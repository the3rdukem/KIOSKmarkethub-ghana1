"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SiteLayout } from "@/components/layout/site-layout";
import { MobileMoneyCheckout } from "@/components/payment/mobile-money-checkout";
import { useCartStore, validateCartItems, syncCartWithProducts, CartValidationResult } from "@/lib/cart-store";
import { useProductsStore } from "@/lib/products-store";
import { useAuthStore } from "@/lib/auth-store";
import { useOrdersStore } from "@/lib/orders-store";
import { useOrderOperations } from "@/lib/order-helpers";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  ShoppingCart,
  Package,
  Truck,
  Shield,
  MapPin,
  CreditCard,
  Smartphone,
  Plus,
  Edit,
  User,
  Mail,
  Lock,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Tag,
  X,
  RefreshCw,
  Trash2,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import { isPaystackEnabled, openPaystackPopup, formatAmount, generatePaymentReference, fetchPaystackConfig } from "@/lib/services/paystack";
import { AddressAutocomplete } from "@/components/integrations/address-autocomplete";
import { PlaceDetails } from "@/lib/services/google-maps";
import { useAddressesStore, Address } from "@/lib/addresses-store";

const ghanaRegions = [
  "Greater Accra", "Ashanti Region", "Western Region", "Central Region",
  "Volta Region", "Eastern Region", "Northern Region", "Upper East Region",
  "Upper West Region", "Brong-Ahafo Region"
];

const ghanaCities = {
  "Greater Accra": ["Accra", "Tema", "Madina", "Kasoa", "Adenta", "Dansoman"],
  "Ashanti Region": ["Kumasi", "Obuasi", "Ejisu", "Mampong", "Bekwai"],
  "Western Region": ["Takoradi", "Tarkwa", "Axim", "Half Assini", "Prestea"],
  "Central Region": ["Cape Coast", "Elmina", "Winneba", "Kasoa", "Swedru"],
  "Volta Region": ["Ho", "Keta", "Hohoe", "Aflao", "Kpando"],
  "Eastern Region": ["Koforidua", "Akosombo", "Akim Oda", "Begoro", "Nkawkaw"],
  "Northern Region": ["Tamale", "Yendi", "Damongo", "Salaga", "Bimbilla"],
  "Upper East Region": ["Bolgatanga", "Navrongo", "Bawku", "Zebilla"],
  "Upper West Region": ["Wa", "Lawra", "Jirapa", "Tumu"],
  "Brong-Ahafo Region": ["Sunyani", "Techiman", "Berekum", "Dormaa Ahenkro", "Kintampo"]
};

// Paystack Card Payment Component
function PaystackCardPayment({
  amount,
  email,
  onSuccess,
  onCancel,
  disabled,
}: {
  amount: number;
  email: string;
  onSuccess: (reference: string) => void;
  onCancel: () => void;
  disabled?: boolean;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [isConfigLoading, setIsConfigLoading] = useState(true);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLive, setIsLive] = useState(false);

  // Fetch Paystack config from server on mount
  useEffect(() => {
    async function loadConfig() {
      try {
        const config = await fetchPaystackConfig();
        if (config && config.publicKey) {
          setIsEnabled(true);
          setIsLive(config.isLive);
        } else {
          setIsEnabled(false);
        }
      } catch (error) {
        console.error("Failed to load Paystack config:", error);
        setIsEnabled(false);
      } finally {
        setIsConfigLoading(false);
      }
    }
    loadConfig();
  }, []);

  const handlePaystackPayment = async () => {
    // Ensure config is loaded
    const config = await fetchPaystackConfig();
    if (!config || !config.publicKey) {
      toast.error("Payment gateway not configured. Please contact support.");
      return;
    }

    if (!email) {
      toast.error("Please provide an email address to continue");
      return;
    }

    setIsLoading(true);

    try {
      await openPaystackPopup({
        email,
        amount,
        reference: generatePaymentReference(),
        onSuccess: (response) => {
          setIsLoading(false);
          onSuccess(response.reference);
        },
        onClose: () => {
          setIsLoading(false);
          onCancel();
        },
      });
    } catch (error) {
      setIsLoading(false);
      toast.error("Payment initialization failed. Please try again.");
    }
  };

  if (isConfigLoading) {
    return (
      <Card className="border-gray-200">
        <CardContent className="p-6 text-center">
          <Loader2 className="w-8 h-8 mx-auto mb-4 text-gray-400 animate-spin" />
          <p className="text-sm text-muted-foreground">Loading payment options...</p>
        </CardContent>
      </Card>
    );
  }

  if (!isEnabled) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-6 text-center">
          <CreditCard className="w-12 h-12 mx-auto mb-4 text-amber-600" />
          <h4 className="font-semibold text-amber-800">Card Payment Unavailable</h4>
          <p className="text-sm text-amber-700 mt-2">
            Card payments are currently being configured. Please use Mobile Money for now.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-green-200 bg-green-50">
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-100 rounded-full">
              <CreditCard className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h4 className="font-semibold">Pay with Card</h4>
              <p className="text-sm text-muted-foreground">
                Visa, Mastercard, or Verve
              </p>
            </div>
            {!isLive && (
              <Badge variant="secondary" className="ml-auto">Test Mode</Badge>
            )}
          </div>

          <Alert>
            <Lock className="h-4 w-4" />
            <AlertDescription>
              Secure payment powered by Paystack. Your card details are encrypted and never stored.
            </AlertDescription>
          </Alert>

          <Button
            className="w-full"
            onClick={handlePaystackPayment}
            disabled={disabled || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4 mr-2" />
                Pay {formatAmount(amount)}
              </>
            )}
          </Button>

          <div className="flex items-center justify-center gap-4 pt-2">
            <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" alt="Visa" className="h-6 opacity-70" />
            <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" alt="Mastercard" className="h-8 opacity-70" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, getTotalPrice, clearCart } = useCartStore();
  const { user, isAuthenticated } = useAuthStore();
  const { createOrder } = useOrdersStore();
  const { processNewOrder } = useOrderOperations();
  const { getAddressesByUser, getDefaultAddress, addAddress } = useAddressesStore();
  const { products } = useProductsStore();
  const { updateItemPrice, updateItemMaxQuantity, removeUnavailableItems } = useCartStore();

  const [hydrated, setHydrated] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [useNewAddress, setUseNewAddress] = useState(false);
  const [saveNewAddress, setSaveNewAddress] = useState(true);
  const [newAddress, setNewAddress] = useState({
    name: "",
    street: "",
    city: "",
    region: "",
    phone: ""
  });
  const [paymentMethod, setPaymentMethod] = useState("mobile_money");

  // Coupon state
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number; couponId: string } | null>(null);
  const [couponError, setCouponError] = useState("");
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  // Cart validation state
  const [cartValidation, setCartValidation] = useState<CartValidationResult | null>(null);
  const [showValidationDialog, setShowValidationDialog] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  // Validate cart when items or products change
  useEffect(() => {
    if (hydrated && items.length > 0 && products.length > 0) {
      const validation = validateCartItems(items, products);
      setCartValidation(validation);

      // Show validation dialog for critical issues (out of stock, unavailable)
      if (!validation.isValid) {
        const hasCriticalIssues = validation.issues.some(
          i => i.type === 'out_of_stock' || i.type === 'product_unavailable'
        );
        if (hasCriticalIssues) {
          setShowValidationDialog(true);
        }
      }
    } else if (hydrated && items.length === 0) {
      setCartValidation(null);
    }
  }, [hydrated, items, products]);

  useEffect(() => {
    if (hydrated && isAuthenticated && user) {
      setIsLoggedIn(true);
      setNewAddress(prev => ({
        ...prev,
        name: user.name,
        phone: user.phone || ""
      }));
      // Set default address if available
      const defaultAddr = getDefaultAddress(user.id);
      if (defaultAddr) {
        setSelectedAddressId(defaultAddr.id);
        setUseNewAddress(false);
      } else {
        setUseNewAddress(true);
      }
    }
  }, [hydrated, isAuthenticated, user, getDefaultAddress]);

  // Get saved addresses for user
  const savedAddresses = hydrated && user ? getAddressesByUser(user.id) : [];

  // Get the selected address or use new address
  const getShippingAddress = () => {
    if (!useNewAddress && selectedAddressId) {
      const selectedAddr = savedAddresses.find(a => a.id === selectedAddressId);
      if (selectedAddr) {
        return {
          fullName: selectedAddr.fullName,
          phone: selectedAddr.phone,
          address: selectedAddr.street,
          city: selectedAddr.city,
          region: selectedAddr.region,
          digitalAddress: selectedAddr.digitalAddress,
        };
      }
    }
    return {
      fullName: newAddress.name || user?.name || "",
      phone: newAddress.phone || user?.phone || "",
      address: newAddress.street,
      city: newAddress.city,
      region: newAddress.region,
    };
  };

  // Handle order creation
  const handlePaymentSuccess = (transactionId: string) => {
    if (!user) {
      toast.error("Please log in to complete your order");
      return;
    }

    // Final cart validation before order creation
    if (items.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    // Re-validate cart to ensure stock is still available
    const finalValidation = validateCartItems(items, products);
    if (!finalValidation.isValid) {
      const criticalIssues = finalValidation.issues.filter(
        i => i.type === 'out_of_stock' || i.type === 'product_unavailable'
      );
      if (criticalIssues.length > 0) {
        setCartValidation(finalValidation);
        setShowValidationDialog(true);
        toast.error("Some items in your cart are no longer available. Please review and update your cart.");
        return;
      }
      // For price changes and stock adjustments, sync and continue
      syncCartWithProducts(items, products, updateItemPrice, updateItemMaxQuantity, removeUnavailableItems);
    }

    const shippingAddress = getShippingAddress();

    // Validate address
    if (!shippingAddress.address || !shippingAddress.city || !shippingAddress.region) {
      toast.error("Please provide a complete shipping address");
      return;
    }

    // Save new address if requested
    if (useNewAddress && saveNewAddress && newAddress.street) {
      addAddress({
        userId: user.id,
        label: "home",
        fullName: newAddress.name || user.name,
        phone: newAddress.phone || user.phone || "",
        street: newAddress.street,
        city: newAddress.city,
        region: newAddress.region,
        isDefault: savedAddresses.length === 0,
      });
    }

    // Create the order
    const orderItems = items.map(item => ({
      productId: item.id,
      productName: item.name,
      vendorId: item.vendorId,
      vendorName: item.vendor,
      quantity: item.quantity,
      price: item.price,
      image: item.image,
      variations: item.variations
    }));

    const order = createOrder({
      buyerId: user.id,
      buyerName: user.name,
      buyerEmail: user.email,
      items: orderItems,
      subtotal: subtotal,
      shippingFee: shipping,
      tax: tax,
      total: total,
      status: "pending",
      paymentStatus: "paid",
      paymentMethod: paymentMethod,
      shippingAddress: shippingAddress,
    });

    console.log("Order created:", order);

    // Increment coupon usage on server if coupon was applied
    if (appliedCoupon) {
      fetch(`/api/coupons/${appliedCoupon.couponId}/use`, {
        method: 'POST',
        credentials: 'include',
      }).catch(err => console.error('Failed to record coupon usage:', err));
    }

    // Send notifications to vendors
    processNewOrder(order);

    // Clear cart and reset coupon
    clearCart();
    setAppliedCoupon(null);

    // Show success message
    toast.success("Order placed successfully!");

    // Redirect to success page
    router.push(`/order-success?orderId=${order.id}&transaction=${transactionId}`);
  };

  const subtotal = hydrated ? getTotalPrice() : 0;
  const couponDiscount = appliedCoupon?.discount || 0;
  const shipping = subtotal > 500 ? 0 : 25.00;
  const tax = (subtotal - couponDiscount) * 0.025; // 2.5% tax after discount
  const total = subtotal - couponDiscount + shipping + tax;

  // Get unique vendor IDs from cart
  const vendorIds = [...new Set(items.map(item => item.vendorId))];

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError("Please enter a coupon code");
      return;
    }

    if (items.length === 0) {
      setCouponError("No items in cart");
      return;
    }

    setCouponError("");
    setIsValidatingCoupon(true);

    try {
      const response = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          code: couponCode,
          orderAmount: subtotal,
          vendorIds: vendorIds,
        }),
      });

      const result = await response.json();

      if (!result.valid) {
        setCouponError(result.error || "Invalid coupon");
        return;
      }

      setAppliedCoupon({
        code: result.coupon.code,
        discount: result.discount,
        couponId: result.coupon.id,
      });
      setCouponCode("");
      toast.success(`Coupon applied! You save GHS ${result.discount.toFixed(2)}`);
    } catch (error) {
      console.error('Coupon validation error:', error);
      setCouponError("Failed to validate coupon. Please try again.");
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    toast.info("Coupon removed");
  };

  // Check if cart has validation issues that need user attention
  const hasCartIssues = cartValidation && !cartValidation.isValid && cartValidation.issues.length > 0;
  const priceChangeIssues = cartValidation?.issues.filter(i => i.type === 'price_changed') || [];
  const stockIssues = cartValidation?.issues.filter(i => i.type === 'out_of_stock' || i.type === 'insufficient_stock') || [];
  const unavailableIssues = cartValidation?.issues.filter(i => i.type === 'product_unavailable') || [];

  const handleResolveIssues = () => {
    // Re-sync cart with products to fix issues
    syncCartWithProducts(
      items,
      products,
      updateItemPrice,
      updateItemMaxQuantity,
      removeUnavailableItems
    );
    setShowValidationDialog(false);
    toast.success("Cart updated with latest product information");
  };

  return (
    <SiteLayout>
      <div className="container max-w-6xl py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Checkout</h1>
          <p className="text-muted-foreground">Complete your purchase with Mobile Money</p>
        </div>

        {/* Cart Validation Alert */}
        {hasCartIssues && (
          <Alert className="mb-6 border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="flex items-center justify-between">
              <div className="text-amber-800">
                <span className="font-medium">Some items in your cart need attention.</span>
                <span className="ml-1">
                  {priceChangeIssues.length > 0 && `${priceChangeIssues.length} price change(s)`}
                  {priceChangeIssues.length > 0 && (stockIssues.length > 0 || unavailableIssues.length > 0) && ", "}
                  {stockIssues.length > 0 && `${stockIssues.length} stock issue(s)`}
                  {stockIssues.length > 0 && unavailableIssues.length > 0 && ", "}
                  {unavailableIssues.length > 0 && `${unavailableIssues.length} unavailable item(s)`}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-amber-300 text-amber-700 hover:bg-amber-100"
                onClick={() => setShowValidationDialog(true)}
              >
                Review Issues
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Cart Validation Dialog */}
        <Dialog open={showValidationDialog} onOpenChange={setShowValidationDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Cart Updates Required
              </DialogTitle>
              <DialogDescription>
                The following items in your cart have changed since you added them
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[400px] overflow-y-auto space-y-3">
              {/* Price Changes */}
              {priceChangeIssues.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-500" />
                    Price Changes
                  </h4>
                  {priceChangeIssues.map((issue, idx) => (
                    <div key={idx} className="p-3 bg-blue-50 rounded-lg text-sm">
                      <p className="font-medium">{issue.itemName}</p>
                      <p className="text-muted-foreground flex items-center gap-2 mt-1">
                        <span className="line-through">GHS {issue.oldValue?.toLocaleString()}</span>
                        <span>→</span>
                        <span className={issue.newValue && issue.oldValue && issue.newValue < issue.oldValue ? "text-green-600" : "text-red-600"}>
                          GHS {issue.newValue?.toLocaleString()}
                        </span>
                        {issue.newValue && issue.oldValue && issue.newValue < issue.oldValue ? (
                          <Badge className="bg-green-100 text-green-700 text-xs">Price Dropped!</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Price Increased</Badge>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Stock Issues */}
              {stockIssues.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Package className="w-4 h-4 text-orange-500" />
                    Stock Issues
                  </h4>
                  {stockIssues.map((issue, idx) => (
                    <div key={idx} className="p-3 bg-orange-50 rounded-lg text-sm">
                      <p className="font-medium">{issue.itemName}</p>
                      <p className="text-orange-700">{issue.message}</p>
                      {issue.type === 'insufficient_stock' && issue.newValue && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Quantity will be adjusted to {issue.newValue}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Unavailable Items */}
              {unavailableIssues.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Trash2 className="w-4 h-4 text-red-500" />
                    Unavailable Items
                  </h4>
                  {unavailableIssues.map((issue, idx) => (
                    <div key={idx} className="p-3 bg-red-50 rounded-lg text-sm">
                      <p className="font-medium">{issue.itemName}</p>
                      <p className="text-red-700">{issue.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        This item will be removed from your cart
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={() => setShowValidationDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleResolveIssues}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Update Cart
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Checkout Steps */}
          <div className="space-y-6">
            {/* User Authentication */}
            {!isLoggedIn && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Sign in or Create Account
                  </CardTitle>
                  <CardDescription>Sign in for faster checkout or continue as guest</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Button onClick={() => setIsLoggedIn(true)}>
                      <User className="w-4 h-4 mr-2" />
                      Sign In
                    </Button>
                    <Button variant="outline" onClick={() => setShowRegistration(true)}>
                      <Mail className="w-4 h-4 mr-2" />
                      Quick Sign Up
                    </Button>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">Or continue as guest</span>
                    </div>
                  </div>

                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Creating an account allows you to track orders and save addresses for future purchases.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            )}

            {/* Quick Registration Dialog */}
            <Dialog open={showRegistration} onOpenChange={setShowRegistration}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Quick Account Creation</DialogTitle>
                  <DialogDescription>
                    Create an account to save your information for future orders
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Button className="w-full" onClick={() => setShowRegistration(false)}>
                    <Mail className="w-4 h-4 mr-2" />
                    Continue with Gmail
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">Or</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">First Name</Label>
                      <Input id="firstName" />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input id="lastName" />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" />
                  </div>

                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" />
                  </div>

                  <Button className="w-full" onClick={() => {
                    setIsLoggedIn(true);
                    setShowRegistration(false);
                  }}>
                    Create Account & Continue
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Shipping Address */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Shipping Address
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoggedIn && savedAddresses.length > 0 && (
                  <div className="space-y-3">
                    <Label>Select saved address</Label>
                    <RadioGroup
                      value={useNewAddress ? "new" : selectedAddressId}
                      onValueChange={(value) => {
                        if (value === "new") {
                          setUseNewAddress(true);
                          setSelectedAddressId("");
                        } else {
                          setUseNewAddress(false);
                          setSelectedAddressId(value);
                        }
                      }}
                    >
                      {savedAddresses.map((address) => (
                        <div key={address.id} className="flex items-center space-x-2">
                          <RadioGroupItem value={address.id} id={address.id} />
                          <Label htmlFor={address.id} className="flex-1">
                            <div className={`border rounded-lg p-3 cursor-pointer hover:bg-accent ${selectedAddressId === address.id && !useNewAddress ? 'border-green-500 bg-green-50' : ''}`}>
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-medium">{address.fullName}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {address.street}, {address.city}, {address.region}
                                  </p>
                                  <p className="text-sm text-muted-foreground">{address.phone}</p>
                                </div>
                                {address.isDefault && (
                                  <Badge variant="outline" className="text-xs">Default</Badge>
                                )}
                              </div>
                            </div>
                          </Label>
                        </div>
                      ))}
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="new" id="new-address" />
                        <Label htmlFor="new-address" className="cursor-pointer">
                          <span className="font-medium">Use a new address</span>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}

                {(useNewAddress || savedAddresses.length === 0) && (
                  <div className="space-y-4">
                    {savedAddresses.length > 0 && (
                      <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-background px-2 text-muted-foreground">New Address Details</span>
                        </div>
                      </div>
                    )}

                    <div>
                      <Label htmlFor="fullName">Full Name</Label>
                      <Input
                        id="fullName"
                        value={newAddress.name}
                        onChange={(e) => setNewAddress({...newAddress, name: e.target.value})}
                        placeholder="John Kwame Asante"
                      />
                    </div>

                    <div>
                      <AddressAutocomplete
                        label="Street Address"
                        placeholder="Start typing your address..."
                        value={newAddress.street}
                        onValueChange={(value) => setNewAddress({...newAddress, street: value})}
                        onAddressSelect={(details: PlaceDetails) => {
                          setNewAddress(prev => ({
                            ...prev,
                            street: details.formattedAddress,
                            city: details.city || prev.city,
                            region: details.region || prev.region,
                          }));
                        }}
                        showCurrentLocation={true}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="region">Region</Label>
                        <Select
                          value={newAddress.region}
                          onValueChange={(value) => setNewAddress({...newAddress, region: value, city: ""})}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select region" />
                          </SelectTrigger>
                          <SelectContent>
                            {ghanaRegions.map((region) => (
                              <SelectItem key={region} value={region}>{region}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="city">City</Label>
                        <Select
                          value={newAddress.city}
                          onValueChange={(value) => setNewAddress({...newAddress, city: value})}
                          disabled={!newAddress.region}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select city" />
                          </SelectTrigger>
                          <SelectContent>
                            {newAddress.region && ghanaCities[newAddress.region as keyof typeof ghanaCities]?.map((city) => (
                              <SelectItem key={city} value={city}>{city}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        value={newAddress.phone}
                        onChange={(e) => setNewAddress({...newAddress, phone: e.target.value})}
                        placeholder="+233 24 123 4567"
                      />
                    </div>

                    {isLoggedIn && (
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="saveAddress"
                          checked={saveNewAddress}
                          onCheckedChange={(checked) => setSaveNewAddress(checked as boolean)}
                        />
                        <Label htmlFor="saveAddress" className="text-sm">
                          Save this address to my account
                        </Label>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Order Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  Order Summary
                </CardTitle>
                <CardDescription>Review your items</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!hydrated || items.length === 0 ? (
                  <div className="text-center py-6">
                    <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-muted-foreground">Your cart is empty</p>
                  </div>
                ) : (
                  <>
                    {items.map((item) => (
                      <div key={`${item.id}-${JSON.stringify(item.variations)}`} className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                          <Package className="w-8 h-8 text-gray-400" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium">{item.name}</h3>
                          <p className="text-sm text-muted-foreground">by {item.vendor}</p>
                          {item.variations && (
                            <div className="flex gap-2 text-xs text-muted-foreground">
                              {item.variations.color && <span>Color: {item.variations.color}</span>}
                              {item.variations.size && <span>Size: {item.variations.size}</span>}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              <Shield className="w-3 h-3 mr-1" />
                              Verified Vendor
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">GHS {(item.price * item.quantity).toFixed(2)}</p>
                          <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                        </div>
                      </div>
                    ))}

                    <Separator />

                    {/* Coupon Code Section */}
                    <div className="space-y-3">
                      <Label className="flex items-center gap-2">
                        <Tag className="w-4 h-4" />
                        Coupon Code
                      </Label>
                      {appliedCoupon ? (
                        <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="font-medium text-green-800">{appliedCoupon.code}</span>
                            <span className="text-green-600">-GHS {appliedCoupon.discount.toFixed(2)}</span>
                          </div>
                          <Button variant="ghost" size="sm" onClick={handleRemoveCoupon}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Input
                            placeholder="Enter coupon code"
                            value={couponCode}
                            onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(""); }}
                            className={couponError ? "border-red-500" : ""}
                          />
                          <Button variant="outline" onClick={handleApplyCoupon}>Apply</Button>
                        </div>
                      )}
                      {couponError && <p className="text-sm text-red-500">{couponError}</p>}
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>GHS {subtotal.toFixed(2)}</span>
                      </div>
                      {appliedCoupon && (
                        <div className="flex justify-between text-green-600">
                          <span>Coupon Discount:</span>
                          <span>-GHS {couponDiscount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Shipping:</span>
                        <span className={shipping === 0 ? "text-green-600" : ""}>
                          {shipping === 0 ? "FREE" : `GHS ${shipping.toFixed(2)}`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tax (2.5%):</span>
                        <span>GHS {tax.toFixed(2)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-semibold text-lg">
                        <span>Total:</span>
                        <span>GHS {total.toFixed(2)}</span>
                      </div>
                    </div>

                    {shipping === 0 && (
                      <Alert className="border-green-200 bg-green-50">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-800">
                          🎉 You qualify for free shipping!
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Payment */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Payment Method</CardTitle>
                <CardDescription>Choose how you'd like to pay</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={paymentMethod} onValueChange={setPaymentMethod}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="mobile_money" className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4" />
                      Mobile Money
                    </TabsTrigger>
                    <TabsTrigger value="card" className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      Credit Card
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="mobile_money" className="mt-6">
                    <MobileMoneyCheckout
                      amount={total}
                      currency="GHS"
                      vendorName={!hydrated ? "MarketHub" : items.length > 1 ? "Multiple Vendors" : items[0]?.vendor || "MarketHub"}
                      orderId={`ORD-${Date.now()}`}
                      email={user?.email || "customer@markethub.gh"}
                      onSuccess={(transactionId) => {
                        console.log("Payment successful:", transactionId);
                        handlePaymentSuccess(transactionId);
                      }}
                      onError={(error) => {
                        console.error("Payment failed:", error);
                        toast.error(error);
                      }}
                    />
                  </TabsContent>

                  <TabsContent value="card" className="mt-6">
                    <PaystackCardPayment
                      amount={total}
                      email={user?.email || "customer@markethub.gh"}
                      onSuccess={(reference) => {
                        console.log("Paystack payment successful:", reference);
                        handlePaymentSuccess(reference);
                      }}
                      onCancel={() => {
                        toast.info("Payment cancelled");
                      }}
                      disabled={!hydrated || items.length === 0}
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Security Features */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Your Protection
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Escrow payment protection</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Verified vendor guarantee</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Secure payment processing</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Order tracking & support</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Trust Indicators */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 p-6 bg-gray-50 rounded-lg">
          <div className="text-center">
            <Shield className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <h3 className="font-semibold mb-1">Secure Payments</h3>
            <p className="text-sm text-muted-foreground">
              All transactions protected by advanced encryption and escrow system
            </p>
          </div>
          <div className="text-center">
            <Package className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <h3 className="font-semibold mb-1">Verified Vendors</h3>
            <p className="text-sm text-muted-foreground">
              Every seller verified with ID and facial recognition technology
            </p>
          </div>
          <div className="text-center">
            <Truck className="w-8 h-8 text-orange-600 mx-auto mb-2" />
            <h3 className="font-semibold mb-1">Fast Delivery</h3>
            <p className="text-sm text-muted-foreground">
              Quick delivery with real-time tracking and updates
            </p>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
