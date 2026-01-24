"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { SiteLayout } from "@/components/layout/site-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Package,
  Truck,
  Shield,
  MapPin,
  Clock,
  CheckCircle,
  Circle,
  Search,
  Loader2,
  Mail,
  Phone,
  ArrowRight,
  AlertCircle
} from "lucide-react";
import { useOrdersStore, Order } from "@/lib/orders-store";
import { useAuthStore } from "@/lib/auth-store";
import { getOrderStatusInfo } from "@/lib/order-helpers";
import { formatDistance } from "date-fns";

interface TrackingStep {
  status: string;
  label: string;
  description: string;
  completed: boolean;
  current: boolean;
  timestamp?: string;
}

const getTrackingSteps = (order: Order): TrackingStep[] => {
  const statusOrder = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
  const currentIndex = statusOrder.indexOf(order.status);

  if (order.status === 'cancelled') {
    return [
      { status: 'pending', label: 'Order Placed', description: 'Order was placed', completed: true, current: false, timestamp: order.createdAt },
      { status: 'cancelled', label: 'Order Cancelled', description: 'Order was cancelled', completed: true, current: true, timestamp: order.updatedAt },
    ];
  }

  return [
    {
      status: 'pending',
      label: 'Order Placed',
      description: 'Your order has been received',
      completed: currentIndex >= 0,
      current: currentIndex === 0,
      timestamp: order.createdAt,
    },
    {
      status: 'confirmed',
      label: 'Order Confirmed',
      description: 'Vendor has confirmed your order',
      completed: currentIndex >= 1,
      current: currentIndex === 1,
    },
    {
      status: 'processing',
      label: 'Processing',
      description: 'Order is being prepared',
      completed: currentIndex >= 2,
      current: currentIndex === 2,
    },
    {
      status: 'shipped',
      label: 'Shipped',
      description: order.trackingNumber ? `Tracking: ${order.trackingNumber}` : 'Package has been dispatched',
      completed: currentIndex >= 3,
      current: currentIndex === 3,
    },
    {
      status: 'delivered',
      label: 'Delivered',
      description: 'Package delivered successfully',
      completed: currentIndex >= 4,
      current: currentIndex === 4,
      timestamp: currentIndex >= 4 ? order.updatedAt : undefined,
    },
  ];
};

export default function TrackingPage() {
  const searchParams = useSearchParams();
  const initialOrderId = searchParams.get('orderId') || "";

  const { getOrderById, getOrdersByBuyer } = useOrdersStore();
  const { user, isAuthenticated } = useAuthStore();

  const [orderIdInput, setOrderIdInput] = useState(initialOrderId);
  const [trackedOrder, setTrackedOrder] = useState<Order | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const handleTrackOrder = useCallback(() => {
    if (!orderIdInput.trim()) {
      setError("Please enter an order ID");
      return;
    }

    setIsSearching(true);
    setError("");

    // Simulate search delay
    setTimeout(() => {
      const order = getOrderById(orderIdInput);
      if (order) {
        // If user is logged in, verify they own the order
        if (user && order.buyerId !== user.id && user.role !== 'admin') {
          setError("You don't have permission to view this order");
          setTrackedOrder(null);
        } else {
          setTrackedOrder(order);
        }
      } else {
        setError("Order not found. Please check the order ID and try again.");
        setTrackedOrder(null);
      }
      setIsSearching(false);
    }, 500);
  }, [orderIdInput, getOrderById, user]);

  // Auto-track if order ID is provided in URL
  useEffect(() => {
    if (isHydrated && initialOrderId) {
      handleTrackOrder();
    }
  }, [isHydrated, initialOrderId, handleTrackOrder]);

  // Get user's orders if logged in
  const userOrders = isHydrated && user ? getOrdersByBuyer(user.id) : [];

  if (!isHydrated) {
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

  const trackingSteps = trackedOrder ? getTrackingSteps(trackedOrder) : [];
  const statusInfo = trackedOrder ? getOrderStatusInfo(trackedOrder.status) : null;

  return (
    <SiteLayout>
      <div className="container max-w-4xl py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2">Track Your Order</h1>
          <p className="text-muted-foreground">
            Enter your order ID to see real-time tracking information
          </p>
        </div>

        {/* Search Box */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Label htmlFor="orderId" className="sr-only">Order ID</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="orderId"
                    placeholder="Enter your order ID (e.g., order_1234567890_abc123)"
                    value={orderIdInput}
                    onChange={(e) => {
                      setOrderIdInput(e.target.value);
                      setError("");
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleTrackOrder()}
                    className="pl-10"
                  />
                </div>
              </div>
              <Button onClick={handleTrackOrder} disabled={isSearching}>
                {isSearching ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    Track Order
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
            {error && (
              <div className="mt-3 flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tracked Order Details */}
        {trackedOrder && (
          <div className="space-y-6">
            {/* Order Summary */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      Order #{trackedOrder.id.slice(-8).toUpperCase()}
                    </CardTitle>
                    <CardDescription>
                      Placed {formatDistance(new Date(trackedOrder.createdAt), new Date(), { addSuffix: true })}
                    </CardDescription>
                  </div>
                  <Badge className={statusInfo?.color}>{statusInfo?.label}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Delivery Address */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <MapPin className="w-4 h-4" />
                      Delivery Address
                    </div>
                    <div className="text-sm text-muted-foreground pl-6">
                      <p>{trackedOrder.shippingAddress.fullName}</p>
                      <p>{trackedOrder.shippingAddress.address}</p>
                      <p>{trackedOrder.shippingAddress.city}, {trackedOrder.shippingAddress.region}</p>
                      <p className="flex items-center gap-1 mt-1">
                        <Phone className="w-3 h-3" />
                        {trackedOrder.shippingAddress.phone}
                      </p>
                    </div>
                  </div>

                  {/* Tracking Number */}
                  {trackedOrder.trackingNumber && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Truck className="w-4 h-4" />
                        Tracking Number
                      </div>
                      <div className="pl-6">
                        <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                          {trackedOrder.trackingNumber}
                        </code>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Tracking Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Tracking Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  {trackingSteps.map((step, index) => (
                    <div key={step.status} className="flex gap-4 pb-8 last:pb-0">
                      {/* Timeline Line */}
                      <div className="flex flex-col items-center">
                        <div className={`rounded-full p-1 ${
                          step.completed
                            ? step.status === 'cancelled' ? 'bg-red-100' : 'bg-green-100'
                            : 'bg-gray-100'
                        }`}>
                          {step.completed ? (
                            step.status === 'cancelled' ? (
                              <AlertCircle className="w-5 h-5 text-red-600" />
                            ) : (
                              <CheckCircle className="w-5 h-5 text-green-600" />
                            )
                          ) : (
                            <Circle className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        {index < trackingSteps.length - 1 && (
                          <div className={`w-0.5 flex-1 mt-2 ${
                            step.completed ? 'bg-green-300' : 'bg-gray-200'
                          }`} />
                        )}
                      </div>

                      {/* Step Content */}
                      <div className={`flex-1 pt-0.5 ${step.current ? 'pb-2' : ''}`}>
                        <div className="flex items-center gap-2">
                          <h4 className={`font-medium ${
                            step.completed
                              ? step.status === 'cancelled' ? 'text-red-800' : 'text-green-800'
                              : 'text-gray-500'
                          }`}>
                            {step.label}
                          </h4>
                          {step.current && (
                            <Badge variant="outline" className="text-xs">Current</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{step.description}</p>
                        {step.timestamp && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(step.timestamp).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Order Items */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Order Items
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {trackedOrder.items.map((item, index) => (
                    <div key={index} className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                        {item.image ? (
                          <img src={item.image} alt={item.productName} className="w-full h-full object-cover rounded-lg" />
                        ) : (
                          <Package className="w-8 h-8 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{item.productName}</p>
                        <p className="text-sm text-muted-foreground">
                          Qty: {item.quantity} x GHS {item.price.toLocaleString()}
                        </p>
                      </div>
                      <p className="font-medium">
                        GHS {(item.price * item.quantity).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
                <Separator className="my-4" />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>GHS {trackedOrder.total.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>

            {/* Support */}
            <Card className="bg-gray-50">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <Shield className="w-10 h-10 text-green-600" />
                  <div className="flex-1">
                    <h3 className="font-semibold">Need Help with Your Order?</h3>
                    <p className="text-sm text-muted-foreground">
                      Contact our support team for assistance with tracking or delivery issues.
                    </p>
                  </div>
                  <Button variant="outline">
                    <Mail className="w-4 h-4 mr-2" />
                    Contact Support
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* User's Recent Orders */}
        {!trackedOrder && isAuthenticated && userOrders.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Your Recent Orders</CardTitle>
              <CardDescription>Click on an order to track it</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {userOrders.slice(0, 5).map((order) => {
                  const info = getOrderStatusInfo(order.status);
                  return (
                    <button
                      key={order.id}
                      onClick={() => {
                        setOrderIdInput(order.id);
                        setTrackedOrder(order);
                      }}
                      className="w-full flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors text-left"
                    >
                      <div>
                        <p className="font-medium">Order #{order.id.slice(-8).toUpperCase()}</p>
                        <p className="text-sm text-muted-foreground">
                          {order.items.length} item(s) - {formatDistance(new Date(order.createdAt), new Date(), { addSuffix: true })}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={info.color}>{info.label}</Badge>
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!trackedOrder && (!isAuthenticated || userOrders.length === 0) && (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Enter Your Order ID</h3>
            <p className="text-muted-foreground">
              You can find your order ID in the confirmation email or your order history.
            </p>
          </div>
        )}
      </div>
    </SiteLayout>
  );
}
