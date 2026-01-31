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

function getBaseUrl(request: NextRequest): string {
  // Priority: NEXT_PUBLIC_APP_URL (production) > Replit domains (dev) > request origin (fallback)
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  const replitDomain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS;
  if (replitDomain) {
    return `https://${replitDomain}`;
  }
  return request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const baseUrl = getBaseUrl(request);
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      console.error('[GOOGLE_OAUTH] OAuth error:', error);
      return NextResponse.redirect(new URL(`/auth/login?error=${encodeURIComponent(error)}`, baseUrl));
    }

    if (!code) {
      return NextResponse.redirect(new URL('/auth/login?error=missing_code', baseUrl));
    }

    // Parse state to get role (buyer or vendor)
    let intendedRole: 'buyer' | 'vendor' = 'buyer';
    let returnUrl = '/';
    
    if (state) {
      try {
        // State is base64 encoded by GoogleSignInButton
        const decodedState = Buffer.from(state, 'base64').toString('utf-8');
        const stateData = JSON.parse(decodedState);
        if (stateData.role === 'vendor') {
          intendedRole = 'vendor';
        }
        if (stateData.returnUrl) {
          returnUrl = stateData.returnUrl;
        }
        console.log('[GOOGLE_OAUTH] Parsed state:', { mode: stateData.mode, role: stateData.role });
      } catch (stateError) {
        console.warn('[GOOGLE_OAUTH] Failed to parse state, using defaults:', stateError);
        // Invalid state, use defaults
      }
    }

    // Exchange code for user info (using server-side function with database credentials)
    const googleResult = await handleGoogleCallbackServer(code);
    
    if (!googleResult.success || !googleResult.user) {
      console.error('[GOOGLE_OAUTH] Failed to get user info:', googleResult.error);
      return NextResponse.redirect(new URL(`/auth/login?error=${encodeURIComponent(googleResult.error || 'oauth_failed')}`, baseUrl));
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
      return NextResponse.redirect(new URL(`/auth/login?error=${encodeURIComponent(errorMessage)}`, baseUrl));
    }

    const user = authResult.data.user;

    // Create session
    const sessionResult = await createSessionForUser(user.id, user.role);
    
    if (!sessionResult.success || !sessionResult.data) {
      console.error('[GOOGLE_OAUTH] Failed to create session:', sessionResult.error);
      return NextResponse.redirect(new URL('/auth/login?error=session_failed', baseUrl));
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

    return NextResponse.redirect(new URL(redirectUrl, baseUrl));
  } catch (error) {
    console.error('[GOOGLE_OAUTH] Callback error:', error);
    const errorBaseUrl = getBaseUrl(request);
    return NextResponse.redirect(new URL('/auth/login?error=internal_error', errorBaseUrl));
  }
}
