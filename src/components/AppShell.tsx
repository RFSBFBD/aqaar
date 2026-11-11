'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Building2,
  Users,
  Clock,
  FileText,
  ShieldCheck,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

export interface AppShellUser {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'SALES' | 'ACCOUNTANT';
  companyName: string;
}

const ROLE_LABELS: Record<AppShellUser['role'], string> = {
  ADMIN: 'مدير الشركة',
  SALES: 'مندوب مبيعات',
  ACCOUNTANT: 'محاسب',
};

export function AppShell({
  user,
  children,
}: {
  user: AppShellUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const navItems = [
    { href: '/units', label: 'الوحدات العقارية', icon: Building2, roles: ['ADMIN', 'SALES', 'ACCOUNTANT'] },
    { href: '/clients', label: 'العملاء', icon: Users, roles: ['ADMIN', 'SALES', 'ACCOUNTANT'] },
    { href: '/reservations', label: 'الحجوزات', icon: Clock, roles: ['ADMIN', 'SALES', 'ACCOUNTANT'] },
    { href: '/contracts', label: 'العقود والأقساط', icon: FileText, roles: ['ADMIN', 'SALES', 'ACCOUNTANT'] },
    { href: '/audit-logs', label: 'سجل التدقيق', icon: ShieldCheck, roles: ['ADMIN'] },
  ].filter((item) => item.roles.includes(user.role));

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.push('/login');
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#1B2420]">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#E2DDD3] bg-white px-4 py-3 lg:hidden">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded border border-[#E2DDD3] text-[#1B2420]"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div>
            <p className="text-sm font-bold text-[#14533C]">عقار إيليت</p>
            <p className="text-xs text-[#56615B]">{user.companyName}</p>
          </div>
        </div>
        <span className="rounded border border-[#E2DDD3] bg-[#F7F5F0] px-2.5 py-1 text-xs font-medium">
          {ROLE_LABELS[user.role]}
        </span>
      </header>

      <div className="mx-auto flex max-w-[1440px]">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 right-0 z-40 w-64 shrink-0 border-l border-[#E2DDD3] bg-white transition-transform lg:static lg:block lg:translate-x-0 ${
            mobileOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex h-full flex-col justify-between p-5">
            <div>
              <div className="mb-6 border-b border-[#E2DDD3] pb-4">
                <p className="text-lg font-bold tracking-tight text-[#14533C]">عقار إيليت</p>
                <p className="mt-1 text-xs font-medium text-[#56615B]">{user.companyName}</p>
              </div>

              <nav aria-label="التنقل الرئيسي" className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex min-h-[44px] items-center gap-3 rounded px-3 py-2.5 text-sm font-medium transition-colors ${
                        active
                          ? 'bg-[#14533C] text-white'
                          : 'text-[#1B2420] hover:bg-[#EFECE4]'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="border-t border-[#E2DDD3] pt-4">
              <div className="mb-3">
                <p className="text-sm font-semibold text-[#1B2420]">{user.name}</p>
                <p className="text-xs text-[#56615B]">{ROLE_LABELS[user.role]}</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded border border-[#E2DDD3] bg-[#F7F5F0] px-3 py-2 text-sm font-medium text-[#1B2420] hover:bg-[#EFECE4] disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span>{loggingOut ? 'جاري الخروج...' : 'تسجيل الخروج'}</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Backdrop on mobile */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/30 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Main Content */}
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
