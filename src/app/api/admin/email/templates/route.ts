/**
 * Admin Email Templates API
 * 
 * GET /api/admin/email/templates - List all email templates
 * POST /api/admin/email/templates - Create a new email template
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAdminSession } from '@/lib/db/dal/admin';
import { getEmailTemplates, createEmailTemplate } from '@/lib/db/dal/email';

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

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') as 'order' | 'payment' | 'auth' | 'notification' | 'system' | null;

    const templates = await getEmailTemplates(category || undefined);
    return NextResponse.json({ templates });
  } catch (error) {
    console.error('[ADMIN_EMAIL_TEMPLATES_API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email templates' },
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
    
    if (!body.name || !body.subject || !body.bodyHtml || !body.category) {
      return NextResponse.json(
        { error: 'Missing required fields: name, subject, bodyHtml, category' },
        { status: 400 }
      );
    }

    const template = await createEmailTemplate({
      name: body.name,
      subject: body.subject,
      bodyHtml: body.bodyHtml,
      bodyText: body.bodyText,
      variables: body.variables,
      category: body.category,
      isActive: body.isActive !== false,
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error('[ADMIN_EMAIL_TEMPLATES_API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create email template' },
      { status: 500 }
    );
  }
}
