"use client";

import { useEffect, useState } from "react";
import { useCartStore } from "@/lib/cart-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShoppingCart, Plus, Minus, Trash2, Package } from "lucide-react";
import Link from "next/link";

export function CartSheet() {
  const [hydrated, setHydrated] = useState(false);
  const {
    items,
    isOpen,
    isSynced,
    openCart,
    closeCart,
    updateQuantity,
    removeItem,
    getTotalItems,
    getTotalPrice,
    getItemsByVendor,
    syncWithServer,
  } = useCartStore();

  useEffect(() => {
    setHydrated(true);
    // Sync cart with server on mount if not already synced
    if (!isSynced) {
      syncWithServer();
    }
  }, [isSynced, syncWithServer]);

  const totalItems = hydrated ? getTotalItems() : 0;
  const totalPrice = hydrated ? getTotalPrice() : 0;
  const itemsByVendor = hydrated ? getItemsByVendor() : {};

  return (
    <Sheet open={isOpen} onOpenChange={(open) => open ? openCart() : closeCart()}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <ShoppingCart className="w-5 h-5" />
          {totalItems > 0 && (
            <Badge className="absolute -top-2 -right-2 w-5 h-5 rounded-full p-0 flex items-center justify-center text-xs">
              {totalItems}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Shopping Cart ({totalItems})</SheetTitle>
          <SheetDescription>
            Review your items before checkout
          </SheetDescription>
        </SheetHeader>

        {!hydrated || items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64">
            <Package className="w-16 h-16 text-gray-400 mb-4" />
            <p className="text-gray-500 text-center">Your cart is empty</p>
            <p className="text-sm text-gray-400 text-center mt-2">
              Add some products to get started
            </p>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <ScrollArea className="flex-1 mt-6">
              <div className="space-y-6">
                {Object.entries(itemsByVendor).map(([vendorId, vendorItems]) => (
                  <div key={vendorId} className="space-y-3">
                    {/* Vendor Header */}
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      <Package className="w-4 h-4" />
                      <span>{vendorItems[0].vendor}</span>
                    </div>

                    {/* Vendor Items */}
                    <div className="space-y-3 pl-6">
                      {vendorItems.map((item) => (
                        <div key={`${item.id}-${JSON.stringify(item.variations)}`} className="flex gap-3">
                          <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Package className="w-8 h-8 text-gray-400" />
                          </div>

                          <div className="flex-1 space-y-2">
                            <div>
                              <h4 className="font-medium text-sm line-clamp-2">{item.name}</h4>
                              {item.variations && (
                                <div className="flex gap-2 text-xs text-gray-500">
                                  {item.variations.color && (
                                    <span>Color: {item.variations.color}</span>
                                  )}
                                  {item.variations.size && (
                                    <span>Size: {item.variations.size}</span>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-sm">
                                GHS {(item.price * item.quantity).toFixed(2)}
                              </span>

                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                >
                                  <Minus className="w-3 h-3" />
                                </Button>

                                <span className="text-sm w-8 text-center">{item.quantity}</span>

                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                  disabled={item.quantity >= item.maxQuantity}
                                >
                                  <Plus className="w-3 h-3" />
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                  onClick={() => removeItem(item.id)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {Object.keys(itemsByVendor).length > 1 && (
                      <Separator className="my-4" />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Cart Footer */}
            <div className="space-y-4 mt-6 pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="font-semibold">Total</span>
                <span className="font-bold text-lg">GHS {totalPrice.toFixed(2)}</span>
              </div>

              <div className="space-y-2">
                <Link href="/checkout" onClick={closeCart}>
                  <Button className="w-full bg-green-600 hover:bg-green-700">
                    Proceed to Checkout
                  </Button>
                </Link>
                <Link href="/search" onClick={closeCart}>
                  <Button variant="outline" className="w-full">
                    Continue Shopping
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
