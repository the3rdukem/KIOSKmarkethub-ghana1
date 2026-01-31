/**
 * User API Route
 *
 * Operations for a specific user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/db/dal/sessions';
import {
  getUserById,
  updateUser,
  softDeleteUser,
  deleteUser,
  type UpdateUserInput,
} from '@/lib/db/dal/users';
import { query } from '@/lib/db';
import { logAdminAction } from '@/lib/db/dal/audit';
import { getAdminById } from '@/lib/db/dal/admin';
import { validatePhone, normalizePhone, validateContentSafety, validateAddress } from '@/lib/validation';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/users/[id]
 * Returns user info. Requires authentication.
 * Any authenticated user can view vendor public profiles (name, business info).
 * Full details require ownership or admin access.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Verify authentication - required for all requests
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const session = await validateSession(sessionToken);
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const user = await getUserById(id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isOwnProfile = session.user_id === id;
    const isAdmin = session.user_role === 'admin' || session.user_role === 'master_admin';

    // Any authenticated user can view vendor public profiles (for messaging, store pages)
    if (user.role === 'vendor') {
      const publicInfo = {
        id: user.id,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        businessName: user.business_name,
        storeDescription: user.store_description,
        storeBanner: user.store_banner,
        storeLogo: user.store_logo,
        verificationStatus: user.verification_status,
      };

      // Add full details if own profile or admin
      if (isOwnProfile || isAdmin) {
        let storeSettings = {};
        if (user.store_settings) {
          try {
            storeSettings = typeof user.store_settings === 'string' 
              ? JSON.parse(user.store_settings) 
              : user.store_settings;
          } catch { storeSettings = {}; }
        }
        return NextResponse.json({
          user: {
            ...publicInfo,
            email: user.email,
            status: user.status,
            phone: user.phone,
            location: user.location,
            businessType: user.business_type,
            verificationNotes: user.verification_notes,
            verifiedAt: user.verified_at,
            isDeleted: user.is_deleted === 1,
            lastLoginAt: user.last_login_at,
            createdAt: user.created_at,
            updatedAt: user.updated_at,
            storeSettings,
          },
        });
      }

      // Return public info for other authenticated users
      return NextResponse.json({ user: publicInfo });
    }

    // Non-vendor profiles require ownership or admin access
    if (!isOwnProfile && !isAdmin) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    let notificationSettings = {};
    if (user.notification_settings) {
      try {
        notificationSettings = typeof user.notification_settings === 'string' 
          ? JSON.parse(user.notification_settings) 
          : user.notification_settings;
      } catch { notificationSettings = {}; }
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        avatar: user.avatar,
        phone: user.phone,
        location: user.location,
        businessName: user.business_name,
        businessType: user.business_type,
        verificationStatus: user.verification_status,
        verificationNotes: user.verification_notes,
        verifiedAt: user.verified_at,
        storeDescription: user.store_description,
        storeBanner: user.store_banner,
        storeLogo: user.store_logo,
        isDeleted: user.is_deleted === 1,
        lastLoginAt: user.last_login_at,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        notificationSettings,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

/**
 * PUT /api/users/[id]
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

    const user = await getUserById(id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Users can update their own profile, admins can update any
    const isAdmin = session.user_role === 'admin' || session.user_role === 'master_admin';
    const isOwnProfile = session.user_id === id;

    if (!isOwnProfile && !isAdmin) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const body = await request.json();
    
    // Validate phone if provided
    if (body.phone !== undefined && body.phone !== null && body.phone !== '') {
      const phoneResult = validatePhone(body.phone);
      if (!phoneResult.valid) {
        return NextResponse.json(
          { error: phoneResult.message, code: phoneResult.code },
          { status: 400 }
        );
      }
      
      // Security: Vendors must verify with OTP before changing phone number
      // Only required when actually changing the phone (not for initial setup or same value)
      const normalizedNewPhone = normalizePhone(body.phone);
      const currentPhone = user.phone ? normalizePhone(user.phone) : null;
      const isPhoneChange = currentPhone && normalizedNewPhone !== currentPhone;
      
      if (isPhoneChange && user.role === 'vendor' && isOwnProfile && !isAdmin) {
        // Require phone change token for vendors changing their phone
        const { phoneChangeToken } = body;
        
        if (!phoneChangeToken) {
          return NextResponse.json({
            error: 'OTP verification required',
            code: 'OTP_REQUIRED',
            message: 'Please verify with OTP before changing your phone number.'
          }, { status: 403 });
        }
        
        // Validate the phone change token
        if (user.phone_change_token !== phoneChangeToken) {
          return NextResponse.json({
            error: 'Invalid or expired verification',
            code: 'INVALID_TOKEN'
          }, { status: 403 });
        }
        
        // Check token expiry
        if (!user.phone_change_token_expires || new Date(user.phone_change_token_expires) < new Date()) {
          return NextResponse.json({
            error: 'Verification expired',
            code: 'TOKEN_EXPIRED',
            message: 'Your verification has expired. Please request a new OTP.'
          }, { status: 403 });
        }
        
        // Token is valid - will be invalidated after successful update
      }
    }
    
    // Validate location/address if provided
    if (body.location !== undefined && body.location !== null && body.location !== '') {
      const locationResult = validateAddress(body.location, 'Location');
      if (!locationResult.valid) {
        return NextResponse.json(
          { error: locationResult.message, code: locationResult.code },
          { status: 400 }
        );
      }
    }
    
    // Content safety for store description
    if (body.storeDescription !== undefined && body.storeDescription !== null && body.storeDescription !== '') {
      const descResult = validateContentSafety(body.storeDescription);
      if (!descResult.valid) {
        return NextResponse.json(
          { error: descResult.message, code: descResult.code },
          { status: 400 }
        );
      }
    }
    
    // Content safety for business name
    if (body.businessName !== undefined && body.businessName !== null && body.businessName !== '') {
      const nameResult = validateContentSafety(body.businessName);
      if (!nameResult.valid) {
        return NextResponse.json(
          { error: nameResult.message, code: nameResult.code },
          { status: 400 }
        );
      }
    }
    
    const updates: UpdateUserInput = {};

    // Fields users can update on their own profile
    if (body.name !== undefined) updates.name = body.name;
    if (body.avatar !== undefined) updates.avatar = body.avatar;
    if (body.phone !== undefined) updates.phone = body.phone ? normalizePhone(body.phone) : body.phone;
    if (body.location !== undefined) updates.location = body.location;
    
    // Email update for own profile (foundation for verification flow)
    // When verification is enabled, this will store in pending_email instead
    if (isOwnProfile && body.email !== undefined) {
      // Normalize email to lowercase for case-insensitive matching
      const normalizedEmail = body.email.trim().toLowerCase();
      
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        return NextResponse.json(
          { error: 'Invalid email format', code: 'INVALID_EMAIL' },
          { status: 400 }
        );
      }
      // Check if email is already taken by another user
      const { getUserByEmail } = await import('@/lib/db/dal/users');
      const existingUser = await getUserByEmail(normalizedEmail);
      if (existingUser && existingUser.id !== id) {
        return NextResponse.json(
          { error: 'This email is already in use', code: 'EMAIL_TAKEN' },
          { status: 400 }
        );
      }
      // TODO: When verification is enabled, set pendingEmail instead of email
      // and trigger verification email flow
      updates.email = normalizedEmail;
    }

    // Vendor-specific fields (vendors can update their own)
    if (user.role === 'vendor' && isOwnProfile) {
      if (body.businessName !== undefined) updates.businessName = body.businessName;
      if (body.businessType !== undefined) updates.businessType = body.businessType;
      if (body.storeDescription !== undefined) updates.storeDescription = body.storeDescription;
      if (body.storeBanner !== undefined) updates.storeBanner = body.storeBanner;
      if (body.storeLogo !== undefined) updates.storeLogo = body.storeLogo;
      if (body.storeStatus !== undefined) updates.storeStatus = body.storeStatus;
      if (body.storeVacationMessage !== undefined) updates.storeVacationMessage = body.storeVacationMessage;
      if (body.storeContactEmail !== undefined) updates.storeContactEmail = body.storeContactEmail;
      if (body.storeContactPhone !== undefined) updates.storeContactPhone = body.storeContactPhone;
      if (body.storeWebsite !== undefined) updates.storeWebsite = body.storeWebsite;
      if (body.storeBusinessHours !== undefined) updates.storeBusinessHours = body.storeBusinessHours;
      if (body.storeReturnPolicy !== undefined) updates.storeReturnPolicy = body.storeReturnPolicy;
      if (body.storeShippingPolicy !== undefined) updates.storeShippingPolicy = body.storeShippingPolicy;
      if (body.storeResponseTime !== undefined) updates.storeResponseTime = body.storeResponseTime;
      if (body.storeSocialLinks !== undefined) updates.storeSocialLinks = body.storeSocialLinks;
      if (body.storeSettings !== undefined) updates.storeSettings = body.storeSettings;
    }

    // Users can update their own notification settings (both buyers and vendors)
    if (isOwnProfile && body.notificationSettings !== undefined) {
      updates.notificationSettings = body.notificationSettings;
    }

    // Admin-only fields
    if (isAdmin) {
      if (body.status !== undefined) updates.status = body.status;
      if (body.verificationStatus !== undefined) updates.verificationStatus = body.verificationStatus;
      if (body.verificationNotes !== undefined) updates.verificationNotes = body.verificationNotes;
      if (body.verifiedAt !== undefined) updates.verifiedAt = body.verifiedAt;
      if (body.verifiedBy !== undefined) updates.verifiedBy = body.verifiedBy;

      // Log admin action
      const admin = await getAdminById(session.user_id);
      if (admin) {
        await logAdminAction('USER_UPDATED', {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
        }, {
          category: 'user',
          targetId: id,
          targetType: 'user',
          targetName: user.name,
          details: `Updated user: ${JSON.stringify(Object.keys(updates))}`,
        });
      }
    }

    const updatedUser = await updateUser(id, updates);

    if (!updatedUser) {
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }

    // If vendor phone was changed, invalidate the token and reset phone_verified
    if (updates.phone && user.role === 'vendor' && isOwnProfile && !isAdmin) {
      const currentPhone = user.phone ? normalizePhone(user.phone) : null;
      const newPhone = normalizePhone(updates.phone);
      
      if (currentPhone && newPhone !== currentPhone) {
        await query(
          `UPDATE users SET 
            phone_change_token = NULL,
            phone_change_token_expires = NULL,
            phone_verified = false,
            updated_at = $1
          WHERE id = $2`,
          [new Date().toISOString(), id]
        );
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        status: updatedUser.status,
        updatedAt: updatedUser.updated_at,
      },
    });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

/**
 * DELETE /api/users/[id]
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

    // Only admins can delete users
    if (session.user_role !== 'admin' && session.user_role !== 'master_admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const user = await getUserById(id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const permanent = searchParams.get('permanent') === 'true';
    const reason = searchParams.get('reason') || 'Deleted by admin';

    let success: boolean;
    if (permanent && session.user_role === 'master_admin') {
      success = await deleteUser(id);
    } else {
      success = await softDeleteUser(id, session.user_id, reason);
    }

    if (!success) {
      return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
    }

    // Log admin action
    const admin = await getAdminById(session.user_id);
    if (admin) {
      await logAdminAction(permanent ? 'USER_PERMANENTLY_DELETED' : 'USER_SOFT_DELETED', {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      }, {
        category: 'user',
        targetId: id,
        targetType: 'user',
        targetName: user.name,
        details: reason,
        severity: 'critical',
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
