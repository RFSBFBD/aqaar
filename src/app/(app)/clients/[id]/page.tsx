import { requirePageUser } from '@/server/auth';
import { ClientDetailWorkspace } from '@/components/clients/ClientDetailWorkspace';

export const dynamic = 'force-dynamic';

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageUser();
  const { id } = await params;
  return <ClientDetailWorkspace clientId={id} userRole={user.role} />;
}
