/**
 * Products API Route
 *
 * CRUD operations for products.
 * CRITICAL: Vendor verification gating enforced server-side.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import {
  getProducts,
  getActiveProducts,
  createProduct,
  getProductStats,
  CreateProductInput,
} from '@/lib/db/dal/products';
import { getUserById } from '@/lib/db/dal/users';
import { getVendorByUserId } from '@/lib/db/dal/vendors';
import { createAuditLog } from '@/lib/db/dal/audit';

/**
 * GET /api/products
 *
 * Get products with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const vendorId = searchParams.get('vendorId') || undefined;
    const category = searchParams.get('category') || undefined;
    const status = searchParams.get('status') as 'active' | 'draft' | undefined;
    const featured = searchParams.get('featured');
    const search = searchParams.get('search') || undefined;
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const options: Parameters<typeof getProducts>[0] = {
      vendorId,
      category,
      search,
    };

    // For public access, only show active products
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;
    const session = sessionToken ? await validateSession(sessionToken) : null;

    if (session) {
      // Authenticated - can see their own products regardless of status
      if (vendorId && session.user_id === vendorId) {
        options.status = status;
      } else if (session.user_role === 'admin' || session.user_role === 'master_admin') {
        // Admins can see all products
        options.status = status;
      } else {
        options.status = 'active';
      }
    } else {
      options.status = 'active';
    }

    if (featured === 'true') {
      options.isFeatured = true;
    }

    if (limit) {
      options.limit = parseInt(limit, 10);
    }

    if (offset) {
      options.offset = parseInt(offset, 10);
    }

    const products = await getProducts(options);

    // Transform for client
    const transformedProducts = products.map((product) => ({
      id: product.id,
      vendorId: product.vendor_id,
      vendorName: product.vendor_name,
      name: product.name,
      description: product.description,
      category: product.category,
      price: product.price,
      comparePrice: product.compare_price,
      quantity: product.quantity,
      trackQuantity: product.track_quantity === 1,
      images: product.images ? JSON.parse(product.images) : [],
      tags: product.tags ? JSON.parse(product.tags) : [],
      status: product.status,
      categoryAttributes: product.category_attributes ? JSON.parse(product.category_attributes) : {},
      isFeatured: product.is_featured === 1,
      createdAt: product.created_at,
      updatedAt: product.updated_at,
    }));

    return NextResponse.json({
      products: transformedProducts,
      total: transformedProducts.length,
    });
  } catch (error) {
    console.error('Get products error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/products
 *
 * Create a new product
 * CRITICAL: Enforces vendor verification gating server-side
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const body = await request.json();

    // Determine if this is admin creating on behalf of vendor
    const isAdmin = session.user_role === 'admin' || session.user_role === 'master_admin';
    const isVendor = session.user_role === 'vendor';

    // For admin product creation, a vendorId must be provided
    let targetVendorId: string;
    let targetVendor: Awaited<ReturnType<typeof getUserById>>;

    if (isAdmin && body.vendorId) {
      // Admin creating product on behalf of vendor
      targetVendorId = body.vendorId;
      targetVendor = await getUserById(targetVendorId);

      if (!targetVendor) {
        return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
      }

      if (targetVendor.role !== 'vendor') {
        return NextResponse.json({ error: 'Target user is not a vendor' }, { status: 400 });
      }

      // Check vendor entity for verification status (preferred) or fallback to user
      const vendorEntity = await getVendorByUserId(targetVendorId);
      const verificationStatus = vendorEntity?.verification_status || targetVendor.verification_status;

      // CRITICAL: Even admin-created products respect vendor verification
      // Only verified vendors can have products published
      if (verificationStatus !== 'verified' && body.status === 'active') {
        return NextResponse.json(
          {
            error: 'Vendor verification required to publish products',
            code: 'VENDOR_NOT_VERIFIED',
            details: 'Products can only be published (status: active) for verified vendors. Set status to "draft" instead.',
          },
          { status: 403 }
        );
      }
    } else if (isVendor) {
      // Vendor creating their own product
      targetVendorId = session.user_id;
      targetVendor = await getUserById(targetVendorId);

      if (!targetVendor) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      // CRITICAL: Vendor verification gating - SERVER-SIDE ENFORCEMENT
      // Check vendor entity for verification status (preferred) or fallback to user
      const vendorEntity = await getVendorByUserId(targetVendorId);
      const verificationStatus = vendorEntity?.verification_status || targetVendor.verification_status;

      // Unverified vendors can only create drafts, not publish
      if (verificationStatus !== 'verified') {
        // If trying to publish (status=active), block it
        if (body.status === 'active' || !body.status) {
          // Log the blocked attempt
          await createAuditLog({
            action: 'PRODUCT_PUBLISH_BLOCKED',
            category: 'product',
            targetId: targetVendorId,
            targetType: 'vendor',
            targetName: targetVendor.email,
            details: `Unverified vendor attempted to publish product. Verification status: ${verificationStatus}. Auto-saving as draft.`,
            severity: 'warning',
            ipAddress: request.headers.get('x-forwarded-for') || undefined,
          });

          // Force status to draft instead of blocking entirely
          body.status = 'draft';
        }
      }
    } else if (isAdmin && !body.vendorId) {
      return NextResponse.json(
        { error: 'Admin must specify vendorId when creating products' },
        { status: 400 }
      );
    } else {
      return NextResponse.json({ error: 'Only vendors and admins can create products' }, { status: 403 });
    }

    // Validate required fields
    if (!body.name || !body.price) {
      return NextResponse.json(
        { error: 'Name and price are required' },
        { status: 400 }
      );
    }

    const productInput: CreateProductInput = {
      vendorId: targetVendorId,
      vendorName: targetVendor!.business_name || targetVendor!.name,
      name: body.name,
      description: body.description,
      category: body.category,
      price: parseFloat(body.price),
      comparePrice: body.comparePrice ? parseFloat(body.comparePrice) : undefined,
      quantity: body.quantity ? parseInt(body.quantity, 10) : 0,
      trackQuantity: body.trackQuantity !== false,
      images: body.images,
      tags: body.tags,
      status: body.status || 'active',
      categoryAttributes: body.categoryAttributes,
    };

    const product = await createProduct(productInput);

    // Log successful product creation
    const adminUser = isAdmin ? await getUserById(session.user_id) : null;
    await createAuditLog({
      action: isAdmin ? 'ADMIN_PRODUCT_CREATED' : 'PRODUCT_CREATED',
      category: 'product',
      adminId: isAdmin ? session.user_id : undefined,
      adminName: isAdmin ? (adminUser?.name || 'Admin') : undefined,
      targetId: product.id,
      targetType: 'product',
      targetName: product.name,
      details: isAdmin
        ? `Admin created product "${product.name}" for vendor ${targetVendor!.email}`
        : `Vendor created product "${product.name}"`,
      severity: 'info',
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    });

    return NextResponse.json({
      success: true,
      product: {
        id: product.id,
        vendorId: product.vendor_id,
        vendorName: product.vendor_name,
        name: product.name,
        description: product.description,
        category: product.category,
        price: product.price,
        comparePrice: product.compare_price,
        quantity: product.quantity,
        trackQuantity: product.track_quantity === 1,
        images: product.images ? JSON.parse(product.images) : [],
        tags: product.tags ? JSON.parse(product.tags) : [],
        status: product.status,
        createdAt: product.created_at,
      },
    });
  } catch (error) {
    console.error('Create product error:', error);
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    );
  }
}
