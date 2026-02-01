"use client";

import { useState, Suspense, useRef, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Store,
  Shield,
  Mail,
  Lock,
  Phone,
  MapPin,
  Building,
  CheckCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  Loader2,
  ArrowLeft
} from "lucide-react";
import { toast } from "sonner";
import { registerViaAPI, getRouteForRole, type UserRole } from "@/lib/auth-store";
import { GoogleSignInButton, GoogleAuthFallback } from "@/components/integrations/google-sign-in-button";
import { AddressAutocomplete } from "@/components/integrations/address-autocomplete";
import { Separator } from "@/components/ui/separator";
import { getSafeRedirectUrl } from "@/lib/utils/safe-redirect";
import { GHANA_REGIONS } from "@/lib/constants/ghana-locations";

function RegisterPageContent() {
  const searchParams = useSearchParams();
  const redirectUrl = getSafeRedirectUrl(searchParams.get('redirect'));
  const [userType, setUserType] = useState<"buyer" | "vendor">("buyer");
  const [authMethod, setAuthMethod] = useState<"phone" | "email">("phone");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    businessName: "",
    businessType: "",
    region: "",
    city: "",
    address: "",
    agreeTerms: false,
    agreeMarketing: false
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  
  const [showOtpVerification, setShowOtpVerification] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [maskedPhone, setMaskedPhone] = useState("");
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpAttemptsRemaining, setOtpAttemptsRemaining] = useState(5);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  useEffect(() => {
    if (otpCooldown > 0) {
      const timer = setTimeout(() => setOtpCooldown(otpCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpCooldown]);

  const businessTypes = [
    "Individual Seller", "Small Business", "Medium Enterprise", "Corporation",
    "Manufacturer", "Wholesaler", "Retailer", "Service Provider"
  ];

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) newErrors.firstName = "First name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";
    
    if (authMethod === "email") {
      if (!formData.email.trim()) newErrors.email = "Email is required";
      else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = "Email is invalid";
    }
    
    if (authMethod === "phone") {
      const cleanedPhone = formData.phone.replace(/\D/g, "");
      if (!cleanedPhone) newErrors.phone = "Phone number is required";
      else if (cleanedPhone.length !== 10 || !cleanedPhone.startsWith("0")) {
        newErrors.phone = "Please enter a valid 10-digit Ghana phone number starting with 0";
      }
    } else {
      if (!formData.phone.trim()) newErrors.phone = "Phone number is required";
    }

    if (!formData.password) newErrors.password = "Password is required";
    else {
      const passwordChecks = [];
      if (formData.password.length < 8) passwordChecks.push("at least 8 characters");
      if (!/[A-Z]/.test(formData.password)) passwordChecks.push("one uppercase letter");
      if (!/[a-z]/.test(formData.password)) passwordChecks.push("one lowercase letter");
      if (!/[0-9]/.test(formData.password)) passwordChecks.push("one number");
      if (passwordChecks.length > 0) {
        newErrors.password = `Password must contain ${passwordChecks.join(", ")}`;
      }
    }
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = "Passwords do not match";
    if (!formData.region) newErrors.region = "Region is required";
    if (!formData.city.trim()) newErrors.city = "City is required";
    if (!formData.agreeTerms) newErrors.agreeTerms = "You must agree to the terms and conditions";

    if (userType === "vendor") {
      if (!formData.businessName.trim()) newErrors.businessName = "Business name is required";
      if (!formData.businessType) newErrors.businessType = "Business type is required";
      if (!formData.address.trim()) newErrors.address = "Business address is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      if (authMethod === "phone") {
        const response = await fetch("/api/auth/otp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: formData.phone }),
        });
        
        const data = await response.json();
        
        if (!data.success) {
          if (data.cooldownRemaining) {
            setOtpCooldown(data.cooldownRemaining);
          }
          setErrors({ submit: data.error || "Failed to send verification code" });
          setIsLoading(false);
          return;
        }
        
        setMaskedPhone(data.message?.match(/\+\d+\*+\d+/)?.[0] || formData.phone);
        setShowOtpVerification(true);
        setOtp(["", "", "", "", "", ""]);
        setOtpAttemptsRemaining(5);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
        setIsLoading(false);
        return;
      }
      
      const fullName = `${formData.firstName} ${formData.lastName}`;
      const location = `${formData.city}, ${formData.region}`;

      const result = await registerViaAPI({
        email: formData.email,
        password: formData.password,
        name: fullName,
        role: userType,
        phone: formData.phone,
        location: location,
        businessName: userType === "vendor" ? formData.businessName : undefined,
        businessType: userType === "vendor" ? formData.businessType : undefined,
        address: userType === "vendor" ? formData.address : undefined,
      });

      if (!result.success) {
        // Map server field errors to client field names
        const fieldMap: Record<string, string> = {
          'email': 'email',
          'firstName': 'firstName',
          'lastName': 'lastName',
          'name': 'firstName',
          'phone': 'phone',
          'city': 'city',
          'location': 'city',
          'businessName': 'businessName',
          'storeName': 'businessName',
          'address': 'address',
        };
        
        // Check if server returned a specific field
        const serverField = result.field as string | undefined;
        const clientField = serverField ? (fieldMap[serverField] || serverField) : null;
        
        if (clientField) {
          // Field-specific error - set error on that field only (no toast)
          setErrors({ [clientField]: result.error || "Invalid value" });
          // Auto-scroll and focus on the failing field
          setTimeout(() => {
            const errorInput = document.getElementById(clientField) as HTMLInputElement;
            if (errorInput) {
              errorInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
              errorInput.focus();
            }
          }, 100);
        } else if (result.code === 'EMAIL_EXISTS') {
          setErrors({ email: "This email is already registered" });
        } else if (result.code === 'PHONE_ALREADY_IN_USE') {
          setErrors({ phone: result.error || "This phone number is already in use" });
        } else {
          // Generic error - show as submit error (no toast spam)
          setErrors({ submit: result.error || "Registration failed" });
        }
        setIsLoading(false);
        return;
      }

      // Success - single toast only
      toast.success(`Welcome to KIOSK, ${formData.firstName}!`);

      if (userType === "vendor") {
        setTimeout(() => {
          window.location.href = "/vendor/verify";
        }, 500);
      } else {
        // Redirect to specified URL or buyer dashboard
        setTimeout(() => {
          window.location.href = redirectUrl || getRouteForRole("buyer");
        }, 500);
      }
    } catch (error) {
      console.error('[REGISTER] Error:', error);
      const errorMessage = error instanceof Error ? error.message : "Registration failed";
      setErrors({ submit: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    setErrors({});

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    if (newOtp.every(d => d) && newOtp.join("").length === 6) {
      handleVerifyOTP(newOtp.join(""));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pastedData.length === 6) {
      const newOtp = pastedData.split("");
      setOtp(newOtp);
      handleVerifyOTP(pastedData);
    }
  };

  const handleVerifyOTP = async (otpCode: string) => {
    setIsLoading(true);
    setErrors({});

    try {
      const response = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formData.phone, otp: otpCode }),
      });

      const data = await response.json();

      if (!data.success) {
        if (data.attemptsRemaining !== undefined) {
          setOtpAttemptsRemaining(data.attemptsRemaining);
        }
        setErrors({ submit: data.error });
        setOtp(["", "", "", "", "", ""]);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
        setIsLoading(false);
        return;
      }

      const fullName = `${formData.firstName} ${formData.lastName}`;
      const location = `${formData.city}, ${formData.region}`;

      const regResponse = await fetch("/api/auth/phone/complete-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: formData.phone,
          password: formData.password,
          name: fullName,
          role: userType,
          location: location,
          businessName: userType === "vendor" ? formData.businessName : undefined,
          businessType: userType === "vendor" ? formData.businessType : undefined,
          address: userType === "vendor" ? formData.address : undefined,
        }),
      });

      const regData = await regResponse.json();

      if (!regData.success) {
        setErrors({ submit: regData.error || "Registration failed" });
        setIsLoading(false);
        return;
      }

      toast.success(`Welcome to KIOSK, ${formData.firstName}!`);

      if (userType === "vendor") {
        setTimeout(() => {
          window.location.href = "/vendor/verify";
        }, 500);
      } else {
        setTimeout(() => {
          window.location.href = redirectUrl || getRouteForRole("buyer");
        }, 500);
      }
    } catch (error) {
      console.error('[REGISTER] OTP verification error:', error);
      setErrors({ submit: "Verification failed. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (otpCooldown > 0) return;
    
    setIsLoading(true);
    setErrors({});

    try {
      const response = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formData.phone }),
      });

      const data = await response.json();

      if (!data.success) {
        if (data.cooldownRemaining) {
          setOtpCooldown(data.cooldownRemaining);
        }
        setErrors({ submit: data.error });
      } else {
        setOtp(["", "", "", "", "", ""]);
        setOtpAttemptsRemaining(5);
        setOtpCooldown(60);
        toast.success("Verification code sent!");
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
      }
    } catch (error) {
      setErrors({ submit: "Failed to resend code. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  if (showOtpVerification) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <Link href="/" className="flex items-center justify-center space-x-2 mb-6">
              <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center text-white font-bold">
                K
              </div>
              <span className="font-bold text-xl">KIOSK</span>
            </Link>
            <h2 className="text-3xl font-bold text-gray-900">Verify Your Phone</h2>
          </div>

          <Card>
            <CardContent className="pt-6 space-y-6">
              <button
                type="button"
                onClick={() => setShowOtpVerification(false)}
                className="flex items-center text-sm text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back to registration
              </button>

              <div className="text-center">
                <p className="text-sm text-gray-600">
                  Enter the 6-digit code sent to
                </p>
                <p className="font-medium">{maskedPhone}</p>
              </div>

              <div className="flex justify-center gap-2">
                {otp.map((digit, index) => (
                  <Input
                    key={index}
                    ref={(el) => { otpRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    onPaste={handleOtpPaste}
                    className={`w-12 h-12 text-center text-xl font-semibold ${errors.submit ? "border-red-500" : ""}`}
                    disabled={isLoading}
                  />
                ))}
              </div>

              {errors.submit && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    {errors.submit}
                    {otpAttemptsRemaining > 0 && otpAttemptsRemaining < 5 && (
                      <span className="block mt-1 text-xs">
                        {otpAttemptsRemaining} attempt{otpAttemptsRemaining !== 1 ? "s" : ""} remaining
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {isLoading && (
                <div className="flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-green-600" />
                </div>
              )}

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={otpCooldown > 0 || isLoading}
                  className={`text-sm ${otpCooldown > 0 ? "text-gray-400" : "text-blue-600 hover:underline"}`}
                >
                  {otpCooldown > 0 ? `Resend code in ${otpCooldown}s` : "Resend code"}
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <Link href="/" className="flex items-center justify-center space-x-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center text-white font-bold">
              K
            </div>
            <span className="font-bold text-xl">KIOSK</span>
          </Link>
          <h2 className="text-3xl font-bold text-gray-900">Join KIOSK</h2>
          <p className="mt-2 text-gray-600">
            Create your account to start {userType === "buyer" ? "shopping" : "selling"} today
          </p>
        </div>

        {/* Account Type Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-center">Choose Account Type</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={userType} onValueChange={(value) => setUserType(value as "buyer" | "vendor")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="buyer" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Buyer
                </TabsTrigger>
                <TabsTrigger value="vendor" className="flex items-center gap-2">
                  <Store className="w-4 h-4" />
                  Vendor
                </TabsTrigger>
              </TabsList>

              {/* Enhanced Account Type Cards */}
              <div className="mt-4 p-5 rounded-xl border-2 transition-all duration-300" 
                   style={{ 
                     background: userType === "buyer" 
                       ? "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)" 
                       : "linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)",
                     borderColor: userType === "buyer" ? "#93C5FD" : "#6EE7B7"
                   }}>
                {userType === "buyer" ? (
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <User className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-base text-blue-900">Buyer Account</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        Shop from verified vendors, track orders, and enjoy buyer protection
                      </p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Secure Payments
                        </Badge>
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs">
                          <Shield className="w-3 h-3 mr-1" />
                          Buyer Protected
                        </Badge>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Store className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-base text-green-900">Vendor Account</h4>
                      <p className="text-sm text-green-700 mt-1">
                        Start selling your products to thousands of buyers across Ghana
                      </p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                          <Shield className="w-3 h-3 mr-1" />
                          ID Verification
                        </Badge>
                        <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Verified Badge
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Tabs>
          </CardContent>
        </Card>

        {/* Registration Form */}
        <Card>
          <CardHeader>
            <CardTitle>Create Account</CardTitle>
            <CardDescription>
              {userType === "vendor"
                ? "After registration, you'll go through our verification process"
                : "Fill in your details to create your buyer account"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={authMethod} onValueChange={(v) => setAuthMethod(v as "phone" | "email")} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="phone" className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Phone
                </TabsTrigger>
                <TabsTrigger value="email" className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="phone">
              </TabsContent>
              
              <TabsContent value="email">
              </TabsContent>
            </Tabs>
            
            <div className="mt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Personal Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange("firstName", e.target.value)}
                    className={errors.firstName ? "border-red-500" : ""}
                    placeholder="John"
                  />
                  {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange("lastName", e.target.value)}
                    className={errors.lastName ? "border-red-500" : ""}
                    placeholder="Asante"
                  />
                  {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
                </div>
              </div>

              {authMethod === "phone" ? (
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
                      className={`pl-10 ${errors.phone ? "border-red-500" : ""}`}
                      placeholder="024 XXX XXXX"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Enter your 10-digit Ghana phone number</p>
                  {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                </div>
              ) : (
                <>
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
                        placeholder="john@example.com"
                      />
                    </div>
                    {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                  </div>

                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => handleInputChange("phone", e.target.value)}
                        className={`pl-10 ${errors.phone ? "border-red-500" : ""}`}
                        placeholder="+233 24 123 4567"
                      />
                    </div>
                    {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                  </div>
                </>
              )}

              {/* Location - City autocomplete with Google Places */}
              <div>
                <AddressAutocomplete
                  id="city"
                  label="City / Town"
                  placeholder="Start typing your city or town..."
                  value={formData.city}
                  onValueChange={(value) => handleInputChange("city", value)}
                  onAddressSelect={(details) => {
                    handleInputChange("city", details.city || details.name || details.formattedAddress);
                    if (details.region) {
                      const matchedRegion = GHANA_REGIONS.find(r => 
                        r.toLowerCase().includes(details.region!.toLowerCase()) ||
                        details.region!.toLowerCase().includes(r.replace(" Region", "").toLowerCase())
                      );
                      if (matchedRegion) {
                        handleInputChange("region", matchedRegion);
                      } else {
                        handleInputChange("region", details.region);
                      }
                    }
                  }}
                  showCurrentLocation={false}
                  types={["(cities)"]}
                  required
                  error={errors.city}
                />
              </div>

              <div>
                <Label htmlFor="region">Region</Label>
                <Select value={formData.region} onValueChange={(value) => handleInputChange("region", value)}>
                  <SelectTrigger className={errors.region ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select or auto-filled from city" />
                  </SelectTrigger>
                  <SelectContent>
                    {GHANA_REGIONS.map((region) => (
                      <SelectItem key={region} value={region}>{region}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.region && <p className="text-red-500 text-xs mt-1">{errors.region}</p>}
              </div>

              {/* Vendor-specific fields */}
              {userType === "vendor" && (
                <>
                  <div>
                    <Label htmlFor="businessName">Business Name</Label>
                    <div className="relative">
                      <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        id="businessName"
                        type="text"
                        value={formData.businessName}
                        onChange={(e) => handleInputChange("businessName", e.target.value)}
                        className={`pl-10 ${errors.businessName ? "border-red-500" : ""}`}
                        placeholder="Your Business Name"
                      />
                    </div>
                    {errors.businessName && <p className="text-red-500 text-xs mt-1">{errors.businessName}</p>}
                  </div>

                  <div>
                    <Label htmlFor="businessType">Business Type</Label>
                    <Select value={formData.businessType} onValueChange={(value) => handleInputChange("businessType", value)}>
                      <SelectTrigger className={errors.businessType ? "border-red-500" : ""}>
                        <SelectValue placeholder="Select business type" />
                      </SelectTrigger>
                      <SelectContent>
                        {businessTypes.map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.businessType && <p className="text-red-500 text-xs mt-1">{errors.businessType}</p>}
                  </div>

                  <div>
                    <AddressAutocomplete
                      label="Business Address"
                      placeholder="Start typing your business address..."
                      value={formData.address}
                      onValueChange={(value) => handleInputChange("address", value)}
                      onAddressSelect={(details) => {
                        handleInputChange("address", details.formattedAddress);
                        // Auto-fill city if we can extract it
                        if (details.city && !formData.city) {
                          handleInputChange("city", details.city);
                        }
                      }}
                      showCurrentLocation={true}
                      required
                      error={errors.address}
                    />
                  </div>
                </>
              )}

              {/* Password */}
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
                    placeholder="Create a strong password"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {formData.password && (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex gap-1">
                      {[
                        formData.password.length >= 8,
                        /[A-Z]/.test(formData.password),
                        /[a-z]/.test(formData.password),
                        /[0-9]/.test(formData.password)
                      ].map((met, i) => (
                        <div
                          key={i}
                          className={`h-1.5 flex-1 rounded-full transition-colors ${
                            met ? "bg-green-500" : "bg-gray-200"
                          }`}
                        />
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs">
                      <span className={formData.password.length >= 8 ? "text-green-600" : "text-gray-500"}>
                        {formData.password.length >= 8 ? <CheckCircle className="inline w-3 h-3 mr-1" /> : "○ "}8+ characters
                      </span>
                      <span className={/[A-Z]/.test(formData.password) ? "text-green-600" : "text-gray-500"}>
                        {/[A-Z]/.test(formData.password) ? <CheckCircle className="inline w-3 h-3 mr-1" /> : "○ "}Uppercase
                      </span>
                      <span className={/[a-z]/.test(formData.password) ? "text-green-600" : "text-gray-500"}>
                        {/[a-z]/.test(formData.password) ? <CheckCircle className="inline w-3 h-3 mr-1" /> : "○ "}Lowercase
                      </span>
                      <span className={/[0-9]/.test(formData.password) ? "text-green-600" : "text-gray-500"}>
                        {/[0-9]/.test(formData.password) ? <CheckCircle className="inline w-3 h-3 mr-1" /> : "○ "}Number
                      </span>
                    </div>
                  </div>
                )}
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
              </div>

              <div>
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                    className={`pl-10 pr-10 ${errors.confirmPassword ? "border-red-500" : ""}`}
                    placeholder="Confirm your password"
                    autoComplete="new-password"
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

              {/* Terms and Conditions */}
              <div className="space-y-3">
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="agreeTerms"
                    checked={formData.agreeTerms}
                    onCheckedChange={(checked) => handleInputChange("agreeTerms", checked)}
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

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="agreeMarketing"
                    checked={formData.agreeMarketing}
                    onCheckedChange={(checked) => handleInputChange("agreeMarketing", checked)}
                  />
                  <label htmlFor="agreeMarketing" className="text-sm text-muted-foreground">
                    I'd like to receive marketing emails about new products and promotions
                  </label>
                </div>
              </div>

              {userType === "vendor" && (
                <Alert className="border-orange-200 bg-orange-50">
                  <Shield className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-orange-800">
                    <strong>Next Step:</strong> After registration, you'll complete our vendor verification process including ID verification and facial recognition.
                  </AlertDescription>
                </Alert>
              )}

              {errors.submit && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    {errors.submit}
                  </AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  "Creating Account..."
                ) : authMethod === "phone" ? (
                  "Continue to Verification"
                ) : userType === "vendor" ? (
                  "Create Account & Verify"
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>
            </div>

            <div className="mt-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>

              <div className="mt-4">
                <GoogleSignInButton
                  mode="signup"
                  role={userType}
                  className="w-full"
                  onSuccess={(credential) => {
                    toast.success("Google Sign-Up successful!");
                  }}
                  onError={(error) => {
                    toast.error(error);
                  }}
                />
                <GoogleAuthFallback />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Login Link */}
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-blue-600 hover:underline font-semibold">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    }>
      <RegisterPageContent />
    </Suspense>
  );
}
