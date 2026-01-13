/**
 * Single Conversation API
 * GET /api/messaging/conversations/[id] - Get conversation details
 * PATCH /api/messaging/conversations/[id] - Update conversation (pin, mute, archive)
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken } from '@/lib/db/dal/auth-service';
import {
  getConversationForUser,
  updateConversation,
  archiveConversation,
} from '@/lib/db/dal/messaging';

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

    return NextResponse.json({ conversation });
  } catch (error) {
    console.error('[API] GET /messaging/conversations/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversation' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

    const body = await request.json();
    const { action, isPinned, isMuted } = body;

    if (action === 'archive') {
      await archiveConversation(id, session.userId, role);
      return NextResponse.json({ success: true });
    }

    const updates: Record<string, boolean> = {};
    if (isPinned !== undefined) {
      if (role === 'buyer') {
        updates.isPinnedBuyer = isPinned;
      } else {
        updates.isPinnedVendor = isPinned;
      }
    }
    if (isMuted !== undefined) {
      if (role === 'buyer') {
        updates.isMutedBuyer = isMuted;
      } else {
        updates.isMutedVendor = isMuted;
      }
    }

    if (Object.keys(updates).length > 0) {
      await updateConversation(id, updates);
    }

    const updated = await getConversationForUser(id, session.userId, role);
    return NextResponse.json({ conversation: updated });
  } catch (error) {
    console.error('[API] PATCH /messaging/conversations/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to update conversation' },
      { status: 500 }
    );
  }
}
