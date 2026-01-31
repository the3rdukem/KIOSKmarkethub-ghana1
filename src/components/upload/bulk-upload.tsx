"use client";

import React, { useState, useCallback, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { formatCurrency } from '@/lib/utils/currency';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Upload,
  Download,
  FileSpreadsheet,
  Package,
  CheckCircle,
  AlertTriangle,
  X,
  Eye,
  Edit3,
  Trash2,
  Play,
  Pause,
  RotateCcw,
  FileText,
  Image as ImageIcon,
  Database,
  Zap,
  CloudUpload
} from "lucide-react";
import { toast } from "sonner";

interface ProductData {
  id?: string;
  name: string;
  description: string;
  price: number;
  category: string;
  sku: string;
  stock: number;
  images: string[];
  status: "draft" | "processing" | "completed" | "error";
  errors?: string[];
}

interface BulkUploadProps {
  onProductsUploaded?: (products: ProductData[]) => void;
  existingProducts?: ProductData[];
  className?: string;
}

const csvTemplate = `name,description,price,category,sku,stock,image_urls
iPhone 15 Pro Max,Latest flagship smartphone from Apple,4200,Electronics,IP15PM001,50,"https://example.com/image1.jpg,https://example.com/image2.jpg"
MacBook Air M3,Powerful laptop with M3 chip,5200,Electronics,MBA13M3001,25,"https://example.com/image3.jpg"
Traditional Kente Dress,Handwoven authentic Ghanaian dress,350,Fashion,KEN001,10,"https://example.com/image4.jpg"`;

// Mock CSV parsing service
class CSVService {
  static parseCSV(csvText: string): { data: ProductData[]; errors: string[] } {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
      return { data: [], errors: ['CSV file must contain header and at least one data row'] };
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const requiredHeaders = ['name', 'description', 'price', 'category', 'sku', 'stock'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

    if (missingHeaders.length > 0) {
      return {
        data: [],
        errors: [`Missing required headers: ${missingHeaders.join(', ')}`]
      };
    }

    const data: ProductData[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const row: Record<string, string> = {};

        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });

        // Parse and validate data
        const product: ProductData = {
          id: `bulk_${Date.now()}_${i}`,
          name: row.name,
          description: row.description,
          price: parseFloat(row.price) || 0,
          category: row.category,
          sku: row.sku,
          stock: parseInt(row.stock) || 0,
          images: row.image_urls ? row.image_urls.split(',').map((url: string) => url.trim()) : [],
          status: "draft"
        };

        // Validation
        const productErrors: string[] = [];
        if (!product.name) productErrors.push('Name is required');
        if (!product.description) productErrors.push('Description is required');
        if (product.price <= 0) productErrors.push('Price must be greater than 0');
        if (!product.category) productErrors.push('Category is required');
        if (!product.sku) productErrors.push('SKU is required');
        if (product.stock < 0) productErrors.push('Stock cannot be negative');

        if (productErrors.length > 0) {
          product.status = "error";
          product.errors = productErrors;
          errors.push(`Row ${i + 1}: ${productErrors.join(', ')}`);
        }

        data.push(product);
      } catch (error) {
        errors.push(`Row ${i + 1}: Failed to parse data`);
      }
    }

    return { data, errors };
  }

  static async processProduct(product: ProductData): Promise<ProductData> {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simulate processing with random success/failure
        if (Math.random() > 0.1 && product.status !== "error") { // 90% success rate
          resolve({
            ...product,
            status: "completed",
            id: `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          });
        } else {
          resolve({
            ...product,
            status: "error",
            errors: product.errors || ['Failed to process product']
          });
        }
      }, Math.random() * 2000 + 1000);
    });
  }
}

export function BulkUpload({ onProductsUploaded, existingProducts = [], className = "" }: BulkUploadProps) {
  const [products, setProducts] = useState<ProductData[]>(existingProducts);
  const [csvText, setCsvText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductData | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [uploadMode, setUploadMode] = useState<"csv" | "manual">("csv");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle CSV file upload
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvText(text);

      const { data, errors } = CSVService.parseCSV(text);

      if (errors.length > 0) {
        toast.error(`CSV parsing errors: ${errors.length} issues found`);
      } else {
        toast.success(`Successfully parsed ${data.length} products`);
      }

      setProducts(data);
      setShowPreview(true);
    };

    reader.readAsText(file);
  }, []);

  // Handle manual CSV text input
  const handleCsvParse = useCallback(() => {
    if (!csvText.trim()) {
      toast.error('Please enter CSV data');
      return;
    }

    const { data, errors } = CSVService.parseCSV(csvText);

    if (errors.length > 0) {
      toast.error(`Parsing errors: ${errors.join(', ')}`);
    }

    setProducts(data);
    setShowPreview(true);

    if (data.length > 0) {
      toast.success(`Parsed ${data.length} products`);
    }
  }, [csvText]);

  // Process products
  const processProducts = useCallback(async () => {
    if (products.length === 0) return;

    setIsProcessing(true);
    setProcessingProgress(0);

    const validProducts = products.filter(p => p.status !== "error");

    for (let i = 0; i < validProducts.length; i++) {
      const product = validProducts[i];

      setProducts(prev => prev.map(p =>
        p.id === product.id ? { ...p, status: "processing" } : p
      ));

      try {
        const processedProduct = await CSVService.processProduct(product);

        setProducts(prev => prev.map(p =>
          p.id === product.id ? processedProduct : p
        ));
      } catch (error) {
        setProducts(prev => prev.map(p =>
          p.id === product.id ? {
            ...p,
            status: "error",
            errors: ['Processing failed']
          } : p
        ));
      }

      setProcessingProgress(((i + 1) / validProducts.length) * 100);
    }

    setIsProcessing(false);
    const completedProducts = products.filter(p => p.status === "completed");

    if (completedProducts.length > 0) {
      onProductsUploaded?.(completedProducts);
      toast.success(`Successfully uploaded ${completedProducts.length} products`);
    }
  }, [products, onProductsUploaded]);

  // Remove product
  const removeProduct = useCallback((productId: string) => {
    setProducts(prev => prev.filter(p => p.id !== productId));
  }, []);

  // Edit product
  const saveProductEdit = useCallback((updatedProduct: ProductData) => {
    setProducts(prev => prev.map(p =>
      p.id === updatedProduct.id ? updatedProduct : p
    ));
    setEditingProduct(null);
    toast.success('Product updated');
  }, []);

  // Bulk operations
  const bulkRemove = useCallback(() => {
    setProducts(prev => prev.filter(p => !selectedProducts.includes(p.id!)));
    setSelectedProducts([]);
    toast.success(`Removed ${selectedProducts.length} products`);
  }, [selectedProducts]);

  const toggleProductSelection = useCallback((productId: string) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  }, []);

  const getStatusIcon = (status: ProductData['status']) => {
    switch (status) {
      case "completed": return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "processing": return <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />;
      case "error": return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default: return <Package className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: ProductData['status']) => {
    switch (status) {
      case "completed": return "text-green-600";
      case "processing": return "text-blue-600";
      case "error": return "text-red-600";
      default: return "text-gray-600";
    }
  };

  const stats = {
    total: products.length,
    draft: products.filter(p => p.status === "draft").length,
    processing: products.filter(p => p.status === "processing").length,
    completed: products.filter(p => p.status === "completed").length,
    errors: products.filter(p => p.status === "error").length
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Bulk Product Upload
              </CardTitle>
              <CardDescription>
                Upload multiple products at once using CSV import or manual entry
              </CardDescription>
            </div>

            {stats.total > 0 && (
              <div className="flex gap-2">
                <Badge variant="outline">{stats.total} Total</Badge>
                <Badge variant="secondary">{stats.completed} Completed</Badge>
                {stats.errors > 0 && <Badge variant="destructive">{stats.errors} Errors</Badge>}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={uploadMode} onValueChange={(value) => setUploadMode(value as "csv" | "manual")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="csv">CSV Import</TabsTrigger>
              <TabsTrigger value="manual">Manual Entry</TabsTrigger>
            </TabsList>

            <TabsContent value="csv" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* CSV Upload */}
                <div className="space-y-4">
                  <Label className="text-sm font-medium">Upload CSV File</Label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <Button onClick={() => fileInputRef.current?.click()}>
                      <Upload className="w-4 h-4 mr-2" />
                      Select CSV File
                    </Button>
                    <p className="text-sm text-gray-500 mt-2">
                      Upload a CSV file with product data
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => {
                      const blob = new Blob([csvTemplate], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'product_template.csv';
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="w-full"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download CSV Template
                  </Button>
                </div>

                {/* Manual CSV Input */}
                <div className="space-y-4">
                  <Label className="text-sm font-medium">Or Paste CSV Data</Label>
                  <Textarea
                    placeholder="Paste your CSV data here..."
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    className="min-h-[200px] font-mono text-sm"
                  />
                  <Button onClick={handleCsvParse} className="w-full">
                    <Eye className="w-4 h-4 mr-2" />
                    Parse CSV Data
                  </Button>
                </div>
              </div>

              {/* Sample format */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">CSV Format Example:</h4>
                <pre className="text-xs font-mono text-gray-600 overflow-x-auto">
{`name,description,price,category,sku,stock,image_urls
iPhone 15 Pro,Latest smartphone,4200,Electronics,IP15001,50,"img1.jpg,img2.jpg"
MacBook Air,Powerful laptop,5200,Electronics,MBA001,25,"img3.jpg"`}
                </pre>
              </div>
            </TabsContent>

            <TabsContent value="manual" className="space-y-4">
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Manual Product Entry</h3>
                <p className="text-gray-500 mb-4">
                  Add products one by one using a form interface
                </p>
                <Button>
                  <Upload className="w-4 h-4 mr-2" />
                  Add New Product
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Product Preview and Management */}
      {products.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Product Preview</CardTitle>
                <CardDescription>
                  Review and edit products before uploading
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                {selectedProducts.length > 0 && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remove Selected ({selectedProducts.length})
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Products</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove {selectedProducts.length} selected products?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={bulkRemove}>
                          Remove Products
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}

                <Button
                  onClick={processProducts}
                  disabled={isProcessing || stats.draft === 0}
                  className="flex items-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CloudUpload className="w-4 h-4" />
                      Upload Products ({stats.draft})
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Processing progress */}
            {isProcessing && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Processing products...</span>
                  <span>{Math.round(processingProgress)}%</span>
                </div>
                <Progress value={processingProgress} className="h-2" />
              </div>
            )}
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        checked={selectedProducts.length === products.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProducts(products.map(p => p.id!));
                          } else {
                            setSelectedProducts([]);
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Product Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedProducts.includes(product.id!)}
                          onChange={() => toggleProductSelection(product.id!)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(product.status)}
                          <span className={`text-sm ${getStatusColor(product.status)}`}>
                            {product.status}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{product.name}</p>
                          {product.errors && product.errors.length > 0 && (
                            <p className="text-xs text-red-600">{product.errors[0]}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                      <TableCell>{product.category}</TableCell>
                      <TableCell>{formatCurrency(product.price)}</TableCell>
                      <TableCell>{product.stock}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingProduct(product)}
                          >
                            <Edit3 className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeProduct(product.id!)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Product Edit Dialog */}
      {editingProduct && (
        <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Product</DialogTitle>
              <DialogDescription>
                Modify product details before uploading
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Product Name</Label>
                <Input
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({
                    ...editingProduct,
                    name: e.target.value
                  })}
                />
              </div>
              <div>
                <Label>SKU</Label>
                <Input
                  value={editingProduct.sku}
                  onChange={(e) => setEditingProduct({
                    ...editingProduct,
                    sku: e.target.value
                  })}
                />
              </div>
              <div>
                <Label>Category</Label>
                <Select
                  value={editingProduct.category}
                  onValueChange={(value) => setEditingProduct({
                    ...editingProduct,
                    category: value
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Electronics">Electronics</SelectItem>
                    <SelectItem value="Fashion">Fashion</SelectItem>
                    <SelectItem value="Home & Garden">Home & Garden</SelectItem>
                    <SelectItem value="Sports">Sports</SelectItem>
                    <SelectItem value="Books">Books</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Price (GHS)</Label>
                <Input
                  type="number"
                  value={editingProduct.price}
                  onChange={(e) => setEditingProduct({
                    ...editingProduct,
                    price: parseFloat(e.target.value) || 0
                  })}
                />
              </div>
              <div className="col-span-2">
                <Label>Description</Label>
                <Textarea
                  value={editingProduct.description}
                  onChange={(e) => setEditingProduct({
                    ...editingProduct,
                    description: e.target.value
                  })}
                />
              </div>
              <div>
                <Label>Stock Quantity</Label>
                <Input
                  type="number"
                  value={editingProduct.stock}
                  onChange={(e) => setEditingProduct({
                    ...editingProduct,
                    stock: parseInt(e.target.value) || 0
                  })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setEditingProduct(null)}>
                Cancel
              </Button>
              <Button onClick={() => saveProductEdit(editingProduct)}>
                Save Changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
