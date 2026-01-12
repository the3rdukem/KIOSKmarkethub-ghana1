"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Heart,
  ShoppingCart,
  Trash2,
  Package,
  ArrowLeft,
  Loader2,
  Store
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { useWishlistStore } from "@/lib/wishlist-store";
import { useCartStore } from "@/lib/cart-store";
import { toast } from "sonner";

interface WishlistProduct {
  id: string;
  productId: string;
  addedAt: string;
  product: {
    id: string;
    name: string;
    price: number;
    comparePrice?: number;
    images: string[];
    vendorId: string;
    vendorName: string;
    quantity: number;
    trackQuantity: boolean;
  } | null;
}

export default function WishlistPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { removeFromWishlist, syncWithServer } = useWishlistStore();
  const { addItem } = useCartStore();
  const [isHydrated, setIsHydrated] = useState(false);
  const [wishlistProducts, setWishlistProducts] = useState<WishlistProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push("/auth/login");
    }
  }, [isHydrated, isAuthenticated, router]);

  const fetchWishlist = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/wishlist', { credentials: 'include' });
      const data = await res.json();
      if (data.authenticated && data.items) {
        const products: WishlistProduct[] = data.items.map((item: { id: string; productId: string; createdAt: string; productName?: string; productPrice?: number; productImage?: string | null; vendorId?: string; vendorName?: string }) => ({
          id: item.id,
          productId: item.productId,
          addedAt: item.createdAt,
          product: item.productName ? {
            id: item.productId,
            name: item.productName,
            price: item.productPrice || 0,
            images: item.productImage ? [item.productImage] : [],
            vendorId: item.vendorId || '',
            vendorName: item.vendorName || 'Unknown Vendor',
            quantity: 999,
            trackQuantity: false,
          } : null
        }));
        setWishlistProducts(products.filter(p => p.product !== null));
      }
    } catch (error) {
      console.error('Failed to fetch wishlist:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isHydrated && isAuthenticated && user) {
      fetchWishlist();
      syncWithServer(user.id);
    }
  }, [isHydrated, isAuthenticated, user]);

  if (!isHydrated || isLoading) {
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

  if (!isAuthenticated || !user) {
    return null;
  }

  const handleRemoveFromWishlist = async (productId: string, productName: string) => {
    setWishlistProducts(prev => prev.filter(item => item.productId !== productId));
    await removeFromWishlist(user.id, productId);
    toast.success(`Removed "${productName}" from wishlist`);
  };

  const handleAddToCart = (product: NonNullable<typeof wishlistProducts[0]["product"]>) => {
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.images[0] || "",
      vendor: product.vendorName,
      vendorId: product.vendorId,
      quantity: 1,
      maxQuantity: product.trackQuantity ? product.quantity : 999
    });
    toast.success(`Added "${product.name}" to cart`);
  };

  const handleMoveAllToCart = () => {
    let addedCount = 0;
    for (const item of wishlistProducts) {
      if (item.product && (!item.product.trackQuantity || item.product.quantity > 0)) {
        handleAddToCart(item.product);
        addedCount++;
      }
    }
    if (addedCount > 0) {
      toast.success(`Added ${addedCount} items to cart`);
    }
  };

  return (
    <SiteLayout>
      <div className="container py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link href="/search">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Continue Shopping
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Heart className="w-8 h-8 text-red-500 fill-current" />
                My Wishlist
              </h1>
              <p className="text-muted-foreground">
                {wishlistProducts.length} {wishlistProducts.length === 1 ? "item" : "items"} saved
              </p>
            </div>
          </div>
          {wishlistProducts.length > 0 && (
            <Button onClick={handleMoveAllToCart}>
              <ShoppingCart className="w-4 h-4 mr-2" />
              Add All to Cart
            </Button>
          )}
        </div>

        {/* Wishlist Items */}
        {wishlistProducts.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Your wishlist is empty</h2>
              <p className="text-muted-foreground mb-6">
                Save items you love by clicking the heart icon on any product
              </p>
              <Button asChild>
                <Link href="/search">
                  <Package className="w-4 h-4 mr-2" />
                  Browse Products
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {wishlistProducts.map(({ product, productId, addedAt }) => {
              if (!product) return null;
              const inStock = !product.trackQuantity || product.quantity > 0;
              const discount = product.comparePrice
                ? Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)
                : 0;

              return (
                <Card key={productId} className="group hover:shadow-lg transition-shadow">
                  <div className="relative">
                    <Link href={`/product/${product.id}`}>
                      <div className="aspect-square bg-gray-100 rounded-t-lg overflow-hidden">
                        {product.images.length > 0 ? (
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-16 h-16 text-gray-400" />
                          </div>
                        )}
                      </div>
                    </Link>
                    {discount > 0 && (
                      <Badge className="absolute top-2 left-2" variant="destructive">
                        -{discount}%
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 bg-white/80 hover:bg-white"
                      onClick={() => handleRemoveFromWishlist(product.id, product.name)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                  <CardContent className="p-4 space-y-3">
                    <Link href={`/product/${product.id}`}>
                      <h3 className="font-semibold line-clamp-2 hover:underline">{product.name}</h3>
                    </Link>

                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">GHS {product.price.toLocaleString()}</span>
                      {product.comparePrice && (
                        <span className="text-sm text-muted-foreground line-through">
                          GHS {product.comparePrice.toLocaleString()}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Store className="w-4 h-4" />
                      <Link href={`/vendor/${product.vendorId}`} className="hover:underline">
                        {product.vendorName}
                      </Link>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      Added {new Date(addedAt).toLocaleDateString()}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        disabled={!inStock}
                        onClick={() => handleAddToCart(product)}
                      >
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        {inStock ? "Add to Cart" : "Out of Stock"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </SiteLayout>
  );
}
