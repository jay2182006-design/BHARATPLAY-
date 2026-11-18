import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  IndianRupee,
  QrCode,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from './Toast';
import { submitQrPayment } from '../lib/monetizationService';
import { formatInr } from '../lib/formatters';
import type {
  AppRoute,
  PaymentMethodOption,
  PaymentServiceType,
} from '../types/bharatplay';

export const UPI_QR_IMAGE_SRC = '/assets/aistudio/qr_codes_68178a7d.jpeg';

export const PAYMENT_METHOD_OPTIONS: {
  id: PaymentMethodOption;
  label: string;
  hint: string;
}[] = [
  { id: 'PhonePe', label: 'PhonePe', hint: 'Open PhonePe → Scan Any QR → Enter UPI PIN' },
  { id: 'Google Pay', label: 'Google Pay', hint: 'Open GPay → Scan Any QR Code → Pay' },
  { id: 'Paytm', label: 'Paytm', hint: 'Open Paytm → Scan & Pay → Complete UPI transfer' },
  { id: 'UPI', label: 'UPI', hint: 'Use BHIM or your bank UPI app to scan the QR code' },
  { id: 'Other UPI Apps', label: 'Other UPI Apps', hint: 'CRED, Amazon Pay, WhatsApp Pay, or any NPCI UPI app' },
];

export interface UpiQrPaymentRequest {
  serviceType: PaymentServiceType;
  targetId: string;
  targetTitle: string;
  creatorId: string;
  creatorName: string;
  defaultAmountInr: number;
  minAmountInr?: number;
  maxAmountInr?: number;
  allowCustomAmount?: boolean;
  defaultNote?: string;
}

interface UpiQrPaymentModalProps {
  open: boolean;
  request: UpiQrPaymentRequest | null;
  onClose: () => void;
  onSubmitted?: (result: { paymentId: string; utrNumber: string; amountInr: number }) => void;
  onNavigate?: (route: AppRoute, param?: string) => void;
}

export function UpiQrPaymentModal({
  open,
  request,
  onClose,
  onSubmitted,
  onNavigate,
}: UpiQrPaymentModalProps) {
  const { user, getIdToken } = useAuth();
  const { showToast } = useToast();

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodOption>('PhonePe');
  const [amountInput, setAmountInput] = useState<number>(100);
  const [utrNumber, setUtrNumber] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<{
    paymentId: string;
    utrNumber: string;
    paymentMethod: PaymentMethodOption;
    amountInr: number;
    targetTitle: string;
  } | null>(null);

  useEffect(() => {
    if (open && request) {
      setSelectedMethod('PhonePe');
      setAmountInput(request.defaultAmountInr);
      setUtrNumber('');
      setNote(request.defaultNote || '');
      setReceipt(null);
    }
  }, [open, request]);

  if (!open || !request) return null;

  const minAmt = request.minAmountInr ?? (request.serviceType === 'membership' ? 29 : 10);
  const maxAmt = request.maxAmountInr ?? 50000;
  const activeHint =
    PAYMENT_METHOD_OPTIONS.find((m) => m.id === selectedMethod)?.hint ||
    'Scan this PhonePe UPI QR code in your payment app.';

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onClose();
      onNavigate?.('login');
      showToast('Please sign in to submit a payment confirmation.', 'info');
      return;
    }

    const cleanAmt = Math.round(Number(amountInput || 0));
    if (cleanAmt < minAmt || cleanAmt > maxAmt) {
      showToast(`Amount must be between ${formatInr(minAmt)} and ${formatInr(maxAmt)}.`, 'error');
      return;
    }

    const cleanUtr = utrNumber.trim().toUpperCase().replace(/\s+/g, '');
    if (cleanUtr.length < 6 || cleanUtr.length > 40 || !/^[A-Z0-9_-]+$/.test(cleanUtr)) {
      showToast('Enter a valid 6–40 character UTR / Transaction Reference ID.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Authentication required. Please sign in again.');

      const res = await submitQrPayment(token, {
        paymentMethod: selectedMethod,
        amountInr: cleanAmt,
        utrNumber: cleanUtr,
        serviceType: request.serviceType,
        targetId: request.targetId,
        targetTitle: request.targetTitle,
        creatorId: request.creatorId,
        creatorName: request.creatorName,
        note: note.trim(),
      });

      setReceipt({
        paymentId: res.paymentId,
        utrNumber: res.utrNumber,
        paymentMethod: res.paymentMethod,
        amountInr: res.amountInr,
        targetTitle: res.targetTitle,
      });

      showToast(
        `UTR ${res.utrNumber} submitted. Status: Pending Verification by BharatPlay CEO/Admin.`,
        'info'
      );
      onSubmitted?.({
        paymentId: res.paymentId,
        utrNumber: res.utrNumber,
        amountInr: res.amountInr,
      });
    } catch (err: any) {
      showToast(err?.message || 'Unable to record payment confirmation.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-2xl max-h-[94vh] overflow-y-auto bg-white dark:bg-[#111115] border-t sm:border border-zinc-200 dark:border-zinc-800 rounded-t-2xl sm:rounded-2xl shadow-2xl text-zinc-900 dark:text-white">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/95 dark:bg-[#111115]/95 backdrop-blur-md px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-[#E11D48] shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#EA580C] dark:text-[#F97316]">
                BharatPlay UPI Checkout
              </span>
            </div>
            <h3 className="text-base font-bold truncate mt-0.5">{request.targetTitle}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close payment modal"
            className="p-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {receipt ? (
          <div className="p-6 space-y-5">
            <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 space-y-3">
              <div className="flex items-center gap-2.5 text-amber-800 dark:text-amber-300">
                <Clock className="w-5 h-5 shrink-0" />
                <span className="text-sm font-bold">Payment Status: Pending Verification</span>
              </div>
              <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                Your transaction reference has been securely logged. Services and memberships activate strictly after CEO / Admin verifies UTR{' '}
                <span className="font-mono font-bold text-zinc-900 dark:text-white">{receipt.utrNumber}</span> against the merchant UPI settlement statement.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800 text-xs">
              <div>
                <div className="text-zinc-500 dark:text-zinc-400">Reference ID</div>
                <div className="font-mono font-semibold mt-0.5 break-all">{receipt.paymentId}</div>
              </div>
              <div>
                <div className="text-zinc-500 dark:text-zinc-400">UTR / Transaction ID</div>
                <div className="font-mono font-bold text-[#EA580C] dark:text-[#F97316] mt-0.5 break-all">
                  {receipt.utrNumber}
                </div>
              </div>
              <div>
                <div className="text-zinc-500 dark:text-zinc-400">Payment Method</div>
                <div className="font-semibold mt-0.5">{receipt.paymentMethod}</div>
              </div>
              <div>
                <div className="text-zinc-500 dark:text-zinc-400">Amount Submitted</div>
                <div className="font-mono font-bold mt-0.5">{formatInr(receipt.amountInr)}</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigate('payments');
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#E11D48] to-[#F97316] text-xs font-semibold text-white min-h-[44px]"
                >
                  View Payment History
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-900 dark:text-white min-h-[44px]"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleConfirmPayment} className="p-5 sm:p-6 space-y-5">
            {/* Step 1: Select Payment Method */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                1. Select Payment Method
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {PAYMENT_METHOD_OPTIONS.map((opt) => {
                  const active = selectedMethod === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedMethod(opt.id)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all min-h-[44px] flex items-center justify-center text-center ${
                        active
                          ? 'bg-gradient-to-r from-[#E11D48] to-[#F97316] border-transparent text-white shadow-sm'
                          : 'bg-zinc-50 dark:bg-[#18181D] border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Confirm / Enter Payment Amount */}
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                  2. Payment Amount (INR)
                </div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Recipient: <span className="font-semibold text-zinc-800 dark:text-zinc-200">{request.creatorName}</span>
                </div>
              </div>

              {request.allowCustomAmount ? (
                <div className="flex items-center gap-2">
                  {[50, 100, 250, 500].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAmountInput(preset)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold border ${
                        amountInput === preset
                          ? 'bg-[#F97316] border-[#F97316] text-white'
                          : 'bg-white dark:bg-[#141418] border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      ₹{preset}
                    </button>
                  ))}
                  <div className="relative w-28">
                    <IndianRupee className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="number"
                      min={minAmt}
                      max={maxAmt}
                      required
                      value={amountInput}
                      onChange={(e) => setAmountInput(Number(e.target.value))}
                      aria-label="Payment amount in INR"
                      className="w-full pl-7 pr-2.5 py-2 rounded-lg bg-white dark:bg-[#141418] border border-zinc-300 dark:border-zinc-700 text-xs font-mono font-bold text-zinc-900 dark:text-white"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="relative w-32">
                    <IndianRupee className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="number"
                      min={minAmt}
                      max={maxAmt}
                      required
                      value={amountInput}
                      onChange={(e) => setAmountInput(Math.max(minAmt, Number(e.target.value)))}
                      aria-label="Confirm payment amount in INR"
                      className="w-full pl-7 pr-2.5 py-2 rounded-lg bg-white dark:bg-[#141418] border border-zinc-300 dark:border-zinc-700 text-sm font-mono font-bold text-zinc-900 dark:text-white"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Step 3: Exact Scan & Pay PhonePe QR + Instructions */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center p-4 rounded-2xl bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800">
              <div className="sm:col-span-5 flex flex-col items-center justify-center">
                <div className="w-full max-w-[230px] rounded-2xl bg-white p-2.5 border border-zinc-200 shadow-md">
                  <img
                    src={UPI_QR_IMAGE_SRC}
                    alt="BharatPlay Official PhonePe UPI QR Code"
                    className="w-full h-auto block object-contain rounded-lg"
                  />
                </div>
              </div>

              <div className="sm:col-span-7 space-y-3 text-xs">
                <div className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-white">
                  <Smartphone className="w-4 h-4 text-[#F97316]" />
                  <span>Scan & Pay with {selectedMethod}</span>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                  <span className="text-zinc-600 dark:text-zinc-400">Pay Exact Amount</span>
                  <span className="text-lg font-mono font-extrabold tabular-nums text-[#E11D48] dark:text-[#F97316]">
                    {formatInr(amountInput || 0)}
                  </span>
                </div>

                <ol className="space-y-1.5 text-zinc-600 dark:text-zinc-300 list-decimal list-inside leading-relaxed">
                  <li>{activeHint}</li>
                  <li>
                    Verify payee and enter <span className="font-mono font-semibold text-zinc-900 dark:text-white">{formatInr(amountInput || 0)}</span>.
                  </li>
                  <li>Complete UPI PIN authorization in your app.</li>
                  <li>Copy the 12-digit UTR / Transaction Reference ID and submit below.</li>
                </ol>

                <div className="flex items-start gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 pt-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    Payments are marked <strong>Pending Verification</strong> and activated after CEO/Admin UTR verification.
                  </span>
                </div>
              </div>
            </div>

            {/* Step 4: Submit UTR / Transaction ID */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  3. Enter Transaction ID / UTR Number *
                </label>
                <input
                  type="text"
                  required
                  minLength={6}
                  maxLength={40}
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. 429183746512 or T2603192837461"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-sm font-mono text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-[#F97316] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Note / Appreciation Message (Optional)
                </label>
                <input
                  type="text"
                  maxLength={280}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional message for creator or billing note"
                  className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-[#09090B] border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white placeholder-zinc-400"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2.5 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#E11D48] to-[#F97316] hover:opacity-95 disabled:opacity-50 text-xs font-bold text-white min-h-[44px]"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {submitting
                    ? 'Submitting UTR...'
                    : `I Have Paid ${formatInr(amountInput || 0)} · Submit Confirmation`}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
