"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Shield, Lock, Mail, AlertTriangle, Eye, EyeOff, ShieldCheck, Loader2 } from "lucide-react";
import { useAuthStore, adminLoginViaAPI } from "@/lib/auth-store";
import { toast } from "sonner";

export default function AdminLoginPage() {
  // Hydration state
  const [isHydrated, setIsHydrated] = useState(false);

  // Get auth state safely
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutTimer, setLockoutTimer] = useState(0);

  // Mark as hydrated on mount
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Redirect if already authenticated as admin (only after hydration)
  // CRITICAL: Use window.location.href for HARD redirect to prevent chunk load errors
  useEffect(() => {
    if (isHydrated && isAuthenticated && user && (user.role === 'admin' || user.role === 'master_admin')) {
      console.log('[ADMIN_LOGIN] Already authenticated as admin, redirecting...');
      window.location.href = '/admin';
    }
  }, [isHydrated, isAuthenticated, user]);

  // Lockout timer
  useEffect(() => {
    if (lockoutTimer > 0) {
      const timer = setTimeout(() => {
        setLockoutTimer(lockoutTimer - 1);
        if (lockoutTimer === 1) {
          setIsLocked(false);
          setLoginAttempts(0);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [lockoutTimer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (isLocked) {
      setError(`Too many failed attempts. Try again in ${lockoutTimer} seconds.`);
      return;
    }

    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }

    setIsLoading(true);
    console.log('[ADMIN_LOGIN] Attempting login for:', email);

    try {
      // Use API-based admin authentication
      const result = await adminLoginViaAPI(email, password);

      console.log('[ADMIN_LOGIN] API response:', { success: result.success, hasAdmin: !!result.admin });

      if (!result.success) {
        setLoginAttempts(prev => prev + 1);

        // Lock after 5 failed attempts
        if (loginAttempts >= 4) {
          setIsLocked(true);
          setLockoutTimer(60); // 60 second lockout
          setError("Too many failed attempts. Account locked for 60 seconds.");
        } else {
          setError(result.error || "Invalid credentials");
        }
        setIsLoading(false);
        return;
      }

      const admin = result.admin!;
      console.log('[ADMIN_LOGIN] Login successful for:', admin.email, 'role:', admin.role);

      toast.success(`Welcome, ${admin.name}!`, {
        description: admin.adminRole === 'MASTER_ADMIN'
          ? 'Logged in as Master Administrator'
          : 'Logged in as Administrator'
      });

      // CRITICAL: Use window.location.href for HARD redirect to prevent chunk load errors
      // Wait a bit to ensure cookies are set
      console.log('[ADMIN_LOGIN] Redirecting to /admin...');
      setTimeout(() => {
        window.location.href = '/admin';
      }, 500);
    } catch (err) {
      console.error('[ADMIN_LOGIN] Error:', err);
      setError("An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center space-x-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
            <div>
              <span className="font-bold text-2xl text-white">KIOSK</span>
              <Badge variant="outline" className="ml-2 border-amber-500 text-amber-400">
                Admin
              </Badge>
            </div>
          </div>
          <h2 className="text-3xl font-bold text-white">Administrator Access</h2>
          <p className="mt-2 text-slate-400">
            Secure login for platform administrators
          </p>
        </div>

        {/* Security Notice */}
        <Alert className="bg-slate-800/50 border-slate-700">
          <Shield className="h-4 w-4 text-blue-400" />
          <AlertDescription className="text-slate-300">
            This is a restricted area. All login attempts are monitored and logged for security purposes.
          </AlertDescription>
        </Alert>

        {/* Login Form */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Sign In
            </CardTitle>
            <CardDescription className="text-slate-400">
              Enter your administrator credentials
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-slate-300">Email Address</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-slate-700/50 border-slate-600 text-white placeholder-slate-500 focus:border-green-500"
                    placeholder="admin@kiosk.com.gh"
                    disabled={isLocked || isLoading}
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="password" className="text-slate-300">Password</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 bg-slate-700/50 border-slate-600 text-white placeholder-slate-500 focus:border-green-500"
                    placeholder="Enter your password"
                    disabled={isLocked || isLoading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    disabled={isLocked}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <Alert className="bg-red-900/30 border-red-800">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                  <AlertDescription className="text-red-300">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              {isLocked && (
                <Alert className="bg-amber-900/30 border-amber-800">
                  <Lock className="h-4 w-4 text-amber-400" />
                  <AlertDescription className="text-amber-300">
                    Account temporarily locked. Please wait {lockoutTimer} seconds.
                  </AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                disabled={isLocked || isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    Sign In
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Security Info */}
        <div className="text-center space-y-2">
          <p className="text-sm text-slate-500">
            Protected by enterprise-grade security
          </p>
          <div className="flex items-center justify-center gap-4 text-xs text-slate-600">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Encrypted
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Monitored
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Logged
            </span>
          </div>
        </div>

        {/* Return Link */}
        <div className="text-center">
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
            ← Return to Marketplace
          </Link>
        </div>
      </div>
    </div>
  );
}
