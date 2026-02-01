import { NextResponse } from 'next/server';
import { getActivePlatformFlashSales, getProductsInActiveFlashSales } from '@/lib/db/dal/promotions';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const [flashSales, productsInSales] = await Promise.all([
      getActivePlatformFlashSales(),
      getProductsInActiveFlashSales(),
    ]);
    
    if (flashSales.length === 0) {
      return NextResponse.json({ flashSales: [], products: [] });
    }
    
    // Get product details for products in active sales
    const productIds = [...new Set(productsInSales.map(p => p.product_id))];
    
    if (productIds.length === 0) {
      return NextResponse.json({ flashSales, products: [] });
    }
    
    const placeholders = productIds.map((_, i) => `$${i + 1}`).join(',');
    const productsResult = await query<{
      id: string;
      name: string;
      price: number;
      images: string;
      category_id: string;
      vendor_id: string;
    }>(
      `SELECT id, name, price, images, category_id, vendor_id
       FROM products 
       WHERE id IN (${placeholders}) AND status = 'active'`,
      productIds
    );
    
    // Combine product info with sale discount info
    const productsWithDiscounts = productsResult.rows.map(product => {
      const saleInfo = productsInSales.find(p => p.product_id === product.id);
      if (!saleInfo) return null;
      
      const salePrice = saleInfo.discount_type === 'percentage'
        ? product.price * (1 - saleInfo.discount_value / 100)
        : Math.max(0, product.price - saleInfo.discount_value);
      
      return {
        ...product,
        original_price: product.price,
        sale_price: Math.round(salePrice * 100) / 100,
        discount_type: saleInfo.discount_type,
        discount_value: saleInfo.discount_value,
        sale_ends_at: saleInfo.ends_at,
        images: product.images ? JSON.parse(product.images) : [],
      };
    }).filter(Boolean);
    
    return NextResponse.json({
      flashSales: flashSales.map(sale => ({
        id: sale.id,
        name: sale.name,
        description: sale.description,
        banner_image: sale.banner_image,
        discount_type: sale.discount_type,
        discount_value: sale.discount_value,
        starts_at: sale.starts_at,
        ends_at: sale.ends_at,
      })),
      products: productsWithDiscounts,
    });
  } catch (error) {
    console.error('[API] Error fetching active flash sales:', error);
    return NextResponse.json({ error: 'Failed to fetch flash sales' }, { status: 500 });
  }
}
