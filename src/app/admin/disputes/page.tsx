"use client";

import { useState, useEffect, useCallback } from "react";
import { SiteLayout } from "@/components/layout/site-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertTriangle,
  Clock,
  CheckCircle,
  Search,
  MoreHorizontal,
  CreditCard,
  Scale,
  MessageSquare,
  Loader2,
  RefreshCw,
  Eye,
  ArrowUpCircle,
  XCircle,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
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
  assigned_to: string | null;
  messages: Array<{
    id: string;
    senderId: string;
    senderName: string;
    senderRole: string;
    message: string;
    timestamp: string;
  }>;
  resolved_at: string | null;
  resolved_by?: string;
  refund_status?: string;
  created_at: string;
  updated_at: string;
}

interface DisputeStats {
  total: number;
  open: number;
  investigating: number;
  resolved: number;
  escalated: number;
  byPriority: { urgent: number; high: number; medium: number; low: number };
  avgResolutionTimeHours: number | null;
}

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [stats, setStats] = useState<DisputeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolutionType, setResolutionType] = useState("");
  const [resolutionText, setResolutionText] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDisputes = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (priorityFilter !== "all") params.append("priority", priorityFilter);
      
      const response = await fetch(`/api/admin/disputes?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch disputes");
      
      const data = await response.json();
      setDisputes(data.disputes || []);
      setStats(data.stats || null);
    } catch (error) {
      console.error("Error fetching disputes:", error);
      toast.error("Failed to load disputes");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter]);

  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  const filteredDisputes = disputes.filter(dispute => {
    const matchesSearch = searchQuery === "" ||
      dispute.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dispute.order_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dispute.buyer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dispute.vendor_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const handleUpdateStatus = async (disputeId: string, newStatus: string) => {
    try {
      setActionLoading(true);
      const response = await fetch(`/api/admin/disputes/${disputeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      
      if (!response.ok) throw new Error("Failed to update status");
      
      toast.success("Status updated");
      fetchDisputes();
    } catch (error) {
      toast.error("Failed to update status");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdatePriority = async (disputeId: string, newPriority: string) => {
    try {
      setActionLoading(true);
      const response = await fetch(`/api/admin/disputes/${disputeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: newPriority }),
      });
      
      if (!response.ok) throw new Error("Failed to update priority");
      
      toast.success("Priority updated");
      fetchDisputes();
    } catch (error) {
      toast.error("Failed to update priority");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedDispute || !resolutionType || !resolutionText) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      setActionLoading(true);
      const response = await fetch(`/api/admin/disputes/${selectedDispute.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resolve",
          resolutionType,
          resolution: resolutionText,
          refundAmount: refundAmount ? parseFloat(refundAmount) : undefined,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to resolve dispute");
      }
      
      toast.success("Dispute resolved");
      setResolveOpen(false);
      setResolutionType("");
      setResolutionText("");
      setRefundAmount("");
      setSelectedDispute(null);
      fetchDisputes();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEscalate = async (disputeId: string) => {
    try {
      setActionLoading(true);
      const response = await fetch(`/api/admin/disputes/${disputeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "escalate", reason: "Escalated by admin" }),
      });
      
      if (!response.ok) throw new Error("Failed to escalate");
      
      toast.success("Dispute escalated");
      fetchDisputes();
    } catch (error) {
      toast.error("Failed to escalate");
    } finally {
      setActionLoading(false);
    }
  };

  const handleClose = async (disputeId: string) => {
    try {
      setActionLoading(true);
      const response = await fetch(`/api/admin/disputes/${disputeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close", reason: "Closed by admin" }),
      });
      
      if (!response.ok) throw new Error("Failed to close");
      
      toast.success("Dispute closed");
      fetchDisputes();
    } catch (error) {
      toast.error("Failed to close");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge variant="destructive">Open</Badge>;
      case "investigating":
        return <Badge variant="secondary">Investigating</Badge>;
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
        return <Badge variant="outline" className="border-red-400 text-red-600">High</Badge>;
      case "medium":
        return <Badge variant="outline" className="border-yellow-400 text-yellow-600">Medium</Badge>;
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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <SiteLayout>
      <div className="container py-8">
        <div className="mb-8">
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
            <Link href="/admin">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Link>
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Dispute Resolution Center</h1>
              <p className="text-muted-foreground text-sm sm:text-base">Manage and resolve marketplace disputes</p>
            </div>
            <Button onClick={fetchDisputes} variant="outline" disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="space-y-6">

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Disputes</p>
                <p className="text-2xl font-bold">{stats?.total || 0}</p>
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
                <p className="text-2xl font-bold text-red-600">{stats?.open || 0}</p>
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
                <p className="text-2xl font-bold text-orange-600">{stats?.investigating || 0}</p>
              </div>
              <MessageSquare className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Resolved</p>
                <p className="text-2xl font-bold text-green-600">{stats?.resolved || 0}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Resolution</p>
                <p className="text-2xl font-bold">
                  {stats?.avgResolutionTimeHours 
                    ? `${Math.round(stats.avgResolutionTimeHours)}h` 
                    : "N/A"}
                </p>
              </div>
              <Clock className="w-8 h-8 text-gray-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search by ID, order, buyer, or vendor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="investigating">Investigating</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="escalated">Escalated</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Disputes ({filteredDisputes.length})</CardTitle>
          <CardDescription>Review and resolve marketplace disputes</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredDisputes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No disputes found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dispute</TableHead>
                  <TableHead>Order / Amount</TableHead>
                  <TableHead>Parties</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDisputes.map((dispute) => (
                  <TableRow key={dispute.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{dispute.id}</p>
                        <p className="text-xs text-muted-foreground">{getTypeLabel(dispute.type)}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{dispute.order_id}</p>
                        {dispute.amount && (
                          <p className="text-sm text-green-600">GHS {dispute.amount.toFixed(2)}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p><span className="text-muted-foreground">Buyer:</span> {dispute.buyer_name}</p>
                        <p><span className="text-muted-foreground">Vendor:</span> {dispute.vendor_name}</p>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(dispute.status)}</TableCell>
                    <TableCell>{getPriorityBadge(dispute.priority)}</TableCell>
                    <TableCell className="text-sm">{formatDate(dispute.created_at)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" disabled={actionLoading}>
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setSelectedDispute(dispute);
                            setDetailsOpen(true);
                          }}>
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {dispute.status === "open" && (
                            <DropdownMenuItem onClick={() => handleUpdateStatus(dispute.id, "investigating")}>
                              <MessageSquare className="w-4 h-4 mr-2" />
                              Start Investigation
                            </DropdownMenuItem>
                          )}
                          {(dispute.status === "open" || dispute.status === "investigating") && (
                            <>
                              <DropdownMenuItem onClick={() => {
                                setSelectedDispute(dispute);
                                setRefundAmount(dispute.amount?.toString() || "");
                                setResolveOpen(true);
                              }}>
                                <CreditCard className="w-4 h-4 mr-2" />
                                Resolve Dispute
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEscalate(dispute.id)}>
                                <ArrowUpCircle className="w-4 h-4 mr-2" />
                                Escalate
                              </DropdownMenuItem>
                            </>
                          )}
                          {dispute.status !== "closed" && dispute.status !== "resolved" && (
                            <DropdownMenuItem onClick={() => handleClose(dispute.id)}>
                              <XCircle className="w-4 h-4 mr-2" />
                              Close Without Resolution
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleUpdatePriority(dispute.id, "urgent")}>
                            Mark Urgent
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleUpdatePriority(dispute.id, "high")}>
                            Mark High Priority
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
            <DialogTitle>Dispute Details - {selectedDispute?.id}</DialogTitle>
            <DialogDescription>
              Order: {selectedDispute?.order_id}
            </DialogDescription>
          </DialogHeader>
          {selectedDispute && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <p>{getStatusBadge(selectedDispute.status)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Priority</Label>
                  <p>{getPriorityBadge(selectedDispute.priority)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Type</Label>
                  <p>{getTypeLabel(selectedDispute.type)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Amount</Label>
                  <p>GHS {selectedDispute.amount?.toFixed(2) || "N/A"}</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Buyer</Label>
                <p>{selectedDispute.buyer_name} ({selectedDispute.buyer_email})</p>
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
                <Label className="text-muted-foreground">Description</Label>
                <p className="text-sm">{selectedDispute.description || "No description provided"}</p>
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
                            {msg.senderName} ({msg.senderRole})
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
              {selectedDispute.resolution && (
                <div>
                  <Label className="text-muted-foreground">Resolution</Label>
                  <p className="text-sm">{selectedDispute.resolution}</p>
                  {selectedDispute.refund_amount && (
                    <p className="text-sm text-green-600">Refund: GHS {selectedDispute.refund_amount.toFixed(2)}</p>
                  )}
                </div>
              )}
              <div>
                <Label className="text-muted-foreground">Timeline</Label>
                <p className="text-sm">Created: {formatDate(selectedDispute.created_at)}</p>
                {selectedDispute.resolved_at && (
                  <p className="text-sm">Resolved: {formatDate(selectedDispute.resolved_at)}</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Dispute</DialogTitle>
            <DialogDescription>
              Choose how to resolve this dispute for order {selectedDispute?.order_id}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Resolution Type</Label>
              <Select value={resolutionType} onValueChange={setResolutionType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select resolution type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_refund">Full Refund</SelectItem>
                  <SelectItem value="partial_refund">Partial Refund</SelectItem>
                  <SelectItem value="replacement">Replacement</SelectItem>
                  <SelectItem value="no_action">No Action Required</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(resolutionType === "full_refund" || resolutionType === "partial_refund") && (
              <div>
                <Label>Refund Amount (GHS)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder="Enter refund amount"
                />
              </div>
            )}
            <div>
              <Label>Resolution Notes</Label>
              <Textarea
                value={resolutionText}
                onChange={(e) => setResolutionText(e.target.value)}
                placeholder="Explain the resolution decision..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleResolve} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Resolve Dispute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </div>
      </div>
    </SiteLayout>
  );
}
