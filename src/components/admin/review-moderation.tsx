"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Star,
  MessageSquare,
  Search,
  MoreHorizontal,
  Eye,
  EyeOff,
  Trash2,
  Package,
  CheckCircle,
  Loader2,
  User,
  Store,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";

interface Review {
  id: string;
  product_id: string;
  product_name?: string;
  buyer_id: string;
  buyer_name?: string;
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

interface ReviewStats {
  total: number;
  active: number;
  hidden: number;
  deleted: number;
  averageRating: number;
}

export function ReviewModeration() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "hidden" | "deleted">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchReviews();
    fetchStats();
  }, []);

  async function fetchReviews() {
    try {
      setLoading(true);
      const response = await fetch("/api/reviews?admin=true");
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

  async function fetchStats() {
    try {
      const response = await fetch("/api/reviews?admin=true&stats=true");
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  }

  const handleModerate = async (reviewId: string, action: "hide" | "unhide" | "delete") => {
    setActionLoading(reviewId);
    try {
      const response = await fetch(`/api/reviews/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        const data = await response.json();
        setReviews((prev) =>
          prev.map((r) => (r.id === reviewId ? data.review : r))
        );
        toast.success(
          action === "hide"
            ? "Review hidden"
            : action === "unhide"
            ? "Review restored"
            : "Review deleted"
        );
        fetchStats();
      } else {
        const error = await response.json();
        toast.error(error.error || "Action failed");
      }
    } catch {
      toast.error("Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  const filteredReviews = reviews.filter((review) => {
    if (filter === "active" && review.status !== "active") return false;
    if (filter === "hidden" && review.status !== "hidden") return false;
    if (filter === "deleted" && review.status !== "deleted") return false;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        review.comment.toLowerCase().includes(query) ||
        review.buyer_name?.toLowerCase().includes(query) ||
        review.product_name?.toLowerCase().includes(query)
      );
    }

    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default" className="bg-green-500">Active</Badge>;
      case "hidden":
        return <Badge variant="secondary">Hidden</Badge>;
      case "deleted":
        return <Badge variant="destructive">Deleted</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
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
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <MessageSquare className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.total ?? 0}</p>
                <p className="text-sm text-muted-foreground">Total</p>
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
                <p className="text-2xl font-bold">{stats?.active ?? 0}</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <EyeOff className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.hidden ?? 0}</p>
                <p className="text-sm text-muted-foreground">Hidden</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.deleted ?? 0}</p>
                <p className="text-sm text-muted-foreground">Deleted</p>
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
                <p className="text-2xl font-bold">
                  {stats?.averageRating?.toFixed(1) ?? "0.0"}
                </p>
                <p className="text-sm text-muted-foreground">Avg Rating</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search reviews..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="hidden">Hidden</TabsTrigger>
            <TabsTrigger value="deleted">Deleted</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Review</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReviews.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-muted-foreground">No reviews found</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredReviews.map((review) => (
                  <TableRow key={review.id}>
                    <TableCell>
                      <div className="max-w-xs">
                        <div className="flex items-center gap-2 mb-1">
                          <User className="w-3 h-3 text-gray-400" />
                          <span className="text-sm font-medium">
                            {review.buyer_name || "Anonymous"}
                          </span>
                          {review.is_verified_purchase && (
                            <Badge variant="outline" className="text-xs">
                              Verified
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {review.comment}
                        </p>
                        {review.vendor_reply && (
                          <div className="mt-1 text-xs text-green-600 flex items-center gap-1">
                            <Store className="w-3 h-3" />
                            Vendor replied
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/product/${review.product_id}`}
                        className="text-sm hover:underline"
                      >
                        {review.product_name || "Product"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3 h-3 ${
                              i < review.rating
                                ? "text-yellow-400 fill-current"
                                : "text-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(review.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(review.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={actionLoading === review.id}
                          >
                            {actionLoading === review.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="w-4 h-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setSelectedReview(review)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          {review.status === "active" && (
                            <DropdownMenuItem
                              onClick={() => handleModerate(review.id, "hide")}
                            >
                              <EyeOff className="w-4 h-4 mr-2" />
                              Hide Review
                            </DropdownMenuItem>
                          )}
                          {review.status === "hidden" && (
                            <DropdownMenuItem
                              onClick={() => handleModerate(review.id, "unhide")}
                            >
                              <RotateCcw className="w-4 h-4 mr-2" />
                              Restore Review
                            </DropdownMenuItem>
                          )}
                          {review.status !== "deleted" && (
                            <DropdownMenuItem
                              onClick={() => handleModerate(review.id, "delete")}
                              className="text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete Review
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedReview} onOpenChange={() => setSelectedReview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Details</DialogTitle>
          </DialogHeader>
          {selectedReview && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-gray-400" />
                </div>
                <div>
                  <p className="font-semibold">
                    {selectedReview.buyer_name || "Anonymous"}
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${
                            i < selectedReview.rating
                              ? "text-yellow-400 fill-current"
                              : "text-gray-300"
                          }`}
                        />
                      ))}
                    </div>
                    {selectedReview.is_verified_purchase && (
                      <Badge variant="outline" className="text-xs">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Verified Purchase
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium mb-1">Product</p>
                <Link
                  href={`/product/${selectedReview.product_id}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {selectedReview.product_name || "View Product"}
                </Link>
              </div>

              <div>
                <p className="text-sm font-medium mb-1">Comment</p>
                <p className="text-gray-700">{selectedReview.comment}</p>
              </div>

              {selectedReview.vendor_reply && (
                <div className="p-3 bg-green-50 rounded-lg border-l-4 border-green-400">
                  <div className="flex items-center gap-2 mb-1">
                    <Store className="w-4 h-4 text-green-600" />
                    <span className="font-semibold text-sm text-green-800">
                      Vendor Response
                    </span>
                  </div>
                  <p className="text-sm text-green-800">
                    {selectedReview.vendor_reply}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  Created: {new Date(selectedReview.created_at).toLocaleString()}
                </span>
                {getStatusBadge(selectedReview.status)}
              </div>

              <div className="flex gap-2 pt-4 border-t">
                {selectedReview.status === "active" && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      handleModerate(selectedReview.id, "hide");
                      setSelectedReview(null);
                    }}
                  >
                    <EyeOff className="w-4 h-4 mr-2" />
                    Hide
                  </Button>
                )}
                {selectedReview.status === "hidden" && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      handleModerate(selectedReview.id, "unhide");
                      setSelectedReview(null);
                    }}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Restore
                  </Button>
                )}
                {selectedReview.status !== "deleted" && (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      handleModerate(selectedReview.id, "delete");
                      setSelectedReview(null);
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
