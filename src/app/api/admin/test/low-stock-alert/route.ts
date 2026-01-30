/**
 * Test Low Stock Alert API (Admin Only)
 * 
 * POST /api/admin/test/low-stock-alert - Trigger a test low stock alert
 * 
 * This endpoint is for testing purposes only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import { sendLowStockAlert, runLowStockCheck } from '@/lib/services/low-stock-alerts';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session || !['admin', 'master_admin'].includes(session.user_role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { mode, vendorId, productId, productName, quantity, threshold, skipCooldown } = body;

    if (mode === 'manual') {
      if (!vendorId || !productId || !productName) {
        return NextResponse.json({ 
          error: 'Manual mode requires vendorId, productId, and productName' 
        }, { status: 400 });
      }

      const result = await sendLowStockAlert(
        productId,
        productName,
        vendorId,
        quantity ?? 2,
        threshold ?? 5,
        { skipCooldown: skipCooldown === true }
      );

      return NextResponse.json({
        success: true,
        message: 'Low stock alert triggered manually',
        result,
      });
    }

    if (mode === 'scan') {
      const results = await runLowStockCheck(vendorId);
      
      return NextResponse.json({
        success: true,
        message: `Scanned ${results.length} products with low stock`,
        results,
      });
    }

    if (mode === 'find_product') {
      const productsResult = await query<{
        id: string;
        name: string;
        vendor_id: string;
        quantity: number;
        track_quantity: number;
        status: string;
        vendor_name: string;
        vendor_phone: string;
        vendor_email: string;
      }>(
        `SELECT p.id, p.name, p.vendor_id, p.quantity, p.track_quantity, p.status,
                u.business_name as vendor_name, u.phone as vendor_phone, u.email as vendor_email
         FROM products p 
         JOIN users u ON p.vendor_id = u.id 
         WHERE p.track_quantity = 1 AND p.status = 'active'
         ORDER BY p.quantity ASC
         LIMIT 10`
      );

      return NextResponse.json({
        success: true,
        message: 'Found products with inventory tracking',
        products: productsResult.rows,
      });
    }

    if (mode === 'debug') {
      const allProducts = await query<{
        id: string;
        name: string;
        track_quantity: number;
        status: string;
        quantity: number;
      }>(
        `SELECT id, name, track_quantity, status, quantity FROM products LIMIT 20`
      );

      return NextResponse.json({
        success: true,
        message: 'Debug: All products',
        products: allProducts.rows,
      });
    }

    return NextResponse.json({ 
      error: 'Invalid mode. Use "manual", "scan", or "find_product"' 
    }, { status: 400 });

  } catch (error) {
    console.error('[TEST LOW STOCK] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to trigger low stock alert',
      details: (error as Error).message 
    }, { status: 500 });
  }
}
