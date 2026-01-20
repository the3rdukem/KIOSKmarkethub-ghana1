"use client";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  User,
  Store,
  Shield,
  Loader2
} from "lucide-react";
import { useAuthStore, loginViaAPI, getRouteForRole, mergeCartAfterAuth, type UserRole } from "@/lib/auth-store";
import { toast } from "sonner";
import { GoogleSignInButton, GoogleAuthFallback } from "@/components/integrations/google-sign-in-button";
import { Separator } from "@/components/ui/separator";
import { getSafeRedirectUrl } from "@/lib/utils/safe-redirect";

const VALID_ROLES: UserRole[] = ['buyer', 'vendor', 'admin', 'master_admin'];

function resolveRole(role?: string): UserRole {
  if (role && VALID_ROLES.includes(role as UserRole)) {
    return role as UserRole;
  }
  return 'buyer';
}

function LoginPageContent() {
  const [isHydrated, setIsHydrated] = useState(false);
  const searchParams = useSearchParams();
  const redirectUrl = getSafeRedirectUrl(searchParams.get('redirect'));

  // Get auth state safely
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Mark as hydrated on mount
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Helper to get redirect destination
  const getRedirectDestination = (role: UserRole) => {
    // If there's a redirect URL in query params, use it
    if (redirectUrl) {
      return redirectUrl;
    }
    // Otherwise use role-based default
    return getRouteForRole(role);
  };

  // Redirect if already authenticated (only after hydration)
  useEffect(() => {
    if (isHydrated && isAuthenticated && user) {
      window.location.href = getRedirectDestination(user.role);
    }
  }, [isHydrated, isAuthenticated, user, redirectUrl]);

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = "Email is invalid";
    if (!formData.password) newErrors.password = "Password is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      // Use API-based login
      const result = await loginViaAPI(formData.email, formData.password);

      if (!result.success) {
        // Display exact server error message
        setErrors({ submit: result.error || "Invalid email or password" });
        setIsLoading(false);
        return;
      }

      toast.success(`Welcome back, ${result.user?.name}!`);

      // Merge guest cart before redirecting (important for checkout flow)
      await mergeCartAfterAuth();

      // Redirect to specified URL or role-based default
      window.location.href = getRedirectDestination(resolveRole(result.user?.role));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Login failed";
      setErrors({ submit: errorMessage });
      setIsLoading(false);
    }
  };

  // Quick login helpers for testing (fills form only)
  const handleQuickLogin = (email: string) => {
    setFormData({ email, password: "password123", rememberMe: true });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <Link href="/" className="flex items-center justify-center space-x-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center text-white font-bold">
              MH
            </div>
            <span className="font-bold text-xl">MarketHub</span>
          </Link>
          <h2 className="text-3xl font-bold text-gray-900">Welcome Back</h2>
          <p className="mt-2 text-gray-600">
            Sign in to your MarketHub account
          </p>
        </div>

        {/* Login Form */}
        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    className={`pl-10 ${errors.email ? "border-red-500" : ""}`}
                    placeholder="Enter your email"
                  />
                </div>
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    className={`pl-10 pr-10 ${errors.password ? "border-red-500" : ""}`}
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="rememberMe"
                    checked={formData.rememberMe}
                    onCheckedChange={(checked) => handleInputChange("rememberMe", !!checked)}
                  />
                  <label htmlFor="rememberMe" className="text-sm text-gray-600">
                    Remember me
                  </label>
                </div>
                <Link href="/forgot-password" className="text-sm text-blue-600 hover:underline">
                  Forgot password?
                </Link>
              </div>

              {errors.submit && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    {errors.submit}
                  </AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Signing In..." : "Sign In"}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>

              <GoogleSignInButton
                mode="signin"
                className="w-full"
                onSuccess={(credential) => {
                  toast.success("Google Sign-In successful!");
                }}
                onError={(error) => {
                  toast.error(error);
                }}
              />
              <GoogleAuthFallback />
            </form>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-800 text-sm">Getting Started</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-blue-700">
              New to MarketHub? Create an account to start shopping or selling.
            </p>
            <p className="text-xs text-blue-700">
              For admin access, use the <Link href="/admin/login" className="underline">Admin Login</Link>.
            </p>
          </CardContent>
        </Card>

        {/* Register Link */}
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Don't have an account?{" "}
            <Link href="/auth/register" className="text-blue-600 hover:underline font-semibold">
              Create one here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
