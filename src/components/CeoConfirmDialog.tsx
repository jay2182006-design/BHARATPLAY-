import React, { useState } from 'react';
import { AlertTriangle, KeyRound, ShieldAlert, X } from 'lucide-react';

export interface PendingCeoAction {
  title: string;
  description: string;
  scopeNotice?: string;
  confirmLabel: string;
  defaultReason?: string;
  isPermanent?: boolean;
  dangerTone?: 'red' | 'orange';
  onConfirm: (params: { reason: string; confirmPhrase?: string; freshToken?: string }) => Promise<void>;
}

interface CeoConfirmDialogProps {
  pending: PendingCeoAction | null;
  requiresStepUpAuth: boolean;
  onStepUpReauth: () => Promise<string>;
  onClose: () => void;
}

export function CeoConfirmDialog({
  pending,
  requiresStepUpAuth,
  onStepUpReauth,
  onClose,
}: CeoConfirmDialogProps) {
  const [reason, setReason] = useState(pending?.defaultReason || '');
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [ackPermanent, setAckPermanent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    setReason(pending?.defaultReason || '');
    setConfirmPhrase('');
    setAckPermanent(false);
    setError('');
  }, [pending]);

  if (!pending) return null;

  const isPermanent = Boolean(pending.isPermanent);
  const needsPhrase = isPermanent;

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanReason = reason.trim();
    if (cleanReason.length < 3) {
      setError('Please enter a valid action reason (minimum 3 characters) for the CEO audit log.');
      return;
    }
    if (needsPhrase && (!ackPermanent || confirmPhrase.trim() !== 'PERMANENTLY DELETE')) {
      setError('Check the confirmation box and type PERMANENTLY DELETE to proceed.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      let freshToken: string | undefined;
      if (requiresStepUpAuth) {
        freshToken = await onStepUpReauth();
      }
      await pending.onConfirm({
        reason: cleanReason,
        confirmPhrase: needsPhrase ? confirmPhrase.trim() : undefined,
        freshToken,
      });
      onClose();
    } catch (err: any) {
      if (err?.code === 'CEO_REAUTH_REQUIRED' || String(err?.message || '').includes('re-authentication')) {
        try {
          const freshToken = await onStepUpReauth();
          await pending.onConfirm({
            reason: cleanReason,
            confirmPhrase: needsPhrase ? confirmPhrase.trim() : undefined,
            freshToken,
          });
          onClose();
          return;
        } catch (reauthErr: any) {
          setError(reauthErr?.message || 'Step-up CEO re-authentication failed.');
        }
      } else {
        setError(err?.message || 'Action could not be completed.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl bg-[#0D0D10] border border-red-900/50 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 bg-gradient-to-r from-[#450A0A] via-[#1C0A0A] to-[#0D0D10] border-b border-red-900/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {isPermanent ? (
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-[#F97316] shrink-0" />
            )}
            <h3 className="text-base font-bold text-white">{pending.title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10"
            aria-label="Close confirmation dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleConfirm} className="p-5 space-y-4">
          <p className="text-sm text-zinc-200 leading-relaxed">{pending.description}</p>

          {pending.scopeNotice && (
            <div className="rounded-xl bg-white/[0.03] border border-white/10 px-3.5 py-2.5 text-xs text-zinc-300">
              {pending.scopeNotice}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Mandatory Executive Audit Reason
            </label>
            <textarea
              rows={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter explicit policy, safety, or governance reason (recorded permanently in CEO Audit Logs)..."
              className="w-full rounded-xl bg-[#09090B] border border-white/15 focus:border-[#F97316] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none"
            />
          </div>

          {isPermanent && (
            <div className="rounded-xl bg-red-950/35 border border-red-800/60 p-4 space-y-3">
              <div className="text-xs font-semibold text-red-300">
                Permanent Deletion Safety Gate
              </div>
              <label className="flex items-start gap-2.5 text-xs text-zinc-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ackPermanent}
                  onChange={(e) => setAckPermanent(e.target.checked)}
                  className="mt-0.5 rounded border-red-700 bg-black text-red-600 focus:ring-red-600"
                />
                <span>
                  I confirm this action is permanent, non-recoverable, and will be recorded in the immutable CEO Audit Log.
                </span>
              </label>
              <div>
                <label className="block text-[11px] font-medium text-red-200 mb-1">
                  Type <span className="font-mono font-bold">PERMANENTLY DELETE</span> to authorize
                </label>
                <input
                  type="text"
                  value={confirmPhrase}
                  onChange={(e) => setConfirmPhrase(e.target.value)}
                  placeholder="PERMANENTLY DELETE"
                  className="w-full rounded-lg bg-black/70 border border-red-800/70 focus:border-red-500 px-3 py-2 text-xs font-mono text-white focus:outline-none"
                />
              </div>
            </div>
          )}

          {requiresStepUpAuth && (
            <div className="flex items-center gap-2.5 rounded-xl bg-[#F97316]/10 border border-[#F97316]/30 px-3.5 py-2.5 text-xs text-[#FDBA74]">
              <KeyRound className="w-4 h-4 shrink-0" />
              <span>
                Additional CEO identity re-authentication will be verified before committing this operation.
              </span>
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-red-950/60 border border-red-700/70 px-3.5 py-2 text-xs text-red-200">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-zinc-300 whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`px-4 py-2 rounded-xl text-xs font-bold text-white whitespace-nowrap transition-colors ${
                pending.dangerTone === 'orange'
                  ? 'bg-[#F97316] hover:bg-[#EA580C]'
                  : 'bg-[#DC2626] hover:bg-[#B91C1C]'
              } disabled:opacity-50`}
            >
              {submitting ? 'Verifying & Executing...' : pending.confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
