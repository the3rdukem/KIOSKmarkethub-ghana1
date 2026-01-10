/**
 * Product API Route
 *
 * Operations for a specific product.
 * CRITICAL: Vendor verification gating enforced on status changes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import {
  getProductById,
  updateProduct,
  deleteProduct,
  UpdateProductInput,
} from '@/lib/db/dal/products';
import { getVendorByUserId } from '@/lib/db/dal/vendors';
import { getUserById } from '@/lib/db/dal/users';
import { createAuditLog } from '@/lib/db/dal/audit';
import { getActiveSaleByProduct } from '@/lib/db/dal/promotions';
import { validateContentSafety, validateName } from '@/lib/validation';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/products/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const product = await getProductById(id);

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Check access for non-active products
    if (product.status !== 'active') {
      const cookieStore = await cookies();
      const sessionToken = cookieStore.get('session_token')?.value;
      const session = sessionToken ? await validateSession(sessionToken) : null;

      if (!session) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }

      // Only owner or admin can see non-active products
      if (
        session.user_id !== product.vendor_id &&
        session.user_role !== 'admin' &&
        session.user_role !== 'master_admin'
      ) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }
    }

    const activeSale = await getActiveSaleByProduct(product.id);
    let effectivePrice = product.price;
    let saleInfo = null;

    if (activeSale) {
      if (activeSale.discount_type === 'percentage') {
        effectivePrice = product.price * (1 - activeSale.discount_value / 100);
      } else {
        effectivePrice = Math.max(0, product.price - activeSale.discount_value);
      }
      saleInfo = {
        id: activeSale.id,
        name: activeSale.name,
        discountType: activeSale.discount_type,
        discountValue: activeSale.discount_value,
        endsAt: activeSale.ends_at,
      };
    }

    // Section 3: UI Safety - Normalize null values in API response layer
    // CRITICAL: category must NEVER be empty string (crashes Radix Select)
    return NextResponse.json({
      product: {
        id: product.id,
        vendorId: product.vendor_id,
        vendorName: product.vendor_name,
        name: product.name,
        description: product.description,
        category: product.category || null,
        price: product.price ?? 0, // Normalize null to 0
        effectivePrice: Math.round(effectivePrice * 100) / 100,
        comparePrice: product.compare_price, // null is valid for comparePrice
        costPerItem: product.cost_per_item,
        sku: product.sku,
        barcode: product.barcode,
        quantity: product.quantity ?? 0, // Normalize null to 0
        trackQuantity: product.track_quantity === 1,
        images: product.images ? JSON.parse(product.images) : [],
        weight: product.weight,
        dimensions: product.dimensions ? JSON.parse(product.dimensions) : null,
        tags: product.tags ? JSON.parse(product.tags) : [],
        status: product.status,
        categoryAttributes: product.category_attributes
          ? JSON.parse(product.category_attributes)
          : {},
        isFeatured: product.is_featured === 1,
        createdAt: product.created_at,
        updatedAt: product.updated_at,
        activeSale: saleInfo,
      },
    });
  } catch (error) {
    console.error('Get product error:', error);
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}

/**
 * PUT /api/products/[id]
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

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

    const product = await getProductById(id);
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Check ownership or admin access
    if (
      session.user_id !== product.vendor_id &&
      session.user_role !== 'admin' &&
      session.user_role !== 'master_admin'
    ) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const body = await request.json();
    const validationErrors: string[] = [];
    
    // Validate fields if provided with field attribution
    if (body.name !== undefined) {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name) {
        return NextResponse.json(
          { error: 'Product name cannot be empty', code: 'REQUIRED_FIELD', field: 'name' },
          { status: 400 }
        );
      }
      // Content safety + garbage check for product name
      const nameResult = validateName(name, 'Product name');
      if (!nameResult.valid) {
        return NextResponse.json(
          { error: nameResult.message, code: nameResult.code, field: 'name' },
          { status: 400 }
        );
      }
    }
    
    // Content safety check for description if provided
    if (body.description !== undefined && body.description !== null && body.description !== '') {
      const descResult = validateContentSafety(body.description);
      if (!descResult.valid) {
        return NextResponse.json(
          { error: `Description ${descResult.message?.toLowerCase() || 'contains prohibited content'}`, code: descResult.code, field: 'description' },
          { status: 400 }
        );
      }
    }

    // PHASE 1.2: Sentinel value rejection for required fields when publishing
    const UNSET_SENTINEL = '__unset__';
    const isPublishing = body.status === 'active';

    // Category validation - reject sentinel value only when publishing
    if (body.category !== undefined) {
      const categoryInput = typeof body.category === 'string' ? body.category.trim() : '';
      if (isPublishing && (categoryInput === UNSET_SENTINEL || !categoryInput)) {
        return NextResponse.json(
          { error: 'Please select a category', code: 'REQUIRED_FIELD', field: 'category' },
          { status: 400 }
        );
      }
    }

    // Condition validation - check both top-level and categoryAttributes
    const conditionTopLevel = body.condition;
    const conditionAttr = body.categoryAttributes?.condition;
    const conditionValue = conditionTopLevel ?? conditionAttr;

    // When publishing, require condition to be set (either top-level or in categoryAttributes)
    // This enforces that ALL published products must have a condition, regardless of category
    // Reject sentinel value or empty/null only when publishing
    if (isPublishing && (!conditionValue || conditionValue === '' || conditionValue === null || conditionValue === UNSET_SENTINEL)) {
      return NextResponse.json(
        { error: 'Please select a condition', code: 'REQUIRED_FIELD', field: 'condition' },
        { status: 400 }
      );
    }

    // Check categoryAttributes for sentinel values only when publishing
    // Note: Client-side transform now filters out __unset__ for optional fields
    // This check is a safety net for any required category attributes that slip through
    if (isPublishing && body.categoryAttributes && typeof body.categoryAttributes === 'object') {
      for (const [key, value] of Object.entries(body.categoryAttributes)) {
        if (value === UNSET_SENTINEL) {
          return NextResponse.json(
            { error: `Please select a value for ${key}`, code: 'REQUIRED_FIELD', field: key },
            { status: 400 }
          );
        }
      }
    }
    
    // Validate color if provided (garbage detection)
    const colorAttr = body.categoryAttributes?.color;
    if (colorAttr && typeof colorAttr === 'string' && colorAttr.trim()) {
      const colorResult = validateName(colorAttr.trim(), 'Color');
      if (!colorResult.valid) {
        return NextResponse.json(
          { error: colorResult.message, code: colorResult.code, field: 'color' },
          { status: 400 }
        );
      }
    }
    
    // Validate brand if provided (garbage + profanity)
    const brandAttr = body.categoryAttributes?.brand;
    if (brandAttr && typeof brandAttr === 'string' && brandAttr.trim()) {
      const brandResult = validateName(brandAttr.trim(), 'Brand');
      if (!brandResult.valid) {
        return NextResponse.json(
          { error: brandResult.message, code: brandResult.code, field: 'brand' },
          { status: 400 }
        );
      }
    }
    
    // Validate tags if provided (garbage + profanity for each tag)
    if (body.tags && Array.isArray(body.tags)) {
      for (const tag of body.tags) {
        if (typeof tag === 'string' && tag.trim()) {
          const tagResult = validateContentSafety(tag.trim());
          if (!tagResult.valid) {
            return NextResponse.json(
              { error: `Tag "${tag}" contains prohibited content`, code: tagResult.code, field: 'tags' },
              { status: 400 }
            );
          }
        }
      }
    }
    
    if (body.price !== undefined) {
      const price = parseFloat(body.price);
      if (isNaN(price) || price <= 0) {
        return NextResponse.json(
          { error: 'Price must be a positive number', code: 'VALIDATION_ERROR', field: 'price' },
          { status: 400 }
        );
      }
    }
    
    // Section 2: Numeric Field Normalization - quantity defaults to 0 if empty
    if (body.quantity !== undefined) {
      const quantityInput = body.quantity === '' || body.quantity === null ? '0' : String(body.quantity);
      const quantity = parseInt(quantityInput, 10);
      if (isNaN(quantity) || quantity < 0) {
        return NextResponse.json(
          { error: 'Quantity must be zero or a positive number', code: 'VALIDATION_ERROR', field: 'quantity' },
          { status: 400 }
        );
      }
      // Normalize to ensure we store 0 not empty
      body.quantity = quantity;
    }
    
    // Section 2: Numeric Field Normalization - comparePrice becomes null if empty
    if (body.comparePrice !== undefined) {
      if (body.comparePrice === null || body.comparePrice === '') {
        body.comparePrice = null; // Normalize empty to null
      } else {
        const comparePrice = parseFloat(body.comparePrice);
        if (isNaN(comparePrice) || comparePrice < 0) {
          return NextResponse.json(
            { error: 'Compare price must be a positive number', code: 'VALIDATION_ERROR', field: 'comparePrice' },
            { status: 400 }
          );
        }
      }
    }
    
    const updates: UpdateProductInput = {};

    // CRITICAL: Vendor verification gating for status changes to 'active'
    // Prevents unverified vendors from publishing via update
    const isAdmin = session.user_role === 'admin' || session.user_role === 'master_admin';
    const isVendor = session.user_role === 'vendor';

    if (body.status === 'active' && product.status !== 'active') {
      // Vendor trying to publish - check verification
      if (isVendor) {
        const vendorEntity = await getVendorByUserId(session.user_id);
        const user = await getUserById(session.user_id);
        const verificationStatus = vendorEntity?.verification_status || user?.verification_status;

        if (verificationStatus !== 'verified') {
          await createAuditLog({
            action: 'PRODUCT_PUBLISH_BLOCKED',
            category: 'product',
            targetId: product.id,
            targetType: 'product',
            targetName: product.name,
            details: `Unverified vendor attempted to publish product via update. Verification status: ${verificationStatus}`,
            severity: 'warning',
            ipAddress: request.headers.get('x-forwarded-for') || undefined,
          });

          return NextResponse.json(
            {
              error: 'Vendor verification required to publish products',
              code: 'VENDOR_NOT_VERIFIED',
              details: `Your account verification status is "${verificationStatus}". Only verified vendors can publish products.`,
            },
            { status: 403 }
          );
        }
      } else if (isAdmin) {
        // Admin publishing on behalf of vendor - check vendor's verification
        const vendorEntity = await getVendorByUserId(product.vendor_id);
        const vendorUser = await getUserById(product.vendor_id);
        const verificationStatus = vendorEntity?.verification_status || vendorUser?.verification_status;

        if (verificationStatus !== 'verified') {
          return NextResponse.json(
            {
              error: 'Cannot publish product for unverified vendor',
              code: 'VENDOR_NOT_VERIFIED',
              details: `The vendor's verification status is "${verificationStatus}". Products can only be published for verified vendors.`,
            },
            { status: 403 }
          );
        }
      }
    }

    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.category !== undefined) updates.category = body.category;
    if (body.price !== undefined) updates.price = parseFloat(body.price);
    if (body.comparePrice !== undefined)
      updates.comparePrice = body.comparePrice ? parseFloat(body.comparePrice) : undefined;
    if (body.quantity !== undefined) updates.quantity = parseInt(body.quantity, 10);
    if (body.trackQuantity !== undefined) updates.trackQuantity = body.trackQuantity;
    if (body.images !== undefined) updates.images = body.images;
    if (body.tags !== undefined) updates.tags = body.tags;
    if (body.status !== undefined) updates.status = body.status;
    if (body.categoryAttributes !== undefined)
      updates.categoryAttributes = body.categoryAttributes;
    if (body.isFeatured !== undefined && isAdmin) {
      updates.isFeatured = body.isFeatured;
      updates.featuredBy = session.user_id;
    }

    const updatedProduct = await updateProduct(id, updates);

    if (!updatedProduct) {
      return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
    }

    // Log product update with status change info
    const statusChanged = body.status !== undefined && body.status !== product.status;
    await createAuditLog({
      action: statusChanged && body.status === 'active' ? 'PRODUCT_PUBLISHED' : 'PRODUCT_UPDATED',
      category: 'product',
      adminId: isAdmin ? session.user_id : undefined,
      targetId: product.id,
      targetType: 'product',
      targetName: product.name,
      details: statusChanged
        ? `Product status changed from "${product.status}" to "${body.status}"`
        : `Product "${product.name}" updated`,
      previousValue: statusChanged ? product.status : undefined,
      newValue: statusChanged ? body.status : undefined,
      severity: 'info',
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    });

    return NextResponse.json({
      success: true,
      product: {
        id: updatedProduct.id,
        vendorId: updatedProduct.vendor_id,
        name: updatedProduct.name,
        status: updatedProduct.status,
        updatedAt: updatedProduct.updated_at,
      },
    });
  } catch (error) {
    console.error('Update product error:', error);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

/**
 * PATCH /api/products/[id]
 * Admin actions: approve, reject, suspend, unsuspend, feature, unfeature
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    if (session.user_role !== 'admin' && session.user_role !== 'master_admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const product = await getProductById(id);
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const body = await request.json();
    const { action, reason } = body;

    const adminUser = await getUserById(session.user_id);
    const now = new Date().toISOString();
    let updates: UpdateProductInput = {};
    let auditAction = '';
    let auditDetails = '';

    switch (action) {
      case 'approve':
        updates = { status: 'active' };
        auditAction = 'PRODUCT_APPROVED';
        auditDetails = `Admin approved product "${product.name}"`;
        break;
      case 'reject':
        if (!reason) {
          return NextResponse.json({ error: 'Reason required for rejection' }, { status: 400 });
        }
        updates = { status: 'rejected' };
        auditAction = 'PRODUCT_REJECTED';
        auditDetails = `Admin rejected product "${product.name}". Reason: ${reason}`;
        break;
      case 'suspend':
        if (!reason) {
          return NextResponse.json({ error: 'Reason required for suspension' }, { status: 400 });
        }
        updates = { status: 'suspended' };
        auditAction = 'PRODUCT_SUSPENDED';
        auditDetails = `Admin suspended product "${product.name}". Reason: ${reason}`;
        break;
      case 'unsuspend':
        updates = { status: 'active' };
        auditAction = 'PRODUCT_UNSUSPENDED';
        auditDetails = `Admin unsuspended product "${product.name}"`;
        break;
      case 'feature':
        updates = { isFeatured: true, featuredBy: session.user_id };
        auditAction = 'PRODUCT_FEATURED';
        auditDetails = `Admin featured product "${product.name}"`;
        break;
      case 'unfeature':
        updates = { isFeatured: false };
        auditAction = 'PRODUCT_UNFEATURED';
        auditDetails = `Admin removed product "${product.name}" from featured`;
        break;
      case 'publish':
        updates = { status: 'active' };
        auditAction = 'PRODUCT_PUBLISHED';
        auditDetails = `Admin published product "${product.name}"`;
        break;
      case 'unpublish':
        updates = { status: 'draft' };
        auditAction = 'PRODUCT_UNPUBLISHED';
        auditDetails = `Admin changed product "${product.name}" to draft`;
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const updatedProduct = await updateProduct(id, updates);

    if (!updatedProduct) {
      return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
    }

    await createAuditLog({
      action: auditAction,
      category: 'product',
      adminId: session.user_id,
      adminName: adminUser?.name || 'Admin',
      adminEmail: adminUser?.email,
      adminRole: session.user_role,
      targetId: product.id,
      targetType: 'product',
      targetName: product.name,
      details: auditDetails,
      previousValue: product.status,
      newValue: updates.status || (updates.isFeatured ? 'featured' : 'unfeatured'),
      severity: action === 'suspend' || action === 'reject' ? 'warning' : 'info',
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    });

    return NextResponse.json({
      success: true,
      product: {
        id: updatedProduct.id,
        status: updatedProduct.status,
        isFeatured: updatedProduct.is_featured === 1,
      },
    });
  } catch (error) {
    console.error('Product action error:', error);
    return NextResponse.json({ error: 'Failed to perform action' }, { status: 500 });
  }
}

/**
 * DELETE /api/products/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

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

    const product = await getProductById(id);
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Check ownership or admin access
    if (
      session.user_id !== product.vendor_id &&
      session.user_role !== 'admin' &&
      session.user_role !== 'master_admin'
    ) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const success = await deleteProduct(id);

    if (!success) {
      return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete product error:', error);
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}
