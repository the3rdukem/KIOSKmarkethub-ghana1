/**
 * Messaging Unread Count API
 * GET /api/messaging/unread - Get total unread count for current user
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken } from '@/lib/db/dal/auth-service';
import { getUnreadCount } from '@/lib/db/dal/messaging';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await validateSessionToken(sessionToken);
    if (!result.success || !result.data) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { session } = result.data;
    const role = session.userRole;

    if (role !== 'buyer' && role !== 'vendor') {
      return NextResponse.json({ unreadCount: 0 });
    }

    const unreadCount = await getUnreadCount(session.userId, role as 'buyer' | 'vendor');

    return NextResponse.json({ unreadCount });
  } catch (error) {
    console.error('[API] GET /messaging/unread error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch unread count' },
      { status: 500 }
    );
  }
}
