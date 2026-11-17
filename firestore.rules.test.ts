/**
 * BHARATPLAY Firestore Security Rules Verification Spec
 * Maps each of the "Dirty Dozen" adversarial payloads to expected PERMISSION_DENIED outcomes.
 */
export interface AdversarialTestCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: { uid: string; email?: string; email_verified?: boolean } | null;
  payload?: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED';
}

export const dirtyDozenTests: AdversarialTestCase[] = [
  {
    id: 1,
    name: 'Shadow CEO Role Escalation',
    collectionPath: 'users/admin_1/private/account',
    operation: 'update',
    auth: { uid: 'admin_1', email: 'mod@example.com', email_verified: true },
    payload: { uid: 'admin_1', email: 'mod@example.com', role: 'ceo' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unauthorized Audit Log Tampering',
    collectionPath: 'ceoAuditLogs/log_1',
    operation: 'delete',
    auth: { uid: 'admin_1', email: 'mod@example.com', email_verified: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Unauthorized CEO Role Injection',
    collectionPath: 'ceoRoles/admin_1',
    operation: 'create',
    auth: { uid: 'admin_1', email: 'mod@example.com', email_verified: true },
    payload: { uid: 'admin_1', clearanceLevel: 'CEO' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Spoofed Creator Upload',
    collectionPath: 'videos/vid_spoof_1',
    operation: 'create',
    auth: { uid: 'attacker_1', email: 'attacker@example.com', email_verified: true },
    payload: { creatorId: 'creator_b', creatorName: 'Legit', title: 'Spoof', videoUrl: '/api/media/x.mp4', type: 'video', category: 'Tech', language: 'Hindi', status: 'published' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Oversized ID Poisoning',
    collectionPath: `videos/${'a'.repeat(200)}`,
    operation: 'create',
    auth: { uid: 'creator_1', email: 'c@example.com', email_verified: true },
    payload: { creatorId: 'creator_1', title: 'Test' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Unverified Email Write',
    collectionPath: 'videos/vid_1/comments/c_1',
    operation: 'create',
    auth: { uid: 'user_unverified', email: 'u@example.com', email_verified: false },
    payload: { videoId: 'vid_1', authorId: 'user_unverified', authorName: 'Unverified', text: 'Spam' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'PII Cross-Read',
    collectionPath: 'users/user_b/private/account',
    operation: 'get',
    auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Shadow Field Injection on Profile Update',
    collectionPath: 'users/creator_1',
    operation: 'update',
    auth: { uid: 'creator_1', email: 'c@example.com', email_verified: true },
    payload: { displayName: 'New Name', accountStatus: 'active', isVerified: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Timestamp Forgery on Audit Log',
    collectionPath: 'ceoAuditLogs/log_fake',
    operation: 'create',
    auth: { uid: 'viewer_1', email: 'v@example.com', email_verified: true },
    payload: { actorUid: 'viewer_1', action: 'delete', targetType: 'video', targetId: 'v1', reason: 'fake', status: 'success', createdAt: '2020-01-01T00:00:00Z' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Orphaned Comment Write',
    collectionPath: 'videos/nonexistent_vid/comments/c_99',
    operation: 'create',
    auth: { uid: 'user_1', email: 'u@example.com', email_verified: true },
    payload: { videoId: 'nonexistent_vid', authorId: 'user_1', authorName: 'User', text: 'Orphan' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Non-CEO Account Deletion',
    collectionPath: 'users/user_victim',
    operation: 'delete',
    auth: { uid: 'admin_1', email: 'mod@example.com', email_verified: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Unscoped Notification Read',
    collectionPath: 'notifications/notif_other',
    operation: 'get',
    auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
];
