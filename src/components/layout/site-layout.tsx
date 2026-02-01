"use client";

import { MainNav } from "@/components/layout/main-nav";
import { Footer } from "@/components/layout/footer";
import { BottomNav } from "@/components/layout/bottom-nav";
import { PromotionalBannerDisplay, PopupBannerDisplay, SidebarBannerDisplay } from "@/components/banners/promotional-banner";

interface SiteLayoutProps {
  children: React.ReactNode;
  hideBottomNav?: boolean;
  hideBanners?: boolean;
  showSidebar?: boolean;
}

export function SiteLayout({ children, hideBottomNav = false, hideBanners = false, showSidebar = false }: SiteLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {!hideBanners && <PromotionalBannerDisplay position="top" />}
      <MainNav />
      <main className="flex-1 pb-16 md:pb-0">
        {showSidebar ? (
          <div className="flex">
            <div className="flex-1">{children}</div>
            <aside className="hidden lg:block w-72 p-4">
              <SidebarBannerDisplay />
            </aside>
          </div>
        ) : (
          children
        )}
      </main>
      {!hideBanners && <PromotionalBannerDisplay position="footer" />}
      <Footer />
      {!hideBottomNav && <BottomNav />}
      {/* Popup banner - renders on top of everything */}
      {!hideBanners && <PopupBannerDisplay />}
    </div>
  );
}
