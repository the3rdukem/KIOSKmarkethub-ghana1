import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type IntegrationEnvironment = 'demo' | 'live';
export type IntegrationStatus = 'connected' | 'error' | 'disconnected' | 'not_configured';

export interface IntegrationCredential {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'email';
  required: boolean;
  placeholder?: string;
  description?: string;
  value?: string;
}

export interface Integration {
  id: string;
  name: string;
  description: string;
  provider: string;
  category: 'auth' | 'maps' | 'payment' | 'otp' | 'storage' | 'ai' | 'verification';
  icon: string;
  isEnabled: boolean;
  isConfigured: boolean;
  environment: IntegrationEnvironment;
  status: IntegrationStatus;
  credentials: IntegrationCredential[];
  lastTestedAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationAuditLog {
  id: string;
  integrationId: string;
  integrationName: string;
  action: 'enabled' | 'disabled' | 'configured' | 'tested' | 'env_changed' | 'credentials_updated';
  adminId: string;
  adminName: string;
  details: string;
  previousValue?: string;
  newValue?: string;
  timestamp: string;
}

// Default integrations configuration
const defaultIntegrations: Integration[] = [
  {
    id: 'google_oauth',
    name: 'Google OAuth',
    description: 'Sign up and sign in with Google accounts. Supports account linking for existing users.',
    provider: 'Google',
    category: 'auth',
    icon: 'google',
    isEnabled: false,
    isConfigured: false,
    environment: 'demo',
    status: 'not_configured',
    credentials: [
      {
        key: 'GOOGLE_OAUTH_CLIENT_ID',
        label: 'Client ID',
        type: 'text',
        required: true,
        placeholder: 'xxxx.apps.googleusercontent.com',
        description: 'OAuth 2.0 Client ID from Google Cloud Console',
      },
      {
        key: 'GOOGLE_OAUTH_CLIENT_SECRET',
        label: 'Client Secret',
        type: 'password',
        required: true,
        placeholder: 'Enter client secret',
        description: 'OAuth 2.0 Client Secret',
      },
      {
        key: 'GOOGLE_OAUTH_REDIRECT_URI',
        label: 'Redirect URI',
        type: 'url',
        required: true,
        placeholder: 'https://your-domain/api/auth/callback/google',
        description: 'Must match exactly: https://your-domain/api/auth/callback/google',
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'google_maps',
    name: 'Google Maps',
    description: 'Location services including address autocomplete, store locations, and distance-based filtering.',
    provider: 'Google',
    category: 'maps',
    icon: 'map',
    isEnabled: false,
    isConfigured: false,
    environment: 'live',
    status: 'not_configured',
    credentials: [
      {
        key: 'GOOGLE_MAPS_API_KEY',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'AIzaSy...',
        description: 'Google Maps Platform API Key with Places, Geocoding, and Maps JavaScript API enabled',
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'paystack',
    name: 'Paystack Payments',
    description: 'Payment processing including checkout, Mobile Money, and webhook handling.',
    provider: 'Paystack',
    category: 'payment',
    icon: 'credit-card',
    isEnabled: false,
    isConfigured: false,
    environment: 'demo',
    status: 'not_configured',
    credentials: [
      {
        key: 'PAYSTACK_PUBLIC_KEY',
        label: 'Public Key',
        type: 'text',
        required: true,
        placeholder: 'pk_test_xxxx or pk_live_xxxx',
        description: 'Paystack public key for frontend integration',
      },
      {
        key: 'PAYSTACK_SECRET_KEY',
        label: 'Secret Key',
        type: 'password',
        required: true,
        placeholder: 'sk_test_xxxx or sk_live_xxxx',
        description: 'Paystack secret key for server-side operations',
      },
      {
        key: 'PAYSTACK_WEBHOOK_SECRET',
        label: 'Webhook Secret',
        type: 'password',
        required: false,
        placeholder: 'whsec_xxxx',
        description: 'Secret for verifying webhook signatures',
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'arkesel_otp',
    name: 'Arkesel OTP',
    description: 'Phone number verification via SMS OTP for withdrawals, password changes, and sensitive actions.',
    provider: 'Arkesel',
    category: 'otp',
    icon: 'smartphone',
    isEnabled: false,
    isConfigured: false,
    environment: 'demo',
    status: 'not_configured',
    credentials: [
      {
        key: 'ARKESEL_API_KEY',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'Enter Arkesel API key',
        description: 'Arkesel API key from dashboard',
      },
      {
        key: 'ARKESEL_SENDER_ID',
        label: 'Sender ID',
        type: 'text',
        required: true,
        placeholder: 'KIOSK',
        description: 'Registered sender ID (max 11 characters)',
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'google_cloud_storage',
    name: 'Google Cloud Storage',
    description: 'Cloud storage for product images, vendor banners, and user profile pictures.',
    provider: 'Google Cloud',
    category: 'storage',
    icon: 'cloud',
    isEnabled: false,
    isConfigured: false,
    environment: 'live',
    status: 'not_configured',
    credentials: [
      {
        key: 'GCS_SERVICE_ACCOUNT_EMAIL',
        label: 'Service Account Email',
        type: 'email',
        required: true,
        placeholder: 'service-account@project.iam.gserviceaccount.com',
        description: 'Service account email with storage permissions',
      },
      {
        key: 'GCS_PROJECT_ID',
        label: 'Project ID',
        type: 'text',
        required: true,
        placeholder: 'your-project-id',
        description: 'Google Cloud project ID',
      },
      {
        key: 'GCS_BUCKET_NAME',
        label: 'Bucket Name',
        type: 'text',
        required: true,
        placeholder: 'your-bucket-name',
        description: 'Cloud Storage bucket name for file uploads',
      },
      {
        key: 'GCS_PRIVATE_KEY',
        label: 'Service Account Private Key',
        type: 'password',
        required: true,
        placeholder: '-----BEGIN PRIVATE KEY-----...',
        description: 'Private key from service account JSON',
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'AI-powered semantic product search, recommendations, and content moderation.',
    provider: 'OpenAI',
    category: 'ai',
    icon: 'brain',
    isEnabled: false,
    isConfigured: false,
    environment: 'live',
    status: 'not_configured',
    credentials: [
      {
        key: 'OPENAI_API_KEY',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'sk-...',
        description: 'OpenAI API Key from platform.openai.com',
      },
      {
        key: 'OPENAI_ORG_ID',
        label: 'Organization ID',
        type: 'text',
        required: false,
        placeholder: 'org-...',
        description: 'Optional: OpenAI Organization ID for billing',
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'facial_recognition',
    name: 'Facial Recognition',
    description: 'Vendor identity verification using facial recognition for KYC compliance.',
    provider: 'Veriff',
    category: 'verification',
    icon: 'scan-face',
    isEnabled: false,
    isConfigured: false,
    environment: 'demo',
    status: 'not_configured',
    credentials: [
      {
        key: 'VERIFF_API_KEY',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'Enter Veriff API key',
        description: 'Veriff API Key from dashboard',
      },
      {
        key: 'VERIFF_API_SECRET',
        label: 'API Secret',
        type: 'password',
        required: true,
        placeholder: 'Enter Veriff API secret',
        description: 'Veriff API Secret for signature verification',
      },
      {
        key: 'VERIFF_WEBHOOK_SECRET',
        label: 'Webhook Secret',
        type: 'password',
        required: false,
        placeholder: 'Enter webhook secret',
        description: 'Secret for webhook signature verification',
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

interface IntegrationsState {
  integrations: Integration[];
  auditLogs: IntegrationAuditLog[];

  // Integration Management
  getIntegration: (id: string) => Integration | undefined;
  getIntegrationsByCategory: (category: Integration['category']) => Integration[];
  getEnabledIntegrations: () => Integration[];

  // Configuration
  updateCredential: (integrationId: string, key: string, value: string) => void;
  saveCredentials: (integrationId: string, credentials: Record<string, string>, adminId: string, adminName: string) => void;

  // Toggle & Environment
  toggleIntegration: (id: string, adminId: string, adminName: string) => void;
  setEnvironment: (id: string, environment: IntegrationEnvironment, adminId: string, adminName: string) => void;

  // Testing
  testConnection: (id: string, adminId: string, adminName: string) => Promise<{ success: boolean; message: string }>;

  // Status
  updateStatus: (id: string, status: IntegrationStatus, error?: string) => void;

  // Audit Logs
  addAuditLog: (log: Omit<IntegrationAuditLog, 'id' | 'timestamp'>) => void;
  getAuditLogs: (integrationId?: string) => IntegrationAuditLog[];

  // Service Access (for use in components)
  isIntegrationReady: (id: string) => boolean;
  getCredentialValue: (integrationId: string, key: string) => string | undefined;
}

export const useIntegrationsStore = create<IntegrationsState>()(
  persist(
    (set, get) => ({
      integrations: defaultIntegrations,
      auditLogs: [],

      getIntegration: (id) => {
        return get().integrations.find((i) => i.id === id);
      },

      getIntegrationsByCategory: (category) => {
        return get().integrations.filter((i) => i.category === category);
      },

      getEnabledIntegrations: () => {
        return get().integrations.filter((i) => i.isEnabled && i.isConfigured);
      },

      updateCredential: (integrationId, key, value) => {
        set((state) => ({
          integrations: state.integrations.map((integration) =>
            integration.id === integrationId
              ? {
                  ...integration,
                  credentials: integration.credentials.map((cred) =>
                    cred.key === key ? { ...cred, value } : cred
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : integration
          ),
        }));
      },

      saveCredentials: (integrationId, credentials, adminId, adminName) => {
        const integration = get().getIntegration(integrationId);
        if (!integration) return;

        const updatedCredentials = integration.credentials.map((cred) => ({
          ...cred,
          value: credentials[cred.key] ?? cred.value,
        }));

        // Check if all required credentials are provided
        const allRequiredFilled = updatedCredentials
          .filter((c) => c.required)
          .every((c) => c.value && c.value.trim() !== '');

        set((state) => ({
          integrations: state.integrations.map((i) =>
            i.id === integrationId
              ? {
                  ...i,
                  credentials: updatedCredentials,
                  isConfigured: allRequiredFilled,
                  status: allRequiredFilled ? 'disconnected' : 'not_configured',
                  updatedAt: new Date().toISOString(),
                }
              : i
          ),
        }));

        get().addAuditLog({
          integrationId,
          integrationName: integration.name,
          action: 'credentials_updated',
          adminId,
          adminName,
          details: `Credentials updated for ${integration.name}`,
        });
      },

      toggleIntegration: (id, adminId, adminName) => {
        const integration = get().getIntegration(id);
        if (!integration) return;

        // Can only enable if configured
        if (!integration.isEnabled && !integration.isConfigured) {
          return;
        }

        const newEnabled = !integration.isEnabled;

        set((state) => ({
          integrations: state.integrations.map((i) =>
            i.id === id
              ? {
                  ...i,
                  isEnabled: newEnabled,
                  status: newEnabled ? 'connected' : 'disconnected',
                  updatedAt: new Date().toISOString(),
                }
              : i
          ),
        }));

        get().addAuditLog({
          integrationId: id,
          integrationName: integration.name,
          action: newEnabled ? 'enabled' : 'disabled',
          adminId,
          adminName,
          details: `${integration.name} ${newEnabled ? 'enabled' : 'disabled'}`,
          previousValue: String(!newEnabled),
          newValue: String(newEnabled),
        });
      },

      setEnvironment: (id, environment, adminId, adminName) => {
        const integration = get().getIntegration(id);
        if (!integration) return;

        set((state) => ({
          integrations: state.integrations.map((i) =>
            i.id === id
              ? {
                  ...i,
                  environment,
                  updatedAt: new Date().toISOString(),
                }
              : i
          ),
        }));

        get().addAuditLog({
          integrationId: id,
          integrationName: integration.name,
          action: 'env_changed',
          adminId,
          adminName,
          details: `${integration.name} environment changed to ${environment}`,
          previousValue: integration.environment,
          newValue: environment,
        });
      },

      testConnection: async (id, adminId, adminName) => {
        const integration = get().getIntegration(id);
        if (!integration) {
          return { success: false, message: 'Integration not found' };
        }

        if (!integration.isConfigured) {
          return { success: false, message: 'Integration not configured. Please save credentials first.' };
        }

        // Simulate API test based on integration type
        await new Promise((resolve) => setTimeout(resolve, 1500 + Math.random() * 1000));

        // Different test logic for each integration
        let success = true;
        let message = 'Connection successful';

        switch (integration.id) {
          case 'google_oauth': {
            const clientId = integration.credentials.find((c) => c.key === 'GOOGLE_OAUTH_CLIENT_ID')?.value;
            if (!clientId?.includes('.apps.googleusercontent.com')) {
              success = false;
              message = 'Invalid Client ID format. Should end with .apps.googleusercontent.com';
            }
            break;
          }
          case 'google_maps': {
            const apiKey = integration.credentials.find((c) => c.key === 'GOOGLE_MAPS_API_KEY')?.value;
            if (!apiKey?.startsWith('AIza')) {
              success = false;
              message = 'Invalid API Key format. Google Maps API keys start with AIza';
            }
            break;
          }
          case 'paystack': {
            const publicKey = integration.credentials.find((c) => c.key === 'PAYSTACK_PUBLIC_KEY')?.value;
            const secretKey = integration.credentials.find((c) => c.key === 'PAYSTACK_SECRET_KEY')?.value;

            if (integration.environment === 'demo') {
              if (!publicKey?.startsWith('pk_test_') || !secretKey?.startsWith('sk_test_')) {
                success = false;
                message = 'Demo mode requires test keys (pk_test_* and sk_test_*)';
              }
            } else {
              if (!publicKey?.startsWith('pk_live_') || !secretKey?.startsWith('sk_live_')) {
                success = false;
                message = 'Live mode requires live keys (pk_live_* and sk_live_*)';
              }
            }
            break;
          }
          case 'arkesel_otp': {
            const senderId = integration.credentials.find((c) => c.key === 'ARKESEL_SENDER_ID')?.value;
            if (senderId && senderId.length > 11) {
              success = false;
              message = 'Sender ID must be 11 characters or less';
            }
            break;
          }
          case 'google_cloud_storage': {
            const privateKey = integration.credentials.find((c) => c.key === 'GCS_PRIVATE_KEY')?.value;
            if (!privateKey?.includes('BEGIN PRIVATE KEY')) {
              success = false;
              message = 'Invalid private key format. Must be a valid PEM-encoded private key';
            }
            break;
          }
          case 'openai': {
            const apiKey = integration.credentials.find((c) => c.key === 'OPENAI_API_KEY')?.value;
            if (!apiKey?.startsWith('sk-')) {
              success = false;
              message = 'Invalid API key format. OpenAI API keys start with sk-';
            }
            break;
          }
          case 'facial_recognition': {
            const veriffApiKey = integration.credentials.find((c) => c.key === 'VERIFF_API_KEY')?.value;
            const veriffApiSecret = integration.credentials.find((c) => c.key === 'VERIFF_API_SECRET')?.value;
            if (!veriffApiKey || !veriffApiSecret) {
              success = false;
              message = 'Both API Key and API Secret are required';
            }
            break;
          }
        }

        // Update status
        set((state) => ({
          integrations: state.integrations.map((i) =>
            i.id === id
              ? {
                  ...i,
                  lastTestedAt: new Date().toISOString(),
                  status: success ? 'connected' : 'error',
                  lastError: success ? undefined : message,
                  updatedAt: new Date().toISOString(),
                }
              : i
          ),
        }));

        get().addAuditLog({
          integrationId: id,
          integrationName: integration.name,
          action: 'tested',
          adminId,
          adminName,
          details: success ? 'Connection test passed' : `Connection test failed: ${message}`,
        });

        return { success, message };
      },

      updateStatus: (id, status, error) => {
        set((state) => ({
          integrations: state.integrations.map((i) =>
            i.id === id
              ? {
                  ...i,
                  status,
                  lastError: error,
                  updatedAt: new Date().toISOString(),
                }
              : i
          ),
        }));
      },

      addAuditLog: (logData) => {
        const newLog: IntegrationAuditLog = {
          ...logData,
          id: `int_log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date().toISOString(),
        };
        set((state) => ({
          auditLogs: [newLog, ...state.auditLogs].slice(0, 500),
        }));
      },

      getAuditLogs: (integrationId) => {
        const logs = get().auditLogs;
        if (integrationId) {
          return logs.filter((log) => log.integrationId === integrationId);
        }
        return logs;
      },

      isIntegrationReady: (id) => {
        const integration = get().getIntegration(id);
        return !!(integration?.isEnabled && integration?.isConfigured && integration?.status === 'connected');
      },

      getCredentialValue: (integrationId, key) => {
        const integration = get().getIntegration(integrationId);
        return integration?.credentials.find((c) => c.key === key)?.value;
      },
    }),
    {
      name: 'marketplace-integrations',
      partialize: (state) => ({
        integrations: state.integrations,
        auditLogs: state.auditLogs,
      }),
    }
  )
);

// Fetch public integration status (no auth required)
export async function fetchPublicIntegrationStatus(): Promise<Record<string, { isEnabled: boolean; isReady: boolean }>> {
  try {
    const response = await fetch('/api/integrations/public');
    if (!response.ok) {
      return {};
    }
    const data = await response.json();
    return data.success ? data.data : {};
  } catch {
    return {};
  }
}

// Helper hooks for specific integrations
export const useGoogleOAuth = () => {
  const store = useIntegrationsStore();
  const integration = store.getIntegration('google_oauth');

  return {
    isEnabled: integration?.isEnabled && integration?.isConfigured,
    isReady: store.isIntegrationReady('google_oauth'),
    clientId: store.getCredentialValue('google_oauth', 'GOOGLE_OAUTH_CLIENT_ID'),
    redirectUri: store.getCredentialValue('google_oauth', 'GOOGLE_OAUTH_REDIRECT_URI'),
  };
};

export const useGoogleMaps = () => {
  const store = useIntegrationsStore();
  const integration = store.getIntegration('google_maps');

  return {
    isEnabled: integration?.isEnabled && integration?.isConfigured,
    isReady: store.isIntegrationReady('google_maps'),
    apiKey: store.getCredentialValue('google_maps', 'GOOGLE_MAPS_API_KEY'),
  };
};

export const usePaystack = () => {
  const store = useIntegrationsStore();
  const integration = store.getIntegration('paystack');

  return {
    isEnabled: integration?.isEnabled && integration?.isConfigured,
    isReady: store.isIntegrationReady('paystack'),
    publicKey: store.getCredentialValue('paystack', 'PAYSTACK_PUBLIC_KEY'),
    environment: integration?.environment || 'demo',
    isLive: integration?.environment === 'live',
  };
};

export const useArkeselOTP = () => {
  const store = useIntegrationsStore();
  const integration = store.getIntegration('arkesel_otp');

  return {
    isEnabled: integration?.isEnabled && integration?.isConfigured,
    isReady: store.isIntegrationReady('arkesel_otp'),
    senderId: store.getCredentialValue('arkesel_otp', 'ARKESEL_SENDER_ID'),
    environment: integration?.environment || 'demo',
    isDemoMode: integration?.environment === 'demo',
  };
};

export const useOpenAI = () => {
  const store = useIntegrationsStore();
  const integration = store.getIntegration('openai');

  return {
    isEnabled: integration?.isEnabled && integration?.isConfigured,
    isReady: store.isIntegrationReady('openai'),
    status: integration?.status || 'not_configured',
  };
};

