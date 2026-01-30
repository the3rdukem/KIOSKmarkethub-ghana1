"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CartSheet } from "@/components/cart/cart-sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ShoppingCart,
  Search,
  Shield,
  Store,
  Settings,
  User,
  LogOut,
  Heart,
  Package,
  MessageSquare,
  LayoutDashboard,
  Users,
  ShoppingBag,
  Crown,
  Tag,
  BarChart3,
  Wallet,
  Loader2,
  Menu,
  X,
  Home,
  HelpCircle,
  UserCircle,
  Bell,
  FileText
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { useAuthStore, UserRole } from "@/lib/auth-store";
import { NotificationsPanel } from "@/components/notifications/notifications-panel";
import { toast } from "sonner";

interface BrandingData {
  site_name?: string;
  logo_url?: string;
}

export function MainNav() {
  const pathname = usePathname();
  const router = useRouter();

  // Hydration state to prevent SSR mismatch
  const [isHydrated, setIsHydrated] = useState(false);
  const [branding, setBranding] = useState<BrandingData>({});
  const [brandingLoaded, setBrandingLoaded] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Check if we're on the homepage (has its own search)
  const isHomepage = pathname === '/';

  // Get auth state - these are safe to call but values may change after hydration
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    setIsHydrated(true);
    
    async function fetchBranding() {
      try {
        const res = await fetch('/api/site-settings/public');
        if (res.ok) {
          const data = await res.json();
          if (data.settings) {
            setBranding(data.settings);
          }
        }
      } catch (error) {
        console.error('Failed to fetch branding:', error);
      } finally {
        setBrandingLoaded(true);
      }
    }
    fetchBranding();
  }, []);

  const handleLogout = () => {
    toast.success("Logged out successfully");
    // CRITICAL: logout() performs a hard redirect via window.location.href
    // to prevent chunk load errors. Do NOT use router.push after this.
    logout();
  };

  // Determine user's effective role (including master_admin)
  const getEffectiveRole = (): UserRole | null => {
    if (!user) return null;
    if (user.adminRole === 'MASTER_ADMIN' || user.role === 'master_admin') {
      return 'master_admin';
    }
    return user.role;
  };

  // Safe values - default to unauthenticated state before hydration
  const safeUser = isHydrated ? user : null;
  const safeIsAuthenticated = isHydrated ? isAuthenticated : false;
  const effectiveRole = isHydrated ? getEffectiveRole() : null;

  const getPortalColor = () => {
    if (!safeUser) return "bg-green-600 hover:bg-green-700";
    switch (effectiveRole) {
      case "vendor":
        return "bg-emerald-600 hover:bg-emerald-700";
      case "admin":
        return "bg-purple-600 hover:bg-purple-700";
      case "master_admin":
        return "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600";
      default:
        return "bg-green-600 hover:bg-green-700";
    }
  };

  const siteName = brandingLoaded ? (branding.site_name || 'KIOSK') : '';
  
  const getPortalTitle = () => {
    if (!safeUser) return siteName;
    switch (effectiveRole) {
      case "vendor":
        return "Vendor Portal";
      case "admin":
        return "Admin Portal";
      case "master_admin":
        return "Master Admin";
      default:
        return siteName;
    }
  };

  const getInitials = (name: string | undefined | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadge = () => {
    switch (effectiveRole) {
      case "master_admin":
        return (
          <Badge className="w-fit text-xs mt-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
            <Crown className="w-3 h-3 mr-1" />
            Master Admin
          </Badge>
        );
      case "admin":
        return (
          <Badge variant="default" className="w-fit text-xs mt-1 bg-purple-600">
            Admin
          </Badge>
        );
      case "vendor":
        return (
          <Badge variant="default" className="w-fit text-xs mt-1 bg-emerald-600">
            <Store className="w-3 h-3 mr-1" />
            Vendor
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="w-fit text-xs mt-1 capitalize">
            Buyer
          </Badge>
        );
    }
  };

  // Role-specific menu items
  const getBuyerMenuItems = () => (
    <>
      <DropdownMenuItem asChild>
        <Link href="/buyer/dashboard" className="cursor-pointer">
          <LayoutDashboard className="mr-2 h-4 w-4" />
          My Dashboard
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/buyer/dashboard?tab=orders" className="cursor-pointer">
          <Package className="mr-2 h-4 w-4" />
          My Orders
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/buyer/wishlist" className="cursor-pointer">
          <Heart className="mr-2 h-4 w-4" />
          Wishlist
        </Link>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <Link href="/buyer/profile" className="cursor-pointer">
          <User className="mr-2 h-4 w-4" />
          Profile & Addresses
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/messages" className="cursor-pointer">
          <MessageSquare className="mr-2 h-4 w-4" />
          Messages
        </Link>
      </DropdownMenuItem>
    </>
  );

  const getVendorMenuItems = () => (
    <>
      <DropdownMenuLabel className="text-xs text-muted-foreground">
        Vendor Portal
      </DropdownMenuLabel>
      <DropdownMenuItem asChild>
        <Link href="/vendor" className="cursor-pointer">
          <LayoutDashboard className="mr-2 h-4 w-4" />
          Dashboard
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href={`/vendor/${safeUser?.id || ''}`} className="cursor-pointer">
          <Store className="mr-2 h-4 w-4" />
          My Store
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/vendor/products" className="cursor-pointer">
          <ShoppingBag className="mr-2 h-4 w-4" />
          Products
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/vendor/orders" className="cursor-pointer">
          <Package className="mr-2 h-4 w-4" />
          Orders
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/vendor/promotions" className="cursor-pointer">
          <Tag className="mr-2 h-4 w-4" />
          Promotions
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/vendor/analytics" className="cursor-pointer">
          <BarChart3 className="mr-2 h-4 w-4" />
          Analytics
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/vendor/withdraw" className="cursor-pointer">
          <Wallet className="mr-2 h-4 w-4" />
          Withdrawals
        </Link>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <Link href="/messages" className="cursor-pointer">
          <MessageSquare className="mr-2 h-4 w-4" />
          Messages
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/vendor/settings" className="cursor-pointer">
          <Settings className="mr-2 h-4 w-4" />
          Store Settings
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/vendor/profile" className="cursor-pointer">
          <User className="mr-2 h-4 w-4" />
          My Profile
        </Link>
      </DropdownMenuItem>
    </>
  );

  const getAdminMenuItems = () => (
    <>
      <DropdownMenuLabel className="text-xs text-muted-foreground">
        Admin Portal
      </DropdownMenuLabel>
      <DropdownMenuItem asChild>
        <Link href="/admin" className="cursor-pointer">
          <LayoutDashboard className="mr-2 h-4 w-4" />
          Admin Dashboard
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/admin?tab=buyers" className="cursor-pointer">
          <Users className="mr-2 h-4 w-4" />
          User Management
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/admin?tab=vendors" className="cursor-pointer">
          <Store className="mr-2 h-4 w-4" />
          Vendor Management
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/admin?tab=products" className="cursor-pointer">
          <Package className="mr-2 h-4 w-4" />
          Products
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/admin?tab=audit" className="cursor-pointer">
          <Settings className="mr-2 h-4 w-4" />
          Audit Logs
        </Link>
      </DropdownMenuItem>
    </>
  );

  const getMasterAdminMenuItems = () => (
    <>
      <DropdownMenuLabel className="text-xs text-amber-600 font-semibold flex items-center gap-1">
        <Crown className="w-3 h-3" />
        Master Admin
      </DropdownMenuLabel>
      <DropdownMenuItem asChild>
        <Link href="/admin" className="cursor-pointer">
          <LayoutDashboard className="mr-2 h-4 w-4" />
          Admin Dashboard
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/admin?tab=buyers" className="cursor-pointer">
          <Users className="mr-2 h-4 w-4" />
          User Management
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/admin?tab=vendors" className="cursor-pointer">
          <Store className="mr-2 h-4 w-4" />
          Vendor Management
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/admin?tab=products" className="cursor-pointer">
          <Package className="mr-2 h-4 w-4" />
          Products
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/admin?tab=categories" className="cursor-pointer">
          <Tag className="mr-2 h-4 w-4" />
          Categories
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/admin?tab=site-settings" className="cursor-pointer">
          <Settings className="mr-2 h-4 w-4" />
          Site Settings
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/admin?tab=api" className="cursor-pointer">
          <Shield className="mr-2 h-4 w-4" />
          API Management
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/admin?tab=admins" className="cursor-pointer">
          <Crown className="mr-2 h-4 w-4" />
          Admin Users
        </Link>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <Link href="/admin/verifications" className="cursor-pointer">
          <Shield className="mr-2 h-4 w-4" />
          Vendor Verifications
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/admin/audit-logs" className="cursor-pointer">
          <LayoutDashboard className="mr-2 h-4 w-4" />
          Audit Logs
        </Link>
      </DropdownMenuItem>
    </>
  );

  const getRoleMenuItems = () => {
    if (!safeUser) return null;
    switch (effectiveRole) {
      case "master_admin":
        return getMasterAdminMenuItems();
      case "admin":
        return getAdminMenuItems();
      case "vendor":
        return getVendorMenuItems();
      default:
        return getBuyerMenuItems();
    }
  };

  // Determine if we should show the search bar (hide on homepage - it has its own search)
  const showSearch = (!safeUser || safeUser.role === "buyer") && !isHomepage;

  // Determine if we should show cart
  const showCart = !safeUser || safeUser.role === "buyer";

  // Mobile navigation links
  const getMobileNavLinks = () => {
    const baseLinks = [
      { href: '/', label: 'Home', icon: Home },
      { href: '/search', label: 'Browse Products', icon: Search },
      { href: '/how-it-works', label: 'How It Works', icon: HelpCircle },
    ];
    
    if (safeIsAuthenticated && safeUser) {
      if (effectiveRole === 'buyer') {
        return [
          ...baseLinks,
          { href: '/buyer/dashboard', label: 'My Dashboard', icon: LayoutDashboard },
          { href: '/buyer/orders', label: 'My Orders', icon: ShoppingBag },
          { href: '/buyer/wishlist', label: 'Wishlist', icon: Heart },
          { href: '/messages', label: 'Messages', icon: MessageSquare },
          { href: '/buyer/notifications', label: 'Notifications', icon: Bell },
        ];
      } else if (effectiveRole === 'vendor') {
        return [
          { href: '/vendor', label: 'Dashboard', icon: LayoutDashboard },
          { href: `/vendor/${safeUser?.id || ''}`, label: 'My Store', icon: Store },
          { href: '/vendor/products', label: 'Products', icon: Package },
          { href: '/vendor/orders', label: 'Orders', icon: ShoppingBag },
          { href: '/vendor/promotions', label: 'Promotions', icon: Tag },
          { href: '/vendor/analytics', label: 'Analytics', icon: BarChart3 },
          { href: '/vendor/withdraw', label: 'Withdrawals', icon: Wallet },
          { href: '/messages', label: 'Messages', icon: MessageSquare },
          { href: '/vendor/notifications', label: 'Notifications', icon: Bell },
          { href: '/vendor/settings', label: 'Store Settings', icon: Settings },
          { href: '/vendor/profile', label: 'My Profile', icon: User },
        ];
      } else if (effectiveRole === 'admin' || effectiveRole === 'master_admin') {
        return [
          { href: '/admin', label: 'Admin Dashboard', icon: LayoutDashboard },
          { href: '/admin/verification', label: 'Verifications', icon: Shield },
          { href: '/admin/orders', label: 'Orders', icon: ShoppingBag },
          { href: '/admin/payouts', label: 'Payouts', icon: Wallet },
          { href: '/admin?tab=vendors', label: 'Vendors', icon: Store },
          { href: '/admin?tab=buyers', label: 'Buyers', icon: Users },
          { href: '/admin?tab=products', label: 'Products', icon: Package },
          { href: '/admin?tab=categories', label: 'Categories', icon: Tag },
          { href: '/admin/audit-logs', label: 'Audit Logs', icon: FileText },
          { href: '/admin?tab=site-settings', label: 'Site Settings', icon: Settings },
        ];
      }
    }
    return baseLinks;
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo and Portal Title */}
        <div className="flex items-center space-x-4">
          <Link href="/" className="flex items-center space-x-2">
            <div className={`w-8 h-8 rounded-lg ${getPortalColor()} flex items-center justify-center text-white font-bold overflow-hidden`}>
              {branding.logo_url ? (
                <img src={branding.logo_url} alt={siteName} className="w-full h-full object-cover" />
              ) : effectiveRole === "vendor" ? (
                <Store className="w-4 h-4" />
              ) : effectiveRole === "master_admin" ? (
                <Crown className="w-4 h-4" />
              ) : effectiveRole === "admin" ? (
                <Shield className="w-4 h-4" />
              ) : (
                siteName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
              )}
            </div>
            <span className="font-bold text-xl">{getPortalTitle()}</span>
          </Link>
        </div>

        {/* Search Bar (for buyer portal or public) - Hidden on mobile */}
        {showSearch && (
          <div className="hidden md:flex flex-1 max-w-lg mx-8">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const query = formData.get('q')?.toString().trim();
                if (query) {
                  router.push(`/search?q=${encodeURIComponent(query)}`);
                } else {
                  router.push('/search');
                }
              }}
              className="relative w-full"
            >
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <input
                type="text"
                name="q"
                placeholder="Search products..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </form>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center space-x-4">
          {/* Show loading placeholder before hydration */}
          {!isHydrated ? (
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
              <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
            </div>
          ) : (
            <>
              {/* Verification Badge (for vendors) */}
              {effectiveRole === "vendor" && safeUser && (
                <Badge
                  variant={safeUser.isVerified || safeUser.verificationStatus === 'verified' ? "default" : "destructive"}
                  className={`hidden sm:flex ${safeUser.isVerified || safeUser.verificationStatus === 'verified' ? 'bg-emerald-600' : ''}`}
                >
                  <Shield className="w-3 h-3 mr-1" />
                  {safeUser.isVerified || safeUser.verificationStatus === 'verified' ? "Verified" : "Pending"}
                </Badge>
              )}

              {/* Master Admin Badge */}
              {effectiveRole === "master_admin" && (
                <Badge className="hidden sm:flex bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
                  <Crown className="w-3 h-3 mr-1" />
                  Master
                </Badge>
              )}

              {/* Cart (for buyers or unauthenticated) */}
              {showCart && <CartSheet />}

              {/* Notifications - Hidden on mobile for non-logged-in users */}
              {safeIsAuthenticated && (
                <NotificationsPanel />
              )}

              {/* User Menu */}
              {safeIsAuthenticated && safeUser ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                      <Avatar className="h-10 w-10 border-2 border-gray-200">
                        <AvatarImage src={safeUser.avatar || safeUser.storeLogo} alt={safeUser.name || 'User'} />
                        <AvatarFallback className={
                          effectiveRole === 'master_admin' ? 'bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700' :
                          effectiveRole === 'admin' ? 'bg-purple-100 text-purple-700' :
                          effectiveRole === 'vendor' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-gray-100 text-gray-700'
                        }>
                          {getInitials(safeUser.name)}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64" align="end" forceMount>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-md m-1">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={safeUser.avatar || safeUser.storeLogo} alt={safeUser.name || 'User'} />
                        <AvatarFallback>{getInitials(safeUser.name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col space-y-0.5 leading-none">
                        <p className="font-medium text-sm">{safeUser.name || 'User'}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[150px]">{safeUser.email || ''}</p>
                        {getRoleBadge()}
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    {getRoleMenuItems()}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="text-red-600 cursor-pointer focus:text-red-600 focus:bg-red-50"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <>
                  {/* Desktop: Full Sign In / Register buttons */}
                  <div className="hidden sm:flex items-center space-x-2">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href="/auth/login">Sign In</Link>
                    </Button>
                    <Button size="sm" asChild>
                      <Link href="/auth/register">Register</Link>
                    </Button>
                  </div>
                  {/* Mobile: Account icon */}
                  <Button variant="ghost" size="sm" className="sm:hidden" asChild>
                    <Link href="/auth/login">
                      <UserCircle className="w-6 h-6" />
                    </Link>
                  </Button>
                </>
              )}

              {/* Hamburger Menu - Mobile Only */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="md:hidden p-2">
                    <Menu className="w-6 h-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80">
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg ${getPortalColor()} flex items-center justify-center text-white font-bold`}>
                        K
                      </div>
                      <span>KIOSK</span>
                    </SheetTitle>
                  </SheetHeader>
                  <nav className="mt-8 flex flex-col space-y-1">
                    {getMobileNavLinks().map((link) => (
                      <SheetClose asChild key={link.href}>
                        <Link
                          href={link.href}
                          className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                            pathname === link.href 
                              ? 'bg-green-50 text-green-700' 
                              : 'hover:bg-gray-100'
                          }`}
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <link.icon className="w-5 h-5" />
                          {link.label}
                        </Link>
                      </SheetClose>
                    ))}
                    
                    {/* Auth actions in mobile menu */}
                    {!safeIsAuthenticated && (
                      <>
                        <div className="border-t my-4" />
                        <SheetClose asChild>
                          <Link
                            href="/auth/login"
                            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100"
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            <User className="w-5 h-5" />
                            Sign In
                          </Link>
                        </SheetClose>
                        <SheetClose asChild>
                          <Link
                            href="/auth/register"
                            className="flex items-center gap-3 px-4 py-3 rounded-lg bg-green-600 text-white hover:bg-green-700"
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            <UserCircle className="w-5 h-5" />
                            Create Account
                          </Link>
                        </SheetClose>
                      </>
                    )}
                    
                    {safeIsAuthenticated && safeUser && (
                      <>
                        <div className="border-t my-4" />
                        <div className="px-4 py-2 text-sm text-muted-foreground">
                          Signed in as {safeUser.email}
                        </div>
                        <button
                          onClick={() => {
                            setMobileMenuOpen(false);
                            handleLogout();
                          }}
                          className="flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 w-full text-left"
                        >
                          <LogOut className="w-5 h-5" />
                          Log out
                        </button>
                      </>
                    )}
                  </nav>
                </SheetContent>
              </Sheet>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
