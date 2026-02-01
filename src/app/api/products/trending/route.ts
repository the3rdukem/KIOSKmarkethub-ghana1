import { NextRequest, NextResponse } from 'next/server';
import { getTrendingProducts, getBestSellingProducts } from '@/lib/db/dal/promotions';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'trending';
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 20);
    const days = parseInt(searchParams.get('days') || '7');
    
    let productRanking: { product_id: string; score: number }[] = [];
    
    if (type === 'bestselling') {
      const results = await getBestSellingProducts(limit, days);
      productRanking = results.map(r => ({ product_id: r.product_id, score: r.units_sold }));
    } else {
      const results = await getTrendingProducts(limit, days);
      productRanking = results.map(r => ({ product_id: r.product_id, score: r.view_count }));
    }
    
    if (productRanking.length === 0) {
      return NextResponse.json({ products: [], type });
    }
    
    // Get product details
    const productIds = productRanking.map(r => r.product_id);
    const placeholders = productIds.map((_, i) => `$${i + 1}`).join(',');
    
    const productsResult = await query<{
      id: string;
      name: string;
      price: number;
      images: string;
      category_id: string;
      vendor_id: string;
      status: string;
    }>(
      `SELECT id, name, price, images, category_id, vendor_id, status
       FROM products 
       WHERE id IN (${placeholders}) AND status = 'active'`,
      productIds
    );
    
    // Merge with ranking data and sort by score
    const productsWithScore = productsResult.rows.map(product => {
      const ranking = productRanking.find(r => r.product_id === product.id);
      return {
        ...product,
        score: ranking?.score || 0,
        images: product.images ? JSON.parse(product.images) : [],
      };
    }).sort((a, b) => b.score - a.score);
    
    return NextResponse.json({
      type,
      products: productsWithScore,
    });
  } catch (error) {
    console.error('[API] Error fetching trending products:', error);
    return NextResponse.json({ error: 'Failed to fetch trending products' }, { status: 500 });
  }
}
