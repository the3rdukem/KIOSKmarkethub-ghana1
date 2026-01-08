/**
 * Cart Merge API Route
 *
 * Merges guest cart to authenticated user cart on login/registration.
 * Called after successful authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSessionToken } from '@/lib/db/dal/auth-service';
import { mergeGuestCartToUser } from '@/lib/db/dal/cart';

export const dynamic = 'force-dynamic';

const GUEST_SESSION_COOKIE = 'guest_session_id';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;
    const guestSessionId = cookieStore.get(GUEST_SESSION_COOKIE)?.value;
    
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    const sessionResult = await validateSessionToken(sessionToken);
    if (!sessionResult.success || !sessionResult.data?.user) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }
    
    const userId = sessionResult.data.user.id;
    
    if (!guestSessionId) {
      return NextResponse.json({
        success: true,
        message: 'No guest cart to merge',
        merged: false,
      });
    }
    
    const mergedCart = await mergeGuestCartToUser(guestSessionId, userId);
    
    const response = NextResponse.json({
      success: true,
      message: 'Cart merged successfully',
      merged: true,
      cart: {
        id: mergedCart.id,
        items: mergedCart.items,
        itemCount: mergedCart.items.length,
      },
    });
    
    response.cookies.set(GUEST_SESSION_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    
    return response;
  } catch (error) {
    console.error('[CART_MERGE_API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to merge cart' },
      { status: 500 }
    );
  }
}
