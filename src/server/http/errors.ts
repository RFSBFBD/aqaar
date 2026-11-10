import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AuthError, DomainError } from '@/server/auth/guards';

/**
 * Maps known errors to safe, generic HTTP JSON responses.
 * Never exposes stack traces, SQL queries, or internal details to clients.
 */
export function handleApiError(error: unknown, context: string): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode }
    );
  }

  if (error instanceof DomainError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode }
    );
  }

  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const path = issue.path.join('.') || 'form';
      if (!fieldErrors[path]) {
        fieldErrors[path] = issue.message;
      }
    }
    return NextResponse.json(
      { error: 'بيانات الإدخال غير صالحة', fieldErrors },
      { status: 400 }
    );
  }

  // Handle Prisma unique constraint violation without leaking schema details
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  ) {
    return NextResponse.json(
      { error: 'تعارض في البيانات: السجل موجود مسبقاً' },
      { status: 409 }
    );
  }

  // Log unexpected errors server-side without sensitive payloads
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`[API Error][${context}]:`, message);

  return NextResponse.json(
    { error: 'حدث خطأ غير متوقع في الخادم' },
    { status: 500 }
  );
}
