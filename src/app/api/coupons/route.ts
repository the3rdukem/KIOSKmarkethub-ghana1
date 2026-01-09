import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/db/dal/sessions';
import { cookies } from 'next/headers';
import {
  getCouponsByVendor,
  getAllCoupons,
  createCoupon,
  validateCoupon,
} from '@/lib/db/dal/promotions';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const vendorId = searchParams.get('vendorId');

    if (session.user_role === 'admin' || session.user_role === 'master_admin') {
      const coupons = await getAllCoupons();
      return NextResponse.json({ coupons });
    }

    if (session.user_role === 'vendor') {
      const coupons = await getCouponsByVendor(session.user_id);
      return NextResponse.json({ coupons });
    }

    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  } catch (error) {
    console.error('[COUPONS_GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session || session.user_role !== 'vendor') {
      return NextResponse.json({ error: 'Vendors only' }, { status: 403 });
    }

    const body = await request.json();
    const { code, name, discountType, discountValue, minOrderAmount, usageLimit, startDate, endDate } = body;

    if (!code || !name || !discountType || discountValue === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const coupon = await createCoupon({
      vendor_user_id: session.user_id,
      code,
      name,
      discount_type: discountType,
      discount_value: discountValue,
      min_order_amount: minOrderAmount || 0,
      usage_limit: usageLimit || undefined,
      starts_at: startDate,
      ends_at: endDate,
    });

    return NextResponse.json({ coupon }, { status: 201 });
  } catch (error: unknown) {
    console.error('[COUPONS_POST]', error);
    if (error instanceof Error && error.message?.includes('unique constraint')) {
      return NextResponse.json({ error: 'Coupon code already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
