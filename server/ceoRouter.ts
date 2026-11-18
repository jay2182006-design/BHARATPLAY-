import express from 'express';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };
import {
  DEFAULT_ADMIN_PERMISSIONS,
  type AdminPermissionKey,
  type AdminPermissions,
} from '../src/types/bharatplay.ts';

export interface CeoAuthedRequest extends express.Request {
  uid?: string;
  userEmail?: string;
  emailVerified?: boolean;
  authTime?: number;
  idToken?: string;
  isCeo?: boolean;
  isAdmin?: boolean;
  adminPermissions?: AdminPermissions;
}

const CEO_EMAIL = (process.env.CEO_EMAIL || 'jay2182006@gmail.com').trim().toLowerCase();
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents`;

export function isVerifiedCeoRequest(req: CeoAuthedRequest): boolean {
  return Boolean(
    req.uid &&
      req.emailVerified === true &&
      req.userEmail &&
      req.userEmail.trim().toLowerCase() === CEO_EMAIL
  );
}

const ALL_CEO_PERMISSIONS: AdminPermissions = {
  moderateVideos: true,
  resolveReports: true,
  manageCreators: true,
  manageCompetitions: true,
  manageAnnouncements: true,
  manageCategories: true,
  manageMonetization: true,
};

function sanitizePermissions(input?: Partial<AdminPermissions> | Record<string, unknown>): AdminPermissions {
  const src = (input || {}) as Record<string, unknown>;
  return {
    moderateVideos: Boolean(src.moderateVideos),
    resolveReports: Boolean(src.resolveReports),
    manageCreators: Boolean(src.manageCreators),
    manageCompetitions: Boolean(src.manageCompetitions),
    manageAnnouncements: Boolean(src.manageAnnouncements),
    manageCategories: Boolean(src.manageCategories),
    manageMonetization: Boolean(src.manageMonetization),
  };
}

// --- Firestore REST Value Converters ---
type FsValue =
  | { stringValue: string }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { timestampValue: string }
  | { nullValue: null }
  | { arrayValue: { values?: FsValue[] } }
  | { mapValue: { fields?: Record<string, FsValue> } };

function decodeFsValue(val: FsValue | undefined): unknown {
  if (!val) return undefined;
  if ('stringValue' in val) return val.stringValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('timestampValue' in val) return val.timestampValue;
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) return (val.arrayValue.values || []).map(decodeFsValue);
  if ('mapValue' in val) {
    const out: Record<string, unknown> = {};
    const fields = val.mapValue.fields || {};
    for (const [k, v] of Object.entries(fields)) {
      out[k] = decodeFsValue(v);
    }
    return out;
  }
  return undefined;
}

function encodeFsValue(val: unknown): FsValue {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(encodeFsValue) } };
  if (typeof val === 'object') {
    const fields: Record<string, FsValue> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v !== undefined) fields[k] = encodeFsValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function decodeFsDocument<T = Record<string, unknown>>(doc: {
  name?: string;
  fields?: Record<string, FsValue>;
}): T & { id: string } {
  const id = doc.name ? doc.name.split('/').pop() || '' : '';
  const out: Record<string, unknown> = { id };
  const fields = doc.fields || {};
  for (const [k, v] of Object.entries(fields)) {
    out[k] = decodeFsValue(v);
  }
  return out as T & { id: string };
}

export function docName(docPath: string): string {
  return `projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/${docPath}`;
}

export async function fsGetDoc<T = Record<string, unknown>>(
  idToken: string,
  docPath: string
): Promise<(T & { id: string }) | null> {
  const res = await fetch(`${FIRESTORE_BASE}/${docPath}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore GET ${docPath} failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return decodeFsDocument<T>(data);
}

export async function fsListCollection<T = Record<string, unknown>>(
  idToken: string,
  collectionPath: string,
  maxDocs = 300
): Promise<(T & { id: string })[]> {
  const results: (T & { id: string })[] = [];
  let pageToken = '';
  while (results.length < maxDocs) {
    const url = new URL(`${FIRESTORE_BASE}/${collectionPath}`);
    url.searchParams.set('pageSize', String(Math.min(100, maxDocs - results.length)));
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (res.status === 404) break;
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Firestore LIST ${collectionPath} failed (${res.status}): ${text}`);
    }
    const json = await res.json();
    const docs = Array.isArray(json.documents) ? json.documents : [];
    for (const d of docs) results.push(decodeFsDocument<T>(d));
    if (!json.nextPageToken) break;
    pageToken = json.nextPageToken;
  }
  return results;
}

export interface CommitWrite {
  update?: {
    name: string;
    fields: Record<string, FsValue>;
  };
  updateMask?: { fieldPaths: string[] };
  updateTransforms?: { fieldPath: string; setToServerValue: 'REQUEST_TIME' }[];
  currentDocument?: { exists: boolean };
  delete?: string;
}

export async function fsCommit(idToken: string, writes: CommitWrite[]): Promise<void> {
  if (writes.length === 0) return;
  const res = await fetch(`${FIRESTORE_BASE}:commit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ writes }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore commit failed (${res.status}): ${text}`);
  }
}

export function encodeFields(obj: Record<string, unknown>): Record<string, FsValue> {
  const fields: Record<string, FsValue> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) fields[k] = encodeFsValue(v);
  }
  return fields;
}

export type AuditTargetType =
  | 'user'
  | 'channel'
  | 'video'
  | 'report'
  | 'announcement'
  | 'system'
  | 'admin'
  | 'payout'
  | 'config'
  | 'competition'
  | 'challenge'
  | 'monetization'
  | 'dispute'
  | 'traffic'
  | 'brand'
  | 'payment';

export function buildAuditWrite(params: {
  actorUid: string;
  actorEmail: string;
  actorRole?: 'ceo' | 'admin';
  action: string;
  targetType: AuditTargetType;
  targetId: string;
  targetLabel?: string;
  reason: string;
  status: 'success' | 'blocked' | 'failed';
  details?: string;
}): CommitWrite {
  const role = params.actorRole || 'ceo';
  const logId = `${role}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    update: {
      name: docName(`ceoAuditLogs/${logId}`),
      fields: encodeFields({
        actorUid: params.actorUid.slice(0, 128),
        actorEmail: params.actorEmail.slice(0, 160),
        actorRole: role,
        action: params.action.slice(0, 80),
        targetType: params.targetType,
        targetId: params.targetId.slice(0, 128) || 'system',
        targetLabel: (params.targetLabel || params.targetId).slice(0, 150),
        reason: params.reason.slice(0, 500),
        status: params.status,
        details: (params.details || '').slice(0, 500),
      }),
    },
    currentDocument: { exists: false },
    updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
  };
}

async function recordAuditStandalone(
  idToken: string,
  params: Parameters<typeof buildAuditWrite>[0]
) {
  try {
    await fsCommit(idToken, [buildAuditWrite(params)]);
  } catch (err) {
    console.error('Failed to persist audit log:', err);
  }
}

export function requireCeoMiddleware(
  req: CeoAuthedRequest,
  res: express.Response,
  next: express.NextFunction
) {
  if (!isVerifiedCeoRequest(req)) {
    res.status(403).json({
      error: 'Unauthorized Access: Exclusive BHARATPLAY CEO clearance required.',
      code: 'CEO_UNAUTHORIZED',
    });
    return;
  }
  req.isCeo = true;
  req.isAdmin = true;
  req.adminPermissions = ALL_CEO_PERMISSIONS;
  next();
}

export async function loadAdminMiddleware(
  req: CeoAuthedRequest,
  res: express.Response,
  next: express.NextFunction
) {
  if (isVerifiedCeoRequest(req)) {
    req.isCeo = true;
    req.isAdmin = true;
    req.adminPermissions = ALL_CEO_PERMISSIONS;
    next();
    return;
  }

  if (!req.uid || !req.idToken || req.emailVerified !== true) {
    res.status(403).json({
      error: 'Unauthorized Access: Verified Administrator privileges required.',
      code: 'ADMIN_UNAUTHORIZED',
    });
    return;
  }

  try {
    const adminDoc = await fsGetDoc<Record<string, any>>(req.idToken, `admins/${req.uid}`);
    if (!adminDoc) {
      res.status(403).json({
        error: 'Unauthorized Access: Administrator role has not been assigned by the CEO.',
        code: 'ADMIN_UNAUTHORIZED',
      });
      return;
    }
    req.isCeo = false;
    req.isAdmin = true;
    req.adminPermissions = sanitizePermissions(adminDoc.permissions);
    next();
  } catch {
    res.status(403).json({
      error: 'Unauthorized Access: Unable to verify Administrator privileges.',
      code: 'ADMIN_UNAUTHORIZED',
    });
  }
}

export function requireAdminPerm(perm: AdminPermissionKey) {
  return (req: CeoAuthedRequest, res: express.Response, next: express.NextFunction) => {
    if (req.isCeo) {
      next();
      return;
    }
    if (!req.isAdmin || !req.adminPermissions || req.adminPermissions[perm] !== true) {
      res.status(403).json({
        error: `Permission Denied: CEO has not granted "${perm}" permission to your Admin account.`,
        code: 'ADMIN_PERMISSION_DENIED',
      });
      return;
    }
    next();
  };
}

async function checkSensitiveStepUpAuth(
  req: CeoAuthedRequest,
  res: express.Response,
  options: {
    permanent?: boolean;
    actionName: string;
    targetType: AuditTargetType;
    targetId: string;
    reason?: string;
  }
): Promise<boolean> {
  const maxAgeSeconds = options.permanent ? 300 : 900;
  const nowSec = Math.floor(Date.now() / 1000);
  const authAge = req.authTime ? Math.max(0, nowSec - req.authTime) : 999999;

  if (authAge > maxAgeSeconds) {
    if (req.idToken && req.uid) {
      await recordAuditStandalone(req.idToken, {
        actorUid: req.uid,
        actorEmail: req.userEmail || '',
        actorRole: 'ceo',
        action: options.actionName,
        targetType: options.targetType,
        targetId: options.targetId || 'system',
        reason: options.reason || 'Step-up authentication expired',
        status: 'blocked',
        details: `Blocked: auth_time age ${authAge}s exceeded ${maxAgeSeconds}s window.`,
      });
    }
    res.status(428).json({
      error: 'Additional CEO authentication verification required for this sensitive action.',
      code: 'CEO_REAUTH_REQUIRED',
      maxAgeSeconds,
    });
    return false;
  }

  if (options.permanent && req.body?.confirmPhrase !== 'PERMANENTLY DELETE') {
    res.status(400).json({
      error: 'Permanent deletion requires typing exact confirmation phrase: PERMANENTLY DELETE',
      code: 'CONFIRMATION_PHRASE_REQUIRED',
    });
    return false;
  }

  return true;
}

export function createCeoRouter(
  verifyBearerToken: (
    req: CeoAuthedRequest,
    res: express.Response,
    next: express.NextFunction
  ) => Promise<void>
) {
  const router = express.Router();

  // Clearance check endpoint for authenticated users (never exposes CEO email to client)
  router.get('/auth/clearance', verifyBearerToken, async (req: CeoAuthedRequest, res) => {
    const isCeo = isVerifiedCeoRequest(req);
    let isAdmin = isCeo;
    let adminPermissions: AdminPermissions | null = isCeo ? ALL_CEO_PERMISSIONS : null;

    if (!isAdmin && req.uid && req.idToken && req.emailVerified === true) {
      try {
        const adminDoc = await fsGetDoc<Record<string, any>>(req.idToken, `admins/${req.uid}`);
        if (adminDoc) {
          isAdmin = true;
          adminPermissions = sanitizePermissions(adminDoc.permissions);
        }
      } catch {
        isAdmin = false;
        adminPermissions = null;
      }
    }

    let role: 'ceo' | 'admin' | 'creator' | 'viewer' = isCeo ? 'ceo' : isAdmin ? 'admin' : 'viewer';
    if (!isCeo && !isAdmin && req.uid && req.idToken) {
      try {
        const pub = await fsGetDoc<Record<string, any>>(req.idToken, `users/${req.uid}`).catch(() => null);
        const priv = await fsGetDoc<Record<string, any>>(req.idToken, `users/${req.uid}/private/account`).catch(
          () => null
        );
        if (pub?.isCreator || priv?.role === 'creator') {
          role = 'creator';
        }
      } catch {
        // Keep viewer fallback on initial signup
      }
    }

    res.json({
      role,
      isCeo,
      isAdmin,
      adminPermissions,
      authTime: req.authTime || 0,
    });
  });

  // =========================================================================
  // EXCLUSIVE CEO ROUTES (Strictly Verified CEO Only)
  // =========================================================================
  router.use('/ceo', verifyBearerToken, requireCeoMiddleware);

  // CEO Session Info
  router.get('/ceo/session', (req: CeoAuthedRequest, res) => {
    const nowSec = Math.floor(Date.now() / 1000);
    const authAgeSeconds = req.authTime ? Math.max(0, nowSec - req.authTime) : 999999;
    res.json({
      authorized: true,
      clearance: 'CEO',
      uid: req.uid,
      authAgeSeconds,
      recentSensitiveAuthValid: authAgeSeconds <= 900,
      recentPermanentAuthValid: authAgeSeconds <= 300,
    });
  });

  // CEO Overview & Complete Platform Analytics
  router.get('/ceo/overview', async (req: CeoAuthedRequest, res) => {
    try {
      const idToken = req.idToken!;
      const [
        users,
        admins,
        videos,
        reports,
        announcements,
        auditLogs,
        liveStreams,
        challenges,
        competitions,
        payouts,
        supports,
        platformConfigDoc,
      ] = await Promise.all([
        fsListCollection<Record<string, any>>(idToken, 'users', 300),
        fsListCollection<Record<string, any>>(idToken, 'admins', 100).catch(() => []),
        fsListCollection<Record<string, any>>(idToken, 'videos', 300),
        fsListCollection<Record<string, any>>(idToken, 'reports', 200).catch(() => []),
        fsListCollection<Record<string, any>>(idToken, 'announcements', 100).catch(() => []),
        fsListCollection<Record<string, any>>(idToken, 'ceoAuditLogs', 250).catch(() => []),
        fsListCollection<Record<string, any>>(idToken, 'liveStreams', 100).catch(() => []),
        fsListCollection<Record<string, any>>(idToken, 'challenges', 100).catch(() => []),
        fsListCollection<Record<string, any>>(idToken, 'competitions', 100).catch(() => []),
        fsListCollection<Record<string, any>>(idToken, 'creatorPayouts', 200).catch(() => []),
        fsListCollection<Record<string, any>>(idToken, 'creatorSupports', 200).catch(() => []),
        fsGetDoc<Record<string, any>>(idToken, 'platformConfig/settings').catch(() => null),
      ]);

      const adminMap = new Map<string, Record<string, any>>();
      for (const a of admins) {
        adminMap.set(a.uid || a.id, a);
      }

      const privateMap = new Map<string, Record<string, any>>();
      const batchTargets = users.slice(0, 80);
      await Promise.all(
        batchTargets.map(async (u) => {
          try {
            const p = await fsGetDoc<Record<string, any>>(idToken, `users/${u.uid || u.id}/private/account`);
            if (p) privateMap.set(u.uid || u.id, p);
          } catch {
            // Seeded creators may not have private doc
          }
        })
      );

      const enrichedUsers: Array<Record<string, any>> = users.map((u) => {
        const uid = u.uid || u.id;
        const priv = privateMap.get(uid);
        const adm = adminMap.get(uid);
        const resolvedRole =
          priv?.role === 'ceo'
            ? 'ceo'
            : adm || priv?.role === 'admin'
            ? 'admin'
            : u.isCreator || priv?.role === 'creator'
            ? 'creator'
            : 'viewer';
        return {
          ...u,
          uid,
          email: priv?.email || adm?.email || '',
          role: resolvedRole,
          monetizationEnabled: Boolean(priv?.monetizationEnabled),
          estimatedEarningsInr: Number(priv?.estimatedEarningsInr || 0),
          upiId: priv?.upiId || '',
          adminPermissions: adm ? sanitizePermissions(adm.permissions) : undefined,
          accountStatus: u.accountStatus || (priv?.suspended ? 'suspended' : 'active'),
          channelStatus: u.channelStatus || 'active',
        };
      });

      const normalizedAdmins = admins.map((a) => ({
        uid: a.uid || a.id,
        displayName: a.displayName || enrichedUsers.find((u) => u.uid === (a.uid || a.id))?.displayName || 'Admin',
        email: a.email || enrichedUsers.find((u) => u.uid === (a.uid || a.id))?.email || '',
        permissions: sanitizePermissions(a.permissions),
        grantedBy: a.grantedBy || req.uid!,
        notes: a.notes || '',
        grantedAt: a.grantedAt,
        updatedAt: a.updatedAt,
      }));

      const sortTsDesc = (a: any, b: any) =>
        new Date(b.createdAt || b.updatedAt || 0).getTime() -
        new Date(a.createdAt || a.updatedAt || 0).getTime();

      videos.sort(sortTsDesc);
      reports.sort(sortTsDesc);
      announcements.sort(sortTsDesc);
      auditLogs.sort(sortTsDesc);
      payouts.sort(sortTsDesc);
      supports.sort(sortTsDesc);

      const totalUsers = enrichedUsers.length;
      const totalCreators = enrichedUsers.filter((u) => u.isCreator && u.channelStatus !== 'deleted').length;
      const totalChannels = enrichedUsers.filter(
        (u) => u.isCreator || u.channelStatus === 'suspended' || u.channelStatus === 'deleted'
      ).length;
      const suspendedAccounts = enrichedUsers.filter((u) => u.accountStatus === 'suspended').length;
      const suspendedChannels = enrichedUsers.filter((u) => u.channelStatus === 'suspended').length;
      const activeUsers = enrichedUsers.filter((u) => u.accountStatus === 'active').length;

      const totalVideos = videos.length;
      const publishedVideos = videos.filter((v) => v.status === 'published').length;
      const removedVideos = videos.filter((v) => v.status === 'removed').length;
      const flaggedVideos = videos.filter((v) => v.status === 'flagged').length;
      const totalPlatformViews = Math.max(
        videos.reduce((s, v) => s + Number(v.viewsCount || 0), 0),
        enrichedUsers.reduce((s, u) => s + Number(u.totalViews || 0), 0)
      );
      const totalWatchSeconds = videos.reduce((s, v) => s + Number(v.totalWatchSeconds || 0), 0);
      const totalWatchHours = Number((totalWatchSeconds / 3600).toFixed(1));
      const pendingReports = reports.filter((r) => r.status === 'pending').length;

      const totalSupportsInr = supports.reduce((s, x) => s + Number(x.amountInr || 0), 0);
      const totalCreatorEarningsInr = enrichedUsers.reduce(
        (s, u) => s + Number(u.estimatedEarningsInr || 0),
        0
      );
      const pendingPayouts = payouts.filter((p) => p.status === 'pending' || p.status === 'approved');
      const paidPayouts = payouts.filter((p) => p.status === 'paid');

      const platformConfig = platformConfigDoc || {
        categories: ['All', 'Music', 'Tech', 'Gaming', 'Education', 'Comedy', 'Vlogs', 'Podcasts', 'Regional', 'Movies'],
        languages: ['All Languages', 'Hindi', 'English', 'Punjabi', 'Rajasthani', 'Tamil', 'Telugu', 'Bengali', 'Marathi'],
        earlyCreatorBoostEnabled: true,
        creatorRevenueSharePercent: 75,
        minPayoutInr: 500,
        maintenanceMode: false,
        updatedAt: new Date().toISOString(),
      };

      res.json({
        metrics: {
          totalUsers,
          totalCreators,
          totalChannels,
          totalVideos,
          publishedVideos,
          removedVideos,
          flaggedVideos,
          totalPlatformViews,
          totalWatchHours,
          activeUsers,
          suspendedAccounts,
          suspendedChannels,
          pendingReports,
          liveStreamsActive: liveStreams.filter((s) => s.isLive).length,
          activeChallenges: challenges.filter((c) => c.status === 'active').length,
          activeCompetitions: competitions.filter((c) => c.status === 'active').length,
          totalAdmins: normalizedAdmins.length,
          totalSupportsInr,
          totalCreatorEarningsInr,
          pendingPayoutsCount: pendingPayouts.length,
          pendingPayoutsInr: pendingPayouts.reduce((s, p) => s + Number(p.amountInr || 0), 0),
          paidPayoutsInr: paidPayouts.reduce((s, p) => s + Number(p.amountInr || 0), 0),
        },
        users: enrichedUsers,
        admins: normalizedAdmins,
        videos,
        reports,
        announcements,
        payouts,
        supports,
        platformConfig,
        auditLogs,
      });
    } catch (err: any) {
      console.error('CEO overview error:', err);
      res.status(500).json({ error: err?.message || 'Failed to load CEO Command Center telemetry.' });
    }
  });

  // Channel Lifecycle Actions (Suspend, Restore, Soft Delete, Permanent Delete)
  router.post('/ceo/channels/action', async (req: CeoAuthedRequest, res) => {
    const { action, targetUid, reason } = req.body || {};
    if (!targetUid || typeof targetUid !== 'string') {
      res.status(400).json({ error: 'Target channel ID is required.' });
      return;
    }
    const cleanReason = String(reason || '').trim();
    if (cleanReason.length < 3) {
      res.status(400).json({ error: 'An executive action reason (minimum 3 characters) is required.' });
      return;
    }

    const isPermanent = action === 'permanent_delete_channel';
    const isSensitive = isPermanent || action === 'soft_delete_channel' || action === 'suspend_channel';
    if (isSensitive) {
      const ok = await checkSensitiveStepUpAuth(req, res, {
        permanent: isPermanent,
        actionName: action,
        targetType: 'channel',
        targetId: targetUid,
        reason: cleanReason,
      });
      if (!ok) return;
    }

    try {
      const idToken = req.idToken!;
      const targetUser = await fsGetDoc<Record<string, any>>(idToken, `users/${targetUid}`);
      if (!targetUser) {
        res.status(404).json({ error: 'Channel record not found in Firestore.' });
        return;
      }

      if (targetUid === req.uid && (isPermanent || action === 'soft_delete_channel' || action === 'suspend_channel')) {
        res.status(400).json({ error: 'Cannot suspend or delete the active CEO channel.' });
        return;
      }

      const writes: CommitWrite[] = [];
      let details = '';

      if (action === 'suspend_channel') {
        writes.push({
          update: {
            name: docName(`users/${targetUid}`),
            fields: encodeFields({
              channelStatus: 'suspended',
              isFeatured: false,
              boostEnabled: false,
              moderationReason: cleanReason.slice(0, 500),
            }),
          },
          updateMask: {
            fieldPaths: ['channelStatus', 'isFeatured', 'boostEnabled', 'moderationReason', 'statusUpdatedAt', 'updatedAt'],
          },
          updateTransforms: [
            { fieldPath: 'statusUpdatedAt', setToServerValue: 'REQUEST_TIME' },
            { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
          ],
        });
        details = 'Channel suspended while preserving underlying user account.';
      } else if (action === 'restore_channel') {
        writes.push({
          update: {
            name: docName(`users/${targetUid}`),
            fields: encodeFields({
              channelStatus: 'active',
              isCreator: true,
              moderationReason: cleanReason.slice(0, 500),
            }),
          },
          updateMask: {
            fieldPaths: ['channelStatus', 'isCreator', 'moderationReason', 'statusUpdatedAt', 'updatedAt'],
          },
          updateTransforms: [
            { fieldPath: 'statusUpdatedAt', setToServerValue: 'REQUEST_TIME' },
            { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
          ],
        });
        details = 'Channel restored to active standing.';
      } else if (action === 'soft_delete_channel') {
        writes.push({
          update: {
            name: docName(`users/${targetUid}`),
            fields: encodeFields({
              channelStatus: 'deleted',
              isCreator: false,
              isFeatured: false,
              boostEnabled: false,
              moderationReason: cleanReason.slice(0, 500),
            }),
          },
          updateMask: {
            fieldPaths: ['channelStatus', 'isCreator', 'isFeatured', 'boostEnabled', 'moderationReason', 'statusUpdatedAt', 'updatedAt'],
          },
          updateTransforms: [
            { fieldPath: 'statusUpdatedAt', setToServerValue: 'REQUEST_TIME' },
            { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
          ],
        });
        details = 'Channel soft-deleted (recoverable); user account retained separately.';
      } else if (action === 'permanent_delete_channel') {
        const allVideos = await fsListCollection<Record<string, any>>(idToken, 'videos', 300);
        const ownedVideos = allVideos.filter((v) => v.creatorId === targetUid);
        for (const v of ownedVideos) {
          writes.push({ delete: docName(`videos/${v.id}`) });
        }
        writes.push({
          update: {
            name: docName(`users/${targetUid}`),
            fields: encodeFields({
              channelStatus: 'deleted',
              isCreator: false,
              isVerified: false,
              isFeatured: false,
              boostEnabled: false,
              subscribersCount: 0,
              moderationReason: `Channel permanently purged: ${cleanReason}`.slice(0, 500),
            }),
          },
          updateMask: {
            fieldPaths: [
              'channelStatus',
              'isCreator',
              'isVerified',
              'isFeatured',
              'boostEnabled',
              'subscribersCount',
              'moderationReason',
              'statusUpdatedAt',
              'updatedAt',
            ],
          },
          updateTransforms: [
            { fieldPath: 'statusUpdatedAt', setToServerValue: 'REQUEST_TIME' },
            { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
          ],
        });
        details = `Permanently purged channel and ${ownedVideos.length} owned video(s). User account kept intact.`;
      } else {
        res.status(400).json({ error: 'Unsupported channel action.' });
        return;
      }

      writes.push(
        buildAuditWrite({
          actorUid: req.uid!,
          actorEmail: req.userEmail || '',
          actorRole: 'ceo',
          action,
          targetType: 'channel',
          targetId: targetUid,
          targetLabel: `${targetUser.displayName || targetUid} (@${targetUser.handle || 'channel'})`,
          reason: cleanReason,
          status: 'success',
          details,
        })
      );

      await fsCommit(idToken, writes);
      res.json({ ok: true, action, targetUid, details });
    } catch (err: any) {
      await recordAuditStandalone(req.idToken!, {
        actorUid: req.uid!,
        actorEmail: req.userEmail || '',
        actorRole: 'ceo',
        action,
        targetType: 'channel',
        targetId: targetUid,
        reason: cleanReason,
        status: 'failed',
        details: err?.message || 'Commit failed',
      });
      res.status(500).json({ error: err?.message || 'Failed to execute CEO channel action.' });
    }
  });

  // Video Moderation Actions (Soft Remove, Restore, Permanent Delete)
  router.post('/ceo/videos/action', async (req: CeoAuthedRequest, res) => {
    const { action, videoId, reason } = req.body || {};
    if (!videoId || typeof videoId !== 'string') {
      res.status(400).json({ error: 'Video ID is required.' });
      return;
    }
    const cleanReason = String(reason || '').trim();
    if (cleanReason.length < 3) {
      res.status(400).json({ error: 'Action reason (minimum 3 characters) is required.' });
      return;
    }

    const isPermanent = action === 'permanent_delete';
    if (isPermanent) {
      const ok = await checkSensitiveStepUpAuth(req, res, {
        permanent: true,
        actionName: 'permanent_delete_video',
        targetType: 'video',
        targetId: videoId,
        reason: cleanReason,
      });
      if (!ok) return;
    }

    try {
      const idToken = req.idToken!;
      const videoDoc = await fsGetDoc<Record<string, any>>(idToken, `videos/${videoId}`);
      if (!videoDoc) {
        res.status(404).json({ error: 'Video record not found.' });
        return;
      }

      const writes: CommitWrite[] = [];
      let details = '';

      if (action === 'soft_remove') {
        writes.push({
          update: {
            name: docName(`videos/${videoId}`),
            fields: encodeFields({
              status: 'removed',
              removalReason: cleanReason.slice(0, 500),
              removedBy: req.uid!,
            }),
          },
          updateMask: { fieldPaths: ['status', 'removalReason', 'removedBy', 'updatedAt'] },
          updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
        });
        details = 'Video soft-removed from public discovery (recoverable).';
      } else if (action === 'restore') {
        writes.push({
          update: {
            name: docName(`videos/${videoId}`),
            fields: encodeFields({
              status: 'published',
              removalReason: '',
              removedBy: '',
            }),
          },
          updateMask: { fieldPaths: ['status', 'removalReason', 'removedBy', 'updatedAt'] },
          updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
        });
        details = 'Video restored to published catalog.';
      } else if (action === 'permanent_delete') {
        writes.push({ delete: docName(`videos/${videoId}`) });
        details = 'Video permanently deleted from database.';
      } else {
        res.status(400).json({ error: 'Unsupported video action.' });
        return;
      }

      writes.push(
        buildAuditWrite({
          actorUid: req.uid!,
          actorEmail: req.userEmail || '',
          actorRole: 'ceo',
          action,
          targetType: 'video',
          targetId: videoId,
          targetLabel: String(videoDoc.title || videoId),
          reason: cleanReason,
          status: 'success',
          details,
        })
      );

      await fsCommit(idToken, writes);
      res.json({ ok: true, action, videoId, details });
    } catch (err: any) {
      await recordAuditStandalone(req.idToken!, {
        actorUid: req.uid!,
        actorEmail: req.userEmail || '',
        actorRole: 'ceo',
        action,
        targetType: 'video',
        targetId: videoId,
        reason: cleanReason,
        status: 'failed',
        details: err?.message || 'Video action failed',
      });
      res.status(500).json({ error: err?.message || 'Failed to execute CEO video action.' });
    }
  });

  // User Governance, Roles & Creator Verification Actions
  router.post('/ceo/users/action', async (req: CeoAuthedRequest, res) => {
    const { action, targetUid, reason, value, permissions, notes } = req.body || {};
    if (!targetUid || typeof targetUid !== 'string') {
      res.status(400).json({ error: 'Target user ID is required.' });
      return;
    }
    const cleanReason = String(reason || '').trim();
    if (cleanReason.length < 3) {
      res.status(400).json({ error: 'Executive reason (minimum 3 characters) is required.' });
      return;
    }

    const isPermanent = action === 'permanent_delete_account';
    const isSensitive =
      isPermanent ||
      action === 'suspend_account' ||
      action === 'soft_delete_account' ||
      action === 'set_creator_permission' ||
      action === 'set_admin_permission';

    if (isSensitive) {
      const ok = await checkSensitiveStepUpAuth(req, res, {
        permanent: isPermanent,
        actionName: action,
        targetType: 'user',
        targetId: targetUid,
        reason: cleanReason,
      });
      if (!ok) return;
    }

    try {
      const idToken = req.idToken!;
      const targetUser = await fsGetDoc<Record<string, any>>(idToken, `users/${targetUid}`);
      if (!targetUser) {
        res.status(404).json({ error: 'User profile not found.' });
        return;
      }

      if (
        targetUid === req.uid &&
        ['suspend_account', 'soft_delete_account', 'permanent_delete_account', 'set_admin_permission'].includes(
          action
        )
      ) {
        res.status(400).json({ error: 'Cannot execute destructive or role-demotion actions against the CEO account.' });
        return;
      }

      const privDoc = await fsGetDoc<Record<string, any>>(idToken, `users/${targetUid}/private/account`).catch(
        () => null
      );

      if (privDoc?.role === 'ceo' && targetUid !== req.uid) {
        res.status(403).json({ error: 'CEO account cannot be altered via standard user governance.' });
        return;
      }

      const writes: CommitWrite[] = [];
      let details = '';

      if (action === 'suspend_account') {
        writes.push({
          update: {
            name: docName(`users/${targetUid}`),
            fields: encodeFields({
              accountStatus: 'suspended',
              isFeatured: false,
              boostEnabled: false,
              moderationReason: cleanReason.slice(0, 500),
            }),
          },
          updateMask: {
            fieldPaths: ['accountStatus', 'isFeatured', 'boostEnabled', 'moderationReason', 'statusUpdatedAt', 'updatedAt'],
          },
          updateTransforms: [
            { fieldPath: 'statusUpdatedAt', setToServerValue: 'REQUEST_TIME' },
            { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
          ],
        });
        if (privDoc) {
          writes.push({
            update: {
              name: docName(`users/${targetUid}/private/account`),
              fields: encodeFields({
                suspended: true,
                suspensionReason: cleanReason.slice(0, 500),
              }),
            },
            updateMask: { fieldPaths: ['suspended', 'suspensionReason', 'updatedAt'] },
            updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
          });
        }
        details = 'User account suspended platform-wide.';
      } else if (action === 'reactivate_account') {
        writes.push({
          update: {
            name: docName(`users/${targetUid}`),
            fields: encodeFields({
              accountStatus: 'active',
              moderationReason: cleanReason.slice(0, 500),
            }),
          },
          updateMask: {
            fieldPaths: ['accountStatus', 'moderationReason', 'statusUpdatedAt', 'updatedAt'],
          },
          updateTransforms: [
            { fieldPath: 'statusUpdatedAt', setToServerValue: 'REQUEST_TIME' },
            { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
          ],
        });
        if (privDoc) {
          writes.push({
            update: {
              name: docName(`users/${targetUid}/private/account`),
              fields: encodeFields({
                suspended: false,
                suspensionReason: '',
              }),
            },
            updateMask: { fieldPaths: ['suspended', 'suspensionReason', 'updatedAt'] },
            updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
          });
        }
        details = 'User account reactivated.';
      } else if (action === 'soft_delete_account') {
        writes.push({
          update: {
            name: docName(`users/${targetUid}`),
            fields: encodeFields({
              accountStatus: 'deleted',
              channelStatus: 'deleted',
              isCreator: false,
              isFeatured: false,
              boostEnabled: false,
              moderationReason: cleanReason.slice(0, 500),
            }),
          },
          updateMask: {
            fieldPaths: [
              'accountStatus',
              'channelStatus',
              'isCreator',
              'isFeatured',
              'boostEnabled',
              'moderationReason',
              'statusUpdatedAt',
              'updatedAt',
            ],
          },
          updateTransforms: [
            { fieldPath: 'statusUpdatedAt', setToServerValue: 'REQUEST_TIME' },
            { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
          ],
        });
        if (privDoc) {
          writes.push({
            update: {
              name: docName(`users/${targetUid}/private/account`),
              fields: encodeFields({
                suspended: true,
                suspensionReason: `Soft-deleted: ${cleanReason}`.slice(0, 500),
              }),
            },
            updateMask: { fieldPaths: ['suspended', 'suspensionReason', 'updatedAt'] },
            updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
          });
        }
        details = 'Account soft-deleted (recoverable via Reactivate).';
      } else if (action === 'permanent_delete_account') {
        const allVideos = await fsListCollection<Record<string, any>>(idToken, 'videos', 300);
        const ownedVideos = allVideos.filter((v) => v.creatorId === targetUid);
        for (const v of ownedVideos) {
          writes.push({ delete: docName(`videos/${v.id}`) });
        }
        const existingAdmin = await fsGetDoc(idToken, `admins/${targetUid}`).catch(() => null);
        if (existingAdmin) {
          writes.push({ delete: docName(`admins/${targetUid}`) });
        }
        if (privDoc) {
          writes.push({ delete: docName(`users/${targetUid}/private/account`) });
        }
        writes.push({ delete: docName(`users/${targetUid}`) });
        details = `Account permanently deleted (${ownedVideos.length} video(s) purged) with atomic audit record.`;
      } else if (action === 'set_creator_permission') {
        const allowCreator = Boolean(value);
        writes.push({
          update: {
            name: docName(`users/${targetUid}`),
            fields: encodeFields({
              isCreator: allowCreator,
              channelStatus: allowCreator ? 'active' : targetUser.channelStatus || 'active',
              moderationReason: cleanReason.slice(0, 500),
            }),
          },
          updateMask: {
            fieldPaths: ['isCreator', 'channelStatus', 'moderationReason', 'statusUpdatedAt', 'updatedAt'],
          },
          updateTransforms: [
            { fieldPath: 'statusUpdatedAt', setToServerValue: 'REQUEST_TIME' },
            { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
          ],
        });
        if (privDoc && privDoc.role !== 'ceo' && privDoc.role !== 'admin') {
          writes.push({
            update: {
              name: docName(`users/${targetUid}/private/account`),
              fields: encodeFields({
                role: allowCreator ? 'creator' : 'viewer',
                monetizationEnabled: allowCreator,
              }),
            },
            updateMask: { fieldPaths: ['role', 'monetizationEnabled', 'updatedAt'] },
            updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
          });
        }
        details = allowCreator ? 'Creator permissions granted.' : 'Creator permissions revoked.';
      } else if (action === 'set_admin_permission') {
        const allowAdmin = Boolean(value);
        const existingAdmin = await fsGetDoc(idToken, `admins/${targetUid}`).catch(() => null);
        if (allowAdmin) {
          const nextPerms = permissions
            ? sanitizePermissions(permissions)
            : { ...DEFAULT_ADMIN_PERMISSIONS, resolveReports: true, moderateVideos: true };

          if (existingAdmin) {
            writes.push({
              update: {
                name: docName(`admins/${targetUid}`),
                fields: encodeFields({
                  displayName: String(targetUser.displayName || '').slice(0, 80),
                  email: String(privDoc?.email || '').slice(0, 160),
                  permissions: nextPerms,
                  grantedBy: req.uid!,
                  notes: String(notes || cleanReason).slice(0, 300),
                }),
              },
              updateMask: { fieldPaths: ['displayName', 'email', 'permissions', 'grantedBy', 'notes', 'updatedAt'] },
              updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
            });
          } else {
            writes.push({
              update: {
                name: docName(`admins/${targetUid}`),
                fields: encodeFields({
                  uid: targetUid,
                  displayName: String(targetUser.displayName || '').slice(0, 80),
                  email: String(privDoc?.email || '').slice(0, 160),
                  permissions: nextPerms,
                  grantedBy: req.uid!,
                  notes: String(notes || cleanReason).slice(0, 300),
                }),
              },
              currentDocument: { exists: false },
              updateTransforms: [
                { fieldPath: 'grantedAt', setToServerValue: 'REQUEST_TIME' },
                { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
              ],
            });
          }
          details = `Regular Admin role assigned with scoped permissions (${Object.entries(nextPerms)
            .filter(([, v]) => v)
            .map(([k]) => k)
            .join(', ') || 'none'}).`;
        } else {
          if (existingAdmin) {
            writes.push({ delete: docName(`admins/${targetUid}`) });
          }
          details = 'Regular Admin role revoked.';
        }

        if (privDoc && privDoc.role !== 'ceo') {
          writes.push({
            update: {
              name: docName(`users/${targetUid}/private/account`),
              fields: encodeFields({
                role: allowAdmin ? 'admin' : targetUser.isCreator ? 'creator' : 'viewer',
              }),
            },
            updateMask: { fieldPaths: ['role', 'updatedAt'] },
            updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
          });
        }
      } else if (action === 'set_verification') {
        const verified = Boolean(value);
        writes.push({
          update: {
            name: docName(`users/${targetUid}`),
            fields: encodeFields({
              isVerified: verified,
              moderationReason: cleanReason.slice(0, 500),
            }),
          },
          updateMask: { fieldPaths: ['isVerified', 'moderationReason', 'updatedAt'] },
          updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
        });
        details = verified ? 'Creator verification badge granted.' : 'Verification badge removed.';
      } else if (action === 'set_featured') {
        const featured = Boolean(value);
        writes.push({
          update: {
            name: docName(`users/${targetUid}`),
            fields: encodeFields({
              isFeatured: featured,
              moderationReason: cleanReason.slice(0, 500),
            }),
          },
          updateMask: { fieldPaths: ['isFeatured', 'moderationReason', 'updatedAt'] },
          updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
        });
        details = featured ? 'Creator featured on homepage.' : 'Removed from homepage featured list.';
      } else if (action === 'set_rising_creator') {
        const rising = Boolean(value);
        writes.push({
          update: {
            name: docName(`users/${targetUid}`),
            fields: encodeFields({
              isEarlyCreator: rising,
              boostEnabled: rising,
              rewardTier: rising ? 'Rising' : 'Seed',
              moderationReason: cleanReason.slice(0, 500),
            }),
          },
          updateMask: { fieldPaths: ['isEarlyCreator', 'boostEnabled', 'rewardTier', 'moderationReason', 'updatedAt'] },
          updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
        });
        details = rising ? 'Rising Creator boost & badge enabled.' : 'Rising Creator boost status removed.';
      } else {
        res.status(400).json({ error: 'Unsupported user action.' });
        return;
      }

      writes.push(
        buildAuditWrite({
          actorUid: req.uid!,
          actorEmail: req.userEmail || '',
          actorRole: 'ceo',
          action,
          targetType: action === 'set_admin_permission' ? 'admin' : 'user',
          targetId: targetUid,
          targetLabel: `${targetUser.displayName || targetUid} (@${targetUser.handle || 'user'})`,
          reason: cleanReason,
          status: 'success',
          details,
        })
      );

      await fsCommit(idToken, writes);
      res.json({ ok: true, action, targetUid, details });
    } catch (err: any) {
      await recordAuditStandalone(req.idToken!, {
        actorUid: req.uid!,
        actorEmail: req.userEmail || '',
        actorRole: 'ceo',
        action,
        targetType: 'user',
        targetId: targetUid,
        reason: cleanReason,
        status: 'failed',
        details: err?.message || 'User action failed',
      });
      res.status(500).json({ error: err?.message || 'Failed to execute CEO user action.' });
    }
  });

  // CEO-Only Granular Admin Permissions Management
  router.post('/ceo/admins/permissions', async (req: CeoAuthedRequest, res) => {
    const { targetUid, enabled, permissions, notes, reason } = req.body || {};
    if (!targetUid || typeof targetUid !== 'string') {
      res.status(400).json({ error: 'Target Admin UID is required.' });
      return;
    }
    if (targetUid === req.uid) {
      res.status(400).json({ error: 'Cannot alter CEO clearance as a regular Admin record.' });
      return;
    }
    const cleanReason = String(reason || notes || '').trim();
    if (cleanReason.length < 3) {
      res.status(400).json({ error: 'Audit reason (minimum 3 characters) is required.' });
      return;
    }

    const ok = await checkSensitiveStepUpAuth(req, res, {
      permanent: false,
      actionName: enabled ? 'update_admin_permissions' : 'revoke_admin_role',
      targetType: 'admin',
      targetId: targetUid,
      reason: cleanReason,
    });
    if (!ok) return;

    try {
      const idToken = req.idToken!;
      const [targetUser, privDoc, existingAdmin, targetCeo] = await Promise.all([
        fsGetDoc<Record<string, any>>(idToken, `users/${targetUid}`),
        fsGetDoc<Record<string, any>>(idToken, `users/${targetUid}/private/account`).catch(() => null),
        fsGetDoc<Record<string, any>>(idToken, `admins/${targetUid}`).catch(() => null),
        fsGetDoc<Record<string, any>>(idToken, `ceoRoles/${targetUid}`).catch(() => null),
      ]);

      if (!targetUser) {
        res.status(404).json({ error: 'Target user does not exist.' });
        return;
      }
      if (targetCeo || privDoc?.role === 'ceo') {
        res.status(403).json({ error: 'Cannot downgrade or modify CEO permissions.' });
        return;
      }

      const writes: CommitWrite[] = [];
      let details = '';

      if (enabled) {
        const cleanPerms = sanitizePermissions(permissions);
        if (existingAdmin) {
          writes.push({
            update: {
              name: docName(`admins/${targetUid}`),
              fields: encodeFields({
                displayName: String(targetUser.displayName || '').slice(0, 80),
                email: String(privDoc?.email || '').slice(0, 160),
                permissions: cleanPerms,
                grantedBy: req.uid!,
                notes: String(notes || cleanReason).slice(0, 300),
              }),
            },
            updateMask: { fieldPaths: ['displayName', 'email', 'permissions', 'grantedBy', 'notes', 'updatedAt'] },
            updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
          });
        } else {
          writes.push({
            update: {
              name: docName(`admins/${targetUid}`),
              fields: encodeFields({
                uid: targetUid,
                displayName: String(targetUser.displayName || '').slice(0, 80),
                email: String(privDoc?.email || '').slice(0, 160),
                permissions: cleanPerms,
                grantedBy: req.uid!,
                notes: String(notes || cleanReason).slice(0, 300),
              }),
            },
            currentDocument: { exists: false },
            updateTransforms: [
              { fieldPath: 'grantedAt', setToServerValue: 'REQUEST_TIME' },
              { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
            ],
          });
        }

        if (privDoc) {
          writes.push({
            update: {
              name: docName(`users/${targetUid}/private/account`),
              fields: encodeFields({ role: 'admin' }),
            },
            updateMask: { fieldPaths: ['role', 'updatedAt'] },
            updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
          });
        }

        const grantedKeys = Object.entries(cleanPerms)
          .filter(([, v]) => v)
          .map(([k]) => k);
        details = `Admin permissions updated: ${grantedKeys.length ? grantedKeys.join(', ') : 'none (view-only)'}.`;
      } else {
        if (existingAdmin) {
          writes.push({ delete: docName(`admins/${targetUid}`) });
        }
        if (privDoc) {
          writes.push({
            update: {
              name: docName(`users/${targetUid}/private/account`),
              fields: encodeFields({ role: targetUser.isCreator ? 'creator' : 'viewer' }),
            },
            updateMask: { fieldPaths: ['role', 'updatedAt'] },
            updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
          });
        }
        details = 'Admin role & all delegated permissions revoked.';
      }

      writes.push(
        buildAuditWrite({
          actorUid: req.uid!,
          actorEmail: req.userEmail || '',
          actorRole: 'ceo',
          action: enabled ? 'update_admin_permissions' : 'revoke_admin_role',
          targetType: 'admin',
          targetId: targetUid,
          targetLabel: `${targetUser.displayName || targetUid} (@${targetUser.handle || 'admin'})`,
          reason: cleanReason,
          status: 'success',
          details,
        })
      );

      await fsCommit(idToken, writes);
      res.json({ ok: true, details });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to update admin permissions.' });
    }
  });

  // CEO-Only Platform Monetization & Global Settings
  router.post('/ceo/monetization/config', async (req: CeoAuthedRequest, res) => {
    const {
      creatorRevenueSharePercent,
      adSharePercent,
      membershipSharePercent,
      supportSharePercent,
      paidVideoSharePercent,
      minPayoutInr,
      earlyCreatorBoostEnabled,
      maintenanceMode,
      categories,
      languages,
      reason,
    } = req.body || {};

    const cleanReason = String(reason || 'CEO platform monetization & configuration update').trim();
    const ok = await checkSensitiveStepUpAuth(req, res, {
      permanent: false,
      actionName: 'update_platform_config',
      targetType: 'config',
      targetId: 'settings',
      reason: cleanReason,
    });
    if (!ok) return;

    const revShare = Math.min(95, Math.max(10, Number(creatorRevenueSharePercent ?? 75)));
    const safeAdShare = Math.min(95, Math.max(10, Number(adSharePercent ?? revShare)));
    const safeMemShare = Math.min(95, Math.max(10, Number(membershipSharePercent ?? 80)));
    const safeSupShare = Math.min(98, Math.max(50, Number(supportSharePercent ?? 90)));
    const safePaidShare = Math.min(95, Math.max(10, Number(paidVideoSharePercent ?? revShare)));
    const minPayout = Math.min(50000, Math.max(100, Number(minPayoutInr ?? 500)));
    const gatewayConfigured = Boolean(process.env.PAYMENT_GATEWAY_KEY_ID && process.env.PAYMENT_GATEWAY_KEY_SECRET);

    try {
      const idToken = req.idToken!;
      const existingCfg = await fsGetDoc<Record<string, any>>(idToken, 'platformConfig/settings').catch(() => null);

      const safeCategories = Array.isArray(categories) && categories.length
        ? categories.map((c) => String(c).trim()).filter(Boolean).slice(0, 20)
        : existingCfg?.categories || ['All', 'Music', 'Tech', 'Gaming', 'Education', 'Comedy', 'Vlogs', 'Podcasts', 'Regional', 'Movies'];

      const safeLanguages = Array.isArray(languages) && languages.length
        ? languages.map((l) => String(l).trim()).filter(Boolean).slice(0, 20)
        : existingCfg?.languages || ['All Languages', 'Hindi', 'English', 'Punjabi', 'Rajasthani', 'Tamil', 'Telugu', 'Bengali', 'Marathi'];

      const writes: CommitWrite[] = [
        {
          update: {
            name: docName('platformConfig/settings'),
            fields: encodeFields({
              categories: safeCategories,
              languages: safeLanguages,
              earlyCreatorBoostEnabled: Boolean(earlyCreatorBoostEnabled),
              creatorRevenueSharePercent: revShare,
              adSharePercent: safeAdShare,
              membershipSharePercent: safeMemShare,
              supportSharePercent: safeSupShare,
              paidVideoSharePercent: safePaidShare,
              paymentGatewayMode: gatewayConfigured ? 'live' : 'unconfigured',
              minPayoutInr: minPayout,
              maintenanceMode: Boolean(maintenanceMode),
            }),
          },
          updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
        },
        buildAuditWrite({
          actorUid: req.uid!,
          actorEmail: req.userEmail || '',
          actorRole: 'ceo',
          action: 'update_platform_config',
          targetType: 'config',
          targetId: 'settings',
          targetLabel: 'Platform Settings & Monetization',
          reason: cleanReason,
          status: 'success',
          details: `Ad=${safeAdShare}%, Membership=${safeMemShare}%, Support=${safeSupShare}%, PaidVideo=${safePaidShare}%, MinPayout=₹${minPayout}`,
        }),
      ];

      await fsCommit(idToken, writes);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to save platform monetization settings.' });
    }
  });

  // CEO-Only Creator Monetization Eligibility & Earnings Adjustment
  router.post('/ceo/monetization/creator', async (req: CeoAuthedRequest, res) => {
    const { targetUid, monetizationEnabled, estimatedEarningsInr, reason } = req.body || {};
    if (!targetUid || typeof targetUid !== 'string') {
      res.status(400).json({ error: 'Target creator UID is required.' });
      return;
    }
    const cleanReason = String(reason || '').trim();
    if (cleanReason.length < 3) {
      res.status(400).json({ error: 'Audit reason (minimum 3 characters) is required.' });
      return;
    }

    const ok = await checkSensitiveStepUpAuth(req, res, {
      permanent: false,
      actionName: 'manage_creator_monetization',
      targetType: 'payout',
      targetId: targetUid,
      reason: cleanReason,
    });
    if (!ok) return;

    try {
      const idToken = req.idToken!;
      const [targetUser, privDoc] = await Promise.all([
        fsGetDoc<Record<string, any>>(idToken, `users/${targetUid}`),
        fsGetDoc<Record<string, any>>(idToken, `users/${targetUid}/private/account`).catch(() => null),
      ]);
      if (!targetUser) {
        res.status(404).json({ error: 'Creator user profile not found.' });
        return;
      }
      if (!privDoc) {
        res.status(400).json({ error: 'Creator has not initialized private payout ledger yet.' });
        return;
      }

      const nextMonetization = typeof monetizationEnabled === 'boolean' ? monetizationEnabled : Boolean(privDoc.monetizationEnabled);
      const nextEarnings =
        typeof estimatedEarningsInr === 'number' && !Number.isNaN(estimatedEarningsInr)
          ? Math.max(0, Math.round(estimatedEarningsInr))
          : Number(privDoc.estimatedEarningsInr || 0);

      const writes: CommitWrite[] = [
        {
          update: {
            name: docName(`users/${targetUid}/private/account`),
            fields: encodeFields({
              monetizationEnabled: nextMonetization,
              estimatedEarningsInr: nextEarnings,
            }),
          },
          updateMask: { fieldPaths: ['monetizationEnabled', 'estimatedEarningsInr', 'updatedAt'] },
          updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
        },
        buildAuditWrite({
          actorUid: req.uid!,
          actorEmail: req.userEmail || '',
          actorRole: 'ceo',
          action: 'manage_creator_monetization',
          targetType: 'payout',
          targetId: targetUid,
          targetLabel: `${targetUser.displayName || targetUid} (@${targetUser.handle || 'creator'})`,
          reason: cleanReason,
          status: 'success',
          details: `Monetization=${nextMonetization ? 'enabled' : 'disabled'}, Balance=₹${nextEarnings}`,
        }),
      ];

      await fsCommit(idToken, writes);
      res.json({ ok: true, monetizationEnabled: nextMonetization, estimatedEarningsInr: nextEarnings });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to update creator monetization ledger.' });
    }
  });

  // CEO-Only Creator Payout Processing
  router.post('/ceo/payouts/action', async (req: CeoAuthedRequest, res) => {
    const { payoutId, status, reason, creatorId, amountInr, upiId } = req.body || {};
    const cleanReason = String(reason || '').trim();
    if (cleanReason.length < 3) {
      res.status(400).json({ error: 'Audit reason (minimum 3 characters) is required.' });
      return;
    }

    const ok = await checkSensitiveStepUpAuth(req, res, {
      permanent: false,
      actionName: `payout_${status || 'process'}`,
      targetType: 'payout',
      targetId: payoutId || creatorId || 'payout',
      reason: cleanReason,
    });
    if (!ok) return;

    try {
      const idToken = req.idToken!;
      const writes: CommitWrite[] = [];

      if (payoutId) {
        if (!['approved', 'paid', 'rejected'].includes(status)) {
          res.status(400).json({ error: 'Invalid payout status transition.' });
          return;
        }
        const payoutDoc = await fsGetDoc<Record<string, any>>(idToken, `creatorPayouts/${payoutId}`);
        if (!payoutDoc) {
          res.status(404).json({ error: 'Payout request not found.' });
          return;
        }

        writes.push({
          update: {
            name: docName(`creatorPayouts/${payoutId}`),
            fields: encodeFields({
              status,
              notes: cleanReason.slice(0, 300),
              processedByUid: req.uid!,
            }),
          },
          updateMask: { fieldPaths: ['status', 'notes', 'processedByUid', 'updatedAt'] },
          updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
        });

        // If marked paid, record verified payout debit in monetizationTransactions ledger
        if (status === 'paid' && payoutDoc.creatorId) {
          const txId = `tx_pay_${payoutId}`;
          writes.push({
            update: {
              name: docName(`monetizationTransactions/${txId}`),
              fields: encodeFields({
                creatorId: payoutDoc.creatorId,
                counterpartyId: req.uid!,
                counterpartyName: 'BharatPlay Payout Desk',
                source: 'payout',
                grossInr: Number(payoutDoc.amountInr || 0),
                platformFeeInr: 0,
                netCreatorInr: Number(payoutDoc.amountInr || 0),
                status: 'paid',
                referenceId: payoutId,
                gatewayVerified: true,
                description: `UPI Payout settled to ${payoutDoc.upiId}`,
              }),
            },
            updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
          });
        }

        writes.push(
          buildAuditWrite({
            actorUid: req.uid!,
            actorEmail: req.userEmail || '',
            actorRole: 'ceo',
            action: `payout_${status}`,
            targetType: 'payout',
            targetId: payoutId,
            targetLabel: `${payoutDoc.creatorName || payoutDoc.creatorId} · ₹${payoutDoc.amountInr}`,
            reason: cleanReason,
            status: 'success',
            details: `Payout marked ${status} (UPI: ${payoutDoc.upiId})`,
          })
        );
      } else if (creatorId && amountInr) {
        const cleanAmt = Math.max(100, Math.min(5000000, Number(amountInr)));
        const creatorProfile = await fsGetDoc<Record<string, any>>(idToken, `users/${creatorId}`);
        if (!creatorProfile) {
          res.status(404).json({ error: 'Creator profile not found.' });
          return;
        }
        const newId = `pay_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
        writes.push({
          update: {
            name: docName(`creatorPayouts/${newId}`),
            fields: encodeFields({
              creatorId,
              creatorName: String(creatorProfile.displayName || creatorId).slice(0, 80),
              creatorHandle: String(creatorProfile.handle || '').slice(0, 40),
              upiId: String(upiId || 'ceo-direct@upi').slice(0, 100),
              amountInr: cleanAmt,
              periodLabel: new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
              status: 'paid',
              notes: cleanReason.slice(0, 300),
              processedByUid: req.uid!,
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
            actorRole: 'ceo',
            action: 'issue_direct_payout',
            targetType: 'payout',
            targetId: newId,
            targetLabel: `${creatorProfile.displayName} · ₹${cleanAmt}`,
            reason: cleanReason,
            status: 'success',
            details: `CEO issued direct UPI payout of ₹${cleanAmt}`,
          })
        );
      } else {
        res.status(400).json({ error: 'Provide payoutId & status or creatorId & amountInr.' });
        return;
      }

      await fsCommit(idToken, writes);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to process creator payout.' });
    }
  });

  // Review Reports (Video or User reports)
  router.post('/ceo/reports/action', async (req: CeoAuthedRequest, res) => {
    const { reportId, status, reason, alsoSoftRemoveTarget } = req.body || {};
    if (!reportId || !['reviewed', 'resolved', 'dismissed'].includes(status)) {
      res.status(400).json({ error: 'Valid reportId and status are required.' });
      return;
    }
    const cleanReason = String(reason || '').trim() || `Report marked ${status} by CEO`;
    try {
      const idToken = req.idToken!;
      const reportDoc = await fsGetDoc<Record<string, any>>(idToken, `reports/${reportId}`);
      if (!reportDoc) {
        res.status(404).json({ error: 'Report not found.' });
        return;
      }

      const writes: CommitWrite[] = [
        {
          update: {
            name: docName(`reports/${reportId}`),
            fields: encodeFields({ status }),
          },
          updateMask: { fieldPaths: ['status'] },
        },
      ];

      if (alsoSoftRemoveTarget && reportDoc.targetType === 'video' && reportDoc.targetId) {
        const vid = await fsGetDoc(idToken, `videos/${reportDoc.targetId}`);
        if (vid) {
          writes.push({
            update: {
              name: docName(`videos/${reportDoc.targetId}`),
              fields: encodeFields({
                status: 'removed',
                removalReason: cleanReason.slice(0, 500),
                removedBy: req.uid!,
              }),
            },
            updateMask: { fieldPaths: ['status', 'removalReason', 'removedBy', 'updatedAt'] },
            updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
          });
        }
      }

      writes.push(
        buildAuditWrite({
          actorUid: req.uid!,
          actorEmail: req.userEmail || '',
          actorRole: 'ceo',
          action: `report_${status}`,
          targetType: 'report',
          targetId: reportId,
          targetLabel: String(reportDoc.targetTitle || reportDoc.targetId || reportId),
          reason: cleanReason,
          status: 'success',
          details: alsoSoftRemoveTarget
            ? `Report ${status} and reported target soft-removed.`
            : `Report marked ${status}.`,
        })
      );

      await fsCommit(idToken, writes);
      res.json({ ok: true, reportId, status });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to update report.' });
    }
  });

  // Global Platform Announcements (Create, Toggle, Delete)
  router.post('/ceo/announcements', async (req: CeoAuthedRequest, res) => {
    const { action = 'publish', announcementId, title, body, category = 'policy', isActive } = req.body || {};
    const ok = await checkSensitiveStepUpAuth(req, res, {
      permanent: false,
      actionName: `announcement_${action}`,
      targetType: 'announcement',
      targetId: announcementId || 'new_announcement',
      reason: String(title || 'Global CEO announcement'),
    });
    if (!ok) return;

    try {
      const idToken = req.idToken!;
      const writes: CommitWrite[] = [];
      let targetId = announcementId || `ann_ceo_${Date.now().toString(36)}`;
      let auditAction = 'publish_announcement';
      let auditReason = String(title || 'Announcement update');

      if (action === 'publish') {
        const cleanTitle = String(title || '').trim();
        const cleanBody = String(body || '').trim();
        if (cleanTitle.length < 2 || cleanBody.length < 3) {
          res.status(400).json({ error: 'Announcement title and message body are required.' });
          return;
        }
        const safeCategory = ['feature', 'league', 'policy', 'event'].includes(category)
          ? category
          : 'policy';
        writes.push({
          update: {
            name: docName(`announcements/${targetId}`),
            fields: encodeFields({
              title: cleanTitle.slice(0, 120),
              body: cleanBody.slice(0, 600),
              category: safeCategory,
              createdBy: 'BHARATPLAY CEO Office',
              isActive: true,
            }),
          },
          currentDocument: { exists: false },
          updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
        });
        auditReason = cleanTitle;
      } else if (action === 'toggle' && announcementId) {
        writes.push({
          update: {
            name: docName(`announcements/${announcementId}`),
            fields: encodeFields({ isActive: Boolean(isActive) }),
          },
          updateMask: { fieldPaths: ['isActive'] },
        });
        auditAction = isActive ? 'activate_announcement' : 'pause_announcement';
      } else if (action === 'delete' && announcementId) {
        writes.push({ delete: docName(`announcements/${announcementId}`) });
        auditAction = 'delete_announcement';
      } else {
        res.status(400).json({ error: 'Invalid announcement operation.' });
        return;
      }

      writes.push(
        buildAuditWrite({
          actorUid: req.uid!,
          actorEmail: req.userEmail || '',
          actorRole: 'ceo',
          action: auditAction,
          targetType: 'announcement',
          targetId,
          targetLabel: auditReason.slice(0, 150),
          reason: auditReason,
          status: 'success',
          details: 'Platform-wide CEO announcement updated.',
        })
      );

      await fsCommit(idToken, writes);
      res.json({ ok: true, id: targetId });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to publish global announcement.' });
    }
  });

  // =========================================================================
  // SCOPED ADMIN ROUTES (Strictly Limited to Explicit CEO-Granted Permissions)
  // Every Admin action is server-verified & automatically written to Audit Log
  // =========================================================================
  router.use('/admin', verifyBearerToken, loadAdminMiddleware);

  router.post('/admin/creators/flags', requireAdminPerm('manageCreators'), async (req: CeoAuthedRequest, res) => {
    const { targetUid, updates } = req.body || {};
    if (!targetUid || typeof targetUid !== 'string' || !updates || typeof updates !== 'object') {
      res.status(400).json({ error: 'Target creator UID and updates are required.' });
      return;
    }

    try {
      const idToken = req.idToken!;
      const [targetUser, targetCeo] = await Promise.all([
        fsGetDoc<Record<string, any>>(idToken, `users/${targetUid}`),
        fsGetDoc<Record<string, any>>(idToken, `ceoRoles/${targetUid}`).catch(() => null),
      ]);
      if (!targetUser) {
        res.status(404).json({ error: 'Creator profile not found.' });
        return;
      }
      if (targetCeo) {
        res.status(403).json({ error: 'Admins cannot modify CEO account attributes.' });
        return;
      }

      const allowedUpdates: Record<string, unknown> = {};
      const fieldPaths: string[] = [];

      if (typeof updates.isFeatured === 'boolean') {
        allowedUpdates.isFeatured = updates.isFeatured;
        fieldPaths.push('isFeatured');
      }
      if (typeof updates.isVerified === 'boolean') {
        allowedUpdates.isVerified = updates.isVerified;
        fieldPaths.push('isVerified');
      }
      if (typeof updates.boostEnabled === 'boolean') {
        allowedUpdates.boostEnabled = updates.boostEnabled;
        fieldPaths.push('boostEnabled');
      }
      if (typeof updates.isEarlyCreator === 'boolean') {
        allowedUpdates.isEarlyCreator = updates.isEarlyCreator;
        fieldPaths.push('isEarlyCreator');
      }
      if (typeof updates.leagueCategory === 'string') {
        allowedUpdates.leagueCategory = updates.leagueCategory.slice(0, 40);
        fieldPaths.push('leagueCategory');
      }
      if (['Seed', 'Rising', 'Star', 'Icon'].includes(updates.rewardTier)) {
        allowedUpdates.rewardTier = updates.rewardTier;
        fieldPaths.push('rewardTier');
      }

      if (fieldPaths.length === 0) {
        res.status(400).json({ error: 'No permitted creator flags provided.' });
        return;
      }

      fieldPaths.push('updatedAt');
      const writes: CommitWrite[] = [
        {
          update: {
            name: docName(`users/${targetUid}`),
            fields: encodeFields(allowedUpdates),
          },
          updateMask: { fieldPaths },
          updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
        },
        buildAuditWrite({
          actorUid: req.uid!,
          actorEmail: req.userEmail || '',
          actorRole: req.isCeo ? 'ceo' : 'admin',
          action: 'admin_update_creator_flags',
          targetType: 'user',
          targetId: targetUid,
          targetLabel: `${targetUser.displayName || targetUid} (@${targetUser.handle || 'creator'})`,
          reason: `Updated creator flags: ${Object.keys(allowedUpdates).join(', ')}`,
          status: 'success',
          details: JSON.stringify(allowedUpdates).slice(0, 500),
        }),
      ];

      await fsCommit(idToken, writes);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to update creator flags.' });
    }
  });

  router.post('/admin/videos/status', requireAdminPerm('moderateVideos'), async (req: CeoAuthedRequest, res) => {
    const { videoId, status, isTrending, isOriginal, removalReason } = req.body || {};
    if (!videoId || typeof videoId !== 'string' || !['published', 'flagged', 'removed'].includes(status)) {
      res.status(400).json({ error: 'Valid videoId and status are required.' });
      return;
    }

    try {
      const idToken = req.idToken!;
      const videoDoc = await fsGetDoc<Record<string, any>>(idToken, `videos/${videoId}`);
      if (!videoDoc) {
        res.status(404).json({ error: 'Video not found.' });
        return;
      }

      const fields: Record<string, unknown> = {
        status,
        removalReason: status === 'removed' ? String(removalReason || 'Removed by Admin moderation').slice(0, 500) : '',
        removedBy: status === 'removed' ? req.uid! : '',
      };
      const fieldPaths = ['status', 'removalReason', 'removedBy', 'updatedAt'];

      if (typeof isTrending === 'boolean') {
        fields.isTrending = isTrending;
        fieldPaths.push('isTrending');
      }
      if (typeof isOriginal === 'boolean') {
        fields.isOriginal = isOriginal;
        fieldPaths.push('isOriginal');
      }

      const writes: CommitWrite[] = [
        {
          update: {
            name: docName(`videos/${videoId}`),
            fields: encodeFields(fields),
          },
          updateMask: { fieldPaths },
          updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
        },
        buildAuditWrite({
          actorUid: req.uid!,
          actorEmail: req.userEmail || '',
          actorRole: req.isCeo ? 'ceo' : 'admin',
          action: `admin_video_${status}`,
          targetType: 'video',
          targetId: videoId,
          targetLabel: String(videoDoc.title || videoId),
          reason: String(removalReason || `Video moderation updated (${status})`),
          status: 'success',
          details: `Trending=${Boolean(isTrending ?? videoDoc.isTrending)}, Original=${Boolean(isOriginal ?? videoDoc.isOriginal)}`,
        }),
      ];

      await fsCommit(idToken, writes);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to update video moderation status.' });
    }
  });

  router.post('/admin/reports/resolve', requireAdminPerm('resolveReports'), async (req: CeoAuthedRequest, res) => {
    const { reportId, status, reason } = req.body || {};
    if (!reportId || !['reviewed', 'resolved', 'dismissed'].includes(status)) {
      res.status(400).json({ error: 'Valid reportId and status are required.' });
      return;
    }

    try {
      const idToken = req.idToken!;
      const reportDoc = await fsGetDoc<Record<string, any>>(idToken, `reports/${reportId}`);
      if (!reportDoc) {
        res.status(404).json({ error: 'Report not found.' });
        return;
      }

      const writes: CommitWrite[] = [
        {
          update: {
            name: docName(`reports/${reportId}`),
            fields: encodeFields({ status }),
          },
          updateMask: { fieldPaths: ['status'] },
        },
        buildAuditWrite({
          actorUid: req.uid!,
          actorEmail: req.userEmail || '',
          actorRole: req.isCeo ? 'ceo' : 'admin',
          action: `admin_report_${status}`,
          targetType: 'report',
          targetId: reportId,
          targetLabel: String(reportDoc.targetTitle || reportDoc.targetId || reportId),
          reason: String(reason || `Report marked ${status} by Admin`).slice(0, 500),
          status: 'success',
        }),
      ];

      await fsCommit(idToken, writes);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to update report.' });
    }
  });

  router.post('/admin/competitions', requireAdminPerm('manageCompetitions'), async (req: CeoAuthedRequest, res) => {
    const { action } = req.body || {};
    try {
      const idToken = req.idToken!;
      const writes: CommitWrite[] = [];

      if (action === 'create_competition') {
        const { title, monthLabel, description, prizePoolInr, categories } = req.body;
        const compId = `comp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        writes.push({
          update: {
            name: docName(`competitions/${compId}`),
            fields: encodeFields({
              title: String(title || '').trim().slice(0, 120),
              monthLabel: String(monthLabel || '').trim().slice(0, 40),
              description: String(description || '').trim().slice(0, 1000),
              prizePoolInr: Math.max(0, Number(prizePoolInr || 0)),
              categories: Array.isArray(categories) && categories.length
                ? categories
                : ['Best Educational Creator', 'Best Entertainment Creator', 'Rising Star'],
              winnerCreatorId: '',
              winnerCreatorName: '',
              status: 'active',
            }),
          },
          currentDocument: { exists: false },
          updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
        });
        writes.push(
          buildAuditWrite({
            actorUid: req.uid!,
            actorEmail: req.userEmail || '',
            actorRole: req.isCeo ? 'ceo' : 'admin',
            action: 'admin_create_competition',
            targetType: 'competition',
            targetId: compId,
            targetLabel: String(title || compId).slice(0, 150),
            reason: `Created monthly league competition (${monthLabel})`,
            status: 'success',
          })
        );
      } else if (action === 'update_competition') {
        const { compId, status, winnerCreatorId, winnerCreatorName } = req.body;
        if (!compId || !['active', 'completed'].includes(status)) {
          res.status(400).json({ error: 'Valid compId and status required.' });
          return;
        }
        const updateFields: Record<string, unknown> = { status };
        const mask = ['status'];
        if (typeof winnerCreatorId === 'string') {
          updateFields.winnerCreatorId = winnerCreatorId;
          mask.push('winnerCreatorId');
        }
        if (typeof winnerCreatorName === 'string') {
          updateFields.winnerCreatorName = winnerCreatorName;
          mask.push('winnerCreatorName');
        }
        writes.push({
          update: {
            name: docName(`competitions/${compId}`),
            fields: encodeFields(updateFields),
          },
          updateMask: { fieldPaths: mask },
        });
        writes.push(
          buildAuditWrite({
            actorUid: req.uid!,
            actorEmail: req.userEmail || '',
            actorRole: req.isCeo ? 'ceo' : 'admin',
            action: 'admin_update_competition',
            targetType: 'competition',
            targetId: compId,
            reason: `Updated competition status to ${status}`,
            status: 'success',
          })
        );
      } else if (action === 'create_challenge') {
        const { title, description, prizePoolInr, category, deadline } = req.body;
        const chgId = `chg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        writes.push({
          update: {
            name: docName(`challenges/${chgId}`),
            fields: encodeFields({
              title: String(title || '').trim().slice(0, 120),
              description: String(description || '').trim().slice(0, 1000),
              prizePoolInr: Math.max(0, Number(prizePoolInr || 0)),
              category: String(category || 'Regional').slice(0, 50),
              deadline: String(deadline || '2026-12-31').slice(0, 40),
              participantsCount: 0,
              status: 'active',
            }),
          },
          currentDocument: { exists: false },
          updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
        });
        writes.push(
          buildAuditWrite({
            actorUid: req.uid!,
            actorEmail: req.userEmail || '',
            actorRole: req.isCeo ? 'ceo' : 'admin',
            action: 'admin_create_challenge',
            targetType: 'challenge',
            targetId: chgId,
            targetLabel: String(title || chgId).slice(0, 150),
            reason: `Launched Creator Challenge (${category})`,
            status: 'success',
          })
        );
      } else {
        res.status(400).json({ error: 'Unsupported competition/challenge action.' });
        return;
      }

      await fsCommit(idToken, writes);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to update competition/challenge.' });
    }
  });

  router.post('/admin/announcements', requireAdminPerm('manageAnnouncements'), async (req: CeoAuthedRequest, res) => {
    const { action, announcementId, title, body, category, isActive, createdBy } = req.body || {};
    try {
      const idToken = req.idToken!;
      const writes: CommitWrite[] = [];

      if (action === 'create') {
        const annId = `ann_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        const cleanTitle = String(title || '').trim();
        const cleanBody = String(body || '').trim();
        if (cleanTitle.length < 2 || cleanBody.length < 3) {
          res.status(400).json({ error: 'Title and message body are required.' });
          return;
        }
        writes.push({
          update: {
            name: docName(`announcements/${annId}`),
            fields: encodeFields({
              title: cleanTitle.slice(0, 120),
              body: cleanBody.slice(0, 600),
              category: ['feature', 'league', 'policy', 'event'].includes(category) ? category : 'feature',
              createdBy: String(createdBy || 'BHARATPLAY Admin').slice(0, 80),
              isActive: true,
            }),
          },
          currentDocument: { exists: false },
          updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
        });
        writes.push(
          buildAuditWrite({
            actorUid: req.uid!,
            actorEmail: req.userEmail || '',
            actorRole: req.isCeo ? 'ceo' : 'admin',
            action: 'admin_create_announcement',
            targetType: 'announcement',
            targetId: annId,
            targetLabel: cleanTitle.slice(0, 150),
            reason: cleanTitle.slice(0, 500),
            status: 'success',
          })
        );
      } else if (action === 'toggle' && announcementId) {
        writes.push({
          update: {
            name: docName(`announcements/${announcementId}`),
            fields: encodeFields({ isActive: Boolean(isActive) }),
          },
          updateMask: { fieldPaths: ['isActive'] },
        });
        writes.push(
          buildAuditWrite({
            actorUid: req.uid!,
            actorEmail: req.userEmail || '',
            actorRole: req.isCeo ? 'ceo' : 'admin',
            action: 'admin_toggle_announcement',
            targetType: 'announcement',
            targetId: announcementId,
            reason: `Announcement ${isActive ? 'activated' : 'archived'} by Admin`,
            status: 'success',
          })
        );
      } else {
        res.status(400).json({ error: 'Unsupported announcement action.' });
        return;
      }

      await fsCommit(idToken, writes);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to update announcement.' });
    }
  });

  router.post('/admin/categories', requireAdminPerm('manageCategories'), async (req: CeoAuthedRequest, res) => {
    const { categories } = req.body || {};
    if (!Array.isArray(categories) || categories.length === 0) {
      res.status(400).json({ error: 'Non-empty categories list is required.' });
      return;
    }

    const safeCategories = Array.from(
      new Set(categories.map((c) => String(c).trim()).filter(Boolean))
    ).slice(0, 20);

    try {
      const idToken = req.idToken!;
      const existingCfg = await fsGetDoc(idToken, 'platformConfig/settings');
      if (!existingCfg) {
        res.status(400).json({ error: 'Platform config must be initialized by CEO first.' });
        return;
      }

      const writes: CommitWrite[] = [
        {
          update: {
            name: docName('platformConfig/settings'),
            fields: encodeFields({ categories: safeCategories }),
          },
          updateMask: { fieldPaths: ['categories', 'updatedAt'] },
          updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
        },
        buildAuditWrite({
          actorUid: req.uid!,
          actorEmail: req.userEmail || '',
          actorRole: req.isCeo ? 'ceo' : 'admin',
          action: 'admin_update_categories',
          targetType: 'config',
          targetId: 'settings',
          targetLabel: 'Discovery Categories',
          reason: `Categories updated (${safeCategories.length} entries)`,
          status: 'success',
        }),
      ];

      await fsCommit(idToken, writes);
      res.json({ ok: true, categories: safeCategories });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to update discovery categories.' });
    }
  });

  return router;
}
