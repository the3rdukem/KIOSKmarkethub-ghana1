"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle,
  Package,
  Truck,
  MessageSquare,
  Download,
  Star,
  ShoppingCart,
  Home,
  Eye,
  Bell,
  Share2,
  Mail,
  Smartphone,
  Loader2,
  Clock,
  AlertCircle,
  Facebook,
  Twitter,
  Copy
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface OrderItem {
  productId: string;
  productName: string;
  vendorId: string;
  vendorName: string;
  quantity: number;
  price: number;
  image?: string;
}

interface ShippingAddress {
  fullName: string;
  phone: string;
  address: string;
  city: string;
  region: string;
}

interface OrderData {
  id: string;
  buyerId: string;
  buyerName: string;
  buyerEmail: string;
  items: OrderItem[];
  subtotal: number;
  discountTotal: number;
  shippingFee: number;
  tax: number;
  total: number;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  shippingAddress: ShippingAddress;
  couponCode?: string;
  createdAt: string;
}

function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const transactionId = searchParams.get('transaction');

  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    // Check if native share is available (typically mobile devices)
    const checkNativeShare = () => {
      try {
        if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
          setCanNativeShare(true);
        }
      } catch {
        setCanNativeShare(false);
      }
    };
    checkNativeShare();
  }, []);

  useEffect(() => {
    if (orderId) {
      fetchOrder(orderId);
    } else {
      setLoading(false);
      setError("Order ID not found");
    }
  }, [orderId]);

  const handleNativeShare = async () => {
    const shareText = `Just made a purchase on KIOSK! Check out this amazing marketplace.`;
    const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}` : '';
    const shareData = {
      title: 'KIOSK - Ghana\'s Trusted Marketplace',
      text: shareText,
      url: shareUrl,
    };
    
    try {
      await navigator.share(shareData);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        toast.error("Failed to share");
      }
    }
  };

  const handleCopyLink = async () => {
    const shareUrl = typeof window !== 'undefined' ? window.location.origin : '';
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied to clipboard!");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const fetchOrder = async (id: string) => {
    try {
      const response = await fetch(`/api/orders/${id}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch order');
      }
      
      const data = await response.json();
      setOrder(data.order);
    } catch (err) {
      console.error('Error fetching order:', err);
      setError('Unable to load order details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SiteLayout>
        <div className="container py-8">
          <div className="max-w-3xl mx-auto text-center">
            <Loader2 className="w-16 h-16 mx-auto mb-6 animate-spin text-primary" />
            <h1 className="text-xl sm:text-2xl font-bold mb-2">Loading Order Details...</h1>
            <p className="text-muted-foreground">Please wait while we retrieve your order.</p>
          </div>
        </div>
      </SiteLayout>
    );
  }

  if (error || !order) {
    return (
      <SiteLayout>
        <div className="container py-8">
          <div className="max-w-3xl mx-auto text-center">
            <AlertCircle className="w-16 h-16 mx-auto mb-6 text-amber-500" />
            <h1 className="text-xl sm:text-2xl font-bold mb-2">Order Created</h1>
            <p className="text-muted-foreground mb-6">
              Your order has been placed successfully. You can view your orders in your dashboard.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild>
                <Link href="/buyer/orders">
                  <Package className="w-4 h-4 mr-2" />
                  View My Orders
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/">
                  <Home className="w-4 h-4 mr-2" />
                  Back to Home
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </SiteLayout>
    );
  }

  const estimatedDelivery = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <SiteLayout>
      <div className="container py-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-green-600 mb-2">Order Confirmed!</h1>
            <p className="text-muted-foreground mb-4">
              Thank you for your purchase. Your order has been successfully placed.
            </p>
            <div className="flex items-center justify-center gap-2">
              {canNativeShare ? (
                <Button variant="outline" size="sm" className="border-purple-300 text-purple-700 hover:bg-purple-100" onClick={handleNativeShare}>
                  <Share2 className="w-4 h-4 mr-2" />
                  Share your purchase
                </Button>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="border-purple-300 text-purple-700 hover:bg-purple-100">
                      <Share2 className="w-4 h-4 mr-2" />
                      Share your purchase
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center">
                    <DropdownMenuItem onClick={handleCopyLink}>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Link
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        const shareUrl = typeof window !== 'undefined' ? window.location.origin : '';
                        window.open(
                          `https://wa.me/?text=${encodeURIComponent(`Just made a purchase on KIOSK! Check out this amazing marketplace: ${shareUrl}`)}`,
                          '_blank'
                        );
                      }}
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Share on WhatsApp
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        const shareUrl = typeof window !== 'undefined' ? window.location.origin : '';
                        window.open(
                          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
                          '_blank',
                          'width=600,height=400'
                        );
                      }}
                    >
                      <Facebook className="w-4 h-4 mr-2" />
                      Share on Facebook
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        const shareUrl = typeof window !== 'undefined' ? window.location.origin : '';
                        window.open(
                          `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent('Just made a purchase on KIOSK! Check out this amazing marketplace.')}`,
                          '_blank',
                          'width=600,height=400'
                        );
                      }}
                    >
                      <Twitter className="w-4 h-4 mr-2" />
                      Share on X
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        const shareUrl = typeof window !== 'undefined' ? window.location.origin : '';
                        window.location.href = `mailto:?subject=${encodeURIComponent('Check out KIOSK!')}&body=${encodeURIComponent(`I just made a purchase on KIOSK, Ghana's trusted marketplace. Check it out: ${shareUrl}`)}`;
                      }}
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      Share via Email
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
              <CardDescription>
                Order #{order.id}
                {transactionId && ` • Transaction #${transactionId}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {order.items.map((item, index) => (
                <div key={index} className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                    <Package className="w-6 h-6 text-gray-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">{item.productName}</h3>
                    <p className="text-sm text-muted-foreground">by {item.vendorName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">GHS {(item.price * item.quantity).toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                  </div>
                </div>
              ))}

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>GHS {order.subtotal.toFixed(2)}</span>
                </div>
                {order.discountTotal > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount:</span>
                    <span>-GHS {order.discountTotal.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Shipping:</span>
                  <span className="text-gray-600">Paid on Delivery</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax:</span>
                  <span>GHS {order.tax.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total:</span>
                  <span>GHS {order.total.toFixed(2)}</span>
                </div>
              </div>

              <div className="pt-4">
                <Badge 
                  variant={order.status === 'pending_payment' ? 'secondary' : 'default'} 
                  className={`text-sm ${order.status === 'processing' ? 'bg-blue-100 text-blue-800' : order.status === 'fulfilled' || order.status === 'delivered' ? 'bg-green-600 text-white' : ''}`}
                >
                  <Clock className="w-3 h-3 mr-1" />
                  Status: {order.status === 'pending_payment' ? 'Awaiting Payment' : order.status === 'processing' ? 'Processing' : order.status === 'fulfilled' || order.status === 'delivered' ? 'Delivered' : order.status}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="w-5 h-5" />
                  Shipping Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="font-medium">{order.shippingAddress.fullName}</p>
                  <p className="text-sm text-muted-foreground">
                    {order.shippingAddress.address}, {order.shippingAddress.city}
                  </p>
                  <p className="text-sm text-muted-foreground">{order.shippingAddress.region}</p>
                  <p className="text-sm text-muted-foreground">{order.shippingAddress.phone}</p>
                  <div className="pt-2">
                    <Badge variant="outline" className="text-green-700 border-green-300">
                      <Truck className="w-3 h-3 mr-1" />
                      Estimated: {estimatedDelivery}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5" />
                  Payment Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="font-medium">{order.paymentMethod || 'Pending'}</p>
                  {transactionId && (
                    <p className="text-sm text-muted-foreground">Transaction: {transactionId}</p>
                  )}
                  <p className="text-sm text-muted-foreground">Amount: GHS {order.total.toFixed(2)}</p>
                  {order.couponCode && (
                    <p className="text-sm text-muted-foreground">Coupon: {order.couponCode}</p>
                  )}
                  <div className="pt-2">
                    <Badge 
                      variant={order.paymentStatus === 'paid' ? 'default' : 'secondary'} 
                      className={order.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}
                    >
                      <Clock className="w-3 h-3 mr-1" />
                      {order.paymentStatus === 'paid' ? 'Payment Complete' : 
                       order.paymentStatus === 'pending' ? 'Payment Pending' : 
                       order.paymentStatus === 'failed' ? 'Payment Failed' :
                       `Payment ${order.paymentStatus}`}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>What's Next?</CardTitle>
              <CardDescription>Here's what you can expect</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-blue-600 text-sm font-bold">1</span>
                  </div>
                  <div>
                    <h4 className="font-semibold">Order Processing</h4>
                    <p className="text-sm text-muted-foreground">
                      Your vendor(s) will prepare your items for shipment.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-orange-600 text-sm font-bold">2</span>
                  </div>
                  <div>
                    <h4 className="font-semibold">Item Fulfillment</h4>
                    <p className="text-sm text-muted-foreground">
                      Each vendor will mark their items as fulfilled when ready.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-green-600 text-sm font-bold">3</span>
                  </div>
                  <div>
                    <h4 className="font-semibold">Delivery</h4>
                    <p className="text-sm text-muted-foreground">
                      Receive your package and enjoy your purchase!
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Button className="flex items-center justify-center gap-2" asChild>
              <Link href="/buyer/orders">
                <Eye className="w-4 h-4" />
                View Orders
              </Link>
            </Button>

            <Button variant="outline" className="flex items-center justify-center gap-2" asChild>
              <Link href="/search">
                <ShoppingCart className="w-4 h-4" />
                Continue Shopping
              </Link>
            </Button>

            <Button variant="outline" className="flex items-center justify-center gap-2" asChild>
              <Link href="/help">
                <MessageSquare className="w-4 h-4" />
                Get Help
              </Link>
            </Button>

            <Button variant="outline" className="flex items-center justify-center gap-2" asChild>
              <Link href="/">
                <Home className="w-4 h-4" />
                Home
              </Link>
            </Button>
          </div>

          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <Bell className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-blue-800">Stay Updated</h4>
                  <p className="text-sm text-blue-700 mb-3">
                    Check your orders page regularly for status updates.
                  </p>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-blue-700 border-blue-300">
                      <Package className="w-3 h-3 mr-1" />
                      Track Order
                    </Badge>
                    <Badge variant="outline" className="text-blue-700 border-blue-300">
                      <Mail className="w-3 h-3 mr-1" />
                      Email Updates
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </SiteLayout>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={
      <div className="container py-8">
        <div className="max-w-3xl mx-auto text-center">
          <Loader2 className="w-16 h-16 mx-auto mb-6 animate-spin text-primary" />
          <h1 className="text-xl sm:text-2xl font-bold mb-2">Loading...</h1>
        </div>
      </div>
    }>
      <OrderSuccessContent />
    </Suspense>
  );
}
