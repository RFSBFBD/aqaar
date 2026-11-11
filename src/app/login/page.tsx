'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Lock, Mail, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const nextErrors: { email?: string; password?: string } = {};
    if (!email.trim() || !email.includes('@')) {
      nextErrors.email = 'يرجى إدخال بريد إلكتروني صحيح';
    }
    if (!password) {
      nextErrors.password = 'يرجى إدخال كلمة المرور';
    }
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = (await res.json()) as {
        error?: string;
        fieldErrors?: Record<string, string>;
      };

      if (!res.ok) {
        if (data.fieldErrors) {
          setFieldErrors(data.fieldErrors);
        }
        setErrorMsg(data.error ?? 'تعذر تسجيل الدخول');
        return;
      }

      router.push('/units');
      router.refresh();
    } catch {
      setErrorMsg('حدث خطأ في الاتصال بالخادم، يرجى المحاولة مرة أخرى');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-[#F7F5F0] px-4 py-10">
      <div className="mx-auto w-full max-w-md border border-[#E2DDD3] bg-white p-6 sm:p-8 rounded-lg">
        <div className="mb-6 border-b border-[#E2DDD3] pb-5">
          <div className="flex items-center gap-2.5 text-[#14533C]">
            <Building2 className="h-6 w-6" aria-hidden="true" />
            <h1 className="text-xl font-bold">عقار إيليت</h1>
          </div>
          <p className="mt-2 text-sm text-[#56615B]">
            تسجيل الدخول إلى نظام إدارة المبيعات العقارية والأقساط
          </p>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-2 rounded border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B91C1C]"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-[#1B2420]">
              البريد الإلكتروني
            </label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-[#56615B]"
                aria-hidden="true"
              />
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.local"
                className="min-h-[44px] w-full rounded border border-[#E2DDD3] bg-white py-2 pl-3 pr-10 text-sm text-[#1B2420] placeholder:text-[#56615B]/60"
                disabled={submitting}
              />
            </div>
            {fieldErrors.email && (
              <p className="mt-1 text-xs text-[#B91C1C]">{fieldErrors.email}</p>
            )}
          </div>

          <div>
            <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-[#1B2420]">
              كلمة المرور
            </label>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-[#56615B]"
                aria-hidden="true"
              />
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="min-h-[44px] w-full rounded border border-[#E2DDD3] bg-white py-2 pl-3 pr-10 text-sm text-[#1B2420]"
                disabled={submitting}
              />
            </div>
            {fieldErrors.password && (
              <p className="mt-1 text-xs text-[#B91C1C]">{fieldErrors.password}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="min-h-[44px] w-full rounded bg-[#14533C] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0F402E] disabled:opacity-60"
          >
            {submitting ? 'جاري التحقق...' : 'تسجيل الدخول'}
          </button>
        </form>
      </div>
    </div>
  );
}
