'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, MessageSquare, Send, FileText, History, Settings, Loader2, CheckCircle, XCircle, Clock, AlertCircle, Plus } from 'lucide-react';

const SMS_EVENT_TYPES = [
  { value: 'order_confirmed', label: 'Order Confirmed', variables: ['orderNumber', 'buyerName', 'totalAmount'] },
  { value: 'order_preparing', label: 'Order Preparing', variables: ['orderNumber', 'buyerName'] },
  { value: 'order_ready_for_pickup', label: 'Order Ready for Pickup', variables: ['orderNumber', 'buyerName', 'pickupAddress'] },
  { value: 'order_out_for_delivery', label: 'Order Out for Delivery', variables: ['orderNumber', 'buyerName', 'courierName', 'courierPhone'] },
  { value: 'order_delivered', label: 'Order Delivered', variables: ['orderNumber', 'buyerName'] },
  { value: 'order_cancelled', label: 'Order Cancelled', variables: ['orderNumber', 'buyerName', 'reason'] },
  { value: 'vendor_new_order', label: 'Vendor: New Order', variables: ['orderNumber', 'vendorName', 'itemCount', 'totalAmount'] },
  { value: 'dispute_opened', label: 'Dispute Opened', variables: ['orderNumber', 'disputeId'] },
  { value: 'dispute_resolved', label: 'Dispute Resolved', variables: ['orderNumber', 'disputeId', 'resolution'] },
  { value: 'welcome_buyer', label: 'Welcome Buyer', variables: ['buyerName'] },
  { value: 'welcome_vendor', label: 'Welcome Vendor', variables: ['vendorName', 'storeName'] },
  { value: 'payout_processing', label: 'Payout Processing', variables: ['vendorName', 'amount'] },
  { value: 'payout_completed', label: 'Payout Completed', variables: ['vendorName', 'amount', 'reference'] },
  { value: 'payout_failed', label: 'Payout Failed', variables: ['vendorName', 'amount', 'reason'] },
  { value: 'low_stock_alert', label: 'Low Stock Alert', variables: ['vendorName', 'productName', 'quantity', 'threshold'] },
  { value: 'out_of_stock_alert', label: 'Out of Stock Alert', variables: ['vendorName', 'productName'] },
];
import { useAuthStore } from '@/lib/auth-store';
import { toast } from 'sonner';
import { SiteLayout } from '@/components/layout/site-layout';

interface SMSTemplate {
  id: string;
  name: string;
  eventType: string;
  messageTemplate: string;
  variables: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SMSLog {
  id: string;
  recipientPhone: string;
  recipientName: string | null;
  eventType: string;
  messageContent: string;
  status: string;
  errorMessage: string | null;
  orderId: string | null;
  sentAt: string | null;
  createdAt: string;
}

interface SMSStats {
  totalSent: number;
  totalFailed: number;
  totalPending: number;
  last24Hours: number;
  last7Days: number;
}

interface SMSStatus {
  enabled: boolean;
  integrationConfigured: boolean;
  featureEnabled: boolean;
  mode: 'live' | 'demo' | 'disabled';
}

export default function SMSManagementPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuthStore();
  
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SMSStatus | null>(null);
  const [stats, setStats] = useState<SMSStats | null>(null);
  const [templates, setTemplates] = useState<SMSTemplate[]>([]);
  const [logs, setLogs] = useState<SMSLog[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(0);
  
  const [editingTemplate, setEditingTemplate] = useState<SMSTemplate | null>(null);
  const [editForm, setEditForm] = useState({ name: '', messageTemplate: '' });
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  
  // Create template state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', eventType: '', messageTemplate: '' });
  const [creating, setCreating] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const fetchOverview = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/sms?action=overview');
      if (!response.ok) throw new Error('Failed to fetch SMS overview');
      
      const data = await response.json();
      setStatus(data.status);
      setStats(data.stats);
      setTemplates(data.templates);
    } catch (error) {
      toast.error('Failed to load SMS settings');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async (page: number = 0) => {
    try {
      const response = await fetch(`/api/admin/sms?action=logs&limit=20&offset=${page * 20}`);
      if (!response.ok) throw new Error('Failed to fetch SMS logs');
      
      const data = await response.json();
      setLogs(data.logs);
      setLogsTotal(data.total);
      setLogsPage(page);
    } catch (error) {
      toast.error('Failed to load SMS logs');
      console.error(error);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user && ['admin', 'master_admin'].includes(user.role)) {
      fetchOverview();
      fetchLogs(0);
    }
  }, [authLoading, user, fetchOverview, fetchLogs]);

  const handleCreateTemplate = async () => {
    if (!createForm.name || !createForm.eventType || !createForm.messageTemplate) {
      toast.error('Please fill in all fields');
      return;
    }
    
    setCreating(true);
    try {
      const response = await fetch('/api/admin/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_template',
          name: createForm.name,
          eventType: createForm.eventType,
          messageTemplate: createForm.messageTemplate,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        toast.error(data.error || 'Failed to create template');
        return;
      }
      
      setTemplates(prev => [...prev, data.template]);
      setShowCreateDialog(false);
      setCreateForm({ name: '', eventType: '', messageTemplate: '' });
      toast.success('Template created successfully');
    } catch (error) {
      toast.error('Failed to create template');
      console.error(error);
    } finally {
      setCreating(false);
    }
  };

  const handleSeedDefaults = async () => {
    setSeeding(true);
    try {
      const response = await fetch('/api/admin/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed_default_templates' }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        toast.error(data.error || 'Failed to populate templates');
        return;
      }
      
      setTemplates(data.templates);
      toast.success(`Created ${data.created} templates${data.skipped > 0 ? `, skipped ${data.skipped} existing` : ''}`);
    } catch (error) {
      toast.error('Failed to populate default templates');
      console.error(error);
    } finally {
      setSeeding(false);
    }
  };

  const handleToggleSMS = async (enabled: boolean) => {
    try {
      const response = await fetch('/api/admin/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_sms', enabled }),
      });
      
      if (!response.ok) throw new Error('Failed to toggle SMS');
      
      const data = await response.json();
      setStatus(data.status);
      toast.success(data.message);
    } catch (error) {
      toast.error('Failed to toggle SMS notifications');
      console.error(error);
    }
  };

  const handleToggleTemplate = async (templateId: string, isActive: boolean) => {
    setTogglingId(templateId);
    try {
      const response = await fetch('/api/admin/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_template', templateId, isActive }),
      });
      
      if (!response.ok) throw new Error('Failed to toggle template');
      
      const data = await response.json();
      setTemplates(prev => prev.map(t => t.id === templateId ? data.template : t));
      toast.success(data.message);
    } catch (error) {
      toast.error('Failed to toggle template');
      console.error(error);
    } finally {
      setTogglingId(null);
    }
  };

  const handleEditTemplate = (template: SMSTemplate) => {
    setEditingTemplate(template);
    setEditForm({
      name: template.name,
      messageTemplate: template.messageTemplate,
    });
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;
    
    setSaving(true);
    try {
      const response = await fetch('/api/admin/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_template',
          templateId: editingTemplate.id,
          name: editForm.name,
          messageTemplate: editForm.messageTemplate,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to update template');
      
      const data = await response.json();
      setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? data.template : t));
      setEditingTemplate(null);
      toast.success('Template updated successfully');
    } catch (error) {
      toast.error('Failed to update template');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Sent</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getEventTypeBadge = (eventType: string) => {
    const colors: Record<string, string> = {
      order_confirmed: 'bg-blue-100 text-blue-800',
      order_preparing: 'bg-purple-100 text-purple-800',
      order_delivered: 'bg-green-100 text-green-800',
      order_cancelled: 'bg-red-100 text-red-800',
      vendor_new_order: 'bg-orange-100 text-orange-800',
      dispute_opened: 'bg-yellow-100 text-yellow-800',
      welcome_buyer: 'bg-teal-100 text-teal-800',
      welcome_vendor: 'bg-indigo-100 text-indigo-800',
      low_stock_alert: 'bg-amber-100 text-amber-800',
      out_of_stock_alert: 'bg-red-100 text-red-800',
    };
    return <Badge className={colors[eventType] || 'bg-gray-100 text-gray-800'}>{eventType.replace(/_/g, ' ')}</Badge>;
  };

  if (authLoading || loading) {
    return (
      <SiteLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="mt-2 text-muted-foreground">Loading SMS Management...</p>
          </div>
        </div>
      </SiteLayout>
    );
  }

  if (!user || !['admin', 'master_admin'].includes(user.role)) {
    router.push('/admin/login');
    return null;
  }

  return (
    <SiteLayout>
      <div className="container mx-auto py-8 px-4 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">SMS Notifications</h1>
            <p className="text-muted-foreground">Manage SMS templates and view message history</p>
          </div>
          <div className="flex items-center gap-2">
            {status?.mode === 'demo' && (
              <Badge variant="outline" className="bg-yellow-50">Demo Mode</Badge>
            )}
            {status?.mode === 'live' && (
              <Badge className="bg-green-100 text-green-800">Live</Badge>
            )}
            {status?.mode === 'disabled' && (
              <Badge variant="secondary">Disabled</Badge>
            )}
          </div>
        </div>

        {!status?.integrationConfigured && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-yellow-800">Arkesel Integration Required</h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    SMS notifications require Arkesel API credentials. Go to Admin → API Management to configure.
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => router.push('/admin?tab=api-management')}
                  >
                    Configure API
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Sent</CardDescription>
                <CardTitle className="text-2xl text-green-600">{stats.totalSent}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Failed</CardDescription>
                <CardTitle className="text-2xl text-red-600">{stats.totalFailed}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Pending</CardDescription>
                <CardTitle className="text-2xl text-yellow-600">{stats.totalPending}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Last 24 Hours</CardDescription>
                <CardTitle className="text-2xl">{stats.last24Hours}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Last 7 Days</CardDescription>
                <CardTitle className="text-2xl">{stats.last7Days}</CardTitle>
              </CardHeader>
            </Card>
          </div>
        )}

        <Tabs defaultValue="settings" className="space-y-4">
          <TabsList>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" /> Settings
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <FileText className="h-4 w-4" /> Templates
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <History className="h-4 w-4" /> Message History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Arkesel API Configuration</CardTitle>
                  <CardDescription>SMS requires Arkesel OTP integration to be configured</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium">Arkesel OTP Integration</p>
                      <p className="text-sm text-muted-foreground">
                        Configure your Arkesel API key and Sender ID in the API Management section
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {status?.integrationConfigured ? (
                        <Badge className="bg-green-100 text-green-800">Configured</Badge>
                      ) : (
                        <Badge variant="secondary">Not Configured</Badge>
                      )}
                      <Button variant="outline" onClick={() => router.push('/admin?tab=api')}>
                        Go to API Management
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>SMS Settings</CardTitle>
                  <CardDescription>Enable or disable SMS notifications globally</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">Enable SMS Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        When enabled, the system will send SMS for order events, welcome messages, etc.
                      </p>
                    </div>
                    <Switch
                      checked={status?.featureEnabled || false}
                      onCheckedChange={handleToggleSMS}
                      disabled={!status?.integrationConfigured}
                    />
                  </div>

                  {!status?.integrationConfigured && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <p className="text-sm text-yellow-800">
                        Please configure Arkesel OTP in API Management before enabling SMS notifications.
                      </p>
                    </div>
                  )}

                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-2">Integration Status</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Arkesel API:</span>
                        <span className="ml-2">
                          {status?.integrationConfigured ? (
                            <Badge className="bg-green-100 text-green-800">Configured</Badge>
                          ) : (
                            <Badge variant="secondary">Not Configured</Badge>
                          )}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Mode:</span>
                        <span className="ml-2 capitalize">{status?.mode || 'disabled'}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="templates">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>SMS Templates</CardTitle>
                    <CardDescription>Manage message templates for different events</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleSeedDefaults} disabled={seeding}>
                      {seeding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      Populate Defaults
                    </Button>
                    <Button onClick={() => setShowCreateDialog(true)}>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Create Template
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {templates.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No SMS Templates</h3>
                    <p className="text-muted-foreground mb-4">Create templates to enable SMS notifications</p>
                    <Button onClick={() => setShowCreateDialog(true)}>
                      Create Your First Template
                    </Button>
                  </div>
                ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Event Type</TableHead>
                      <TableHead>Variables</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell className="font-medium">{template.name}</TableCell>
                        <TableCell>{getEventTypeBadge(template.eventType)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {template.variables.map((v) => (
                              <Badge key={v} variant="outline" className="text-xs">
                                {`{{${v}}}`}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={template.isActive}
                            onCheckedChange={(checked) => handleToggleTemplate(template.id, checked)}
                            disabled={togglingId === template.id}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditTemplate(template)}
                          >
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <CardTitle>Message History</CardTitle>
                <CardDescription>View sent SMS messages and their delivery status</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No SMS messages sent yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{log.recipientPhone}</div>
                              {log.recipientName && (
                                <div className="text-sm text-muted-foreground">{log.recipientName}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{getEventTypeBadge(log.eventType)}</TableCell>
                          <TableCell>
                            <div className="max-w-xs truncate" title={log.messageContent}>
                              {log.messageContent}
                            </div>
                            {log.errorMessage && (
                              <div className="text-xs text-red-600 mt-1">{log.errorMessage}</div>
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(log.status)}</TableCell>
                          <TableCell className="text-sm">{formatDate(log.sentAt || log.createdAt)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>

                {logsTotal > 20 && (
                  <div className="flex justify-center gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={logsPage === 0}
                      onClick={() => fetchLogs(logsPage - 1)}
                    >
                      Previous
                    </Button>
                    <span className="flex items-center text-sm text-muted-foreground">
                      Page {logsPage + 1} of {Math.ceil(logsTotal / 20)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={(logsPage + 1) * 20 >= logsTotal}
                      onClick={() => fetchLogs(logsPage + 1)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={!!editingTemplate} onOpenChange={() => setEditingTemplate(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Template</DialogTitle>
              <DialogDescription>
                Modify the SMS template. Use {`{{variable_name}}`} for dynamic content.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Template Name</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Message Template</Label>
                <Textarea
                  value={editForm.messageTemplate}
                  onChange={(e) => setEditForm({ ...editForm, messageTemplate: e.target.value })}
                  rows={4}
                  placeholder="Enter your message template..."
                />
                <p className="text-xs text-muted-foreground">
                  Available variables: {editingTemplate?.variables.map(v => `{{${v}}}`).join(', ')}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingTemplate(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveTemplate} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Template Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create SMS Template</DialogTitle>
              <DialogDescription>
                Create a new SMS template for a specific event type.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Template Name</Label>
                <Input
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="e.g., Order Confirmation SMS"
                />
              </div>
              <div className="space-y-2">
                <Label>Event Type</Label>
                <Select
                  value={createForm.eventType}
                  onValueChange={(value) => setCreateForm({ ...createForm, eventType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an event type" />
                  </SelectTrigger>
                  <SelectContent>
                    {SMS_EVENT_TYPES.filter(et => !templates.some(t => t.eventType === et.value)).map((eventType) => (
                      <SelectItem key={eventType.value} value={eventType.value}>
                        {eventType.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {createForm.eventType && (
                  <p className="text-xs text-muted-foreground">
                    Available variables: {SMS_EVENT_TYPES.find(et => et.value === createForm.eventType)?.variables.map(v => `{{${v}}}`).join(', ')}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Message Template</Label>
                <Textarea
                  value={createForm.messageTemplate}
                  onChange={(e) => setCreateForm({ ...createForm, messageTemplate: e.target.value })}
                  rows={4}
                  placeholder="Enter your message template using {{variable}} for dynamic content..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowCreateDialog(false);
                setCreateForm({ name: '', eventType: '', messageTemplate: '' });
              }}>
                Cancel
              </Button>
              <Button onClick={handleCreateTemplate} disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Create Template
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SiteLayout>
  );
}
