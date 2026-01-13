/**
 * Smile Identity Webhook Handler
 *
 * Handles KYC verification result notifications from Smile Identity.
 * Updates vendor verification status based on results.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSmileIdentityCredentials } from '@/lib/db/dal/integrations';
import { verifyWebhookSignature } from '@/lib/services/smile-identity';

interface SmileIdWebhookPayload {
  ResultCode: string;
  ResultText: string;
  Actions: {
    Document_Check?: string;
    Selfie_Check?: string;
    Liveness_Check?: string;
    Human_Review_Compare?: string;
    Human_Review_Liveness_Check?: string;
  };
  PartnerParams: {
    user_id: string;
    job_id: string;
    job_type: number;
  };
  ResultType: string;
  SmileJobID: string;
  signature?: string;
  timestamp?: string;
}

/**
 * POST /api/webhooks/smile-identity
 *
 * Handle Smile Identity verification result webhooks
 */
export async function POST(request: NextRequest) {
  try {
    // Get Smile Identity credentials
    const credentials = await getSmileIdentityCredentials();

    if (!credentials || !credentials.isEnabled) {
      console.error('[SMILE_ID_WEBHOOK] Smile Identity is not configured or enabled');
      return NextResponse.json({ error: 'Verification service not configured' }, { status: 503 });
    }

    // Parse the webhook payload
    let payload: SmileIdWebhookPayload;
    try {
      payload = await request.json();
    } catch {
      console.error('[SMILE_ID_WEBHOOK] Invalid JSON payload');
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    console.log(`[SMILE_ID_WEBHOOK] Received verification result for job: ${payload.SmileJobID}`);
    console.log(`[SMILE_ID_WEBHOOK] Result: ${payload.ResultCode} - ${payload.ResultText}`);

    // Verify webhook signature (optional but recommended for production)
    if (payload.signature && payload.timestamp && credentials.environment === 'production') {
      const isValid = verifyWebhookSignature(
        credentials.partnerId,
        credentials.apiKey,
        payload.timestamp,
        payload.signature
      );
      if (!isValid) {
        console.error('[SMILE_ID_WEBHOOK] Invalid webhook signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
      console.log('[SMILE_ID_WEBHOOK] Webhook signature verified');
    }

    // Extract user ID from partner params
    const userId = payload.PartnerParams?.user_id;

    if (!userId) {
      console.error('[SMILE_ID_WEBHOOK] No user ID in partner params');
      return NextResponse.json({ error: 'Missing user ID' }, { status: 400 });
    }

    // Determine verification status based on result code
    let verificationStatus: 'verified' | 'rejected' | 'under_review';
    let verificationNotes: string;

    // Smile ID result codes:
    // 0810, 0820 = Verified
    // 1xxx = Not Verified
    // 2xxx = Needs Human Review

    if (payload.ResultCode === '0810' || payload.ResultCode === '0820') {
      verificationStatus = 'verified';
      verificationNotes = 'Identity verified via Smile Identity';
    } else if (payload.ResultCode.startsWith('1')) {
      verificationStatus = 'rejected';
      verificationNotes = `Verification failed: ${payload.ResultText}`;
    } else {
      verificationStatus = 'under_review';
      verificationNotes = `Requires manual review: ${payload.ResultText}`;
    }

    // Build action details
    const actionDetails: string[] = [];
    if (payload.Actions.Document_Check) {
      actionDetails.push(`Document: ${payload.Actions.Document_Check}`);
    }
    if (payload.Actions.Selfie_Check) {
      actionDetails.push(`Selfie: ${payload.Actions.Selfie_Check}`);
    }
    if (payload.Actions.Liveness_Check) {
      actionDetails.push(`Liveness: ${payload.Actions.Liveness_Check}`);
    }

    if (actionDetails.length > 0) {
      verificationNotes += ` (${actionDetails.join(', ')})`;
    }

    try {
      // Update vendor verification status
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { updateVendorVerificationStatus } = require('@/lib/db/dal/vendors');

      updateVendorVerificationStatus(userId, {
        verificationStatus,
        verificationNotes,
        smileJobId: payload.SmileJobID,
        verifiedAt: verificationStatus === 'verified' ? new Date().toISOString() : undefined,
      });

      console.log(`[SMILE_ID_WEBHOOK] Vendor ${userId} verification updated to: ${verificationStatus}`);

      // Create audit log
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createAuditLog } = require('@/lib/db/dal/audit');

      createAuditLog({
        action: 'VENDOR_VERIFICATION_RESULT',
        category: 'vendor',
        targetId: userId,
        targetType: 'vendor',
        targetName: `Vendor ${userId}`,
        details: `Verification result: ${verificationStatus} - ${payload.ResultText}`,
        severity: verificationStatus === 'verified' ? 'info' : 'warning',
      });

    } catch (error) {
      console.error(`[SMILE_ID_WEBHOOK] Failed to update vendor ${userId}:`, error);
      return NextResponse.json({ error: 'Failed to update vendor' }, { status: 500 });
    }

    return NextResponse.json({
      received: true,
      userId,
      status: verificationStatus,
    });
  } catch (error) {
    console.error('[SMILE_ID_WEBHOOK] Error processing webhook:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
