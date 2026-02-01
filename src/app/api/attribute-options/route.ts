/**
 * Attribute Options API Route
 *
 * Manages hierarchical attribute options for cascading filters.
 * Public GET for fetching options, Admin POST/PATCH/DELETE for management.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import {
  getRootOptions,
  getChildOptions,
  getChildOptionsByParentValue,
  getAllCategoryOptions,
  getFieldOptionsHierarchy,
  createAttributeOption,
  updateAttributeOption,
  deleteAttributeOption,
  deleteFieldOptions,
  reorderOptions,
  importOptionsHierarchy,
  buildOptionsTree,
  hasFieldOptions,
} from '@/lib/db/dal/attribute-options';
import { withRateLimit } from '@/lib/utils/rate-limiter';

/**
 * GET /api/attribute-options
 *
 * Query params:
 * - categoryId: Required - Category to get options for
 * - fieldKey: Field key to filter by
 * - parentOptionId: Get children of a specific option
 * - parentValue: Get children by parent's value (with parentFieldKey)
 * - parentFieldKey: Parent field key (used with parentValue)
 * - childFieldKey: Child field key (used with parentValue)
 * - hierarchy: If "true", returns tree structure
 * - includeInactive: Admin only - include inactive options
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitCheck = await withRateLimit(request, 'api_public_read');
    if (!rateLimitCheck.allowed) {
      return rateLimitCheck.response;
    }

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    const fieldKey = searchParams.get('fieldKey');
    const parentOptionId = searchParams.get('parentOptionId');
    const parentValue = searchParams.get('parentValue');
    const parentFieldKey = searchParams.get('parentFieldKey');
    const childFieldKey = searchParams.get('childFieldKey');
    const hierarchy = searchParams.get('hierarchy') === 'true';
    const includeInactive = searchParams.get('includeInactive') === 'true';

    if (!categoryId) {
      return NextResponse.json({ error: 'categoryId is required' }, { status: 400 });
    }

    if (includeInactive) {
      const cookieStore = await cookies();
      const sessionToken = cookieStore.get('session_token')?.value;
      if (!sessionToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const session = await validateSession(sessionToken);
      if (!session || (session.user_role !== 'admin' && session.user_role !== 'master_admin')) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }
    }

    if (parentOptionId) {
      const options = await getChildOptions(parentOptionId);
      return NextResponse.json({ options });
    }

    if (parentValue && parentFieldKey && childFieldKey) {
      const options = await getChildOptionsByParentValue(
        categoryId,
        parentFieldKey,
        parentValue,
        childFieldKey
      );
      return NextResponse.json({ options });
    }

    if (fieldKey) {
      if (hierarchy) {
        const options = await getFieldOptionsHierarchy(categoryId, fieldKey, includeInactive);
        const tree = buildOptionsTree(options);
        return NextResponse.json({ options: tree });
      }
      const options = await getRootOptions(categoryId, fieldKey);
      return NextResponse.json({ options });
    }

    const options = await getAllCategoryOptions(categoryId, includeInactive);
    if (hierarchy) {
      const tree = buildOptionsTree(options);
      return NextResponse.json({ options: tree });
    }
    return NextResponse.json({ options });
  } catch (error) {
    console.error('[API] attribute-options GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch options' }, { status: 500 });
  }
}

/**
 * POST /api/attribute-options
 *
 * Admin only - Create new attribute option(s)
 * Body: { categoryId, fieldKey, value, parentOptionId?, level? }
 * Or for bulk: { categoryId, options: [...] }
 * Or for import: { categoryId, import: [...] }
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session || (session.user_role !== 'admin' && session.user_role !== 'master_admin')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();

    if (body.import && Array.isArray(body.import)) {
      if (!body.categoryId) {
        return NextResponse.json({ error: 'categoryId is required for import' }, { status: 400 });
      }
      const result = await importOptionsHierarchy(body.categoryId, body.import);
      return NextResponse.json({
        success: true,
        created: result.created,
        errors: result.errors,
      });
    }

    if (body.options && Array.isArray(body.options)) {
      const created = [];
      for (const opt of body.options) {
        if (!opt.categoryId || !opt.fieldKey || !opt.value) {
          continue;
        }
        const newOpt = await createAttributeOption(opt);
        created.push(newOpt);
      }
      return NextResponse.json({ success: true, options: created });
    }

    if (!body.categoryId || !body.fieldKey || !body.value) {
      return NextResponse.json(
        { error: 'categoryId, fieldKey, and value are required' },
        { status: 400 }
      );
    }

    const option = await createAttributeOption({
      categoryId: body.categoryId,
      fieldKey: body.fieldKey,
      value: body.value,
      parentOptionId: body.parentOptionId,
      level: body.level,
      displayOrder: body.displayOrder,
      isActive: body.isActive,
    });

    return NextResponse.json({ success: true, option });
  } catch (error) {
    console.error('[API] attribute-options POST error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create option';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/attribute-options
 *
 * Admin only - Update or reorder options
 * Body: { id, value?, displayOrder?, isActive? }
 * Or for reorder: { reorder: ['id1', 'id2', ...] }
 */
export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session || (session.user_role !== 'admin' && session.user_role !== 'master_admin')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();

    if (body.reorder && Array.isArray(body.reorder)) {
      await reorderOptions(body.reorder);
      return NextResponse.json({ success: true });
    }

    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const option = await updateAttributeOption(body.id, {
      value: body.value,
      parentOptionId: body.parentOptionId,
      displayOrder: body.displayOrder,
      isActive: body.isActive,
    });

    if (!option) {
      return NextResponse.json({ error: 'Option not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, option });
  } catch (error) {
    console.error('[API] attribute-options PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update option' }, { status: 500 });
  }
}

/**
 * DELETE /api/attribute-options
 *
 * Admin only - Delete option(s)
 * Query: ?id=xxx or ?categoryId=xxx&fieldKey=xxx (delete all for field)
 */
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session || (session.user_role !== 'admin' && session.user_role !== 'master_admin')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const categoryId = searchParams.get('categoryId');
    const fieldKey = searchParams.get('fieldKey');

    if (id) {
      const deleted = await deleteAttributeOption(id);
      if (!deleted) {
        return NextResponse.json({ error: 'Option not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true });
    }

    if (categoryId && fieldKey) {
      const count = await deleteFieldOptions(categoryId, fieldKey);
      return NextResponse.json({ success: true, deletedCount: count });
    }

    return NextResponse.json(
      { error: 'id or categoryId+fieldKey required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[API] attribute-options DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete option' }, { status: 500 });
  }
}
