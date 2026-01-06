/**
 * Admin Vendors API Route
 *
 * CRUD operations for vendor entities.
 * Vendors are business entities linked to users.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import {
  getVendors,
  getVendorsWithUsers,
  getPendingVendors,
  getVendorById,
  getVendorByUserId,
  updateVendor,
  approveVendor,
  rejectVendor,
  suspendVendor,
  getVendorStats,
} from '@/lib/db/dal/vendors';
import { updateUser } from '@/lib/db/dal/users';
import { createAuditLog } from '@/lib/db/dal/audit';

/**
 * GET /api/admin/vendors
 *
 * Get vendors with optional filters (admin only)
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

    // Only admins can access vendor management
    if (session.user_role !== 'admin' && session.user_role !== 'master_admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const verificationStatus = searchParams.get('verificationStatus') as 'pending' | 'verified' | 'rejected' | 'suspended' | null;
    const storeStatus = searchParams.get('storeStatus') as 'active' | 'inactive' | 'suspended' | null;
    const pending = searchParams.get('pending');
    const stats = searchParams.get('stats');

    // Return stats if requested
    if (stats === 'true') {
      const vendorStats = await getVendorStats();
      return NextResponse.json({ stats: vendorStats });
    }

    // Return pending vendors if requested
    if (pending === 'true') {
      const pendingVendors = await getPendingVendors();
      return NextResponse.json({
        vendors: pendingVendors.map(v => ({
          id: v.id,
          userId: v.user_id,
          businessName: v.business_name,
          businessType: v.business_type,
          description: v.description,
          logo: v.logo,
          banner: v.banner,
          phone: v.phone,
          email: v.email,
          address: v.address,
          city: v.city,
          region: v.region,
          verificationStatus: v.verification_status,
          verificationNotes: v.verification_notes,
          storeStatus: v.store_status,
          userName: v.user_name,
          userEmail: v.user_email,
          createdAt: v.created_at,
          updatedAt: v.updated_at,
        })),
        total: pendingVendors.length,
      });
    }

    // Get vendors with user data
    const vendors = await getVendorsWithUsers({
      verificationStatus: verificationStatus || undefined,
      storeStatus: storeStatus || undefined,
    });

    return NextResponse.json({
      vendors: vendors.map(v => ({
        id: v.id,
        userId: v.user_id,
        businessName: v.business_name,
        businessType: v.business_type,
        description: v.description,
        logo: v.logo,
        banner: v.banner,
        phone: v.phone,
        email: v.email,
        address: v.address,
        city: v.city,
        region: v.region,
        verificationStatus: v.verification_status,
        verificationDocuments: v.verification_documents,
        verificationNotes: v.verification_notes,
        verifiedAt: v.verified_at,
        verifiedBy: v.verified_by,
        storeStatus: v.store_status,
        commissionRate: v.commission_rate,
        totalSales: v.total_sales,
        totalOrders: v.total_orders,
        rating: v.rating,
        reviewCount: v.review_count,
        userName: v.user_name,
        userEmail: v.user_email,
        userStatus: v.user_status,
        createdAt: v.created_at,
        updatedAt: v.updated_at,
      })),
      total: vendors.length,
    });
  } catch (error) {
    console.error('Get vendors error:', error);
    return NextResponse.json({ error: 'Failed to fetch vendors' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/vendors
 *
 * Update vendor - approve, reject, suspend, or update details
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

    // Only admins can update vendors
    if (session.user_role !== 'admin' && session.user_role !== 'master_admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { vendorId, action, reason, ...updates } = body;

    if (!vendorId) {
      return NextResponse.json({ error: 'Vendor ID is required' }, { status: 400 });
    }

    const vendor = await getVendorById(vendorId);
    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    let updatedVendor;
    let auditAction: string;
    let auditDetails: string;

    switch (action) {
      case 'approve':
        updatedVendor = await approveVendor(vendorId, session.user_id);
        // Also update the user's verification status
        await updateUser(vendor.user_id, {
          verificationStatus: 'verified',
          verifiedAt: new Date().toISOString(),
          verifiedBy: session.user_id,
          status: 'active',
        });
        auditAction = 'VENDOR_APPROVED';
        auditDetails = `Approved vendor: ${vendor.business_name}`;
        break;

      case 'reject':
        if (!reason) {
          return NextResponse.json({ error: 'Reason is required for rejection' }, { status: 400 });
        }
        updatedVendor = await rejectVendor(vendorId, session.user_id, reason);
        // Also update the user's verification status
        await updateUser(vendor.user_id, {
          verificationStatus: 'rejected',
          verificationNotes: reason,
        });
        auditAction = 'VENDOR_REJECTED';
        auditDetails = `Rejected vendor: ${vendor.business_name}. Reason: ${reason}`;
        break;

      case 'suspend':
        if (!reason) {
          return NextResponse.json({ error: 'Reason is required for suspension' }, { status: 400 });
        }
        updatedVendor = await suspendVendor(vendorId, session.user_id, reason);
        // Also update the user's status
        await updateUser(vendor.user_id, {
          verificationStatus: 'suspended',
          status: 'suspended',
        });
        auditAction = 'VENDOR_SUSPENDED';
        auditDetails = `Suspended vendor: ${vendor.business_name}. Reason: ${reason}`;
        break;

      case 'unsuspend':
        updatedVendor = await updateVendor(vendorId, {
          verificationStatus: 'verified',
          storeStatus: 'active',
        });
        await updateUser(vendor.user_id, {
          verificationStatus: 'verified',
          status: 'active',
        });
        auditAction = 'VENDOR_UNSUSPENDED';
        auditDetails = `Unsuspended vendor: ${vendor.business_name}`;
        break;

      default:
        // Generic update
        updatedVendor = await updateVendor(vendorId, updates);
        auditAction = 'VENDOR_UPDATED';
        auditDetails = `Updated vendor: ${vendor.business_name}`;
    }

    if (!updatedVendor) {
      return NextResponse.json({ error: 'Failed to update vendor' }, { status: 500 });
    }

    // Create audit log
    await createAuditLog({
      action: auditAction,
      category: 'vendor',
      adminId: session.user_id,
      targetId: vendorId,
      targetType: 'vendor',
      targetName: vendor.business_name,
      details: auditDetails,
      severity: action === 'suspend' ? 'warning' : 'info',
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    });

    return NextResponse.json({
      success: true,
      vendor: {
        id: updatedVendor.id,
        userId: updatedVendor.user_id,
        businessName: updatedVendor.business_name,
        verificationStatus: updatedVendor.verification_status,
        storeStatus: updatedVendor.store_status,
      },
    });
  } catch (error) {
    console.error('Update vendor error:', error);
    return NextResponse.json({ error: 'Failed to update vendor' }, { status: 500 });
  }
}
