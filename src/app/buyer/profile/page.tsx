"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Lock,
  Shield,
  Edit,
  Plus,
  Trash2,
  Star,
  CheckCircle,
  ArrowLeft,
  Loader2,
  Home,
  Building2,
  Briefcase,
  Save,
  Eye,
  EyeOff,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { useAddressesStore, Address } from "@/lib/addresses-store";
import { AddressAutocomplete } from "@/components/integrations/address-autocomplete";
import { PlaceDetails } from "@/lib/services/google-maps";
import { toast } from "sonner";
import { GHANA_REGIONS } from "@/lib/constants/ghana-locations";

const addressLabels = [
  { value: "home", label: "Home", icon: Home },
  { value: "work", label: "Work", icon: Briefcase },
  { value: "office", label: "Office", icon: Building2 },
  { value: "other", label: "Other", icon: MapPin },
];

export default function BuyerProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, updateUser } = useAuthStore();
  const {
    getAddressesByUser,
    addAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
  } = useAddressesStore();

  const [isHydrated, setIsHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showAddressDialog, setShowAddressDialog] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    phone: "",
    location: "",
  });

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordErrors, setPasswordErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  // Address form state
  const [addressForm, setAddressForm] = useState({
    label: "home",
    fullName: "",
    phone: "",
    street: "",
    city: "",
    region: "",
    digitalAddress: "",
    landmark: "",
    isDefault: false,
  });

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated && user) {
      setProfileForm({
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        location: user.location || "",
      });
    }
  }, [isHydrated, user]);

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push("/auth/login");
    }
  }, [isHydrated, isAuthenticated, router]);

  if (!isHydrated) {
    return (
      <SiteLayout>
        <div className="container py-8 flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-12 h-12 animate-spin text-gray-400" />
        </div>
      </SiteLayout>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const userAddresses = getAddressesByUser(user.id);

  const handleSaveProfile = async () => {
    if (!profileForm.name.trim()) {
      toast.error("Name is required");
      return;
    }

    if (!profileForm.email.trim()) {
      toast.error("Email is required");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(profileForm.email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsSaving(true);
    try {
      const updatePayload: Record<string, string> = {
        name: profileForm.name,
        phone: profileForm.phone,
        location: profileForm.location,
      };

      if (profileForm.email !== user.email) {
        updatePayload.email = profileForm.email;
      }

      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updatePayload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update profile');
      }

      updateUser(updatePayload);
      toast.success("Profile updated successfully");
      setIsEditing(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    const errors: typeof passwordErrors = {};

    if (!passwordForm.currentPassword) {
      errors.currentPassword = "Current password is required";
    }
    if (!passwordForm.newPassword) {
      errors.newPassword = "New password is required";
    } else if (passwordForm.newPassword.length < 8) {
      errors.newPassword = "Password must be at least 8 characters";
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }

    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      return;
    }

    setPasswordErrors({});
    setIsSaving(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        const errorMsg = error.error || 'Failed to change password';
        if (errorMsg.toLowerCase().includes('current password')) {
          setPasswordErrors({ currentPassword: errorMsg });
        } else if (errorMsg.toLowerCase().includes('new password') || errorMsg.toLowerCase().includes('must contain')) {
          setPasswordErrors({ newPassword: errorMsg });
        } else {
          toast.error(errorMsg);
        }
        return;
      }

      toast.success("Password changed successfully");
      setShowPasswordDialog(false);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPasswordErrors({});
    } catch (error) {
      console.error("Failed to change password:", error);
      toast.error(error instanceof Error ? error.message : "Failed to change password");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenAddressDialog = (address?: Address) => {
    if (address) {
      setEditingAddress(address);
      setAddressForm({
        label: address.label,
        fullName: address.fullName,
        phone: address.phone,
        street: address.street,
        city: address.city,
        region: address.region,
        digitalAddress: address.digitalAddress || "",
        landmark: address.landmark || "",
        isDefault: address.isDefault,
      });
    } else {
      setEditingAddress(null);
      setAddressForm({
        label: "home",
        fullName: user.name,
        phone: user.phone || "",
        street: "",
        city: "",
        region: "",
        digitalAddress: "",
        landmark: "",
        isDefault: userAddresses.length === 0,
      });
    }
    setShowAddressDialog(true);
  };

  const handleSaveAddress = () => {
    if (!addressForm.fullName || !addressForm.phone || !addressForm.street || !addressForm.city || !addressForm.region) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (editingAddress) {
      updateAddress(editingAddress.id, addressForm);
      if (addressForm.isDefault && !editingAddress.isDefault) {
        setDefaultAddress(user.id, editingAddress.id);
      }
      toast.success("Address updated successfully");
    } else {
      addAddress({
        userId: user.id,
        ...addressForm,
      });
      toast.success("Address added successfully");
    }

    setShowAddressDialog(false);
    setEditingAddress(null);
  };

  const handleDeleteAddress = (addressId: string) => {
    deleteAddress(addressId);
    toast.success("Address deleted");
  };

  const handleSetDefaultAddress = (addressId: string) => {
    setDefaultAddress(user.id, addressId);
    toast.success("Default address updated");
  };

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const getLabelIcon = (label: string) => {
    const found = addressLabels.find((l) => l.value === label);
    return found?.icon || MapPin;
  };

  return (
    <SiteLayout>
      <div className="container py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" asChild>
            <Link href="/buyer/dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">My Profile</h1>
            <p className="text-muted-foreground">Manage your account settings and addresses</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex w-full overflow-x-auto mb-6">
            <TabsTrigger value="profile" className="flex-shrink-0">Profile</TabsTrigger>
            <TabsTrigger value="addresses" className="flex-shrink-0">Addresses</TabsTrigger>
            <TabsTrigger value="security" className="flex-shrink-0">Security</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={user.avatar} />
                      <AvatarFallback className="text-xl">{getInitials(user.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle>{user.name}</CardTitle>
                      <CardDescription>{user.email}</CardDescription>
                      <Badge variant="outline" className="mt-1 capitalize">{user.role}</Badge>
                    </div>
                  </div>
                  {!isEditing ? (
                    <Button variant="outline" onClick={() => setIsEditing(true)}>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Profile
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                      <Button onClick={handleSaveProfile} disabled={isSaving}>
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        Save
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Full Name</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <User className="w-4 h-4 text-muted-foreground" />
                      {isEditing ? (
                        <Input
                          id="name"
                          value={profileForm.name}
                          onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                        />
                      ) : (
                        <span>{user.name}</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="email">Email Address (Login Email)</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      {isEditing ? (
                        <Input
                          id="email"
                          type="email"
                          value={profileForm.email}
                          onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                          placeholder="your@email.com"
                        />
                      ) : (
                        <>
                          <span>{user.email}</span>
                          <Badge variant="outline" className="text-xs">
                            <CheckCircle className="w-3 h-3 mr-1 text-green-600" />
                            Verified
                          </Badge>
                        </>
                      )}
                    </div>
                    {isEditing && profileForm.email !== user.email && (
                      <p className="text-xs text-amber-600 mt-1">
                        Changing your email will update your login credentials.
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      {isEditing ? (
                        <Input
                          id="phone"
                          value={profileForm.phone}
                          onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                          placeholder="+233 XX XXX XXXX"
                        />
                      ) : (
                        <span>{user.phone || "Not set"}</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="location">Location</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      {isEditing ? (
                        <Input
                          id="location"
                          value={profileForm.location}
                          onChange={(e) => setProfileForm({ ...profileForm, location: e.target.value })}
                          placeholder="City, Region"
                        />
                      ) : (
                        <span>{user.location || "Not set"}</span>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold mb-2">Account Statistics</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold">0</p>
                      <p className="text-sm text-muted-foreground">Orders</p>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold">0</p>
                      <p className="text-sm text-muted-foreground">Reviews</p>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold">0</p>
                      <p className="text-sm text-muted-foreground">Wishlist</p>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold">{userAddresses.length}</p>
                      <p className="text-sm text-muted-foreground">Addresses</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Addresses Tab */}
          <TabsContent value="addresses">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Saved Addresses</CardTitle>
                    <CardDescription>Manage your delivery addresses</CardDescription>
                  </div>
                  <Button onClick={() => handleOpenAddressDialog()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Address
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {userAddresses.length === 0 ? (
                  <div className="text-center py-12">
                    <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Addresses Saved</h3>
                    <p className="text-muted-foreground mb-4">Add an address for faster checkout</p>
                    <Button onClick={() => handleOpenAddressDialog()}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Your First Address
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {userAddresses.map((address) => {
                      const LabelIcon = getLabelIcon(address.label);
                      return (
                        <Card key={address.id} className={`relative ${address.isDefault ? "border-green-500" : ""}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <LabelIcon className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium capitalize">{address.label}</span>
                                {address.isDefault && (
                                  <Badge className="bg-green-100 text-green-700">Default</Badge>
                                )}
                              </div>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenAddressDialog(address)}>
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600">
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Address</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete this address? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDeleteAddress(address.id)} className="bg-red-600">
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                            <div className="space-y-1 text-sm">
                              <p className="font-medium">{address.fullName}</p>
                              <p className="text-muted-foreground">{address.street}</p>
                              <p className="text-muted-foreground">{address.city}, {address.region}</p>
                              {address.digitalAddress && (
                                <p className="text-muted-foreground">GPS: {address.digitalAddress}</p>
                              )}
                              <p className="text-muted-foreground">{address.phone}</p>
                            </div>
                            {!address.isDefault && (
                              <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => handleSetDefaultAddress(address.id)}>
                                Set as Default
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Address Dialog */}
            <Dialog open={showAddressDialog} onOpenChange={setShowAddressDialog}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingAddress ? "Edit Address" : "Add New Address"}</DialogTitle>
                  <DialogDescription>
                    {editingAddress ? "Update your address details" : "Add a new delivery address"}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                  <div>
                    <Label>Address Label</Label>
                    <Select value={addressForm.label} onValueChange={(v) => setAddressForm({ ...addressForm, label: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {addressLabels.map((label) => (
                          <SelectItem key={label.value} value={label.value}>
                            <div className="flex items-center gap-2">
                              <label.icon className="w-4 h-4" />
                              {label.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Full Name *</Label>
                      <Input value={addressForm.fullName} onChange={(e) => setAddressForm({ ...addressForm, fullName: e.target.value })} />
                    </div>
                    <div>
                      <Label>Phone Number *</Label>
                      <Input value={addressForm.phone} onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <AddressAutocomplete
                      label="Street Address *"
                      placeholder="Enter your street address"
                      value={addressForm.street}
                      onValueChange={(value) => setAddressForm({ ...addressForm, street: value })}
                      onAddressSelect={(details: PlaceDetails) => {
                        setAddressForm({
                          ...addressForm,
                          street: details.formattedAddress,
                          city: details.city || addressForm.city,
                          region: details.region || addressForm.region,
                        });
                      }}
                      showCurrentLocation
                    />
                  </div>
                  <div>
                    <AddressAutocomplete
                      id="address-city"
                      label="City / Town *"
                      placeholder="Start typing your city or town..."
                      value={addressForm.city}
                      onValueChange={(value) => setAddressForm({ ...addressForm, city: value })}
                      onAddressSelect={(details: PlaceDetails) => {
                        const city = details.city || details.name || details.formattedAddress;
                        let region = addressForm.region;
                        if (details.region) {
                          const matchedRegion = GHANA_REGIONS.find(r => 
                            r.toLowerCase().includes(details.region!.toLowerCase()) ||
                            details.region!.toLowerCase().includes(r.replace(" Region", "").toLowerCase())
                          );
                          region = matchedRegion || details.region;
                        }
                        setAddressForm({ ...addressForm, city, region });
                      }}
                      showCurrentLocation={false}
                      types={["(cities)"]}
                    />
                  </div>

                  <div>
                    <Label>Region *</Label>
                    <Select value={addressForm.region} onValueChange={(v) => setAddressForm({ ...addressForm, region: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select or auto-filled from city" />
                      </SelectTrigger>
                      <SelectContent>
                        {GHANA_REGIONS.map((region) => (
                          <SelectItem key={region} value={region}>{region}</SelectItem>
                        ))}
                        </SelectContent>
                      </Select>
                    </div>
                  <div>
                    <Label>Ghana Post GPS Address</Label>
                    <Input value={addressForm.digitalAddress} onChange={(e) => setAddressForm({ ...addressForm, digitalAddress: e.target.value })} placeholder="e.g., GA-XXX-XXXX" />
                  </div>
                  <div>
                    <Label>Landmark (Optional)</Label>
                    <Input value={addressForm.landmark} onChange={(e) => setAddressForm({ ...addressForm, landmark: e.target.value })} placeholder="Near a landmark" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAddressDialog(false)}>Cancel</Button>
                  <Button onClick={handleSaveAddress}>{editingAddress ? "Update Address" : "Save Address"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Security Settings
                </CardTitle>
                <CardDescription>Manage your account security</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      <Lock className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium">Password</p>
                      <p className="text-sm text-muted-foreground">Change your account password</p>
                    </div>
                  </div>
                  <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline">Change Password</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Change Password</DialogTitle>
                        <DialogDescription>Enter your current password and choose a new one</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Current Password</Label>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              value={passwordForm.currentPassword}
                              onChange={(e) => {
                                setPasswordForm({ ...passwordForm, currentPassword: e.target.value });
                                if (passwordErrors.currentPassword) {
                                  setPasswordErrors({ ...passwordErrors, currentPassword: undefined });
                                }
                              }}
                              className={passwordErrors.currentPassword ? "border-red-500 focus-visible:ring-red-500" : ""}
                            />
                          </div>
                          {passwordErrors.currentPassword && (
                            <p className="text-sm text-red-500 mt-1">{passwordErrors.currentPassword}</p>
                          )}
                        </div>
                        <div>
                          <Label>New Password</Label>
                          <Input
                            type={showPassword ? "text" : "password"}
                            value={passwordForm.newPassword}
                            onChange={(e) => {
                              setPasswordForm({ ...passwordForm, newPassword: e.target.value });
                              if (passwordErrors.newPassword) {
                                setPasswordErrors({ ...passwordErrors, newPassword: undefined });
                              }
                            }}
                            className={passwordErrors.newPassword ? "border-red-500 focus-visible:ring-red-500" : ""}
                          />
                          {passwordErrors.newPassword && (
                            <p className="text-sm text-red-500 mt-1">{passwordErrors.newPassword}</p>
                          )}
                        </div>
                        <div>
                          <Label>Confirm New Password</Label>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              value={passwordForm.confirmPassword}
                              onChange={(e) => {
                                setPasswordForm({ ...passwordForm, confirmPassword: e.target.value });
                                if (passwordErrors.confirmPassword) {
                                  setPasswordErrors({ ...passwordErrors, confirmPassword: undefined });
                                }
                              }}
                              className={passwordErrors.confirmPassword ? "border-red-500 focus-visible:ring-red-500" : ""}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </Button>
                          </div>
                          {passwordErrors.confirmPassword && (
                            <p className="text-sm text-red-500 mt-1">{passwordErrors.confirmPassword}</p>
                          )}
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => {
                          setShowPasswordDialog(false);
                          setPasswordErrors({});
                        }}>Cancel</Button>
                        <Button onClick={handleChangePassword} disabled={isSaving}>
                          {isSaving ? "Updating..." : "Update Password"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">Email Verification</p>
                      <p className="text-sm text-muted-foreground">Your email is verified</p>
                    </div>
                  </div>
                  <Badge className="bg-green-100 text-green-700">Verified</Badge>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      <Phone className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium">Phone Verification</p>
                      <p className="text-sm text-muted-foreground">
                        {user.phone ? "Your phone number is on file" : "Add a phone number for extra security"}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" disabled={!user.phone}>
                    {user.phone ? "Verify Phone" : "Add Phone First"}
                  </Button>
                </div>

                <Separator />

                <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
                  <h4 className="font-medium text-red-800 mb-2">Danger Zone</h4>
                  <p className="text-sm text-red-600 mb-4">
                    Permanently delete your account and all associated data. This action cannot be undone.
                  </p>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">Delete Account</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete your account and remove all your data from our servers. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-red-600" onClick={() => toast.error("Account deletion is disabled in demo mode")}>
                          Yes, delete my account
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </SiteLayout>
  );
}
