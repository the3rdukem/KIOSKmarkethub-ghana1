"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useGoogleOAuth, fetchPublicIntegrationStatus } from "@/lib/integrations-store";
import { getGoogleAuthUrl, isGoogleOAuthEnabled } from "@/lib/services/google-oauth";

interface GoogleSignInButtonProps {
  mode: "signin" | "signup";
  onSuccess?: (credential: string) => void;
  onError?: (error: string) => void;
  className?: string;
  disabled?: boolean;
  children?: React.ReactNode;
}

export function GoogleSignInButton({
  mode,
  onSuccess,
  onError,
  className,
  disabled,
  children,
}: GoogleSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [publicStatus, setPublicStatus] = useState<{ isEnabled: boolean; isReady: boolean } | null>(null);
  const [isStatusLoaded, setIsStatusLoaded] = useState(false);
  const { isEnabled: localEnabled, isReady: localReady } = useGoogleOAuth();

  // Fetch public status on mount
  useEffect(() => {
    fetchPublicIntegrationStatus().then((status) => {
      if (status.google_oauth) {
        setPublicStatus(status.google_oauth);
      }
      setIsStatusLoaded(true);
    }).catch(() => {
      setIsStatusLoaded(true);
    });
  }, []);

  // Use public status if available, otherwise fall back to local
  const isEnabled = publicStatus?.isEnabled ?? localEnabled;
  const isReady = publicStatus?.isReady ?? localReady;

  const handleClick = async () => {
    if (!isReady) {
      onError?.("Google Sign-In is not available at the moment");
      return;
    }

    setIsLoading(true);

    try {
      // Generate state parameter for CSRF protection
      const state = btoa(JSON.stringify({
        mode,
        timestamp: Date.now(),
        nonce: Math.random().toString(36).substring(2),
      }));

      // Store state for verification on callback
      sessionStorage.setItem("google_oauth_state", state);

      // Redirect to Google OAuth
      const authUrl = getGoogleAuthUrl(state);
      if (authUrl) {
        window.location.href = authUrl;
      } else {
        throw new Error("Failed to generate authentication URL");
      }
    } catch (error) {
      setIsLoading(false);
      onError?.(error instanceof Error ? error.message : "Authentication failed");
    }
  };

  // Show loading state until we know the status
  if (!isStatusLoaded) {
    return (
      <Button
        type="button"
        variant="outline"
        className={className}
        disabled
      >
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        Loading...
      </Button>
    );
  }

  // If Google OAuth is not configured, don't render the button
  if (!isEnabled) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      onClick={handleClick}
      disabled={disabled || isLoading || !isReady}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
      )}
      {children || (mode === "signin" ? "Sign in with Google" : "Sign up with Google")}
    </Button>
  );
}

/**
 * Fallback component when Google OAuth is not available
 * Use this in places where the Google button would normally appear
 */
export function GoogleAuthFallback() {
  const [publicStatus, setPublicStatus] = useState<{ isEnabled: boolean; isReady: boolean } | null>(null);
  const [isStatusLoaded, setIsStatusLoaded] = useState(false);
  const { isEnabled: localEnabled } = useGoogleOAuth();

  useEffect(() => {
    fetchPublicIntegrationStatus().then((status) => {
      if (status.google_oauth) {
        setPublicStatus(status.google_oauth);
      }
      setIsStatusLoaded(true);
    }).catch(() => {
      setIsStatusLoaded(true);
    });
  }, []);

  // Don't render until we know the status
  if (!isStatusLoaded) {
    return null;
  }

  const isEnabled = publicStatus?.isEnabled ?? localEnabled;

  if (isEnabled) {
    return null;
  }

  return (
    <div className="text-center py-2 text-sm text-muted-foreground">
      <p>Google Sign-In is currently unavailable.</p>
      <p>Please use email and password instead.</p>
    </div>
  );
}
