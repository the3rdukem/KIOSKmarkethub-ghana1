"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  Loader2,
  MessageSquare,
  Info,
  Percent
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
  earnings?: {
    grossSales: number;
    total: number;
    commission: number;
    commissionRate: number;
    commissionSource: 'vendor' | 'category' | 'default';
    pending: number;
    completed: number;
  };
}

function VendorDashboardContent() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<VendorStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Use cache: 'no-store' to always get fresh data from DB
        const response = await fetch('/api/vendor/stats', { 
          credentials: 'include',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
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
      pending_payment: "bg-amber-100 text-amber-800",
      confirmed: "bg-blue-100 text-blue-800",
      processing: "bg-blue-100 text-blue-800",
      shipped: "bg-purple-100 text-purple-800",
      delivered: "bg-green-100 text-green-800",
      fulfilled: "bg-emerald-100 text-emerald-800",
      cancelled: "bg-red-100 text-red-800",
    };
    const displayLabels: Record<string, string> = {
      pending_payment: "Awaiting Payment",
      fulfilled: "Delivered",
      processing: "Confirmed",
    };
    return <Badge className={styles[status] || "bg-gray-100 text-gray-800"}>{displayLabels[status] || status}</Badge>;
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
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Vendor Dashboard</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Welcome back, {user.businessName || user.name}</p>
          </div>
          <div className="flex gap-2 sm:gap-3">
            <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => router.push("/vendor/analytics")}>
              <BarChart3 className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Reports</span>
            </Button>
            <Button size="sm" className="flex-1 sm:flex-none" onClick={() => router.push("/vendor/products/create")}>
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Add Product</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6 pb-2">
                  <div className="flex items-center gap-1">
                    <CardTitle className="text-xs sm:text-sm font-medium">Your Earnings</CardTitle>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3 w-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="font-semibold mb-1">Platform Fee Breakdown</p>
                          <p className="text-xs">The platform fee covers payment processing, buyer protection, and marketplace services.</p>
                          {stats?.earnings?.commissionSource === 'vendor' && (
                            <p className="text-xs mt-1 text-green-600">You have a partner rate!</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <DollarSign className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                  <div className="text-lg sm:text-2xl font-bold text-green-600 truncate">
                    GHS {(stats?.earnings?.total ?? totalRevenue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    {stats?.earnings?.commissionSource === 'vendor' ? (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 text-purple-600 border-purple-600">Custom Rate</Badge>
                    ) : stats?.earnings?.commissionSource === 'category' ? (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 text-blue-600 border-blue-600">Category Rate</Badge>
                    ) : null}
                    {Math.round((stats?.earnings?.commissionRate ?? 0.08) * 100)}% fee applied
                  </span>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6 pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Products</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                  <div className="text-lg sm:text-2xl font-bold">{totalProducts}</div>
                  <p className="text-xs text-muted-foreground">
                    {activeProducts} active
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6 pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Orders</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                  <div className="text-lg sm:text-2xl font-bold">{totalOrders}</div>
                  <p className="text-xs text-muted-foreground">
                    {pendingOrders} pending
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6 pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Completed</CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                  <div className="text-lg sm:text-2xl font-bold">{completedOrders}</div>
                  <p className="text-xs text-muted-foreground">
                    Delivered orders
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Sales Overview */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Sales Overview</CardTitle>
                    <CardDescription>Your sales performance and earnings breakdown</CardDescription>
                  </div>
                  {stats?.earnings?.commissionSource && (
                    <Badge 
                      variant="outline" 
                      className={
                        stats.earnings.commissionSource === 'vendor' 
                          ? 'text-purple-600 border-purple-600' 
                          : stats.earnings.commissionSource === 'category'
                          ? 'text-blue-600 border-blue-600'
                          : 'text-gray-600 border-gray-600'
                      }
                    >
                      {stats.earnings.commissionSource === 'vendor' 
                        ? `Custom Rate: ${((stats.earnings.commissionRate) * 100).toFixed(0)}%`
                        : stats.earnings.commissionSource === 'category'
                        ? `Category Rate: ${((stats.earnings.commissionRate) * 100).toFixed(0)}%`
                        : `Platform Rate: ${((stats.earnings.commissionRate) * 100).toFixed(0)}%`
                      }
                    </Badge>
                  )}
                </div>
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
                  <div className="space-y-6">
                    {/* Earnings Breakdown */}
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-gray-200">
                        <span className="text-sm text-muted-foreground">Gross Sales</span>
                        <span className="text-lg font-semibold">
                          GHS {(stats?.earnings?.grossSales ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-200">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Platform Fee ({((stats?.earnings?.commissionRate ?? 0.08) * 100).toFixed(0)}%)</span>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="h-3 w-3 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p className="text-xs mb-2">This fee covers:</p>
                                <ul className="text-xs list-disc list-inside space-y-1">
                                  <li>Payment processing</li>
                                  <li>Buyer protection</li>
                                  <li>Marketplace services</li>
                                  <li>Customer support</li>
                                </ul>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <span className="text-lg font-semibold text-red-600">
                          - GHS {(stats?.earnings?.commission ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 bg-green-50 -mx-4 px-4 rounded-b-lg">
                        <span className="text-sm font-medium text-green-800">Your Earnings</span>
                        <span className="text-xl font-bold text-green-600">
                          GHS {(stats?.earnings?.total ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* Earnings Status */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="h-4 w-4 text-amber-600" />
                          <span className="text-xs font-medium text-amber-800">Pending</span>
                        </div>
                        <p className="text-lg font-bold text-amber-700">
                          GHS {(stats?.earnings?.pending ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-amber-600">Orders in progress</p>
                      </div>
                      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-xs font-medium text-green-800">Ready to Withdraw</span>
                        </div>
                        <p className="text-lg font-bold text-green-700">
                          GHS {(stats?.earnings?.completed ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-green-600">From completed orders</p>
                      </div>
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
                  <div className="space-y-3">
                    {recentOrders.map((order) => (
                      <div key={order.id} className="p-3 border rounded-lg">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">#{order.id.slice(-6).toUpperCase()}</p>
                            <p className="text-xs text-muted-foreground truncate">{order.buyerName}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-semibold text-sm">GHS {(order.total || 0).toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
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
                  onClick={() => router.push("/vendor/disputes")}
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Customer Disputes
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push("/vendor/analytics?tab=reviews")}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Customer Reviews
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
