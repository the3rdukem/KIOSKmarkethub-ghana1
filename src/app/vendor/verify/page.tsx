"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Shield,
  Camera,
  Upload,
  FileText,
  CheckCircle,
  AlertTriangle,
  User,
  Building,
  ArrowRight,
  ArrowLeft,
  Info,
  X,
  Loader2,
  Clock,
  XCircle,
  RefreshCw,
  Eye,
  Zap,
  ScanFace,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/auth-store";
import { useVerificationSubmissionsStore } from "@/lib/verification-submissions-store";
import { useVerificationStore } from "@/lib/verification-store";
import { useAuditStore } from "@/lib/audit-store";
import {
  getStatusDisplayName,
  getStatusColor,
  getDocumentTypeName,
  SubmissionStatus,
} from "@/lib/verification-provider";
import { VendorAuthGuard } from "@/components/auth/auth-guard";

const ID_TYPES = [
  { value: 'national_id', label: 'National ID Card (Ghana Card)' },
  { value: 'passport', label: 'Passport' },
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'voters_id', label: "Voter's ID" },
];

interface SmileIdConfig {
  available: boolean;
  environment: 'sandbox' | 'production';
  enableDocumentVerification: boolean;
  enableSelfieVerification: boolean;
  enableEnhancedKYC: boolean;
}

interface SupportedIdType {
  value: string;
  label: string;
}

function VendorVerificationPageContent() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);
  const backIdInputRef = useRef<HTMLInputElement>(null);
  const businessDocInputRef = useRef<HTMLInputElement>(null);

  const { user } = useAuthStore();
  const {
    getSubmission,
    createSubmission,
    uploadDocument,
    addBusinessDocument,
    removeBusinessDocument,
    updateSubmissionInfo,
    submitForReview,
  } = useVerificationSubmissionsStore();
  const { initializeVendorVerification, getVendorVerification } = useVerificationStore();
  const { logVerificationAction } = useAuditStore();

  const [isHydrated, setIsHydrated] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  // Smile Identity state
  const [smileIdConfig, setSmileIdConfig] = useState<SmileIdConfig | null>(null);
  const [supportedIdTypes, setSupportedIdTypes] = useState<SupportedIdType[]>(ID_TYPES);
  const [verificationMethod, setVerificationMethod] = useState<'manual' | 'automated'>('manual');
  const [pendingJob, setPendingJob] = useState<{
    jobId: string;
    status: string;
    resultCode?: string;
    resultText?: string;
  } | null>(null);
  const [dbVendor, setDbVendor] = useState<{
    verificationStatus: string;
    verificationNotes?: string;
  } | null>(null);

  // Form state
  const [idType, setIdType] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [idIssueDate, setIdIssueDate] = useState('');
  const [currentAddress, setCurrentAddress] = useState('');
  const [dob, setDob] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Fetch Smile Identity config on mount
  useEffect(() => {
    if (!isHydrated) return;

    async function fetchConfig() {
      try {
        const response = await fetch('/api/vendors/verify', { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();

          if (data.smileIdentity) {
            setSmileIdConfig(data.smileIdentity);
            // Prefer automated if available
            if (data.smileIdentity.available) {
              setVerificationMethod('automated');
            }
          }

          if (data.supportedIdTypes) {
            setSupportedIdTypes(data.supportedIdTypes);
          }

          if (data.pendingJob) {
            setPendingJob(data.pendingJob);
            // If there's a pending job, go to status step
            if (data.pendingJob.jobId) {
              setCurrentStep(4);
            }
          }

          if (data.vendor) {
            setDbVendor({
              verificationStatus: data.vendor.verificationStatus,
              verificationNotes: data.vendor.verificationNotes,
            });

            // If already verified, go to status step
            if (data.vendor.verificationStatus === 'verified') {
              setCurrentStep(4);
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch Smile ID config:', error);
      }
    }

    fetchConfig();
  }, [isHydrated]);

  // Initialize submission when component mounts
  useEffect(() => {
    if (!isHydrated || !user) return;

    const submission = getSubmission(user.id);
    if (!submission) {
      createSubmission(user.id, user.name, user.email);
      initializeVendorVerification(user.id, user.name, user.email, user.businessName);
    } else {
      // Load existing data into form
      if (submission.idType) setIdType(submission.idType);
      if (submission.idNumber) setIdNumber(submission.idNumber);
      if (submission.idIssueDate) setIdIssueDate(submission.idIssueDate);
      if (submission.currentAddress) setCurrentAddress(submission.currentAddress);

      // Determine starting step based on submission status (if not overridden by DB status)
      if (!dbVendor?.verificationStatus || dbVendor.verificationStatus === 'pending') {
        if (submission.status === 'approved') {
          setCurrentStep(4);
        } else if (submission.status === 'under_review' || submission.status === 'submitted') {
          setCurrentStep(4);
        } else if (submission.governmentId && submission.selfiePhoto) {
          setCurrentStep(3);
        } else if (submission.governmentId) {
          setCurrentStep(2);
        }
      }
    }

    // Initialize name from user
    if (user.name) {
      const nameParts = user.name.split(' ');
      setFirstName(nameParts[0] || '');
      setLastName(nameParts.slice(1).join(' ') || '');
    }
  }, [isHydrated, user, getSubmission, createSubmission, initializeVendorVerification, dbVendor]);

  const submission = user ? getSubmission(user.id) : undefined;
  const verification = user ? getVendorVerification(user.id) : undefined;

  const handleFileUpload = async (
    field: 'governmentId' | 'governmentIdBack' | 'selfiePhoto',
    file: File
  ) => {
    if (!user) return;

    setUploadingField(field);

    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;

        uploadDocument(user.id, field, {
          type: field === 'selfiePhoto' ? 'selfie' : 'government_id',
          fileUrl: dataUrl,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        });

        toast.success(`${getDocumentTypeName(field === 'selfiePhoto' ? 'selfie' : 'government_id')} uploaded`);
        setUploadingField(null);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error('Failed to upload file');
      setUploadingField(null);
    }
  };

  const handleBusinessDocUpload = async (file: File) => {
    if (!user) return;

    setUploadingField('businessDoc');

    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;

        addBusinessDocument(user.id, {
          type: 'business_registration',
          fileUrl: dataUrl,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        });

        toast.success('Business document uploaded');
        setUploadingField(null);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error('Failed to upload file');
      setUploadingField(null);
    }
  };

  const handleSaveInfo = () => {
    if (!user) return;

    updateSubmissionInfo(user.id, {
      idType,
      idNumber,
      idIssueDate,
      currentAddress,
    });

    toast.success('Information saved');
  };

  // Submit with Smile Identity
  const handleSubmitWithSmileId = async () => {
    if (!user) return;

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/vendors/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          firstName: firstName || user.name.split(' ')[0],
          lastName: lastName || user.name.split(' ').slice(1).join(' '),
          idType: idType.toUpperCase().replace(/\s+/g, '_'),
          idNumber,
          dob,
          phone: user.phone,
          selfieImage: submission?.selfiePhoto?.fileUrl,
          idImageFront: submission?.governmentId?.fileUrl,
          idImageBack: submission?.governmentIdBack?.fileUrl,
          useSmileIdentity: true,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        if (data.status === 'approved') {
          toast.success('Verification successful!');
          setDbVendor({ verificationStatus: 'verified' });
        } else {
          toast.success(data.message || 'Verification submitted');
          setPendingJob({ jobId: data.jobId, status: data.status });
        }
        setCurrentStep(4);
      } else {
        toast.error(data.error || 'Verification failed');
      }
    } catch (error) {
      toast.error('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit for manual review (original flow)
  const handleSubmitManual = async () => {
    if (!user) return;

    setIsSubmitting(true);

    try {
      // Save latest info first
      updateSubmissionInfo(user.id, {
        idType,
        idNumber,
        idIssueDate,
        currentAddress,
      });

      const result = await submitForReview(user.id);

      if (result.success) {
        // Log the action
        logVerificationAction(
          'VERIFICATION_SUBMITTED',
          user.id,
          user.email,
          'vendor',
          user.id,
          user.name,
          'full_submission',
          undefined,
          { status: 'submitted' }
        );

        toast.success('Verification submitted successfully!');
        setCurrentStep(4);
      } else {
        toast.error(result.error || 'Failed to submit verification');
      }
    } catch (error) {
      toast.error('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (verificationMethod === 'automated' && smileIdConfig?.available) {
      await handleSubmitWithSmileId();
    } else {
      await handleSubmitManual();
    }
  };

  const getStepStatus = (step: number) => {
    if (!submission) return 'pending';

    switch (step) {
      case 1:
        return submission.governmentId ? 'complete' : 'pending';
      case 2:
        return submission.selfiePhoto ? 'complete' : submission.governmentId ? 'current' : 'pending';
      case 3:
        return submission.status === 'submitted' || submission.status === 'under_review' || submission.status === 'approved'
          ? 'complete'
          : submission.selfiePhoto
          ? 'current'
          : 'pending';
      case 4:
        return submission.status === 'approved' || dbVendor?.verificationStatus === 'verified' ? 'complete' : 'pending';
      default:
        return 'pending';
    }
  };

  const renderStatusBanner = () => {
    // Use DB status if available
    if (dbVendor?.verificationStatus && dbVendor.verificationStatus !== 'pending') {
      // Map DB status to display values
      const status = dbVendor.verificationStatus;
      const isApproved = status === 'verified';
      const isRejected = status === 'rejected';
      const isReviewing = status === 'under_review';

      // Map 'verified' to 'approved' for the status color function
      const mappedStatus: SubmissionStatus = isApproved ? 'approved' : status as SubmissionStatus;
      const statusColors = getStatusColor(mappedStatus);
      const displayName = isApproved ? 'Verified' : getStatusDisplayName(mappedStatus);

      return (
        <Alert className={`${statusColors.bg} border mb-6`}>
          <div className="flex items-center gap-3">
            {isApproved && <CheckCircle className="w-5 h-5 text-green-600" />}
            {isRejected && <XCircle className="w-5 h-5 text-red-600" />}
            {isReviewing && <Clock className="w-5 h-5 text-yellow-600" />}
            <div>
              <p className={`font-semibold ${statusColors.text}`}>
                Status: {displayName}
              </p>
              {dbVendor.verificationNotes && (
                <p className="text-sm mt-1">{dbVendor.verificationNotes}</p>
              )}
            </div>
          </div>
        </Alert>
      );
    }

    if (!submission || submission.status === 'draft') return null;

    const statusColors = getStatusColor(submission.status);

    return (
      <Alert className={`${statusColors.bg} border mb-6`}>
        <div className="flex items-center gap-3">
          {submission.status === 'approved' && <CheckCircle className="w-5 h-5 text-green-600" />}
          {submission.status === 'rejected' && <XCircle className="w-5 h-5 text-red-600" />}
          {submission.status === 'under_review' && <Clock className="w-5 h-5 text-yellow-600" />}
          {submission.status === 'submitted' && <Clock className="w-5 h-5 text-blue-600" />}
          {submission.status === 'pending_resubmit' && <AlertTriangle className="w-5 h-5 text-orange-600" />}
          <div>
            <p className={`font-semibold ${statusColors.text}`}>
              Status: {getStatusDisplayName(submission.status)}
            </p>
            {submission.status === 'rejected' && submission.rejectionReason && (
              <p className="text-sm mt-1">Reason: {submission.rejectionReason}</p>
            )}
            {submission.status === 'pending_resubmit' && submission.resubmitReason && (
              <p className="text-sm mt-1">Please resubmit: {submission.resubmitReason}</p>
            )}
            {submission.status === 'under_review' && (
              <p className="text-sm mt-1">Your documents are being reviewed. This usually takes 24-48 hours.</p>
            )}
          </div>
        </div>
      </Alert>
    );
  };

  // Auth is handled by the vendor layout
  if (!isHydrated || !user) {
    return (
      <SiteLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </SiteLayout>
    );
  }

  const steps = [
    { id: 1, name: 'Identity Document', icon: FileText },
    { id: 2, name: 'Selfie Photo', icon: Camera },
    { id: 3, name: 'Review & Submit', icon: Shield },
    { id: 4, name: 'Verification Status', icon: CheckCircle },
  ];

  const isVerified = dbVendor?.verificationStatus === 'verified' || submission?.status === 'approved';
  const isUnderReview = dbVendor?.verificationStatus === 'under_review' || submission?.status === 'under_review' || submission?.status === 'submitted';
  const isReadOnly = isVerified || isUnderReview;

  return (
    <SiteLayout>
      <div className="container max-w-4xl py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4">Vendor Verification</h1>
          <p className="text-muted-foreground">
            Complete verification to build trust with buyers and unlock all seller features.
          </p>
        </div>

        {/* Smile Identity Badge */}
        {smileIdConfig?.available && !isVerified && !isUnderReview && (
          <Alert className="border-green-200 bg-green-50 mb-6">
            <div className="flex items-center gap-3">
              <ScanFace className="w-5 h-5 text-green-600" />
              <div className="flex-1">
                <p className="font-semibold text-green-800 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Instant KYC Verification Available
                </p>
                <span className="text-sm text-green-700">
                  Get verified automatically in minutes with Smile Identity{' '}
                  {smileIdConfig.environment === 'sandbox' && <Badge variant="secondary" className="text-xs ml-1">Sandbox Mode</Badge>}
                </span>
              </div>
            </div>
          </Alert>
        )}

        {/* Status Banner */}
        {renderStatusBanner()}

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const status = getStepStatus(step.id);
              const isActive = currentStep === step.id;

              return (
                <div key={step.id} className="flex flex-col items-center flex-1">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center border-2 mb-2 cursor-pointer transition-all ${
                      status === 'complete'
                        ? 'bg-green-600 border-green-600 text-white'
                        : isActive
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-gray-300 text-gray-400'
                    }`}
                    onClick={() => !isReadOnly && setCurrentStep(step.id)}
                  >
                    {status === 'complete' ? (
                      <CheckCircle className="w-6 h-6" />
                    ) : (
                      <Icon className="w-6 h-6" />
                    )}
                  </div>
                  <p
                    className={`text-sm font-medium text-center ${
                      isActive ? 'text-blue-600' : status === 'complete' ? 'text-green-600' : 'text-gray-400'
                    }`}
                  >
                    {step.name}
                  </p>
                </div>
              );
            })}
          </div>
          <Progress value={(currentStep / steps.length) * 100} className="w-full" />
        </div>

        {/* Step Content */}
        <Card className="mb-8">
          {/* Step 1: Identity Document */}
          {currentStep === 1 && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Upload Identity Document
                </CardTitle>
                <CardDescription>
                  Upload a clear photo of your government-issued ID
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert className="border-blue-200 bg-blue-50">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    Your documents are encrypted and stored securely. We only use them for verification purposes.
                  </AlertDescription>
                </Alert>

                {/* Verification Method Selection */}
                {smileIdConfig?.available && (
                  <>
                    <div className="space-y-3">
                      <Label className="text-base font-semibold">Verification Method</Label>
                      <RadioGroup value={verificationMethod} onValueChange={(v) => setVerificationMethod(v as 'manual' | 'automated')}>
                        <div className={`flex items-start space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                          verificationMethod === 'automated' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setVerificationMethod('automated')}>
                          <RadioGroupItem value="automated" id="automated" className="mt-1" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Label htmlFor="automated" className="font-semibold cursor-pointer">
                                Instant Verification
                              </Label>
                              <Badge className="bg-green-100 text-green-700 text-xs">
                                <Zap className="w-3 h-3 mr-1" />
                                Recommended
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              Get verified automatically in minutes using Smile Identity KYC
                            </p>
                          </div>
                        </div>
                        <div className={`flex items-start space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                          verificationMethod === 'manual' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setVerificationMethod('manual')}>
                          <RadioGroupItem value="manual" id="manual" className="mt-1" />
                          <div className="flex-1">
                            <Label htmlFor="manual" className="font-semibold cursor-pointer">
                              Manual Review
                            </Label>
                            <p className="text-sm text-muted-foreground mt-1">
                              Submit for manual verification by our team (24-48 hours)
                            </p>
                          </div>
                        </div>
                      </RadioGroup>
                    </div>
                    <Separator />
                  </>
                )}

                {/* Name fields (for Smile ID) */}
                {verificationMethod === 'automated' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>First Name *</Label>
                      <Input
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="First name as on ID"
                        disabled={isReadOnly}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Last Name *</Label>
                      <Input
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Last name as on ID"
                        disabled={isReadOnly}
                      />
                    </div>
                  </div>
                )}

                {/* ID Type Selection */}
                <div className="space-y-2">
                  <Label>ID Type *</Label>
                  <Select value={idType} onValueChange={setIdType} disabled={isReadOnly}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select ID type" />
                    </SelectTrigger>
                    <SelectContent>
                      {supportedIdTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* ID Front Upload */}
                <div className="space-y-2">
                  <Label>ID Front Side *</Label>
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      submission?.governmentId
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {submission?.governmentId ? (
                      <div className="space-y-3">
                        <CheckCircle className="w-12 h-12 text-green-600 mx-auto" />
                        <p className="text-sm text-green-700 font-medium">
                          {submission.governmentId.fileName}
                        </p>
                        {submission.governmentId.fileUrl && (
                          <img
                            src={submission.governmentId.fileUrl}
                            alt="ID Front"
                            className="max-h-40 mx-auto rounded-lg border"
                          />
                        )}
                        {!isReadOnly && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Replace
                          </Button>
                        )}
                      </div>
                    ) : (
                      <>
                        {uploadingField === 'governmentId' ? (
                          <Loader2 className="w-12 h-12 text-gray-400 mx-auto mb-4 animate-spin" />
                        ) : (
                          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        )}
                        <p className="text-sm text-muted-foreground mb-2">
                          Upload front side of your ID
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingField === 'governmentId'}
                        >
                          Choose File
                        </Button>
                      </>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload('governmentId', file);
                      }}
                    />
                  </div>
                </div>

                {/* ID Back Upload (optional) */}
                <div className="space-y-2">
                  <Label>ID Back Side (Optional)</Label>
                  <div
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                      submission?.governmentIdBack
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {submission?.governmentIdBack ? (
                      <div className="space-y-2">
                        <CheckCircle className="w-8 h-8 text-green-600 mx-auto" />
                        <p className="text-sm text-green-700">
                          {submission.governmentIdBack.fileName}
                        </p>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => backIdInputRef.current?.click()}
                          disabled={uploadingField === 'governmentIdBack'}
                        >
                          Upload Back
                        </Button>
                      </>
                    )}
                    <input
                      ref={backIdInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload('governmentIdBack', file);
                      }}
                    />
                  </div>
                </div>

                {/* ID Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>ID Number *</Label>
                    <Input
                      value={idNumber}
                      onChange={(e) => setIdNumber(e.target.value)}
                      placeholder="Enter your ID number"
                      disabled={isReadOnly}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{verificationMethod === 'automated' ? 'Date of Birth *' : 'Issue Date'}</Label>
                    <Input
                      type="date"
                      value={verificationMethod === 'automated' ? dob : idIssueDate}
                      onChange={(e) => verificationMethod === 'automated' ? setDob(e.target.value) : setIdIssueDate(e.target.value)}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Current Address</Label>
                  <Textarea
                    value={currentAddress}
                    onChange={(e) => setCurrentAddress(e.target.value)}
                    placeholder="Enter your current residential address"
                    disabled={isReadOnly}
                  />
                </div>
              </CardContent>
            </>
          )}

          {/* Step 2: Selfie Photo */}
          {currentStep === 2 && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="w-5 h-5" />
                  Upload Selfie Photo
                </CardTitle>
                <CardDescription>
                  Take a clear selfie to verify your identity matches your ID
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert className="border-green-200 bg-green-50">
                  <Shield className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    {verificationMethod === 'automated'
                      ? 'Your selfie will be verified instantly using AI-powered facial recognition.'
                      : 'Your selfie will be compared with your ID photo by our admin team to verify your identity.'}
                  </AlertDescription>
                </Alert>

                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    submission?.selfiePhoto
                      ? 'border-green-300 bg-green-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {submission?.selfiePhoto ? (
                    <div className="space-y-4">
                      <CheckCircle className="w-16 h-16 text-green-600 mx-auto" />
                      <p className="text-green-700 font-medium">Selfie uploaded successfully!</p>
                      {submission.selfiePhoto.fileUrl && (
                        <img
                          src={submission.selfiePhoto.fileUrl}
                          alt="Selfie"
                          className="max-h-48 mx-auto rounded-lg border"
                        />
                      )}
                      {!isReadOnly && (
                        <Button
                          variant="outline"
                          onClick={() => selfieInputRef.current?.click()}
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Retake Photo
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {uploadingField === 'selfiePhoto' ? (
                        <Loader2 className="w-16 h-16 text-gray-400 mx-auto animate-spin" />
                      ) : (
                        <Camera className="w-16 h-16 text-gray-400 mx-auto" />
                      )}
                      <div className="space-y-2">
                        <p className="text-muted-foreground">Take or upload a clear selfie</p>
                        <div className="flex gap-2 justify-center">
                          <Button onClick={() => selfieInputRef.current?.click()}>
                            <Camera className="w-4 h-4 mr-2" />
                            Take/Upload Photo
                          </Button>
                        </div>
                      </div>
                      <ul className="text-sm text-muted-foreground text-left max-w-sm mx-auto space-y-1">
                        <li>• Look directly at the camera</li>
                        <li>• Ensure good lighting</li>
                        <li>• Remove glasses if possible</li>
                        <li>• Keep a neutral expression</li>
                      </ul>
                    </div>
                  )}
                  <input
                    ref={selfieInputRef}
                    type="file"
                    accept="image/*"
                    capture="user"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload('selfiePhoto', file);
                    }}
                  />
                </div>

                {/* Business Documents (Optional) */}
                <Separator />
                <div className="space-y-4">
                  <div>
                    <Label className="text-base font-semibold">Business Documents (Optional)</Label>
                    <p className="text-sm text-muted-foreground">
                      Upload business registration for enhanced trust badge
                    </p>
                  </div>

                  {submission?.businessDocuments && submission.businessDocuments.length > 0 && (
                    <div className="space-y-2">
                      {submission.businessDocuments.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-gray-500" />
                            <span className="text-sm">{doc.fileName}</span>
                          </div>
                          {!isReadOnly && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeBusinessDocument(user.id, doc.id)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {!isReadOnly && (
                    <div className="border-2 border-dashed rounded-lg p-6 text-center">
                      <Building className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => businessDocInputRef.current?.click()}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Add Business Document
                      </Button>
                      <input
                        ref={businessDocInputRef}
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleBusinessDocUpload(file);
                        }}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </>
          )}

          {/* Step 3: Review & Submit */}
          {currentStep === 3 && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Review & Submit
                </CardTitle>
                <CardDescription>
                  Review your information before submitting for verification
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {verificationMethod === 'automated' && smileIdConfig?.available ? (
                  <Alert className="border-green-200 bg-green-50">
                    <Zap className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      <strong>Instant Verification:</strong> Your identity will be verified automatically using Smile Identity.
                      {smileIdConfig.environment === 'sandbox' && ' (Sandbox Mode - instant approval for testing)'}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert className="border-blue-200 bg-blue-50">
                    <Info className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800">
                      Our team will review your submission within 24-48 hours. You'll be notified once verification is complete.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Personal Info Summary */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Personal Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Name:</span>
                        <span className="font-medium">{firstName} {lastName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Email:</span>
                        <span className="font-medium">{user.email}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">ID Type:</span>
                        <span className="font-medium">
                          {supportedIdTypes.find((t) => t.value === idType)?.label || 'Not selected'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">ID Number:</span>
                        <span className="font-medium">{idNumber || 'Not provided'}</span>
                      </div>
                      {verificationMethod === 'automated' && dob && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Date of Birth:</span>
                          <span className="font-medium">{dob}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Documents Summary */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Uploaded Documents</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">ID Document:</span>
                        {submission?.governmentId ? (
                          <Badge className="bg-green-100 text-green-700">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Uploaded
                          </Badge>
                        ) : (
                          <Badge variant="destructive">Missing</Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Selfie Photo:</span>
                        {submission?.selfiePhoto ? (
                          <Badge className="bg-green-100 text-green-700">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Uploaded
                          </Badge>
                        ) : (
                          <Badge variant="destructive">Missing</Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Business Docs:</span>
                        <Badge variant="outline">
                          {submission?.businessDocuments?.length || 0} file(s)
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Validation Errors */}
                {(!submission?.governmentId || !submission?.selfiePhoto || !idType || !idNumber || (verificationMethod === 'automated' && (!firstName || !lastName))) && (
                  <Alert className="border-red-200 bg-red-50">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                      <p className="font-medium mb-2">Please complete the following before submitting:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {!submission?.governmentId && <li>Upload ID document</li>}
                        {!submission?.selfiePhoto && <li>Upload selfie photo</li>}
                        {!idType && <li>Select ID type</li>}
                        {!idNumber && <li>Enter ID number</li>}
                        {verificationMethod === 'automated' && !firstName && <li>Enter first name</li>}
                        {verificationMethod === 'automated' && !lastName && <li>Enter last name</li>}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-4">
                    By submitting, you confirm that all information is accurate and you agree to our Terms of Service.
                  </p>
                  <Button
                    size="lg"
                    className={verificationMethod === 'automated' ? "bg-green-600 hover:bg-green-700" : ""}
                    onClick={handleSubmit}
                    disabled={
                      isSubmitting ||
                      !submission?.governmentId ||
                      !submission?.selfiePhoto ||
                      !idType ||
                      !idNumber ||
                      (verificationMethod === 'automated' && (!firstName || !lastName))
                    }
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        {verificationMethod === 'automated' ? 'Verifying...' : 'Submitting...'}
                      </>
                    ) : verificationMethod === 'automated' ? (
                      <>
                        <Zap className="w-5 h-5 mr-2" />
                        Verify Instantly
                      </>
                    ) : (
                      <>
                        <Shield className="w-5 h-5 mr-2" />
                        Submit for Review
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {/* Step 4: Status */}
          {currentStep === 4 && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {isVerified ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <Clock className="w-5 h-5 text-yellow-600" />
                  )}
                  Verification Status
                </CardTitle>
                <CardDescription>
                  {isVerified
                    ? 'Your verification is complete!'
                    : 'Track the progress of your verification'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isVerified ? (
                  <div className="text-center py-8">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-10 h-10 text-green-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-green-800 mb-2">
                      Verification Complete!
                    </h3>
                    <p className="text-muted-foreground mb-6">
                      Your account is now verified. You have access to all vendor features.
                    </p>
                    <Button onClick={() => router.push('/vendor')}>
                      Go to Dashboard
                    </Button>
                  </div>
                ) : dbVendor?.verificationStatus === 'rejected' || submission?.status === 'rejected' ? (
                  <div className="text-center py-8">
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <XCircle className="w-10 h-10 text-red-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-red-800 mb-2">
                      Verification Rejected
                    </h3>
                    <p className="text-muted-foreground mb-2">
                      Unfortunately, your verification was not approved.
                    </p>
                    {(dbVendor?.verificationNotes || submission?.rejectionReason) && (
                      <p className="text-sm text-red-700 mb-6">
                        Reason: {dbVendor?.verificationNotes || submission?.rejectionReason}
                      </p>
                    )}
                    <Button onClick={() => setCurrentStep(1)}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Start New Submission
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Clock className="w-10 h-10 text-yellow-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-yellow-800 mb-2">
                      Under Review
                    </h3>
                    <p className="text-muted-foreground mb-6">
                      {pendingJob?.jobId
                        ? 'Your verification is being processed. This usually completes within a few minutes.'
                        : 'Your submission is being reviewed by our team. This usually takes 24-48 hours.'}
                    </p>
                    {pendingJob?.jobId && (
                      <p className="text-xs text-muted-foreground mb-4">
                        Job ID: {pendingJob.jobId}
                      </p>
                    )}
                    <div className="max-w-sm mx-auto space-y-3">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm">Documents Submitted</span>
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm">{pendingJob?.jobId ? 'AI Verification' : 'Admin Review'}</span>
                        <Loader2 className="w-5 h-5 text-yellow-600 animate-spin" />
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm">Verification Complete</span>
                        <Clock className="w-5 h-5 text-gray-400" />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </>
          )}
        </Card>

        {/* Navigation */}
        {!isReadOnly && currentStep < 4 && (
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => {
                handleSaveInfo();
                setCurrentStep(Math.max(1, currentStep - 1));
              }}
              disabled={currentStep === 1}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>
            <Button
              onClick={() => {
                handleSaveInfo();
                setCurrentStep(Math.min(3, currentStep + 1));
              }}
              disabled={currentStep === 3}
            >
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}
      </div>
    </SiteLayout>
  );
}

// Export with auth guard wrapper
export default function VendorVerificationPage() {
  return (
    <VendorAuthGuard>
      <VendorVerificationPageContent />
    </VendorAuthGuard>
  );
}
