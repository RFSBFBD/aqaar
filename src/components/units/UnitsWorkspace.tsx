'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Plus, Pencil, Clock, Filter, AlertCircle, CheckCircle2, ChevronRight, ChevronLeft } from 'lucide-react';
import { formatMinorUnits, majorInputToMinorString, minorStringToMajorInput } from '@/lib/format';
import { unitStatusBadge } from '@/components/StatusBadge';

interface UnitItem {
  id: string;
  projectName: string;
  unitNumber: string;
  type: string;
  area: number;
  rooms: number;
  price: string;
  status: 'AVAILABLE' | 'RESERVED' | 'SOLD';
}

interface ClientOption {
  id: string;
  name: string;
  phone: string;
}

export function UnitsWorkspace({ userRole }: { userRole: 'ADMIN' | 'SALES' | 'ACCOUNTANT' }) {
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [status, setStatus] = useState<string>('');
  const [minPriceInput, setMinPriceInput] = useState('');
  const [maxPriceInput, setMaxPriceInput] = useState('');
  const [sortBy, setSortBy] = useState<'price' | 'area'>('price');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Admin add/edit unit modal
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<UnitItem | null>(null);
  const [formProject, setFormProject] = useState('');
  const [formNumber, setFormNumber] = useState('');
  const [formType, setFormType] = useState('');
  const [formArea, setFormArea] = useState('');
  const [formRooms, setFormRooms] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formFieldErrors, setFormFieldErrors] = useState<Record<string, string>>({});
  const [savingUnit, setSavingUnit] = useState(false);

  // Sales reserve modal
  const [reservingUnit, setReservingUnit] = useState<UnitItem | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [reserveError, setReserveError] = useState<string | null>(null);
  const [reserving, setReserving] = useState(false);

  const loadUnits = useCallback(async (targetPage: number) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(targetPage));
      params.set('pageSize', '10');
      params.set('sortBy', sortBy);
      params.set('sortDir', sortDir);
      if (status) params.set('status', status);

      if (minPriceInput.trim()) {
        params.set('minPrice', majorInputToMinorString(minPriceInput));
      }
      if (maxPriceInput.trim()) {
        params.set('maxPrice', majorInputToMinorString(maxPriceInput));
      }

      const res = await fetch(`/api/units?${params.toString()}`);
      const data = (await res.json()) as {
        items?: UnitItem[];
        total?: number;
        totalPages?: number;
        error?: string;
      };
      if (!res.ok) {
        setErrorMsg(data.error ?? 'تعذر تحميل الوحدات');
        return;
      }
      setUnits(data.items ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر تحميل الوحدات');
    } finally {
      setLoading(false);
    }
  }, [status, minPriceInput, maxPriceInput, sortBy, sortDir]);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', '10');
    params.set('sortBy', sortBy);
    params.set('sortDir', sortDir);
    if (status) params.set('status', status);

    try {
      if (minPriceInput.trim()) {
        params.set('minPrice', majorInputToMinorString(minPriceInput));
      }
      if (maxPriceInput.trim()) {
        params.set('maxPrice', majorInputToMinorString(maxPriceInput));
      }
    } catch (err) {
      Promise.resolve().then(() => {
        if (active) {
          setErrorMsg(err instanceof Error ? err.message : 'صيغة السعر غير صالحة');
          setLoading(false);
        }
      });
      return () => {
        active = false;
      };
    }

    fetch(`/api/units?${params.toString()}`)
      .then(async (res) => {
        const data = (await res.json()) as {
          items?: UnitItem[];
          total?: number;
          totalPages?: number;
          error?: string;
        };
        if (!active) return;
        if (!res.ok) {
          setErrorMsg(data.error ?? 'تعذر تحميل الوحدات');
          return;
        }
        setUnits(data.items ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
      })
      .catch(() => {
        if (active) setErrorMsg('تعذر تحميل الوحدات');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page, status, minPriceInput, maxPriceInput, sortBy, sortDir]);

  function openCreateUnit() {
    setEditingUnit(null);
    setFormProject('');
    setFormNumber('');
    setFormType('');
    setFormArea('');
    setFormRooms('');
    setFormPrice('');
    setFormError(null);
    setFormFieldErrors({});
    setUnitModalOpen(true);
  }

  function openEditUnit(unit: UnitItem) {
    setEditingUnit(unit);
    setFormProject(unit.projectName);
    setFormNumber(unit.unitNumber);
    setFormType(unit.type);
    setFormArea(String(unit.area));
    setFormRooms(String(unit.rooms));
    setFormPrice(minorStringToMajorInput(unit.price));
    setFormError(null);
    setFormFieldErrors({});
    setUnitModalOpen(true);
  }

  async function handleSaveUnit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormFieldErrors({});

    let priceMinor: string;
    try {
      priceMinor = majorInputToMinorString(formPrice);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'السعر غير صالح';
      setFormError(msg);
      setFormFieldErrors({ price: msg });
      return;
    }

    setSavingUnit(true);
    try {
      const payload: Record<string, unknown> = {
        projectName: formProject.trim(),
        unitNumber: formNumber.trim(),
        type: formType.trim(),
        area: Number(formArea),
        rooms: Number(formRooms),
      };
      // Only include price when creating or when unit is AVAILABLE
      if (!editingUnit || editingUnit.status === 'AVAILABLE') {
        payload.price = priceMinor;
      }

      const url = editingUnit ? `/api/units/${editingUnit.id}` : '/api/units';
      const method = editingUnit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        error?: string;
        fieldErrors?: Record<string, string>;
      };
      if (!res.ok) {
        if (data.fieldErrors) {
          setFormFieldErrors(data.fieldErrors);
        }
        setFormError(data.error ?? 'تعذر حفظ الوحدة');
        return;
      }

      setUnitModalOpen(false);
      setSuccessMsg(editingUnit ? 'تم تحديث بيانات الوحدة بنجاح' : 'تمت إضافة الوحدة بنجاح');
      await loadUnits(page);
    } catch {
      setFormError('خطأ في الاتصال بالخادم');
    } finally {
      setSavingUnit(false);
    }
  }

  async function openReserveModal(unit: UnitItem) {
    setReservingUnit(unit);
    setReserveError(null);
    setSelectedClientId('');
    try {
      const res = await fetch('/api/clients');
      const data = (await res.json()) as { items?: ClientOption[]; error?: string };
      if (!res.ok) {
        setReserveError(data.error ?? 'تعذر تحميل قائمة العملاء');
        return;
      }
      const list = data.items ?? [];
      setClients(list);
      if (list.length > 0) {
        setSelectedClientId(list[0]!.id);
      }
    } catch {
      setReserveError('تعذر تحميل العملاء');
    }
  }

  async function handleConfirmReserve(e: FormEvent) {
    e.preventDefault();
    if (!reservingUnit || !selectedClientId) return;
    setReserveError(null);
    setReserving(true);

    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId: reservingUnit.id,
          clientId: selectedClientId,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setReserveError(data.error ?? 'تعذر حجز الوحدة');
        return;
      }
      setReservingUnit(null);
      setSuccessMsg(`تم حجز الوحدة ${reservingUnit.unitNumber} لمدة 72 ساعة بنجاح`);
      await loadUnits(page);
    } catch {
      setReserveError('تعذر الاتصال بالخادم');
    } finally {
      setReserving(false);
    }
  }

  function handleFilterSubmit(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    void loadUnits(1);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E2DDD3] pb-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B2420]">الوحدات العقارية</h1>
          <p className="mt-1 text-sm text-[#56615B]">
            إجمالي السجلات المطابقة: <span className="font-semibold tabular-nums">{total}</span>
          </p>
        </div>

        {userRole === 'ADMIN' && (
          <button
            type="button"
            onClick={openCreateUnit}
            className="inline-flex min-h-[44px] items-center gap-2 rounded bg-[#14533C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0F402E]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>إضافة وحدة</span>
          </button>
        )}
      </div>

      {successMsg && (
        <div
          role="status"
          className="flex items-center justify-between gap-2 rounded border border-[#BBF7D0] bg-[#ECFDF5] p-3 text-sm text-[#15803D]"
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
          className="flex items-center gap-2 rounded border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B91C1C]"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Server-side filter & sort bar */}
      <form
        onSubmit={handleFilterSubmit}
        className="grid grid-cols-1 gap-3 rounded-lg border border-[#E2DDD3] bg-white p-4 sm:grid-cols-2 lg:grid-cols-6"
      >
        <div>
          <label htmlFor="filter-status" className="mb-1 block text-xs font-medium text-[#56615B]">
            الحالة
          </label>
          <select
            id="filter-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="min-h-[40px] w-full rounded border border-[#E2DDD3] bg-white px-2.5 text-sm"
          >
            <option value="">الكل</option>
            <option value="AVAILABLE">متاحة</option>
            <option value="RESERVED">محجوزة</option>
            <option value="SOLD">مباعة</option>
          </select>
        </div>

        <div>
          <label htmlFor="filter-min-price" className="mb-1 block text-xs font-medium text-[#56615B]">
            أقل سعر
          </label>
          <input
            id="filter-min-price"
            type="text"
            inputMode="decimal"
            dir="ltr"
            value={minPriceInput}
            onChange={(e) => setMinPriceInput(e.target.value)}
            placeholder="0"
            className="min-h-[40px] w-full rounded border border-[#E2DDD3] px-2.5 text-sm tabular-nums"
          />
        </div>

        <div>
          <label htmlFor="filter-max-price" className="mb-1 block text-xs font-medium text-[#56615B]">
            أعلى سعر
          </label>
          <input
            id="filter-max-price"
            type="text"
            inputMode="decimal"
            dir="ltr"
            value={maxPriceInput}
            onChange={(e) => setMaxPriceInput(e.target.value)}
            placeholder="5000000"
            className="min-h-[40px] w-full rounded border border-[#E2DDD3] px-2.5 text-sm tabular-nums"
          />
        </div>

        <div>
          <label htmlFor="sort-by" className="mb-1 block text-xs font-medium text-[#56615B]">
            الترتيب حسب
          </label>
          <select
            id="sort-by"
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value as 'price' | 'area');
              setPage(1);
            }}
            className="min-h-[40px] w-full rounded border border-[#E2DDD3] bg-white px-2.5 text-sm"
          >
            <option value="price">السعر</option>
            <option value="area">المساحة</option>
          </select>
        </div>

        <div>
          <label htmlFor="sort-dir" className="mb-1 block text-xs font-medium text-[#56615B]">
            الاتجاه
          </label>
          <select
            id="sort-dir"
            value={sortDir}
            onChange={(e) => {
              setSortDir(e.target.value as 'asc' | 'desc');
              setPage(1);
            }}
            className="min-h-[40px] w-full rounded border border-[#E2DDD3] bg-white px-2.5 text-sm"
          >
            <option value="asc">تصاعدي</option>
            <option value="desc">تنازلي</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            className="inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded border border-[#14533C] bg-white px-3 text-sm font-semibold text-[#14533C] hover:bg-[#ECFDF5]"
          >
            <Filter className="h-4 w-4" aria-hidden="true" />
            <span>تطبيق</span>
          </button>
        </div>
      </form>

      {/* Content */}
      {loading ? (
        <div className="rounded-lg border border-[#E2DDD3] bg-white p-8 text-center text-sm text-[#56615B]">
          جاري تحميل الوحدات...
        </div>
      ) : units.length === 0 ? (
        <div className="rounded-lg border border-[#E2DDD3] bg-white p-8 text-center text-sm text-[#56615B]">
          لا توجد وحدات مطابقة لمعايير البحث الحالية.
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-lg border border-[#E2DDD3] bg-white md:block">
            <table className="w-full border-collapse text-right text-sm">
              <thead className="border-b border-[#E2DDD3] bg-[#F7F5F0] text-xs font-semibold text-[#56615B]">
                <tr>
                  <th className="px-4 py-3">رقم الوحدة</th>
                  <th className="px-4 py-3">المشروع</th>
                  <th className="px-4 py-3">النوع</th>
                  <th className="px-4 py-3">المساحة (م²)</th>
                  <th className="px-4 py-3">الغرف</th>
                  <th className="px-4 py-3">السعر</th>
                  <th className="px-4 py-3">الحالة</th>
                  <th className="px-4 py-3">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2DDD3]">
                {units.map((u) => (
                  <tr key={u.id} className="hover:bg-[#F7F5F0]/50">
                    <td className="px-4 py-3 font-semibold tabular-nums">{u.unitNumber}</td>
                    <td className="px-4 py-3">{u.projectName}</td>
                    <td className="px-4 py-3 text-[#56615B]">{u.type}</td>
                    <td className="px-4 py-3 tabular-nums">{u.area}</td>
                    <td className="px-4 py-3 tabular-nums">{u.rooms}</td>
                    <td className="px-4 py-3 font-semibold tabular-nums">
                      {formatMinorUnits(u.price)}
                    </td>
                    <td className="px-4 py-3">{unitStatusBadge(u.status)}</td>
                    <td className="px-4 py-3">
                      {userRole === 'ADMIN' && (
                        <button
                          type="button"
                          onClick={() => openEditUnit(u)}
                          className="inline-flex min-h-[36px] items-center gap-1 rounded border border-[#E2DDD3] px-2.5 py-1 text-xs font-medium hover:bg-[#EFECE4]"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>تعديل</span>
                        </button>
                      )}
                      {userRole === 'SALES' && u.status === 'AVAILABLE' && (
                        <button
                          type="button"
                          onClick={() => openReserveModal(u)}
                          className="inline-flex min-h-[36px] items-center gap-1 rounded bg-[#14533C] px-3 py-1 text-xs font-semibold text-white hover:bg-[#0F402E]"
                        >
                          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>حجز الوحدة (72 ساعة)</span>
                        </button>
                      )}
                      {userRole === 'ACCOUNTANT' && (
                        <span className="text-xs text-[#56615B]">عرض فقط</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile responsive list */}
          <div className="space-y-3 md:hidden">
            {units.map((u) => (
              <div
                key={u.id}
                className="rounded-lg border border-[#E2DDD3] bg-white p-4 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold tabular-nums">{u.unitNumber}</span>
                  {unitStatusBadge(u.status)}
                </div>
                <p className="text-sm font-medium">{u.projectName}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#56615B]">
                  <span>{u.type}</span>
                  <span className="tabular-nums">{u.area} م²</span>
                  <span className="tabular-nums">{u.rooms} غرف</span>
                </div>
                <p className="text-base font-bold text-[#14533C] tabular-nums">
                  {formatMinorUnits(u.price)}
                </p>
                <div className="pt-2">
                  {userRole === 'ADMIN' && (
                    <button
                      type="button"
                      onClick={() => openEditUnit(u)}
                      className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded border border-[#E2DDD3] text-sm font-medium"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      <span>تعديل الوحدة</span>
                    </button>
                  )}
                  {userRole === 'SALES' && u.status === 'AVAILABLE' && (
                    <button
                      type="button"
                      onClick={() => openReserveModal(u)}
                      className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded bg-[#14533C] text-sm font-semibold text-white"
                    >
                      <Clock className="h-4 w-4" aria-hidden="true" />
                      <span>حجز الوحدة (72 ساعة)</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-[#E2DDD3] pt-4 text-sm">
            <span className="text-[#56615B] tabular-nums">
              صفحة {page} من {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex min-h-[40px] items-center gap-1 rounded border border-[#E2DDD3] bg-white px-3 text-sm disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
                <span>السابق</span>
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex min-h-[40px] items-center gap-1 rounded border border-[#E2DDD3] bg-white px-3 text-sm disabled:opacity-40"
              >
                <span>التالي</span>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Admin Add/Edit Unit Modal */}
      {unitModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="unit-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-lg rounded-lg border border-[#E2DDD3] bg-white p-6">
            <h2 id="unit-modal-title" className="text-lg font-bold">
              {editingUnit ? `تعديل الوحدة ${editingUnit.unitNumber}` : 'إضافة وحدة جديدة'}
            </h2>

            {formError && (
              <div className="mt-3 rounded border border-[#FECACA] bg-[#FEF2F2] p-2.5 text-sm text-[#B91C1C]">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveUnit} className="mt-4 space-y-3">
              <div>
                <label htmlFor="u-project" className="mb-1 block text-xs font-medium">
                  اسم المشروع
                </label>
                <input
                  id="u-project"
                  required
                  value={formProject}
                  onChange={(e) => setFormProject(e.target.value)}
                  className="min-h-[42px] w-full rounded border border-[#E2DDD3] px-3 text-sm"
                />
                {formFieldErrors.projectName && (
                  <p className="mt-1 text-xs text-[#B91C1C]">{formFieldErrors.projectName}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="u-number" className="mb-1 block text-xs font-medium">
                    رقم الوحدة
                  </label>
                  <input
                    id="u-number"
                    required
                    value={formNumber}
                    onChange={(e) => setFormNumber(e.target.value)}
                    className="min-h-[42px] w-full rounded border border-[#E2DDD3] px-3 text-sm tabular-nums"
                  />
                  {formFieldErrors.unitNumber && (
                    <p className="mt-1 text-xs text-[#B91C1C]">{formFieldErrors.unitNumber}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="u-type" className="mb-1 block text-xs font-medium">
                    النوع
                  </label>
                  <input
                    id="u-type"
                    required
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    placeholder="شقة / فيلا / دوبلكس"
                    className="min-h-[42px] w-full rounded border border-[#E2DDD3] px-3 text-sm"
                  />
                  {formFieldErrors.type && (
                    <p className="mt-1 text-xs text-[#B91C1C]">{formFieldErrors.type}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="u-area" className="mb-1 block text-xs font-medium">
                    المساحة (م²)
                  </label>
                  <input
                    id="u-area"
                    type="number"
                    step="0.1"
                    required
                    dir="ltr"
                    value={formArea}
                    onChange={(e) => setFormArea(e.target.value)}
                    className="min-h-[42px] w-full rounded border border-[#E2DDD3] px-3 text-sm tabular-nums"
                  />
                  {formFieldErrors.area && (
                    <p className="mt-1 text-xs text-[#B91C1C]">{formFieldErrors.area}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="u-rooms" className="mb-1 block text-xs font-medium">
                    عدد الغرف
                  </label>
                  <input
                    id="u-rooms"
                    type="number"
                    min="1"
                    required
                    dir="ltr"
                    value={formRooms}
                    onChange={(e) => setFormRooms(e.target.value)}
                    className="min-h-[42px] w-full rounded border border-[#E2DDD3] px-3 text-sm tabular-nums"
                  />
                  {formFieldErrors.rooms && (
                    <p className="mt-1 text-xs text-[#B91C1C]">{formFieldErrors.rooms}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="u-price" className="mb-1 block text-xs font-medium">
                  السعر (بالوحدة الأساسية)
                </label>
                <input
                  id="u-price"
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  required
                  disabled={Boolean(editingUnit && editingUnit.status !== 'AVAILABLE')}
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  className="min-h-[42px] w-full rounded border border-[#E2DDD3] px-3 text-sm tabular-nums disabled:bg-[#F3F4F6]"
                />
                {formFieldErrors.price && (
                  <p className="mt-1 text-xs text-[#B91C1C]">{formFieldErrors.price}</p>
                )}
                {editingUnit && editingUnit.status !== 'AVAILABLE' && (
                  <p className="mt-1 text-xs text-[#A16207]">
                    لا يمكن تعديل السعر لأن الوحدة محجوزة أو مباعة.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setUnitModalOpen(false)}
                  className="min-h-[42px] rounded border border-[#E2DDD3] px-4 text-sm"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingUnit}
                  className="min-h-[42px] rounded bg-[#14533C] px-4 text-sm font-semibold text-white hover:bg-[#0F402E] disabled:opacity-60"
                >
                  {savingUnit ? 'جاري الحفظ...' : 'حفظ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sales Reserve Modal */}
      {reservingUnit && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reserve-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-[#E2DDD3] bg-white p-6">
            <h2 id="reserve-modal-title" className="text-lg font-bold">
              حجز الوحدة {reservingUnit.unitNumber}
            </h2>
            <p className="mt-1 text-sm text-[#56615B]">
              سيتم حجز الوحدة لمدة 72 ساعة للعميل المختار. إذا لم يتم إنشاء واعتماد العقد خلال هذه المدة تعود الوحدة متاحة تلقائياً.
            </p>

            {reserveError && (
              <div className="mt-3 rounded border border-[#FECACA] bg-[#FEF2F2] p-2.5 text-sm text-[#B91C1C]">
                {reserveError}
              </div>
            )}

            <form onSubmit={handleConfirmReserve} className="mt-4 space-y-4">
              <div>
                <label htmlFor="reserve-client" className="mb-1 block text-xs font-medium">
                  اختر العميل (من عملائك فقط)
                </label>
                {clients.length === 0 ? (
                  <p className="rounded border border-[#FDE68A] bg-[#FEFCE8] p-2.5 text-xs text-[#A16207]">
                    لا يوجد لديك عملاء مسجلون بعد. يرجى إضافة عميل أولاً من صفحة العملاء.
                  </p>
                ) : (
                  <select
                    id="reserve-client"
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="min-h-[42px] w-full rounded border border-[#E2DDD3] bg-white px-3 text-sm"
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — {c.phone}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReservingUnit(null)}
                  className="min-h-[42px] rounded border border-[#E2DDD3] px-4 text-sm"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={reserving || clients.length === 0}
                  className="min-h-[42px] rounded bg-[#14533C] px-4 text-sm font-semibold text-white hover:bg-[#0F402E] disabled:opacity-50"
                >
                  {reserving ? 'جاري الحجز...' : 'تأكيد الحجز لمدة 72 ساعة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
