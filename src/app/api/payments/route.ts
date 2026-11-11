import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/server/auth';
import { createPaymentSchema } from '@/server/validation/payment';
import { recordPayment } from '@/server/services/payment.service';
import { assertCsrfSafe } from '@/server/http/csrf';
import { handleApiError } from '@/server/http/errors';

export async function POST(request: NextRequest) {
  try {
    assertCsrfSafe(request);
    const ctx = await getTenantContext();
    const body = await request.json();
    const input = createPaymentSchema.parse(body);
    const payment = await recordPayment(ctx, input);
    return NextResponse.json({ payment }, { status: payment.replayed ? 200 : 201 });
  } catch (error) {
    return handleApiError(error, 'POST /api/payments');
  }
}
