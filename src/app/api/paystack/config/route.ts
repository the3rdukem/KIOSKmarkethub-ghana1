/**
 * Paystack Public Config API
 * 
 * Returns ONLY the public key for Paystack integration.
 * This endpoint is accessible to all authenticated users (buyers included)
 * because the public key is safe to expose.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import { getIntegrationById, initializeIntegrations } from '@/lib/db/dal/integrations';

let initialized = false;

export async function GET(request: NextRequest) {
  try {
    // Initialize integrations if needed
    if (!initialized) {
      await initializeIntegrations();
      initialized = true;
    }

    // Require authentication (any logged-in user)
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Get Paystack integration
    const integration = await getIntegrationById('paystack');
    
    if (!integration) {
      return NextResponse.json({ 
        enabled: false,
        message: 'Payment gateway not configured' 
      });
    }

    if (!integration.isEnabled) {
      return NextResponse.json({ 
        enabled: false,
        message: 'Payment gateway is currently disabled' 
      });
    }

    // Only return the public key (safe to expose)
    const publicKey = integration.credentials?.publicKey;
    // Integration environment uses 'live' or 'test' (not 'production')
    const isLive = integration.environment === 'live';

    if (!publicKey) {
      return NextResponse.json({ 
        enabled: false,
        message: 'Payment gateway not fully configured' 
      });
    }

    return NextResponse.json({
      enabled: true,
      publicKey,
      isLive,
    });
  } catch (error) {
    console.error('Paystack config error:', error);
    return NextResponse.json({ 
      enabled: false,
      message: 'Failed to load payment configuration' 
    }, { status: 500 });
  }
}
