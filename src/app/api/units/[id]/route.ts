import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/server/auth';
import { updateUnitSchema } from '@/server/validation/unit';
import { getUnitDetail, updateUnit } from '@/server/services/unit.service';
import { assertCsrfSafe } from '@/server/http/csrf';
import { handleApiError } from '@/server/http/errors';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getTenantContext();
    const { id } = await params;
    const unit = await getUnitDetail(ctx, id);
    return NextResponse.json({ unit });
  } catch (error) {
    return handleApiError(error, 'GET /api/units/[id]');
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
    const input = updateUnitSchema.parse(body);
    const unit = await updateUnit(ctx, id, input);
    return NextResponse.json({ unit });
  } catch (error) {
    return handleApiError(error, 'PATCH /api/units/[id]');
  }
}
