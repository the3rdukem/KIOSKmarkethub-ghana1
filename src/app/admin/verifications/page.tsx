"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  ShieldCheck,
  Phone,
  Mail,
  IdCard,
  User,
  Building,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  Search,
  MoreHorizontal,
  Lock,
  Loader2,
  FileText,
  History,
  RefreshCw,
  Download
} from "lucide-react";
import { toast } from "sonner";
import { formatDistance, format } from "date-fns";
import { useAuthStore } from "@/lib/auth-store";
import { useVerificationStore, VendorVerification, VerificationStatus } from "@/lib/verification-store";
import { useVerificationSubmissionsStore } from "@/lib/verification-submissions-store";
import { useAuditStore } from "@/lib/audit-store";
import { useUsersStore } from "@/lib/users-store";
import { getStatusDisplayName, getStatusColor } from "@/lib/verification-provider";

const statusColors: Record<VerificationStatus, string> = {
  not_started: "bg-gray-100 text-gray-600",
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  expired: "bg-orange-100 text-orange-700",
};

const verificationTypes = [
  { key: 'phoneVerification', label: 'Phone', icon: Phone },
  { key: 'emailVerification', label: 'Email', icon: Mail },
  { key: 'idVerification', label: 'ID Document', icon: IdCard },
  { key: 'facialVerification', label: 'Facial Recognition', icon: User },
  { key: 'businessDocuments', label: 'Business Documents', icon: Building },
  { key: 'addressVerification', label: 'Address', icon: MapPin },
] as const;

export default function AdminVerificationsPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const {
    verifications,
    getAllVerifications,
    getPendingVerifications,
    getVerifiedVendors,
    approveVerification,
    rejectVerification,
    suspendVendorVerification,
    reinstateVendorVerification,
    approveAllPendingVerifications,
    getAuditLogs,
  } = useVerificationStore();
  const {
    getAllSubmissions,
    getSubmission,
    approveSubmission,
    rejectSubmission: rejectSub,
    requestResubmit,
    startReview,
    getStats,
  } = useVerificationSubmissionsStore();
  const { logVerificationAction } = useAuditStore();
  const { users } = useUsersStore();

  const [isHydrated, setIsHydrated] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVendor, setSelectedVendor] = useState<VendorVerification | null>(null);
  const [selectedTab, setSelectedTab] = useState("pending");
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [currentVerificationType, setCurrentVerificationType] = useState<typeof verificationTypes[number]['key'] | null>(null);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    if (!isAuthenticated) {
      router.push("/admin/login");
      return;
    }
    if (user?.role !== "admin" && user?.role !== "master_admin") {
      toast.error("Access denied. Admin privileges required.");
      router.push("/");
    }
  }, [isAuthenticated, user, router, isHydrated]);

  const isMasterAdmin = user?.role === 'master_admin' || user?.adminRole === 'MASTER_ADMIN';

  // Get submission stats
  const submissionStats = getStats();
  const allSubmissions = getAllSubmissions();

  // Filter verifications based on tab and search
  const allVerifications = getAllVerifications();
  const pendingVerifications = getPendingVerifications();
  const verifiedVendors = getVerifiedVendors();

  const filteredVerifications = allVerifications.filter(v => {
    const searchLower = searchQuery.toLowerCase();
    return (
      v.vendorName.toLowerCase().includes(searchLower) ||
      v.vendorEmail.toLowerCase().includes(searchLower) ||
      (v.businessName?.toLowerCase().includes(searchLower))
    );
  });

  const displayVerifications = selectedTab === 'pending'
    ? filteredVerifications.filter(v => pendingVerifications.includes(v))
    : selectedTab === 'verified'
    ? filteredVerifications.filter(v => v.overallStatus === 'verified')
    : selectedTab === 'suspended'
    ? filteredVerifications.filter(v => v.overallStatus === 'suspended')
    : filteredVerifications;

  const handleApprove = (vendorId: string, type: typeof verificationTypes[number]['key']) => {
    if (!user) return;
    approveVerification(vendorId, type, user.id, user.email || "", "Approved by admin");

    // Also update submission if it exists
    const submission = getSubmission(vendorId);
    if (submission && submission.status === 'under_review') {
      // Check if all verifications are now approved
      const v = getAllVerifications().find(v => v.vendorId === vendorId);
      if (v && v.verificationScore >= 90) {
        approveSubmission(vendorId, user.id, user.email || "", "All verifications passed");
        logVerificationAction(
          'VERIFICATION_APPROVED',
          user.id,
          user.email || '',
          user.role,
          vendorId,
          v.vendorName,
          type,
          undefined,
          { status: 'approved' }
        );
      }
    }

    toast.success(`${type.replace('Verification', '')} verification approved`);
  };

  const handleReject = () => {
    if (!user || !selectedVendor || !currentVerificationType || !rejectionReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    rejectVerification(selectedVendor.vendorId, currentVerificationType, user.id, user.email || "", rejectionReason);

    // Also update submission
    const submission = getSubmission(selectedVendor.vendorId);
    if (submission) {
      rejectSub(selectedVendor.vendorId, user.id, user.email || "", rejectionReason);
      logVerificationAction(
        'VERIFICATION_REJECTED',
        user.id,
        user.email || '',
        user.role,
        selectedVendor.vendorId,
        selectedVendor.vendorName,
        currentVerificationType,
        undefined,
        { status: 'rejected', reason: rejectionReason }
      );
    }

    toast.success("Verification rejected");
    setShowRejectDialog(false);
    setRejectionReason("");
    setCurrentVerificationType(null);
  };

  const handleApproveAll = (vendorId: string) => {
    if (!user) return;
    approveAllPendingVerifications(vendorId, user.id, user.email || "");
    toast.success("All pending verifications approved");
  };

  const handleSuspend = (vendorId: string, reason: string) => {
    if (!user) return;
    suspendVendorVerification(vendorId, user.id, user.email || "", reason);
    toast.success("Vendor verification suspended");
  };

  const handleReinstate = (vendorId: string) => {
    if (!user) return;
    reinstateVendorVerification(vendorId, user.id, user.email || "");
    toast.success("Vendor verification reinstated");
  };

  const getVerificationItem = (v: VendorVerification, type: typeof verificationTypes[number]['key']) => {
    return v[type];
  };

  if (!isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-green-600 mx-auto mb-4 animate-spin" />
          <h2 className="text-xl font-semibold mb-2">Loading...</h2>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || (user?.role !== "admin" && user?.role !== "master_admin")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Lock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
          <p className="text-muted-foreground mb-4">Admin authentication required</p>
          <Button onClick={() => router.push("/admin/login")}>Go to Admin Login</Button>
        </div>
      </div>
    );
  }

  const auditLogs = getAuditLogs().slice(0, 50);

  return (
    <SiteLayout>
      <div className="container py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Vendor Verification</h1>
              {isMasterAdmin && (
                <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                  Master Admin
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              Review and manage vendor verification requests
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Vendors</p>
                  <p className="text-2xl font-bold">{allVerifications.length}</p>
                </div>
                <ShieldCheck className="w-8 h-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Review</p>
                  <p className="text-2xl font-bold text-yellow-600">{pendingVerifications.length}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Fully Verified</p>
                  <p className="text-2xl font-bold text-green-600">{verifiedVendors.length}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Suspended</p>
                  <p className="text-2xl font-bold text-red-600">
                    {allVerifications.filter(v => v.overallStatus === 'suspended').length}
                  </p>
                </div>
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <div className="flex items-center justify-between mb-6">
            <TabsList>
              <TabsTrigger value="pending">
                Pending
                {pendingVerifications.length > 0 && (
                  <Badge variant="destructive" className="ml-2">{pendingVerifications.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="verified">Verified</TabsTrigger>
              <TabsTrigger value="all">All Vendors</TabsTrigger>
              <TabsTrigger value="suspended">Suspended</TabsTrigger>
              <TabsTrigger value="logs">
                <History className="w-4 h-4 mr-1" />
                Audit Logs
              </TabsTrigger>
            </TabsList>

            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search vendors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Verifications Table */}
          <TabsContent value="pending" className="space-y-4">
            <VerificationTable
              verifications={displayVerifications}
              onView={setSelectedVendor}
              onApprove={handleApprove}
              onReject={(vendorId, type) => {
                const v = allVerifications.find(x => x.vendorId === vendorId);
                if (v) {
                  setSelectedVendor(v);
                  setCurrentVerificationType(type);
                  setShowRejectDialog(true);
                }
              }}
              onApproveAll={handleApproveAll}
            />
          </TabsContent>

          <TabsContent value="verified" className="space-y-4">
            <VerificationTable
              verifications={displayVerifications}
              onView={setSelectedVendor}
              onApprove={handleApprove}
              onReject={(vendorId, type) => {
                const v = allVerifications.find(x => x.vendorId === vendorId);
                if (v) {
                  setSelectedVendor(v);
                  setCurrentVerificationType(type);
                  setShowRejectDialog(true);
                }
              }}
            />
          </TabsContent>

          <TabsContent value="all" className="space-y-4">
            <VerificationTable
              verifications={displayVerifications}
              onView={setSelectedVendor}
              onApprove={handleApprove}
              onReject={(vendorId, type) => {
                const v = allVerifications.find(x => x.vendorId === vendorId);
                if (v) {
                  setSelectedVendor(v);
                  setCurrentVerificationType(type);
                  setShowRejectDialog(true);
                }
              }}
              onSuspend={(vendorId) => handleSuspend(vendorId, "Suspended by admin")}
              onReinstate={handleReinstate}
            />
          </TabsContent>

          <TabsContent value="suspended" className="space-y-4">
            <VerificationTable
              verifications={displayVerifications}
              onView={setSelectedVendor}
              onReinstate={handleReinstate}
            />
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Verification Audit Logs</CardTitle>
                <CardDescription>Track all verification actions</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Admin</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm">
                            {format(new Date(log.timestamp), "MMM d, HH:mm")}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.action.replace(/_/g, ' ')}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">{log.vendorName}</TableCell>
                          <TableCell className="text-sm">{log.verificationType.replace('Verification', '')}</TableCell>
                          <TableCell>
                            <Badge className={statusColors[log.newStatus]}>
                              {log.newStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{log.adminEmail}</TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate">{log.details}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Vendor Detail Dialog */}
        <Dialog open={!!selectedVendor && !showRejectDialog} onOpenChange={(open) => !open && setSelectedVendor(null)}>
          <DialogContent className="max-w-2xl">
            {selectedVendor && (
              <>
                <DialogHeader>
                  <DialogTitle>{selectedVendor.vendorName}</DialogTitle>
                  <DialogDescription>{selectedVendor.vendorEmail}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Business Name</p>
                      <p className="font-medium">{selectedVendor.businessName || "Not provided"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Verification Score</p>
                      <div className="flex items-center gap-2">
                        <Progress value={selectedVendor.verificationScore} className="w-24" />
                        <span className="font-medium">{selectedVendor.verificationScore}%</span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    {verificationTypes.map(({ key, label, icon: Icon }) => {
                      const item = getVerificationItem(selectedVendor, key);
                      return (
                        <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <Icon className="w-5 h-5 text-gray-500" />
                            <div>
                              <p className="font-medium">{label}</p>
                              {item.evidence && (
                                <a
                                  href={item.evidence}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:underline"
                                >
                                  View Evidence
                                </a>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={statusColors[item.status]}>
                              {item.status.replace('_', ' ')}
                            </Badge>
                            {item.status === 'pending' && (
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => handleApprove(selectedVendor.vendorId, key)}
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    setCurrentVerificationType(key);
                                    setShowRejectDialog(true);
                                  }}
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {selectedVendor.overallStatus !== 'suspended' && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => handleApproveAll(selectedVendor.vendorId)}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve All Pending
                    </Button>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Verification</DialogTitle>
              <DialogDescription>
                Provide a reason for rejecting this verification
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Rejection Reason</Label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Please provide a clear reason for rejection..."
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleReject} disabled={!rejectionReason.trim()}>
                Reject
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SiteLayout>
  );
}

// Verification Table Component
function VerificationTable({
  verifications,
  onView,
  onApprove,
  onReject,
  onApproveAll,
  onSuspend,
  onReinstate,
}: {
  verifications: VendorVerification[];
  onView: (v: VendorVerification) => void;
  onApprove?: (vendorId: string, type: typeof verificationTypes[number]['key']) => void;
  onReject?: (vendorId: string, type: typeof verificationTypes[number]['key']) => void;
  onApproveAll?: (vendorId: string) => void;
  onSuspend?: (vendorId: string) => void;
  onReinstate?: (vendorId: string) => void;
}) {
  if (verifications.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <ShieldCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Verifications</h3>
            <p className="text-muted-foreground">No vendors match the current filter</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendor</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Face</TableHead>
              <TableHead>Business</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {verifications.map((v) => (
              <TableRow key={v.vendorId}>
                <TableCell>
                  <div>
                    <p className="font-medium">{v.vendorName}</p>
                    <p className="text-xs text-muted-foreground">{v.businessName || v.vendorEmail}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <StatusDot status={v.phoneVerification.status} />
                </TableCell>
                <TableCell>
                  <StatusDot status={v.emailVerification.status} />
                </TableCell>
                <TableCell>
                  <StatusDot status={v.idVerification.status} />
                </TableCell>
                <TableCell>
                  <StatusDot status={v.facialVerification.status} />
                </TableCell>
                <TableCell>
                  <StatusDot status={v.businessDocuments.status} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={v.verificationScore} className="w-12 h-2" />
                    <span className="text-xs">{v.verificationScore}%</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={v.overallStatus === 'verified' ? 'default' : 'secondary'}
                    className={
                      v.overallStatus === 'verified' ? 'bg-green-100 text-green-800' :
                      v.overallStatus === 'suspended' ? 'bg-red-100 text-red-800' :
                      v.overallStatus === 'partially_verified' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }
                  >
                    {v.overallStatus.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => onView(v)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onView(v)}>
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        {onApproveAll && (
                          <DropdownMenuItem onClick={() => onApproveAll(v.vendorId)}>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Approve All Pending
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        {v.overallStatus !== 'suspended' && onSuspend && (
                          <DropdownMenuItem className="text-red-600" onClick={() => onSuspend(v.vendorId)}>
                            <XCircle className="w-4 h-4 mr-2" />
                            Suspend Verification
                          </DropdownMenuItem>
                        )}
                        {v.overallStatus === 'suspended' && onReinstate && (
                          <DropdownMenuItem onClick={() => onReinstate(v.vendorId)}>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Reinstate
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function StatusDot({ status }: { status: VerificationStatus }) {
  const colors: Record<VerificationStatus, string> = {
    not_started: "bg-gray-300",
    pending: "bg-yellow-400",
    approved: "bg-green-500",
    rejected: "bg-red-500",
    expired: "bg-orange-400",
  };

  return (
    <div className="flex items-center justify-center">
      <div className={`w-3 h-3 rounded-full ${colors[status]}`} title={status} />
    </div>
  );
}
