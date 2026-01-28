"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Smartphone,
  DollarSign,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Wallet,
  Loader2,
  XCircle,
  Building,
  RefreshCw,
  Search,
  Eye,
  Ban
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { formatDistance, format } from "date-fns";
import { toast } from "sonner";

interface PayoutStats {
  total_payouts: number;
  total_amount: number;
  pending_count: number;
  pending_amount: number;
  completed_count: number;
  completed_amount: number;
  failed_count: number;
  failed_amount: number;
}

interface Payout {
  id: string;
  vendor_id: string;
  vendor_name: string;
  reference: string;
  amount: number;
  fee: number;
  net_amount: number;
  status: string;
  bank_account_name: string;
  bank_name?: string;
  mobile_money_provider?: string;
  account_number: string;
  transfer_code?: string;
  created_at: string;
  processed_at?: string;
  failure_reason?: string;
}

export default function AdminPayoutsPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  const [isHydrated, setIsHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  // Data state
  const [stats, setStats] = useState<PayoutStats | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Fetch all data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [statsRes, payoutsRes] = await Promise.all([
        fetch('/api/admin/payouts/stats', { credentials: 'include' }),
        fetch('/api/admin/payouts', { credentials: 'include' }),
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats);
      }

      if (payoutsRes.ok) {
        const data = await payoutsRes.json();
        setPayouts(data.payouts || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load payout data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push("/auth/login");
    }
    if (isHydrated && user && user.role !== "admin") {
      router.push("/");
    }
  }, [isHydrated, isAuthenticated, user, router]);

  useEffect(() => {
    if (isHydrated && user && user.role === "admin") {
      fetchData();
    }
  }, [isHydrated, user, fetchData]);

  if (!isHydrated || isLoading) {
    return (
      <SiteLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </SiteLayout>
    );
  }

  if (!isAuthenticated || !user || user.role !== "admin") {
    return null;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case "processing":
        return <Badge className="bg-blue-100 text-blue-800">Processing</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "failed":
        return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
      case "reversed":
        return <Badge className="bg-orange-100 text-orange-800">Reversed</Badge>;
      case "cancelled":
        return <Badge className="bg-gray-100 text-gray-800">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Filter payouts
  const filteredPayouts = payouts.filter(payout => {
    const matchesSearch = searchQuery === "" || 
      payout.vendor_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payout.reference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payout.bank_account_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || payout.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleRetryPayout = async (payoutId: string) => {
    try {
      const response = await fetch(`/api/admin/payouts/${payoutId}/retry`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to retry payout');
      }

      toast.success('Payout retry initiated');
      fetchData();
    } catch (error) {
      toast.error('Failed to retry payout');
    }
  };

  const handleCancelPayout = async (payoutId: string) => {
    if (!confirm('Are you sure you want to cancel this payout?')) return;

    try {
      const response = await fetch(`/api/admin/payouts/${payoutId}/cancel`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to cancel payout');
      }

      toast.success('Payout cancelled');
      fetchData();
    } catch (error) {
      toast.error('Failed to cancel payout');
    }
  };

  return (
    <SiteLayout>
      <div className="container py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
              <Link href="/admin">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Admin Dashboard
              </Link>
            </Button>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Vendor Payouts</h1>
            <p className="text-muted-foreground text-sm sm:text-base">Manage vendor withdrawal requests</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchData()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Payouts</p>
                  <p className="text-2xl font-bold">{stats?.total_payouts || 0}</p>
                  <p className="text-xs text-muted-foreground">GHS {(stats?.total_amount || 0).toLocaleString()}</p>
                </div>
                <DollarSign className="w-8 h-8 text-gray-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats?.pending_count || 0}</p>
                  <p className="text-xs text-muted-foreground">GHS {(stats?.pending_amount || 0).toLocaleString()}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold text-green-600">{stats?.completed_count || 0}</p>
                  <p className="text-xs text-muted-foreground">GHS {(stats?.completed_amount || 0).toLocaleString()}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Failed</p>
                  <p className="text-2xl font-bold text-red-600">{stats?.failed_count || 0}</p>
                  <p className="text-xs text-muted-foreground">GHS {(stats?.failed_amount || 0).toLocaleString()}</p>
                </div>
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by vendor, reference, or account..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="reversed">Reversed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Payouts Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Payouts</CardTitle>
            <CardDescription>
              {filteredPayouts.length} payout{filteredPayouts.length !== 1 ? 's' : ''} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredPayouts.length === 0 ? (
              <div className="text-center py-12">
                <Wallet className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-muted-foreground">No payouts found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayouts.map((payout) => (
                    <TableRow key={payout.id}>
                      <TableCell className="font-mono text-sm">
                        {payout.reference?.slice(-10).toUpperCase() || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{payout.vendor_name || 'Unknown'}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">GHS {payout.net_amount?.toLocaleString()}</p>
                          {payout.fee > 0 && (
                            <p className="text-xs text-muted-foreground">Fee: GHS {payout.fee}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {payout.mobile_money_provider ? (
                            <Smartphone className="w-4 h-4" />
                          ) : (
                            <Building className="w-4 h-4" />
                          )}
                          <div>
                            <p className="text-sm">{payout.bank_account_name}</p>
                            <p className="text-xs text-muted-foreground">{payout.account_number}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          {getStatusBadge(payout.status)}
                          {payout.failure_reason && (
                            <p className="text-xs text-red-500 mt-1">{payout.failure_reason}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">{format(new Date(payout.created_at), 'MMM d, yyyy')}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistance(new Date(payout.created_at), new Date(), { addSuffix: true })}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {payout.status === 'failed' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRetryPayout(payout.id)}
                            >
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                          )}
                          {(payout.status === 'pending' || payout.status === 'processing') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancelPayout(payout.id)}
                            >
                              <Ban className="w-4 h-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </SiteLayout>
  );
}
