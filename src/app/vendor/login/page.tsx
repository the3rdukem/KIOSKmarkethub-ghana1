"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Store,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  Shield,
  CheckCircle,
  User,
  Building,
  Phone,
  MapPin
} from "lucide-react";
import { useAuthStore, loginViaAPI, registerViaAPI, getRouteForRole } from "@/lib/auth-store";
import { toast } from "sonner";

export default function VendorLoginPage() {
  const { isAuthenticated, user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [isHydrated, setIsHydrated] = useState(false);

  // Login state
  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
    rememberMe: false
  });

  // Registration state
  const [registerData, setRegisterData] = useState({
    shopName: "",
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    agreeTerms: false
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Mark as hydrated on mount
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Redirect if already authenticated as vendor
  // CRITICAL: Use window.location.href for HARD redirect to prevent chunk load errors
  useEffect(() => {
    if (isHydrated && isAuthenticated && user && user.role === 'vendor') {
      window.location.href = '/vendor';
    }
  }, [isHydrated, isAuthenticated, user]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!loginData.email.trim()) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(loginData.email)) newErrors.email = "Email is invalid";
    if (!loginData.password) newErrors.password = "Password is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      // Use unified API-based login
      const result = await loginViaAPI(loginData.email, loginData.password);

      if (!result.success) {
        setErrors({ submit: result.error || "Invalid email or password. Please try again." });
        setIsLoading(false);
        return;
      }

      // Check if user is a vendor - redirect to appropriate dashboard if not
      if (result.user?.role !== 'vendor') {
        toast.info("You've been logged in. Redirecting to your dashboard.");
        setTimeout(() => {
          window.location.href = getRouteForRole(result.user?.role || 'buyer');
        }, 500);
        return;
      }

      toast.success(`Welcome back, ${result.user.name}!`);

      // CRITICAL: Use window.location.href for HARD redirect
      setTimeout(() => {
        window.location.href = getRouteForRole("vendor");
      }, 500);
    } catch (error) {
      console.error('[VENDOR_LOGIN] Error:', error);
      setErrors({ submit: "Login failed. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!registerData.shopName.trim()) newErrors.shopName = "Shop name is required";
    if (!registerData.name.trim()) newErrors.name = "Name is required";
    if (!registerData.email.trim()) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(registerData.email)) newErrors.email = "Email is invalid";
    if (!registerData.phone.trim()) newErrors.phone = "Phone is required";
    if (!registerData.password) newErrors.password = "Password is required";
    else if (registerData.password.length < 6) newErrors.password = "Password must be at least 6 characters";
    if (registerData.password !== registerData.confirmPassword) newErrors.confirmPassword = "Passwords do not match";
    if (!registerData.agreeTerms) newErrors.agreeTerms = "You must agree to the terms";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      // Use API-based registration
      const result = await registerViaAPI({
        email: registerData.email,
        password: registerData.password,
        name: registerData.name,
        role: 'vendor',
        phone: registerData.phone,
        businessName: registerData.shopName,
      });

      if (!result.success) {
        setErrors({ submit: result.error || "Registration failed. Please try again." });
        setIsLoading(false);
        return;
      }

      toast.success("Registration successful! Please complete verification.");

      // CRITICAL: Use window.location.href for HARD redirect to prevent chunk load errors
      setTimeout(() => {
        window.location.href = "/vendor/verify";
      }, 500);
    } catch (error) {
      setErrors({ submit: "Registration failed. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/30 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-100/40 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-indigo-100/40 rounded-full blur-3xl" />
      </div>
      <div className="max-w-md w-full space-y-8 relative z-10">
        {/* Header */}
        <div className="text-center">
          <Link href="/" className="flex items-center justify-center space-x-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
              <Store className="w-5 h-5" />
            </div>
            <span className="font-bold text-xl">KIOSK Vendor</span>
          </Link>
          <h2 className="text-3xl font-bold text-gray-900">
            {activeTab === "login" ? "Welcome Back" : "Become a Vendor"}
          </h2>
          <p className="mt-2 text-gray-600">
            {activeTab === "login"
              ? "Sign in to your vendor account"
              : "Join our marketplace and start selling"
            }
          </p>
        </div>

        {/* Verification Notice - Enhanced */}
        <Alert className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Shield className="h-5 w-5 text-blue-600" />
            </div>
            <AlertDescription className="text-blue-800">
              <strong className="text-blue-900">Verified Vendor Program:</strong> All vendors undergo ID and facial recognition verification for marketplace security.
            </AlertDescription>
          </div>
        </Alert>

        {/* Main Form */}
        <Card>
          <CardContent className="p-6">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "login" | "register")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Sign In</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>

              {/* Login Tab */}
              <TabsContent value="login" className="mt-6">
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="loginEmail">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        id="loginEmail"
                        type="email"
                        value={loginData.email}
                        onChange={(e) => setLoginData({...loginData, email: e.target.value})}
                        className={`pl-10 ${errors.email ? "border-red-500" : ""}`}
                        placeholder="vendor@example.com"
                      />
                    </div>
                    {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                  </div>

                  <div>
                    <Label htmlFor="loginPassword">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        id="loginPassword"
                        type={showPassword ? "text" : "password"}
                        value={loginData.password}
                        onChange={(e) => setLoginData({...loginData, password: e.target.value})}
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
                        checked={loginData.rememberMe}
                        onCheckedChange={(checked) => setLoginData({...loginData, rememberMe: !!checked})}
                      />
                      <label htmlFor="rememberMe" className="text-sm text-gray-600">
                        Remember me
                      </label>
                    </div>
                    <Link href="/auth/forgot-password" className="text-sm text-blue-600 hover:underline">
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

                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
                    {isLoading ? "Signing In..." : "Sign In"}
                  </Button>
                </form>
              </TabsContent>

              {/* Registration Tab */}
              <TabsContent value="register" className="mt-6">
                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="shopName">Shop Name</Label>
                    <div className="relative">
                      <Store className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        id="shopName"
                        type="text"
                        value={registerData.shopName}
                        onChange={(e) => setRegisterData({...registerData, shopName: e.target.value})}
                        className={`pl-10 ${errors.shopName ? "border-red-500" : ""}`}
                        placeholder="Your Shop Name"
                      />
                    </div>
                    {errors.shopName && <p className="text-red-500 text-xs mt-1">{errors.shopName}</p>}
                  </div>

                  <div>
                    <Label htmlFor="registerName">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        id="registerName"
                        type="text"
                        value={registerData.name}
                        onChange={(e) => setRegisterData({...registerData, name: e.target.value})}
                        className={`pl-10 ${errors.name ? "border-red-500" : ""}`}
                        placeholder="John Doe"
                      />
                    </div>
                    {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                  </div>

                  <div>
                    <Label htmlFor="registerEmail">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        id="registerEmail"
                        type="email"
                        value={registerData.email}
                        onChange={(e) => setRegisterData({...registerData, email: e.target.value})}
                        className={`pl-10 ${errors.email ? "border-red-500" : ""}`}
                        placeholder="vendor@example.com"
                      />
                    </div>
                    {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                  </div>

                  <div>
                    <Label htmlFor="registerPhone">Phone Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        id="registerPhone"
                        type="tel"
                        value={registerData.phone}
                        onChange={(e) => setRegisterData({...registerData, phone: e.target.value})}
                        className={`pl-10 ${errors.phone ? "border-red-500" : ""}`}
                        placeholder="+233 24 123 4567"
                      />
                    </div>
                    {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                  </div>

                  <div>
                    <Label htmlFor="registerPassword">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        id="registerPassword"
                        type={showPassword ? "text" : "password"}
                        value={registerData.password}
                        onChange={(e) => setRegisterData({...registerData, password: e.target.value})}
                        className={`pl-10 pr-10 ${errors.password ? "border-red-500" : ""}`}
                        placeholder="Create password"
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

                  <div>
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={registerData.confirmPassword}
                        onChange={(e) => setRegisterData({...registerData, confirmPassword: e.target.value})}
                        className={`pl-10 pr-10 ${errors.confirmPassword ? "border-red-500" : ""}`}
                        placeholder="Confirm password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
                  </div>

                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="agreeTerms"
                      checked={registerData.agreeTerms}
                      onCheckedChange={(checked) => setRegisterData({...registerData, agreeTerms: !!checked})}
                    />
                    <label htmlFor="agreeTerms" className="text-sm leading-relaxed">
                      I agree to the{" "}
                      <Link href="/terms" className="text-blue-600 hover:underline">
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link href="/privacy" className="text-blue-600 hover:underline">
                        Privacy Policy
                      </Link>
                    </label>
                  </div>
                  {errors.agreeTerms && <p className="text-red-500 text-xs">{errors.agreeTerms}</p>}

                  {errors.submit && (
                    <Alert className="border-red-200 bg-red-50">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-800">
                        {errors.submit}
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
                    {isLoading ? "Creating Account..." : "Register & Verify"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Verification Process Info */}
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-green-800 text-sm">Next: Verification Process</h4>
                <p className="text-green-700 text-xs mt-1">
                  After registration, you'll complete ID verification and facial recognition to ensure marketplace security.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Back to Homepage */}
        <div className="text-center">
          <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
            ← Back to KIOSK
          </Link>
        </div>
      </div>
    </div>
  );
}
