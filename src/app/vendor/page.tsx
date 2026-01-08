"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  DollarSign,
  Package,
  ShoppingCart,
  TrendingUp,
  AlertTriangle,
  Shield,
  Camera,
  CheckCircle,
  Clock,
  Plus,
  BarChart3,
  Settings,
  Eye,
  Loader2
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { VendorAuthGuard } from "@/components/auth/auth-guard";
import { VerificationBanner } from "@/components/vendor/verification-banner";
import { formatDistance } from "date-fns";

interface VendorStats {
  products: {
    total: number;
    draft: number;
    active: number;
    pending: number;
    suspended: number;
  };
  orders: {
    total: number;
    pending: number;
    completed: number;
    cancelled: number;
  };
  revenue: number;
  recentOrders: Array<{
    id: string;
    status: string;
    total: number;
    createdAt: string;
    buyerName: string;
  }>;
}

function VendorDashboardContent() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<VendorStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/vendor/stats', { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch vendor stats:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, []);

  // User is guaranteed to exist here because of AuthGuard
  if (!user) return null;

  // Show loading state while fetching data
  if (isLoading) {
    return (
      <SiteLayout>
        <div className="container py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
              <p className="text-muted-foreground">Loading dashboard...</p>
            </div>
          </div>
        </div>
      </SiteLayout>
    );
  }

  // Extract stats from API response
  const totalProducts = stats?.products.total ?? 0;
  const activeProducts = stats?.products.active ?? 0;
  const draftProducts = stats?.products.draft ?? 0;
  const totalRevenue = stats?.revenue ?? 0;
  const totalOrders = stats?.orders.total ?? 0;
  const pendingOrders = stats?.orders.pending ?? 0;
  const completedOrders = stats?.orders.completed ?? 0;
  const recentOrders = stats?.recentOrders ?? [];

  // Verification status - from user data
  const isVerified = user.isVerified || false;
  const verificationStep = isVerified ? 4 : 2; // Default to step 2 if not verified

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      confirmed: "bg-blue-100 text-blue-800",
      processing: "bg-blue-100 text-blue-800",
      shipped: "bg-purple-100 text-purple-800",
      delivered: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return <Badge className={styles[status] || "bg-gray-100"}>{status}</Badge>;
  };

  return (
    <SiteLayout>
      <div className="container py-8">
        {/* Verification Banner - Shows for unverified/pending vendors */}
        <VerificationBanner 
          verificationStatus={user.verificationStatus as 'pending' | 'under_review' | 'verified' | 'rejected' | undefined}
          verificationNotes={(user as { verificationNotes?: string }).verificationNotes}
          onStartVerification={() => router.push("/vendor/verify")}
        />

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Vendor Dashboard</h1>
            <p className="text-muted-foreground">Welcome back, {user.businessName || user.name}</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => router.push("/vendor/analytics")}>
              <BarChart3 className="w-4 h-4 mr-2" />
              Reports
            </Button>
            <Button onClick={() => router.push("/vendor/products/create")}>
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">GHS {totalRevenue.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    From {totalOrders} orders
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Products</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalProducts}</div>
                  <p className="text-xs text-muted-foreground">
                    {activeProducts} active
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Orders</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalOrders}</div>
                  <p className="text-xs text-muted-foreground">
                    {pendingOrders} pending
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completed</CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{completedOrders}</div>
                  <p className="text-xs text-muted-foreground">
                    Delivered orders
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Sales Overview Placeholder */}
            <Card>
              <CardHeader>
                <CardTitle>Sales Overview</CardTitle>
                <CardDescription>Your sales performance</CardDescription>
              </CardHeader>
              <CardContent>
                {totalOrders === 0 ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="text-center">
                      <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-muted-foreground">No sales data yet</p>
                      <p className="text-sm text-muted-foreground">Start selling to see your performance</p>
                    </div>
                  </div>
                ) : (
                  <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <TrendingUp className="w-12 h-12 text-green-500 mx-auto mb-3" />
                      <p className="text-2xl font-bold">GHS {totalRevenue.toLocaleString()}</p>
                      <p className="text-muted-foreground">Total Revenue from {totalOrders} orders</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Orders */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Recent Orders</CardTitle>
                    <CardDescription>Latest orders from your customers</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => router.push("/vendor/orders")}>
                    View All
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {recentOrders.length === 0 ? (
                  <div className="text-center py-12">
                    <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Orders Yet</h3>
                    <p className="text-muted-foreground mb-4">
                      When customers order your products, they'll appear here.
                    </p>
                    <Button variant="outline" onClick={() => router.push("/vendor/products/create")}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Products to Start Selling
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentOrders.map((order) => (
                      <div key={order.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-4">
                            <div>
                              <p className="font-medium">{order.id.slice(0, 15)}...</p>
                              <p className="text-sm text-muted-foreground">{order.buyerName}</p>
                            </div>
                            <div>
                              <p className="font-medium">GHS {(order.total || 0).toLocaleString()}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {getStatusBadge(order.status)}
                          <span className="text-xs text-muted-foreground">
                            {formatDistance(new Date(order.createdAt), new Date(), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Verification Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Verification Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-sm">Basic Information</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-sm">Business Documents</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {isVerified ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <Clock className="w-5 h-5 text-orange-500" />
                    )}
                    <span className="text-sm">Facial Recognition</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {isVerified ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <Clock className="w-5 h-5 text-gray-400" />
                    )}
                    <span className={`text-sm ${!isVerified ? "text-muted-foreground" : ""}`}>Manual Review</span>
                  </div>
                </div>
                <Progress value={isVerified ? 100 : 50} className="w-full" />
                <p className="text-sm text-muted-foreground">
                  {isVerified ? "Verification complete" : `${verificationStep} of 4 steps completed`}
                </p>
                {!isVerified && (
                  <Button size="sm" className="w-full" onClick={() => router.push("/vendor/verify")}>
                    <Camera className="w-4 h-4 mr-2" />
                    Complete Facial Verification
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push("/vendor/products/create")}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add New Product
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push("/vendor/products")}
                >
                  <Package className="w-4 h-4 mr-2" />
                  Manage Inventory
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push("/vendor/orders")}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Orders
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push("/vendor/promotions")}
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Promotions & Discounts
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push("/vendor/settings")}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Store Settings
                </Button>
              </CardContent>
            </Card>

            {/* Financial Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Financial Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Sales</span>
                  <span className="font-medium">GHS {totalRevenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Pending Orders</span>
                  <span className="font-medium">{pendingOrders}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Completed Orders</span>
                  <span className="font-medium">{completedOrders}</span>
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => router.push("/vendor/withdraw")}
                  disabled={totalRevenue === 0}
                >
                  Withdraw to Mobile Money
                </Button>
              </CardContent>
            </Card>

            {/* Performance Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Store Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Total Products</span>
                  <span className="font-medium">{totalProducts}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Active Products</span>
                  <span className="font-medium">{activeProducts}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Total Orders</span>
                  <span className="font-medium">{totalOrders}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}

// Export with auth guard wrapper
export default function VendorDashboard() {
  return (
    <VendorAuthGuard>
      <VendorDashboardContent />
    </VendorAuthGuard>
  );
}
