"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  Save,
  CheckCircle,
  AlertTriangle,
  Package,
  Loader2,
  ImageIcon,
  Tag,
  Percent,
  TrendingDown,
  Zap,
  ExternalLink,
  Clock,
  DollarSign
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { useProductsStore } from "@/lib/products-store";
import { usePromotionsStore, Sale } from "@/lib/promotions-store";
import { MultiImageUpload } from "@/components/ui/image-upload";
import { toast } from "sonner";
import { format } from "date-fns";

const categories = [
  "Electronics",
  "Fashion & Clothing",
  "Home & Garden",
  "Sports & Outdoors",
  "Health & Beauty",
  "Books & Media",
  "Toys & Games",
  "Automotive",
  "Food & Beverages",
  "Jewelry & Accessories",
  "Arts & Crafts",
  "Other"
];

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  const { user, isAuthenticated } = useAuthStore();
  const { updateProduct } = useProductsStore();
  const { getSalesByVendor, getSalePrice, updateSale, getActiveSales } = usePromotionsStore();

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProduct, setIsLoadingProduct] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isHydrated, setIsHydrated] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);
  const [productImages, setProductImages] = useState<string[]>([]);

  const [productData, setProductData] = useState({
    name: "",
    description: "",
    category: "",
    price: "",
    comparePrice: "",
    costPerItem: "",
    sku: "",
    barcode: "",
    quantity: "",
    trackQuantity: true,
    tags: "",
    status: "active" as "active" | "draft" | "archived"
  });

  // Hydration check
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Load product data from API
  useEffect(() => {
    if (!isHydrated) return;

    // Check authentication
    if (!isAuthenticated || !user) {
      router.push("/auth/login");
      return;
    }

    // Check if user is a vendor
    if (user.role !== "vendor") {
      router.push("/");
      return;
    }

    // Fetch the product from API
    const fetchProduct = async () => {
      try {
        const response = await fetch(`/api/products/${productId}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          if (response.status === 404) {
            setNotFound(true);
          } else {
            toast.error('Failed to load product');
          }
          setIsLoadingProduct(false);
          return;
        }

        const data = await response.json();
        const product = data.product;

        if (!product) {
          setNotFound(true);
          setIsLoadingProduct(false);
          return;
        }

        // Check vendor ownership
        if (product.vendorId !== user.id) {
          setUnauthorized(true);
          setIsLoadingProduct(false);
          return;
        }

        // Pre-fill form with real product data - NULL-SAFE initialization
        setProductData({
          name: product.name ?? "",
          description: product.description ?? "",
          category: product.category ?? "",
          price: product.price != null ? String(product.price) : "",
          comparePrice: product.comparePrice != null ? String(product.comparePrice) : "",
          costPerItem: product.costPerItem != null ? String(product.costPerItem) : "",
          sku: product.sku ?? "",
          barcode: product.barcode ?? "",
          quantity: product.quantity != null ? String(product.quantity) : "",
          trackQuantity: product.trackQuantity ?? true,
          tags: Array.isArray(product.tags) ? product.tags.join(", ") : "",
          status: (product.status === 'active' || product.status === 'draft' || product.status === 'archived') ? product.status : 'draft'
        });

        // Load existing product images - NULL-SAFE
        setProductImages(Array.isArray(product.images) ? product.images : []);

        setIsLoadingProduct(false);
      } catch (error) {
        console.error('Error fetching product:', error);
        toast.error('Failed to load product');
        setIsLoadingProduct(false);
      }
    };

    fetchProduct();
  }, [isHydrated, isAuthenticated, user, productId, router]);

  // Get vendor's sales for promotional pricing
  const vendorSales = isHydrated && user ? getSalesByVendor(user.id) : [];
  const activeSales = isHydrated && user ? getActiveSales(user.id) : [];

  // Check if product is currently on sale
  const currentPrice = productData.price ? parseFloat(productData.price) : 0;
  const { salePrice, discount, sale: activeSale } = isHydrated ? getSalePrice(productId, currentPrice) : { salePrice: currentPrice, discount: 0, sale: undefined };
  const isOnSale = discount > 0;

  // Handle adding/removing product from a sale
  const handleSaleToggle = (sale: Sale) => {
    const isInSale = sale.productIds.includes(productId);
    const newProductIds = isInSale
      ? sale.productIds.filter(id => id !== productId)
      : [...sale.productIds, productId];

    updateSale(sale.id, { productIds: newProductIds });

    if (isInSale) {
      toast.success(`Removed from "${sale.name}"`);
    } else {
      toast.success(`Added to "${sale.name}"`);
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setProductData(prev => ({ ...prev, [field]: value }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = (forPublish: boolean) => {
    const newErrors: Record<string, string> = {};

    // NULL-SAFE validation - coerce to string before trim
    const name = (productData.name || "").trim();
    const description = (productData.description || "").trim();
    const category = productData.category || "";
    const price = productData.price || "";
    const quantity = productData.quantity || "";

    // Draft saves only require a name
    if (!name) {
      newErrors.name = "Product name is required";
    }

    // Full validation only for publish
    if (forPublish) {
      if (!description) newErrors.description = "Product description is required";
      if (!category) newErrors.category = "Category is required";
      if (!price) {
        newErrors.price = "Price is required";
      } else if (Number.isNaN(Number(price)) || Number(price) <= 0) {
        newErrors.price = "Price must be a valid positive number";
      }
      if (productData.trackQuantity && !quantity) {
        newErrors.quantity = "Quantity is required when tracking inventory";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent, status: "draft" | "active") => {
    e.preventDefault();

    // Draft saves skip full validation, only require name
    const forPublish = status === "active";
    if (!validateForm(forPublish)) return;

    setIsLoading(true);

    try {
      // NULL-SAFE: Parse tags with fallback
      const tagsString = productData.tags || "";
      const tagsArray = tagsString
        .split(",")
        .map(tag => (tag || "").trim())
        .filter(tag => tag.length > 0);

      // NULL-SAFE: Parse numeric values
      const name = (productData.name || "").trim();
      const description = (productData.description || "").trim();
      const sku = (productData.sku || "").trim();
      const barcode = (productData.barcode || "").trim();
      const priceValue = productData.price ? Number.parseFloat(productData.price) : 0;
      const comparePriceValue = productData.comparePrice ? Number.parseFloat(productData.comparePrice) : undefined;
      const costPerItemValue = productData.costPerItem ? Number.parseFloat(productData.costPerItem) : undefined;
      const quantityValue = productData.quantity ? Number.parseInt(productData.quantity, 10) : 0;

      // Update the product via API
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name,
          description,
          category: productData.category || "",
          price: priceValue,
          comparePrice: comparePriceValue,
          costPerItem: costPerItemValue,
          sku: sku || undefined,
          barcode: barcode || undefined,
          quantity: productData.trackQuantity ? quantityValue : 0,
          trackQuantity: productData.trackQuantity ?? true,
          images: productImages,
          tags: tagsArray,
          status
        }),
      });

      if (response.ok) {
        toast.success(`Product "${name}" updated successfully!`);
        router.push("/vendor/products");
      } else {
        const data = await response.json();
        if (data.code === 'VENDOR_NOT_VERIFIED' && status === 'active') {
          toast.error("Your vendor account must be verified to publish products");
          setErrors({ submit: data.details || "Vendor verification required" });
        } else {
          toast.error(data.error || "Failed to update product");
          setErrors({ submit: data.error || "Failed to update product" });
        }
      }
    } catch (error) {
      console.error("Update product error:", error);
      setErrors({ submit: "Failed to update product. Please try again." });
      toast.error("Failed to update product");
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state
  if (!isHydrated || isLoadingProduct) {
    return (
      <SiteLayout>
        <div className="container py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin text-gray-400 mx-auto mb-4" />
              <p className="text-lg text-gray-600">Loading product...</p>
            </div>
          </div>
        </div>
      </SiteLayout>
    );
  }

  // Not found state
  if (notFound) {
    return (
      <SiteLayout>
        <div className="container py-8">
          <div className="text-center py-16">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Product Not Found</h2>
            <p className="text-muted-foreground mb-6">
              The product you're looking for doesn't exist or has been deleted.
            </p>
            <Button onClick={() => router.push("/vendor/products")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Products
            </Button>
          </div>
        </div>
      </SiteLayout>
    );
  }

  // Unauthorized state
  if (unauthorized) {
    return (
      <SiteLayout>
        <div className="container py-8">
          <div className="text-center py-16">
            <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Unauthorized</h2>
            <p className="text-muted-foreground mb-6">
              You don't have permission to edit this product.
            </p>
            <Button onClick={() => router.push("/vendor/products")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Products
            </Button>
          </div>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className="container py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/vendor/products">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Products
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Edit Product</h1>
            <p className="text-muted-foreground">Update your product information</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Product Information</CardTitle>
                <CardDescription>Update your product details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name">Product Name *</Label>
                  <Input
                    id="name"
                    value={productData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder="Enter product name"
                    className={errors.name ? "border-red-500" : ""}
                  />
                  {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                </div>

                <div>
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    value={productData.description}
                    onChange={(e) => handleInputChange("description", e.target.value)}
                    placeholder="Describe your product in detail"
                    rows={6}
                    className={errors.description ? "border-red-500" : ""}
                  />
                  {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
                </div>

                <div>
                  <Label htmlFor="category">Category *</Label>
                  <Select value={productData.category} onValueChange={(value) => handleInputChange("category", value)}>
                    <SelectTrigger className={errors.category ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category}</p>}
                </div>

                <div>
                  <Label htmlFor="tags">Tags (comma-separated)</Label>
                  <Input
                    id="tags"
                    value={productData.tags}
                    onChange={(e) => handleInputChange("tags", e.target.value)}
                    placeholder="e.g. new arrival, best seller, premium"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Product Images */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5" />
                  Product Images
                </CardTitle>
                <CardDescription>
                  Upload up to 5 product images. The first image will be used as the main product image.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MultiImageUpload
                  values={productImages}
                  onChange={setProductImages}
                  maxImages={5}
                  maxSizeMB={5}
                />
              </CardContent>
            </Card>

            {/* Pricing */}
            <Card>
              <CardHeader>
                <CardTitle>Pricing</CardTitle>
                <CardDescription>Update your product pricing</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="price">Price (GHS) *</Label>
                    <Input
                      id="price"
                      type="number"
                      value={productData.price}
                      onChange={(e) => handleInputChange("price", e.target.value)}
                      placeholder="0.00"
                      className={errors.price ? "border-red-500" : ""}
                      min="0"
                      step="0.01"
                    />
                    {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price}</p>}
                  </div>

                  <div>
                    <Label htmlFor="comparePrice">Compare at Price (GHS)</Label>
                    <Input
                      id="comparePrice"
                      type="number"
                      value={productData.comparePrice}
                      onChange={(e) => handleInputChange("comparePrice", e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                    />
                  </div>

                  <div>
                    <Label htmlFor="costPerItem">Cost per Item (GHS)</Label>
                    <Input
                      id="costPerItem"
                      type="number"
                      value={productData.costPerItem}
                      onChange={(e) => handleInputChange("costPerItem", e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Promotional Pricing - NEW SECTION */}
            <Card className={isOnSale ? "border-red-200 bg-red-50/30" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="w-5 h-5 text-red-600" />
                  Promotional Pricing
                  {isOnSale && (
                    <Badge className="ml-2 bg-red-500 text-white">
                      <Zap className="w-3 h-3 mr-1" />
                      On Sale
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Add this product to sales and promotions to offer discounts
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Current Sale Status */}
                {isOnSale && activeSale && (
                  <div className="p-4 bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingDown className="w-5 h-5 text-red-600" />
                          <span className="font-semibold text-red-800">Currently in: {activeSale.name}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Original Price:</span>
                            <span className="ml-2 line-through text-gray-500">GHS {currentPrice.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Sale Price:</span>
                            <span className="ml-2 font-bold text-red-600">GHS {salePrice.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Discount:</span>
                            <span className="ml-2 font-medium text-green-600">
                              {activeSale.discountType === 'percentage'
                                ? `${activeSale.discountValue}% OFF`
                                : `GHS ${activeSale.discountValue} OFF`
                              }
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-gray-500" />
                            <span className="text-gray-600">Ends:</span>
                            <span className="ml-1 text-gray-700">{format(new Date(activeSale.endDate), "MMM d, yyyy")}</span>
                          </div>
                        </div>
                      </div>
                      <Badge className="bg-green-100 text-green-800 border-green-200">
                        <Percent className="w-3 h-3 mr-1" />
                        -{Math.round((discount / currentPrice) * 100)}%
                      </Badge>
                    </div>
                  </div>
                )}

                {/* Price Preview Card */}
                {currentPrice > 0 && (
                  <div className="p-4 bg-gray-50 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Price customers will see:</p>
                        <div className="flex items-baseline gap-3">
                          <span className="text-2xl font-bold text-gray-900">
                            GHS {salePrice.toFixed(2)}
                          </span>
                          {isOnSale && (
                            <span className="text-lg text-gray-400 line-through">
                              GHS {currentPrice.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        {isOnSale ? (
                          <div className="flex items-center gap-2 text-green-600">
                            <DollarSign className="w-5 h-5" />
                            <span className="text-lg font-medium">Saving GHS {discount.toFixed(2)}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">No active promotions</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <Separator />

                {/* Available Sales to Add Product To */}
                <div>
                  <Label className="text-base font-medium mb-3 block">Add to Sales</Label>
                  {vendorSales.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed">
                      <Tag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-600 mb-2">No sales created yet</p>
                      <p className="text-sm text-gray-500 mb-4">Create sales to offer discounts on this product</p>
                      <Button variant="outline" size="sm" asChild>
                        <Link href="/vendor/promotions">
                          <Tag className="w-4 h-4 mr-2" />
                          Create a Sale
                          <ExternalLink className="w-3 h-3 ml-2" />
                        </Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {vendorSales.map((sale) => {
                        const isInSale = sale.productIds.includes(productId);
                        const isActive = sale.status === 'active';
                        const isExpired = sale.status === 'expired';
                        const isScheduled = sale.status === 'scheduled';

                        return (
                          <div
                            key={sale.id}
                            className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                              isInSale
                                ? 'bg-red-50 border-red-200'
                                : 'bg-white border-gray-200 hover:bg-gray-50'
                            } ${isExpired ? 'opacity-50' : ''}`}
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={isInSale}
                                onCheckedChange={() => handleSaleToggle(sale)}
                                disabled={isExpired}
                              />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{sale.name}</span>
                                  {isActive && (
                                    <Badge className="bg-green-100 text-green-800 text-xs">Active</Badge>
                                  )}
                                  {isScheduled && (
                                    <Badge className="bg-blue-100 text-blue-800 text-xs">Scheduled</Badge>
                                  )}
                                  {isExpired && (
                                    <Badge className="bg-gray-100 text-gray-600 text-xs">Expired</Badge>
                                  )}
                                </div>
                                <p className="text-sm text-gray-500">
                                  {sale.discountType === 'percentage'
                                    ? `${sale.discountValue}% off`
                                    : `GHS ${sale.discountValue} off`
                                  }
                                  {' · '}
                                  {format(new Date(sale.startDate), "MMM d")} - {format(new Date(sale.endDate), "MMM d, yyyy")}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              {isInSale && !isExpired && (
                                <div className="text-sm">
                                  <span className="text-gray-500">Sale price: </span>
                                  <span className="font-medium text-red-600">
                                    GHS {(currentPrice - (sale.discountType === 'percentage'
                                      ? (currentPrice * sale.discountValue / 100)
                                      : sale.discountValue
                                    )).toFixed(2)}
                                  </span>
                                </div>
                              )}
                              <span className="text-xs text-gray-400">{sale.productIds.length} products</span>
                            </div>
                          </div>
                        );
                      })}

                      <div className="pt-2">
                        <Button variant="outline" size="sm" className="w-full" asChild>
                          <Link href="/vendor/promotions">
                            <Tag className="w-4 h-4 mr-2" />
                            Manage All Promotions
                            <ExternalLink className="w-3 h-3 ml-2" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Inventory */}
            <Card>
              <CardHeader>
                <CardTitle>Inventory</CardTitle>
                <CardDescription>Manage your product inventory</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Track Quantity</Label>
                    <p className="text-sm text-muted-foreground">Enable inventory tracking for this product</p>
                  </div>
                  <Switch
                    checked={productData.trackQuantity}
                    onCheckedChange={(checked) => handleInputChange("trackQuantity", checked)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="sku">SKU</Label>
                    <Input
                      id="sku"
                      value={productData.sku}
                      onChange={(e) => handleInputChange("sku", e.target.value)}
                      placeholder="SKU-123"
                    />
                  </div>

                  <div>
                    <Label htmlFor="barcode">Barcode</Label>
                    <Input
                      id="barcode"
                      value={productData.barcode}
                      onChange={(e) => handleInputChange("barcode", e.target.value)}
                      placeholder="Barcode number"
                    />
                  </div>

                  <div>
                    <Label htmlFor="quantity">Quantity {productData.trackQuantity ? "*" : ""}</Label>
                    <Input
                      id="quantity"
                      type="number"
                      value={productData.quantity}
                      onChange={(e) => handleInputChange("quantity", e.target.value)}
                      placeholder="0"
                      min="0"
                      disabled={!productData.trackQuantity}
                      className={errors.quantity ? "border-red-500" : ""}
                    />
                    {errors.quantity && <p className="text-red-500 text-xs mt-1">{errors.quantity}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status */}
            <Card>
              <CardHeader>
                <CardTitle>Product Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={productData.status} onValueChange={(value) => handleInputChange("status", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-2">
                  {productData.status === "active"
                    ? "Product is visible to customers"
                    : productData.status === "draft"
                    ? "Product is saved as draft"
                    : "Product is archived"
                  }
                </p>
              </CardContent>
            </Card>

            {/* Sale Status Badge in Sidebar */}
            {isOnSale && activeSale && (
              <Card className="border-red-200 bg-gradient-to-br from-red-50 to-pink-50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-5 h-5 text-red-600" />
                    <span className="font-semibold text-red-800">On Sale!</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Original:</span>
                      <span className="line-through text-gray-400">GHS {currentPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Sale:</span>
                      <span className="font-bold text-red-600">GHS {salePrice.toFixed(2)}</span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex justify-between">
                      <span className="text-gray-600">Savings:</span>
                      <span className="font-medium text-green-600">GHS {discount.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Product Info */}
            <Card>
              <CardHeader>
                <CardTitle>Product Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Package className="w-4 h-4 text-gray-500" />
                  <span className="text-muted-foreground">ID:</span>
                  <span className="font-mono text-xs">{productId.slice(0, 20)}...</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Package className="w-4 h-4 text-gray-500" />
                  <span className="text-muted-foreground">Category:</span>
                  <span>{productData.category || "Not selected"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Package className="w-4 h-4 text-gray-500" />
                  <span className="text-muted-foreground">Status:</span>
                  <span className="capitalize">{productData.status}</span>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardContent className="p-4 space-y-3">
                {errors.submit && (
                  <Alert className="border-red-200 bg-red-50">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                      {errors.submit}
                    </AlertDescription>
                  </Alert>
                )}

                <Button
                  type="button"
                  onClick={(e) => handleSubmit(e, "active")}
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Update & Publish
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  onClick={(e) => handleSubmit(e, "draft")}
                  variant="outline"
                  className="w-full"
                  disabled={isLoading}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save as Draft
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
