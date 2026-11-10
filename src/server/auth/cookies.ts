export function getSessionCookieOptions(expiresAt: Date) {
  const isProd = process.env.NODE_ENV === 'production';
  const secure =
    process.env.COOKIE_SECURE === 'false'
      ? false
      : process.env.COOKIE_SECURE === 'true'
        ? true
        : isProd;

  return {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
    expires: expiresAt,
  };
}
