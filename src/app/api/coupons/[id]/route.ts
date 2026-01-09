import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/db/dal/sessions';
import { cookies } from 'next/headers';
import { getCouponById, updateCoupon, deleteCoupon } from '@/lib/db/dal/promotions';
import { validateContentSafety } from '@/lib/validation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const coupon = await getCouponById(id);
    if (!coupon) {
      return NextResponse.json({ error: 'Coupon not found' }, { status: 404 });
    }

    if (session.user_role === 'vendor' && coupon.vendor_user_id !== session.user_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ coupon });
  } catch (error) {
    console.error('[COUPON_GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
    const { name, discountType, discountValue, minOrderAmount, usageLimit, startDate, endDate, isActive } = body;

    // Content safety validation for name and code
    if (name) {
      const nameCheck = validateContentSafety(name);
      if (!nameCheck.valid) {
        return NextResponse.json({ error: nameCheck.message, code: nameCheck.code }, { status: 400 });
      }
    }
    if (body.code) {
      const codeCheck = validateContentSafety(body.code);
      if (!codeCheck.valid) {
        return NextResponse.json({ error: codeCheck.message, code: codeCheck.code }, { status: 400 });
      }
    }

    const coupon = await updateCoupon(id, session.user_id, {
      name,
      discount_type: discountType,
      discount_value: discountValue,
      min_order_amount: minOrderAmount,
      usage_limit: usageLimit,
      starts_at: startDate,
      ends_at: endDate,
      is_active: isActive,
    });

    if (!coupon) {
      return NextResponse.json({ error: 'Coupon not found or not authorized' }, { status: 404 });
    }

    return NextResponse.json({ coupon });
  } catch (error) {
    console.error('[COUPON_PATCH]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session || session.user_role !== 'vendor') {
      return NextResponse.json({ error: 'Vendors only' }, { status: 403 });
    }

    const deleted = await deleteCoupon(id, session.user_id);
    if (!deleted) {
      return NextResponse.json({ error: 'Coupon not found or not authorized' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[COUPON_DELETE]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
