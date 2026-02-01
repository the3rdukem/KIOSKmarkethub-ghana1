import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import {
  getPlatformFlashSales,
  createPlatformFlashSale,
  CreatePlatformFlashSaleInput,
} from '@/lib/db/dal/promotions';

async function getAdminSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session_token')?.value;
  
  if (!sessionToken) {
    return null;
  }
  
  const session = await validateSession(sessionToken);
  if (!session || (session.user_role !== 'admin' && session.user_role !== 'master_admin')) {
    return null;
  }
  
  return session;
}

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const flashSales = await getPlatformFlashSales();
    return NextResponse.json({ flashSales });
  } catch (error) {
    console.error('[API] Error fetching flash sales:', error);
    return NextResponse.json({ error: 'Failed to fetch flash sales' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    
    // Validate required fields
    const { name, product_ids, discount_type, discount_value, starts_at, ends_at, description, banner_image } = body;
    
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json({ error: 'Name is required (min 2 characters)' }, { status: 400 });
    }
    
    if (!product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
      return NextResponse.json({ error: 'At least one product must be selected' }, { status: 400 });
    }
    
    if (!discount_type || !['percentage', 'fixed'].includes(discount_type)) {
      return NextResponse.json({ error: 'Invalid discount type' }, { status: 400 });
    }
    
    if (typeof discount_value !== 'number' || discount_value <= 0) {
      return NextResponse.json({ error: 'Discount value must be greater than 0' }, { status: 400 });
    }
    
    if (discount_type === 'percentage' && discount_value > 100) {
      return NextResponse.json({ error: 'Percentage discount cannot exceed 100%' }, { status: 400 });
    }
    
    if (!starts_at || !ends_at) {
      return NextResponse.json({ error: 'Start and end dates are required' }, { status: 400 });
    }
    
    const startDate = new Date(starts_at);
    const endDate = new Date(ends_at);
    
    if (endDate <= startDate) {
      return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 });
    }
    
    const input: CreatePlatformFlashSaleInput = {
      name: name.trim(),
      description: description?.trim() || undefined,
      banner_image: banner_image || undefined,
      product_ids,
      discount_type,
      discount_value,
      starts_at,
      ends_at,
      created_by: session.user_id,
    };
    
    const flashSale = await createPlatformFlashSale(input);
    
    return NextResponse.json({ flashSale }, { status: 201 });
  } catch (error) {
    console.error('[API] Error creating flash sale:', error);
    return NextResponse.json({ error: 'Failed to create flash sale' }, { status: 500 });
  }
}
