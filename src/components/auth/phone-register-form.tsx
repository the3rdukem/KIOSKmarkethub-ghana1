"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Phone, AlertTriangle, Loader2, ArrowLeft, User, MapPin, Lock, Eye, EyeOff, CheckCircle } from "lucide-react";
import { GHANA_REGIONS } from "@/lib/constants/ghana-locations";
import Link from "next/link";

interface PhoneRegisterFormProps {
  userType: "buyer" | "vendor";
  onSuccess: (user: { id: string; email: string; name: string; role: string; phone: string }) => void;
  onError: (error: string) => void;
}

type Step = "credentials" | "otp" | "profile";

export function PhoneRegisterForm({ userType, onSuccess, onError }: PhoneRegisterFormProps) {
  const [step, setStep] = useState<Step>("credentials");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState(5);
  const [maskedPhone, setMaskedPhone] = useState("");
  
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    region: "",
    city: "",
    businessName: "",
    businessType: "",
    address: "",
    agreeTerms: false,
  });

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const businessTypes = [
    "Individual Seller", "Small Business", "Medium Enterprise", "Corporation",
    "Manufacturer", "Wholesaler", "Retailer", "Service Provider"
  ];

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const formatPhoneDisplay = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 10)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 10);
    setPhone(value);
    setError("");
  };

  const validatePassword = (pwd: string): string[] => {
    const errors: string[] = [];
    if (pwd.length < 8) errors.push("At least 8 characters");
    if (!/[A-Z]/.test(pwd)) errors.push("One uppercase letter");
    if (!/[a-z]/.test(pwd)) errors.push("One lowercase letter");
    if (!/[0-9]/.test(pwd)) errors.push("One number");
    return errors;
  };

  const passwordErrors = validatePassword(password);
  const isPasswordValid = passwordErrors.length === 0;
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (phone.length !== 10 || !phone.startsWith("0")) {
      setError("Please enter a valid 10-digit Ghana phone number starting with 0");
      return;
    }

    if (!isPasswordValid) {
      setError("Please ensure your password meets all requirements");
      return;
    }

    if (!passwordsMatch) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });

      const data = await response.json();

      if (!data.success) {
        if (data.cooldownRemaining) {
          setCooldown(data.cooldownRemaining);
        }
        setError(data.error);
        setIsLoading(false);
        return;
      }

      setMaskedPhone(data.message?.match(/\+\d+\*+\d+/)?.[0] || phone);
      setStep("otp");
      setOtp(["", "", "", "", "", ""]);
      setAttemptsRemaining(5);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      setError("Failed to send verification code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    setError("");

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
    setError("");

    try {
      const response = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp: otpCode }),
      });

      const data = await response.json();

      if (!data.success) {
        if (data.attemptsRemaining !== undefined) {
          setAttemptsRemaining(data.attemptsRemaining);
        }
        setError(data.error);
        setOtp(["", "", "", "", "", ""]);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
        setIsLoading(false);
        return;
      }

      if (data.user && data.user.status !== 'pending') {
        onSuccess(data.user);
      } else {
        setStep("profile");
      }
    } catch (err) {
      setError("Verification failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (cooldown > 0) return;
    
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });

      const data = await response.json();

      if (!data.success) {
        if (data.cooldownRemaining) {
          setCooldown(data.cooldownRemaining);
        }
        setError(data.error);
      } else {
        setOtp(["", "", "", "", "", ""]);
        setAttemptsRemaining(5);
        setCooldown(60);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
      }
    } catch (err) {
      setError("Failed to resend code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const errors: string[] = [];
    if (!profileData.firstName.trim()) errors.push("First name is required");
    if (!profileData.lastName.trim()) errors.push("Last name is required");
    if (!profileData.region) errors.push("Region is required");
    if (!profileData.city.trim()) errors.push("City is required");
    if (!profileData.agreeTerms) errors.push("You must agree to the terms");
    
    if (userType === "vendor") {
      if (!profileData.businessName.trim()) errors.push("Business name is required");
      if (!profileData.businessType) errors.push("Business type is required");
    }

    if (errors.length > 0) {
      setError(errors[0]);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/phone/complete-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          password,
          name: `${profileData.firstName} ${profileData.lastName}`,
          role: userType,
          location: `${profileData.city}, ${profileData.region}`,
          businessName: userType === "vendor" ? profileData.businessName : undefined,
          businessType: userType === "vendor" ? profileData.businessType : undefined,
          address: userType === "vendor" ? profileData.address : undefined,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || "Registration failed");
        setIsLoading(false);
        return;
      }

      if (data.user) {
        onSuccess(data.user);
      }
    } catch (err) {
      setError("Registration failed. Please try again.");
      onError("Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  if (step === "credentials") {
    return (
      <form onSubmit={handleCredentialsSubmit} className="space-y-4">
        <div>
          <Label htmlFor="phone">Phone Number</Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              id="phone"
              type="tel"
              value={formatPhoneDisplay(phone)}
              onChange={handlePhoneChange}
              className={`pl-10 ${error ? "border-red-500" : ""}`}
              placeholder="024 XXX XXXX"
              disabled={isLoading}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">Enter your 10-digit Ghana phone number</p>
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              className={`pl-10 pr-10 ${error ? "border-red-500" : ""}`}
              placeholder="Create a password"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {password && (
            <div className="mt-2 space-y-1">
              {["At least 8 characters", "One uppercase letter", "One lowercase letter", "One number"].map((req) => {
                const passed = !passwordErrors.includes(req);
                return (
                  <div key={req} className={`text-xs flex items-center gap-1 ${passed ? "text-green-600" : "text-gray-400"}`}>
                    <CheckCircle className={`w-3 h-3 ${passed ? "text-green-600" : "text-gray-300"}`} />
                    {req}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
              className={`pl-10 pr-10 ${confirmPassword && !passwordsMatch ? "border-red-500" : ""}`}
              placeholder="Confirm your password"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {confirmPassword && (
            <p className={`text-xs mt-1 ${passwordsMatch ? "text-green-600" : "text-red-500"}`}>
              {passwordsMatch ? "Passwords match" : "Passwords do not match"}
            </p>
          )}
        </div>

        {error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {cooldown > 0 && (
          <p className="text-sm text-amber-600 text-center">
            Please wait {cooldown} seconds before requesting a new code
          </p>
        )}

        <Button type="submit" className="w-full" disabled={isLoading || cooldown > 0 || !isPasswordValid || !passwordsMatch}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending Code...
            </>
          ) : (
            "Continue"
          )}
        </Button>

        <p className="text-xs text-center text-gray-500">
          We&apos;ll send a verification code to your phone
        </p>
      </form>
    );
  }

  if (step === "otp") {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setStep("credentials")}
          className="flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Change phone number
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
              className={`w-12 h-12 text-center text-xl font-semibold ${error ? "border-red-500" : ""}`}
              disabled={isLoading}
            />
          ))}
        </div>

        {error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              {error}
              {attemptsRemaining > 0 && attemptsRemaining < 5 && (
                <span className="block mt-1 text-xs">
                  {attemptsRemaining} attempt{attemptsRemaining !== 1 ? "s" : ""} remaining
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
            disabled={cooldown > 0 || isLoading}
            className={`text-sm ${cooldown > 0 ? "text-gray-400" : "text-blue-600 hover:underline"}`}
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleProfileSubmit} className="space-y-4">
      <div className="text-center mb-4">
        <div className="flex items-center justify-center gap-2 text-green-600 mb-2">
          <CheckCircle className="w-5 h-5" />
          <span className="font-medium">Phone verified!</span>
        </div>
        <p className="text-sm text-gray-600">Complete your profile to finish registration.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="firstName">First Name</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              id="firstName"
              value={profileData.firstName}
              onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
              className="pl-10"
              placeholder="First name"
              disabled={isLoading}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            value={profileData.lastName}
            onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
            placeholder="Last name"
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="region">Region</Label>
          <Select
            value={profileData.region}
            onValueChange={(value) => setProfileData({ ...profileData, region: value })}
            disabled={isLoading}
          >
            <SelectTrigger id="region">
              <SelectValue placeholder="Select region" />
            </SelectTrigger>
            <SelectContent>
              {GHANA_REGIONS.map((region) => (
                <SelectItem key={region} value={region}>{region}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="city">City</Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              id="city"
              value={profileData.city}
              onChange={(e) => setProfileData({ ...profileData, city: e.target.value })}
              className="pl-10"
              placeholder="City"
              disabled={isLoading}
            />
          </div>
        </div>
      </div>

      {userType === "vendor" && (
        <>
          <div>
            <Label htmlFor="businessName">Business Name</Label>
            <Input
              id="businessName"
              value={profileData.businessName}
              onChange={(e) => setProfileData({ ...profileData, businessName: e.target.value })}
              placeholder="Your business name"
              disabled={isLoading}
            />
          </div>

          <div>
            <Label htmlFor="businessType">Business Type</Label>
            <Select
              value={profileData.businessType}
              onValueChange={(value) => setProfileData({ ...profileData, businessType: value })}
              disabled={isLoading}
            >
              <SelectTrigger id="businessType">
                <SelectValue placeholder="Select business type" />
              </SelectTrigger>
              <SelectContent>
                {businessTypes.map((type) => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="address">Business Address (Optional)</Label>
            <Input
              id="address"
              value={profileData.address}
              onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
              placeholder="Business address"
              disabled={isLoading}
            />
          </div>
        </>
      )}

      <div className="flex items-start space-x-2">
        <Checkbox
          id="terms"
          checked={profileData.agreeTerms}
          onCheckedChange={(checked) => setProfileData({ ...profileData, agreeTerms: checked === true })}
          disabled={isLoading}
        />
        <label htmlFor="terms" className="text-sm text-gray-600 leading-tight">
          I agree to the{" "}
          <Link href="/terms" className="text-blue-600 hover:underline">Terms of Service</Link>
          {" "}and{" "}
          <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>
        </label>
      </div>

      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating Account...
          </>
        ) : (
          `Create ${userType === "vendor" ? "Vendor" : "Buyer"} Account`
        )}
      </Button>
    </form>
  );
}
