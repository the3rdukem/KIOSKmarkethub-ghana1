"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft,
  Save,
  AlertTriangle,
  Package,
  Loader2,
  Store,
  Send,
  FileX
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { MultiImageUpload } from "@/components/ui/image-upload";
import { toast } from "sonner";

interface ApiCategory {
  id: string;
  name: string;
  slug: string;
}

export default function AdminEditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  const { user, isAuthenticated } = useAuthStore();

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProduct, setIsLoadingProduct] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isHydrated, setIsHydrated] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);
  const [productImages, setProductImages] = useState<string[]>([]);
  const [vendorInfo, setVendorInfo] = useState<{ id: string; name: string } | null>(null);

  const [apiCategories, setApiCategories] = useState<ApiCategory[]>([]);

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
    status: "active" as "active" | "draft" | "archived" | "suspended"
  });

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const response = await fetch('/api/categories?active=true');
        const data = await response.json();
        if (data.categories) {
          setApiCategories(data.categories);
        }
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      }
    }
    fetchCategories();
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    if (!isAuthenticated || !user) {
      router.push("/admin/login");
      return;
    }

    if (user.role !== "admin" && user.role !== "master_admin") {
      setUnauthorized(true);
      setIsLoadingProduct(false);
      return;
    }

    async function fetchProduct() {
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

        setVendorInfo({
          id: product.vendorId,
          name: product.vendorName
        });

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
          status: product.status ?? 'draft'
        });

        setProductImages(Array.isArray(product.images) ? product.images : []);
        setIsLoadingProduct(false);
      } catch (error) {
        console.error('Failed to fetch product:', error);
        toast.error('Failed to load product');
        setIsLoadingProduct(false);
      }
    }

    fetchProduct();
  }, [isHydrated, isAuthenticated, user, productId, router]);

  const handleInputChange = (field: string, value: string | boolean) => {
    setProductData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    const name = (productData.name || "").trim();
    const description = (productData.description || "").trim();
    const category = productData.category || "";
    const price = productData.price || "";
    const quantity = productData.quantity || "";

    if (!name) newErrors.name = "Product name is required";
    if (!description) newErrors.description = "Product description is required";
    if (!category) newErrors.category = "Category is required";

    if (!price) {
      newErrors.price = "Price is required";
    } else if (isNaN(Number(price)) || Number(price) <= 0) {
      newErrors.price = "Price must be a valid positive number";
    }

    if (productData.trackQuantity && !quantity) {
      newErrors.quantity = "Quantity is required when tracking inventory";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fix the errors in the form");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: productData.name,
          description: productData.description,
          category: productData.category,
          price: parseFloat(productData.price) || 0,
          comparePrice: productData.comparePrice ? parseFloat(productData.comparePrice) : undefined,
          costPerItem: productData.costPerItem ? parseFloat(productData.costPerItem) : undefined,
          sku: productData.sku || undefined,
          barcode: productData.barcode || undefined,
          quantity: productData.trackQuantity ? parseInt(productData.quantity, 10) || 0 : 0,
          trackQuantity: productData.trackQuantity,
          images: productImages,
          tags: productData.tags.split(',').map(t => t.trim()).filter(Boolean),
          status: productData.status,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update product');
      }

      toast.success('Product updated successfully!');
      router.push('/admin');
    } catch (error) {
      console.error('Update error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update product');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusAction = async (action: 'publish' | 'unpublish' | 'suspend' | 'unsuspend') => {
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        const data = await response.json();
        setProductData(prev => ({ ...prev, status: data.product.status }));

        const messages: Record<string, string> = {
          publish: 'Product published successfully',
          unpublish: 'Product changed to draft',
          suspend: 'Product suspended',
          unsuspend: 'Product unsuspended',
        };
        toast.success(messages[action]);
      } else {
        const data = await response.json();
        toast.error(data.error || 'Action failed');
      }
    } catch (error) {
      console.error('Status action error:', error);
      toast.error('Failed to update status');
    }
  };

  if (!isHydrated || isLoadingProduct) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (unauthorized) {
    return (
      <div className="container py-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You do not have permission to access this page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="container py-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Product not found. It may have been deleted.
          </AlertDescription>
        </Alert>
        <Button className="mt-4" onClick={() => router.push('/admin')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Admin
        </Button>
      </div>
    );
  }

  const categories = apiCategories.map(c => c.name);

  return (
    <div className="container py-8 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Admin
          </Link>
        </Button>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="w-6 h-6" />
            Edit Product (Admin)
          </h1>
          {vendorInfo && (
            <p className="text-muted-foreground flex items-center gap-1 mt-1">
              <Store className="w-4 h-4" />
              Vendor: {vendorInfo.name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={
            productData.status === 'active' ? 'default' :
            productData.status === 'draft' ? 'secondary' :
            productData.status === 'suspended' ? 'destructive' : 'outline'
          }>
            {productData.status}
          </Badge>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {productData.status === 'draft' && (
          <Button onClick={() => handleStatusAction('publish')} className="bg-green-600 hover:bg-green-700">
            <Send className="w-4 h-4 mr-2" />
            Publish
          </Button>
        )}
        {productData.status === 'active' && (
          <Button onClick={() => handleStatusAction('unpublish')} variant="outline">
            <FileX className="w-4 h-4 mr-2" />
            Unpublish (Draft)
          </Button>
        )}
        {productData.status === 'suspended' && (
          <Button onClick={() => handleStatusAction('unsuspend')} className="bg-green-600 hover:bg-green-700">
            Unsuspend
          </Button>
        )}
        {productData.status === 'active' && (
          <Button onClick={() => handleStatusAction('suspend')} variant="destructive">
            Suspend
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Product details and description</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                value={productData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
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
                rows={4}
                className={errors.description ? "border-red-500" : ""}
              />
              {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
            </div>

            <div>
              <Label htmlFor="category">Category *</Label>
              <Select
                value={productData.category}
                onValueChange={(value) => handleInputChange("category", value)}
              >
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
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Product Images</CardTitle>
            <CardDescription>Upload product images</CardDescription>
          </CardHeader>
          <CardContent>
            <MultiImageUpload
              images={productImages}
              onChange={setProductImages}
              maxImages={5}
            />
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
            <CardDescription>Set product pricing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="price">Price (GHS) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={productData.price}
                  onChange={(e) => handleInputChange("price", e.target.value)}
                  className={errors.price ? "border-red-500" : ""}
                />
                {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price}</p>}
              </div>
              <div>
                <Label htmlFor="comparePrice">Compare at Price (optional)</Label>
                <Input
                  id="comparePrice"
                  type="number"
                  step="0.01"
                  value={productData.comparePrice}
                  onChange={(e) => handleInputChange("comparePrice", e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="costPerItem">Cost per Item (optional)</Label>
              <Input
                id="costPerItem"
                type="number"
                step="0.01"
                value={productData.costPerItem}
                onChange={(e) => handleInputChange("costPerItem", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Inventory</CardTitle>
            <CardDescription>Manage stock levels</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Track Quantity</Label>
                <p className="text-sm text-muted-foreground">Enable inventory tracking</p>
              </div>
              <Switch
                checked={productData.trackQuantity}
                onCheckedChange={(checked) => handleInputChange("trackQuantity", checked)}
              />
            </div>
            {productData.trackQuantity && (
              <div>
                <Label htmlFor="quantity">Quantity *</Label>
                <Input
                  id="quantity"
                  type="number"
                  value={productData.quantity}
                  onChange={(e) => handleInputChange("quantity", e.target.value)}
                  className={errors.quantity ? "border-red-500" : ""}
                />
                {errors.quantity && <p className="text-red-500 text-xs mt-1">{errors.quantity}</p>}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sku">SKU</Label>
                <Input
                  id="sku"
                  value={productData.sku}
                  onChange={(e) => handleInputChange("sku", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="barcode">Barcode</Label>
                <Input
                  id="barcode"
                  value={productData.barcode}
                  onChange={(e) => handleInputChange("barcode", e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Tags</CardTitle>
            <CardDescription>Add searchable tags (comma-separated)</CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              id="tags"
              value={productData.tags}
              onChange={(e) => handleInputChange("tags", e.target.value)}
              placeholder="e.g. electronics, wireless, bluetooth"
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.push('/admin')}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
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
      </form>
    </div>
  );
}
