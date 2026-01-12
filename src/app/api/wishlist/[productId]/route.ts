import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import { removeFromWishlist, isInWishlist } from '@/lib/db/dal/wishlist';

interface RouteParams {
  params: Promise<{ productId: string }>;
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { productId } = await params;
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const removed = await removeFromWishlist(session.user_id, productId);
    return NextResponse.json({ removed });
  } catch (error) {
    console.error('Failed to remove from wishlist:', error);
    return NextResponse.json({ error: 'Failed to remove from wishlist' }, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { productId } = await params;
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ inWishlist: false, authenticated: false });
    }

    const session = await validateSession(sessionToken);
    if (!session) {
      return NextResponse.json({ inWishlist: false, authenticated: false });
    }

    const inWishlist = await isInWishlist(session.user_id, productId);
    return NextResponse.json({ inWishlist, authenticated: true });
  } catch (error) {
    console.error('Failed to check wishlist:', error);
    return NextResponse.json({ error: 'Failed to check wishlist' }, { status: 500 });
  }
}
