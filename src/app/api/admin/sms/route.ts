/**
 * Admin SMS Management API
 * 
 * Endpoints for managing SMS templates, settings, and viewing logs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken } from '@/lib/db/dal/auth-service';
import { cookies } from 'next/headers';
import * as smsDal from '@/lib/db/dal/sms';
import { getSMSServiceStatus } from '@/lib/services/arkesel-sms';

async function getAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('session_token')?.value;
  
  if (!token) {
    return null;
  }
  
  const result = await validateSessionToken(token);
  if (!result.success || !result.data) {
    return null;
  }
  
  const session = result.data.session;
  if (!['admin', 'master_admin'].includes(session.userRole)) {
    return null;
  }
  
  return { ...session, role: session.userRole };
}

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'overview';

    switch (action) {
      case 'overview': {
        const [status, stats, templates, arkeselConfig] = await Promise.all([
          getSMSServiceStatus(),
          smsDal.getSMSStats(),
          smsDal.getAllTemplates(),
          smsDal.getArkeselConfig(),
        ]);

        return NextResponse.json({
          status,
          stats,
          templates,
          config: arkeselConfig ? {
            hasApiKey: !!arkeselConfig.apiKey,
            apiKeyPreview: arkeselConfig.apiKey ? `${arkeselConfig.apiKey.substring(0, 8)}...` : null,
            senderId: arkeselConfig.senderId,
            isDemoMode: arkeselConfig.isDemoMode,
          } : null,
        });
      }

      case 'templates': {
        const templates = await smsDal.getAllTemplates();
        return NextResponse.json({ templates });
      }

      case 'logs': {
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');
        const eventType = searchParams.get('eventType') as smsDal.SMSEventType | null;
        const status = searchParams.get('status') as smsDal.SMSStatus | null;
        const orderId = searchParams.get('orderId');

        const result = await smsDal.getSMSLogs({
          limit,
          offset,
          eventType: eventType || undefined,
          status: status || undefined,
          orderId: orderId || undefined,
        });

        return NextResponse.json(result);
      }

      case 'stats': {
        const stats = await smsDal.getSMSStats();
        return NextResponse.json(stats);
      }

      case 'status': {
        const status = await getSMSServiceStatus();
        return NextResponse.json(status);
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[SMS API] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'toggle_sms': {
        const { enabled } = body;
        if (typeof enabled !== 'boolean') {
          return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 });
        }

        await smsDal.setSMSNotificationsEnabled(enabled);
        const status = await getSMSServiceStatus();

        return NextResponse.json({
          success: true,
          message: enabled ? 'SMS notifications enabled' : 'SMS notifications disabled',
          status,
        });
      }

      case 'update_template': {
        const { templateId, name, messageTemplate, isActive } = body;
        
        if (!templateId) {
          return NextResponse.json({ error: 'templateId is required' }, { status: 400 });
        }

        const variables = messageTemplate 
          ? smsDal.extractTemplateVariables(messageTemplate) 
          : undefined;

        const template = await smsDal.updateTemplate(templateId, {
          name,
          messageTemplate,
          variables,
          isActive,
        });

        if (!template) {
          return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        }

        return NextResponse.json({
          success: true,
          message: 'Template updated successfully',
          template,
        });
      }

      case 'toggle_template': {
        const { templateId, isActive } = body;
        
        if (!templateId || typeof isActive !== 'boolean') {
          return NextResponse.json({ error: 'templateId and isActive are required' }, { status: 400 });
        }

        const template = await smsDal.toggleTemplate(templateId, isActive);

        if (!template) {
          return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        }

        return NextResponse.json({
          success: true,
          message: isActive ? 'Template enabled' : 'Template disabled',
          template,
        });
      }

      case 'create_template': {
        const { name, eventType, messageTemplate } = body;
        
        if (!name || !eventType || !messageTemplate) {
          return NextResponse.json({ 
            error: 'name, eventType, and messageTemplate are required' 
          }, { status: 400 });
        }

        // Check if template already exists for this event type
        const exists = await smsDal.templateExistsForEventType(eventType);
        if (exists) {
          return NextResponse.json({ 
            error: `A template for event type "${eventType}" already exists` 
          }, { status: 400 });
        }

        const variables = smsDal.extractTemplateVariables(messageTemplate);
        
        const template = await smsDal.createTemplate({
          name,
          eventType,
          messageTemplate,
          variables,
          isActive: true,
        });

        return NextResponse.json({
          success: true,
          message: 'Template created successfully',
          template,
        });
      }

      case 'delete_template': {
        const { templateId } = body;
        
        if (!templateId) {
          return NextResponse.json({ error: 'templateId is required' }, { status: 400 });
        }

        const deleted = await smsDal.deleteTemplate(templateId);

        if (!deleted) {
          return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        }

        return NextResponse.json({
          success: true,
          message: 'Template deleted successfully',
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[SMS API] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
