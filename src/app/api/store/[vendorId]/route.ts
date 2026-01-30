/**
 * Public Store API
 * GET /api/store/[vendorId]
 * Returns public vendor store information and their products
 */

import { NextRequest, NextResponse } from 'next/server';
import { getVendorById } from '@/lib/db/dal/vendors';
import { query } from '@/lib/db';

interface RouteParams {
  params: Promise<{ vendorId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { vendorId } = await params;

    const vendor = await getVendorById(vendorId);
    
    if (!vendor) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    if (vendor.verification_status !== 'verified') {
      return NextResponse.json({ error: 'Store not available' }, { status: 404 });
    }

    const productsResult = await query<{
      id: string;
      name: string;
      description: string;
      price: number;
      images: string;
      category_id: string;
      quantity: number;
      status: string;
      created_at: string;
    }>(
      `SELECT id, name, description, price, images, category_id, quantity, status, created_at 
       FROM products 
       WHERE vendor_id = $1 AND status = 'approved' AND quantity > 0
       ORDER BY created_at DESC
       LIMIT 50`,
      [vendorId]
    );

    const reviewsResult = await query<{ avg_rating: string; review_count: string }>(
      `SELECT 
        COALESCE(AVG(r.rating), 0) as avg_rating,
        COUNT(r.id) as review_count
       FROM reviews r
       JOIN products p ON r.product_id = p.id
       WHERE p.vendor_id = $1 AND r.status = 'approved'`,
      [vendorId]
    );

    const ordersResult = await query<{ total_sales: string }>(
      `SELECT COUNT(DISTINCT oi.order_id) as total_sales
       FROM order_items oi
       WHERE oi.vendor_id = $1`,
      [vendorId]
    );

    const products = productsResult.rows.map(product => ({
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      images: product.images ? JSON.parse(product.images) : [],
      categoryId: product.category_id,
      quantity: product.quantity,
      status: product.status,
    }));

    return NextResponse.json({
      store: {
        id: vendor.id,
        name: vendor.business_name,
        description: vendor.description,
        logo: vendor.logo,
        businessType: vendor.business_type,
        joinedAt: vendor.created_at,
        stats: {
          productCount: products.length,
          averageRating: parseFloat(reviewsResult.rows[0]?.avg_rating || '0'),
          reviewCount: parseInt(reviewsResult.rows[0]?.review_count || '0', 10),
          totalSales: parseInt(ordersResult.rows[0]?.total_sales || '0', 10),
        },
      },
      products,
    });
  } catch (error) {
    console.error('Error fetching store:', error);
    return NextResponse.json({ error: 'Failed to load store' }, { status: 500 });
  }
}
