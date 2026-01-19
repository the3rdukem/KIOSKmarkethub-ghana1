/**
 * Mark Notifications as Read API
 * 
 * POST /api/notifications/read - Mark one or all notifications as read
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken } from '@/lib/db/dal/auth-service';
import { markAsRead, markAllAsRead, markMessageNotificationsAsRead } from '@/lib/db/dal/notifications';

export async function POST(request: NextRequest) {
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
    const body = await request.json();

    if (body.all === true) {
      const count = await markAllAsRead(session.userId);
      return NextResponse.json({ success: true, markedCount: count });
    }

    if (body.type === 'message') {
      const count = await markMessageNotificationsAsRead(session.userId);
      return NextResponse.json({ success: true, markedCount: count });
    }

    if (body.notificationId) {
      const success = await markAsRead(body.notificationId, session.userId);
      if (!success) {
        return NextResponse.json(
          { error: 'Notification not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: 'Provide notificationId, type, or all: true' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[NOTIFICATIONS_READ_API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to mark notifications as read' },
      { status: 500 }
    );
  }
}
