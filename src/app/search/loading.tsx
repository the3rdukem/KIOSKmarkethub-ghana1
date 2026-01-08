"use client";

import { SiteLayout } from "@/components/layout/site-layout";
import { Loader2 } from "lucide-react";

export default function SearchLoading() {
  return (
    <SiteLayout>
      <div className="container py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-12 h-12 animate-spin text-gray-400" />
        </div>
      </div>
    </SiteLayout>
  );
}
