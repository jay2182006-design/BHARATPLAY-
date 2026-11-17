# BHARATPLAY Firestore Security Specification

## 1. Data Invariants
1. **Identity Integrity**: Every user-owned document (`videos.creatorId`, `comments.authorId`, `reactions.userId`, `subscriptions.subscriberId`, `playlists.ownerId`, `communityPosts.creatorId`, `creatorSupports.supporterId`, `liveStreams.creatorId`, `liveChatMessages.senderId`, `reports.reporterId`, `watchHistory.userId`) MUST equal `request.auth.uid` on create and remain immutable on update.
2. **PII Isolation**: Private user data (`email`, `role`, `upiId`, `estimatedEarningsInr`, `monetizationEnabled`, `notificationsEnabled`, `suspended`, `suspensionReason`) lives strictly under `/users/{userId}/private/account` and is readable/writable only by the owning user, regular admin (excluding CEO assignment), or CEO. Public profiles under `/users/{userId}` contain zero PII.
3. **Strict CEO Exclusivity & Zero Privilege Escalation**:
   - Non-CEO users (viewers, creators, moderators, and regular admins) CANNOT read or write `/ceoRoles/{id}`, `/ceoAuditLogs/{id}`, or set `role == 'ceo'` in `/users/{uid}/private/account`.
   - Non-admins cannot create or update `/users/{userId}/private/account` with `role in ['admin', 'ceo']`, nor write to `/admins/{adminId}` or `/platformConfig/{configId}`.
   - Only `isCEO()` can permanently delete user documents (`/users/{uid}`) or mutate `ceoRoles`.
4. **Immutable Audit Trail**: `/ceoAuditLogs/{logId}` is append-only (`create` strictly allowed for `isCEO()` with `actorUid == request.auth.uid && createdAt == request.time`), strictly readable only by `isCEO()`, and permanently immutable (`allow update, delete: if false`).
5. **Temporal & Relational Integrity**: All `createdAt` / `updatedAt` timestamps must equal `request.time` on write. Child subcollection writes verify parent document existence via `exists()`.
6. **Strict Payload Boundaries**: Every string field has explicit `.size()` bounds; every array has explicit `.size()` bounds; every create checks `keys().hasAll(...) && keys().hasOnly(...)`; every update checks `affectedKeys().hasOnly(...)`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Shadow CEO Role Escalation**: Viewer or regular admin attempts to set `role: "ceo"` in `/users/{uid}/private/account`. -> Expected: `PERMISSION_DENIED`.
2. **Unauthorized Audit Log Tampering**: Any user or admin attempts to update or delete a record in `/ceoAuditLogs/{logId}`. -> Expected: `PERMISSION_DENIED`.
3. **Unauthorized CEO Role Injection**: Regular admin attempts to write to `/ceoRoles/{uid}`. -> Expected: `PERMISSION_DENIED`.
4. **Spoofed Creator Upload**: User A attempts to create a video under `/videos/{id}` with `creatorId: "userB"`. -> Expected: `PERMISSION_DENIED`.
5. **Oversized ID Poisoning**: Attacker attempts to write to `/videos/` with a 500-character document ID containing `$` and `/`. -> Expected: `PERMISSION_DENIED`.
6. **Unverified Email Admin/CEO Spoof**: Authenticated user matching CEO/admin email with `email_verified: false` attempts privileged read/write. -> Expected: `PERMISSION_DENIED`.
7. **PII Cross-Read**: User A attempts `get` on `/users/userB/private/account`. -> Expected: `PERMISSION_DENIED`.
8. **Shadow Field Injection**: Creator updates channel profile while injecting `accountStatus: "active"` or `isVerified: true`. -> Expected: `PERMISSION_DENIED`.
9. **Timestamp Forgery**: User creates a video or audit log with backdated `createdAt` instead of `request.time`. -> Expected: `PERMISSION_DENIED`.
10. **Orphaned Comment Write**: User attempts to create a comment under `/videos/nonexistent_id/comments/c1`. -> Expected: `PERMISSION_DENIED`.
11. **Non-CEO Account Deletion**: Regular admin attempts to delete `/users/{uid}`. -> Expected: `PERMISSION_DENIED`.
12. **Unscoped Notification Read**: User A attempts to `list` notifications belonging to User B. -> Expected: `PERMISSION_DENIED`.
