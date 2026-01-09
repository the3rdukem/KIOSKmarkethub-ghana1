import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/db/dal/sessions';
import { cookies } from 'next/headers';
import { getSaleById, updateSale, deleteSale } from '@/lib/db/dal/promotions';
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

    const sale = await getSaleById(id);
    if (!sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    }

    if (session.user_role === 'vendor' && sale.vendor_user_id !== session.user_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ sale });
  } catch (error) {
    console.error('[SALE_GET]', error);
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
    const { name, productIds, discountType, discountValue, startDate, endDate, isActive } = body;

    // Content safety validation for name
    if (name) {
      const nameCheck = validateContentSafety(name);
      if (!nameCheck.valid) {
        return NextResponse.json({ error: nameCheck.message, code: nameCheck.code }, { status: 400 });
      }
    }

    const sale = await updateSale(id, session.user_id, {
      name,
      product_ids: productIds,
      discount_type: discountType,
      discount_value: discountValue,
      starts_at: startDate,
      ends_at: endDate,
      is_active: isActive,
    });

    if (!sale) {
      return NextResponse.json({ error: 'Sale not found or not authorized' }, { status: 404 });
    }

    return NextResponse.json({ sale });
  } catch (error) {
    console.error('[SALE_PATCH]', error);
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

    const deleted = await deleteSale(id, session.user_id);
    if (!deleted) {
      return NextResponse.json({ error: 'Sale not found or not authorized' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[SALE_DELETE]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
