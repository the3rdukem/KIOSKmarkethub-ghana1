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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Database,
  Loader2
} from "lucide-react";
import { MultiImageUpload } from "@/components/ui/image-upload";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/auth-store";
import { useProductsStore } from "@/lib/products-store";
import { Checkbox } from "@/components/ui/checkbox";

// Category form field type from API
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

// API category type
interface ApiCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  isActive: boolean;
  formSchema: CategoryFormField[] | null;
}

interface ProductData {
  name: string;
  description: string;
  category: string;
  price: string;
  comparePrice: string;
  costPerItem: string;
  sku: string;
  barcode: string;
  trackQuantity: boolean;
  quantity: string;
  continueSellingWhenOutOfStock: boolean;
  weight: string;
  dimensions: {
    length: string;
    width: string;
    height: string;
  };
  requiresShipping: boolean;
  tags: string[];
  metaTitle: string;
  metaDescription: string;
  status: "active" | "draft";
}

export default function CreateProductPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { addProduct } = useProductsStore();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currentTag, setCurrentTag] = useState("");
  const [categoryAttributes, setCategoryAttributes] = useState<Record<string, string | boolean>>({});
  const [productImages, setProductImages] = useState<string[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Categories from API
  const [apiCategories, setApiCategories] = useState<ApiCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  // Fetch categories from API
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

  // Get category names for dropdown
  const categories = apiCategories.map(c => c.name);

  const [productData, setProductData] = useState<ProductData>({
    name: "",
    description: "",
    category: "",
    price: "",
    comparePrice: "",
    costPerItem: "",
    sku: "",
    barcode: "",
    trackQuantity: true,
    quantity: "",
    continueSellingWhenOutOfStock: false,
    weight: "",
    dimensions: {
      length: "",
      width: "",
      height: ""
    },
    requiresShipping: true,
    tags: [],
    metaTitle: "",
    metaDescription: "",
    status: "draft"
  });

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

  const handleInputChange = (field: string, value: string | boolean) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setProductData(prev => ({
        ...prev,
        [parent]: {
          ...(prev[parent as keyof ProductData] as Record<string, string>),
          [child]: value
        }
      }));
    } else {
      setProductData(prev => ({ ...prev, [field]: value }));
      // Reset category-specific attributes when category changes
      if (field === "category") {
        setCategoryAttributes({});
      }
    }
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  // Handle category-specific attribute changes
  const handleCategoryAttributeChange = (key: string, value: string | boolean) => {
    setCategoryAttributes(prev => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: "" }));
    }
  };

  // Get current category fields from API
  const selectedCategory = apiCategories.find(c => c.name === productData.category);
  const currentCategoryFields: CategoryFormField[] = selectedCategory?.formSchema || [];

  // Render a dynamic field based on its type
  const renderDynamicField = (field: CategoryFormField) => {
    const value = categoryAttributes[field.key] || "";
    const error = errors[field.key];

    switch (field.type) {
      case "select":
        return (
          <div key={field.key}>
            <Label htmlFor={field.key}>
              {field.label} {field.required && "*"}
            </Label>
            <Select
              value={value as string}
              onValueChange={(val) => handleCategoryAttributeChange(field.key, val)}
            >
              <SelectTrigger className={error ? "border-red-500" : ""}>
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
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );

      case "boolean":
        return (
          <div key={field.key} className="flex items-center space-x-2">
            <Checkbox
              id={field.key}
              checked={!!categoryAttributes[field.key]}
              onCheckedChange={(checked) => handleCategoryAttributeChange(field.key, !!checked)}
            />
            <Label htmlFor={field.key}>{field.label}</Label>
          </div>
        );

      case "multi_select":
        return (
          <div key={field.key}>
            <Label htmlFor={field.key}>
              {field.label} {field.required && "*"}
            </Label>
            <Select
              value={value as string}
              onValueChange={(val) => handleCategoryAttributeChange(field.key, val)}
            >
              <SelectTrigger className={error ? "border-red-500" : ""}>
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
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );

      case "date":
        return (
          <div key={field.key}>
            <Label htmlFor={field.key}>
              {field.label} {field.required && "*"}
            </Label>
            <Input
              id={field.key}
              type="date"
              value={value as string}
              onChange={(e) => handleCategoryAttributeChange(field.key, e.target.value)}
              className={error ? "border-red-500" : ""}
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );

      case "textarea":
        return (
          <div key={field.key}>
            <Label htmlFor={field.key}>
              {field.label} {field.required && "*"}
            </Label>
            <Textarea
              id={field.key}
              value={value as string}
              onChange={(e) => handleCategoryAttributeChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              className={error ? "border-red-500" : ""}
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );

      case "number":
        return (
          <div key={field.key}>
            <Label htmlFor={field.key}>
              {field.label} {field.required && "*"}
            </Label>
            <Input
              id={field.key}
              type="number"
              value={value as string}
              onChange={(e) => handleCategoryAttributeChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              min={field.min}
              max={field.max}
              className={error ? "border-red-500" : ""}
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );

      default:
        return (
          <div key={field.key}>
            <Label htmlFor={field.key}>
              {field.label} {field.required && "*"}
            </Label>
            <Input
              id={field.key}
              type="text"
              value={value as string}
              onChange={(e) => handleCategoryAttributeChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              className={error ? "border-red-500" : ""}
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!productData.name.trim()) newErrors.name = "Product name is required";
    if (!productData.description.trim()) newErrors.description = "Product description is required";
    if (!productData.category) newErrors.category = "Category is required";

    // Validate category-specific fields from API schema
    if (productData.category && currentCategoryFields.length > 0) {
      for (const field of currentCategoryFields) {
        if (field.required) {
          const value = categoryAttributes[field.key];
          if (value === undefined || value === null || value === '') {
            newErrors[field.key] = `${field.label} is required`;
          }
        }
      }
    }

    if (!productData.price) newErrors.price = "Price is required";
    else if (isNaN(Number(productData.price)) || Number(productData.price) <= 0) {
      newErrors.price = "Price must be a valid positive number";
    }
    if (productData.comparePrice && (isNaN(Number(productData.comparePrice)) || Number(productData.comparePrice) <= 0)) {
      newErrors.comparePrice = "Compare price must be a valid positive number";
    }
    if (productData.trackQuantity && !productData.quantity) {
      newErrors.quantity = "Quantity is required when tracking inventory";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddTag = () => {
    if (currentTag.trim() && !productData.tags.includes(currentTag.trim())) {
      setProductData(prev => ({
        ...prev,
        tags: [...prev.tags, currentTag.trim()]
      }));
      setCurrentTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setProductData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleSubmit = async (e: React.FormEvent, status: "draft" | "active") => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fix the errors in the form");
      return;
    }

    if (!user) {
      toast.error("You must be logged in to create a product");
      return;
    }

    setIsLoading(true);

    try {
      // Create product via API (persisted to database)
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: productData.name,
          description: productData.description,
          category: productData.category,
          price: productData.price,
          comparePrice: productData.comparePrice || undefined,
          quantity: productData.trackQuantity ? productData.quantity : 0,
          trackQuantity: productData.trackQuantity,
          images: productImages,
          tags: productData.tags,
          status: status,
          categoryAttributes: categoryAttributes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create product');
      }

      console.log("Product created successfully:", data.product);

      // Check if the product was actually published or forced to draft
      const actualStatus = data.product?.status || status;
      const wasDowngradedToDraft = status === "active" && actualStatus === "draft";

      // Also add to local store for immediate UI update
      addProduct({
        vendorId: user.id,
        vendorName: user.businessName || user.name,
        name: productData.name,
        description: productData.description,
        category: productData.category,
        price: Number(productData.price),
        comparePrice: productData.comparePrice ? Number(productData.comparePrice) : undefined,
        costPerItem: productData.costPerItem ? Number(productData.costPerItem) : undefined,
        sku: productData.sku || undefined,
        barcode: productData.barcode || undefined,
        quantity: productData.trackQuantity ? Number(productData.quantity) : 0,
        trackQuantity: productData.trackQuantity,
        images: productImages,
        weight: productData.weight ? Number(productData.weight) : undefined,
        dimensions: productData.dimensions.length ? {
          length: Number(productData.dimensions.length),
          width: Number(productData.dimensions.width),
          height: Number(productData.dimensions.height),
        } : undefined,
        tags: productData.tags,
        status: actualStatus,
        categoryAttributes: categoryAttributes as Record<string, string | number | boolean>,
      });

      // Show appropriate message based on actual result
      if (wasDowngradedToDraft) {
        toast.warning("Product saved as draft. Your account must be verified before you can publish products.");
      } else if (actualStatus === "active") {
        toast.success("Product published successfully!");
      } else {
        toast.success("Product saved as draft!");
      }

      // Redirect to products page
      router.push("/vendor/products");
    } catch (error) {
      console.error("Failed to create product:", error);
      setErrors({ submit: "Failed to create product. Please try again." });
      toast.error("Failed to create product. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

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
            <h1 className="text-3xl font-bold">Add New Product</h1>
            <p className="text-muted-foreground">Create a new product listing for your store</p>
          </div>
        </div>

        <form className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                  <CardDescription>Essential details about your product</CardDescription>
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

                  {/* Dynamic category fields */}
                  {currentCategoryFields.length > 0 && (
                    <div className="space-y-4 mt-4">
                      <Separator />
                      <h4 className="font-semibold text-base">Category Details</h4>
                      {currentCategoryFields.map(renderDynamicField)}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Media and Upload */}
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
                  <CardDescription>Set your product pricing</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="price">Price (GHS) *</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                          id="price"
                          type="number"
                          value={productData.price}
                          onChange={(e) => handleInputChange("price", e.target.value)}
                          placeholder="0.00"
                          className={`pl-10 ${errors.price ? "border-red-500" : ""}`}
                          min="0"
                          step="0.01"
                        />
                      </div>
                      {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price}</p>}
                    </div>

                    <div>
                      <Label htmlFor="comparePrice">Compare at Price (GHS)</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                          id="comparePrice"
                          type="number"
                          value={productData.comparePrice}
                          onChange={(e) => handleInputChange("comparePrice", e.target.value)}
                          placeholder="0.00"
                          className={`pl-10 ${errors.comparePrice ? "border-red-500" : ""}`}
                          min="0"
                          step="0.01"
                        />
                      </div>
                      {errors.comparePrice && <p className="text-red-500 text-xs mt-1">{errors.comparePrice}</p>}
                      <p className="text-xs text-muted-foreground mt-1">
                        Show customers the original price for sales
                      </p>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="costPerItem">Cost per Item (GHS)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        id="costPerItem"
                        type="number"
                        value={productData.costPerItem}
                        onChange={(e) => handleInputChange("costPerItem", e.target.value)}
                        placeholder="0.00"
                        className="pl-10"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Internal cost for profit calculations
                    </p>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        placeholder="1234567890123"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="trackQuantity"
                        checked={productData.trackQuantity}
                        onChange={(e) => handleInputChange("trackQuantity", e.target.checked)}
                        className="rounded"
                      />
                      <Label htmlFor="trackQuantity">Track quantity</Label>
                    </div>

                    {productData.trackQuantity && (
                      <div>
                        <Label htmlFor="quantity">Quantity *</Label>
                        <Input
                          id="quantity"
                          type="number"
                          value={productData.quantity}
                          onChange={(e) => handleInputChange("quantity", e.target.value)}
                          placeholder="0"
                          className={errors.quantity ? "border-red-500" : ""}
                          min="0"
                        />
                        {errors.quantity && <p className="text-red-500 text-xs mt-1">{errors.quantity}</p>}
                      </div>
                    )}

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="continueSellingWhenOutOfStock"
                        checked={productData.continueSellingWhenOutOfStock}
                        onChange={(e) => handleInputChange("continueSellingWhenOutOfStock", e.target.checked)}
                        className="rounded"
                      />
                      <Label htmlFor="continueSellingWhenOutOfStock">Continue selling when out of stock</Label>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Shipping */}
              <Card>
                <CardHeader>
                  <CardTitle>Shipping</CardTitle>
                  <CardDescription>Configure shipping settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="requiresShipping"
                      checked={productData.requiresShipping}
                      onChange={(e) => handleInputChange("requiresShipping", e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="requiresShipping">This is a physical product</Label>
                  </div>

                  {productData.requiresShipping && (
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="weight">Weight (kg)</Label>
                        <Input
                          id="weight"
                          type="number"
                          value={productData.weight}
                          onChange={(e) => handleInputChange("weight", e.target.value)}
                          placeholder="0.0"
                          min="0"
                          step="0.1"
                        />
                      </div>

                      <div>
                        <Label>Dimensions (cm)</Label>
                        <div className="grid grid-cols-3 gap-4 mt-2">
                          <Input
                            type="number"
                            value={productData.dimensions.length}
                            onChange={(e) => handleInputChange("dimensions.length", e.target.value)}
                            placeholder="Length"
                            min="0"
                          />
                          <Input
                            type="number"
                            value={productData.dimensions.width}
                            onChange={(e) => handleInputChange("dimensions.width", e.target.value)}
                            placeholder="Width"
                            min="0"
                          />
                          <Input
                            type="number"
                            value={productData.dimensions.height}
                            onChange={(e) => handleInputChange("dimensions.height", e.target.value)}
                            placeholder="Height"
                            min="0"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* SEO */}
              <Card>
                <CardHeader>
                  <CardTitle>Search Engine Optimization</CardTitle>
                  <CardDescription>Improve your product's search visibility</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="metaTitle">Meta Title</Label>
                    <Input
                      id="metaTitle"
                      value={productData.metaTitle}
                      onChange={(e) => handleInputChange("metaTitle", e.target.value)}
                      placeholder="Product title for search engines"
                    />
                  </div>

                  <div>
                    <Label htmlFor="metaDescription">Meta Description</Label>
                    <Textarea
                      id="metaDescription"
                      value={productData.metaDescription}
                      onChange={(e) => handleInputChange("metaDescription", e.target.value)}
                      placeholder="Brief description for search results"
                      rows={3}
                    />
                  </div>

                  <div>
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
                      {productData.tags.map((tag, index) => (
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
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-2">
                    {productData.status === "active"
                      ? "Product will be visible to customers"
                      : "Product will be saved as draft"
                    }
                  </p>
                </CardContent>
              </Card>

              {/* Organization */}
              <Card>
                <CardHeader>
                  <CardTitle>Organization</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Package className="w-4 h-4 text-gray-500" />
                    <span>Category: {productData.category || "Not selected"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <ImageIcon className="w-4 h-4 text-gray-500" />
                    <span>Media: {productImages.length} images</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Tag className="w-4 h-4 text-gray-500" />
                    <span>Tags: {productData.tags.length}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Truck className="w-4 h-4 text-gray-500" />
                    <span>Shipping: {productData.requiresShipping ? "Required" : "Not required"}</span>
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

                  {/* Verification Warning for Unverified Vendors */}
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
                    onClick={(e) => handleSubmit(e, "active")}
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
        </form>
      </div>
    </SiteLayout>
  );
}
