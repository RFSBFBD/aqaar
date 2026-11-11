import { requirePageUser } from '@/server/auth';
import { UnitsWorkspace } from '@/components/units/UnitsWorkspace';

export const dynamic = 'force-dynamic';

export default async function UnitsPage() {
  const user = await requirePageUser();
  return <UnitsWorkspace userRole={user.role} />;
}
