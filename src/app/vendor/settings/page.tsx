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
  AlertTriangle,
  Percent,
  Info,
  DollarSign
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  const [commissionData, setCommissionData] = useState<{
    grossSales: number;
    total: number;
    commission: number;
    commissionRate: number;
    commissionSource: 'vendor' | 'category' | 'default';
    pending: number;
    completed: number;
  } | null>(null);
  const [isLoadingCommission, setIsLoadingCommission] = useState(false);

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

  // Fetch commission data
  useEffect(() => {
    if (isHydrated && user && user.role === 'vendor') {
      setIsLoadingCommission(true);
      fetch('/api/vendor/stats', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          if (data.earnings) {
            setCommissionData({
              grossSales: data.earnings.grossSales || 0,
              total: data.earnings.total || 0,
              commission: data.earnings.commission || 0,
              commissionRate: data.earnings.commissionRate || 0.08,
              commissionSource: data.earnings.commissionSource || 'default',
              pending: data.earnings.pending || 0,
              completed: data.earnings.completed || 0
            });
          }
        })
        .catch(err => console.error('Failed to fetch commission data:', err))
        .finally(() => setIsLoadingCommission(false));
    }
  }, [isHydrated, user]);

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

      // Persist to database via API
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updatePayload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save settings');
      }

      // Update in users store (for UI sync)
      updateUser(user.id, updatePayload);

      // Update in auth store to keep in sync
      updateAuthUser(updatePayload);

      setHasUnsavedChanges(false);
      toast.success("Store settings saved successfully!");
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save settings. Please try again.");
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
              <TabsList className="flex w-full overflow-x-auto">
                <TabsTrigger value="store" className="flex-shrink-0">Store Info</TabsTrigger>
                <TabsTrigger value="commission" className="flex-shrink-0">Commission</TabsTrigger>
                <TabsTrigger value="status" className="flex-shrink-0">Status</TabsTrigger>
                <TabsTrigger value="business" className="flex-shrink-0">Business</TabsTrigger>
                <TabsTrigger value="notifications" className="flex-shrink-0">Notifications</TabsTrigger>
                <TabsTrigger value="security" className="flex-shrink-0">Security</TabsTrigger>
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

              {/* Commission Details Tab */}
              <TabsContent value="commission" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Percent className="w-5 h-5" />
                      Platform Commission Details
                    </CardTitle>
                    <CardDescription>
                      Understand your commission rate and how earnings are calculated
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {isLoadingCommission ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : commissionData ? (
                      <>
                        {/* Current Rate Card */}
                        <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Your Commission Rate</h3>
                            <Badge 
                              variant="outline" 
                              className={
                                commissionData.commissionSource === 'vendor' 
                                  ? 'text-green-600 border-green-600 bg-green-50' 
                                  : commissionData.commissionSource === 'category'
                                  ? 'text-blue-600 border-blue-600 bg-blue-50'
                                  : 'text-gray-600 border-gray-600 bg-gray-50'
                              }
                            >
                              {commissionData.commissionSource === 'vendor' 
                                ? 'Partner Rate'
                                : commissionData.commissionSource === 'category'
                                ? 'Category Rate'
                                : 'Standard Rate'
                              }
                            </Badge>
                          </div>
                          <div className="text-4xl font-bold text-blue-700 mb-2">
                            {(commissionData.commissionRate * 100).toFixed(0)}%
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {commissionData.commissionSource === 'vendor' 
                              ? 'You have a special partner rate negotiated for your account.'
                              : commissionData.commissionSource === 'category'
                              ? 'Your rate is based on the category of products you sell.'
                              : 'This is the standard marketplace commission rate.'
                            }
                          </p>
                        </div>

                        {/* What the fee covers */}
                        <Card className="border-l-4 border-l-amber-500">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Info className="w-4 h-4" />
                              What Does the Platform Fee Cover?
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ul className="space-y-2 text-sm">
                              <li className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                <span><strong>Payment Processing</strong> - Secure payment handling via Mobile Money and cards</span>
                              </li>
                              <li className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                <span><strong>Buyer Protection</strong> - Dispute resolution and refund management</span>
                              </li>
                              <li className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                <span><strong>Marketplace Services</strong> - Product listing, search, and discovery</span>
                              </li>
                              <li className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                <span><strong>Customer Support</strong> - 24/7 buyer and seller support</span>
                              </li>
                              <li className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                <span><strong>Platform Infrastructure</strong> - Hosting, security, and maintenance</span>
                              </li>
                            </ul>
                          </CardContent>
                        </Card>

                        {/* Earnings Summary */}
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                              <DollarSign className="w-4 h-4" />
                              Your Earnings Summary
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              <div className="flex justify-between items-center py-2 border-b">
                                <span className="text-sm text-muted-foreground">Gross Sales</span>
                                <span className="font-semibold">
                                  GHS {commissionData.grossSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div className="flex justify-between items-center py-2 border-b">
                                <span className="text-sm text-muted-foreground">
                                  Platform Fee ({(commissionData.commissionRate * 100).toFixed(0)}%)
                                </span>
                                <span className="font-semibold text-red-600">
                                  - GHS {commissionData.commission.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div className="flex justify-between items-center py-2 bg-green-50 -mx-4 px-4 rounded">
                                <span className="font-medium text-green-800">Your Total Earnings</span>
                                <span className="text-xl font-bold text-green-600">
                                  GHS {commissionData.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Commission Rate Tiers Explanation */}
                        <Card className="border-l-4 border-l-purple-500">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base">Commission Rate Tiers</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4 text-sm">
                              <div className="flex items-start gap-3">
                                <Badge variant="outline" className="text-green-600 border-green-600 mt-0.5">Partner</Badge>
                                <div>
                                  <p className="font-medium">Partner Rate</p>
                                  <p className="text-muted-foreground">Special rates negotiated for high-volume sellers or strategic partners. Contact us to learn more.</p>
                                </div>
                              </div>
                              <div className="flex items-start gap-3">
                                <Badge variant="outline" className="text-blue-600 border-blue-600 mt-0.5">Category</Badge>
                                <div>
                                  <p className="font-medium">Category Rate</p>
                                  <p className="text-muted-foreground">Some categories have different commission rates based on industry standards and margins.</p>
                                </div>
                              </div>
                              <div className="flex items-start gap-3">
                                <Badge variant="outline" className="text-gray-600 border-gray-600 mt-0.5">Standard</Badge>
                                <div>
                                  <p className="font-medium">Standard Rate</p>
                                  <p className="text-muted-foreground">The default marketplace rate applied to all vendors.</p>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>No commission data available yet.</p>
                        <p className="text-sm">Complete your first sale to see your earnings breakdown.</p>
                      </div>
                    )}
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
