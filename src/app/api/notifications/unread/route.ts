/**
 * Unread Notifications Count API
 * 
 * GET /api/notifications/unread - Get unread count for authenticated user
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken } from '@/lib/db/dal/auth-service';
import { getUnreadCount } from '@/lib/db/dal/notifications';

export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;
    if (!sessionToken) {
      return NextResponse.json({ unreadCount: 0 });
    }

    const result = await validateSessionToken(sessionToken);
    if (!result.success || !result.data) {
      return NextResponse.json({ unreadCount: 0 });
    }

    const { session } = result.data;
    const unreadCount = await getUnreadCount(session.userId);

    return NextResponse.json({ unreadCount });
  } catch (error) {
    console.error('[NOTIFICATIONS_UNREAD_API] GET error:', error);
    return NextResponse.json({ unreadCount: 0 });
  }
}
