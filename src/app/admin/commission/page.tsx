'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Percent, Save, TrendingUp, DollarSign, Store, FolderTree, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { toast } from 'sonner';
import { SiteLayout } from '@/components/layout/site-layout';

interface CommissionSummary {
  totalOrders: number;
  totalRevenue: number;
  totalCommission: number;
  totalVendorEarnings: number;
  avgCommissionRate: number;
}

interface CategoryRate {
  id: string;
  name: string;
  commission_rate: number | null;
}

interface VendorRate {
  id: string;
  user_id: string;
  business_name: string;
  email: string;
  commission_rate: number | null;
}

export default function CommissionPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [defaultRate, setDefaultRate] = useState(8);
  const [editingDefaultRate, setEditingDefaultRate] = useState(8);
  const [categories, setCategories] = useState<CategoryRate[]>([]);
  const [vendors, setVendors] = useState<VendorRate[]>([]);
  const [summary, setSummary] = useState<CommissionSummary | null>(null);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingVendor, setEditingVendor] = useState<string | null>(null);
  const [categoryRates, setCategoryRates] = useState<Record<string, string>>({});
  const [vendorRates, setVendorRates] = useState<Record<string, string>>({});
  const [vendorSearch, setVendorSearch] = useState('');

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    if (!isAuthenticated) {
      router.push("/admin/login");
      return;
    }
    if (user?.role !== "admin" && user?.role !== "master_admin") {
      toast.error("Access denied. Admin privileges required.");
      router.push("/");
    }
  }, [isAuthenticated, user, router, isHydrated]);

  const fetchCommissionData = useCallback(async () => {
    if (!isHydrated || !isAuthenticated) return;
    try {
      const response = await fetch('/api/admin/commission');
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          router.push('/admin/login');
          return;
        }
        throw new Error('Failed to fetch commission data');
      }
      const data = await response.json();
      setDefaultRate(data.defaultRate * 100);
      setEditingDefaultRate(data.defaultRate * 100);
      setCategories(data.categories || []);
      setVendors(data.vendors || []);
      setSummary(data.summary);

      const catRates: Record<string, string> = {};
      data.categories?.forEach((cat: CategoryRate) => {
        catRates[cat.id] = cat.commission_rate !== null ? (cat.commission_rate * 100).toString() : '';
      });
      setCategoryRates(catRates);

      const vendRates: Record<string, string> = {};
      data.vendors?.forEach((vendor: VendorRate) => {
        vendRates[vendor.id] = vendor.commission_rate !== null ? (vendor.commission_rate * 100).toString() : '';
      });
      setVendorRates(vendRates);
    } catch (error) {
      console.error('Error fetching commission data:', error);
    } finally {
      setLoading(false);
    }
  }, [router, isHydrated, isAuthenticated]);

  useEffect(() => {
    if (isHydrated && isAuthenticated) {
      fetchCommissionData();
    }
  }, [fetchCommissionData, isHydrated, isAuthenticated]);

  const saveDefaultRate = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/commission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'default',
          rate: editingDefaultRate / 100
        })
      });
      if (response.ok) {
        setDefaultRate(editingDefaultRate);
        await fetchCommissionData();
      }
    } catch (error) {
      console.error('Error saving default rate:', error);
    } finally {
      setSaving(false);
    }
  };

  const saveCategoryRate = async (categoryId: string) => {
    setSaving(true);
    try {
      const rateValue = categoryRates[categoryId];
      const rate = rateValue === '' ? null : parseFloat(rateValue) / 100;
      const response = await fetch('/api/admin/commission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'category',
          categoryId,
          rate
        })
      });
      if (response.ok) {
        setEditingCategory(null);
        await fetchCommissionData();
      }
    } catch (error) {
      console.error('Error saving category rate:', error);
    } finally {
      setSaving(false);
    }
  };

  const saveVendorRate = async (vendor: VendorRate) => {
    setSaving(true);
    try {
      const rateValue = vendorRates[vendor.id];
      const rate = rateValue === '' ? null : parseFloat(rateValue) / 100;
      const response = await fetch('/api/admin/commission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'vendor',
          vendorId: vendor.user_id,
          rate
        })
      });
      if (response.ok) {
        setEditingVendor(null);
        toast.success(rate === null ? 'Vendor rate cleared - now using platform default' : `Vendor rate updated to ${(rate * 100).toFixed(0)}%`);
        await fetchCommissionData();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update vendor rate');
      }
    } catch (error) {
      console.error('Error saving vendor rate:', error);
      toast.error('Failed to update vendor rate');
    } finally {
      setSaving(false);
    }
  };

  const filteredVendors = vendors.filter(vendor => 
    vendor.business_name?.toLowerCase().includes(vendorSearch.toLowerCase()) ||
    vendor.email?.toLowerCase().includes(vendorSearch.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS'
    }).format(amount);
  };

  if (!isHydrated || !isAuthenticated || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-50">
        <div className="text-center">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Loading Commission Management</h2>
          <p className="text-sm text-muted-foreground">Verifying session...</p>
        </div>
      </div>
    );
  }

  return (
    <SiteLayout>
      <div className="container mx-auto py-8 px-4 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        <div>
          <h1 className="text-3xl font-bold">Commission Management</h1>
          <p className="text-muted-foreground">Configure platform commission rates and view earnings</p>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Orders</CardDescription>
              <CardTitle className="text-2xl">{summary.totalOrders}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <DollarSign className="h-4 w-4" /> Total Revenue
              </CardDescription>
              <CardTitle className="text-2xl">{formatCurrency(summary.totalRevenue)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4" /> Platform Commission
              </CardDescription>
              <CardTitle className="text-2xl text-green-600">{formatCurrency(summary.totalCommission)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Store className="h-4 w-4" /> Vendor Earnings
              </CardDescription>
              <CardTitle className="text-2xl">{formatCurrency(summary.totalVendorEarnings)}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      <Tabs defaultValue="default" className="space-y-4">
        <TabsList>
          <TabsTrigger value="default" className="flex items-center gap-2">
            <Percent className="h-4 w-4" /> Default Rate
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <FolderTree className="h-4 w-4" /> Category Rates
          </TabsTrigger>
          <TabsTrigger value="vendors" className="flex items-center gap-2">
            <Store className="h-4 w-4" /> Vendor Rates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="default">
          <Card>
            <CardHeader>
              <CardTitle>Default Commission Rate</CardTitle>
              <CardDescription>
                This rate applies to all orders unless overridden by vendor-specific or category-specific rates.
                Priority: Vendor Rate &gt; Category Rate &gt; Default Rate
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end gap-4">
                <div className="space-y-2">
                  <Label>Commission Rate (%)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={editingDefaultRate}
                      onChange={(e) => setEditingDefaultRate(parseFloat(e.target.value) || 0)}
                      className="w-32"
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                </div>
                <Button
                  onClick={saveDefaultRate}
                  disabled={saving || editingDefaultRate === defaultRate}
                  className="flex items-center gap-2"
                >
                  <Save className="h-4 w-4" /> Save
                </Button>
              </div>
              <span className="text-sm text-muted-foreground">
                Current rate: <Badge variant="secondary">{defaultRate}%</Badge>
              </span>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <Card>
            <CardHeader>
              <CardTitle>Category Commission Rates</CardTitle>
              <CardDescription>
                Set custom commission rates for specific categories. Leave blank to use default rate.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Commission Rate</TableHead>
                    <TableHead className="w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell className="font-medium">{category.name}</TableCell>
                      <TableCell>
                        {editingCategory === category.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              placeholder={`Default: ${defaultRate}%`}
                              value={categoryRates[category.id] || ''}
                              onChange={(e) => setCategoryRates({
                                ...categoryRates,
                                [category.id]: e.target.value
                              })}
                              className="w-24"
                            />
                            <span className="text-muted-foreground">%</span>
                          </div>
                        ) : (
                          <Badge variant={category.commission_rate !== null ? 'default' : 'secondary'}>
                            {category.commission_rate !== null
                              ? `${(category.commission_rate * 100).toFixed(1)}%`
                              : `Default (${defaultRate}%)`}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingCategory === category.id ? (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => saveCategoryRate(category.id)}
                              disabled={saving}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingCategory(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingCategory(category.id)}
                          >
                            Edit
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {categories.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        No categories found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vendors">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <CardTitle>Vendor Commission Rates</CardTitle>
                  <CardDescription>
                    Set custom commission rates for specific vendors. These override category and default rates.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    placeholder="Search vendors..."
                    value={vendorSearch}
                    onChange={(e) => setVendorSearch(e.target.value)}
                    className="w-64"
                  />
                  {vendorSearch && (
                    <Button variant="ghost" size="sm" onClick={() => setVendorSearch('')}>
                      Clear
                    </Button>
                  )}
                </div>
              </div>
              {vendorSearch && (
                <p className="text-sm text-muted-foreground mt-2">
                  Showing {filteredVendors.length} of {vendors.length} vendors
                </p>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Commission Rate</TableHead>
                    <TableHead className="w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVendors.map((vendor) => (
                    <TableRow key={vendor.id}>
                      <TableCell className="font-medium">{vendor.business_name}</TableCell>
                      <TableCell className="text-muted-foreground">{vendor.email}</TableCell>
                      <TableCell>
                        {editingVendor === vendor.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              placeholder={`Default: ${defaultRate}%`}
                              value={vendorRates[vendor.id] || ''}
                              onChange={(e) => setVendorRates({
                                ...vendorRates,
                                [vendor.id]: e.target.value
                              })}
                              className="w-24"
                            />
                            <span className="text-muted-foreground">%</span>
                          </div>
                        ) : (
                          <Badge variant={vendor.commission_rate !== null ? 'default' : 'secondary'}>
                            {vendor.commission_rate !== null
                              ? `${(vendor.commission_rate * 100).toFixed(1)}%`
                              : `Default (${defaultRate}%)`}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingVendor === vendor.id ? (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => saveVendorRate(vendor)}
                              disabled={saving}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingVendor(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingVendor(vendor.id)}
                          >
                            Edit
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredVendors.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        {vendorSearch ? `No vendors matching "${vendorSearch}"` : 'No vendors found'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        </Tabs>
      </div>
    </SiteLayout>
  );
}
