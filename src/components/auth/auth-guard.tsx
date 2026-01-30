"use client";

import { useEffect, useState, ReactNode, useCallback } from "react";
import { useAuthStore, syncAuthWithServer, UserRole } from "@/lib/auth-store";
import { Loader2, Shield, Lock, Store, User } from "lucide-react";

/**
 * AuthGuard Component
 *
 * This component wraps protected page content and handles:
 * 1. Session sync with server
 * 2. Auth validation
 * 3. Role validation
 * 4. Redirects for unauthorized users
 *
 * CRITICAL: All redirects use window.location.href to prevent chunk load errors.
 */

interface AuthGuardProps {
  children: ReactNode;
  requiredRoles?: UserRole[];
  loginPath?: string;
  loadingMessage?: string;
  portalType?: "vendor" | "admin" | "buyer";
}

// Loading states for different portals
function LoadingState({ portalType, message }: { portalType: string; message?: string }) {
  const configs = {
    vendor: { bg: "from-emerald-50 to-teal-50", iconBg: "bg-emerald-100", iconColor: "text-emerald-600", icon: Store, title: "Loading Vendor Portal" },
    admin: { bg: "from-purple-50 to-indigo-50", iconBg: "bg-purple-100", iconColor: "text-purple-600", icon: Shield, title: "Loading Admin Portal" },
    buyer: { bg: "from-green-50 to-emerald-50", iconBg: "bg-green-100", iconColor: "text-green-600", icon: User, title: "Loading Dashboard" },
  };

  const config = configs[portalType as keyof typeof configs] || configs.buyer;
  const Icon = config.icon;

  return (
    <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br ${config.bg}`}>
      <div className="text-center">
        <div className={`w-16 h-16 ${config.iconBg} rounded-full flex items-center justify-center mx-auto mb-4`}>
          <Loader2 className={`w-8 h-8 ${config.iconColor} animate-spin`} />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">{config.title}</h2>
        <p className="text-sm text-muted-foreground">{message || "Verifying session..."}</p>
      </div>
    </div>
  );
}

// Unauthorized states
function UnauthorizedState({ portalType, redirectPath }: { portalType: string; redirectPath: string }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      window.location.href = redirectPath;
    }, 100);
    return () => clearTimeout(timer);
  }, [redirectPath]);

  const configs = {
    vendor: { bg: "from-emerald-50 to-teal-50", iconBg: "bg-amber-100", iconColor: "text-amber-600", title: "Vendor Access Required" },
    admin: { bg: "from-purple-50 to-indigo-50", iconBg: "bg-red-100", iconColor: "text-red-600", title: "Admin Access Required" },
    buyer: { bg: "from-green-50 to-emerald-50", iconBg: "bg-amber-100", iconColor: "text-amber-600", title: "Login Required" },
  };

  const config = configs[portalType as keyof typeof configs] || configs.buyer;

  return (
    <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br ${config.bg}`}>
      <div className="text-center">
        <div className={`w-16 h-16 ${config.iconBg} rounded-full flex items-center justify-center mx-auto mb-4`}>
          <Lock className={`w-8 h-8 ${config.iconColor}`} />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">{config.title}</h2>
        <p className="text-sm text-muted-foreground">Redirecting to login...</p>
      </div>
    </div>
  );
}

export function AuthGuard({
  children,
  requiredRoles,
  loginPath,
  loadingMessage,
  portalType = "buyer",
}: AuthGuardProps) {
  const [state, setState] = useState<"loading" | "authorized" | "unauthorized">("loading");
  const [redirectTarget, setRedirectTarget] = useState<string | null>(null);

  // Determine default login path based on portal type
  const defaultLoginPath = {
    vendor: "/vendor/login",
    admin: "/admin/login",
    buyer: "/auth/login",
  }[portalType];

  const redirectPath = loginPath || defaultLoginPath;

  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      // Sync with server first
      const user = await syncAuthWithServer();

      if (!mounted) return;

      // Not authenticated
      if (!user) {
        setState("unauthorized");
        return;
      }

      // Check role requirements
      if (requiredRoles && requiredRoles.length > 0) {
        const userRole = user.role;
        const adminRole = (user as { adminRole?: string }).adminRole;

        const hasRequiredRole = requiredRoles.some((role) => {
          if (role === "admin" || role === "master_admin") {
            return userRole === "admin" || userRole === "master_admin" || adminRole === "ADMIN" || adminRole === "MASTER_ADMIN";
          }
          return userRole === role;
        });

        if (!hasRequiredRole) {
          // Redirect to correct dashboard based on role
          const roleRedirects: Record<string, string> = {
            vendor: "/vendor",
            admin: "/admin",
            master_admin: "/admin",
            buyer: "/buyer/dashboard",
          };
          setRedirectTarget(roleRedirects[userRole] || "/");
          setState("unauthorized");
          return;
        }
      }

      // Authorized
      setState("authorized");
    }

    checkAuth();

    return () => {
      mounted = false;
    };
  }, [requiredRoles]);

  // Handle redirect
  useEffect(() => {
    if (redirectTarget) {
      window.location.href = redirectTarget;
    }
  }, [redirectTarget]);

  // Loading state
  if (state === "loading") {
    return <LoadingState portalType={portalType} message={loadingMessage} />;
  }

  // Unauthorized state (will redirect)
  if (state === "unauthorized") {
    return <UnauthorizedState portalType={portalType} redirectPath={redirectTarget || redirectPath} />;
  }

  // Authorized - render children
  return <>{children}</>;
}

/**
 * Convenience wrappers for specific portals
 */
export function VendorAuthGuard({ children }: { children: ReactNode }) {
  return (
    <AuthGuard requiredRoles={["vendor"]} portalType="vendor">
      {children}
    </AuthGuard>
  );
}

export function AdminAuthGuard({ children }: { children: ReactNode }) {
  return (
    <AuthGuard requiredRoles={["admin", "master_admin"]} portalType="admin">
      {children}
    </AuthGuard>
  );
}

export function BuyerAuthGuard({ children }: { children: ReactNode }) {
  return (
    <AuthGuard requiredRoles={["buyer"]} portalType="buyer">
      {children}
    </AuthGuard>
  );
}
