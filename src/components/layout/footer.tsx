"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shield, CreditCard, Truck, HeadphonesIcon } from "lucide-react";

interface FooterLink {
  title: string;
  url: string;
  isExternal: boolean;
}

interface FooterData {
  sections: Record<string, FooterLink[]>;
}

interface BrandingData {
  site_name?: string;
  copyright_text?: string;
}

const DEFAULT_SECTIONS: Record<string, FooterLink[]> = {
  'For Buyers': [
    { title: 'How It Works', url: '/how-it-works', isExternal: false },
    { title: 'Buyer Protection', url: '/buyer-protection', isExternal: false },
    { title: 'Mobile Money Guide', url: '/mobile-money', isExternal: false },
    { title: 'Help Center', url: '/help', isExternal: false },
  ],
  'For Vendors': [
    { title: 'Start Selling', url: '/vendor/register', isExternal: false },
    { title: 'Verification Guide', url: '/verification-guide', isExternal: false },
    { title: 'Fees & Commissions', url: '/vendor/fees', isExternal: false },
    { title: 'Seller Resources', url: '/vendor/resources', isExternal: false },
  ],
  'Security': [
    { title: 'Security Center', url: '/security', isExternal: false },
    { title: 'Vendor Verification', url: '/verification', isExternal: false },
    { title: 'Privacy Policy', url: '/privacy', isExternal: false },
    { title: 'Terms of Service', url: '/terms', isExternal: false },
  ],
  'Company': [
    { title: 'About Us', url: '/about', isExternal: false },
    { title: 'Careers', url: '/careers', isExternal: false },
    { title: 'Press', url: '/press', isExternal: false },
    { title: 'Contact', url: '/contact', isExternal: false },
  ],
};

const SECTION_ORDER = ['For Buyers', 'For Vendors', 'Security', 'Company'];

export function Footer() {
  const [sections, setSections] = useState<Record<string, FooterLink[]>>(DEFAULT_SECTIONS);
  const [branding, setBranding] = useState<BrandingData>({});

  useEffect(() => {
    async function fetchData() {
      try {
        const [linksRes, brandingRes] = await Promise.all([
          fetch('/api/footer-links/public'),
          fetch('/api/site-settings/public'),
        ]);
        
        if (linksRes.ok) {
          const linksData: FooterData = await linksRes.json();
          if (linksData.sections && Object.keys(linksData.sections).length > 0) {
            setSections(linksData.sections);
          }
        }
        
        if (brandingRes.ok) {
          const brandingData = await brandingRes.json();
          if (brandingData.settings) {
            setBranding(brandingData.settings);
          }
        }
      } catch (error) {
        console.error('Failed to fetch footer data:', error);
      }
    }
    fetchData();
  }, []);

  const siteName = branding.site_name || 'MarketHub';
  const copyrightText = branding.copyright_text || `© ${new Date().getFullYear()} ${siteName}. All rights reserved. Built with security and trust in mind.`;

  return (
    <footer className="bg-gray-50 border-t">
      <div className="container py-12">
        {/* Trust Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          <div className="flex items-center space-x-3">
            <Shield className="w-8 h-8 text-green-600" />
            <div>
              <h4 className="font-semibold">Verified Vendors</h4>
              <p className="text-sm text-muted-foreground">ID + Facial verification required</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <CreditCard className="w-8 h-8 text-blue-600" />
            <div>
              <h4 className="font-semibold">Mobile Money</h4>
              <p className="text-sm text-muted-foreground">M-Pesa, MTN MoMo & more</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Truck className="w-8 h-8 text-orange-600" />
            <div>
              <h4 className="font-semibold">Secure Escrow</h4>
              <p className="text-sm text-muted-foreground">Funds protected until delivery</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <HeadphonesIcon className="w-8 h-8 text-purple-600" />
            <div>
              <h4 className="font-semibold">24/7 Support</h4>
              <p className="text-sm text-muted-foreground">Help when you need it</p>
            </div>
          </div>
        </div>

        {/* Links */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {SECTION_ORDER.map((sectionName) => {
            const links = sections[sectionName] || [];
            return (
              <div key={sectionName}>
                <h3 className="font-semibold mb-4">{sectionName}</h3>
                <ul className="space-y-2 text-sm">
                  {links.map((link) => (
                    <li key={link.url}>
                      {link.isExternal ? (
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {link.title}
                        </a>
                      ) : (
                        <Link href={link.url} className="text-muted-foreground hover:text-foreground">
                          {link.title}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Copyright */}
        <div className="border-t pt-8 text-center text-sm text-muted-foreground">
          <p>{copyrightText}</p>
        </div>
      </div>
    </footer>
  );
}
