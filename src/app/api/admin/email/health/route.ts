/**
 * Admin Email Provider Health Check API
 * 
 * GET /api/admin/email/health - Check email provider status
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAdminSession } from '@/lib/db/dal/admin';
import { checkEmailProviderHealth } from '@/lib/db/dal/email';

export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await validateAdminSession(sessionToken);
    if (!admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const health = await checkEmailProviderHealth();
    return NextResponse.json(health);
  } catch (error) {
    console.error('[ADMIN_EMAIL_HEALTH_API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to check email provider health' },
      { status: 500 }
    );
  }
}
