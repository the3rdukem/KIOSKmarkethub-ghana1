"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Package,
  Truck,
  CheckCircle,
  Clock,
  MapPin,
  CreditCard,
  MessageSquare,
  AlertTriangle,
  Star,
  Store,
  Loader2,
  XCircle,
  Phone,
  Copy,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { format } from "date-fns";
import { toast } from "sonner";
import { fetchPaystackConfig, openPaystackPopup } from "@/lib/services/paystack";

interface OrderItem {
  id?: string;
  productId: string;
  productName: string;
  vendorId: string;
  vendorName: string;
  quantity: number;
  unitPrice?: number;
  finalPrice?: number | null;
  price?: number;
  image?: string;
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
    digitalAddress?: string;
  };
  couponCode?: string;
  createdAt: string;
  updatedAt: string;
}

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

const orderSteps = [
  { status: "pending_payment", label: "Order Placed", icon: Package },
  { status: "processing", label: "Payment Confirmed", icon: Clock },
  { status: "fulfilled", label: "Fulfilled", icon: CheckCircle },
];

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  pending_payment: { color: "text-yellow-700", bg: "bg-yellow-100", label: "Pending Payment" },
  pending: { color: "text-yellow-700", bg: "bg-yellow-100", label: "Pending" },
  processing: { color: "text-blue-700", bg: "bg-blue-100", label: "Payment Confirmed - Processing" },
  fulfilled: { color: "text-green-700", bg: "bg-green-100", label: "Fulfilled" },
  delivered: { color: "text-green-700", bg: "bg-green-100", label: "Delivered" },
  cancelled: { color: "text-red-700", bg: "bg-red-100", label: "Cancelled" },
};

export default function OrderDetailPage({ params }: OrderDetailPageProps) {
  const router = useRouter();
  const { id: orderId } = use(params);
  const { user, isAuthenticated } = useAuthStore();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push("/login");
    }
  }, [isHydrated, isAuthenticated, router]);

  useEffect(() => {
    if (isHydrated && isAuthenticated && orderId) {
      fetchOrder();
    }
  }, [isHydrated, isAuthenticated, orderId]);

  const fetchOrder = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('Order not found');
        } else if (response.status === 403) {
          setError('You do not have permission to view this order');
        } else {
          setError('Failed to load order');
        }
        return;
      }
      
      const data = await response.json();
      setOrder(data.order);
    } catch (err) {
      console.error('Error fetching order:', err);
      setError('Failed to load order');
    } finally {
      setLoading(false);
    }
  };

  if (!isHydrated || loading) {
    return (
      <SiteLayout>
        <div className="container py-8 flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-12 h-12 animate-spin text-gray-400" />
        </div>
      </SiteLayout>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  if (error || !order) {
    return (
      <SiteLayout>
        <div className="container py-8">
          <Card>
            <CardContent className="p-12 text-center">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">{error || 'Order Not Found'}</h2>
              <p className="text-muted-foreground mb-6">
                The order you're looking for doesn't exist or you don't have access to it.
              </p>
              <Button asChild>
                <Link href="/buyer/orders">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Orders
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </SiteLayout>
    );
  }

  if (order.buyerId !== user.id) {
    return (
      <SiteLayout>
        <div className="container py-8">
          <Card>
            <CardContent className="p-12 text-center">
              <AlertTriangle className="w-16 h-16 text-red-300 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
              <p className="text-muted-foreground mb-6">
                You don't have permission to view this order.
              </p>
              <Button asChild>
                <Link href="/buyer/orders">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Orders
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </SiteLayout>
    );
  }

  const getCurrentStep = () => {
    if (order.status === "cancelled") return -1;
    if (order.status === "fulfilled" || order.status === "delivered") return 2;
    // 'processing' means payment confirmed, awaiting fulfillment
    if (order.status === "processing") return 1;
    // 'pending_payment' is initial state
    return 0;
  };

  const currentStep = getCurrentStep();
  const progress = currentStep >= 0 ? ((currentStep + 1) / orderSteps.length) * 100 : 0;

  const handleCopyOrderId = () => {
    navigator.clipboard.writeText(order.id);
    toast.success("Order ID copied to clipboard");
  };

  const handlePayNow = async () => {
    if (!user?.email) {
      toast.error("Please log in to continue");
      return;
    }

    setIsProcessingPayment(true);

    try {
      // Step 1: Initialize payment server-side to get a stored reference
      const initResponse = await fetch(`/api/orders/${order.id}/payment`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!initResponse.ok) {
        const errorData = await initResponse.json();
        toast.error(errorData.error || "Failed to initialize payment");
        setIsProcessingPayment(false);
        return;
      }

      const paymentData = await initResponse.json();

      // Step 2: Get Paystack config
      const config = await fetchPaystackConfig();
      if (!config || !config.publicKey) {
        toast.error("Payment gateway not configured. Please contact support.");
        setIsProcessingPayment(false);
        return;
      }

      // Step 3: Open Paystack popup with server-generated reference
      await openPaystackPopup({
        email: paymentData.email,
        amount: paymentData.amount,
        reference: paymentData.paymentReference,
        metadata: {
          orderId: order.id,
          custom_fields: [
            { display_name: "Order ID", variable_name: "order_id", value: order.id },
          ],
        },
        onSuccess: async (response) => {
          toast.success("Payment successful!");
          setIsProcessingPayment(false);
          fetchOrder();
        },
        onClose: () => {
          setIsProcessingPayment(false);
          toast.info("Payment window closed");
        },
      });
    } catch (error) {
      console.error("Payment error:", error);
      toast.error("Failed to initialize payment. Please try again.");
      setIsProcessingPayment(false);
    }
  };

  const canPayNow = (order.status === 'pending_payment' && 
    (order.paymentStatus === 'pending' || order.paymentStatus === 'failed'));

  const statusConfigMap = statusConfig[order.status] || statusConfig.pending_payment;

  const orderItems = order.orderItems || order.items || [];
  const fulfilledCount = orderItems.filter(i => i.fulfillmentStatus === 'fulfilled').length;
  const totalItems = orderItems.length;

  return (
    <SiteLayout>
      <div className="container py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link href="/buyer/orders">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">Order Details</h1>
                <Badge className={`${statusConfigMap.bg} ${statusConfigMap.color}`}>{statusConfigMap.label}</Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-mono">{order.id.slice(-8).toUpperCase()}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopyOrderId}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {order.status !== "cancelled" && (
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span>Fulfillment Progress</span>
                  <span>{fulfilledCount} of {totalItems} items fulfilled</span>
                </div>
                <Progress value={(fulfilledCount / totalItems) * 100} className="h-2" />
              </div>
              <div className="flex justify-between">
                {orderSteps.map((step, index) => {
                  const StepIcon = step.icon;
                  const isCompleted = index <= currentStep;
                  const isCurrent = index === currentStep;
                  return (
                    <div key={step.status} className="flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                        isCompleted ? "bg-green-100 text-green-600" :
                        isCurrent ? "bg-blue-100 text-blue-600" :
                        "bg-gray-100 text-gray-400"
                      }`}>
                        <StepIcon className="w-5 h-5" />
                      </div>
                      <span className={`text-xs text-center ${isCompleted || isCurrent ? "font-medium" : "text-muted-foreground"}`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {order.status === "cancelled" && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-red-800">Order Cancelled</h3>
                  <p className="text-sm text-red-600">
                    This order has been cancelled by the administrator.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Order Items
                </CardTitle>
                <CardDescription>{orderItems.length} item(s)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {orderItems.map((item, index) => {
                  const itemTotal = item.finalPrice != null ? item.finalPrice : ((item.unitPrice || item.price || 0) * item.quantity);
                  return (
                  <div key={index}>
                    <div className="flex gap-4">
                      <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                        {item.image ? (
                          <img src={item.image} alt={item.productName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-8 h-8 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <Link href={`/product/${item.productId}`} className="font-medium hover:underline">
                          {item.productName}
                        </Link>
                        <Link href={`/vendor/${item.vendorId}`} className="flex items-center gap-1 text-sm text-muted-foreground hover:underline">
                          <Store className="w-3 h-3" />
                          {item.vendorName}
                        </Link>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-sm">Qty: {item.quantity}</span>
                          <span className="font-medium">GHS {itemTotal.toFixed(2)}</span>
                          <Badge variant="outline" className={item.fulfillmentStatus === 'fulfilled' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}>
                            {item.fulfillmentStatus === 'fulfilled' ? 'Fulfilled' : 'Pending'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    {index < orderItems.length - 1 && <Separator className="my-4" />}
                  </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Shipping Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="font-medium">{order.shippingAddress.fullName}</p>
                  <p className="text-muted-foreground">{order.shippingAddress.address}</p>
                  <p className="text-muted-foreground">
                    {order.shippingAddress.city}, {order.shippingAddress.region}
                  </p>
                  {order.shippingAddress.digitalAddress && (
                    <p className="text-sm text-muted-foreground">
                      Digital Address: {order.shippingAddress.digitalAddress}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    {order.shippingAddress.phone}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>GHS {order.subtotal.toFixed(2)}</span>
                </div>
                {order.discountTotal > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount</span>
                    <span>-GHS {order.discountTotal.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>{order.shippingFee === 0 ? "FREE" : `GHS ${order.shippingFee.toFixed(2)}`}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span>GHS {order.tax.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span>GHS {order.total.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Payment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Method</span>
                  <span className="capitalize">{order.paymentMethod?.replace("_", " ") || 'Pending'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={order.paymentStatus === "paid" ? "default" : "secondary"} className={order.paymentStatus === "paid" ? "bg-green-600" : ""}>
                    {order.paymentStatus || 'pending'}
                  </Badge>
                </div>
                {order.couponCode && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Coupon</span>
                    <span className="font-mono">{order.couponCode}</span>
                  </div>
                )}
                {canPayNow && (
                  <>
                    <Separator className="my-3" />
                    <Button 
                      className="w-full" 
                      onClick={handlePayNow}
                      disabled={isProcessingPayment}
                    >
                      {isProcessingPayment ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4 mr-2" />
                          {order.paymentStatus === 'failed' ? 'Retry Payment' : 'Pay Now'} - GHS {order.total.toFixed(2)}
                        </>
                      )}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order Placed</span>
                  <span>{format(new Date(order.createdAt), "MMM d, yyyy h:mm a")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Updated</span>
                  <span>{format(new Date(order.updatedAt), "MMM d, yyyy h:mm a")}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-center space-y-3">
                  <MessageSquare className="w-8 h-8 text-gray-400 mx-auto" />
                  <p className="text-sm text-muted-foreground">Need help with this order?</p>
                  <Button variant="outline" className="w-full" asChild>
                    <Link href="/help">Contact Support</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
