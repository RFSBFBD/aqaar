import { requireAuthenticatedUser } from '@/server/auth';
import { UnitsWorkspace } from '@/components/units/UnitsWorkspace';

export const dynamic = 'force-dynamic';

export default async function UnitsPage() {
  const user = await requireAuthenticatedUser();
  return <UnitsWorkspace userRole={user.role} />;
}
