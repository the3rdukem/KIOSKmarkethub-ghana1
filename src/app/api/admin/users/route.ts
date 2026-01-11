/**
 * Admin Users API Route
 *
 * Admin-only endpoints for user management.
 * Uses canonical createUser() for all user creation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import { getUsers, getUserById, updateUser, type UserRole } from '@/lib/db/dal/users';
import { createUser, type AuthUser } from '@/lib/db/dal/auth-service';
import { createAuditLog } from '@/lib/db/dal/audit';

/**
 * GET /api/admin/users
 *
 * Get all users (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Only admins can access
    if (session.user_role !== 'admin' && session.user_role !== 'master_admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role') as UserRole | null;
    const status = searchParams.get('status') as string | null;
    const includeDeleted = searchParams.get('includeDeleted') === 'true';

    // Fetch users from database
    const users = await getUsers({
      role: role || undefined,
      status: status as 'active' | 'suspended' | 'pending' | 'banned' | 'deleted' | undefined,
      includeDeleted,
    });

    // Transform for client
    const transformedUsers = users.map((user) => ({
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
      isDeleted: user.is_deleted === 1,
      lastLoginAt: user.last_login_at,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    }));

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
 * POST /api/admin/users
 *
 * Create a new user (admin only)
 * Uses CANONICAL createUser() for all user types
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Only admins can create users
    if (session.user_role !== 'admin' && session.user_role !== 'master_admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { email, password, name, role, phone, location, businessName, businessType } = body;

    // Validate required fields
    if (!email || !password || !name || !role) {
      return NextResponse.json(
        { error: 'Email, password, name, and role are required' },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles: UserRole[] = ['buyer', 'vendor', 'admin', 'master_admin'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Only master_admin can create other admins
    if ((role === 'admin' || role === 'master_admin') && session.user_role !== 'master_admin') {
      return NextResponse.json(
        { error: 'Only master admins can create admin accounts' },
        { status: 403 }
      );
    }

    // Vendor-specific validation
    if (role === 'vendor' && !businessName) {
      return NextResponse.json(
        { error: 'Business name is required for vendor accounts' },
        { status: 400 }
      );
    }

    // Use CANONICAL createUser() - same as registration
    const result = await createUser(
      {
        email,
        password,
        name,
        role,
        phone,
        location,
        businessName,
        businessType,
      },
      {
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
        createSession: false, // Admin-created users don't need immediate session
      }
    );

    if (!result.success || !result.data) {
      return NextResponse.json(
        {
          error: result.error?.message || 'Failed to create user',
          code: result.error?.code,
        },
        { status: 400 }
      );
    }

    const createdUser = result.data.user;

    // Set created_by for admin accounts (for deletion permission tracking)
    if (role === 'admin') {
      await updateUser(createdUser.id, { createdBy: session.user_id });
    }

    // Get admin info for audit log
    const adminUser = await getUserById(session.user_id);

    // Log admin user creation
    await createAuditLog({
      action: 'ADMIN_USER_CREATED',
      category: 'admin',
      adminId: session.user_id,
      adminName: adminUser?.name || 'Admin',
      adminEmail: adminUser?.email,
      adminRole: session.user_role,
      targetId: createdUser.id,
      targetType: 'user',
      targetName: createdUser.email,
      details: `Admin created ${role} account for ${email}`,
      severity: 'info',
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    console.log('[ADMIN_CREATE_USER] Success:', {
      userId: createdUser.id,
      email: createdUser.email,
      role: createdUser.role,
      createdBy: session.user_id,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: createdUser.id,
        email: createdUser.email,
        name: createdUser.name,
        role: createdUser.role,
        status: createdUser.status,
        phone: createdUser.phone,
        location: createdUser.location,
        businessName: createdUser.businessName,
        businessType: createdUser.businessType,
        verificationStatus: createdUser.verificationStatus,
        createdAt: createdUser.createdAt,
      },
      message: `${role} account created successfully. User can now log in.`,
    });
  } catch (error) {
    console.error('Admin create user error:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/users
 *
 * Update user verification status (admin only)
 */
export async function PATCH(request: NextRequest) {
  try {
    // Verify admin authentication
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Only admins can update users
    if (session.user_role !== 'admin' && session.user_role !== 'master_admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, action, reason } = body;

    if (!userId || !action) {
      return NextResponse.json({ error: 'userId and action are required' }, { status: 400 });
    }

    const targetUser = await getUserById(userId);
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const adminUser = await getUserById(session.user_id);
    const now = new Date().toISOString();

    let updates: Parameters<typeof updateUser>[1] = {};
    let auditAction = '';
    let auditDetails = '';

    switch (action) {
      case 'approve_verification':
        if (targetUser.role !== 'vendor') {
          return NextResponse.json({ error: 'Only vendors can be verified' }, { status: 400 });
        }
        updates = {
          verificationStatus: 'verified',
          verifiedAt: now,
          verifiedBy: session.user_id,
          verificationNotes: reason || 'Approved by admin',
          status: 'active',
        };
        auditAction = 'VENDOR_VERIFICATION_APPROVED';
        auditDetails = `Approved vendor verification for ${targetUser.email}`;
        break;

      case 'reject_verification':
        if (targetUser.role !== 'vendor') {
          return NextResponse.json({ error: 'Only vendors can be verified' }, { status: 400 });
        }
        if (!reason) {
          return NextResponse.json({ error: 'Reason is required for rejection' }, { status: 400 });
        }
        updates = {
          verificationStatus: 'rejected',
          verificationNotes: reason,
        };
        auditAction = 'VENDOR_VERIFICATION_REJECTED';
        auditDetails = `Rejected vendor verification for ${targetUser.email}. Reason: ${reason}`;
        break;

      case 'suspend':
        if (!reason) {
          return NextResponse.json({ error: 'Reason is required for suspension' }, { status: 400 });
        }
        updates = {
          status: 'suspended',
        };
        auditAction = 'USER_SUSPENDED';
        auditDetails = `Suspended user ${targetUser.email}. Reason: ${reason}`;
        break;

      case 'activate':
        updates = {
          status: 'active',
        };
        auditAction = 'USER_ACTIVATED';
        auditDetails = `Activated user ${targetUser.email}`;
        break;

      case 'ban':
        if (!reason) {
          return NextResponse.json({ error: 'Reason is required for ban' }, { status: 400 });
        }
        updates = {
          status: 'banned',
        };
        auditAction = 'USER_BANNED';
        auditDetails = `Banned user ${targetUser.email}. Reason: ${reason}`;
        break;

      case 'delete':
        // Soft delete - prevent deleting super admin or self
        if (targetUser.role === 'master_admin') {
          return NextResponse.json({ error: 'Cannot delete super admin account' }, { status: 403 });
        }
        if (targetUser.id === session.user_id) {
          return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 403 });
        }
        // Admin accounts can only be deleted by master_admin
        if (targetUser.role === 'admin') {
          if (session.user_role !== 'master_admin') {
            return NextResponse.json({ error: 'Only master admin can delete admin accounts' }, { status: 403 });
          }
          // Master admin can delete any admin account (including legacy admins with NULL created_by)
        }
        if (!reason) {
          return NextResponse.json({ error: 'Reason is required for deletion' }, { status: 400 });
        }
        updates = {
          isDeleted: true,
          status: 'deleted',
        };
        auditAction = 'USER_DELETED';
        auditDetails = `Soft-deleted user ${targetUser.email}. Reason: ${reason}`;
        break;

      case 'permanent_delete':
        // Only master admin can permanently delete
        if (session.user_role !== 'master_admin') {
          return NextResponse.json({ error: 'Only super admin can permanently delete users' }, { status: 403 });
        }
        if (targetUser.role === 'master_admin') {
          return NextResponse.json({ error: 'Cannot permanently delete super admin account' }, { status: 403 });
        }
        if (targetUser.id === session.user_id) {
          return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 403 });
        }
        // Master admin can permanently delete any admin (including legacy admins with NULL created_by)
        // For now, implement as hard delete flag - actual data deletion would require more work
        updates = {
          isDeleted: true,
          status: 'deleted',
        };
        auditAction = 'USER_PERMANENTLY_DELETED';
        auditDetails = `Permanently deleted user ${targetUser.email}`;
        break;

      case 'restore':
        // Restore soft-deleted user
        if (targetUser.is_deleted !== 1) {
          return NextResponse.json({ error: 'User is not deleted' }, { status: 400 });
        }
        updates = {
          isDeleted: false,
          status: 'active',
        };
        auditAction = 'USER_RESTORED';
        auditDetails = `Restored user ${targetUser.email}`;
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const updatedUser = await updateUser(userId, updates);

    if (!updatedUser) {
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }

    // Log the action
    await createAuditLog({
      action: auditAction,
      category: action.includes('verification') ? 'vendor' : 'user',
      adminId: session.user_id,
      adminName: adminUser?.name || 'Admin',
      adminEmail: adminUser?.email,
      adminRole: session.user_role,
      targetId: userId,
      targetType: 'user',
      targetName: targetUser.email,
      details: auditDetails,
      previousValue: JSON.stringify({ status: targetUser.status, verificationStatus: targetUser.verification_status }),
      newValue: JSON.stringify(updates),
      severity: action === 'ban' || action === 'reject_verification' ? 'warning' : 'info',
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        status: updatedUser.status,
        verificationStatus: updatedUser.verification_status,
      },
      message: `User ${action.replace('_', ' ')} successfully`,
    });
  } catch (error) {
    console.error('Admin update user error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
