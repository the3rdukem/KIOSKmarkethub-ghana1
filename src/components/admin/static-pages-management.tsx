"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { FileText, Plus, Edit, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface StaticPage {
  id: string;
  slug: string;
  title: string;
  content: string;
  meta_title: string | null;
  meta_description: string | null;
  is_published: boolean;
  show_in_footer: boolean;
  show_in_header: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

interface PageFormData {
  slug: string;
  title: string;
  content: string;
  metaTitle: string;
  metaDescription: string;
  isPublished: boolean;
  showInFooter: boolean;
  showInHeader: boolean;
}

const defaultFormData: PageFormData = {
  slug: "",
  title: "",
  content: "",
  metaTitle: "",
  metaDescription: "",
  isPublished: false,
  showInFooter: false,
  showInHeader: false,
};

export function StaticPagesManagement() {
  const [pages, setPages] = useState<StaticPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editingPage, setEditingPage] = useState<StaticPage | null>(null);
  const [formData, setFormData] = useState<PageFormData>(defaultFormData);
  const [pageToDelete, setPageToDelete] = useState<StaticPage | null>(null);

  const fetchPages = async () => {
    try {
      const response = await fetch('/api/admin/static-pages', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (response.ok) {
        const data = await response.json();
        setPages(data.pages || []);
      }
    } catch (error) {
      console.error('Failed to fetch static pages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPages();
  }, []);

  const handleCreateNew = () => {
    setEditingPage(null);
    setFormData(defaultFormData);
    setShowEditor(true);
  };

  const handleEdit = (page: StaticPage) => {
    setEditingPage(page);
    setFormData({
      slug: page.slug,
      title: page.title,
      content: page.content,
      metaTitle: page.meta_title || "",
      metaDescription: page.meta_description || "",
      isPublished: page.is_published,
      showInFooter: page.show_in_footer,
      showInHeader: page.show_in_header,
    });
    setShowEditor(true);
  };

  const handleSave = async () => {
    if (!formData.slug || !formData.title || !formData.content) {
      toast.error("Please fill in the required fields (slug, title, content)");
      return;
    }

    setIsSaving(true);
    try {
      const url = editingPage 
        ? `/api/admin/static-pages/${editingPage.id}`
        : '/api/admin/static-pages';
      
      const response = await fetch(url, {
        method: editingPage ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success(editingPage ? "Page updated successfully" : "Page created successfully");
        setShowEditor(false);
        fetchPages();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to save page");
      }
    } catch (error) {
      console.error('Failed to save page:', error);
      toast.error("Failed to save page");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!pageToDelete) return;

    try {
      const response = await fetch(`/api/admin/static-pages/${pageToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        toast.success("Page deleted successfully");
        setPageToDelete(null);
        fetchPages();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to delete page");
      }
    } catch (error) {
      console.error('Failed to delete page:', error);
      toast.error("Failed to delete page");
    }
  };

  const handleTogglePublished = async (page: StaticPage) => {
    try {
      const response = await fetch(`/api/admin/static-pages/${page.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: !page.is_published }),
      });

      if (response.ok) {
        toast.success(page.is_published ? "Page unpublished" : "Page published");
        fetchPages();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to update publish status");
      }
    } catch (error) {
      console.error('Failed to toggle publish status:', error);
      toast.error("Failed to update publish status");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
          <p className="text-muted-foreground mt-2">Loading pages...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Static Pages
              </CardTitle>
              <CardDescription>Create and edit content pages (About, Privacy, Terms, etc.)</CardDescription>
            </div>
            <Button onClick={handleCreateNew}>
              <Plus className="w-4 h-4 mr-2" />
              New Page
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {pages.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-muted-foreground">No static pages yet</p>
              <Button variant="outline" className="mt-4" onClick={handleCreateNew}>
                Create your first page
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>Footer</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pages.map((page) => (
                  <TableRow key={page.id}>
                    <TableCell className="font-medium">{page.title}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">/pages/{page.slug}</code>
                    </TableCell>
                    <TableCell>
                      <Switch 
                        checked={page.is_published} 
                        onCheckedChange={() => handleTogglePublished(page)}
                      />
                    </TableCell>
                    <TableCell>
                      <Switch 
                        checked={page.show_in_footer} 
                        onCheckedChange={async () => {
                          try {
                            const response = await fetch(`/api/admin/static-pages/${page.id}`, {
                              method: 'PUT',
                              credentials: 'include',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ showInFooter: !page.show_in_footer }),
                            });
                            if (response.ok) {
                              toast.success(page.show_in_footer ? "Removed from footer" : "Added to footer");
                              fetchPages();
                            } else {
                              const data = await response.json();
                              toast.error(data.error || "Failed to update footer visibility");
                            }
                          } catch (e) { 
                            console.error(e);
                            toast.error("Failed to update footer visibility");
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(page.updated_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="sm" onClick={() => window.open(`/pages/${page.slug}`, '_blank')}>
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(page)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => setPageToDelete(page)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPage ? "Edit Page" : "Create New Page"}</DialogTitle>
            <DialogDescription>
              {editingPage ? "Update the page content and settings" : "Create a new static page for your site"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Page Title <span className="text-red-500">*</span></Label>
                <Input 
                  value={formData.title} 
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="About Us"
                />
              </div>
              <div>
                <Label>URL Slug <span className="text-red-500">*</span></Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm">/pages/</span>
                  <Input 
                    value={formData.slug} 
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                    placeholder="about-us"
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Only lowercase letters, numbers, and hyphens</p>
              </div>
            </div>

            <div>
              <Label>Page Content <span className="text-red-500">*</span></Label>
              <p className="text-xs text-muted-foreground mb-2">You can use HTML tags for formatting (e.g., &lt;h2&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;a&gt;)</p>
              <Textarea 
                value={formData.content} 
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="<h2>About Our Company</h2><p>Your content here...</p>"
                className="min-h-[300px] font-mono text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Meta Title (SEO)</Label>
                <Input 
                  value={formData.metaTitle} 
                  onChange={(e) => setFormData({ ...formData, metaTitle: e.target.value })}
                  placeholder="About Us - MarketHub"
                />
              </div>
              <div>
                <Label>Meta Description (SEO)</Label>
                <Input 
                  value={formData.metaDescription} 
                  onChange={(e) => setFormData({ ...formData, metaDescription: e.target.value })}
                  placeholder="Learn about our company and mission..."
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-6 pt-4 border-t">
              <div className="flex items-center gap-2">
                <Switch 
                  checked={formData.isPublished} 
                  onCheckedChange={(checked) => setFormData({ ...formData, isPublished: checked })}
                />
                <Label>Published</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch 
                  checked={formData.showInFooter} 
                  onCheckedChange={(checked) => setFormData({ ...formData, showInFooter: checked })}
                />
                <Label>Show in Footer</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch 
                  checked={formData.showInHeader} 
                  onCheckedChange={(checked) => setFormData({ ...formData, showInHeader: checked })}
                />
                <Label>Show in Header</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditor(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingPage ? "Save Changes" : "Create Page"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pageToDelete} onOpenChange={() => setPageToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Page</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{pageToDelete?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
