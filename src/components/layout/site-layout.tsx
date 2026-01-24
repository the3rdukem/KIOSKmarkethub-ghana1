"use client";

import { MainNav } from "@/components/layout/main-nav";
import { Footer } from "@/components/layout/footer";
import { BottomNav } from "@/components/layout/bottom-nav";

interface SiteLayoutProps {
  children: React.ReactNode;
  hideBottomNav?: boolean;
}

export function SiteLayout({ children, hideBottomNav = false }: SiteLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <MainNav />
      <main className="flex-1 pb-16 md:pb-0">
        {children}
      </main>
      <Footer />
      {!hideBottomNav && <BottomNav />}
    </div>
  );
}
