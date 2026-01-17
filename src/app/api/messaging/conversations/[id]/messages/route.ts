/**
 * Conversation Messages API
 * GET /api/messaging/conversations/[id]/messages - List messages in conversation
 * POST /api/messaging/conversations/[id]/messages - Send a new message
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken } from '@/lib/db/dal/auth-service';
import {
  getConversationForUser,
  createMessage,
  listMessages,
} from '@/lib/db/dal/messaging';
import { createNotification } from '@/lib/db/dal/notifications';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
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

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const cursor = searchParams.get('cursor') || undefined;

    const { messages, nextCursor } = await listMessages(id, session.userId, role, { limit, cursor });

    return NextResponse.json({
      messages,
      nextCursor,
    });
  } catch (error) {
    console.error('[API] GET /messaging/conversations/[id]/messages error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
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

    const { session, user } = result.data;
    const { id } = await params;
    const role = session.userRole;

    if (role !== 'buyer' && role !== 'vendor') {
      return NextResponse.json({ error: 'Admins should use /api/admin/messaging endpoint' }, { status: 403 });
    }

    const conversation = await getConversationForUser(id, session.userId, role);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    if (conversation.status === 'closed') {
      return NextResponse.json({ error: 'Conversation is closed' }, { status: 403 });
    }

    const body = await request.json();
    const { content, messageType, attachmentUrl, attachmentName } = body;

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
    }

    if (content.length > 5000) {
      return NextResponse.json({ error: 'Message is too long (max 5000 characters)' }, { status: 400 });
    }

    const message = await createMessage({
      conversationId: id,
      senderId: session.userId,
      senderName: user?.name || 'User',
      senderRole: role,
      senderAvatar: user?.avatar || undefined,
      content: content.trim(),
      messageType: messageType || 'text',
      attachmentUrl,
      attachmentName,
    });

    // Notify recipient if not muted (fire-and-forget)
    const recipientId = role === 'buyer' ? conversation.vendorId : conversation.buyerId;
    const recipientRole = role === 'buyer' ? 'vendor' : 'buyer';
    const recipientMuted = role === 'buyer' ? conversation.isMutedVendor : conversation.isMutedBuyer;
    
    if (!recipientMuted) {
      const senderName = user?.name || (role === 'buyer' ? 'A buyer' : 'A vendor');
      const truncatedContent = content.length > 50 ? content.substring(0, 47) + '...' : content;
      createNotification({
        userId: recipientId,
        role: recipientRole as 'buyer' | 'vendor',
        type: 'system',
        title: 'New Message',
        message: `${senderName}: ${truncatedContent}`,
        payload: { conversationId: id, senderId: session.userId, senderName },
      }).catch(err => console.error('[NOTIFICATION] Failed to notify message recipient:', err));
    }

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error('[API] POST /messaging/conversations/[id]/messages error:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
