'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FilePlus2, AlertCircle, Clock } from 'lucide-react';
import { formatMinorUnits, formatUtcDateTime, majorInputToMinorString } from '@/lib/format';
import { reservationStatusBadge } from '@/components/StatusBadge';

interface ReservationItem {
  id: string;
  unitId: string;
  unitNumber: string;
  projectName: string;
  unitPrice: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  agentName: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CONVERTED';
  expiresAt: string;
  createdAt: string;
  contractId: string | null;
}

export function ReservationsWorkspace({ userRole }: { userRole: 'ADMIN' | 'SALES' | 'ACCOUNTANT' }) {
  const router = useRouter();
  const [items, setItems] = useState<ReservationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Draft contract modal
  const [draftFor, setDraftFor] = useState<ReservationItem | null>(null);
  const [discountInput, setDiscountInput] = useState('0');
  const [downPaymentInput, setDownPaymentInput] = useState('0');
  const [installmentCount, setInstallmentCount] = useState('12');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [draftError, setDraftError] = useState<string | null>(null);
  const [creatingDraft, setCreatingDraft] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/reservations')
      .then(async (res) => {
        const data = (await res.json()) as { items?: ReservationItem[]; error?: string };
        if (!active) return;
        if (!res.ok) {
          setErrorMsg(data.error ?? 'تعذر تحميل الحجوزات');
          return;
        }
        setItems(data.items ?? []);
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
  }, []);

  function openDraftModal(r: ReservationItem) {
    setDraftFor(r);
    setDiscountInput('0');
    setDownPaymentInput('0');
    setInstallmentCount('12');
    setStartDate(new Date().toISOString().slice(0, 10));
    setDraftError(null);
  }

  async function handleCreateDraft(e: FormEvent) {
    e.preventDefault();
    if (!draftFor) return;
    setDraftError(null);

    let discountMinor: string;
    let downMinor: string;
    try {
      discountMinor = majorInputToMinorString(discountInput || '0');
      downMinor = majorInputToMinorString(downPaymentInput || '0');
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : 'قيم مالية غير صالحة');
      return;
    }

    setCreatingDraft(true);
    try {
      const res = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationId: draftFor.id,
          discount: discountMinor,
          downPayment: downMinor,
          installmentCount: Number(installmentCount),
          startDate,
        }),
      });
      const data = (await res.json()) as { contract?: { id: string }; error?: string };
      if (!res.ok || !data.contract) {
        setDraftError(data.error ?? 'تعذر إنشاء مسودة العقد');
        return;
      }
      setDraftFor(null);
      router.push(`/contracts/${data.contract.id}`);
    } catch {
      setDraftError('تعذر الاتصال بالخادم');
    } finally {
      setCreatingDraft(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-[#E2DDD3] pb-4">
        <h1 className="text-2xl font-bold">الحجوزات (صلاحية 72 ساعة)</h1>
        <p className="mt-1 text-sm text-[#56615B]">
          تعود الوحدات المحجوزة إلى متاحة تلقائياً عند انتهاء مدة 72 ساعة دون اعتماد عقد.
        </p>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B91C1C]"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-[#E2DDD3] bg-white p-8 text-center text-sm text-[#56615B]">
          جاري تحميل الحجوزات...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-[#E2DDD3] bg-white p-8 text-center text-sm text-[#56615B]">
          لا توجد حجوزات مسجلة حالياً.
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-[#E2DDD3] bg-white md:block">
            <table className="w-full border-collapse text-right text-sm">
              <thead className="border-b border-[#E2DDD3] bg-[#F7F5F0] text-xs font-semibold text-[#56615B]">
                <tr>
                  <th className="px-4 py-3">الوحدة</th>
                  <th className="px-4 py-3">السعر</th>
                  <th className="px-4 py-3">العميل</th>
                  <th className="px-4 py-3">المندوب</th>
                  <th className="px-4 py-3">ينتهي في</th>
                  <th className="px-4 py-3">الحالة</th>
                  <th className="px-4 py-3">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2DDD3]">
                {items.map((r) => (
                  <tr key={r.id} className="hover:bg-[#F7F5F0]/50">
                    <td className="px-4 py-3">
                      <p className="font-semibold tabular-nums">{r.unitNumber}</p>
                      <p className="text-xs text-[#56615B]">{r.projectName}</p>
                    </td>
                    <td className="px-4 py-3 font-medium tabular-nums">
                      {formatMinorUnits(r.unitPrice)}
                    </td>
                    <td className="px-4 py-3">
                      <p>{r.clientName}</p>
                      <p className="text-xs text-[#56615B] tabular-nums" dir="ltr">
                        {r.clientPhone}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-[#56615B]">{r.agentName}</td>
                    <td className="px-4 py-3 text-xs tabular-nums" dir="ltr">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-[#56615B]" aria-hidden="true" />
                        {formatUtcDateTime(r.expiresAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{reservationStatusBadge(r.status)}</td>
                    <td className="px-4 py-3">
                      {r.contractId ? (
                        <Link
                          href={`/contracts/${r.contractId}`}
                          className="text-xs font-semibold text-[#14533C] underline"
                        >
                          عرض العقد
                        </Link>
                      ) : userRole === 'SALES' && r.status === 'ACTIVE' ? (
                        <button
                          type="button"
                          onClick={() => openDraftModal(r)}
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded bg-[#14533C] px-3 py-1 text-xs font-semibold text-white hover:bg-[#0F402E]"
                        >
                          <FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>إنشاء مسودة عقد</span>
                        </button>
                      ) : (
                        <span className="text-xs text-[#56615B]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {items.map((r) => (
              <div key={r.id} className="rounded-lg border border-[#E2DDD3] bg-white p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold tabular-nums">{r.unitNumber}</span>
                  {reservationStatusBadge(r.status)}
                </div>
                <p className="text-sm">{r.projectName}</p>
                <p className="text-sm text-[#56615B]">العميل: {r.clientName}</p>
                <p className="text-xs text-[#56615B] tabular-nums" dir="ltr">
                  ينتهي: {formatUtcDateTime(r.expiresAt)}
                </p>
                {r.contractId ? (
                  <Link
                    href={`/contracts/${r.contractId}`}
                    className="inline-flex min-h-[44px] w-full items-center justify-center rounded border border-[#14533C] text-sm font-semibold text-[#14533C]"
                  >
                    عرض العقد
                  </Link>
                ) : userRole === 'SALES' && r.status === 'ACTIVE' ? (
                  <button
                    type="button"
                    onClick={() => openDraftModal(r)}
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded bg-[#14533C] text-sm font-semibold text-white"
                  >
                    <FilePlus2 className="h-4 w-4" aria-hidden="true" />
                    <span>إنشاء مسودة عقد</span>
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </>
      )}

      {draftFor && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="draft-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-[#E2DDD3] bg-white p-6">
            <h2 id="draft-modal-title" className="text-lg font-bold">
              إنشاء مسودة عقد — وحدة {draftFor.unitNumber}
            </h2>
            <p className="mt-1 text-sm text-[#56615B]">
              سعر الوحدة: <strong className="tabular-nums">{formatMinorUnits(draftFor.unitPrice)}</strong> (الحد الأقصى للخصم 5%)
            </p>

            {draftError && (
              <div className="mt-3 rounded border border-[#FECACA] bg-[#FEF2F2] p-2.5 text-sm text-[#B91C1C]">
                {draftError}
              </div>
            )}

            <form onSubmit={handleCreateDraft} className="mt-4 space-y-3">
              <div>
                <label htmlFor="cd-discount" className="mb-1 block text-xs font-medium">
                  قيمة الخصم (بحد أقصى 5% من السعر)
                </label>
                <input
                  id="cd-discount"
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  className="min-h-[42px] w-full rounded border border-[#E2DDD3] px-3 text-sm tabular-nums"
                />
              </div>

              <div>
                <label htmlFor="cd-down" className="mb-1 block text-xs font-medium">
                  الدفعة الأولى
                </label>
                <input
                  id="cd-down"
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  required
                  value={downPaymentInput}
                  onChange={(e) => setDownPaymentInput(e.target.value)}
                  className="min-h-[42px] w-full rounded border border-[#E2DDD3] px-3 text-sm tabular-nums"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cd-count" className="mb-1 block text-xs font-medium">
                    عدد الأقساط
                  </label>
                  <input
                    id="cd-count"
                    type="number"
                    min="1"
                    max="360"
                    dir="ltr"
                    required
                    value={installmentCount}
                    onChange={(e) => setInstallmentCount(e.target.value)}
                    className="min-h-[42px] w-full rounded border border-[#E2DDD3] px-3 text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="cd-start" className="mb-1 block text-xs font-medium">
                    تاريخ بداية الأقساط
                  </label>
                  <input
                    id="cd-start"
                    type="date"
                    dir="ltr"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="min-h-[42px] w-full rounded border border-[#E2DDD3] px-3 text-sm tabular-nums"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setDraftFor(null)}
                  className="min-h-[42px] rounded border border-[#E2DDD3] px-4 text-sm"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={creatingDraft}
                  className="min-h-[42px] rounded bg-[#14533C] px-4 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {creatingDraft ? 'جاري الإنشاء...' : 'حفظ مسودة العقد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
