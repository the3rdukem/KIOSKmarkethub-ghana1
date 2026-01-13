/**
 * Mark Conversation as Read API
 * POST /api/messaging/conversations/[id]/read - Mark all messages in conversation as read
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken } from '@/lib/db/dal/auth-service';
import {
  getConversationForUser,
  markConversationAsRead,
} from '@/lib/db/dal/messaging';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
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
    const { id } = await params;
    const role = session.userRole;

    if (role !== 'buyer' && role !== 'vendor') {
      return NextResponse.json({ error: 'Admins should use /api/admin/messaging endpoint' }, { status: 403 });
    }

    const conversation = await getConversationForUser(id, session.userId, role);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    await markConversationAsRead(id, session.userId, role);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] POST /messaging/conversations/[id]/read error:', error);
    return NextResponse.json(
      { error: 'Failed to mark as read' },
      { status: 500 }
    );
  }
}
