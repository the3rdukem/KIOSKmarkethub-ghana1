"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Palette,
  Image as ImageIcon,
  Type,
  Globe,
  Phone,
  Mail,
  MapPin,
  Save,
  RefreshCw,
  CheckCircle,
  Lock,
  Loader2,
  Upload,
  Trash2,
  Eye,
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  Youtube
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/auth-store";
import { useSiteSettingsStore, SiteBranding } from "@/lib/site-settings-store";

export default function AdminBrandingPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const {
    branding,
    updateBranding,
    getBranding,
    auditLogs,
    getAuditLogs
  } = useSiteSettingsStore();

  const [isHydrated, setIsHydrated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Local form state
  const [formData, setFormData] = useState<SiteBranding>({
    siteName: "",
    tagline: "",
    logoUrl: "",
    logoAltText: "",
    faviconUrl: "",
    primaryColor: "#16a34a",
    secondaryColor: "#2563eb",
    accentColor: "#f59e0b",
    footerText: "",
    copyrightText: "",
    socialLinks: {},
    contactEmail: "",
    contactPhone: "",
    contactAddress: "",
  });

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated) {
      setFormData(branding);
    }
  }, [isHydrated, branding]);

  useEffect(() => {
    if (!isHydrated) return;

    if (!isAuthenticated) {
      router.push("/admin/login");
      return;
    }
    if (user?.role !== "admin" && user?.role !== "master_admin") {
      toast.error("Access denied. Admin privileges required.");
      router.push("/");
    }
  }, [isAuthenticated, user, router, isHydrated]);

  const isMasterAdmin = user?.role === 'master_admin' || user?.adminRole === 'MASTER_ADMIN';

  const handleInputChange = (field: keyof SiteBranding, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSocialLinkChange = (platform: keyof SiteBranding['socialLinks'], value: string) => {
    setFormData(prev => ({
      ...prev,
      socialLinks: { ...prev.socialLinks, [platform]: value }
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      updateBranding(formData, user.id, user.email || "");
      setHasChanges(false);
      toast.success("Branding settings saved successfully!");
    } catch (error) {
      toast.error("Failed to save branding settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setFormData(branding);
    setHasChanges(false);
    toast.info("Changes discarded");
  };

  if (!isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-green-600 mx-auto mb-4 animate-spin" />
          <h2 className="text-xl font-semibold mb-2">Loading...</h2>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || (user?.role !== "admin" && user?.role !== "master_admin")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Lock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
          <p className="text-muted-foreground mb-4">Master Admin authentication required</p>
          <Button onClick={() => router.push("/admin/login")}>Go to Admin Login</Button>
        </div>
      </div>
    );
  }

  if (!isMasterAdmin) {
    return (
      <SiteLayout>
        <div className="container py-8">
          <Alert className="border-amber-200 bg-amber-50">
            <Lock className="w-4 h-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              Branding management is restricted to Master Administrators only.
            </AlertDescription>
          </Alert>
        </div>
      </SiteLayout>
    );
  }

  const recentLogs = getAuditLogs('branding').slice(0, 10);

  return (
    <SiteLayout>
      <div className="container py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">Site Branding</h1>
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                Master Admin
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Manage your marketplace's visual identity and branding
            </p>
          </div>
          <div className="flex items-center gap-3">
            {hasChanges && (
              <Badge variant="outline" className="text-amber-600 border-amber-300">
                Unsaved Changes
              </Badge>
            )}
            <Button variant="outline" onClick={handleReset} disabled={!hasChanges}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Reset
            </Button>
            <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </div>

        <Tabs defaultValue="identity" className="space-y-6">
          <TabsList>
            <TabsTrigger value="identity">
              <Type className="w-4 h-4 mr-2" />
              Identity
            </TabsTrigger>
            <TabsTrigger value="logo">
              <ImageIcon className="w-4 h-4 mr-2" />
              Logo & Images
            </TabsTrigger>
            <TabsTrigger value="colors">
              <Palette className="w-4 h-4 mr-2" />
              Colors
            </TabsTrigger>
            <TabsTrigger value="contact">
              <Mail className="w-4 h-4 mr-2" />
              Contact Info
            </TabsTrigger>
            <TabsTrigger value="social">
              <Globe className="w-4 h-4 mr-2" />
              Social Links
            </TabsTrigger>
          </TabsList>

          {/* Identity Tab */}
          <TabsContent value="identity" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Site Identity</CardTitle>
                <CardDescription>
                  Configure your marketplace name and tagline
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="siteName">Site Name</Label>
                    <Input
                      id="siteName"
                      value={formData.siteName}
                      onChange={(e) => handleInputChange('siteName', e.target.value)}
                      placeholder="KIOSK"
                    />
                    <p className="text-xs text-muted-foreground">
                      This appears in the header and browser tab
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tagline">Tagline</Label>
                    <Input
                      id="tagline"
                      value={formData.tagline}
                      onChange={(e) => handleInputChange('tagline', e.target.value)}
                      placeholder="Ghana's Trusted Marketplace"
                    />
                    <p className="text-xs text-muted-foreground">
                      Appears below the site name in some areas
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="footerText">Footer Description</Label>
                  <Textarea
                    id="footerText"
                    value={formData.footerText}
                    onChange={(e) => handleInputChange('footerText', e.target.value)}
                    placeholder="Your trusted marketplace for quality products..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="copyrightText">Copyright Text</Label>
                  <Input
                    id="copyrightText"
                    value={formData.copyrightText}
                    onChange={(e) => handleInputChange('copyrightText', e.target.value)}
                    placeholder="© 2024 KIOSK. All rights reserved."
                  />
                </div>
              </CardContent>
            </Card>

            {/* Live Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Live Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg p-6 bg-gray-50">
                  <div className="flex items-center gap-3 mb-4">
                    {formData.logoUrl ? (
                      <img src={formData.logoUrl} alt={formData.logoAltText || formData.siteName} className="h-10" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-bold">
                        {formData.siteName.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-xl">{formData.siteName || "Site Name"}</h3>
                      <p className="text-sm text-muted-foreground">{formData.tagline || "Your tagline here"}</p>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground border-t pt-4">
                    {formData.footerText || "Footer description will appear here..."}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    {formData.copyrightText || "© Copyright text"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Logo & Images Tab */}
          <TabsContent value="logo" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Logo & Favicon</CardTitle>
                <CardDescription>
                  Upload your brand logo and favicon
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <Label>Site Logo</Label>
                    <div className="border-2 border-dashed rounded-lg p-8 text-center bg-gray-50">
                      {formData.logoUrl ? (
                        <div className="space-y-4">
                          <img
                            src={formData.logoUrl}
                            alt="Logo preview"
                            className="max-h-20 mx-auto"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleInputChange('logoUrl', '')}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <div>
                          <Upload className="w-10 h-10 mx-auto text-gray-400 mb-3" />
                          <p className="text-sm text-muted-foreground mb-3">
                            Enter a URL for your logo
                          </p>
                        </div>
                      )}
                    </div>
                    <Input
                      placeholder="https://example.com/logo.png"
                      value={formData.logoUrl || ""}
                      onChange={(e) => handleInputChange('logoUrl', e.target.value)}
                    />
                    <Input
                      placeholder="Logo alt text"
                      value={formData.logoAltText || ""}
                      onChange={(e) => handleInputChange('logoAltText', e.target.value)}
                    />
                  </div>

                  <div className="space-y-4">
                    <Label>Favicon</Label>
                    <div className="border-2 border-dashed rounded-lg p-8 text-center bg-gray-50">
                      {formData.faviconUrl ? (
                        <div className="space-y-4">
                          <img
                            src={formData.faviconUrl}
                            alt="Favicon preview"
                            className="w-8 h-8 mx-auto"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleInputChange('faviconUrl', '')}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <div>
                          <ImageIcon className="w-10 h-10 mx-auto text-gray-400 mb-3" />
                          <p className="text-sm text-muted-foreground mb-3">
                            Enter a URL for your favicon (32x32px)
                          </p>
                        </div>
                      )}
                    </div>
                    <Input
                      placeholder="https://example.com/favicon.ico"
                      value={formData.faviconUrl || ""}
                      onChange={(e) => handleInputChange('faviconUrl', e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Colors Tab */}
          <TabsContent value="colors" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Brand Colors</CardTitle>
                <CardDescription>
                  Define your marketplace color palette
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <Label>Primary Color</Label>
                    <div className="flex gap-3">
                      <div
                        className="w-16 h-16 rounded-lg border cursor-pointer"
                        style={{ backgroundColor: formData.primaryColor }}
                      >
                        <input
                          type="color"
                          value={formData.primaryColor}
                          onChange={(e) => handleInputChange('primaryColor', e.target.value)}
                          className="w-full h-full opacity-0 cursor-pointer"
                        />
                      </div>
                      <div className="flex-1">
                        <Input
                          value={formData.primaryColor}
                          onChange={(e) => handleInputChange('primaryColor', e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Main brand color (buttons, links)
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Secondary Color</Label>
                    <div className="flex gap-3">
                      <div
                        className="w-16 h-16 rounded-lg border cursor-pointer"
                        style={{ backgroundColor: formData.secondaryColor }}
                      >
                        <input
                          type="color"
                          value={formData.secondaryColor}
                          onChange={(e) => handleInputChange('secondaryColor', e.target.value)}
                          className="w-full h-full opacity-0 cursor-pointer"
                        />
                      </div>
                      <div className="flex-1">
                        <Input
                          value={formData.secondaryColor}
                          onChange={(e) => handleInputChange('secondaryColor', e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Secondary actions and accents
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Accent Color</Label>
                    <div className="flex gap-3">
                      <div
                        className="w-16 h-16 rounded-lg border cursor-pointer"
                        style={{ backgroundColor: formData.accentColor }}
                      >
                        <input
                          type="color"
                          value={formData.accentColor}
                          onChange={(e) => handleInputChange('accentColor', e.target.value)}
                          className="w-full h-full opacity-0 cursor-pointer"
                        />
                      </div>
                      <div className="flex-1">
                        <Input
                          value={formData.accentColor}
                          onChange={(e) => handleInputChange('accentColor', e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Highlights and special elements
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Color Preview */}
                <div className="space-y-4">
                  <Label>Color Preview</Label>
                  <div className="flex gap-4 flex-wrap">
                    <Button style={{ backgroundColor: formData.primaryColor }}>
                      Primary Button
                    </Button>
                    <Button style={{ backgroundColor: formData.secondaryColor }}>
                      Secondary Button
                    </Button>
                    <Button variant="outline" style={{ borderColor: formData.accentColor, color: formData.accentColor }}>
                      Accent Outline
                    </Button>
                    <Badge style={{ backgroundColor: formData.primaryColor }}>
                      Primary Badge
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contact Tab */}
          <TabsContent value="contact" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
                <CardDescription>
                  Display contact details across the site
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="contactEmail">
                      <Mail className="w-4 h-4 inline mr-2" />
                      Contact Email
                    </Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      value={formData.contactEmail}
                      onChange={(e) => handleInputChange('contactEmail', e.target.value)}
                      placeholder="support@markethub.gh"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contactPhone">
                      <Phone className="w-4 h-4 inline mr-2" />
                      Contact Phone
                    </Label>
                    <Input
                      id="contactPhone"
                      value={formData.contactPhone}
                      onChange={(e) => handleInputChange('contactPhone', e.target.value)}
                      placeholder="+233 XX XXX XXXX"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactAddress">
                    <MapPin className="w-4 h-4 inline mr-2" />
                    Business Address
                  </Label>
                  <Textarea
                    id="contactAddress"
                    value={formData.contactAddress}
                    onChange={(e) => handleInputChange('contactAddress', e.target.value)}
                    placeholder="123 Main Street, Accra, Ghana"
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Social Links Tab */}
          <TabsContent value="social" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Social Media Links</CardTitle>
                <CardDescription>
                  Connect your social media profiles
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
                      <Facebook className="w-5 h-5 text-white" />
                    </div>
                    <Input
                      placeholder="https://facebook.com/yourpage"
                      value={formData.socialLinks.facebook || ""}
                      onChange={(e) => handleSocialLinkChange('facebook', e.target.value)}
                      className="flex-1"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-sky-500 flex items-center justify-center">
                      <Twitter className="w-5 h-5 text-white" />
                    </div>
                    <Input
                      placeholder="https://twitter.com/yourhandle"
                      value={formData.socialLinks.twitter || ""}
                      onChange={(e) => handleSocialLinkChange('twitter', e.target.value)}
                      className="flex-1"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center">
                      <Instagram className="w-5 h-5 text-white" />
                    </div>
                    <Input
                      placeholder="https://instagram.com/yourhandle"
                      value={formData.socialLinks.instagram || ""}
                      onChange={(e) => handleSocialLinkChange('instagram', e.target.value)}
                      className="flex-1"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-700 flex items-center justify-center">
                      <Linkedin className="w-5 h-5 text-white" />
                    </div>
                    <Input
                      placeholder="https://linkedin.com/company/yourcompany"
                      value={formData.socialLinks.linkedin || ""}
                      onChange={(e) => handleSocialLinkChange('linkedin', e.target.value)}
                      className="flex-1"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-600 flex items-center justify-center">
                      <Youtube className="w-5 h-5 text-white" />
                    </div>
                    <Input
                      placeholder="https://youtube.com/c/yourchannel"
                      value={formData.socialLinks.youtube || ""}
                      onChange={(e) => handleSocialLinkChange('youtube', e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Recent Changes */}
        {recentLogs.length > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="text-sm">Recent Branding Changes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentLogs.map((log) => (
                  <div key={log.id} className="flex items-center gap-3 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-muted-foreground">
                      {log.details} • {new Date(log.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </SiteLayout>
  );
}
