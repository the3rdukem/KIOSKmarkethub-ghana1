/**
 * Integrations API Route
 *
 * CRUD operations for third-party integrations.
 * Admin-only access with credential encryption.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import {
  getIntegrations,
  getIntegrationById,
  updateIntegrationCredentials,
  toggleIntegration,
  updateIntegrationEnvironment,
  testIntegrationConnection,
  getIntegrationStats,
  initializeIntegrations,
  INTEGRATION_SCHEMAS,
  type IntegrationSchema,
} from '@/lib/db/dal/integrations';
import { createAuditLog } from '@/lib/db/dal/audit';

// Initialize integrations on first API call
let initialized = false;

/**
 * GET /api/integrations
 *
 * Get all integrations (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    // Ensure integrations are initialized
    if (!initialized) {
      await initializeIntegrations();
      initialized = true;
    }

    // Verify admin authentication
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Only admins can access integrations
    if (session.user_role !== 'admin' && session.user_role !== 'master_admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const stats = searchParams.get('stats');
    const schemas = searchParams.get('schemas');

    // Return schemas if requested
    if (schemas === 'true') {
      return NextResponse.json({ schemas: INTEGRATION_SCHEMAS });
    }

    // Return stats if requested
    if (stats === 'true') {
      return NextResponse.json({ stats: await getIntegrationStats() });
    }

    // Return single integration if ID provided
    if (id) {
      const integration = await getIntegrationById(id);
      if (!integration) {
        return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
      }

      // Mask sensitive credentials for non-master admins
      const isMasterAdmin = session.user_role === 'master_admin';
      const maskedCredentials: Record<string, string> = {};

      for (const [key, value] of Object.entries(integration.credentials)) {
        if (isMasterAdmin) {
          maskedCredentials[key] = value;
        } else if (value) {
          // Show only first 4 and last 4 characters for secrets
          const schema = integration.schema;
          const field = schema?.fields.find(f => f.key === key);
          const isSecret = field?.type === 'password';

          if (isSecret && value.length > 8) {
            maskedCredentials[key] = `${value.substring(0, 4)}${'*'.repeat(8)}${value.substring(value.length - 4)}`;
          } else if (isSecret) {
            maskedCredentials[key] = '*'.repeat(value.length || 8);
          } else {
            maskedCredentials[key] = value;
          }
        } else {
          maskedCredentials[key] = '';
        }
      }

      return NextResponse.json({
        integration: {
          ...integration,
          credentials: maskedCredentials,
        },
      });
    }

    // Return all integrations with schemas
    const integrations = await getIntegrations();
    const isMasterAdmin = session.user_role === 'master_admin';

    // Mask credentials for security
    const maskedIntegrations = integrations.map(integration => {
      const maskedCredentials: Record<string, string> = {};

      for (const [key, value] of Object.entries(integration.credentials)) {
        if (isMasterAdmin && value) {
          maskedCredentials[key] = value;
        } else if (value) {
          const schema = integration.schema;
          const field = schema?.fields.find(f => f.key === key);
          const isSecret = field?.type === 'password';

          if (isSecret && value.length > 8) {
            maskedCredentials[key] = `${value.substring(0, 4)}${'*'.repeat(8)}${value.substring(value.length - 4)}`;
          } else if (isSecret) {
            maskedCredentials[key] = '*'.repeat(value.length || 8);
          } else {
            maskedCredentials[key] = value;
          }
        } else {
          maskedCredentials[key] = '';
        }
      }

      return {
        ...integration,
        credentials: maskedCredentials,
      };
    });

    return NextResponse.json({
      integrations: maskedIntegrations,
      total: integrations.length,
      stats: await getIntegrationStats(),
    });
  } catch (error) {
    console.error('Get integrations error:', error);
    return NextResponse.json({ error: 'Failed to fetch integrations' }, { status: 500 });
  }
}

/**
 * PATCH /api/integrations
 *
 * Update integration settings (admin only)
 */
export async function PATCH(request: NextRequest) {
  try {
    // Ensure integrations are initialized
    if (!initialized) {
      await initializeIntegrations();
      initialized = true;
    }

    // Verify admin authentication
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Only master admins can update integrations
    if (session.user_role !== 'master_admin') {
      return NextResponse.json({ error: 'Master admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { integrationId, action, credentials, environment, enabled } = body;

    if (!integrationId) {
      return NextResponse.json({ error: 'Integration ID is required' }, { status: 400 });
    }

    const integration = await getIntegrationById(integrationId);
    if (!integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    let updatedIntegration;
    let auditAction: string;
    let auditDetails: string;

    switch (action) {
      case 'update_credentials':
        if (!credentials || typeof credentials !== 'object') {
          return NextResponse.json({ error: 'Credentials object is required' }, { status: 400 });
        }
        updatedIntegration = await updateIntegrationCredentials(integrationId, credentials);
        auditAction = 'INTEGRATION_CREDENTIALS_UPDATED';
        auditDetails = `Updated credentials for ${integration.name}`;
        break;

      case 'toggle':
        if (typeof enabled !== 'boolean') {
          return NextResponse.json({ error: 'Enabled boolean is required' }, { status: 400 });
        }
        updatedIntegration = await toggleIntegration(integrationId, enabled);
        if (!updatedIntegration && enabled) {
          return NextResponse.json(
            { error: 'Cannot enable integration: not configured' },
            { status: 400 }
          );
        }
        auditAction = enabled ? 'INTEGRATION_ENABLED' : 'INTEGRATION_DISABLED';
        auditDetails = `${enabled ? 'Enabled' : 'Disabled'} ${integration.name}`;
        break;

      case 'set_environment':
        if (!environment || !['demo', 'live', 'sandbox', 'production'].includes(environment)) {
          return NextResponse.json({ error: 'Valid environment (demo/live/sandbox/production) is required' }, { status: 400 });
        }
        updatedIntegration = await updateIntegrationEnvironment(integrationId, environment);
        auditAction = 'INTEGRATION_ENVIRONMENT_CHANGED';
        auditDetails = `Changed ${integration.name} environment to ${environment}`;
        break;

      case 'test':
        // Test the connection using the unified test function
        const testResult = await testIntegrationConnection(integrationId);

        if (testResult.success) {
          updatedIntegration = await getIntegrationById(integrationId);
          auditAction = 'INTEGRATION_TEST_SUCCESS';
          auditDetails = `Successfully tested ${integration.name}`;
        } else {
          // Create audit log for failed test
          await createAuditLog({
            action: 'INTEGRATION_TEST_FAILED',
            category: 'api',
            adminId: session.user_id,
            targetId: integrationId,
            targetType: 'integration',
            targetName: integration.name,
            details: `Test failed: ${testResult.error}`,
            severity: 'warning',
            ipAddress: request.headers.get('x-forwarded-for') || undefined,
          });

          return NextResponse.json({
            success: false,
            error: testResult.error || 'Connection test failed',
          });
        }
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    if (!updatedIntegration) {
      return NextResponse.json({ error: 'Failed to update integration' }, { status: 500 });
    }

    // Create audit log
    await createAuditLog({
      action: auditAction,
      category: 'api',
      adminId: session.user_id,
      targetId: integrationId,
      targetType: 'integration',
      targetName: integration.name,
      details: auditDetails,
      severity: 'info',
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    });

    return NextResponse.json({
      success: true,
      integration: {
        id: updatedIntegration.id,
        name: updatedIntegration.name,
        isEnabled: updatedIntegration.isEnabled,
        isConfigured: updatedIntegration.isConfigured,
        environment: updatedIntegration.environment,
        status: updatedIntegration.status,
        lastTestedAt: updatedIntegration.lastTestedAt,
        lastError: updatedIntegration.lastError,
      },
    });
  } catch (error) {
    console.error('Update integration error:', error);
    return NextResponse.json({ error: 'Failed to update integration' }, { status: 500 });
  }
}
