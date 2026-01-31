"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Package,
  Star,
  BarChart3,
  Loader2,
  Calendar,
  MessageSquare,
  Send,
  FileText,
  Download,
  Percent,
  AlertTriangle,
  LineChart
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { Product } from "@/lib/products-store";
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Legend
} from "recharts";
import { format, parseISO } from "date-fns";

interface ApiReview {
  id: string;
  product_id: string;
  buyer_id: string;
  buyer_name: string;
  rating: number;
  comment: string;
  status: string;
  created_at: string;
  updated_at: string;
  product_name?: string;
  vendor_reply?: string | null;
  vendor_reply_at?: string | null;
}

interface NormalizedReview {
  id: string;
  productId: string;
  buyerId: string;
  buyerName: string;
  rating: number;
  comment: string;
  productName: string;
  createdAt: string;
  vendorReply?: string | null;
  vendorReplyAt?: string | null;
}

interface SalesTrend {
  date: string;
  revenue: number;
  orders: number;
  itemsSold: number;
}

interface ProductPerformance {
  productId: string;
  productName: string;
  totalSold: number;
  totalRevenue: number;
  orderCount: number;
  avgRating: number | null;
  reviewCount: number;
}

interface VendorAnalyticsData {
  sales: {
    totalRevenue: number;
    totalOrders: number;
    totalItemsSold: number;
    avgOrderValue: number;
    grossSales: number;
    totalCommission: number;
    netEarnings: number;
    refundedAmount: number;
    salesTrends: SalesTrend[];
  };
  orders: {
    total: number;
    byStatus: Record<string, number>;
    byPaymentStatus: Record<string, number>;
    pendingFulfillment: number;
    completedOrders: number;
    cancelledOrders: number;
    fulfillmentRate: number;
  };
  products: {
    total: number;
    active: number;
    topPerformers: ProductPerformance[];
    lowStock: number;
  };
  reviews: {
    totalReviews: number;
    avgRating: number;
    ratingDistribution: Record<number, number>;
    recentReviews: Array<{
      id: string;
      productName: string;
      rating: number;
      comment: string;
      buyerName: string;
      createdAt: string;
    }>;
  };
  generatedAt: string;
}

const RATING_COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];

function VendorAnalyticsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated } = useAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y' | 'all'>("30d");
  const initialTab = searchParams.get("tab") || "trends";
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const tabFromUrl = searchParams.get("tab") || "trends";
    setActiveTab(tabFromUrl);
  }, [searchParams]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    router.push(`/vendor/analytics?tab=${value}`, { scroll: false });
  };
  
  const [vendorProducts, setVendorProducts] = useState<Product[]>([]);
  const [productReviews, setProductReviews] = useState<NormalizedReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState<VendorAnalyticsData | null>(null);
  const [vendorStats, setVendorStats] = useState<{
    products: { total: number; draft: number; active: number; pending: number; suspended: number };
    orders: { total: number; pending: number; completed: number; cancelled: number };
    revenue: number;
    recentOrders: Array<{ id: string; status: string; total: number; createdAt: string; buyerName: string }>;
    earnings?: {
      grossSales: number;
      total: number;
      commission: number;
      commissionRate: number;
      commissionSource: 'vendor' | 'category' | 'default';
      pending: number;
      completed: number;
    };
  } | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push("/auth/login");
    }
    if (isHydrated && user && user.role !== "vendor") {
      router.push("/");
    }
  }, [isHydrated, isAuthenticated, user, router]);

  useEffect(() => {
    const fetchData = async () => {
      if (!isHydrated || !user) return;
      
      setIsLoading(true);
      try {
        const bucket = timeRange === '7d' ? 'day' : timeRange === '30d' ? 'day' : timeRange === '90d' ? 'week' : 'month';
        
        const [productsRes, reviewsRes, statsRes, analyticsRes] = await Promise.all([
          fetch(`/api/products?vendorId=${user.id}`, { credentials: 'include' }),
          fetch(`/api/reviews?vendorId=${user.id}`, { credentials: 'include' }),
          fetch('/api/vendor/stats', { credentials: 'include', cache: 'no-store' }),
          fetch(`/api/vendor/analytics?range=${timeRange}&bucket=${bucket}`, { 
            credentials: 'include', 
            cache: 'no-store' 
          })
        ]);

        if (productsRes.ok) {
          const productsData = await productsRes.json();
          setVendorProducts(productsData.products || []);
        }

        if (reviewsRes.ok) {
          const reviewsData = await reviewsRes.json();
          const apiReviews: ApiReview[] = reviewsData.reviews || [];
          const normalized: NormalizedReview[] = apiReviews.map((r) => ({
            id: r.id,
            productId: r.product_id,
            buyerId: r.buyer_id,
            buyerName: r.buyer_name || 'Anonymous',
            rating: r.rating,
            comment: r.comment || '',
            productName: r.product_name || 'Unknown Product',
            createdAt: r.created_at,
            vendorReply: r.vendor_reply,
            vendorReplyAt: r.vendor_reply_at,
          }));
          setProductReviews(normalized);
        }

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setVendorStats(statsData);
        }

        if (analyticsRes.ok) {
          const analyticsResult = await analyticsRes.json();
          if (analyticsResult.success) {
            setAnalyticsData(analyticsResult.data);
          }
        }
      } catch (error) {
        console.error('Failed to fetch analytics data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isHydrated, user, timeRange]);

  const handleSubmitReply = async (reviewId: string) => {
    if (!replyText.trim()) {
      toast.error("Please enter a reply");
      return;
    }

    setIsSubmittingReply(true);
    try {
      const response = await fetch(`/api/reviews/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "reply", reply: replyText.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        setProductReviews((prev) =>
          prev.map((r) =>
            r.id === reviewId
              ? { ...r, vendorReply: data.review.vendor_reply, vendorReplyAt: data.review.vendor_reply_at }
              : r
          )
        );
        toast.success("Reply posted successfully");
        setReplyingTo(null);
        setReplyText("");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to post reply");
      }
    } catch (error) {
      console.error("Failed to submit reply:", error);
      toast.error("Failed to post reply");
    } finally {
      setIsSubmittingReply(false);
    }
  };

  if (!isHydrated || isLoading) {
    return (
      <SiteLayout>
        <div className="container py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="w-12 h-12 animate-spin text-gray-400" />
          </div>
        </div>
      </SiteLayout>
    );
  }

  if (!isAuthenticated || !user || user.role !== "vendor") {
    return null;
  }

  const averageStoreRating = productReviews.length > 0
    ? productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length
    : 0;

  const totalRevenue = analyticsData?.sales.totalRevenue || vendorStats?.revenue || 0;
  const totalOrders = analyticsData?.orders.total || vendorStats?.orders.total || 0;
  const completedOrders = analyticsData?.orders.completedOrders || vendorStats?.orders.completed || 0;
  const pendingOrders = analyticsData?.orders.pendingFulfillment || vendorStats?.orders.pending || 0;

  const statusCounts: Record<string, number> = analyticsData?.orders.byStatus || {};
  if (!analyticsData && vendorStats) {
    if (vendorStats.orders.pending > 0) statusCounts['pending'] = vendorStats.orders.pending;
    if (vendorStats.orders.completed > 0) statusCounts['delivered'] = vendorStats.orders.completed;
    if (vendorStats.orders.cancelled > 0) statusCounts['cancelled'] = vendorStats.orders.cancelled;
  }

  const formattedTrends = (analyticsData?.sales.salesTrends || []).map(t => ({
    ...t,
    formattedDate: (() => {
      try {
        return format(parseISO(t.date), timeRange === '7d' || timeRange === '30d' ? 'MMM d' : 'MMM yyyy');
      } catch {
        return t.date;
      }
    })()
  }));

  const ratingDistributionData = analyticsData?.reviews.ratingDistribution 
    ? Object.entries(analyticsData.reviews.ratingDistribution)
        .map(([rating, count]) => ({
          name: `${rating} Star${parseInt(rating) > 1 ? 's' : ''}`,
          value: count,
          rating: parseInt(rating)
        }))
        .sort((a, b) => b.rating - a.rating)
    : [];

  return (
    <SiteLayout>
      <div className="container py-8">
        <div className="mb-8">
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link href="/vendor">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Dashboard
            </Link>
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold flex items-center gap-2">
                <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6" />
                Store Analytics
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base">Track your store performance</p>
            </div>
            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
              <SelectTrigger className="w-32 sm:w-40">
                <Calendar className="w-4 h-4 mr-1 sm:mr-2 hidden sm:inline" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="1y">Last year</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-3xl font-bold">GHS {totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  <div className="flex items-center text-green-600 text-sm mt-1">
                    <TrendingUp className="w-4 h-4 mr-1" />
                    <span>From {totalOrders} orders</span>
                  </div>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Orders</p>
                  <p className="text-3xl font-bold">{totalOrders}</p>
                  <div className="flex items-center text-sm mt-1">
                    <span className="text-green-600">{completedOrders} completed</span>
                    <span className="mx-2">|</span>
                    <span className="text-orange-600">{pendingOrders} pending</span>
                  </div>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <ShoppingCart className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Products</p>
                  <p className="text-3xl font-bold">{analyticsData?.products.active || vendorProducts.filter(p => p.status === "active").length}</p>
                  <div className="flex items-center text-sm mt-1 text-muted-foreground">
                    {analyticsData?.products.total || vendorProducts.length} total products
                    {(analyticsData?.products.lowStock || 0) > 0 && (
                      <Badge variant="destructive" className="ml-2 text-xs">
                        {analyticsData?.products.lowStock} low stock
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <Package className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Store Rating</p>
                  <p className="text-3xl font-bold flex items-center gap-1">
                    {(analyticsData?.reviews.avgRating || averageStoreRating) > 0 
                      ? (analyticsData?.reviews.avgRating || averageStoreRating).toFixed(1) 
                      : "-"}
                    <Star className="w-6 h-6 text-yellow-400 fill-current" />
                  </p>
                  <div className="text-sm mt-1 text-muted-foreground">
                    {analyticsData?.reviews.totalReviews || productReviews.length} reviews
                  </div>
                </div>
                <div className="p-3 bg-yellow-100 rounded-full">
                  <Star className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="trends">Sales Trends</TabsTrigger>
            <TabsTrigger value="products">Top Products</TabsTrigger>
            <TabsTrigger value="orders">Recent Orders</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
            <TabsTrigger value="earnings">Earnings</TabsTrigger>
          </TabsList>

          <TabsContent value="trends">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LineChart className="w-5 h-5" />
                    Revenue Trend
                  </CardTitle>
                  <CardDescription>Sales revenue over time</CardDescription>
                </CardHeader>
                <CardContent>
                  {formattedTrends.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartsLineChart data={formattedTrends}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="formattedDate" fontSize={12} />
                        <YAxis fontSize={12} tickFormatter={(v) => `GHS ${v.toLocaleString()}`} />
                        <Tooltip 
                          formatter={(value: number) => [`GHS ${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 'Revenue']}
                          labelFormatter={(label) => `Date: ${label}`}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="revenue" 
                          stroke="#22c55e" 
                          strokeWidth={2}
                          dot={{ fill: '#22c55e' }}
                        />
                      </RechartsLineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center">
                      <div className="text-center">
                        <LineChart className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                        <p className="text-muted-foreground">No sales data for this period</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5" />
                    Orders Trend
                  </CardTitle>
                  <CardDescription>Number of orders over time</CardDescription>
                </CardHeader>
                <CardContent>
                  {formattedTrends.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={formattedTrends}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="formattedDate" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip 
                          formatter={(value: number) => [value, 'Orders']}
                          labelFormatter={(label) => `Date: ${label}`}
                        />
                        <Bar dataKey="orders" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center">
                      <div className="text-center">
                        <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                        <p className="text-muted-foreground">No order data for this period</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="w-5 h-5" />
                    Rating Distribution
                  </CardTitle>
                  <CardDescription>Breakdown of customer ratings</CardDescription>
                </CardHeader>
                <CardContent>
                  {ratingDistributionData.some(d => d.value > 0) ? (
                    <div className="space-y-3">
                      {[5, 4, 3, 2, 1].map((rating) => {
                        const count = analyticsData?.reviews.ratingDistribution[rating] || 0;
                        const total = analyticsData?.reviews.totalReviews || 1;
                        const percentage = total > 0 ? (count / total) * 100 : 0;
                        return (
                          <div key={rating} className="flex items-center gap-2">
                            <div className="flex items-center gap-1 w-16">
                              <span className="text-sm">{rating}</span>
                              <Star className="w-4 h-4 text-yellow-400 fill-current" />
                            </div>
                            <div className="flex-1 bg-gray-200 rounded-full h-2.5">
                              <div 
                                className="h-2.5 rounded-full" 
                                style={{ 
                                  width: `${percentage}%`,
                                  backgroundColor: RATING_COLORS[rating - 1]
                                }}
                              />
                            </div>
                            <span className="w-12 text-sm text-muted-foreground text-right">
                              {count}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="h-[200px] flex items-center justify-center">
                      <div className="text-center">
                        <Star className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                        <p className="text-muted-foreground">No reviews yet</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Percent className="w-5 h-5" />
                    Performance Summary
                  </CardTitle>
                  <CardDescription>Key metrics at a glance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-muted-foreground">Avg Order Value</span>
                      <span className="font-bold">
                        GHS {(analyticsData?.sales.avgOrderValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-muted-foreground">Items Sold</span>
                      <span className="font-bold">{analyticsData?.sales.totalItemsSold || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-muted-foreground">Fulfillment Rate</span>
                      <span className="font-bold">
                        {(analyticsData?.orders.fulfillmentRate || 0).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-muted-foreground">Net Earnings</span>
                      <span className="font-bold text-green-600">
                        GHS {(analyticsData?.sales.netEarnings || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="products">
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Products</CardTitle>
                <CardDescription>Your best-selling products by revenue</CardDescription>
              </CardHeader>
              <CardContent>
                {(analyticsData?.products.topPerformers || []).length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-muted-foreground">No product sales data yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {analyticsData?.products.topPerformers.map((product, index) => (
                      <div key={product.productId} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                            index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-600' : 'bg-gray-200 text-gray-600'
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium">{product.productName}</p>
                            <p className="text-sm text-muted-foreground">
                              {product.totalSold} sold | {product.orderCount} orders
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">
                            GHS {product.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                          {product.avgRating && (
                            <div className="flex items-center justify-end gap-1 text-sm">
                              <Star className="w-3 h-3 text-yellow-400 fill-current" />
                              <span>{product.avgRating.toFixed(1)}</span>
                              <span className="text-muted-foreground">({product.reviewCount})</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>Recent Orders</CardTitle>
                <CardDescription>Your latest orders from customers</CardDescription>
              </CardHeader>
              <CardContent>
                {!vendorStats?.recentOrders || vendorStats.recentOrders.length === 0 ? (
                  <div className="text-center py-12">
                    <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-muted-foreground">No orders yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {vendorStats.recentOrders.map((order, index) => (
                      <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium">{order.buyerName}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(order.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge
                            variant={
                              order.status === "delivered" ? "default" :
                              order.status === "pending" ? "secondary" :
                              order.status === "cancelled" ? "destructive" : "outline"
                            }
                            className="mb-1"
                          >
                            {order.status}
                          </Badge>
                          <p className="font-bold text-green-600">GHS {order.total.toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reviews">
            <Card>
              <CardHeader>
                <CardTitle>Recent Product Reviews</CardTitle>
                <CardDescription>Latest feedback from customers</CardDescription>
              </CardHeader>
              <CardContent>
                {productReviews.length === 0 ? (
                  <div className="text-center py-12">
                    <Star className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-muted-foreground">No reviews yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {productReviews.slice(0, 10).map((review) => (
                      <div key={review.id} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium">{review.productName}</p>
                            <p className="text-sm text-muted-foreground">by {review.buyerName}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`w-4 h-4 ${
                                  i < review.rating ? "text-yellow-400 fill-current" : "text-gray-300"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        <p className="text-sm text-gray-700">{review.comment}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(review.createdAt).toLocaleDateString()}
                        </p>
                        {review.vendorReply ? (
                          <div className="mt-3 pl-4 border-l-2 border-green-200 bg-green-50 p-3 rounded-r-lg">
                            <p className="text-xs font-medium text-green-700 mb-1">Your Reply</p>
                            <p className="text-sm text-gray-700">{review.vendorReply}</p>
                            {review.vendorReplyAt && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(review.vendorReplyAt).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="mt-3">
                            {replyingTo === review.id ? (
                              <div className="space-y-2">
                                <Textarea
                                  placeholder="Write your reply to this customer..."
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                  rows={3}
                                  className="text-sm"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleSubmitReply(review.id)}
                                    disabled={isSubmittingReply || !replyText.trim()}
                                  >
                                    {isSubmittingReply ? (
                                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                    ) : (
                                      <Send className="w-4 h-4 mr-1" />
                                    )}
                                    Post Reply
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setReplyingTo(null);
                                      setReplyText("");
                                    }}
                                    disabled={isSubmittingReply}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setReplyingTo(review.id)}
                              >
                                <MessageSquare className="w-4 h-4 mr-1" />
                                Reply to Customer
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="earnings">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Earnings Statement
                    </CardTitle>
                    <CardDescription>Lifetime breakdown of your earnings and platform fees</CardDescription>
                  </div>
                  {vendorStats?.earnings && (
                    <Badge 
                      variant="outline" 
                      className={
                        vendorStats.earnings.commissionSource === 'vendor' 
                          ? 'text-purple-600 border-purple-600' 
                          : vendorStats.earnings.commissionSource === 'category'
                          ? 'text-blue-600 border-blue-600'
                          : 'text-gray-600 border-gray-600'
                      }
                    >
                      {vendorStats.earnings.commissionSource === 'vendor' 
                        ? `Custom Rate: ${(vendorStats.earnings.commissionRate * 100).toFixed(0)}%`
                        : vendorStats.earnings.commissionSource === 'category'
                        ? `Category Rate: ${(vendorStats.earnings.commissionRate * 100).toFixed(0)}%`
                        : `Platform Rate: ${(vendorStats.earnings.commissionRate * 100).toFixed(0)}%`
                      }
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {vendorStats?.earnings ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card className="bg-gray-50">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-4 h-4 text-gray-600" />
                            <span className="text-sm font-medium text-muted-foreground">Gross Sales</span>
                          </div>
                          <p className="text-2xl font-bold">
                            GHS {vendorStats.earnings.grossSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="bg-red-50">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Percent className="w-4 h-4 text-red-600" />
                            <span className="text-sm font-medium text-red-700">Platform Fees</span>
                          </div>
                          <p className="text-2xl font-bold text-red-600">
                            - GHS {vendorStats.earnings.commission.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="bg-green-50">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <DollarSign className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-medium text-green-700">Net Earnings</span>
                          </div>
                          <p className="text-2xl font-bold text-green-600">
                            GHS {vendorStats.earnings.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="border-2">
                      <CardHeader className="bg-gray-50 border-b">
                        <CardTitle className="text-lg">Earnings Statement</CardTitle>
                        <CardDescription>Summary of all earnings to date</CardDescription>
                      </CardHeader>
                      <CardContent className="p-0">
                        <table className="w-full">
                          <thead className="bg-gray-50 border-b">
                            <tr>
                              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Description</th>
                              <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Amount (GHS)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            <tr>
                              <td className="px-4 py-3">
                                <div className="font-medium">Gross Sales</div>
                                <div className="text-xs text-muted-foreground">Total value of all orders</div>
                              </td>
                              <td className="px-4 py-3 text-right font-medium">
                                {vendorStats.earnings.grossSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                            <tr className="bg-red-50">
                              <td className="px-4 py-3">
                                <div className="font-medium text-red-700">Platform Fee ({(vendorStats.earnings.commissionRate * 100).toFixed(0)}%)</div>
                                <div className="text-xs text-red-600">Payment processing, buyer protection, marketplace services</div>
                              </td>
                              <td className="px-4 py-3 text-right font-medium text-red-600">
                                - {vendorStats.earnings.commission.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                            <tr className="bg-green-50">
                              <td className="px-4 py-3">
                                <div className="font-bold text-green-800">Net Earnings</div>
                                <div className="text-xs text-green-600">Your total earnings after fees</div>
                              </td>
                              <td className="px-4 py-3 text-right text-xl font-bold text-green-600">
                                {vendorStats.earnings.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card className="border-l-4 border-l-amber-500">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Calendar className="w-4 h-4 text-amber-600" />
                            <span className="text-sm font-medium">Pending Earnings</span>
                          </div>
                          <p className="text-xl font-bold text-amber-700">
                            GHS {vendorStats.earnings.pending.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">From orders still in progress</p>
                        </CardContent>
                      </Card>
                      <Card className="border-l-4 border-l-green-500">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Download className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-medium">Available for Withdrawal</span>
                          </div>
                          <p className="text-xl font-bold text-green-700">
                            GHS {vendorStats.earnings.completed.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">From completed orders</p>
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="p-4">
                        <h4 className="font-medium text-blue-800 mb-2">Understanding Your Rate</h4>
                        <p className="text-sm text-blue-700">
                          {vendorStats.earnings.commissionSource === 'vendor' 
                            ? `You have a special partner rate of ${(vendorStats.earnings.commissionRate * 100).toFixed(0)}%. This rate was negotiated for your account and is lower than the standard marketplace rate.`
                            : vendorStats.earnings.commissionSource === 'category'
                            ? `Your rate of ${(vendorStats.earnings.commissionRate * 100).toFixed(0)}% is based on the category of products you sell. Different categories have different rates based on industry standards.`
                            : `You're on the standard marketplace rate of ${(vendorStats.earnings.commissionRate * 100).toFixed(0)}%. This covers payment processing, buyer protection, customer support, and platform infrastructure.`
                          }
                        </p>
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Earnings Yet</h3>
                    <p className="text-muted-foreground">
                      Complete your first sale to see your earnings statement.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </SiteLayout>
  );
}

export default function VendorAnalyticsPage() {
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
      <VendorAnalyticsContent />
    </Suspense>
  );
}
