/**
 * Paystack Payment Service
 *
 * Handles all payment processing for the marketplace.
 * Credentials are managed from Admin → API Management.
 *
 * PRODUCTION-READY: All mock/stub logic removed.
 * Credentials are fetched from the database (server-side) or API (client-side).
 *
 * Capabilities:
 * - Checkout payment processing
 * - Mobile Money payments (MTN, Vodafone, AirtelTigo)
 * - Order payment confirmation
 * - Webhook handling
 */

import { executeAPI, isIntegrationReady, APIExecutionError, getIntegrationStatus } from '../api-execution-layer';

export type PaymentChannel = 'card' | 'mobile_money' | 'bank' | 'ussd' | 'qr';
export type MobileMoneyProvider = 'mtn' | 'vodafone' | 'airteltigo';
export type PaymentStatus = 'pending' | 'success' | 'failed' | 'abandoned';

const INTEGRATION_ID = 'paystack';
const PAYSTACK_API_BASE = 'https://api.paystack.co';

export interface PaymentInitializeRequest {
  email: string;
  amount: number; // In GHS (will be converted to pesewas)
  reference?: string;
  currency?: string;
  channels?: PaymentChannel[];
  metadata?: Record<string, unknown>;
  callback_url?: string;
}

export interface PaymentInitializeResponse {
  success: boolean;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
  error?: string;
  integrationDisabled?: boolean;
}

export interface MobileMoneyChargeRequest {
  email: string;
  amount: number;
  phone: string;
  provider: MobileMoneyProvider;
  reference?: string;
  metadata?: Record<string, unknown>;
}

export interface MobileMoneyChargeResponse {
  success: boolean;
  data?: {
    reference: string;
    status: 'send_otp' | 'pending' | 'success' | 'failed';
    display_text?: string;
  };
  error?: string;
  integrationDisabled?: boolean;
}

export interface PaymentVerifyResponse {
  success: boolean;
  data?: {
    reference: string;
    amount: number;
    currency: string;
    status: PaymentStatus;
    channel: PaymentChannel;
    paid_at?: string;
    customer: {
      email: string;
      phone?: string;
    };
    metadata?: Record<string, unknown>;
  };
  error?: string;
  integrationDisabled?: boolean;
}

// Cache for client-side paystack config (fetched via API)
interface PaystackConfig {
  publicKey: string;
  secretKey: string;
  isLive: boolean;
  webhookSecret: string;
}
let cachedConfig: PaystackConfig | null = null;
let configFetchPromise: Promise<PaystackConfig | null> | null = null;

/**
 * Get Paystack configuration from database (server-side)
 */
export const getPaystackConfigServer = (): {
  publicKey: string;
  secretKey: string;
  webhookSecret: string;
  isLive: boolean;
} | null => {
  // Only run on server
  if (typeof window !== 'undefined') {
    return null;
  }

  try {
    // Dynamic import to avoid client-side bundling issues
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getPaystackCredentials } = require('@/lib/db/dal/integrations');
    const credentials = getPaystackCredentials();

    if (!credentials || !credentials.isConfigured || !credentials.isEnabled) {
      return null;
    }

    if (!credentials.publicKey || !credentials.secretKey) {
      return null;
    }

    return {
      publicKey: credentials.publicKey,
      secretKey: credentials.secretKey,
      webhookSecret: credentials.webhookSecret || '',
      isLive: credentials.environment === 'live',
    };
  } catch (error) {
    console.error('[PAYSTACK] Failed to get server config:', error);
    return null;
  }
};

/**
 * Get Paystack configuration (client-side, fetches from API)
 */
export const getPaystackConfig = (): {
  publicKey: string;
  secretKey: string;
  isLive: boolean;
} | null => {
  // On server, use database directly
  if (typeof window === 'undefined') {
    return getPaystackConfigServer();
  }

  // Return cached config if available
  return cachedConfig;
};

/**
 * Fetch and cache Paystack configuration from API (client-side)
 */
export const fetchPaystackConfig = async (): Promise<{
  publicKey: string;
  secretKey: string;
  isLive: boolean;
} | null> => {
  // On server, use database directly
  if (typeof window === 'undefined') {
    return getPaystackConfigServer();
  }

  // Return cached if available
  if (cachedConfig) {
    return cachedConfig;
  }

  // Avoid duplicate fetches
  if (configFetchPromise) {
    return configFetchPromise;
  }

  configFetchPromise = (async () => {
    try {
      // Use the public config endpoint (accessible to all authenticated users)
      const response = await fetch('/api/paystack/config', { credentials: 'include' });
      if (!response.ok) {
        console.error('[PAYSTACK] Config fetch failed:', response.status);
        return null;
      }

      const data = await response.json();

      if (!data.enabled || !data.publicKey) {
        console.log('[PAYSTACK] Not enabled or no public key');
        return null;
      }

      cachedConfig = {
        publicKey: data.publicKey,
        secretKey: '', // Not exposed to client (security)
        webhookSecret: '',
        isLive: data.isLive || false,
      };

      return cachedConfig;
    } catch (error) {
      console.error('[PAYSTACK] Failed to fetch config:', error);
      return null;
    } finally {
      configFetchPromise = null;
    }
  })();

  return configFetchPromise;
};

/**
 * Clear cached Paystack config (call when config is updated)
 */
export const clearPaystackConfigCache = (): void => {
  cachedConfig = null;
  configFetchPromise = null;
};

/**
 * Check if Paystack is available for checkout
 */
export const isPaystackEnabled = (): boolean => {
  return isIntegrationReady(INTEGRATION_ID);
};

/**
 * Get Paystack status for UI display
 */
export const getPaystackStatus = (): {
  available: boolean;
  message: string;
} => {
  const status = getIntegrationStatus(INTEGRATION_ID);
  return {
    available: status.available,
    message: status.message,
  };
};

/**
 * Generate unique payment reference
 */
export const generatePaymentReference = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `MH_${timestamp}_${random}`.toUpperCase();
};

/**
 * Convert GHS to pesewas (Paystack uses smallest currency unit)
 */
const toPesewas = (amountInGHS: number): number => {
  return Math.round(amountInGHS * 100);
};

/**
 * Convert pesewas to GHS
 */
export const toGHS = (amountInPesewas: number): number => {
  return amountInPesewas / 100;
};

/**
 * Initialize a payment transaction via Paystack API
 * Returns authorization URL for redirect-based flow
 */
export const initializePayment = async (
  request: PaymentInitializeRequest
): Promise<PaymentInitializeResponse> => {
  const config = getPaystackConfig();

  if (!config) {
    const status = getPaystackStatus();
    return {
      success: false,
      error: status.message || 'Payment gateway not configured. Please contact support.',
      integrationDisabled: true,
    };
  }

  const reference = request.reference || generatePaymentReference();

  const result = await executeAPI<{
    status: boolean;
    message: string;
    data: {
      authorization_url: string;
      access_code: string;
      reference: string;
    };
  }>(
    INTEGRATION_ID,
    'initialize_transaction',
    async () => {
      const response = await fetch(`${PAYSTACK_API_BASE}/transaction/initialize`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: request.email,
          amount: toPesewas(request.amount),
          currency: request.currency || 'GHS',
          reference,
          channels: request.channels,
          callback_url: request.callback_url,
          metadata: request.metadata,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: Payment initialization failed`);
      }

      return response.json();
    },
    { timeout: 30000, maxRetries: 2 }
  );

  if (!result.success || !result.data?.status) {
    return {
      success: false,
      error: result.error?.message || result.data?.message || 'Payment initialization failed',
    };
  }

  return {
    success: true,
    data: {
      authorization_url: result.data.data.authorization_url,
      access_code: result.data.data.access_code,
      reference: result.data.data.reference,
    },
  };
};

/**
 * Initialize Mobile Money charge via Paystack API
 */
export const initializeMobileMoneyPayment = async (
  request: MobileMoneyChargeRequest
): Promise<MobileMoneyChargeResponse> => {
  const config = getPaystackConfig();

  if (!config) {
    const status = getPaystackStatus();
    return {
      success: false,
      error: status.message || 'Payment gateway not configured. Please contact support.',
      integrationDisabled: true,
    };
  }

  // Validate phone number format for Ghana
  const phone = request.phone.replace(/\s/g, '');
  if (!phone.match(/^(\+233|0)([235][0-9]{8})$/)) {
    return {
      success: false,
      error: 'Invalid phone number format. Use 0XX XXX XXXX or +233 XX XXX XXXX',
    };
  }

  // Provider-specific validation
  const providerPrefixes: Record<MobileMoneyProvider, string[]> = {
    mtn: ['024', '054', '055', '059'],
    vodafone: ['020', '050'],
    airteltigo: ['026', '027', '056', '057'],
  };

  const phonePrefix = phone.replace(/^\+233/, '0').substring(0, 3);
  if (!providerPrefixes[request.provider].includes(phonePrefix)) {
    return {
      success: false,
      error: `Phone number doesn't match ${request.provider.toUpperCase()} provider`,
    };
  }

  const reference = request.reference || generatePaymentReference();
  const formattedPhone = phone.replace(/^0/, '+233');

  const result = await executeAPI<{
    status: boolean;
    message: string;
    data: {
      reference: string;
      status: string;
      display_text?: string;
    };
  }>(
    INTEGRATION_ID,
    'charge_mobile_money',
    async () => {
      const response = await fetch(`${PAYSTACK_API_BASE}/charge`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: request.email,
          amount: toPesewas(request.amount),
          currency: 'GHS',
          reference,
          mobile_money: {
            phone: formattedPhone,
            provider: request.provider,
          },
          metadata: request.metadata,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: Mobile Money charge failed`);
      }

      return response.json();
    },
    { timeout: 60000, maxRetries: 1 }
  );

  if (!result.success || !result.data?.status) {
    return {
      success: false,
      error: result.error?.message || result.data?.message || 'Mobile Money charge failed',
    };
  }

  return {
    success: true,
    data: {
      reference: result.data.data.reference,
      status: result.data.data.status as 'send_otp' | 'pending' | 'success' | 'failed',
      display_text: result.data.data.display_text,
    },
  };
};

/**
 * Submit OTP for Mobile Money payment
 */
export const submitMobileMoneyOTP = async (
  reference: string,
  otp: string
): Promise<{ success: boolean; error?: string }> => {
  const config = getPaystackConfig();

  if (!config) {
    return { success: false, error: 'Payment gateway not configured' };
  }

  if (otp.length !== 6) {
    return { success: false, error: 'OTP must be 6 digits' };
  }

  const result = await executeAPI<{ status: boolean; message: string }>(
    INTEGRATION_ID,
    'submit_otp',
    async () => {
      const response = await fetch(`${PAYSTACK_API_BASE}/charge/submit_otp`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          otp,
          reference,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: OTP submission failed`);
      }

      return response.json();
    },
    { timeout: 30000, maxRetries: 1 }
  );

  if (!result.success) {
    return {
      success: false,
      error: result.error?.message || 'OTP submission failed',
    };
  }

  return { success: true };
};

/**
 * Verify payment status via Paystack API
 */
export const verifyPayment = async (
  reference: string
): Promise<PaymentVerifyResponse> => {
  const config = getPaystackConfig();

  if (!config) {
    return {
      success: false,
      error: 'Payment gateway not configured',
      integrationDisabled: true,
    };
  }

  const result = await executeAPI<{
    status: boolean;
    message: string;
    data: {
      reference: string;
      amount: number;
      currency: string;
      status: string;
      channel: string;
      paid_at?: string;
      customer: {
        email: string;
        phone?: string;
      };
      metadata?: Record<string, unknown>;
    };
  }>(
    INTEGRATION_ID,
    'verify_transaction',
    async () => {
      const response = await fetch(`${PAYSTACK_API_BASE}/transaction/verify/${reference}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.secretKey}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: Payment verification failed`);
      }

      return response.json();
    },
    { timeout: 30000, maxRetries: 2 }
  );

  if (!result.success || !result.data?.status) {
    return {
      success: false,
      error: result.error?.message || result.data?.message || 'Payment verification failed',
    };
  }

  const paymentData = result.data.data;

  return {
    success: true,
    data: {
      reference: paymentData.reference,
      amount: paymentData.amount,
      currency: paymentData.currency,
      status: paymentData.status as PaymentStatus,
      channel: paymentData.channel as PaymentChannel,
      paid_at: paymentData.paid_at,
      customer: paymentData.customer,
      metadata: paymentData.metadata,
    },
  };
};

/**
 * Load Paystack Inline Script for popup checkout
 */
export const loadPaystackScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Window not available'));
      return;
    }

    // Check if already loaded
    if ((window as unknown as { PaystackPop?: unknown }).PaystackPop) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;

    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Paystack script'));

    document.head.appendChild(script);
  });
};

/**
 * Open Paystack popup for payment
 * This uses the client-side Paystack Popup integration
 */
export const openPaystackPopup = async (options: {
  email: string;
  amount: number;
  reference?: string;
  metadata?: Record<string, unknown>;
  onSuccess: (response: { reference: string; status: string }) => void;
  onClose: () => void;
}): Promise<void> => {
  const config = getPaystackConfig();

  if (!config) {
    throw new APIExecutionError(
      'Paystack not configured. Please contact support.',
      INTEGRATION_ID,
      { isRetryable: false }
    );
  }

  await loadPaystackScript();

  const PaystackPop = (window as unknown as { PaystackPop: { setup: (opts: Record<string, unknown>) => { openIframe: () => void } } }).PaystackPop;

  if (!PaystackPop) {
    throw new APIExecutionError(
      'Failed to load Paystack. Please refresh and try again.',
      INTEGRATION_ID,
      { isRetryable: true }
    );
  }

  const handler = PaystackPop.setup({
    key: config.publicKey,
    email: options.email,
    amount: toPesewas(options.amount),
    currency: 'GHS',
    ref: options.reference || generatePaymentReference(),
    metadata: options.metadata,
    callback: (response: { reference: string; status: string }) => {
      options.onSuccess(response);
    },
    onClose: () => {
      options.onClose();
    },
  });

  handler.openIframe();
};

/**
 * Webhook signature verification helper
 * Note: This should be used server-side only
 */
export const verifyWebhookSignature = (
  payload: string,
  signature: string
): boolean => {
  const config = getPaystackConfigServer();

  if (!config?.webhookSecret) {
    console.error('Webhook secret not configured');
    return false;
  }

  try {
    // Use Node.js crypto for HMAC verification
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require('crypto');
    const hash = crypto.createHmac('sha512', config.webhookSecret).update(payload).digest('hex');
    return hash === signature;
  } catch (error) {
    console.error('[PAYSTACK] Webhook verification error:', error);
    return false;
  }
};

/**
 * Format amount for display
 */
export const formatAmount = (amount: number): string => {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
  }).format(amount);
};

/**
 * Get list of banks for bank transfer
 */
export const getBankList = async (): Promise<{
  success: boolean;
  banks?: Array<{ code: string; name: string }>;
  error?: string;
}> => {
  const config = getPaystackConfig();

  if (!config) {
    return { success: false, error: 'Paystack not configured' };
  }

  const result = await executeAPI<{
    status: boolean;
    data: Array<{ code: string; name: string }>;
  }>(
    INTEGRATION_ID,
    'list_banks',
    async () => {
      const response = await fetch(`${PAYSTACK_API_BASE}/bank?country=ghana`, {
        headers: {
          'Authorization': `Bearer ${config.secretKey}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch banks');
      }

      return response.json();
    },
    { timeout: 15000 }
  );

  if (!result.success) {
    return { success: false, error: result.error?.message };
  }

  return {
    success: true,
    banks: result.data?.data,
  };
};
