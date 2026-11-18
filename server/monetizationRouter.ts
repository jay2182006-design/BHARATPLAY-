import express from 'express';
import crypto from 'node:crypto';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };
import {
  buildAuditWrite,
  docName,
  encodeFields,
  fsCommit,
  fsGetDoc,
  fsListCollection,
  loadAdminMiddleware,
  requireAdminPerm,
  type CeoAuthedRequest,
  type CommitWrite,
} from './ceoRouter.ts';

const FIRESTORE_ROOT = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents`;

// Sliding-window in-memory traffic rate monitor (detects rapid burst clicks / ad spam)
const trafficBurstMap = new Map<string, number[]>();

function detectTrafficBurst(fingerprint: string, maxHitsPerMinute = 8): { isInvalid: boolean; recentCount: number } {
  const now = Date.now();
  const windowMs = 60_000;
  const arr = (trafficBurstMap.get(fingerprint) || []).filter((ts) => now - ts < windowMs);
  arr.push(now);
  trafficBurstMap.set(fingerprint, arr);
  if (trafficBurstMap.size > 5000) {
    // Prune oldest keys to prevent unbounded memory growth
    const firstKey = trafficBurstMap.keys().next().value;
    if (firstKey) trafficBurstMap.delete(firstKey);
  }
  return {
    isInvalid: arr.length > maxHitsPerMinute,
    recentCount: arr.length,
  };
}

const UPI_QR_IMAGE_URL = '/assets/aistudio/qr_codes_68178a7d.jpeg';
const SUPPORTED_UPI_PAYMENT_METHODS = [
  'PhonePe',
  'Google Pay',
  'Paytm',
  'UPI',
  'Other UPI Apps',
] as const;

function getGatewayConfig() {
  const provider = (process.env.PAYMENT_GATEWAY_PROVIDER || '').trim().toLowerCase();
  const keyId = (process.env.PAYMENT_GATEWAY_KEY_ID || '').trim();
  const keySecret = (process.env.PAYMENT_GATEWAY_KEY_SECRET || '').trim();
  const webhookSecret = (process.env.PAYMENT_WEBHOOK_SECRET || '').trim();
  const gatewayConfigured = Boolean(keyId && keySecret);
  return {
    provider: provider || (gatewayConfigured ? 'configured_hmac' : 'upi_qr_manual'),
    keyId,
    keySecret,
    webhookConfigured: Boolean(webhookSecret),
    gatewayConfigured,
    realPaymentsActive: true,
    upiQrEnabled: true,
    qrImageUrl: UPI_QR_IMAGE_URL,
    supportedPaymentMethods: [...SUPPORTED_UPI_PAYMENT_METHODS],
  };
}

function signOrderHmac(orderId: string, paymentId: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
}

function verifyHmacSafe(expected: string, provided: string): boolean {
  if (!expected || !provided) return false;
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Decode raw REST structuredQuery document
function decodeRestVal(val: any): unknown {
  if (!val || typeof val !== 'object') return undefined;
  if ('stringValue' in val) return val.stringValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('timestampValue' in val) return val.timestampValue;
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) return (val.arrayValue?.values || []).map(decodeRestVal);
  if ('mapValue' in val) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val.mapValue?.fields || {})) {
      out[k] = decodeRestVal(v);
    }
    return out;
  }
  return undefined;
}

function decodeRestDoc<T = Record<string, unknown>>(doc: any): T & { id: string } {
  const id = doc?.name ? String(doc.name).split('/').pop() || '' : '';
  const out: Record<string, unknown> = { id };
  for (const [k, v] of Object.entries(doc?.fields || {})) {
    out[k] = decodeRestVal(v);
  }
  return out as T & { id: string };
}

async function fsQueryWhereEqual<T = Record<string, unknown>>(
  idToken: string | null,
  collectionId: string,
  fieldPath: string,
  value: string | boolean,
  limit = 200
): Promise<(T & { id: string })[]> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (idToken) headers.Authorization = `Bearer ${idToken}`;

  const valueObj = typeof value === 'boolean' ? { booleanValue: value } : { stringValue: value };
  const res = await fetch(`${FIRESTORE_ROOT}:runQuery`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        where: {
          fieldFilter: {
            field: { fieldPath },
            op: 'EQUAL',
            value: valueObj,
          },
        },
        limit,
      },
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Firestore query ${collectionId} failed (${res.status}): ${txt}`);
  }
  const rows = (await res.json()) as any[];
  return rows.filter((r) => r.document).map((r) => decodeRestDoc<T>(r.document));
}

async function fsQueryActiveAffiliateByCode(code: string): Promise<Record<string, any> | null> {
  const res = await fetch(`${FIRESTORE_ROOT}:runQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'affiliateLinks' }],
        where: {
          compositeFilter: {
            op: 'AND',
            filters: [
              {
                fieldFilter: {
                  field: { fieldPath: 'code' },
                  op: 'EQUAL',
                  value: { stringValue: code },
                },
              },
              {
                fieldFilter: {
                  field: { fieldPath: 'isActive' },
                  op: 'EQUAL',
                  value: { booleanValue: true },
                },
              },
            ],
          },
        },
        limit: 1,
      },
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Firestore query affiliateLinks failed (${res.status}): ${txt}`);
  }
  const rows = (await res.json()) as any[];
  const hit = rows.find((r) => r.document);
  return hit ? decodeRestDoc<Record<string, any>>(hit.document) : null;
}

function isSafeHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

export function createMonetizationRouter(
  verifyBearerToken: (
    req: CeoAuthedRequest,
    res: express.Response,
    next: express.NextFunction
  ) => Promise<void>
) {
  const router = express.Router();

  // 1. Public Payment Gateway Readiness Check (Never exposes secrets)
  router.get('/monetization/gateway-status', (_req, res) => {
    const cfg = getGatewayConfig();
    res.json({
      gatewayConfigured: cfg.gatewayConfigured,
      realPaymentsActive: cfg.realPaymentsActive,
      provider: cfg.provider,
      webhookConfigured: cfg.webhookConfigured,
      upiQrEnabled: cfg.upiQrEnabled,
      qrImageUrl: cfg.qrImageUrl,
      supportedPaymentMethods: cfg.supportedPaymentMethods,
    });
  });

  // 2. Public Affiliate Tracking Redirect (`/api/r/:code`) with burst invalid-traffic filtering
  router.get('/r/:code', async (req, res) => {
    const code = String(req.params.code || '').trim().slice(0, 32);
    if (!code) {
      res.status(400).json({ error: 'Invalid affiliate code.' });
      return;
    }

    try {
      const link = await fsQueryActiveAffiliateByCode(code);
      if (!link || !link.isActive || !isSafeHttpUrl(String(link.targetUrl || ''))) {
        res.status(404).json({ error: 'Affiliate link not found or inactive.' });
        return;
      }

      const ua = String(req.headers['user-agent'] || '').toLowerCase();
      const ip = String(req.ip || req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
      const isBotUa = /bot|crawler|spider|curl|wget|headless|python-requests/i.test(ua);
      const burst = detectTrafficBurst(`aff:${ip}:${code}`, 5);
      const isInvalidTraffic = isBotUa || burst.isInvalid;

      if (req.query.preview === '1') {
        res.json({
          ok: true,
          code,
          targetUrl: link.targetUrl,
          isInvalidTraffic,
          recentBurstCount: burst.recentCount,
        });
        return;
      }

      res.redirect(302, String(link.targetUrl));
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Unable to resolve affiliate link.' });
    }
  });

  // 3. Ad / Traffic Telemetry Signal (Checks rapid/invalid impression bursts)
  router.post('/monetization/traffic/signal', (req, res) => {
    const { targetType = 'video', targetId = 'unknown' } = req.body || {};
    const ua = String(req.headers['user-agent'] || '').toLowerCase();
    const ip = String(req.ip || req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
    const isBotUa = /bot|crawler|spider|curl|wget|headless/i.test(ua);
    const burst = detectTrafficBurst(`imp:${ip}:${targetType}:${targetId}`, 12);
    const isInvalid = isBotUa || burst.isInvalid;

    res.json({
      ok: true,
      valid: !isInvalid,
      isInvalidTraffic: isInvalid,
      recentWindowHits: burst.recentCount,
    });
  });

  // 4. Server-Verified Payment Intent Creation (Disabled when gateway keys aren't configured)
  router.post('/monetization/payment/create-intent', verifyBearerToken, async (req: CeoAuthedRequest, res) => {
    const cfg = getGatewayConfig();
    if (!cfg.gatewayConfigured) {
      res.status(503).json({
        error:
          'Real payments are currently disabled: payment gateway credentials and backend signature verification are not configured yet.',
        code: 'PAYMENT_GATEWAY_NOT_CONFIGURED',
        gatewayConfigured: false,
        realPaymentsActive: false,
      });
      return;
    }

    const { kind, targetId, creatorId, amountInr } = req.body || {};
    const amt = Math.round(Number(amountInr || 0));
    if (!['support', 'membership', 'paid_video'].includes(kind) || !creatorId || amt < 10 || amt > 50000) {
      res.status(400).json({ error: 'Valid payment kind, creatorId, and INR amount (₹10–₹50,000) required.' });
      return;
    }

    const orderId = `ord_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
    const orderSignature = signOrderHmac(orderId, `${req.uid}:${amt}:${targetId || creatorId}`, cfg.keySecret);

    res.json({
      orderId,
      kind,
      targetId: targetId || creatorId,
      creatorId,
      amountInr: amt,
      currency: 'INR',
      provider: cfg.provider,
      keyId: cfg.keyId,
      orderSignature,
      gatewayConfigured: true,
    });
  });

  // 5. Server-Side HMAC Payment Verification Endpoint (Zero client trust)
  router.post('/monetization/payment/verify', verifyBearerToken, async (req: CeoAuthedRequest, res) => {
    const cfg = getGatewayConfig();
    if (!cfg.gatewayConfigured) {
      res.status(503).json({
        error:
          'Payment verification blocked: payment gateway secret is not configured on the server.',
        code: 'PAYMENT_GATEWAY_NOT_CONFIGURED',
        gatewayConfigured: false,
      });
      return;
    }

    const { orderId, paymentId, signature, kind, targetId, creatorId, amountInr } = req.body || {};
    if (!orderId || !paymentId || !signature || !kind || !creatorId) {
      res.status(400).json({ error: 'orderId, paymentId, signature, kind, and creatorId are required.' });
      return;
    }

    const expectedSig = signOrderHmac(String(orderId), String(paymentId), cfg.keySecret);
    if (!verifyHmacSafe(expectedSig, String(signature))) {
      res.status(403).json({
        error: 'Payment signature verification failed. Transaction rejected.',
        code: 'INVALID_PAYMENT_SIGNATURE',
      });
      return;
    }

    // Verified cryptographic payment signature accepted. Record receipt status cleanly.
    res.json({
      verified: true,
      orderId,
      paymentId,
      kind,
      targetId: targetId || creatorId,
      creatorId,
      amountInr: Math.round(Number(amountInr || 0)),
      verifiedAt: new Date().toISOString(),
    });
  });

  // 5b. Submit UPI QR Payment UTR for CEO / Admin Verification (NEVER auto-approves)
  router.post('/monetization/qr-payment/submit', verifyBearerToken, async (req: CeoAuthedRequest, res) => {
    if (!req.uid || !req.idToken || req.emailVerified !== true) {
      res.status(403).json({ error: 'Verified account required to submit payment confirmations.' });
      return;
    }

    const {
      paymentMethod,
      amountInr,
      utrNumber,
      serviceType,
      targetId,
      targetTitle,
      creatorId,
      creatorName,
      note,
    } = req.body || {};

    const cleanMethod = String(paymentMethod || '').trim();
    if (!SUPPORTED_UPI_PAYMENT_METHODS.includes(cleanMethod as any)) {
      res.status(400).json({ error: 'Select a valid UPI payment method (PhonePe, Google Pay, Paytm, UPI, or Other UPI Apps).' });
      return;
    }

    const cleanUtr = String(utrNumber || '').trim().toUpperCase().replace(/\s+/g, '');
    if (cleanUtr.length < 6 || cleanUtr.length > 40 || !/^[A-Z0-9_-]+$/.test(cleanUtr)) {
      res.status(400).json({ error: 'Enter a valid 6–40 character UTR / Transaction Reference ID (letters, digits, hyphen, or underscore).' });
      return;
    }

    const cleanServiceType = String(serviceType || '').trim();
    if (!['paid_video', 'membership', 'support', 'creator_boost_pass', 'platform_service'].includes(cleanServiceType)) {
      res.status(400).json({ error: 'Invalid payment service type.' });
      return;
    }

    const cleanTargetId = String(targetId || '').trim();
    if (!cleanTargetId || !/^[A-Za-z0-9_.-]+$/.test(cleanTargetId) || cleanTargetId.length > 128) {
      res.status(400).json({ error: 'Valid targetId is required.' });
      return;
    }

    let amt = Math.round(Number(amountInr || 0));
    if (amt < 1 || amt > 500000) {
      res.status(400).json({ error: 'Payment amount must be between ₹1 and ₹5,00,000.' });
      return;
    }

    try {
      const idToken = req.idToken;
      const uid = req.uid;

      // Enforce per-collection minimum constraints & server pricing truth
      const [userDoc, cfgDoc, existingUserPayments] = await Promise.all([
        fsGetDoc<Record<string, any>>(idToken, `users/${uid}`).catch(() => null),
        fsGetDoc<Record<string, any>>(idToken, 'platformConfig/settings').catch(() => null),
        fsQueryWhereEqual<Record<string, any>>(idToken, 'paymentTransactions', 'userId', uid, 200).catch(() => []),
      ]);

      const duplicateForUser = existingUserPayments.find(
        (p) => String(p.utrNumber || '').toUpperCase() === cleanUtr && p.status !== 'rejected'
      );
      if (duplicateForUser) {
        res.status(409).json({
          error: `UTR ${cleanUtr} was already submitted and is ${duplicateForUser.status.replace('_', ' ')}.`,
        });
        return;
      }

      let resolvedTargetTitle = String(targetTitle || cleanTargetId).trim().slice(0, 150) || cleanTargetId;
      let resolvedCreatorId = String(creatorId || 'platform').trim().slice(0, 128) || 'platform';
      let resolvedCreatorName = String(creatorName || 'BharatPlay').trim().slice(0, 80) || 'BharatPlay';

      if (cleanServiceType === 'paid_video') {
        const videoDoc = await fsGetDoc<Record<string, any>>(idToken, `videos/${cleanTargetId}`).catch(() => null);
        if (!videoDoc) {
          res.status(404).json({ error: 'Target paid video not found.' });
          return;
        }
        const priceFloor = Math.max(10, Math.round(Number(videoDoc.priceInr || 10)));
        if (amt < priceFloor) {
          res.status(400).json({ error: `Minimum payment for this video is ₹${priceFloor}.` });
          return;
        }
        resolvedTargetTitle = String(videoDoc.title || resolvedTargetTitle).slice(0, 150);
        resolvedCreatorId = String(videoDoc.creatorId || resolvedCreatorId).slice(0, 128);
        resolvedCreatorName = String(videoDoc.creatorName || resolvedCreatorName).slice(0, 80);
      } else if (cleanServiceType === 'membership') {
        const planDoc = await fsGetDoc<Record<string, any>>(idToken, `membershipPlans/${cleanTargetId}`).catch(() => null);
        if (!planDoc) {
          res.status(404).json({ error: 'Selected membership plan not found.' });
          return;
        }
        const priceFloor = Math.max(29, Math.round(Number(planDoc.priceInr || 29)));
        if (amt < priceFloor) {
          res.status(400).json({ error: `Minimum payment for ${planDoc.name || 'this plan'} is ₹${priceFloor}.` });
          return;
        }
        resolvedTargetTitle = String(planDoc.name || resolvedTargetTitle).slice(0, 150);
        resolvedCreatorId = String(planDoc.creatorId || resolvedCreatorId).slice(0, 128);
        resolvedCreatorName = String(planDoc.creatorName || resolvedCreatorName).slice(0, 80);
      } else if (cleanServiceType === 'support') {
        if (amt < 10 || amt > 50000) {
          res.status(400).json({ error: 'Creator Support amount must be between ₹10 and ₹50,000.' });
          return;
        }
      }

      if (!/^[A-Za-z0-9_.-]+$/.test(resolvedCreatorId)) {
        resolvedCreatorId = 'platform';
      }

      const buyerName = String(userDoc?.displayName || req.userEmail?.split('@')[0] || 'BharatPlay Member')
        .trim()
        .slice(0, 80) || 'BharatPlay Member';

      const paymentId = `pay_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
      const writes: CommitWrite[] = [];
      let serviceRecordId = '';

      if (cleanServiceType === 'paid_video') {
        serviceRecordId = `vp_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
        const sharePct = Math.min(95, Math.max(10, Number(cfgDoc?.paidVideoSharePercent ?? cfgDoc?.creatorRevenueSharePercent ?? 80)));
        const creatorNetInr = Math.round((amt * sharePct) / 100);
        const platformFeeInr = Math.max(0, amt - creatorNetInr);
        writes.push({
          update: {
            name: docName(`videoPurchases/${serviceRecordId}`),
            fields: encodeFields({
              videoId: cleanTargetId,
              videoTitle: resolvedTargetTitle,
              creatorId: resolvedCreatorId,
              creatorName: resolvedCreatorName,
              buyerId: uid,
              buyerName,
              amountInr: amt,
              creatorNetInr,
              platformFeeInr,
              paymentOrderId: paymentId,
              paymentVerified: false,
              status: 'pending_verification',
            }),
          },
          currentDocument: { exists: false },
          updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
        });
      } else if (cleanServiceType === 'membership') {
        serviceRecordId = `mem_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
        writes.push({
          update: {
            name: docName(`creatorMemberships/${serviceRecordId}`),
            fields: encodeFields({
              planId: cleanTargetId,
              planName: resolvedTargetTitle.slice(0, 60),
              creatorId: resolvedCreatorId,
              creatorName: resolvedCreatorName,
              memberId: uid,
              memberName: buyerName,
              priceInr: amt,
              status: 'pending',
              paymentOrderId: paymentId,
              paymentVerified: false,
            }),
          },
          currentDocument: { exists: false },
          updateTransforms: [
            { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
            { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
          ],
        });
      } else if (cleanServiceType === 'support') {
        serviceRecordId = `sup_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
        writes.push({
          update: {
            name: docName(`creatorSupports/${serviceRecordId}`),
            fields: encodeFields({
              supporterId: uid,
              supporterName: buyerName,
              creatorId: resolvedCreatorId,
              creatorName: resolvedCreatorName,
              amountInr: amt,
              message: String(note || '').trim().slice(0, 280),
              paymentOrderId: paymentId,
              paymentVerified: false,
              status: 'pending_verification',
            }),
          },
          currentDocument: { exists: false },
          updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
        });
      }

      const paymentFields: Record<string, unknown> = {
        userId: uid,
        userName: buyerName,
        paymentMethod: cleanMethod,
        amountInr: amt,
        utrNumber: cleanUtr,
        serviceType: cleanServiceType,
        targetId: cleanTargetId,
        targetTitle: resolvedTargetTitle,
        creatorId: resolvedCreatorId,
        creatorName: resolvedCreatorName,
        qrCodeImage: UPI_QR_IMAGE_URL,
        status: 'pending_verification',
        serviceActivated: false,
      };
      if (req.userEmail) paymentFields.userEmail = String(req.userEmail).slice(0, 160);
      if (serviceRecordId) paymentFields.serviceRecordId = serviceRecordId;
      const cleanNote = String(note || '').trim().slice(0, 280);
      if (cleanNote) paymentFields.note = cleanNote;

      writes.push({
        update: {
          name: docName(`paymentTransactions/${paymentId}`),
          fields: encodeFields(paymentFields),
        },
        currentDocument: { exists: false },
        updateTransforms: [
          { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
          { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
        ],
      });

      await fsCommit(idToken, writes);

      res.status(201).json({
        ok: true,
        paymentId,
        status: 'pending_verification',
        serviceActivated: false,
        utrNumber: cleanUtr,
        paymentMethod: cleanMethod,
        amountInr: amt,
        serviceType: cleanServiceType,
        targetId: cleanTargetId,
        targetTitle: resolvedTargetTitle,
        serviceRecordId: serviceRecordId || undefined,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Unable to submit payment confirmation.' });
    }
  });

  // 5c. User's Own UPI Payment History
  router.get('/monetization/qr-payment/my-history', verifyBearerToken, async (req: CeoAuthedRequest, res) => {
    if (!req.uid || !req.idToken) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    try {
      const items = await fsQueryWhereEqual<Record<string, any>>(
        req.idToken,
        'paymentTransactions',
        'userId',
        req.uid,
        250
      );
      items.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
      res.json({ payments: items });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Unable to load payment history.' });
    }
  });

  // 6. Accept Creator Monetization Terms & Payment Rules
  router.post('/monetization/creator/terms', verifyBearerToken, async (req: CeoAuthedRequest, res) => {
    if (!req.uid || !req.idToken || req.emailVerified !== true) {
      res.status(403).json({ error: 'Verified account required.' });
      return;
    }
    try {
      const acceptedAt = new Date().toISOString();
      await fsCommit(req.idToken, [
        {
          update: {
            name: docName(`users/${req.uid}/private/account`),
            fields: encodeFields({
              monetizationTermsAcceptedAt: acceptedAt,
            }),
          },
          updateMask: { fieldPaths: ['monetizationTermsAcceptedAt', 'updatedAt'] },
          updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
        },
      ]);
      res.json({ ok: true, acceptedAt });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Unable to record creator terms acceptance.' });
    }
  });

  // 7. Verified Creator Earnings Summary (Strictly Verified Ledger Only — Never Fake Estimates)
  router.get('/monetization/creator/summary', verifyBearerToken, async (req: CeoAuthedRequest, res) => {
    if (!req.uid || !req.idToken) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    try {
      const idToken = req.idToken;
      const uid = req.uid;

      const [txs, payouts, adRecords, supports, memberships, purchases, affiliates, privAccount] = await Promise.all([
        fsQueryWhereEqual<Record<string, any>>(idToken, 'monetizationTransactions', 'creatorId', uid, 300).catch(() => []),
        fsQueryWhereEqual<Record<string, any>>(idToken, 'creatorPayouts', 'creatorId', uid, 200).catch(() => []),
        fsQueryWhereEqual<Record<string, any>>(idToken, 'adRevenueRecords', 'creatorId', uid, 200).catch(() => []),
        fsQueryWhereEqual<Record<string, any>>(idToken, 'creatorSupports', 'creatorId', uid, 200).catch(() => []),
        fsQueryWhereEqual<Record<string, any>>(idToken, 'creatorMemberships', 'creatorId', uid, 200).catch(() => []),
        fsQueryWhereEqual<Record<string, any>>(idToken, 'videoPurchases', 'creatorId', uid, 200).catch(() => []),
        fsQueryWhereEqual<Record<string, any>>(idToken, 'affiliateLinks', 'creatorId', uid, 100).catch(() => []),
        fsGetDoc<Record<string, any>>(idToken, `users/${uid}/private/account`).catch(() => null),
      ]);

      const streams = {
        adRevenueInr: 0,
        membershipInr: 0,
        supportInr: 0,
        brandConnectInr: 0,
        affiliateInr: 0,
        paidVideoInr: 0,
      };

      let settledCreditsInr = 0;
      let pendingCreditsInr = 0;
      let reversedDeductionsInr = 0;

      for (const tx of txs) {
        const net = Number(tx.netCreatorInr || 0);
        if (tx.source === 'payout') continue;
        if (tx.status === 'settled' && tx.gatewayVerified) {
          settledCreditsInr += net;
          if (tx.source === 'ad_revenue') streams.adRevenueInr += net;
          else if (tx.source === 'membership') streams.membershipInr += net;
          else if (tx.source === 'support') streams.supportInr += net;
          else if (tx.source === 'brand_connect') streams.brandConnectInr += net;
          else if (tx.source === 'affiliate') streams.affiliateInr += net;
          else if (tx.source === 'paid_video') streams.paidVideoInr += net;
        } else if (tx.status === 'pending' || tx.status === 'held') {
          pendingCreditsInr += net;
        } else if (tx.status === 'reversed' || tx.status === 'disputed') {
          reversedDeductionsInr += Math.abs(net);
        }
      }

      // Include pending unverified ad/affiliate records purely in pendingBalanceInr (NEVER in availableBalanceInr)
      const pendingAds = adRecords
        .filter((r) => r.status === 'pending')
        .reduce((s, r) => s + Number(r.creatorNetInr || 0), 0);

      const paidOutTotalInr = payouts
        .filter((p) => p.status === 'paid')
        .reduce((s, p) => s + Number(p.amountInr || 0), 0);
      const pendingPayoutsTotalInr = payouts
        .filter((p) => p.status === 'pending' || p.status === 'approved')
        .reduce((s, p) => s + Number(p.amountInr || 0), 0);

      // Available withdrawable balance strictly equals settled ledger credits minus payouts & reversals
      const computedAvailable = Math.max(
        0,
        settledCreditsInr - reversedDeductionsInr - paidOutTotalInr - pendingPayoutsTotalInr
      );

      // Honor CEO direct adjustment if higher verified ledger balance exists, without fabricating view estimates
      const availableBalanceInr = Math.max(
        computedAvailable,
        Number(privAccount?.availableBalanceInr ?? privAccount?.estimatedEarningsInr ?? 0)
      );

      res.json({
        summary: {
          availableBalanceInr,
          pendingBalanceInr: pendingCreditsInr + pendingAds,
          lifetimeEarningsInr: settledCreditsInr + Number(privAccount?.lifetimeEarningsInr ?? 0),
          paidOutTotalInr,
          pendingPayoutsTotalInr,
          unverifiedEstimateInr: 0,
          streams,
        },
        transactions: txs,
        adRecords,
        supports,
        memberships,
        purchases,
        affiliates,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Unable to compute creator earnings summary.' });
    }
  });

  // --- Governance Endpoints (CEO or Admin with explicit `manageMonetization` permission) ---
  const monetizationGovRouter = express.Router();
  monetizationGovRouter.use(verifyBearerToken);
  monetizationGovRouter.use(loadAdminMiddleware);
  monetizationGovRouter.use(requireAdminPerm('manageMonetization'));

  // 8. Governance Overview
  monetizationGovRouter.get('/monetization/governance/overview', async (req: CeoAuthedRequest, res) => {
    try {
      const idToken = req.idToken!;
      const [
        adRevenueRecords,
        brandCampaigns,
        brandApplications,
        invalidTrafficFlags,
        paymentDisputes,
        monetizationTransactions,
        videoPurchases,
        creatorMemberships,
        affiliateLinks,
        payouts,
        paymentTransactions,
        platformConfig,
      ] = await Promise.all([
        fsListCollection<Record<string, any>>(idToken, 'adRevenueRecords', 250).catch(() => []),
        fsListCollection<Record<string, any>>(idToken, 'brandCampaigns', 100).catch(() => []),
        fsListCollection<Record<string, any>>(idToken, 'brandApplications', 250).catch(() => []),
        fsListCollection<Record<string, any>>(idToken, 'invalidTrafficFlags', 250).catch(() => []),
        fsListCollection<Record<string, any>>(idToken, 'paymentDisputes', 250).catch(() => []),
        fsListCollection<Record<string, any>>(idToken, 'monetizationTransactions', 300).catch(() => []),
        fsListCollection<Record<string, any>>(idToken, 'videoPurchases', 250).catch(() => []),
        fsListCollection<Record<string, any>>(idToken, 'creatorMemberships', 250).catch(() => []),
        fsListCollection<Record<string, any>>(idToken, 'affiliateLinks', 250).catch(() => []),
        fsListCollection<Record<string, any>>(idToken, 'creatorPayouts', 250).catch(() => []),
        fsListCollection<Record<string, any>>(idToken, 'paymentTransactions', 300).catch(() => []),
        fsGetDoc<Record<string, any>>(idToken, 'platformConfig/settings').catch(() => null),
      ]);

      res.json({
        gatewayStatus: getGatewayConfig(),
        adRevenueRecords,
        brandCampaigns,
        brandApplications,
        invalidTrafficFlags,
        paymentDisputes,
        monetizationTransactions,
        videoPurchases,
        creatorMemberships,
        affiliateLinks,
        payouts,
        paymentTransactions,
        platformConfig,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Unable to load monetization governance telemetry.' });
    }
  });

  // 9. Record or Verify Ad Revenue (CEO or manageMonetization)
  monetizationGovRouter.post('/monetization/governance/ad-revenue', async (req: CeoAuthedRequest, res) => {
    const {
      action = 'record',
      recordId,
      videoId,
      videoTitle,
      creatorId,
      creatorName,
      periodLabel,
      validImpressions,
      invalidImpressionsBlocked,
      grossAdRevenueInr,
      status = 'verified',
      notes,
    } = req.body || {};

    try {
      const idToken = req.idToken!;
      const cfg = await fsGetDoc<Record<string, any>>(idToken, 'platformConfig/settings').catch(() => null);
      const sharePct = Math.min(
        95,
        Math.max(10, Number(cfg?.adSharePercent ?? cfg?.creatorRevenueSharePercent ?? 75))
      );
      const writes: CommitWrite[] = [];

      if (action === 'record') {
        if (!videoId || !creatorId || Number(grossAdRevenueInr || 0) < 0) {
          res.status(400).json({ error: 'videoId, creatorId, and non-negative grossAdRevenueInr are required.' });
          return;
        }
        const gross = Math.round(Number(grossAdRevenueInr || 0));
        const net = Math.round((gross * sharePct) / 100);
        const recId = `adr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        const finalStatus = req.isCeo && status === 'verified' ? 'verified' : 'pending';

        writes.push({
          update: {
            name: docName(`adRevenueRecords/${recId}`),
            fields: encodeFields({
              videoId: String(videoId).slice(0, 128),
              videoTitle: String(videoTitle || videoId).slice(0, 150),
              creatorId: String(creatorId).slice(0, 128),
              creatorName: String(creatorName || 'Creator').slice(0, 80),
              periodLabel: String(periodLabel || 'Current Cycle').slice(0, 60),
              validImpressions: Math.max(0, Math.round(Number(validImpressions || 0))),
              invalidImpressionsBlocked: Math.max(0, Math.round(Number(invalidImpressionsBlocked || 0))),
              grossAdRevenueInr: gross,
              creatorSharePercent: sharePct,
              creatorNetInr: net,
              status: finalStatus,
              notes: String(notes || '').slice(0, 300),
            }),
          },
          currentDocument: { exists: false },
          updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
        });

        // Only CEO writes settled ledger transaction & credits availableBalanceInr
        if (req.isCeo && finalStatus === 'verified' && net > 0) {
          const txId = `tx_${recId}`;
          writes.push({
            update: {
              name: docName(`monetizationTransactions/${txId}`),
              fields: encodeFields({
                creatorId: String(creatorId).slice(0, 128),
                counterpartyId: req.uid!,
                counterpartyName: 'BharatPlay Ad Exchange',
                source: 'ad_revenue',
                grossInr: gross,
                platformFeeInr: Math.max(0, gross - net),
                netCreatorInr: net,
                status: 'settled',
                referenceId: recId,
                gatewayVerified: true,
                description: `Verified Ad Revenue (${sharePct}% share) · ${String(videoTitle || videoId).slice(0, 80)}`,
              }),
            },
            currentDocument: { exists: false },
            updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
          });
        }

        writes.push(
          buildAuditWrite({
            actorUid: req.uid!,
            actorEmail: req.userEmail || '',
            actorRole: req.isCeo ? 'ceo' : 'admin',
            action: 'record_ad_revenue',
            targetType: 'monetization',
            targetId: recId,
            targetLabel: `${videoTitle || videoId} · ₹${net}`,
            reason: notes || `Recorded ad revenue (${finalStatus})`,
            status: 'success',
          })
        );
      } else if (action === 'update_status' && recordId) {
        if (!['pending', 'verified', 'invalidated'].includes(status)) {
          res.status(400).json({ error: 'Invalid ad revenue status.' });
          return;
        }
        if (status === 'verified' && !req.isCeo) {
          res.status(403).json({ error: 'Only Platform CEO can settle verified ad revenue into payouts.' });
          return;
        }
        writes.push({
          update: {
            name: docName(`adRevenueRecords/${recordId}`),
            fields: encodeFields({
              status,
              notes: String(notes || `Marked ${status}`).slice(0, 300),
            }),
          },
          updateMask: { fieldPaths: ['status', 'notes'] },
        });
        writes.push(
          buildAuditWrite({
            actorUid: req.uid!,
            actorEmail: req.userEmail || '',
            actorRole: req.isCeo ? 'ceo' : 'admin',
            action: `ad_revenue_${status}`,
            targetType: 'monetization',
            targetId: recordId,
            reason: notes || `Ad revenue record marked ${status}`,
            status: 'success',
          })
        );
      } else {
        res.status(400).json({ error: 'Unsupported ad revenue action.' });
        return;
      }

      await fsCommit(idToken, writes);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to update ad revenue record.' });
    }
  });

  // 10. Invalid Traffic Detection & Enforcement
  monetizationGovRouter.post('/monetization/governance/invalid-traffic', async (req: CeoAuthedRequest, res) => {
    const {
      action = 'flag',
      flagId,
      targetType = 'video',
      targetId,
      creatorId,
      creatorName,
      signalType,
      suspiciousCount,
      estimatedImpactInr,
      severity = 'medium',
      status,
      notes,
      deductRecordId,
    } = req.body || {};

    try {
      const idToken = req.idToken!;
      const writes: CommitWrite[] = [];

      if (action === 'flag') {
        if (!targetId || !creatorId || !signalType) {
          res.status(400).json({ error: 'targetId, creatorId, and signalType are required.' });
          return;
        }
        const id = `itf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        writes.push({
          update: {
            name: docName(`invalidTrafficFlags/${id}`),
            fields: encodeFields({
              targetType: ['video', 'affiliate', 'creator'].includes(targetType) ? targetType : 'video',
              targetId: String(targetId).slice(0, 128),
              creatorId: String(creatorId).slice(0, 128),
              creatorName: String(creatorName || 'Creator').slice(0, 80),
              signalType: String(signalType).slice(0, 120),
              suspiciousCount: Math.max(0, Math.round(Number(suspiciousCount || 0))),
              estimatedImpactInr: Math.max(0, Math.round(Number(estimatedImpactInr || 0))),
              severity: ['low', 'medium', 'high'].includes(severity) ? severity : 'medium',
              status: 'open',
              notes: String(notes || '').slice(0, 400),
            }),
          },
          currentDocument: { exists: false },
          updateTransforms: [
            { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
            { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
          ],
        });
        writes.push(
          buildAuditWrite({
            actorUid: req.uid!,
            actorEmail: req.userEmail || '',
            actorRole: req.isCeo ? 'ceo' : 'admin',
            action: 'flag_invalid_traffic',
            targetType: 'traffic',
            targetId: id,
            targetLabel: `${creatorName || creatorId} · ${signalType}`,
            reason: notes || signalType,
            status: 'success',
          })
        );
      } else if (action === 'resolve' && flagId) {
        if (!['confirmed_invalid', 'cleared'].includes(status)) {
          res.status(400).json({ error: 'Invalid resolution status.' });
          return;
        }
        writes.push({
          update: {
            name: docName(`invalidTrafficFlags/${flagId}`),
            fields: encodeFields({
              status,
              notes: String(notes || `Marked ${status}`).slice(0, 400),
            }),
          },
          updateMask: { fieldPaths: ['status', 'notes', 'updatedAt'] },
          updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
        });

        if (status === 'confirmed_invalid' && deductRecordId) {
          writes.push({
            update: {
              name: docName(`adRevenueRecords/${deductRecordId}`),
              fields: encodeFields({
                status: 'invalidated',
                notes: `Invalidated due to IVT flag ${flagId}`,
              }),
            },
            updateMask: { fieldPaths: ['status', 'notes'] },
          });
        }

        writes.push(
          buildAuditWrite({
            actorUid: req.uid!,
            actorEmail: req.userEmail || '',
            actorRole: req.isCeo ? 'ceo' : 'admin',
            action: `ivt_${status}`,
            targetType: 'traffic',
            targetId: flagId,
            reason: notes || `Invalid traffic flag marked ${status}`,
            status: 'success',
          })
        );
      } else {
        res.status(400).json({ error: 'Unsupported invalid traffic action.' });
        return;
      }

      await fsCommit(idToken, writes);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to update invalid traffic flag.' });
    }
  });

  // 11. Payment Disputes Resolution
  monetizationGovRouter.post('/monetization/governance/disputes', async (req: CeoAuthedRequest, res) => {
    const { disputeId, status, resolutionNote } = req.body || {};
    if (!disputeId || !['investigating', 'resolved', 'refunded', 'rejected'].includes(status)) {
      res.status(400).json({ error: 'Valid disputeId and status are required.' });
      return;
    }
    if (status === 'refunded' && !req.isCeo) {
      res.status(403).json({ error: 'Only Platform CEO can execute ledger refunds on disputed payouts.' });
      return;
    }

    try {
      const idToken = req.idToken!;
      const dispute = await fsGetDoc<Record<string, any>>(idToken, `paymentDisputes/${disputeId}`);
      if (!dispute) {
        res.status(404).json({ error: 'Dispute ticket not found.' });
        return;
      }

      const writes: CommitWrite[] = [
        {
          update: {
            name: docName(`paymentDisputes/${disputeId}`),
            fields: encodeFields({
              status,
              resolutionNote: String(resolutionNote || `Marked ${status}`).slice(0, 400),
            }),
          },
          updateMask: { fieldPaths: ['status', 'resolutionNote', 'updatedAt'] },
          updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
        },
        buildAuditWrite({
          actorUid: req.uid!,
          actorEmail: req.userEmail || '',
          actorRole: req.isCeo ? 'ceo' : 'admin',
          action: `dispute_${status}`,
          targetType: 'dispute',
          targetId: disputeId,
          targetLabel: `${dispute.creatorName || dispute.creatorId} · ₹${dispute.amountInr}`,
          reason: String(resolutionNote || dispute.reason || `Dispute marked ${status}`).slice(0, 500),
          status: 'success',
        }),
      ];

      await fsCommit(idToken, writes);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to update payment dispute.' });
    }
  });

  // 12. Brand Connect Campaigns & Application Settlements
  monetizationGovRouter.post('/monetization/governance/brand-connect', async (req: CeoAuthedRequest, res) => {
    const {
      action,
      campaignId,
      brandName,
      title,
      description,
      budgetInr,
      category,
      deliverables,
      deadline,
      campaignStatus,
      applicationId,
      appStatus,
      reviewNotes,
    } = req.body || {};

    try {
      const idToken = req.idToken!;
      const writes: CommitWrite[] = [];

      if (action === 'create_campaign') {
        const cleanTitle = String(title || '').trim();
        const cleanBrand = String(brandName || '').trim();
        if (cleanTitle.length < 3 || cleanBrand.length < 2) {
          res.status(400).json({ error: 'Brand name and campaign title are required.' });
          return;
        }
        const id = `cmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        writes.push({
          update: {
            name: docName(`brandCampaigns/${id}`),
            fields: encodeFields({
              brandName: cleanBrand.slice(0, 80),
              brandId: req.uid!,
              title: cleanTitle.slice(0, 120),
              description: String(description || 'Creator sponsorship collaboration').slice(0, 1000),
              budgetInr: Math.max(500, Math.round(Number(budgetInr || 10000))),
              category: String(category || 'Tech').slice(0, 50),
              deliverables: String(deliverables || '1 Dedicated Video + 1 Bharat Short').slice(0, 500),
              deadline: String(deadline || '2026-12-31').slice(0, 40),
              status: 'open',
            }),
          },
          currentDocument: { exists: false },
          updateTransforms: [
            { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
            { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
          ],
        });
        writes.push(
          buildAuditWrite({
            actorUid: req.uid!,
            actorEmail: req.userEmail || '',
            actorRole: req.isCeo ? 'ceo' : 'admin',
            action: 'create_brand_campaign',
            targetType: 'brand',
            targetId: id,
            targetLabel: `${cleanBrand} · ${cleanTitle}`,
            reason: `Published Brand Connect campaign (${cleanBrand})`,
            status: 'success',
          })
        );
      } else if (action === 'update_campaign' && campaignId) {
        if (!['open', 'in_progress', 'completed', 'closed'].includes(campaignStatus)) {
          res.status(400).json({ error: 'Invalid campaign status.' });
          return;
        }
        writes.push({
          update: {
            name: docName(`brandCampaigns/${campaignId}`),
            fields: encodeFields({ status: campaignStatus }),
          },
          updateMask: { fieldPaths: ['status', 'updatedAt'] },
          updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
        });
      } else if (action === 'review_application' && applicationId) {
        if (!['shortlisted', 'approved', 'paid', 'rejected'].includes(appStatus)) {
          res.status(400).json({ error: 'Invalid application status.' });
          return;
        }
        if (appStatus === 'paid' && !req.isCeo) {
          res.status(403).json({ error: 'Only Platform CEO can settle sponsorship payout into creator ledger.' });
          return;
        }
        const appDoc = await fsGetDoc<Record<string, any>>(idToken, `brandApplications/${applicationId}`);
        if (!appDoc) {
          res.status(404).json({ error: 'Brand application not found.' });
          return;
        }

        writes.push({
          update: {
            name: docName(`brandApplications/${applicationId}`),
            fields: encodeFields({
              status: appStatus,
              reviewNotes: String(reviewNotes || `Marked ${appStatus}`).slice(0, 300),
            }),
          },
          updateMask: { fieldPaths: ['status', 'reviewNotes', 'updatedAt'] },
          updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
        });

        if (req.isCeo && appStatus === 'paid') {
          const fee = Math.round(Number(appDoc.proposedFeeInr || 0));
          const net = Math.round(fee * 0.9); // 90% creator sponsorship payout (10% Brand Connect platform fee)
          const txId = `tx_brand_${applicationId}`;
          writes.push({
            update: {
              name: docName(`monetizationTransactions/${txId}`),
              fields: encodeFields({
                creatorId: appDoc.creatorId,
                counterpartyId: req.uid!,
                counterpartyName: appDoc.brandName || 'Brand Connect Partner',
                source: 'brand_connect',
                grossInr: fee,
                platformFeeInr: Math.max(0, fee - net),
                netCreatorInr: net,
                status: 'settled',
                referenceId: applicationId,
                gatewayVerified: true,
                description: `Brand Connect Sponsorship Settled · ${appDoc.campaignTitle || applicationId}`,
              }),
            },
            updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
          });
        }

        writes.push(
          buildAuditWrite({
            actorUid: req.uid!,
            actorEmail: req.userEmail || '',
            actorRole: req.isCeo ? 'ceo' : 'admin',
            action: `brand_app_${appStatus}`,
            targetType: 'brand',
            targetId: applicationId,
            targetLabel: `${appDoc.creatorName || appDoc.creatorId} · ${appDoc.campaignTitle}`,
            reason: String(reviewNotes || `Application ${appStatus}`).slice(0, 500),
            status: 'success',
          })
        );
      } else {
        res.status(400).json({ error: 'Unsupported Brand Connect governance action.' });
        return;
      }

      await fsCommit(idToken, writes);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to update Brand Connect record.' });
    }
  });

  // 13. CEO / Admin Manual UPI QR Payment Verification & Service Activation
  monetizationGovRouter.post('/monetization/governance/qr-payments/verify', async (req: CeoAuthedRequest, res) => {
    const { paymentId, decision, reason } = req.body || {};
    if (!paymentId || !['approve', 'reject'].includes(String(decision))) {
      res.status(400).json({ error: 'Valid paymentId and decision (approve | reject) are required.' });
      return;
    }

    try {
      const idToken = req.idToken!;
      const txDoc = await fsGetDoc<Record<string, any>>(idToken, `paymentTransactions/${paymentId}`).catch(() => null);
      if (!txDoc) {
        res.status(404).json({ error: 'Payment transaction record not found.' });
        return;
      }
      if (txDoc.status !== 'pending_verification') {
        res.status(400).json({ error: `Payment ${paymentId} is already ${txDoc.status}.` });
        return;
      }

      const approve = decision === 'approve';
      const verifiedAt = new Date().toISOString();
      const actorRole: 'ceo' | 'admin' = req.isCeo ? 'ceo' : 'admin';
      const amt = Math.round(Number(txDoc.amountInr || 0));
      const serviceType = String(txDoc.serviceType || '');
      const serviceRecordId = String(txDoc.serviceRecordId || '');
      const creatorId = String(txDoc.creatorId || 'platform');
      const creatorName = String(txDoc.creatorName || 'BharatPlay');
      const cleanUtr = String(txDoc.utrNumber || '').trim();
      const cleanReason = String(reason || (approve ? 'UPI UTR verified by governance' : 'UTR could not be reconciled against bank/UPI statement')).trim().slice(0, 300);

      if (approve && cleanUtr) {
        const sameUtrRows = await fsQueryWhereEqual<Record<string, any>>(
          idToken,
          'paymentTransactions',
          'utrNumber',
          cleanUtr,
          10
        ).catch(() => []);
        const alreadyApproved = sameUtrRows.find((r) => r.id !== paymentId && r.status === 'approved');
        if (alreadyApproved) {
          res.status(409).json({
            error: `Duplicate UTR detected: ${cleanUtr} was already approved on transaction ${alreadyApproved.id}.`,
          });
          return;
        }
      }

      const writes: CommitWrite[] = [];

      // 1. Update paymentTransactions document
      const updateMaskPaths = [
        'status',
        'serviceActivated',
        'verifiedByUid',
        'verifiedByRole',
        'verifiedAt',
        'updatedAt',
      ];
      const updateFields: Record<string, unknown> = {
        status: approve ? 'approved' : 'rejected',
        serviceActivated: approve,
        verifiedByUid: req.uid!,
        verifiedByRole: actorRole,
        verifiedAt,
      };
      if (!approve) {
        updateFields.rejectionReason = cleanReason;
        updateMaskPaths.push('rejectionReason');
      }

      writes.push({
        update: {
          name: docName(`paymentTransactions/${paymentId}`),
          fields: encodeFields(updateFields),
        },
        updateMask: { fieldPaths: updateMaskPaths },
        updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
      });

      // 2. Activate or reject linked service entitlement
      if (serviceRecordId) {
        if (serviceType === 'paid_video') {
          const vpDoc = await fsGetDoc<Record<string, any>>(idToken, `videoPurchases/${serviceRecordId}`).catch(() => null);
          if (vpDoc) {
            writes.push({
              update: {
                name: docName(`videoPurchases/${serviceRecordId}`),
                fields: encodeFields({
                  paymentVerified: approve,
                  status: approve ? 'verified' : 'rejected',
                }),
              },
              updateMask: { fieldPaths: ['paymentVerified', 'status'] },
            });
          }
        } else if (serviceType === 'membership') {
          const memDoc = await fsGetDoc<Record<string, any>>(idToken, `creatorMemberships/${serviceRecordId}`).catch(() => null);
          if (memDoc) {
            const memFields: Record<string, unknown> = {
              paymentVerified: approve,
              status: approve ? 'active' : 'rejected',
            };
            const memPaths = ['paymentVerified', 'status', 'updatedAt'];
            if (approve) {
              memFields.renewsAt = new Date(Date.now() + 30 * 86400_000).toISOString();
              memPaths.push('renewsAt');
            }
            writes.push({
              update: {
                name: docName(`creatorMemberships/${serviceRecordId}`),
                fields: encodeFields(memFields),
              },
              updateMask: { fieldPaths: memPaths },
              updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
            });
          }
        } else if (serviceType === 'support') {
          const supDoc = await fsGetDoc<Record<string, any>>(idToken, `creatorSupports/${serviceRecordId}`).catch(() => null);
          if (supDoc) {
            writes.push({
              update: {
                name: docName(`creatorSupports/${serviceRecordId}`),
                fields: encodeFields({
                  paymentVerified: approve,
                  status: approve ? 'verified' : 'rejected',
                }),
              },
              updateMask: { fieldPaths: ['paymentVerified', 'status'] },
            });
          }
        }
      }

      // 3. Activate Creator Boost if serviceType === 'creator_boost_pass'
      if (approve && serviceType === 'creator_boost_pass' && txDoc.userId) {
        const buyerProfile = await fsGetDoc<Record<string, any>>(idToken, `users/${txDoc.userId}`).catch(() => null);
        if (buyerProfile && req.isCeo) {
          writes.push({
            update: {
              name: docName(`users/${txDoc.userId}`),
              fields: encodeFields({
                boostEnabled: true,
              }),
            },
            updateMask: { fieldPaths: ['boostEnabled', 'updatedAt'] },
            updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
          });
        }
      }

      // 4. Credit creator ledger strictly by CEO when payment is approved for a creator service
      if (approve && req.isCeo && creatorId !== 'platform' && ['paid_video', 'membership', 'support'].includes(serviceType)) {
        const cfg = await fsGetDoc<Record<string, any>>(idToken, 'platformConfig/settings').catch(() => null);
        const sharePct =
          serviceType === 'support'
            ? Number(cfg?.supportSharePercent ?? 85)
            : serviceType === 'membership'
            ? Number(cfg?.membershipSharePercent ?? 80)
            : Number(cfg?.paidVideoSharePercent ?? cfg?.creatorRevenueSharePercent ?? 80);
        const boundedPct = Math.min(95, Math.max(10, sharePct));
        const netCreatorInr = Math.round((amt * boundedPct) / 100);
        const platformFeeInr = Math.max(0, amt - netCreatorInr);
        const ledgerId = `tx_qr_${paymentId}`;

        writes.push({
          update: {
            name: docName(`monetizationTransactions/${ledgerId}`),
            fields: encodeFields({
              creatorId,
              counterpartyId: String(txDoc.userId || req.uid!),
              counterpartyName: String(txDoc.userName || 'Viewer').slice(0, 80),
              source: serviceType as 'paid_video' | 'membership' | 'support',
              grossInr: amt,
              platformFeeInr,
              netCreatorInr,
              status: 'settled',
              referenceId: paymentId,
              gatewayVerified: true,
              description: `Verified ${txDoc.paymentMethod} UTR ${cleanUtr} · ${String(txDoc.targetTitle || serviceType).slice(0, 80)}`,
            }),
          },
          currentDocument: { exists: false },
          updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
        });
      }

      // 5. Notify buyer (and creator when approved)
      if (txDoc.userId) {
        const buyerNotifId = `notif_pay_${paymentId}_u`;
        writes.push({
          update: {
            name: docName(`notifications/${buyerNotifId}`),
            fields: encodeFields({
              recipientId: String(txDoc.userId),
              senderName: 'BharatPlay Payments',
              type: 'system',
              title: approve ? 'Payment Verified & Service Activated' : 'Payment Verification Rejected',
              message: approve
                ? `Your ${txDoc.paymentMethod} payment of ₹${amt} (UTR ${cleanUtr}) for "${String(txDoc.targetTitle || serviceType).slice(0, 70)}" has been approved.`
                : `Your ${txDoc.paymentMethod} payment of ₹${amt} (UTR ${cleanUtr}) was rejected: ${cleanReason.slice(0, 140)}`,
              linkPath: '/payments',
              isRead: false,
            }),
          },
          currentDocument: { exists: false },
          updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
        });
      }

      if (approve && creatorId !== 'platform' && creatorId !== txDoc.userId) {
        const creatorNotifId = `notif_pay_${paymentId}_c`;
        writes.push({
          update: {
            name: docName(`notifications/${creatorNotifId}`),
            fields: encodeFields({
              recipientId: creatorId,
              senderName: String(txDoc.userName || 'Viewer').slice(0, 80),
              type: 'support',
              title: `Verified ₹${amt} ${serviceType.replace('_', ' ')} received`,
              message: `${txDoc.userName || 'A supporter'} completed ₹${amt} via ${txDoc.paymentMethod} (UTR ${cleanUtr}) for ${String(txDoc.targetTitle || creatorName).slice(0, 80)}.`,
              linkPath: '/studio',
              isRead: false,
            }),
          },
          currentDocument: { exists: false },
          updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
        });
      }

      // 6. Immutable Audit Log
      writes.push(
        buildAuditWrite({
          actorUid: req.uid!,
          actorEmail: req.userEmail || '',
          actorRole,
          action: approve ? 'qr_payment_approved' : 'qr_payment_rejected',
          targetType: 'payment',
          targetId: paymentId,
          targetLabel: `${txDoc.paymentMethod} ₹${amt} · UTR ${cleanUtr} · ${txDoc.userName || txDoc.userId}`,
          reason: cleanReason,
          status: 'success',
          details: `Service: ${serviceType} (${txDoc.targetId}) · Creator: ${creatorName}`,
        })
      );

      await fsCommit(idToken, writes);
      res.json({
        ok: true,
        paymentId,
        status: approve ? 'approved' : 'rejected',
        serviceActivated: approve,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to verify QR payment transaction.' });
    }
  });

  router.use(monetizationGovRouter);

  return router;
}
