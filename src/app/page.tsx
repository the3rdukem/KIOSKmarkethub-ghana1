"use client";

import { useState, useEffect } from "react";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, TrendingUp, Users, ShoppingBag, Search, Package, CheckCircle } from "lucide-react";
import AdvancedSearch from "@/components/search/advanced-search";
import Link from "next/link";
import { Product } from "@/lib/products-store";
import { useUsersStore } from "@/lib/users-store";
import { useOrdersStore } from "@/lib/orders-store";
import { PromotionalBannerDisplay } from "@/components/banners/promotional-banner";

const categories = [
  { name: "Electronics", icon: "📱", href: "/search?category=Electronics" },
  { name: "Fashion", icon: "👕", href: "/search?category=Fashion%20%26%20Clothing" },
  { name: "Home & Garden", icon: "🏠", href: "/search?category=Home%20%26%20Garden" },
  { name: "Sports", icon: "⚽", href: "/search?category=Sports%20%26%20Outdoors" },
  { name: "Books", icon: "📚", href: "/search?category=Books%20%26%20Media" },
  { name: "Automotive", icon: "🚗", href: "/search?category=Automotive" },
];

const trendingSearches = ["iPhone", "MacBook", "Kente", "Cocoa", "Smartphones"];

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const { users, getPlatformMetrics } = useUsersStore();
  const { orders } = useOrdersStore();

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch('/api/products?status=active', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setProducts(data.products || []);
        }
      } catch (error) {
        console.error('Failed to fetch products:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // Get real active products (only after data loads)
  const activeProducts = products.filter(p => p.status === 'active');
  const featuredProducts = activeProducts.slice(0, 4);

  // Get real metrics (only after data loads)
  const metrics = !isLoading ? getPlatformMetrics() : { totalVendors: 0 };
  const totalProducts = !isLoading ? products.length : 0;
  const totalVendors = !isLoading ? (metrics.totalVendors || users.filter(u => u.role === "vendor").length) : 0;
  const totalOrders = !isLoading ? orders.length : 0;

  // Get product counts by category (only after data loads)
  const getCategoryCount = (categoryName: string) => {
    if (isLoading) return "Browse";
    const count = products.filter(p =>
      p.category && p.category.toLowerCase().includes(categoryName.toLowerCase())
    ).length;
    return count > 0 ? `${count} products` : "Browse";
  };

  return (
    <SiteLayout>
      {/* Promotional Banner */}
      <PromotionalBannerDisplay position="top" />

      {/* Hero Section with Advanced Search */}
      <section className="bg-gradient-to-br from-blue-50 via-green-50 to-blue-50 py-16 lg:py-24">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 mb-6">
                Shop with <span className="text-green-600">Confidence</span>
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Ghana's most secure marketplace with verified vendors, Mobile Money payments, and buyer protection.
              </p>

              {/* Advanced Search Bar */}
              <div className="mb-8">
                <AdvancedSearch
                  size="lg"
                  placeholder="Search for products, vendors, or categories..."
                  className="w-full"
                  autoFocus={false}
                />

                {/* Trending Searches */}
                <div className="flex items-center gap-3 mt-4">
                  <span className="text-sm text-gray-500">Trending:</span>
                  <div className="flex flex-wrap gap-2">
                    {trendingSearches.map((search, index) => (
                      <Link key={index} href={`/search?q=${encodeURIComponent(search)}`}>
                        <Badge
                          variant="secondary"
                          className="cursor-pointer hover:bg-secondary/80 transition-colors"
                        >
                          {search}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" className="bg-green-600 hover:bg-green-700" asChild>
                  <Link href="/search">
                    <Search className="w-5 h-5 mr-2" />
                    Browse All Products
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/auth/register">
                    Become a Vendor
                  </Link>
                </Button>
              </div>

              <div className="flex items-center gap-6 mt-8 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-green-600" />
                  <span>All vendors verified</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span>{totalVendors > 0 ? `${totalVendors}+ active vendors` : "Join our vendors"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>Buyer protection</span>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="aspect-square bg-gradient-to-br from-green-100 to-blue-100 rounded-2xl flex items-center justify-center">
                <ShoppingBag className="w-32 h-32 text-green-600" />
              </div>
              <div className="absolute -top-4 -right-4 bg-white rounded-lg shadow-lg p-3">
                <div className="flex items-center gap-2 text-sm">
                  <Shield className="w-4 h-4 text-green-600" />
                  <span className="font-semibold">Verified Secure</span>
                </div>
              </div>
              <div className="absolute -bottom-4 -left-4 bg-white rounded-lg shadow-lg p-3">
                <div className="flex items-center gap-2 text-sm">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold">Mobile Money</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Stats */}
      <section className="py-16 bg-white">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="text-center">
              <CardContent className="p-6">
                <Package className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <h3 className="text-2xl font-bold mb-2">{totalProducts > 0 ? totalProducts.toLocaleString() : "0"}</h3>
                <p className="text-muted-foreground">{totalProducts > 0 ? "Products Available" : "Add Your Products"}</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="p-6">
                <Shield className="w-12 h-12 text-green-600 mx-auto mb-4" />
                <h3 className="text-2xl font-bold mb-2">100%</h3>
                <p className="text-muted-foreground">Verified Vendors</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="p-6">
                <Users className="w-12 h-12 text-purple-600 mx-auto mb-4" />
                <h3 className="text-2xl font-bold mb-2">{totalVendors > 0 ? totalVendors.toLocaleString() : "0"}</h3>
                <p className="text-muted-foreground">{totalVendors > 0 ? "Active Sellers" : "Be the First Seller"}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 bg-gray-50">
        <div className="container">
          <div className="flex justify-between items-center mb-12">
            <div>
              <h2 className="text-3xl font-bold mb-2">Shop by Category</h2>
              <p className="text-muted-foreground">Discover products in your favorite categories</p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/search">View All Categories</Link>
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {categories.map((category, index) => (
              <Link key={index} href={category.href}>
                <Card className="cursor-pointer hover:shadow-lg transition-all duration-300 text-center group hover:scale-105">
                  <CardContent className="p-6">
                    <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">
                      {category.icon}
                    </div>
                    <h3 className="font-semibold mb-1">{category.name}</h3>
                    <p className="text-sm text-muted-foreground">{getCategoryCount(category.name)}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-16 bg-white">
        <div className="container">
          <div className="flex justify-between items-center mb-12">
            <div>
              <h2 className="text-3xl font-bold mb-2">Featured Products</h2>
              <p className="text-muted-foreground">
                {featuredProducts.length > 0
                  ? "Products from verified vendors"
                  : "Products will appear here once vendors add them"}
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/search">View All Products</Link>
            </Button>
          </div>

          {featuredProducts.length === 0 ? (
            <div className="text-center py-16">
              <Package className="w-20 h-20 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Products Yet</h3>
              <p className="text-muted-foreground mb-6">
                Be the first to list your products on MarketHub!
              </p>
              <Button asChild>
                <Link href="/auth/register">
                  Become a Vendor
                </Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredProducts.map((product) => (
                <Link key={product.id} href={`/product/${product.id}`}>
                  <Card className="cursor-pointer hover:shadow-lg transition-all duration-300 group hover:scale-[1.02]">
                    <CardHeader className="p-0">
                      <div className="relative aspect-square">
                        {product.images && product.images.length > 0 ? (
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            className="w-full h-full object-cover rounded-t-lg"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-200 rounded-t-lg flex items-center justify-center group-hover:bg-gray-100 transition-colors">
                            <Package className="w-16 h-16 text-gray-400" />
                          </div>
                        )}
                        <Badge className="absolute top-2 left-2" variant="secondary">
                          {product.category}
                        </Badge>
                        {product.comparePrice && product.comparePrice > product.price && (
                          <Badge className="absolute top-2 right-2" variant="destructive">
                            -{Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)}%
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                        {product.name}
                      </h3>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-lg font-bold">GHS {product.price.toLocaleString()}</span>
                        {product.comparePrice && product.comparePrice > product.price && (
                          <span className="text-sm text-muted-foreground line-through">
                            GHS {product.comparePrice.toLocaleString()}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Shield className="w-3 h-3 text-green-600" />
                          <span className="text-muted-foreground truncate">{product.vendorName}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-gradient-to-r from-green-600 to-blue-600 text-white">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Join MarketHub Today</h2>
            <p className="text-xl opacity-90">Ghana's trusted marketplace for buyers and sellers</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold mb-2">{totalProducts > 0 ? totalProducts : "0"}</div>
              <div className="opacity-90">Products Listed</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">{totalVendors > 0 ? totalVendors : "0"}</div>
              <div className="opacity-90">Active Vendors</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">{totalOrders}</div>
              <div className="opacity-90">Orders Placed</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">100%</div>
              <div className="opacity-90">Secure Payments</div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-16 bg-gray-50">
        <div className="container text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Start?</h2>
          <p className="text-xl text-muted-foreground mb-8">
            {totalProducts > 0
              ? "Discover amazing products from verified vendors across Ghana"
              : "Join our marketplace as a buyer or seller today"}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-green-600 hover:bg-green-700" asChild>
              <Link href="/search">
                <Search className="w-5 h-5 mr-2" />
                {totalProducts > 0 ? "Start Shopping Now" : "Browse Marketplace"}
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/auth/register">
                Join as Vendor
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="border-purple-200 text-purple-700 hover:bg-purple-50" asChild>
              <Link href="/admin/login">
                <Shield className="w-5 h-5 mr-2" />
                Admin Access
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
