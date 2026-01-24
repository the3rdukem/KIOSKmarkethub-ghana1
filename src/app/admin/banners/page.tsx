"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Image as ImageIcon,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Calendar,
  Link as LinkIcon,
  ExternalLink,
  MoreHorizontal,
  Lock,
  Loader2,
  GripVertical,
  Copy,
  ArrowUpDown,
  CheckCircle,
  XCircle,
  ArrowLeft
} from "lucide-react";
import { toast } from "sonner";
import { formatDistance, format } from "date-fns";
import { useAuthStore } from "@/lib/auth-store";
import { useSiteSettingsStore, PromotionalBanner, HeroBanner } from "@/lib/site-settings-store";
import { useProductsStore } from "@/lib/products-store";
import { useCategoriesStore } from "@/lib/categories-store";

type BannerLinkType = 'none' | 'product' | 'category' | 'store' | 'external';

interface BannerFormData {
  title: string;
  description: string;
  imageUrl: string;
  linkType: BannerLinkType;
  linkUrl: string;
  position: PromotionalBanner['position'];
  startDate: string;
  endDate: string;
  isActive: boolean;
  order: number;
}

const defaultBannerForm: BannerFormData = {
  title: "",
  description: "",
  imageUrl: "",
  linkType: "none",
  linkUrl: "",
  position: "top",
  startDate: "",
  endDate: "",
  isActive: true,
  order: 1,
};

export default function AdminBannersPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const {
    promotionalBanners,
    heroBanners,
    addPromotionalBanner,
    updatePromotionalBanner,
    deletePromotionalBanner,
    getActivePromotionalBanners,
    addHeroBanner,
    updateHeroBanner,
    deleteHeroBanner,
  } = useSiteSettingsStore();
  const { products } = useProductsStore();
  const { categories } = useCategoriesStore();

  const [isHydrated, setIsHydrated] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedBanner, setSelectedBanner] = useState<PromotionalBanner | null>(null);
  const [bannerType, setBannerType] = useState<'promo' | 'hero'>('promo');
  const [formData, setFormData] = useState<BannerFormData>(defaultBannerForm);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

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

  const resetForm = () => {
    setFormData(defaultBannerForm);
    setSelectedBanner(null);
  };

  const handleCreateBanner = () => {
    if (!user) return;
    if (!formData.title.trim()) {
      toast.error("Please enter a banner title");
      return;
    }

    addPromotionalBanner(
      {
        title: formData.title,
        description: formData.description,
        imageUrl: formData.imageUrl,
        linkUrl: formData.linkUrl,
        position: formData.position,
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
        isActive: formData.isActive,
        order: formData.order,
      },
      user.id,
      user.email || ""
    );

    toast.success("Banner created successfully!");
    setShowCreateDialog(false);
    resetForm();
  };

  const handleUpdateBanner = () => {
    if (!user || !selectedBanner) return;

    updatePromotionalBanner(
      selectedBanner.id,
      {
        title: formData.title,
        description: formData.description,
        imageUrl: formData.imageUrl,
        linkUrl: formData.linkUrl,
        position: formData.position,
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
        isActive: formData.isActive,
        order: formData.order,
      },
      user.id,
      user.email || ""
    );

    toast.success("Banner updated successfully!");
    setSelectedBanner(null);
    resetForm();
  };

  const handleDeleteBanner = (banner: PromotionalBanner) => {
    if (!user) return;
    deletePromotionalBanner(banner.id, user.id, user.email || "");
    toast.success("Banner deleted");
  };

  const handleToggleBanner = (banner: PromotionalBanner) => {
    if (!user) return;
    updatePromotionalBanner(
      banner.id,
      { isActive: !banner.isActive },
      user.id,
      user.email || ""
    );
    toast.success(banner.isActive ? "Banner disabled" : "Banner enabled");
  };

  const openEditDialog = (banner: PromotionalBanner) => {
    setSelectedBanner(banner);
    setFormData({
      title: banner.title,
      description: banner.description || "",
      imageUrl: banner.imageUrl || "",
      linkType: banner.linkUrl ? "external" : "none",
      linkUrl: banner.linkUrl || "",
      position: banner.position,
      startDate: banner.startDate || "",
      endDate: banner.endDate || "",
      isActive: banner.isActive,
      order: banner.order,
    });
  };

  const getBannerStatus = (banner: PromotionalBanner) => {
    if (!banner.isActive) return { label: "Disabled", color: "gray" };

    const now = new Date();
    if (banner.startDate && new Date(banner.startDate) > now) {
      return { label: "Scheduled", color: "blue" };
    }
    if (banner.endDate && new Date(banner.endDate) < now) {
      return { label: "Expired", color: "red" };
    }
    return { label: "Active", color: "green" };
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
          <p className="text-muted-foreground mb-4">Admin authentication required</p>
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
              Banner management is restricted to Master Administrators only.
            </AlertDescription>
          </Alert>
        </div>
      </SiteLayout>
    );
  }

  const activeBanners = getActivePromotionalBanners();

  return (
    <SiteLayout>
      <div className="container py-8">
        <div className="mb-8">
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
            <Link href="/admin">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Link>
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Promotional Banners</h1>
                <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                  Master Admin
                </Badge>
              </div>
              <p className="text-muted-foreground">
                Create and manage promotional banners displayed across the site
              </p>
            </div>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button onClick={() => resetForm()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Banner
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Promotional Banner</DialogTitle>
                <DialogDescription>
                  Add a new promotional banner to display on the site
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Banner Title *</Label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Summer Sale - Up to 50% Off!"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Position</Label>
                    <Select
                      value={formData.position}
                      onValueChange={(v) => setFormData({ ...formData, position: v as PromotionalBanner['position'] })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="top">Top Banner</SelectItem>
                        <SelectItem value="sidebar">Sidebar</SelectItem>
                        <SelectItem value="footer">Footer</SelectItem>
                        <SelectItem value="popup">Popup</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Shop now and save big on selected items..."
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Banner Image URL</Label>
                  <Input
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    placeholder="https://example.com/banner.jpg"
                  />
                  {formData.imageUrl && (
                    <div className="mt-2 border rounded-lg overflow-hidden">
                      <img
                        src={formData.imageUrl}
                        alt="Banner preview"
                        className="w-full h-32 object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/placeholder.jpg';
                        }}
                      />
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Link Type</Label>
                  <Select
                    value={formData.linkType}
                    onValueChange={(v) => setFormData({ ...formData, linkType: v as BannerLinkType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Link</SelectItem>
                      <SelectItem value="product">Link to Product</SelectItem>
                      <SelectItem value="category">Link to Category</SelectItem>
                      <SelectItem value="store">Link to Vendor Store</SelectItem>
                      <SelectItem value="external">External URL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.linkType === 'product' && (
                  <div className="space-y-2">
                    <Label>Select Product</Label>
                    <Select
                      value={formData.linkUrl}
                      onValueChange={(v) => setFormData({ ...formData, linkUrl: `/product/${v}` })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.slice(0, 20).map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {formData.linkType === 'category' && (
                  <div className="space-y-2">
                    <Label>Select Category</Label>
                    <Select
                      value={formData.linkUrl}
                      onValueChange={(v) => setFormData({ ...formData, linkUrl: `/search?category=${v}` })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.slug}>
                            {category.icon} {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {formData.linkType === 'external' && (
                  <div className="space-y-2">
                    <Label>External URL</Label>
                    <Input
                      value={formData.linkUrl}
                      onChange={(e) => setFormData({ ...formData, linkUrl: e.target.value })}
                      placeholder="https://example.com/promo"
                    />
                  </div>
                )}

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>
                      <Calendar className="w-4 h-4 inline mr-2" />
                      Start Date (Optional)
                    </Label>
                    <Input
                      type="datetime-local"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      <Calendar className="w-4 h-4 inline mr-2" />
                      End Date (Optional)
                    </Label>
                    <Input
                      type="datetime-local"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.isActive}
                      onCheckedChange={(v) => setFormData({ ...formData, isActive: v })}
                    />
                    <Label>Banner is active</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label>Display Order:</Label>
                    <Input
                      type="number"
                      value={formData.order}
                      onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 1 })}
                      className="w-20"
                      min={1}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
                <Button onClick={handleCreateBanner}>Create Banner</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Banners</p>
                  <p className="text-2xl font-bold">{promotionalBanners.length}</p>
                </div>
                <ImageIcon className="w-8 h-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Now</p>
                  <p className="text-2xl font-bold text-green-600">{activeBanners.length}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Scheduled</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {promotionalBanners.filter(b => b.startDate && new Date(b.startDate) > new Date()).length}
                  </p>
                </div>
                <Calendar className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Disabled</p>
                  <p className="text-2xl font-bold text-gray-600">
                    {promotionalBanners.filter(b => !b.isActive).length}
                  </p>
                </div>
                <XCircle className="w-8 h-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Banners Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Promotional Banners</CardTitle>
            <CardDescription>
              Manage banners displayed on the homepage and throughout the site
            </CardDescription>
          </CardHeader>
          <CardContent>
            {promotionalBanners.length === 0 ? (
              <div className="text-center py-12">
                <ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Banners Created</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first promotional banner to display on the site
                </p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Banner
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Banner</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Link</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {promotionalBanners.sort((a, b) => a.order - b.order).map((banner) => {
                    const status = getBannerStatus(banner);
                    return (
                      <TableRow key={banner.id}>
                        <TableCell>
                          <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {banner.imageUrl ? (
                              <img
                                src={banner.imageUrl}
                                alt={banner.title}
                                className="w-16 h-10 object-cover rounded border"
                              />
                            ) : (
                              <div className="w-16 h-10 bg-gray-100 rounded border flex items-center justify-center">
                                <ImageIcon className="w-4 h-4 text-gray-400" />
                              </div>
                            )}
                            <div>
                              <p className="font-medium">{banner.title}</p>
                              {banner.description && (
                                <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  {banner.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {banner.position}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {banner.linkUrl ? (
                            <div className="flex items-center gap-1 text-sm text-blue-600">
                              <LinkIcon className="w-3 h-3" />
                              <span className="truncate max-w-[150px]">{banner.linkUrl}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">No link</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs text-muted-foreground">
                            {banner.startDate && (
                              <div>From: {format(new Date(banner.startDate), "MMM d, yyyy")}</div>
                            )}
                            {banner.endDate && (
                              <div>Until: {format(new Date(banner.endDate), "MMM d, yyyy")}</div>
                            )}
                            {!banner.startDate && !banner.endDate && "Always"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={status.color === 'green' ? 'default' : 'secondary'}
                            className={
                              status.color === 'green' ? 'bg-green-100 text-green-800' :
                              status.color === 'blue' ? 'bg-blue-100 text-blue-800' :
                              status.color === 'red' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }
                          >
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(banner)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleBanner(banner)}>
                                {banner.isActive ? (
                                  <>
                                    <EyeOff className="w-4 h-4 mr-2" />
                                    Disable
                                  </>
                                ) : (
                                  <>
                                    <Eye className="w-4 h-4 mr-2" />
                                    Enable
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                navigator.clipboard.writeText(banner.id);
                                toast.success("Banner ID copied");
                              }}>
                                <Copy className="w-4 h-4 mr-2" />
                                Copy ID
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => handleDeleteBanner(banner)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={!!selectedBanner} onOpenChange={(open) => !open && setSelectedBanner(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Banner</DialogTitle>
              <DialogDescription>
                Update the promotional banner settings
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Banner Title *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Position</Label>
                  <Select
                    value={formData.position}
                    onValueChange={(v) => setFormData({ ...formData, position: v as PromotionalBanner['position'] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="top">Top Banner</SelectItem>
                      <SelectItem value="sidebar">Sidebar</SelectItem>
                      <SelectItem value="footer">Footer</SelectItem>
                      <SelectItem value="popup">Popup</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Banner Image URL</Label>
                <Input
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                />
                {formData.imageUrl && (
                  <div className="mt-2 border rounded-lg overflow-hidden">
                    <img
                      src={formData.imageUrl}
                      alt="Banner preview"
                      className="w-full h-32 object-cover"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Link URL</Label>
                <Input
                  value={formData.linkUrl}
                  onChange={(e) => setFormData({ ...formData, linkUrl: e.target.value })}
                  placeholder="/product/123 or https://example.com"
                />
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="datetime-local"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="datetime-local"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={(v) => setFormData({ ...formData, isActive: v })}
                  />
                  <Label>Banner is active</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Label>Display Order:</Label>
                  <Input
                    type="number"
                    value={formData.order}
                    onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 1 })}
                    className="w-20"
                    min={1}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedBanner(null)}>Cancel</Button>
              <Button onClick={handleUpdateBanner}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SiteLayout>
  );
}
