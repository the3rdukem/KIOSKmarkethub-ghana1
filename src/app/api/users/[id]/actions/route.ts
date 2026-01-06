/**
 * User Actions API Route
 *
 * Actions for a specific user (admin only).
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import { getUserById, updateUser } from '@/lib/db/dal/users';
import { logAdminAction } from '@/lib/db/dal/audit';
import { getAdminById } from '@/lib/db/dal/admin';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/users/[id]/actions
 *
 * Perform actions on a user:
 * - suspend: Suspend user account
 * - activate: Activate user account
 * - ban: Ban user account
 * - approve_vendor: Approve vendor verification
 * - reject_vendor: Reject vendor verification
 * - request_docs: Request additional documents
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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

    // Only admins can perform user actions
    if (session.user_role !== 'admin' && session.user_role !== 'master_admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const user = await getUserById(id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const admin = await getAdminById(session.user_id);
    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    const body = await request.json();
    const { action, reason } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    switch (action) {
      case 'suspend': {
        if (!reason) {
          return NextResponse.json({ error: 'Reason is required for suspension' }, { status: 400 });
        }

        const result = await updateUser(id, { status: 'suspended' });
        if (!result) {
          return NextResponse.json({ error: 'Failed to suspend user' }, { status: 500 });
        }

        await logAdminAction('USER_SUSPENDED', {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
        }, {
          category: 'user',
          targetId: id,
          targetType: 'user',
          targetName: user.name,
          details: `Suspended: ${reason}`,
          previousValue: user.status,
          newValue: 'suspended',
        });

        return NextResponse.json({ success: true, message: 'User suspended' });
      }

      case 'activate': {
        const result = await updateUser(id, { status: 'active' });
        if (!result) {
          return NextResponse.json({ error: 'Failed to activate user' }, { status: 500 });
        }

        await logAdminAction('USER_ACTIVATED', {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
        }, {
          category: 'user',
          targetId: id,
          targetType: 'user',
          targetName: user.name,
          details: 'User activated',
          previousValue: user.status,
          newValue: 'active',
        });

        return NextResponse.json({ success: true, message: 'User activated' });
      }

      case 'ban': {
        if (!reason) {
          return NextResponse.json({ error: 'Reason is required for ban' }, { status: 400 });
        }

        const result = await updateUser(id, { status: 'banned' });
        if (!result) {
          return NextResponse.json({ error: 'Failed to ban user' }, { status: 500 });
        }

        await logAdminAction('USER_BANNED', {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
        }, {
          category: 'user',
          targetId: id,
          targetType: 'user',
          targetName: user.name,
          details: `Banned: ${reason}`,
          previousValue: user.status,
          newValue: 'banned',
          severity: 'critical',
        });

        return NextResponse.json({ success: true, message: 'User banned' });
      }

      case 'approve_vendor': {
        if (user.role !== 'vendor') {
          return NextResponse.json({ error: 'User is not a vendor' }, { status: 400 });
        }

        const result = await updateUser(id, {
          verificationStatus: 'verified',
          status: 'active',
          verifiedAt: new Date().toISOString(),
          verifiedBy: session.user_id,
        });

        if (!result) {
          return NextResponse.json({ error: 'Failed to approve vendor' }, { status: 500 });
        }

        await logAdminAction('VENDOR_APPROVED', {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
        }, {
          category: 'vendor',
          targetId: id,
          targetType: 'vendor',
          targetName: user.business_name || user.name,
          details: 'Vendor application approved',
          previousValue: user.verification_status || 'pending',
          newValue: 'verified',
        });

        return NextResponse.json({ success: true, message: 'Vendor approved' });
      }

      case 'reject_vendor': {
        if (user.role !== 'vendor') {
          return NextResponse.json({ error: 'User is not a vendor' }, { status: 400 });
        }

        if (!reason) {
          return NextResponse.json({ error: 'Reason is required for rejection' }, { status: 400 });
        }

        const result = await updateUser(id, {
          verificationStatus: 'rejected',
          verificationNotes: reason,
        });

        if (!result) {
          return NextResponse.json({ error: 'Failed to reject vendor' }, { status: 500 });
        }

        await logAdminAction('VENDOR_REJECTED', {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
        }, {
          category: 'vendor',
          targetId: id,
          targetType: 'vendor',
          targetName: user.business_name || user.name,
          details: `Vendor rejected: ${reason}`,
          previousValue: user.verification_status || 'pending',
          newValue: 'rejected',
        });

        return NextResponse.json({ success: true, message: 'Vendor rejected' });
      }

      case 'request_docs': {
        if (user.role !== 'vendor') {
          return NextResponse.json({ error: 'User is not a vendor' }, { status: 400 });
        }

        if (!reason) {
          return NextResponse.json({ error: 'Request details are required' }, { status: 400 });
        }

        const result = await updateUser(id, {
          verificationStatus: 'under_review',
          verificationNotes: reason,
        });

        if (!result) {
          return NextResponse.json({ error: 'Failed to request documents' }, { status: 500 });
        }

        await logAdminAction('VENDOR_DOCS_REQUESTED', {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
        }, {
          category: 'vendor',
          targetId: id,
          targetType: 'vendor',
          targetName: user.business_name || user.name,
          details: `Additional documents requested: ${reason}`,
        });

        return NextResponse.json({ success: true, message: 'Document request sent' });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('User action error:', error);
    return NextResponse.json({ error: 'Failed to perform action' }, { status: 500 });
  }
}
