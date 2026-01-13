/**
 * Smile Identity Service
 *
 * KYC verification service for vendor identity verification.
 * Uses the official smile-identity-core SDK for proper authentication.
 * Supports document verification, selfie matching, and enhanced KYC.
 */

import { getSmileIdentityCredentials } from '@/lib/db/dal/integrations';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const smileIdentityCore = require('smile-identity-core');
const WebApi = smileIdentityCore.WebApi;
const IDApi = smileIdentityCore.IDApi;
const Signature = smileIdentityCore.Signature;

export interface SmileIdentityConfig {
  partnerId: string;
  apiKey: string;
  callbackUrl: string;
  environment: 'sandbox' | 'production';
  enableDocumentVerification: boolean;
  enableSelfieVerification: boolean;
  enableEnhancedKYC: boolean;
}

export interface VerificationRequest {
  userId: string;
  firstName: string;
  lastName: string;
  idType: 'DRIVERS_LICENSE' | 'NATIONAL_ID' | 'PASSPORT' | 'VOTER_ID' | 'GHANA_CARD';
  idNumber: string;
  country: string;
  dob?: string;
  phone?: string;
  selfieImage?: string; // Base64 encoded
  idImageFront?: string; // Base64 encoded
  idImageBack?: string; // Base64 encoded
}

export interface VerificationResult {
  success: boolean;
  jobId?: string;
  status: 'pending' | 'approved' | 'rejected' | 'review';
  confidence?: number;
  resultCode?: string;
  resultText?: string;
  error?: string;
  actions?: {
    documentVerification?: 'Verified' | 'Not Verified' | 'Pending';
    selfieMatch?: 'Verified' | 'Not Verified' | 'Pending';
    livenessCheck?: 'Passed' | 'Failed' | 'Pending';
  };
}

/**
 * Get Smile Identity configuration (async)
 */
export async function getSmileIdConfig(): Promise<SmileIdentityConfig | null> {
  const credentials = await getSmileIdentityCredentials();
  if (!credentials || !credentials.isConfigured) {
    return null;
  }

  return {
    partnerId: credentials.partnerId,
    apiKey: credentials.apiKey,
    callbackUrl: credentials.callbackUrl,
    environment: credentials.environment === 'production' ? 'production' : 'sandbox',
    enableDocumentVerification: credentials.enableDocumentVerification,
    enableSelfieVerification: credentials.enableSelfieVerification,
    enableEnhancedKYC: credentials.enableEnhancedKYC,
  };
}

/**
 * Check if Smile Identity is available and configured (async)
 */
export async function isSmileIdentityAvailable(): Promise<boolean> {
  const credentials = await getSmileIdentityCredentials();
  return !!(credentials?.isConfigured && credentials?.isEnabled);
}

/**
 * Generate HMAC signature for Smile Identity requests
 */
export function generateSignature(partnerId: string, apiKey: string): { signature: string; timestamp: string } {
  const signature = new Signature(partnerId, apiKey);
  const timestamp = new Date().toISOString();
  const sig = signature.generate_signature(timestamp);
  return { signature: sig, timestamp };
}

/**
 * Verify incoming webhook signature
 */
export function verifyWebhookSignature(
  partnerId: string,
  apiKey: string,
  timestamp: string,
  incomingSignature: string
): boolean {
  try {
    const signature = new Signature(partnerId, apiKey);
    return signature.confirm_signature(timestamp, incomingSignature);
  } catch {
    return false;
  }
}

/**
 * Create a verification job for a vendor using official SDK
 */
export async function createVerificationJob(
  request: VerificationRequest
): Promise<VerificationResult> {
  const config = await getSmileIdConfig();

  if (!config) {
    return {
      success: false,
      status: 'rejected',
      error: 'Smile Identity is not configured. Please configure it in Admin > API Management.',
    };
  }

  // In sandbox mode, simulate verification for quick testing
  if (config.environment === 'sandbox') {
    return simulateSandboxVerification(request);
  }

  try {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Use IDApi for ID verification without images
    if (!request.selfieImage && !request.idImageFront) {
      return await submitIdVerification(config, request, jobId);
    }

    // Use WebApi for biometric KYC with images
    return await submitBiometricVerification(config, request, jobId);
  } catch (error) {
    console.error('[SMILE_ID] Verification error:', error);
    return {
      success: false,
      status: 'rejected',
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

/**
 * Submit ID verification (without images) using IDApi
 */
async function submitIdVerification(
  config: SmileIdentityConfig,
  request: VerificationRequest,
  jobId: string
): Promise<VerificationResult> {
  try {
    const sidServer = config.environment === 'production' ? 1 : 0;
    const connection = new IDApi(config.partnerId, config.apiKey, sidServer);

    const partnerParams = {
      user_id: request.userId,
      job_id: jobId,
      job_type: 5, // Basic KYC
    };

    const idInfo = {
      country: request.country || 'GH',
      id_type: request.idType,
      id_number: request.idNumber,
      first_name: request.firstName,
      last_name: request.lastName,
      dob: request.dob,
      phone_number: request.phone,
    };

    const response = await connection.submit_job(partnerParams, idInfo);

    console.log('[SMILE_ID] ID verification response:', JSON.stringify(response, null, 2));

    return mapSmileIdResponse(response, jobId);
  } catch (error) {
    console.error('[SMILE_ID] ID verification error:', error);
    throw error;
  }
}

/**
 * Submit biometric verification (with images) using WebApi
 */
async function submitBiometricVerification(
  config: SmileIdentityConfig,
  request: VerificationRequest,
  jobId: string
): Promise<VerificationResult> {
  try {
    const sidServer = config.environment === 'production' ? 1 : 0;
    const connection = new WebApi(
      config.partnerId,
      config.callbackUrl,
      config.apiKey,
      sidServer
    );

    const partnerParams = {
      user_id: request.userId,
      job_id: jobId,
      job_type: 1, // Biometric KYC
    };

    // Build image details array
    const imageDetails: Array<{ image_type_id: number; image: string }> = [];

    if (request.selfieImage) {
      imageDetails.push({
        image_type_id: 0, // Selfie
        image: request.selfieImage,
      });
    }

    if (request.idImageFront) {
      imageDetails.push({
        image_type_id: 1, // ID Card Front
        image: request.idImageFront,
      });
    }

    if (request.idImageBack) {
      imageDetails.push({
        image_type_id: 2, // ID Card Back
        image: request.idImageBack,
      });
    }

    const idInfo = {
      country: request.country || 'GH',
      id_type: request.idType,
      id_number: request.idNumber,
      first_name: request.firstName,
      last_name: request.lastName,
      dob: request.dob,
    };

    const options = {
      return_job_status: true,
      return_history: false,
      return_image_links: false,
    };

    const response = await connection.submit_job(partnerParams, imageDetails, idInfo, options);

    console.log('[SMILE_ID] Biometric verification response:', JSON.stringify(response, null, 2));

    return mapSmileIdResponse(response, jobId);
  } catch (error) {
    console.error('[SMILE_ID] Biometric verification error:', error);
    throw error;
  }
}

/**
 * Map Smile ID SDK response to our VerificationResult format
 */
function mapSmileIdResponse(response: unknown, jobId: string): VerificationResult {
  const data = response as {
    job_success?: boolean;
    result?: {
      ResultCode?: string;
      ResultText?: string;
      ConfidenceValue?: string;
      Actions?: {
        Verify_ID_Number?: string;
        Return_Personal_Info?: string;
        Human_Review_Compare?: string;
        Human_Review_Liveness_Check?: string;
        Liveness_Check?: string;
        Selfie_To_ID_Card_Compare?: string;
      };
    };
    SmileJobID?: string;
    ResultCode?: string;
    ResultText?: string;
  };

  const resultCode = data.result?.ResultCode || data.ResultCode || '';
  const resultText = data.result?.ResultText || data.ResultText || '';
  const confidence = data.result?.ConfidenceValue 
    ? parseFloat(data.result.ConfidenceValue) 
    : undefined;

  // Determine status based on result code
  let status: VerificationResult['status'] = 'pending';
  if (resultCode === '0810' || resultCode === '0820' || data.job_success === true) {
    status = 'approved';
  } else if (resultCode.startsWith('1')) {
    status = 'rejected';
  } else if (resultCode.startsWith('2')) {
    status = 'review';
  }

  // Map actions
  const actions: VerificationResult['actions'] = {};
  if (data.result?.Actions) {
    const a = data.result.Actions;
    if (a.Verify_ID_Number === 'Verified' || a.Human_Review_Compare === 'Verified') {
      actions.documentVerification = 'Verified';
    } else if (a.Verify_ID_Number === 'Not Verified') {
      actions.documentVerification = 'Not Verified';
    } else {
      actions.documentVerification = 'Pending';
    }

    if (a.Selfie_To_ID_Card_Compare === 'Verified') {
      actions.selfieMatch = 'Verified';
    } else if (a.Selfie_To_ID_Card_Compare) {
      actions.selfieMatch = 'Not Verified';
    }

    if (a.Liveness_Check === 'Passed' || a.Human_Review_Liveness_Check === 'Passed') {
      actions.livenessCheck = 'Passed';
    } else if (a.Liveness_Check === 'Failed') {
      actions.livenessCheck = 'Failed';
    } else {
      actions.livenessCheck = 'Pending';
    }
  }

  return {
    success: status === 'approved' || status === 'pending',
    jobId: data.SmileJobID || jobId,
    status,
    confidence,
    resultCode,
    resultText,
    actions: Object.keys(actions).length > 0 ? actions : undefined,
  };
}

/**
 * Simulate verification in sandbox mode
 */
function simulateSandboxVerification(request: VerificationRequest): VerificationResult {
  const jobId = `sandbox_job_${Date.now()}`;

  const hasRequiredFields = !!(
    request.firstName &&
    request.lastName &&
    request.idType &&
    request.idNumber
  );

  if (!hasRequiredFields) {
    return {
      success: false,
      jobId,
      status: 'rejected',
      error: 'Missing required fields for verification',
    };
  }

  return {
    success: true,
    jobId,
    status: 'approved',
    confidence: 95.5,
    resultCode: '0810',
    resultText: 'Document Verified (Sandbox)',
    actions: {
      documentVerification: 'Verified',
      selfieMatch: request.selfieImage ? 'Verified' : 'Pending',
      livenessCheck: 'Passed',
    },
  };
}

/**
 * Check verification job status using SDK
 */
export async function checkVerificationStatus(
  jobId: string,
  userId?: string
): Promise<VerificationResult> {
  const config = await getSmileIdConfig();

  if (!config) {
    return {
      success: false,
      status: 'rejected',
      error: 'Smile Identity is not configured',
    };
  }

  // In sandbox mode, always return approved
  if (config.environment === 'sandbox' || jobId.startsWith('sandbox_')) {
    return {
      success: true,
      jobId,
      status: 'approved',
      confidence: 95.5,
      resultCode: '0810',
      resultText: 'Document Verified (Sandbox)',
      actions: {
        documentVerification: 'Verified',
        selfieMatch: 'Verified',
        livenessCheck: 'Passed',
      },
    };
  }

  try {
    const sidServer = config.environment === 'production' ? 1 : 0;
    const connection = new WebApi(
      config.partnerId,
      config.callbackUrl,
      config.apiKey,
      sidServer
    );

    const partnerParams = {
      user_id: userId || 'unknown',
      job_id: jobId,
    };

    const options = {
      return_history: false,
      return_image_links: false,
    };

    const response = await connection.get_job_status(partnerParams, options);

    console.log('[SMILE_ID] Job status response:', JSON.stringify(response, null, 2));

    return mapSmileIdResponse(response, jobId);
  } catch (error) {
    console.error('[SMILE_ID] Status check error:', error);
    return {
      success: false,
      jobId,
      status: 'pending',
      error: error instanceof Error ? error.message : 'Failed to check status',
    };
  }
}

/**
 * Get supported ID types for a country
 */
export function getSupportedIdTypes(country: string = 'GH'): { value: string; label: string }[] {
  const idTypes: Record<string, { value: string; label: string }[]> = {
    GH: [
      { value: 'GHANA_CARD', label: 'Ghana Card' },
      { value: 'PASSPORT', label: 'Passport' },
      { value: 'DRIVERS_LICENSE', label: "Driver's License" },
      { value: 'VOTER_ID', label: "Voter's ID" },
    ],
    NG: [
      { value: 'NIN', label: 'National ID (NIN)' },
      { value: 'BVN', label: 'Bank Verification Number (BVN)' },
      { value: 'PASSPORT', label: 'Passport' },
      { value: 'DRIVERS_LICENSE', label: "Driver's License" },
      { value: 'VOTER_ID', label: "Voter's Card" },
    ],
    KE: [
      { value: 'NATIONAL_ID', label: 'National ID' },
      { value: 'PASSPORT', label: 'Passport' },
      { value: 'DRIVERS_LICENSE', label: "Driver's License" },
    ],
    ZA: [
      { value: 'NATIONAL_ID', label: 'National ID' },
      { value: 'PASSPORT', label: 'Passport' },
      { value: 'DRIVERS_LICENSE', label: "Driver's License" },
    ],
  };

  return idTypes[country] || idTypes.GH;
}
