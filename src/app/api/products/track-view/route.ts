import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { trackProductView } from '@/lib/db/dal/promotions';
import { validateSession } from '@/lib/db/dal/sessions';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { product_id, session_id } = body;
    
    if (!product_id) {
      return NextResponse.json({ error: 'Product ID required' }, { status: 400 });
    }
    
    // Get user ID if authenticated
    let userId: string | undefined;
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;
    
    if (sessionToken) {
      const session = await validateSession(sessionToken);
      if (session) {
        userId = session.user_id;
      }
    }
    
    // Track the view (fire and forget pattern - don't wait for response)
    trackProductView(product_id, userId, session_id).catch(err => {
      console.error('[API] Error tracking product view:', err);
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error in track-view:', error);
    return NextResponse.json({ error: 'Failed to track view' }, { status: 500 });
  }
}
