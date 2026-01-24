"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, Tag, Percent, CheckCircle, Clock, AlertTriangle, Loader2, Eye
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { format } from "date-fns";

interface Coupon {
  id: string;
  vendor_user_id: string;
  vendor_name?: string;
  code: string;
  name: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_amount: number;
  usage_limit: number | null;
  usage_count: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  created_at: string;
}

interface Sale {
  id: string;
  vendor_user_id: string;
  vendor_name?: string;
  name: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  created_at: string;
  product_ids?: string[];
  product_names?: string[];
}

type PromotionStatus = 'active' | 'scheduled' | 'expired' | 'disabled';

function getPromotionStatus(startsAt: string, endsAt: string, isActive: boolean): PromotionStatus {
  if (!isActive) return 'disabled';
  const now = new Date();
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (now < start) return 'scheduled';
  if (now > end) return 'expired';
  return 'active';
}

export default function AdminPromotionsPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  
  const [isHydrated, setIsHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);

  useEffect(() => { setIsHydrated(true); }, []);
  
  useEffect(() => {
    if (isHydrated && !isAuthenticated) router.push("/auth/login");
    if (isHydrated && user && user.role !== "admin" && user.role !== "master_admin") router.push("/");
  }, [isHydrated, isAuthenticated, user, router]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      setIsLoading(true);
      try {
        const [couponsRes, salesRes] = await Promise.all([
          fetch('/api/coupons', { credentials: 'include' }),
          fetch('/api/sales', { credentials: 'include' }),
        ]);

        if (couponsRes.ok) {
          const data = await couponsRes.json();
          setCoupons(data.coupons || []);
        }

        if (salesRes.ok) {
          const data = await salesRes.json();
          setSales(data.sales || []);
        }
      } catch (error) {
        console.error('Failed to fetch promotions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isHydrated && user) {
      fetchData();
    }
  }, [isHydrated, user]);

  if (!isHydrated || isLoading) {
    return <SiteLayout><div className="container py-8 flex justify-center min-h-[400px]"><Loader2 className="w-12 h-12 animate-spin text-emerald-500" /></div></SiteLayout>;
  }
  
  if (!isAuthenticated || !user || (user.role !== "admin" && user.role !== "master_admin")) return null;

  const activeCoupons = coupons.filter(c => getPromotionStatus(c.starts_at, c.ends_at, c.is_active) === 'active');
  const activeSales = sales.filter(s => getPromotionStatus(s.starts_at, s.ends_at, s.is_active) === 'active');

  const getStatusBadge = (status: PromotionStatus) => {
    const configs: Record<PromotionStatus, { className: string; icon: React.ReactNode; label: string }> = {
      active: { className: "bg-green-100 text-green-800", icon: <CheckCircle className="w-3 h-3 mr-1" />, label: "Active" },
      scheduled: { className: "bg-blue-100 text-blue-800", icon: <Clock className="w-3 h-3 mr-1" />, label: "Scheduled" },
      expired: { className: "bg-gray-100 text-gray-800", icon: <AlertTriangle className="w-3 h-3 mr-1" />, label: "Expired" },
      disabled: { className: "bg-red-100 text-red-800", icon: null, label: "Disabled" },
    };
    const config = configs[status];
    return <Badge className={config.className}>{config.icon}{config.label}</Badge>;
  };

  return (
    <SiteLayout>
      <div className="container py-8">
        <div className="mb-8">
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
            <Link href="/admin">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Link>
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">All Promotions</h1>
                <Badge variant="outline" className="ml-2"><Eye className="w-3 h-3 mr-1" />Read Only</Badge>
              </div>
              <p className="text-muted-foreground">View all vendor coupons and sales across the platform</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Coupons", value: coupons.length, active: activeCoupons.length, icon: Tag, color: "bg-emerald-100", iconColor: "text-emerald-600" },
            { label: "Total Sales", value: sales.length, active: activeSales.length, icon: Percent, color: "bg-red-100", iconColor: "text-red-600" },
          ].map(({ label, value, active, icon: Icon, color, iconColor }) => (
            <Card key={label} className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${iconColor}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-xs text-gray-500">{label} ({active} active)</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="coupons" className="space-y-6">
          <TabsList>
            <TabsTrigger value="coupons"><Tag className="w-4 h-4 mr-2" />Coupons ({coupons.length})</TabsTrigger>
            <TabsTrigger value="sales"><Percent className="w-4 h-4 mr-2" />Sales ({sales.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="coupons">
            <Card>
              <CardHeader>
                <CardTitle>All Vendor Coupons</CardTitle>
                <CardDescription>Platform-wide view of all coupon codes</CardDescription>
              </CardHeader>
              <CardContent>
                {coupons.length === 0 ? (
                  <div className="text-center py-12">
                    <Tag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="font-semibold">No Coupons</h3>
                    <p className="text-muted-foreground">No vendors have created coupons yet</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Discount</TableHead>
                        <TableHead>Usage</TableHead>
                        <TableHead>Valid Period</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {coupons.map(c => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.vendor_name || 'Unknown Vendor'}</TableCell>
                          <TableCell>
                            <code className="bg-gray-100 px-2 py-1 rounded font-mono text-sm">{c.code}</code>
                            <p className="text-xs text-muted-foreground mt-1">{c.name}</p>
                          </TableCell>
                          <TableCell>
                            {c.discount_type === "percentage" ? `${c.discount_value}%` : `GHS ${c.discount_value}`}
                            {c.min_order_amount > 0 && (
                              <p className="text-xs text-muted-foreground">Min: GHS {c.min_order_amount}</p>
                            )}
                          </TableCell>
                          <TableCell>{c.usage_count}{c.usage_limit ? `/${c.usage_limit}` : ""}</TableCell>
                          <TableCell className="text-xs">
                            {format(new Date(c.starts_at), "MMM d, yyyy")} - {format(new Date(c.ends_at), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>{getStatusBadge(getPromotionStatus(c.starts_at, c.ends_at, c.is_active))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sales">
            <Card>
              <CardHeader>
                <CardTitle>All Product Sales</CardTitle>
                <CardDescription>Platform-wide view of all flash sales</CardDescription>
              </CardHeader>
              <CardContent>
                {sales.length === 0 ? (
                  <div className="text-center py-12">
                    <Percent className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="font-semibold">No Sales</h3>
                    <p className="text-muted-foreground">No vendors have created sales yet</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Sale Name</TableHead>
                        <TableHead>Products</TableHead>
                        <TableHead>Discount</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sales.map(s => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.vendor_name || 'Unknown Vendor'}</TableCell>
                          <TableCell>{s.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px]">
                            {s.product_names && s.product_names.length > 0 ? (
                              <div className="space-y-1">
                                {s.product_names.slice(0, 2).map((name, i) => (
                                  <Badge key={i} variant="outline" className="text-xs mr-1">{name}</Badge>
                                ))}
                                {s.product_names.length > 2 && (
                                  <Badge variant="secondary" className="text-xs">+{s.product_names.length - 2} more</Badge>
                                )}
                              </div>
                            ) : 'No products'}
                          </TableCell>
                          <TableCell>{s.discount_type === "percentage" ? `${s.discount_value}%` : `GHS ${s.discount_value}`}</TableCell>
                          <TableCell className="text-xs">
                            {format(new Date(s.starts_at), "MMM d, yyyy")} - {format(new Date(s.ends_at), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>{getStatusBadge(getPromotionStatus(s.starts_at, s.ends_at, s.is_active))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </SiteLayout>
  );
}
