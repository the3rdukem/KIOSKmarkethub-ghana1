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
  Scale,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  deliveredAt?: string;
}

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

const orderSteps = [
  { status: "pending_payment", label: "Order Placed", icon: Package },
  { status: "confirmed", label: "Payment Confirmed", icon: Clock },
  { status: "preparing", label: "Preparing", icon: Package },
  { status: "out_for_delivery", label: "Out for Delivery", icon: Truck },
  { status: "delivered", label: "Delivered", icon: CheckCircle },
];

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
  const [disputeDialogOpen, setDisputeDialogOpen] = useState(false);
  const [disputeType, setDisputeType] = useState<string>("");
  const [disputeDescription, setDisputeDescription] = useState("");
  const [disputeProductId, setDisputeProductId] = useState<string>("");
  const [disputeEvidence, setDisputeEvidence] = useState<string[]>([]);
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);
  const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);

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
    // Phase 7B statuses
    if (order.status === "completed" || order.status === "delivered" || order.status === "fulfilled") return 4;
    if (order.status === "out_for_delivery" || order.status === "shipped") return 3;
    if (order.status === "preparing" || order.status === "ready_for_pickup") return 2;
    if (order.status === "confirmed" || order.status === "processing") return 1;
    // 'pending_payment', 'pending', 'created' are initial states
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

  const isDelivered = ['delivered', 'completed', 'fulfilled'].includes(order.status);
  const deliveryTimestamp = order.deliveredAt || order.updatedAt;
  const deliveredAt = new Date(deliveryTimestamp);
  const now = new Date();
  const hoursSinceDelivery = (now.getTime() - deliveredAt.getTime()) / (1000 * 60 * 60);
  const canRaiseDispute = isDelivered && hoursSinceDelivery <= 48 && order.status !== 'disputed';
  const isMultiVendor = new Set((order.orderItems || order.items || []).map((i: OrderItem) => i.vendorId)).size > 1;

  const handleSubmitDispute = async () => {
    if (!disputeType) {
      toast.error("Please select a dispute type");
      return;
    }
    if (isMultiVendor && !disputeProductId) {
      toast.error("Please select the product you have an issue with");
      return;
    }
    if (disputeDescription.trim().length < 20) {
      toast.error("Please provide a detailed description (at least 20 characters)");
      return;
    }

    setIsSubmittingDispute(true);
    try {
      const response = await fetch('/api/buyer/disputes/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          orderId: order.id,
          type: disputeType,
          description: disputeDescription.trim(),
          productId: disputeProductId || undefined,
          evidence: disputeEvidence,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create dispute');
      }

      toast.success("Dispute submitted successfully. Our team will review it shortly.");
      setDisputeDialogOpen(false);
      setDisputeType("");
      setDisputeDescription("");
      setDisputeProductId("");
      setDisputeEvidence([]);
      router.push('/buyer/disputes');
    } catch (error) {
      console.error('Error submitting dispute:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit dispute');
    } finally {
      setIsSubmittingDispute(false);
    }
  };

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
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Order Details</h1>
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
                {(() => {
                  const progressValue = (fulfilledCount / totalItems) * 100;
                  const isCompleted = order.status === 'delivered' || order.status === 'completed' || order.status === 'fulfilled';
                  const hasIssue = order.status === 'cancelled' || order.status === 'disputed' || order.status === 'delivery_failed';
                  const indicatorColor = hasIssue 
                    ? 'bg-red-500' 
                    : isCompleted 
                    ? 'bg-green-500' 
                    : 'bg-yellow-500';
                  return (
                    <Progress value={progressValue} className="h-2" indicatorClassName={indicatorColor} />
                  );
                })()}
              </div>
              <div className="flex justify-between">
                {orderSteps.map((step, index) => {
                  const StepIcon = step.icon;
                  const isCompleted = index <= currentStep;
                  const isCurrent = index === currentStep;
                  const hasIssue = order.status === 'cancelled' || order.status === 'disputed' || order.status === 'delivery_failed';
                  return (
                    <div key={step.status} className="flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                        hasIssue && isCurrent ? "bg-red-100 text-red-600" :
                        isCompleted ? "bg-green-100 text-green-600" :
                        isCurrent ? "bg-yellow-100 text-yellow-600" :
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
                  Ordered Items
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
                          <Badge variant="outline" className={
                            item.fulfillmentStatus === 'delivered' || item.fulfillmentStatus === 'fulfilled' ? 'bg-green-50 text-green-700' :
                            item.fulfillmentStatus === 'handed_to_courier' || item.fulfillmentStatus === 'shipped' ? 'bg-cyan-50 text-cyan-700' :
                            item.fulfillmentStatus === 'packed' ? 'bg-purple-50 text-purple-700' :
                            'bg-yellow-50 text-yellow-700'
                          }>
                            {item.fulfillmentStatus === 'delivered' ? 'Delivered' :
                             item.fulfillmentStatus === 'fulfilled' ? 'Delivered' :
                             item.fulfillmentStatus === 'handed_to_courier' ? 'With Courier' :
                             item.fulfillmentStatus === 'shipped' ? 'Shipped' :
                             item.fulfillmentStatus === 'packed' ? 'Packed' :
                             'Awaiting Processing'}
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
                  <span className="text-gray-600">Paid on Delivery</span>
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
                    {order.paymentStatus === 'paid' ? 'Payment Complete' : 
                     order.paymentStatus === 'pending' ? 'Awaiting Payment' :
                     order.paymentStatus === 'failed' ? 'Payment Failed' :
                     order.paymentStatus || 'Awaiting Payment'}
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

            {canRaiseDispute && (
              <Card className="border-orange-200 bg-orange-50">
                <CardContent className="p-4">
                  <div className="text-center space-y-3">
                    <Scale className="w-8 h-8 text-orange-500 mx-auto" />
                    <div>
                      <p className="font-medium text-orange-800">Having an issue?</p>
                      <p className="text-xs text-orange-600">
                        {Math.round(48 - hoursSinceDelivery)} hours left to raise a dispute
                      </p>
                    </div>
                    <Dialog open={disputeDialogOpen} onOpenChange={setDisputeDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="destructive" className="w-full">
                          <Scale className="w-4 h-4 mr-2" />
                          Raise Dispute
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Raise a Dispute</DialogTitle>
                          <DialogDescription>
                            Please describe the issue with your order. Our team will review and respond within 24-48 hours.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          {isMultiVendor && (
                            <div className="space-y-2">
                              <Label>Which product has an issue?</Label>
                              <Select value={disputeProductId} onValueChange={setDisputeProductId}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select the product" />
                                </SelectTrigger>
                                <SelectContent>
                                  {orderItems.map((item) => (
                                    <SelectItem key={item.productId} value={item.productId}>
                                      {item.productName} ({item.vendorName})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground">
                                This order has items from multiple vendors. Please select the specific product.
                              </p>
                            </div>
                          )}
                          <div className="space-y-2">
                            <Label>Issue Type</Label>
                            <Select value={disputeType} onValueChange={setDisputeType}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select issue type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="quality">Product Quality Issue</SelectItem>
                                <SelectItem value="delivery">Delivery Problem</SelectItem>
                                <SelectItem value="refund">Request Refund</SelectItem>
                                <SelectItem value="fraud">Fraudulent/Fake Product</SelectItem>
                                <SelectItem value="other">Other Issue</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                              placeholder="Please describe your issue in detail (at least 20 characters)..."
                              value={disputeDescription}
                              onChange={(e) => setDisputeDescription(e.target.value)}
                              rows={4}
                            />
                            <p className="text-xs text-muted-foreground">
                              {disputeDescription.length}/20 characters minimum
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label>Evidence Photos (Optional)</Label>
                            <p className="text-xs text-muted-foreground mb-2">
                              Upload photos showing the issue (max 5 images, 5MB each)
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {disputeEvidence.map((url, index) => (
                                <div key={index} className="relative w-20 h-20 border rounded overflow-hidden group">
                                  <img 
                                    src={url} 
                                    alt={`Evidence ${index + 1}`} 
                                    className="w-full h-full object-cover"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setDisputeEvidence(prev => prev.filter((_, i) => i !== index))}
                                    className="absolute top-0 right-0 bg-red-500 text-white p-1 rounded-bl opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <XCircle className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                              {disputeEvidence.length < 5 && (
                                <label className="w-20 h-20 border-2 border-dashed rounded flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors">
                                  {isUploadingEvidence ? (
                                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                  ) : (
                                    <>
                                      <Package className="w-5 h-5 text-muted-foreground" />
                                      <span className="text-xs text-muted-foreground mt-1">Add</span>
                                    </>
                                  )}
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    disabled={isUploadingEvidence}
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      if (file.size > 5 * 1024 * 1024) {
                                        toast.error("Image must be less than 5MB");
                                        return;
                                      }
                                      setIsUploadingEvidence(true);
                                      try {
                                        const formData = new FormData();
                                        formData.append('file', file);
                                        formData.append('directory', 'disputes');
                                        const res = await fetch('/api/upload', {
                                          method: 'POST',
                                          credentials: 'include',
                                          body: formData,
                                        });
                                        const data = await res.json();
                                        if (!res.ok) throw new Error(data.error || 'Upload failed');
                                        setDisputeEvidence(prev => [...prev, data.url]);
                                      } catch (err) {
                                        console.error('Upload error:', err);
                                        toast.error('Failed to upload image');
                                      } finally {
                                        setIsUploadingEvidence(false);
                                        e.target.value = '';
                                      }
                                    }}
                                  />
                                </label>
                              )}
                            </div>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setDisputeDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button 
                            onClick={handleSubmitDispute} 
                            disabled={isSubmittingDispute}
                          >
                            {isSubmittingDispute ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Submitting...
                              </>
                            ) : (
                              "Submit Dispute"
                            )}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="p-4">
                <div className="text-center space-y-3">
                  <MessageSquare className="w-8 h-8 text-gray-400 mx-auto" />
                  <p className="text-sm text-muted-foreground">Need help with this order?</p>
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" className="w-full" asChild>
                      <Link href="/buyer/disputes">View My Disputes</Link>
                    </Button>
                    <Button variant="ghost" size="sm" className="w-full" asChild>
                      <Link href="/help">Contact Support</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
