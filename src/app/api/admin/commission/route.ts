/**
 * Commission Management API
 * 
 * Phase 12: Commission System
 * Admin endpoints for managing platform commission rates.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import {
  getDefaultCommissionRate,
  setDefaultCommissionRate,
  getAllCategoryCommissionRates,
  setCategoryCommissionRate,
  getAllVendorCommissionRates,
  setVendorCommissionRate,
  getCommissionSummary
} from '@/lib/db/dal/commission';
import { createAuditLog } from '@/lib/db/dal/audit';

/**
 * GET /api/admin/commission
 * Get all commission settings and summary
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session || (session.user_role !== 'admin' && session.user_role !== 'master_admin')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';

    if (type === 'summary') {
      const startDate = searchParams.get('startDate') || undefined;
      const endDate = searchParams.get('endDate') || undefined;
      const summary = await getCommissionSummary(startDate, endDate);
      return NextResponse.json({ summary });
    }

    if (type === 'categories') {
      const categories = await getAllCategoryCommissionRates();
      return NextResponse.json({ categories });
    }

    if (type === 'vendors') {
      const vendors = await getAllVendorCommissionRates();
      return NextResponse.json({ vendors });
    }

    const [defaultRate, categories, vendors, summary] = await Promise.all([
      getDefaultCommissionRate(),
      getAllCategoryCommissionRates(),
      getAllVendorCommissionRates(),
      getCommissionSummary()
    ]);

    return NextResponse.json({
      defaultRate,
      categories,
      vendors,
      summary
    });
  } catch (error) {
    console.error('[Commission API] GET error:', error);
    return NextResponse.json({ error: 'Failed to get commission settings' }, { status: 500 });
  }
}

/**
 * POST /api/admin/commission
 * Update commission rates
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session || (session.user_role !== 'admin' && session.user_role !== 'master_admin')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { type, rate, categoryId, vendorId } = body;

    if (rate !== null && (typeof rate !== 'number' || rate < 0 || rate > 1)) {
      return NextResponse.json(
        { error: 'Rate must be a number between 0 and 1 (0% to 100%)' },
        { status: 400 }
      );
    }

    let success = false;
    let auditDetails = '';

    if (type === 'default') {
      const oldRate = await getDefaultCommissionRate();
      success = await setDefaultCommissionRate(rate, session.user_id);
      auditDetails = `Changed default commission rate from ${(oldRate * 100).toFixed(1)}% to ${(rate * 100).toFixed(1)}%`;
    } else if (type === 'category' && categoryId) {
      success = await setCategoryCommissionRate(categoryId, rate);
      auditDetails = rate !== null
        ? `Set category ${categoryId} commission rate to ${(rate * 100).toFixed(1)}%`
        : `Removed custom commission rate for category ${categoryId}`;
    } else if (type === 'vendor' && vendorId) {
      success = await setVendorCommissionRate(vendorId, rate);
      auditDetails = rate !== null
        ? `Set vendor ${vendorId} commission rate to ${(rate * 100).toFixed(1)}%`
        : `Removed custom commission rate for vendor ${vendorId}`;
    } else {
      return NextResponse.json(
        { error: 'Invalid request. Specify type and required ID.' },
        { status: 400 }
      );
    }

    if (success) {
      await createAuditLog({
        action: 'commission_rate_updated',
        category: 'admin',
        adminId: session.user_id,
        adminRole: session.user_role || 'admin',
        targetType: type,
        targetId: categoryId || vendorId || 'default',
        details: auditDetails,
        severity: 'info'
      });

      return NextResponse.json({ success: true, message: 'Commission rate updated' });
    }

    return NextResponse.json({ error: 'Failed to update commission rate' }, { status: 500 });
  } catch (error) {
    console.error('[Commission API] POST error:', error);
    return NextResponse.json({ error: 'Failed to update commission rate' }, { status: 500 });
  }
}
