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
export const getPaystackConfigServer = async (): Promise<{
  publicKey: string;
  secretKey: string;
  webhookSecret: string;
  isLive: boolean;
} | null> => {
  // Only run on server
  if (typeof window !== 'undefined') {
    return null;
  }

  try {
    // Dynamic import to avoid client-side bundling issues
    const integrations = await import('@/lib/db/dal/integrations');
    const credentials = await integrations.getPaystackCredentials();

    console.log('[PAYSTACK] Credentials check:', {
      hasCredentials: !!credentials,
      isConfigured: credentials?.isConfigured,
      isEnabled: credentials?.isEnabled,
      hasPublicKey: !!credentials?.publicKey,
      hasSecretKey: !!credentials?.secretKey,
      environment: credentials?.environment,
    });

    if (!credentials || !credentials.isConfigured || !credentials.isEnabled) {
      console.log('[PAYSTACK] Config rejected - not configured or not enabled');
      return null;
    }

    if (!credentials.publicKey || !credentials.secretKey) {
      console.log('[PAYSTACK] Config rejected - missing keys');
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
 * Get Paystack configuration (async, works on both client and server)
 */
export const getPaystackConfig = async (): Promise<{
  publicKey: string;
  secretKey: string;
  isLive: boolean;
} | null> => {
  // On server, use database directly
  if (typeof window === 'undefined') {
    return await getPaystackConfigServer();
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
  const config = await getPaystackConfig();

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
    { timeout: 30000, maxRetries: 2, skipStatusCheck: true }
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
  const config = await getPaystackConfig();

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
    { timeout: 60000, maxRetries: 1, skipStatusCheck: true }
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
  const config = await getPaystackConfig();

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
    { timeout: 30000, maxRetries: 1, skipStatusCheck: true }
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
  const config = await getPaystackConfig();

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
    { timeout: 30000, maxRetries: 2, skipStatusCheck: true }
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
  const config = await getPaystackConfig();

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
export const verifyWebhookSignature = async (
  payload: string,
  signature: string
): Promise<boolean> => {
  const config = await getPaystackConfigServer();

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
  const config = await getPaystackConfig();

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
    { timeout: 15000, skipStatusCheck: true }
  );

  if (!result.success) {
    return { success: false, error: result.error?.message };
  }

  return {
    success: true,
    banks: result.data?.data,
  };
};

// ============================================
// PAYSTACK TRANSFERS API (Vendor Payouts)
// ============================================

export interface TransferRecipientRequest {
  type: 'nuban' | 'mobile_money' | 'ghipss';
  name: string;
  account_number: string;
  bank_code: string;
  currency?: string;
  metadata?: Record<string, unknown>;
}

export interface TransferRecipientResponse {
  success: boolean;
  data?: {
    recipient_code: string;
    name: string;
    type: string;
    currency: string;
    bank_code: string;
    account_number: string;
  };
  error?: string;
}

export interface InitiateTransferRequest {
  source?: string;
  amount: number; // In pesewas (GHS × 100)
  recipient: string; // recipient_code
  reference: string;
  reason?: string;
  currency?: string;
}

export interface TransferResponse {
  success: boolean;
  data?: {
    transfer_code: string;
    reference: string;
    status: 'pending' | 'success' | 'failed' | 'otp' | 'reversed';
    amount: number;
    currency: string;
    recipient: {
      name: string;
      account_number: string;
      bank_name: string;
    };
  };
  error?: string;
}

export interface TransferVerifyResponse {
  success: boolean;
  data?: {
    transfer_code: string;
    reference: string;
    status: 'pending' | 'success' | 'failed' | 'reversed';
    amount: number;
    currency: string;
    reason: string;
    transferred_at?: string;
    recipient: {
      name: string;
      account_number: string;
      bank_name: string;
    };
  };
  error?: string;
}

export interface ResolveBankAccountResponse {
  success: boolean;
  data?: {
    account_number: string;
    account_name: string;
    bank_id: number;
  };
  error?: string;
}

/**
 * Resolve bank account to get account name
 * This validates that the account number is valid for the given bank
 */
export const resolveBankAccount = async (
  accountNumber: string,
  bankCode: string
): Promise<ResolveBankAccountResponse> => {
  const config = await getPaystackConfig();
  if (!config) {
    return { success: false, error: 'Paystack not configured' };
  }

  const result = await executeAPI<{
    status: boolean;
    data: {
      account_number: string;
      account_name: string;
      bank_id: number;
    };
  }>(
    INTEGRATION_ID,
    'resolve_bank_account',
    async () => {
      const response = await fetch(
        `${PAYSTACK_API_BASE}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
        {
          headers: {
            'Authorization': `Bearer ${config.secretKey}`,
          },
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to resolve bank account');
      }
      return data;
    },
    { timeout: 30000, skipStatusCheck: true }
  );

  if (!result.success) {
    return { success: false, error: result.error?.message };
  }

  return {
    success: true,
    data: result.data?.data,
  };
};

/**
 * Create a transfer recipient (vendor's bank account or mobile money)
 * This must be done once before any transfers can be made
 */
export const createTransferRecipient = async (
  request: TransferRecipientRequest
): Promise<TransferRecipientResponse> => {
  const config = await getPaystackConfig();
  if (!config) {
    return { success: false, error: 'Paystack not configured' };
  }

  const result = await executeAPI<{
    status: boolean;
    data: {
      recipient_code: string;
      name: string;
      type: string;
      currency: string;
      details: {
        bank_code: string;
        account_number: string;
        bank_name: string;
      };
    };
  }>(
    INTEGRATION_ID,
    'create_transfer_recipient',
    async () => {
      const response = await fetch(`${PAYSTACK_API_BASE}/transferrecipient`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: request.type,
          name: request.name,
          account_number: request.account_number,
          bank_code: request.bank_code,
          currency: request.currency || 'GHS',
          metadata: request.metadata,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to create transfer recipient');
      }
      return data;
    },
    { timeout: 30000, skipStatusCheck: true }
  );

  if (!result.success) {
    return { success: false, error: result.error?.message };
  }

  return {
    success: true,
    data: {
      recipient_code: result.data?.data.recipient_code || '',
      name: result.data?.data.name || '',
      type: result.data?.data.type || '',
      currency: result.data?.data.currency || 'GHS',
      bank_code: result.data?.data.details?.bank_code || '',
      account_number: result.data?.data.details?.account_number || '',
    },
  };
};

/**
 * Initiate a transfer to a recipient
 * Amount is in pesewas (GHS × 100)
 */
export const initiateTransfer = async (
  request: InitiateTransferRequest
): Promise<TransferResponse> => {
  const config = await getPaystackConfig();
  if (!config) {
    return { success: false, error: 'Paystack not configured' };
  }

  const result = await executeAPI<{
    status: boolean;
    data: {
      transfer_code: string;
      reference: string;
      status: 'pending' | 'success' | 'failed' | 'otp' | 'reversed';
      amount: number;
      currency: string;
      recipient: {
        name: string;
        details: {
          account_number: string;
          bank_name: string;
        };
      };
    };
  }>(
    INTEGRATION_ID,
    'initiate_transfer',
    async () => {
      const response = await fetch(`${PAYSTACK_API_BASE}/transfer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: request.source || 'balance',
          amount: request.amount,
          recipient: request.recipient,
          reference: request.reference,
          reason: request.reason || 'Vendor payout',
          currency: request.currency || 'GHS',
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to initiate transfer');
      }
      return data;
    },
    { timeout: 30000, skipStatusCheck: true }
  );

  if (!result.success) {
    return { success: false, error: result.error?.message };
  }

  return {
    success: true,
    data: {
      transfer_code: result.data?.data.transfer_code || '',
      reference: result.data?.data.reference || '',
      status: result.data?.data.status || 'pending',
      amount: result.data?.data.amount || 0,
      currency: result.data?.data.currency || 'GHS',
      recipient: {
        name: result.data?.data.recipient?.name || '',
        account_number: result.data?.data.recipient?.details?.account_number || '',
        bank_name: result.data?.data.recipient?.details?.bank_name || '',
      },
    },
  };
};

/**
 * Verify a transfer status by reference
 */
export const verifyTransfer = async (reference: string): Promise<TransferVerifyResponse> => {
  const config = await getPaystackConfig();
  if (!config) {
    return { success: false, error: 'Paystack not configured' };
  }

  const result = await executeAPI<{
    status: boolean;
    data: {
      transfer_code: string;
      reference: string;
      status: 'pending' | 'success' | 'failed' | 'reversed';
      amount: number;
      currency: string;
      reason: string;
      transferred_at?: string;
      recipient: {
        name: string;
        details: {
          account_number: string;
          bank_name: string;
        };
      };
    };
  }>(
    INTEGRATION_ID,
    'verify_transfer',
    async () => {
      const response = await fetch(`${PAYSTACK_API_BASE}/transfer/verify/${reference}`, {
        headers: {
          'Authorization': `Bearer ${config.secretKey}`,
        },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to verify transfer');
      }
      return data;
    },
    { timeout: 15000, skipStatusCheck: true }
  );

  if (!result.success) {
    return { success: false, error: result.error?.message };
  }

  return {
    success: true,
    data: {
      transfer_code: result.data?.data.transfer_code || '',
      reference: result.data?.data.reference || '',
      status: result.data?.data.status || 'pending',
      amount: result.data?.data.amount || 0,
      currency: result.data?.data.currency || 'GHS',
      reason: result.data?.data.reason || '',
      transferred_at: result.data?.data.transferred_at,
      recipient: {
        name: result.data?.data.recipient?.name || '',
        account_number: result.data?.data.recipient?.details?.account_number || '',
        bank_name: result.data?.data.recipient?.details?.bank_name || '',
      },
    },
  };
};

/**
 * Get list of mobile money providers in Ghana
 */
export const getMobileMoneyProviders = (): Array<{ code: string; name: string }> => {
  return [
    { code: 'mtn', name: 'MTN Mobile Money' },
    { code: 'vodafone', name: 'Vodafone Cash' },
    { code: 'airteltigo', name: 'AirtelTigo Money' },
  ];
};

/**
 * List all banks in Ghana
 * Used for vendor bank account registration
 */
export interface Bank {
  name: string;
  code: string;
  type: string;
}

export interface ListBanksResponse {
  success: boolean;
  banks?: Bank[];
  error?: string;
}

export const listGhanaBanks = async (): Promise<ListBanksResponse> => {
  const config = await getPaystackConfig();
  if (!config) {
    return { success: false, error: 'Paystack not configured' };
  }

  const result = await executeAPI<{
    status: boolean;
    data: Array<{
      name: string;
      code: string;
      type: string;
    }>;
  }>(
    INTEGRATION_ID,
    'list_banks',
    async () => {
      const response = await fetch(`${PAYSTACK_API_BASE}/bank?country=ghana`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.secretKey}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to list banks');
      }
      return data;
    },
    { timeout: 15000, skipStatusCheck: true }
  );

  if (!result.success) {
    return { success: false, error: result.error?.message };
  }

  return {
    success: true,
    banks: result.data?.data || [],
  };
};

