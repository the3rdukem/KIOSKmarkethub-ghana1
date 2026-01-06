"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, CheckCircle, XCircle, Shield, FileText } from "lucide-react";

interface VerificationBannerProps {
  verificationStatus: 'pending' | 'under_review' | 'verified' | 'rejected' | null | undefined;
  verificationNotes?: string | null;
  onStartVerification?: () => void;
}

export function VerificationBanner({ 
  verificationStatus, 
  verificationNotes,
  onStartVerification 
}: VerificationBannerProps) {
  if (verificationStatus === 'verified') {
    return null;
  }

  const getStatusConfig = () => {
    switch (verificationStatus) {
      case 'pending':
        return {
          icon: <Clock className="h-5 w-5 text-yellow-600" />,
          title: "Account Verification Required",
          description: "Your account must be verified before you can publish products. Start the verification process to unlock full selling capabilities.",
          variant: "default" as const,
          className: "border-yellow-200 bg-yellow-50",
          badge: <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">Pending</Badge>,
          showCTA: true,
          ctaText: "Start Verification",
        };
      case 'under_review':
        return {
          icon: <FileText className="h-5 w-5 text-blue-600" />,
          title: "Verification Under Review",
          description: "Your verification documents are being reviewed by our team. This usually takes 1-2 business days. You'll be notified once the review is complete.",
          variant: "default" as const,
          className: "border-blue-200 bg-blue-50",
          badge: <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">Under Review</Badge>,
          showCTA: false,
          ctaText: "",
        };
      case 'rejected':
        return {
          icon: <XCircle className="h-5 w-5 text-red-600" />,
          title: "Verification Rejected",
          description: verificationNotes 
            ? `Your verification was rejected: ${verificationNotes}. Please address the issues and resubmit.`
            : "Your verification was rejected. Please review the feedback and resubmit your documents.",
          variant: "destructive" as const,
          className: "border-red-200 bg-red-50",
          badge: <Badge variant="destructive">Rejected</Badge>,
          showCTA: true,
          ctaText: "Resubmit Verification",
        };
      default:
        return {
          icon: <AlertTriangle className="h-5 w-5 text-yellow-600" />,
          title: "Verification Required",
          description: "Complete your account verification to start selling on the marketplace.",
          variant: "default" as const,
          className: "border-yellow-200 bg-yellow-50",
          badge: <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Not Verified</Badge>,
          showCTA: true,
          ctaText: "Start Verification",
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Alert className={`mb-6 ${config.className}`}>
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 mt-0.5">
          {config.icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <AlertTitle className="mb-0">{config.title}</AlertTitle>
            {config.badge}
          </div>
          <AlertDescription className="text-sm text-muted-foreground">
            {config.description}
          </AlertDescription>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="h-3 w-3" />
              <span>Products created while unverified will be saved as drafts</span>
            </div>
          </div>
        </div>
        {config.showCTA && onStartVerification && (
          <div className="flex-shrink-0">
            <Button onClick={onStartVerification} size="sm" variant="outline">
              {config.ctaText}
            </Button>
          </div>
        )}
      </div>
    </Alert>
  );
}

export function PublishDisabledTooltip({ verificationStatus }: { verificationStatus: string | null | undefined }) {
  if (verificationStatus === 'verified') {
    return null;
  }

  return (
    <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        <span>Publishing disabled: Account verification required</span>
      </div>
    </div>
  );
}
