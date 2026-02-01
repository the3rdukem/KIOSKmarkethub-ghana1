"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Zap,
  Plus,
  Edit,
  Trash2,
  ArrowLeft,
  Loader2,
  Calendar,
  Package,
  Percent,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  Search
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistance, isPast, isFuture } from "date-fns";
import { useAuthStore } from "@/lib/auth-store";
import { getCsrfHeaders } from "@/lib/utils/csrf-client";
import { ImageUpload } from "@/components/ui/image-upload";
import { formatCurrency } from "@/lib/utils/currency";

interface FlashSale {
  id: string;
  name: string;
  description: string | null;
  banner_image: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  product_count?: number;
  product_ids?: string[];
  created_at: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  images: string;
  status: string;
}

interface FlashSaleFormData {
  name: string;
  description: string;
  banner_image: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  starts_at: string;
  ends_at: string;
  product_ids: string[];
}

const defaultFormData: FlashSaleFormData = {
  name: "",
  description: "",
  banner_image: "",
  discount_type: "percentage",
  discount_value: 10,
  starts_at: "",
  ends_at: "",
  product_ids: [],
};

export default function AdminFlashSalesPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  
  const [flashSales, setFlashSales] = useState<FlashSale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedSale, setSelectedSale] = useState<FlashSale | null>(null);
  const [formData, setFormData] = useState<FlashSaleFormData>(defaultFormData);
  const [productSearch, setProductSearch] = useState("");

  useEffect(() => {
    if (!isAuthenticated || (user?.role !== 'admin' && user?.role !== 'master_admin')) {
      router.push('/auth/login');
      return;
    }
    fetchData();
  }, [isAuthenticated, user, router]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [salesRes, productsRes] = await Promise.all([
        fetch('/api/admin/flash-sales', { credentials: 'include' }),
        fetch('/api/products?status=active&limit=500', { credentials: 'include' }),
      ]);
      
      if (salesRes.ok) {
        const data = await salesRes.json();
        setFlashSales(data.flashSales || []);
      }
      
      if (productsRes.ok) {
        const data = await productsRes.json();
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const getSaleStatus = (sale: FlashSale) => {
    if (!sale.is_active) return { label: 'Inactive', color: 'bg-gray-100 text-gray-800' };
    const now = new Date();
    const start = new Date(sale.starts_at);
    const end = new Date(sale.ends_at);
    
    if (isPast(end)) return { label: 'Ended', color: 'bg-red-100 text-red-800' };
    if (isFuture(start)) return { label: 'Scheduled', color: 'bg-blue-100 text-blue-800' };
    return { label: 'Active', color: 'bg-green-100 text-green-800' };
  };

  const handleCreateSale = async () => {
    if (!formData.name || formData.product_ids.length === 0) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/flash-sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getCsrfHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || undefined,
          banner_image: formData.banner_image || undefined,
          discount_type: formData.discount_type,
          discount_value: formData.discount_value,
          starts_at: formData.starts_at,
          ends_at: formData.ends_at,
          product_ids: formData.product_ids,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create flash sale');
      }
      
      toast.success('Flash sale created successfully');
      setShowCreateDialog(false);
      setFormData(defaultFormData);
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create flash sale');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateSale = async () => {
    if (!selectedSale) return;
    
    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/flash-sales/${selectedSale.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getCsrfHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          banner_image: formData.banner_image,
          discount_type: formData.discount_type,
          discount_value: formData.discount_value,
          starts_at: formData.starts_at,
          ends_at: formData.ends_at,
          product_ids: formData.product_ids,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update flash sale');
      }
      
      toast.success('Flash sale updated successfully');
      setShowEditDialog(false);
      setSelectedSale(null);
      setFormData(defaultFormData);
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update flash sale');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (sale: FlashSale) => {
    try {
      const response = await fetch(`/api/admin/flash-sales/${sale.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getCsrfHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify({ is_active: !sale.is_active }),
      });
      
      if (!response.ok) throw new Error('Failed to update');
      
      toast.success(sale.is_active ? 'Flash sale deactivated' : 'Flash sale activated');
      fetchData();
    } catch (error) {
      toast.error('Failed to update flash sale');
    }
  };

  const handleDeleteSale = async (id: string) => {
    if (!confirm('Are you sure you want to delete this flash sale?')) return;
    
    try {
      const response = await fetch(`/api/admin/flash-sales/${id}`, {
        method: 'DELETE',
        headers: getCsrfHeaders(),
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Failed to delete');
      
      toast.success('Flash sale deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete flash sale');
    }
  };

  const openEditDialog = async (sale: FlashSale) => {
    setSelectedSale(sale);
    
    // Fetch full sale details including products
    try {
      const response = await fetch(`/api/admin/flash-sales/${sale.id}`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setFormData({
          name: data.flashSale.name,
          description: data.flashSale.description || "",
          banner_image: data.flashSale.banner_image || "",
          discount_type: data.flashSale.discount_type,
          discount_value: data.flashSale.discount_value,
          starts_at: data.flashSale.starts_at?.slice(0, 16) || "",
          ends_at: data.flashSale.ends_at?.slice(0, 16) || "",
          product_ids: data.flashSale.product_ids || [],
        });
      }
    } catch (error) {
      console.error('Error fetching sale details:', error);
    }
    
    setShowEditDialog(true);
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  const toggleProductSelection = (productId: string) => {
    setFormData(prev => ({
      ...prev,
      product_ids: prev.product_ids.includes(productId)
        ? prev.product_ids.filter(id => id !== productId)
        : [...prev.product_ids, productId],
    }));
  };

  if (!isAuthenticated || (user?.role !== 'admin' && user?.role !== 'master_admin')) {
    return null;
  }

  return (
    <SiteLayout hideBanners>
      <div className="container py-6">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Zap className="w-6 h-6 text-yellow-500" />
              Flash Sales
            </h1>
            <p className="text-muted-foreground">Create platform-wide promotional sales</p>
          </div>
          <Button onClick={() => {
            setFormData(defaultFormData);
            setShowCreateDialog(true);
          }}>
            <Plus className="w-4 h-4 mr-2" />
            Create Flash Sale
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : flashSales.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Zap className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Flash Sales Yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Create your first platform-wide flash sale to boost conversions
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Flash Sale
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flashSales.map((sale) => {
                  const status = getSaleStatus(sale);
                  return (
                    <TableRow key={sale.id}>
                      <TableCell>
                        <div className="font-medium">{sale.name}</div>
                        {sale.description && (
                          <div className="text-sm text-muted-foreground truncate max-w-xs">
                            {sale.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {sale.discount_type === 'percentage' ? (
                            <>
                              <Percent className="w-4 h-4" />
                              {sale.discount_value}% off
                            </>
                          ) : (
                            <>
                              <DollarSign className="w-4 h-4" />
                              {formatCurrency(sale.discount_value)} off
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Package className="w-4 h-4" />
                          {sale.product_count || 0} products
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(sale.starts_at), 'MMM d, yyyy')}
                          </div>
                          <div className="text-muted-foreground">
                            to {format(new Date(sale.ends_at), 'MMM d, yyyy')}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={status.color}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Switch
                            checked={sale.is_active}
                            onCheckedChange={() => handleToggleActive(sale)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(sale)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteSale(sale.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Create Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500" />
                Create Flash Sale
              </DialogTitle>
              <DialogDescription>
                Create a platform-wide promotional sale to boost conversions
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Sale Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Weekend Flash Sale"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Discount Type</Label>
                  <Select
                    value={formData.discount_type}
                    onValueChange={(v) => setFormData({ ...formData, discount_type: v as 'percentage' | 'fixed' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                      <SelectItem value="fixed">Fixed Amount (GHS)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Discount Value *</Label>
                  <Input
                    type="number"
                    min={1}
                    max={formData.discount_type === 'percentage' ? 100 : undefined}
                    value={formData.discount_value}
                    onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Up to 50% off on selected items!"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date & Time *</Label>
                  <Input
                    type="datetime-local"
                    value={formData.starts_at}
                    onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date & Time *</Label>
                  <Input
                    type="datetime-local"
                    value={formData.ends_at}
                    onChange={(e) => setFormData({ ...formData, ends_at: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Banner Image (Optional)</Label>
                <ImageUpload
                  value={formData.banner_image}
                  onChange={(url) => setFormData({ ...formData, banner_image: url })}
                  onRemove={() => setFormData({ ...formData, banner_image: "" })}
                  aspectRatio="banner"
                  description="Recommended: 1200x400px for best display"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Select Products * ({formData.product_ids.length} selected)</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search products..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  {filteredProducts.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      No products found
                    </div>
                  ) : (
                    filteredProducts.slice(0, 50).map((product) => (
                      <div
                        key={product.id}
                        className={`flex items-center gap-3 p-2 hover:bg-muted cursor-pointer border-b last:border-b-0 ${
                          formData.product_ids.includes(product.id) ? 'bg-green-50' : ''
                        }`}
                        onClick={() => toggleProductSelection(product.id)}
                      >
                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                          formData.product_ids.includes(product.id) 
                            ? 'bg-green-600 border-green-600 text-white' 
                            : 'border-gray-300'
                        }`}>
                          {formData.product_ids.includes(product.id) && (
                            <CheckCircle className="w-3 h-3" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{product.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatCurrency(product.price)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateSale} disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Flash Sale
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="w-5 h-5" />
                Edit Flash Sale
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Sale Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Discount Type</Label>
                  <Select
                    value={formData.discount_type}
                    onValueChange={(v) => setFormData({ ...formData, discount_type: v as 'percentage' | 'fixed' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                      <SelectItem value="fixed">Fixed Amount (GHS)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Discount Value *</Label>
                  <Input
                    type="number"
                    min={1}
                    max={formData.discount_type === 'percentage' ? 100 : undefined}
                    value={formData.discount_value}
                    onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date & Time *</Label>
                  <Input
                    type="datetime-local"
                    value={formData.starts_at}
                    onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date & Time *</Label>
                  <Input
                    type="datetime-local"
                    value={formData.ends_at}
                    onChange={(e) => setFormData({ ...formData, ends_at: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Banner Image</Label>
                <ImageUpload
                  value={formData.banner_image}
                  onChange={(url) => setFormData({ ...formData, banner_image: url })}
                  onRemove={() => setFormData({ ...formData, banner_image: "" })}
                  aspectRatio="banner"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Select Products * ({formData.product_ids.length} selected)</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search products..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  {filteredProducts.slice(0, 50).map((product) => (
                    <div
                      key={product.id}
                      className={`flex items-center gap-3 p-2 hover:bg-muted cursor-pointer border-b last:border-b-0 ${
                        formData.product_ids.includes(product.id) ? 'bg-green-50' : ''
                      }`}
                      onClick={() => toggleProductSelection(product.id)}
                    >
                      <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                        formData.product_ids.includes(product.id) 
                          ? 'bg-green-600 border-green-600 text-white' 
                          : 'border-gray-300'
                      }`}>
                        {formData.product_ids.includes(product.id) && (
                          <CheckCircle className="w-3 h-3" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{product.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatCurrency(product.price)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateSale} disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SiteLayout>
  );
}
