import { requireAuthenticatedUser } from '@/server/auth';
import { ContractsListWorkspace } from '@/components/contracts/ContractsListWorkspace';

export const dynamic = 'force-dynamic';

export default async function ContractsPage() {
  await requireAuthenticatedUser();
  return <ContractsListWorkspace />;
}
