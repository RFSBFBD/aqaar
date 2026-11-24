'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowRight, AlertCircle, CheckCircle2, Building2 } from 'lucide-react';
import { formatCurrency, majorInputToMinorString, minorStringToMajorInput } from '@/lib/format';
import { unitStatusBadge } from '@/components/StatusBadge';

interface UnitDetail {
  id: string;
  projectName: string;
  unitNumber: string;
  type: string;
  area: number;
  rooms: number;
  price: string;
  status: 'AVAILABLE' | 'RESERVED' | 'SOLD';
  createdAt: string;
  updatedAt: string;
}

export function UnitDetailWorkspace({
  unitId,
  userRole,
}: {
  unitId: string;
  userRole: 'ADMIN' | 'SALES' | 'ACCOUNTANT';
}) {
  const [unit, setUnit] = useState<UnitDetail | null>(null);
  const [projectName, setProjectName] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const [type, setType] = useState('');
  const [area, setArea] = useState('');
  const [rooms, setRooms] = useState('');
  const [price, setPrice] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/units/${unitId}`)
      .then(async (res) => {
        const data = (await res.json()) as { unit?: UnitDetail; error?: string };
        if (!active) return;
        if (!res.ok || !data.unit) {
          setErrorMsg(data.error ?? 'الوحدة غير موجودة');
          return;
        }
        setUnit(data.unit);
        setProjectName(data.unit.projectName);
        setUnitNumber(data.unit.unitNumber);
        setType(data.unit.type);
        setArea(String(data.unit.area));
        setRooms(String(data.unit.rooms));
        setPrice(minorStringToMajorInput(data.unit.price));
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
  }, [unitId]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (userRole !== 'ADMIN') return;
    setErrorMsg(null);
    setFieldErrors({});
    setSuccessMsg(null);

    let priceMinor: string | undefined;
    if (!unit || unit.status === 'AVAILABLE') {
      try {
        priceMinor = majorInputToMinorString(price);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'السعر غير صالح';
        setErrorMsg(msg);
        setFieldErrors({ price: msg });
        return;
      }
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        projectName: projectName.trim(),
        unitNumber: unitNumber.trim(),
        type: type.trim(),
        area: Number(area),
        rooms: Number(rooms),
      };
      if (priceMinor !== undefined) {
        payload.price = priceMinor;
      }

      const res = await fetch(`/api/units/${unitId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as {
        unit?: UnitDetail;
        error?: string;
        fieldErrors?: Record<string, string>;
      };

      if (!res.ok || !data.unit) {
        if (data.fieldErrors) {
          setFieldErrors(data.fieldErrors);
        }
        setErrorMsg(data.error ?? 'تعذر حفظ بيانات الوحدة');
        return;
      }

      setUnit(data.unit);
      setSuccessMsg('تم تحديث بيانات الوحدة بنجاح');
    } catch {
      setErrorMsg('حدث خطأ في الاتصال بالخادم');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Link
          href="/units"
          className="inline-flex items-center gap-1.5 text-sm text-[#56615B] hover:text-[#1B2420]"
        >
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
          <span>العودة إلى الوحدات</span>
        </Link>
        <div className="rounded-lg border border-[#E2DDD3] bg-white p-8 text-center text-sm text-[#56615B]">
          جاري تحميل بيانات الوحدة...
        </div>
      </div>
    );
  }

  if (errorMsg && !unit) {
    return (
      <div className="space-y-4">
        <Link
          href="/units"
          className="inline-flex items-center gap-1.5 text-sm text-[#56615B] hover:text-[#1B2420]"
        >
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
          <span>العودة إلى الوحدات</span>
        </Link>
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-4 text-sm text-[#B91C1C]"
        >
          <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      </div>
    );
  }

  if (!unit) return null;

  const isPriceLocked = unit.status !== 'AVAILABLE';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E2DDD3] pb-4">
        <div>
          <Link
            href="/units"
            className="mb-2 inline-flex items-center gap-1.5 text-sm text-[#56615B] hover:text-[#1B2420]"
          >
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
            <span>العودة إلى الوحدات</span>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[#1B2420]">
              الوحدة {unit.unitNumber}
            </h1>
            {unitStatusBadge(unit.status)}
          </div>
          <p className="mt-1 text-sm text-[#56615B]">{unit.projectName}</p>
        </div>

        <div className="text-left">
          <p className="text-xs text-[#56615B]">السعر الحالي</p>
          <p className="text-xl font-bold text-[#14533C] tabular-nums">
            {formatCurrency(unit.price)}
          </p>
        </div>
      </div>

      {successMsg && (
        <div
          role="status"
          className="flex items-center justify-between gap-2 rounded-lg border border-[#BBF7D0] bg-[#ECFDF5] p-3 text-sm text-[#15803D]"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{successMsg}</span>
          </div>
          <button type="button" onClick={() => setSuccessMsg(null)} className="text-xs underline">
            إغلاق
          </button>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B91C1C]"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Unit Info Card */}
        <div className="rounded-lg border border-[#E2DDD3] bg-white p-5 space-y-4">
          <div className="flex items-center gap-2 text-[#14533C]">
            <Building2 className="h-5 w-5" aria-hidden="true" />
            <h2 className="text-base font-bold">معلومات الوحدة</h2>
          </div>
          <dl className="divide-y divide-[#E2DDD3] text-sm">
            <div className="flex justify-between py-2">
              <dt className="text-[#56615B]">المشروع</dt>
              <dd className="font-semibold">{unit.projectName}</dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="text-[#56615B]">رقم الوحدة</dt>
              <dd className="font-semibold tabular-nums">{unit.unitNumber}</dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="text-[#56615B]">النوع</dt>
              <dd className="font-semibold">{unit.type}</dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="text-[#56615B]">المساحة</dt>
              <dd className="font-semibold tabular-nums">{unit.area} م²</dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="text-[#56615B]">عدد الغرف</dt>
              <dd className="font-semibold tabular-nums">{unit.rooms}</dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="text-[#56615B]">السعر (ر.س)</dt>
              <dd className="font-bold text-[#14533C] tabular-nums">
                {formatCurrency(unit.price)}
              </dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="text-[#56615B]">الحالة</dt>
              <dd>{unitStatusBadge(unit.status)}</dd>
            </div>
          </dl>
        </div>

        {/* Edit Form (Admin Only) or Read-Only Message */}
        <div className="rounded-lg border border-[#E2DDD3] bg-white p-5 lg:col-span-2">
          {userRole === 'ADMIN' ? (
            <form onSubmit={handleSave} className="space-y-4" noValidate>
              <h2 className="text-base font-bold">تعديل بيانات الوحدة</h2>

              {isPriceLocked && (
                <div className="rounded border border-[#FDE68A] bg-[#FEFCE8] p-3 text-xs text-[#A16207]">
                  ⚠️ تنبيه: لا يمكن تعديل السعر لأن الوحدة محجوزة أو مباعة. يمكنك تعديل باقي البيانات.
                </div>
              )}

              <div>
                <label htmlFor="edit-project" className="mb-1 block text-xs font-medium text-[#1B2420]">
                  اسم المشروع
                </label>
                <input
                  id="edit-project"
                  type="text"
                  required
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="min-h-[42px] w-full rounded border border-[#E2DDD3] px-3 text-sm"
                />
                {fieldErrors.projectName && (
                  <p className="mt-1 text-xs text-[#B91C1C]">{fieldErrors.projectName}</p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="edit-number" className="mb-1 block text-xs font-medium text-[#1B2420]">
                    رقم الوحدة
                  </label>
                  <input
                    id="edit-number"
                    type="text"
                    required
                    value={unitNumber}
                    onChange={(e) => setUnitNumber(e.target.value)}
                    className="min-h-[42px] w-full rounded border border-[#E2DDD3] px-3 text-sm tabular-nums"
                  />
                  {fieldErrors.unitNumber && (
                    <p className="mt-1 text-xs text-[#B91C1C]">{fieldErrors.unitNumber}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="edit-type" className="mb-1 block text-xs font-medium text-[#1B2420]">
                    نوع الوحدة
                  </label>
                  <input
                    id="edit-type"
                    type="text"
                    required
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="min-h-[42px] w-full rounded border border-[#E2DDD3] px-3 text-sm"
                  />
                  {fieldErrors.type && (
                    <p className="mt-1 text-xs text-[#B91C1C]">{fieldErrors.type}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="edit-area" className="mb-1 block text-xs font-medium text-[#1B2420]">
                    المساحة (م²)
                  </label>
                  <input
                    id="edit-area"
                    type="number"
                    step="0.01"
                    required
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    className="min-h-[42px] w-full rounded border border-[#E2DDD3] px-3 text-sm tabular-nums"
                  />
                  {fieldErrors.area && (
                    <p className="mt-1 text-xs text-[#B91C1C]">{fieldErrors.area}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="edit-rooms" className="mb-1 block text-xs font-medium text-[#1B2420]">
                    عدد الغرف
                  </label>
                  <input
                    id="edit-rooms"
                    type="number"
                    required
                    value={rooms}
                    onChange={(e) => setRooms(e.target.value)}
                    className="min-h-[42px] w-full rounded border border-[#E2DDD3] px-3 text-sm tabular-nums"
                  />
                  {fieldErrors.rooms && (
                    <p className="mt-1 text-xs text-[#B91C1C]">{fieldErrors.rooms}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="edit-price" className="mb-1 block text-xs font-medium text-[#1B2420]">
                  السعر (بالريال السعودي - ر.س)
                </label>
                <input
                  id="edit-price"
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  required
                  disabled={isPriceLocked}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="min-h-[42px] w-full rounded border border-[#E2DDD3] px-3 text-sm tabular-nums disabled:bg-[#F3F4F6] disabled:text-[#9CA3AF]"
                />
                {fieldErrors.price && (
                  <p className="mt-1 text-xs text-[#B91C1C]">{fieldErrors.price}</p>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[44px] rounded bg-[#14533C] px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0F402E] disabled:opacity-60"
                >
                  {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <h2 className="text-base font-bold">صلاحية العرض</h2>
              <p className="text-sm text-[#56615B]">
                أنت مسجل كـ {userRole === 'SALES' ? 'مندوب مبيعات' : 'محاسب'}. تعديل بيانات الوحدات والأسعار متاح لمدير الشركة (ADMIN) فقط.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
