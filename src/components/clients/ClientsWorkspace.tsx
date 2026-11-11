'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { UserPlus, AlertCircle, CheckCircle2, Eye } from 'lucide-react';

interface ClientItem {
  id: string;
  name: string;
  phone: string;
  notes: string;
  agentName: string;
  createdAt: string;
}

export function ClientsWorkspace({ userRole }: { userRole: 'ADMIN' | 'SALES' | 'ACCOUNTANT' }) {
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formFieldErrors, setFormFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const loadClients = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/clients');
      const data = (await res.json()) as { items?: ClientItem[]; error?: string };
      if (!res.ok) {
        setErrorMsg(data.error ?? 'تعذر تحميل العملاء');
        return;
      }
      setClients(data.items ?? []);
    } catch {
      setErrorMsg('تعذر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch('/api/clients')
      .then(async (res) => {
        const data = (await res.json()) as { items?: ClientItem[]; error?: string };
        if (!active) return;
        if (!res.ok) {
          setErrorMsg(data.error ?? 'تعذر تحميل العملاء');
          return;
        }
        setClients(data.items ?? []);
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

  async function handleCreateClient(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormFieldErrors({});
    setSaving(true);
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          notes: notes.trim(),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        fieldErrors?: Record<string, string>;
      };
      if (!res.ok) {
        if (data.fieldErrors) {
          setFormFieldErrors(data.fieldErrors);
        }
        setFormError(data.error ?? 'تعذر إضافة العميل');
        return;
      }
      setModalOpen(false);
      setName('');
      setPhone('');
      setNotes('');
      setSuccessMsg('تمت إضافة العميل بنجاح');
      await loadClients();
    } catch {
      setFormError('خطأ في الاتصال بالخادم');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E2DDD3] pb-4">
        <div>
          <h1 className="text-2xl font-bold">العملاء</h1>
          <p className="mt-1 text-sm text-[#56615B]">
            {userRole === 'SALES'
              ? 'قائمة عملائك المسجلين فقط'
              : 'سجل عملاء الشركة (عرض فقط)'}
          </p>
        </div>

        {userRole === 'SALES' && (
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setFormFieldErrors({});
              setModalOpen(true);
            }}
            className="inline-flex min-h-[44px] items-center gap-2 rounded bg-[#14533C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0F402E]"
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            <span>إضافة عميل</span>
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

      {loading ? (
        <div className="rounded-lg border border-[#E2DDD3] bg-white p-8 text-center text-sm text-[#56615B]">
          جاري تحميل العملاء...
        </div>
      ) : clients.length === 0 ? (
        <div className="rounded-lg border border-[#E2DDD3] bg-white p-8 text-center text-sm text-[#56615B]">
          لا يوجد عملاء مسجلون حالياً.
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-[#E2DDD3] bg-white md:block">
            <table className="w-full border-collapse text-right text-sm">
              <thead className="border-b border-[#E2DDD3] bg-[#F7F5F0] text-xs font-semibold text-[#56615B]">
                <tr>
                  <th className="px-4 py-3">اسم العميل</th>
                  <th className="px-4 py-3">الهاتف</th>
                  <th className="px-4 py-3">المندوب المسؤول</th>
                  <th className="px-4 py-3">التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2DDD3]">
                {clients.map((c) => (
                  <tr key={c.id} className="hover:bg-[#F7F5F0]/50">
                    <td className="px-4 py-3 font-semibold">{c.name}</td>
                    <td className="px-4 py-3 tabular-nums" dir="ltr">
                      {c.phone}
                    </td>
                    <td className="px-4 py-3 text-[#56615B]">{c.agentName}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/clients/${c.id}`}
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded border border-[#E2DDD3] px-3 py-1 text-xs font-medium hover:bg-[#EFECE4]"
                      >
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>عرض الملاحظات والتفاصيل</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {clients.map((c) => (
              <div key={c.id} className="rounded-lg border border-[#E2DDD3] bg-white p-4 space-y-2">
                <p className="font-bold">{c.name}</p>
                <p className="text-sm tabular-nums text-[#56615B]" dir="ltr">
                  {c.phone}
                </p>
                <p className="text-xs text-[#56615B]">المندوب: {c.agentName}</p>
                <Link
                  href={`/clients/${c.id}`}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded border border-[#E2DDD3] text-sm font-medium"
                >
                  <Eye className="h-4 w-4" aria-hidden="true" />
                  <span>عرض التفاصيل</span>
                </Link>
              </div>
            ))}
          </div>
        </>
      )}

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="client-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-[#E2DDD3] bg-white p-6">
            <h2 id="client-modal-title" className="text-lg font-bold">
              إضافة عميل جديد
            </h2>

            {formError && (
              <div className="mt-3 rounded border border-[#FECACA] bg-[#FEF2F2] p-2.5 text-sm text-[#B91C1C]">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateClient} className="mt-4 space-y-3">
              <div>
                <label htmlFor="c-name" className="mb-1 block text-xs font-medium">
                  الاسم الكامل
                </label>
                <input
                  id="c-name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="min-h-[42px] w-full rounded border border-[#E2DDD3] px-3 text-sm"
                />
                {formFieldErrors.name && (
                  <p className="mt-1 text-xs text-[#B91C1C]">{formFieldErrors.name}</p>
                )}
              </div>
              <div>
                <label htmlFor="c-phone" className="mb-1 block text-xs font-medium">
                  رقم الهاتف
                </label>
                <input
                  id="c-phone"
                  required
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="min-h-[42px] w-full rounded border border-[#E2DDD3] px-3 text-sm tabular-nums"
                />
                {formFieldErrors.phone && (
                  <p className="mt-1 text-xs text-[#B91C1C]">{formFieldErrors.phone}</p>
                )}
              </div>
              <div>
                <label htmlFor="c-notes" className="mb-1 block text-xs font-medium">
                  ملاحظات
                </label>
                <textarea
                  id="c-notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded border border-[#E2DDD3] p-3 text-sm"
                />
                {formFieldErrors.notes && (
                  <p className="mt-1 text-xs text-[#B91C1C]">{formFieldErrors.notes}</p>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="min-h-[42px] rounded border border-[#E2DDD3] px-4 text-sm"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[42px] rounded bg-[#14533C] px-4 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving ? 'جاري الحفظ...' : 'حفظ العميل'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
