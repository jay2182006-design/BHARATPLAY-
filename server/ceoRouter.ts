import express from 'express';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };

export interface CeoAuthedRequest extends express.Request {
  uid?: string;
  userEmail?: string;
  emailVerified?: boolean;
  authTime?: number;
  idToken?: string;
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

function docName(docPath: string): string {
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

async function fsListCollection<T = Record<string, unknown>>(
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

interface CommitWrite {
  update?: {
    name: string;
    fields: Record<string, FsValue>;
  };
  updateMask?: { fieldPaths: string[] };
  updateTransforms?: { fieldPath: string; setToServerValue: 'REQUEST_TIME' }[];
  currentDocument?: { exists: boolean };
  delete?: string;
}

async function fsCommit(idToken: string, writes: CommitWrite[]): Promise<void> {
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

function encodeFields(obj: Record<string, unknown>): Record<string, FsValue> {
  const fields: Record<string, FsValue> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) fields[k] = encodeFsValue(v);
  }
  return fields;
}

function buildAuditWrite(params: {
  actorUid: string;
  actorEmail: string;
  action: string;
  targetType: 'user' | 'channel' | 'video' | 'report' | 'announcement' | 'system';
  targetId: string;
  targetLabel?: string;
  reason: string;
  status: 'success' | 'blocked' | 'failed';
  details?: string;
}): CommitWrite {
  const logId = `ceo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    update: {
      name: docName(`ceoAuditLogs/${logId}`),
      fields: encodeFields({
        actorUid: params.actorUid.slice(0, 128),
        actorEmail: params.actorEmail.slice(0, 160),
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
    console.error('Failed to persist CEO audit log:', err);
  }
}

function requireCeoMiddleware(
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
  next();
}

async function checkSensitiveStepUpAuth(
  req: CeoAuthedRequest,
  res: express.Response,
  options: {
    permanent?: boolean;
    actionName: string;
    targetType: 'user' | 'channel' | 'video' | 'report' | 'announcement' | 'system';
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
    if (!isAdmin && req.uid && req.idToken) {
      try {
        const adminDoc = await fsGetDoc(req.idToken, `admins/${req.uid}`);
        isAdmin = Boolean(adminDoc);
      } catch {
        isAdmin = false;
      }
    }
    res.json({
      isCeo,
      isAdmin,
      authTime: req.authTime || 0,
    });
  });

  // All routes below strictly require verified CEO clearance
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

  // CEO Overview & Live Telemetry
  router.get('/ceo/overview', async (req: CeoAuthedRequest, res) => {
    try {
      const idToken = req.idToken!;
      const [users, videos, reports, announcements, auditLogs, liveStreams, challenges, competitions] =
        await Promise.all([
          fsListCollection<Record<string, any>>(idToken, 'users', 300),
          fsListCollection<Record<string, any>>(idToken, 'videos', 300),
          fsListCollection<Record<string, any>>(idToken, 'reports', 200).catch(() => []),
          fsListCollection<Record<string, any>>(idToken, 'announcements', 100).catch(() => []),
          fsListCollection<Record<string, any>>(idToken, 'ceoAuditLogs', 250).catch(() => []),
          fsListCollection<Record<string, any>>(idToken, 'liveStreams', 100).catch(() => []),
          fsListCollection<Record<string, any>>(idToken, 'challenges', 100).catch(() => []),
          fsListCollection<Record<string, any>>(idToken, 'competitions', 100).catch(() => []),
        ]);

      // Fetch private account metadata (role, email, suspended) for users in small parallel batches
      const privateMap = new Map<string, Record<string, any>>();
      const batchTargets = users.slice(0, 60);
      await Promise.all(
        batchTargets.map(async (u) => {
          try {
            const p = await fsGetDoc<Record<string, any>>(idToken, `users/${u.uid || u.id}/private/account`);
            if (p) privateMap.set(u.uid || u.id, p);
          } catch {
            // Seeded system creators may not have private/account doc
          }
        })
      );

      const enrichedUsers: Array<Record<string, any>> = users.map((u) => {
        const uid = u.uid || u.id;
        const priv = privateMap.get(uid);
        return {
          ...u,
          uid,
          email: priv?.email || '',
          role: priv?.role || (u.isCreator ? 'creator' : 'viewer'),
          accountStatus: u.accountStatus || (priv?.suspended ? 'suspended' : 'active'),
          channelStatus: u.channelStatus || 'active',
        };
      });

      const sortTsDesc = (a: any, b: any) =>
        new Date(b.createdAt || b.updatedAt || 0).getTime() -
        new Date(a.createdAt || a.updatedAt || 0).getTime();

      videos.sort(sortTsDesc);
      reports.sort(sortTsDesc);
      announcements.sort(sortTsDesc);
      auditLogs.sort(sortTsDesc);

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
      const pendingReports = reports.filter((r) => r.status === 'pending').length;

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
          activeUsers,
          suspendedAccounts,
          suspendedChannels,
          pendingReports,
          liveStreamsActive: liveStreams.filter((s) => s.isLive).length,
          activeChallenges: challenges.filter((c) => c.status === 'active').length,
          activeCompetitions: competitions.filter((c) => c.status === 'active').length,
        },
        users: enrichedUsers,
        videos,
        reports,
        announcements,
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

  // User Governance, Permissions & Creator Verification Actions
  router.post('/ceo/users/action', async (req: CeoAuthedRequest, res) => {
    const { action, targetUid, reason, value } = req.body || {};
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
        res.status(400).json({ error: 'Cannot execute destructive account actions against the active CEO account.' });
        return;
      }

      const privDoc = await fsGetDoc<Record<string, any>>(idToken, `users/${targetUid}/private/account`).catch(
        () => null
      );

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
        if (privDoc && privDoc.role !== 'ceo') {
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
        if (allowAdmin) {
          writes.push({
            update: {
              name: docName(`admins/${targetUid}`),
              fields: encodeFields({ uid: targetUid }),
            },
            updateTransforms: [{ fieldPath: 'grantedAt', setToServerValue: 'REQUEST_TIME' }],
          });
        } else {
          writes.push({ delete: docName(`admins/${targetUid}`) });
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
        details = allowAdmin ? 'Regular Admin role granted (non-CEO).' : 'Regular Admin role revoked.';
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
          action,
          targetType: 'user',
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

  return router;
}
