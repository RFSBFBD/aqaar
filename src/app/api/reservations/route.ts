import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/server/auth';
import { AuthError } from '@/server/auth/guards';
import { createReservationSchema } from '@/server/validation/reservation';
import { createReservation, listReservations } from '@/server/services/reservation.service';
import { assertCsrfSafe } from '@/server/http/csrf';
import { handleApiError } from '@/server/http/errors';

export async function GET() {
  try {
    const ctx = await getTenantContext();
    const items = await listReservations(ctx);
    return NextResponse.json({ items });
  } catch (error) {
    return handleApiError(error, 'GET /api/reservations');
  }
}

export async function POST(request: NextRequest) {
  try {
    assertCsrfSafe(request);
    const ctx = await getTenantContext();
    if (ctx.userRole !== 'SALES') {
      throw new AuthError('إنشاء الحجز متاح لمندوب المبيعات فقط', 403);
    }
    const body = await request.json();
    const input = createReservationSchema.parse(body);
    const reservation = await createReservation(ctx, input);
    return NextResponse.json({ reservation }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'POST /api/reservations');
  }
}
