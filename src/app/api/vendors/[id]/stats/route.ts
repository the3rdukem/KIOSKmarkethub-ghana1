import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: vendorId } = await params;

    if (!vendorId) {
      return NextResponse.json({ error: 'Vendor ID required' }, { status: 400 });
    }

    const allOrders = await query<{ id: string; status: string; items: string }>(
      `SELECT id, status, items FROM orders WHERE status = 'delivered'`,
      []
    );

    let totalSales = 0;

    for (const order of allOrders.rows) {
      try {
        const items = JSON.parse(order.items || '[]');
        const vendorItems = items.filter((item: { vendorId?: string }) => item.vendorId === vendorId);
        
        if (vendorItems.length > 0) {
          totalSales++;
        }
      } catch (e) {
      }
    }

    const response = NextResponse.json({
      totalSales,
    });
    
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    
    return response;
  } catch (error) {
    console.error('[VENDOR_PUBLIC_STATS] Error:', error);
    return NextResponse.json({ totalSales: 0 }, { status: 200 });
  }
}
