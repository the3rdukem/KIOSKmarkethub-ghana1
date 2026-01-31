"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Package,
  ArrowLeft,
  ArrowRight,
  Store,
  Loader2,
} from "lucide-react";
import { useCartStore } from "@/lib/cart-store";
import { useAuthStore } from "@/lib/auth-store";
import { formatCurrency } from "@/lib/utils/currency";

export default function CartPage() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const { user, isAuthenticated } = useAuthStore();
  const {
    items,
    isSynced,
    updateQuantity,
    removeItem,
    getTotalItems,
    getTotalPrice,
    getItemsByVendor,
    syncWithServer,
  } = useCartStore();

  useEffect(() => {
    setHydrated(true);
    if (!isSynced) {
      syncWithServer();
    }
  }, [isSynced, syncWithServer]);

  const totalItems = hydrated ? getTotalItems() : 0;
  const totalPrice = hydrated ? getTotalPrice() : 0;
  const itemsByVendor = hydrated ? getItemsByVendor() : {};

  if (!hydrated) {
    return (
      <SiteLayout>
        <div className="container py-8 flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-12 h-12 animate-spin text-gray-400" />
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className="container py-6 pb-24 md:pb-8">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">Shopping Cart</h1>
          {totalItems > 0 && (
            <Badge variant="secondary">{totalItems} items</Badge>
          )}
        </div>

        {items.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <ShoppingCart className="w-16 h-16 text-gray-400 mb-4" />
              <h2 className="text-xl font-semibold text-gray-700 mb-2">Your cart is empty</h2>
              <p className="text-gray-500 text-center mb-6">
                Looks like you haven't added any items to your cart yet.
              </p>
              <Link href="/search">
                <Button className="bg-green-600 hover:bg-green-700">
                  Start Shopping
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {Object.entries(itemsByVendor).map(([vendorId, vendorItems]) => (
                <Card key={vendorId}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Store className="w-4 h-4" />
                      {vendorItems[0].vendor}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {vendorItems.map((item) => (
                      <div 
                        key={`${item.id}-${JSON.stringify(item.variations)}`}
                        className="flex gap-4 p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {item.image ? (
                            <img 
                              src={item.image} 
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="w-10 h-10 text-gray-400" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <Link 
                            href={`/products/${item.id}`}
                            className="font-medium hover:text-green-600 line-clamp-2"
                          >
                            {item.name}
                          </Link>
                          {item.variations && (
                            <div className="flex gap-2 text-sm text-gray-500 mt-1">
                              {item.variations.color && (
                                <span>Color: {item.variations.color}</span>
                              )}
                              {item.variations.size && (
                                <span>Size: {item.variations.size}</span>
                              )}
                            </div>
                          )}
                          <div className="text-green-600 font-semibold mt-2">
                            {formatCurrency(item.price)}
                          </div>

                          <div className="flex items-center justify-between mt-3">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                                disabled={item.quantity <= 1}
                              >
                                <Minus className="w-3 h-3" />
                              </Button>
                              <Input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  if (!isNaN(val) && val >= 1) {
                                    updateQuantity(item.id, val);
                                  }
                                }}
                                className="w-16 h-8 text-center"
                                min={1}
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>

                            <div className="flex items-center gap-4">
                              <span className="font-semibold">
                                {formatCurrency(item.price * item.quantity)}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => removeItem(item.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="lg:col-span-1">
              <Card className="sticky top-4">
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal ({totalItems} items)</span>
                      <span>{formatCurrency(totalPrice)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Shipping</span>
                      <span className="text-gray-600">Paid on Delivery</span>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex justify-between font-semibold text-lg">
                    <span>Total</span>
                    <span>{formatCurrency(totalPrice)}</span>
                  </div>

                  <Link href="/checkout" className="block">
                    <Button className="w-full bg-green-600 hover:bg-green-700" size="lg">
                      Proceed to Checkout
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>

                  <Link href="/search" className="block">
                    <Button variant="outline" className="w-full">
                      Continue Shopping
                    </Button>
                  </Link>

                  <p className="text-xs text-gray-500 text-center">
                    Shipping costs will be calculated and paid upon delivery
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </SiteLayout>
  );
}
