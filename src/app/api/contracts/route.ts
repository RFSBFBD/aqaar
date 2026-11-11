import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/server/auth';
import { createContractDraftSchema } from '@/server/validation/contract';
import { createContractDraft, listContracts } from '@/server/services/contract.service';
import { assertCsrfSafe } from '@/server/http/csrf';
import { handleApiError } from '@/server/http/errors';

export async function GET() {
  try {
    const ctx = await getTenantContext();
    const items = await listContracts(ctx);
    return NextResponse.json({ items });
  } catch (error) {
    return handleApiError(error, 'GET /api/contracts');
  }
}

export async function POST(request: NextRequest) {
  try {
    assertCsrfSafe(request);
    const ctx = await getTenantContext();
    const body = await request.json();
    const input = createContractDraftSchema.parse(body);
    const contract = await createContractDraft(ctx, input);
    return NextResponse.json({ contract }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'POST /api/contracts');
  }
}
