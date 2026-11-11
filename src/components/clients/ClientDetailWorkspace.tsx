'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ClientDetail {
  id: string;
  name: string;
  phone: string;
  notes: string;
  agentName: string;
}

export function ClientDetailWorkspace({
  clientId,
  userRole,
}: {
  clientId: string;
  userRole: 'ADMIN' | 'SALES' | 'ACCOUNTANT';
}) {
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/clients/${clientId}`)
      .then(async (res) => {
        const data = (await res.json()) as { client?: ClientDetail; error?: string };
        if (!active) return;
        if (!res.ok || !data.client) {
          setErrorMsg(data.error ?? 'العميل غير موجود');
          return;
        }
        setClient(data.client);
        setName(data.client.name);
        setPhone(data.client.phone);
        setNotes(data.client.notes);
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
  }, [clientId]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setFieldErrors({});
    setSuccessMsg(null);
    setSaving(true);

    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          notes: notes.trim(),
        }),
      });
      const data = (await res.json()) as {
        client?: ClientDetail;
        error?: string;
        fieldErrors?: Record<string, string>;
      };
      if (!res.ok || !data.client) {
        if (data.fieldErrors) {
          setFieldErrors(data.fieldErrors);
        }
        setErrorMsg(data.error ?? 'تعذر تحديث بيانات العميل');
        return;
      }
      setClient(data.client);
      setSuccessMsg('تم تحديث بيانات العميل بنجاح');
    } catch {
      setErrorMsg('تعذر الاتصال بالخادم');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/clients"
        className="inline-flex min-h-[40px] items-center gap-1.5 text-sm font-medium text-[#14533C] hover:underline"
      >
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
        <span>العودة إلى قائمة العملاء</span>
      </Link>

      {loading ? (
        <div className="rounded-lg border border-[#E2DDD3] bg-white p-8 text-center text-sm text-[#56615B]">
          جاري تحميل بيانات العميل...
        </div>
      ) : errorMsg && !client ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded border border-[#FECACA] bg-[#FEF2F2] p-4 text-sm text-[#B91C1C]"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      ) : client ? (
        <div className="max-w-2xl rounded-lg border border-[#E2DDD3] bg-white p-6 space-y-5">
          <div className="border-b border-[#E2DDD3] pb-4">
            <h1 className="text-xl font-bold">{client.name}</h1>
            <p className="mt-1 text-sm text-[#56615B]">المندوب المسؤول: {client.agentName}</p>
          </div>

          {successMsg && (
            <div className="flex items-center gap-2 rounded border border-[#BBF7D0] bg-[#ECFDF5] p-3 text-sm text-[#15803D]">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="flex items-center gap-2 rounded border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B91C1C]">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}

          {userRole === 'SALES' ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label htmlFor="cd-name" className="mb-1 block text-xs font-medium">
                  الاسم
                </label>
                <input
                  id="cd-name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="min-h-[42px] w-full rounded border border-[#E2DDD3] px-3 text-sm"
                />
                {fieldErrors.name && (
                  <p className="mt-1 text-xs text-[#B91C1C]">{fieldErrors.name}</p>
                )}
              </div>
              <div>
                <label htmlFor="cd-phone" className="mb-1 block text-xs font-medium">
                  رقم الهاتف
                </label>
                <input
                  id="cd-phone"
                  required
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="min-h-[42px] w-full rounded border border-[#E2DDD3] px-3 text-sm tabular-nums"
                />
                {fieldErrors.phone && (
                  <p className="mt-1 text-xs text-[#B91C1C]">{fieldErrors.phone}</p>
                )}
              </div>
              <div>
                <label htmlFor="cd-notes" className="mb-1 block text-xs font-medium">
                  الملاحظات
                </label>
                <textarea
                  id="cd-notes"
                  rows={5}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded border border-[#E2DDD3] p-3 text-sm"
                />
                {fieldErrors.notes && (
                  <p className="mt-1 text-xs text-[#B91C1C]">{fieldErrors.notes}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={saving}
                className="min-h-[44px] rounded bg-[#14533C] px-5 text-sm font-semibold text-white hover:bg-[#0F402E] disabled:opacity-60"
              >
                {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
              </button>
            </form>
          ) : (
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-xs font-medium text-[#56615B]">رقم الهاتف</p>
                <p className="mt-1 font-medium tabular-nums" dir="ltr">
                  {client.phone}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-[#56615B]">الملاحظات</p>
                <p className="mt-1 whitespace-pre-wrap rounded border border-[#E2DDD3] bg-[#F7F5F0] p-3 text-sm">
                  {client.notes || 'لا توجد ملاحظات مسجلة'}
                </p>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
