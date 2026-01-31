"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPriceCompact } from "@/lib/utils/currency";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  Users,
  Package,
  Store,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  RefreshCw,
  Wallet,
  CheckCircle,
  Clock,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type DateRange = "7d" | "30d" | "90d" | "1y" | "all";
type TimeBucket = "day" | "week" | "month";

interface TrendDataPoint {
  date: string;
  value: number;
  count?: number;
}

interface RevenueMetrics {
  totalRevenue: number;
  orderCount: number;
  avgOrderValue: number;
  paidOrderCount: number;
  refundedAmount: number;
  trends: TrendDataPoint[];
}

interface UserMetrics {
  totalUsers: number;
  buyers: number;
  vendors: number;
  admins: number;
  newUsersThisPeriod: number;
  registrationTrends: TrendDataPoint[];
}

interface ProductMetrics {
  total: number;
  active: number;
  draft: number;
  pendingApproval: number;
  rejected: number;
  archived: number;
  suspended: number;
  outOfStock: number;
}

interface VendorMetrics {
  total: number;
  verified: number;
  pending: number;
  underReview: number;
  rejected: number;
  suspended: number;
  topPerformers: Array<{
    vendorId: string;
    businessName: string;
    totalSales: number;
    orderCount: number;
  }>;
}

interface OrderMetrics {
  total: number;
  byStatus: Record<string, number>;
  byPaymentStatus: Record<string, number>;
  fulfillmentRate: number;
  avgDeliveryTimeHours: number | null;
  cancelledCount: number;
  disputedCount: number;
}

interface FinancialMetrics {
  totalCommissions: number;
  pendingPayouts: number;
  processedPayouts: number;
  failedPayouts: number;
  payoutTrends: TrendDataPoint[];
}

interface AdminAnalytics {
  revenue: RevenueMetrics;
  users: UserMetrics;
  products: ProductMetrics;
  vendors: VendorMetrics;
  orders: OrderMetrics;
  financials: FinancialMetrics;
  generatedAt: string;
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}

function formatDate(dateString: string, bucket: TimeBucket): string {
  const date = new Date(dateString);
  if (bucket === "day") {
    return date.toLocaleDateString("en-GH", { month: "short", day: "numeric" });
  }
  if (bucket === "week") {
    return `Week of ${date.toLocaleDateString("en-GH", { month: "short", day: "numeric" })}`;
  }
  return date.toLocaleDateString("en-GH", { month: "short", year: "2-digit" });
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  variant?: "default" | "success" | "warning" | "danger";
}

function MetricCard({ title, value, subtitle, icon, trend, variant = "default" }: MetricCardProps) {
  const variantStyles = {
    default: "bg-card",
    success: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900",
    warning: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900",
    danger: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900",
  };

  return (
    <Card className={variantStyles[variant]}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="p-2 rounded-lg bg-primary/10">{icon}</div>
        </div>
        {trend && (
          <div className="flex items-center mt-2 text-xs">
            {trend.isPositive ? (
              <TrendingUp className="w-3 h-3 mr-1 text-emerald-500" />
            ) : (
              <TrendingDown className="w-3 h-3 mr-1 text-red-500" />
            )}
            <span className={trend.isPositive ? "text-emerald-600" : "text-red-600"}>
              {trend.isPositive ? "+" : ""}
              {trend.value}% from last period
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminAnalytics() {
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<DateRange>("30d");
  const [bucket, setBucket] = useState<TimeBucket>("day");

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/analytics?range=${range}&bucket=${bucket}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch analytics");
      }
      const data = await response.json();
      setAnalytics(data.data);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [range, bucket]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium">Unable to load analytics</p>
          <p className="text-sm text-muted-foreground mb-4">Please try again later</p>
          <Button onClick={fetchAnalytics}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const revenueChartData = analytics.revenue.trends.map((t) => ({
    date: formatDate(t.date, bucket),
    revenue: t.value,
    orders: t.count || 0,
  }));

  const userChartData = analytics.users.registrationTrends.map((t) => ({
    date: formatDate(t.date, bucket),
    users: t.value,
  }));

  const orderStatusData = Object.entries(analytics.orders.byStatus)
    .filter(([_, count]) => count > 0)
    .map(([status, count], index) => ({
      name: status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      value: count,
      fill: COLORS[index % COLORS.length],
    }));

  const productStatusData = [
    { name: "Active", value: analytics.products.active, fill: "#10b981" },
    { name: "Draft", value: analytics.products.draft, fill: "#6b7280" },
    { name: "Pending", value: analytics.products.pendingApproval, fill: "#f59e0b" },
    { name: "Rejected", value: analytics.products.rejected, fill: "#ef4444" },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Platform Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Last updated: {new Date(analytics.generatedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={range} onValueChange={(v) => setRange(v as DateRange)}>
            <SelectTrigger className="w-32">
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
          <Select value={bucket} onValueChange={(v) => setBucket(v as TimeBucket)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Daily</SelectItem>
              <SelectItem value="week">Weekly</SelectItem>
              <SelectItem value="month">Monthly</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchAnalytics}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Revenue"
          value={formatCurrency(analytics.revenue.totalRevenue)}
          subtitle={`${analytics.revenue.paidOrderCount} paid orders`}
          icon={<DollarSign className="w-5 h-5 text-emerald-600" />}
          variant="success"
        />
        <MetricCard
          title="Total Orders"
          value={formatNumber(analytics.revenue.orderCount)}
          subtitle={`Avg: ${formatCurrency(analytics.revenue.avgOrderValue)}`}
          icon={<ShoppingCart className="w-5 h-5 text-blue-600" />}
        />
        <MetricCard
          title="Total Users"
          value={formatNumber(analytics.users.totalUsers)}
          subtitle={`+${analytics.users.newUsersThisPeriod} new this period`}
          icon={<Users className="w-5 h-5 text-violet-600" />}
        />
        <MetricCard
          title="Active Products"
          value={formatNumber(analytics.products.active)}
          subtitle={`${analytics.products.total} total products`}
          icon={<Package className="w-5 h-5 text-amber-600" />}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Verified Vendors"
          value={analytics.vendors.verified}
          subtitle={`${analytics.vendors.total} total vendors`}
          icon={<Store className="w-5 h-5 text-emerald-600" />}
        />
        <MetricCard
          title="Pending Verification"
          value={analytics.vendors.pending + analytics.vendors.underReview}
          subtitle="Vendors awaiting review"
          icon={<Clock className="w-5 h-5 text-amber-600" />}
          variant={analytics.vendors.pending > 0 ? "warning" : "default"}
        />
        <MetricCard
          title="Fulfillment Rate"
          value={`${analytics.orders.fulfillmentRate.toFixed(1)}%`}
          subtitle="Of paid orders delivered"
          icon={<CheckCircle className="w-5 h-5 text-emerald-600" />}
        />
        <MetricCard
          title="Disputes"
          value={analytics.orders.disputedCount}
          subtitle={`${analytics.orders.cancelledCount} cancelled`}
          icon={<AlertCircle className="w-5 h-5 text-red-600" />}
          variant={analytics.orders.disputedCount > 0 ? "danger" : "default"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue Trend</CardTitle>
            <CardDescription>Revenue over time</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={revenueChartData}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    fontSize={12} 
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    fontSize={12} 
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => formatPriceCompact(v)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value) => [formatCurrency(Number(value) || 0), "Revenue"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10b981"
                    fill="url(#revenueGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No revenue data for this period
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">User Registrations</CardTitle>
            <CardDescription>New user signups over time</CardDescription>
          </CardHeader>
          <CardContent>
            {userChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={userChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    fontSize={12} 
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    fontSize={12} 
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="users" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No registration data for this period
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Order Status Distribution</CardTitle>
            <CardDescription>Current order statuses</CardDescription>
          </CardHeader>
          <CardContent>
            {orderStatusData.length > 0 ? (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={orderStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {orderStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-2 mt-2">
                  {orderStatusData.slice(0, 4).map((entry) => (
                    <Badge key={entry.name} variant="outline" className="text-xs">
                      <span
                        className="w-2 h-2 rounded-full mr-1"
                        style={{ backgroundColor: entry.fill }}
                      />
                      {entry.name}: {entry.value}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                No orders in this period
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Product Status</CardTitle>
            <CardDescription>Product listing breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {productStatusData.length > 0 ? (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={productStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {productStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-2 mt-2">
                  {productStatusData.map((entry) => (
                    <Badge key={entry.name} variant="outline" className="text-xs">
                      <span
                        className="w-2 h-2 rounded-full mr-1"
                        style={{ backgroundColor: entry.fill }}
                      />
                      {entry.name}: {entry.value}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                No products found
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Financial Summary</CardTitle>
            <CardDescription>Commissions and payouts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <span className="text-sm">Total Commissions</span>
              </div>
              <span className="font-semibold">{formatCurrency(analytics.financials.totalCommissions)}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-blue-600" />
                <span className="text-sm">Processed Payouts</span>
              </div>
              <span className="font-semibold">{formatCurrency(analytics.financials.processedPayouts)}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <span className="text-sm">Pending Payouts</span>
              </div>
              <span className="font-semibold">{formatCurrency(analytics.financials.pendingPayouts)}</span>
            </div>
            {analytics.financials.failedPayouts > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-950/20">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span className="text-sm">Failed Payouts</span>
                </div>
                <span className="font-semibold text-red-600">{formatCurrency(analytics.financials.failedPayouts)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {analytics.vendors.topPerformers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Performing Vendors</CardTitle>
            <CardDescription>Vendors with highest sales</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {analytics.vendors.topPerformers.map((vendor, index) => (
                <div
                  key={vendor.vendorId}
                  className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </div>
                    <span className="font-medium text-sm truncate">{vendor.businessName}</span>
                  </div>
                  <p className="text-lg font-bold text-emerald-600">
                    {formatCurrency(vendor.totalSales)}
                  </p>
                  <p className="text-xs text-muted-foreground">{vendor.orderCount} orders</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">User Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Buyers</span>
                <span className="font-medium">{analytics.users.buyers}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Vendors</span>
                <span className="font-medium">{analytics.users.vendors}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Admins</span>
                <span className="font-medium">{analytics.users.admins}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Product Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Out of Stock</span>
                <Badge variant={analytics.products.outOfStock > 0 ? "destructive" : "secondary"}>
                  {analytics.products.outOfStock}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Pending Approval</span>
                <Badge variant={analytics.products.pendingApproval > 0 ? "outline" : "secondary"}>
                  {analytics.products.pendingApproval}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Archived</span>
                <span className="font-medium">{analytics.products.archived}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Order Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Avg Delivery Time</span>
                <span className="font-medium">
                  {analytics.orders.avgDeliveryTimeHours
                    ? `${analytics.orders.avgDeliveryTimeHours.toFixed(1)}h`
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Refunded</span>
                <span className="font-medium text-amber-600">
                  {formatCurrency(analytics.revenue.refundedAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Payment Success</span>
                <span className="font-medium">
                  {analytics.orders.byPaymentStatus.paid || 0} / {analytics.orders.total}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
