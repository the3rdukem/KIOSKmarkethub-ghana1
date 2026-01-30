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

// Valid event types for validation
const VALID_EVENT_TYPES: smsDal.SMSEventType[] = [
  'order_confirmed', 'order_preparing', 'order_ready_for_pickup',
  'order_out_for_delivery', 'order_delivered', 'order_cancelled',
  'vendor_new_order', 'dispute_opened', 'dispute_resolved',
  'welcome_buyer', 'welcome_vendor', 'payout_processing',
  'payout_completed', 'payout_failed', 'low_stock_alert', 'out_of_stock_alert'
];

function isValidEventType(eventType: string): eventType is smsDal.SMSEventType {
  return VALID_EVENT_TYPES.includes(eventType as smsDal.SMSEventType);
}

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

        // Validate event type
        if (!isValidEventType(eventType)) {
          return NextResponse.json({ 
            error: `Invalid event type: ${eventType}. Must be one of: ${VALID_EVENT_TYPES.join(', ')}` 
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

      case 'seed_default_templates': {
        // Default templates with sample messages
        const defaultTemplates = [
          { eventType: 'order_confirmed', name: 'Order Confirmed', messageTemplate: 'Hi {{buyerName}}, your order #{{orderNumber}} for GHS {{totalAmount}} has been confirmed! Track your order on KIOSK.' },
          { eventType: 'order_preparing', name: 'Order Preparing', messageTemplate: 'Hi {{buyerName}}, your order #{{orderNumber}} is now being prepared by the vendor.' },
          { eventType: 'order_ready_for_pickup', name: 'Order Ready for Pickup', messageTemplate: 'Hi {{buyerName}}, your order #{{orderNumber}} is ready for pickup at {{pickupAddress}}.' },
          { eventType: 'order_out_for_delivery', name: 'Order Out for Delivery', messageTemplate: 'Hi {{buyerName}}, your order #{{orderNumber}} is on its way! Courier: {{courierName}} ({{courierPhone}}).' },
          { eventType: 'order_delivered', name: 'Order Delivered', messageTemplate: 'Hi {{buyerName}}, your order #{{orderNumber}} has been delivered. Enjoy your purchase from KIOSK!' },
          { eventType: 'order_cancelled', name: 'Order Cancelled', messageTemplate: 'Hi {{buyerName}}, your order #{{orderNumber}} has been cancelled. Reason: {{reason}}. Contact support if needed.' },
          { eventType: 'vendor_new_order', name: 'Vendor: New Order', messageTemplate: 'Hi {{vendorName}}, you have a new order #{{orderNumber}}! {{itemCount}} item(s) worth GHS {{totalAmount}}. Check your dashboard.' },
          { eventType: 'dispute_opened', name: 'Dispute Opened', messageTemplate: 'A dispute has been opened for order #{{orderNumber}} (Dispute ID: {{disputeId}}). We will review it shortly.' },
          { eventType: 'dispute_resolved', name: 'Dispute Resolved', messageTemplate: 'Your dispute (ID: {{disputeId}}) for order #{{orderNumber}} has been resolved. Resolution: {{resolution}}.' },
          { eventType: 'welcome_buyer', name: 'Welcome Buyer', messageTemplate: 'Welcome to KIOSK, {{buyerName}}! Start shopping from trusted vendors across Ghana.' },
          { eventType: 'welcome_vendor', name: 'Welcome Vendor', messageTemplate: 'Welcome to KIOSK, {{vendorName}}! Your store "{{storeName}}" is now ready. Start listing your products!' },
          { eventType: 'payout_processing', name: 'Payout Processing', messageTemplate: 'Hi {{vendorName}}, your payout of GHS {{amount}} is now being processed.' },
          { eventType: 'payout_completed', name: 'Payout Completed', messageTemplate: 'Hi {{vendorName}}, your payout of GHS {{amount}} is complete! Ref: {{reference}}.' },
          { eventType: 'payout_failed', name: 'Payout Failed', messageTemplate: 'Hi {{vendorName}}, your payout of GHS {{amount}} failed. Reason: {{reason}}. Please contact support.' },
          { eventType: 'low_stock_alert', name: 'Low Stock Alert', messageTemplate: 'Hi {{vendorName}}, your product "{{productName}}" is running low ({{quantity}} left, threshold: {{threshold}}). Restock soon!' },
          { eventType: 'out_of_stock_alert', name: 'Out of Stock Alert', messageTemplate: 'Hi {{vendorName}}, your product "{{productName}}" is now OUT OF STOCK. Restock to continue selling.' },
        ];

        let created = 0;
        let skipped = 0;

        for (const tmpl of defaultTemplates) {
          const exists = await smsDal.templateExistsForEventType(tmpl.eventType as smsDal.SMSEventType);
          if (exists) {
            skipped++;
            continue;
          }

          const variables = smsDal.extractTemplateVariables(tmpl.messageTemplate);
          await smsDal.createTemplate({
            name: tmpl.name,
            eventType: tmpl.eventType as smsDal.SMSEventType,
            messageTemplate: tmpl.messageTemplate,
            variables,
            isActive: true,
          });
          created++;
        }

        const templates = await smsDal.getAllTemplates();

        return NextResponse.json({
          success: true,
          message: `Created ${created} templates, skipped ${skipped} (already exist)`,
          created,
          skipped,
          templates,
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
