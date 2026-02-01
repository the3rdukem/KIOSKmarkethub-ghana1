/**
 * Categories API Route
 *
 * Public GET for fetching categories.
 * Admin-only POST/PATCH/DELETE for management.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import {
  getCategories,
  getActiveCategories,
  getMenuCategories,
  getCategoryById,
  getCategoryBySlug,
  getCategoryFormSchema,
  getCategoryFormSchemaByName,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
  getCategoryStats,
} from '@/lib/db/dal/categories';
import { createAuditLog } from '@/lib/db/dal/audit';
import { withRateLimit } from '@/lib/utils/rate-limiter';

/**
 * GET /api/categories
 *
 * Public endpoint to get categories
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitCheck = await withRateLimit(request, 'api_public_read');
    if (!rateLimitCheck.allowed) {
      return rateLimitCheck.response;
    }

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') !== 'false';
    const menuOnly = searchParams.get('menu') === 'true';
    const homeOnly = searchParams.get('home') === 'true';
    const slug = searchParams.get('slug');
    const id = searchParams.get('id');
    const formSchema = searchParams.get('formSchema');
    const stats = searchParams.get('stats');

    // Return stats (admin only)
    if (stats === 'true') {
      const cookieStore = await cookies();
      const sessionToken = cookieStore.get('session_token')?.value;
      if (sessionToken) {
        const session = await validateSession(sessionToken);
        if (session && (session.user_role === 'admin' || session.user_role === 'master_admin')) {
          return NextResponse.json({ stats: await getCategoryStats() });
        }
      }
    }

    // Get form schema for a specific category
    if (formSchema) {
      const schema = await getCategoryFormSchemaByName(formSchema);
      return NextResponse.json({ formSchema: schema });
    }

    // Get single category by ID
    if (id) {
      const category = await getCategoryById(id);
      if (!category) {
        return NextResponse.json({ error: 'Category not found' }, { status: 404 });
      }

      let parsedFormSchema = null;
      if (category.form_schema) {
        try {
          parsedFormSchema = JSON.parse(category.form_schema);
        } catch {
          parsedFormSchema = [];
        }
      }

      return NextResponse.json({
        category: {
          id: category.id,
          name: category.name,
          slug: category.slug,
          description: category.description,
          icon: category.icon,
          imageUrl: category.image_url,
          parentId: category.parent_id,
          isActive: category.is_active === 1,
          showInMenu: category.show_in_menu === 1,
          showInHome: category.show_in_home === 1,
          displayOrder: category.display_order,
          formSchema: parsedFormSchema,
          createdAt: category.created_at,
          updatedAt: category.updated_at,
        },
      });
    }

    // Get single category by slug
    if (slug) {
      const category = await getCategoryBySlug(slug);
      if (!category) {
        return NextResponse.json({ error: 'Category not found' }, { status: 404 });
      }

      let parsedFormSchema = null;
      if (category.form_schema) {
        try {
          parsedFormSchema = JSON.parse(category.form_schema);
        } catch {
          parsedFormSchema = [];
        }
      }

      return NextResponse.json({
        category: {
          id: category.id,
          name: category.name,
          slug: category.slug,
          description: category.description,
          icon: category.icon,
          imageUrl: category.image_url,
          parentId: category.parent_id,
          isActive: category.is_active === 1,
          showInMenu: category.show_in_menu === 1,
          showInHome: category.show_in_home === 1,
          displayOrder: category.display_order,
          formSchema: parsedFormSchema,
          createdAt: category.created_at,
          updatedAt: category.updated_at,
        },
      });
    }

    // Get list of categories
    let categories;
    if (menuOnly) {
      categories = await getMenuCategories();
    } else if (homeOnly) {
      categories = await getCategories({ isActive: true, showInHome: true });
    } else if (activeOnly) {
      categories = await getActiveCategories();
    } else {
      // Admin can see all categories
      const cookieStore = await cookies();
      const sessionToken = cookieStore.get('session_token')?.value;
      if (sessionToken) {
        const session = await validateSession(sessionToken);
        if (session && (session.user_role === 'admin' || session.user_role === 'master_admin')) {
          categories = await getCategories();
        } else {
          categories = await getActiveCategories();
        }
      } else {
        categories = await getActiveCategories();
      }
    }

    return NextResponse.json({
      categories: categories.map(c => {
        let parsedFormSchema = null;
        if (c.form_schema) {
          try {
            parsedFormSchema = JSON.parse(c.form_schema);
          } catch {
            parsedFormSchema = [];
          }
        }

        return {
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
          icon: c.icon,
          imageUrl: c.image_url,
          parentId: c.parent_id,
          isActive: c.is_active === 1,
          showInMenu: c.show_in_menu === 1,
          showInHome: c.show_in_home === 1,
          displayOrder: c.display_order,
          formSchema: parsedFormSchema,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        };
      }),
      total: categories.length,
    });
  } catch (error) {
    console.error('Get categories error:', error);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

/**
 * POST /api/categories
 *
 * Create a new category (admin only)
 */
export async function POST(request: NextRequest) {
  try {
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

    // Only admins can create categories
    if (session.user_role !== 'admin' && session.user_role !== 'master_admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { name, slug, description, icon, imageUrl, parentId, isActive, showInMenu, showInHome, displayOrder, formSchema } = body;

    if (!name) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    // Check for duplicate slug
    const generatedSlug = slug || name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const existing = await getCategoryBySlug(generatedSlug);
    if (existing) {
      return NextResponse.json({ error: 'A category with this slug already exists' }, { status: 409 });
    }

    const category = await createCategory({
      name,
      slug: generatedSlug,
      description,
      icon,
      imageUrl,
      parentId,
      isActive,
      showInMenu,
      showInHome,
      displayOrder,
      formSchema,
      createdBy: session.user_id,
    });

    // Create audit log
    await createAuditLog({
      action: 'CATEGORY_CREATED',
      category: 'category',
      adminId: session.user_id,
      targetId: category.id,
      targetType: 'category',
      targetName: category.name,
      details: `Created category: ${category.name}`,
      severity: 'info',
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    });

    return NextResponse.json({
      success: true,
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        icon: category.icon,
        isActive: category.is_active === 1,
        formSchema: category.form_schema ? JSON.parse(category.form_schema) : null,
        createdAt: category.created_at,
      },
    });
  } catch (error) {
    console.error('Create category error:', error);
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}

/**
 * PATCH /api/categories
 *
 * Update a category (admin only)
 */
export async function PATCH(request: NextRequest) {
  try {
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

    // Only admins can update categories
    if (session.user_role !== 'admin' && session.user_role !== 'master_admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { categoryId, reorder, ...updates } = body;

    // Handle reorder
    if (reorder && Array.isArray(reorder)) {
      await reorderCategories(reorder);
      await createAuditLog({
        action: 'CATEGORIES_REORDERED',
        category: 'category',
        adminId: session.user_id,
        details: 'Reordered categories',
        severity: 'info',
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
      });
      return NextResponse.json({ success: true });
    }

    if (!categoryId) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
    }

    const category = await getCategoryById(categoryId);
    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const updatedCategory = await updateCategory(categoryId, updates);
    if (!updatedCategory) {
      return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
    }

    // Create audit log
    await createAuditLog({
      action: 'CATEGORY_UPDATED',
      category: 'category',
      adminId: session.user_id,
      targetId: categoryId,
      targetType: 'category',
      targetName: category.name,
      details: `Updated category: ${category.name}`,
      severity: 'info',
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    });

    return NextResponse.json({
      success: true,
      category: {
        id: updatedCategory.id,
        name: updatedCategory.name,
        slug: updatedCategory.slug,
        isActive: updatedCategory.is_active === 1,
        formSchema: updatedCategory.form_schema ? JSON.parse(updatedCategory.form_schema) : null,
      },
    });
  } catch (error) {
    console.error('Update category error:', error);
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
  }
}

/**
 * DELETE /api/categories
 *
 * Delete a category (admin only)
 */
export async function DELETE(request: NextRequest) {
  try {
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

    // Only master admins can delete categories
    if (session.user_role !== 'master_admin') {
      return NextResponse.json({ error: 'Master admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('id');
    const force = searchParams.get('force') === 'true';

    if (!categoryId) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
    }

    const category = await getCategoryById(categoryId);
    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const result = await deleteCategory(categoryId, force);
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to delete category' }, { status: 400 });
    }

    // Create audit log
    await createAuditLog({
      action: 'CATEGORY_DELETED',
      category: 'category',
      adminId: session.user_id,
      targetId: categoryId,
      targetType: 'category',
      targetName: category.name,
      details: `Deleted category: ${category.name}`,
      severity: 'warning',
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete category error:', error);
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}
