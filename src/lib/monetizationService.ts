import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import type {
  AffiliateLink,
  AdRevenueRecord,
  BrandApplication,
  BrandCampaign,
  CreatorEarningsSummary,
  CreatorMembership,
  CreatorPayout,
  CreatorSupport,
  GatewayStatusResponse,
  InvalidTrafficFlag,
  MembershipPlan,
  MonetizationTransaction,
  PaymentDispute,
  PaymentMethodOption,
  PaymentServiceType,
  PaymentTransaction,
  PlatformConfig,
  VideoPurchase,
} from '../types/bharatplay';

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

async function monFetch<T>(path: string, token?: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || `Monetization API error (${res.status})`) as Error & {
      code?: string;
      status?: number;
    };
    err.code = data?.code;
    err.status = res.status;
    throw err;
  }
  return data as T;
}

// --- Gateway & Payment Verification ---
export async function fetchGatewayStatus(): Promise<GatewayStatusResponse> {
  return monFetch<GatewayStatusResponse>('/api/monetization/gateway-status', undefined, {
    method: 'GET',
  });
}

export async function createPaymentIntent(
  token: string,
  payload: {
    kind: 'support' | 'membership' | 'paid_video';
    targetId: string;
    creatorId: string;
    amountInr: number;
  }
) {
  return monFetch<{
    orderId: string;
    kind: string;
    targetId: string;
    creatorId: string;
    amountInr: number;
    currency: 'INR';
    provider: string;
    keyId: string;
    orderSignature: string;
    gatewayConfigured: boolean;
  }>('/api/monetization/payment/create-intent', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function verifyPayment(
  token: string,
  payload: {
    orderId: string;
    paymentId: string;
    signature: string;
    kind: 'support' | 'membership' | 'paid_video';
    targetId: string;
    creatorId: string;
    amountInr: number;
  }
) {
  return monFetch<{
    verified: boolean;
    orderId: string;
    paymentId: string;
    verifiedAt: string;
  }>('/api/monetization/payment/verify', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function submitQrPayment(
  token: string,
  payload: {
    paymentMethod: PaymentMethodOption;
    amountInr: number;
    utrNumber: string;
    serviceType: PaymentServiceType;
    targetId: string;
    targetTitle: string;
    creatorId: string;
    creatorName: string;
    note?: string;
  }
) {
  return monFetch<{
    ok: boolean;
    paymentId: string;
    status: 'pending_verification';
    serviceActivated: boolean;
    utrNumber: string;
    paymentMethod: PaymentMethodOption;
    amountInr: number;
    serviceType: PaymentServiceType;
    targetId: string;
    targetTitle: string;
    serviceRecordId?: string;
  }>('/api/monetization/qr-payment/submit', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchMyQrPaymentHistory(token: string): Promise<PaymentTransaction[]> {
  const res = await monFetch<{ payments: PaymentTransaction[] }>(
    '/api/monetization/qr-payment/my-history',
    token,
    { method: 'GET' }
  );
  return res.payments || [];
}

export async function sendTrafficSignal(targetType: 'video' | 'affiliate', targetId: string) {
  try {
    return await monFetch<{ ok: boolean; valid: boolean; isInvalidTraffic: boolean; recentWindowHits: number }>(
      '/api/monetization/traffic/signal',
      undefined,
      {
        method: 'POST',
        body: JSON.stringify({ targetType, targetId }),
      }
    );
  } catch {
    return { ok: false, valid: true, isInvalidTraffic: false, recentWindowHits: 1 };
  }
}

export async function acceptCreatorMonetizationTerms(token: string) {
  return monFetch<{ ok: boolean; acceptedAt: string }>('/api/monetization/creator/terms', token, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export interface CreatorEarningsResponse {
  summary: CreatorEarningsSummary;
  transactions: MonetizationTransaction[];
  adRecords: AdRevenueRecord[];
  supports: CreatorSupport[];
  memberships: CreatorMembership[];
  purchases: VideoPurchase[];
  affiliates: AffiliateLink[];
}

export async function fetchCreatorEarningsSummary(token: string): Promise<CreatorEarningsResponse> {
  return monFetch<CreatorEarningsResponse>('/api/monetization/creator/summary', token, {
    method: 'GET',
  });
}

// --- Real-time Firestore Subscriptions (Compliant with Pillar 8 `allow list`) ---

export function subscribeMembershipPlans(
  creatorId: string,
  includeInactive: boolean,
  cb: (plans: MembershipPlan[]) => void
) {
  const q = includeInactive
    ? query(collection(db, 'membershipPlans'), where('creatorId', '==', creatorId))
    : query(
        collection(db, 'membershipPlans'),
        where('creatorId', '==', creatorId),
        where('isActive', '==', true)
      );

  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MembershipPlan, 'id'>) }));
      items.sort((a, b) => a.tierLevel - b.tierLevel);
      cb(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'membershipPlans')
  );
}

export function subscribeUserMemberships(memberId: string, cb: (items: CreatorMembership[]) => void) {
  const q = query(collection(db, 'creatorMemberships'), where('memberId', '==', memberId));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CreatorMembership, 'id'>) }));
      items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      cb(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'creatorMemberships')
  );
}

export function subscribeCreatorMemberships(creatorId: string, cb: (items: CreatorMembership[]) => void) {
  const q = query(collection(db, 'creatorMemberships'), where('creatorId', '==', creatorId));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CreatorMembership, 'id'>) }));
      items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      cb(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'creatorMemberships')
  );
}

export function subscribeUserVideoPurchases(buyerId: string, cb: (items: VideoPurchase[]) => void) {
  const q = query(collection(db, 'videoPurchases'), where('buyerId', '==', buyerId));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VideoPurchase, 'id'>) }));
      items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      cb(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'videoPurchases')
  );
}

export function subscribeBrandCampaigns(cb: (items: BrandCampaign[]) => void) {
  const q = query(collection(db, 'brandCampaigns'));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BrandCampaign, 'id'>) }));
      items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      cb(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'brandCampaigns')
  );
}

export function subscribeCreatorBrandApplications(
  creatorId: string,
  cb: (items: BrandApplication[]) => void
) {
  const q = query(collection(db, 'brandApplications'), where('creatorId', '==', creatorId));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BrandApplication, 'id'>) }));
      items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      cb(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'brandApplications')
  );
}

export function subscribeAffiliateLinks(
  creatorId: string,
  includeInactive: boolean,
  cb: (items: AffiliateLink[]) => void
) {
  const q = includeInactive
    ? query(collection(db, 'affiliateLinks'), where('creatorId', '==', creatorId))
    : query(
        collection(db, 'affiliateLinks'),
        where('creatorId', '==', creatorId),
        where('isActive', '==', true)
      );

  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AffiliateLink, 'id'>) }));
      items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      cb(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'affiliateLinks')
  );
}

export function subscribeCreatorDisputes(uid: string, asCreator: boolean, cb: (items: PaymentDispute[]) => void) {
  const q = query(
    collection(db, 'paymentDisputes'),
    where(asCreator ? 'creatorId' : 'reporterId', '==', uid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PaymentDispute, 'id'>) }));
      items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      cb(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'paymentDisputes')
  );
}

export function subscribeCreatorTrafficFlags(creatorId: string, cb: (items: InvalidTrafficFlag[]) => void) {
  const q = query(collection(db, 'invalidTrafficFlags'), where('creatorId', '==', creatorId));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InvalidTrafficFlag, 'id'>) }));
      items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      cb(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'invalidTrafficFlags')
  );
}

export function subscribeSupporterHistory(supporterId: string, cb: (items: CreatorSupport[]) => void) {
  const q = query(collection(db, 'creatorSupports'), where('supporterId', '==', supporterId));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CreatorSupport, 'id'>) }));
      items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      cb(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'creatorSupports')
  );
}

export function subscribeUserPaymentTransactions(
  userId: string,
  cb: (items: PaymentTransaction[]) => void
) {
  const q = query(collection(db, 'paymentTransactions'), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<PaymentTransaction, 'id'>),
      }));
      items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      cb(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'paymentTransactions')
  );
}

// --- Creator Actions ---

export async function createMembershipPlan(params: {
  creatorId: string;
  creatorName: string;
  name: string;
  tierLevel: number;
  priceInr: number;
  perks: string;
}): Promise<string> {
  const planId = newId('plan');
  try {
    await setDoc(doc(db, 'membershipPlans', planId), {
      creatorId: params.creatorId,
      creatorName: params.creatorName.slice(0, 80),
      name: params.name.trim().slice(0, 60),
      tierLevel: Math.max(1, Math.min(10, Math.round(params.tierLevel))),
      priceInr: Math.max(29, Math.min(50000, Math.round(params.priceInr))),
      perks: params.perks.trim().slice(0, 400),
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return planId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `membershipPlans/${planId}`);
  }
}

export async function toggleMembershipPlan(planId: string, isActive: boolean) {
  try {
    await updateDoc(doc(db, 'membershipPlans', planId), {
      isActive,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `membershipPlans/${planId}`);
  }
}

export async function deleteMembershipPlan(planId: string) {
  try {
    await deleteDoc(doc(db, 'membershipPlans', planId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `membershipPlans/${planId}`);
  }
}

export async function submitBrandApplication(params: {
  campaign: BrandCampaign;
  creatorId: string;
  creatorName: string;
  pitch: string;
  proposedFeeInr: number;
}): Promise<string> {
  const appId = newId('bapp');
  try {
    await setDoc(doc(db, 'brandApplications', appId), {
      campaignId: params.campaign.id,
      campaignTitle: params.campaign.title.slice(0, 120),
      brandName: params.campaign.brandName.slice(0, 80),
      creatorId: params.creatorId,
      creatorName: params.creatorName.slice(0, 80),
      pitch: params.pitch.trim().slice(0, 800),
      proposedFeeInr: Math.max(100, Math.min(50000000, Math.round(params.proposedFeeInr))),
      status: 'applied',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return appId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `brandApplications/${appId}`);
  }
}

export async function submitBrandDeliverable(applicationId: string, deliverableUrl: string) {
  try {
    await updateDoc(doc(db, 'brandApplications', applicationId), {
      deliverableUrl: deliverableUrl.trim().slice(0, 500),
      status: 'delivered',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `brandApplications/${applicationId}`);
  }
}

export async function createAffiliateLink(params: {
  creatorId: string;
  creatorName: string;
  productTitle: string;
  merchantName: string;
  targetUrl: string;
  commissionPercent: number;
}): Promise<string> {
  const linkId = newId('aff');
  const cleanCode = `BP${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const url = params.targetUrl.trim();
  if (!/^https?:\/\//i.test(url)) {
    throw new Error('Affiliate destination URL must start with https:// or http://');
  }
  try {
    await setDoc(doc(db, 'affiliateLinks', linkId), {
      creatorId: params.creatorId,
      creatorName: params.creatorName.slice(0, 80),
      code: cleanCode,
      targetUrl: url.slice(0, 500),
      productTitle: params.productTitle.trim().slice(0, 120),
      merchantName: params.merchantName.trim().slice(0, 80),
      commissionPercent: Math.max(1, Math.min(50, Number(params.commissionPercent || 8))),
      clicksCount: 0,
      validClicksCount: 0,
      conversionsCount: 0,
      earnedInr: 0,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return linkId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `affiliateLinks/${linkId}`);
  }
}

export async function toggleAffiliateLink(linkId: string, isActive: boolean) {
  try {
    await updateDoc(doc(db, 'affiliateLinks', linkId), {
      isActive,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `affiliateLinks/${linkId}`);
  }
}

export async function deleteAffiliateLink(linkId: string) {
  try {
    await deleteDoc(doc(db, 'affiliateLinks', linkId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `affiliateLinks/${linkId}`);
  }
}

export async function reportPaymentDispute(params: {
  reporterId: string;
  reporterName: string;
  creatorId: string;
  creatorName: string;
  transactionId: string;
  amountInr: number;
  category: 'unauthorized' | 'undelivered' | 'payout_delay' | 'ad_deduction' | 'brand_milestone';
  reason: string;
}): Promise<string> {
  const disputeId = newId('disp');
  try {
    await setDoc(doc(db, 'paymentDisputes', disputeId), {
      reporterId: params.reporterId,
      reporterName: params.reporterName.slice(0, 80),
      creatorId: params.creatorId,
      creatorName: params.creatorName.slice(0, 80),
      transactionId: params.transactionId.trim().slice(0, 128),
      amountInr: Math.max(0, Math.min(50000000, Math.round(params.amountInr))),
      category: params.category,
      reason: params.reason.trim().slice(0, 500),
      status: 'open',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return disputeId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `paymentDisputes/${disputeId}`);
  }
}

// --- Governance API Clients (CEO or Admin with `manageMonetization`) ---

export interface MonetizationGovernanceOverview {
  gatewayStatus: GatewayStatusResponse;
  adRevenueRecords: AdRevenueRecord[];
  brandCampaigns: BrandCampaign[];
  brandApplications: BrandApplication[];
  invalidTrafficFlags: InvalidTrafficFlag[];
  paymentDisputes: PaymentDispute[];
  monetizationTransactions: MonetizationTransaction[];
  videoPurchases: VideoPurchase[];
  creatorMemberships: CreatorMembership[];
  affiliateLinks: AffiliateLink[];
  payouts: CreatorPayout[];
  paymentTransactions: PaymentTransaction[];
  platformConfig: PlatformConfig | null;
}

export async function fetchMonetizationGovernanceOverview(
  token: string
): Promise<MonetizationGovernanceOverview> {
  return monFetch<MonetizationGovernanceOverview>('/api/monetization/governance/overview', token, {
    method: 'GET',
  });
}

export async function govVerifyQrPayment(
  token: string,
  payload: {
    paymentId: string;
    decision: 'approve' | 'reject';
    reason?: string;
  }
) {
  return monFetch<{
    ok: boolean;
    paymentId: string;
    status: 'approved' | 'rejected';
    serviceActivated: boolean;
  }>('/api/monetization/governance/qr-payments/verify', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function govRecordAdRevenue(
  token: string,
  payload: {
    action: 'record' | 'update_status';
    recordId?: string;
    videoId?: string;
    videoTitle?: string;
    creatorId?: string;
    creatorName?: string;
    periodLabel?: string;
    validImpressions?: number;
    invalidImpressionsBlocked?: number;
    grossAdRevenueInr?: number;
    status?: 'pending' | 'verified' | 'invalidated';
    notes?: string;
  }
) {
  return monFetch<{ ok: boolean }>('/api/monetization/governance/ad-revenue', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function govResolveInvalidTraffic(
  token: string,
  payload: {
    action: 'flag' | 'resolve';
    flagId?: string;
    targetType?: 'video' | 'affiliate' | 'creator';
    targetId?: string;
    creatorId?: string;
    creatorName?: string;
    signalType?: string;
    suspiciousCount?: number;
    estimatedImpactInr?: number;
    severity?: 'low' | 'medium' | 'high';
    status?: 'confirmed_invalid' | 'cleared';
    notes?: string;
    deductRecordId?: string;
  }
) {
  return monFetch<{ ok: boolean }>('/api/monetization/governance/invalid-traffic', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function govResolveDispute(
  token: string,
  payload: {
    disputeId: string;
    status: 'investigating' | 'resolved' | 'refunded' | 'rejected';
    resolutionNote: string;
  }
) {
  return monFetch<{ ok: boolean }>('/api/monetization/governance/disputes', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function govBrandConnectAction(
  token: string,
  payload: {
    action: 'create_campaign' | 'update_campaign' | 'review_application';
    campaignId?: string;
    brandName?: string;
    title?: string;
    description?: string;
    budgetInr?: number;
    category?: string;
    deliverables?: string;
    deadline?: string;
    campaignStatus?: 'open' | 'in_progress' | 'completed' | 'closed';
    applicationId?: string;
    appStatus?: 'shortlisted' | 'approved' | 'paid' | 'rejected';
    reviewNotes?: string;
  }
) {
  return monFetch<{ ok: boolean }>('/api/monetization/governance/brand-connect', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
