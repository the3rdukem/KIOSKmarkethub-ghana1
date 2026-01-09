import { NextRequest, NextResponse } from 'next/server';
import { validateCoupon } from '@/lib/db/dal/promotions';

interface CartItem {
  id: string;
  vendorId: string;
  price: number;
  quantity: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, orderAmount, vendorIds, cartItems } = body;

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

    let eligibleSubtotal = 0;
    let lineItemDiscount = 0;
    
    if (cartItems && Array.isArray(cartItems)) {
      const eligibleItems = cartItems.filter((item: CartItem) => item.vendorId === coupon.vendor_user_id);
      eligibleSubtotal = eligibleItems.reduce((sum: number, item: CartItem) => sum + (item.price * item.quantity), 0);
      
      if (coupon.discount_type === 'percentage') {
        lineItemDiscount = (eligibleSubtotal * coupon.discount_value) / 100;
      } else {
        lineItemDiscount = Math.min(coupon.discount_value, eligibleSubtotal);
      }
    } else {
      lineItemDiscount = result.discount || 0;
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
      eligibleSubtotal,
      discount: lineItemDiscount,
    });
  } catch (error) {
    console.error('[COUPON_VALIDATE]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
