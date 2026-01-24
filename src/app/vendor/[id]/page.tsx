"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Star,
  Shield,
  MapPin,
  Clock,
  Package,
  Store,
  MessageSquare,
  Heart,
  Search,
  Grid3X3,
  List,
  CheckCircle,
  TrendingUp,
  Users,
  ShoppingCart,
  ArrowLeft,
  Loader2,
  Phone,
  Mail,
  Globe,
  Facebook,
  Instagram,
  Twitter,
  Power,
  PowerOff,
  Palmtree,
  ExternalLink,
  AlertTriangle,
  Truck,
  RefreshCw,
  ShieldCheck,
  Calendar
} from "lucide-react";
import { useProductsStore, Product } from "@/lib/products-store";
import { useUsersStore, PlatformUser } from "@/lib/users-store";
import { useReviewsStore } from "@/lib/reviews-store";
import { useOrdersStore } from "@/lib/orders-store";
import { useCartStore } from "@/lib/cart-store";
import { usePromotionsStore } from "@/lib/promotions-store";
import { useAuthStore } from "@/lib/auth-store";
import { useVerificationSubmissionsStore } from "@/lib/verification-submissions-store";
import { VerificationBadges } from "@/components/vendor/verification-badges";
import { toast } from "sonner";
import { formatDistance, format } from "date-fns";

export default function VendorStorePage() {
  const params = useParams();
  const router = useRouter();
  const vendorId = params.id as string;

  const { getProductsByVendor } = useProductsStore();
  const { getUserById, users } = useUsersStore();
  const { getOrdersByVendor } = useOrdersStore();
  const { addItem } = useCartStore();
  const { getSalePrice, getActiveSales } = usePromotionsStore();
  const { user: currentUser } = useAuthStore();
  const { getSubmission } = useVerificationSubmissionsStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("featured");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isHydrated, setIsHydrated] = useState(false);
  const [dbVendor, setDbVendor] = useState<PlatformUser | null>(null);
  const [dbProducts, setDbProducts] = useState<Product[]>([]);
  const [vendorStats, setVendorStats] = useState<{ totalSales: number }>({ totalSales: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    const fetchVendorData = async () => {
      if (!vendorId) return;
      setIsLoading(true);
      try {
        const [vendorRes, productsRes, statsRes] = await Promise.all([
          fetch(`/api/vendors/${vendorId}`),
          fetch(`/api/products?vendorId=${vendorId}&status=active`),
          fetch(`/api/vendors/${vendorId}/stats`)
        ]);

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setVendorStats({ totalSales: statsData.totalSales || 0 });
        }

        if (vendorRes.ok) {
          const vendorData = await vendorRes.json();
          if (vendorData.user) {
            setDbVendor({
              id: vendorData.user.id,
              email: vendorData.user.email,
              name: vendorData.user.name,
              role: vendorData.user.role,
              status: vendorData.user.status,
              avatar: vendorData.user.avatar,
              phone: vendorData.user.phone,
              location: vendorData.user.location,
              createdAt: vendorData.user.createdAt,
              updatedAt: vendorData.user.updatedAt,
              businessName: vendorData.user.businessName,
              verificationStatus: vendorData.user.verificationStatus,
              storeDescription: vendorData.user.storeDescription,
              storeBanner: vendorData.user.storeBanner,
              storeLogo: vendorData.user.storeLogo,
              storeWebsite: vendorData.user.storeWebsite,
              storeBusinessHours: vendorData.user.storeBusinessHours,
              storeReturnPolicy: vendorData.user.storeReturnPolicy,
              storeShippingPolicy: vendorData.user.storeShippingPolicy,
              storeSpecialties: vendorData.user.storeSpecialties,
              storeCertifications: vendorData.user.storeCertifications,
              storeRating: vendorData.user.storeRating,
              storeResponseTime: vendorData.user.storeResponseTime,
              storeStatus: vendorData.user.storeStatus,
              storeVacationMessage: vendorData.user.storeVacationMessage,
              storeContactEmail: vendorData.user.storeContactEmail,
              storeContactPhone: vendorData.user.storeContactPhone,
              storeSocialLinks: vendorData.user.storeSocialLinks,
            });
          }
        }

        if (productsRes.ok) {
          const productsData = await productsRes.json();
          setDbProducts(productsData.products || []);
        }
      } catch (error) {
        console.error('Failed to fetch vendor data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVendorData();
  }, [vendorId]);

  const vendor = dbVendor || (currentUser && currentUser.id === vendorId && currentUser.role === 'vendor' ? {
    id: currentUser.id,
    email: currentUser.email,
    name: currentUser.name,
    role: 'vendor' as const,
    status: 'active' as const,
    avatar: currentUser.avatar,
    phone: currentUser.phone,
    location: currentUser.location,
    createdAt: currentUser.createdAt,
    updatedAt: currentUser.createdAt,
    businessName: currentUser.businessName,
    verificationStatus: currentUser.verificationStatus,
    storeDescription: currentUser.storeDescription,
    storeBanner: currentUser.storeBanner,
    storeLogo: currentUser.storeLogo,
    storeWebsite: currentUser.storeWebsite,
    storeBusinessHours: currentUser.storeBusinessHours,
    storeReturnPolicy: currentUser.storeReturnPolicy,
    storeShippingPolicy: currentUser.storeShippingPolicy,
    storeSpecialties: currentUser.storeSpecialties,
    storeCertifications: currentUser.storeCertifications,
    storeRating: currentUser.storeRating,
    storeResponseTime: currentUser.storeResponseTime,
    storeStatus: currentUser.storeStatus,
    storeVacationMessage: currentUser.storeVacationMessage,
    storeContactEmail: currentUser.storeContactEmail,
    storeContactPhone: currentUser.storeContactPhone,
    storeSocialLinks: currentUser.storeSocialLinks,
  } : null);

  // Get vendor's products from database (already filtered to active)
  const vendorProducts = useMemo(() => {
    if (!isHydrated) return [];
    return dbProducts.length > 0 ? dbProducts : getProductsByVendor(vendorId).filter(p => p.status === "active");
  }, [isHydrated, dbProducts, vendorId, getProductsByVendor]);

  // Get vendor's orders for stats
  const vendorOrders = useMemo(() => {
    if (!isHydrated) return [];
    return getOrdersByVendor(vendorId);
  }, [isHydrated, vendorId, getOrdersByVendor]);

  // Real metrics from API data
  const totalSales = vendorStats.totalSales;
  const totalRevenue = vendorOrders
    .filter(o => o.status === 'delivered')
    .reduce((sum, order) => {
      const vendorItems = order.items.filter(item => item.vendorId === vendorId);
      return sum + vendorItems.reduce((s, i) => s + i.price * i.quantity, 0);
    }, 0);

  // Calculate categories from products
  const categories = useMemo(() => {
    return [...new Set(vendorProducts.map(p => p.category))].sort();
  }, [vendorProducts]);

  // Get active sales for this vendor
  const activeSales = useMemo(() => {
    if (!isHydrated) return [];
    return getActiveSales(vendorId);
  }, [isHydrated, vendorId, getActiveSales]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let filtered = vendorProducts
      .filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          product.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = categoryFilter === "all" || product.category === categoryFilter;
        return matchesSearch && matchesCategory;
      });

    // Sort
    switch (sortBy) {
      case "price_low":
        filtered = filtered.sort((a, b) => a.price - b.price);
        break;
      case "price_high":
        filtered = filtered.sort((a, b) => b.price - a.price);
        break;
      case "newest":
        filtered = filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case "popular":
        // Sort by featured first
        filtered = filtered.sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));
        break;
      default:
        break;
    }

    return filtered;
  }, [vendorProducts, searchQuery, categoryFilter, sortBy]);

  const handleAddToCart = (product: Product) => {
    if (vendor?.storeStatus === 'closed') {
      toast.error("This store is currently closed");
      return;
    }
    if (vendor?.storeStatus === 'vacation') {
      toast.error("This store is on vacation");
      return;
    }

    // Get sale price if applicable
    const { salePrice } = getSalePrice(product.id, product.price);

    addItem({
      id: product.id,
      name: product.name,
      price: salePrice,
      image: product.images[0] || "",
      vendor: product.vendorName,
      vendorId: product.vendorId,
      quantity: 1,
      maxQuantity: product.trackQuantity ? product.quantity : 999
    });
    toast.success(`Added ${product.name} to cart!`);
  };

  // Loading state
  if (!isHydrated || isLoading) {
    return (
      <SiteLayout>
        <div className="container py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="w-12 h-12 animate-spin text-emerald-500" />
          </div>
        </div>
      </SiteLayout>
    );
  }

  // Vendor not found
  if (!vendor || (vendor.role !== "vendor" && vendor.role !== 'admin' && vendor.role !== 'master_admin')) {
    return (
      <SiteLayout>
        <div className="container py-8">
          <div className="text-center py-16">
            <Store className="w-20 h-20 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Store Not Found</h2>
            <p className="text-muted-foreground mb-6">
              The store you're looking for doesn't exist or has been removed.
            </p>
            <Button onClick={() => router.push("/search")} size="lg">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Browse Products
            </Button>
          </div>
        </div>
      </SiteLayout>
    );
  }

  const storeName = vendor.businessName || vendor.name;
  const storeRating = vendor.storeRating || 0;
  const responseTime = vendor.storeResponseTime || "< 24 hours";
  const storeStatus = vendor.storeStatus || 'open';
  const joinedDate = format(new Date(vendor.createdAt), "MMMM yyyy");

  const getStoreStatusBadge = () => {
    switch (storeStatus) {
      case 'open':
        return <Badge className="bg-green-100 text-green-800 border-green-200"><Power className="w-3 h-3 mr-1" /> Open</Badge>;
      case 'closed':
        return <Badge className="bg-red-100 text-red-800 border-red-200"><PowerOff className="w-3 h-3 mr-1" /> Temporarily Closed</Badge>;
      case 'vacation':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200"><Palmtree className="w-3 h-3 mr-1" /> On Vacation</Badge>;
      default:
        return null;
    }
  };

  const ProductCard = ({ product }: { product: Product }) => {
    const inStock = !product.trackQuantity || product.quantity > 0;
    const { salePrice, discount, sale } = getSalePrice(product.id, product.price);
    const isOnSale = discount > 0;
    const discountPercent = isOnSale ? Math.round((discount / product.price) * 100) : 0;
    const isStoreOpen = storeStatus === 'open';

    return (
      <Card className="group hover:shadow-xl transition-all duration-300 overflow-hidden border-0 bg-white">
        <Link href={`/product/${product.id}`}>
          <div className="relative aspect-square overflow-hidden bg-gray-100">
            {product.images.length > 0 ? (
              <img
                src={product.images[0]}
                alt={product.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-16 h-16 text-gray-300" />
              </div>
            )}

            {/* Badges */}
            <div className="absolute top-3 left-3 flex flex-col gap-2">
              {isOnSale && (
                <Badge className="bg-red-500 text-white border-0 shadow-lg">
                  -{discountPercent}% OFF
                </Badge>
              )}
              {product.isFeatured && (
                <Badge className="bg-amber-500 text-white border-0 shadow-lg">
                  <Star className="w-3 h-3 mr-1 fill-current" /> Featured
                </Badge>
              )}
            </div>

            {!inStock && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="text-white font-semibold text-lg">Out of Stock</span>
              </div>
            )}
          </div>
        </Link>

        <CardContent className="p-4">
          <Link href={`/product/${product.id}`}>
            <h3 className="font-semibold text-gray-900 line-clamp-2 mb-2 group-hover:text-emerald-600 transition-colors">
              {product.name}
            </h3>
          </Link>

          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-xl font-bold text-gray-900">
              GHS {salePrice.toLocaleString()}
            </span>
            {isOnSale && (
              <span className="text-sm text-gray-400 line-through">
                GHS {product.price.toLocaleString()}
              </span>
            )}
          </div>

          <Button
            className={`w-full ${isStoreOpen && inStock ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-gray-400'}`}
            disabled={!inStock || !isStoreOpen}
            onClick={(e) => {
              e.preventDefault();
              handleAddToCart(product);
            }}
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            {!isStoreOpen ? 'Store Closed' : !inStock ? 'Out of Stock' : 'Add to Cart'}
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <SiteLayout>
      {/* Store Status Alerts */}
      {storeStatus === 'closed' && (
        <div className="bg-red-50 border-b border-red-200">
          <div className="container py-3">
            <Alert className="bg-transparent border-0 p-0">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                This store is temporarily closed. Products are visible but orders cannot be placed.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      )}

      {storeStatus === 'vacation' && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="container py-3">
            <Alert className="bg-transparent border-0 p-0">
              <Palmtree className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                {vendor.storeVacationMessage || "This store is currently on vacation. Please check back later."}
              </AlertDescription>
            </Alert>
          </div>
        </div>
      )}

      <div className="container py-6 md:py-8">
        {/* Back Button */}
        <Button variant="ghost" className="mb-6 -ml-2 text-muted-foreground hover:text-foreground" asChild>
          <Link href="/search">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Products
          </Link>
        </Button>

        {/* Store Header */}
        <div className="mb-8">
          {/* Banner */}
          <div className="relative h-40 md:h-56 rounded-2xl overflow-hidden bg-gradient-to-r from-emerald-600 to-teal-600 mb-6">
            {vendor.storeBanner ? (
              <img
                src={vendor.storeBanner}
                alt="Store Banner"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Store className="w-20 h-20 text-white/30" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          </div>

          {/* Store Info Card */}
          <div className="bg-white rounded-2xl shadow-lg border p-6 -mt-20 relative z-10 mx-4 md:mx-8">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Logo */}
              <Avatar className="w-24 h-24 md:w-28 md:h-28 border-4 border-white shadow-xl -mt-16 md:-mt-20 self-start">
                <AvatarImage src={vendor.storeLogo || vendor.avatar} />
                <AvatarFallback className="text-3xl bg-emerald-100 text-emerald-700">
                  {storeName[0]}
                </AvatarFallback>
              </Avatar>

              {/* Info */}
              <div className="flex-1">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">{storeName}</h1>
                      {vendor.verificationStatus === "verified" && (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                          <ShieldCheck className="w-3 h-3 mr-1" />
                          Verified Seller
                        </Badge>
                      )}
                      {(() => {
                        const submission = getSubmission(vendorId);
                        if (submission && submission.status === 'under_review') {
                          return (
                            <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                              <Clock className="w-3 h-3 mr-1" />
                              Verification Pending
                            </Badge>
                          );
                        }
                        if (submission && submission.status === 'submitted') {
                          return (
                            <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                              <Shield className="w-3 h-3 mr-1" />
                              Documents Submitted
                            </Badge>
                          );
                        }
                        return null;
                      })()}
                      {getStoreStatusBadge()}
                    </div>

                    {vendor.storeDescription && (
                      <p className="text-gray-600 mb-4 line-clamp-2 md:line-clamp-none max-w-2xl">
                        {vendor.storeDescription}
                      </p>
                    )}

                    {/* Quick Stats */}
                    <div className="flex flex-wrap items-center gap-4 md:gap-6 text-sm">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Package className="w-4 h-4 text-emerald-600" />
                        <span><strong>{vendorProducts.length}</strong> Products</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <ShoppingCart className="w-4 h-4 text-emerald-600" />
                        <span><strong>{totalSales}</strong> Sales</span>
                      </div>
                      {vendor.location && (
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <MapPin className="w-4 h-4 text-emerald-600" />
                          <span>{vendor.location}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Calendar className="w-4 h-4 text-emerald-600" />
                        <span>Joined {joinedDate}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <Button variant="outline" asChild>
                      <Link href={`/messages?vendor=${vendorId}`}>
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Message
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Trust Indicators */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-white">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Response Time</p>
                <p className="font-semibold text-gray-900">{responseTime}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-white">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Truck className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Shipping</p>
                <p className="font-semibold text-gray-900">Available</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50 to-white">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Returns</p>
                <p className="font-semibold text-gray-900">{vendor.storeReturnPolicy ? 'Available' : 'Contact Seller'}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-white">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <Shield className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Protection</p>
                <p className="font-semibold text-gray-900">Buyer Guaranteed</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="products" className="space-y-6">
          <TabsList className="bg-gray-100 p-1 rounded-lg">
            <TabsTrigger value="products" className="rounded-md">
              Products ({vendorProducts.length})
            </TabsTrigger>
            <TabsTrigger value="about" className="rounded-md">About</TabsTrigger>
            <TabsTrigger value="policies" className="rounded-md">Policies</TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="space-y-6">
            {/* Active Sales Banner */}
            {activeSales.length > 0 && (
              <div className="bg-gradient-to-r from-red-500 to-pink-500 rounded-xl p-4 text-white">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Sale Active!</h3>
                    <p className="text-white/80 text-sm">{activeSales.length} promotion(s) running now</p>
                  </div>
                </div>
              </div>
            )}

            {/* Search and Filters */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        placeholder="Search products in this store..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 border-gray-200"
                      />
                    </div>
                  </div>

                  {categories.length > 0 && (
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="w-full md:w-48 border-gray-200">
                        <SelectValue placeholder="All Categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category} value={category}>{category}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-full md:w-48 border-gray-200">
                      <SelectValue placeholder="Sort By" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="featured">Featured</SelectItem>
                      <SelectItem value="popular">Most Popular</SelectItem>
                      <SelectItem value="price_low">Price: Low to High</SelectItem>
                      <SelectItem value="price_high">Price: High to Low</SelectItem>
                      <SelectItem value="newest">Newest First</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="flex gap-1 border rounded-lg p-1 bg-gray-50">
                    <Button
                      variant={viewMode === "grid" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("grid")}
                      className={viewMode === "grid" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                    >
                      <Grid3X3 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={viewMode === "list" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("list")}
                      className={viewMode === "list" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                    >
                      <List className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Products Grid */}
            {filteredProducts.length === 0 ? (
              <div className="text-center py-16 bg-gray-50 rounded-2xl">
                <Package className="w-20 h-20 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2 text-gray-900">
                  {vendorProducts.length === 0 ? "No Products Yet" : "No products found"}
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {vendorProducts.length === 0
                    ? "This store hasn't listed any products yet. Check back soon!"
                    : "Try adjusting your search or filter criteria to find what you're looking for."}
                </p>
              </div>
            ) : (
              <div className={`grid gap-6 ${
                viewMode === "grid"
                  ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
                  : "grid-cols-1"
              }`}>
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="about" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Store className="w-5 h-5 text-emerald-600" />
                    Store Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-gray-500">Store Name</span>
                    <span className="font-medium text-gray-900">{storeName}</span>
                  </div>
                  {vendor.location && (
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-gray-500">Location</span>
                      <span className="font-medium text-gray-900">{vendor.location}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-gray-500">Member Since</span>
                    <span className="font-medium text-gray-900">{joinedDate}</span>
                  </div>
                  {vendor.storeBusinessHours && (
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-gray-500">Business Hours</span>
                      <span className="font-medium text-gray-900">{vendor.storeBusinessHours}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-gray-500">Response Time</span>
                    <span className="font-medium text-gray-900">{responseTime}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    Verification Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className={`flex items-center gap-4 p-4 rounded-lg ${
                    vendor.verificationStatus === "verified"
                      ? "bg-emerald-50 border border-emerald-200"
                      : "bg-amber-50 border border-amber-200"
                  }`}>
                    {vendor.verificationStatus === "verified" ? (
                      <>
                        <CheckCircle className="w-10 h-10 text-emerald-600" />
                        <div>
                          <p className="font-semibold text-emerald-800">Verified Seller</p>
                          <p className="text-sm text-emerald-700">
                            Identity and business documents verified
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <Shield className="w-10 h-10 text-amber-600" />
                        <div>
                          <p className="font-semibold text-amber-800">Verification Pending</p>
                          <p className="text-sm text-amber-700">
                            This seller is awaiting verification
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Contact Info */}
                  <Separator />
                  <div className="space-y-3">
                    {vendor.storeContactEmail && (
                      <div className="flex items-center gap-3">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">{vendor.storeContactEmail}</span>
                      </div>
                    )}
                    {vendor.storeContactPhone && (
                      <div className="flex items-center gap-3">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">{vendor.storeContactPhone}</span>
                      </div>
                    )}
                    {vendor.storeWebsite && (
                      <div className="flex items-center gap-3">
                        <Globe className="w-4 h-4 text-gray-400" />
                        <a href={vendor.storeWebsite} target="_blank" rel="noopener noreferrer"
                          className="text-sm text-emerald-600 hover:underline flex items-center gap-1">
                          {vendor.storeWebsite.replace(/^https?:\/\//, '')}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Social Links */}
                  {vendor.storeSocialLinks && Object.values(vendor.storeSocialLinks).some(v => v) && (
                    <>
                      <Separator />
                      <div className="flex items-center gap-3">
                        {vendor.storeSocialLinks.facebook && (
                          <a href={vendor.storeSocialLinks.facebook} target="_blank" rel="noopener noreferrer"
                            className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center hover:bg-blue-200 transition-colors">
                            <Facebook className="w-5 h-5 text-blue-600" />
                          </a>
                        )}
                        {vendor.storeSocialLinks.instagram && (
                          <a href={vendor.storeSocialLinks.instagram} target="_blank" rel="noopener noreferrer"
                            className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center hover:bg-pink-200 transition-colors">
                            <Instagram className="w-5 h-5 text-pink-600" />
                          </a>
                        )}
                        {vendor.storeSocialLinks.twitter && (
                          <a href={vendor.storeSocialLinks.twitter} target="_blank" rel="noopener noreferrer"
                            className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center hover:bg-sky-200 transition-colors">
                            <Twitter className="w-5 h-5 text-sky-500" />
                          </a>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {vendor.storeDescription && (
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle>About This Store</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">{vendor.storeDescription}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="policies" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-purple-600" />
                    Returns Policy
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 whitespace-pre-wrap">
                    {vendor.storeReturnPolicy || "Contact the vendor for information about their return policy."}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="w-5 h-5 text-blue-600" />
                    Shipping Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 whitespace-pre-wrap">
                    {vendor.storeShippingPolicy || "Contact the vendor for shipping rates and delivery times."}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-emerald-600" />
                    Buyer Protection
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">
                    All purchases from this store are protected by our marketplace buyer protection program.
                    If there's an issue with your order, we're here to help.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </SiteLayout>
  );
}
