"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft,
  User,
  Mail,
  Save,
  Loader2,
  Shield,
  Eye,
  EyeOff,
  CheckCircle,
  AlertTriangle,
  Info
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { ImageUpload } from "@/components/ui/image-upload";
import { toast } from "sonner";

export default function VendorProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, updateUser: updateAuthUser, isHydrated } = useAuthStore();

  const [isLoading, setIsLoading] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    avatar: "",
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [originalEmail, setOriginalEmail] = useState("");

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
        avatar: user.avatar || "",
      });
      setOriginalEmail(user.email || "");
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
        avatar: profileData.avatar,
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
              <div className="flex flex-col sm:flex-row gap-6">
                <div className="flex-shrink-0">
                  <Label className="mb-2 block">Profile Photo</Label>
                  <ImageUpload
                    value={profileData.avatar}
                    onChange={(url) => handleProfileChange("avatar", url)}
                    className="w-24 h-24 rounded-full"
                  />
                </div>
                <div className="flex-1 space-y-4">
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
    </SiteLayout>
  );
}
