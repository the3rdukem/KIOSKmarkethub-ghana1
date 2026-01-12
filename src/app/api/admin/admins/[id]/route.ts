/**
 * Admin Admin User Actions API
 * 
 * Actions on specific admin users (revoke, update).
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import { getAdminById, revokeAdminAccess, updateAdmin, deleteAdmin } from '@/lib/db/dal/admin';
import { createAuditLog } from '@/lib/db/dal/audit';
import { getUserById } from '@/lib/db/dal/users';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
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
    const { action, reason } = body;

    const targetAdmin = await getAdminById(id);
    if (!targetAdmin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    const adminUser = await getUserById(session.user_id);

    if (action === 'revoke') {
      const success = await revokeAdminAccess(id);
      
      if (!success) {
        return NextResponse.json({ error: 'Cannot revoke access' }, { status: 400 });
      }

      await createAuditLog({
        action: 'ADMIN_ACCESS_REVOKED',
        category: 'admin',
        adminId: session.user_id,
        adminName: adminUser?.name || 'Master Admin',
        adminEmail: adminUser?.email,
        adminRole: session.user_role,
        targetId: id,
        targetType: 'admin',
        targetName: targetAdmin.email,
        details: `Revoked admin access for ${targetAdmin.email}. Reason: ${reason || 'Not specified'}`,
        severity: 'warning',
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
      });

      return NextResponse.json({ success: true });
    }

    if (action === 'activate') {
      const updated = await updateAdmin(id, { isActive: true });
      
      if (!updated) {
        return NextResponse.json({ error: 'Failed to activate admin' }, { status: 500 });
      }

      await createAuditLog({
        action: 'ADMIN_ACTIVATED',
        category: 'admin',
        adminId: session.user_id,
        adminName: adminUser?.name || 'Master Admin',
        targetId: id,
        targetType: 'admin',
        targetName: targetAdmin.email,
        details: `Activated admin account for ${targetAdmin.email}`,
        severity: 'info',
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Admin action error:', error);
    return NextResponse.json({ error: 'Failed to perform action' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
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

    const targetAdmin = await getAdminById(id);
    if (!targetAdmin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    if (id === 'master_admin_001') {
      return NextResponse.json({ error: 'Cannot delete the original master admin' }, { status: 403 });
    }

    if (id === session.user_id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    const adminUser = await getUserById(session.user_id);
    const success = await deleteAdmin(id);
    
    if (!success) {
      return NextResponse.json({ error: 'Cannot delete admin. This may be the last master admin.' }, { status: 400 });
    }

    await createAuditLog({
      action: 'ADMIN_DELETED',
      category: 'admin',
      adminId: session.user_id,
      adminName: adminUser?.name || 'Master Admin',
      adminEmail: adminUser?.email,
      adminRole: session.user_role,
      targetId: id,
      targetType: 'admin',
      targetName: targetAdmin.email,
      details: `Permanently deleted admin account: ${targetAdmin.email}`,
      severity: 'critical',
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin delete error:', error);
    return NextResponse.json({ error: 'Failed to delete admin' }, { status: 500 });
  }
}
