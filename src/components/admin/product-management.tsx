"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Package, Eye, CheckCircle, XCircle, AlertTriangle,
  Search, MoreHorizontal, Ban, Trash2, Star, StarOff,
  DollarSign, Tag, Store, Image as ImageIcon, Clock, Pause, Play, Plus, Loader2
} from "lucide-react";
import { formatDistance, format } from "date-fns";
import { toast } from "sonner";
import { Product, useProductsStore } from "@/lib/products-store";
import { useUsersStore } from "@/lib/users-store";

// Types for API data
interface ApiVendor {
  id: string;
  userId: string;
  businessName: string;
  verificationStatus: string;
  userEmail: string;
}

interface ApiCategory {
  id: string;
  name: string;
  slug: string;
  formSchema: CategoryFormField[] | null;
}

interface CategoryFormField {
  key: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
}

interface ProductManagementProps {
  currentAdmin: {
    id: string;
    name: string;
    email?: string;
  };
  isMasterAdmin: boolean;
}

type ProductFilter = "all" | "active" | "draft" | "pending" | "suspended" | "rejected" | "featured";
type ProductAction = "approve" | "reject" | "suspend" | "unsuspend" | "feature" | "unfeature" | "delete" | null;

export function ProductManagement({ currentAdmin, isMasterAdmin }: ProductManagementProps) {
  const {
    products,
    getAllProducts,
    getPendingApprovalProducts,
    getSuspendedProducts,
    getFeaturedProducts,
    approveProduct,
    rejectProduct,
    suspendProduct,
    unsuspendProduct,
    featureProduct,
    unfeatureProduct,
    adminDeleteProduct,
  } = useProductsStore();

  const { getUserById } = useUsersStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionType, setActionType] = useState<ProductAction>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [productFilter, setProductFilter] = useState<ProductFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Admin create product state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [vendors, setVendors] = useState<ApiVendor[]>([]);
  const [apiCategories, setApiCategories] = useState<ApiCategory[]>([]);
  const [newProduct, setNewProduct] = useState({
    vendorId: "",
    name: "",
    description: "",
    category: "",
    price: "",
    quantity: "0",
    status: "active" as "active" | "draft",
    imageUrl: "",
  });
  const [categoryAttributes, setCategoryAttributes] = useState<Record<string, string | boolean>>({});

  // Fetch vendors and categories for admin product creation
  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch verified vendors
        const vendorsRes = await fetch('/api/admin/vendors?verificationStatus=verified');
        const vendorsData = await vendorsRes.json();
        if (vendorsData.vendors) {
          setVendors(vendorsData.vendors);
        }

        // Fetch categories
        const catsRes = await fetch('/api/categories?active=true');
        const catsData = await catsRes.json();
        if (catsData.categories) {
          setApiCategories(catsData.categories);
        }
      } catch (error) {
        console.error('Failed to fetch data for product creation:', error);
      }
    }
    fetchData();
  }, []);

  // Get selected category form schema
  const selectedCategorySchema = useMemo(() => {
    const cat = apiCategories.find(c => c.name === newProduct.category);
    return cat?.formSchema || [];
  }, [apiCategories, newProduct.category]);

  // Handle admin product creation
  const handleCreateProduct = async () => {
    if (!newProduct.vendorId) {
      toast.error("Please select a vendor");
      return;
    }
    if (!newProduct.name.trim()) {
      toast.error("Please enter a product name");
      return;
    }
    if (!newProduct.price || parseFloat(newProduct.price) <= 0) {
      toast.error("Please enter a valid price");
      return;
    }

    setCreateLoading(true);
    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          vendorId: newProduct.vendorId,
          name: newProduct.name,
          description: newProduct.description,
          category: newProduct.category,
          price: newProduct.price,
          quantity: newProduct.quantity,
          status: newProduct.status,
          images: newProduct.imageUrl ? [newProduct.imageUrl] : [],
          categoryAttributes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create product');
      }

      toast.success(`Product "${newProduct.name}" created successfully`);
      setShowCreateDialog(false);
      setNewProduct({
        vendorId: "",
        name: "",
        description: "",
        category: "",
        price: "",
        quantity: "0",
        status: "active",
        imageUrl: "",
      });
      setCategoryAttributes({});

      // Refresh products (in a real app, you'd refetch from API)
      window.location.reload();
    } catch (error) {
      console.error('Failed to create product:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create product');
    } finally {
      setCreateLoading(false);
    }
  };

  // Get unique categories from products
  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category));
    return Array.from(cats).sort();
  }, [products]);

  const getFilteredProducts = () => {
    let filtered = products;

    // Apply status filter
    switch (productFilter) {
      case "active":
        filtered = products.filter(p => p.status === "active");
        break;
      case "draft":
        filtered = products.filter(p => p.status === "draft");
        break;
      case "pending":
        filtered = getPendingApprovalProducts();
        break;
      case "suspended":
        filtered = getSuspendedProducts();
        break;
      case "rejected":
        filtered = products.filter(p => p.status === "rejected");
        break;
      case "featured":
        filtered = getFeaturedProducts();
        break;
      default:
        filtered = products;
    }

    // Apply category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter(p => p.category === categoryFilter);
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.vendorName.toLowerCase().includes(query) ||
        p.sku?.toLowerCase().includes(query) ||
        p.tags.some(t => t.toLowerCase().includes(query))
      );
    }

    return filtered;
  };

  const filteredProducts = getFilteredProducts();

  const getStatusBadge = (product: Product) => {
    const colors: Record<string, string> = {
      active: "bg-green-100 text-green-800",
      draft: "bg-gray-100 text-gray-800",
      archived: "bg-gray-200 text-gray-600",
      pending_approval: "bg-yellow-100 text-yellow-800",
      rejected: "bg-red-100 text-red-800",
      suspended: "bg-red-200 text-red-900",
    };
    return <Badge variant="outline" className={colors[product.status] || "bg-gray-100"}>{product.status.replace("_", " ")}</Badge>;
  };

  const handleAction = (type: ProductAction, product: Product) => {
    setActionType(type);
    setSelectedProduct(product);
    setShowActionDialog(true);
    setActionReason("");
  };

  const executeAction = () => {
    if (!selectedProduct || !actionType) return;

    switch (actionType) {
      case "approve":
        approveProduct(selectedProduct.id, currentAdmin.id);
        toast.success(`"${selectedProduct.name}" has been approved`);
        break;
      case "reject":
        if (!actionReason.trim()) {
          toast.error("Please provide a reason for rejection");
          return;
        }
        rejectProduct(selectedProduct.id, currentAdmin.id, actionReason);
        toast.success(`"${selectedProduct.name}" has been rejected`);
        break;
      case "suspend":
        if (!actionReason.trim()) {
          toast.error("Please provide a reason for suspension");
          return;
        }
        suspendProduct(selectedProduct.id, currentAdmin.id, actionReason);
        toast.success(`"${selectedProduct.name}" has been suspended`);
        break;
      case "unsuspend":
        unsuspendProduct(selectedProduct.id, currentAdmin.id);
        toast.success(`"${selectedProduct.name}" has been unsuspended`);
        break;
      case "feature":
        featureProduct(selectedProduct.id, currentAdmin.id);
        toast.success(`"${selectedProduct.name}" is now featured`);
        break;
      case "unfeature":
        unfeatureProduct(selectedProduct.id, currentAdmin.id);
        toast.success(`"${selectedProduct.name}" is no longer featured`);
        break;
      case "delete":
        adminDeleteProduct(selectedProduct.id, currentAdmin.id);
        toast.success(`"${selectedProduct.name}" has been deleted`);
        break;
    }

    setShowActionDialog(false);
    setSelectedProduct(null);
    setActionType(null);
    setActionReason("");
  };

  const getActionDialogContent = () => {
    if (!actionType || !selectedProduct) return null;

    const configs: Record<Exclude<ProductAction, null>, { title: string; description: string; requiresReason: boolean; buttonText: string; buttonClass: string }> = {
      approve: {
        title: "Approve Product",
        description: `This will approve "${selectedProduct.name}" and make it visible to customers.`,
        requiresReason: false,
        buttonText: "Approve Product",
        buttonClass: "bg-green-600 hover:bg-green-700",
      },
      reject: {
        title: "Reject Product",
        description: `This will reject "${selectedProduct.name}". The vendor will be notified.`,
        requiresReason: true,
        buttonText: "Reject Product",
        buttonClass: "bg-red-600 hover:bg-red-700",
      },
      suspend: {
        title: "Suspend Product",
        description: `This will suspend "${selectedProduct.name}". It will no longer be visible to customers.`,
        requiresReason: true,
        buttonText: "Suspend Product",
        buttonClass: "bg-orange-600 hover:bg-orange-700",
      },
      unsuspend: {
        title: "Unsuspend Product",
        description: `This will unsuspend "${selectedProduct.name}" and make it visible again.`,
        requiresReason: false,
        buttonText: "Unsuspend Product",
        buttonClass: "bg-green-600 hover:bg-green-700",
      },
      feature: {
        title: "Feature Product",
        description: `This will feature "${selectedProduct.name}" on the homepage and search results.`,
        requiresReason: false,
        buttonText: "Feature Product",
        buttonClass: "bg-yellow-600 hover:bg-yellow-700",
      },
      unfeature: {
        title: "Remove from Featured",
        description: `This will remove "${selectedProduct.name}" from featured products.`,
        requiresReason: false,
        buttonText: "Remove from Featured",
        buttonClass: "bg-gray-600 hover:bg-gray-700",
      },
      delete: {
        title: "Delete Product",
        description: `This will permanently delete "${selectedProduct.name}". This action cannot be undone.`,
        requiresReason: false,
        buttonText: "Delete Product",
        buttonClass: "bg-red-700 hover:bg-red-800",
      },
    };

    return configs[actionType];
  };

  const actionConfig = getActionDialogContent();

  // Count by status for quick stats
  const statusCounts = useMemo(() => ({
    all: products.length,
    active: products.filter(p => p.status === "active").length,
    pending: getPendingApprovalProducts().length,
    suspended: getSuspendedProducts().length,
    featured: getFeaturedProducts().length,
  }), [products, getPendingApprovalProducts, getSuspendedProducts, getFeaturedProducts]);

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-5 gap-4">
        <Card className="cursor-pointer hover:border-gray-400 transition-colors" onClick={() => setProductFilter("all")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">All Products</p>
                <p className="text-2xl font-bold">{statusCounts.all}</p>
              </div>
              <Package className="w-8 h-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-green-400 transition-colors" onClick={() => setProductFilter("active")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-green-600">{statusCounts.active}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-yellow-400 transition-colors" onClick={() => setProductFilter("pending")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{statusCounts.pending}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-red-400 transition-colors" onClick={() => setProductFilter("suspended")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Suspended</p>
                <p className="text-2xl font-bold text-red-600">{statusCounts.suspended}</p>
              </div>
              <Pause className="w-8 h-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-amber-400 transition-colors" onClick={() => setProductFilter("featured")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Featured</p>
                <p className="text-2xl font-bold text-amber-600">{statusCounts.featured}</p>
              </div>
              <Star className="w-8 h-8 text-amber-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Products Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Product Management
              </CardTitle>
              <CardDescription>
                Manage all products - approve, reject, suspend, feature, or delete
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              {/* Add Product Button */}
              <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Add Product
              </Button>
              {/* Category Filter */}
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Status Filter */}
              <Select value={productFilter} onValueChange={(v: ProductFilter) => setProductFilter(v)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending">Pending Approval</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="featured">Featured</SelectItem>
                </SelectContent>
              </Select>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search products..."
                  className="pl-10 w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold">No Products Found</h3>
              <p className="text-muted-foreground">
                {searchQuery ? "Try adjusting your search query" : "No products match the current filter"}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                        onCheckedChange={(checked) => {
                          setSelectedProducts(checked ? filteredProducts.map(p => p.id) : []);
                        }}
                      />
                    </TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Featured</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedProducts.includes(product.id)}
                          onCheckedChange={(checked) => {
                            setSelectedProducts(prev =>
                              checked ? [...prev, product.id] : prev.filter(id => id !== product.id)
                            );
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                            {product.images && product.images.length > 0 ? (
                              <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon className="w-6 h-6 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium line-clamp-1">{product.name}</p>
                            <p className="text-xs text-muted-foreground">SKU: {product.sku || "N/A"}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Store className="w-3 h-3 text-gray-400" />
                          <span className="text-sm">{product.vendorName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{product.category}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="font-medium">GHS {product.price.toLocaleString()}</span>
                          {product.comparePrice && (
                            <span className="text-xs text-muted-foreground line-through">
                              {product.comparePrice.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {product.trackQuantity ? (
                          <span className={product.quantity <= 5 ? "text-red-600 font-medium" : ""}>
                            {product.quantity}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Unlimited</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(product)}</TableCell>
                      <TableCell>
                        {product.isFeatured ? (
                          <Star className="w-5 h-5 text-amber-500 fill-current" />
                        ) : (
                          <StarOff className="w-5 h-5 text-gray-300" />
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setSelectedProduct(product); setShowProductDialog(true); }}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />

                            {/* Approval actions */}
                            {(product.status === "pending_approval" || product.approvalStatus === "pending") && (
                              <>
                                <DropdownMenuItem className="text-green-600" onClick={() => handleAction("approve", product)}>
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-red-600" onClick={() => handleAction("reject", product)}>
                                  <XCircle className="w-4 h-4 mr-2" />
                                  Reject
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}

                            {/* Suspend/Unsuspend */}
                            {product.status === "suspended" ? (
                              <DropdownMenuItem className="text-green-600" onClick={() => handleAction("unsuspend", product)}>
                                <Play className="w-4 h-4 mr-2" />
                                Unsuspend
                              </DropdownMenuItem>
                            ) : product.status === "active" && (
                              <DropdownMenuItem className="text-orange-600" onClick={() => handleAction("suspend", product)}>
                                <Pause className="w-4 h-4 mr-2" />
                                Suspend
                              </DropdownMenuItem>
                            )}

                            {/* Feature/Unfeature */}
                            {product.status === "active" && (
                              product.isFeatured ? (
                                <DropdownMenuItem onClick={() => handleAction("unfeature", product)}>
                                  <StarOff className="w-4 h-4 mr-2" />
                                  Remove from Featured
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem className="text-amber-600" onClick={() => handleAction("feature", product)}>
                                  <Star className="w-4 h-4 mr-2" />
                                  Feature Product
                                </DropdownMenuItem>
                              )
                            )}

                            <DropdownMenuSeparator />

                            {/* Delete */}
                            {isMasterAdmin && (
                              <DropdownMenuItem className="text-red-600" onClick={() => handleAction("delete", product)}>
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete Product
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Product Details Dialog */}
      <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedProduct && (
                <>
                  <Package className="w-5 h-5" />
                  {selectedProduct.name}
                </>
              )}
            </DialogTitle>
            <DialogDescription>Product details and moderation</DialogDescription>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4">
              {/* Product Images */}
              {selectedProduct.images && selectedProduct.images.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {selectedProduct.images.map((img, i) => (
                    <img
                      key={i}
                      src={img}
                      alt={`${selectedProduct.name} ${i + 1}`}
                      className="w-24 h-24 object-cover rounded-lg border"
                    />
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Vendor</Label>
                  <p className="text-sm font-medium">{selectedProduct.vendorName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Category</Label>
                  <p className="text-sm font-medium">{selectedProduct.category}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Price</Label>
                  <p className="text-sm font-medium">GHS {selectedProduct.price.toLocaleString()}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Stock</Label>
                  <p className="text-sm font-medium">
                    {selectedProduct.trackQuantity ? selectedProduct.quantity : "Unlimited"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedProduct)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Created</Label>
                  <p className="text-sm font-medium">{format(new Date(selectedProduct.createdAt), "PPP")}</p>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground text-xs">Description</Label>
                <p className="text-sm mt-1">{selectedProduct.description}</p>
              </div>

              {selectedProduct.tags && selectedProduct.tags.length > 0 && (
                <div>
                  <Label className="text-muted-foreground text-xs">Tags</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedProduct.tags.map((tag, i) => (
                      <Badge key={i} variant="secondary">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Moderation Info */}
              {(selectedProduct.suspensionReason || selectedProduct.rejectionReason) && (
                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex items-center gap-2 text-red-800 mb-2">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="font-medium">Moderation Note</span>
                  </div>
                  <p className="text-sm text-red-700">
                    {selectedProduct.suspensionReason || selectedProduct.rejectionReason}
                  </p>
                </div>
              )}

              <DialogFooter className="flex gap-2">
                <Button variant="outline" onClick={() => setShowProductDialog(false)}>Close</Button>

                {(selectedProduct.status === "pending_approval" || selectedProduct.approvalStatus === "pending") && (
                  <>
                    <Button className="bg-green-600 hover:bg-green-700" onClick={() => { setShowProductDialog(false); handleAction("approve", selectedProduct); }}>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve
                    </Button>
                    <Button variant="destructive" onClick={() => { setShowProductDialog(false); handleAction("reject", selectedProduct); }}>
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                  </>
                )}

                {selectedProduct.status === "active" && !selectedProduct.isFeatured && (
                  <Button className="bg-amber-600 hover:bg-amber-700" onClick={() => { setShowProductDialog(false); handleAction("feature", selectedProduct); }}>
                    <Star className="w-4 h-4 mr-2" />
                    Feature
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Confirmation Dialog */}
      <AlertDialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{actionConfig?.title}</AlertDialogTitle>
            <AlertDialogDescription>{actionConfig?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          {actionConfig?.requiresReason && (
            <div className="py-4">
              <Label>Reason</Label>
              <Textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Provide a reason for this action..."
                className="mt-2"
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowActionDialog(false); setActionReason(""); }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className={actionConfig?.buttonClass}
              onClick={executeAction}
              disabled={actionConfig?.requiresReason && !actionReason.trim()}
            >
              {actionConfig?.buttonText}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Product Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Create Product
            </DialogTitle>
            <DialogDescription>
              Create a product on behalf of a verified vendor
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Vendor Selection */}
            <div>
              <Label>Vendor *</Label>
              <Select
                value={newProduct.vendorId}
                onValueChange={(v) => setNewProduct(p => ({ ...p, vendorId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a verified vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">No verified vendors available</div>
                  ) : (
                    vendors.map(v => (
                      <SelectItem key={v.userId} value={v.userId}>
                        {v.businessName} ({v.userEmail})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Only verified vendors can have products published</p>
            </div>

            {/* Product Name */}
            <div>
              <Label>Product Name *</Label>
              <Input
                value={newProduct.name}
                onChange={(e) => setNewProduct(p => ({ ...p, name: e.target.value }))}
                placeholder="Enter product name"
              />
            </div>

            {/* Description */}
            <div>
              <Label>Description</Label>
              <Textarea
                value={newProduct.description}
                onChange={(e) => setNewProduct(p => ({ ...p, description: e.target.value }))}
                placeholder="Product description"
                rows={3}
              />
            </div>

            {/* Category */}
            <div>
              <Label>Category</Label>
              <Select
                value={newProduct.category}
                onValueChange={(v) => {
                  setNewProduct(p => ({ ...p, category: v }));
                  setCategoryAttributes({});
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {apiCategories.map(c => (
                    <SelectItem key={c.id} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category-specific fields */}
            {selectedCategorySchema.length > 0 && (
              <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-700">Category Fields</p>
                {selectedCategorySchema.map(field => (
                  <div key={field.key}>
                    <Label>{field.label} {field.required && "*"}</Label>
                    {field.type === 'select' && field.options ? (
                      <Select
                        value={categoryAttributes[field.key] as string || ""}
                        onValueChange={(v) => setCategoryAttributes(a => ({ ...a, [field.key]: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={field.placeholder || `Select ${field.label}`} />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options.map(opt => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : field.type === 'boolean' ? (
                      <div className="flex items-center gap-2 mt-1">
                        <Checkbox
                          checked={!!categoryAttributes[field.key]}
                          onCheckedChange={(c) => setCategoryAttributes(a => ({ ...a, [field.key]: !!c }))}
                        />
                        <span className="text-sm">Yes</span>
                      </div>
                    ) : (
                      <Input
                        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                        value={categoryAttributes[field.key] as string || ""}
                        onChange={(e) => setCategoryAttributes(a => ({ ...a, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Product Image */}
            <div>
              <Label>Product Image URL</Label>
              <Input
                value={newProduct.imageUrl}
                onChange={(e) => setNewProduct(p => ({ ...p, imageUrl: e.target.value }))}
                placeholder="https://example.com/image.jpg"
              />
              <p className="text-xs text-muted-foreground mt-1">Enter a URL for the product image (optional)</p>
              {newProduct.imageUrl && (
                <div className="mt-2 w-20 h-20 bg-gray-100 rounded-lg overflow-hidden">
                  <img 
                    src={newProduct.imageUrl} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                </div>
              )}
            </div>

            {/* Price and Quantity */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Price (GHS) *</Label>
                <Input
                  type="number"
                  value={newProduct.price}
                  onChange={(e) => setNewProduct(p => ({ ...p, price: e.target.value }))}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  value={newProduct.quantity}
                  onChange={(e) => setNewProduct(p => ({ ...p, quantity: e.target.value }))}
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>

            {/* Status */}
            <div>
              <Label>Status</Label>
              <Select
                value={newProduct.status}
                onValueChange={(v: "active" | "draft") => setNewProduct(p => ({ ...p, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active (Published)</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateProduct} disabled={createLoading}>
              {createLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Product"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
