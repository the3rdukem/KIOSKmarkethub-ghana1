import { NextRequest, NextResponse } from 'next/server';
import { validateCoupon, getCouponByCode } from '@/lib/db/dal/promotions';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, orderAmount, vendorIds } = body;

    if (!code) {
      return NextResponse.json({ error: 'Coupon code is required' }, { status: 400 });
    }

    const result = await validateCoupon(code, orderAmount || 0);

    if (!result.valid) {
      return NextResponse.json({ 
        valid: false, 
        error: result.error 
      }, { status: 200 });
    }

    const coupon = result.coupon!;
    
    if (vendorIds && vendorIds.length > 0) {
      if (!vendorIds.includes(coupon.vendor_user_id)) {
        return NextResponse.json({ 
          valid: false, 
          error: 'This coupon is not valid for the items in your cart' 
        }, { status: 200 });
      }
    }

    return NextResponse.json({
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        name: coupon.name,
        discountType: coupon.discount_type,
        discountValue: coupon.discount_value,
        vendorId: coupon.vendor_user_id,
      },
      discount: result.discount,
    });
  } catch (error) {
    console.error('[COUPON_VALIDATE]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
