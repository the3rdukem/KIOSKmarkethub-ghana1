/**
 * Admin Admins API Route
 * 
 * Fetch and manage admin users from the database.
 * Only accessible by master_admin role.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import { getAllAdmins, createAdminUser, type AdminRole, type AdminPermission, ADMIN_PERMISSIONS, MASTER_ADMIN_PERMISSIONS } from '@/lib/db/dal/admin';
import { createAuditLog } from '@/lib/db/dal/audit';
import { getUserById } from '@/lib/db/dal/users';

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

    const admins = await getAllAdmins();

    const transformedAdmins = admins.map((admin) => ({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      isActive: admin.is_active === 1,
      permissions: admin.permissions ? JSON.parse(admin.permissions) : [],
      mfaEnabled: admin.mfa_enabled === 1,
      createdBy: admin.created_by,
      lastLoginAt: admin.last_login_at,
      createdAt: admin.created_at,
      updatedAt: admin.updated_at,
    }));

    return NextResponse.json({
      admins: transformedAdmins,
      total: transformedAdmins.length,
    });
  } catch (error) {
    console.error('Get admins error:', error);
    return NextResponse.json({ error: 'Failed to fetch admins' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

    if (session.user_role !== 'master_admin') {
      return NextResponse.json({ error: 'Master admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { email, password, name, role } = body;

    if (!email || !password || !name || !role) {
      return NextResponse.json(
        { error: 'Email, password, name, and role are required' },
        { status: 400 }
      );
    }

    const validRoles: AdminRole[] = ['ADMIN', 'MASTER_ADMIN'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const permissions: AdminPermission[] = role === 'MASTER_ADMIN' 
      ? MASTER_ADMIN_PERMISSIONS 
      : ADMIN_PERMISSIONS;

    const admin = await createAdminUser({
      email,
      password,
      name,
      role,
      permissions,
      createdBy: session.user_id,
    });

    const adminUser = await getUserById(session.user_id);

    await createAuditLog({
      action: 'ADMIN_CREATED',
      category: 'admin',
      adminId: session.user_id,
      adminName: adminUser?.name || 'Master Admin',
      adminEmail: adminUser?.email,
      adminRole: session.user_role,
      targetId: admin.id,
      targetType: 'admin',
      targetName: admin.email,
      details: `Created admin account for ${email} with role ${role}`,
      severity: 'info',
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    });

    return NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        isActive: admin.is_active === 1,
        permissions: admin.permissions ? JSON.parse(admin.permissions) : [],
        createdAt: admin.created_at,
      },
    });
  } catch (error) {
    console.error('Create admin error:', error);
    return NextResponse.json({ error: 'Failed to create admin' }, { status: 500 });
  }
}
