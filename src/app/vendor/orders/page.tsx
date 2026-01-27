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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Search,
  Package,
  Eye,
  MoreHorizontal,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  RefreshCw,
  Mail,
  Phone,
  ShoppingBag
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { formatDistance } from "date-fns";
import { toast } from "sonner";

interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  vendorId: string;
  vendorName: string;
  quantity: number;
  unitPrice: number;
  finalPrice?: number | null;
  appliedDiscount?: number | null;
  image?: string;
  fulfillmentStatus: string;
}

interface Order {
  id: string;
  buyerId: string;
  buyerName: string;
  buyerEmail: string;
  items: OrderItem[];
  orderItems: OrderItem[];
  subtotal: number;
  discountTotal: number;
  couponCode?: string;
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
  createdAt: string;
  updatedAt: string;
}

const statusConfig: Record<string, { color: string; icon: typeof Clock; label: string }> = {
  // Phase 7B: New statuses
  created: { color: "bg-yellow-100 text-yellow-800", icon: Clock, label: "Awaiting Payment" },
  confirmed: { color: "bg-blue-100 text-blue-800", icon: Package, label: "Payment Confirmed" },
  preparing: { color: "bg-purple-100 text-purple-800", icon: Package, label: "Preparing" },
  ready_for_pickup: { color: "bg-indigo-100 text-indigo-800", icon: Package, label: "Ready for Pickup" },
  out_for_delivery: { color: "bg-cyan-100 text-cyan-800", icon: Truck, label: "Out for Delivery" },
  delivered: { color: "bg-green-600 text-white", icon: CheckCircle, label: "Delivered" },
  completed: { color: "bg-emerald-100 text-emerald-800", icon: CheckCircle, label: "Completed" },
  delivery_failed: { color: "bg-orange-100 text-orange-800", icon: XCircle, label: "Delivery Failed" },
  disputed: { color: "bg-amber-100 text-amber-800", icon: Clock, label: "Disputed" },
  // Legacy statuses for backward compatibility
  pending_payment: { color: "bg-yellow-100 text-yellow-800", icon: Clock, label: "Awaiting Payment" },
  pending: { color: "bg-yellow-100 text-yellow-800", icon: Clock, label: "Pending" },
  processing: { color: "bg-blue-100 text-blue-800", icon: Package, label: "Payment Confirmed" },
  shipped: { color: "bg-cyan-100 text-cyan-800", icon: Truck, label: "Shipped" },
  fulfilled: { color: "bg-green-600 text-white", icon: CheckCircle, label: "Delivered" },
  cancelled: { color: "bg-red-100 text-red-800", icon: XCircle, label: "Cancelled" },
};

const itemStatusConfig: Record<string, { color: string; label: string }> = {
  // Phase 7B: New item statuses
  pending: { color: "bg-yellow-100 text-yellow-800", label: "Pending" },
  packed: { color: "bg-purple-100 text-purple-800", label: "Packed" },
  handed_to_courier: { color: "bg-cyan-100 text-cyan-800", label: "With Courier" },
  delivered: { color: "bg-green-600 text-white", label: "Delivered" },
  // Legacy
  shipped: { color: "bg-cyan-100 text-cyan-800", label: "Shipped" },
  fulfilled: { color: "bg-green-600 text-white", label: "Delivered" },
};

export default function VendorOrdersPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isHydrated, setIsHydrated] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [shippingItemId, setShippingItemId] = useState<string | null>(null);
  const [fulfillingItemId, setFulfillingItemId] = useState<string | null>(null);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push("/vendor/login");
    }
    if (isHydrated && user && user.role !== "vendor") {
      router.push("/");
    }
  }, [isHydrated, isAuthenticated, user, router]);

  useEffect(() => {
    if (isHydrated && isAuthenticated && user?.role === "vendor") {
      fetchOrders();
    }
  }, [isHydrated, isAuthenticated, user]);

  useEffect(() => {
    if (!isHydrated || !isAuthenticated || user?.role !== "vendor") return;
    
    const interval = setInterval(() => {
      fetch('/api/orders?role=vendor', { credentials: 'include' })
        .then(res => res.ok ? res.json() : { orders: [] })
        .then(data => setOrders(data.orders || []))
        .catch(console.error);
    }, 30000);

    return () => clearInterval(interval);
  }, [isHydrated, isAuthenticated, user]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/orders?role=vendor', {
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

  const handleShipItem = async (orderId: string, itemId: string) => {
    setShippingItemId(itemId);
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'ship',
          itemId,
        }),
      });

      if (response.ok) {
        toast.success('Item marked as shipped');
        fetchOrders();
        if (selectedOrder && selectedOrder.id === orderId) {
          const updatedResponse = await fetch(`/api/orders/${orderId}`, { credentials: 'include' });
          if (updatedResponse.ok) {
            const data = await updatedResponse.json();
            setSelectedOrder(data.order);
          }
        }
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to ship item');
      }
    } catch (error) {
      console.error('Failed to ship item:', error);
      toast.error('Failed to ship item');
    } finally {
      setShippingItemId(null);
    }
  };

  const handleFulfillItem = async (orderId: string, itemId: string) => {
    setFulfillingItemId(itemId);
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'fulfill',
          itemId,
        }),
      });

      if (response.ok) {
        toast.success('Item marked as delivered');
        fetchOrders();
        if (selectedOrder && selectedOrder.id === orderId) {
          const updatedResponse = await fetch(`/api/orders/${orderId}`, { credentials: 'include' });
          if (updatedResponse.ok) {
            const data = await updatedResponse.json();
            setSelectedOrder(data.order);
          }
        }
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to mark as delivered');
      }
    } catch (error) {
      console.error('Failed to mark as delivered:', error);
      toast.error('Failed to mark as delivered');
    } finally {
      setFulfillingItemId(null);
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

  if (!isAuthenticated || !user || user.role !== "vendor") {
    return null;
  }

  const filteredOrders = orders.filter(order => {
    const matchesSearch =
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.buyerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.buyerEmail.toLowerCase().includes(searchQuery.toLowerCase());
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

  const getItemStatusBadge = (status: string) => {
    const config = itemStatusConfig[status] || itemStatusConfig.pending;
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const getOrderItems = (order: Order) => {
    if (order.orderItems && order.orderItems.length > 0) {
      return order.orderItems;
    }
    return order.items || [];
  };

  const getVendorItemsTotal = (order: Order) => {
    return getOrderItems(order)
      .filter(item => item.vendorId === user?.id)
      .reduce((sum, item) => {
        const lineTotal = item.finalPrice != null ? item.finalPrice : (item.unitPrice * item.quantity);
        return sum + lineTotal;
      }, 0);
  };

  const getVendorItems = (order: Order) => {
    return getOrderItems(order).filter(item => item.vendorId === user?.id);
  };

  const hasItemsNeedingAction = (order: Order) => {
    // Items need action if they are pending (need to ship) or shipped (need to confirm delivery)
    return getVendorItems(order).some(item => 
      item.fulfillmentStatus === 'pending' || 
      item.fulfillmentStatus === 'shipped' || 
      !item.fulfillmentStatus
    );
  };

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
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Orders</h1>
              <p className="text-muted-foreground text-sm sm:text-base">Manage customer orders</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchOrders} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline ml-2">Refresh</span>
            </Button>
          </div>
        </div>

        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search by order ID, customer name, or email..."
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
                  <SelectItem value="fulfilled">Fulfilled</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Orders ({filteredOrders.length})</CardTitle>
            <CardDescription>View and fulfill your orders</CardDescription>
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
                <p className="text-muted-foreground">
                  {orders.length === 0
                    ? "You haven't received any orders yet."
                    : "No orders match your current filters."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Your Items</TableHead>
                      <TableHead>Your Total</TableHead>
                      <TableHead>Order Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => {
                      const vendorItems = getVendorItems(order);
                      const vendorTotal = getVendorItemsTotal(order);
                      const orderNumber = order.id.slice(-8).toUpperCase();

                      return (
                        <TableRow key={order.id}>
                          <TableCell>
                            <span className="font-mono text-sm">#{orderNumber}</span>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{order.buyerName}</p>
                              <p className="text-sm text-muted-foreground">{order.buyerEmail}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <span>{vendorItems.length} item(s)</span>
                              {hasItemsNeedingAction(order) && (
                                <Badge variant="outline" className="ml-2 text-xs bg-amber-50 text-amber-700">
                                  Needs Fulfillment
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">GHS {vendorTotal.toFixed(2)}</span>
                          </TableCell>
                          <TableCell>{getStatusBadge(order.status)}</TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {formatDistance(new Date(order.createdAt), new Date(), { addSuffix: true })}
                            </span>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => {
                                  setSelectedOrder(order);
                                  setIsDetailsOpen(true);
                                }}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => {
                                    router.push(`/messages?startConversation=true&buyerId=${order.buyerId}&orderId=${order.id}`);
                                  }}
                                >
                                  <Mail className="w-4 h-4 mr-2" />
                                  Contact Customer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
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

        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Order #{selectedOrder?.id.slice(-8).toUpperCase()}
              </DialogTitle>
              <DialogDescription>
                Order details and fulfillment
              </DialogDescription>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  {getStatusBadge(selectedOrder.status)}
                  <span className="text-sm text-muted-foreground">
                    {new Date(selectedOrder.createdAt).toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Customer</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-1">
                      <p className="font-medium">{selectedOrder.buyerName}</p>
                      <p className="text-muted-foreground">{selectedOrder.buyerEmail}</p>
                      <p className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {selectedOrder.shippingAddress.phone}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Shipping Address</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm">
                      <p>{selectedOrder.shippingAddress.fullName}</p>
                      <p className="text-muted-foreground">{selectedOrder.shippingAddress.address}</p>
                      <p className="text-muted-foreground">{selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.region}</p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Your Items to Fulfill</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {getVendorItems(selectedOrder).map((item, index) => (
                        <div key={index} className="flex items-center justify-between py-3 border-b last:border-0">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                              {item.image ? (
                                <img src={item.image} alt={item.productName} className="w-full h-full object-cover rounded" />
                              ) : (
                                <Package className="w-6 h-6 text-gray-400" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{item.productName}</p>
                              <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="font-medium">GHS {(item.finalPrice != null ? item.finalPrice : item.unitPrice * item.quantity).toFixed(2)}</p>
                              {getItemStatusBadge(item.fulfillmentStatus || 'pending')}
                            </div>
                            {(item.fulfillmentStatus === 'pending' || !item.fulfillmentStatus) && 
                             selectedOrder.status !== 'cancelled' && (
                              <Button
                                size="sm"
                                onClick={() => handleShipItem(selectedOrder.id, item.id)}
                                disabled={shippingItemId !== null || fulfillingItemId !== null}
                              >
                                {shippingItemId === item.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <Truck className="w-4 h-4 mr-1" />
                                    Mark Shipped
                                  </>
                                )}
                              </Button>
                            )}
                            {item.fulfillmentStatus === 'shipped' && 
                             selectedOrder.status !== 'cancelled' && (
                              <Button
                                size="sm"
                                onClick={() => handleFulfillItem(selectedOrder.id, item.id)}
                                disabled={shippingItemId !== null || fulfillingItemId !== null}
                              >
                                {fulfillingItemId === item.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    Mark Delivered
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-4 border-t space-y-1">
                      {selectedOrder.discountTotal > 0 && (
                        <div className="flex justify-between text-sm text-green-600">
                          <span>Coupon Applied{selectedOrder.couponCode ? ` (${selectedOrder.couponCode})` : ''}</span>
                          <span>-GHS {selectedOrder.discountTotal.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold">
                        <span>Your Total</span>
                        <span>GHS {getVendorItemsTotal(selectedOrder).toFixed(2)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {selectedOrder.status === 'cancelled' && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 text-red-800">
                      <XCircle className="w-5 h-5" />
                      <span className="font-medium">This order has been cancelled</span>
                    </div>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SiteLayout>
  );
}
