import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import {
  getPlatformFlashSaleById,
  updatePlatformFlashSale,
  deletePlatformFlashSale,
  getFlashSaleProducts,
  UpdatePlatformFlashSaleInput,
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { id } = await params;
    const flashSale = await getPlatformFlashSaleById(id);
    
    if (!flashSale) {
      return NextResponse.json({ error: 'Flash sale not found' }, { status: 404 });
    }
    
    // Get products in this sale
    const products = await getFlashSaleProducts(id);
    
    return NextResponse.json({ flashSale, products });
  } catch (error) {
    console.error('[API] Error fetching flash sale:', error);
    return NextResponse.json({ error: 'Failed to fetch flash sale' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { id } = await params;
    const body = await request.json();
    
    // Check if sale exists
    const existingSale = await getPlatformFlashSaleById(id);
    if (!existingSale) {
      return NextResponse.json({ error: 'Flash sale not found' }, { status: 404 });
    }
    
    const input: UpdatePlatformFlashSaleInput = {};
    
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim().length < 2) {
        return NextResponse.json({ error: 'Name must be at least 2 characters' }, { status: 400 });
      }
      input.name = body.name.trim();
    }
    
    if (body.description !== undefined) {
      input.description = body.description?.trim() || '';
    }
    
    if (body.banner_image !== undefined) {
      input.banner_image = body.banner_image || '';
    }
    
    if (body.product_ids !== undefined) {
      if (!Array.isArray(body.product_ids) || body.product_ids.length === 0) {
        return NextResponse.json({ error: 'At least one product must be selected' }, { status: 400 });
      }
      input.product_ids = body.product_ids;
    }
    
    if (body.discount_type !== undefined) {
      if (!['percentage', 'fixed'].includes(body.discount_type)) {
        return NextResponse.json({ error: 'Invalid discount type' }, { status: 400 });
      }
      input.discount_type = body.discount_type;
    }
    
    if (body.discount_value !== undefined) {
      if (typeof body.discount_value !== 'number' || body.discount_value <= 0) {
        return NextResponse.json({ error: 'Discount value must be greater than 0' }, { status: 400 });
      }
      const discountType = body.discount_type || existingSale.discount_type;
      if (discountType === 'percentage' && body.discount_value > 100) {
        return NextResponse.json({ error: 'Percentage discount cannot exceed 100%' }, { status: 400 });
      }
      input.discount_value = body.discount_value;
    }
    
    if (body.starts_at !== undefined) {
      input.starts_at = body.starts_at;
    }
    
    if (body.ends_at !== undefined) {
      input.ends_at = body.ends_at;
    }
    
    if (body.is_active !== undefined) {
      input.is_active = Boolean(body.is_active);
    }
    
    // Validate dates if both are provided
    const startDate = new Date(input.starts_at || existingSale.starts_at);
    const endDate = new Date(input.ends_at || existingSale.ends_at);
    if (endDate <= startDate) {
      return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 });
    }
    
    const updatedSale = await updatePlatformFlashSale(id, input);
    
    return NextResponse.json({ flashSale: updatedSale });
  } catch (error) {
    console.error('[API] Error updating flash sale:', error);
    return NextResponse.json({ error: 'Failed to update flash sale' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { id } = await params;
    
    const deleted = await deletePlatformFlashSale(id);
    
    if (!deleted) {
      return NextResponse.json({ error: 'Flash sale not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting flash sale:', error);
    return NextResponse.json({ error: 'Failed to delete flash sale' }, { status: 500 });
  }
}
