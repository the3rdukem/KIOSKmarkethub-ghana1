import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/db/dal/sessions';
import { cookies } from 'next/headers';
import {
  getSalesByVendor,
  getAllSales,
  createSale,
} from '@/lib/db/dal/promotions';
import { validateContentSafety } from '@/lib/validation';

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

    if (session.user_role === 'admin' || session.user_role === 'master_admin') {
      const sales = await getAllSales();
      return NextResponse.json({ sales });
    }

    if (session.user_role === 'vendor') {
      const sales = await getSalesByVendor(session.user_id);
      return NextResponse.json({ sales });
    }

    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  } catch (error) {
    console.error('[SALES_GET]', error);
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
    const { productIds, name, discountType, discountValue, startDate, endDate } = body;

    // Comprehensive validation
    const validationErrors: string[] = [];
    
    // Required fields
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      validationErrors.push('At least one product must be selected');
    }
    
    const saleName = typeof name === 'string' ? name.trim() : '';
    if (!saleName) {
      validationErrors.push('Sale name is required');
    } else {
      // Content safety check for sale name
      const nameResult = validateContentSafety(saleName);
      if (!nameResult.valid) {
        return NextResponse.json(
          { error: nameResult.message, code: nameResult.code },
          { status: 400 }
        );
      }
    }
    
    if (!discountType || !['percentage', 'fixed'].includes(discountType)) {
      validationErrors.push('Discount type must be "percentage" or "fixed"');
    }
    
    // Discount value validation
    const parsedDiscountValue = parseFloat(discountValue);
    if (isNaN(parsedDiscountValue) || parsedDiscountValue <= 0) {
      validationErrors.push('Discount value must be a positive number');
    }
    
    if (discountType === 'percentage' && parsedDiscountValue > 100) {
      validationErrors.push('Percentage discount cannot exceed 100%');
    }
    
    // Date validation - require both or neither
    const hasStartDate = startDate !== undefined && startDate !== null && startDate !== '';
    const hasEndDate = endDate !== undefined && endDate !== null && endDate !== '';
    
    if (hasStartDate !== hasEndDate) {
      validationErrors.push('Both start date and end date are required, or leave both empty');
    } else if (hasStartDate && hasEndDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        validationErrors.push('Invalid date format');
      } else if (start >= end) {
        validationErrors.push('End date must be after start date');
      }
    }
    
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { 
          error: validationErrors[0],
          code: 'VALIDATION_ERROR',
          details: validationErrors.join('; '),
          validationErrors 
        },
        { status: 400 }
      );
    }

    const sale = await createSale({
      vendor_user_id: session.user_id,
      product_ids: productIds,
      name,
      discount_type: discountType,
      discount_value: discountValue,
      starts_at: startDate,
      ends_at: endDate,
    });

    return NextResponse.json({ sale }, { status: 201 });
  } catch (error) {
    console.error('[SALES_POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
