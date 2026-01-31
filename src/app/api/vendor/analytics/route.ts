/**
 * Vendor Analytics API Route
 * 
 * Returns comprehensive analytics for the vendor dashboard.
 * Supports date range filtering and time bucket grouping.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSessionToken } from '@/lib/db/dal/auth-service';
import { 
  getVendorAnalytics, 
  DateRange, 
  TimeBucket 
} from '@/lib/db/dal/vendor-analytics';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const VALID_RANGES: DateRange[] = ['7d', '30d', '90d', '1y', 'all'];
const VALID_BUCKETS: TimeBucket[] = ['day', 'week', 'month'];

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const result = await validateSessionToken(sessionToken);
    if (!result.success || !result.data?.session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { session } = result.data;
    if (session.userRole !== 'vendor') {
      return NextResponse.json({ error: 'Vendor access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const rangeParam = searchParams.get('range') || '30d';
    const bucketParam = searchParams.get('bucket') || 'day';

    const range: DateRange = VALID_RANGES.includes(rangeParam as DateRange) 
      ? (rangeParam as DateRange) 
      : '30d';
    const bucket: TimeBucket = VALID_BUCKETS.includes(bucketParam as TimeBucket)
      ? (bucketParam as TimeBucket)
      : 'day';

    const analytics = await getVendorAnalytics(session.userId, range, bucket);

    const response = NextResponse.json({
      success: true,
      data: analytics,
    });

    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return response;
  } catch (error) {
    console.error('[VENDOR ANALYTICS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
