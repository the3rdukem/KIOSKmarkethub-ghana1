"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Zap,
  TrendingUp,
  Clock,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ShoppingCart,
  Flame
} from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { useCartStore } from "@/lib/cart-store";
import { toast } from "sonner";

interface FlashSaleProduct {
  id: string;
  name: string;
  original_price: number;
  sale_price: number;
  discount_type: string;
  discount_value: number;
  sale_ends_at: string;
  images: string[];
}

interface TrendingProduct {
  id: string;
  name: string;
  price: number;
  images: string[];
  score: number;
}

export function PromotionalSection() {
  const [activeTab, setActiveTab] = useState("flash-sale");
  const [flashSaleProducts, setFlashSaleProducts] = useState<FlashSaleProduct[]>([]);
  const [trendingProducts, setTrendingProducts] = useState<TrendingProduct[]>([]);
  const [bestSellers, setBestSellers] = useState<TrendingProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [countdown, setCountdown] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { addItem } = useCartStore();

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (flashSaleProducts.length === 0) return;
    
    const endDate = flashSaleProducts[0]?.sale_ends_at;
    if (!endDate) return;
    
    const updateCountdown = () => {
      const now = new Date().getTime();
      const end = new Date(endDate).getTime();
      const diff = end - now;
      
      if (diff <= 0) {
        setCountdown("Sale ended");
        return;
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setCountdown(`${hours}h ${minutes}m ${seconds}s`);
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [flashSaleProducts]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [flashRes, trendingRes, bestRes] = await Promise.all([
        fetch('/api/flash-sales/active'),
        fetch('/api/products/trending?type=trending&limit=10'),
        fetch('/api/products/trending?type=bestselling&limit=10'),
      ]);
      
      if (flashRes.ok) {
        const data = await flashRes.json();
        setFlashSaleProducts(data.products || []);
      }
      
      if (trendingRes.ok) {
        const data = await trendingRes.json();
        setTrendingProducts(data.products || []);
      }
      
      if (bestRes.ok) {
        const data = await bestRes.json();
        setBestSellers(data.products || []);
      }
    } catch (error) {
      console.error('Error fetching promotional data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const handleAddToCart = async (product: FlashSaleProduct | TrendingProduct, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const price = 'sale_price' in product ? product.sale_price : product.price;
    
    addItem({
      id: product.id,
      name: product.name,
      price: price,
      quantity: 1,
      image: product.images?.[0] || '',
      vendorId: '',
      vendor: '',
      maxQuantity: 99,
    });
    
    toast.success('Added to cart');
  };

  const hasContent = flashSaleProducts.length > 0 || trendingProducts.length > 0 || bestSellers.length > 0;
  
  if (!hasContent && !isLoading) {
    return null;
  }

  const renderProductCard = (product: FlashSaleProduct | TrendingProduct, isFlashSale: boolean = false) => {
    const price = isFlashSale ? (product as FlashSaleProduct).sale_price : (product as TrendingProduct).price;
    const originalPrice = isFlashSale ? (product as FlashSaleProduct).original_price : null;
    const discountValue = isFlashSale ? (product as FlashSaleProduct).discount_value : null;
    const discountType = isFlashSale ? (product as FlashSaleProduct).discount_type : null;
    
    return (
      <Link
        key={product.id}
        href={`/product/${product.id}`}
        className="flex-shrink-0 w-48 group"
      >
        <Card className="overflow-hidden h-full hover:shadow-lg transition-shadow">
          <div className="relative aspect-square bg-gray-100">
            {product.images?.[0] ? (
              <img
                src={product.images[0]}
                alt={product.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                No image
              </div>
            )}
            
            {isFlashSale && discountValue && (
              <Badge className="absolute top-2 left-2 bg-red-500 text-white">
                {discountType === 'percentage' ? `-${discountValue}%` : `-${formatCurrency(discountValue)}`}
              </Badge>
            )}
            
            <Button
              size="icon"
              variant="secondary"
              className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => handleAddToCart(product, e)}
            >
              <ShoppingCart className="w-4 h-4" />
            </Button>
          </div>
          
          <CardContent className="p-3">
            <h3 className="font-medium text-sm line-clamp-2 mb-2">{product.name}</h3>
            <div className="flex items-center gap-2">
              <span className="font-bold text-green-600">{formatCurrency(price)}</span>
              {originalPrice && (
                <span className="text-sm text-muted-foreground line-through">
                  {formatCurrency(originalPrice)}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  };

  return (
    <div className="mb-6 bg-gradient-to-r from-orange-50 via-yellow-50 to-red-50 rounded-xl p-4 border border-orange-100">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between mb-4">
          <TabsList className="bg-white/80">
            {flashSaleProducts.length > 0 && (
              <TabsTrigger value="flash-sale" className="gap-2">
                <Zap className="w-4 h-4 text-yellow-500" />
                Flash Sale
              </TabsTrigger>
            )}
            {trendingProducts.length > 0 && (
              <TabsTrigger value="trending" className="gap-2">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                Trending
              </TabsTrigger>
            )}
            {bestSellers.length > 0 && (
              <TabsTrigger value="bestsellers" className="gap-2">
                <Flame className="w-4 h-4 text-orange-500" />
                Best Sellers
              </TabsTrigger>
            )}
          </TabsList>
          
          {activeTab === 'flash-sale' && countdown && (
            <div className="flex items-center gap-2 text-sm font-medium">
              <Clock className="w-4 h-4 text-red-500" />
              <span className="text-red-600">Ends in: {countdown}</span>
            </div>
          )}
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => scroll('left')}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => scroll('right')}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <>
            <TabsContent value="flash-sale" className="mt-0">
              <div
                ref={scrollRef}
                className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {flashSaleProducts.map((product) => renderProductCard(product, true))}
                {flashSaleProducts.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground w-full">
                    No flash sales active right now
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="trending" className="mt-0">
              <div
                ref={scrollRef}
                className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {trendingProducts.map((product) => renderProductCard(product, false))}
                {trendingProducts.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground w-full">
                    No trending products yet
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="bestsellers" className="mt-0">
              <div
                ref={scrollRef}
                className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {bestSellers.map((product) => renderProductCard(product, false))}
                {bestSellers.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground w-full">
                    No best sellers yet
                  </div>
                )}
              </div>
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
