import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/server/auth';
import { listAuditLogs } from '@/server/services/audit.service';
import { handleApiError } from '@/server/http/errors';

export async function GET(request: NextRequest) {
  try {
    const ctx = await getTenantContext();
    const rawLimit = Number(request.nextUrl.searchParams.get('limit') ?? '100');
    const limit = Number.isFinite(rawLimit) ? rawLimit : 100;
    const items = await listAuditLogs(ctx, limit);
    return NextResponse.json({ items });
  } catch (error) {
    return handleApiError(error, 'GET /api/audit-logs');
  }
}
