"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller } from "react-hook-form";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Plus,
  Save,
  AlertTriangle,
  ImageIcon,
  Package,
  DollarSign,
  Tag,
  Truck,
  Loader2
} from "lucide-react";
import { MultiImageUpload } from "@/components/ui/image-upload";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/auth-store";
import { useProductsStore } from "@/lib/products-store";
import { Checkbox } from "@/components/ui/checkbox";
import { useProductForm } from "@/lib/forms/useProductForm";
import { UNSET_VALUE, transformFormToApiPayload } from "@/lib/forms/product";

interface CategoryFormField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'multi_select' | 'boolean' | 'date' | 'textarea';
  required: boolean;
  placeholder?: string;
  options?: string[];
  min?: number;
  max?: number;
}

interface ApiCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  isActive: boolean;
  formSchema: CategoryFormField[] | null;
}

export default function CreateProductPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { addProduct } = useProductsStore();
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [currentTag, setCurrentTag] = useState("");
  const [productImages, setProductImages] = useState<string[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [apiCategories, setApiCategories] = useState<ApiCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  const { form, validateForPublish, validateForDraft, scrollToFirstError } = useProductForm({
    mode: "create",
  });

  const { control, watch, setValue, formState: { errors }, setError, clearErrors } = form;
  const watchCategory = watch("category");
  const watchTrackQuantity = watch("trackQuantity");
  const watchRequiresShipping = watch("requiresShipping");
  const watchStatus = watch("status");
  const watchTags = watch("tags");

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
      } finally {
        setCategoriesLoading(false);
      }
    }
    fetchCategories();
  }, []);

  const categories = apiCategories.map(c => c.name);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push("/auth/login");
    }
    if (isHydrated && user && user.role !== "vendor") {
      toast.error("Only vendors can create products");
      router.push("/");
    }
  }, [isHydrated, isAuthenticated, user, router]);

  const selectedCategory = apiCategories.find(c => c.name === watchCategory);
  // Filter out 'condition' from dynamic category fields - it's now a dedicated top-level field
  const currentCategoryFields: CategoryFormField[] = (selectedCategory?.formSchema || []).filter(f => f.key !== 'condition');

  useEffect(() => {
    if (watchCategory && watchCategory !== UNSET_VALUE) {
      const newAttrs: Record<string, string | boolean> = {};
      // Only seed non-condition fields into categoryAttributes
      currentCategoryFields.forEach(field => {
        if (field.type === 'select' || field.type === 'multi_select') {
          newAttrs[field.key] = UNSET_VALUE;
        } else if (field.type === 'boolean') {
          newAttrs[field.key] = false;
        } else {
          newAttrs[field.key] = "";
        }
      });
      setValue("categoryAttributes", newAttrs);
    }
  }, [watchCategory, currentCategoryFields, setValue]);

  if (!isHydrated) {
    return (
      <SiteLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </SiteLayout>
    );
  }

  if (!isAuthenticated || !user || user.role !== "vendor") {
    return null;
  }

  const handleAddTag = () => {
    const currentTags = watchTags || "";
    const tagsArray = currentTags.split(",").map(t => t.trim()).filter(t => t);
    if (currentTag.trim() && !tagsArray.includes(currentTag.trim())) {
      const newTags = [...tagsArray, currentTag.trim()].join(", ");
      setValue("tags", newTags);
      setCurrentTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const currentTags = watchTags || "";
    const tagsArray = currentTags.split(",").map(t => t.trim()).filter(t => t);
    const newTags = tagsArray.filter(tag => tag !== tagToRemove).join(", ");
    setValue("tags", newTags);
  };

  const tagsArray = (watchTags || "").split(",").map(t => t.trim()).filter(t => t);

  const validateCategoryFields = (): boolean => {
    let isValid = true;
    const categoryAttrs = form.getValues("categoryAttributes") || {};

    for (const field of currentCategoryFields) {
      if (field.required) {
        const value = categoryAttrs[field.key];
        if (value === undefined || value === null || value === '' || value === UNSET_VALUE) {
          setError(`categoryAttributes.${field.key}` as keyof typeof errors, {
            type: "manual",
            message: `${field.label} is required`,
          });
          isValid = false;
        }
      }
    }

    return isValid;
  };

  const handleSubmit = async (status: "draft" | "active") => {
    setSubmitError(null);
    clearErrors();

    const forPublish = status === "active";

    let isValid: boolean;
    if (forPublish) {
      isValid = await validateForPublish();
      if (isValid) {
        isValid = validateCategoryFields();
      }
    } else {
      isValid = await validateForDraft();
    }

    if (!isValid) {
      scrollToFirstError();
      return;
    }

    if (!user) {
      setSubmitError("You must be logged in to create a product");
      return;
    }

    setIsLoading(true);

    try {
      const formValues = form.getValues();
      const payload = transformFormToApiPayload(formValues);

      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...payload,
          images: productImages,
          status: status,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || 'Failed to create product';
        if (data.field) {
          const fieldMap: Record<string, string> = {
            'name': 'name',
            'description': 'description',
            'category': 'category',
            'condition': 'condition',
            'price': 'price',
            'quantity': 'quantity',
            'comparePrice': 'comparePrice',
            'sku': 'sku',
            'barcode': 'barcode',
            'color': 'color',
            'brand': 'brand',
            'tags': 'tags',
          };
          const clientField = fieldMap[data.field] || data.field;
          setError(clientField as keyof typeof errors, {
            type: "manual",
            message: errorMessage,
          });
          setTimeout(scrollToFirstError, 100);
        } else {
          setSubmitError(errorMessage);
        }
        return;
      }

      console.log("Product created successfully:", data.product);

      const actualStatus = data.product?.status || status;
      const wasDowngradedToDraft = status === "active" && actualStatus === "draft";

      addProduct({
        vendorId: user.id,
        vendorName: user.businessName || user.name,
        name: payload.name,
        description: payload.description,
        category: payload.category || "",
        price: payload.price,
        comparePrice: payload.comparePrice ?? undefined,
        quantity: payload.quantity,
        trackQuantity: payload.trackQuantity,
        images: productImages,
        tags: payload.tags,
        status: actualStatus,
        categoryAttributes: payload.categoryAttributes as Record<string, string | number | boolean>,
      });

      if (wasDowngradedToDraft) {
        toast.warning("Product saved as draft. Your account must be verified before you can publish products.");
      } else if (actualStatus === "active") {
        toast.success("Product published successfully!");
      } else {
        toast.success("Product saved as draft!");
      }

      router.push("/vendor/products");
    } catch (error) {
      console.error("Failed to create product:", error);
      setSubmitError(error instanceof Error ? error.message : "Failed to create product");
    } finally {
      setIsLoading(false);
    }
  };

  const renderDynamicField = (field: CategoryFormField) => {
    const categoryAttrs = form.getValues("categoryAttributes") || {};
    const value = categoryAttrs[field.key] ?? (field.type === 'select' || field.type === 'multi_select' ? UNSET_VALUE : "");
    const fieldError = errors.categoryAttributes?.[field.key as keyof typeof errors.categoryAttributes];
    const errorMessage = fieldError && typeof fieldError === 'object' && 'message' in fieldError ? fieldError.message as string : undefined;

    const handleChange = (key: string, val: string | boolean) => {
      const current = form.getValues("categoryAttributes") || {};
      setValue("categoryAttributes", { ...current, [key]: val });
      if (errors.categoryAttributes?.[key as keyof typeof errors.categoryAttributes]) {
        clearErrors(`categoryAttributes.${key}` as keyof typeof errors);
      }
    };

    switch (field.type) {
      case "select":
      case "multi_select":
        return (
          <div key={field.key} data-field={field.key}>
            <Label htmlFor={field.key}>
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </Label>
            <Select
              value={value === UNSET_VALUE ? UNSET_VALUE : (value as string)}
              onValueChange={(val) => handleChange(field.key, val)}
            >
              <SelectTrigger
                id={field.key}
                name={field.key}
                data-field={field.key}
                className={errorMessage ? "border-red-500" : ""}
              >
                <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errorMessage && <p className="text-red-500 text-xs mt-1">{errorMessage}</p>}
          </div>
        );

      case "boolean":
        return (
          <div key={field.key} className="flex items-center space-x-2">
            <Checkbox
              id={field.key}
              checked={!!value}
              onCheckedChange={(checked) => handleChange(field.key, !!checked)}
            />
            <Label htmlFor={field.key}>{field.label}</Label>
          </div>
        );

      case "number":
        return (
          <div key={field.key} data-field={field.key}>
            <Label htmlFor={field.key}>
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </Label>
            <Input
              id={field.key}
              name={field.key}
              data-field={field.key}
              type="number"
              value={value as string}
              onChange={(e) => handleChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              min={field.min}
              max={field.max}
              className={errorMessage ? "border-red-500" : ""}
            />
            {errorMessage && <p className="text-red-500 text-xs mt-1">{errorMessage}</p>}
          </div>
        );

      case "textarea":
        return (
          <div key={field.key} data-field={field.key}>
            <Label htmlFor={field.key}>
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </Label>
            <Textarea
              id={field.key}
              name={field.key}
              data-field={field.key}
              value={value as string}
              onChange={(e) => handleChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              className={errorMessage ? "border-red-500" : ""}
            />
            {errorMessage && <p className="text-red-500 text-xs mt-1">{errorMessage}</p>}
          </div>
        );

      case "date":
        return (
          <div key={field.key} data-field={field.key}>
            <Label htmlFor={field.key}>
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </Label>
            <Input
              id={field.key}
              name={field.key}
              data-field={field.key}
              type="date"
              value={value as string}
              onChange={(e) => handleChange(field.key, e.target.value)}
              className={errorMessage ? "border-red-500" : ""}
            />
            {errorMessage && <p className="text-red-500 text-xs mt-1">{errorMessage}</p>}
          </div>
        );

      default:
        return (
          <div key={field.key} data-field={field.key}>
            <Label htmlFor={field.key}>
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </Label>
            <Input
              id={field.key}
              name={field.key}
              data-field={field.key}
              type="text"
              value={value as string}
              onChange={(e) => handleChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              className={errorMessage ? "border-red-500" : ""}
            />
            {errorMessage && <p className="text-red-500 text-xs mt-1">{errorMessage}</p>}
          </div>
        );
    }
  };

  return (
    <SiteLayout>
      <div className="container py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/vendor/products">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Products
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Add New Product</h1>
            <p className="text-muted-foreground">Create a new product listing for your store</p>
          </div>
        </div>

        <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                  <CardDescription>Essential details about your product</CardDescription>
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
                          placeholder="Enter product name"
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
                          placeholder="Describe your product in detail"
                          rows={6}
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

                  {currentCategoryFields.length > 0 && (
                    <div className="space-y-4 mt-4">
                      <Separator />
                      <h4 className="font-semibold text-base">Category Details</h4>
                      {currentCategoryFields.map(renderDynamicField)}
                    </div>
                  )}
                </CardContent>
              </Card>

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

              <Card>
                <CardHeader>
                  <CardTitle>Pricing</CardTitle>
                  <CardDescription>Set your product pricing</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div data-field="price">
                      <Label htmlFor="price">Price (GHS) <span className="text-red-500">*</span></Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Controller
                          name="price"
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              id="price"
                              type="number"
                              placeholder="0.00"
                              className={`pl-10 ${errors.price ? "border-red-500" : ""}`}
                              min="0"
                              step="0.01"
                            />
                          )}
                        />
                      </div>
                      {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price.message}</p>}
                    </div>

                    <div data-field="comparePrice">
                      <Label htmlFor="comparePrice">Compare at Price (GHS)</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Controller
                          name="comparePrice"
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              id="comparePrice"
                              type="number"
                              placeholder="0.00"
                              className={`pl-10 ${errors.comparePrice ? "border-red-500" : ""}`}
                              min="0"
                              step="0.01"
                            />
                          )}
                        />
                      </div>
                      {errors.comparePrice && <p className="text-red-500 text-xs mt-1">{errors.comparePrice.message}</p>}
                      <p className="text-xs text-muted-foreground mt-1">
                        Show customers the original price for sales
                      </p>
                    </div>
                  </div>

                  <div data-field="costPerItem">
                    <Label htmlFor="costPerItem">Cost per Item (GHS)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Controller
                        name="costPerItem"
                        control={control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            id="costPerItem"
                            type="number"
                            placeholder="0.00"
                            className="pl-10"
                            min="0"
                            step="0.01"
                          />
                        )}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Internal cost for profit calculations
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Inventory</CardTitle>
                  <CardDescription>Manage your product inventory</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div data-field="sku">
                      <Label htmlFor="sku">SKU</Label>
                      <Controller
                        name="sku"
                        control={control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            id="sku"
                            placeholder="SKU-123"
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
                            placeholder="1234567890123"
                          />
                        )}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Controller
                        name="trackQuantity"
                        control={control}
                        render={({ field }) => (
                          <input
                            type="checkbox"
                            id="trackQuantity"
                            checked={field.value}
                            onChange={(e) => field.onChange(e.target.checked)}
                            className="rounded"
                          />
                        )}
                      />
                      <Label htmlFor="trackQuantity">Track quantity</Label>
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
                              placeholder="0"
                              className={errors.quantity ? "border-red-500" : ""}
                              min="0"
                            />
                          )}
                        />
                        {errors.quantity && <p className="text-red-500 text-xs mt-1">{errors.quantity.message}</p>}
                      </div>
                    )}

                    <div className="flex items-center space-x-2">
                      <Controller
                        name="continueSellingWhenOutOfStock"
                        control={control}
                        render={({ field }) => (
                          <input
                            type="checkbox"
                            id="continueSellingWhenOutOfStock"
                            checked={field.value}
                            onChange={(e) => field.onChange(e.target.checked)}
                            className="rounded"
                          />
                        )}
                      />
                      <Label htmlFor="continueSellingWhenOutOfStock">Continue selling when out of stock</Label>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Shipping</CardTitle>
                  <CardDescription>Configure shipping settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Controller
                      name="requiresShipping"
                      control={control}
                      render={({ field }) => (
                        <input
                          type="checkbox"
                          id="requiresShipping"
                          checked={field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                          className="rounded"
                        />
                      )}
                    />
                    <Label htmlFor="requiresShipping">This is a physical product</Label>
                  </div>

                  {watchRequiresShipping && (
                    <div className="space-y-4">
                      <div data-field="weight">
                        <Label htmlFor="weight">Weight (kg)</Label>
                        <Controller
                          name="weight"
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              id="weight"
                              type="number"
                              placeholder="0.0"
                              min="0"
                              step="0.1"
                            />
                          )}
                        />
                      </div>

                      <div>
                        <Label>Dimensions (cm)</Label>
                        <div className="grid grid-cols-3 gap-4 mt-2">
                          <Controller
                            name="dimensions.length"
                            control={control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                type="number"
                                placeholder="Length"
                                min="0"
                              />
                            )}
                          />
                          <Controller
                            name="dimensions.width"
                            control={control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                type="number"
                                placeholder="Width"
                                min="0"
                              />
                            )}
                          />
                          <Controller
                            name="dimensions.height"
                            control={control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                type="number"
                                placeholder="Height"
                                min="0"
                              />
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Search Engine Optimization</CardTitle>
                  <CardDescription>Improve your product's search visibility</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div data-field="metaTitle">
                    <Label htmlFor="metaTitle">Meta Title</Label>
                    <Controller
                      name="metaTitle"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          id="metaTitle"
                          placeholder="Product title for search engines"
                        />
                      )}
                    />
                  </div>

                  <div data-field="metaDescription">
                    <Label htmlFor="metaDescription">Meta Description</Label>
                    <Controller
                      name="metaDescription"
                      control={control}
                      render={({ field }) => (
                        <Textarea
                          {...field}
                          id="metaDescription"
                          placeholder="Brief description for search results"
                          rows={3}
                        />
                      )}
                    />
                  </div>

                  <div data-field="tags">
                    <Label htmlFor="tags">Product Tags</Label>
                    <div className="flex gap-2 mb-2">
                      <Input
                        id="tags"
                        value={currentTag}
                        onChange={(e) => setCurrentTag(e.target.value)}
                        placeholder="Add a tag"
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                      />
                      <Button type="button" onClick={handleAddTag} variant="outline">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {tagsArray.map((tag, index) => (
                        <Badge key={index} variant="secondary" className="flex items-center gap-1">
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="ml-1 hover:text-red-500"
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Product Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <Controller
                    name="status"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="draft">Draft</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    {watchStatus === "active"
                      ? "Product will be visible to customers"
                      : "Product will be saved as draft"
                    }
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Organization</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Package className="w-4 h-4 text-gray-500" />
                    <span>Category: {watchCategory && watchCategory !== UNSET_VALUE ? watchCategory : "Not selected"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <ImageIcon className="w-4 h-4 text-gray-500" />
                    <span>Media: {productImages.length} images</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Tag className="w-4 h-4 text-gray-500" />
                    <span>Tags: {tagsArray.length}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Truck className="w-4 h-4 text-gray-500" />
                    <span>Shipping: {watchRequiresShipping ? "Required" : "Not required"}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-3">
                  {submitError && (
                    <Alert className="border-red-200 bg-red-50">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-800">
                        {submitError}
                      </AlertDescription>
                    </Alert>
                  )}

                  {user && user.verificationStatus !== 'verified' && (
                    <Alert className="border-amber-200 bg-amber-50">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-800 text-sm">
                        Your account must be verified before you can publish products. Products will be saved as drafts until verification is complete.
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button
                    type="button"
                    onClick={() => handleSubmit("active")}
                    className="w-full"
                    disabled={isLoading || (user?.verificationStatus !== 'verified')}
                    title={user?.verificationStatus !== 'verified' ? "Account verification required to publish" : undefined}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Publishing...
                      </>
                    ) : user?.verificationStatus !== 'verified' ? (
                      "Verification Required to Publish"
                    ) : (
                      "Publish Product"
                    )}
                  </Button>

                  <Button
                    type="button"
                    onClick={() => handleSubmit("draft")}
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
        </form>
      </div>
    </SiteLayout>
  );
}
