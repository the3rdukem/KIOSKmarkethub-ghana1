/**
 * Vendor Payouts Data Access Layer
 * 
 * Handles vendor bank accounts, payout requests, and balance calculations.
 * Works with Paystack Transfers API for actual money movement.
 */

import { query, runTransaction } from '../index';
import { PoolClient } from 'pg';
import { 
  createTransferRecipient, 
  initiateTransfer, 
  verifyTransfer,
  resolveBankAccount 
} from '@/lib/services/paystack';

// ============================================
// Types
// ============================================

export interface VendorBankAccount {
  id: string;
  vendor_id: string;
  account_type: 'bank' | 'mobile_money';
  bank_code: string | null;
  bank_name: string | null;
  account_number: string;
  account_name: string;
  mobile_money_provider: 'mtn' | 'vodafone' | 'airteltigo' | null;
  paystack_recipient_code: string | null;
  is_primary: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface VendorPayout {
  id: string;
  vendor_id: string;
  bank_account_id: string | null;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'success' | 'failed' | 'reversed';
  paystack_transfer_code: string | null;
  paystack_reference: string | null;
  failure_reason: string | null;
  initiated_by: 'vendor' | 'admin' | 'system';
  initiated_by_id: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
  bank_account?: VendorBankAccount;
}

export interface VendorBalance {
  total_earnings: number;
  pending_earnings: number;
  available_balance: number;
  total_withdrawn: number;
  pending_withdrawal: number;
}

export interface CreateBankAccountRequest {
  vendor_id: string;
  account_type: 'bank' | 'mobile_money';
  bank_code?: string;
  bank_name?: string;
  account_number: string;
  account_name: string;
  mobile_money_provider?: 'mtn' | 'vodafone' | 'airteltigo';
  is_primary?: boolean;
}

export interface WithdrawalRequest {
  vendor_id: string;
  bank_account_id: string;
  amount: number;
  initiated_by: 'vendor' | 'admin' | 'system';
  initiated_by_id?: string;
}

// ============================================
// Bank Account Management
// ============================================

/**
 * Generate unique ID
 */
function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Get all bank accounts for a vendor
 */
export async function getVendorBankAccounts(vendorId: string): Promise<VendorBankAccount[]> {
  try {
    const result = await query(
      `SELECT * FROM vendor_bank_accounts WHERE vendor_id = $1 ORDER BY is_primary DESC, created_at DESC`,
      [vendorId]
    );
    return result.rows.map(row => mapRowToBankAccount(row));
  } catch (error) {
    console.error('[Payouts] Error getting bank accounts:', error);
    return [];
  }
}

function mapRowToBankAccount(row: Record<string, unknown>): VendorBankAccount {
  return {
    id: String(row.id || ''),
    vendor_id: String(row.vendor_id || ''),
    account_type: row.account_type as 'bank' | 'mobile_money',
    bank_code: row.bank_code ? String(row.bank_code) : null,
    bank_name: row.bank_name ? String(row.bank_name) : null,
    account_number: String(row.account_number || ''),
    account_name: String(row.account_name || ''),
    mobile_money_provider: row.mobile_money_provider as 'mtn' | 'vodafone' | 'airteltigo' | null,
    paystack_recipient_code: row.paystack_recipient_code ? String(row.paystack_recipient_code) : null,
    is_primary: row.is_primary === 1 || row.is_primary === true,
    is_verified: row.is_verified === 1 || row.is_verified === true,
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || ''),
  };
}

function mapRowToPayout(row: Record<string, unknown>): VendorPayout {
  return {
    id: String(row.id || ''),
    vendor_id: String(row.vendor_id || ''),
    bank_account_id: row.bank_account_id ? String(row.bank_account_id) : null,
    amount: parseFloat(String(row.amount || '0')),
    currency: String(row.currency || 'GHS'),
    status: row.status as VendorPayout['status'],
    paystack_transfer_code: row.paystack_transfer_code ? String(row.paystack_transfer_code) : null,
    paystack_reference: row.paystack_reference ? String(row.paystack_reference) : null,
    failure_reason: row.failure_reason ? String(row.failure_reason) : null,
    initiated_by: row.initiated_by as 'vendor' | 'admin' | 'system',
    initiated_by_id: row.initiated_by_id ? String(row.initiated_by_id) : null,
    processed_at: row.processed_at ? String(row.processed_at) : null,
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || ''),
    bank_account: row.bank_account_id ? {
      id: String(row.bank_account_id || ''),
      vendor_id: String(row.vendor_id || ''),
      account_type: (row.account_type || 'bank') as 'bank' | 'mobile_money',
      bank_code: row.bank_code ? String(row.bank_code) : null,
      bank_name: row.bank_name ? String(row.bank_name) : null,
      account_number: String(row.account_number || ''),
      account_name: String(row.account_name || ''),
      mobile_money_provider: row.mobile_money_provider as 'mtn' | 'vodafone' | 'airteltigo' | null,
      paystack_recipient_code: null,
      is_primary: false,
      is_verified: false,
      created_at: '',
      updated_at: '',
    } : undefined,
  };
}

/**
 * Get a single bank account by ID
 */
export async function getBankAccountById(accountId: string): Promise<VendorBankAccount | null> {
  try {
    const result = await query(
      `SELECT * FROM vendor_bank_accounts WHERE id = $1`,
      [accountId]
    );
    if (result.rows.length === 0) return null;
    return mapRowToBankAccount(result.rows[0]);
  } catch (error) {
    console.error('[Payouts] Error getting bank account:', error);
    return null;
  }
}

/**
 * Get primary bank account for a vendor
 */
export async function getPrimaryBankAccount(vendorId: string): Promise<VendorBankAccount | null> {
  try {
    const result = await query(
      `SELECT * FROM vendor_bank_accounts WHERE vendor_id = $1 AND is_primary = 1 LIMIT 1`,
      [vendorId]
    );
    if (result.rows.length === 0) {
      const fallback = await query(
        `SELECT * FROM vendor_bank_accounts WHERE vendor_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [vendorId]
      );
      if (fallback.rows.length === 0) return null;
      return mapRowToBankAccount(fallback.rows[0]);
    }
    return mapRowToBankAccount(result.rows[0]);
  } catch (error) {
    console.error('[Payouts] Error getting primary bank account:', error);
    return null;
  }
}

/**
 * Add a new bank account for a vendor
 */
export async function addBankAccount(request: CreateBankAccountRequest): Promise<{ success: boolean; account?: VendorBankAccount; error?: string }> {
  try {
    const id = generateId('vba');
    const now = new Date().toISOString();

    // If this is the first account or set as primary, unset other primaries
    if (request.is_primary) {
      await query(
        `UPDATE vendor_bank_accounts SET is_primary = 0, updated_at = $1 WHERE vendor_id = $2`,
        [now, request.vendor_id]
      );
    }

    // Check if this is the first account
    const existingAccounts = await query(
      `SELECT COUNT(*) as count FROM vendor_bank_accounts WHERE vendor_id = $1`,
      [request.vendor_id]
    );
    const isFirst = parseInt(String(existingAccounts.rows[0].count || '0')) === 0;

    await query(
      `INSERT INTO vendor_bank_accounts 
       (id, vendor_id, account_type, bank_code, bank_name, account_number, account_name, 
        mobile_money_provider, is_primary, is_verified, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $10, $10)`,
      [
        id,
        request.vendor_id,
        request.account_type,
        request.bank_code || null,
        request.bank_name || null,
        request.account_number,
        request.account_name,
        request.mobile_money_provider || null,
        request.is_primary || isFirst ? 1 : 0,
        now,
      ]
    );

    const account = await getBankAccountById(id);
    return { success: true, account: account || undefined };
  } catch (error) {
    console.error('[Payouts] Error adding bank account:', error);
    return { success: false, error: 'Failed to add bank account' };
  }
}

/**
 * Update bank account with Paystack recipient code
 */
export async function updateBankAccountRecipientCode(
  accountId: string, 
  recipientCode: string
): Promise<boolean> {
  try {
    const now = new Date().toISOString();
    await query(
      `UPDATE vendor_bank_accounts SET paystack_recipient_code = $1, is_verified = 1, updated_at = $2 WHERE id = $3`,
      [recipientCode, now, accountId]
    );
    return true;
  } catch (error) {
    console.error('[Payouts] Error updating recipient code:', error);
    return false;
  }
}

/**
 * Set a bank account as primary
 */
export async function setPrimaryBankAccount(vendorId: string, accountId: string): Promise<boolean> {
  try {
    const now = new Date().toISOString();
    await query(
      `UPDATE vendor_bank_accounts SET is_primary = 0, updated_at = $1 WHERE vendor_id = $2`,
      [now, vendorId]
    );
    await query(
      `UPDATE vendor_bank_accounts SET is_primary = 1, updated_at = $1 WHERE id = $2 AND vendor_id = $3`,
      [now, accountId, vendorId]
    );
    return true;
  } catch (error) {
    console.error('[Payouts] Error setting primary account:', error);
    return false;
  }
}

/**
 * Delete a bank account
 */
export async function deleteBankAccount(vendorId: string, accountId: string): Promise<boolean> {
  try {
    await query(
      `DELETE FROM vendor_bank_accounts WHERE id = $1 AND vendor_id = $2`,
      [accountId, vendorId]
    );
    return true;
  } catch (error) {
    console.error('[Payouts] Error deleting bank account:', error);
    return false;
  }
}

/**
 * Verify and register bank account with Paystack
 */
export async function verifyAndRegisterBankAccount(accountId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const account = await getBankAccountById(accountId);
    if (!account) {
      return { success: false, error: 'Account not found' };
    }

    // Already verified
    if (account.paystack_recipient_code) {
      return { success: true };
    }

    // Create transfer recipient in Paystack
    const recipientResult = await createTransferRecipient({
      type: account.account_type === 'mobile_money' ? 'mobile_money' : 'ghipss',
      name: account.account_name,
      account_number: account.account_number,
      bank_code: account.bank_code || account.mobile_money_provider || '',
      currency: 'GHS',
      metadata: {
        vendor_id: account.vendor_id,
        account_id: account.id,
      },
    });

    if (!recipientResult.success || !recipientResult.data?.recipient_code) {
      return { success: false, error: recipientResult.error || 'Failed to create Paystack recipient' };
    }

    // Update account with recipient code
    await updateBankAccountRecipientCode(accountId, recipientResult.data.recipient_code);
    
    return { success: true };
  } catch (error) {
    console.error('[Payouts] Error verifying bank account:', error);
    return { success: false, error: 'Failed to verify bank account' };
  }
}

// ============================================
// Balance Calculations
// ============================================

/**
 * Get vendor's current balance
 * Available balance = earnings from completed orders (48h+ after delivery) - pending/successful withdrawals
 */
export async function getVendorBalance(vendorId: string): Promise<VendorBalance> {
  try {
    // Total earnings from all completed orders
    const totalEarningsResult = await query(
      `SELECT COALESCE(SUM(oi.vendor_earnings), 0) as total
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE oi.vendor_id = $1 
       AND o.payment_status = 'paid'`,
      [vendorId]
    );
    const totalEarnings = parseFloat(String(totalEarningsResult.rows[0]?.total || '0'));

    // Pending earnings (orders not yet completed/delivered 48h+)
    const pendingEarningsResult = await query(
      `SELECT COALESCE(SUM(oi.vendor_earnings), 0) as total
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE oi.vendor_id = $1 
       AND o.payment_status = 'paid'
       AND (
         o.status NOT IN ('completed', 'delivered')
         OR (o.status = 'delivered' AND o.delivered_at > NOW() - INTERVAL '48 hours')
       )`,
      [vendorId]
    );
    const pendingEarnings = parseFloat(String(pendingEarningsResult.rows[0]?.total || '0'));

    // Total successfully withdrawn
    const withdrawnResult = await query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM vendor_payouts
       WHERE vendor_id = $1 AND status = 'success'`,
      [vendorId]
    );
    const totalWithdrawn = parseFloat(String(withdrawnResult.rows[0]?.total || '0'));

    // Pending withdrawals (processing)
    const pendingWithdrawalResult = await query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM vendor_payouts
       WHERE vendor_id = $1 AND status IN ('pending', 'processing')`,
      [vendorId]
    );
    const pendingWithdrawal = parseFloat(String(pendingWithdrawalResult.rows[0]?.total || '0'));

    // Available balance = total earnings - pending earnings - withdrawn - pending withdrawals
    const availableBalance = Math.max(0, totalEarnings - pendingEarnings - totalWithdrawn - pendingWithdrawal);

    return {
      total_earnings: totalEarnings,
      pending_earnings: pendingEarnings,
      available_balance: availableBalance,
      total_withdrawn: totalWithdrawn,
      pending_withdrawal: pendingWithdrawal,
    };
  } catch (error) {
    console.error('[Payouts] Error calculating balance:', error);
    return {
      total_earnings: 0,
      pending_earnings: 0,
      available_balance: 0,
      total_withdrawn: 0,
      pending_withdrawal: 0,
    };
  }
}

// ============================================
// Payout Management
// ============================================

/**
 * Get vendor's payout history
 */
export async function getVendorPayouts(
  vendorId: string,
  options?: { status?: string; limit?: number; offset?: number }
): Promise<VendorPayout[]> {
  try {
    let sql = `
      SELECT vp.*, vba.bank_name, vba.account_number, vba.account_name, vba.account_type
      FROM vendor_payouts vp
      LEFT JOIN vendor_bank_accounts vba ON vp.bank_account_id = vba.id
      WHERE vp.vendor_id = $1
    `;
    const params: (string | number)[] = [vendorId];

    if (options?.status) {
      params.push(options.status);
      sql += ` AND vp.status = $${params.length}`;
    }

    sql += ` ORDER BY vp.created_at DESC`;

    if (options?.limit) {
      params.push(options.limit);
      sql += ` LIMIT $${params.length}`;
    }

    if (options?.offset) {
      params.push(options.offset);
      sql += ` OFFSET $${params.length}`;
    }

    const result = await query(sql, params);
    return result.rows.map(row => mapRowToPayout(row));
  } catch (error) {
    console.error('[Payouts] Error getting payouts:', error);
    return [];
  }
}

/**
 * Get a single payout by ID
 */
export async function getPayoutById(payoutId: string): Promise<VendorPayout | null> {
  try {
    const result = await query(
      `SELECT vp.*, vba.bank_name, vba.account_number, vba.account_name, vba.account_type
       FROM vendor_payouts vp
       LEFT JOIN vendor_bank_accounts vba ON vp.bank_account_id = vba.id
       WHERE vp.id = $1`,
      [payoutId]
    );
    if (result.rows.length === 0) return null;
    return mapRowToPayout(result.rows[0]);
  } catch (error) {
    console.error('[Payouts] Error getting payout:', error);
    return null;
  }
}

/**
 * Request a withdrawal (vendor-initiated)
 */
export async function requestWithdrawal(request: WithdrawalRequest): Promise<{ success: boolean; payout?: VendorPayout; error?: string }> {
  const MINIMUM_WITHDRAWAL = 50; // GHS 50 minimum

  try {
    // Validate amount
    if (request.amount < MINIMUM_WITHDRAWAL) {
      return { success: false, error: `Minimum withdrawal is GHS ${MINIMUM_WITHDRAWAL}` };
    }

    // Get vendor balance
    const balance = await getVendorBalance(request.vendor_id);
    if (request.amount > balance.available_balance) {
      return { success: false, error: `Insufficient balance. Available: GHS ${balance.available_balance.toFixed(2)}` };
    }

    // Get and verify bank account
    const bankAccount = await getBankAccountById(request.bank_account_id);
    if (!bankAccount || bankAccount.vendor_id !== request.vendor_id) {
      return { success: false, error: 'Invalid bank account' };
    }

    // Ensure account is registered with Paystack
    if (!bankAccount.paystack_recipient_code) {
      const verifyResult = await verifyAndRegisterBankAccount(bankAccount.id);
      if (!verifyResult.success) {
        return { success: false, error: verifyResult.error || 'Failed to verify bank account' };
      }
      // Refresh account data
      const updatedAccount = await getBankAccountById(request.bank_account_id);
      if (!updatedAccount?.paystack_recipient_code) {
        return { success: false, error: 'Failed to register bank account with payment provider' };
      }
      Object.assign(bankAccount, updatedAccount);
    }

    // Create payout record
    const payoutId = generateId('payout');
    const reference = `KIOSK_${payoutId}`;
    const now = new Date().toISOString();

    await query(
      `INSERT INTO vendor_payouts 
       (id, vendor_id, bank_account_id, amount, currency, status, paystack_reference, 
        initiated_by, initiated_by_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'GHS', 'pending', $5, $6, $7, $8, $8)`,
      [
        payoutId,
        request.vendor_id,
        request.bank_account_id,
        request.amount,
        reference,
        request.initiated_by,
        request.initiated_by_id || request.vendor_id,
        now,
      ]
    );

    // Initiate transfer via Paystack
    const amountInPesewas = Math.round(request.amount * 100);
    const transferResult = await initiateTransfer({
      amount: amountInPesewas,
      recipient: bankAccount.paystack_recipient_code!,
      reference: reference,
      reason: 'KIOSK vendor payout',
    });

    if (!transferResult.success) {
      // Update payout as failed
      await query(
        `UPDATE vendor_payouts SET status = 'failed', failure_reason = $1, updated_at = $2 WHERE id = $3`,
        [transferResult.error || 'Transfer initiation failed', now, payoutId]
      );
      return { success: false, error: transferResult.error || 'Failed to initiate transfer' };
    }

    // Update payout with transfer details
    await query(
      `UPDATE vendor_payouts SET status = 'processing', paystack_transfer_code = $1, updated_at = $2 WHERE id = $3`,
      [transferResult.data?.transfer_code, now, payoutId]
    );

    const payout = await getPayoutById(payoutId);
    return { success: true, payout: payout || undefined };
  } catch (error) {
    console.error('[Payouts] Error requesting withdrawal:', error);
    return { success: false, error: 'Failed to process withdrawal request' };
  }
}

/**
 * Update payout status (from webhook or manual check)
 */
export async function updatePayoutStatus(
  reference: string, 
  status: 'pending' | 'processing' | 'success' | 'failed' | 'reversed',
  failureReason?: string
): Promise<boolean> {
  try {
    const now = new Date().toISOString();
    const processedAt = status === 'success' ? now : null;

    await query(
      `UPDATE vendor_payouts 
       SET status = $1, failure_reason = $2, processed_at = $3, updated_at = $4 
       WHERE paystack_reference = $5`,
      [status, failureReason || null, processedAt, now, reference]
    );
    return true;
  } catch (error) {
    console.error('[Payouts] Error updating payout status:', error);
    return false;
  }
}

/**
 * Check and update payout status from Paystack
 */
export async function syncPayoutStatus(payoutId: string): Promise<{ success: boolean; status?: string; error?: string }> {
  try {
    const payout = await getPayoutById(payoutId);
    if (!payout || !payout.paystack_reference) {
      return { success: false, error: 'Payout not found or no reference' };
    }

    const result = await verifyTransfer(payout.paystack_reference);
    if (!result.success) {
      return { success: false, error: result.error };
    }

    const newStatus = result.data?.status || 'pending';
    if (newStatus !== payout.status) {
      await updatePayoutStatus(payout.paystack_reference, newStatus as VendorPayout['status']);
    }

    return { success: true, status: newStatus };
  } catch (error) {
    console.error('[Payouts] Error syncing payout status:', error);
    return { success: false, error: 'Failed to sync status' };
  }
}

// ============================================
// Admin Functions
// ============================================

/**
 * Get all payouts for admin dashboard
 */
export async function getAllPayouts(options?: {
  status?: string;
  vendorId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ payouts: VendorPayout[]; total: number }> {
  try {
    let countSql = `SELECT COUNT(*) as total FROM vendor_payouts vp WHERE 1=1`;
    let sql = `
      SELECT vp.*, 
             vba.bank_name, vba.account_number, vba.account_name, vba.account_type,
             u.email as vendor_email,
             v.business_name as vendor_business_name
      FROM vendor_payouts vp
      LEFT JOIN vendor_bank_accounts vba ON vp.bank_account_id = vba.id
      LEFT JOIN users u ON vp.vendor_id = u.id
      LEFT JOIN vendors v ON vp.vendor_id = v.user_id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (options?.status) {
      params.push(options.status);
      const paramNum = params.length;
      countSql += ` AND vp.status = $${paramNum}`;
      sql += ` AND vp.status = $${paramNum}`;
    }

    if (options?.vendorId) {
      params.push(options.vendorId);
      const paramNum = params.length;
      countSql += ` AND vp.vendor_id = $${paramNum}`;
      sql += ` AND vp.vendor_id = $${paramNum}`;
    }

    sql += ` ORDER BY vp.created_at DESC`;

    const countResult = await query(countSql, params);
    const total = parseInt(String(countResult.rows[0]?.total || '0'));

    if (options?.limit) {
      params.push(options.limit);
      sql += ` LIMIT $${params.length}`;
    }

    if (options?.offset) {
      params.push(options.offset);
      sql += ` OFFSET $${params.length}`;
    }

    const result = await query(sql, params);
    const payouts: (VendorPayout & { vendor_email?: string; vendor_business_name?: string })[] = result.rows.map(row => {
      const payout = mapRowToPayout(row);
      return {
        ...payout,
        vendor_email: row.vendor_email ? String(row.vendor_email) : undefined,
        vendor_business_name: row.vendor_business_name ? String(row.vendor_business_name) : undefined,
      };
    });

    return { payouts, total };
  } catch (error) {
    console.error('[Payouts] Error getting all payouts:', error);
    return { payouts: [], total: 0 };
  }
}

/**
 * Get payout summary statistics
 */
export async function getPayoutStats(): Promise<{
  totalPaidOut: number;
  totalPending: number;
  totalFailed: number;
  countSuccess: number;
  countPending: number;
  countFailed: number;
}> {
  try {
    const result = await query(`
      SELECT 
        COALESCE(SUM(CASE WHEN status = 'success' THEN amount ELSE 0 END), 0) as total_paid_out,
        COALESCE(SUM(CASE WHEN status IN ('pending', 'processing') THEN amount ELSE 0 END), 0) as total_pending,
        COALESCE(SUM(CASE WHEN status = 'failed' THEN amount ELSE 0 END), 0) as total_failed,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as count_success,
        COUNT(CASE WHEN status IN ('pending', 'processing') THEN 1 END) as count_pending,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as count_failed
      FROM vendor_payouts
    `);
    
    const row = result.rows[0] || {};
    return {
      totalPaidOut: parseFloat(String(row.total_paid_out || '0')),
      totalPending: parseFloat(String(row.total_pending || '0')),
      totalFailed: parseFloat(String(row.total_failed || '0')),
      countSuccess: parseInt(String(row.count_success || '0')),
      countPending: parseInt(String(row.count_pending || '0')),
      countFailed: parseInt(String(row.count_failed || '0')),
    };
  } catch (error) {
    console.error('[Payouts] Error getting payout stats:', error);
    return {
      totalPaidOut: 0,
      totalPending: 0,
      totalFailed: 0,
      countSuccess: 0,
      countPending: 0,
      countFailed: 0,
    };
  }
}
