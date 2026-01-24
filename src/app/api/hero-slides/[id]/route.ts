import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken } from '@/lib/db/dal/auth-service';
import { cookies } from 'next/headers';
import * as heroSlidesDAL from '@/lib/db/dal/hero-slides';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const slide = await heroSlidesDAL.getHeroSlideById(id);

    if (!slide) {
      return NextResponse.json({ error: 'Slide not found' }, { status: 404 });
    }

    return NextResponse.json({ slide });
  } catch (error) {
    console.error('[HERO_SLIDES] GET by ID error:', error);
    return NextResponse.json({ error: 'Failed to fetch slide' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await validateSessionToken(sessionToken);
    if (!result.success || !result.data?.session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { session } = result.data;
    if (session.userRole !== 'admin' && session.userRole !== 'master_admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const slide = await heroSlidesDAL.updateHeroSlide(id, body);

    if (!slide) {
      return NextResponse.json({ error: 'Slide not found' }, { status: 404 });
    }

    return NextResponse.json({ slide });
  } catch (error) {
    console.error('[HERO_SLIDES] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update slide' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await validateSessionToken(sessionToken);
    if (!result.success || !result.data?.session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { session } = result.data;
    if (session.userRole !== 'admin' && session.userRole !== 'master_admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const deleted = await heroSlidesDAL.deleteHeroSlide(id);

    if (!deleted) {
      return NextResponse.json({ error: 'Slide not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[HERO_SLIDES] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete slide' }, { status: 500 });
  }
}
