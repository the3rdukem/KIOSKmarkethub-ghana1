"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
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
import { useReviewsStore } from "@/lib/reviews-store";
import { useOpenAI } from "@/lib/integrations-store";
import { isOpenAIEnabled, semanticSearch } from "@/lib/services/openai";
import { useCategoriesStore } from "@/lib/categories-store";
import { toast } from "sonner";

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
  const getAverageRating = useReviewsStore((state) => state.getAverageRating);
  const getReviewsByProduct = useReviewsStore((state) => state.getReviewsByProduct);

  // Dynamic categories from store
  const { getActiveCategories, getCategoryByName } = useCategoriesStore();
  const dynamicCategories = useMemo(() => {
    const cats = getActiveCategories();
    return ["All Categories", ...cats.map(c => c.name)];
  }, [getActiveCategories]);

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);

  // Get selected category's attributes for dynamic filtering (must be after selectedCategory state)
  const selectedCategoryData = useMemo(() => {
    if (selectedCategory === "All Categories") return null;
    return getCategoryByName(selectedCategory);
  }, [selectedCategory, getCategoryByName]);

  const categoryAttributes = useMemo(() => {
    if (!selectedCategoryData?.attributes) return [];
    return selectedCategoryData.attributes.filter(attr => 
      attr.type === 'select' || attr.type === 'multi_select'
    );
  }, [selectedCategoryData]);
  const [selectedVendor, setSelectedVendor] = useState("All Vendors");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 100000]);
  const [priceRangeInitialized, setPriceRangeInitialized] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [attributeFilters, setAttributeFilters] = useState<Record<string, string>>({});
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

  // Advanced filtering and sorting logic
  const filteredAndSortedProducts = useMemo(() => {
    const filtered = allProducts.filter(product => {
      // Text search
      const matchesSearch = debouncedSearchQuery === "" ||
        product.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        product.description.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        (product.tags && product.tags.some(tag => tag.toLowerCase().includes(debouncedSearchQuery.toLowerCase()))) ||
        product.vendorName.toLowerCase().includes(debouncedSearchQuery.toLowerCase());

      // Category filter
      const matchesCategory = selectedCategory === "All Categories" || product.category === selectedCategory;

      // Vendor filter
      const matchesVendor = selectedVendor === "All Vendors" || product.vendorName === selectedVendor;

      // Price range filter
      const matchesPrice = product.price >= priceRange[0] && product.price <= priceRange[1];

      // Rating filter
      const rating = getAverageRating(product.id);
      const matchesRating = rating >= minRating;

      // Stock filter
      const inStock = !product.trackQuantity || product.quantity > 0;
      const matchesStock = !inStockOnly || inStock;

      // Category attribute filters
      const matchesAttributes = Object.entries(attributeFilters).every(([key, value]) => {
        if (!value || value === "all") return true;
        const productAttrs = product.categoryAttributes as Record<string, string> | undefined;
        return productAttrs?.[key] === value;
      });

      return matchesSearch && matchesCategory && matchesVendor && matchesPrice && matchesRating && matchesStock && matchesAttributes;
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
  }, [allProducts, debouncedSearchQuery, selectedCategory, selectedVendor, priceRange, minRating, inStockOnly, sortBy, getAverageRating, aiSearchResults, attributeFilters]);

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
  }, [maxPrice]);

  const activeFiltersCount = useMemo(() => {
    const attrFiltersActive = Object.values(attributeFilters).filter(v => v && v !== "all").length;
    return [
      selectedCategory !== "All Categories",
      selectedVendor !== "All Vendors",
      priceRange[0] > 0 || priceRange[1] < maxPrice,
      minRating > 0,
      inStockOnly,
    ].filter(Boolean).length + attrFiltersActive;
  }, [selectedCategory, selectedVendor, priceRange, maxPrice, minRating, inStockOnly, attributeFilters]);

  // Clear attribute filters when category changes
  useEffect(() => {
    setAttributeFilters({});
  }, [selectedCategory]);

  // Removed early return for loading state - will use conditional rendering in JSX

  const FilterSidebar = () => (
    <div className="space-y-6">
      {/* Categories */}
      <div>
        <Label className="text-sm font-semibold">Category</Label>
        <div className="mt-2 space-y-2">
          {dynamicCategories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`block w-full text-left text-sm py-1.5 px-2 rounded transition-colors ${
                selectedCategory === category
                  ? "bg-green-100 text-green-800 font-medium"
                  : "hover:bg-gray-100"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <Separator />

      {/* Vendor Filter */}
      {uniqueVendors.length > 1 && (
        <>
          <div>
            <Label className="text-sm font-semibold">Vendor</Label>
            <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
              {uniqueVendors.map((vendor) => (
                <button
                  key={vendor}
                  onClick={() => setSelectedVendor(vendor)}
                  className={`block w-full text-left text-sm py-1.5 px-2 rounded transition-colors ${
                    selectedVendor === vendor
                      ? "bg-emerald-100 text-emerald-800 font-medium"
                      : "hover:bg-gray-100"
                  }`}
                >
                  {vendor}
                </button>
              ))}
            </div>
          </div>
          <Separator />
        </>
      )}

      {/* Dynamic Category Attribute Filters */}
      {categoryAttributes.length > 0 && (
        <>
          {categoryAttributes.map((attr) => (
            <div key={attr.name}>
              <Label className="text-sm font-semibold">{attr.label || attr.name}</Label>
              <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                <button
                  onClick={() => setAttributeFilters(prev => ({ ...prev, [attr.name]: "all" }))}
                  className={`block w-full text-left text-sm py-1.5 px-2 rounded transition-colors ${
                    !attributeFilters[attr.name] || attributeFilters[attr.name] === "all"
                      ? "bg-emerald-100 text-emerald-800 font-medium"
                      : "hover:bg-gray-100"
                  }`}
                >
                  All {attr.label || attr.name}
                </button>
                {attr.options?.map((option) => (
                  <button
                    key={option}
                    onClick={() => setAttributeFilters(prev => ({ ...prev, [attr.name]: option }))}
                    className={`block w-full text-left text-sm py-1.5 px-2 rounded transition-colors ${
                      attributeFilters[attr.name] === option
                        ? "bg-emerald-100 text-emerald-800 font-medium"
                        : "hover:bg-gray-100"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <Separator />
        </>
      )}

      {/* Price Range */}
      <div>
        <Label className="text-sm font-semibold">Price Range (GHS)</Label>
        <div className="mt-4 px-2">
          <Slider
            value={priceRange}
            onValueChange={(value) => setPriceRange([value[0], value[1]])}
            min={0}
            max={maxPrice}
            step={100}
          />
          <div className="flex justify-between mt-2 text-sm text-muted-foreground">
            <span>GHS {priceRange[0].toLocaleString()}</span>
            <span>GHS {priceRange[1].toLocaleString()}</span>
          </div>
        </div>
      </div>

      <Separator />

      {/* Rating Filter */}
      <div>
        <Label className="text-sm font-semibold">Minimum Rating</Label>
        <div className="mt-2 space-y-2">
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
      </div>

      <Separator />

      {/* Other Filters */}
      <div className="space-y-3">
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
      </div>

      {activeFiltersCount > 0 && (
        <>
          <Separator />
          <Button variant="outline" onClick={clearFilters} className="w-full">
            <X className="w-4 h-4 mr-2" />
            Clear All Filters ({activeFiltersCount})
          </Button>
        </>
      )}
    </div>
  );

  const ProductCard = ({ product }: { product: Product }) => {
    const rating = getAverageRating(product.id);
    const reviewCount = getReviewsByProduct(product.id)?.length || 0;
    const inStock = !product.trackQuantity || product.quantity > 0;
    const discount = product.comparePrice
      ? Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)
      : 0;
    const isWishlisted = user ? isInWishlist(user.id, product.id) : false;

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
                <span className="font-bold text-lg text-green-600">GHS {(product.effectivePrice || product.price).toLocaleString()}</span>
                <span className="text-sm text-muted-foreground line-through">
                  GHS {product.price.toLocaleString()}
                </span>
                <Badge variant="destructive" className="text-xs animate-pulse">
                  {product.activeSale.discountType === 'percentage' 
                    ? `-${product.activeSale.discountValue}%` 
                    : `-GHS ${product.activeSale.discountValue}`}
                </Badge>
              </>
            ) : (
              <>
                <span className="font-bold text-lg">GHS {product.price.toLocaleString()}</span>
                {product.comparePrice && (
                  <span className="text-sm text-muted-foreground line-through">
                    GHS {product.comparePrice.toLocaleString()}
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
        {/* Search Header */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <Input
                type="text"
                placeholder="Search products, categories, vendors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 text-lg"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

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
                <SheetContent side="left" className="w-80">
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                    <SheetDescription>
                      Narrow down your search results
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-6">
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

              {/* View Mode */}
              <div className="hidden sm:flex items-center gap-1 border rounded-lg p-1">
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
        </div>

        <div className="flex gap-6">
          {/* Desktop Filters Sidebar */}
          <div className="hidden md:block w-64 flex-shrink-0">
            <Card className="p-4 sticky top-20">
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
              <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-12 h-12 animate-spin text-gray-400" />
              </div>
            ) : filteredAndSortedProducts.length === 0 ? (
              <div className="text-center py-16">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Products Found</h3>
                <p className="text-muted-foreground mb-4">
                  {allProducts.length === 0
                    ? "No products have been listed yet. Check back later!"
                    : "Try adjusting your search or filter criteria."}
                </p>
                {activeFiltersCount > 0 && (
                  <Button variant="outline" onClick={clearFilters}>
                    <X className="w-4 h-4 mr-2" />
                    Clear All Filters
                  </Button>
                )}
              </div>
            ) : (
              <div className={`grid gap-4 ${
                viewMode === "grid"
                  ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
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
