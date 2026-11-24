import { requirePageUser } from '@/server/auth';
import { UnitDetailWorkspace } from '@/components/units/UnitDetailWorkspace';

export const dynamic = 'force-dynamic';

export default async function UnitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageUser();
  const { id } = await params;
  return <UnitDetailWorkspace unitId={id} userRole={user.role} />;
}
