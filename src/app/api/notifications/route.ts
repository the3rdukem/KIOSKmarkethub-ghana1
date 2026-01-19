/**
 * Notifications API
 * 
 * GET /api/notifications - Get notifications for authenticated user
 * POST /api/notifications - Create a notification (admin only - for system-generated notifications)
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken } from '@/lib/db/dal/auth-service';
import { validateAdminSession } from '@/lib/db/dal/admin';
import {
  getNotificationsForUser,
  createNotification,
  CreateNotificationInput,
} from '@/lib/db/dal/notifications';

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
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    const data = await getNotificationsForUser(session.userId, {
      limit: Math.min(limit, 100),
      offset,
      unreadOnly,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('[NOTIFICATIONS_API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await validateAdminSession(sessionToken);
    if (!admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    
    if (!body.userId || !body.role || !body.title || !body.message) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, role, title, message' },
        { status: 400 }
      );
    }

    const validRoles = ['buyer', 'vendor', 'admin'];
    if (!validRoles.includes(body.role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be buyer, vendor, or admin' },
        { status: 400 }
      );
    }

    const input: CreateNotificationInput = {
      userId: body.userId,
      role: body.role,
      type: 'system',
      title: body.title,
      message: body.message,
      payload: { 
        ...body.payload, 
        _adminCreated: true,
        _createdBy: admin.id,
        _createdAt: new Date().toISOString(),
      },
    };

    console.log('[NOTIFICATIONS_API] Admin system notification created', {
      adminId: admin.id,
      adminEmail: admin.email,
      targetUserId: body.userId,
      targetRole: body.role,
      title: body.title,
    });

    const notification = await createNotification(input);
    return NextResponse.json({ notification }, { status: 201 });
  } catch (error) {
    console.error('[NOTIFICATIONS_API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create notification' },
      { status: 500 }
    );
  }
}
