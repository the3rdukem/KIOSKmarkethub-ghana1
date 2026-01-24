"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Tag, Percent, Plus, Edit, Trash2, Copy, CheckCircle, Clock,
  AlertTriangle, Loader2, Zap, ShoppingBag, TrendingUp
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { toast } from "sonner";
import { format } from "date-fns";

interface Coupon {
  id: string;
  vendor_user_id: string;
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

interface Product {
  id: string;
  name: string;
  price: number;
  status: string;
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

export default function VendorPromotionsPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  
  const [isHydrated, setIsHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [vendorProducts, setVendorProducts] = useState<Product[]>([]);
  
  const [showCouponDialog, setShowCouponDialog] = useState(false);
  const [showSaleDialog, setShowSaleDialog] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);

  const [couponForm, setCouponForm] = useState({
    code: "", name: "", discountType: "percentage" as "percentage" | "fixed",
    discountValue: 10, minOrderAmount: 0, usageLimit: 0,
    startDate: format(new Date(), "yyyy-MM-dd"),
    endDate: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
  });

  const [saleForm, setSaleForm] = useState({
    name: "", discountType: "percentage" as "percentage" | "fixed",
    discountValue: 10, productIds: [] as string[],
    startDate: format(new Date(), "yyyy-MM-dd"),
    endDate: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
  });

  const fetchData = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const [couponsRes, salesRes, productsRes] = await Promise.all([
        fetch('/api/coupons', { credentials: 'include' }),
        fetch('/api/sales', { credentials: 'include' }),
        fetch(`/api/products?vendorId=${user.id}`, { credentials: 'include' }),
      ]);

      if (couponsRes.ok) {
        const data = await couponsRes.json();
        setCoupons(data.coupons || []);
      }

      if (salesRes.ok) {
        const data = await salesRes.json();
        setSales(data.sales || []);
      }

      if (productsRes.ok) {
        const data = await productsRes.json();
        setVendorProducts(data.products || []);
      }
    } catch (error) {
      console.error('Failed to fetch promotions data:', error);
      toast.error('Failed to load promotions');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { setIsHydrated(true); }, []);
  
  useEffect(() => {
    if (isHydrated && !isAuthenticated) router.push("/auth/login");
    if (isHydrated && user && user.role !== "vendor") router.push("/");
  }, [isHydrated, isAuthenticated, user, router]);

  useEffect(() => {
    if (isHydrated && user) {
      fetchData();
    }
  }, [isHydrated, user, fetchData]);

  if (!isHydrated || isLoading) {
    return <SiteLayout><div className="container py-8 flex justify-center min-h-[400px]"><Loader2 className="w-12 h-12 animate-spin text-emerald-500" /></div></SiteLayout>;
  }
  if (!isAuthenticated || !user || user.role !== "vendor") return null;

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

  const resetCouponForm = () => {
    setCouponForm({ code: "", name: "", discountType: "percentage", discountValue: 10, minOrderAmount: 0, usageLimit: 0, startDate: format(new Date(), "yyyy-MM-dd"), endDate: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd") });
    setEditingCoupon(null);
  };

  const resetSaleForm = () => {
    setSaleForm({ name: "", discountType: "percentage", discountValue: 10, productIds: [], startDate: format(new Date(), "yyyy-MM-dd"), endDate: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd") });
    setEditingSale(null);
  };

  const handleSaveCoupon = async () => {
    if (!couponForm.code.trim() || !couponForm.name.trim()) { 
      toast.error("Please fill required fields"); 
      return; 
    }
    
    setIsSaving(true);
    try {
      const payload = {
        code: couponForm.code.toUpperCase(),
        name: couponForm.name,
        discountType: couponForm.discountType,
        discountValue: couponForm.discountValue,
        minOrderAmount: couponForm.minOrderAmount || 0,
        usageLimit: couponForm.usageLimit || null,
        startDate: new Date(couponForm.startDate).toISOString(),
        endDate: new Date(couponForm.endDate).toISOString(),
      };

      let response;
      if (editingCoupon) {
        response = await fetch(`/api/coupons/${editingCoupon.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
      } else {
        response = await fetch('/api/coupons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
      }

      if (response.ok) {
        toast.success(editingCoupon ? "Coupon updated!" : "Coupon created!");
        setShowCouponDialog(false);
        resetCouponForm();
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to save coupon");
      }
    } catch (error) {
      console.error('Save coupon error:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to save coupon";
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    try {
      const response = await fetch(`/api/coupons/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (response.ok) {
        toast.success("Coupon deleted");
        fetchData();
      } else {
        toast.error("Failed to delete coupon");
      }
    } catch (error) {
      console.error('Delete coupon error:', error);
      toast.error("Failed to delete coupon");
    }
  };

  const handleSaveSale = async () => {
    if (!saleForm.name.trim() || saleForm.productIds.length === 0) { 
      toast.error("Please fill fields and select at least one product"); 
      return; 
    }
    
    setIsSaving(true);
    try {
      const payload = {
        productIds: saleForm.productIds,
        name: saleForm.name,
        discountType: saleForm.discountType,
        discountValue: saleForm.discountValue,
        startDate: new Date(saleForm.startDate).toISOString(),
        endDate: new Date(saleForm.endDate).toISOString(),
      };

      let response;
      if (editingSale) {
        response = await fetch(`/api/sales/${editingSale.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
      } else {
        response = await fetch('/api/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
      }

      if (response.ok) {
        toast.success(editingSale ? "Sale updated!" : "Sale created!");
        setShowSaleDialog(false);
        resetSaleForm();
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to save sale");
      }
    } catch (error) {
      console.error('Save sale error:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to save sale";
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSale = async (id: string) => {
    try {
      const response = await fetch(`/api/sales/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (response.ok) {
        toast.success("Sale deleted");
        fetchData();
      } else {
        toast.error("Failed to delete sale");
      }
    } catch (error) {
      console.error('Delete sale error:', error);
      toast.error("Failed to delete sale");
    }
  };

  const handleEditCoupon = (c: Coupon) => {
    setEditingCoupon(c);
    setCouponForm({ 
      code: c.code, 
      name: c.name, 
      discountType: c.discount_type, 
      discountValue: c.discount_value, 
      minOrderAmount: c.min_order_amount || 0, 
      usageLimit: c.usage_limit || 0, 
      startDate: format(new Date(c.starts_at), "yyyy-MM-dd"), 
      endDate: format(new Date(c.ends_at), "yyyy-MM-dd") 
    });
    setShowCouponDialog(true);
  };

  const handleEditSale = (s: Sale) => {
    setEditingSale(s);
    setSaleForm({ 
      name: s.name, 
      discountType: s.discount_type, 
      discountValue: s.discount_value, 
      productIds: s.product_ids || [], 
      startDate: format(new Date(s.starts_at), "yyyy-MM-dd"), 
      endDate: format(new Date(s.ends_at), "yyyy-MM-dd") 
    });
    setShowSaleDialog(true);
  };

  const toggleProductSelection = (productId: string) => {
    setSaleForm(prev => ({
      ...prev,
      productIds: prev.productIds.includes(productId)
        ? prev.productIds.filter(id => id !== productId)
        : [...prev.productIds, productId]
    }));
  };

  return (
    <SiteLayout>
      <div className="container py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/vendor"><Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4 mr-2" />Back</Button></Link>
          <div><h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Promotions & Discounts</h1><p className="text-muted-foreground text-sm sm:text-base">Manage coupons and sales</p></div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Active Coupons", value: activeCoupons.length, icon: Tag, color: "bg-emerald-100", iconColor: "text-emerald-600" },
            { label: "Active Sales", value: activeSales.length, icon: Zap, color: "bg-red-100", iconColor: "text-red-600" },
            { label: "Products", value: vendorProducts.length, icon: ShoppingBag, color: "bg-blue-100", iconColor: "text-blue-600" },
            { label: "Coupon Uses", value: coupons.reduce((s, c) => s + c.usage_count, 0), icon: TrendingUp, color: "bg-purple-100", iconColor: "text-purple-600" },
          ].map(({ label, value, icon: Icon, color, iconColor }) => (
            <Card key={label} className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${iconColor}`} />
                </div>
                <div><p className="text-2xl font-bold">{value}</p><p className="text-xs text-gray-500">{label}</p></div>
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
              <CardHeader className="flex flex-row items-center justify-between">
                <div><CardTitle>Coupon Codes</CardTitle><CardDescription>Create discount codes for customers</CardDescription></div>
                <Dialog open={showCouponDialog} onOpenChange={(o) => { setShowCouponDialog(o); if (!o) resetCouponForm(); }}>
                  <DialogTrigger asChild><Button className="bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4 mr-2" />Create Coupon</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>{editingCoupon ? "Edit" : "Create"} Coupon</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div><Label>Code *</Label><Input value={couponForm.code} onChange={e => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })} placeholder="SAVE20" disabled={!!editingCoupon} /></div>
                        <div><Label>Name *</Label><Input value={couponForm.name} onChange={e => setCouponForm({ ...couponForm, name: e.target.value })} placeholder="Summer Sale" /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><Label>Type</Label><Select value={couponForm.discountType} onValueChange={v => setCouponForm({ ...couponForm, discountType: v as "percentage" | "fixed" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="percentage">Percentage (%)</SelectItem><SelectItem value="fixed">Fixed (GHS)</SelectItem></SelectContent></Select></div>
                        <div><Label>Value</Label><Input type="number" value={couponForm.discountValue} onChange={e => setCouponForm({ ...couponForm, discountValue: Number(e.target.value) })} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><Label>Min Order (GHS)</Label><Input type="number" value={couponForm.minOrderAmount} onChange={e => setCouponForm({ ...couponForm, minOrderAmount: Number(e.target.value) })} /></div>
                        <div><Label>Usage Limit</Label><Input type="number" value={couponForm.usageLimit} onChange={e => setCouponForm({ ...couponForm, usageLimit: Number(e.target.value) })} placeholder="0 = unlimited" /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><Label>Start Date</Label><Input type="date" value={couponForm.startDate} onChange={e => setCouponForm({ ...couponForm, startDate: e.target.value })} /></div>
                        <div><Label>End Date</Label><Input type="date" value={couponForm.endDate} onChange={e => setCouponForm({ ...couponForm, endDate: e.target.value })} /></div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowCouponDialog(false)}>Cancel</Button>
                      <Button onClick={handleSaveCoupon} className="bg-emerald-600" disabled={isSaving}>
                        {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        {editingCoupon ? "Update" : "Create"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {coupons.length === 0 ? (
                  <div className="text-center py-12"><Tag className="w-16 h-16 text-gray-300 mx-auto mb-4" /><h3 className="font-semibold">No Coupons Yet</h3><p className="text-muted-foreground">Create your first coupon to attract customers</p></div>
                ) : (
                  <Table>
                    <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Discount</TableHead><TableHead>Usage</TableHead><TableHead>Valid</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {coupons.map(c => (
                        <TableRow key={c.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <code className="bg-gray-100 px-2 py-1 rounded font-mono">{c.code}</code>
                              <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(c.code); toast.success("Copied!"); }}><Copy className="w-3 h-3" /></Button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{c.name}</p>
                          </TableCell>
                          <TableCell>{c.discount_type === "percentage" ? `${c.discount_value}%` : `GHS ${c.discount_value}`}</TableCell>
                          <TableCell>{c.usage_count}{c.usage_limit ? `/${c.usage_limit}` : ""}</TableCell>
                          <TableCell className="text-xs">{format(new Date(c.starts_at), "MMM d")} - {format(new Date(c.ends_at), "MMM d, yyyy")}</TableCell>
                          <TableCell>{getStatusBadge(getPromotionStatus(c.starts_at, c.ends_at, c.is_active))}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => handleEditCoupon(c)}><Edit className="w-4 h-4" /></Button>
                              <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDeleteCoupon(c.id)}><Trash2 className="w-4 h-4" /></Button>
                            </div>
                          </TableCell>
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
              <CardHeader className="flex flex-row items-center justify-between">
                <div><CardTitle>Product Sales</CardTitle><CardDescription>Create flash sales on products</CardDescription></div>
                <Dialog open={showSaleDialog} onOpenChange={(o) => { setShowSaleDialog(o); if (!o) resetSaleForm(); }}>
                  <DialogTrigger asChild><Button className="bg-red-600 hover:bg-red-700"><Plus className="w-4 h-4 mr-2" />Create Sale</Button></DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader><DialogTitle>{editingSale ? "Edit" : "Create"} Sale</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                      <div><Label>Sale Name *</Label><Input value={saleForm.name} onChange={e => setSaleForm({ ...saleForm, name: e.target.value })} placeholder="Flash Sale" /></div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><Label>Discount Type</Label><Select value={saleForm.discountType} onValueChange={v => setSaleForm({ ...saleForm, discountType: v as "percentage" | "fixed" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="percentage">Percentage (%)</SelectItem><SelectItem value="fixed">Fixed (GHS)</SelectItem></SelectContent></Select></div>
                        <div><Label>Discount Value</Label><Input type="number" value={saleForm.discountValue} onChange={e => setSaleForm({ ...saleForm, discountValue: Number(e.target.value) })} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><Label>Start Date</Label><Input type="date" value={saleForm.startDate} onChange={e => setSaleForm({ ...saleForm, startDate: e.target.value })} /></div>
                        <div><Label>End Date</Label><Input type="date" value={saleForm.endDate} onChange={e => setSaleForm({ ...saleForm, endDate: e.target.value })} /></div>
                      </div>
                      <div>
                        <Label>Select Products * ({saleForm.productIds.length} selected)</Label>
                        {vendorProducts.length === 0 ? (
                          <div className="border rounded-lg p-4 mt-2 text-center">
                            <ShoppingBag className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                            <p className="text-muted-foreground text-sm">No products available</p>
                            <Link href="/vendor/products/create"><Button variant="link" size="sm">Add a product first</Button></Link>
                          </div>
                        ) : (
                          <div className="border rounded-lg mt-2 max-h-48 overflow-y-auto">
                            {vendorProducts.filter(p => p.status === 'active').map(p => (
                              <div 
                                key={p.id} 
                                className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 border-b last:border-b-0 ${saleForm.productIds.includes(p.id) ? 'bg-emerald-50' : ''}`}
                                onClick={() => toggleProductSelection(p.id)}
                              >
                                <input 
                                  type="checkbox" 
                                  checked={saleForm.productIds.includes(p.id)} 
                                  onChange={() => {}} 
                                  className="w-4 h-4 text-emerald-600 rounded"
                                />
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{p.name}</p>
                                  <p className="text-xs text-muted-foreground">GHS {p.price}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowSaleDialog(false)}>Cancel</Button>
                      <Button onClick={handleSaveSale} className="bg-red-600" disabled={isSaving || vendorProducts.length === 0}>
                        {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        {editingSale ? "Update" : "Create"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {sales.length === 0 ? (
                  <div className="text-center py-12"><Percent className="w-16 h-16 text-gray-300 mx-auto mb-4" /><h3 className="font-semibold">No Sales Yet</h3><p className="text-muted-foreground">Create flash sales to boost conversions</p></div>
                ) : (
                  <Table>
                    <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Products</TableHead><TableHead>Discount</TableHead><TableHead>Duration</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {sales.map(s => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.name}</TableCell>
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
                          <TableCell className="text-xs">{format(new Date(s.starts_at), "MMM d")} - {format(new Date(s.ends_at), "MMM d, yyyy")}</TableCell>
                          <TableCell>{getStatusBadge(getPromotionStatus(s.starts_at, s.ends_at, s.is_active))}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => handleEditSale(s)}><Edit className="w-4 h-4" /></Button>
                              <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDeleteSale(s.id)}><Trash2 className="w-4 h-4" /></Button>
                            </div>
                          </TableCell>
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
