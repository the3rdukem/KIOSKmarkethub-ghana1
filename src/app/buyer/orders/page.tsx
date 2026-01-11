"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Search,
  Package,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  Loader2,
  ShoppingBag,
  RefreshCw
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { formatDistance } from "date-fns";

interface OrderItem {
  id?: string;
  productId: string;
  productName: string;
  vendorId: string;
  vendorName: string;
  quantity: number;
  unitPrice: number;
  finalPrice?: number | null;
  appliedDiscount?: number | null;
  fulfillmentStatus?: string;
}

interface Order {
  id: string;
  buyerId: string;
  buyerName: string;
  buyerEmail: string;
  items: any[];
  orderItems?: OrderItem[];
  subtotal: number;
  discountTotal: number;
  shippingFee: number;
  tax: number;
  total: number;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  shippingAddress: {
    fullName: string;
    phone: string;
    address: string;
    city: string;
    region: string;
  };
  couponCode?: string;
  createdAt: string;
  updatedAt: string;
}

const statusConfig: Record<string, { color: string; icon: typeof Clock; label: string }> = {
  pending_payment: { color: "bg-yellow-100 text-yellow-800", icon: Clock, label: "Pending Payment" },
  pending: { color: "bg-yellow-100 text-yellow-800", icon: Clock, label: "Pending" },
  confirmed: { color: "bg-blue-100 text-blue-800", icon: CheckCircle, label: "Confirmed" },
  processing: { color: "bg-blue-100 text-blue-800", icon: Package, label: "Processing" },
  shipped: { color: "bg-purple-100 text-purple-800", icon: Truck, label: "Shipped" },
  fulfilled: { color: "bg-green-100 text-green-800", icon: CheckCircle, label: "Fulfilled" },
  delivered: { color: "bg-green-100 text-green-800", icon: CheckCircle, label: "Delivered" },
  cancelled: { color: "bg-red-100 text-red-800", icon: XCircle, label: "Cancelled" },
};

export default function BuyerOrdersPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push("/login");
    }
  }, [isHydrated, isAuthenticated, router]);

  useEffect(() => {
    if (isHydrated && isAuthenticated && user?.id) {
      fetchOrders();
    }
  }, [isHydrated, isAuthenticated, user?.id]);

  useEffect(() => {
    if (!isHydrated || !isAuthenticated || !user?.id) return;
    
    const interval = setInterval(() => {
      fetch('/api/orders?role=buyer', { credentials: 'include' })
        .then(res => res.ok ? res.json() : { orders: [] })
        .then(data => setOrders(data.orders || []))
        .catch(console.error);
    }, 30000);

    return () => clearInterval(interval);
  }, [isHydrated, isAuthenticated, user?.id]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/orders?role=buyer', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders || []);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isHydrated) {
    return (
      <SiteLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </SiteLayout>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const getOrderItems = (order: Order) => order.orderItems || order.items || [];

  const filteredOrders = orders.filter(order => {
    const items = getOrderItems(order);
    const matchesSearch =
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      items.some(item => item.productName?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;
    return (
      <Badge className={config.color}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  return (
    <SiteLayout>
      <div className="container py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link href="/buyer/dashboard">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Dashboard
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold">My Orders</h1>
              <p className="text-muted-foreground">View and track your orders</p>
            </div>
          </div>
          <Button variant="outline" onClick={fetchOrders} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search by order ID or product name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending_payment">Pending Payment</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="fulfilled">Fulfilled</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Orders ({filteredOrders.length})</CardTitle>
            <CardDescription>Your purchase history</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-16">
                <Loader2 className="w-12 h-12 animate-spin text-gray-400 mx-auto mb-4" />
                <p className="text-muted-foreground">Loading orders...</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-16">
                <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Orders Found</h3>
                <p className="text-muted-foreground mb-4">
                  {orders.length === 0
                    ? "You haven't placed any orders yet."
                    : "No orders match your current filters."}
                </p>
                <Button asChild>
                  <Link href="/search">Start Shopping</Link>
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => {
                      const orderNumber = order.id.slice(-8).toUpperCase();
                      const items = getOrderItems(order);
                      return (
                        <TableRow key={order.id}>
                          <TableCell>
                            <span className="font-mono text-sm">#{orderNumber}</span>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{items.length} item(s)</p>
                              <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                                {items.map(i => i.productName).join(', ')}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">GHS {order.total.toFixed(2)}</span>
                          </TableCell>
                          <TableCell>{getStatusBadge(order.status)}</TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {formatDistance(new Date(order.createdAt), new Date(), { addSuffix: true })}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/buyer/orders/${order.id}`}>
                                <Eye className="w-4 h-4 mr-2" />
                                View
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SiteLayout>
  );
}
