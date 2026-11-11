'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  CreditCard,
} from 'lucide-react';
import { formatMinorUnits, majorInputToMinorString } from '@/lib/format';
import { generateIdempotencyKey } from '@/lib/uuid';
import {
  contractStatusBadge,
  installmentStatusBadge,
  unitStatusBadge,
} from '@/components/StatusBadge';

interface InstallmentRow {
  id: string;
  sequenceNumber: number;
  amount: string;
  paidAmount: string;
  remainingAmount: string;
  status: 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE';
  dueDate: string;
}

interface PaymentRow {
  id: string;
  amount: string;
  idempotencyKey: string;
  recordedByName: string;
  createdAt: string;
  allocations: Array<{
    installmentId: string;
    sequenceNumber: number;
    amount: string;
  }>;
}

interface ContractDetail {
  id: string;
  unitNumber: string;
  projectName: string;
  unitStatus: 'AVAILABLE' | 'RESERVED' | 'SOLD';
  clientName: string;
  clientPhone: string;
  createdByName: string;
  approvedByName: string | null;
  status: 'DRAFT' | 'APPROVED';
  unitPrice: string;
  discount: string;
  finalPrice: string;
  downPayment: string;
  remainingAmount: string;
  outstandingBalance: string;
  installmentCount: number;
  startDate: string;
  approvedAt: string | null;
  installments: InstallmentRow[];
  payments: PaymentRow[];
}

interface PaymentSuccessResult {
  amount: string;
  replayed: boolean;
  remainingContractBalance: string;
  allocations: Array<{
    sequenceNumber: number;
    amount: string;
  }>;
}

export function ContractDetailWorkspace({
  contractId,
  userRole,
}: {
  contractId: string;
  userRole: 'ADMIN' | 'SALES' | 'ACCOUNTANT';
}) {
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Approve confirmation
  const [confirmApproveOpen, setConfirmApproveOpen] = useState(false);
  const [approving, setApproving] = useState(false);

  // Payment entry
  const [payAmountInput, setPayAmountInput] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(() => generateIdempotencyKey());
  const [confirmPaymentOpen, setConfirmPaymentOpen] = useState(false);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentFieldError, setPaymentFieldError] = useState<string | null>(null);
  const [lastPaymentResult, setLastPaymentResult] = useState<PaymentSuccessResult | null>(null);

  const loadContract = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/contracts/${contractId}`);
      const data = (await res.json()) as { contract?: ContractDetail; error?: string };
      if (!res.ok || !data.contract) {
        setErrorMsg(data.error ?? 'العقد غير موجود');
        return;
      }
      setContract(data.contract);
    } catch {
      setErrorMsg('تعذر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    let active = true;
    fetch(`/api/contracts/${contractId}`)
      .then(async (res) => {
        const data = (await res.json()) as { contract?: ContractDetail; error?: string };
        if (!active) return;
        if (!res.ok || !data.contract) {
          setErrorMsg(data.error ?? 'العقد غير موجود');
          return;
        }
        setContract(data.contract);
      })
      .catch(() => {
        if (active) setErrorMsg('تعذر الاتصال بالخادم');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [contractId]);

  async function handleApproveContract() {
    setApproving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/contracts/${contractId}/approve`, {
        method: 'POST',
      });
      const data = (await res.json()) as { contract?: ContractDetail; error?: string };
      if (!res.ok || !data.contract) {
        setErrorMsg(data.error ?? 'تعذر اعتماد العقد');
        setConfirmApproveOpen(false);
        return;
      }
      setContract(data.contract);
      setConfirmApproveOpen(false);
      setSuccessMsg('تم اعتماد العقد وتحديث حالة الوحدة إلى مباعة وتوليد جدول الأقساط بنجاح.');
    } catch {
      setErrorMsg('تعذر الاتصال بالخادم');
    } finally {
      setApproving(false);
    }
  }

  function handleOpenPaymentConfirm(e: FormEvent) {
    e.preventDefault();
    setPaymentError(null);
    setPaymentFieldError(null);
    try {
      const minor = majorInputToMinorString(payAmountInput);
      if (BigInt(minor) <= 0n) {
        const msg = 'مبلغ الدفعة يجب أن يكون أكبر من صفر';
        setPaymentError(msg);
        setPaymentFieldError(msg);
        return;
      }
      setConfirmPaymentOpen(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'مبلغ غير صالح';
      setPaymentError(msg);
      setPaymentFieldError(msg);
    }
  }

  async function handleSubmitPayment() {
    if (!contract) return;
    setPaymentError(null);
    setPaymentFieldError(null);
    setRecordingPayment(true);

    let minorStr: string;
    try {
      minorStr = majorInputToMinorString(payAmountInput);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'مبلغ غير صالح';
      setPaymentError(msg);
      setPaymentFieldError(msg);
      setRecordingPayment(false);
      setConfirmPaymentOpen(false);
      return;
    }

    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractId: contract.id,
          amount: minorStr,
          idempotencyKey,
        }),
      });
      const data = (await res.json()) as {
        payment?: PaymentSuccessResult;
        error?: string;
        fieldErrors?: Record<string, string>;
      };
      if (!res.ok || !data.payment) {
        if (data.fieldErrors?.amount) {
          setPaymentFieldError(data.fieldErrors.amount);
        }
        setPaymentError(data.error ?? 'تعذر تسجيل الدفعة');
        setConfirmPaymentOpen(false);
        return;
      }

      setLastPaymentResult(data.payment);
      setConfirmPaymentOpen(false);
      setPayAmountInput('');
      // Rotate idempotency key for the NEXT distinct payment
      setIdempotencyKey(generateIdempotencyKey());
      setSuccessMsg('تم تسجيل الدفعة وتوزيعها على الأقساط الأقدم بنجاح.');
      await loadContract();
    } catch {
      setPaymentError('تعذر الاتصال بالخادم');
      setConfirmPaymentOpen(false);
    } finally {
      setRecordingPayment(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-[#E2DDD3] bg-white p-8 text-center text-sm text-[#56615B]">
        جاري تحميل تفاصيل العقد...
      </div>
    );
  }

  if (errorMsg && !contract) {
    return (
      <div className="space-y-4">
        <Link
          href="/contracts"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#14533C] hover:underline"
        >
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
          <span>العودة إلى العقود</span>
        </Link>
        <div
          role="alert"
          className="flex items-center gap-2 rounded border border-[#FECACA] bg-[#FEF2F2] p-4 text-sm text-[#B91C1C]"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      </div>
    );
  }

  if (!contract) return null;

  const hasOutstanding = BigInt(contract.outstandingBalance) > 0n;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E2DDD3] pb-4">
        <div>
          <Link
            href="/contracts"
            className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-[#14533C] hover:underline"
          >
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
            <span>العودة إلى العقود</span>
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">
              عقد وحدة {contract.unitNumber}
            </h1>
            {contractStatusBadge(contract.status)}
            {unitStatusBadge(contract.unitStatus)}
          </div>
          <p className="mt-1 text-sm text-[#56615B]">
            {contract.projectName} — العميل: {contract.clientName} ({contract.clientPhone})
          </p>
        </div>

        {userRole === 'ACCOUNTANT' && contract.status === 'DRAFT' && (
          <button
            type="button"
            onClick={() => setConfirmApproveOpen(true)}
            className="min-h-[44px] rounded bg-[#14533C] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0F402E]"
          >
            اعتماد العقد
          </button>
        )}
      </div>

      {successMsg && (
        <div
          role="status"
          className="flex items-center gap-2 rounded border border-[#BBF7D0] bg-[#ECFDF5] p-3 text-sm text-[#15803D]"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B91C1C]"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Financial Ledger Summary */}
      <section aria-label="الملخص المالي للعقد" className="rounded-lg border border-[#E2DDD3] bg-white p-5">
        <h2 className="mb-4 text-base font-bold">الملخص المالي</h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <dt className="text-xs text-[#56615B]">سعر الوحدة</dt>
            <dd className="mt-1 font-semibold tabular-nums">{formatMinorUnits(contract.unitPrice)}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#56615B]">الخصم</dt>
            <dd className="mt-1 font-semibold tabular-nums">{formatMinorUnits(contract.discount)}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#56615B]">السعر النهائي</dt>
            <dd className="mt-1 font-bold tabular-nums">{formatMinorUnits(contract.finalPrice)}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#56615B]">الدفعة الأولى</dt>
            <dd className="mt-1 font-semibold tabular-nums">{formatMinorUnits(contract.downPayment)}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#56615B]">إجمالي الأقساط</dt>
            <dd className="mt-1 font-semibold tabular-nums">{formatMinorUnits(contract.remainingAmount)}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#56615B]">المتبقي المستحق</dt>
            <dd className="mt-1 text-lg font-bold text-[#14533C] tabular-nums">
              {formatMinorUnits(contract.outstandingBalance)}
            </dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-[#E2DDD3] pt-3 text-xs text-[#56615B]">
          <span>تاريخ البداية: <strong className="tabular-nums">{contract.startDate}</strong></span>
          <span>عدد الأقساط: <strong className="tabular-nums">{contract.installmentCount}</strong></span>
          <span>أنشئ بواسطة: <strong>{contract.createdByName}</strong></span>
          {contract.approvedByName && (
            <span>اعتمده: <strong>{contract.approvedByName}</strong></span>
          )}
        </div>
      </section>

      {/* Accountant Payment Form */}
      {userRole === 'ACCOUNTANT' && contract.status === 'APPROVED' && hasOutstanding && (
        <section aria-label="تسجيل دفعة" className="rounded-lg border border-[#E2DDD3] bg-white p-5 space-y-4">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-[#14533C]" aria-hidden="true" />
            <h2 className="text-base font-bold">تسجيل دفعة جديدة</h2>
          </div>

          {paymentError && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B91C1C]"
            >
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{paymentError}</span>
            </div>
          )}

          {lastPaymentResult && (
            <div className="rounded border border-[#BBF7D0] bg-[#ECFDF5] p-3 text-sm text-[#15803D] space-y-1">
              <p className="font-semibold">
                نتيجة توزيع الدفعة ({formatMinorUnits(lastPaymentResult.amount)}):
              </p>
              <ul className="list-inside list-disc text-xs">
                {lastPaymentResult.allocations.map((a) => (
                  <li key={a.sequenceNumber} className="tabular-nums">
                    قسط رقم #{a.sequenceNumber}: {formatMinorUnits(a.amount)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <form onSubmit={handleOpenPaymentConfirm} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <label htmlFor="pay-amount" className="mb-1 block text-xs font-medium text-[#56615B]">
                مبلغ الدفعة (المتبقي الأقصى: {formatMinorUnits(contract.outstandingBalance)})
              </label>
              <input
                id="pay-amount"
                type="text"
                inputMode="decimal"
                dir="ltr"
                required
                value={payAmountInput}
                onChange={(e) => setPayAmountInput(e.target.value)}
                placeholder="مثال: 5000"
                disabled={recordingPayment}
                className="min-h-[44px] w-full rounded border border-[#E2DDD3] px-3 text-sm tabular-nums"
              />
              {paymentFieldError && (
                <p className="mt-1 text-xs text-[#B91C1C]">{paymentFieldError}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={recordingPayment}
              className="min-h-[44px] rounded bg-[#14533C] px-5 text-sm font-semibold text-white hover:bg-[#0F402E] disabled:opacity-60"
            >
              {recordingPayment ? 'جاري التسجيل...' : 'تسجيل الدفعة'}
            </button>
          </form>
        </section>
      )}

      {/* Installments Schedule */}
      <section aria-label="جدول الأقساط" className="rounded-lg border border-[#E2DDD3] bg-white p-5 space-y-4">
        <h2 className="text-base font-bold">جدول الأقساط</h2>

        {contract.status === 'DRAFT' ? (
          <p className="text-sm text-[#56615B]">
            سيتم توليد جدول الأقساط الشهري تلقائياً فور اعتماد العقد من المحاسب.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-right text-sm">
              <thead className="border-b border-[#E2DDD3] bg-[#F7F5F0] text-xs font-semibold text-[#56615B]">
                <tr>
                  <th className="px-3 py-2.5">#</th>
                  <th className="px-3 py-2.5">تاريخ الاستحقاق</th>
                  <th className="px-3 py-2.5">قيمة القسط</th>
                  <th className="px-3 py-2.5">المدفوع</th>
                  <th className="px-3 py-2.5">المتبقي</th>
                  <th className="px-3 py-2.5">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2DDD3]">
                {contract.installments.map((inst) => (
                  <tr key={inst.id}>
                    <td className="px-3 py-2.5 font-semibold tabular-nums">{inst.sequenceNumber}</td>
                    <td className="px-3 py-2.5 tabular-nums" dir="ltr">
                      {inst.dueDate}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{formatMinorUnits(inst.amount)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{formatMinorUnits(inst.paidAmount)}</td>
                    <td className="px-3 py-2.5 font-semibold tabular-nums">
                      {formatMinorUnits(inst.remainingAmount)}
                    </td>
                    <td className="px-3 py-2.5">{installmentStatusBadge(inst.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recorded Payments History (Append-Only) */}
      {contract.payments.length > 0 && (
        <section aria-label="سجل الدفعات" className="rounded-lg border border-[#E2DDD3] bg-white p-5 space-y-3">
          <h2 className="text-base font-bold">سجل الدفعات المسجلة</h2>
          <div className="divide-y divide-[#E2DDD3]">
            {contract.payments.map((p) => (
              <div key={p.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-[#14533C] tabular-nums">
                    {formatMinorUnits(p.amount)}
                  </span>
                  <span className="text-xs text-[#56615B]">
                    بواسطة {p.recordedByName} — <span dir="ltr">{p.createdAt.slice(0, 16).replace('T', ' ')}</span>
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#56615B]">
                  التوزيع:{' '}
                  {p.allocations
                    .map((a) => `قسط #${a.sequenceNumber} (${formatMinorUnits(a.amount)})`)
                    .join(' + ')}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Confirm Contract Approval Dialog */}
      {confirmApproveOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="approve-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-[#E2DDD3] bg-white p-6 space-y-4">
            <div className="flex items-center gap-2 text-[#A16207]">
              <ShieldAlert className="h-5 w-5" aria-hidden="true" />
              <h2 id="approve-dialog-title" className="text-lg font-bold text-[#1B2420]">
                تأكيد اعتماد العقد
              </h2>
            </div>
            <p className="text-sm text-[#56615B]">
              عند اعتماد العقد سيصبح غير قابل للتعديل نهائياً، وستتحول الوحدة إلى «مباعة»، وسيتم توليد {contract.installmentCount} قسطاً شهرياً. هل تريد المتابعة؟
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={approving}
                onClick={() => setConfirmApproveOpen(false)}
                className="min-h-[42px] rounded border border-[#E2DDD3] px-4 text-sm"
              >
                تراجع
              </button>
              <button
                type="button"
                disabled={approving}
                onClick={handleApproveContract}
                className="min-h-[42px] rounded bg-[#14533C] px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {approving ? 'جاري الاعتماد...' : 'تأكيد الاعتماد النهائي'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Payment Dialog */}
      {confirmPaymentOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pay-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-[#E2DDD3] bg-white p-6 space-y-4">
            <h2 id="pay-dialog-title" className="text-lg font-bold">
              تأكيد تسجيل الدفعة
            </h2>
            <p className="text-sm text-[#56615B]">
              سيتم تسجيل دفعة بمبلغ <strong className="tabular-nums text-[#1B2420]">{payAmountInput}</strong> وتوزيعها تلقائياً على الأقساط الأقدم غير المسددة. لا يمكن تعديل أو حذف الدفعة بعد تسجيلها.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={recordingPayment}
                onClick={() => setConfirmPaymentOpen(false)}
                className="min-h-[42px] rounded border border-[#E2DDD3] px-4 text-sm"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={recordingPayment}
                onClick={handleSubmitPayment}
                className="min-h-[42px] rounded bg-[#14533C] px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {recordingPayment ? 'جاري التسجيل...' : 'تأكيد التسجيل'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
