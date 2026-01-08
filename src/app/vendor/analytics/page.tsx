"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Package,
  Users,
  Eye,
  Star,
  BarChart3,
  Loader2,
  Calendar
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { useProductsStore, Product } from "@/lib/products-store";
import { useOrdersStore } from "@/lib/orders-store";

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
}

export default function VendorAnalyticsPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { syncVendorProducts } = useProductsStore();
  const { getOrdersByVendor, getOrderStats } = useOrdersStore();
  const [isHydrated, setIsHydrated] = useState(false);
  const [timeRange, setTimeRange] = useState("30");
  const [vendorProducts, setVendorProducts] = useState<Product[]>([]);
  const [productReviews, setProductReviews] = useState<NormalizedReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
        const [productsRes, reviewsRes] = await Promise.all([
          fetch(`/api/products?vendorId=${user.id}`, { credentials: 'include' }),
          fetch(`/api/reviews?vendorId=${user.id}`, { credentials: 'include' })
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
          }));
          setProductReviews(normalized);
        }
      } catch (error) {
        console.error('Failed to fetch analytics data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isHydrated, user]);

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

  const vendorOrders = getOrdersByVendor(user.id);
  const orderStats = getOrderStats(user.id);

  const averageStoreRating = productReviews.length > 0
    ? productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length
    : 0;

  // Calculate metrics
  const totalRevenue = orderStats.totalRevenue;
  const totalOrders = orderStats.totalOrders;
  const completedOrders = orderStats.completedOrders;
  const pendingOrders = orderStats.pendingOrders;

  // Get top products by orders
  const productOrderCounts: Record<string, { name: string; orders: number; revenue: number }> = {};
  for (const order of vendorOrders) {
    for (const item of order.items) {
      if (!productOrderCounts[item.productId]) {
        productOrderCounts[item.productId] = { name: item.productName, orders: 0, revenue: 0 };
      }
      productOrderCounts[item.productId].orders += item.quantity;
      productOrderCounts[item.productId].revenue += item.price * item.quantity;
    }
  }
  const topProducts = Object.entries(productOrderCounts)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5);

  // Calculate order status distribution
  const statusCounts: Record<string, number> = {};
  for (const order of vendorOrders) {
    statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
  }

  return (
    <SiteLayout>
      <div className="container py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link href="/vendor">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <BarChart3 className="w-8 h-8" />
                Store Analytics
              </h1>
              <p className="text-muted-foreground">Track your store performance</p>
            </div>
          </div>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-40">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-3xl font-bold">GHS {totalRevenue.toLocaleString()}</p>
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
                    <span className="mx-2">•</span>
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
                  <p className="text-3xl font-bold">{vendorProducts.filter(p => p.status === "active").length}</p>
                  <div className="text-sm mt-1 text-muted-foreground">
                    {vendorProducts.length} total products
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
                    {averageStoreRating > 0 ? averageStoreRating.toFixed(1) : "-"}
                    <Star className="w-6 h-6 text-yellow-400 fill-current" />
                  </p>
                  <div className="text-sm mt-1 text-muted-foreground">
                    {productReviews.length} reviews
                  </div>
                </div>
                <div className="p-3 bg-yellow-100 rounded-full">
                  <Star className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="products" className="space-y-6">
          <TabsList>
            <TabsTrigger value="products">Top Products</TabsTrigger>
            <TabsTrigger value="orders">Order Status</TabsTrigger>
            <TabsTrigger value="reviews">Recent Reviews</TabsTrigger>
          </TabsList>

          <TabsContent value="products">
            <Card>
              <CardHeader>
                <CardTitle>Best Selling Products</CardTitle>
                <CardDescription>Products generating the most revenue</CardDescription>
              </CardHeader>
              <CardContent>
                {topProducts.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-muted-foreground">No sales data yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {topProducts.map(([productId, data], index) => (
                      <div key={productId} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium">{data.name}</p>
                            <p className="text-sm text-muted-foreground">{data.orders} units sold</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">GHS {data.revenue.toLocaleString()}</p>
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
                <CardTitle>Order Status Distribution</CardTitle>
                <CardDescription>Breakdown of orders by status</CardDescription>
              </CardHeader>
              <CardContent>
                {totalOrders === 0 ? (
                  <div className="text-center py-12">
                    <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-muted-foreground">No orders yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {Object.entries(statusCounts).map(([status, count]) => (
                      <Card key={status}>
                        <CardContent className="p-4 text-center">
                          <Badge
                            variant={
                              status === "delivered" ? "default" :
                              status === "pending" ? "secondary" :
                              status === "cancelled" ? "destructive" : "outline"
                            }
                            className="mb-2"
                          >
                            {status}
                          </Badge>
                          <p className="text-2xl font-bold">{count}</p>
                          <p className="text-sm text-muted-foreground">
                            {Math.round((count / totalOrders) * 100)}%
                          </p>
                        </CardContent>
                      </Card>
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
                      </div>
                    ))}
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
