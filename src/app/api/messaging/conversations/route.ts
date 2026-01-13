/**
 * Messaging Conversations API
 * GET /api/messaging/conversations - List conversations for current user
 * POST /api/messaging/conversations - Create a new conversation
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken } from '@/lib/db/dal/auth-service';
import {
  createConversation,
  listConversationsForUser,
  getUnreadCount,
} from '@/lib/db/dal/messaging';
import { query } from '@/lib/db';

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
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const cursor = searchParams.get('cursor') || undefined;
    const status = searchParams.get('status') as 'active' | 'archived' | 'flagged' | 'closed' | undefined;

    const role = session.userRole;
    if (role !== 'buyer' && role !== 'vendor') {
      return NextResponse.json({ error: 'Admins should use /api/admin/messaging endpoint' }, { status: 403 });
    }

    const { conversations, nextCursor } = await listConversationsForUser(
      session.userId,
      role,
      { limit, cursor, status }
    );

    const unreadCount = await getUnreadCount(session.userId, role);

    return NextResponse.json({
      conversations,
      nextCursor,
      unreadCount,
    });
  } catch (error) {
    console.error('[API] GET /messaging/conversations error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}

interface UserRow {
  id: string;
  name: string;
  avatar?: string;
  business_name?: string;
}

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

    const { session, user } = result.data;

    if (session.userRole !== 'buyer') {
      return NextResponse.json(
        { error: 'Only buyers can initiate conversations' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { vendorId, productId, orderId, context } = body;

    if (!vendorId) {
      return NextResponse.json(
        { error: 'Vendor ID is required' },
        { status: 400 }
      );
    }

    const vendorResult = await query<UserRow>(
      'SELECT id, name, avatar, business_name FROM users WHERE id = $1 AND role = $2',
      [vendorId, 'vendor']
    );

    if (vendorResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
      );
    }

    const vendor = vendorResult.rows[0];

    interface CreateInput {
      buyerId: string;
      buyerName: string;
      buyerAvatar?: string;
      vendorId: string;
      vendorName: string;
      vendorAvatar?: string;
      vendorBusinessName?: string;
      context: 'product_inquiry' | 'order_support' | 'general' | 'dispute';
      productId?: string;
      productName?: string;
      productImage?: string;
      orderId?: string;
      orderNumber?: string;
    }

    const input: CreateInput = {
      buyerId: session.userId,
      buyerName: user?.name || 'Buyer',
      buyerAvatar: user?.avatar || undefined,
      vendorId: vendor.id,
      vendorName: vendor.name,
      vendorAvatar: vendor.avatar || undefined,
      vendorBusinessName: vendor.business_name || undefined,
      context: context || 'general',
    };

    if (productId) {
      interface ProductRow {
        id: string;
        name: string;
        main_image?: string;
      }
      const productResult = await query<ProductRow>(
        'SELECT id, name, main_image FROM products WHERE id = $1',
        [productId]
      );
      if (productResult.rows.length > 0) {
        const product = productResult.rows[0];
        input.productId = product.id;
        input.productName = product.name;
        input.productImage = product.main_image;
        input.context = 'product_inquiry';
      }
    }

    if (orderId) {
      interface OrderRow {
        id: string;
        order_number?: string;
      }
      const orderResult = await query<OrderRow>(
        'SELECT id, order_number FROM orders WHERE id = $1 AND user_id = $2',
        [orderId, session.userId]
      );
      if (orderResult.rows.length > 0) {
        const order = orderResult.rows[0];
        input.orderId = order.id;
        input.orderNumber = order.order_number;
        input.context = 'order_support';
      }
    }

    const conversation = await createConversation(input);

    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    console.error('[API] POST /messaging/conversations error:', error);
    return NextResponse.json(
      { error: 'Failed to create conversation' },
      { status: 500 }
    );
  }
}
