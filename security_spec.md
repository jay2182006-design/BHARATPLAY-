# BHARATPLAY Firestore Security Specification

## 1. Data Invariants
1. **Identity Integrity**: Every user-owned document (`videos.creatorId`, `comments.authorId`, `reactions.userId`, `subscriptions.subscriberId`, `playlists.ownerId`, `communityPosts.creatorId`, `creatorSupports.supporterId`, `liveStreams.creatorId`, `liveChatMessages.senderId`, `reports.reporterId`, `watchHistory.userId`, `creatorPayouts.creatorId`) MUST equal `request.auth.uid` on create and remain immutable on update.
2. **PII Isolation**: Private user data (`email`, `role`, `upiId`, `estimatedEarningsInr`, `monetizationEnabled`, `notificationsEnabled`, `suspended`, `suspensionReason`) lives strictly under `/users/{userId}/private/account` and is readable ONLY by the owning user or the verified CEO. Regular admins CANNOT read or modify private PII, UPI IDs, or earnings. Public profiles under `/users/{userId}` contain zero PII.
3. **Strict Three-Tier RBAC (CEO / ADMIN / CREATOR) & Zero Privilege Escalation**:
   - **CEO (`jay2182006@gmail.com`)**: Exclusive full platform governance, CEO Command Center access, user/channel deletion, monetization/revenue share settings, creator payout settlements, platform-wide settings, and admin role/permission management.
   - **ADMIN**: Only receives limited permissions explicitly granted by the CEO under `/admins/{adminId}.permissions` (`moderateVideos`, `resolveReports`, `manageCreators`, `manageCompetitions`, `manageAnnouncements`, `manageCategories`). Admins CANNOT access the CEO Dashboard, modify CEO permissions, promote themselves or others to Admin/CEO, modify `users/{uid}/private/account`, delete users/channels, or alter monetization/revenue settings.
   - **CREATOR**: Strictly scoped to their own channel (`/users/{uid}`), own videos (`/videos/{id}` where `creatorId == uid`), own analytics, and own payout requests (`/creatorPayouts/{id}` where `creatorId == uid`).
   - **Zero Self-Role Modification**: No user (owner or admin) can modify `role` on `/users/{uid}/private/account` (`incoming().role == existing().role` strictly enforced on update).
4. **Immutable Audit Trail**: `/ceoAuditLogs/{logId}` records both CEO (`actorRole: 'ceo'`) and Admin (`actorRole: 'admin'`) actions. It is append-only (`create` strictly allowed for `isAdmin()`/`isCEO()` with `actorUid == request.auth.uid && createdAt == request.time`), strictly readable ONLY by `isCEO()`, and permanently immutable (`allow update, delete: if false`).
5. **Temporal & Relational Integrity**: All `createdAt` / `updatedAt` timestamps must equal `request.time` on write. Child subcollection writes verify parent document existence via `exists()`.
6. **Strict Payload Boundaries**: Every string field has explicit `.size()` bounds; every array has explicit `.size()` bounds; every create checks `keys().hasAll(...) && keys().hasOnly(...)`; every update checks `affectedKeys().hasOnly(...)`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Shadow CEO Role Escalation**: Viewer, creator, or regular admin attempts to set `role: "ceo"` in `/users/{uid}/private/account`. -> Expected: `PERMISSION_DENIED`.
2. **Self Role Modification**: User attempts to change their own `role` from `"viewer"` or `"creator"` to `"admin"` in `/users/{uid}/private/account`. -> Expected: `PERMISSION_DENIED`.
3. **Unauthorized Admin Self-Promotion**: Regular admin attempts to create or edit `/admins/{uid}` to grant themselves new permissions. -> Expected: `PERMISSION_DENIED`.
4. **Unpermitted Admin Monetization Tampering**: Regular admin attempts to update `creatorRevenueSharePercent` or `maintenanceMode` on `/platformConfig/settings` or process `/creatorPayouts/{id}`. -> Expected: `PERMISSION_DENIED`.
5. **Unauthorized Audit Log Tampering**: Any user or admin attempts to update, delete, or read `/ceoAuditLogs/{logId}`. -> Expected: `PERMISSION_DENIED`.
6. **Unauthorized CEO Role Injection**: Regular admin attempts to write to `/ceoRoles/{uid}`. -> Expected: `PERMISSION_DENIED`.
7. **Spoofed Creator Upload**: User A attempts to create a video under `/videos/{id}` with `creatorId: "userB"`. -> Expected: `PERMISSION_DENIED`.
8. **Oversized ID Poisoning**: Attacker attempts to write to `/videos/` with a 200-character document ID. -> Expected: `PERMISSION_DENIED`.
9. **Unverified Email Admin/CEO Spoof**: Authenticated user with `email_verified: false` attempts privileged read/write. -> Expected: `PERMISSION_DENIED`.
10. **PII Cross-Read by Admin**: Regular admin attempts `get` on `/users/userB/private/account`. -> Expected: `PERMISSION_DENIED`.
11. **Shadow Field Injection**: Creator updates channel profile while injecting `accountStatus: "active"` or `isVerified: true`. -> Expected: `PERMISSION_DENIED`.
12. **Non-CEO Account Deletion**: Regular admin attempts to delete `/users/{uid}`. -> Expected: `PERMISSION_DENIED`.
13. **Self Balance / Monetization Forgery**: Creator attempts to update `availableBalanceInr`, `pendingBalanceInr`, `lifetimeEarningsInr`, or `monetizationEnabled` on `/users/{uid}/private/account` or write directly to `/monetizationTransactions/{txId}`. -> Expected: `PERMISSION_DENIED`.
14. **Forged Paid Video / Membership Unlock**: Viewer attempts to write `paymentVerified: true` on `/videoPurchases/{id}` or `status: "active", paymentVerified: true` on `/creatorMemberships/{id}`. -> Expected: `PERMISSION_DENIED`.
15. **Ledger Tampering**: Any user or admin attempts to delete `/monetizationTransactions/{txId}` or falsify settled affiliate commissions in `/affiliateEvents/{id}`. -> Expected: `PERMISSION_DENIED`.
16. **Forged QR Payment Self-Approval**: User attempts to create `/paymentTransactions/{paymentId}` with `status: "approved"` or `serviceActivated: true`, or attempts to update their own pending UTR transaction to `"approved"`. -> Expected: `PERMISSION_DENIED`.

