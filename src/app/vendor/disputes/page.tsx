"use client";

import { useState, useEffect } from "react";
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
  Clock,
  CheckCircle,
  Eye,
  Loader2,
  RefreshCw,
  Scale,
  MessageSquare,
  Package,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { EvidenceGallery } from "@/components/ui/image-lightbox";
import Link from "next/link";

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
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  messages: Array<{
    id: string;
    senderId: string;
    senderName: string;
    senderRole: string;
    message: string;
    timestamp: string;
  }>;
}

export default function VendorDisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [replyMessage, setReplyMessage] = useState("");
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  const fetchDisputes = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/vendor/disputes");
      if (!response.ok) throw new Error("Failed to fetch disputes");
      
      const data = await response.json();
      setDisputes(data.disputes || []);
    } catch (error) {
      console.error("Error fetching disputes:", error);
      toast.error("Failed to load disputes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisputes();
  }, []);

  const handleSubmitReply = async () => {
    if (!selectedDispute || !replyMessage.trim()) return;
    
    setIsSubmittingReply(true);
    try {
      const response = await fetch(`/api/vendor/disputes/${selectedDispute.id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: replyMessage.trim() }),
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to send response");
      }
      
      toast.success("Your response has been sent to the support team.");
      setReplyMessage("");
      
      if (data.dispute) {
        setSelectedDispute(data.dispute);
        setDisputes(prev => prev.map(d => d.id === data.dispute.id ? data.dispute : d));
      }
    } catch (error) {
      console.error("Error submitting reply:", error);
      toast.error(error instanceof Error ? error.message : "Failed to send response. Please try again.");
    } finally {
      setIsSubmittingReply(false);
    }
  };

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

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <Badge variant="destructive">Urgent</Badge>;
      case "high":
        return <Badge variant="default" className="bg-orange-500">High</Badge>;
      case "medium":
        return <Badge variant="secondary">Medium</Badge>;
      case "low":
        return <Badge variant="outline">Low</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
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

  const stats = {
    total: disputes.length,
    open: disputes.filter(d => d.status === "open").length,
    investigating: disputes.filter(d => d.status === "investigating").length,
    resolved: disputes.filter(d => d.status === "resolved").length,
  };

  return (
    <SiteLayout>
      <div className="container py-8 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Disputes</h1>
            <p className="text-muted-foreground">View and respond to customer disputes</p>
          </div>
          <Button onClick={fetchDisputes} variant="outline" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
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
                  <p className="text-sm text-muted-foreground">Open</p>
                  <p className="text-2xl font-bold text-red-600">{stats.open}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Investigating</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.investigating}</p>
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
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Dispute Cases</CardTitle>
            <CardDescription>Customer disputes against your orders</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : disputes.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Disputes</h3>
                <p className="text-muted-foreground mb-4">
                  Great news! You have no customer disputes. Keep up the good work!
                </p>
                <Button asChild>
                  <Link href="/vendor/orders">View My Orders</Link>
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dispute ID</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Buyer</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {disputes.map((dispute) => (
                    <TableRow key={dispute.id}>
                      <TableCell className="font-medium font-mono text-sm">
                        {dispute.id.slice(-8)}
                      </TableCell>
                      <TableCell>
                        <Link 
                          href={`/vendor/orders`} 
                          className="text-blue-600 hover:underline"
                        >
                          {dispute.order_id.slice(-8)}
                        </Link>
                      </TableCell>
                      <TableCell>{dispute.buyer_name}</TableCell>
                      <TableCell>{getTypeLabel(dispute.type)}</TableCell>
                      <TableCell>{getPriorityBadge(dispute.priority)}</TableCell>
                      <TableCell>{getStatusBadge(dispute.status)}</TableCell>
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
                          View
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
          <DialogContent className="max-w-2xl">
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
                    <Label className="text-muted-foreground">Priority</Label>
                    <div className="mt-1">{getPriorityBadge(selectedDispute.priority)}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Type</Label>
                    <p>{getTypeLabel(selectedDispute.type)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Disputed Amount</Label>
                    <p className="font-medium">GHS {selectedDispute.amount?.toFixed(2) || "N/A"}</p>
                  </div>
                </div>

                <div>
                  <Label className="text-muted-foreground">Buyer</Label>
                  <p>{selectedDispute.buyer_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedDispute.buyer_email}</p>
                </div>

                {selectedDispute.product_name && (
                  <div>
                    <Label className="text-muted-foreground">Product</Label>
                    <p>{selectedDispute.product_name}</p>
                  </div>
                )}

                <div>
                  <Label className="text-muted-foreground">Customer Complaint</Label>
                  <p className="text-sm mt-1 p-3 bg-red-50 rounded-md border border-red-100">
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
                          <p className="text-green-900 font-medium">GHS {selectedDispute.refund_amount.toFixed(2)}</p>
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

                {selectedDispute.messages && selectedDispute.messages.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground">Conversation History</Label>
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
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-xs font-medium ${
                              msg.senderRole === 'vendor' ? 'text-blue-700' : 
                              msg.senderRole === 'admin' ? 'text-purple-700' : 'text-gray-700'
                            }`}>
                              {msg.senderName} ({msg.senderRole === 'vendor' ? 'You' : msg.senderRole === 'admin' ? 'Support' : 'Buyer'})
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

                {(selectedDispute.status === "open" || selectedDispute.status === "investigating") && (
                  <div className="space-y-3">
                    <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                      <h4 className="font-medium text-yellow-800 flex items-center">
                        <MessageSquare className="w-4 h-4 mr-2" />
                        {selectedDispute.status === "open" ? "Pending Review" : "Under Investigation"}
                      </h4>
                      <p className="text-yellow-700 text-sm mt-1">
                        This dispute is being reviewed by our support team. You can respond below with additional information.
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="reply">Your Response</Label>
                      <Textarea
                        id="reply"
                        placeholder="Provide additional information, explain your position, or offer a resolution..."
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        rows={3}
                        maxLength={2000}
                        className="resize-none"
                      />
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">
                          {replyMessage.length}/2000 characters
                        </span>
                        <Button
                          onClick={handleSubmitReply}
                          disabled={isSubmittingReply || replyMessage.trim().length < 5}
                          size="sm"
                        >
                          {isSubmittingReply ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <MessageSquare className="w-4 h-4 mr-2" />
                              Send Response
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
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
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </SiteLayout>
  );
}
