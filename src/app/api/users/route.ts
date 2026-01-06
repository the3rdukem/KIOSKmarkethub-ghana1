/**
 * Users API Route
 *
 * CRUD operations for users (admin access required for most operations).
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import {
  getUsers,
  updateUser,
  searchUsers,
  getPendingVendors,
  getUserStats,
  type DbUser,
  type UserRole,
  type UserStatus,
} from '@/lib/db/dal/users';
import { logAdminAction } from '@/lib/db/dal/audit';
import { getAdminById } from '@/lib/db/dal/admin';

/**
 * GET /api/users
 *
 * Get users with optional filters (admin only)
 */
export async function GET(request: NextRequest) {
  try {
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

    // Only admins can list users
    if (session.user_role !== 'admin' && session.user_role !== 'master_admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role') as UserRole | null;
    const status = searchParams.get('status') as UserStatus | null;
    const search = searchParams.get('search');
    const pending = searchParams.get('pending');
    const stats = searchParams.get('stats');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    // Return stats if requested
    if (stats === 'true') {
      const userStats = await getUserStats();
      return NextResponse.json({ stats: userStats });
    }

    // Return pending vendors if requested
    if (pending === 'true') {
      const pendingVendors = await getPendingVendors();
      const transformedVendors = pendingVendors.map(transformUser);
      return NextResponse.json({ users: transformedVendors, total: transformedVendors.length });
    }

    // Search if query provided
    if (search) {
      const results = await searchUsers(search, {
        role: role || undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
      });
      const transformedUsers = results.map(transformUser);
      return NextResponse.json({ users: transformedUsers, total: transformedUsers.length });
    }

    // Get users with filters
    const users = await getUsers({
      role: role || undefined,
      status: status || undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });

    const transformedUsers = users.map(transformUser);

    return NextResponse.json({
      users: transformedUsers,
      total: transformedUsers.length,
    });
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

/**
 * Transform database user to client format
 */
function transformUser(user: DbUser | null) {
  if (!user) return null;
  return {
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
    verifiedBy: user.verified_by,
    storeDescription: user.store_description,
    storeBanner: user.store_banner,
    storeLogo: user.store_logo,
    isDeleted: user.is_deleted === 1,
    lastLoginAt: user.last_login_at,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}
