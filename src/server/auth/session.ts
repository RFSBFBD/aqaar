import { prisma } from '@/lib/prisma';
import type { Session } from '@prisma/client';
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  hashSessionToken,
} from './crypto';

export { hashPassword, verifyPassword, generateSessionToken, hashSessionToken };

const SESSION_MAX_AGE = parseInt(process.env.SESSION_MAX_AGE_SECONDS || '86400', 10) * 1000;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'SALES' | 'ACCOUNTANT';
  companyId: string;
}

export interface ValidSession {
  session: Session;
  user: SessionUser;
}

/**
 * Creates a new session for a user.
 * Returns the raw token (to be set in cookie) — NOT the hash.
 */
export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE);

  await prisma.session.create({
    data: {
      tokenHash,
      userId,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

/**
 * Validates a session token and returns the session + user if valid.
 * Returns null if the session is expired or not found.
 */
export async function validateSession(token: string): Promise<ValidSession | null> {
  const tokenHash = hashSessionToken(token);

  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          companyId: true,
        },
      },
    },
  });

  if (!session) return null;

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return {
    session,
    user: session.user as SessionUser,
  };
}

/**
 * Invalidates (deletes) a session — used for logout.
 */
export async function invalidateSession(token: string): Promise<void> {
  const tokenHash = hashSessionToken(token);
  await prisma.session.deleteMany({ where: { tokenHash } });
}

/**
 * Invalidates all sessions for a user.
 */
export async function invalidateAllUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

/**
 * Cleans up expired sessions (maintenance task).
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
