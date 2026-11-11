import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentSession } from '@/server/auth';
import { AppShell } from '@/components/AppShell';

export const dynamic = 'force-dynamic';

export default async function AuthenticatedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSession();
  if (!session) {
    redirect('/login');
  }

  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { name: true },
  });

  return (
    <AppShell
      user={{
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role,
        companyName: company?.name ?? 'الشركة',
      }}
    >
      {children}
    </AppShell>
  );
}
