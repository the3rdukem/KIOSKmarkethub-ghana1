"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { Controller } from "react-hook-form";
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
import { useProductForm } from "@/lib/forms/useProductForm";
import { UNSET_VALUE, transformFormToApiPayload, transformApiToFormValues } from "@/lib/forms/product";

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

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  const { user, isAuthenticated } = useAuthStore();
  const { updateProduct } = useProductsStore();
  const { getSalesByVendor, getSalePrice, updateSale, getActiveSales } = usePromotionsStore();

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProduct, setIsLoadingProduct] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);
  const [productImages, setProductImages] = useState<string[]>([]);
  const [productLoaded, setProductLoaded] = useState(false);
  const [apiCategories, setApiCategories] = useState<ApiCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  const { form, validateForPublish, validateForDraft, scrollToFirstError } = useProductForm({
    mode: "edit",
  });

  const { control, watch, setValue, getValues, formState: { errors }, setError, clearErrors, reset } = form;
  const watchCategory = watch("category");
  const watchTrackQuantity = watch("trackQuantity");
  const watchStatus = watch("status");
  const watchPrice = watch("price");

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Fetch categories from API
  useEffect(() => {
    async function fetchCategories() {
      try {
        const response = await fetch('/api/categories');
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
  const selectedCategory = apiCategories.find(c => c.name === watchCategory);
  
  // Memoize category fields to prevent unnecessary effect re-runs
  // CONDITION REFACTOR: condition now appears as a dynamic category field when defined in schema
  const currentCategoryFields = useMemo<CategoryFormField[]>(() => {
    return selectedCategory?.formSchema || [];
  }, [selectedCategory?.formSchema]);

  // Track previous category and schema keys to detect changes
  const prevCategoryRef = useRef<string | undefined>(undefined);
  const prevSchemaKeysRef = useRef<string>("");

  // Reconcile categoryAttributes with current schema
  // Gate on categoriesLoading to prevent wiping values before schema is available
  useEffect(() => {
    if (categoriesLoading) return; // Wait for categories to load
    if (!watchCategory || watchCategory === UNSET_VALUE) return;
    
    const currentSchemaKeys = currentCategoryFields.map(f => f.key).sort().join(",");
    const categoryChanged = prevCategoryRef.current !== watchCategory;
    const schemaChanged = prevSchemaKeysRef.current !== currentSchemaKeys;
    
    if (!categoryChanged && !schemaChanged) return;
    
    prevCategoryRef.current = watchCategory;
    prevSchemaKeysRef.current = currentSchemaKeys;
    
    const existingAttrs = getValues("categoryAttributes") || {};
    const reconciledAttrs: Record<string, string | boolean> = {};
    
    currentCategoryFields.forEach(field => {
      const existingValue = existingAttrs[field.key];
      const hasExistingValue = existingValue !== undefined && existingValue !== null && existingValue !== "";
      
      if (hasExistingValue && existingValue !== UNSET_VALUE) {
        reconciledAttrs[field.key] = existingValue;
      } else {
        if (field.type === 'select' || field.type === 'multi_select') {
          reconciledAttrs[field.key] = UNSET_VALUE;
        } else if (field.type === 'boolean') {
          reconciledAttrs[field.key] = false;
        } else {
          reconciledAttrs[field.key] = "";
        }
      }
    });
    
    setValue("categoryAttributes", {}, { shouldDirty: false });
    
    Object.entries(reconciledAttrs).forEach(([key, value]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setValue(`categoryAttributes.${key}` as any, value, { shouldDirty: false });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoriesLoading, watchCategory, currentCategoryFields, setValue]);

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

        if (product.vendorId !== user.id) {
          setUnauthorized(true);
          setIsLoadingProduct(false);
          return;
        }

        const formValues = transformApiToFormValues(product);
        reset(formValues);
        setProductImages(Array.isArray(product.images) ? product.images : []);
        setProductLoaded(true);
        setIsLoadingProduct(false);
      } catch (error) {
        console.error('Error fetching product:', error);
        toast.error('Failed to load product');
        setIsLoadingProduct(false);
      }
    };

    fetchProduct();
  }, [isHydrated, isAuthenticated, user, productId, router, reset]);

  const vendorSales = isHydrated && user ? getSalesByVendor(user.id) : [];
  const activeSales = isHydrated && user ? getActiveSales(user.id) : [];

  const currentPrice = watchPrice ? parseFloat(watchPrice) : 0;
  const { salePrice, discount, sale: activeSale } = isHydrated ? getSalePrice(productId, currentPrice) : { salePrice: currentPrice, discount: 0, sale: undefined };
  const isOnSale = discount > 0;

  // Dynamic Category Attribute Field Component using per-attribute RHF registration
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const DynamicAttributeField = ({ field }: { field: CategoryFormField }) => {
    const fieldPath = `categoryAttributes.${field.key}`;
    const fieldError = errors.categoryAttributes?.[field.key as keyof typeof errors.categoryAttributes];
    const errorMessage = fieldError && typeof fieldError === 'object' && 'message' in fieldError ? fieldError.message as string : undefined;

    switch (field.type) {
      case "select":
      case "multi_select":
        return (
          <div data-field={fieldPath}>
            <Label htmlFor={field.key}>
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </Label>
            <Controller
              name={fieldPath as any}
              control={control}
              render={({ field: rhfField }) => {
                const currentValue = rhfField.value ?? UNSET_VALUE;
                return (
                  <Select
                    value={currentValue === UNSET_VALUE ? UNSET_VALUE : String(currentValue)}
                    onValueChange={rhfField.onChange}
                  >
                    <SelectTrigger
                      id={field.key}
                      name={fieldPath}
                      data-field={fieldPath}
                      ref={rhfField.ref}
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
                );
              }}
            />
            {errorMessage && <p className="text-red-500 text-xs mt-1">{errorMessage}</p>}
          </div>
        );

      case "boolean":
        return (
          <div className="flex items-center space-x-2">
            <Controller
              name={fieldPath as any}
              control={control}
              render={({ field: rhfField }) => (
                <Checkbox
                  id={field.key}
                  name={rhfField.name}
                  ref={rhfField.ref}
                  checked={!!rhfField.value}
                  onCheckedChange={rhfField.onChange}
                  data-field={fieldPath}
                />
              )}
            />
            <Label htmlFor={field.key}>{field.label}</Label>
          </div>
        );

      case "number":
        return (
          <div data-field={fieldPath}>
            <Label htmlFor={field.key}>
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </Label>
            <Controller
              name={fieldPath as any}
              control={control}
              render={({ field: rhfField }) => (
                <Input
                  id={field.key}
                  type="number"
                  name={rhfField.name}
                  ref={rhfField.ref}
                  value={rhfField.value ?? ""}
                  onChange={rhfField.onChange}
                  onBlur={rhfField.onBlur}
                  data-field={fieldPath}
                  placeholder={field.placeholder}
                  min={field.min}
                  max={field.max}
                  className={errorMessage ? "border-red-500" : ""}
                />
              )}
            />
            {errorMessage && <p className="text-red-500 text-xs mt-1">{errorMessage}</p>}
          </div>
        );

      case "textarea":
        return (
          <div data-field={fieldPath}>
            <Label htmlFor={field.key}>
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </Label>
            <Controller
              name={fieldPath as any}
              control={control}
              render={({ field: rhfField }) => (
                <Textarea
                  id={field.key}
                  name={rhfField.name}
                  ref={rhfField.ref}
                  value={rhfField.value ?? ""}
                  onChange={rhfField.onChange}
                  onBlur={rhfField.onBlur}
                  data-field={fieldPath}
                  placeholder={field.placeholder}
                  className={errorMessage ? "border-red-500" : ""}
                />
              )}
            />
            {errorMessage && <p className="text-red-500 text-xs mt-1">{errorMessage}</p>}
          </div>
        );

      case "date":
        return (
          <div data-field={fieldPath}>
            <Label htmlFor={field.key}>
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </Label>
            <Controller
              name={fieldPath as any}
              control={control}
              render={({ field: rhfField }) => (
                <Input
                  id={field.key}
                  type="date"
                  name={rhfField.name}
                  ref={rhfField.ref}
                  value={rhfField.value ?? ""}
                  onChange={rhfField.onChange}
                  onBlur={rhfField.onBlur}
                  data-field={fieldPath}
                  className={errorMessage ? "border-red-500" : ""}
                />
              )}
            />
            {errorMessage && <p className="text-red-500 text-xs mt-1">{errorMessage}</p>}
          </div>
        );

      default:
        return (
          <div data-field={fieldPath}>
            <Label htmlFor={field.key}>
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </Label>
            <Controller
              name={fieldPath as any}
              control={control}
              render={({ field: rhfField }) => (
                <Input
                  id={field.key}
                  type="text"
                  name={rhfField.name}
                  ref={rhfField.ref}
                  value={rhfField.value ?? ""}
                  onChange={rhfField.onChange}
                  onBlur={rhfField.onBlur}
                  data-field={fieldPath}
                  placeholder={field.placeholder}
                  className={errorMessage ? "border-red-500" : ""}
                />
              )}
            />
            {errorMessage && <p className="text-red-500 text-xs mt-1">{errorMessage}</p>}
          </div>
        );
    }
  };

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

  const handleSubmit = async (status: "draft" | "active") => {
    setSubmitError(null);
    clearErrors();

    const forPublish = status === "active";

    let isValid: boolean;
    if (forPublish) {
      isValid = await validateForPublish();
    } else {
      isValid = await validateForDraft();
    }

    if (!isValid) {
      scrollToFirstError();
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
          status: status,
        }),
      });

      if (response.ok) {
        toast.success(`Product "${payload.name}" updated successfully!`);
        router.push("/vendor/products");
      } else {
        const data = await response.json();
        if (data.code === 'VENDOR_NOT_VERIFIED' && status === 'active') {
          setSubmitError(data.details || "Vendor verification required to publish products");
        } else if (data.field) {
          const fieldMap: Record<string, string> = {
            'name': 'name',
            'description': 'description',
            'category': 'category',
            // CONDITION REFACTOR: condition now lives in categoryAttributes
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
            message: data.error || "Invalid value",
          });
          setTimeout(scrollToFirstError, 100);
        } else {
          setSubmitError(data.error || "Failed to update product");
        }
      }
    } catch (error) {
      console.error("Update product error:", error);
      setSubmitError(error instanceof Error ? error.message : "Failed to update product");
    } finally {
      setIsLoading(false);
    }
  };

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
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Product Information</CardTitle>
                <CardDescription>Update your product details</CardDescription>
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

                {/* CONDITION REFACTOR: condition now appears as a dynamic category field when defined in schema */}
                {currentCategoryFields.length > 0 && (
                  <div className="space-y-4 mt-4">
                    <Separator />
                    <h4 className="font-semibold text-base">Category Details</h4>
                    {currentCategoryFields.map((field) => (
                      <DynamicAttributeField key={field.key} field={field} />
                    ))}
                  </div>
                )}

                <div data-field="tags">
                  <Label htmlFor="tags">Tags (comma-separated)</Label>
                  <Controller
                    name="tags"
                    control={control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        id="tags"
                        placeholder="e.g. new arrival, best seller, premium"
                      />
                    )}
                  />
                </div>
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
                <CardDescription>Update your product pricing</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                          placeholder="0.00"
                          className={errors.price ? "border-red-500" : ""}
                          min="0"
                          step="0.01"
                        />
                      )}
                    />
                    {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price.message}</p>}
                  </div>

                  <div data-field="comparePrice">
                    <Label htmlFor="comparePrice">Compare at Price (GHS)</Label>
                    <Controller
                      name="comparePrice"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          id="comparePrice"
                          type="number"
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                        />
                      )}
                    />
                  </div>

                  <div data-field="costPerItem">
                    <Label htmlFor="costPerItem">Cost per Item (GHS)</Label>
                    <Controller
                      name="costPerItem"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          id="costPerItem"
                          type="number"
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                        />
                      )}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                          placeholder="Barcode number"
                        />
                      )}
                    />
                  </div>

                  <div data-field="quantity">
                    <Label htmlFor="quantity">Quantity {watchTrackQuantity ? <span className="text-red-500">*</span> : ""}</Label>
                    <Controller
                      name="quantity"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          id="quantity"
                          type="number"
                          placeholder="0"
                          min="0"
                          disabled={!watchTrackQuantity}
                          className={errors.quantity ? "border-red-500" : ""}
                        />
                      )}
                    />
                    {errors.quantity && <p className="text-red-500 text-xs mt-1">{errors.quantity.message}</p>}
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
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  {watchStatus === "active"
                    ? "Product is visible to customers"
                    : watchStatus === "draft"
                    ? "Product is saved as draft"
                    : "Product is archived"
                  }
                </p>
              </CardContent>
            </Card>

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
                  <span>{watchCategory && watchCategory !== UNSET_VALUE ? watchCategory : "Not selected"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Package className="w-4 h-4 text-gray-500" />
                  <span className="text-muted-foreground">Status:</span>
                  <span className="capitalize">{watchStatus}</span>
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

                <Button
                  type="button"
                  onClick={() => handleSubmit("active")}
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
      </div>
    </SiteLayout>
  );
}
