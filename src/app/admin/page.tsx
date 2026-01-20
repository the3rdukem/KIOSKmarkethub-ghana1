"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Users, Store, Package, DollarSign, Eye, CheckCircle, XCircle, AlertTriangle,
  FileText, Search, Download, MoreHorizontal, MapPin, Flag, Ban,
  Settings, Key, Globe, CreditCard, Map, Brain, Cloud, Phone, Camera, Share2,
  TestTube, History, ShoppingCart, Loader2, Lock, AlertCircle, MessageSquare
} from "lucide-react";
import { formatDistance, format } from "date-fns";
import { toast } from "sonner";
import { useAuthStore, hasAdminPermission } from "@/lib/auth-store";
import { useUsersStore, PlatformUser, Dispute, APIConfiguration } from "@/lib/users-store";
import { useProductsStore, Product } from "@/lib/products-store";
import { useOrdersStore } from "@/lib/orders-store";
import { APIManagement } from "@/components/admin/api-management";
import { UserManagement } from "@/components/admin/user-management";
import { ProductManagement } from "@/components/admin/product-management";
import { VendorManagement } from "@/components/admin/vendor-management";
import {
  useSystemConfigStore,
  MasterAdminUser,
  AdminRole,
  checkAdminPermission,
} from "@/lib/system-config-store";
import { useCategoriesStore, ProductCategory, CategoryAttribute } from "@/lib/categories-store";
import { CategoryManagement } from "@/components/admin/category-management";
import { ReviewModeration } from "@/components/admin/review-moderation";
import { useSiteSettingsStore } from "@/lib/site-settings-store";
import { useApprovalWorkflowsStore, ApprovalRequest } from "@/lib/approval-workflows-store";
import {
  Layers, FileEdit, CheckSquare, Trash2, RotateCcw, Palette, Globe2,
  Layout, Tag, Plus, Edit, GripVertical, Image as ImageIcon
} from "lucide-react";
import { AdminAuthGuard } from "@/components/auth/auth-guard";
import { EmailTemplateEditor } from "@/components/admin/email-template-editor";

interface DbAdmin {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  permissions: string[];
  createdBy: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

function AdminManagementSection({
  currentAdmin,
}: {
  currentAdmin: { id: string; name: string; adminRole?: string };
}) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newAdminData, setNewAdminData] = useState({ email: "", name: "", password: "", role: "ADMIN" as AdminRole });
  const [revokeReason, setRevokeReason] = useState("");
  const [selectedAdminToRevoke, setSelectedAdminToRevoke] = useState<DbAdmin | null>(null);
  const [selectedAdminToDelete, setSelectedAdminToDelete] = useState<DbAdmin | null>(null);
  const [admins, setAdmins] = useState<DbAdmin[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAdmins = async () => {
    try {
      const response = await fetch('/api/admin/admins', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setAdmins(data.admins || []);
      }
    } catch (error) {
      console.error('Failed to fetch admins:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleCreateAdmin = async () => {
    if (!newAdminData.email || !newAdminData.name || !newAdminData.password) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      const response = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: newAdminData.email,
          name: newAdminData.name,
          password: newAdminData.password,
          role: newAdminData.role,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(`Admin account created for ${newAdminData.email}`);
        setShowCreateDialog(false);
        setNewAdminData({ email: "", name: "", password: "", role: "ADMIN" });
        fetchAdmins();
      } else {
        toast.error(data.error || "Failed to create admin");
      }
    } catch (error) {
      console.error('Failed to create admin:', error);
      toast.error("Failed to create admin");
    }
  };

  const handleRevokeAccess = async () => {
    if (!selectedAdminToRevoke || !revokeReason) {
      toast.error("Please provide a reason");
      return;
    }

    try {
      const response = await fetch(`/api/admin/admins/${selectedAdminToRevoke.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'revoke', reason: revokeReason }),
      });

      if (response.ok) {
        toast.success(`Access revoked for ${selectedAdminToRevoke.name}`);
        setSelectedAdminToRevoke(null);
        setRevokeReason("");
        fetchAdmins();
      } else {
        toast.error("Cannot revoke access for this admin");
      }
    } catch (error) {
      console.error('Failed to revoke access:', error);
      toast.error("Cannot revoke access for this admin");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Administrator Management
              </CardTitle>
              <CardDescription>
                Manage system administrators and their access levels
              </CardDescription>
            </div>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Users className="w-4 h-4 mr-2" />
                  Create Admin
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Administrator</DialogTitle>
                  <DialogDescription>
                    Add a new administrator to the platform
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Full Name</Label>
                    <Input
                      value={newAdminData.name}
                      onChange={(e) => setNewAdminData({ ...newAdminData, name: e.target.value })}
                      placeholder="John Admin"
                    />
                  </div>
                  <div>
                    <Label>Email Address</Label>
                    <Input
                      type="email"
                      value={newAdminData.email}
                      onChange={(e) => setNewAdminData({ ...newAdminData, email: e.target.value })}
                      placeholder="admin@markethub.gh"
                    />
                  </div>
                  <div>
                    <Label>Password</Label>
                    <Input
                      type="password"
                      value={newAdminData.password}
                      onChange={(e) => setNewAdminData({ ...newAdminData, password: e.target.value })}
                      placeholder="Minimum 8 characters"
                    />
                  </div>
                  <div>
                    <Label>Role</Label>
                    <Select
                      value={newAdminData.role}
                      onValueChange={(v) => setNewAdminData({ ...newAdminData, role: v as AdminRole })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADMIN">Admin (Limited Access)</SelectItem>
                        <SelectItem value="MASTER_ADMIN">Master Admin (Full Access)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
                  <Button onClick={handleCreateAdmin}>Create Admin</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="w-[80px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell className="font-medium">{admin.name}</TableCell>
                  <TableCell>{admin.email}</TableCell>
                  <TableCell>
                    <Badge variant={admin.role === "MASTER_ADMIN" ? "default" : "secondary"}>
                      {admin.role === "MASTER_ADMIN" ? "Master Admin" : "Admin"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={admin.isActive ? "default" : "destructive"} className={admin.isActive ? "bg-green-100 text-green-800" : ""}>
                      {admin.isActive ? "Active" : "Disabled"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistance(new Date(admin.createdAt), new Date(), { addSuffix: true })}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {admin.lastLoginAt ? formatDistance(new Date(admin.lastLoginAt), new Date(), { addSuffix: true }) : "Never"}
                  </TableCell>
                  <TableCell className="w-[80px]">
                    <div className="flex justify-end">
                      {admin.id !== currentAdmin.id && admin.id !== "master_admin_001" ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 min-w-[2rem] flex-shrink-0">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {admin.isActive ? (
                              <DropdownMenuItem 
                                className="text-red-600"
                                onClick={() => setSelectedAdminToRevoke(admin)}
                              >
                                <Ban className="w-4 h-4 mr-2" />
                                Revoke Access
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem 
                                className="text-green-600"
                                onClick={async () => {
                                  try {
                                    const response = await fetch(`/api/admin/admins/${admin.id}`, {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      credentials: 'include',
                                      body: JSON.stringify({ action: 'activate' }),
                                    });
                                    if (response.ok) {
                                      toast.success(`Activated ${admin.name}`);
                                      fetchAdmins();
                                    } else {
                                      toast.error("Failed to activate admin");
                                    }
                                  } catch (error) {
                                    toast.error("Failed to activate admin");
                                  }
                                }}
                              >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Activate
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-red-600"
                              onClick={() => setSelectedAdminToDelete(admin)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete Admin
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : admin.id === "master_admin_001" ? (
                        <Badge variant="outline" className="text-xs">Protected</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">You</Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {/* Revoke Access Dialog */}
          <AlertDialog open={!!selectedAdminToRevoke} onOpenChange={(open) => { if (!open) { setSelectedAdminToRevoke(null); setRevokeReason(""); } }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Revoke Admin Access</AlertDialogTitle>
                <AlertDialogDescription>
                  This will disable {selectedAdminToRevoke?.name}'s administrator access. They will no longer be able to log in to the admin panel.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div>
                <Label>Reason for revocation</Label>
                <Textarea
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder="Enter reason..."
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => { setSelectedAdminToRevoke(null); setRevokeReason(""); }}>Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-red-600" onClick={handleRevokeAccess}>Revoke Access</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Delete Admin Dialog */}
          <AlertDialog open={!!selectedAdminToDelete} onOpenChange={(open) => { if (!open) { setSelectedAdminToDelete(null); } }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-red-600">Permanently Delete Admin</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete {selectedAdminToDelete?.name}'s administrator account. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">
                  <strong>Warning:</strong> This will completely remove the admin account from the system. If you want to temporarily disable access, use "Revoke Access" instead.
                </p>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => { setSelectedAdminToDelete(null); }}>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  className="bg-red-600 hover:bg-red-700" 
                  onClick={async () => {
                    if (!selectedAdminToDelete) return;
                    try {
                      const response = await fetch(`/api/admin/admins/${selectedAdminToDelete.id}`, {
                        method: 'DELETE',
                        credentials: 'include',
                      });
                      if (response.ok) {
                        toast.success(`Deleted admin account: ${selectedAdminToDelete.name}`);
                        setSelectedAdminToDelete(null);
                        fetchAdmins();
                      } else {
                        const data = await response.json();
                        toast.error(data.error || "Failed to delete admin");
                      }
                    } catch (error) {
                      console.error('Failed to delete admin:', error);
                      toast.error("Failed to delete admin");
                    }
                  }}
                >
                  Delete Permanently
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* Role Permissions Legend */}
      <Card>
        <CardHeader>
          <CardTitle>Role Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Badge>Master Admin</Badge>
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Full API key management</li>
                <li>• Create/manage administrators</li>
                <li>• System settings control</li>
                <li>• Security configuration</li>
                <li>• All standard admin permissions</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Badge variant="secondary">Admin</Badge>
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Vendor verification</li>
                <li>• User management</li>
                <li>• Order oversight</li>
                <li>• Dispute resolution</li>
                <li>• View analytics</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Email Management Section
function EmailManagementSection() {
  const [emailConfig, setEmailConfig] = useState<{
    provider: string;
    enabled: boolean;
    dryRun: boolean;
    fromEmail?: string;
    fromName?: string;
  } | null>(null);
  const [templates, setTemplates] = useState<Array<{
    id: string;
    name: string;
    subject: string;
    bodyHtml: string;
    bodyText?: string;
    category: "order" | "payment" | "auth" | "notification" | "system";
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [configForm, setConfigForm] = useState({
    provider: 'none',
    fromEmail: '',
    fromName: '',
    apiKey: '',
    dryRun: true,
  });
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<typeof templates[0] | null>(null);

  useEffect(() => {
    fetchEmailConfig();
    fetchEmailTemplates();
  }, []);

  const fetchEmailConfig = async () => {
    try {
      const response = await fetch('/api/admin/email/config', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setEmailConfig(data.config);
        if (data.config) {
          setConfigForm({
            provider: data.config.provider || 'none',
            fromEmail: data.config.fromEmail || '',
            fromName: data.config.fromName || '',
            apiKey: '',
            dryRun: data.config.dryRun ?? true,
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch email config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEmailTemplates = async () => {
    try {
      const response = await fetch('/api/admin/email/templates', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Failed to fetch email templates:', error);
    }
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/email/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(configForm),
      });
      if (response.ok) {
        toast.success('Email configuration saved');
        fetchEmailConfig();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to save configuration');
      }
    } catch (error) {
      toast.error('Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestEmail = async () => {
    try {
      const response = await fetch('/api/admin/email/health', { credentials: 'include' });
      const data = await response.json();
      if (data.status === 'healthy') {
        toast.success('Email provider is connected and healthy');
      } else if (data.status === 'dry_run') {
        toast.info('Email is in dry-run mode (no emails will be sent)');
      } else {
        toast.error(data.message || 'Email provider is not configured');
      }
    } catch (error) {
      toast.error('Failed to check email health');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Email Provider Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Globe2 className="w-5 h-5" />
                Email Provider Configuration
              </CardTitle>
              <CardDescription>
                Configure your email service provider for transactional emails
              </CardDescription>
            </div>
            <Button variant="outline" onClick={handleTestEmail}>
              <TestTube className="w-4 h-4 mr-2" />
              Test Connection
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email Provider</Label>
              <Select
                value={configForm.provider}
                onValueChange={(value) => setConfigForm({ ...configForm, provider: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Disabled)</SelectItem>
                  <SelectItem value="sendgrid">SendGrid</SelectItem>
                  <SelectItem value="resend">Resend</SelectItem>
                  <SelectItem value="ses">AWS SES</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>API Key</Label>
              <Input
                type="password"
                placeholder="Enter API key"
                value={configForm.apiKey}
                onChange={(e) => setConfigForm({ ...configForm, apiKey: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Leave blank to keep existing key</p>
            </div>
            <div className="space-y-2">
              <Label>From Email</Label>
              <Input
                type="email"
                placeholder="noreply@yourdomain.com"
                value={configForm.fromEmail}
                onChange={(e) => setConfigForm({ ...configForm, fromEmail: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>From Name</Label>
              <Input
                placeholder="MarketHub"
                value={configForm.fromName}
                onChange={(e) => setConfigForm({ ...configForm, fromName: e.target.value })}
              />
            </div>
          </div>
          <div className="flex items-center space-x-2 pt-2">
            <Switch
              id="dry-run"
              checked={configForm.dryRun}
              onCheckedChange={(checked) => setConfigForm({ ...configForm, dryRun: checked })}
            />
            <Label htmlFor="dry-run" className="cursor-pointer">
              Dry Run Mode (log emails instead of sending)
            </Label>
          </div>
          <div className="flex justify-end pt-4">
            <Button onClick={handleSaveConfig} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Settings className="w-4 h-4 mr-2" />}
              Save Configuration
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Email Templates */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileEdit className="w-5 h-5" />
                Email Templates
              </CardTitle>
              <CardDescription>
                Manage transactional email templates
              </CardDescription>
            </div>
            <Button
              onClick={() => {
                setSelectedTemplate(null);
                setShowTemplateEditor(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <div className="text-center py-12">
              <FileEdit className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Email Templates</h3>
              <p className="text-muted-foreground mb-4">Get started with default templates or create your own</p>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const response = await fetch('/api/admin/email/templates/seed', {
                      method: 'POST',
                      credentials: 'include',
                    });
                    if (response.ok) {
                      const data = await response.json();
                      toast.success(`Created ${data.created.length} default templates`);
                      fetchEmailTemplates();
                    } else {
                      toast.error('Failed to seed templates');
                    }
                  } catch (error) {
                    toast.error('Failed to seed templates');
                  }
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Load Default Templates
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell>{template.subject}</TableCell>
                    <TableCell><Badge variant="outline">{template.category}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(template.createdAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedTemplate(template);
                          setShowTemplateEditor(true);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Template Editor Dialog */}
      <EmailTemplateEditor
        template={selectedTemplate}
        isOpen={showTemplateEditor}
        onClose={() => {
          setShowTemplateEditor(false);
          setSelectedTemplate(null);
        }}
        onSave={() => {
          fetchEmailTemplates();
        }}
      />

      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle>Current Email Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${emailConfig?.enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span>{emailConfig?.enabled ? 'Enabled' : 'Disabled'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={emailConfig?.dryRun ? 'secondary' : 'default'}>
                {emailConfig?.dryRun ? 'Dry Run Mode' : 'Live Mode'}
              </Badge>
            </div>
            {emailConfig?.provider && emailConfig.provider !== 'none' && (
              <Badge variant="outline">{emailConfig.provider.toUpperCase()}</Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AdminDashboardContent() {
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    users, disputes, apiConfigurations, auditLogs,
    getPlatformMetrics, getPendingVendors, getOpenDisputes,
    approveVendor, rejectVendor, suspendUser, activateUser,
    updateDispute, resolveDispute, updateAPIConfiguration,
    toggleAPI, testAPIConnection, addAuditLog,
  } = useUsersStore();
  const { products, getAllProducts, approveProduct, rejectProduct, suspendProduct, unsuspendProduct, featureProduct, unfeatureProduct, adminDeleteProduct, getPendingApprovalProducts, getSuspendedProducts, getFeaturedProducts } = useProductsStore();
  const { orders, getOrderStats } = useOrdersStore();

  // Categories store
  const { categories, addCategory, updateCategory, deleteCategory, reorderCategories, addCategoryAttribute, updateCategoryAttribute, deleteCategoryAttribute, getActiveCategories } = useCategoriesStore();

  // Site settings store
  const { branding, updateBranding, staticPages, addStaticPage, updateStaticPage, deleteStaticPage, publishStaticPage, unpublishStaticPage, homepageSections, toggleHomepageSection, featuredProducts: siteFeaturedProducts, addFeaturedProduct: addSiteFeaturedProduct, removeFeaturedProduct: removeSiteFeaturedProduct } = useSiteSettingsStore();

  // Approval workflows store
  const { workflows, requests: approvalRequests, getPendingRequests, getPendingCount, approveRequest, rejectRequest, updateWorkflow, toggleWorkflow } = useApprovalWorkflowsStore();

  const pendingApprovals = getPendingCount();

  const [selectedTab, setSelectedTab] = useState("overview");
  const [selectedVendor, setSelectedVendor] = useState<PlatformUser | null>(null);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [disputeResolution, setDisputeResolution] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isTestingAPI, setIsTestingAPI] = useState<string | null>(null);
  const [apiFormData, setApiFormData] = useState<Record<string, string>>({});
  const [isHydrated, setIsHydrated] = useState(false);

  const [dbStats, setDbStats] = useState<{
    userStats: {
      totalBuyers: number;
      totalVendors: number;
      verifiedVendors: number;
      pendingVendors: number;
      activeUsers: number;
      suspendedUsers: number;
    };
    totalProducts: number;
    totalOrders: number;
    totalRevenue: number;
  } | null>(null);

  const [dbAuditLogs, setDbAuditLogs] = useState<Array<{
    id: string;
    action: string;
    category: string;
    adminId: string | null;
    adminName: string | null;
    adminEmail: string | null;
    adminRole: string | null;
    targetId: string | null;
    targetType: string | null;
    targetName: string | null;
    details: string | null;
    severity: string;
    timestamp: string;
  }>>([]);

  const [activityCounts, setActivityCounts] = useState<{
    users: number;
    vendors: number;
    products: number;
    orders: number;
    disputes: number;
  }>({ users: 0, vendors: 0, products: 0, orders: 0, disputes: 0 });

  const [dbOrders, setDbOrders] = useState<Array<{
    id: string;
    buyerId: string;
    buyerName: string;
    buyerEmail: string;
    total: number;
    status: string;
    paymentStatus: string;
    createdAt: string;
    orderItems?: Array<{ id: string; productId: string; quantity: number }>;
    items?: Array<{ id: string; productId: string; quantity: number }>;
  }>>([]);

  // Fetch stats and audit logs from PostgreSQL
  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Use cache: 'no-store' to always get fresh data from DB
        const response = await fetch('/api/admin/stats', { 
          credentials: 'include',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        if (response.ok) {
          const data = await response.json();
          setDbStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch admin stats:', error);
      }
    };

    const fetchAuditLogs = async () => {
      try {
        // Use cache: 'no-store' to always get fresh data from DB
        const response = await fetch('/api/admin/audit-logs?limit=100', { 
          credentials: 'include',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        if (response.ok) {
          const data = await response.json();
          setDbAuditLogs(data.logs || []);
        }
      } catch (error) {
        console.error('Failed to fetch audit logs:', error);
      }
    };

    const fetchActivityCounts = async () => {
      try {
        // Use cache: 'no-store' to always get fresh data from DB
        const response = await fetch('/api/admin/activity-summary', { 
          credentials: 'include',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        if (response.ok) {
          const data = await response.json();
          setActivityCounts(data.counts || { users: 0, vendors: 0, products: 0, orders: 0, disputes: 0 });
        }
      } catch (error) {
        console.error('Failed to fetch activity counts:', error);
      }
    };

    const fetchOrders = async () => {
      try {
        const response = await fetch('/api/orders', { 
          credentials: 'include',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        if (response.ok) {
          const data = await response.json();
          setDbOrders(data.orders || []);
        }
      } catch (error) {
        console.error('Failed to fetch orders:', error);
      }
    };

    fetchStats();
    fetchAuditLogs();
    fetchActivityCounts();
    fetchOrders();
  }, []); // Fetch ONCE on mount - activity counts use stable checkpoint set at login

  // Wait for hydration before checking auth
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Initialize system config
  const { initializeSystem, isInitialized, getAllAdmins, createAdmin, revokeAdminAccess, getAdminById } = useSystemConfigStore();

  useEffect(() => {
    if (!isInitialized) {
      initializeSystem();
    }
  }, [isInitialized, initializeSystem]);

  // Auth is now handled by the admin layout
  // This page only renders after admin auth is confirmed

  // Check if current user is master admin
  const isMasterAdmin = user?.role === 'master_admin' || user?.adminRole === 'MASTER_ADMIN';
  const canManageAPIs = isMasterAdmin || hasAdminPermission(user, 'MANAGE_API_KEYS');
  const canManageAdmins = isMasterAdmin;

  // Auth is handled by admin layout - just wait for user data
  if (!isHydrated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-purple-600 mx-auto mb-4 animate-spin" />
          <h2 className="text-xl font-semibold mb-2">Loading...</h2>
        </div>
      </div>
    );
  }

  const platformMetrics = getPlatformMetrics();
  const orderStats = getOrderStats();
  const pendingVendors = getPendingVendors();
  const openDisputes = getOpenDisputes();
  const buyers = users.filter((u) => u.role === "buyer");
  const vendors = users.filter((u) => u.role === "vendor");

  const formatTimestamp = (timestamp: string) => formatDistance(new Date(timestamp), new Date(), { addSuffix: true });
  const getInitials = (name: string) => name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const handleApproveVendor = (vendorId: string) => {
    if (!user) return;
    approveVendor(vendorId, user.id, user.name);
    toast.success("Vendor approved successfully");
    setSelectedVendor(null);
  };

  const handleRejectVendor = (vendorId: string) => {
    if (!user || !rejectionReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    rejectVendor(vendorId, user.id, user.name, rejectionReason);
    toast.success("Vendor application rejected");
    setRejectionReason("");
    setSelectedVendor(null);
  };

  const handleTestAPI = async (apiId: string) => {
    setIsTestingAPI(apiId);
    const success = await testAPIConnection(apiId);
    setIsTestingAPI(null);
    toast[success ? "success" : "error"](success ? "API connection successful" : "API connection failed");
  };

  const handleToggleAPI = (apiId: string) => {
    if (!user) return;
    toggleAPI(apiId, user.id, user.name);
    const config = apiConfigurations.find((c) => c.id === apiId);
    toast.success(`${config?.name} ${config?.isEnabled ? "disabled" : "enabled"}`);
  };

  const handleSaveAPIConfig = (apiId: string) => {
    updateAPIConfiguration(apiId, {
      apiKey: apiFormData.apiKey,
      secretKey: apiFormData.secretKey,
      webhookUrl: apiFormData.webhookUrl,
      isConfigured: !!(apiFormData.apiKey && apiFormData.secretKey),
    });
    if (user) {
      addAuditLog({
        action: "API_CONFIGURED",
        category: "api",
        adminId: user.id,
        adminName: user.name,
        targetId: apiId,
        targetType: "api",
        targetName: apiConfigurations.find((c) => c.id === apiId)?.name || "",
        details: "API configuration updated",
      });
    }
    toast.success("API configuration saved");
    setApiFormData({});
  };

  const getAPIIcon = (category: string) => {
    const icons: Record<string, React.ReactNode> = {
      payment: <CreditCard className="w-5 h-5" />,
      maps: <Map className="w-5 h-5" />,
      auth: <Key className="w-5 h-5" />,
      ai: <Brain className="w-5 h-5" />,
      storage: <Cloud className="w-5 h-5" />,
      sms: <Phone className="w-5 h-5" />,
      verification: <Camera className="w-5 h-5" />,
      social: <Share2 className="w-5 h-5" />,
    };
    return icons[category] || <Globe className="w-5 h-5" />;
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      under_review: "bg-blue-100 text-blue-800",
      verified: "bg-green-100 text-green-800",
      active: "bg-green-100 text-green-800",
      suspended: "bg-red-100 text-red-800",
      rejected: "bg-red-100 text-red-800",
      open: "bg-red-100 text-red-800",
      investigating: "bg-blue-100 text-blue-800",
      resolved: "bg-green-100 text-green-800",
      error: "bg-red-100 text-red-800",
      inactive: "bg-gray-100 text-gray-800",
    };
    return <Badge variant="outline" className={colors[status] || "bg-gray-100"}>{status.replace("_", " ")}</Badge>;
  };

  return (
    <SiteLayout>
      <div className="container py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">Admin Dashboard</h1>
              <Badge
                variant={isMasterAdmin ? "default" : "secondary"}
                className={isMasterAdmin ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white" : ""}
              >
                {isMasterAdmin ? "Master Admin" : "Admin"}
              </Badge>
            </div>
            <p className="text-muted-foreground">Welcome back, {user?.name}</p>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => setSelectedTab("audit")}>
              <History className="w-4 h-4 mr-2" />Audit Logs
            </Button>
            <Button variant="outline"><Download className="w-4 h-4 mr-2" />Export</Button>
          </div>
        </div>

        {/* Metrics - From PostgreSQL Database */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <Card><CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-muted-foreground">Total Buyers</p><p className="text-2xl font-bold">{dbStats?.userStats.totalBuyers ?? 0}</p></div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-muted-foreground">Total Vendors</p><p className="text-2xl font-bold">{dbStats?.userStats.totalVendors ?? 0}</p><p className="text-xs text-green-600">{dbStats?.userStats.verifiedVendors ?? 0} verified</p></div>
              <Store className="w-8 h-8 text-green-600" />
            </div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-muted-foreground">Total Products</p><p className="text-2xl font-bold">{dbStats?.totalProducts ?? 0}</p></div>
              <Package className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-muted-foreground">Total Orders</p><p className="text-2xl font-bold">{dbStats?.totalOrders ?? 0}</p></div>
              <ShoppingCart className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-muted-foreground">Total Sales</p><p className="text-2xl font-bold">GHS {(dbStats?.totalRevenue ?? 0).toLocaleString()}</p></div>
              <DollarSign className="w-8 h-8 text-emerald-600" />
            </div>
          </CardContent></Card>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="mb-6 flex-wrap h-auto gap-1">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="buyers">
              Users
              {activityCounts.users > 0 && <Badge className="ml-1 bg-blue-500 text-white text-xs">+{activityCounts.users}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="vendors">
              Vendors
              {pendingVendors.length > 0 && <Badge className="ml-2" variant="destructive">{pendingVendors.length}</Badge>}
              {activityCounts.vendors > 0 && <Badge className="ml-1 bg-blue-500 text-white text-xs">+{activityCounts.vendors}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="products">
              Products
              <Badge className="ml-2" variant="secondary">{products.length}</Badge>
              {activityCounts.products > 0 && <Badge className="ml-1 bg-blue-500 text-white text-xs">+{activityCounts.products}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="orders">
              Orders
              {(dbStats?.totalOrders ?? 0) > 0 && <Badge className="ml-2" variant="secondary">{dbStats?.totalOrders ?? 0}</Badge>}
              {activityCounts.orders > 0 && <Badge className="ml-1 bg-blue-500 text-white text-xs">+{activityCounts.orders}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="disputes">
              Disputes
              {openDisputes.length > 0 && <Badge className="ml-2" variant="destructive">{openDisputes.length}</Badge>}
              {activityCounts.disputes > 0 && <Badge className="ml-1 bg-blue-500 text-white text-xs">+{activityCounts.disputes}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="reviews">
              <MessageSquare className="w-4 h-4 mr-1" />Reviews
            </TabsTrigger>
            {/* API Management - Only for Master Admin */}
            {canManageAPIs && (
              <TabsTrigger value="api"><Key className="w-4 h-4 mr-1" />API Management</TabsTrigger>
            )}
            {/* Admin Management - Only for Master Admin */}
            {canManageAdmins && (
              <TabsTrigger value="admins"><Users className="w-4 h-4 mr-1" />Admins</TabsTrigger>
            )}
            {/* Categories Management - Master Admin */}
            {isMasterAdmin && (
              <TabsTrigger value="categories"><Layers className="w-4 h-4 mr-1" />Categories</TabsTrigger>
            )}
            {/* Site Settings - Master Admin */}
            {isMasterAdmin && (
              <TabsTrigger value="site-settings"><Palette className="w-4 h-4 mr-1" />Site Settings</TabsTrigger>
            )}
            {/* Email Management - Master Admin */}
            {isMasterAdmin && (
              <TabsTrigger value="email"><Globe2 className="w-4 h-4 mr-1" />Email</TabsTrigger>
            )}
            {/* Approvals */}
            <TabsTrigger value="approvals">
              <CheckSquare className="w-4 h-4 mr-1" />Approvals
              {pendingApprovals > 0 && <Badge className="ml-2" variant="destructive">{pendingApprovals}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="audit"><History className="w-4 h-4 mr-1" />Audit Logs</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full justify-start" variant={pendingVendors.length > 0 ? "default" : "outline"} onClick={() => setSelectedTab("vendors")}>
                    <CheckCircle className="w-4 h-4 mr-2" />Review Vendor Applications ({pendingVendors.length})
                  </Button>
                  <Button className="w-full justify-start" variant={openDisputes.length > 0 ? "destructive" : "outline"} onClick={() => setSelectedTab("disputes")}>
                    <Flag className="w-4 h-4 mr-2" />Handle Disputes ({openDisputes.length})
                  </Button>
                  <Button className="w-full justify-start" variant="outline" asChild>
                    <a href="/admin/orders">
                      <ShoppingCart className="w-4 h-4 mr-2" />Order Management
                    </a>
                  </Button>
                  <Button className="w-full justify-start" variant="outline" onClick={() => setSelectedTab("api")}>
                    <Settings className="w-4 h-4 mr-2" />Configure APIs
                  </Button>
                  {isMasterAdmin && (
                    <>
                      <Button className="w-full justify-start" variant="outline" asChild>
                        <a href="/admin/verifications">
                          <CheckCircle className="w-4 h-4 mr-2" />Vendor Verifications
                        </a>
                      </Button>
                      <Button className="w-full justify-start" variant="outline" asChild>
                        <a href="/admin/branding">
                          <Palette className="w-4 h-4 mr-2" />Manage Branding
                        </a>
                      </Button>
                      <Button className="w-full justify-start" variant="outline" asChild>
                        <a href="/admin/banners">
                          <ImageIcon className="w-4 h-4 mr-2" />Promotional Banners
                        </a>
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    {dbAuditLogs.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No recent activity</p>
                    ) : (
                      <div className="space-y-3">
                        {dbAuditLogs.slice(0, 10).map((log) => (
                          <div key={log.id} className="flex items-start gap-3 text-sm">
                            <div className="w-2 h-2 mt-2 rounded-full bg-blue-500" />
                            <div><p className="font-medium">{log.action.replace(/_/g, " ")}</p><p className="text-muted-foreground text-xs">{log.details || "-"} • {formatTimestamp(log.timestamp)}</p></div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Buyers/Users Tab - Enhanced User Management */}
          <TabsContent value="buyers">
            <UserManagement
              currentAdmin={{ id: user.id, name: user.name, email: user.email }}
              isMasterAdmin={isMasterAdmin}
            />
          </TabsContent>

          {/* Vendors Tab - Uses API */}
          <TabsContent value="vendors">
            <VendorManagement
              currentAdmin={{ id: user.id, name: user.name, email: user.email }}
              isMasterAdmin={isMasterAdmin}
            />
          </TabsContent>

          {/* Products Tab - Enhanced Product Management */}
          <TabsContent value="products">
            <ProductManagement
              currentAdmin={{ id: user.id, name: user.name, email: user.email }}
              isMasterAdmin={isMasterAdmin}
            />
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders">
            <div className="space-y-6">
              {/* Order Stats */}
              <div className="grid grid-cols-6 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Orders</p>
                        <p className="text-2xl font-bold">{dbOrders.length}</p>
                      </div>
                      <ShoppingCart className="w-8 h-8 text-gray-400" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Pending</p>
                        <p className="text-2xl font-bold text-yellow-600">{dbOrders.filter(o => o.status === 'pending').length}</p>
                      </div>
                      <AlertTriangle className="w-8 h-8 text-yellow-400" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Processing</p>
                        <p className="text-2xl font-bold text-blue-600">{dbOrders.filter(o => ['confirmed', 'processing', 'shipped'].includes(o.status)).length}</p>
                      </div>
                      <Package className="w-8 h-8 text-blue-400" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Delivered</p>
                        <p className="text-2xl font-bold text-green-600">{dbOrders.filter(o => o.status === 'delivered').length}</p>
                      </div>
                      <CheckCircle className="w-8 h-8 text-green-400" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Cancelled</p>
                        <p className="text-2xl font-bold text-red-600">{dbOrders.filter(o => o.status === 'cancelled').length}</p>
                      </div>
                      <XCircle className="w-8 h-8 text-red-400" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Revenue</p>
                        <p className="text-2xl font-bold text-emerald-600">GHS {dbOrders.reduce((sum, o) => sum + (o.total || 0), 0).toLocaleString()}</p>
                      </div>
                      <DollarSign className="w-8 h-8 text-emerald-400" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Order Management</CardTitle>
                  <Button variant="outline" size="sm" asChild>
                    <a href="/admin/orders">View All Orders</a>
                  </Button>
                </CardHeader>
                <CardContent>
                  {dbOrders.length === 0 ? (
                    <div className="text-center py-12"><ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" /><h3 className="text-lg font-semibold">No Orders Yet</h3></div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table className="table-fixed w-full">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[120px]">Order ID</TableHead>
                            <TableHead className="w-[150px]">Customer</TableHead>
                            <TableHead className="w-[80px]">Items</TableHead>
                            <TableHead className="w-[100px]">Total</TableHead>
                            <TableHead className="w-[120px]">Status</TableHead>
                            <TableHead className="w-[100px]">Date</TableHead>
                            <TableHead className="w-[80px] text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dbOrders.map((order) => {
                            const orderItems = order.orderItems || order.items || [];
                            const canCancel = order.status !== 'cancelled' && order.status !== 'fulfilled' && order.status !== 'delivered';
                            return (
                              <TableRow key={order.id}>
                                <TableCell className="font-mono text-sm">#{order.id.slice(-8).toUpperCase()}</TableCell>
                                <TableCell>
                                  <div>
                                    <p className="font-medium truncate">{order.buyerName}</p>
                                    <p className="text-xs text-muted-foreground truncate">{order.buyerEmail}</p>
                                  </div>
                                </TableCell>
                                <TableCell>{orderItems.length} item(s)</TableCell>
                                <TableCell>GHS {order.total.toLocaleString()}</TableCell>
                                <TableCell>{getStatusBadge(order.status)}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{formatTimestamp(order.createdAt)}</TableCell>
                                <TableCell className="w-[80px]">
                                  <div className="flex justify-end">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                          <MoreHorizontal className="h-4 w-4" />
                                          <span className="sr-only">Open menu</span>
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem asChild>
                                          <a href={`/admin/orders?view=${order.id}`}>
                                            <Eye className="w-4 h-4 mr-2" />
                                            View Details
                                          </a>
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        {canCancel && (
                                          <DropdownMenuItem 
                                            className="text-red-600"
                                            onSelect={(e) => {
                                              e.preventDefault();
                                              if (confirm(`Cancel order #${order.id.slice(-8).toUpperCase()}? This will restore inventory.`)) {
                                                fetch(`/api/orders/${order.id}`, {
                                                  method: 'DELETE',
                                                  headers: { 'Content-Type': 'application/json' },
                                                  credentials: 'include',
                                                  body: JSON.stringify({ reason: 'Cancelled by admin' }),
                                                }).then(res => {
                                                  if (res.ok) {
                                                    toast.success('Order cancelled');
                                                    window.location.reload();
                                                  } else {
                                                    toast.error('Failed to cancel order');
                                                  }
                                                });
                                              }
                                            }}
                                          >
                                            <XCircle className="w-4 h-4 mr-2" />
                                            Cancel Order
                                          </DropdownMenuItem>
                                        )}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Disputes Tab */}
          <TabsContent value="disputes">
            <Card>
              <CardHeader><CardTitle>Dispute Resolution</CardTitle></CardHeader>
              <CardContent>
                {disputes.length === 0 ? (
                  <div className="text-center py-12"><Flag className="w-16 h-16 text-gray-300 mx-auto mb-4" /><h3 className="text-lg font-semibold">No Disputes</h3></div>
                ) : (
                  <Table>
                    <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Parties</TableHead><TableHead>Type</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {disputes.map((dispute) => (
                        <TableRow key={dispute.id}>
                          <TableCell>{dispute.orderId}</TableCell>
                          <TableCell><p>Buyer: {dispute.buyerName}</p><p>Vendor: {dispute.vendorName}</p></TableCell>
                          <TableCell><Badge variant="outline">{dispute.type}</Badge></TableCell>
                          <TableCell>GHS {dispute.amount.toLocaleString()}</TableCell>
                          <TableCell>{getStatusBadge(dispute.status)}</TableCell>
                          <TableCell>
                            <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="sm"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent>
                                <DropdownMenuItem onClick={() => updateDispute(dispute.id, { status: "investigating" })}><Eye className="w-4 h-4 mr-2" />Investigate</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { resolveDispute(dispute.id, "Resolved by admin", user!.id, user!.name); toast.success("Dispute resolved"); }}><CheckCircle className="w-4 h-4 mr-2" />Resolve</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateDispute(dispute.id, { status: "escalated" })}><AlertTriangle className="w-4 h-4 mr-2" />Escalate</DropdownMenuItem>
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
          </TabsContent>

          {/* Reviews Moderation Tab */}
          <TabsContent value="reviews">
            <ReviewModeration />
          </TabsContent>

          {/* API Management Tab - Master Admin Only */}
          {canManageAPIs && (
            <TabsContent value="api" className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Key className="w-5 h-5" />
                    API & Integration Management
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    Configure system-wide API credentials. Changes persist globally.
                  </p>
                </div>
                <Badge variant={isMasterAdmin ? "default" : "secondary"} className="text-xs">
                  {isMasterAdmin ? "Master Admin" : "Admin"}
                </Badge>
              </div>
              <APIManagement adminId={user.id} adminName={user.name} />
            </TabsContent>
          )}

          {/* Admin Management Tab - Master Admin Only */}
          {canManageAdmins && (
            <TabsContent value="admins" className="space-y-6">
              <AdminManagementSection
                currentAdmin={user}
              />
            </TabsContent>
          )}

          {/* Categories Management Tab - Master Admin Only */}
          {isMasterAdmin && (
            <TabsContent value="categories">
              <CategoryManagement />
            </TabsContent>
          )}

          {/* Site Settings Tab - Master Admin Only */}
          {isMasterAdmin && (
            <TabsContent value="site-settings">
              <div className="space-y-6">
                {/* Branding */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Palette className="w-5 h-5" />Site Branding</CardTitle>
                    <CardDescription>Customize your marketplace appearance</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label>Site Name</Label><Input value={branding.siteName} onChange={(e) => user && updateBranding({ siteName: e.target.value }, user.id, user.email || '')} /></div>
                      <div><Label>Tagline</Label><Input value={branding.tagline} onChange={(e) => user && updateBranding({ tagline: e.target.value }, user.id, user.email || '')} /></div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div><Label>Primary Color</Label><div className="flex gap-2"><Input type="color" value={branding.primaryColor} className="w-12 h-10 p-1" onChange={(e) => user && updateBranding({ primaryColor: e.target.value }, user.id, user.email || '')} /><Input value={branding.primaryColor} className="flex-1" readOnly /></div></div>
                      <div><Label>Secondary Color</Label><div className="flex gap-2"><Input type="color" value={branding.secondaryColor} className="w-12 h-10 p-1" onChange={(e) => user && updateBranding({ secondaryColor: e.target.value }, user.id, user.email || '')} /><Input value={branding.secondaryColor} className="flex-1" readOnly /></div></div>
                      <div><Label>Accent Color</Label><div className="flex gap-2"><Input type="color" value={branding.accentColor} className="w-12 h-10 p-1" onChange={(e) => user && updateBranding({ accentColor: e.target.value }, user.id, user.email || '')} /><Input value={branding.accentColor} className="flex-1" readOnly /></div></div>
                    </div>
                    <div><Label>Contact Email</Label><Input value={branding.contactEmail} onChange={(e) => user && updateBranding({ contactEmail: e.target.value }, user.id, user.email || '')} /></div>
                    <div><Label>Footer Text</Label><Textarea value={branding.footerText} onChange={(e) => user && updateBranding({ footerText: e.target.value }, user.id, user.email || '')} /></div>
                  </CardContent>
                </Card>

                {/* Static Pages */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div><CardTitle className="flex items-center gap-2"><FileEdit className="w-5 h-5" />Static Pages</CardTitle><CardDescription>Manage About, Terms, Privacy, and other pages</CardDescription></div>
                      <Button><Plus className="w-4 h-4 mr-2" />Add Page</Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader><TableRow><TableHead>Page</TableHead><TableHead>Slug</TableHead><TableHead>Status</TableHead><TableHead>Footer</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {staticPages.map((page) => (
                          <TableRow key={page.id}>
                            <TableCell className="font-medium">{page.title}</TableCell>
                            <TableCell><code className="text-xs bg-gray-100 px-2 py-1 rounded">/{page.slug}</code></TableCell>
                            <TableCell><Badge variant={page.isPublished ? "default" : "secondary"} className={page.isPublished ? "bg-green-100 text-green-800" : ""}>{page.isPublished ? "Published" : "Draft"}</Badge></TableCell>
                            <TableCell>{page.showInFooter ? <CheckCircle className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-gray-300" />}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm"><Edit className="w-4 h-4" /></Button>
                                <Button variant="ghost" size="sm"><Eye className="w-4 h-4" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Homepage Sections */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Layout className="w-5 h-5" />Homepage Sections</CardTitle>
                    <CardDescription>Control which sections appear on the homepage</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {homepageSections.map((section) => (
                        <div key={section.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                            <div>
                              <p className="font-medium">{section.title || section.type.replace(/_/g, ' ').toUpperCase()}</p>
                              <p className="text-xs text-muted-foreground">Type: {section.type}</p>
                            </div>
                          </div>
                          <Switch checked={section.isVisible} onCheckedChange={() => user && toggleHomepageSection(section.id, user.id, user.email || '')} />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}

          {/* Approvals Tab */}
          <TabsContent value="approvals">
            <div className="space-y-6">
              {/* Approval Workflows */}
              {isMasterAdmin && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Settings className="w-5 h-5" />Approval Workflows</CardTitle>
                    <CardDescription>Configure which actions require admin approval</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {workflows.map((workflow) => (
                        <div key={workflow.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <p className="font-medium">{workflow.name}</p>
                            <p className="text-sm text-muted-foreground">{workflow.description}</p>
                            <div className="flex gap-2 mt-2">
                              {workflow.autoApprove && <Badge variant="outline" className="text-xs">Auto-approve enabled</Badge>}
                              {workflow.notifyAdminOnSubmission && <Badge variant="outline" className="text-xs">Notify on submission</Badge>}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <Switch checked={workflow.isEnabled} onCheckedChange={() => user && toggleWorkflow(workflow.id, user.id, user.name)} />
                            <Button variant="ghost" size="sm"><Settings className="w-4 h-4" /></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Pending Approvals */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckSquare className="w-5 h-5" />
                    Pending Approvals
                    {pendingApprovals > 0 && <Badge variant="destructive">{pendingApprovals}</Badge>}
                  </CardTitle>
                  <CardDescription>Review and process approval requests</CardDescription>
                </CardHeader>
                <CardContent>
                  {getPendingRequests().length === 0 ? (
                    <div className="text-center py-12">
                      <CheckCircle className="w-16 h-16 text-green-300 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold">All Caught Up!</h3>
                      <p className="text-muted-foreground">No pending approvals at the moment</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Entity</TableHead>
                          <TableHead>Submitted By</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Priority</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getPendingRequests().map((request) => (
                          <TableRow key={request.id}>
                            <TableCell><Badge variant="outline">{request.workflowType.replace(/_/g, ' ')}</Badge></TableCell>
                            <TableCell className="font-medium">{request.entityName}</TableCell>
                            <TableCell>{request.submittedByName}</TableCell>
                            <TableCell className="text-sm">{formatDistance(new Date(request.createdAt), new Date(), { addSuffix: true })}</TableCell>
                            <TableCell>
                              <Badge variant={request.priority === 'urgent' ? 'destructive' : request.priority === 'high' ? 'default' : 'secondary'}>
                                {request.priority}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => user && approveRequest(request.id, user.id, user.name)}>
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => user && rejectRequest(request.id, user.id, user.name, 'Rejected by admin')}>
                                  <XCircle className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="outline"><Eye className="w-4 h-4" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Email Management Tab */}
          <TabsContent value="email">
            <EmailManagementSection />
          </TabsContent>

          <TabsContent value="audit">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div><CardTitle className="flex items-center gap-2"><History className="w-5 h-5" />Audit Logs</CardTitle><CardDescription>Track all admin actions</CardDescription></div>
                  <Button variant="outline"><Download className="w-4 h-4 mr-2" />Export</Button>
                </div>
              </CardHeader>
              <CardContent>
                {dbAuditLogs.length === 0 ? (
                  <div className="text-center py-12"><History className="w-16 h-16 text-gray-300 mx-auto mb-4" /><h3 className="text-lg font-semibold">No Audit Logs</h3></div>
                ) : (
                  <ScrollArea className="h-[600px]">
                    <Table>
                      <TableHeader><TableRow><TableHead>Timestamp</TableHead><TableHead>Action</TableHead><TableHead>Category</TableHead><TableHead>Admin</TableHead><TableHead>Target</TableHead><TableHead>Details</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {dbAuditLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-sm">{format(new Date(log.timestamp), "MMM d, yyyy HH:mm")}</TableCell>
                            <TableCell><Badge variant="outline">{log.action.replace(/_/g, " ")}</Badge></TableCell>
                            <TableCell><Badge variant="secondary">{log.category}</Badge></TableCell>
                            <TableCell>{log.adminName || "-"}</TableCell>
                            <TableCell>{log.targetName || "-"}</TableCell>
                            <TableCell className="max-w-[300px] truncate">{log.details || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </SiteLayout>
  );
}

// Export with auth guard wrapper
export default function AdminDashboard() {
  return (
    <AdminAuthGuard>
      <AdminDashboardContent />
    </AdminAuthGuard>
  );
}
