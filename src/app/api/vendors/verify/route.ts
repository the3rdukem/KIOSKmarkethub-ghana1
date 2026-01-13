/**
 * Vendor Verification API
 *
 * Initiates KYC verification using Smile Identity or fallback manual review.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import { getVendorByUserId, setVendorKycJobId, getVendorKycJobId, updateVendor } from '@/lib/db/dal/vendors';
import { createAuditLog } from '@/lib/db/dal/audit';
import {
  isSmileIdentityAvailable,
  createVerificationJob,
  checkVerificationStatus,
  getSupportedIdTypes,
  getSmileIdConfig,
} from '@/lib/services/smile-identity';

/**
 * GET /api/vendors/verify
 *
 * Get verification status and config
 */
export async function GET(request: NextRequest) {
  try {
    // Verify user authentication
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Get vendor record
    const vendor = await getVendorByUserId(session.user_id);

    // Check if Smile Identity is available
    const smileIdAvailable = await isSmileIdentityAvailable();
    const config = await getSmileIdConfig();

    // Get pending KYC job ID if any
    const pendingJobId = await getVendorKycJobId(session.user_id);

    // If there's a pending job, check its status
    let pendingJobStatus = null;
    if (pendingJobId) {
      pendingJobStatus = await checkVerificationStatus(pendingJobId);
    }

    return NextResponse.json({
      vendor: vendor ? {
        id: vendor.id,
        businessName: vendor.business_name,
        verificationStatus: vendor.verification_status,
        verificationNotes: vendor.verification_notes,
        verifiedAt: vendor.verified_at,
        storeStatus: vendor.store_status,
      } : null,
      smileIdentity: {
        available: smileIdAvailable,
        environment: config?.environment || 'sandbox',
        enableDocumentVerification: config?.enableDocumentVerification || false,
        enableSelfieVerification: config?.enableSelfieVerification || false,
        enableEnhancedKYC: config?.enableEnhancedKYC || false,
      },
      pendingJob: pendingJobId ? {
        jobId: pendingJobId,
        status: pendingJobStatus?.status,
        resultCode: pendingJobStatus?.resultCode,
        resultText: pendingJobStatus?.resultText,
        confidence: pendingJobStatus?.confidence,
      } : null,
      supportedIdTypes: getSupportedIdTypes('GH'),
    });
  } catch (error) {
    console.error('[VENDOR_VERIFY] GET error:', error);
    return NextResponse.json({ error: 'Failed to get verification status' }, { status: 500 });
  }
}

/**
 * POST /api/vendors/verify
 *
 * Submit verification request (starts Smile Identity verification or manual review)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify user authentication
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Only vendors can verify
    if (session.user_role !== 'vendor') {
      return NextResponse.json({ error: 'Only vendors can submit verification' }, { status: 403 });
    }

    const body = await request.json();
    const {
      firstName,
      lastName,
      idType,
      idNumber,
      dob,
      phone,
      selfieImage,
      idImageFront,
      idImageBack,
      useSmileIdentity,
    } = body;

    // Validate required fields
    if (!firstName || !lastName || !idType || !idNumber) {
      return NextResponse.json({
        error: 'First name, last name, ID type, and ID number are required',
      }, { status: 400 });
    }

    // Get or create vendor record
    const vendor = await getVendorByUserId(session.user_id);

    if (!vendor) {
      // If no vendor record exists, we need to create one
      // This shouldn't happen normally as vendor registration creates the record
      return NextResponse.json({
        error: 'Vendor record not found. Please complete registration first.',
      }, { status: 400 });
    }

    // Check if already verified
    if (vendor.verification_status === 'verified') {
      return NextResponse.json({
        error: 'Your account is already verified',
      }, { status: 400 });
    }

    // Check if there's a pending verification
    const existingJobId = await getVendorKycJobId(session.user_id);
    if (existingJobId && vendor.verification_status === 'under_review') {
      return NextResponse.json({
        error: 'Verification is already in progress',
        jobId: existingJobId,
      }, { status: 400 });
    }

    // Try Smile Identity if enabled and requested
    const smileAvailable = await isSmileIdentityAvailable();
    if (useSmileIdentity && smileAvailable) {
      const verificationResult = await createVerificationJob({
        userId: session.user_id,
        firstName,
        lastName,
        idType: idType.toUpperCase().replace(/\s+/g, '_'),
        idNumber,
        country: 'GH',
        dob,
        phone,
        selfieImage,
        idImageFront,
        idImageBack,
      });

      if (verificationResult.success && verificationResult.jobId) {
        // Store the job ID
        await setVendorKycJobId(session.user_id, verificationResult.jobId);

        // Log the action
        await createAuditLog({
          action: 'VENDOR_KYC_INITIATED',
          category: 'vendor',
          adminId: session.user_id,
          targetId: vendor.id,
          targetType: 'vendor',
          targetName: vendor.business_name,
          details: `KYC verification initiated via Smile Identity (Job: ${verificationResult.jobId})`,
          severity: 'info',
          ipAddress: request.headers.get('x-forwarded-for') || undefined,
        });

        // For sandbox, the verification is instant
        const verifyConfig = await getSmileIdConfig();
        if (verifyConfig?.environment === 'sandbox' && verificationResult.status === 'approved') {
          // Auto-approve in sandbox
          await updateVendor(vendor.id, {
            verificationStatus: 'verified',
            verificationNotes: 'Verified via Smile Identity (Sandbox)',
            verifiedAt: new Date().toISOString(),
            verifiedBy: 'smile_identity_sandbox',
            storeStatus: 'active',
          });

          return NextResponse.json({
            success: true,
            status: 'approved',
            message: 'Verification successful! (Sandbox Mode)',
            jobId: verificationResult.jobId,
          });
        }

        return NextResponse.json({
          success: true,
          status: 'pending',
          message: 'Verification submitted. You will be notified when complete.',
          jobId: verificationResult.jobId,
        });
      } else {
        // Smile Identity failed, fall back to manual review
        console.warn('[VENDOR_VERIFY] Smile Identity failed:', verificationResult.error);
      }
    }

    // Manual review fallback
    await updateVendor(vendor.id, {
      verificationStatus: 'under_review',
      verificationNotes: `Manual review requested. ID Type: ${idType}, ID Number: ${idNumber}`,
    });

    // Log the action
    await createAuditLog({
      action: 'VENDOR_VERIFICATION_SUBMITTED',
      category: 'vendor',
      adminId: session.user_id,
      targetId: vendor.id,
      targetType: 'vendor',
      targetName: vendor.business_name,
      details: 'Vendor verification submitted for manual review',
      severity: 'info',
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    });

    return NextResponse.json({
      success: true,
      status: 'under_review',
      message: 'Verification submitted for manual review. This usually takes 24-48 hours.',
    });
  } catch (error) {
    console.error('[VENDOR_VERIFY] POST error:', error);
    return NextResponse.json({ error: 'Failed to submit verification' }, { status: 500 });
  }
}

/**
 * PUT /api/vendors/verify
 *
 * Check status of pending verification
 */
export async function PUT(request: NextRequest) {
  try {
    // Verify user authentication
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { jobId } = await request.json();

    if (!jobId) {
      // Check for stored job ID
      const storedJobId = await getVendorKycJobId(session.user_id);
      if (!storedJobId) {
        return NextResponse.json({ error: 'No pending verification found' }, { status: 400 });
      }

      const status = await checkVerificationStatus(storedJobId);
      return NextResponse.json({
        jobId: storedJobId,
        ...status,
      });
    }

    const status = await checkVerificationStatus(jobId);
    return NextResponse.json({
      jobId,
      ...status,
    });
  } catch (error) {
    console.error('[VENDOR_VERIFY] PUT error:', error);
    return NextResponse.json({ error: 'Failed to check verification status' }, { status: 500 });
  }
}
