"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, Search, ShoppingCart, Package, User, Store, BarChart3, Settings, MessageSquare, Shield } from "lucide-react";
import { useCartStore } from "@/lib/cart-store";
import { useAuthStore } from "@/lib/auth-store";
import { Badge } from "@/components/ui/badge";

interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

const buyerNavItems: NavItem[] = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/search", icon: Search, label: "Search" },
  { href: "/cart", icon: ShoppingCart, label: "Cart" },
  { href: "/buyer/orders", icon: Package, label: "Orders" },
  { href: "/buyer/dashboard", icon: User, label: "Account" },
];

const vendorNavItems: NavItem[] = [
  { href: "/vendor", icon: BarChart3, label: "Dashboard" },
  { href: "/vendor/products", icon: Package, label: "Products" },
  { href: "/vendor/orders", icon: ShoppingCart, label: "Orders" },
  { href: "/messages", icon: MessageSquare, label: "Messages" },
  { href: "/vendor/settings", icon: Settings, label: "Settings" },
];

const adminNavItems: NavItem[] = [
  { href: "/admin", icon: BarChart3, label: "Dashboard" },
  { href: "/admin/vendors", icon: Store, label: "Vendors" },
  { href: "/admin/orders", icon: Package, label: "Orders" },
  { href: "/admin/verification", icon: Shield, label: "Verify" },
  { href: "/admin/settings", icon: Settings, label: "Settings" },
];

export function BottomNav() {
  const pathname = usePathname();
  const { items: cartItems } = useCartStore();
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated || !user) {
    return null;
  }

  let navItems: NavItem[] = buyerNavItems;
  if (user.role === "vendor") {
    navItems = vendorNavItems;
  } else if (user.role === "admin" || user.role === "master_admin") {
    navItems = adminNavItems;
  }

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 md:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          const showCartBadge = item.href === "/cart" && cartCount > 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors relative ${
                active
                  ? "text-green-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${active ? "text-green-600" : ""}`} />
                {showCartBadge && (
                  <Badge className="absolute -top-2 -right-2 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-red-500">
                    {cartCount > 99 ? "99+" : cartCount}
                  </Badge>
                )}
              </div>
              <span className={`text-xs mt-1 ${active ? "font-medium" : ""}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
