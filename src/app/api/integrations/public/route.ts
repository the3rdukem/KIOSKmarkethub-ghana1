/**
 * Public Integrations Status API
 * 
 * Returns public-facing integration availability status.
 * No authentication required - only exposes enabled/disabled status.
 * Does NOT expose credentials or sensitive configuration.
 */

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const result = await query<{
      id: string;
      is_enabled: boolean;
      is_configured: boolean;
      status: string;
    }>(
      `SELECT id, is_enabled, is_configured, status 
       FROM integrations 
       WHERE id IN ('google_oauth', 'google_maps')`
    );

    const integrations: Record<string, { isEnabled: boolean; isReady: boolean }> = {};

    for (const row of result.rows) {
      const isEnabled = Boolean(row.is_enabled) && Boolean(row.is_configured);
      const isReady = isEnabled && row.status === 'connected';
      integrations[row.id] = {
        isEnabled,
        isReady,
      };
    }

    return NextResponse.json({
      success: true,
      data: integrations,
    });
  } catch (error) {
    console.error('[PUBLIC_INTEGRATIONS] Error:', error);
    return NextResponse.json({
      success: true,
      data: {
        google_oauth: { isEnabled: false, isReady: false },
        google_maps: { isEnabled: false, isReady: false },
      },
    });
  }
}
