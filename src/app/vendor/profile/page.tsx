"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Save,
  Loader2,
  Shield,
  Eye,
  EyeOff,
  Info,
  AlertTriangle
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { toast } from "sonner";

export default function VendorProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, updateUser: updateAuthUser } = useAuthStore();

  const [isLoading, setIsLoading] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [originalEmail, setOriginalEmail] = useState("");
  
  // Phone change state
  const [phoneData, setPhoneData] = useState({
    currentPhone: "",
    newPhone: "",
  });
  const [originalPhone, setOriginalPhone] = useState("");
  const [isPhoneOtpDialogOpen, setIsPhoneOtpDialogOpen] = useState(false);
  const [phoneOtpCode, setPhoneOtpCode] = useState("");
  const [isRequestingPhoneOtp, setIsRequestingPhoneOtp] = useState(false);
  const [isVerifyingPhoneOtp, setIsVerifyingPhoneOtp] = useState(false);
  const [phoneChangeToken, setPhoneChangeToken] = useState<string | null>(null);
  const [isSavingPhone, setIsSavingPhone] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    
    if (!isAuthenticated || user?.role !== 'vendor') {
      router.push('/vendor/login');
      return;
    }

    if (user) {
      setProfileData({
        name: user.name || "",
        email: user.email || "",
      });
      setOriginalEmail(user.email || "");
      setPhoneData({
        currentPhone: user.phone || "",
        newPhone: user.phone || "",
      });
      setOriginalPhone(user.phone || "");
    }
  }, [isHydrated, isAuthenticated, user, router]);

  const handleProfileChange = (field: string, value: string) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  };

  const handlePasswordChange = (field: string, value: string) => {
    setPasswordData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    if (!profileData.name.trim()) {
      toast.error("Name is required");
      return;
    }

    if (!profileData.email.trim()) {
      toast.error("Email is required");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(profileData.email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsLoading(true);

    try {
      const updatePayload: Record<string, string> = {
        name: profileData.name,
      };

      if (profileData.email !== originalEmail) {
        updatePayload.email = profileData.email;
      }

      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updatePayload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save profile');
      }

      updateAuthUser(updatePayload);

      setOriginalEmail(profileData.email);
      setHasUnsavedChanges(false);
      toast.success("Profile saved successfully!");
    } catch (error) {
      console.error("Failed to save profile:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save profile. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user) return;

    if (!passwordData.currentPassword) {
      toast.error("Current password is required");
      return;
    }

    if (!passwordData.newPassword) {
      toast.error("New password is required");
      return;
    }

    if (passwordData.newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    setIsChangingPassword(true);

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to change password');
      }

      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      toast.success("Password changed successfully!");
    } catch (error) {
      console.error("Failed to change password:", error);
      toast.error(error instanceof Error ? error.message : "Failed to change password. Please try again.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Phone change handlers
  const handlePhoneChange = (value: string) => {
    setPhoneData(prev => ({ ...prev, newPhone: value }));
  };

  const phoneChanged = phoneData.newPhone !== originalPhone && originalPhone !== "";

  const handleRequestPhoneOtp = async () => {
    if (!user || !originalPhone) {
      toast.error("You must have a phone number to change it");
      return;
    }

    setIsRequestingPhoneOtp(true);

    try {
      const response = await fetch('/api/vendor/profile/phone-change/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send verification code');
      }

      setIsPhoneOtpDialogOpen(true);
      toast.success(`Verification code sent to ${data.maskedPhone || 'your phone'}`);
    } catch (error) {
      console.error("Failed to request phone OTP:", error);
      toast.error(error instanceof Error ? error.message : "Failed to send verification code");
    } finally {
      setIsRequestingPhoneOtp(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    if (phoneOtpCode.length !== 6) {
      toast.error("Please enter the 6-digit code");
      return;
    }

    setIsVerifyingPhoneOtp(true);

    try {
      const response = await fetch('/api/vendor/profile/phone-change/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ otp: phoneOtpCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid verification code');
      }

      setPhoneChangeToken(data.phoneChangeToken);
      setIsPhoneOtpDialogOpen(false);
      setPhoneOtpCode("");
      toast.success("Verified! You can now update your phone number.");
    } catch (error) {
      console.error("Failed to verify phone OTP:", error);
      toast.error(error instanceof Error ? error.message : "Invalid verification code");
    } finally {
      setIsVerifyingPhoneOtp(false);
    }
  };

  const handleSavePhone = async () => {
    if (!user || !phoneChangeToken) {
      toast.error("Please verify with OTP first");
      return;
    }

    if (!phoneData.newPhone.trim()) {
      toast.error("Phone number is required");
      return;
    }

    setIsSavingPhone(true);

    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          phone: phoneData.newPhone,
          phoneChangeToken: phoneChangeToken,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Failed to update phone');
      }

      // Update local state with new phone
      updateAuthUser({ phone: phoneData.newPhone });

      setOriginalPhone(phoneData.newPhone);
      setPhoneData(prev => ({ ...prev, currentPhone: phoneData.newPhone }));
      setPhoneChangeToken(null);
      toast.success("Phone number updated! Please verify your new number.");
    } catch (error) {
      console.error("Failed to save phone:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update phone number");
    } finally {
      setIsSavingPhone(false);
    }
  };

  if (!isHydrated) {
    return (
      <SiteLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </SiteLayout>
    );
  }

  if (!isAuthenticated || user?.role !== 'vendor') {
    return null;
  }

  const emailChanged = profileData.email !== originalEmail;

  return (
    <SiteLayout>
      <div className="container max-w-2xl mx-auto py-8 px-4">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/vendor')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">My Profile</h1>
            <p className="text-muted-foreground">
              Manage your account information and security
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Account Information
              </CardTitle>
              <CardDescription>
                Update your personal details and login email
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={profileData.name}
                    onChange={(e) => handleProfileChange("name", e.target.value)}
                    placeholder="Your full name"
                  />
                </div>

                <div>
                  <Label htmlFor="email" className="flex items-center gap-2">
                    Login Email *
                    <span className="text-xs text-muted-foreground font-normal">
                      (used to sign in)
                    </span>
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      id="email"
                      type="email"
                      value={profileData.email}
                      onChange={(e) => handleProfileChange("email", e.target.value)}
                      className="pl-10"
                      placeholder="your@email.com"
                    />
                  </div>
                  {emailChanged && (
                    <Alert className="mt-2">
                      <Info className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        Changing your login email will update how you sign in to KIOSK.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleSaveProfile}
                  disabled={isLoading || !hasUnsavedChanges}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Change Password
              </CardTitle>
              <CardDescription>
                Update your password for enhanced security
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="currentPassword">Current Password</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    value={passwordData.currentPassword}
                    onChange={(e) => handlePasswordChange("currentPassword", e.target.value)}
                    placeholder="Enter current password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={passwordData.newPassword}
                    onChange={(e) => handlePasswordChange("newPassword", e.target.value)}
                    placeholder="Enter new password (min 8 characters)"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={passwordData.confirmPassword}
                    onChange={(e) => handlePasswordChange("confirmPassword", e.target.value)}
                    placeholder="Confirm new password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleChangePassword}
                  disabled={isChangingPassword || !passwordData.currentPassword || !passwordData.newPassword}
                  variant="outline"
                >
                  {isChangingPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Changing...
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4 mr-2" />
                      Change Password
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Phone Number Change Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Phone Number
              </CardTitle>
              <CardDescription>
                Update your phone number (requires verification via OTP)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!originalPhone ? (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    No phone number is set. Add one in your Store Settings.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div>
                    <Label htmlFor="currentPhone">Current Phone Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        id="currentPhone"
                        value={phoneData.currentPhone}
                        className="pl-10"
                        disabled
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="newPhone">New Phone Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        id="newPhone"
                        value={phoneData.newPhone}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        className="pl-10"
                        placeholder="Enter new phone number"
                      />
                    </div>
                  </div>

                  {phoneChangeToken && (
                    <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                      <Shield className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-700 dark:text-green-300">
                        Verified! You can now save your new phone number.
                      </AlertDescription>
                    </Alert>
                  )}

                  {phoneChanged && !phoneChangeToken && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        To change your phone number, you must first verify ownership of your current number via OTP.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex justify-end gap-2 pt-4">
                    {phoneChanged && !phoneChangeToken ? (
                      <Button
                        onClick={handleRequestPhoneOtp}
                        disabled={isRequestingPhoneOtp}
                        variant="outline"
                      >
                        {isRequestingPhoneOtp ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Sending OTP...
                          </>
                        ) : (
                          <>
                            <Shield className="w-4 h-4 mr-2" />
                            Verify & Change
                          </>
                        )}
                      </Button>
                    ) : phoneChangeToken ? (
                      <Button
                        onClick={handleSavePhone}
                        disabled={isSavingPhone || !phoneChanged}
                      >
                        {isSavingPhone ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Save New Phone
                          </>
                        )}
                      </Button>
                    ) : null}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <div className="text-center text-sm text-muted-foreground">
            <p>
              Looking for store settings?{" "}
              <Button
                variant="link"
                className="p-0 h-auto font-medium"
                onClick={() => router.push('/vendor/settings')}
              >
                Go to Store Settings
              </Button>
            </p>
          </div>
        </div>
      </div>

      {/* Phone Change OTP Dialog */}
      <Dialog open={isPhoneOtpDialogOpen} onOpenChange={setIsPhoneOtpDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Verify Your Identity</DialogTitle>
            <DialogDescription>
              Enter the 6-digit code sent to your current phone number to verify you own this account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex justify-center">
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={phoneOtpCode}
                onChange={(e) => setPhoneOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="text-center text-2xl tracking-widest w-40"
              />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Enter the 6-digit code. It expires in 10 minutes.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsPhoneOtpDialogOpen(false);
                setPhoneOtpCode("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleVerifyPhoneOtp}
              disabled={isVerifyingPhoneOtp || phoneOtpCode.length !== 6}
            >
              {isVerifyingPhoneOtp ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </SiteLayout>
  );
}
