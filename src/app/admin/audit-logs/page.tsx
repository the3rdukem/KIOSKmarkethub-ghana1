"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  History,
  Search,
  Filter,
  Download,
  Eye,
  MoreHorizontal,
  Clock,
  User,
  Package,
  Shield,
  Settings,
  MessageSquare,
  CreditCard,
  Lock,
  Server,
  Image,
  Loader2,
  Crown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistance } from "date-fns";
import { useAuthStore } from "@/lib/auth-store";

type AuditCategory = 'product' | 'vendor' | 'user' | 'order' | 'api' | 'system' | 'auth' | 'admin' | 'security' | 'category';
type AuditSeverity = 'info' | 'warning' | 'critical';

interface AuditLogEntry {
  id: string;
  action: string;
  category: AuditCategory;
  adminId: string | null;
  adminName: string | null;
  adminEmail: string | null;
  adminRole: string | null;
  targetId: string | null;
  targetType: string | null;
  targetName: string | null;
  details: string | null;
  previousValue: string | null;
  newValue: string | null;
  ipAddress: string | null;
  severity: AuditSeverity;
  timestamp: string;
}

const categoryIcons: Record<string, React.ReactNode> = {
  product: <Package className="w-4 h-4" />,
  vendor: <Shield className="w-4 h-4" />,
  user: <User className="w-4 h-4" />,
  order: <Package className="w-4 h-4" />,
  api: <Server className="w-4 h-4" />,
  system: <Server className="w-4 h-4" />,
  auth: <Lock className="w-4 h-4" />,
  admin: <Crown className="w-4 h-4" />,
  security: <Lock className="w-4 h-4" />,
  category: <Settings className="w-4 h-4" />,
};

const categoryColors: Record<string, string> = {
  product: "bg-blue-100 text-blue-700",
  vendor: "bg-purple-100 text-purple-700",
  user: "bg-green-100 text-green-700",
  order: "bg-indigo-100 text-indigo-700",
  api: "bg-slate-100 text-slate-700",
  system: "bg-gray-100 text-gray-700",
  auth: "bg-amber-100 text-amber-700",
  admin: "bg-orange-100 text-orange-700",
  security: "bg-red-100 text-red-700",
  category: "bg-cyan-100 text-cyan-700",
};

const severityColors: Record<AuditSeverity, string> = {
  info: "bg-blue-100 text-blue-700",
  warning: "bg-amber-100 text-amber-700",
  critical: "bg-red-100 text-red-700",
};

export default function AdminAuditLogsPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  const [isHydrated, setIsHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<AuditCategory | "all">("all");
  const [severityFilter, setSeverityFilter] = useState<AuditSeverity | "all">("all");
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (categoryFilter !== "all") params.append("category", categoryFilter);
      if (severityFilter !== "all") params.append("severity", severityFilter);
      params.append("limit", "200");

      const response = await fetch(`/api/admin/audit-logs?${params.toString()}`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch audit logs");
      }

      const data = await response.json();
      setLogs(data.logs || []);
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
      toast.error("Failed to load audit logs");
    } finally {
      setIsLoading(false);
    }
  }, [categoryFilter, severityFilter]);

  useEffect(() => {
    if (!isHydrated) return;

    if (!isAuthenticated) {
      router.push("/admin/login");
      return;
    }

    const isMasterAdmin = user?.role === 'master_admin' || user?.adminRole === 'MASTER_ADMIN';
    if (!isMasterAdmin) {
      toast.error("Access denied. Master Admin privileges required.");
      router.push("/admin");
      return;
    }

    fetchLogs();
  }, [isHydrated, isAuthenticated, user, router, fetchLogs]);

  const isMasterAdmin = user?.role === 'master_admin' || user?.adminRole === 'MASTER_ADMIN';

  const filteredLogs = logs.filter(log => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        log.action.toLowerCase().includes(query) ||
        log.details?.toLowerCase().includes(query) ||
        log.targetName?.toLowerCase().includes(query) ||
        log.adminName?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const categoryStats = Object.entries(
    logs.reduce((acc, log) => {
      acc[log.category] = (acc[log.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1]);

  const handleExportLogs = () => {
    const data = JSON.stringify(filteredLogs, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${format(new Date(), "yyyy-MM-dd")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Logs exported");
  };

  const handleRefresh = () => {
    fetchLogs();
    toast.success("Logs refreshed");
  };

  if (!isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-16 h-16 text-green-600 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !isMasterAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Lock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
          <p className="text-muted-foreground mb-4">Master Admin privileges required</p>
          <Button onClick={() => router.push("/admin/login")}>Go to Admin Login</Button>
        </div>
      </div>
    );
  }

  return (
    <SiteLayout>
      <div className="container py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold flex items-center gap-2">
                <History className="w-8 h-8" />
                Audit Logs
              </h1>
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                <Crown className="w-3 h-3 mr-1" />
                Master Admin Only
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Track all sensitive actions across the platform (from PostgreSQL)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" onClick={handleExportLogs}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {Object.keys(categoryIcons).slice(0, 5).map((category) => (
            <Card
              key={category}
              className={`cursor-pointer transition-all ${
                categoryFilter === category ? "ring-2 ring-green-500" : "hover:shadow-md"
              }`}
              onClick={() => setCategoryFilter(categoryFilter === category ? "all" : category as AuditCategory)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">{category}</p>
                    <p className="text-2xl font-bold">
                      {categoryStats.find(([c]) => c === category)?.[1] || 0}
                    </p>
                  </div>
                  <div className={`p-2 rounded-lg ${categoryColors[category] || "bg-gray-100 text-gray-700"}`}>
                    {categoryIcons[category] || <Settings className="w-4 h-4" />}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <Label htmlFor="search" className="sr-only">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Search logs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="w-[150px]">
                <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as AuditCategory | "all")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {Object.keys(categoryIcons).map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[150px]">
                <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as AuditSeverity | "all")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severities</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Audit Trail</CardTitle>
            <CardDescription>
              {isLoading ? "Loading..." : `${filteredLogs.length} entries found`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-green-600" />
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-12">
                <History className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Audit Logs Found</h3>
                <p className="text-muted-foreground">
                  {logs.length === 0 
                    ? "No actions have been logged yet. Actions like user creation, product publishing, and verification changes will appear here."
                    : "No logs match your current filters."}
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setSelectedLog(log)}>
                        <TableCell className="font-mono text-sm">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            {format(new Date(log.timestamp), "MMM dd, HH:mm:ss")}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {log.action.replace(/_/g, " ")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={categoryColors[log.category] || "bg-gray-100"}>
                            {categoryIcons[log.category]}
                            <span className="ml-1">{log.category}</span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={severityColors[log.severity]}>
                            {log.severity === "critical" ? (
                              <XCircle className="w-3 h-3 mr-1" />
                            ) : log.severity === "warning" ? (
                              <AlertTriangle className="w-3 h-3 mr-1" />
                            ) : (
                              <CheckCircle className="w-3 h-3 mr-1" />
                            )}
                            {log.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">{log.adminName || "System"}</div>
                            <div className="text-muted-foreground text-xs">{log.adminEmail || log.adminRole || "-"}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">{log.targetName || "-"}</div>
                            <div className="text-muted-foreground text-xs">{log.targetType || ""}</div>
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
                              <DropdownMenuItem onClick={() => setSelectedLog(log)}>
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Log Detail Dialog */}
        <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Log Details
              </DialogTitle>
              <DialogDescription>
                Full audit trail entry information
              </DialogDescription>
            </DialogHeader>
            {selectedLog && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Action</Label>
                    <p className="font-medium">{selectedLog.action.replace(/_/g, " ")}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Timestamp</Label>
                    <p className="font-medium">{format(new Date(selectedLog.timestamp), "PPpp")}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Category</Label>
                    <Badge variant="outline" className={categoryColors[selectedLog.category]}>
                      {selectedLog.category}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Severity</Label>
                    <Badge variant="outline" className={severityColors[selectedLog.severity]}>
                      {selectedLog.severity}
                    </Badge>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Actor</Label>
                    <p className="font-medium">{selectedLog.adminName || "System"}</p>
                    <p className="text-sm text-muted-foreground">{selectedLog.adminEmail}</p>
                    <p className="text-xs text-muted-foreground">{selectedLog.adminRole}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Target</Label>
                    <p className="font-medium">{selectedLog.targetName || "-"}</p>
                    <p className="text-sm text-muted-foreground">{selectedLog.targetType}: {selectedLog.targetId}</p>
                  </div>
                </div>
                {selectedLog.details && (
                  <>
                    <Separator />
                    <div>
                      <Label className="text-muted-foreground">Details</Label>
                      <p className="mt-1 text-sm bg-gray-50 p-3 rounded-lg">{selectedLog.details}</p>
                    </div>
                  </>
                )}
                {selectedLog.ipAddress && (
                  <div>
                    <Label className="text-muted-foreground">IP Address</Label>
                    <p className="font-mono text-sm">{selectedLog.ipAddress}</p>
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
