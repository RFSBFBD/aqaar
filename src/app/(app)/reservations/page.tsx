import { requirePageUser } from '@/server/auth';
import { ReservationsWorkspace } from '@/components/reservations/ReservationsWorkspace';

export const dynamic = 'force-dynamic';

export default async function ReservationsPage() {
  const user = await requirePageUser();
  return <ReservationsWorkspace userRole={user.role} />;
}
