/**
 * Reviews API
 * 
 * GET: Get reviews (product, buyer, vendor, or all)
 * POST: Create a new review
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken } from '@/lib/db/dal/auth-service';
import { 
  createReview, 
  getProductReviews, 
  getBuyerReviews, 
  getVendorProductReviews,
  getAllReviews,
  getProductRatingStats,
  getReviewStats
} from '@/lib/db/dal/reviews';
import { createAuditLog } from '@/lib/db/dal/audit';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getSession(sessionToken: string) {
  const result = await validateSessionToken(sessionToken);
  if (!result.success || !result.data) return null;
  return {
    userId: result.data.session.userId,
    role: result.data.session.userRole,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const buyerId = searchParams.get('buyerId');
    const vendorId = searchParams.get('vendorId');
    const statsOnly = searchParams.get('stats') === 'true';
    const adminView = searchParams.get('admin') === 'true';

    // If admin view, require admin session
    if (adminView) {
      const sessionToken = request.cookies.get('session_token')?.value;
      if (!sessionToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const session = await getSession(sessionToken);
      if (!session || (session.role !== 'admin' && session.role !== 'master_admin')) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }

      if (statsOnly) {
        const stats = await getReviewStats();
        return NextResponse.json({ stats });
      }

      const reviews = await getAllReviews({ limit: 100 });
      return NextResponse.json({ reviews });
    }

    // Product reviews (public)
    if (productId) {
      const reviews = await getProductReviews(productId);
      const stats = await getProductRatingStats(productId);
      return NextResponse.json({ reviews, stats });
    }

    // Buyer reviews (require auth)
    if (buyerId) {
      const sessionToken = request.cookies.get('session_token')?.value;
      if (!sessionToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const session = await getSession(sessionToken);
      if (!session || session.userId !== buyerId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const reviews = await getBuyerReviews(buyerId);
      return NextResponse.json({ reviews });
    }

    // Vendor reviews (require vendor auth)
    if (vendorId) {
      const sessionToken = request.cookies.get('session_token')?.value;
      if (!sessionToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const session = await getSession(sessionToken);
      if (!session) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      // Check if user is this vendor
      const vendorCheck = await query<{ id: string }>(
        'SELECT id FROM vendors WHERE user_id = $1',
        [session.userId]
      );
      
      if (vendorCheck.rows[0]?.id !== vendorId && session.role !== 'admin' && session.role !== 'master_admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const reviews = await getVendorProductReviews(vendorId);
      return NextResponse.json({ reviews });
    }

    return NextResponse.json({ error: 'Missing query parameter' }, { status: 400 });
  } catch (error) {
    console.error('[REVIEWS_API] GET Error:', error);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await getSession(sessionToken);
    if (!session || session.role !== 'buyer') {
      return NextResponse.json({ error: 'Only buyers can create reviews' }, { status: 403 });
    }

    const body = await request.json();
    const { productId, rating, comment, mediaUrls } = body;

    if (!productId || !rating || !comment) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
    }

    if (!comment.trim()) {
      return NextResponse.json({ error: 'Comment is required' }, { status: 400 });
    }

    // Get product to find vendor
    const productResult = await query<{ vendor_id: string }>(
      'SELECT vendor_id FROM products WHERE id = $1',
      [productId]
    );

    if (!productResult.rows[0]) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Check if buyer has purchased this product (for verified purchase badge)
    const orderResult = await query<{ id: string }>(
      `SELECT o.id FROM orders o
       WHERE o.buyer_id = $1 
       AND o.status IN ('delivered', 'completed', 'shipped')
       AND o.items::text LIKE $2`,
      [session.userId, `%${productId}%`]
    );
    const isVerifiedPurchase = orderResult.rows.length > 0;

    const review = await createReview({
      productId,
      buyerId: session.userId,
      vendorId: productResult.rows[0].vendor_id,
      rating,
      comment: comment.trim(),
      isVerifiedPurchase,
      mediaUrls: mediaUrls || [],
    });

    if (!review) {
      return NextResponse.json({ error: 'You have already reviewed this product' }, { status: 409 });
    }

    // Audit log
    await createAuditLog({
      action: 'REVIEW_CREATED',
      category: 'product',
      targetId: review.id,
      targetType: 'review',
      targetName: `Review for product ${productId}`,
      details: JSON.stringify({ productId, rating, buyerId: session.userId }),
    });

    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    console.error('[REVIEWS_API] POST Error:', error);
    return NextResponse.json({ error: 'Failed to create review' }, { status: 500 });
  }
}
