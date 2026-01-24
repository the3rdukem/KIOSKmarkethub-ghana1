import { NextRequest, NextResponse } from 'next/server';
import { getUserById } from '@/lib/db/dal/users';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const user = await getUserById(id);
    if (!user || user.role !== 'vendor') {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    if (user.status !== 'active') {
      return NextResponse.json({ error: 'Vendor not available' }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        status: user.status,
        avatar: user.avatar,
        location: user.location,
        businessName: user.business_name,
        businessType: user.business_type,
        verificationStatus: user.verification_status,
        storeDescription: user.store_description,
        storeBanner: user.store_banner,
        storeLogo: user.store_logo,
        storeStatus: user.store_status || 'open',
        storeVacationMessage: user.store_vacation_message || '',
        storeRating: user.store_rating || 0,
        storeResponseTime: user.store_response_time || '< 24 hours',
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error('Get vendor error:', error);
    return NextResponse.json({ error: 'Failed to fetch vendor' }, { status: 500 });
  }
}
