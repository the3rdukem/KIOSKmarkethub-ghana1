"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { Controller } from "react-hook-form";
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
import { useProductForm } from "@/lib/forms/useProductForm";
import { UNSET_VALUE, transformFormToApiPayload, transformApiToFormValues } from "@/lib/forms/product";

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
  const [isHydrated, setIsHydrated] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);
  const [productImages, setProductImages] = useState<string[]>([]);
  const [vendorInfo, setVendorInfo] = useState<{ id: string; name: string } | null>(null);
  const [currentStatus, setCurrentStatus] = useState<"active" | "draft" | "archived" | "suspended">("draft");

  const [apiCategories, setApiCategories] = useState<ApiCategory[]>([]);

  const { form, validateForPublish, validateForDraft, scrollToFirstError } = useProductForm({
    mode: "edit",
  });

  const { control, watch, reset, formState: { errors } } = form;
  const watchTrackQuantity = watch("trackQuantity");

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

        setCurrentStatus(product.status ?? 'draft');

        // Transform API data to form values and reset the form
        const formValues = transformApiToFormValues(product);
        reset(formValues);

        setProductImages(Array.isArray(product.images) ? product.images : []);
        setIsLoadingProduct(false);
      } catch (error) {
        console.error('Failed to fetch product:', error);
        toast.error('Failed to load product');
        setIsLoadingProduct(false);
      }
    }

    fetchProduct();
  }, [isHydrated, isAuthenticated, user, productId, router, reset]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Use publish validation since admin edits should enforce all required fields
    const isValid = await validateForPublish();
    if (!isValid) {
      scrollToFirstError();
      toast.error("Please fix the errors in the form");
      return;
    }

    setIsLoading(true);

    try {
      const formValues = form.getValues();
      const payload = transformFormToApiPayload(formValues);

      const response = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...payload,
          images: productImages,
          status: currentStatus,
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
        setCurrentStatus(data.product.status);

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
            currentStatus === 'active' ? 'default' :
            currentStatus === 'draft' ? 'secondary' :
            currentStatus === 'suspended' ? 'destructive' : 'outline'
          }>
            {currentStatus}
          </Badge>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {currentStatus === 'draft' && (
          <Button onClick={() => handleStatusAction('publish')} className="bg-green-600 hover:bg-green-700">
            <Send className="w-4 h-4 mr-2" />
            Publish
          </Button>
        )}
        {currentStatus === 'active' && (
          <Button onClick={() => handleStatusAction('unpublish')} variant="outline">
            <FileX className="w-4 h-4 mr-2" />
            Unpublish (Draft)
          </Button>
        )}
        {currentStatus === 'suspended' && (
          <Button onClick={() => handleStatusAction('unsuspend')} className="bg-green-600 hover:bg-green-700">
            Unsuspend
          </Button>
        )}
        {currentStatus === 'active' && (
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
            <div data-field="name">
              <Label htmlFor="name">Product Name <span className="text-red-500">*</span></Label>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    id="name"
                    className={errors.name ? "border-red-500" : ""}
                  />
                )}
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>

            <div data-field="description">
              <Label htmlFor="description">Description <span className="text-red-500">*</span></Label>
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <Textarea
                    {...field}
                    id="description"
                    rows={4}
                    className={errors.description ? "border-red-500" : ""}
                  />
                )}
              />
              {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>}
            </div>

            <div data-field="category">
              <Label htmlFor="category">Category <span className="text-red-500">*</span></Label>
              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value === UNSET_VALUE ? UNSET_VALUE : field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger
                      id="category"
                      name="category"
                      data-field="category"
                      className={errors.category ? "border-red-500" : ""}
                    >
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
                )}
              />
              {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category.message}</p>}
            </div>

            <div data-field="condition">
              <Label htmlFor="condition">Condition <span className="text-red-500">*</span></Label>
              <Controller
                name="condition"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value === UNSET_VALUE ? UNSET_VALUE : field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger
                      id="condition"
                      name="condition"
                      data-field="condition"
                      className={errors.condition ? "border-red-500" : ""}
                    >
                      <SelectValue placeholder="Select condition" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="New">New</SelectItem>
                      <SelectItem value="Like New">Like New</SelectItem>
                      <SelectItem value="Good">Good</SelectItem>
                      <SelectItem value="Fair">Fair</SelectItem>
                      <SelectItem value="Used">Used</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.condition && <p className="text-red-500 text-xs mt-1">{errors.condition.message}</p>}
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
              values={productImages}
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
              <div data-field="price">
                <Label htmlFor="price">Price (GHS) <span className="text-red-500">*</span></Label>
                <Controller
                  name="price"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="price"
                      type="number"
                      step="0.01"
                      className={errors.price ? "border-red-500" : ""}
                    />
                  )}
                />
                {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price.message}</p>}
              </div>
              <div data-field="comparePrice">
                <Label htmlFor="comparePrice">Compare at Price (optional)</Label>
                <Controller
                  name="comparePrice"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="comparePrice"
                      type="number"
                      step="0.01"
                    />
                  )}
                />
              </div>
            </div>
            <div data-field="costPerItem">
              <Label htmlFor="costPerItem">Cost per Item (optional)</Label>
              <Controller
                name="costPerItem"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    id="costPerItem"
                    type="number"
                    step="0.01"
                  />
                )}
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
              <Controller
                name="trackQuantity"
                control={control}
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>
            {watchTrackQuantity && (
              <div data-field="quantity">
                <Label htmlFor="quantity">Quantity <span className="text-red-500">*</span></Label>
                <Controller
                  name="quantity"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="quantity"
                      type="number"
                      className={errors.quantity ? "border-red-500" : ""}
                    />
                  )}
                />
                {errors.quantity && <p className="text-red-500 text-xs mt-1">{errors.quantity.message}</p>}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div data-field="sku">
                <Label htmlFor="sku">SKU</Label>
                <Controller
                  name="sku"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="sku"
                    />
                  )}
                />
              </div>
              <div data-field="barcode">
                <Label htmlFor="barcode">Barcode</Label>
                <Controller
                  name="barcode"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="barcode"
                    />
                  )}
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
            <div data-field="tags">
              <Controller
                name="tags"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    id="tags"
                    placeholder="e.g. electronics, wireless, bluetooth"
                  />
                )}
              />
            </div>
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
