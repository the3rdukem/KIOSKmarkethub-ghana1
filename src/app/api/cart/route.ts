/**
 * Cart API Route
 *
 * Server-side cart management with ownership validation.
 * Supports both guest (session_id) and authenticated (user_id) carts.
 * 
 * CRITICAL SECURITY RULES:
 * - Every cart fetch MUST validate ownership
 * - If ownership mismatch detected, reject with 403
 * - Never return a cart that doesn't match identity
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSessionToken } from '@/lib/db/dal/auth-service';
import { 
  getOrCreateCart, 
  addItemToCart, 
  removeItemFromCart, 
  updateItemQuantity, 
  clearCart,
  CartItem,
  CartOwnerType
} from '@/lib/db/dal/cart';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const GUEST_SESSION_COOKIE = 'guest_session_id';

async function getCartIdentity(request: NextRequest): Promise<{
  ownerType: CartOwnerType;
  ownerId: string;
  userId?: string;
  guestSessionId?: string;
}> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session_token')?.value;
  
  if (sessionToken) {
    const sessionResult = await validateSessionToken(sessionToken);
    if (sessionResult.success && sessionResult.data?.user) {
      return {
        ownerType: 'user',
        ownerId: sessionResult.data.user.id,
        userId: sessionResult.data.user.id,
        guestSessionId: cookieStore.get(GUEST_SESSION_COOKIE)?.value,
      };
    }
  }
  
  let guestSessionId = cookieStore.get(GUEST_SESSION_COOKIE)?.value;
  
  if (!guestSessionId) {
    guestSessionId = `guest_${uuidv4().replace(/-/g, '').substring(0, 24)}`;
  }
  
  return {
    ownerType: 'guest',
    ownerId: guestSessionId,
    guestSessionId,
  };
}

export async function GET(request: NextRequest) {
  try {
    const identity = await getCartIdentity(request);
    const cart = await getOrCreateCart(identity.ownerType, identity.ownerId);
    
    const response = NextResponse.json({
      success: true,
      cart: {
        id: cart.id,
        items: cart.items,
        ownerType: cart.ownerType,
      },
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
    
    if (identity.ownerType === 'guest' && identity.guestSessionId) {
      response.cookies.set(GUEST_SESSION_COOKIE, identity.guestSessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      });
    }
    
    return response;
  } catch (error) {
    console.error('[CART_API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get cart' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const identity = await getCartIdentity(request);
    const body = await request.json();
    const { action, item, itemId, quantity } = body;
    
    let cart;
    
    switch (action) {
      case 'add':
        if (!item) {
          return NextResponse.json({ error: 'Item required' }, { status: 400 });
        }
        cart = await addItemToCart(identity.ownerType, identity.ownerId, item as CartItem);
        break;
        
      case 'remove':
        if (!itemId) {
          return NextResponse.json({ error: 'Item ID required' }, { status: 400 });
        }
        cart = await removeItemFromCart(identity.ownerType, identity.ownerId, itemId);
        break;
        
      case 'update_quantity':
        if (!itemId || quantity === undefined) {
          return NextResponse.json({ error: 'Item ID and quantity required' }, { status: 400 });
        }
        cart = await updateItemQuantity(identity.ownerType, identity.ownerId, itemId, quantity);
        break;
        
      case 'clear':
        await clearCart(identity.ownerType, identity.ownerId);
        cart = await getOrCreateCart(identity.ownerType, identity.ownerId);
        break;
        
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    
    const response = NextResponse.json({
      success: true,
      cart: {
        id: cart.id,
        items: cart.items,
        ownerType: cart.ownerType,
      },
    });
    
    if (identity.ownerType === 'guest' && identity.guestSessionId) {
      response.cookies.set(GUEST_SESSION_COOKIE, identity.guestSessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      });
    }
    
    return response;
  } catch (error) {
    console.error('[CART_API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to update cart' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const identity = await getCartIdentity(request);
    await clearCart(identity.ownerType, identity.ownerId);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[CART_API] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to clear cart' },
      { status: 500 }
    );
  }
}
