"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { getSafeRedirectUrl } from "@/lib/utils/safe-redirect";

function LoginRedirectContent() {
  const [isHydrated, setIsHydrated] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated) {
      const safeRedirect = getSafeRedirectUrl(searchParams.get('redirect'));
      const targetUrl = safeRedirect 
        ? `/auth/login?redirect=${encodeURIComponent(safeRedirect)}`
        : "/auth/login";
      window.location.href = targetUrl;
    }
  }, [isHydrated, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-600 mx-auto mb-4"></div>
        <p className="text-lg text-gray-600">Redirecting to login...</p>
      </div>
    </div>
  );
}

export default function LoginRedirectPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    }>
      <LoginRedirectContent />
    </Suspense>
  );
}
