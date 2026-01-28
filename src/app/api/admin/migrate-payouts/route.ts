/**
 * Admin Payouts Migration API
 * 
 * Creates the database tables for vendor payouts functionality
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import { query } from '@/lib/db';
import { createAuditLog } from '@/lib/db/dal/audit';

/**
 * POST /api/admin/migrate-payouts
 * Run payouts database migration
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session || session.user_role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const results: string[] = [];

    // Create vendor_bank_accounts table
    await query(`
      CREATE TABLE IF NOT EXISTS vendor_bank_accounts (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        vendor_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('bank', 'mobile_money')),
        bank_code VARCHAR(20),
        bank_name VARCHAR(100),
        account_number VARCHAR(50) NOT NULL,
        account_name VARCHAR(100) NOT NULL,
        mobile_money_provider VARCHAR(20),
        is_primary BOOLEAN DEFAULT FALSE,
        is_verified BOOLEAN DEFAULT FALSE,
        paystack_recipient_code VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    results.push('Created vendor_bank_accounts table');

    // Create indexes for vendor_bank_accounts
    await query(`
      CREATE INDEX IF NOT EXISTS idx_vendor_bank_accounts_vendor 
      ON vendor_bank_accounts(vendor_id)
    `);
    results.push('Created vendor_bank_accounts index');

    // Create vendor_payouts table
    await query(`
      CREATE TABLE IF NOT EXISTS vendor_payouts (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        vendor_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        bank_account_id VARCHAR(36) NOT NULL REFERENCES vendor_bank_accounts(id),
        reference VARCHAR(50) UNIQUE NOT NULL,
        amount DECIMAL(12, 2) NOT NULL,
        fee DECIMAL(12, 2) DEFAULT 0,
        net_amount DECIMAL(12, 2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'GHS',
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'reversed', 'cancelled')),
        transfer_code VARCHAR(100),
        failure_reason TEXT,
        initiated_by VARCHAR(20) DEFAULT 'vendor' CHECK (initiated_by IN ('vendor', 'admin', 'system')),
        initiated_by_id VARCHAR(36),
        processed_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    results.push('Created vendor_payouts table');

    // Create indexes for vendor_payouts
    await query(`
      CREATE INDEX IF NOT EXISTS idx_vendor_payouts_vendor 
      ON vendor_payouts(vendor_id)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_vendor_payouts_status 
      ON vendor_payouts(status)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_vendor_payouts_reference 
      ON vendor_payouts(reference)
    `);
    results.push('Created vendor_payouts indexes');

    // Create vendor_payout_items table (for multi-order payouts)
    await query(`
      CREATE TABLE IF NOT EXISTS vendor_payout_items (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        payout_id VARCHAR(36) NOT NULL REFERENCES vendor_payouts(id) ON DELETE CASCADE,
        order_id VARCHAR(36) NOT NULL,
        order_item_id VARCHAR(36),
        amount DECIMAL(12, 2) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    results.push('Created vendor_payout_items table');

    // Create index for vendor_payout_items
    await query(`
      CREATE INDEX IF NOT EXISTS idx_vendor_payout_items_payout 
      ON vendor_payout_items(payout_id)
    `);
    results.push('Created vendor_payout_items index');

    // Log the migration
    await createAuditLog({
      action: 'payouts.migration',
      adminId: session.user_id,
      adminRole: session.user_role,
      category: 'system',
      targetType: 'database',
      targetName: 'payouts_migration',
      details: JSON.stringify({ results }),
      severity: 'info',
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Payouts migration completed',
      results 
    });
  } catch (error) {
    console.error('[Payouts Migration] Error:', error);
    return NextResponse.json({ 
      error: 'Migration failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
