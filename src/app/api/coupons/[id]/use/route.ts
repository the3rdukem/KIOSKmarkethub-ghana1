import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/db/dal/sessions';
import { cookies } from 'next/headers';
import { incrementCouponUsage } from '@/lib/db/dal/promotions';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }
    
    const { id } = await params;
    
    await incrementCouponUsage(id);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[COUPON_USE]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
