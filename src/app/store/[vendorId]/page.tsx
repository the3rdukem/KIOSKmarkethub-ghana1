"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Store,
  Star,
  Package,
  ShoppingBag,
  Share2,
  Copy,
  MessageSquare,
  Facebook,
  Twitter,
  Mail,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistance } from "date-fns";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  categoryId: string;
  quantity: number;
  status: string;
}

interface StoreData {
  id: string;
  name: string;
  description: string | null;
  logo: string | null;
  businessType: string;
  joinedAt: string;
  stats: {
    productCount: number;
    averageRating: number;
    reviewCount: number;
    totalSales: number;
  };
}

export default function VendorStorePage() {
  const params = useParams();
  const vendorId = params.vendorId as string;

  const [store, setStore] = useState<StoreData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (vendorId) {
      fetchStore();
    }
  }, [vendorId]);

  const fetchStore = async () => {
    try {
      const response = await fetch(`/api/store/${vendorId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('Store not found');
        } else {
          setError('Failed to load store');
        }
        return;
      }

      const data = await response.json();
      setStore(data.store);
      setProducts(data.products);
    } catch (err) {
      console.error('Error fetching store:', err);
      setError('Failed to load store');
    } finally {
      setLoading(false);
    }
  };

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

  const handleNativeShare = async () => {
    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
    const shareText = store ? `Check out ${store.name} on KIOSK!` : 'Check out this store on KIOSK!';
    const shareData = {
      title: store?.name || 'KIOSK Store',
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
    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied to clipboard!");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  if (loading) {
    return (
      <SiteLayout>
        <div className="container py-12 flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-12 h-12 animate-spin text-gray-400" />
        </div>
      </SiteLayout>
    );
  }

  if (error || !store) {
    return (
      <SiteLayout>
        <div className="container py-12 text-center">
          <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Store Not Found</h1>
          <p className="text-muted-foreground mb-4">{error || 'This store does not exist or is not available.'}</p>
          <Button asChild>
            <Link href="/search">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Browse Products
            </Link>
          </Button>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className="container py-8">
        <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
          <Link href="/search">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Search
          </Link>
        </Button>

        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-shrink-0">
                {store.logo ? (
                  <Image
                    src={store.logo}
                    alt={store.name}
                    width={120}
                    height={120}
                    className="w-24 h-24 md:w-32 md:h-32 rounded-xl object-cover"
                  />
                ) : (
                  <div className="w-24 h-24 md:w-32 md:h-32 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center">
                    <Store className="w-12 h-12 text-primary/60" />
                  </div>
                )}
              </div>

              <div className="flex-1">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold mb-2">{store.name}</h1>
                    {store.description && (
                      <p className="text-muted-foreground mb-3">{store.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <Badge variant="secondary">{store.businessType}</Badge>
                      <Badge variant="outline" className="text-muted-foreground">
                        <Calendar className="w-3 h-3 mr-1" />
                        Joined {formatDistance(new Date(store.joinedAt), new Date(), { addSuffix: true })}
                      </Badge>
                    </div>
                  </div>

                  {canNativeShare ? (
                    <Button variant="outline" size="sm" onClick={handleNativeShare}>
                      <Share2 className="w-4 h-4 mr-2" />
                      Share
                    </Button>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Share2 className="w-4 h-4 mr-2" />
                          Share
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={handleCopyLink}>
                          <Copy className="w-4 h-4 mr-2" />
                          Copy Link
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
                            window.open(
                              `https://wa.me/?text=${encodeURIComponent(`Check out ${store.name} on KIOSK! ${shareUrl}`)}`,
                              '_blank'
                            );
                          }}
                        >
                          <MessageSquare className="w-4 h-4 mr-2" />
                          Share on WhatsApp
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
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
                            const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
                            window.open(
                              `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(`Check out ${store.name} on KIOSK!`)}`,
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
                            const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
                            window.location.href = `mailto:?subject=${encodeURIComponent(`Check out ${store.name} on KIOSK!`)}&body=${encodeURIComponent(`I found this great store on KIOSK: ${shareUrl}`)}`;
                          }}
                        >
                          <Mail className="w-4 h-4 mr-2" />
                          Share via Email
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <Package className="w-5 h-5 mx-auto mb-1 text-primary" />
                    <p className="text-lg font-semibold">{store.stats.productCount}</p>
                    <p className="text-xs text-muted-foreground">Products</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <Star className="w-5 h-5 mx-auto mb-1 text-yellow-500" />
                    <p className="text-lg font-semibold">{store.stats.averageRating.toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">{store.stats.reviewCount} reviews</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <ShoppingBag className="w-5 h-5 mx-auto mb-1 text-green-500" />
                    <p className="text-lg font-semibold">{store.stats.totalSales}</p>
                    <p className="text-xs text-muted-foreground">Sales</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <Store className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                    <p className="text-lg font-semibold">Verified</p>
                    <p className="text-xs text-muted-foreground">Seller</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">Products ({products.length})</h2>
          
          {products.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Products Yet</h3>
                <p className="text-muted-foreground">This store hasn't listed any products yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {products.map((product) => (
                <Link key={product.id} href={`/product/${product.id}`}>
                  <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer h-full">
                    <div className="aspect-square relative bg-gray-100">
                      {product.images && product.images.length > 0 && !failedImages[product.id] ? (
                        <Image
                          src={product.images[0]}
                          alt={product.name}
                          fill
                          className="object-cover"
                          onError={() => setFailedImages(prev => ({ ...prev, [product.id]: true }))}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-12 h-12 text-gray-300" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-3">
                      <h3 className="font-medium text-sm line-clamp-2 mb-1">{product.name}</h3>
                      <p className="text-primary font-semibold">GHS {product.price.toLocaleString()}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </SiteLayout>
  );
}
