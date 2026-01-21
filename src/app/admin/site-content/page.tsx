"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Save, Plus, Edit, Trash2, Eye, FileText, Palette, Home, CheckCircle, XCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/auth-store";

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
}

export default function SiteContentPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [settings, setSettings] = useState<Record<string, string>>({});
  const [pages, setPages] = useState<StaticPage[]>([]);
  const [editingPage, setEditingPage] = useState<StaticPage | null>(null);
  const [isPageDialogOpen, setIsPageDialogOpen] = useState(false);
  const [pageForm, setPageForm] = useState({
    slug: "",
    title: "",
    content: "",
    metaTitle: "",
    metaDescription: "",
    isPublished: false,
    showInFooter: false,
    showInHeader: false
  });

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

  const fetchData = useCallback(async () => {
    try {
      const [settingsRes, pagesRes] = await Promise.all([
        fetch('/api/admin/site-settings', { credentials: 'include' }),
        fetch('/api/admin/static-pages', { credentials: 'include' })
      ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings(data.settings || {});
      }

      if (pagesRes.ok) {
        const data = await pagesRes.json();
        setPages(data.pages || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load site settings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isHydrated && isAuthenticated) {
      fetchData();
    }
  }, [isHydrated, isAuthenticated, fetchData]);

  const handleSettingChange = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/site-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ settings })
      });

      if (!response.ok) throw new Error('Failed to save settings');
      
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const openPageDialog = (page?: StaticPage) => {
    if (page) {
      setEditingPage(page);
      setPageForm({
        slug: page.slug,
        title: page.title,
        content: page.content,
        metaTitle: page.meta_title || "",
        metaDescription: page.meta_description || "",
        isPublished: page.is_published,
        showInFooter: page.show_in_footer,
        showInHeader: page.show_in_header
      });
    } else {
      setEditingPage(null);
      setPageForm({
        slug: "",
        title: "",
        content: "",
        metaTitle: "",
        metaDescription: "",
        isPublished: false,
        showInFooter: false,
        showInHeader: false
      });
    }
    setIsPageDialogOpen(true);
  };

  const savePage = async () => {
    if (!pageForm.slug || !pageForm.title || !pageForm.content) {
      toast.error('Slug, title, and content are required');
      return;
    }

    setIsSaving(true);
    try {
      const url = editingPage 
        ? `/api/admin/static-pages/${editingPage.id}`
        : '/api/admin/static-pages';
      
      const response = await fetch(url, {
        method: editingPage ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(pageForm)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save page');
      }

      toast.success(editingPage ? 'Page updated successfully' : 'Page created successfully');
      setIsPageDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Failed to save page:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save page');
    } finally {
      setIsSaving(false);
    }
  };

  const deletePage = async (id: string) => {
    if (!confirm('Are you sure you want to delete this page?')) return;

    try {
      const response = await fetch(`/api/admin/static-pages/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to delete page');
      
      toast.success('Page deleted successfully');
      fetchData();
    } catch (error) {
      console.error('Failed to delete page:', error);
      toast.error('Failed to delete page');
    }
  };

  const togglePublish = async (page: StaticPage) => {
    try {
      const response = await fetch(`/api/admin/static-pages/${page.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isPublished: !page.is_published })
      });

      if (!response.ok) throw new Error('Failed to update page');
      
      toast.success(page.is_published ? 'Page unpublished' : 'Page published');
      fetchData();
    } catch (error) {
      console.error('Failed to toggle publish:', error);
      toast.error('Failed to update page');
    }
  };

  if (!isHydrated || isLoading) {
    return (
      <SiteLayout>
        <div className="container py-12 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className="container py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Site Content Management</h1>
          <p className="text-muted-foreground">Manage branding, homepage content, and static pages</p>
        </div>

        <Tabs defaultValue="branding" className="space-y-6">
          <TabsList>
            <TabsTrigger value="branding" className="flex items-center gap-2">
              <Palette className="w-4 h-4" />Branding
            </TabsTrigger>
            <TabsTrigger value="homepage" className="flex items-center gap-2">
              <Home className="w-4 h-4" />Homepage
            </TabsTrigger>
            <TabsTrigger value="pages" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />Static Pages
            </TabsTrigger>
          </TabsList>

          <TabsContent value="branding">
            <Card>
              <CardHeader>
                <CardTitle>Site Branding</CardTitle>
                <CardDescription>Configure your marketplace identity</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Site Name</Label>
                    <Input 
                      value={settings.site_name || ""} 
                      onChange={(e) => handleSettingChange('site_name', e.target.value)}
                      placeholder="MarketHub"
                    />
                  </div>
                  <div>
                    <Label>Tagline</Label>
                    <Input 
                      value={settings.tagline || ""} 
                      onChange={(e) => handleSettingChange('tagline', e.target.value)}
                      placeholder="Ghana's Trusted Marketplace"
                    />
                  </div>
                </div>
                <div>
                  <Label>Contact Email</Label>
                  <Input 
                    type="email"
                    value={settings.contact_email || ""} 
                    onChange={(e) => handleSettingChange('contact_email', e.target.value)}
                    placeholder="support@example.com"
                  />
                </div>
                <div>
                  <Label>Contact Phone</Label>
                  <Input 
                    value={settings.contact_phone || ""} 
                    onChange={(e) => handleSettingChange('contact_phone', e.target.value)}
                    placeholder="+233 XX XXX XXXX"
                  />
                </div>
                <div>
                  <Label>Footer Text</Label>
                  <Textarea 
                    value={settings.footer_text || ""} 
                    onChange={(e) => handleSettingChange('footer_text', e.target.value)}
                    placeholder="Your trusted marketplace for quality products..."
                  />
                </div>
                <div>
                  <Label>Copyright Text</Label>
                  <Input 
                    value={settings.copyright_text || ""} 
                    onChange={(e) => handleSettingChange('copyright_text', e.target.value)}
                    placeholder="2024 MarketHub. All rights reserved."
                  />
                </div>
                <Button onClick={saveSettings} disabled={isSaving}>
                  {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Branding
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="homepage">
            <Card>
              <CardHeader>
                <CardTitle>Homepage Content</CardTitle>
                <CardDescription>Customize the hero section and promotional content</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Hero Headline</Label>
                  <Input 
                    value={settings.hero_headline || ""} 
                    onChange={(e) => handleSettingChange('hero_headline', e.target.value)}
                    placeholder="Shop with Confidence"
                  />
                </div>
                <div>
                  <Label>Hero Sub-headline</Label>
                  <Textarea 
                    value={settings.hero_subheadline || ""} 
                    onChange={(e) => handleSettingChange('hero_subheadline', e.target.value)}
                    placeholder="Ghana's most secure marketplace..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Primary CTA Text</Label>
                    <Input 
                      value={settings.hero_cta_text || ""} 
                      onChange={(e) => handleSettingChange('hero_cta_text', e.target.value)}
                      placeholder="Start Shopping"
                    />
                  </div>
                  <div>
                    <Label>Primary CTA Link</Label>
                    <Input 
                      value={settings.hero_cta_link || ""} 
                      onChange={(e) => handleSettingChange('hero_cta_link', e.target.value)}
                      placeholder="/search"
                    />
                  </div>
                </div>
                <div className="border-t pt-4 mt-4">
                  <Label className="text-lg font-semibold mb-2 block">Promotional Banner</Label>
                  <div className="flex items-center gap-4 mb-4">
                    <Switch 
                      checked={settings.promo_banner_enabled === 'true'} 
                      onCheckedChange={(checked) => handleSettingChange('promo_banner_enabled', String(checked))}
                    />
                    <span className="text-sm text-muted-foreground">Enable promotional banner</span>
                  </div>
                  <div>
                    <Label>Banner Text</Label>
                    <Input 
                      value={settings.promo_banner_text || ""} 
                      onChange={(e) => handleSettingChange('promo_banner_text', e.target.value)}
                      placeholder="Free shipping on orders over GHS 100!"
                    />
                  </div>
                </div>
                <Button onClick={saveSettings} disabled={isSaving}>
                  {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Homepage Content
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pages">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Static Pages</CardTitle>
                    <CardDescription>Manage About, Terms, Privacy, and other pages</CardDescription>
                  </div>
                  <Dialog open={isPageDialogOpen} onOpenChange={setIsPageDialogOpen}>
                    <DialogTrigger asChild>
                      <Button onClick={() => openPageDialog()}>
                        <Plus className="w-4 h-4 mr-2" />Add Page
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>{editingPage ? 'Edit Page' : 'Create Page'}</DialogTitle>
                        <DialogDescription>
                          {editingPage ? 'Update the page details below' : 'Fill in the page details below'}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Slug</Label>
                            <Input 
                              value={pageForm.slug}
                              onChange={(e) => setPageForm(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))}
                              placeholder="about-us"
                            />
                            <p className="text-xs text-muted-foreground mt-1">URL: /pages/{pageForm.slug || 'slug'}</p>
                          </div>
                          <div>
                            <Label>Title</Label>
                            <Input 
                              value={pageForm.title}
                              onChange={(e) => setPageForm(prev => ({ ...prev, title: e.target.value }))}
                              placeholder="About Us"
                            />
                          </div>
                        </div>
                        <div>
                          <Label>Content (HTML)</Label>
                          <Textarea 
                            value={pageForm.content}
                            onChange={(e) => setPageForm(prev => ({ ...prev, content: e.target.value }))}
                            placeholder="<p>Your page content here...</p>"
                            rows={10}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Meta Title (SEO)</Label>
                            <Input 
                              value={pageForm.metaTitle}
                              onChange={(e) => setPageForm(prev => ({ ...prev, metaTitle: e.target.value }))}
                              placeholder="About Us | MarketHub"
                            />
                          </div>
                          <div>
                            <Label>Meta Description (SEO)</Label>
                            <Input 
                              value={pageForm.metaDescription}
                              onChange={(e) => setPageForm(prev => ({ ...prev, metaDescription: e.target.value }))}
                              placeholder="Learn about our marketplace..."
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-2">
                            <Switch 
                              checked={pageForm.isPublished}
                              onCheckedChange={(checked) => setPageForm(prev => ({ ...prev, isPublished: checked }))}
                            />
                            <Label>Published</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch 
                              checked={pageForm.showInFooter}
                              onCheckedChange={(checked) => setPageForm(prev => ({ ...prev, showInFooter: checked }))}
                            />
                            <Label>Show in Footer</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch 
                              checked={pageForm.showInHeader}
                              onCheckedChange={(checked) => setPageForm(prev => ({ ...prev, showInHeader: checked }))}
                            />
                            <Label>Show in Header</Label>
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsPageDialogOpen(false)}>Cancel</Button>
                        <Button onClick={savePage} disabled={isSaving}>
                          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                          {editingPage ? 'Update Page' : 'Create Page'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {pages.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No static pages yet. Create your first page to get started.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Page</TableHead>
                        <TableHead>Slug</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Footer</TableHead>
                        <TableHead>Actions</TableHead>
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
                            <Badge 
                              variant={page.is_published ? "default" : "secondary"} 
                              className={page.is_published ? "bg-green-100 text-green-800" : ""}
                            >
                              {page.is_published ? "Published" : "Draft"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {page.show_in_footer ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-gray-300" />
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openPageDialog(page)}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              {page.is_published && (
                                <Button variant="ghost" size="sm" asChild>
                                  <a href={`/pages/${page.slug}`} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
                                </Button>
                              )}
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => togglePublish(page)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-red-600 hover:text-red-700"
                                onClick={() => deletePage(page.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
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
