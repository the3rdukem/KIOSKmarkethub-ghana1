import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/db/dal/sessions';
import { cookies } from 'next/headers';
import {
  getSalesByVendor,
  getAllSales,
  createSale,
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

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0 || !name || !discountType || discountValue === undefined) {
      return NextResponse.json({ error: 'Missing required fields. productIds must be a non-empty array.' }, { status: 400 });
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
