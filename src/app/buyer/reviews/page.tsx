"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { SiteLayout } from "@/components/layout/site-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Star,
  MessageSquare,
  Edit2,
  Trash2,
  Package,
  CheckCircle,
  Loader2,
  Store,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

interface Review {
  id: string;
  product_id: string;
  product_name?: string;
  product_image?: string;
  buyer_id: string;
  vendor_id: string;
  vendor_name?: string;
  rating: number;
  comment: string;
  status: string;
  is_verified_purchase: boolean;
  helpful_count: number;
  vendor_reply?: string;
  vendor_reply_at?: string;
  created_at: string;
  updated_at: string;
}

export default function BuyerReviewsPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [editForm, setEditForm] = useState({ rating: 5, comment: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "buyer") {
      router.push("/auth/login");
      return;
    }

    fetchReviews();
  }, [isAuthenticated, user]);

  async function fetchReviews() {
    if (!user) return;
    
    try {
      setLoading(true);
      const response = await fetch(`/api/reviews?buyerId=${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setReviews(data.reviews || []);
      }
    } catch (error) {
      console.error("Failed to fetch reviews:", error);
      toast.error("Failed to load reviews");
    } finally {
      setLoading(false);
    }
  }

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

    setIsSubmitting(true);
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
        setReviews((prev) =>
          prev.map((r) => (r.id === editingReview.id ? data.review : r))
        );
        toast.success("Review updated");
        setEditingReview(null);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update review");
      }
    } catch {
      toast.error("Failed to update review");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (reviewId: string) => {
    if (!confirm("Are you sure you want to delete this review?")) return;

    setDeletingId(reviewId);
    try {
      const response = await fetch(`/api/reviews/${reviewId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setReviews((prev) => prev.filter((r) => r.id !== reviewId));
        toast.success("Review deleted");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to delete review");
      }
    } catch {
      toast.error("Failed to delete review");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <SiteLayout>
        <div className="container py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className="container py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Reviews</h1>
          <p className="text-muted-foreground">
            Manage your product reviews
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/">
            Back to Marketplace
          </Link>
        </Button>
      </div>

      {reviews.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">No Reviews Yet</h3>
            <p className="text-muted-foreground mb-4">
              You haven't reviewed any products yet.
            </p>
            <Button asChild>
              <Link href="/search">Browse Products</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <Card key={review.id}>
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                    {review.product_image ? (
                      <img
                        src={review.product_image}
                        alt={review.product_name || "Product"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="w-8 h-8 text-gray-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <Link
                          href={`/product/${review.product_id}`}
                          className="font-semibold hover:underline flex items-center gap-1"
                        >
                          {review.product_name || "Product"}
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                        {review.vendor_name && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Store className="w-3 h-3" />
                            {review.vendor_name}
                          </p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditClick(review)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(review.id)}
                          disabled={deletingId === review.id}
                        >
                          {deletingId === review.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4 text-red-500" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${
                              i < review.rating
                                ? "text-yellow-400 fill-current"
                                : "text-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                      {review.is_verified_purchase && (
                        <Badge variant="outline" className="text-xs">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                      <span className="text-sm text-muted-foreground">
                        {new Date(review.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <p className="mt-2 text-gray-700">{review.comment}</p>

                    {review.vendor_reply && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg border-l-4 border-gray-300">
                        <div className="flex items-center gap-2 mb-1">
                          <Store className="w-4 h-4 text-gray-600" />
                          <span className="font-semibold text-sm">
                            Vendor Response
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          {review.vendor_reply}
                        </p>
                      </div>
                    )}

                    <div className="mt-2 text-sm text-muted-foreground">
                      {review.helpful_count > 0 && (
                        <span>{review.helpful_count} people found this helpful</span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editingReview} onOpenChange={() => setEditingReview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Review</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Rating</label>
              <div className="flex gap-1 mt-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() =>
                      setEditForm((prev) => ({ ...prev, rating: star }))
                    }
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
              <label className="text-sm font-medium">Your Review</label>
              <Textarea
                value={editForm.comment}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, comment: e.target.value }))
                }
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
            <Button onClick={handleEditSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
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
      </div>
    </SiteLayout>
  );
}
