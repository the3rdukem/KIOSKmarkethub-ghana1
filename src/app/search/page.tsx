"use client";

import { useState, useEffect, useMemo, useCallback, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Search,
  Filter,
  Grid3X3,
  List,
  Star,
  MapPin,
  Package,
  ShoppingCart,
  Heart,
  ChevronDown,
  X,
  SlidersHorizontal,
  Loader2
} from "lucide-react";
import { useProductsStore, Product } from "@/lib/products-store";
import { useUsersStore } from "@/lib/users-store";
import { useCartStore } from "@/lib/cart-store";
import { useWishlistStore } from "@/lib/wishlist-store";
import { useAuthStore } from "@/lib/auth-store";
import { useOpenAI } from "@/lib/integrations-store";
import { isOpenAIEnabled, semanticSearch } from "@/lib/services/openai";
import { formatCurrency } from "@/lib/utils/currency";
import { toast } from "sonner";

interface CategoryAttribute {
  id: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
  min?: number;
  max?: number;
  order: number;
  dependsOn?: string;
  optionsSource?: string;
  level?: number;
}

interface RangeFilter {
  min: number | null;
  max: number | null;
}

interface RangePreset {
  label: string;
  min: number | null;
  max: number | null;
}

function RangeFilterSection({
  label,
  currentRange,
  onApply,
  availableRange,
  presets,
  unit,
  formatValue,
}: {
  label: string;
  currentRange: { min: number | null; max: number | null };
  onApply: (range: { min: number | null; max: number | null }) => void;
  availableRange: { min: number; max: number };
  presets?: RangePreset[];
  unit?: string;
  formatValue?: (val: number) => string;
}) {
  const [localMin, setLocalMin] = useState<string>(currentRange.min?.toString() ?? "");
  const [localMax, setLocalMax] = useState<string>(currentRange.max?.toString() ?? "");
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setLocalMin(currentRange.min?.toString() ?? "");
    setLocalMax(currentRange.max?.toString() ?? "");
    setIsDirty(false);
  }, [currentRange.min, currentRange.max]);

  const handleApply = () => {
    const minVal = localMin ? parseInt(localMin) : null;
    const maxVal = localMax ? parseInt(localMax) : null;
    onApply({ min: minVal, max: maxVal });
    setIsDirty(false);
  };

  const handleClear = () => {
    setLocalMin("");
    setLocalMax("");
    onApply({ min: null, max: null });
    setIsDirty(false);
  };

  const handlePreset = (preset: RangePreset) => {
    setLocalMin(preset.min?.toString() ?? "");
    setLocalMax(preset.max?.toString() ?? "");
    onApply({ min: preset.min, max: preset.max });
    setIsDirty(false);
  };

  const format = formatValue || ((val: number) => val.toLocaleString());
  const hasActiveFilter = currentRange.min !== null || currentRange.max !== null;

  return (
    <div className="space-y-3">
      {label && <Label className="text-sm font-semibold">{label}</Label>}
      
      <div className="flex items-center gap-2">
        <input
          type="number"
          placeholder="Min"
          value={localMin}
          onChange={(e) => { setLocalMin(e.target.value); setIsDirty(true); }}
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          )}
          min={availableRange.min}
          max={availableRange.max}
        />
        <span className="text-muted-foreground text-sm shrink-0">to</span>
        <input
          type="number"
          placeholder="Max"
          value={localMax}
          onChange={(e) => { setLocalMax(e.target.value); setIsDirty(true); }}
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          )}
          min={availableRange.min}
          max={availableRange.max}
        />
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={handleApply}
          disabled={!isDirty}
          className="flex-1 h-8 text-xs"
        >
          Apply
        </Button>
        {hasActiveFilter && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleClear}
            className="h-8 text-xs"
          >
            Clear
          </Button>
        )}
      </div>

      {presets && presets.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {presets.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => handlePreset(preset)}
              className={cn(
                "px-2 py-1 text-xs rounded-md border transition-colors",
                currentRange.min === preset.min && currentRange.max === preset.max
                  ? "bg-emerald-100 border-emerald-300 text-emerald-800"
                  : "bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-700"
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Available: {format(availableRange.min)} - {format(availableRange.max)}{unit && ` ${unit}`}
      </p>
    </div>
  );
}

function CollapsibleFilterSection({
  title,
  children,
  defaultOpen = true,
  badge,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string | number;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-gray-100 pb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full py-2 text-left hover:bg-gray-50 rounded-md transition-colors -mx-2 px-2"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">{title}</span>
          {badge !== undefined && (
            <Badge variant="secondary" className="text-xs h-5 px-1.5">
              {badge}
            </Badge>
          )}
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-gray-500 transition-transform duration-200",
            isOpen ? "rotate-180" : ""
          )}
        />
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          isOpen ? "max-h-[2000px] opacity-100 mt-3" : "max-h-0 opacity-0"
        )}
      >
        {children}
      </div>
    </div>
  );
}

interface DynamicFilterOptions {
  availableValues: string[];
  numericRange: { min: number; max: number } | null;
  productCount: number;
}

interface ApiCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  imageUrl?: string;
  parentId?: string;
  isActive: boolean;
  showInMenu: boolean;
  showInHome: boolean;
  displayOrder: number;
  formSchema?: Array<{
    key: string;
    label: string;
    type: string;
    required: boolean;
    placeholder?: string;
    helpText?: string;
    options?: string[];
    min?: number;
    max?: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

const sortOptions = [
  { value: "relevance", label: "Most Relevant" },
  { value: "price_low", label: "Price: Low to High" },
  { value: "price_high", label: "Price: High to Low" },
  { value: "newest", label: "Newest First" },
];

function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get('q') || "";
  const initialCategory = searchParams.get('category') || "All Categories";

  // Get store functions with stable references
  const getUserById = useUsersStore((state) => state.getUserById);
  const addItem = useCartStore((state) => state.addItem);
  const isInWishlist = useWishlistStore((state) => state.isInWishlist);
  const toggleWishlist = useWishlistStore((state) => state.toggleWishlist);
  const user = useAuthStore((state) => state.user);

  // Categories from API (server-side source of truth)
  const [apiCategories, setApiCategories] = useState<ApiCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const response = await fetch('/api/categories');
        if (response.ok) {
          const data = await response.json();
          setApiCategories(data.categories || []);
        }
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      } finally {
        setCategoriesLoading(false);
      }
    }
    fetchCategories();
  }, []);

  const dynamicCategories = useMemo(() => {
    return ["All Categories", ...apiCategories.map(c => c.name)];
  }, [apiCategories]);

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);

  // Get selected category's attributes for dynamic filtering (must be after selectedCategory state)
  const selectedCategoryData = useMemo(() => {
    if (selectedCategory === "All Categories") return null;
    return apiCategories.find(c => c.name === selectedCategory) || null;
  }, [selectedCategory, apiCategories]);

  // Transform formSchema to attributes format for filtering
  // Supports select, multi_select, checkbox, and number field types
  // Inherits attributes from parent categories (parent first, then child - child can override)
  const categoryAttributes = useMemo((): CategoryAttribute[] => {
    if (!selectedCategoryData) return [];
    
    const filterableTypes = ['select', 'multi_select', 'checkbox', 'number', 'dependent_select'];
    
    // Collect all categories in the hierarchy (from root parent down to selected)
    const categoryChain: ApiCategory[] = [];
    let current: ApiCategory | null = selectedCategoryData;
    
    // Walk up the parent chain
    while (current) {
      categoryChain.unshift(current); // Add to beginning so parents come first
      if (current.parentId) {
        current = apiCategories.find(c => c.id === current!.parentId) || null;
      } else {
        current = null;
      }
    }
    
    // Merge attributes from all categories in chain
    // Later categories (children) can override parent attributes with same key
    const attributeMap = new Map<string, CategoryAttribute>();
    let orderCounter = 1;
    
    for (const category of categoryChain) {
      if (!category.formSchema) continue;
      
      for (const field of category.formSchema) {
        if (!filterableTypes.includes(field.type)) continue;
        
        attributeMap.set(field.key, {
          id: `attr_${category.id}_${field.key}`,
          key: field.key,
          label: field.label,
          type: field.type,
          required: field.required,
          placeholder: field.placeholder,
          helpText: field.helpText,
          options: field.type === 'checkbox' ? ['Yes', 'No'] : field.options,
          min: field.min,
          max: field.max,
          order: orderCounter++,
          dependsOn: (field as any).dependsOn,
          optionsSource: (field as any).optionsSource,
          level: (field as any).level,
        });
      }
    }
    
    return Array.from(attributeMap.values()).sort((a, b) => a.order - b.order);
  }, [selectedCategoryData, apiCategories]);
  const [selectedVendor, setSelectedVendor] = useState("All Vendors");
  const [vendorSearchQuery, setVendorSearchQuery] = useState("");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 100000]);
  const [priceRangeInitialized, setPriceRangeInitialized] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [attributeFilters, setAttributeFilters] = useState<Record<string, string>>({});
  const [rangeFilters, setRangeFilters] = useState<Record<string, RangeFilter>>({});
  const [attributeSearchQueries, setAttributeSearchQueries] = useState<Record<string, string>>({});
  const [cascadingOptions, setCascadingOptions] = useState<Record<string, Array<{ id: string; value: string }>>>({});
  const [cascadingLoading, setCascadingLoading] = useState<Record<string, boolean>>({});
  const [sortBy, setSortBy] = useState("relevance");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [isAISearching, setIsAISearching] = useState(false);
  const [aiSearchResults, setAISearchResults] = useState<Map<string, number>>(new Map());

  const { isEnabled: aiSearchEnabled } = useOpenAI();

  // Real-time search with debounce
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);

  useEffect(() => {
    fetch('/api/products?status=active', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setProducts(data.products || []);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Get active products with stable reference using useMemo
  const allProducts = useMemo(() => {
    return products.filter((product) => product.status === 'active');
  }, [products]);

  // AI-powered semantic search when available
  useEffect(() => {
    let isCancelled = false;

    const runSemanticSearch = async () => {
      if (!isOpenAIEnabled() || !debouncedSearchQuery || debouncedSearchQuery.length < 3 || allProducts.length === 0) {
        setAISearchResults(new Map());
        return;
      }

      setIsAISearching(true);
      try {
        const result = await semanticSearch({
          query: debouncedSearchQuery,
          productDescriptions: allProducts.map(p => ({
            id: p.id,
            title: p.name,
            description: p.description,
            category: p.category || undefined,
          })),
          maxResults: 50,
        });

        if (!isCancelled && result.success && result.results) {
          const scoreMap = new Map<string, number>();
          result.results.forEach(r => {
            scoreMap.set(r.id, r.score);
          });
          setAISearchResults(scoreMap);
        }
      } catch (error) {
        console.error("Semantic search error:", error);
      } finally {
        if (!isCancelled) {
          setIsAISearching(false);
        }
      }
    };

    runSemanticSearch();

    return () => {
      isCancelled = true;
    };
  }, [debouncedSearchQuery, allProducts]);

  // Get max price for slider - dynamically calculated from actual products
  const maxPrice = useMemo(() => {
    if (allProducts.length === 0) return 10000;
    const actualMax = Math.max(...allProducts.map(p => p.price));
    return Math.ceil(actualMax / 100) * 100;
  }, [allProducts]);

  // Get min price from products
  const minPrice = useMemo(() => {
    if (allProducts.length === 0) return 0;
    return Math.min(...allProducts.map(p => p.price));
  }, [allProducts]);

  // Initialize price range when products load (only once)
  useEffect(() => {
    if (allProducts.length > 0 && !priceRangeInitialized) {
      setPriceRange([0, maxPrice]);
      setPriceRangeInitialized(true);
    }
  }, [allProducts, maxPrice, priceRangeInitialized]);

  // Get unique vendors from products
  const uniqueVendors = useMemo(() => {
    const vendorSet = new Set<string>();
    allProducts.forEach(p => vendorSet.add(p.vendorName));
    return ["All Vendors", ...Array.from(vendorSet).sort()];
  }, [allProducts]);

  // Filter vendors based on search query
  const filteredVendors = useMemo(() => {
    if (!vendorSearchQuery.trim()) return uniqueVendors;
    const query = vendorSearchQuery.toLowerCase();
    return uniqueVendors.filter(v => v.toLowerCase().includes(query));
  }, [uniqueVendors, vendorSearchQuery]);

  // Compute dynamic filter options from actual product data
  const dynamicFilterOptions = useMemo((): Record<string, DynamicFilterOptions> => {
    const options: Record<string, DynamicFilterOptions> = {};
    
    // Filter products by selected category first
    const categoryProducts = selectedCategory === "All Categories" 
      ? allProducts 
      : allProducts.filter(p => p.category === selectedCategory);
    
    categoryAttributes.forEach(attr => {
      const values: string[] = [];
      let numericMin = Infinity;
      let numericMax = -Infinity;
      let hasNumericValues = false;
      
      categoryProducts.forEach(product => {
        const productAttrs = product.categoryAttributes as Record<string, unknown> | undefined;
        if (productAttrs && productAttrs[attr.key] !== undefined && productAttrs[attr.key] !== null && productAttrs[attr.key] !== '') {
          const value = productAttrs[attr.key];
          
          if (attr.type === 'number') {
            const numVal = typeof value === 'number' ? value : parseFloat(String(value));
            if (!isNaN(numVal)) {
              hasNumericValues = true;
              numericMin = Math.min(numericMin, numVal);
              numericMax = Math.max(numericMax, numVal);
            }
          } else {
            const strValue = String(value);
            if (!values.includes(strValue)) {
              values.push(strValue);
            }
          }
        }
      });
      
      options[attr.key] = {
        availableValues: values.sort(),
        numericRange: hasNumericValues ? { min: numericMin, max: numericMax } : null,
        productCount: categoryProducts.length,
      };
    });
    
    return options;
  }, [allProducts, selectedCategory, categoryAttributes]);

  // Advanced filtering and sorting logic
  const filteredAndSortedProducts = useMemo(() => {
    const filtered = allProducts.filter(product => {
      // Text search (with null checks for optional fields)
      const matchesSearch = debouncedSearchQuery === "" ||
        product.name?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        product.description?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        (product.tags && product.tags.some(tag => tag.toLowerCase().includes(debouncedSearchQuery.toLowerCase()))) ||
        product.vendorName?.toLowerCase().includes(debouncedSearchQuery.toLowerCase());

      // Category filter
      const matchesCategory = selectedCategory === "All Categories" || product.category === selectedCategory;

      // Vendor filter
      const matchesVendor = selectedVendor === "All Vendors" || product.vendorName === selectedVendor;

      // Price range filter
      const matchesPrice = product.price >= priceRange[0] && product.price <= priceRange[1];

      // Rating filter (use server-side rating from products API)
      const rating = (product as Product & { averageRating?: number }).averageRating ?? 0;
      const matchesRating = rating >= minRating;

      // Stock filter
      const inStock = !product.trackQuantity || product.quantity > 0;
      const matchesStock = !inStockOnly || inStock;

      // Category attribute filters (select/multi_select/checkbox)
      const matchesAttributes = Object.entries(attributeFilters).every(([key, value]) => {
        if (!value || value === "all") return true;
        const productAttrs = product.categoryAttributes as Record<string, string> | undefined;
        return productAttrs?.[key] === value;
      });

      // Range filters (number types) - excludes products without the attribute when range is active
      const matchesRangeFilters = Object.entries(rangeFilters).every(([key, range]) => {
        if (range.min === null && range.max === null) return true;
        const productAttrs = product.categoryAttributes as Record<string, unknown> | undefined;
        const value = productAttrs?.[key];
        // If range is active but product doesn't have the attribute, exclude it
        if (value === undefined || value === null || value === '') return false;
        const numValue = typeof value === 'number' ? value : parseFloat(String(value));
        // If value is not a valid number, exclude it
        if (isNaN(numValue)) return false;
        if (range.min !== null && numValue < range.min) return false;
        if (range.max !== null && numValue > range.max) return false;
        return true;
      });

      return matchesSearch && matchesCategory && matchesVendor && matchesPrice && matchesRating && matchesStock && matchesAttributes && matchesRangeFilters;
    });

    // Sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "price_low":
          return a.price - b.price;
        case "price_high":
          return b.price - a.price;
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default:
          // Relevance - use AI scores when available, otherwise default
          const scoreA = aiSearchResults.get(a.id) || 0;
          const scoreB = aiSearchResults.get(b.id) || 0;
          if (scoreA !== scoreB) {
            return scoreB - scoreA; // Higher score first
          }
          return 0;
      }
    });

    return sorted;
  }, [allProducts, debouncedSearchQuery, selectedCategory, selectedVendor, priceRange, minRating, inStockOnly, sortBy, aiSearchResults, attributeFilters, rangeFilters]);

  const handleAddToCart = useCallback((product: Product) => {
    const priceToUse = product.effectivePrice ?? product.price;
    addItem({
      id: product.id,
      name: product.name,
      price: priceToUse,
      image: product.images?.[0] || "",
      vendor: product.vendorName,
      vendorId: product.vendorId,
      quantity: 1,
      maxQuantity: product.trackQuantity ? product.quantity : 999
    });
    toast.success(`Added "${product.name}" to cart!`);
  }, [addItem]);

  const handleToggleWishlist = useCallback(async (productId: string) => {
    if (!user) {
      toast.error("Please login to add items to wishlist");
      router.push("/auth/login");
      return;
    }
    const added = await toggleWishlist(user.id, productId);
    if (added) {
      toast.success("Added to wishlist!");
    } else {
      toast.success("Removed from wishlist");
    }
  }, [user, toggleWishlist, router]);

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedCategory("All Categories");
    setSelectedVendor("All Vendors");
    setPriceRange([0, maxPrice]);
    setMinRating(0);
    setInStockOnly(false);
    setSortBy("relevance");
    setAttributeFilters({});
    setRangeFilters({});
    setAttributeSearchQueries({});
  }, [maxPrice]);

  const activeFiltersCount = useMemo(() => {
    const attrFiltersActive = Object.values(attributeFilters).filter(v => v && v !== "all").length;
    const rangeFiltersActive = Object.values(rangeFilters).filter(r => r.min !== null || r.max !== null).length;
    return [
      selectedCategory !== "All Categories",
      selectedVendor !== "All Vendors",
      priceRange[0] > 0 || priceRange[1] < maxPrice,
      minRating > 0,
      inStockOnly,
    ].filter(Boolean).length + attrFiltersActive + rangeFiltersActive;
  }, [selectedCategory, selectedVendor, priceRange, maxPrice, minRating, inStockOnly, attributeFilters, rangeFilters]);

  // Clear attribute filters when category changes
  useEffect(() => {
    setAttributeFilters({});
    setRangeFilters({});
    setAttributeSearchQueries({});
    setCascadingOptions({});
    setCascadingLoading({});
  }, [selectedCategory]);

  // Fetch cascading options for dependent_select filters
  const fetchCascadingOptions = useCallback(async (fieldKey: string, parentOptionId?: string) => {
    if (!selectedCategoryData?.id) return;
    
    setCascadingLoading(prev => ({ ...prev, [fieldKey]: true }));
    try {
      let url = `/api/attribute-options?categoryId=${selectedCategoryData.id}&fieldKey=${fieldKey}`;
      if (parentOptionId) {
        url += `&parentOptionId=${parentOptionId}`;
      }
      
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.options) {
        setCascadingOptions(prev => ({ ...prev, [fieldKey]: data.options }));
      }
    } catch (error) {
      console.error(`Failed to fetch cascading options for ${fieldKey}:`, error);
    } finally {
      setCascadingLoading(prev => ({ ...prev, [fieldKey]: false }));
    }
  }, [selectedCategoryData?.id]);

  // Load initial cascading options when category changes
  useEffect(() => {
    if (selectedCategoryData?.id && categoryAttributes.length > 0) {
      const dependentFields = categoryAttributes.filter(a => a.type === 'dependent_select');
      const rootFields = dependentFields.filter(a => !a.dependsOn);
      rootFields.forEach(field => {
        fetchCascadingOptions(field.key);
      });
    }
  }, [selectedCategoryData?.id, categoryAttributes, fetchCascadingOptions]);

  // Removed early return for loading state - will use conditional rendering in JSX

  const FilterSidebar = () => (
    <div className="space-y-4">
      {/* Categories */}
      <CollapsibleFilterSection title="Category" defaultOpen={true}>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger>
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            {dynamicCategories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CollapsibleFilterSection>

      {/* Vendor Filter - Autocomplete for scalability */}
      {uniqueVendors.length > 1 && (
        <CollapsibleFilterSection 
          title="Vendor" 
          defaultOpen={false}
          badge={selectedVendor !== "All Vendors" ? 1 : undefined}
        >
          <div className="relative">
            <Input
              type="text"
              placeholder="Search vendors..."
              value={vendorSearchQuery}
              onChange={(e) => setVendorSearchQuery(e.target.value)}
              className="w-full text-sm"
            />
            {selectedVendor !== "All Vendors" && (
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="secondary" className="flex items-center gap-1">
                  {selectedVendor}
                  <button
                    onClick={() => setSelectedVendor("All Vendors")}
                    className="ml-1 hover:bg-gray-200 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              </div>
            )}
            <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
              {filteredVendors.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2 text-center">No vendors found</p>
              ) : (
                filteredVendors.slice(0, 20).map((vendor) => (
                  <button
                    key={vendor}
                    onClick={() => {
                      setSelectedVendor(vendor);
                      setVendorSearchQuery("");
                    }}
                    className={`block w-full text-left text-sm py-1.5 px-2 rounded transition-colors ${
                      selectedVendor === vendor
                        ? "bg-emerald-100 text-emerald-800 font-medium"
                        : "hover:bg-gray-100"
                    }`}
                  >
                    {vendor}
                  </button>
                ))
              )}
              {filteredVendors.length > 20 && (
                <p className="text-xs text-muted-foreground py-1 text-center">
                  +{filteredVendors.length - 20} more - type to filter
                </p>
              )}
            </div>
          </div>
        </CollapsibleFilterSection>
      )}

      {/* Dynamic Category Attribute Filters - Smart Filters */}
      {categoryAttributes.length > 0 && (
        <>
          {categoryAttributes.map((attr) => {
            const filterOptions = dynamicFilterOptions[attr.key];
            const availableValues = filterOptions?.availableValues || [];
            const numericRange = filterOptions?.numericRange;
            const searchQuery = attributeSearchQueries[attr.key] || "";
            
            // For number types, show range inputs with presets
            if (attr.type === 'number' && numericRange) {
              const currentRange = rangeFilters[attr.key] || { min: null, max: null };
              const isYearField = attr.key.toLowerCase().includes('year');
              const isMileageField = attr.key.toLowerCase().includes('mileage') || attr.key.toLowerCase().includes('km');
              
              // Generate presets based on field type
              let presets: RangePreset[] = [];
              const currentYear = new Date().getFullYear();
              
              if (isYearField) {
                presets = [
                  { label: `${currentYear - 2}+`, min: currentYear - 2, max: null },
                  { label: `${currentYear - 5}-${currentYear - 3}`, min: currentYear - 5, max: currentYear - 3 },
                  { label: `${currentYear - 10}-${currentYear - 6}`, min: currentYear - 10, max: currentYear - 6 },
                  { label: `Before ${currentYear - 10}`, min: null, max: currentYear - 11 },
                ];
              } else if (isMileageField) {
                presets = [
                  { label: "Under 50K", min: null, max: 50000 },
                  { label: "50-100K", min: 50000, max: 100000 },
                  { label: "100-150K", min: 100000, max: 150000 },
                  { label: "150K+", min: 150000, max: null },
                ];
              }
              
              return (
                <div key={attr.key}>
                  <RangeFilterSection
                    label={attr.label || attr.key}
                    currentRange={currentRange}
                    onApply={(range) => {
                      setRangeFilters(prev => ({
                        ...prev,
                        [attr.key]: range
                      }));
                    }}
                    availableRange={numericRange}
                    presets={presets}
                    unit={isMileageField ? "km" : undefined}
                  />
                </div>
              );
            }
            
            // For dependent_select - cascading dropdown filters
            // IMPORTANT: Stores display VALUE (not ID) to match product attribute storage
            if (attr.type === 'dependent_select') {
              const options = cascadingOptions[attr.key] || [];
              const isLoadingOptions = cascadingLoading[attr.key] || false;
              const parentKey = attr.dependsOn;
              const parentValue = parentKey ? attributeFilters[parentKey] : undefined;
              const isDisabled = isLoadingOptions || Boolean(parentKey && (!parentValue || parentValue === 'all'));
              const currentValue = attributeFilters[attr.key] || 'all';
              
              const parentAttr = categoryAttributes.find(a => a.key === parentKey);
              const parentLabel = parentAttr?.label || parentKey || '';
              
              return (
                <div key={attr.key}>
                  <Label className="text-sm font-semibold">{attr.label || attr.key}</Label>
                  <Select
                    value={currentValue}
                    onValueChange={(selectedValue) => {
                      // Store the display value (matches product attribute storage)
                      setAttributeFilters(prev => ({ ...prev, [attr.key]: selectedValue }));
                      // Find the option to get its ID for loading child options
                      const selectedOption = options.find(o => o.value === selectedValue);
                      // Clear and reload child filters using the option ID
                      const childFields = categoryAttributes.filter(a => a.dependsOn === attr.key);
                      childFields.forEach(child => {
                        setAttributeFilters(prev => ({ ...prev, [child.key]: 'all' }));
                        if (selectedOption) {
                          fetchCascadingOptions(child.key, selectedOption.id);
                        } else {
                          setCascadingOptions(prev => ({ ...prev, [child.key]: [] }));
                        }
                      });
                    }}
                    disabled={isDisabled}
                  >
                    <SelectTrigger className="mt-2 h-9 text-sm">
                      {isLoadingOptions ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-muted-foreground">Loading...</span>
                        </div>
                      ) : (
                        <SelectValue 
                          placeholder={
                            parentKey && (!parentValue || parentValue === 'all')
                              ? `Select ${parentLabel} first`
                              : `All ${attr.label || attr.key}`
                          } 
                        />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All {attr.label || attr.key}</SelectItem>
                      {options.map((option) => (
                        <SelectItem key={option.id} value={option.value}>
                          {option.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            }
            
            // For select/multi_select/checkbox with options - show searchable list or checkbox list
            const filteredOptions = searchQuery.trim()
              ? availableValues.filter(v => v.toLowerCase().includes(searchQuery.toLowerCase()))
              : availableValues;
            
            // If no options available from products, skip this filter
            if (availableValues.length === 0) return null;
            
            // Use checkbox-style UI for filters with 6 or fewer options (more scannable)
            const useCheckboxStyle = availableValues.length <= 6;
            
            return (
              <div key={attr.key}>
                <Label className="text-sm font-semibold">{attr.label || attr.key}</Label>
                <div className="mt-2">
                  {/* Show search input if more than 8 options */}
                  {availableValues.length > 8 && (
                    <Input
                      type="text"
                      placeholder={`Search ${attr.label || attr.key}...`}
                      value={searchQuery}
                      onChange={(e) => setAttributeSearchQueries(prev => ({ ...prev, [attr.key]: e.target.value }))}
                      className="mb-2 text-sm h-9"
                    />
                  )}
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {useCheckboxStyle ? (
                      // Checkbox-style UI for few options (Condition, Transmission, etc.)
                      <>
                        <label className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-50 cursor-pointer">
                          <Checkbox
                            checked={!attributeFilters[attr.key] || attributeFilters[attr.key] === "all"}
                            onCheckedChange={() => setAttributeFilters(prev => ({ ...prev, [attr.key]: "all" }))}
                          />
                          <span className="text-sm">All {attr.label || attr.key}</span>
                        </label>
                        {availableValues.map((option) => (
                          <label key={option} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-50 cursor-pointer">
                            <Checkbox
                              checked={attributeFilters[attr.key] === option}
                              onCheckedChange={() => {
                                setAttributeFilters(prev => ({ ...prev, [attr.key]: option }));
                              }}
                            />
                            <span className="text-sm">{option}</span>
                          </label>
                        ))}
                      </>
                    ) : (
                      // Button-style UI for many options
                      <>
                        <button
                          onClick={() => setAttributeFilters(prev => ({ ...prev, [attr.key]: "all" }))}
                          className={`block w-full text-left text-sm py-1.5 px-2 rounded transition-colors ${
                            !attributeFilters[attr.key] || attributeFilters[attr.key] === "all"
                              ? "bg-emerald-100 text-emerald-800 font-medium"
                              : "hover:bg-gray-100"
                          }`}
                        >
                          All {attr.label || attr.key}
                        </button>
                        {filteredOptions.slice(0, 20).map((option) => (
                          <button
                            key={option}
                            onClick={() => {
                              setAttributeFilters(prev => ({ ...prev, [attr.key]: option }));
                              setAttributeSearchQueries(prev => ({ ...prev, [attr.key]: "" }));
                            }}
                            className={`block w-full text-left text-sm py-1.5 px-2 rounded transition-colors ${
                              attributeFilters[attr.key] === option
                                ? "bg-emerald-100 text-emerald-800 font-medium"
                                : "hover:bg-gray-100"
                            }`}
                          >
                            {option}
                          </button>
                        ))}
                        {filteredOptions.length > 20 && (
                          <p className="text-xs text-muted-foreground py-1 text-center">
                            +{filteredOptions.length - 20} more - type to filter
                          </p>
                        )}
                        {filteredOptions.length === 0 && searchQuery && (
                          <p className="text-xs text-muted-foreground py-2 text-center">
                            No matching options
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Price Range */}
      <CollapsibleFilterSection 
        title="Price" 
        defaultOpen={true}
        badge={priceRange[0] > 0 || priceRange[1] < maxPrice ? 1 : undefined}
      >
        <RangeFilterSection
          label=""
          currentRange={{ 
            min: priceRange[0] === 0 ? null : priceRange[0], 
            max: priceRange[1] === maxPrice ? null : priceRange[1] 
          }}
          onApply={(range) => {
            setPriceRange([range.min ?? 0, range.max ?? maxPrice]);
          }}
          availableRange={{ min: 0, max: maxPrice }}
          presets={[
            { label: "Under 500", min: null, max: 500 },
            { label: "500-2K", min: 500, max: 2000 },
            { label: "2K-10K", min: 2000, max: 10000 },
            { label: "10K-50K", min: 10000, max: 50000 },
            { label: "50K+", min: 50000, max: null },
          ]}
          formatValue={(val) => formatCurrency(val).replace('GHS ', '')}
        />
      </CollapsibleFilterSection>

      {/* Rating Filter */}
      <CollapsibleFilterSection 
        title="Minimum Rating" 
        defaultOpen={false}
        badge={minRating > 0 ? 1 : undefined}
      >
        <div className="space-y-2">
          {[0, 3, 4, 4.5].map((rating) => (
            <button
              key={rating}
              onClick={() => setMinRating(rating)}
              className={`flex items-center gap-2 w-full text-left text-sm py-1.5 px-2 rounded transition-colors ${
                minRating === rating
                  ? "bg-yellow-100 text-yellow-800 font-medium"
                  : "hover:bg-gray-100"
              }`}
            >
              <div className="flex items-center">
                {rating > 0 ? (
                  <>
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3 h-3 ${
                          i < rating ? "text-yellow-400 fill-current" : "text-gray-300"
                        }`}
                      />
                    ))}
                    <span className="ml-1">{rating}+</span>
                  </>
                ) : (
                  <span>All Ratings</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </CollapsibleFilterSection>

      {/* Other Filters */}
      <CollapsibleFilterSection 
        title="Availability" 
        defaultOpen={false}
        badge={inStockOnly ? 1 : undefined}
      >
        <div className="flex items-center space-x-2">
          <Checkbox
            id="inStock"
            checked={inStockOnly}
            onCheckedChange={(checked) => setInStockOnly(checked as boolean)}
          />
          <label htmlFor="inStock" className="text-sm cursor-pointer">
            In Stock Only
          </label>
        </div>
      </CollapsibleFilterSection>

      {activeFiltersCount > 0 && (
        <div className="pt-2">
          <Button variant="outline" onClick={clearFilters} className="w-full">
            <X className="w-4 h-4 mr-2" />
            Clear All Filters ({activeFiltersCount})
          </Button>
        </div>
      )}
    </div>
  );

  const ProductCard = ({ product }: { product: Product }) => {
    const productWithRating = product as Product & { averageRating?: number; reviewCount?: number };
    const rating = productWithRating.averageRating ?? 0;
    const reviewCount = productWithRating.reviewCount ?? 0;
    const inStock = !product.trackQuantity || product.quantity > 0;
    const discount = product.comparePrice
      ? Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)
      : 0;
    const isWishlisted = user ? isInWishlist(user.id, product.id) : false;

    if (viewMode === "list") {
      return (
        <Card className="group hover:shadow-lg transition-all duration-300 overflow-hidden">
          <div className="flex">
            <div className="relative w-32 sm:w-40 flex-shrink-0">
              <Link href={`/product/${product.id}`}>
                <div className="aspect-square bg-gray-100 overflow-hidden">
                  {product.images && product.images.length > 0 ? (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-10 h-10 text-gray-400" />
                    </div>
                  )}
                </div>
              </Link>
              {discount > 0 && (
                <Badge variant="destructive" className="absolute top-2 left-2 text-xs">
                  -{discount}%
                </Badge>
              )}
            </div>
            <CardContent className="flex-1 p-3 sm:p-4 flex flex-col justify-between">
              <div>
                <Link href={`/product/${product.id}`}>
                  <h3 className="font-semibold text-sm sm:text-base line-clamp-2 hover:text-green-600 transition-colors">
                    {product.name}
                  </h3>
                </Link>
                <div className="flex items-center gap-1 mt-1">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-3 h-3 ${i < Math.floor(rating) ? "text-yellow-400 fill-current" : "text-gray-300"}`} />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">({reviewCount})</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">{product.vendorName}</p>
              </div>
              <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {product.activeSale ? (
                    <>
                      <span className="font-bold text-base sm:text-lg text-green-600">{formatCurrency(product.effectivePrice || product.price)}</span>
                      <span className="text-xs sm:text-sm text-muted-foreground line-through">{formatCurrency(product.price)}</span>
                    </>
                  ) : (
                    <>
                      <span className="font-bold text-base sm:text-lg">{formatCurrency(product.price)}</span>
                      {product.comparePrice && <span className="text-xs sm:text-sm text-muted-foreground line-through">{formatCurrency(product.comparePrice)}</span>}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleWishlist(product.id)}>
                    <Heart className={`w-4 h-4 ${isWishlisted ? "fill-red-500 text-red-500" : ""}`} />
                  </Button>
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 h-8" disabled={!inStock} onClick={() => handleAddToCart(product)}>
                    <ShoppingCart className="w-4 h-4" />
                    <span className="hidden sm:inline ml-1">{inStock ? "Add" : "Out"}</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </div>
        </Card>
      );
    }

    return (
      <Card className="group hover:shadow-lg transition-all duration-300 overflow-hidden">
        <div className="relative">
          <Link href={`/product/${product.id}`}>
            <div className="aspect-square bg-gray-100 overflow-hidden">
              {product.images && product.images.length > 0 ? (
                <img
                  src={product.images[0]}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-16 h-16 text-gray-400" />
                </div>
              )}
            </div>
          </Link>

          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {discount > 0 && (
              <Badge variant="destructive" className="text-xs">
                -{discount}%
              </Badge>
            )}
            {!inStock && (
              <Badge variant="secondary" className="text-xs">
                Out of Stock
              </Badge>
            )}
          </div>

          {/* Wishlist Button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 bg-white/80 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => handleToggleWishlist(product.id)}
          >
            <Heart className={`w-4 h-4 ${isWishlisted ? "fill-red-500 text-red-500" : ""}`} />
          </Button>
        </div>

        <CardContent className="p-4">
          <Link href={`/product/${product.id}`}>
            <h3 className="font-semibold text-sm line-clamp-2 mb-2 hover:text-green-600 transition-colors">
              {product.name}
            </h3>
          </Link>

          {/* Rating */}
          <div className="flex items-center gap-1 mb-2">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`w-3 h-3 ${
                    i < Math.floor(rating) ? "text-yellow-400 fill-current" : "text-gray-300"
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              ({reviewCount})
            </span>
          </div>

          {/* Vendor */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
            <span className="truncate">{product.vendorName}</span>
          </div>

          {/* Price */}
          <div className="flex items-center gap-2 flex-wrap mb-3">
            {product.activeSale ? (
              <>
                <span className="font-bold text-lg text-green-600">{formatCurrency(product.effectivePrice || product.price)}</span>
                <span className="text-sm text-muted-foreground line-through">
                  {formatCurrency(product.price)}
                </span>
                <Badge variant="destructive" className="text-xs animate-pulse">
                  {product.activeSale.discountType === 'percentage' 
                    ? `-${product.activeSale.discountValue}%` 
                    : `-${formatCurrency(product.activeSale.discountValue)}`}
                </Badge>
              </>
            ) : (
              <>
                <span className="font-bold text-lg">{formatCurrency(product.price)}</span>
                {product.comparePrice && (
                  <span className="text-sm text-muted-foreground line-through">
                    {formatCurrency(product.comparePrice)}
                  </span>
                )}
              </>
            )}
          </div>

          {/* Add to Cart */}
          <Button
            size="sm"
            className="w-full bg-green-600 hover:bg-green-700"
            disabled={!inStock}
            onClick={() => handleAddToCart(product)}
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            {inStock ? "Add to Cart" : "Out of Stock"}
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <SiteLayout>
      <div className="container py-6">
        {/* Search Header - Simplified (search bar is in site header) */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            {/* Search Query Display (not a duplicate input) */}
            {debouncedSearchQuery && (
              <div className="flex items-center gap-2 text-lg">
                <span className="text-muted-foreground">Results for:</span>
                <span className="font-semibold">"{debouncedSearchQuery}"</span>
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-muted-foreground hover:text-foreground ml-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* View Controls */}
            <div className="flex items-center gap-2">
              {/* Mobile Filter Button */}
              <Sheet open={showFilters} onOpenChange={setShowFilters}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="md:hidden">
                    <SlidersHorizontal className="w-4 h-4 mr-2" />
                    Filters
                    {activeFiltersCount > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {activeFiltersCount}
                      </Badge>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80 overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                    <SheetDescription>
                      Narrow down your search results
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-6 pb-8">
                    <FilterSidebar />
                  </div>
                </SheetContent>
              </Sheet>

              {/* Sort */}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* View Mode - Visible on all screens */}
              <div className="flex items-center gap-1 border rounded-lg p-1">
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                >
                  <Grid3X3 className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Mobile Quick Filter Pills - Horizontal scroll */}
          <div className="flex md:hidden gap-2 mt-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
            {dynamicCategories.slice(0, 6).map((cat) => (
              <Badge
                key={cat}
                variant={selectedCategory === cat ? "default" : "outline"}
                className={`flex-shrink-0 cursor-pointer transition-all whitespace-nowrap px-3 py-1.5 ${
                  selectedCategory === cat 
                    ? "bg-green-600 hover:bg-green-700 text-white" 
                    : "hover:bg-green-50 hover:border-green-300"
                }`}
                onClick={() => setSelectedCategory(selectedCategory === cat ? "All Categories" : cat)}
              >
                {cat}
              </Badge>
            ))}
            {dynamicCategories.length > 6 && (
              <Badge 
                variant="outline" 
                className="flex-shrink-0 cursor-pointer hover:bg-gray-100 whitespace-nowrap px-3 py-1.5"
                onClick={() => setShowFilters(true)}
              >
                +{dynamicCategories.length - 6} more
              </Badge>
            )}
          </div>

          {/* Results count */}
          <div className="flex items-center gap-2 mt-3">
            <p className="text-sm text-muted-foreground">
              {filteredAndSortedProducts.length} product{filteredAndSortedProducts.length !== 1 ? 's' : ''} found
              {debouncedSearchQuery && ` for "${debouncedSearchQuery}"`}
            </p>
            {isAISearching && (
              <Badge variant="secondary" className="text-xs">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                AI analyzing...
              </Badge>
            )}
            {!isAISearching && aiSearchResults.size > 0 && aiSearchEnabled && (
              <Badge variant="outline" className="text-xs text-green-600 border-green-200 bg-green-50">
                AI-enhanced results
              </Badge>
            )}
          </div>

          {/* Active Filter Chips */}
          {activeFiltersCount > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="text-xs text-muted-foreground">Active filters:</span>
              
              {selectedCategory !== "All Categories" && (
                <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                  Category: {selectedCategory}
                  <button
                    onClick={() => setSelectedCategory("All Categories")}
                    className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              
              {selectedVendor !== "All Vendors" && (
                <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                  Vendor: {selectedVendor}
                  <button
                    onClick={() => setSelectedVendor("All Vendors")}
                    className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              
              {(priceRange[0] > 0 || priceRange[1] < maxPrice) && (
                <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                  Price: {formatCurrency(priceRange[0])} - {formatCurrency(priceRange[1])}
                  <button
                    onClick={() => setPriceRange([0, maxPrice])}
                    className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              
              {minRating > 0 && (
                <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                  Rating: {minRating}+
                  <button
                    onClick={() => setMinRating(0)}
                    className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              
              {inStockOnly && (
                <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                  In Stock Only
                  <button
                    onClick={() => setInStockOnly(false)}
                    className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              
              {Object.entries(attributeFilters).map(([key, value]) => {
                if (!value || value === 'all') return null;
                const attr = categoryAttributes.find(a => a.key === key);
                return (
                  <Badge key={key} variant="secondary" className="flex items-center gap-1 text-xs">
                    {attr?.label || key}: {value}
                    <button
                      onClick={() => setAttributeFilters(prev => ({ ...prev, [key]: 'all' }))}
                      className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                );
              })}
              
              {Object.entries(rangeFilters).map(([key, range]) => {
                if (range.min === null && range.max === null) return null;
                const attr = categoryAttributes.find(a => a.key === key);
                const label = attr?.label || key;
                const rangeText = range.min !== null && range.max !== null
                  ? `${range.min.toLocaleString()} - ${range.max.toLocaleString()}`
                  : range.min !== null
                    ? `${range.min.toLocaleString()}+`
                    : `Up to ${range.max?.toLocaleString()}`;
                return (
                  <Badge key={key} variant="secondary" className="flex items-center gap-1 text-xs">
                    {label}: {rangeText}
                    <button
                      onClick={() => setRangeFilters(prev => ({ ...prev, [key]: { min: null, max: null } }))}
                      className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                );
              })}
              
              <button
                onClick={clearFilters}
                className="text-xs text-emerald-600 hover:underline ml-2"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-6">
          {/* Desktop Filters Sidebar */}
          <div className="hidden md:block w-64 flex-shrink-0">
            <Card className="p-4 sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
              <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Filters
              </h2>
              <FilterSidebar />
            </Card>
          </div>

          {/* Products Grid */}
          <div className="flex-1">
            {isLoading ? (
              /* Skeleton Loading */
              <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[...Array(8)].map((_, i) => (
                  <Card key={i} className="overflow-hidden animate-pulse">
                    <div className="aspect-square bg-gray-200" />
                    <CardContent className="p-4 space-y-3">
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-3 bg-gray-200 rounded w-1/2" />
                      <div className="h-3 bg-gray-200 rounded w-1/4" />
                      <div className="h-6 bg-gray-200 rounded w-1/3" />
                      <div className="h-9 bg-gray-200 rounded w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredAndSortedProducts.length === 0 ? (
              /* Friendly No Results State */
              <div className="text-center py-16 px-4">
                <div className="w-32 h-32 mx-auto mb-6 relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full" />
                  <div className="absolute inset-4 flex items-center justify-center">
                    <Search className="w-12 h-12 text-gray-400" />
                  </div>
                  <div className="absolute -right-2 -bottom-2 bg-white rounded-full p-2 shadow-lg">
                    <Package className="w-6 h-6 text-gray-400" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-3">No Products Found</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  {allProducts.length === 0
                    ? "No products have been listed yet. Check back soon for new arrivals!"
                    : debouncedSearchQuery
                      ? `We couldn't find any products matching "${debouncedSearchQuery}". Try a different search term or browse our categories.`
                      : "No products match your current filters. Try adjusting or clearing some filters."}
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  {activeFiltersCount > 0 && (
                    <Button variant="outline" onClick={clearFilters} className="gap-2">
                      <X className="w-4 h-4" />
                      Clear All Filters
                    </Button>
                  )}
                  <Button asChild className="bg-green-600 hover:bg-green-700 gap-2">
                    <Link href="/search">
                      <Search className="w-4 h-4" />
                      Browse All Products
                    </Link>
                  </Button>
                </div>
                {/* Suggested Categories */}
                <div className="mt-8 pt-6 border-t">
                  <p className="text-sm text-muted-foreground mb-4">Popular categories:</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {["Electronics", "Fashion", "Vehicles", "Mobile Phones"].map((cat) => (
                      <Link key={cat} href={`/search?category=${encodeURIComponent(cat)}`}>
                        <Badge variant="outline" className="hover:bg-green-50 hover:border-green-300 cursor-pointer transition-colors px-3 py-1">
                          {cat}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className={`grid gap-3 sm:gap-4 ${
                viewMode === "grid"
                  ? "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                  : "grid-cols-1"
              }`}>
                {filteredAndSortedProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <SiteLayout>
        <div className="container py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="w-12 h-12 animate-spin text-gray-400" />
          </div>
        </div>
      </SiteLayout>
    }>
      <SearchPageContent />
    </Suspense>
  );
}
