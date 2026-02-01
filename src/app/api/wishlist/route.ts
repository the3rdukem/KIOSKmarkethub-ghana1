import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import { getWishlistByUser, addToWishlist, mergeWishlist } from '@/lib/db/dal/wishlist';
import { withRateLimit } from '@/lib/utils/rate-limiter';

export async function GET(request: NextRequest) {
  try {
    const rateLimitCheck = await withRateLimit(request, 'api_public_read');
    if (!rateLimitCheck.allowed) {
      return rateLimitCheck.response;
    }

    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ items: [], authenticated: false });
    }

    const session = await validateSession(sessionToken);
    if (!session) {
      return NextResponse.json({ items: [], authenticated: false });
    }

    const items = await getWishlistByUser(session.user_id);
    return NextResponse.json({ items, authenticated: true });
  } catch (error) {
    console.error('Failed to fetch wishlist:', error);
    return NextResponse.json({ error: 'Failed to fetch wishlist' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const body = await request.json();
    const { productId, localItems } = body;

    if (localItems && Array.isArray(localItems)) {
      const merged = await mergeWishlist(localItems, session.user_id);
      const items = await getWishlistByUser(session.user_id);
      return NextResponse.json({ merged, items });
    }

    if (!productId) {
      return NextResponse.json({ error: 'Product ID required' }, { status: 400 });
    }

    const item = await addToWishlist(session.user_id, productId);
    if (!item) {
      return NextResponse.json({ error: 'Failed to add to wishlist' }, { status: 500 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    console.error('Failed to add to wishlist:', error);
    return NextResponse.json({ error: 'Failed to add to wishlist' }, { status: 500 });
  }
}
