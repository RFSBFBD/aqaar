import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/server/auth';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const session = await getCurrentSession();
  if (!session) {
    redirect('/login');
  }
  redirect('/units');
}
