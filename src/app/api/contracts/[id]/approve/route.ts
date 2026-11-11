import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/server/auth';
import { approveContract } from '@/server/services/contract.service';
import { assertCsrfSafe } from '@/server/http/csrf';
import { handleApiError } from '@/server/http/errors';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    assertCsrfSafe(request);
    const ctx = await getTenantContext();
    const { id } = await params;
    const contract = await approveContract(ctx, id);
    return NextResponse.json({ contract });
  } catch (error) {
    return handleApiError(error, 'POST /api/contracts/[id]/approve');
  }
}
