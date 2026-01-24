import type { Metadata } from "next";

/**
 * Vendor Layout - Auth-Agnostic Shell
 *
 * CRITICAL: This layout MUST NOT:
 * - Use "use client" directive
 * - Import auth stores
 * - Access user/session data
 * - Contain client-side redirects
 *
 * Auth checks happen at the PAGE level using the AuthGuard component.
 * This prevents chunk loading errors because the layout loads successfully
 * regardless of auth state.
 */

export const metadata: Metadata = {
  title: "Vendor Portal - KIOSK",
  description: "Manage your store on KIOSK",
};

export default function VendorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // This is a simple pass-through layout
  // No auth logic here - handled by individual pages
  return <>{children}</>;
}
