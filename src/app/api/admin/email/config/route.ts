/**
 * Admin Email Configuration API
 * 
 * GET /api/admin/email/config - Get email provider configuration
 * POST /api/admin/email/config - Update email provider configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAdminSession } from '@/lib/db/dal/admin';
import { 
  getEmailProviderConfig, 
  updateEmailProviderConfig,
  checkEmailProviderHealth,
  EmailProviderConfig 
} from '@/lib/db/dal/email';

export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await validateAdminSession(sessionToken);
    if (!admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const [config, health] = await Promise.all([
      getEmailProviderConfig(),
      checkEmailProviderHealth()
    ]);

    const safeConfig = config ? {
      provider: config.provider,
      fromEmail: config.fromEmail,
      fromName: config.fromName,
      dryRun: config.dryRun,
      region: config.region,
      hasApiKey: !!config.apiKey
    } : null;

    return NextResponse.json({ config: safeConfig, health });
  } catch (error) {
    console.error('[ADMIN_EMAIL_CONFIG_API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email configuration' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await validateAdminSession(sessionToken);
    if (!admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    
    const config: EmailProviderConfig = {
      provider: body.provider || 'none',
      apiKey: body.apiKey,
      fromEmail: body.fromEmail,
      fromName: body.fromName || 'MarketHub',
      dryRun: body.dryRun !== false,
      region: body.region,
    };

    await updateEmailProviderConfig(config);
    const health = await checkEmailProviderHealth();

    return NextResponse.json({ 
      success: true, 
      health,
      message: config.dryRun 
        ? 'Email provider configured (dry-run mode - no emails will be sent)'
        : 'Email provider configured'
    });
  } catch (error) {
    console.error('[ADMIN_EMAIL_CONFIG_API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to update email configuration' },
      { status: 500 }
    );
  }
}
