"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Package,
  Truck,
  MapPin,
  Clock,
  CheckCircle,
  AlertTriangle,
  Phone,
  Mail,
  Bell,
  Camera,
  Download,
  RefreshCw,
  Navigation,
  Package2,
  Plane,
  Ship,
  User,
  Calendar,
  Star,
  MessageSquare,
  ExternalLink,
  Copy,
  Share2
} from "lucide-react";

interface TrackingEvent {
  id: string;
  timestamp: Date;
  status: string;
  location: string;
  description: string;
  carrier?: string;
  proof?: {
    type: "signature" | "photo" | "location";
    url?: string;
    details?: string;
  };
}

interface Order {
  id: string;
  vendorName: string;
  vendorAvatar?: string;
  buyerName: string;
  buyerAvatar?: string;
  productName: string;
  productImage?: string;
  quantity: number;
  totalAmount: number;
  orderDate: Date;
  estimatedDelivery: Date;
  actualDelivery?: Date;
  status: "pending" | "confirmed" | "shipped" | "in_transit" | "out_for_delivery" | "delivered" | "returned";
  trackingNumber: string;
  carrier: "DHL" | "UPS" | "Ghana Post" | "Zipline" | "Local Courier";
  shippingAddress: {
    name: string;
    street: string;
    city: string;
    region: string;
    phone: string;
  };
  notifications: {
    sms: boolean;
    email: boolean;
    push: boolean;
  };
  rating?: number;
  review?: string;
}

const mockOrders: Order[] = [
  {
    id: "ORD-2025-001234",
    vendorName: "TechStore Pro",
    vendorAvatar: "/placeholder-avatar.jpg",
    buyerName: "John Kwame Asante",
    buyerAvatar: "/placeholder-avatar.jpg",
    productName: "iPhone 15 Pro Max 256GB",
    productImage: "/placeholder-product.jpg",
    quantity: 1,
    totalAmount: 4200,
    orderDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    estimatedDelivery: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
    status: "in_transit",
    trackingNumber: "DHL123456789GH",
    carrier: "DHL",
    shippingAddress: {
      name: "John Kwame Asante",
      street: "123 Liberation Road",
      city: "Accra",
      region: "Greater Accra",
      phone: "+233 24 123 4567"
    },
    notifications: {
      sms: true,
      email: true,
      push: true
    }
  },
  {
    id: "ORD-2025-001235",
    vendorName: "Fashion Hub GH",
    vendorAvatar: "/placeholder-avatar.jpg",
    buyerName: "Ama Osei",
    buyerAvatar: "/placeholder-avatar.jpg",
    productName: "Traditional Kente Dress",
    productImage: "/placeholder-product.jpg",
    quantity: 1,
    totalAmount: 350,
    orderDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    estimatedDelivery: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    actualDelivery: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    status: "delivered",
    trackingNumber: "GP987654321GH",
    carrier: "Ghana Post",
    shippingAddress: {
      name: "Ama Osei",
      street: "456 Kumasi Road",
      city: "Kumasi",
      region: "Ashanti Region",
      phone: "+233 20 456 7890"
    },
    notifications: {
      sms: true,
      email: false,
      push: true
    },
    rating: 5,
    review: "Beautiful dress, excellent quality!"
  }
];

const mockTrackingEvents: { [key: string]: TrackingEvent[] } = {
  "ORD-2025-001234": [
    {
      id: "1",
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      status: "Order Confirmed",
      location: "Accra, Ghana",
      description: "Your order has been confirmed and is being prepared for shipment",
      carrier: "TechStore Pro"
    },
    {
      id: "2",
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      status: "Shipped",
      location: "Accra Distribution Center",
      description: "Package has been picked up by DHL and is on its way",
      carrier: "DHL"
    },
    {
      id: "3",
      timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      status: "In Transit",
      location: "Tema Port, Ghana",
      description: "Package has departed from Tema and is in transit",
      carrier: "DHL"
    },
    {
      id: "4",
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
      status: "Out for Delivery",
      location: "Accra Local Facility",
      description: "Package is out for delivery and will arrive today",
      carrier: "DHL"
    }
  ],
  "ORD-2025-001235": [
    {
      id: "1",
      timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      status: "Order Confirmed",
      location: "Kumasi, Ghana",
      description: "Your order has been confirmed",
      carrier: "Fashion Hub GH"
    },
    {
      id: "2",
      timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      status: "Shipped",
      location: "Kumasi Post Office",
      description: "Package shipped via Ghana Post",
      carrier: "Ghana Post"
    },
    {
      id: "3",
      timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      status: "Delivered",
      location: "456 Kumasi Road, Kumasi",
      description: "Package delivered successfully",
      carrier: "Ghana Post",
      proof: {
        type: "signature",
        details: "Signed by: Ama Osei"
      }
    }
  ]
};

interface OrderTrackingProps {
  userType: "buyer" | "vendor" | "admin";
  orderId?: string;
}

export function OrderTracking({ userType, orderId }: OrderTrackingProps) {
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(
    orderId ? orders.find(o => o.id === orderId) || orders[0] : orders[0]
  );
  const [trackingEvents, setTrackingEvents] = useState<TrackingEvent[]>(
    selectedOrder ? mockTrackingEvents[selectedOrder.id] || [] : []
  );
  const [trackingInput, setTrackingInput] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notificationSettingsOpen, setNotificationSettingsOpen] = useState(false);

  useEffect(() => {
    if (selectedOrder) {
      setTrackingEvents(mockTrackingEvents[selectedOrder.id] || []);
    }
  }, [selectedOrder]);

  const getStatusProgress = (status: string) => {
    switch (status) {
      case "pending": return 0;
      case "confirmed": return 20;
      case "shipped": return 40;
      case "in_transit": return 60;
      case "out_for_delivery": return 80;
      case "delivered": return 100;
      default: return 0;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered": return "text-green-600";
      case "out_for_delivery": return "text-blue-600";
      case "in_transit": return "text-orange-600";
      case "shipped": return "text-purple-600";
      case "confirmed": return "text-blue-500";
      case "pending": return "text-gray-500";
      case "returned": return "text-red-600";
      default: return "text-gray-500";
    }
  };

  const getCarrierIcon = (carrier: string) => {
    switch (carrier) {
      case "DHL":
      case "UPS":
        return <Plane className="w-4 h-4" />;
      case "Ghana Post":
        return <Truck className="w-4 h-4" />;
      case "Zipline":
        return <Package2 className="w-4 h-4" />;
      case "Local Courier":
        return <User className="w-4 h-4" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

  const handleRefreshTracking = () => {
    setIsRefreshing(true);
    // Simulate API call
    setTimeout(() => {
      setIsRefreshing(false);
      // Add a new tracking event (simulation)
      if (selectedOrder && selectedOrder.status !== "delivered") {
        const newEvent: TrackingEvent = {
          id: String(trackingEvents.length + 1),
          timestamp: new Date(),
          status: "Status Updated",
          location: "Updated Location",
          description: "Tracking information updated",
          carrier: selectedOrder.carrier
        };
        setTrackingEvents([...trackingEvents, newEvent]);
      }
    }, 2000);
  };

  const handleTrackOrder = () => {
    const order = orders.find(o => o.id === trackingInput || o.trackingNumber === trackingInput);
    if (order) {
      setSelectedOrder(order);
      setTrackingInput("");
    }
  };

  const formatEstimatedDelivery = (date: Date) => {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    if (days < 0) return "Overdue";
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    return `${days} days`;
  };

  const copyTrackingNumber = () => {
    if (selectedOrder) {
      navigator.clipboard.writeText(selectedOrder.trackingNumber);
    }
  };

  const shareTracking = () => {
    if (selectedOrder) {
      const url = `${window.location.origin}/tracking/${selectedOrder.id}`;
      navigator.clipboard.writeText(url);
    }
  };

  return (
    <div className="space-y-6">
      {/* Track Order Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Track Your Order
          </CardTitle>
          <CardDescription>
            Enter your order ID or tracking number to get real-time updates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                placeholder="Enter Order ID or Tracking Number"
                value={trackingInput}
                onChange={(e) => setTrackingInput(e.target.value)}
              />
            </div>
            <Button onClick={handleTrackOrder}>
              <Package className="w-4 h-4 mr-2" />
              Track
            </Button>
          </div>
        </CardContent>
      </Card>

      {selectedOrder && (
        <>
          {/* Order Overview */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Badge variant="outline">{selectedOrder.id}</Badge>
                    <Badge className={getStatusColor(selectedOrder.status)}>
                      {selectedOrder.status.replace("_", " ").toUpperCase()}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Ordered on {selectedOrder.orderDate.toLocaleDateString()}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={copyTrackingNumber}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Tracking
                  </Button>
                  <Button variant="outline" size="sm" onClick={shareTracking}>
                    <Share2 className="w-4 h-4 mr-2" />
                    Share
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleRefreshTracking} disabled={isRefreshing}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Order Progress</span>
                  <span>{getStatusProgress(selectedOrder.status)}%</span>
                </div>
                <Progress value={getStatusProgress(selectedOrder.status)} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Confirmed</span>
                  <span>Shipped</span>
                  <span>In Transit</span>
                  <span>Delivered</span>
                </div>
              </div>

              {/* Order Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold">Product Details</h4>
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                      <Package className="w-8 h-8 text-gray-400" />
                    </div>
                    <div>
                      <p className="font-medium">{selectedOrder.productName}</p>
                      <p className="text-sm text-muted-foreground">Qty: {selectedOrder.quantity}</p>
                      <p className="text-sm font-medium">{formatCurrency(selectedOrder.totalAmount)}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold">Shipping Information</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {getCarrierIcon(selectedOrder.carrier)}
                      <span className="text-sm">{selectedOrder.carrier}</span>
                    </div>
                    <p className="text-sm">
                      <span className="font-medium">Tracking:</span> {selectedOrder.trackingNumber}
                    </p>
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="w-4 h-4" />
                      <span>
                        {selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.region}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold">Delivery Timeline</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4" />
                      <span>
                        Estimated: {formatEstimatedDelivery(selectedOrder.estimatedDelivery)}
                      </span>
                    </div>
                    {selectedOrder.actualDelivery && (
                      <div className="flex items-center gap-2 text-sm text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        <span>Delivered: {selectedOrder.actualDelivery.toLocaleDateString()}</span>
                      </div>
                    )}
                    <Dialog open={notificationSettingsOpen} onOpenChange={setNotificationSettingsOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full">
                          <Bell className="w-4 h-4 mr-2" />
                          Notification Settings
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Notification Preferences</DialogTitle>
                          <DialogDescription>
                            Choose how you want to receive tracking updates
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label>SMS Notifications</Label>
                              <p className="text-sm text-muted-foreground">
                                Receive text messages for major updates
                              </p>
                            </div>
                            <Switch checked={selectedOrder.notifications.sms} />
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label>Email Notifications</Label>
                              <p className="text-sm text-muted-foreground">
                                Get detailed updates via email
                              </p>
                            </div>
                            <Switch checked={selectedOrder.notifications.email} />
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label>Push Notifications</Label>
                              <p className="text-sm text-muted-foreground">
                                Instant updates on your device
                              </p>
                            </div>
                            <Switch checked={selectedOrder.notifications.push} />
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tracking Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Navigation className="w-5 h-5" />
                Tracking Timeline
              </CardTitle>
              <CardDescription>
                Real-time updates from {selectedOrder.carrier}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {trackingEvents.map((event, index) => (
                  <div key={event.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-4 h-4 rounded-full ${
                        index === 0 ? "bg-blue-600" : "bg-gray-300"
                      }`} />
                      {index < trackingEvents.length - 1 && (
                        <div className="w-0.5 h-16 bg-gray-200 mt-2" />
                      )}
                    </div>

                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold">{event.status}</h4>
                          <p className="text-sm text-muted-foreground">{event.description}</p>
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              <span>{event.location}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{event.timestamp.toLocaleString()}</span>
                            </div>
                            {event.carrier && (
                              <div className="flex items-center gap-1">
                                {getCarrierIcon(event.carrier)}
                                <span>{event.carrier}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {event.proof && (
                          <div className="text-right">
                            <Badge variant="outline" className="text-xs">
                              <Camera className="w-3 h-3 mr-1" />
                              Proof Available
                            </Badge>
                            {event.proof.details && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {event.proof.details}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Delivery Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Delivery Address
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-2">Shipping Address</h4>
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">{selectedOrder.shippingAddress.name}</p>
                    <p>{selectedOrder.shippingAddress.street}</p>
                    <p>{selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.region}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Phone className="w-4 h-4" />
                      <span>{selectedOrder.shippingAddress.phone}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Carrier Information</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {getCarrierIcon(selectedOrder.carrier)}
                      <span className="font-medium">{selectedOrder.carrier}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Track directly with carrier
                    </p>
                    <Button variant="outline" size="sm">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Visit {selectedOrder.carrier} Website
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Review Section (if delivered) */}
          {selectedOrder.status === "delivered" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="w-5 h-5" />
                  Order Review
                </CardTitle>
                <CardDescription>
                  How was your experience with this order?
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedOrder.rating ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Your Rating:</span>
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${
                              i < selectedOrder.rating! ? "text-yellow-400 fill-current" : "text-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    {selectedOrder.review && (
                      <div>
                        <p className="text-sm text-muted-foreground">Your Review:</p>
                        <p className="text-sm mt-1">{selectedOrder.review}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <Button>
                      <Star className="w-4 h-4 mr-2" />
                      Rate & Review
                    </Button>
                    <Button variant="outline">
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Contact Vendor
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
