import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  IndianRupee,
  Lock,
  QrCode,
  Rocket,
  Search,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchGatewayStatus,
  subscribeUserPaymentTransactions,
} from '../lib/monetizationService';
import { formatInr, formatRelativeDate } from '../lib/formatters';
import {
  PAYMENT_METHOD_OPTIONS,
  UPI_QR_IMAGE_SRC,
  UpiQrPaymentModal,
  type UpiQrPaymentRequest,
} from '../components/UpiQrPaymentModal';
import type {
  AppRoute,
  GatewayStatusResponse,
  PaymentTransaction,
  PaymentVerificationStatus,
  VideoItem,
} from '../types/bharatplay';

interface PaymentsPageProps {
  videos: VideoItem[];
  onWatchVideo: (video: VideoItem) => void;
  onNavigate: (route: AppRoute, param?: string) => void;
}

export function PaymentsPage({ videos, onWatchVideo, onNavigate }: PaymentsPageProps) {
  const { user, profile } = useAuth();
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatusResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentVerificationStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentRequest, setPaymentRequest] = useState<UpiQrPaymentRequest | null>(null);

  useEffect(() => {
    fetchGatewayStatus().then(setGatewayStatus).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setTransactions([]);
      return;
    }
    return subscribeUserPaymentTransactions(user.uid, setTransactions);
  }, [user?.uid]);

  const paidVideos = useMemo(
    () => videos.filter((v) => v.accessType === 'paid' && v.status === 'published').slice(0, 4),
    [videos]
  );

  const filteredHistory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (statusFilter !== 'all' && tx.status !== statusFilter) return false;
      if (!q) return true;
      return (
        tx.utrNumber.toLowerCase().includes(q) ||
        tx.targetTitle.toLowerCase().includes(q) ||
        tx.creatorName.toLowerCase().includes(q) ||
        tx.paymentMethod.toLowerCase().includes(q)
      );
    });
  }, [transactions, statusFilter, searchQuery]);

  const summary = useMemo(() => {
    let pendingCount = 0;
    let approvedTotal = 0;
    for (const tx of transactions) {
      if (tx.status === 'pending_verification') pendingCount += 1;
      if (tx.status === 'approved') approvedTotal += Number(tx.amountInr || 0);
    }
    return { pendingCount, approvedTotal, totalCount: transactions.length };
  }, [transactions]);

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-14 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#E11D48] to-[#F97316] text-white flex items-center justify-center mx-auto">
          <QrCode className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold font-display text-zinc-900 dark:text-white">
          BharatPlay UPI Payments & History
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Sign in to unlock paid creator videos, join channel memberships, support creators via PhonePe / UPI QR, and track UTR verification status.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('login')}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#E11D48] to-[#F97316] text-sm font-semibold text-white"
        >
          Sign In to Continue
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#EA580C] dark:text-[#F97316]">
            <QrCode className="w-4 h-4" />
            <span>PhonePe · Google Pay · Paytm · UPI</span>
          </div>
          <h1 className="text-2xl font-bold font-display text-zinc-900 dark:text-white mt-1">
            Payments & Verification History
          </h1>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
            Scan the official BharatPlay UPI QR, submit your Transaction ID / UTR, and track CEO verification.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() =>
              setPaymentRequest({
                serviceType: 'creator_boost_pass',
                targetId: 'creator_boost_monthly',
                targetTitle: 'BharatPlay Creator Boost Pass (30 Days)',
                creatorId: 'platform',
                creatorName: 'BharatPlay Platform',
                defaultAmountInr: 199,
                minAmountInr: 49,
                maxAmountInr: 10000,
                allowCustomAmount: false,
              })
            }
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#E11D48] to-[#F97316] text-xs font-semibold text-white min-h-[44px]"
          >
            <Rocket className="w-4 h-4" />
            <span>Activate Creator Boost (₹199)</span>
          </button>
          <button
            type="button"
            onClick={() =>
              setPaymentRequest({
                serviceType: 'platform_service',
                targetId: 'bharatplay_supporter_pack',
                targetTitle: 'BharatPlay Supporter Verification Credit',
                creatorId: 'platform',
                creatorName: 'BharatPlay Platform',
                defaultAmountInr: 100,
                minAmountInr: 10,
                maxAmountInr: 50000,
                allowCustomAmount: true,
              })
            }
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-100 dark:bg-[#141418] hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-900 dark:text-white min-h-[44px]"
          >
            <IndianRupee className="w-4 h-4 text-[#F97316]" />
            <span>Custom UPI Payment</span>
          </button>
        </div>
      </div>

      {/* Top Grid: Official QR Preview + User Payment Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 p-5 rounded-2xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Scan & Pay Merchant QR</h2>
            <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
              {gatewayStatus?.upiQrEnabled === false ? 'CHECKOUT' : 'UPI QR ACTIVE'}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-4">
            <div className="w-44 shrink-0 rounded-2xl bg-white p-2 border border-zinc-200 shadow-sm">
              <img
                src={gatewayStatus?.qrImageUrl || UPI_QR_IMAGE_SRC}
                alt="BharatPlay Official PhonePe UPI QR"
                className="w-full h-auto block object-contain rounded-lg"
              />
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="font-semibold text-zinc-900 dark:text-white">Accepted UPI Apps</div>
              <div className="flex flex-wrap gap-1.5">
                {PAYMENT_METHOD_OPTIONS.map((m) => (
                  <span
                    key={m.id}
                    className="px-2 py-1 rounded-md bg-white dark:bg-[#18181D] border border-zinc-200 dark:border-zinc-700 text-[11px] font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    {m.label}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                After paying via any supported UPI app, enter your UTR number inside checkout. All submissions enter{' '}
                <strong>Pending Verification</strong> until approved in the CEO Command Center.
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 space-y-4">
          {/* Summary KPIs */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800">
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Total Submissions</div>
              <div className="text-xl font-mono font-bold tabular-nums text-zinc-900 dark:text-white mt-1">
                {summary.totalCount}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-800/40">
              <div className="text-[11px] text-amber-800 dark:text-amber-300">Pending Review</div>
              <div className="text-xl font-mono font-bold tabular-nums text-amber-900 dark:text-amber-200 mt-1">
                {summary.pendingCount}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-800/40">
              <div className="text-[11px] text-emerald-800 dark:text-emerald-300">Verified Total</div>
              <div className="text-xl font-mono font-bold tabular-nums text-emerald-900 dark:text-emerald-200 mt-1">
                {formatInr(summary.approvedTotal)}
              </div>
            </div>
          </div>

          {/* Quick Paid Video Checkout Cards (if any exist in catalog) */}
          {paidVideos.length > 0 && (
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#E11D48]" />
                  <span>Paid Creator Videos Ready to Unlock</span>
                </span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{profile?.displayName}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {paidVideos.map((v) => (
                  <div
                    key={v.id}
                    className="p-3 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2"
                  >
                    <button
                      type="button"
                      onClick={() => onWatchVideo(v)}
                      className="text-left min-w-0 flex-1"
                    >
                      <div className="text-xs font-semibold text-zinc-900 dark:text-white truncate">{v.title}</div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                        {v.creatorName} · {formatInr(v.priceInr || 49)}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPaymentRequest({
                          serviceType: 'paid_video',
                          targetId: v.id,
                          targetTitle: v.title,
                          creatorId: v.creatorId,
                          creatorName: v.creatorName,
                          defaultAmountInr: v.priceInr || 49,
                          minAmountInr: Math.max(10, v.priceInr || 49),
                          allowCustomAmount: false,
                        })
                      }
                      className="px-3 py-1.5 rounded-lg bg-[#E11D48] hover:bg-[#BE123C] text-[11px] font-semibold text-white shrink-0"
                    >
                      Pay {formatInr(v.priceInr || 49)}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment History Table / List */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base font-bold text-zinc-900 dark:text-white">Your Payment History</h2>
          <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center">
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'all', label: 'All' },
                { id: 'pending_verification', label: 'Pending Verification' },
                { id: 'approved', label: 'Approved' },
                { id: 'rejected', label: 'Rejected' },
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStatusFilter(st.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    statusFilter === st.id
                      ? 'bg-[#E11D48] text-white'
                      : 'bg-zinc-100 dark:bg-[#141418] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search UTR or service..."
                className="w-full sm:w-56 pl-8 pr-3 py-1.5 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="p-10 rounded-2xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 text-center space-y-2">
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">No UPI payment records yet</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Complete a payment with PhonePe, Google Pay, Paytm, or UPI and submit your UTR to see live verification updates here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredHistory.map((tx) => (
              <div
                key={tx.id}
                className="p-4 rounded-xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-sm font-bold text-zinc-900 dark:text-white truncate">{tx.targetTitle}</span>
                    <span className="text-[11px] uppercase font-mono text-zinc-500 dark:text-zinc-400">
                      {tx.serviceType.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">
                    Method: <strong className="text-zinc-900 dark:text-white">{tx.paymentMethod}</strong> · UTR:{' '}
                    <span className="font-mono font-semibold text-[#EA580C] dark:text-[#F97316]">{tx.utrNumber}</span> ·{' '}
                    {formatRelativeDate(tx.createdAt)}
                  </div>
                  {tx.rejectionReason && (
                    <div className="text-xs text-red-600 dark:text-red-400">Reason: {tx.rejectionReason}</div>
                  )}
                </div>

                <div className="flex items-center justify-between sm:flex-col sm:items-end gap-1 shrink-0">
                  <div className="text-base font-mono font-bold tabular-nums text-zinc-900 dark:text-white">
                    {formatInr(tx.amountInr)}
                  </div>
                  <div
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                      tx.status === 'approved'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : tx.status === 'rejected'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {tx.status === 'approved' ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{tx.serviceActivated ? 'Approved & Activated' : 'Approved'}</span>
                      </>
                    ) : tx.status === 'rejected' ? (
                      <>
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Rejected</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-3.5 h-3.5" />
                        <span>Pending Verification</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <UpiQrPaymentModal
        open={Boolean(paymentRequest)}
        request={paymentRequest}
        onClose={() => setPaymentRequest(null)}
        onNavigate={onNavigate}
      />
    </div>
  );
}
