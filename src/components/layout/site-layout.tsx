"use client";

import { MainNav } from "@/components/layout/main-nav";
import { Footer } from "@/components/layout/footer";
import { BottomNav } from "@/components/layout/bottom-nav";
import { PromotionalBannerDisplay } from "@/components/banners/promotional-banner";

interface SiteLayoutProps {
  children: React.ReactNode;
  hideBottomNav?: boolean;
  hideBanners?: boolean;
}

export function SiteLayout({ children, hideBottomNav = false, hideBanners = false }: SiteLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {!hideBanners && <PromotionalBannerDisplay position="top" />}
      <MainNav />
      <main className="flex-1 pb-16 md:pb-0">
        {children}
      </main>
      {!hideBanners && <PromotionalBannerDisplay position="footer" />}
      <Footer />
      {!hideBottomNav && <BottomNav />}
    </div>
  );
}
