/**
 * Server-Side Google OAuth Helper
 * 
 * Handles OAuth token exchange and user info retrieval using database credentials.
 * This file should ONLY be used in server-side code (API routes).
 * 
 * Unlike the client-side google-oauth.ts, this reads credentials directly from
 * the database, making it suitable for server-side callback handling.
 */

import { getIntegrationById } from './integrations';

export interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  verified_email: boolean;
}

export interface GoogleOAuthResult {
  success: boolean;
  user?: GoogleUserInfo;
  error?: string;
}

interface GoogleOAuthCredentials {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface CredentialsResult {
  success: boolean;
  credentials?: GoogleOAuthCredentials;
  error?: string;
}

async function getGoogleCredentials(): Promise<CredentialsResult> {
  try {
    const integration = await getIntegrationById('google_oauth');
    
    if (!integration) {
      return { success: false, error: 'Google OAuth integration not found in database' };
    }

    if (!integration.isEnabled) {
      return { success: false, error: 'Google OAuth is disabled. Please enable it in Admin settings.' };
    }

    if (!integration.isConfigured) {
      return { success: false, error: 'Google OAuth credentials are not configured.' };
    }

    const clientId = integration.credentials.clientId;
    const clientSecret = integration.credentials.clientSecret;
    const redirectUri = integration.credentials.redirectUri;

    if (!clientId) {
      return { success: false, error: 'Google OAuth Client ID is missing.' };
    }

    if (!clientSecret) {
      return { success: false, error: 'Google OAuth Client Secret is missing.' };
    }

    if (!redirectUri) {
      return { success: false, error: 'Google OAuth Redirect URI is missing.' };
    }

    return { 
      success: true, 
      credentials: { clientId, clientSecret, redirectUri } 
    };
  } catch (error) {
    console.error('[GOOGLE_OAUTH_SERVER] Error fetching credentials:', error);
    return { success: false, error: 'Failed to fetch OAuth configuration from database.' };
  }
}

export async function exchangeCodeForTokensServer(code: string): Promise<{
  success: boolean;
  accessToken?: string;
  idToken?: string;
  refreshToken?: string;
  error?: string;
}> {
  const credentialsResult = await getGoogleCredentials();

  if (!credentialsResult.success || !credentialsResult.credentials) {
    return {
      success: false,
      error: credentialsResult.error || 'Google OAuth not configured.',
    };
  }

  const credentials = credentialsResult.credentials;

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        redirect_uri: credentials.redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[GOOGLE_OAUTH_SERVER] Token exchange failed:', errorData);
      return {
        success: false,
        error: errorData.error_description || `Token exchange failed: ${response.status}`,
      };
    }

    const data = await response.json();

    return {
      success: true,
      accessToken: data.access_token,
      idToken: data.id_token,
      refreshToken: data.refresh_token,
    };
  } catch (error) {
    console.error('[GOOGLE_OAUTH_SERVER] Token exchange error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Token exchange failed',
    };
  }
}

export async function getUserInfoServer(accessToken: string): Promise<GoogleOAuthResult> {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.error('[GOOGLE_OAUTH_SERVER] Get user info failed:', response.status);
      return {
        success: false,
        error: `Failed to get user info: ${response.status}`,
      };
    }

    const data = await response.json();

    return {
      success: true,
      user: {
        id: data.sub,
        email: data.email,
        name: data.name,
        given_name: data.given_name,
        family_name: data.family_name,
        picture: data.picture,
        verified_email: data.email_verified,
      },
    };
  } catch (error) {
    console.error('[GOOGLE_OAUTH_SERVER] Get user info error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get user info',
    };
  }
}

export async function handleGoogleCallbackServer(code: string): Promise<GoogleOAuthResult> {
  const tokenResult = await exchangeCodeForTokensServer(code);
  
  if (!tokenResult.success || !tokenResult.accessToken) {
    return {
      success: false,
      error: tokenResult.error || 'Failed to authenticate with Google',
    };
  }

  const userResult = await getUserInfoServer(tokenResult.accessToken);
  
  if (!userResult.success || !userResult.user) {
    return {
      success: false,
      error: userResult.error || 'Failed to get user information',
    };
  }

  return {
    success: true,
    user: userResult.user,
  };
}
