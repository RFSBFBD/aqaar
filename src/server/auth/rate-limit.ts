import { prisma } from '@/lib/prisma';

const LOGIN_MAX_ATTEMPTS = parseInt(process.env.LOGIN_MAX_ATTEMPTS || '5', 10);
const LOGIN_WINDOW_SECONDS = parseInt(process.env.LOGIN_WINDOW_SECONDS || '900', 10);

/**
 * Records a login attempt for rate limiting.
 */
export async function recordLoginAttempt(
  email: string,
  ipAddress: string,
  success: boolean
): Promise<void> {
  await prisma.loginAttempt.create({
    data: {
      email,
      ipAddress,
      success,
    },
  });
}

/**
 * Checks if login attempts are rate-limited.
 * Returns true if the IP or email has exceeded the maximum attempts within the window.
 */
export async function isRateLimited(email: string, ipAddress: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - LOGIN_WINDOW_SECONDS * 1000);

  // Check by IP address
  const ipAttempts = await prisma.loginAttempt.count({
    where: {
      ipAddress,
      success: false,
      createdAt: { gte: windowStart },
    },
  });

  if (ipAttempts >= LOGIN_MAX_ATTEMPTS) {
    return true;
  }

  // Check by email
  const emailAttempts = await prisma.loginAttempt.count({
    where: {
      email,
      success: false,
      createdAt: { gte: windowStart },
    },
  });

  return emailAttempts >= LOGIN_MAX_ATTEMPTS;
}
