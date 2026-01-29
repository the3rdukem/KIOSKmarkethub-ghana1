/**
 * Admin Disputes API
 * 
 * GET /api/admin/disputes - List all disputes with filters
 * POST /api/admin/disputes - Create a dispute (admin can create on behalf of buyer)
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import { getDisputes, getDisputeStats, createDispute } from '@/lib/db/dal/disputes';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session || (session.user_role !== 'admin' && session.user_role !== 'master_admin')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const priority = searchParams.get('priority') || undefined;
    const type = searchParams.get('type') || undefined;
    const vendorId = searchParams.get('vendor_id') || undefined;
    const buyerId = searchParams.get('buyer_id') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const [disputesResult, stats] = await Promise.all([
      getDisputes({
        status: status as 'open' | 'investigating' | 'resolved' | 'escalated' | 'closed' | undefined,
        priority: priority as 'low' | 'medium' | 'high' | 'urgent' | undefined,
        type: type as 'refund' | 'quality' | 'delivery' | 'fraud' | 'other' | undefined,
        vendorId,
        buyerId,
        limit,
        offset,
      }),
      getDisputeStats(),
    ]);

    return NextResponse.json({
      disputes: disputesResult.disputes,
      total: disputesResult.total,
      stats,
    });
  } catch (error) {
    console.error('[Admin Disputes API] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch disputes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session || (session.user_role !== 'admin' && session.user_role !== 'master_admin')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { orderId, buyerId, buyerName, buyerEmail, vendorId, vendorName, productId, productName, amount, type, description, priority } = body;

    if (!orderId || !buyerId || !buyerName || !buyerEmail || !vendorId || !vendorName || !type || !description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const dispute = await createDispute({
      orderId,
      buyerId,
      buyerName,
      buyerEmail,
      vendorId,
      vendorName,
      productId,
      productName,
      amount,
      type,
      description,
      priority,
    });

    return NextResponse.json({ dispute });
  } catch (error) {
    console.error('[Admin Disputes API] POST error:', error);
    return NextResponse.json({ error: 'Failed to create dispute' }, { status: 500 });
  }
}
