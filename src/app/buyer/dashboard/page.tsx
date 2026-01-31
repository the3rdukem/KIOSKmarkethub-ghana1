"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  User, Package, Heart, ShoppingCart, Clock, CheckCircle, Truck, Eye, Loader2,
  MapPin, Bell, Settings, Star, ArrowRight, AlertTriangle, CreditCard, Store
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { useCartStore } from "@/lib/cart-store";
import { useWishlistStore } from "@/lib/wishlist-store";
import { useAddressesStore } from "@/lib/addresses-store";
import { useNotificationsStore } from "@/lib/notifications-store";
import { useProductsStore } from "@/lib/products-store";
import { useReviewsStore } from "@/lib/reviews-store";
import { BuyerAuthGuard } from "@/components/auth/auth-guard";
import { formatDistance, format } from "date-fns";
import { formatCurrency } from "@/lib/utils/currency";

interface Order {
  id: string;
  buyerId: string;
  buyerName: string;
  buyerEmail: string;
  items: any[];
  orderItems?: any[];
  subtotal: number;
  discountTotal?: number;
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

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  // Phase 7B: New statuses
  created: { color: "text-yellow-700", bg: "bg-yellow-100", label: "Awaiting Payment" },
  confirmed: { color: "text-blue-700", bg: "bg-blue-100", label: "Payment Confirmed" },
  preparing: { color: "text-purple-700", bg: "bg-purple-100", label: "Preparing" },
  ready_for_pickup: { color: "text-indigo-700", bg: "bg-indigo-100", label: "Ready for Pickup" },
  out_for_delivery: { color: "text-cyan-700", bg: "bg-cyan-100", label: "Out for Delivery" },
  delivered: { color: "text-white", bg: "bg-green-600", label: "Delivered" },
  completed: { color: "text-emerald-700", bg: "bg-emerald-100", label: "Completed" },
  delivery_failed: { color: "text-orange-700", bg: "bg-orange-100", label: "Delivery Failed" },
  disputed: { color: "text-amber-700", bg: "bg-amber-100", label: "Disputed" },
  // Legacy statuses
  pending_payment: { color: "text-yellow-700", bg: "bg-yellow-100", label: "Awaiting Payment" },
  pending: { color: "text-yellow-700", bg: "bg-yellow-100", label: "Awaiting Payment" },
  processing: { color: "text-blue-700", bg: "bg-blue-100", label: "Payment Confirmed" },
  shipped: { color: "text-cyan-700", bg: "bg-cyan-100", label: "Shipped" },
  fulfilled: { color: "text-white", bg: "bg-green-600", label: "Delivered" },
  cancelled: { color: "text-red-700", bg: "bg-red-100", label: "Cancelled" },
  refunded: { color: "text-gray-700", bg: "bg-gray-100", label: "Refunded" },
};

function BuyerDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "overview";

  const { user, isAuthenticated } = useAuthStore();
  const { items: cartItems, getTotalPrice } = useCartStore();
  const { getWishlistByBuyer, syncWithServer } = useWishlistStore();
  const { getAddressesByUser, getDefaultAddress } = useAddressesStore();
  const { getNotificationsByUser, getUnreadCount } = useNotificationsStore();
  const { getReviewsByBuyer } = useReviewsStore();

  const [isHydrated, setIsHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [buyerOrders, setBuyerOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  useEffect(() => {
    const tabFromUrl = searchParams.get("tab") || "overview";
    setActiveTab(tabFromUrl);
  }, [searchParams]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    router.push(`/buyer/dashboard?tab=${value}`, { scroll: false });
  };
  const [wishlistData, setWishlistData] = useState<Array<{
    id: string;
    productId: string;
    productName: string;
    productPrice: number;
    productImage: string | null;
    vendorId: string;
    vendorName: string;
  }>>([]);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated && user?.id) {
      setOrdersLoading(true);
      fetch('/api/orders?role=buyer', { credentials: 'include' })
        .then(res => res.ok ? res.json() : { orders: [] })
        .then(data => {
          setBuyerOrders(data.orders ?? []);
        })
        .catch(console.error)
        .finally(() => setOrdersLoading(false));
      
      fetch('/api/wishlist', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          if (data.authenticated && data.items) {
            setWishlistData(data.items);
          }
        })
        .catch(console.error);
      
      syncWithServer(user.id);
    }
  }, [isHydrated, user?.id, syncWithServer]);

  useEffect(() => {
    if (!isHydrated || !user?.id) return;
    
    const interval = setInterval(() => {
      fetch('/api/orders?role=buyer', { credentials: 'include' })
        .then(res => res.ok ? res.json() : { orders: [] })
        .then(data => setBuyerOrders(data.orders ?? []))
        .catch(console.error);
    }, 30000);

    return () => clearInterval(interval);
  }, [isHydrated, user?.id]);

  // Auth is handled by buyer layout - just wait for user data
  if (!isHydrated || !user) {
    return (
      <SiteLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </SiteLayout>
    );
  }

  // Get buyer-specific data from API response (already filtered by user ID on server)
  const pendingOrders = buyerOrders.filter((o) => ["pending", "confirmed", "processing"].includes(o.status));
  const shippedOrders = buyerOrders.filter((o) => o.status === "shipped");
  const deliveredOrders = buyerOrders.filter((o) => o.status === "delivered");
  const totalSpent = buyerOrders.reduce((sum, o) => sum + o.total, 0);

  const wishlistProducts = wishlistData.slice(0, 4);

  const userAddresses = getAddressesByUser(user.id);
  const defaultAddress = getDefaultAddress(user.id);

  const notifications = getNotificationsByUser(user.id).slice(0, 5);
  const unreadNotifications = getUnreadCount(user.id);

  const buyerReviews = getReviewsByBuyer(user.id);

  const recentOrders = buyerOrders.slice(0, 5);

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || statusConfig.pending;
    return <Badge className={`${config.bg} ${config.color}`}>{config.label}</Badge>;
  };

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <SiteLayout>
      <div className="container py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.avatar} />
              <AvatarFallback className="text-lg">{getInitials(user.name)}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Welcome back, {user.name.split(" ")[0]}!</h1>
              <p className="text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/buyer/profile">
                <Settings className="w-4 h-4 mr-2" />
                Profile Settings
              </Link>
            </Button>
            <Button onClick={() => router.push("/search")}>
              <ShoppingCart className="w-4 h-4 mr-2" />
              Continue Shopping
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Orders</p>
                  <p className="text-2xl font-bold">{buyerOrders.length}</p>
                </div>
                <Package className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                  <p className="text-2xl font-bold">{pendingOrders.length + shippedOrders.length}</p>
                </div>
                <Truck className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Wishlist</p>
                  <p className="text-2xl font-bold">{wishlistData.length}</p>
                </div>
                <Heart className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Spent</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalSpent)}</p>
                </div>
                <CreditCard className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="cart">
              Cart
              {cartItems.length > 0 && <Badge variant="secondary" className="ml-2">{cartItems.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="wishlist">
              Wishlist
              {wishlistData.length > 0 && <Badge variant="secondary" className="ml-2">{wishlistData.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Recent Orders */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Recent Orders</CardTitle>
                      <CardDescription>Your latest orders</CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href="/buyer/orders">
                        View All <ArrowRight className="w-4 h-4 ml-1" />
                      </Link>
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {recentOrders.length === 0 ? (
                      <div className="text-center py-8">
                        <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-muted-foreground mb-4">No orders yet</p>
                        <Button size="sm" asChild>
                          <Link href="/search">Start Shopping</Link>
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {recentOrders.map((order) => (
                          <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                                <Package className="w-6 h-6 text-gray-500" />
                              </div>
                              <div>
                                <p className="font-medium">{order.items.length} item(s)</p>
                                <p className="text-sm text-muted-foreground">
                                  {formatDistance(new Date(order.createdAt), new Date(), { addSuffix: true })}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="font-medium">{formatCurrency(order.total)}</p>
                                {getStatusBadge(order.status)}
                              </div>
                              <Button variant="ghost" size="icon" asChild>
                                <Link href={`/buyer/orders/${order.id}`}>
                                  <Eye className="w-4 h-4" />
                                </Link>
                              </Button>
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
                {/* Notifications Preview */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Bell className="w-4 h-4" />
                      Notifications
                      {unreadNotifications > 0 && (
                        <Badge className="bg-red-500">{unreadNotifications}</Badge>
                      )}
                    </CardTitle>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href="/buyer/notifications">View All</Link>
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {notifications.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No notifications</p>
                    ) : (
                      <div className="space-y-3">
                        {notifications.slice(0, 3).map((notif) => (
                          <div key={notif.id} className={`p-3 rounded-lg ${!notif.read ? "bg-blue-50" : "bg-gray-50"}`}>
                            <p className="text-sm font-medium">{notif.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{notif.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Default Address */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Default Address
                    </CardTitle>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href="/buyer/profile?tab=addresses">Manage</Link>
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {defaultAddress ? (
                      <div className="text-sm space-y-1">
                        <p className="font-medium">{defaultAddress.fullName}</p>
                        <p className="text-muted-foreground">{defaultAddress.street}</p>
                        <p className="text-muted-foreground">
                          {defaultAddress.city}, {defaultAddress.region}
                        </p>
                        <p className="text-muted-foreground">{defaultAddress.phone}</p>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground mb-2">No address saved</p>
                        <Button size="sm" variant="outline" asChild>
                          <Link href="/buyer/profile?tab=addresses">Add Address</Link>
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Wishlist Preview */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Heart className="w-4 h-4" />
                      Wishlist
                    </CardTitle>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href="/buyer/wishlist">View All</Link>
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {wishlistProducts.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Your wishlist is empty</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {wishlistProducts.map((product) => (
                          <Link
                            key={product.productId}
                            href={`/product/${product.productId}`}
                            className="aspect-square bg-gray-100 rounded-lg overflow-hidden hover:opacity-80 transition-opacity"
                          >
                            {product.productImage ? (
                              <img src={product.productImage} alt={product.productName} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="w-8 h-8 text-gray-400" />
                              </div>
                            )}
                          </Link>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Cart Tab */}
          <TabsContent value="cart">
            <Card>
              <CardHeader>
                <CardTitle>Shopping Cart</CardTitle>
                <CardDescription>Items ready for checkout</CardDescription>
              </CardHeader>
              <CardContent>
                {cartItems.length === 0 ? (
                  <div className="text-center py-12">
                    <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Your Cart is Empty</h3>
                    <p className="text-muted-foreground mb-4">Add items to your cart to checkout.</p>
                    <Button onClick={() => router.push("/search")}>Browse Products</Button>
                  </div>
                ) : (
                  <div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>Vendor</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Qty</TableHead>
                          <TableHead>Subtotal</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cartItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden">
                                  {item.image ? (
                                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <Package className="w-6 h-6 text-gray-400" />
                                    </div>
                                  )}
                                </div>
                                <span className="font-medium">{item.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Link href={`/vendor/${item.vendorId}`} className="flex items-center gap-1 text-muted-foreground hover:underline">
                                <Store className="w-3 h-3" />
                                {item.vendor}
                              </Link>
                            </TableCell>
                            <TableCell>{formatCurrency(item.price)}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell className="font-medium">{formatCurrency(item.price * item.quantity)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <Separator className="my-4" />
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold">Total: {formatCurrency(getTotalPrice())}</span>
                      <Button onClick={() => router.push("/checkout")}>Proceed to Checkout</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Wishlist Tab */}
          <TabsContent value="wishlist">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>My Wishlist</CardTitle>
                  <CardDescription>{wishlistData.length} items saved</CardDescription>
                </div>
                <Button variant="outline" asChild>
                  <Link href="/buyer/wishlist">
                    View Full Wishlist <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {wishlistData.length === 0 ? (
                  <div className="text-center py-12">
                    <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Your Wishlist is Empty</h3>
                    <p className="text-muted-foreground mb-4">Save items you love for later.</p>
                    <Button onClick={() => router.push("/search")}>Browse Products</Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {wishlistData.slice(0, 10).map((item) => (
                      <Link key={item.productId} href={`/product/${item.productId}`} className="group">
                        <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-2">
                          {item.productImage ? (
                            <img
                              src={item.productImage}
                              alt={item.productName}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-8 h-8 text-gray-400" />
                            </div>
                          )}
                        </div>
                        <p className="text-sm font-medium truncate group-hover:text-green-600">{item.productName}</p>
                        <p className="text-sm text-muted-foreground">{formatCurrency(item.productPrice)}</p>
                      </Link>
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

export default function BuyerDashboard() {
  return (
    <BuyerAuthGuard>
      <Suspense fallback={
        <SiteLayout>
          <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        </SiteLayout>
      }>
        <BuyerDashboardContent />
      </Suspense>
    </BuyerAuthGuard>
  );
}
