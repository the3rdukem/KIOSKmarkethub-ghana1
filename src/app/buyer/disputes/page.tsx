"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils/currency";
import { SiteLayout } from "@/components/layout/site-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  CheckCircle,
  Eye,
  Loader2,
  RefreshCw,
  Scale,
  MessageSquare,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { EvidenceGallery } from "@/components/ui/image-lightbox";

interface Dispute {
  id: string;
  order_id: string;
  buyer_id: string;
  buyer_name: string;
  buyer_email: string;
  vendor_id: string;
  vendor_name: string;
  product_id: string | null;
  product_name: string | null;
  amount: number | null;
  type: string;
  status: string;
  priority: string;
  description: string | null;
  evidence: string[];
  resolution: string | null;
  resolution_type?: string;
  refund_amount?: number;
  refund_status?: string;
  refunded_at?: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  messages?: Array<{
    id: string;
    senderId: string;
    senderName: string;
    senderRole: string;
    message: string;
    timestamp: string;
  }>;
}

export default function BuyerDisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [replyMessage, setReplyMessage] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const fetchDisputes = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/buyer/disputes");
      if (!response.ok) throw new Error("Failed to fetch disputes");
      
      const data = await response.json();
      setDisputes(data.disputes || []);
    } catch (error) {
      console.error("Error fetching disputes:", error);
      toast.error("Could not load disputes. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisputes();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge variant="destructive">Open</Badge>;
      case "investigating":
        return <Badge variant="secondary">Under Review</Badge>;
      case "resolved":
        return <Badge className="bg-green-600">Resolved</Badge>;
      case "escalated":
        return <Badge variant="outline" className="border-orange-400 text-orange-600">Escalated</Badge>;
      case "closed":
        return <Badge variant="outline">Closed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      refund: "Refund Request",
      quality: "Quality Issue",
      delivery: "Delivery Issue",
      fraud: "Fraud Report",
      other: "Other",
    };
    return labels[type] || type;
  };

  const getResolutionTypeLabel = (type: string | undefined) => {
    if (!type) return "N/A";
    const labels: Record<string, string> = {
      full_refund: "Full Refund",
      partial_refund: "Partial Refund",
      replacement: "Replacement",
      no_action: "No Action Required",
      other: "Other",
    };
    return labels[type] || type;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const handleSendReply = async () => {
    if (!selectedDispute || !replyMessage.trim()) {
      toast.error("Please enter a message");
      return;
    }

    if (replyMessage.trim().length < 5) {
      toast.error("Message must be at least 5 characters");
      return;
    }

    try {
      setSendingReply(true);
      const response = await fetch(`/api/buyer/disputes/${selectedDispute.id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: replyMessage.trim() }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send message");
      }
      
      const data = await response.json();
      setSelectedDispute(data.dispute);
      setReplyMessage("");
      toast.success("Message sent");
      fetchDisputes();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSendingReply(false);
    }
  };

  const stats = {
    total: disputes.length,
    open: disputes.filter(d => d.status === "open" || d.status === "investigating").length,
    resolved: disputes.filter(d => d.status === "resolved").length,
    refunded: disputes.filter(d => d.refund_status === "completed").length,
  };

  return (
    <SiteLayout>
      <div className="container py-8 space-y-6">
        <div className="mb-8">
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link href="/buyer/orders">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Orders
            </Link>
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">My Disputes</h1>
              <p className="text-muted-foreground text-sm sm:text-base">Track the status of your dispute cases</p>
            </div>
            <Button onClick={fetchDisputes} variant="outline" size="sm" disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline ml-2">Refresh</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Disputes</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Scale className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.open}</p>
                </div>
                <Clock className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Resolved</p>
                  <p className="text-2xl font-bold text-green-600">{stats.resolved}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Refunded</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.refunded}</p>
                </div>
                <CreditCard className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Dispute History</CardTitle>
            <CardDescription>All your dispute cases and their current status</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : disputes.length === 0 ? (
              <div className="text-center py-12">
                <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Disputes</h3>
                <p className="text-muted-foreground mb-4">
                  You haven't raised any disputes yet. If you have an issue with an order, 
                  you can raise a dispute from your order details page within 48 hours of delivery.
                </p>
                <Button asChild>
                  <Link href="/buyer/orders">View My Orders</Link>
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dispute ID</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {disputes.map((dispute) => (
                    <TableRow key={dispute.id}>
                      <TableCell className="font-medium">{dispute.id}</TableCell>
                      <TableCell>
                        <Link href={`/buyer/orders/${dispute.order_id}`} className="text-blue-600 hover:underline">
                          {dispute.order_id}
                        </Link>
                      </TableCell>
                      <TableCell>{getTypeLabel(dispute.type)}</TableCell>
                      <TableCell>{dispute.vendor_name}</TableCell>
                      <TableCell>
                        {dispute.amount ? formatCurrency(dispute.amount) : "N/A"}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {getStatusBadge(dispute.status)}
                          {dispute.refund_status === "completed" && (
                            <Badge className="bg-green-100 text-green-700 ml-1">Refunded</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(dispute.created_at)}</TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setSelectedDispute(dispute);
                            setDetailsOpen(true);
                          }}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Dispute Details</DialogTitle>
              <DialogDescription>
                Dispute ID: {selectedDispute?.id}
              </DialogDescription>
            </DialogHeader>
            {selectedDispute && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <div className="mt-1">{getStatusBadge(selectedDispute.status)}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Type</Label>
                    <p>{getTypeLabel(selectedDispute.type)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Order ID</Label>
                    <p>
                      <Link href={`/buyer/orders/${selectedDispute.order_id}`} className="text-blue-600 hover:underline">
                        {selectedDispute.order_id}
                      </Link>
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Disputed Amount</Label>
                    <p>{selectedDispute.amount ? formatCurrency(selectedDispute.amount) : "N/A"}</p>
                  </div>
                </div>

                <div>
                  <Label className="text-muted-foreground">Vendor</Label>
                  <p>{selectedDispute.vendor_name}</p>
                </div>

                {selectedDispute.product_name && (
                  <div>
                    <Label className="text-muted-foreground">Product</Label>
                    <p>{selectedDispute.product_name}</p>
                  </div>
                )}

                <div>
                  <Label className="text-muted-foreground">Issue Description</Label>
                  <p className="text-sm mt-1 p-3 bg-muted rounded-md">
                    {selectedDispute.description || "No description provided"}
                  </p>
                </div>

                {selectedDispute.evidence && selectedDispute.evidence.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground">Evidence Photos ({selectedDispute.evidence.length})</Label>
                    <div className="mt-2">
                      <EvidenceGallery images={selectedDispute.evidence} />
                    </div>
                  </div>
                )}

                {selectedDispute.messages && selectedDispute.messages.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground">Conversation History ({selectedDispute.messages.length})</Label>
                    <div className="mt-2 space-y-3 max-h-60 overflow-y-auto p-3 bg-gray-50 rounded-lg border">
                      {selectedDispute.messages.map((msg, index) => (
                        <div 
                          key={msg.id || index}
                          className={`p-3 rounded-lg ${
                            msg.senderRole === 'vendor' 
                              ? 'bg-blue-50 border border-blue-200 ml-4' 
                              : msg.senderRole === 'admin'
                              ? 'bg-purple-50 border border-purple-200'
                              : 'bg-white border mr-4'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className={`text-xs font-medium ${
                              msg.senderRole === 'vendor' 
                                ? 'text-blue-700' 
                                : msg.senderRole === 'admin'
                                ? 'text-purple-700'
                                : 'text-gray-700'
                            }`}>
                              {msg.senderRole === 'admin' ? 'KIOSK Support' : msg.senderName} ({msg.senderRole === 'admin' ? 'Support' : msg.senderRole})
                            </span>
                            <span className="text-xs text-gray-400">
                              {formatDate(msg.timestamp)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700">{msg.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedDispute.status !== 'resolved' && selectedDispute.status !== 'closed' && (
                  <div>
                    <Label className="text-muted-foreground">Reply</Label>
                    <div className="mt-2 space-y-2">
                      <Textarea
                        placeholder="Add more details or respond to the vendor/support..."
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        rows={3}
                        className="resize-none"
                      />
                      <Button 
                        onClick={handleSendReply} 
                        disabled={sendingReply || !replyMessage.trim()}
                        size="sm"
                      >
                        {sendingReply ? "Sending..." : "Send Message"}
                      </Button>
                    </div>
                  </div>
                )}

                {selectedDispute.status === "resolved" && (
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <h4 className="font-medium text-green-800 mb-2 flex items-center">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Resolution
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <Label className="text-green-700">Resolution Type</Label>
                        <p className="text-green-900">{getResolutionTypeLabel(selectedDispute.resolution_type)}</p>
                      </div>
                      {selectedDispute.refund_amount && (
                        <div>
                          <Label className="text-green-700">Refund Amount</Label>
                          <p className="text-green-900 font-medium">{formatCurrency(selectedDispute.refund_amount)}</p>
                        </div>
                      )}
                    </div>
                    {selectedDispute.resolution && (
                      <div className="mt-3">
                        <Label className="text-green-700">Resolution Notes</Label>
                        <p className="text-green-900 text-sm mt-1">{selectedDispute.resolution}</p>
                      </div>
                    )}
                    {selectedDispute.resolved_at && (
                      <p className="text-xs text-green-600 mt-2">
                        Resolved on {formatDate(selectedDispute.resolved_at)}
                      </p>
                    )}
                  </div>
                )}

                {selectedDispute.refund_status === "completed" && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="font-medium text-blue-800 mb-2 flex items-center">
                      <CreditCard className="w-4 h-4 mr-2" />
                      Refund Processed
                    </h4>
                    <p className="text-blue-700 text-sm">
                      A refund of {selectedDispute.refund_amount ? formatCurrency(selectedDispute.refund_amount) : "N/A"} has been processed 
                      and will be credited to your original payment method.
                    </p>
                    {selectedDispute.refunded_at && (
                      <p className="text-xs text-blue-600 mt-2">
                        Processed on {formatDate(selectedDispute.refunded_at)}
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                  <div>
                    <Label>Opened</Label>
                    <p>{formatDate(selectedDispute.created_at)}</p>
                  </div>
                  <div>
                    <Label>Last Updated</Label>
                    <p>{formatDate(selectedDispute.updated_at)}</p>
                  </div>
                </div>

                {(selectedDispute.status === "open" || selectedDispute.status === "investigating") && (
                  <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <h4 className="font-medium text-yellow-800 flex items-center">
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Under Review
                    </h4>
                    <p className="text-yellow-700 text-sm mt-1">
                      Your dispute is being reviewed by our team. We typically resolve disputes 
                      within 24-48 hours. You will be notified once a resolution is reached.
                    </p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </SiteLayout>
  );
}
