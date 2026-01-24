"use client";

import { useState, useEffect } from "react";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, TrendingUp, Users, ShoppingBag, Search, Package, CheckCircle, X } from "lucide-react";
import AdvancedSearch from "@/components/search/advanced-search";
import Link from "next/link";
import { Product } from "@/lib/products-store";
import { useOrdersStore } from "@/lib/orders-store";

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
  const [platformStats, setPlatformStats] = useState({ totalVendors: 0, verifiedVendors: 0, totalProducts: 0 });
  const [siteSettings, setSiteSettings] = useState<Record<string, string>>({});
  const { orders } = useOrdersStore();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productsRes, statsRes, settingsRes] = await Promise.all([
          fetch('/api/products?status=active', { credentials: 'include' }),
          fetch('/api/stats/public'),
          fetch('/api/site-settings/public'),
        ]);
        
        if (productsRes.ok) {
          const data = await productsRes.json();
          setProducts(data.products || []);
        }
        
        if (statsRes.ok) {
          const stats = await statsRes.json();
          setPlatformStats(stats);
        }
        
        if (settingsRes.ok) {
          const data = await settingsRes.json();
          setSiteSettings(data.settings || {});
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const [promoBannerDismissed, setPromoBannerDismissed] = useState(false);
  
  const heroHeadline = siteSettings.hero_headline || "Shop with Confidence";
  const heroSubheadline = siteSettings.hero_subheadline || "Ghana's most secure marketplace with verified vendors, Mobile Money payments, and buyer protection.";
  const heroCtaText = siteSettings.hero_cta_text || "Browse All Products";
  const heroCtaLink = siteSettings.hero_cta_link || "/search";
  const promoBannerEnabled = siteSettings.promo_banner_enabled === 'true';
  const promoBannerText = siteSettings.promo_banner_text || '';
  const promoBannerLink = siteSettings.promo_banner_link || '/search';
  const heroImageUrl = siteSettings.hero_image || '';
  
  const categoriesTitle = siteSettings.categories_title || 'Shop by Category';
  const categoriesSubtitle = siteSettings.categories_subtitle || 'Discover products in your favorite categories';
  const featuredTitle = siteSettings.featured_title || 'Featured Products';
  const featuredSubtitle = siteSettings.featured_subtitle || 'Products from verified vendors';
  const statsTitle = siteSettings.stats_title || 'Join KIOSK Today';
  const statsSubtitle = siteSettings.stats_subtitle || "Ghana's trusted marketplace for buyers and sellers";
  const ctaTitle = siteSettings.cta_title || 'Ready to Start?';
  const ctaSubtitle = siteSettings.cta_subtitle || 'Discover amazing products from verified vendors across Ghana';

  // Get real active products (only after data loads)
  const activeProducts = products.filter(p => p.status === 'active');
  const featuredProducts = activeProducts.slice(0, 4);

  // Get real metrics from public stats API
  const totalProducts = !isLoading ? products.length : 0;
  const totalVendors = !isLoading ? platformStats.totalVendors : 0;
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
      {/* Promotional Banner - Database Driven */}
      {promoBannerEnabled && promoBannerText && !promoBannerDismissed && (
        <div className="relative bg-gradient-to-r from-green-600 to-green-700 text-white">
          <div className="container py-3">
            <div className="flex items-center justify-center gap-4">
              <div className="flex items-center gap-3 text-center">
                <span className="font-semibold">{promoBannerText}</span>
                {promoBannerLink && (
                  <Link href={promoBannerLink} className="inline-flex items-center gap-1 underline hover:no-underline ml-2">
                    Shop Now
                  </Link>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-8 w-8 p-0"
              onClick={() => setPromoBannerDismissed(true)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Hero Section with Advanced Search */}
      <section className="bg-gradient-to-br from-blue-50 via-green-50 to-blue-50 py-16 lg:py-24">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-4xl lg:text-6xl font-bold text-gray-900 mb-6 whitespace-nowrap">
                {heroHeadline.includes(' ') ? (
                  <>
                    {heroHeadline.split(' ').slice(0, -1).join(' ')}{' '}
                    <span className="text-green-600">{heroHeadline.split(' ').slice(-1)[0]}</span>
                  </>
                ) : (
                  <span className="text-green-600">{heroHeadline}</span>
                )}
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                {heroSubheadline}
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
                  <Link href={heroCtaLink}>
                    <Search className="w-5 h-5 mr-2" />
                    {heroCtaText}
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/auth/register">
                    Become a Vendor
                  </Link>
                </Button>
              </div>

              <div className="flex items-center gap-4 sm:gap-6 mt-8 text-xs sm:text-sm text-gray-600">
                <div className="flex items-center gap-1 sm:gap-2">
                  <Shield className="w-3 h-3 sm:w-4 sm:h-4 text-green-600 flex-shrink-0" />
                  <span className="whitespace-nowrap">Verified</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <Users className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 flex-shrink-0" />
                  <span className="whitespace-nowrap">{totalVendors > 0 ? `${totalVendors}+` : "Join"}</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-600 flex-shrink-0" />
                  <span className="whitespace-nowrap">Protected</span>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="aspect-square bg-gradient-to-br from-green-100 to-blue-100 rounded-2xl flex items-center justify-center overflow-hidden">
                {heroImageUrl ? (
                  <img 
                    src={heroImageUrl} 
                    alt="Shop with confidence" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ShoppingBag className="w-32 h-32 text-green-600" />
                )}
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

      {/* Platform Stats - Horizontal on mobile */}
      <section className="py-8 sm:py-16 bg-white">
        <div className="container">
          <div className="flex justify-between sm:grid sm:grid-cols-3 gap-2 sm:gap-8">
            <Card className="text-center flex-1">
              <CardContent className="p-3 sm:p-6">
                <Package className="w-6 h-6 sm:w-12 sm:h-12 text-blue-600 mx-auto mb-1 sm:mb-4" />
                <h3 className="text-lg sm:text-2xl font-bold mb-0 sm:mb-2">{totalProducts > 0 ? totalProducts.toLocaleString() : "0"}</h3>
                <p className="text-muted-foreground text-xs sm:text-base">{totalProducts > 0 ? "Products" : "Products"}</p>
              </CardContent>
            </Card>
            <Card className="text-center flex-1">
              <CardContent className="p-3 sm:p-6">
                <Shield className="w-6 h-6 sm:w-12 sm:h-12 text-green-600 mx-auto mb-1 sm:mb-4" />
                <h3 className="text-lg sm:text-2xl font-bold mb-0 sm:mb-2">100%</h3>
                <p className="text-muted-foreground text-xs sm:text-base">Verified</p>
              </CardContent>
            </Card>
            <Card className="text-center flex-1">
              <CardContent className="p-3 sm:p-6">
                <Users className="w-6 h-6 sm:w-12 sm:h-12 text-purple-600 mx-auto mb-1 sm:mb-4" />
                <h3 className="text-lg sm:text-2xl font-bold mb-0 sm:mb-2">{totalVendors > 0 ? totalVendors.toLocaleString() : "0"}</h3>
                <p className="text-muted-foreground text-xs sm:text-base">{totalVendors > 0 ? "Sellers" : "Sellers"}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 bg-gray-50">
        <div className="container">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 sm:mb-12">
            <div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 sm:mb-2">{categoriesTitle}</h2>
              <p className="text-muted-foreground text-sm sm:text-base">{categoriesSubtitle}</p>
            </div>
            <Button variant="outline" size="sm" className="text-xs sm:text-sm" asChild>
              <Link href="/search">View All</Link>
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
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 sm:mb-12">
            <div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 sm:mb-2">{featuredTitle}</h2>
              <p className="text-muted-foreground text-sm sm:text-base">
                {featuredProducts.length > 0
                  ? featuredSubtitle
                  : "Products will appear here once vendors add them"}
              </p>
            </div>
            <Button variant="outline" size="sm" className="text-xs sm:text-sm" asChild>
              <Link href="/search">View All</Link>
            </Button>
          </div>

          {featuredProducts.length === 0 ? (
            <div className="text-center py-16">
              <Package className="w-20 h-20 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Products Yet</h3>
              <p className="text-muted-foreground mb-6">
                Be the first to list your products on KIOSK!
              </p>
              <Button asChild>
                <Link href="/auth/register">
                  Become a Vendor
                </Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
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
                        {product.activeSale ? (
                          <Badge className="absolute top-2 right-2 animate-pulse" variant="destructive">
                            {product.activeSale.discountType === 'percentage' 
                              ? `-${product.activeSale.discountValue}%` 
                              : `-GHS ${product.activeSale.discountValue}`}
                          </Badge>
                        ) : product.comparePrice && product.comparePrice > product.price && (
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
                      <div className="flex items-center gap-2 flex-wrap mb-3">
                        {product.activeSale ? (
                          <>
                            <span className="text-lg font-bold text-green-600">GHS {(product.effectivePrice || product.price).toLocaleString()}</span>
                            <span className="text-sm text-muted-foreground line-through">
                              GHS {product.price.toLocaleString()}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-lg font-bold">GHS {product.price.toLocaleString()}</span>
                            {product.comparePrice && product.comparePrice > product.price && (
                              <span className="text-sm text-muted-foreground line-through">
                                GHS {product.comparePrice.toLocaleString()}
                              </span>
                            )}
                          </>
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
            <h2 className="text-3xl font-bold mb-4">{statsTitle}</h2>
            <p className="text-xl opacity-90">{statsSubtitle}</p>
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
          <h2 className="text-3xl font-bold mb-4">{ctaTitle}</h2>
          <p className="text-xl text-muted-foreground mb-8">
            {totalProducts > 0
              ? ctaSubtitle
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
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
