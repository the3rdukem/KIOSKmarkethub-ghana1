/**
 * Individual Review API
 * 
 * GET: Get a single review
 * PATCH: Update review (buyer) or add reply (vendor) or moderate (admin)
 * DELETE: Soft delete review
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken } from '@/lib/db/dal/auth-service';
import { 
  getReviewById,
  updateReview,
  deleteReview,
  addVendorReply,
  moderateReview,
  markReviewHelpful
} from '@/lib/db/dal/reviews';
import { createAuditLog } from '@/lib/db/dal/audit';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function getSession(sessionToken: string) {
  const result = await validateSessionToken(sessionToken);
  if (!result.success || !result.data) return null;
  return {
    userId: result.data.session.userId,
    role: result.data.session.userRole,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const review = await getReviewById(id);

    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    return NextResponse.json({ review });
  } catch (error) {
    console.error('[REVIEW_API] GET Error:', error);
    return NextResponse.json({ error: 'Failed to fetch review' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sessionToken = request.cookies.get('session_token')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await getSession(sessionToken);
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const body = await request.json();
    const { action, rating, comment, mediaUrls, reply } = body;

    const review = await getReviewById(id);
    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    // Mark as helpful (any user can do this)
    if (action === 'helpful') {
      const success = await markReviewHelpful(id);
      if (!success) {
        return NextResponse.json({ error: 'Failed to mark as helpful' }, { status: 400 });
      }
      const updatedReview = await getReviewById(id);
      return NextResponse.json({ review: updatedReview });
    }

    // Vendor reply
    if (action === 'reply') {
      if (!reply || !reply.trim()) {
        return NextResponse.json({ error: 'Reply text is required' }, { status: 400 });
      }

      // Check if user is the vendor for this product
      // review.vendor_id stores user_id, not vendor entity id
      if (session.userId !== review.vendor_id) {
        return NextResponse.json({ error: 'Only the vendor can reply' }, { status: 403 });
      }

      const updatedReview = await addVendorReply(id, session.userId, reply.trim());
      if (!updatedReview) {
        return NextResponse.json({ error: 'Vendor has already replied' }, { status: 409 });
      }

      await createAuditLog({
        action: 'VENDOR_REPLIED_TO_REVIEW',
        category: 'product',
        targetId: id,
        targetType: 'review',
        details: JSON.stringify({ vendorId: review.vendor_id }),
      });

      return NextResponse.json({ review: updatedReview });
    }

    // Admin moderation
    if (action === 'hide' || action === 'unhide' || action === 'delete') {
      if (session.role !== 'admin' && session.role !== 'master_admin') {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }

      const updatedReview = await moderateReview(id, action);
      if (!updatedReview) {
        return NextResponse.json({ error: 'Moderation failed' }, { status: 400 });
      }

      await createAuditLog({
        action: `REVIEW_${action.toUpperCase()}`,
        category: 'admin',
        adminId: session.userId,
        targetId: id,
        targetType: 'review',
        details: JSON.stringify({ action, previousStatus: review.status, newStatus: updatedReview.status }),
        severity: action === 'delete' ? 'warning' : 'info',
      });

      return NextResponse.json({ review: updatedReview });
    }

    // Buyer update
    if (rating !== undefined || comment !== undefined || mediaUrls !== undefined) {
      if (session.userId !== review.buyer_id) {
        return NextResponse.json({ error: 'Only the reviewer can edit' }, { status: 403 });
      }

      const updatedReview = await updateReview(id, session.userId, {
        rating,
        comment: comment?.trim(),
        mediaUrls,
      });

      if (!updatedReview) {
        return NextResponse.json({ error: 'Update failed' }, { status: 400 });
      }

      await createAuditLog({
        action: 'REVIEW_EDITED',
        category: 'product',
        targetId: id,
        targetType: 'review',
        details: JSON.stringify({ buyerId: session.userId, rating, hasComment: !!comment }),
      });

      return NextResponse.json({ review: updatedReview });
    }

    return NextResponse.json({ error: 'No valid action provided' }, { status: 400 });
  } catch (error) {
    console.error('[REVIEW_API] PATCH Error:', error);
    return NextResponse.json({ error: 'Failed to update review' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sessionToken = request.cookies.get('session_token')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await getSession(sessionToken);
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const review = await getReviewById(id);
    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    // Admin can delete any review
    if (session.role === 'admin' || session.role === 'master_admin') {
      const result = await moderateReview(id, 'delete');
      if (!result) {
        return NextResponse.json({ error: 'Delete failed' }, { status: 400 });
      }

      await createAuditLog({
        action: 'REVIEW_DELETED_BY_ADMIN',
        category: 'admin',
        adminId: session.userId,
        targetId: id,
        targetType: 'review',
        severity: 'warning',
      });

      return NextResponse.json({ success: true });
    }

    // Buyer can only delete their own
    if (session.userId !== review.buyer_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const success = await deleteReview(id, session.userId);
    if (!success) {
      return NextResponse.json({ error: 'Delete failed' }, { status: 400 });
    }

    await createAuditLog({
      action: 'REVIEW_DELETED',
      category: 'product',
      targetId: id,
      targetType: 'review',
      details: JSON.stringify({ buyerId: session.userId }),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[REVIEW_API] DELETE Error:', error);
    return NextResponse.json({ error: 'Failed to delete review' }, { status: 500 });
  }
}
