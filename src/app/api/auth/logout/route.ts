import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { invalidateSession, SESSION_COOKIE_NAME } from '@/server/auth';
import { assertCsrfSafe } from '@/server/http/csrf';
import { handleApiError } from '@/server/http/errors';

export async function POST(request: NextRequest) {
  try {
    assertCsrfSafe(request);
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (token) {
      await invalidateSession(token);
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (error) {
    return handleApiError(error, 'POST /api/auth/logout');
  }
}
