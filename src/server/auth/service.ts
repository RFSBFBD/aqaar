import { prisma } from '@/lib/prisma';
import { AuthError } from './guards';
import { createSession, verifyPassword, type SessionUser } from './session';
import { isRateLimited, recordLoginAttempt } from './rate-limit';
import { recordAuditLog } from '@/server/services/audit.service';

// Precomputed bcrypt hash used when email does not exist to prevent timing side-channel
const DUMMY_PASSWORD_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEeO7eW4P9n9o6z8H5B5q6Q5xK8V9uY0W2m';

const GENERIC_LOGIN_ERROR = 'البريد الإلكتروني أو كلمة المرور غير صحيحة';

export interface LoginResult {
  token: string;
  expiresAt: Date;
  user: SessionUser;
}

/**
 * Authenticates a user by email and password, enforcing rate limits and
 * writing an audit log entry on success.
 */
export async function loginWithCredentials(
  email: string,
  password: string,
  ipAddress: string
): Promise<LoginResult> {
  const normalizedEmail = email.trim().toLowerCase();

  const limited = await isRateLimited(normalizedEmail, ipAddress);
  if (limited) {
    throw new AuthError('تم تجاوز عدد محاولات تسجيل الدخول المسموح بها، يرجى المحاولة لاحقاً', 429);
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      companyId: true,
      passwordHash: true,
    },
  });

  const passwordValid = await verifyPassword(
    password,
    user ? user.passwordHash : DUMMY_PASSWORD_HASH
  );

  if (!user || !passwordValid) {
    await recordLoginAttempt(normalizedEmail, ipAddress, false);
    throw new AuthError(GENERIC_LOGIN_ERROR, 401);
  }

  await recordLoginAttempt(normalizedEmail, ipAddress, true);
  const { token, expiresAt } = await createSession(user.id);

  await recordAuditLog({
    companyId: user.companyId,
    userId: user.id,
    action: 'LOGIN',
    entityType: 'Session',
    entityId: user.id,
    details: { role: user.role },
  });

  return {
    token,
    expiresAt,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
    },
  };
}
