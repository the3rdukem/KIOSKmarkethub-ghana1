/**
 * User API Route
 *
 * Operations for a specific user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import {
  getUserById,
  updateUser,
  softDeleteUser,
  deleteUser,
  type UpdateUserInput,
} from '@/lib/db/dal/users';
import { logAdminAction } from '@/lib/db/dal/audit';
import { getAdminById } from '@/lib/db/dal/admin';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/users/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Verify authentication
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Users can view their own profile, admins can view any
    if (session.user_id !== id && session.user_role !== 'admin' && session.user_role !== 'master_admin') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const user = await getUserById(id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        avatar: user.avatar,
        phone: user.phone,
        location: user.location,
        businessName: user.business_name,
        businessType: user.business_type,
        verificationStatus: user.verification_status,
        verificationNotes: user.verification_notes,
        verifiedAt: user.verified_at,
        storeDescription: user.store_description,
        storeBanner: user.store_banner,
        storeLogo: user.store_logo,
        isDeleted: user.is_deleted === 1,
        lastLoginAt: user.last_login_at,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

/**
 * PUT /api/users/[id]
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Verify authentication
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const user = await getUserById(id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Users can update their own profile, admins can update any
    const isAdmin = session.user_role === 'admin' || session.user_role === 'master_admin';
    const isOwnProfile = session.user_id === id;

    if (!isOwnProfile && !isAdmin) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const body = await request.json();
    const updates: UpdateUserInput = {};

    // Fields users can update on their own profile
    if (body.name !== undefined) updates.name = body.name;
    if (body.avatar !== undefined) updates.avatar = body.avatar;
    if (body.phone !== undefined) updates.phone = body.phone;
    if (body.location !== undefined) updates.location = body.location;

    // Vendor-specific fields (vendors can update their own)
    if (user.role === 'vendor' && isOwnProfile) {
      if (body.businessName !== undefined) updates.businessName = body.businessName;
      if (body.businessType !== undefined) updates.businessType = body.businessType;
      if (body.storeDescription !== undefined) updates.storeDescription = body.storeDescription;
      if (body.storeBanner !== undefined) updates.storeBanner = body.storeBanner;
      if (body.storeLogo !== undefined) updates.storeLogo = body.storeLogo;
    }

    // Admin-only fields
    if (isAdmin) {
      if (body.status !== undefined) updates.status = body.status;
      if (body.verificationStatus !== undefined) updates.verificationStatus = body.verificationStatus;
      if (body.verificationNotes !== undefined) updates.verificationNotes = body.verificationNotes;
      if (body.verifiedAt !== undefined) updates.verifiedAt = body.verifiedAt;
      if (body.verifiedBy !== undefined) updates.verifiedBy = body.verifiedBy;

      // Log admin action
      const admin = await getAdminById(session.user_id);
      if (admin) {
        await logAdminAction('USER_UPDATED', {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
        }, {
          category: 'user',
          targetId: id,
          targetType: 'user',
          targetName: user.name,
          details: `Updated user: ${JSON.stringify(Object.keys(updates))}`,
        });
      }
    }

    const updatedUser = await updateUser(id, updates);

    if (!updatedUser) {
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        status: updatedUser.status,
        updatedAt: updatedUser.updated_at,
      },
    });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

/**
 * DELETE /api/users/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Verify authentication
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Only admins can delete users
    if (session.user_role !== 'admin' && session.user_role !== 'master_admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const user = await getUserById(id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const permanent = searchParams.get('permanent') === 'true';
    const reason = searchParams.get('reason') || 'Deleted by admin';

    let success: boolean;
    if (permanent && session.user_role === 'master_admin') {
      success = await deleteUser(id);
    } else {
      success = await softDeleteUser(id, session.user_id, reason);
    }

    if (!success) {
      return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
    }

    // Log admin action
    const admin = await getAdminById(session.user_id);
    if (admin) {
      await logAdminAction(permanent ? 'USER_PERMANENTLY_DELETED' : 'USER_SOFT_DELETED', {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      }, {
        category: 'user',
        targetId: id,
        targetType: 'user',
        targetName: user.name,
        details: reason,
        severity: 'critical',
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
