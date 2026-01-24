"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Shield,
  Eye,
  CheckCircle,
  XCircle,
  AlertTriangle,
  User,
  FileText,
  Camera,
  Clock,
  Filter,
  Search,
  Download,
  Flag,
  MessageSquare
} from "lucide-react";

export default function AdminVerificationPage() {
  const [selectedApplication, setSelectedApplication] = useState<typeof pendingApplications[0] | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"approve" | "reject" | "flag">("approve");

  const pendingApplications = [
    {
      id: 1,
      vendorName: "TechStore Ghana",
      email: "contact@techstore.gh",
      phone: "+233 24 123 4567",
      submittedAt: "2024-01-15T10:30:00Z",
      status: "pending_manual_review",
      riskScore: "Low",
      aiValidation: "Passed",
      documentsComplete: true,
      facialVerification: "Passed",
      businessType: "Electronics Retailer",
      documents: {
        nationalId: { front: true, back: true, verified: true },
        businessLicense: { uploaded: true, verified: true },
        bankStatement: { uploaded: false, verified: false }
      },
      flags: [],
      notes: "High-quality documentation, consistent information across all documents."
    },
    {
      id: 2,
      vendorName: "Fashion Hub GH",
      email: "info@fashionhub.gh",
      phone: "+233 20 456 7890",
      submittedAt: "2024-01-14T15:45:00Z",
      status: "flagged_review",
      riskScore: "Medium",
      aiValidation: "Warning",
      documentsComplete: true,
      facialVerification: "Passed",
      businessType: "Fashion & Clothing",
      documents: {
        nationalId: { front: true, back: true, verified: true },
        businessLicense: { uploaded: true, verified: false },
        bankStatement: { uploaded: true, verified: true }
      },
      flags: ["Address mismatch", "Recent business registration"],
      notes: "Business registered only 2 months ago. Address on business license differs from ID."
    },
    {
      id: 3,
      vendorName: "Local Crafts",
      email: "crafts@local.gh",
      phone: "+233 26 789 0123",
      submittedAt: "2024-01-13T09:20:00Z",
      status: "high_risk",
      riskScore: "High",
      aiValidation: "Failed",
      documentsComplete: false,
      facialVerification: "Failed",
      businessType: "Handmade Crafts",
      documents: {
        nationalId: { front: true, back: false, verified: false },
        businessLicense: { uploaded: false, verified: false },
        bankStatement: { uploaded: false, verified: false }
      },
      flags: ["Incomplete documents", "Facial verification failed", "Suspicious email pattern"],
      notes: "Multiple red flags. Facial verification failed 3 times. Consider rejection."
    }
  ];

  const handleAction = (application: typeof pendingApplications[0], action: "approve" | "reject" | "flag") => {
    setSelectedApplication(application);
    setActionType(action);
    setActionDialogOpen(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRiskScoreBadge = (riskScore: string) => {
    switch (riskScore) {
      case "Low":
        return <Badge variant="default" className="bg-green-600">Low Risk</Badge>;
      case "Medium":
        return <Badge variant="secondary">Medium Risk</Badge>;
      case "High":
        return <Badge variant="destructive">High Risk</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending_manual_review":
        return <Badge variant="secondary">Pending Review</Badge>;
      case "flagged_review":
        return <Badge variant="outline" className="border-orange-300 text-orange-700">Flagged</Badge>;
      case "high_risk":
        return <Badge variant="destructive">High Risk</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Vendor Verification Center</h1>
            <p className="text-muted-foreground">Review and approve vendor applications</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Review</p>
                  <p className="text-2xl font-bold">12</p>
                </div>
                <Clock className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">High Risk</p>
                  <p className="text-2xl font-bold text-red-600">3</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Approved Today</p>
                  <p className="text-2xl font-bold text-green-600">8</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Rejection Rate</p>
                  <p className="text-2xl font-bold">15%</p>
                </div>
                <XCircle className="w-8 h-8 text-gray-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Applications Table */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Applications</CardTitle>
            <CardDescription>Vendor verification applications requiring review</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor Details</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Risk Assessment</TableHead>
                  <TableHead>Verification Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingApplications.map((application) => (
                  <TableRow key={application.id} className="cursor-pointer hover:bg-accent">
                    <TableCell>
                      <div>
                        <p className="font-medium">{application.vendorName}</p>
                        <p className="text-sm text-muted-foreground">{application.email}</p>
                        <p className="text-sm text-muted-foreground">{application.businessType}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(application.status)}
                      {application.flags.length > 0 && (
                        <div className="mt-1">
                          <Badge variant="outline" className="text-xs">
                            <Flag className="w-3 h-3 mr-1" />
                            {application.flags.length} flags
                          </Badge>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {getRiskScoreBadge(application.riskScore)}
                      <div className="mt-1">
                        <Badge variant="outline" className="text-xs">
                          AI: {application.aiValidation}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <FileText className="w-3 h-3" />
                          <span className="text-xs">
                            {application.documentsComplete ? "Complete" : "Incomplete"}
                          </span>
                          {application.documentsComplete ? (
                            <CheckCircle className="w-3 h-3 text-green-600" />
                          ) : (
                            <XCircle className="w-3 h-3 text-red-600" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Camera className="w-3 h-3" />
                          <span className="text-xs">{application.facialVerification}</span>
                          {application.facialVerification === "Passed" ? (
                            <CheckCircle className="w-3 h-3 text-green-600" />
                          ) : (
                            <XCircle className="w-3 h-3 text-red-600" />
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{formatDate(application.submittedAt)}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline">
                              <Eye className="w-3 h-3 mr-1" />
                              Review
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Vendor Application Review</DialogTitle>
                              <DialogDescription>
                                Detailed review of {application.vendorName}'s verification application
                              </DialogDescription>
                            </DialogHeader>

                            <Tabs defaultValue="overview" className="w-full">
                              <TabsList className="grid w-full grid-cols-4">
                                <TabsTrigger value="overview">Overview</TabsTrigger>
                                <TabsTrigger value="documents">Documents</TabsTrigger>
                                <TabsTrigger value="verification">Verification</TabsTrigger>
                                <TabsTrigger value="analysis">AI Analysis</TabsTrigger>
                              </TabsList>

                              <TabsContent value="overview" className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <h4 className="font-semibold mb-2">Basic Information</h4>
                                    <div className="space-y-2 text-sm">
                                      <div className="flex justify-between">
                                        <span>Business Name:</span>
                                        <span>{application.vendorName}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>Email:</span>
                                        <span>{application.email}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>Phone:</span>
                                        <span>{application.phone}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>Business Type:</span>
                                        <span>{application.businessType}</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div>
                                    <h4 className="font-semibold mb-2">Risk Assessment</h4>
                                    <div className="space-y-2">
                                      {getRiskScoreBadge(application.riskScore)}
                                      <div className="text-sm">
                                        <p><strong>AI Validation:</strong> {application.aiValidation}</p>
                                        <p><strong>Flags:</strong> {application.flags.length || "None"}</p>
                                      </div>
                                      {application.flags.length > 0 && (
                                        <div className="space-y-1">
                                          {application.flags.map((flag, index) => (
                                            <Badge key={index} variant="destructive" className="text-xs mr-1">
                                              {flag}
                                            </Badge>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div>
                                  <h4 className="font-semibold mb-2">Review Notes</h4>
                                  <p className="text-sm text-muted-foreground bg-gray-50 p-3 rounded">
                                    {application.notes}
                                  </p>
                                </div>
                              </TabsContent>

                              <TabsContent value="documents" className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <Card>
                                    <CardHeader>
                                      <CardTitle className="text-sm">National ID</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                          <span>Front:</span>
                                          {application.documents.nationalId.front ? (
                                            <CheckCircle className="w-4 h-4 text-green-600" />
                                          ) : (
                                            <XCircle className="w-4 h-4 text-red-600" />
                                          )}
                                        </div>
                                        <div className="flex justify-between text-sm">
                                          <span>Back:</span>
                                          {application.documents.nationalId.back ? (
                                            <CheckCircle className="w-4 h-4 text-green-600" />
                                          ) : (
                                            <XCircle className="w-4 h-4 text-red-600" />
                                          )}
                                        </div>
                                        <div className="flex justify-between text-sm">
                                          <span>AI Verified:</span>
                                          {application.documents.nationalId.verified ? (
                                            <CheckCircle className="w-4 h-4 text-green-600" />
                                          ) : (
                                            <XCircle className="w-4 h-4 text-red-600" />
                                          )}
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>

                                  <Card>
                                    <CardHeader>
                                      <CardTitle className="text-sm">Business License</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                          <span>Uploaded:</span>
                                          {application.documents.businessLicense.uploaded ? (
                                            <CheckCircle className="w-4 h-4 text-green-600" />
                                          ) : (
                                            <XCircle className="w-4 h-4 text-red-600" />
                                          )}
                                        </div>
                                        <div className="flex justify-between text-sm">
                                          <span>Verified:</span>
                                          {application.documents.businessLicense.verified ? (
                                            <CheckCircle className="w-4 h-4 text-green-600" />
                                          ) : (
                                            <XCircle className="w-4 h-4 text-red-600" />
                                          )}
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>

                                  <Card>
                                    <CardHeader>
                                      <CardTitle className="text-sm">Bank Statement</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                          <span>Uploaded:</span>
                                          {application.documents.bankStatement.uploaded ? (
                                            <CheckCircle className="w-4 h-4 text-green-600" />
                                          ) : (
                                            <XCircle className="w-4 h-4 text-red-600" />
                                          )}
                                        </div>
                                        <div className="flex justify-between text-sm">
                                          <span>Verified:</span>
                                          {application.documents.bankStatement.verified ? (
                                            <CheckCircle className="w-4 h-4 text-green-600" />
                                          ) : (
                                            <XCircle className="w-4 h-4 text-red-600" />
                                          )}
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                </div>
                              </TabsContent>

                              <TabsContent value="verification" className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <Card>
                                    <CardHeader>
                                      <CardTitle className="text-sm">Facial Recognition</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="space-y-2">
                                        <Badge variant={application.facialVerification === "Passed" ? "default" : "destructive"}>
                                          {application.facialVerification}
                                        </Badge>
                                        <p className="text-sm text-muted-foreground">
                                          Facial recognition compared live photo with ID photo for identity verification.
                                        </p>
                                      </div>
                                    </CardContent>
                                  </Card>

                                  <Card>
                                    <CardHeader>
                                      <CardTitle className="text-sm">Document Analysis</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="space-y-2">
                                        <Badge variant="default">AI Validated</Badge>
                                        <p className="text-sm text-muted-foreground">
                                          Documents analyzed for authenticity, consistency, and fraud indicators.
                                        </p>
                                      </div>
                                    </CardContent>
                                  </Card>
                                </div>
                              </TabsContent>

                              <TabsContent value="analysis" className="space-y-4">
                                <Card>
                                  <CardHeader>
                                    <CardTitle className="text-sm">AI Analysis Report</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="space-y-3">
                                      <div>
                                        <h5 className="font-semibold text-sm">Document Authenticity Score</h5>
                                        <div className="flex items-center gap-2">
                                          <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div className="bg-green-600 h-2 rounded-full" style={{ width: "92%" }}></div>
                                          </div>
                                          <span className="text-sm">92%</span>
                                        </div>
                                      </div>

                                      <div>
                                        <h5 className="font-semibold text-sm">Identity Verification Score</h5>
                                        <div className="flex items-center gap-2">
                                          <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div className="bg-green-600 h-2 rounded-full" style={{ width: "88%" }}></div>
                                          </div>
                                          <span className="text-sm">88%</span>
                                        </div>
                                      </div>

                                      <div>
                                        <h5 className="font-semibold text-sm">Risk Assessment</h5>
                                        <div className="flex items-center gap-2">
                                          <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div className="bg-green-600 h-2 rounded-full" style={{ width: "76%" }}></div>
                                          </div>
                                          <span className="text-sm">Low Risk</span>
                                        </div>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              </TabsContent>
                            </Tabs>

                            <div className="flex justify-end gap-3 pt-4 border-t">
                              <Button
                                variant="destructive"
                                onClick={() => handleAction(application, "reject")}
                              >
                                <XCircle className="w-4 h-4 mr-2" />
                                Reject
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => handleAction(application, "flag")}
                              >
                                <Flag className="w-4 h-4 mr-2" />
                                Flag for Review
                              </Button>
                              <Button
                                onClick={() => handleAction(application, "approve")}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Approve
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>

                        <Button
                          size="sm"
                          onClick={() => handleAction(application, "approve")}
                          className="bg-green-600 hover:bg-green-700"
                          disabled={application.riskScore === "High"}
                        >
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleAction(application, "reject")}
                        >
                          <XCircle className="w-3 h-3 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Action Dialog */}
        <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {actionType === "approve" ? "Approve Application" :
                 actionType === "reject" ? "Reject Application" : "Flag for Review"}
              </DialogTitle>
              <DialogDescription>
                {selectedApplication && `${actionType === "approve" ? "Approve" : actionType === "reject" ? "Reject" : "Flag"} ${selectedApplication.vendorName}'s verification application`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="reason">Reason/Notes</Label>
                <Textarea
                  id="reason"
                  placeholder={`Provide a reason for ${actionType}ing this application...`}
                  className="mt-1"
                />
              </div>

              {actionType === "approve" && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    This vendor will be able to start selling immediately after approval.
                  </AlertDescription>
                </Alert>
              )}

              {actionType === "reject" && (
                <Alert className="border-red-200 bg-red-50">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    This vendor will be notified of rejection and can reapply after addressing issues.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant={actionType === "approve" ? "default" : "destructive"}
                onClick={() => setActionDialogOpen(false)}
              >
                Confirm {actionType === "approve" ? "Approval" : actionType === "reject" ? "Rejection" : "Flag"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
