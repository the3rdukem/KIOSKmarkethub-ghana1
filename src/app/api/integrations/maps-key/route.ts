/**
 * Google Maps API Key Endpoint
 * 
 * Returns the Google Maps API key for client-side use.
 * Public endpoint - no authentication required.
 * 
 * SECURITY NOTE: Google Maps API keys are designed for client-side use.
 * They are visible in page source by design. Security is enforced via:
 * 1. HTTP Referrer Restrictions in Google Cloud Console (only your domain can use the key)
 * 2. API Restrictions (limiting which Google APIs the key can access)
 * 
 * This is the industry standard approach per Google's documentation:
 * https://developers.google.com/maps/api-security-best-practices
 * 
 * IMPORTANT: Configure HTTP referrer restrictions in Google Cloud Console
 * to only allow your production domain(s).
 */

import { NextResponse } from 'next/server';
import { getGoogleMapsCredentials } from '@/lib/db/dal/integrations';

export async function GET() {
  try {
    const credentials = await getGoogleMapsCredentials();
    
    if (!credentials) {
      return NextResponse.json({
        success: false,
        error: 'Google Maps not configured',
        apiKey: null,
      });
    }

    if (!credentials.isEnabled || !credentials.isConfigured) {
      return NextResponse.json({
        success: false,
        error: 'Google Maps is disabled',
        apiKey: null,
      });
    }

    return NextResponse.json({
      success: true,
      apiKey: credentials.apiKey,
      enabledServices: credentials.enabledServices,
    });
  } catch (error) {
    console.error('[API] GET /integrations/maps-key error:', error);
    return NextResponse.json(
      { error: 'Failed to get Maps API key' },
      { status: 500 }
    );
  }
}
