import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { DbInitializer } from "@/components/db-initializer";
import { ClientProvider } from "@/components/providers/client-provider";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "MarketHub - Secure Multi-Vendor Marketplace",
  description: "A secure multi-vendor marketplace platform with vendor verification and Mobile Money integration",
  keywords: "marketplace, e-commerce, mobile money, vendor verification, secure shopping",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geist.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <ClientProvider>
          <DbInitializer>
            {children}
          </DbInitializer>
          <Toaster position="top-right" richColors closeButton />
        </ClientProvider>
      </body>
    </html>
  );
}
