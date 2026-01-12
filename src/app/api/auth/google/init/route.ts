/**
 * Google OAuth Initialization API
 * 
 * Generates the Google OAuth authorization URL server-side.
 * This keeps the client_secret secure on the server.
 * 
 * POST /api/auth/google/init
 * Body: { state?: string }
 * Returns: { success: boolean, authUrl?: string, error?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getIntegrationById, initializeIntegrations } from '@/lib/db/dal/integrations';

const DEFAULT_SCOPES = [
  'openid',
  'email',
  'profile',
];

let initialized = false;

export async function POST(request: NextRequest) {
  try {
    if (!initialized) {
      await initializeIntegrations();
      initialized = true;
    }

    const body = await request.json().catch(() => ({}));
    const { state } = body;

    const integration = await getIntegrationById('google_oauth');
    
    if (!integration) {
      return NextResponse.json({
        success: false,
        error: 'Google OAuth is not configured',
      }, { status: 400 });
    }

    if (!integration.isEnabled) {
      return NextResponse.json({
        success: false,
        error: 'Google OAuth is not enabled',
      }, { status: 400 });
    }

    if (!integration.isConfigured) {
      return NextResponse.json({
        success: false,
        error: 'Google OAuth credentials are not configured',
      }, { status: 400 });
    }

    const clientId = integration.credentials.clientId;
    const redirectUri = integration.credentials.redirectUri;

    if (!clientId || !redirectUri) {
      return NextResponse.json({
        success: false,
        error: 'Google OAuth credentials are incomplete',
      }, { status: 400 });
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: DEFAULT_SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      ...(state && { state }),
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return NextResponse.json({
      success: true,
      authUrl,
    });
  } catch (error) {
    console.error('[GOOGLE_OAUTH_INIT] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to generate authentication URL',
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    success: false,
    error: 'Method not allowed. Use POST.',
  }, { status: 405 });
}
