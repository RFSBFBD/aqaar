import { requirePageUser } from '@/server/auth';
import { ContractDetailWorkspace } from '@/components/contracts/ContractDetailWorkspace';

export const dynamic = 'force-dynamic';

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageUser();
  const { id } = await params;
  return <ContractDetailWorkspace contractId={id} userRole={user.role} />;
}
