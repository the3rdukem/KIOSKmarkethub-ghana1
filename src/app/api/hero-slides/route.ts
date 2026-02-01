import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken } from '@/lib/db/dal/auth-service';
import { cookies } from 'next/headers';
import * as heroSlidesDAL from '@/lib/db/dal/hero-slides';
import { withRateLimit } from '@/lib/utils/rate-limiter';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const rateLimitCheck = await withRateLimit(request, 'api_public_read');
    if (!rateLimitCheck.allowed) {
      return rateLimitCheck.response;
    }

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';

    const slides = activeOnly 
      ? await heroSlidesDAL.getActiveHeroSlides()
      : await heroSlidesDAL.getAllHeroSlides();

    return NextResponse.json({ slides });
  } catch (error) {
    console.error('[HERO_SLIDES] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch slides' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { title, subtitle, image_url, link_url, order_num, is_active, media_type, video_url } = body;

    if (!image_url) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }

    if (media_type === 'video' && !video_url) {
      return NextResponse.json({ error: 'Video URL is required for video slides' }, { status: 400 });
    }

    const slide = await heroSlidesDAL.createHeroSlide({
      title,
      subtitle,
      image_url,
      link_url,
      order_num,
      is_active,
      media_type: media_type || 'image',
      video_url,
    });

    return NextResponse.json({ slide }, { status: 201 });
  } catch (error) {
    console.error('[HERO_SLIDES] POST error:', error);
    return NextResponse.json({ error: 'Failed to create slide' }, { status: 500 });
  }
}
