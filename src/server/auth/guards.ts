import { cookies } from 'next/headers';
import { validateSession, type SessionUser, type ValidSession } from './session';

const SESSION_COOKIE_NAME = 'aqar_session';

export type TenantContext = {
  companyId: string;
  userId: string;
  userRole: 'ADMIN' | 'SALES' | 'ACCOUNTANT';
  userName: string;
};

/**
 * Retrieves the current session from the request cookies.
 * Returns null if no valid session exists.
 */
export async function getCurrentSession(): Promise<ValidSession | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!sessionCookie?.value) {
    return null;
  }

  return validateSession(sessionCookie.value);
}

/**
 * Requires an authenticated user. Throws if not authenticated.
 */
export async function requireAuthenticatedUser(): Promise<SessionUser> {
  const result = await getCurrentSession();
  if (!result) {
    throw new AuthError('غير مصرح بالوصول', 401);
  }
  return result.user;
}

/**
 * Requires a specific role. Throws if the user doesn't have the required role.
 */
export async function requireRole(...roles: Array<'ADMIN' | 'SALES' | 'ACCOUNTANT'>): Promise<SessionUser> {
  const user = await requireAuthenticatedUser();
  if (!roles.includes(user.role)) {
    throw new AuthError('ليس لديك صلاحية لتنفيذ هذا الإجراء', 403);
  }
  return user;
}

/**
 * Gets tenant context from the current session.
 * NEVER accepts companyId from the client request.
 */
export async function getTenantContext(): Promise<TenantContext> {
  const user = await requireAuthenticatedUser();
  return {
    companyId: user.companyId,
    userId: user.id,
    userRole: user.role,
    userName: user.name,
  };
}

/**
 * Custom auth error with HTTP status code.
 */
export class AuthError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number = 401) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}

/**
 * Custom domain/business logic error.
 */
export class DomainError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = 'DomainError';
    this.statusCode = statusCode;
  }
}

export { SESSION_COOKIE_NAME };
