"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
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
  XCircle,
  Eye,
  MessageSquare,
  Upload,
  Download,
  Filter,
  Search,
  MoreHorizontal,
  Package,
  CreditCard,
  Scale,
  User,
  Calendar,
  DollarSign,
  FileText,
  Camera,
  Gavel,
  Flag,
  TrendingUp,
  Shield
} from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";

interface Dispute {
  id: string;
  orderId: string;
  buyerName: string;
  buyerAvatar?: string;
  vendorName: string;
  vendorAvatar?: string;
  productName: string;
  orderAmount: number;
  disputeType: "product_issue" | "delivery_delay" | "payment_issue" | "quality_concern" | "other";
  reason: string;
  status: "open" | "in_mediation" | "resolved" | "escalated" | "closed";
  priority: "low" | "medium" | "high" | "critical";
  createdAt: Date;
  deadline: Date;
  evidenceCount: number;
  messagesCount: number;
  assignedAdmin?: string;
  resolution?: {
    type: "refund" | "replacement" | "partial_refund" | "no_action";
    amount?: number;
    description: string;
    resolvedBy: string;
    resolvedAt: Date;
  };
}

const mockDisputes: Dispute[] = [
  {
    id: "DSP-001",
    orderId: "ORD-2025-001234",
    buyerName: "John Kwame Asante",
    buyerAvatar: "/placeholder-avatar.jpg",
    vendorName: "TechStore Pro",
    vendorAvatar: "/placeholder-avatar.jpg",
    productName: "iPhone 15 Pro Max 256GB",
    orderAmount: 4200,
    disputeType: "product_issue",
    reason: "Product received with screen damage",
    status: "open",
    priority: "high",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    evidenceCount: 3,
    messagesCount: 7
  },
  {
    id: "DSP-002",
    orderId: "ORD-2025-001235",
    buyerName: "Ama Osei",
    buyerAvatar: "/placeholder-avatar.jpg",
    vendorName: "Fashion Hub GH",
    vendorAvatar: "/placeholder-avatar.jpg",
    productName: "Traditional Kente Dress",
    orderAmount: 350,
    disputeType: "delivery_delay",
    reason: "Order not delivered after 2 weeks",
    status: "in_mediation",
    priority: "medium",
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    evidenceCount: 1,
    messagesCount: 12,
    assignedAdmin: "Admin Sarah"
  },
  {
    id: "DSP-003",
    orderId: "ORD-2025-001236",
    buyerName: "Kofi Mensah",
    buyerAvatar: "/placeholder-avatar.jpg",
    vendorName: "ElectroMart",
    vendorAvatar: "/placeholder-avatar.jpg",
    productName: "Bluetooth Speaker",
    orderAmount: 120,
    disputeType: "quality_concern",
    reason: "Speaker stops working after 1 day",
    status: "resolved",
    priority: "low",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    deadline: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    evidenceCount: 2,
    messagesCount: 8,
    assignedAdmin: "Admin John",
    resolution: {
      type: "refund",
      amount: 120,
      description: "Full refund approved due to product defect",
      resolvedBy: "Admin John",
      resolvedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    }
  }
];

interface DisputeCenterProps {
  userType: "buyer" | "vendor" | "admin";
}

export function DisputeCenter({ userType }: DisputeCenterProps) {
  const [disputes, setDisputes] = useState<Dispute[]>(mockDisputes);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [newDisputeOpen, setNewDisputeOpen] = useState(false);

  const filteredDisputes = disputes.filter(dispute => {
    const matchesSearch = dispute.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         dispute.orderId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         dispute.productName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || dispute.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || dispute.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge variant="destructive">Open</Badge>;
      case "in_mediation":
        return <Badge variant="secondary">In Mediation</Badge>;
      case "resolved":
        return <Badge variant="default">Resolved</Badge>;
      case "escalated":
        return <Badge variant="outline" className="border-orange-300 text-orange-700">Escalated</Badge>;
      case "closed":
        return <Badge variant="outline">Closed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "critical":
        return <Badge variant="destructive">Critical</Badge>;
      case "high":
        return <Badge variant="outline" className="border-red-300 text-red-700">High</Badge>;
      case "medium":
        return <Badge variant="outline" className="border-yellow-300 text-yellow-700">Medium</Badge>;
      case "low":
        return <Badge variant="outline">Low</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const getDisputeTypeLabel = (type: string) => {
    switch (type) {
      case "product_issue":
        return "Product Issue";
      case "delivery_delay":
        return "Delivery Delay";
      case "payment_issue":
        return "Payment Issue";
      case "quality_concern":
        return "Quality Concern";
      default:
        return "Other";
    }
  };

  const formatTimeRemaining = (deadline: Date) => {
    const now = new Date();
    const diff = deadline.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (diff < 0) return "Overdue";
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  const stats = {
    total: disputes.length,
    open: disputes.filter(d => d.status === "open").length,
    inMediation: disputes.filter(d => d.status === "in_mediation").length,
    resolved: disputes.filter(d => d.status === "resolved").length,
    avgResolutionTime: "2.5 days"
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Dispute Resolution Center</h2>
          <p className="text-muted-foreground">
            {userType === "admin"
              ? "Manage and resolve marketplace disputes"
              : "View and manage your dispute cases"}
          </p>
        </div>
        <div className="flex gap-3">
          {userType === "buyer" && (
            <Dialog open={newDisputeOpen} onOpenChange={setNewDisputeOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Flag className="w-4 h-4 mr-2" />
                  Open Dispute
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Open a New Dispute</DialogTitle>
                  <DialogDescription>
                    Report an issue with your order. We'll help resolve it fairly.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="orderId">Order ID</Label>
                      <Input id="orderId" placeholder="ORD-2025-001234" />
                    </div>
                    <div>
                      <Label htmlFor="disputeType">Dispute Type</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="product_issue">Product Issue</SelectItem>
                          <SelectItem value="delivery_delay">Delivery Delay</SelectItem>
                          <SelectItem value="payment_issue">Payment Issue</SelectItem>
                          <SelectItem value="quality_concern">Quality Concern</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="reason">Describe the Issue</Label>
                    <Textarea
                      id="reason"
                      placeholder="Please provide a detailed description of the issue..."
                      className="min-h-[100px]"
                    />
                  </div>

                  <div>
                    <Label>Upload Evidence</Label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Upload photos, screenshots, or documents
                      </p>
                      <Button variant="outline" size="sm" className="mt-2">
                        Choose Files
                      </Button>
                    </div>
                  </div>

                  <Alert>
                    <Shield className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Fair Resolution Process:</strong> Our team will review your case and work with both parties to reach a fair resolution within 7 days.
                    </AlertDescription>
                  </Alert>

                  <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => setNewDisputeOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={() => setNewDisputeOpen(false)}>
                      Submit Dispute
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {userType === "admin" && (
            <Button variant="outline">
              <TrendingUp className="w-4 h-4 mr-2" />
              Analytics
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
                <p className="text-sm text-muted-foreground">Open Cases</p>
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
                <p className="text-sm text-muted-foreground">In Mediation</p>
                <p className="text-2xl font-bold text-orange-600">{stats.inMediation}</p>
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
                <p className="text-sm text-muted-foreground">Avg Resolution</p>
                <p className="text-2xl font-bold">{stats.avgResolutionTime}</p>
              </div>
              <Clock className="w-8 h-8 text-gray-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search by dispute ID, order ID, or product..."
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
                <SelectItem value="in_mediation">In Mediation</SelectItem>
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
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Disputes Table */}
      <Card>
        <CardHeader>
          <CardTitle>Dispute Cases ({filteredDisputes.length})</CardTitle>
          <CardDescription>
            {userType === "admin"
              ? "Review and resolve marketplace disputes"
              : "Track the status of your dispute cases"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dispute Info</TableHead>
                <TableHead>Parties</TableHead>
                <TableHead>Order Details</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Timeline</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDisputes.map((dispute) => (
                <TableRow key={dispute.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{dispute.id}</p>
                      <p className="text-sm text-muted-foreground">
                        {getDisputeTypeLabel(dispute.disputeType)}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {dispute.reason}
                      </p>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={dispute.buyerAvatar} />
                          <AvatarFallback>{dispute.buyerName[0]}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{dispute.buyerName}</span>
                        <Badge variant="outline" className="text-xs">Buyer</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={dispute.vendorAvatar} />
                          <AvatarFallback>{dispute.vendorName[0]}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{dispute.vendorName}</span>
                        <Badge variant="outline" className="text-xs">Vendor</Badge>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div>
                      <p className="font-medium">{dispute.orderId}</p>
                      <p className="text-sm text-muted-foreground">{dispute.productName}</p>
                      <p className="text-sm font-medium">{formatCurrency(dispute.orderAmount)}</p>
                    </div>
                  </TableCell>

                  <TableCell>
                    {getStatusBadge(dispute.status)}
                    {dispute.assignedAdmin && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Assigned: {dispute.assignedAdmin}
                      </p>
                    )}
                  </TableCell>

                  <TableCell>{getPriorityBadge(dispute.priority)}</TableCell>

                  <TableCell>
                    <div className="space-y-1">
                      <p className="text-sm">
                        Created: {dispute.createdAt.toLocaleDateString()}
                      </p>
                      <p className="text-sm">
                        Deadline: {formatTimeRemaining(dispute.deadline)}
                      </p>
                      {dispute.resolution && (
                        <p className="text-sm text-green-600">
                          Resolved: {dispute.resolution.resolvedAt.toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <MessageSquare className="w-4 h-4 mr-2" />
                          View Messages ({dispute.messagesCount})
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <FileText className="w-4 h-4 mr-2" />
                          Evidence ({dispute.evidenceCount})
                        </DropdownMenuItem>
                        {userType === "admin" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                              <Gavel className="w-4 h-4 mr-2" />
                              Mediate
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <CreditCard className="w-4 h-4 mr-2" />
                              Process Refund
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
