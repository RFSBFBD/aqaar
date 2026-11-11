import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/server/auth';
import { updateContractDraftSchema } from '@/server/validation/contract';
import { getContractDetail, updateContractDraft } from '@/server/services/contract.service';
import { assertCsrfSafe } from '@/server/http/csrf';
import { handleApiError } from '@/server/http/errors';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getTenantContext();
    const { id } = await params;
    const contract = await getContractDetail(ctx, id);
    return NextResponse.json({ contract });
  } catch (error) {
    return handleApiError(error, 'GET /api/contracts/[id]');
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
    const input = updateContractDraftSchema.parse(body);
    const contract = await updateContractDraft(ctx, id, input);
    return NextResponse.json({ contract });
  } catch (error) {
    return handleApiError(error, 'PATCH /api/contracts/[id]');
  }
}
