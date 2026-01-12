/**
 * Google OAuth Callback API
 * 
 * Phase 4A: Handles Google OAuth callback for buyers and vendors.
 * - Exchanges authorization code for tokens
 * - Creates or links user account
 * - Creates session and redirects
 * 
 * RULES:
 * - OAuth is for buyers and vendors ONLY (admins use email/password)
 * - Does not auto-elevate roles
 * - Respects existing email uniqueness rules
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { handleGoogleCallbackServer } from '@/lib/db/dal/google-oauth-server';
import { createOrLinkOAuthUser, createSessionForUser } from '@/lib/db/dal/auth-service';
import { createAuditLog } from '@/lib/db/dal/audit';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      console.error('[GOOGLE_OAUTH] OAuth error:', error);
      return NextResponse.redirect(new URL(`/auth/login?error=${encodeURIComponent(error)}`, request.url));
    }

    if (!code) {
      return NextResponse.redirect(new URL('/auth/login?error=missing_code', request.url));
    }

    // Parse state to get role (buyer or vendor)
    let intendedRole: 'buyer' | 'vendor' = 'buyer';
    let returnUrl = '/';
    
    if (state) {
      try {
        const stateData = JSON.parse(decodeURIComponent(state));
        if (stateData.role === 'vendor') {
          intendedRole = 'vendor';
        }
        if (stateData.returnUrl) {
          returnUrl = stateData.returnUrl;
        }
      } catch {
        // Invalid state, use defaults
      }
    }

    // Exchange code for user info (using server-side function with database credentials)
    const googleResult = await handleGoogleCallbackServer(code);
    
    if (!googleResult.success || !googleResult.user) {
      console.error('[GOOGLE_OAUTH] Failed to get user info:', googleResult.error);
      return NextResponse.redirect(new URL(`/auth/login?error=${encodeURIComponent(googleResult.error || 'oauth_failed')}`, request.url));
    }

    const googleUser = googleResult.user;

    // Create or link user account
    const authResult = await createOrLinkOAuthUser({
      email: googleUser.email,
      name: googleUser.name,
      avatar: googleUser.picture,
      oauthProvider: 'google',
      oauthId: googleUser.id,
      intendedRole,
    });

    if (!authResult.success || !authResult.data) {
      console.error('[GOOGLE_OAUTH] Failed to create/link user:', authResult.error);
      const errorMessage = authResult.error?.message || 'account_error';
      return NextResponse.redirect(new URL(`/auth/login?error=${encodeURIComponent(errorMessage)}`, request.url));
    }

    const user = authResult.data.user;

    // Create session
    const sessionResult = await createSessionForUser(user.id, user.role);
    
    if (!sessionResult.success || !sessionResult.data) {
      console.error('[GOOGLE_OAUTH] Failed to create session:', sessionResult.error);
      return NextResponse.redirect(new URL('/auth/login?error=session_failed', request.url));
    }

    // Set session cookie
    const cookieStore = await cookies();
    cookieStore.set('session_token', sessionResult.data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    // Log OAuth login
    await createAuditLog({
      action: 'OAUTH_LOGIN',
      category: 'auth',
      targetId: user.id,
      targetType: 'user',
      targetName: user.email,
      details: JSON.stringify({
        provider: 'google',
        role: user.role,
        isNewUser: authResult.data.isNewUser,
      }),
      severity: 'info',
    });

    // Determine redirect URL based on role
    let redirectUrl = returnUrl;
    if (returnUrl === '/') {
      if (user.role === 'vendor') {
        redirectUrl = '/vendor';
      } else {
        redirectUrl = '/';
      }
    }

    return NextResponse.redirect(new URL(redirectUrl, request.url));
  } catch (error) {
    console.error('[GOOGLE_OAUTH] Callback error:', error);
    return NextResponse.redirect(new URL('/auth/login?error=internal_error', request.url));
  }
}
