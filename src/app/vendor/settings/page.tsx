"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  ArrowLeft,
  Store,
  Save,
  MapPin,
  Clock,
  Phone,
  Mail,
  Globe,
  Truck,
  CreditCard,
  Bell,
  Shield,
  CheckCircle,
  Loader2,
  Eye,
  EyeOff,
  Power,
  PowerOff,
  Palmtree,
  Facebook,
  Instagram,
  Twitter,
  MessageCircle,
  ExternalLink,
  AlertTriangle
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { useUsersStore } from "@/lib/users-store";
import { ImageUpload } from "@/components/ui/image-upload";
import { AddressAutocomplete } from "@/components/integrations/address-autocomplete";
import { toast } from "sonner";

type StoreStatus = 'open' | 'closed' | 'vacation';

export default function VendorSettingsPage() {
  const router = useRouter();
  const { user, isAuthenticated, updateUser: updateAuthUser } = useAuthStore();
  const { updateUser, getUserById } = useUsersStore();

  const [isLoading, setIsLoading] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [storeData, setStoreData] = useState({
    storeName: "",
    storeDescription: "",
    storeLogo: "",
    storeBanner: "",
    address: "",
    phone: "",
    email: "",
    website: "",
    businessHours: "",
    returnPolicy: "",
    shippingPolicy: "",
    responseTime: "< 24 hours",
    storeStatus: "open" as StoreStatus,
    vacationMessage: "",
    contactEmail: "",
    contactPhone: "",
    socialLinks: {
      facebook: "",
      instagram: "",
      twitter: "",
      whatsapp: "",
    } as { facebook: string; instagram: string; twitter: string; whatsapp: string },

    // Notification settings
    emailNotifications: true,
    smsNotifications: true,
    orderAlerts: true,
    lowStockAlerts: true,

    // Business settings
    autoAcceptOrders: false,
    requireOrderConfirmation: true,
    enableInstantPayouts: false,
  });

  // Hydration
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Load vendor data from both stores
  useEffect(() => {
    if (!isHydrated) return;

    if (!isAuthenticated || !user) {
      router.push("/auth/login");
      return;
    }

    if (user.role !== "vendor") {
      router.push("/");
      return;
    }

    // Get fresh user data from users store
    const freshUserData = getUserById(user.id);
    const userData = freshUserData || user;

    // Load existing vendor data
    setStoreData({
      storeName: userData.businessName || userData.name || "",
      storeDescription: userData.storeDescription || "",
      storeLogo: userData.storeLogo || "",
      storeBanner: userData.storeBanner || "",
      address: userData.location || "",
      phone: userData.phone || "",
      email: userData.email || "",
      website: userData.storeWebsite || "",
      businessHours: userData.storeBusinessHours || "",
      returnPolicy: userData.storeReturnPolicy || "",
      shippingPolicy: userData.storeShippingPolicy || "",
      responseTime: userData.storeResponseTime || "< 24 hours",
      storeStatus: userData.storeStatus || "open",
      vacationMessage: userData.storeVacationMessage || "",
      contactEmail: userData.storeContactEmail || userData.email || "",
      contactPhone: userData.storeContactPhone || userData.phone || "",
      socialLinks: {
        facebook: userData.storeSocialLinks?.facebook || "",
        instagram: userData.storeSocialLinks?.instagram || "",
        twitter: userData.storeSocialLinks?.twitter || "",
        whatsapp: userData.storeSocialLinks?.whatsapp || "",
      },
      emailNotifications: true,
      smsNotifications: true,
      orderAlerts: true,
      lowStockAlerts: true,
      autoAcceptOrders: false,
      requireOrderConfirmation: true,
      enableInstantPayouts: false,
    });
  }, [isHydrated, isAuthenticated, user, router, getUserById]);

  const handleSave = async () => {
    if (!user) return;

    setIsLoading(true);

    try {
      const updatePayload = {
        businessName: storeData.storeName,
        storeDescription: storeData.storeDescription,
        storeLogo: storeData.storeLogo,
        storeBanner: storeData.storeBanner,
        location: storeData.address,
        phone: storeData.phone,
        storeWebsite: storeData.website,
        storeBusinessHours: storeData.businessHours,
        storeReturnPolicy: storeData.returnPolicy,
        storeShippingPolicy: storeData.shippingPolicy,
        storeResponseTime: storeData.responseTime,
        storeStatus: storeData.storeStatus,
        storeVacationMessage: storeData.vacationMessage,
        storeContactEmail: storeData.contactEmail,
        storeContactPhone: storeData.contactPhone,
        storeSocialLinks: storeData.socialLinks,
      };

      // Update in users store (primary source of truth)
      updateUser(user.id, updatePayload);

      // Update in auth store to keep in sync
      updateAuthUser(updatePayload);

      setHasUnsavedChanges(false);
      toast.success("Store settings saved successfully!");
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("Failed to save settings. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setStoreData(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  };

  const handleSocialLinkChange = (platform: string, value: string) => {
    setStoreData(prev => ({
      ...prev,
      socialLinks: { ...prev.socialLinks, [platform]: value }
    }));
    setHasUnsavedChanges(true);
  };

  const handleStoreStatusChange = (status: StoreStatus) => {
    setStoreData(prev => ({ ...prev, storeStatus: status }));
    setHasUnsavedChanges(true);
  };

  const getStatusBadge = (status: StoreStatus) => {
    switch (status) {
      case 'open':
        return <Badge className="bg-green-100 text-green-800"><Power className="w-3 h-3 mr-1" /> Open</Badge>;
      case 'closed':
        return <Badge className="bg-red-100 text-red-800"><PowerOff className="w-3 h-3 mr-1" /> Closed</Badge>;
      case 'vacation':
        return <Badge className="bg-amber-100 text-amber-800"><Palmtree className="w-3 h-3 mr-1" /> Vacation</Badge>;
    }
  };

  // Loading state
  if (!isHydrated) {
    return (
      <SiteLayout>
        <div className="container py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="w-12 h-12 animate-spin text-gray-400" />
          </div>
        </div>
      </SiteLayout>
    );
  }

  if (!isAuthenticated || !user || user.role !== "vendor") {
    return null;
  }

  return (
    <SiteLayout>
      <div className="container py-8">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link href="/vendor">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Dashboard
            </Link>
          </Button>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Store Settings</h1>
              <p className="text-muted-foreground text-sm sm:text-base">Manage store settings</p>
            </div>
            <div className="flex items-center gap-2">
              {hasUnsavedChanges && (
                <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 hidden sm:flex">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Unsaved
                </Badge>
              )}
              <Link href={`/vendor/${user.id}`} target="_blank">
                <Button variant="outline" size="sm">
                  <Eye className="w-4 h-4" />
                  <span className="hidden sm:inline ml-2">Preview</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3">
            <Tabs defaultValue="store" className="space-y-6">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="store">Store Info</TabsTrigger>
                <TabsTrigger value="status">Status</TabsTrigger>
                <TabsTrigger value="business">Business</TabsTrigger>
                <TabsTrigger value="notifications">Notifications</TabsTrigger>
                <TabsTrigger value="security">Security</TabsTrigger>
              </TabsList>

              {/* Store Information */}
              <TabsContent value="store" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Store Information</CardTitle>
                    <CardDescription>Basic information about your store that customers will see</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="storeName">Store Name *</Label>
                      <Input
                        id="storeName"
                        value={storeData.storeName}
                        onChange={(e) => handleInputChange("storeName", e.target.value)}
                        placeholder="Your store name"
                      />
                    </div>

                    <div>
                      <Label htmlFor="storeDescription">Store Description</Label>
                      <Textarea
                        id="storeDescription"
                        value={storeData.storeDescription}
                        onChange={(e) => handleInputChange("storeDescription", e.target.value)}
                        placeholder="Describe your store and what you sell..."
                        rows={4}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        This description appears on your store page and helps customers understand what you offer.
                      </p>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="contactPhone">Contact Phone *</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                          <Input
                            id="contactPhone"
                            value={storeData.contactPhone}
                            onChange={(e) => handleInputChange("contactPhone", e.target.value)}
                            className="pl-10"
                            placeholder="+233 XX XXX XXXX"
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="contactEmail">Contact Email *</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                          <Input
                            id="contactEmail"
                            value={storeData.contactEmail}
                            onChange={(e) => handleInputChange("contactEmail", e.target.value)}
                            className="pl-10"
                            placeholder="store@example.com"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <AddressAutocomplete
                        label="Business Address"
                        placeholder="Search for your business location..."
                        value={storeData.address}
                        onValueChange={(value) => handleInputChange("address", value)}
                        onAddressSelect={(details) => {
                          handleInputChange("address", details.formattedAddress);
                        }}
                        showCurrentLocation
                      />
                    </div>

                    <div>
                      <Label htmlFor="website">Website (Optional)</Label>
                      <div className="relative">
                        <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                          id="website"
                          value={storeData.website}
                          onChange={(e) => handleInputChange("website", e.target.value)}
                          className="pl-10"
                          placeholder="https://yourstore.com"
                        />
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <Label className="mb-3 block">Social Media Links</Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="relative">
                          <Facebook className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-600 w-4 h-4" />
                          <Input
                            value={storeData.socialLinks.facebook}
                            onChange={(e) => handleSocialLinkChange("facebook", e.target.value)}
                            className="pl-10"
                            placeholder="Facebook page URL"
                          />
                        </div>
                        <div className="relative">
                          <Instagram className="absolute left-3 top-1/2 transform -translate-y-1/2 text-pink-600 w-4 h-4" />
                          <Input
                            value={storeData.socialLinks.instagram}
                            onChange={(e) => handleSocialLinkChange("instagram", e.target.value)}
                            className="pl-10"
                            placeholder="Instagram profile URL"
                          />
                        </div>
                        <div className="relative">
                          <Twitter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sky-500 w-4 h-4" />
                          <Input
                            value={storeData.socialLinks.twitter}
                            onChange={(e) => handleSocialLinkChange("twitter", e.target.value)}
                            className="pl-10"
                            placeholder="Twitter profile URL"
                          />
                        </div>
                        <div className="relative">
                          <MessageCircle className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-600 w-4 h-4" />
                          <Input
                            value={storeData.socialLinks.whatsapp}
                            onChange={(e) => handleSocialLinkChange("whatsapp", e.target.value)}
                            className="pl-10"
                            placeholder="WhatsApp number (e.g., +233...)"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Store Images</CardTitle>
                    <CardDescription>Upload your store logo and banner for branding</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <Label className="mb-2 block">Store Logo</Label>
                      <ImageUpload
                        value={storeData.storeLogo}
                        onChange={(value) => handleInputChange("storeLogo", value)}
                        label="Upload Logo"
                        description="Recommended: 200x200px, PNG or JPG (max 5MB)"
                        aspectRatio="square"
                        className="max-w-[200px]"
                      />
                    </div>

                    <Separator />

                    <div>
                      <Label className="mb-2 block">Store Banner</Label>
                      <ImageUpload
                        value={storeData.storeBanner}
                        onChange={(value) => handleInputChange("storeBanner", value)}
                        label="Upload Banner"
                        description="Recommended: 1200x400px, PNG or JPG (max 5MB)"
                        aspectRatio="banner"
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Store Status Tab */}
              <TabsContent value="status" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Power className="w-5 h-5" />
                      Store Operating Status
                    </CardTitle>
                    <CardDescription>Control whether your store is open for orders</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium">Current Status:</span>
                      {getStatusBadge(storeData.storeStatus)}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card
                        className={`cursor-pointer transition-all ${storeData.storeStatus === 'open' ? 'ring-2 ring-green-500 bg-green-50' : 'hover:bg-gray-50'}`}
                        onClick={() => handleStoreStatusChange('open')}
                      >
                        <CardContent className="p-4 text-center">
                          <Power className="w-8 h-8 text-green-600 mx-auto mb-2" />
                          <h4 className="font-semibold text-green-800">Open</h4>
                          <p className="text-xs text-muted-foreground">
                            Customers can browse and order
                          </p>
                        </CardContent>
                      </Card>

                      <Card
                        className={`cursor-pointer transition-all ${storeData.storeStatus === 'closed' ? 'ring-2 ring-red-500 bg-red-50' : 'hover:bg-gray-50'}`}
                        onClick={() => handleStoreStatusChange('closed')}
                      >
                        <CardContent className="p-4 text-center">
                          <PowerOff className="w-8 h-8 text-red-600 mx-auto mb-2" />
                          <h4 className="font-semibold text-red-800">Closed</h4>
                          <p className="text-xs text-muted-foreground">
                            Store temporarily unavailable
                          </p>
                        </CardContent>
                      </Card>

                      <Card
                        className={`cursor-pointer transition-all ${storeData.storeStatus === 'vacation' ? 'ring-2 ring-amber-500 bg-amber-50' : 'hover:bg-gray-50'}`}
                        onClick={() => handleStoreStatusChange('vacation')}
                      >
                        <CardContent className="p-4 text-center">
                          <Palmtree className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                          <h4 className="font-semibold text-amber-800">Vacation</h4>
                          <p className="text-xs text-muted-foreground">
                            On break, with custom message
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    {storeData.storeStatus === 'vacation' && (
                      <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                        <Label htmlFor="vacationMessage">Vacation Message</Label>
                        <Textarea
                          id="vacationMessage"
                          value={storeData.vacationMessage}
                          onChange={(e) => handleInputChange("vacationMessage", e.target.value)}
                          placeholder="We're currently on vacation and will be back on [date]. Thank you for your patience!"
                          rows={3}
                          className="mt-2"
                        />
                        <p className="text-xs text-amber-700 mt-2">
                          This message will be displayed to customers visiting your store.
                        </p>
                      </div>
                    )}

                    {storeData.storeStatus === 'closed' && (
                      <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                        <div className="flex items-center gap-2 text-red-800 mb-2">
                          <AlertTriangle className="w-4 h-4" />
                          <span className="font-medium">Store is Closed</span>
                        </div>
                        <p className="text-sm text-red-700">
                          Customers will see your store but won't be able to place orders.
                          Products will still be visible but marked as unavailable.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Business Hours</CardTitle>
                    <CardDescription>Let customers know when you're available</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="businessHours">Operating Hours</Label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                          id="businessHours"
                          value={storeData.businessHours}
                          onChange={(e) => handleInputChange("businessHours", e.target.value)}
                          className="pl-10"
                          placeholder="Mon-Sat: 9:00 AM - 7:00 PM"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="responseTime">Expected Response Time</Label>
                      <Select
                        value={storeData.responseTime}
                        onValueChange={(value) => handleInputChange("responseTime", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select response time" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="< 1 hour">Within 1 hour</SelectItem>
                          <SelectItem value="< 4 hours">Within 4 hours</SelectItem>
                          <SelectItem value="< 24 hours">Within 24 hours</SelectItem>
                          <SelectItem value="1-2 days">1-2 business days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Business Settings */}
              <TabsContent value="business" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Store Policies</CardTitle>
                    <CardDescription>Set clear policies for your customers</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="returnPolicy">Return Policy</Label>
                      <Textarea
                        id="returnPolicy"
                        value={storeData.returnPolicy}
                        onChange={(e) => handleInputChange("returnPolicy", e.target.value)}
                        rows={3}
                        placeholder="Describe your return and refund policy..."
                      />
                    </div>

                    <div>
                      <Label htmlFor="shippingPolicy">Shipping Policy</Label>
                      <Textarea
                        id="shippingPolicy"
                        value={storeData.shippingPolicy}
                        onChange={(e) => handleInputChange("shippingPolicy", e.target.value)}
                        rows={3}
                        placeholder="Describe your shipping options, rates, and delivery times..."
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Order Management</CardTitle>
                    <CardDescription>Configure how you handle orders</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <Label>Auto-accept Orders</Label>
                        <p className="text-sm text-muted-foreground">
                          Automatically accept orders without manual review
                        </p>
                      </div>
                      <Switch
                        checked={storeData.autoAcceptOrders}
                        onCheckedChange={(checked) => handleInputChange("autoAcceptOrders", checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <Label>Require Order Confirmation</Label>
                        <p className="text-sm text-muted-foreground">
                          Send confirmation emails for each order
                        </p>
                      </div>
                      <Switch
                        checked={storeData.requireOrderConfirmation}
                        onCheckedChange={(checked) => handleInputChange("requireOrderConfirmation", checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <Label>Enable Instant Payouts</Label>
                        <p className="text-sm text-muted-foreground">
                          Receive payments immediately after order completion
                        </p>
                      </div>
                      <Switch
                        checked={storeData.enableInstantPayouts}
                        onCheckedChange={(checked) => handleInputChange("enableInstantPayouts", checked)}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Notifications */}
              <TabsContent value="notifications" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Notification Preferences</CardTitle>
                    <CardDescription>Choose how you want to receive notifications</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <Label>Email Notifications</Label>
                        <p className="text-sm text-muted-foreground">
                          Receive important updates via email
                        </p>
                      </div>
                      <Switch
                        checked={storeData.emailNotifications}
                        onCheckedChange={(checked) => handleInputChange("emailNotifications", checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <Label>SMS Notifications</Label>
                        <p className="text-sm text-muted-foreground">
                          Get alerts via SMS for urgent matters
                        </p>
                      </div>
                      <Switch
                        checked={storeData.smsNotifications}
                        onCheckedChange={(checked) => handleInputChange("smsNotifications", checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <Label>Order Alerts</Label>
                        <p className="text-sm text-muted-foreground">
                          Get notified when you receive new orders
                        </p>
                      </div>
                      <Switch
                        checked={storeData.orderAlerts}
                        onCheckedChange={(checked) => handleInputChange("orderAlerts", checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <Label>Low Stock Alerts</Label>
                        <p className="text-sm text-muted-foreground">
                          Get notified when products are running low
                        </p>
                      </div>
                      <Switch
                        checked={storeData.lowStockAlerts}
                        onCheckedChange={(checked) => handleInputChange("lowStockAlerts", checked)}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Security */}
              <TabsContent value="security" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Account Security</CardTitle>
                    <CardDescription>Manage your account security settings</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <div>
                          <Label>Password</Label>
                          <p className="text-sm text-muted-foreground">Last changed 3 months ago</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">Change</Button>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Shield className="w-5 h-5 text-orange-500" />
                        <div>
                          <Label>Two-Factor Authentication</Label>
                          <p className="text-sm text-muted-foreground">Add extra security to your account</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">Enable</Button>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <CreditCard className="w-5 h-5 text-gray-500" />
                        <div>
                          <Label>Payment Methods</Label>
                          <p className="text-sm text-muted-foreground">Manage your payout methods</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">Manage</Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Store Status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Store Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Operating:</span>
                  {getStatusBadge(storeData.storeStatus)}
                </div>
                <div className="flex items-center gap-2">
                  {user.verificationStatus === "verified" ? (
                    <>
                      <Shield className="w-4 h-4 text-green-600" />
                      <span className="text-sm">Verified Vendor</span>
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4 text-orange-500" />
                      <span className="text-sm">Pending Verification</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-gray-600" />
                  <span className="text-sm">Notifications Enabled</span>
                </div>
              </CardContent>
            </Card>

            {/* Save Button */}
            <Card className={hasUnsavedChanges ? 'ring-2 ring-amber-400' : ''}>
              <CardContent className="p-4">
                <Button
                  onClick={handleSave}
                  className="w-full"
                  disabled={isLoading}
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
                {hasUnsavedChanges && (
                  <p className="text-xs text-amber-600 text-center mt-2">
                    You have unsaved changes
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Preview Store */}
            <Card>
              <CardContent className="p-4">
                <Link href={`/vendor/${user.id}`} target="_blank">
                  <Button variant="outline" className="w-full">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View Public Store
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Help */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Need Help?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">
                  Having trouble with store settings? Contact our support team.
                </p>
                <Button variant="outline" size="sm" className="w-full">
                  Contact Support
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
