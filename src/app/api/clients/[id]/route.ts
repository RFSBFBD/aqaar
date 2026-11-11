import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/server/auth';
import { updateClientSchema } from '@/server/validation/client';
import { getClientDetail, updateClient } from '@/server/services/client.service';
import { assertCsrfSafe } from '@/server/http/csrf';
import { handleApiError } from '@/server/http/errors';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getTenantContext();
    const { id } = await params;
    const client = await getClientDetail(ctx, id);
    return NextResponse.json({ client });
  } catch (error) {
    return handleApiError(error, 'GET /api/clients/[id]');
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    assertCsrfSafe(request);
    const ctx = await getTenantContext();
    const { id } = await params;
    const body = await request.json();
    const input = updateClientSchema.parse(body);
    const client = await updateClient(ctx, id, input);
    return NextResponse.json({ client });
  } catch (error) {
    return handleApiError(error, 'PATCH /api/clients/[id]');
  }
}
