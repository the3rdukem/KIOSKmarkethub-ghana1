/**
 * Vendors Data Access Layer
 *
 * Vendors are business entities linked to users.
 * A user with role "vendor" gets a corresponding vendor record.
 */

import { query, runTransaction } from '../index';
import { v4 as uuidv4 } from 'uuid';

export type VerificationStatus = 'pending' | 'under_review' | 'verified' | 'rejected' | 'suspended';
export type StoreStatus = 'active' | 'inactive' | 'suspended';

export interface DbVendor {
  id: string;
  user_id: string;
  business_name: string;
  business_type: string | null;
  description: string | null;
  logo: string | null;
  banner: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  verification_status: VerificationStatus;
  verification_documents: string | null;
  verification_notes: string | null;
  verified_at: string | null;
  verified_by: string | null;
  store_status: StoreStatus;
  commission_rate: number;
  total_sales: number;
  total_orders: number;
  rating: number;
  review_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateVendorInput {
  userId: string;
  businessName: string;
  businessType?: string;
  description?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  region?: string;
}

export interface UpdateVendorInput {
  businessName?: string;
  businessType?: string;
  description?: string;
  logo?: string;
  banner?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  region?: string;
  verificationStatus?: VerificationStatus;
  verificationDocuments?: string;
  verificationNotes?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  storeStatus?: StoreStatus;
  commissionRate?: number;
}

/**
 * Create a new vendor record
 */
export async function createVendor(input: CreateVendorInput): Promise<DbVendor> {
  const id = `vendor_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
  const now = new Date().toISOString();

  await query(`
    INSERT INTO vendors (
      id, user_id, business_name, business_type, description,
      phone, email, address, city, region,
      verification_status, store_status, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', 'inactive', $11, $12)
  `, [
    id,
    input.userId,
    input.businessName,
    input.businessType || null,
    input.description || null,
    input.phone || null,
    input.email || null,
    input.address || null,
    input.city || null,
    input.region || null,
    now,
    now
  ]);

  const vendor = await getVendorById(id);
  return vendor!;
}

/**
 * Get vendor by ID
 */
export async function getVendorById(id: string): Promise<DbVendor | null> {
  const result = await query<DbVendor>('SELECT * FROM vendors WHERE id = $1', [id]);
  return result.rows[0] || null;
}

/**
 * Get vendor by user ID
 */
export async function getVendorByUserId(userId: string): Promise<DbVendor | null> {
  const result = await query<DbVendor>('SELECT * FROM vendors WHERE user_id = $1', [userId]);
  return result.rows[0] || null;
}

/**
 * Get all vendors with optional filters
 */
export async function getVendors(options?: {
  verificationStatus?: VerificationStatus;
  storeStatus?: StoreStatus;
  limit?: number;
  offset?: number;
}): Promise<DbVendor[]> {
  let queryStr = 'SELECT * FROM vendors WHERE 1=1';
  const params: unknown[] = [];
  let paramIndex = 1;

  if (options?.verificationStatus) {
    queryStr += ` AND verification_status = $${paramIndex++}`;
    params.push(options.verificationStatus);
  }

  if (options?.storeStatus) {
    queryStr += ` AND store_status = $${paramIndex++}`;
    params.push(options.storeStatus);
  }

  queryStr += ' ORDER BY created_at DESC';

  if (options?.limit) {
    queryStr += ` LIMIT $${paramIndex++}`;
    params.push(options.limit);
  }

  if (options?.offset) {
    queryStr += ` OFFSET $${paramIndex++}`;
    params.push(options.offset);
  }

  const result = await query<DbVendor>(queryStr, params);
  return result.rows;
}

/**
 * Get vendors with user data joined
 */
export async function getVendorsWithUsers(options?: {
  verificationStatus?: VerificationStatus;
  storeStatus?: StoreStatus;
  limit?: number;
}): Promise<(DbVendor & { user_name: string; user_email: string; user_status: string })[]> {
  let queryStr = `
    SELECT v.*, u.name as user_name, u.email as user_email, u.status as user_status
    FROM vendors v
    JOIN users u ON v.user_id = u.id
    WHERE u.is_deleted = 0
  `;
  const params: unknown[] = [];
  let paramIndex = 1;

  if (options?.verificationStatus) {
    queryStr += ` AND v.verification_status = $${paramIndex++}`;
    params.push(options.verificationStatus);
  }

  if (options?.storeStatus) {
    queryStr += ` AND v.store_status = $${paramIndex++}`;
    params.push(options.storeStatus);
  }

  queryStr += ' ORDER BY v.created_at DESC';

  if (options?.limit) {
    queryStr += ` LIMIT $${paramIndex++}`;
    params.push(options.limit);
  }

  const result = await query<DbVendor & { user_name: string; user_email: string; user_status: string }>(queryStr, params);
  return result.rows;
}

/**
 * Get pending vendors (for admin approval)
 */
export async function getPendingVendors(): Promise<(DbVendor & { user_name: string; user_email: string })[]> {
  const result = await query<DbVendor & { user_name: string; user_email: string }>(`
    SELECT v.*, u.name as user_name, u.email as user_email
    FROM vendors v
    JOIN users u ON v.user_id = u.id
    WHERE v.verification_status IN ('pending', 'under_review')
    AND u.is_deleted = 0
    ORDER BY v.created_at ASC
  `);
  return result.rows;
}

/**
 * Update vendor
 */
export async function updateVendor(id: string, updates: UpdateVendorInput): Promise<DbVendor | null> {
  const now = new Date().toISOString();

  const fields: string[] = ['updated_at = $1'];
  const values: unknown[] = [now];
  let paramIndex = 2;

  if (updates.businessName !== undefined) {
    fields.push(`business_name = $${paramIndex++}`);
    values.push(updates.businessName);
  }
  if (updates.businessType !== undefined) {
    fields.push(`business_type = $${paramIndex++}`);
    values.push(updates.businessType);
  }
  if (updates.description !== undefined) {
    fields.push(`description = $${paramIndex++}`);
    values.push(updates.description);
  }
  if (updates.logo !== undefined) {
    fields.push(`logo = $${paramIndex++}`);
    values.push(updates.logo);
  }
  if (updates.banner !== undefined) {
    fields.push(`banner = $${paramIndex++}`);
    values.push(updates.banner);
  }
  if (updates.phone !== undefined) {
    fields.push(`phone = $${paramIndex++}`);
    values.push(updates.phone);
  }
  if (updates.email !== undefined) {
    fields.push(`email = $${paramIndex++}`);
    values.push(updates.email);
  }
  if (updates.address !== undefined) {
    fields.push(`address = $${paramIndex++}`);
    values.push(updates.address);
  }
  if (updates.city !== undefined) {
    fields.push(`city = $${paramIndex++}`);
    values.push(updates.city);
  }
  if (updates.region !== undefined) {
    fields.push(`region = $${paramIndex++}`);
    values.push(updates.region);
  }
  if (updates.verificationStatus !== undefined) {
    fields.push(`verification_status = $${paramIndex++}`);
    values.push(updates.verificationStatus);
  }
  if (updates.verificationDocuments !== undefined) {
    fields.push(`verification_documents = $${paramIndex++}`);
    values.push(updates.verificationDocuments);
  }
  if (updates.verificationNotes !== undefined) {
    fields.push(`verification_notes = $${paramIndex++}`);
    values.push(updates.verificationNotes);
  }
  if (updates.verifiedAt !== undefined) {
    fields.push(`verified_at = $${paramIndex++}`);
    values.push(updates.verifiedAt);
  }
  if (updates.verifiedBy !== undefined) {
    fields.push(`verified_by = $${paramIndex++}`);
    values.push(updates.verifiedBy);
  }
  if (updates.storeStatus !== undefined) {
    fields.push(`store_status = $${paramIndex++}`);
    values.push(updates.storeStatus);
  }
  if (updates.commissionRate !== undefined) {
    fields.push(`commission_rate = $${paramIndex++}`);
    values.push(updates.commissionRate);
  }

  values.push(id);
  const sql = `UPDATE vendors SET ${fields.join(', ')} WHERE id = $${paramIndex}`;
  const result = await query(sql, values);

  if ((result.rowCount ?? 0) === 0) return null;
  return await getVendorById(id);
}

/**
 * Approve vendor
 */
export async function approveVendor(vendorId: string, approvedBy: string): Promise<DbVendor | null> {
  const now = new Date().toISOString();
  return await updateVendor(vendorId, {
    verificationStatus: 'verified',
    verifiedAt: now,
    verifiedBy: approvedBy,
    storeStatus: 'active',
  });
}

/**
 * Reject vendor
 */
export async function rejectVendor(vendorId: string, rejectedBy: string, reason: string): Promise<DbVendor | null> {
  return await updateVendor(vendorId, {
    verificationStatus: 'rejected',
    verificationNotes: reason,
    verifiedBy: rejectedBy,
    verifiedAt: new Date().toISOString(),
  });
}

/**
 * Suspend vendor
 */
export async function suspendVendor(vendorId: string, suspendedBy: string, reason: string): Promise<DbVendor | null> {
  return await updateVendor(vendorId, {
    verificationStatus: 'suspended',
    storeStatus: 'suspended',
    verificationNotes: reason,
    verifiedBy: suspendedBy,
  });
}

/**
 * Get vendor statistics
 */
export async function getVendorStats(): Promise<{
  total: number;
  pending: number;
  verified: number;
  rejected: number;
  suspended: number;
  activeStores: number;
}> {
  const result = await query<{
    total: string;
    pending: string;
    verified: string;
    rejected: string;
    suspended: string;
    active_stores: string;
  }>(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN verification_status = 'pending' OR verification_status = 'under_review' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN verification_status = 'verified' THEN 1 ELSE 0 END) as verified,
      SUM(CASE WHEN verification_status = 'rejected' THEN 1 ELSE 0 END) as rejected,
      SUM(CASE WHEN verification_status = 'suspended' THEN 1 ELSE 0 END) as suspended,
      SUM(CASE WHEN store_status = 'active' THEN 1 ELSE 0 END) as active_stores
    FROM vendors
  `);

  const stats = result.rows[0];

  return {
    total: parseInt(stats?.total || '0'),
    pending: parseInt(stats?.pending || '0'),
    verified: parseInt(stats?.verified || '0'),
    rejected: parseInt(stats?.rejected || '0'),
    suspended: parseInt(stats?.suspended || '0'),
    activeStores: parseInt(stats?.active_stores || '0'),
  };
}

/**
 * Delete vendor
 */
export async function deleteVendor(id: string): Promise<boolean> {
  const result = await query('DELETE FROM vendors WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * Check if vendor can sell (is verified)
 */
export async function canVendorSell(vendorId: string): Promise<boolean> {
  const vendor = await getVendorById(vendorId);
  return vendor?.verification_status === 'verified';
}

/**
 * Check if vendor can sell by user ID
 */
export async function canUserSell(userId: string): Promise<boolean> {
  const vendor = await getVendorByUserId(userId);
  return vendor?.verification_status === 'verified';
}

/**
 * Update vendor verification status from KYC service (Smile Identity)
 * This is called by webhook handlers when verification results are received
 */
export async function updateVendorVerificationStatus(
  userId: string,
  data: {
    verificationStatus: VerificationStatus;
    verificationNotes: string;
    smileJobId?: string;
    verifiedAt?: string;
  }
): Promise<DbVendor | null> {
  const vendor = await getVendorByUserId(userId);
  if (!vendor) {
    console.error(`[VENDORS] Vendor not found for user ${userId}`);
    return null;
  }

  const updates: UpdateVendorInput = {
    verificationStatus: data.verificationStatus,
    verificationNotes: data.verificationNotes,
  };

  // Include Smile Job ID in verification documents
  if (data.smileJobId) {
    const existingDocs = vendor.verification_documents
      ? JSON.parse(vendor.verification_documents)
      : {};
    existingDocs.smileJobId = data.smileJobId;
    updates.verificationDocuments = JSON.stringify(existingDocs);
  }

  if (data.verifiedAt) {
    updates.verifiedAt = data.verifiedAt;
    updates.verifiedBy = 'smile_identity';
  }

  // If verified, activate the store
  if (data.verificationStatus === 'verified') {
    updates.storeStatus = 'active';
  }

  return await updateVendor(vendor.id, updates);
}

/**
 * Set vendor KYC job ID (tracks pending Smile Identity verification)
 */
export async function setVendorKycJobId(userId: string, jobId: string): Promise<boolean> {
  const vendor = await getVendorByUserId(userId);
  if (!vendor) return false;

  const existingDocs = vendor.verification_documents
    ? JSON.parse(vendor.verification_documents)
    : {};
  existingDocs.kycJobId = jobId;
  existingDocs.kycInitiatedAt = new Date().toISOString();

  const result = await updateVendor(vendor.id, {
    verificationStatus: 'under_review',
    verificationDocuments: JSON.stringify(existingDocs),
  });

  return !!result;
}

/**
 * Get vendor's pending KYC job ID
 */
export async function getVendorKycJobId(userId: string): Promise<string | null> {
  const vendor = await getVendorByUserId(userId);
  if (!vendor || !vendor.verification_documents) return null;

  try {
    const docs = JSON.parse(vendor.verification_documents);
    return docs.kycJobId || null;
  } catch {
    return null;
  }
}
