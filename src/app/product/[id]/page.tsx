"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCartStore } from "@/lib/cart-store";
import { useWishlistStore } from "@/lib/wishlist-store";
import { useAuthStore } from "@/lib/auth-store";
import { useRecentlyViewedStore } from "@/lib/recently-viewed-store";
import { formatCurrency } from "@/lib/utils/currency";
import { RecentlyViewedSection } from "@/components/recently-viewed-section";
import { toast } from "sonner";
import Link from "next/link";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Star,
  Shield,
  Heart,
  Share2,
  ShoppingCart,
  Truck,
  Package,
  MapPin,
  CheckCircle,
  AlertTriangle,
  MessageSquare,
  ThumbsUp,
  Store,
  Verified,
  CreditCard,
  Smartphone,
  ArrowLeft,
  Plus,
  Minus,
  User,
  Loader2,
  ImagePlus,
  X,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Copy, Facebook, Twitter, Mail, Link as LinkIcon } from "lucide-react";

interface ReviewMedia {
  id: string;
  review_id: string;
  file_url: string;
  file_type: string;
}

interface Review {
  id: string;
  product_id: string;
  buyer_id: string;
  buyer_name?: string;
  buyer_avatar?: string;
  vendor_id: string;
  rating: number;
  comment: string;
  status: string;
  is_verified_purchase: boolean;
  helpful_count: number;
  vendor_reply?: string;
  vendor_reply_at?: string;
  created_at: string;
  updated_at: string;
  media?: ReviewMedia[];
}

interface RatingStats {
  average: number;
  total: number;
  distribution: { [key: number]: number };
}

interface ActiveSale {
  id: string;
  name: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  endsAt: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  effectivePrice?: number;
  comparePrice?: number;
  images: string[];
  category: string;
  vendorId: string;
  vendorName: string;
  status: string;
  quantity: number;
  trackQuantity: boolean;
  sku?: string;
  specifications?: Record<string, string>;
  tags?: string[];
  activeSale?: ActiveSale | null;
}

interface Vendor {
  id: string;
  name: string;
  email: string;
  businessName?: string;
  avatar?: string;
  status?: string;
}

export default function ProductPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;

  const { addItem } = useCartStore();
  const { isInWishlist, toggleWishlist } = useWishlistStore();
  const { user, isAuthenticated } = useAuthStore();
  const { addProduct: addToRecentlyViewed } = useRecentlyViewedStore();

  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, comment: "" });
  const [reviewImages, setReviewImages] = useState<string[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  
  const [product, setProduct] = useState<Product | null>(null);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [reviews, setReviews] = useState<Review[]>([]);
  const [ratingStats, setRatingStats] = useState<RatingStats>({ average: 0, total: 0, distribution: {} });
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [hasReviewed, setHasReviewed] = useState(false);
  
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [editForm, setEditForm] = useState({ rating: 5, comment: "" });
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [isDeletingReview, setIsDeletingReview] = useState(false);
  
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<ReviewMedia[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
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

  useEffect(() => {
    if (!productId) return;
    
    async function fetchProduct() {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/products/${productId}`);
        if (response.ok) {
          const data = await response.json();
          const productData = data.product || data;
          setProduct(productData);
          
          addToRecentlyViewed({
            id: productData.id,
            name: productData.name,
            price: productData.price,
            image: productData.images?.[0] || productData.image,
            category: productData.category,
            vendorName: productData.vendorName,
          });
          
          if (productData.vendorId) {
            try {
              const vendorRes = await fetch(`/api/vendors/${productData.vendorId}`);
              if (vendorRes.ok) {
                const vendorData = await vendorRes.json();
                setVendor(vendorData.user || vendorData.vendor || vendorData);
              }
            } catch (e) {
              console.error('Failed to fetch vendor:', e);
            }
          }
          
          try {
            const relatedRes = await fetch(`/api/products?status=active&category=${encodeURIComponent(productData.category)}&limit=8`);
            if (relatedRes.ok) {
              const relatedData = await relatedRes.json();
              let filtered = (relatedData.products || relatedData || [])
                .filter((p: Product) => p.id !== productId)
                .slice(0, 4);
              
              if (filtered.length < 4 && productData.vendorId) {
                const vendorRes = await fetch(`/api/products?status=active&vendorId=${productData.vendorId}&limit=8`);
                if (vendorRes.ok) {
                  const vendorData = await vendorRes.json();
                  const vendorProducts = (vendorData.products || vendorData || [])
                    .filter((p: Product) => p.id !== productId && !filtered.some((f: Product) => f.id === p.id));
                  filtered = [...filtered, ...vendorProducts].slice(0, 4);
                }
              }
              
              setRelatedProducts(filtered);
            }
          } catch (e) {
            console.error('Failed to fetch related products:', e);
          }
        } else {
          setProduct(null);
        }
      } catch (error) {
        console.error('Failed to fetch product:', error);
        setProduct(null);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchProduct();
  }, [productId]);

  useEffect(() => {
    if (!productId) return;
    
    async function fetchReviews() {
      try {
        setReviewsLoading(true);
        const response = await fetch(`/api/reviews?productId=${productId}`);
        if (response.ok) {
          const data = await response.json();
          setReviews(data.reviews || []);
          setRatingStats(data.stats || { average: 0, total: 0, distribution: {} });
          
          if (user && data.reviews) {
            const userReview = data.reviews.find((r: Review) => r.buyer_id === user.id);
            setHasReviewed(!!userReview);
          }
        }
      } catch (error) {
        console.error('Failed to fetch reviews:', error);
      } finally {
        setReviewsLoading(false);
      }
    }
    
    fetchReviews();
  }, [productId, user]);

  const averageRating = ratingStats.average || 0;
  const totalReviews = ratingStats.total || 0;
  const ratingBreakdown = ratingStats.distribution || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

  const isWishlisted = user ? isInWishlist(user.id, productId) : false;

  const canReview = isAuthenticated && user?.role === "buyer" && !hasReviewed;

  const handleAddToCart = () => {
    if (!product) return;

    const priceToUse = product.effectivePrice ?? product.price;

    addItem({
      id: product.id,
      name: product.name,
      price: priceToUse,
      image: product.images[0] || "",
      vendor: product.vendorName,
      vendorId: product.vendorId,
      quantity,
      maxQuantity: product.trackQuantity ? product.quantity : 999
    });

    toast.success(`Added ${quantity} ${product.name} to cart!`);
  };

  const handleBuyNow = () => {
    handleAddToCart();
    router.push("/checkout");
  };

  const handleToggleWishlist = () => {
    if (!user) {
      toast.error("Please login to add items to wishlist");
      router.push("/auth/login");
      return;
    }

    const added = toggleWishlist(user.id, productId);
    if (added) {
      toast.success("Added to wishlist!");
    } else {
      toast.success("Removed from wishlist");
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (reviewImages.length >= 5) {
      toast.error("Maximum 5 images allowed");
      return;
    }

    const file = files[0];
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error("Only JPEG, PNG, and WebP images allowed");
      return;
    }

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('directory', 'reviews');

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setReviewImages(prev => [...prev, data.file.url]);
        toast.success("Image uploaded");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to upload image");
      }
    } catch {
      toast.error("Failed to upload image");
    } finally {
      setIsUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    setReviewImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmitReview = async () => {
    if (!user || user.role !== "buyer") {
      toast.error("Only buyers can submit reviews");
      return;
    }

    if (!newReview.comment.trim()) {
      toast.error("Please write a review comment");
      return;
    }

    setIsSubmittingReview(true);

    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          rating: newReview.rating,
          comment: newReview.comment.trim(),
          mediaUrls: reviewImages,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success("Review submitted successfully!");
        setNewReview({ rating: 5, comment: "" });
        setReviewImages([]);
        setHasReviewed(true);
        setReviews(prev => [data.review, ...prev]);
        setRatingStats(prev => ({
          ...prev,
          total: prev.total + 1,
          average: ((prev.average * prev.total) + newReview.rating) / (prev.total + 1)
        }));
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to submit review");
      }
    } catch {
      toast.error("Failed to submit review");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleMarkHelpful = async (reviewId: string) => {
    try {
      const response = await fetch(`/api/reviews/${reviewId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'helpful' }),
      });

      if (response.ok) {
        const data = await response.json();
        setReviews(prev => prev.map(r => 
          r.id === reviewId ? { ...r, helpful_count: data.review.helpful_count } : r
        ));
        toast.success("Marked as helpful!");
      }
    } catch {
      toast.error("Failed to mark as helpful");
    }
  };

  const canEditReview = (review: Review): boolean => {
    if (review.vendor_reply) return false;
    const createdAt = new Date(review.created_at);
    const now = new Date();
    const minutesSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60);
    return minutesSinceCreation <= 15;
  };

  const handleEditClick = (review: Review) => {
    setEditingReview(review);
    setEditForm({ rating: review.rating, comment: review.comment });
  };

  const handleEditSubmit = async () => {
    if (!editingReview) return;
    if (!editForm.comment.trim()) {
      toast.error("Comment is required");
      return;
    }

    setIsEditSubmitting(true);
    try {
      const response = await fetch(`/api/reviews/${editingReview.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: editForm.rating,
          comment: editForm.comment.trim(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setReviews(prev => prev.map(r => r.id === editingReview.id ? data.review : r));
        toast.success("Review updated");
        setEditingReview(null);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update review");
      }
    } catch {
      toast.error("Failed to update review");
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!confirm("Are you sure you want to delete this review?")) return;

    setIsDeletingReview(true);
    try {
      const response = await fetch(`/api/reviews/${reviewId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setReviews(prev => prev.filter(r => r.id !== reviewId));
        setHasReviewed(false);
        toast.success("Review deleted");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to delete review");
      }
    } catch {
      toast.error("Failed to delete review");
    } finally {
      setIsDeletingReview(false);
    }
  };

  if (isLoading) {
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

  if (!product) {
    return (
      <SiteLayout>
        <div className="container py-8">
          <div className="text-center py-16">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Product Not Found</h2>
            <p className="text-muted-foreground mb-6">
              The product you're looking for doesn't exist or has been removed.
            </p>
            <Button onClick={() => router.push("/search")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Browse Products
            </Button>
          </div>
        </div>
      </SiteLayout>
    );
  }

  const inStock = !product.trackQuantity || product.quantity > 0;
  const stockQuantity = product.trackQuantity ? product.quantity : 999;
  const discount = product.comparePrice
    ? Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)
    : 0;

  return (
    <SiteLayout>
      <div className="container py-8">
        <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
          <Link href="/" className="hover:text-foreground">Home</Link>
          <span>/</span>
          <Link href="/search" className="hover:text-foreground">Products</Link>
          <span>/</span>
          <Link href={`/search?category=${product.category}`} className="hover:text-foreground">
            {product.category}
          </Link>
          <span>/</span>
          <span className="text-foreground truncate max-w-[200px]">{product.name}</span>
        </nav>

        <Button variant="ghost" className="mb-6" asChild>
          <Link href="/search">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Products
          </Link>
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="space-y-4">
            <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
              {product.images.length > 0 ? (
                <img
                  src={product.images[selectedImage]}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-32 h-32 text-gray-400" />
                </div>
              )}
            </div>
            {product.images.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {product.images.map((image, index) => (
                  <div
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`aspect-square bg-gray-100 rounded-lg cursor-pointer border-2 overflow-hidden ${
                      selectedImage === index ? "border-gray-900" : "border-transparent"
                    }`}
                  >
                    <img src={image} alt={`${product.name} ${index + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div>
              <div className="flex items-start justify-between mb-2">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">{product.name}</h1>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleToggleWishlist}
                  >
                    <Heart className={`w-5 h-5 ${isWishlisted ? "fill-red-500 text-red-500" : ""}`} />
                  </Button>
                  {canNativeShare ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        const shareData = {
                          title: product.name,
                          text: `Check out ${product.name} on KIOSK!`,
                          url: window.location.href,
                        };
                        try {
                          await navigator.share(shareData);
                        } catch (err) {
                          if ((err as Error).name !== 'AbortError') {
                            toast.error("Failed to share");
                          }
                        }
                      }}
                    >
                      <Share2 className="w-5 h-5" />
                    </Button>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Share2 className="w-5 h-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(window.location.href);
                              toast.success("Link copied to clipboard!");
                            } catch {
                              toast.error("Failed to copy link");
                            }
                          }}
                        >
                          <Copy className="w-4 h-4 mr-2" />
                          Copy Link
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            window.open(
                              `https://wa.me/?text=${encodeURIComponent(`Check out ${product.name} on KIOSK! ${window.location.href}`)}`,
                              '_blank'
                            );
                          }}
                        >
                          <MessageSquare className="w-4 h-4 mr-2" />
                          Share on WhatsApp
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            window.open(
                              `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`,
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
                            window.open(
                              `https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(`Check out ${product.name} on KIOSK!`)}`,
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
                            window.location.href = `mailto:?subject=${encodeURIComponent(`Check out ${product.name} on KIOSK!`)}&body=${encodeURIComponent(`I found this product you might like: ${window.location.href}`)}`;
                          }}
                        >
                          <Mail className="w-4 h-4 mr-2" />
                          Share via Email
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-5 h-5 ${
                        i < Math.floor(averageRating) ? "text-yellow-400 fill-current" : "text-gray-300"
                      }`}
                    />
                  ))}
                  <span className="font-semibold ml-1">{averageRating.toFixed(1) || "No ratings"}</span>
                </div>
                <span className="text-muted-foreground">({totalReviews} reviews)</span>
              </div>

              {product.tags.length > 0 && (
                <div className="flex gap-2 mb-4 flex-wrap">
                  {product.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">{tag}</Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              {product.activeSale ? (
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <span className="text-xl sm:text-2xl md:text-3xl font-bold text-green-600">
                    {formatCurrency(product.effectivePrice || product.price)}
                  </span>
                  <span className="text-sm sm:text-lg text-muted-foreground line-through">
                    {formatCurrency(product.price)}
                  </span>
                  <Badge variant="destructive" className="animate-pulse">
                    {product.activeSale.discountType === 'percentage' 
                      ? `-${product.activeSale.discountValue}%` 
                      : `-${formatCurrency(product.activeSale.discountValue)}`}
                  </Badge>
                  <Badge variant="secondary" className="bg-red-100 text-red-800">
                    {product.activeSale.name}
                  </Badge>
                </div>
              ) : (
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <span className="text-xl sm:text-2xl md:text-3xl font-bold text-green-600">
                    {formatCurrency(product.price)}
                  </span>
                  {product.comparePrice && (
                    <>
                      <span className="text-sm sm:text-lg text-muted-foreground line-through">
                        {formatCurrency(product.comparePrice)}
                      </span>
                      <Badge variant="destructive">-{discount}%</Badge>
                    </>
                  )}
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Price includes all taxes. No hidden fees.
              </p>
            </div>

            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0">
                      <AvatarImage src={vendor?.avatar} />
                      <AvatarFallback>{vendor?.businessName?.[0] || product.vendorName[0]}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm sm:text-base truncate">{vendor?.businessName || product.vendorName}</h3>
                        {vendor?.verificationStatus === "verified" && (
                          <Badge variant="default" className="text-xs flex-shrink-0">
                            <Shield className="w-3 h-3 mr-1" />
                            Verified
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs sm:text-sm text-muted-foreground">
                        {vendor?.storeRating && (
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-yellow-400 fill-current" />
                            <span>{vendor.storeRating}</span>
                          </div>
                        )}
                        {vendor?.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            <span className="truncate">{vendor.location}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 sm:flex-none text-xs sm:text-sm" asChild>
                      <Link href={`/vendor/${product.vendorId}`}>
                        <Store className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">Visit Store</span>
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 sm:flex-none text-xs sm:text-sm" asChild>
                      <Link href={`/messages?vendor=${product.vendorId}&product=${product.id}`}>
                        <MessageSquare className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">Contact</span>
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div>
              <Label className="text-base font-semibold">Quantity</Label>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center border rounded-lg">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span className="px-4 py-2 font-semibold">{quantity}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setQuantity(Math.min(stockQuantity, quantity + 1))}
                    disabled={quantity >= stockQuantity}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <span className="text-sm text-muted-foreground">
                  {product.trackQuantity ? `${stockQuantity} available` : "In Stock"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {inStock ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-green-600 font-semibold">In Stock</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <span className="text-red-600 font-semibold">Out of Stock</span>
                </>
              )}
            </div>

            <Card className="border-gray-200 bg-gray-50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Truck className="w-5 h-5 text-gray-600 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-gray-800">Shipping Available</p>
                    <p className="text-sm text-gray-700">
                      Delivery within Ghana. Contact vendor for shipping details.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <Button
                onClick={handleBuyNow}
                size="lg"
                className="w-full bg-green-600 hover:bg-green-700"
                disabled={!inStock}
              >
                <Smartphone className="w-5 h-5 mr-2" />
                Buy Now with Mobile Money
              </Button>
              <Button
                onClick={handleAddToCart}
                variant="outline"
                size="lg"
                className="w-full"
                disabled={!inStock}
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                Add to Cart
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-green-600" />
                <span>Buyer Protection</span>
              </div>
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-gray-600" />
                <span>Secure Payment</span>
              </div>
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-orange-600" />
                <span>Return Policy</span>
              </div>
              <div className="flex items-center gap-2">
                <Verified className="w-4 h-4 text-gray-600" />
                <span>Quality Assured</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12">
          <Tabs defaultValue="description">
            <TabsList className="flex w-full overflow-x-auto">
              <TabsTrigger value="description" className="flex-1 min-w-0 text-xs sm:text-sm">Description</TabsTrigger>
              <TabsTrigger value="reviews" className="flex-1 min-w-0 text-xs sm:text-sm">Reviews ({totalReviews})</TabsTrigger>
              <TabsTrigger value="shipping" className="flex-1 min-w-0 text-xs sm:text-sm whitespace-nowrap">Shipping</TabsTrigger>
            </TabsList>

            <TabsContent value="description" className="mt-6">
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {showFullDescription || product.description.length <= 500
                        ? product.description
                        : `${product.description.slice(0, 500)}...`
                      }
                    </p>
                    {product.description.length > 500 && (
                      <Button
                        variant="link"
                        onClick={() => setShowFullDescription(!showFullDescription)}
                        className="p-0 h-auto"
                      >
                        {showFullDescription ? "Show Less" : "Read More"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reviews" className="mt-6">
              <div className="space-y-6">
                <Card>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="text-center">
                        <div className="text-4xl font-bold">{averageRating.toFixed(1) || "-"}</div>
                        <div className="flex justify-center mt-2">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-5 h-5 ${
                                i < Math.floor(averageRating) ? "text-yellow-400 fill-current" : "text-gray-300"
                              }`}
                            />
                          ))}
                        </div>
                        <p className="text-muted-foreground mt-1">Based on {totalReviews} reviews</p>
                      </div>
                      <div className="space-y-2">
                        {[5, 4, 3, 2, 1].map((stars) => {
                          const count = ratingBreakdown[stars] || 0;
                          const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
                          return (
                            <div key={stars} className="flex items-center gap-2">
                              <span className="text-sm w-4">{stars}</span>
                              <Star className="w-3 h-3 text-yellow-400 fill-current" />
                              <div className="flex-1 bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-yellow-400 h-2 rounded-full"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <span className="text-sm text-muted-foreground w-8">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {canReview && (
                  <Card>
                    <CardContent className="p-6">
                      <h3 className="font-semibold mb-4">Write a Review</h3>
                      <div className="space-y-4">
                        <div>
                          <Label>Rating</Label>
                          <div className="flex gap-1 mt-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => setNewReview(prev => ({ ...prev, rating: star }))}
                              >
                                <Star
                                  className={`w-8 h-8 cursor-pointer transition-colors ${
                                    star <= newReview.rating ? "text-yellow-400 fill-current" : "text-gray-300"
                                  }`}
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <Label>Your Review</Label>
                          <Textarea
                            value={newReview.comment}
                            onChange={(e) => setNewReview(prev => ({ ...prev, comment: e.target.value }))}
                            placeholder="Share your experience with this product..."
                            rows={4}
                            className="mt-2"
                          />
                        </div>
                        <div>
                          <Label>Add Photos (Optional)</Label>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {reviewImages.map((url, idx) => (
                              <div key={idx} className="relative w-20 h-20">
                                <img
                                  src={url}
                                  alt={`Review image ${idx + 1}`}
                                  className="w-full h-full object-cover rounded-md border"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRemoveImage(idx)}
                                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                            {reviewImages.length < 5 && (
                              <label className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-md flex flex-col items-center justify-center cursor-pointer hover:border-green-500 hover:bg-gray-50 transition-colors">
                                {isUploadingImage ? (
                                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                                ) : (
                                  <>
                                    <ImagePlus className="w-5 h-5 text-gray-400" />
                                    <span className="text-xs text-gray-400 mt-1">Add</span>
                                  </>
                                )}
                                <Input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp"
                                  onChange={handleImageUpload}
                                  className="hidden"
                                  disabled={isUploadingImage}
                                />
                              </label>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Up to 5 images (JPEG, PNG, WebP, max 5MB each)
                          </p>
                        </div>
                        <Button onClick={handleSubmitReview} disabled={isSubmittingReview || isUploadingImage}>
                          {isSubmittingReview ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Submitting...
                            </>
                          ) : (
                            "Submit Review"
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {isAuthenticated && user?.role === "buyer" && hasReviewed && (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                      <p className="text-muted-foreground">You've already reviewed this product</p>
                    </CardContent>
                  </Card>
                )}

                {reviewsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                  </div>
                ) : reviews.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <h3 className="font-semibold mb-2">No Reviews Yet</h3>
                      <p className="text-muted-foreground">Be the first to review this product!</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {reviews.map((review) => (
                      <Card key={review.id}>
                        <CardContent className="p-6">
                          <div className="flex items-start gap-4">
                            <Avatar>
                              <AvatarImage src={review.buyer_avatar} />
                              <AvatarFallback>
                                <User className="w-4 h-4" />
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-semibold">{review.buyer_name || 'Anonymous'}</h4>
                                  {review.is_verified_purchase && (
                                    <Badge variant="outline" className="text-xs">
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      Verified Purchase
                                    </Badge>
                                  )}
                                </div>
                                {user && user.id === review.buyer_id && (
                                  <div className="flex gap-1">
                                    {canEditReview(review) && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEditClick(review)}
                                        className="h-8 w-8 p-0"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteReview(review.id)}
                                      disabled={isDeletingReview}
                                      className="h-8 w-8 p-0"
                                    >
                                      {isDeletingReview ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <Trash2 className="w-4 h-4 text-red-500" />
                                      )}
                                    </Button>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mb-2">
                                <div className="flex">
                                  {[...Array(5)].map((_, i) => (
                                    <Star
                                      key={i}
                                      className={`w-4 h-4 ${
                                        i < review.rating ? "text-yellow-400 fill-current" : "text-gray-300"
                                      }`}
                                    />
                                  ))}
                                </div>
                                <span className="text-sm text-muted-foreground">
                                  {new Date(review.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-gray-700 mb-3">{review.comment}</p>
                              
                              {review.media && review.media.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-3">
                                  {review.media.map((m, idx) => (
                                    <img
                                      key={m.id}
                                      src={m.file_url}
                                      alt="Review photo"
                                      className="w-20 h-20 object-cover rounded-md border cursor-pointer hover:opacity-90 transition-opacity"
                                      onClick={() => {
                                        setLightboxImages(review.media!);
                                        setLightboxIndex(idx);
                                        setLightboxOpen(true);
                                      }}
                                    />
                                  ))}
                                </div>
                              )}
                              
                              {review.vendor_reply && (
                                <div className="mt-3 p-3 bg-gray-50 rounded-lg border-l-4 border-gray-300">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Store className="w-4 h-4 text-gray-600" />
                                    <span className="font-semibold text-sm">Vendor Response</span>
                                    {review.vendor_reply_at && (
                                      <span className="text-xs text-muted-foreground">
                                        {new Date(review.vendor_reply_at).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-600">{review.vendor_reply}</p>
                                </div>
                              )}
                              
                              <div className="flex items-center gap-4 text-sm mt-3">
                                <button
                                  onClick={() => handleMarkHelpful(review.id)}
                                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                                >
                                  <ThumbsUp className="w-3 h-3" />
                                  Helpful ({review.helpful_count || 0})
                                </button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="shipping" className="mt-6">
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-semibold mb-3">Shipping Information</h4>
                      <div className="space-y-2 text-sm">
                        <p><strong>Delivery:</strong> Available within Ghana</p>
                        <p><strong>Processing Time:</strong> 1-2 business days</p>
                        <p><strong>Shipping Cost:</strong> Contact vendor for rates</p>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h4 className="font-semibold mb-3">Return Policy</h4>
                      <div className="space-y-2 text-sm">
                        <p><strong>Return Window:</strong> 7 days from delivery</p>
                        <p><strong>Condition:</strong> Items must be unused and in original packaging</p>
                        <p><strong>Contact:</strong> Message the vendor to initiate a return</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {relatedProducts.length > 0 && (
          <section className="mt-12">
            <div className="flex items-center gap-2 mb-4 sm:mb-6">
              <Package className="w-5 h-5 text-green-600" />
              <h3 className="text-xl sm:text-2xl font-bold">You May Also Like</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
              {relatedProducts.map((item) => (
                <Link key={item.id} href={`/product/${item.id}`}>
                  <Card className="cursor-pointer hover:shadow-lg transition-shadow h-full">
                    <CardContent className="p-3 sm:p-4">
                      <div className="aspect-square bg-gray-100 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                        {item.images && item.images.length > 0 ? (
                          <img src={item.images[0]} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-12 h-12 text-gray-400" />
                        )}
                      </div>
                      <h4 className="font-semibold text-sm mb-1 line-clamp-2">{item.name}</h4>
                      <p className="font-bold text-green-600">{formatCurrency(item.price)}</p>
                      {item.vendorName && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">{item.vendorName}</p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        <RecentlyViewedSection currentProductId={productId} limit={6} />
      </div>

      <Dialog open={!!editingReview} onOpenChange={(open) => { if (!open) setEditingReview(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Review</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium">Rating</Label>
              <div className="flex gap-1 mt-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setEditForm(prev => ({ ...prev, rating: star }))}
                  >
                    <Star
                      className={`w-8 h-8 cursor-pointer transition-colors ${
                        star <= editForm.rating
                          ? "text-yellow-400 fill-current"
                          : "text-gray-300"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Your Review</Label>
              <Textarea
                value={editForm.comment}
                onChange={(e) => setEditForm(prev => ({ ...prev, comment: e.target.value }))}
                placeholder="Share your experience..."
                rows={4}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingReview(null)}>
              Cancel
            </Button>
            <Button onClick={handleEditSubmit} disabled={isEditSubmitting}>
              {isEditSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Photo Lightbox */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-4xl p-0 bg-black/95 border-none">
          <DialogTitle className="sr-only">Review Photo</DialogTitle>
          <div className="relative flex items-center justify-center min-h-[60vh]">
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            {lightboxImages.length > 1 && (
              <>
                <button
                  onClick={() => setLightboxIndex((prev) => (prev - 1 + lightboxImages.length) % lightboxImages.length)}
                  className="absolute left-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={() => setLightboxIndex((prev) => (prev + 1) % lightboxImages.length)}
                  className="absolute right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
            
            {lightboxImages[lightboxIndex] && (
              <img
                src={lightboxImages[lightboxIndex].file_url}
                alt="Review photo"
                className="max-h-[80vh] max-w-full object-contain"
              />
            )}
            
            {lightboxImages.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {lightboxImages.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setLightboxIndex(idx)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      idx === lightboxIndex ? 'bg-white' : 'bg-white/40 hover:bg-white/60'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </SiteLayout>
  );
}
