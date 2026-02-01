"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Upload,
  Download,
  Search,
  Filter,
  Edit,
  Trash2,
  Eye,
  Copy,
  Package,
  AlertTriangle,
  CheckCircle,
  MoreHorizontal,
  FileSpreadsheet,
  ImageIcon,
  BarChart3,
  Loader2,
  ArrowLeft
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { useProductsStore, Product } from "@/lib/products-store";
import { useOrdersStore } from "@/lib/orders-store";
import { toast } from "sonner";
import { exportToCSV, PRODUCT_EXPORT_COLUMNS } from "@/lib/utils/csv-export";
import { formatCurrency } from "@/lib/utils/currency";

export default function VendorProductsPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  useProductsStore();
  const { getOrdersByVendor } = useOrdersStore();

  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [vendorProducts, setVendorProducts] = useState<Product[]>([]);

  const fetchVendorProducts = async (vendorId: string) => {
    try {
      const response = await fetch(`/api/products?vendorId=${vendorId}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setVendorProducts(data.products || []);
      }
    } catch (error) {
      console.error('Failed to fetch vendor products:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated && isAuthenticated && user) {
      setIsSyncing(true);
      fetchVendorProducts(user.id);
    }
  }, [isHydrated, isAuthenticated, user]);

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push("/auth/login");
    }
  }, [isHydrated, isAuthenticated, router]);

  if (!isHydrated) {
    return (
      <SiteLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </SiteLayout>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const vendorOrders = user ? getOrdersByVendor(user.id) : [];

  // Filter products based on search and filters
  const filteredProducts = vendorProducts.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (product.sku?.toLowerCase() || "").includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || product.category === categoryFilter;
    const matchesStatus = statusFilter === "all" || product.status === statusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Calculate real metrics
  const totalProducts = vendorProducts.length;
  const activeProducts = vendorProducts.filter(p => p.status === "active").length;
  const lowStockProducts = vendorProducts.filter(p => p.trackQuantity && p.quantity <= 5 && p.quantity > 0).length;
  const outOfStockProducts = vendorProducts.filter(p => p.trackQuantity && p.quantity === 0).length;

  // Get unique categories from vendor's products
  const categories = [...new Set(vendorProducts.map(p => p.category))];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default">Active</Badge>;
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "archived":
        return <Badge variant="outline">Archived</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStockStatus = (product: Product) => {
    if (!product.trackQuantity) {
      return <Badge variant="secondary">Not Tracked</Badge>;
    }
    if (product.quantity === 0) {
      return <Badge variant="destructive">Out of Stock</Badge>;
    } else if (product.quantity <= 5) {
      return <Badge variant="outline" className="border-orange-300 text-orange-700">Low Stock</Badge>;
    } else {
      return <Badge variant="default">In Stock</Badge>;
    }
  };

  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (confirm(`Are you sure you want to delete "${productName}"?`)) {
      try {
        const response = await fetch(`/api/products/${productId}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (response.ok) {
          toast.success(`"${productName}" has been deleted.`);
          if (user) {
            fetchVendorProducts(user.id);
          }
        } else {
          const data = await response.json();
          toast.error(data.error || 'Could not delete product. Please try again.');
        }
      } catch (error) {
        console.error('Delete error:', error);
        toast.error('Could not delete product. Please try again.');
      }
    }
  };

  const handleDuplicateProduct = async (product: Product) => {
    try {
      toast.loading('Duplicating product...', { id: 'duplicate' });

      // Generate unique SKU - strip existing copy suffixes and add timestamp
      let newSku: string | undefined = undefined;
      if (product.sku) {
        const baseSku = product.sku.replace(/-copy(-\d+)?$/i, '');
        newSku = `${baseSku}-copy-${Date.now().toString(36)}`;
      }

      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: `${(product.name ?? '').replace(/ \(Copy\)$/i, '')} (Copy)`,
          description: product.description ?? '',
          category: product.category ?? '',
          price: product.price ?? 0,
          comparePrice: product.comparePrice,
          costPerItem: product.costPerItem,
          sku: newSku,
          barcode: undefined,
          quantity: product.quantity ?? 0,
          trackQuantity: product.trackQuantity ?? true,
          images: Array.isArray(product.images) ? product.images : [],
          tags: Array.isArray(product.tags) ? product.tags : [],
          status: 'draft',
        }),
      });

      toast.dismiss('duplicate');

      if (response.ok) {
        const data = await response.json();
        toast.success('Product duplicated! Edit the draft to publish it.');
        if (data.product?.id) {
          router.push(`/vendor/products/edit/${data.product.id}`);
        } else if (user) {
          fetchVendorProducts(user.id);
        }
      } else {
        const data = await response.json();
        if (data.code === 'VENDOR_NOT_VERIFIED') {
          toast.error('Please complete account verification to create products.');
        } else {
          toast.error(data.error || 'Could not duplicate product. Please try again.');
        }
        if (user) {
          fetchVendorProducts(user.id);
        }
      }
    } catch (error) {
      toast.dismiss('duplicate');
      console.error('Duplicate error:', error);
      toast.error('Could not duplicate product. Please try again.');
      if (user) {
        fetchVendorProducts(user.id);
      }
    }
  };

  const handleBulkUpload = () => {
    setIsUploading(true);
    setUploadProgress(0);

    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          setBulkUploadOpen(false);
          toast.success("Products uploaded successfully!");
          return 100;
        }
        return prev + 10;
      });
    }, 500);
  };

  return (
    <SiteLayout>
      <div className="container py-8">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
            <Link href="/vendor">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Link>
          </Button>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Product Management</h1>
              <p className="text-muted-foreground text-sm sm:text-base">Manage your inventory</p>
            </div>
          <div className="flex gap-3">
            <Dialog open={bulkUploadOpen} onOpenChange={setBulkUploadOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="w-4 h-4 mr-2" />
                  Bulk Upload
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Bulk Product Upload</DialogTitle>
                  <DialogDescription>
                    Upload multiple products at once using a CSV or Excel file
                  </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="upload" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="upload">Upload File</TabsTrigger>
                    <TabsTrigger value="template">Download Template</TabsTrigger>
                  </TabsList>

                  <TabsContent value="upload" className="space-y-4">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                      <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-sm text-muted-foreground mb-2">
                        Drop your CSV or Excel file here, or click to browse
                      </p>
                      <Button variant="outline" size="sm">
                        Choose File
                      </Button>
                    </div>

                    {isUploading && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Uploading products...</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <Progress value={uploadProgress} className="w-full" />
                      </div>
                    )}

                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>File Requirements:</strong> Maximum 1000 products per upload. Supported formats: CSV, XLSX, XLS.
                      </AlertDescription>
                    </Alert>

                    <Button onClick={handleBulkUpload} disabled={isUploading} className="w-full">
                      {isUploading ? "Uploading..." : "Upload Products"}
                    </Button>
                  </TabsContent>

                  <TabsContent value="template" className="space-y-4">
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Download our template to ensure your product data is formatted correctly.
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Button variant="outline" className="justify-start">
                          <Download className="w-4 h-4 mr-2" />
                          Download CSV Template
                        </Button>
                        <Button variant="outline" className="justify-start">
                          <Download className="w-4 h-4 mr-2" />
                          Download Excel Template
                        </Button>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-semibold mb-2">Required Fields:</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          <li>• Product Name</li>
                          <li>• SKU (Stock Keeping Unit)</li>
                          <li>• Category</li>
                          <li>• Price</li>
                          <li>• Stock Quantity</li>
                          <li>• Description</li>
                        </ul>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>

            <Button onClick={() => router.push("/vendor/products/create")}>
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </Button>
          </div>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Products</p>
                  <p className="text-2xl font-bold">{totalProducts}</p>
                </div>
                <Package className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Products</p>
                  <p className="text-2xl font-bold text-green-600">{activeProducts}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Low Stock</p>
                  <p className="text-2xl font-bold text-orange-600">{lowStockProducts}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Out of Stock</p>
                  <p className="text-2xl font-bold text-red-600">{outOfStockProducts}</p>
                </div>
                <Package className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search products by name or SKU..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.filter((c): c is string => c !== null).map((category) => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline">
                <Filter className="w-4 h-4 mr-2" />
                More Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Products Table */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Products ({filteredProducts.length})</CardTitle>
                <CardDescription>Manage your product catalog and inventory</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    if (filteredProducts.length === 0) {
                      toast.error("No products to export");
                      return;
                    }
                    exportToCSV(
                      filteredProducts.map(p => ({
                        id: p.id,
                        name: p.name,
                        category: p.category,
                        price: p.price,
                        quantity: p.quantity,
                        status: p.status,
                        sku: p.sku || '',
                        createdAt: p.createdAt,
                      })),
                      PRODUCT_EXPORT_COLUMNS,
                      `products-export-${new Date().toISOString().split('T')[0]}.csv`
                    );
                    toast.success("Products exported successfully");
                  }}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
                <Button variant="outline" size="sm">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Analytics
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredProducts.length === 0 ? (
              <div className="text-center py-16">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Products Yet</h3>
                <p className="text-muted-foreground mb-4">
                  {vendorProducts.length === 0
                    ? "Start adding products to your store to begin selling."
                    : "No products match your current filters."}
                </p>
                <Button onClick={() => router.push("/vendor/products/create")}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Product
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <input type="checkbox" className="rounded" />
                      </TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <input type="checkbox" className="rounded" />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                              {product.images.length > 0 ? (
                                <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover rounded-lg" />
                              ) : (
                                <ImageIcon className="w-6 h-6 text-gray-400" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{product.name}</p>
                              <p className="text-sm text-muted-foreground">{product.images.length} images</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{product.sku || "-"}</TableCell>
                        <TableCell>{product.category}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{formatCurrency(product.price)}</p>
                            {product.costPerItem && (
                              <p className="text-sm text-muted-foreground">Cost: {formatCurrency(product.costPerItem)}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium">{product.trackQuantity ? `${product.quantity} units` : "N/A"}</p>
                            {getStockStatus(product)}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(product.status)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => router.push(`/product/${product.id}`)}>
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => router.push(`/vendor/products/edit/${product.id}`)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit Product
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDuplicateProduct(product)}>
                                <Copy className="w-4 h-4 mr-2" />
                                Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <BarChart3 className="w-4 h-4 mr-2" />
                                Analytics
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleDeleteProduct(product.id, product.name)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SiteLayout>
  );
}
