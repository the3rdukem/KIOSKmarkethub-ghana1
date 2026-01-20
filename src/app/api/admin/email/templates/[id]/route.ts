/**
 * Admin Email Template API (Single Template)
 * 
 * GET /api/admin/email/templates/[id] - Get a single template
 * PUT /api/admin/email/templates/[id] - Update a template
 * DELETE /api/admin/email/templates/[id] - Delete a template
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAdminSession } from '@/lib/db/dal/admin';
import { updateEmailTemplate } from '@/lib/db/dal/email';
import { query } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await validateAdminSession(sessionToken);
    if (!admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const result = await query(
      'SELECT * FROM email_templates WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const row = result.rows[0];
    const template = {
      id: row.id,
      name: row.name,
      subject: row.subject,
      bodyHtml: row.body_html,
      bodyText: row.body_text || undefined,
      variables: row.variables ? JSON.parse(row.variables) : undefined,
      category: row.category,
      isActive: row.is_active === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    return NextResponse.json({ template });
  } catch (error) {
    console.error('[ADMIN_EMAIL_TEMPLATE_API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch template' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await validateAdminSession(sessionToken);
    if (!admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const updated = await updateEmailTemplate(id, {
      name: body.name,
      subject: body.subject,
      bodyHtml: body.bodyHtml,
      bodyText: body.bodyText,
      variables: body.variables,
      category: body.category,
      isActive: body.isActive,
    });

    if (!updated) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ADMIN_EMAIL_TEMPLATE_API] PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await validateAdminSession(sessionToken);
    if (!admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const result = await query(
      'DELETE FROM email_templates WHERE id = $1',
      [id]
    );

    if ((result.rowCount || 0) === 0) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ADMIN_EMAIL_TEMPLATE_API] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    );
  }
}
