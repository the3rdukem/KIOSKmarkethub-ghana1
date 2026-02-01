"use client";

import { useState, useEffect } from "react";
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
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Layers, Plus, Edit, Trash2, MoreHorizontal, RefreshCw, Loader2, Tag, FolderTree
} from "lucide-react";
import { toast } from "sonner";
import { AttributeOptionsManager } from "./attribute-options-manager";

interface CategoryFormField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'multi_select' | 'boolean' | 'date' | 'textarea' | 'dependent_select';
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
  dependsOn?: string;
  optionsSource?: string;
  level?: number;
  childFieldKey?: string;
}

interface ApiCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  imageUrl: string | null;
  parentId: string | null;
  isActive: boolean;
  showInMenu: boolean;
  showInHome: boolean;
  displayOrder: number;
  formSchema: CategoryFormField[] | null;
  createdAt: string;
  updatedAt: string;
}

interface CategoryStats {
  total: number;
  active: number;
  inactive: number;
  withSchema: number;
}

interface CategoryFormData {
  name: string;
  description: string;
  icon: string;
  isActive: boolean;
  showInMenu: boolean;
  showInHome: boolean;
  formSchema: CategoryFormField[];
}

const initialFormData: CategoryFormData = {
  name: "",
  description: "",
  icon: "",
  isActive: true,
  showInMenu: true,
  showInHome: true,
  formSchema: [],
};

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Dropdown' },
  { value: 'dependent_select', label: 'Cascading Dropdown' },
  { value: 'multi_select', label: 'Multi-Select' },
  { value: 'boolean', label: 'Yes/No' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'date', label: 'Date' },
];

export function CategoryManagement() {
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSchemaDialog, setShowSchemaDialog] = useState(false);
  const [showOptionsDialog, setShowOptionsDialog] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<ApiCategory | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>(initialFormData);

  const [newField, setNewField] = useState<CategoryFormField>({
    key: "",
    label: "",
    type: "text",
    required: false,
    options: [],
    dependsOn: undefined,
    optionsSource: undefined,
    level: 1,
  });
  const [newFieldOption, setNewFieldOption] = useState("");

  async function fetchCategories() {
    try {
      setLoading(true);
      const res = await fetch("/api/categories?active=false");
      const data = await res.json();
      if (data.categories) {
        setCategories(data.categories);
      }
    } catch (error) {
      console.error("Failed to fetch categories:", error);
      toast.error("Failed to load categories");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCategories();
  }, []);

  async function handleCreate() {
    if (!formData.name.trim()) {
      toast.error("Category name is required");
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || undefined,
          icon: formData.icon || undefined,
          isActive: formData.isActive,
          showInMenu: formData.showInMenu,
          showInHome: formData.showInHome,
          formSchema: formData.formSchema.length > 0 ? formData.formSchema : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(`Category "${formData.name}" created`);
      setShowCreateDialog(false);
      setFormData(initialFormData);
      fetchCategories();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create category");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUpdate() {
    if (!selectedCategory || !formData.name.trim()) return;

    setActionLoading(true);
    try {
      const res = await fetch("/api/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          categoryId: selectedCategory.id,
          name: formData.name,
          description: formData.description || undefined,
          icon: formData.icon || undefined,
          isActive: formData.isActive,
          showInMenu: formData.showInMenu,
          showInHome: formData.showInHome,
          formSchema: formData.formSchema.length > 0 ? formData.formSchema : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(`Category "${formData.name}" updated`);
      setShowEditDialog(false);
      setSelectedCategory(null);
      setFormData(initialFormData);
      fetchCategories();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update category");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete() {
    if (!selectedCategory) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/categories?id=${selectedCategory.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(`Category "${selectedCategory.name}" deleted`);
      setShowDeleteDialog(false);
      setSelectedCategory(null);
      fetchCategories();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete category");
    } finally {
      setActionLoading(false);
    }
  }

  function openEditDialog(category: ApiCategory) {
    setSelectedCategory(category);
    setFormData({
      name: category.name,
      description: category.description || "",
      icon: category.icon || "",
      isActive: category.isActive,
      showInMenu: category.showInMenu,
      showInHome: category.showInHome,
      formSchema: category.formSchema || [],
    });
    setShowEditDialog(true);
  }

  function openSchemaDialog(category: ApiCategory) {
    setSelectedCategory(category);
    setFormData({
      ...initialFormData,
      formSchema: category.formSchema || [],
    });
    setShowSchemaDialog(true);
  }

  function addFieldToSchema() {
    if (!newField.key || !newField.label) {
      toast.error("Field key and label are required");
      return;
    }
    if (formData.formSchema.some(f => f.key === newField.key)) {
      toast.error("Field key must be unique");
      return;
    }
    if (newField.type === 'dependent_select' && (newField.level || 1) > 3) {
      toast.error("Maximum 3 levels allowed for cascading dropdowns");
      return;
    }

    const fieldToAdd: CategoryFormField = { ...newField };
    if (newField.type === 'dependent_select') {
      fieldToAdd.optionsSource = 'attribute_options';
      if (!newField.dependsOn) {
        fieldToAdd.level = 1;
      }
    }

    setFormData({
      ...formData,
      formSchema: [...formData.formSchema, fieldToAdd],
    });
    setNewField({
      key: "",
      label: "",
      type: "text",
      required: false,
      options: [],
      dependsOn: undefined,
      optionsSource: undefined,
      level: 1,
    });
  }

  function removeFieldFromSchema(key: string) {
    setFormData({
      ...formData,
      formSchema: formData.formSchema.filter(f => f.key !== key),
    });
  }

  async function saveSchema() {
    if (!selectedCategory) return;

    setActionLoading(true);
    try {
      const res = await fetch("/api/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          categoryId: selectedCategory.id,
          formSchema: formData.formSchema,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success("Schema updated successfully");
      setShowSchemaDialog(false);
      setSelectedCategory(null);
      fetchCategories();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update schema");
    } finally {
      setActionLoading(false);
    }
  }

  const stats: CategoryStats = {
    total: categories.length,
    active: categories.filter(c => c.isActive).length,
    inactive: categories.filter(c => !c.isActive).length,
    withSchema: categories.filter(c => c.formSchema && c.formSchema.length > 0).length,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Categories</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Active</p>
            <p className="text-2xl font-bold text-green-600">{stats.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Inactive</p>
            <p className="text-2xl font-bold text-gray-600">{stats.inactive}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">With Schema</p>
            <p className="text-2xl font-bold text-blue-600">{stats.withSchema}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Layers className="w-5 h-5" />
                Category Management
              </CardTitle>
              <CardDescription>
                Manage product categories and their dynamic form fields
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchCategories}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={() => { setFormData(initialFormData); setShowCreateDialog(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Add Category
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-12">
              <Layers className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold">No Categories</h3>
              <p className="text-muted-foreground">Create your first category to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Fields</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{category.icon || "📦"}</span>
                        <div>
                          <p className="font-medium">{category.name}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {category.description || "No description"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">{category.slug}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {category.formSchema?.length || 0} fields
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={category.isActive ? "default" : "secondary"}
                        className={category.isActive ? "bg-green-100 text-green-800" : ""}
                      >
                        {category.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {category.showInMenu && <Badge variant="outline" className="text-xs">Menu</Badge>}
                        {category.showInHome && <Badge variant="outline" className="text-xs">Home</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => openEditDialog(category)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Category
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openSchemaDialog(category)}>
                            <Tag className="w-4 h-4 mr-2" />
                            Manage Fields
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setSelectedCategory(category); setShowOptionsDialog(true); }}>
                            <FolderTree className="w-4 h-4 mr-2" />
                            Manage Options
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => { setSelectedCategory(category); setShowDeleteDialog(true); }}
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
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Category</DialogTitle>
            <DialogDescription>Add a new product category to the marketplace</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Category Name *</Label>
              <Input
                placeholder="e.g., Electronics"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                placeholder="Category description..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div>
              <Label>Icon (emoji)</Label>
              <Input
                placeholder="e.g., 📱"
                maxLength={2}
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="create-active"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="create-active">Active</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="create-menu"
                  checked={formData.showInMenu}
                  onCheckedChange={(checked) => setFormData({ ...formData, showInMenu: checked })}
                />
                <Label htmlFor="create-menu">Show in Menu</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="create-home"
                  checked={formData.showInHome}
                  onCheckedChange={(checked) => setFormData({ ...formData, showInHome: checked })}
                />
                <Label htmlFor="create-home">Show on Home</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={actionLoading}>
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>Update category details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Category Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div>
              <Label>Icon (emoji)</Label>
              <Input
                maxLength={2}
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-active"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="edit-active">Active</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-menu"
                  checked={formData.showInMenu}
                  onCheckedChange={(checked) => setFormData({ ...formData, showInMenu: checked })}
                />
                <Label htmlFor="edit-menu">Show in Menu</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-home"
                  checked={formData.showInHome}
                  onCheckedChange={(checked) => setFormData({ ...formData, showInHome: checked })}
                />
                <Label htmlFor="edit-home">Show on Home</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={actionLoading}>
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSchemaDialog} onOpenChange={setShowSchemaDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Category Fields</DialogTitle>
            <DialogDescription>
              Define custom fields for products in &quot;{selectedCategory?.name}&quot;
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="border rounded-lg p-4 space-y-4">
              <h4 className="font-medium">Add New Field</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Field Key *</Label>
                  <Input
                    placeholder="e.g., brand"
                    value={newField.key}
                    onChange={(e) => setNewField({ ...newField, key: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  />
                </div>
                <div>
                  <Label>Label *</Label>
                  <Input
                    placeholder="e.g., Brand Name"
                    value={newField.label}
                    onChange={(e) => setNewField({ ...newField, label: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Field Type</Label>
                  <Select
                    value={newField.type}
                    onValueChange={(v) => setNewField({ ...newField, type: v as CategoryFormField['type'] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="field-required"
                      checked={newField.required}
                      onCheckedChange={(checked) => setNewField({ ...newField, required: checked })}
                    />
                    <Label htmlFor="field-required">Required</Label>
                  </div>
                </div>
              </div>
              {newField.type === 'dependent_select' && (
                <div className="space-y-3 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    Cascading dropdowns get their options from the Manage Options dialog. 
                    Configure which field this depends on below.
                  </p>
                  <div>
                    <Label>Depends On (Parent Field)</Label>
                    <Select
                      value={newField.dependsOn || ""}
                      onValueChange={(v) => {
                        const parentField = formData.formSchema.find(f => f.key === v);
                        const parentLevel = parentField?.level || 1;
                        setNewField({ 
                          ...newField, 
                          dependsOn: v || undefined,
                          level: parentLevel + 1,
                          optionsSource: 'attribute_options'
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select parent field (or none for root)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None (Root level)</SelectItem>
                        {formData.formSchema
                          .filter(f => f.type === 'select' || f.type === 'dependent_select')
                          .map((f) => (
                            <SelectItem key={f.key} value={f.key}>
                              {f.label} (Level {f.level || 1})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      This field will be Level {newField.level || 1}. Max 3 levels allowed.
                    </p>
                  </div>
                </div>
              )}
              {(newField.type === 'select' || newField.type === 'multi_select') && (
                <div>
                  <Label>Options</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add option"
                      value={newFieldOption}
                      onChange={(e) => setNewFieldOption(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newFieldOption.trim()) {
                          setNewField({ ...newField, options: [...(newField.options || []), newFieldOption.trim()] });
                          setNewFieldOption("");
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (newFieldOption.trim()) {
                          setNewField({ ...newField, options: [...(newField.options || []), newFieldOption.trim()] });
                          setNewFieldOption("");
                        }
                      }}
                    >
                      Add
                    </Button>
                  </div>
                  {newField.options && newField.options.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {newField.options.map((opt, i) => (
                        <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => {
                          setNewField({ ...newField, options: newField.options?.filter((_, idx) => idx !== i) });
                        }}>
                          {opt} ×
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <Button onClick={addFieldToSchema} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Field
              </Button>
            </div>

            <div>
              <h4 className="font-medium mb-2">Current Fields ({formData.formSchema.length})</h4>
              {formData.formSchema.length === 0 ? (
                <p className="text-muted-foreground text-sm">No fields defined yet</p>
              ) : (
                <div className="space-y-2">
                  {formData.formSchema.map((field) => (
                    <div key={field.key} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{field.label}</p>
                        <p className="text-xs text-muted-foreground">
                          Key: {field.key} | Type: {field.type === 'dependent_select' ? 'Cascading' : field.type} {field.required && "| Required"}
                          {field.level && field.type === 'dependent_select' && ` | Level ${field.level}`}
                        </p>
                        {field.dependsOn && (
                          <p className="text-xs text-blue-600">
                            Depends on: {formData.formSchema.find(f => f.key === field.dependsOn)?.label || field.dependsOn}
                          </p>
                        )}
                        {field.options && field.options.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Options: {field.options.join(", ")}
                          </p>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeFieldFromSchema(field.key)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSchemaDialog(false)}>Cancel</Button>
            <Button onClick={saveSchema} disabled={actionLoading}>
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Schema
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedCategory?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedCategory && (
        <AttributeOptionsManager
          category={selectedCategory}
          open={showOptionsDialog}
          onOpenChange={setShowOptionsDialog}
          onSchemaUpdate={fetchCategories}
        />
      )}
    </div>
  );
}
