"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { useRecentlyViewedStore } from "@/lib/recently-viewed-store";
import { Clock, Store } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";

interface RecentlyViewedSectionProps {
  currentProductId?: string;
  limit?: number;
  title?: string;
}

export function RecentlyViewedSection({ 
  currentProductId, 
  limit = 8,
  title = "Recently Viewed"
}: RecentlyViewedSectionProps) {
  const [mounted, setMounted] = useState(false);
  const products = useRecentlyViewedStore((state) => state.products);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const filteredProducts = products
    .filter((p) => p.id !== currentProductId)
    .slice(0, limit);

  if (filteredProducts.length === 0) {
    return null;
  }

  return (
    <section className="mt-12">
      <div className="flex items-center gap-2 mb-6">
        <Clock className="w-5 h-5 text-muted-foreground" />
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {filteredProducts.map((product) => (
          <Link href={`/product/${product.id}`} key={product.id}>
            <Card className="overflow-hidden hover:shadow-lg transition-shadow h-full">
              <div className="aspect-square relative bg-gray-100">
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    No Image
                  </div>
                )}
              </div>
              <CardContent className="p-3">
                <h3 className="font-medium text-sm line-clamp-2 mb-1">
                  {product.name}
                </h3>
                <p className="text-primary font-semibold text-sm">
                  {formatCurrency(product.price)}
                </p>
                {product.vendorName && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    <Store className="w-3 h-3" />
                    <span className="truncate">{product.vendorName}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
