import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/server/auth';
import { AuthError } from '@/server/auth/guards';
import { createUnitSchema, unitQuerySchema } from '@/server/validation/unit';
import { createUnit, listUnits } from '@/server/services/unit.service';
import { assertCsrfSafe } from '@/server/http/csrf';
import { handleApiError } from '@/server/http/errors';

export async function GET(request: NextRequest) {
  try {
    const ctx = await getTenantContext();
    const sp = request.nextUrl.searchParams;

    const rawQuery: Record<string, string> = {};
    for (const [k, v] of sp.entries()) {
      if (v !== '') {
        rawQuery[k] = v;
      }
    }

    const query = unitQuerySchema.parse(rawQuery);
    const result = await listUnits(ctx, query);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, 'GET /api/units');
  }
}

export async function POST(request: NextRequest) {
  try {
    assertCsrfSafe(request);
    const ctx = await getTenantContext();
    if (ctx.userRole !== 'ADMIN') {
      throw new AuthError('إضافة الوحدات متاحة للمدير فقط', 403);
    }
    const body = await request.json();
    const input = createUnitSchema.parse(body);
    const unit = await createUnit(ctx, input);
    return NextResponse.json({ unit }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'POST /api/units');
  }
}
