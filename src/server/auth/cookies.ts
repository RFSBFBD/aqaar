export function isSecureCookie(): boolean {
  if (process.env.COOKIE_SECURE === 'false') return false;
  if (process.env.COOKIE_SECURE === 'true') return true;
  return process.env.NODE_ENV === 'production';
}

export function getSessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: 'lax' as const,
    path: '/',
    expires: expiresAt,
  };
}
