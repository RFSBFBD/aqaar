import { requirePageUser } from '@/server/auth';
import { ClientsWorkspace } from '@/components/clients/ClientsWorkspace';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
  const user = await requirePageUser();
  return <ClientsWorkspace userRole={user.role} />;
}
