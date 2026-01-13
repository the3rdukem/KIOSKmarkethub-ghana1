"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SiteLayout } from "@/components/layout/site-layout";
import { useCartStore } from "@/lib/cart-store";
import { useAuthStore } from "@/lib/auth-store";
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
  X
} from "lucide-react";
import { isPaystackEnabled, openPaystackPopup, formatAmount, generatePaymentReference, fetchPaystackConfig } from "@/lib/services/paystack";
import { AddressAutocomplete } from "@/components/integrations/address-autocomplete";
import { PlaceDetails } from "@/lib/services/google-maps";
import { useAddressesStore, Address } from "@/lib/addresses-store";
import { GHANA_REGIONS, GHANA_CITIES } from "@/lib/constants/ghana-locations";

// Paystack Card Payment Component
function PaystackCardPayment({
  amount,
  email,
  orderId,
  onSuccess,
  onCancel,
  disabled,
}: {
  amount: number;
  email: string;
  orderId: string;
  onSuccess: (reference: string) => void;
  onCancel: () => void;
  disabled?: boolean;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [isConfigLoading, setIsConfigLoading] = useState(true);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLive, setIsLive] = useState(false);

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
        metadata: {
          orderId,
          custom_fields: [
            { display_name: "Order ID", variable_name: "order_id", value: orderId }
          ]
        },
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
  const { getAddressesByUser, getDefaultAddress, addAddress } = useAddressesStore();

  const [hydrated, setHydrated] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
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
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number; couponId: string; vendorId: string; eligibleSubtotal: number } | null>(null);
  const [couponError, setCouponError] = useState("");
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);


  useEffect(() => {
    setHydrated(true);
  }, []);

  // Sign in handler - redirect to login page
  const handleSignIn = () => {
    router.push('/login?redirect=/checkout');
  };

  // Sign up handler - redirect to registration page
  const handleSignUp = () => {
    router.push('/auth/register?redirect=/checkout');
  };

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

  // State for order creation
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);

  // Create order in pending_payment status (before payment)
  const createPendingOrder = async (): Promise<string | null> => {
    if (!user) {
      toast.error("Please log in to complete your order");
      return null;
    }

    if (items.length === 0) {
      toast.error("Your cart is empty");
      return null;
    }

    const shippingAddress = getShippingAddress();

    if (!shippingAddress.address || !shippingAddress.city || !shippingAddress.region) {
      toast.error("Please provide a complete shipping address");
      return null;
    }

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

    setIsCreatingOrder(true);

    try {
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

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          items: orderItems,
          shippingAddress,
          discountTotal: couponDiscount,
          shippingFee: shipping,
          tax,
          paymentMethod,
          couponCode: appliedCoupon?.code,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.validationErrors) {
          const firstError = result.validationErrors[0];
          toast.error(firstError.message);
        } else {
          toast.error(result.error || 'Failed to create order');
        }
        setIsCreatingOrder(false);
        return null;
      }

      if (appliedCoupon) {
        fetch(`/api/coupons/${appliedCoupon.couponId}/use`, {
          method: 'POST',
          credentials: 'include',
        }).catch(err => console.error('Failed to record coupon usage:', err));
      }

      setPendingOrderId(result.order.id);
      setIsCreatingOrder(false);
      return result.order.id;
    } catch (error) {
      console.error('Order creation error:', error);
      toast.error('Failed to create order. Please try again.');
      setIsCreatingOrder(false);
      return null;
    }
  };

  // Handle place order button - create order then proceed to payment
  const handlePlaceOrder = async () => {
    const orderId = await createPendingOrder();
    if (!orderId) return;
    toast.success("Order created! Please complete payment.");
  };

  // Handle successful payment callback (webhook updates payment status)
  const handlePaymentSuccess = async (transactionId: string) => {
    if (!pendingOrderId) {
      toast.error("Order ID missing. Please contact support.");
      return;
    }
    clearCart();
    setAppliedCoupon(null);
    const orderId = pendingOrderId;
    setPendingOrderId(null);
    toast.success("Payment successful! Redirecting...");
    router.push(`/order-success?orderId=${orderId}&transaction=${transactionId}`);
  };

  // Handle payment cancellation - allow retry
  const handlePaymentCancel = () => {
    toast.info("Payment cancelled. Click 'Pay with Card' to try again, or 'Pay Later' to complete payment later.");
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
      const cartItemsPayload = items.map(item => ({
        id: item.id,
        vendorId: item.vendorId,
        price: item.price,
        quantity: item.quantity,
      }));

      const response = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          code: couponCode,
          orderAmount: subtotal,
          vendorIds: vendorIds,
          cartItems: cartItemsPayload,
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
        vendorId: result.coupon.vendorId,
        eligibleSubtotal: result.eligibleSubtotal || 0,
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


  return (
    <SiteLayout>
      <div className="container max-w-6xl py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Checkout</h1>
          <p className="text-muted-foreground">Complete your purchase with Mobile Money</p>
        </div>

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
                  <CardDescription>Sign in for faster checkout</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Button onClick={handleSignIn}>
                      <User className="w-4 h-4 mr-2" />
                      Sign In
                    </Button>
                    <Button variant="outline" onClick={handleSignUp}>
                      <Mail className="w-4 h-4 mr-2" />
                      Create Account
                    </Button>
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
                            {GHANA_REGIONS.map((region) => (
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
                            {newAddress.region && GHANA_CITIES[newAddress.region]?.map((city) => (
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
                <CardTitle>Complete Your Order</CardTitle>
                <CardDescription>Review your order and proceed to checkout</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!pendingOrderId ? (
                  <>
                    <Alert className="border-blue-200 bg-blue-50">
                      <Package className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-blue-800">
                        Click below to create your order, then proceed to payment.
                      </AlertDescription>
                    </Alert>

                    <Button
                      className="w-full h-12 text-lg"
                      size="lg"
                      onClick={handlePlaceOrder}
                      disabled={!hydrated || items.length === 0 || !isLoggedIn || isCreatingOrder}
                    >
                      {isCreatingOrder ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Creating Order...
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="w-5 h-5 mr-2" />
                          Place Order - GHS {total.toFixed(2)}
                        </>
                      )}
                    </Button>

                    {!isLoggedIn && (
                      <Alert className="border-amber-200 bg-amber-50">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="text-amber-800">
                          Please log in to complete your order.
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                ) : (
                  <>
                    <Alert className="border-green-200 bg-green-50">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800">
                        Order #{pendingOrderId.slice(0, 8)} created! Complete payment below.
                      </AlertDescription>
                    </Alert>

                    <PaystackCardPayment
                      amount={total}
                      email={user?.email || ''}
                      orderId={pendingOrderId}
                      onSuccess={handlePaymentSuccess}
                      onCancel={handlePaymentCancel}
                      disabled={!hydrated}
                    />

                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => router.push(`/buyer/orders/${pendingOrderId}`)}
                    >
                      Pay Later - View Order
                    </Button>
                  </>
                )}
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
