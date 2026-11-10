import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/server/auth';
import { handleApiError } from '@/server/http/errors';

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    return NextResponse.json({ user });
  } catch (error) {
    return handleApiError(error, 'GET /api/auth/me');
  }
}
