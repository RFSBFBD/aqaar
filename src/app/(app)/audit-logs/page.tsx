import { requirePageUser } from '@/server/auth';
import { listAuditLogs } from '@/server/services/audit.service';
import { formatUtcDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function AuditLogsPage() {
  const user = await requirePageUser();

  if (user.role !== 'ADMIN') {
    return (
      <div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-6 text-sm text-[#B91C1C]">
        ليس لديك صلاحية للوصول إلى سجل التدقيق. هذه الصفحة متاحة لمدير الشركة فقط.
      </div>
    );
  }

  const logs = await listAuditLogs(
    {
      companyId: user.companyId,
      userId: user.id,
      userRole: user.role,
      userName: user.name,
    },
    100
  );

  return (
    <div className="space-y-6">
      <div className="border-b border-[#E2DDD3] pb-4">
        <h1 className="text-2xl font-bold">سجل التدقيق (للقراءة فقط)</h1>
        <p className="mt-1 text-sm text-[#56615B]">
          توثيق العمليات المالية والحساسة داخل الشركة.
        </p>
      </div>

      {logs.length === 0 ? (
        <div className="rounded-lg border border-[#E2DDD3] bg-white p-8 text-center text-sm text-[#56615B]">
          لا توجد أحداث مسجلة بعد.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[#E2DDD3] bg-white">
          <table className="w-full border-collapse text-right text-sm">
            <thead className="border-b border-[#E2DDD3] bg-[#F7F5F0] text-xs font-semibold text-[#56615B]">
              <tr>
                <th className="px-4 py-3">التوقيت</th>
                <th className="px-4 py-3">المستخدم</th>
                <th className="px-4 py-3">الحدث</th>
                <th className="px-4 py-3">الكيان</th>
                <th className="px-4 py-3">التفاصيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2DDD3]">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-[#F7F5F0]/50">
                  <td className="px-4 py-3 text-xs tabular-nums" dir="ltr">
                    {formatUtcDateTime(log.createdAt)}
                  </td>
                  <td className="px-4 py-3">{log.userName}</td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold">{log.action}</td>
                  <td className="px-4 py-3 text-xs text-[#56615B]">{log.entityType}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[#56615B]" dir="ltr">
                    {log.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
