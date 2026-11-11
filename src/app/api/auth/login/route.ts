import { NextRequest, NextResponse } from 'next/server';
import { loginSchema } from '@/server/validation/auth';
import { loginWithCredentials } from '@/server/auth/service';
import { getSessionCookieOptions } from '@/server/auth/cookies';
import { SESSION_COOKIE_NAME } from '@/server/auth/guards';
import { assertCsrfSafe } from '@/server/http/csrf';
import { getClientIp } from '@/server/http/client-ip';
import { handleApiError } from '@/server/http/errors';

export async function POST(request: NextRequest) {
  try {
    assertCsrfSafe(request);
    const body = await request.json();
    const parsed = loginSchema.parse(body);

    const ipAddress = getClientIp(request);
    const result = await loginWithCredentials(parsed.email, parsed.password, ipAddress);

    const response = NextResponse.json({
      user: result.user,
    });

    response.cookies.set(
      SESSION_COOKIE_NAME,
      result.token,
      getSessionCookieOptions(result.expiresAt)
    );

    return response;
  } catch (error) {
    return handleApiError(error, 'POST /api/auth/login');
  }
}
