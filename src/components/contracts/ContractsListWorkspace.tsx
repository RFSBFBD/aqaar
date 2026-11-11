'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye, AlertCircle } from 'lucide-react';
import { formatMinorUnits } from '@/lib/format';
import { contractStatusBadge, unitStatusBadge } from '@/components/StatusBadge';

interface ContractSummary {
  id: string;
  unitNumber: string;
  projectName: string;
  unitStatus: 'AVAILABLE' | 'RESERVED' | 'SOLD';
  clientName: string;
  status: 'DRAFT' | 'APPROVED';
  finalPrice: string;
  downPayment: string;
  outstandingBalance: string;
  installmentCount: number;
  startDate: string;
}

export function ContractsListWorkspace() {
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/contracts')
      .then(async (res) => {
        const data = (await res.json()) as { items?: ContractSummary[]; error?: string };
        if (!active) return;
        if (!res.ok) {
          setErrorMsg(data.error ?? 'تعذر تحميل العقود');
          return;
        }
        setContracts(data.items ?? []);
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

  return (
    <div className="space-y-6">
      <div className="border-b border-[#E2DDD3] pb-4">
        <h1 className="text-2xl font-bold">العقود والأقساط</h1>
        <p className="mt-1 text-sm text-[#56615B]">
          مراجعة مسودات العقود، اعتمادها، ومتابعة جداول الأقساط والدفعات.
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
          جاري تحميل العقود...
        </div>
      ) : contracts.length === 0 ? (
        <div className="rounded-lg border border-[#E2DDD3] bg-white p-8 text-center text-sm text-[#56615B]">
          لا توجد عقود مسجلة حالياً.
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-[#E2DDD3] bg-white md:block">
            <table className="w-full border-collapse text-right text-sm">
              <thead className="border-b border-[#E2DDD3] bg-[#F7F5F0] text-xs font-semibold text-[#56615B]">
                <tr>
                  <th className="px-4 py-3">الوحدة</th>
                  <th className="px-4 py-3">العميل</th>
                  <th className="px-4 py-3">السعر النهائي</th>
                  <th className="px-4 py-3">المتبقي</th>
                  <th className="px-4 py-3">الأقساط</th>
                  <th className="px-4 py-3">حالة العقد</th>
                  <th className="px-4 py-3">حالة الوحدة</th>
                  <th className="px-4 py-3">التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2DDD3]">
                {contracts.map((c) => (
                  <tr key={c.id} className="hover:bg-[#F7F5F0]/50">
                    <td className="px-4 py-3">
                      <p className="font-semibold tabular-nums">{c.unitNumber}</p>
                      <p className="text-xs text-[#56615B]">{c.projectName}</p>
                    </td>
                    <td className="px-4 py-3">{c.clientName}</td>
                    <td className="px-4 py-3 font-medium tabular-nums">
                      {formatMinorUnits(c.finalPrice)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-[#14533C] tabular-nums">
                      {formatMinorUnits(c.outstandingBalance)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{c.installmentCount}</td>
                    <td className="px-4 py-3">{contractStatusBadge(c.status)}</td>
                    <td className="px-4 py-3">{unitStatusBadge(c.unitStatus)}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/contracts/${c.id}`}
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded border border-[#E2DDD3] px-3 py-1 text-xs font-medium hover:bg-[#EFECE4]"
                      >
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>فتح العقد</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {contracts.map((c) => (
              <div key={c.id} className="rounded-lg border border-[#E2DDD3] bg-white p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold tabular-nums">{c.unitNumber}</span>
                  {contractStatusBadge(c.status)}
                </div>
                <p className="text-sm">{c.clientName}</p>
                <p className="text-sm text-[#56615B]">
                  المتبقي: <strong className="text-[#14533C] tabular-nums">{formatMinorUnits(c.outstandingBalance)}</strong>
                </p>
                <Link
                  href={`/contracts/${c.id}`}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded border border-[#E2DDD3] text-sm font-medium"
                >
                  <Eye className="h-4 w-4" aria-hidden="true" />
                  <span>فتح العقد</span>
                </Link>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
