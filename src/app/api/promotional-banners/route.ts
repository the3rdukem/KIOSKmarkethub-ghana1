import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken } from '@/lib/db/dal/auth-service';
import { cookies } from 'next/headers';
import { promotionalBannersDAL } from '@/lib/db/dal/promotional-banners';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const position = searchParams.get('position');
    const activeOnly = searchParams.get('active') === 'true';

    let banners;
    if (position) {
      banners = await promotionalBannersDAL.getBannersByPosition(position);
    } else if (activeOnly) {
      banners = await promotionalBannersDAL.getActiveBanners();
    } else {
      banners = await promotionalBannersDAL.getAllBanners();
    }

    return NextResponse.json({ banners });
  } catch (error) {
    console.error('[PROMO_BANNERS] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch banners' }, { status: 500 });
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
    const { title, description, image_url, video_url, media_type, link_url, position, is_active, start_date, end_date } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    if (!position) {
      return NextResponse.json({ error: 'Position is required' }, { status: 400 });
    }

    if (media_type === 'video') {
      if (!video_url) {
        return NextResponse.json({ error: 'Video URL is required for video banners' }, { status: 400 });
      }
    } else {
      if (!image_url) {
        return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
      }
    }

    const banner = await promotionalBannersDAL.createBanner({
      title,
      description,
      image_url,
      video_url,
      media_type: media_type || 'image',
      link_url,
      position,
      is_active: is_active !== false,
      start_date,
      end_date,
    });

    return NextResponse.json({ banner }, { status: 201 });
  } catch (error) {
    console.error('[PROMO_BANNERS] POST error:', error);
    return NextResponse.json({ error: 'Failed to create banner' }, { status: 500 });
  }
}
