import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  IndianRupee,
  QrCode,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { formatInr, formatRelativeDate } from '../lib/formatters';
import type { PaymentTransaction, PaymentVerificationStatus } from '../types/bharatplay';

interface CeoPaymentVerificationPanelProps {
  transactions: PaymentTransaction[];
  onVerifyDecision: (params: {
    paymentId: string;
    decision: 'approve' | 'reject';
    reason?: string;
  }) => Promise<void>;
  onRefresh?: () => void;
  title?: string;
  subtitle?: string;
}

export function CeoPaymentVerificationPanel({
  transactions,
  onVerifyDecision,
  onRefresh,
  title = 'UPI QR Payment Verification Queue',
  subtitle = 'Reconcile submitted UTR numbers against PhonePe / UPI statements before activating services or crediting creator ledgers.',
}: CeoPaymentVerificationPanelProps) {
  const { isCeo } = useAuth();
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentVerificationStatus>('pending_verification');
  const [searchQuery, setSearchQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectDraftId, setRejectDraftId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const sorted = useMemo(() => {
    const copy = [...transactions];
    copy.sort((a, b) => {
      const aSec = Number(a.createdAt?.seconds || (a.createdAt ? new Date(a.createdAt).getTime() / 1000 : 0));
      const bSec = Number(b.createdAt?.seconds || (b.createdAt ? new Date(b.createdAt).getTime() / 1000 : 0));
      return bSec - aSec;
    });
    return copy;
  }, [transactions]);

  const counts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let pendingVolume = 0;
    for (const tx of sorted) {
      if (tx.status === 'pending_verification') {
        pending += 1;
        pendingVolume += Number(tx.amountInr || 0);
      } else if (tx.status === 'approved') {
        approved += 1;
      } else if (tx.status === 'rejected') {
        rejected += 1;
      }
    }
    return { pending, approved, rejected, pendingVolume };
  }, [sorted]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sorted.filter((tx) => {
      if (statusFilter !== 'all' && tx.status !== statusFilter) return false;
      if (!q) return true;
      return (
        tx.utrNumber.toLowerCase().includes(q) ||
        tx.userName.toLowerCase().includes(q) ||
        (tx.userEmail || '').toLowerCase().includes(q) ||
        tx.targetTitle.toLowerCase().includes(q) ||
        tx.creatorName.toLowerCase().includes(q) ||
        tx.paymentMethod.toLowerCase().includes(q) ||
        tx.id.toLowerCase().includes(q)
      );
    });
  }, [sorted, statusFilter, searchQuery]);

  const handleDecision = async (paymentId: string, decision: 'approve' | 'reject', reason?: string) => {
    setBusyId(paymentId);
    try {
      await onVerifyDecision({ paymentId, decision, reason });
      if (rejectDraftId === paymentId) {
        setRejectDraftId(null);
        setRejectReason('');
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <QrCode className="w-4 h-4 text-[#EA580C] dark:text-[#F97316]" />
            <span>{title}</span>
          </h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">{subtitle}</p>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#141418] border border-zinc-300 dark:border-zinc-700 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 shrink-0"
          >
            Refresh Payments
          </button>
        )}
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-800/40">
          <div className="text-[11px] text-amber-800 dark:text-amber-300">Pending Verification</div>
          <div className="text-lg font-mono font-bold tabular-nums text-amber-900 dark:text-amber-200 mt-0.5">
            {counts.pending}
          </div>
        </div>
        <div className="p-3.5 rounded-xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800">
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Pending Volume</div>
          <div className="text-lg font-mono font-bold tabular-nums text-[#EA580C] dark:text-[#F97316] mt-0.5">
            {formatInr(counts.pendingVolume)}
          </div>
        </div>
        <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-800/40">
          <div className="text-[11px] text-emerald-800 dark:text-emerald-300">Approved & Activated</div>
          <div className="text-lg font-mono font-bold tabular-nums text-emerald-900 dark:text-emerald-200 mt-0.5">
            {counts.approved}
          </div>
        </div>
        <div className="p-3.5 rounded-xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800">
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Rejected</div>
          <div className="text-lg font-mono font-bold tabular-nums text-red-600 dark:text-red-400 mt-0.5">
            {counts.rejected}
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'pending_verification', label: `Pending (${counts.pending})` },
            { id: 'approved', label: `Approved (${counts.approved})` },
            { id: 'rejected', label: `Rejected (${counts.rejected})` },
            { id: 'all', label: `All (${sorted.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                statusFilter === tab.id
                  ? 'bg-[#E11D48] text-white'
                  : 'bg-zinc-100 dark:bg-[#141418] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search UTR, user, method, service..."
            className="w-full pl-8 pr-3 py-2 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white placeholder-zinc-400"
          />
        </div>
      </div>

      {/* Verification List */}
      {filtered.length === 0 ? (
        <div className="p-8 rounded-2xl bg-zinc-50 dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-500 dark:text-zinc-400">
          No UPI QR payment transactions match this filter.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((tx) => {
            const busy = busyId === tx.id;
            return (
              <div
                key={tx.id}
                className="p-4 rounded-xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-zinc-800 space-y-3"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono font-bold text-sm text-[#EA580C] dark:text-[#F97316]">
                        {formatInr(tx.amountInr)}
                      </span>
                      <span className="font-semibold text-zinc-900 dark:text-white">{tx.paymentMethod}</span>
                      <span className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                        UTR: {tx.utrNumber}
                      </span>
                      <span
                        className={`text-[11px] font-bold uppercase ${
                          tx.status === 'approved'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : tx.status === 'rejected'
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {tx.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="text-xs text-zinc-700 dark:text-zinc-300">
                      <span className="font-semibold">{tx.targetTitle}</span>{' '}
                      <span className="text-zinc-500 dark:text-zinc-400">
                        ({tx.serviceType.replace('_', ' ')}) · Creator: {tx.creatorName}
                      </span>
                    </div>

                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Buyer: <span className="text-zinc-800 dark:text-zinc-200 font-medium">{tx.userName}</span>
                      {tx.userEmail ? ` (${tx.userEmail})` : ''} · Submitted {formatRelativeDate(tx.createdAt)} · ID {tx.id}
                    </div>

                    {tx.note && (
                      <div className="text-[11px] text-zinc-600 dark:text-zinc-400 italic">
                        Note: “{tx.note}”
                      </div>
                    )}
                    {tx.rejectionReason && (
                      <div className="text-[11px] text-red-600 dark:text-red-400">
                        Rejection Reason: {tx.rejectionReason}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {tx.status === 'pending_verification' ? (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleDecision(tx.id, 'approve', 'UTR verified against PhonePe/UPI statement')}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-xs font-semibold text-white min-h-[40px]"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{busy ? 'Verifying...' : 'Verify & Activate'}</span>
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setRejectDraftId(rejectDraftId === tx.id ? null : tx.id);
                            setRejectReason('');
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/60 border border-red-200 dark:border-red-900/50 text-xs font-semibold text-red-700 dark:text-red-300 min-h-[40px]"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </>
                    ) : (
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 font-mono">
                        {tx.serviceActivated ? (
                          <>
                            <ShieldCheck className="w-4 h-4 text-emerald-500" />
                            <span>Service Active</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-4 h-4 text-red-400" />
                            <span>Not Activated</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {rejectDraftId === tx.id && (
                  <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Rejection reason (e.g., UTR not matched or reversed payment)"
                      className="flex-1 px-3 py-2 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        handleDecision(
                          tx.id,
                          'reject',
                          rejectReason.trim() || 'UTR not found in settlement statement'
                        )
                      }
                      className="px-4 py-2 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-xs font-semibold text-white"
                    >
                      Confirm Rejection
                    </button>
                  </div>
                )}

                {!isCeo && tx.status === 'pending_verification' && ['paid_video', 'membership', 'support'].includes(tx.serviceType) && (
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                    <IndianRupee className="w-3 h-3" />
                    <span>Approving activates viewer access immediately; CEO settlement adds financial ledger credit.</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
