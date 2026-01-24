import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const vendorResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM users 
       WHERE role = 'vendor' AND is_deleted = 0 AND status = 'active'`
    );
    const totalVendors = parseInt(vendorResult.rows[0]?.count || '0', 10);

    const verifiedResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM users 
       WHERE role = 'vendor' AND is_deleted = 0 AND status = 'active' 
       AND verification_status = 'verified'`
    );
    const verifiedVendors = parseInt(verifiedResult.rows[0]?.count || '0', 10);

    const productsResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM products WHERE status = 'active'`
    );
    const totalProducts = parseInt(productsResult.rows[0]?.count || '0', 10);

    const ordersResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM orders WHERE status != 'cancelled'`
    );
    const totalOrders = parseInt(ordersResult.rows[0]?.count || '0', 10);

    return NextResponse.json({
      totalVendors,
      verifiedVendors,
      totalProducts,
      totalOrders,
    });
  } catch (error) {
    console.error('[API] GET /stats/public error:', error);
    return NextResponse.json(
      { totalVendors: 0, verifiedVendors: 0, totalProducts: 0, totalOrders: 0 },
      { status: 200 }
    );
  }
}
