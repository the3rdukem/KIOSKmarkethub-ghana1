"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Reply,
  Package,
  CheckCircle,
  Loader2,
  User,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";

interface Review {
  id: string;
  product_id: string;
  product_name?: string;
  product_image?: string;
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
}

export default function VendorReviewsPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Review | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "replied">("all");

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "vendor") {
      router.push("/auth/login");
      return;
    }

    fetchVendorId();
  }, [isAuthenticated, user]);

  async function fetchVendorId() {
    try {
      const response = await fetch("/api/vendor/profile");
      if (response.ok) {
        const data = await response.json();
        setVendorId(data.vendor?.id);
        if (data.vendor?.id) {
          fetchReviews(data.vendor.id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch vendor profile:", error);
    }
  }

  async function fetchReviews(vId: string) {
    try {
      setLoading(true);
      const response = await fetch(`/api/reviews?vendorId=${vId}`);
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

  const handleReplyClick = (review: Review) => {
    setReplyingTo(review);
    setReplyText("");
  };

  const handleReplySubmit = async () => {
    if (!replyingTo || !replyText.trim()) {
      toast.error("Please enter a reply");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/reviews/${replyingTo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reply",
          reply: replyText.trim(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setReviews((prev) =>
          prev.map((r) => (r.id === replyingTo.id ? data.review : r))
        );
        toast.success("Reply posted successfully");
        setReplyingTo(null);
        setReplyText("");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to post reply");
      }
    } catch {
      toast.error("Failed to post reply");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredReviews = reviews.filter((review) => {
    if (filter === "pending") return !review.vendor_reply;
    if (filter === "replied") return !!review.vendor_reply;
    return true;
  });

  const stats = {
    total: reviews.length,
    pending: reviews.filter((r) => !r.vendor_reply).length,
    replied: reviews.filter((r) => !!r.vendor_reply).length,
    averageRating:
      reviews.length > 0
        ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
        : "0.0",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Product Reviews</h1>
        <p className="text-muted-foreground">
          Manage and respond to customer reviews
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <MessageSquare className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Reviews</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Star className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.averageRating}</p>
                <p className="text-sm text-muted-foreground">Avg Rating</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <AlertCircle className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-sm text-muted-foreground">Pending Reply</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.replied}</p>
                <p className="text-sm text-muted-foreground">Replied</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList>
          <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
          <TabsTrigger value="pending">
            Pending Reply ({stats.pending})
          </TabsTrigger>
          <TabsTrigger value="replied">Replied ({stats.replied})</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-6">
          {filteredReviews.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="font-semibold mb-2">No Reviews</h3>
                <p className="text-muted-foreground">
                  {filter === "pending"
                    ? "No reviews waiting for your reply"
                    : filter === "replied"
                    ? "No replied reviews yet"
                    : "No reviews for your products yet"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredReviews.map((review) => (
                <Card key={review.id}>
                  <CardContent className="p-6">
                    <div className="flex gap-4">
                      <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                        {review.product_image ? (
                          <img
                            src={review.product_image}
                            alt={review.product_name || "Product"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="w-6 h-6 text-gray-400" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <Link
                              href={`/product/${review.product_id}`}
                              className="font-semibold hover:underline"
                            >
                              {review.product_name || "Product"}
                            </Link>
                            <div className="flex items-center gap-2 mt-1">
                              <User className="w-3 h-3 text-gray-400" />
                              <span className="text-sm text-muted-foreground">
                                {review.buyer_name || "Customer"}
                              </span>
                              {review.is_verified_purchase && (
                                <Badge variant="outline" className="text-xs">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Verified
                                </Badge>
                              )}
                            </div>
                          </div>

                          {!review.vendor_reply && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReplyClick(review)}
                            >
                              <Reply className="w-4 h-4 mr-2" />
                              Reply
                            </Button>
                          )}
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
                          <span className="text-sm text-muted-foreground">
                            {new Date(review.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        <p className="mt-2 text-gray-700">{review.comment}</p>

                        {review.vendor_reply && (
                          <div className="mt-3 p-3 bg-green-50 rounded-lg border-l-4 border-green-400">
                            <div className="flex items-center gap-2 mb-1">
                              <Reply className="w-4 h-4 text-green-600" />
                              <span className="font-semibold text-sm text-green-800">
                                Your Response
                              </span>
                              {review.vendor_reply_at && (
                                <span className="text-xs text-green-600">
                                  {new Date(
                                    review.vendor_reply_at
                                  ).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-green-800">
                              {review.vendor_reply}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!replyingTo} onOpenChange={() => setReplyingTo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reply to Review</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {replyingTo && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < replyingTo.rating
                            ? "text-yellow-400 fill-current"
                            : "text-gray-300"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-medium">
                    {replyingTo.buyer_name || "Customer"}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{replyingTo.comment}</p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium">Your Reply</label>
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Thank the customer and address their feedback..."
                rows={4}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Your reply will be visible to all customers viewing this product.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplyingTo(null)}>
              Cancel
            </Button>
            <Button onClick={handleReplySubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Posting...
                </>
              ) : (
                "Post Reply"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
