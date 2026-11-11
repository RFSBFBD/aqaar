import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/server/auth';
import { AuthError } from '@/server/auth/guards';
import { createClientSchema } from '@/server/validation/client';
import { createClient, listClients } from '@/server/services/client.service';
import { assertCsrfSafe } from '@/server/http/csrf';
import { handleApiError } from '@/server/http/errors';

export async function GET() {
  try {
    const ctx = await getTenantContext();
    const items = await listClients(ctx);
    return NextResponse.json({ items });
  } catch (error) {
    return handleApiError(error, 'GET /api/clients');
  }
}

export async function POST(request: NextRequest) {
  try {
    assertCsrfSafe(request);
    const ctx = await getTenantContext();
    if (ctx.userRole !== 'SALES') {
      throw new AuthError('إضافة العملاء متاحة لمندوب المبيعات فقط', 403);
    }
    const body = await request.json();
    const input = createClientSchema.parse(body);
    const client = await createClient(ctx, input);
    return NextResponse.json({ client }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'POST /api/clients');
  }
}
