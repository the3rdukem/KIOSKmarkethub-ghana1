/**
 * Admin Analytics API Route
 * 
 * Returns comprehensive platform analytics for the admin dashboard.
 * Supports date range filtering and time bucket grouping.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import { 
  getAdminAnalytics, 
  DateRange, 
  TimeBucket 
} from '@/lib/db/dal/admin-analytics';

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

    const session = await validateSession(sessionToken);
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    if (session.user_role !== 'admin' && session.user_role !== 'master_admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
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

    const analytics = await getAdminAnalytics(range, bucket);

    const response = NextResponse.json({
      success: true,
      data: analytics,
    });

    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return response;
  } catch (error) {
    console.error('[ADMIN ANALYTICS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
