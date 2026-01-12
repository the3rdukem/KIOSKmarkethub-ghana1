"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Key,
  Settings,
  TestTube,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Shield,
  Cloud,
  CreditCard,
  MapPin,
  Smartphone,
  User,
  RefreshCw,
  History,
  Lock,
  ExternalLink,
  Info,
  Copy,
  Check,
  Brain,
  ScanFace,
} from "lucide-react";
import { format, formatDistance } from "date-fns";
import { toast } from "sonner";

interface APIManagementProps {
  adminId: string;
  adminName: string;
}

// Types matching server schemas
interface CredentialFieldSchema {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'email' | 'textarea' | 'boolean' | 'select' | 'multiselect';
  required: boolean;
  placeholder?: string;
  description?: string;
  options?: { value: string; label: string }[];
  defaultValue?: string;
}

interface IntegrationSchema {
  id: string;
  name: string;
  description: string;
  provider: string;
  category: 'auth' | 'maps' | 'payment' | 'otp' | 'storage' | 'ai' | 'verification';
  icon: string;
  documentationUrl?: string;
  fields: CredentialFieldSchema[];
  supportedEnvironments: string[];
  defaultEnvironment: string;
}

interface Integration {
  id: string;
  name: string;
  description: string;
  provider: string;
  category: 'auth' | 'maps' | 'payment' | 'otp' | 'storage' | 'ai' | 'verification';
  isEnabled: boolean;
  isConfigured: boolean;
  environment: string;
  status: 'connected' | 'error' | 'disconnected' | 'not_configured';
  credentials: Record<string, string>;
  lastTestedAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  schema?: IntegrationSchema;
}

interface IntegrationStats {
  total: number;
  configured: number;
  enabled: number;
  connected: number;
  byCategory: Record<string, { total: number; connected: number }>;
}

interface AuditLog {
  id: string;
  integrationId: string;
  integrationName: string;
  action: string;
  adminId: string;
  adminName: string;
  details: string;
  timestamp: string;
}

const categoryInfo: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  auth: {
    icon: <User className="w-5 h-5" />,
    label: "Authentication",
    color: "bg-blue-100 text-blue-700",
  },
  maps: {
    icon: <MapPin className="w-5 h-5" />,
    label: "Location Services",
    color: "bg-green-100 text-green-700",
  },
  payment: {
    icon: <CreditCard className="w-5 h-5" />,
    label: "Payments",
    color: "bg-amber-100 text-amber-700",
  },
  otp: {
    icon: <Smartphone className="w-5 h-5" />,
    label: "OTP / SMS",
    color: "bg-purple-100 text-purple-700",
  },
  storage: {
    icon: <Cloud className="w-5 h-5" />,
    label: "Cloud Storage",
    color: "bg-cyan-100 text-cyan-700",
  },
  ai: {
    icon: <Brain className="w-5 h-5" />,
    label: "AI Services",
    color: "bg-pink-100 text-pink-700",
  },
  verification: {
    icon: <ScanFace className="w-5 h-5" />,
    label: "Identity Verification",
    color: "bg-orange-100 text-orange-700",
  },
};

const statusStyles: Record<string, { color: string; label: string }> = {
  connected: { color: "bg-emerald-100 text-emerald-700", label: "Connected" },
  error: { color: "bg-red-100 text-red-700", label: "Error" },
  disconnected: { color: "bg-gray-100 text-gray-700", label: "Disconnected" },
  not_configured: { color: "bg-yellow-100 text-yellow-700", label: "Not Configured" },
};

export function APIManagement({ adminId, adminName }: APIManagementProps) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [stats, setStats] = useState<IntegrationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [isTesting, setIsTesting] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [credentialValues, setCredentialValues] = useState<Record<string, string>>({});
  const [visibleCredentials, setVisibleCredentials] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Fetch integrations from API on mount
  const fetchIntegrations = useCallback(async () => {
    try {
      const response = await fetch('/api/integrations', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        if (data.integrations) {
          setIntegrations(data.integrations);
        }
        if (data.stats) {
          setStats(data.stats);
        }
      } else {
        toast.error("Failed to fetch integrations");
      }
    } catch (error) {
      console.error('Failed to fetch integrations:', error);
      toast.error("Failed to load integrations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  // Initialize credential values when selecting an integration
  useEffect(() => {
    if (selectedIntegration && selectedIntegration.schema) {
      const values: Record<string, string> = {};

      // Initialize from existing credentials
      for (const [key, value] of Object.entries(selectedIntegration.credentials)) {
        values[key] = value || "";
      }

      // Ensure all schema fields have entries (with defaults if needed)
      for (const field of selectedIntegration.schema.fields) {
        if (!(field.key in values)) {
          values[field.key] = field.defaultValue || "";
        }
      }

      setCredentialValues(values);
      setVisibleCredentials({});
    }
  }, [selectedIntegration]);

  const handleSaveCredentials = async () => {
    if (!selectedIntegration) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          integrationId: selectedIntegration.id,
          action: 'update_credentials',
          credentials: credentialValues,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Credentials saved successfully");
        // Update local state
        setIntegrations(prev => prev.map(i =>
          i.id === selectedIntegration.id
            ? { ...i, isConfigured: data.integration.isConfigured, status: data.integration.status }
            : i
        ));
        setIsConfiguring(false);
        // Refresh to get updated stats
        await fetchIntegrations();
        
        // If configured, prompt to enable and test
        if (data.integration.isConfigured && !data.integration.isEnabled) {
          toast.info(
            `${selectedIntegration.name} is configured! Click "Enable" then "Test Connection" to activate it.`,
            { duration: 6000 }
          );
        }
      } else {
        toast.error(data.error || "Failed to save credentials");
      }
    } catch (error) {
      toast.error("Failed to save credentials");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async (integrationId: string) => {
    setIsTesting(integrationId);
    try {
      const response = await fetch('/api/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          integrationId,
          action: 'test',
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const integration = integrations.find(i => i.id === integrationId);
        toast.success(`Connection to ${integration?.name || integrationId} successful!`);
        setIntegrations(prev => prev.map(i =>
          i.id === integrationId
            ? { ...i, status: 'connected', lastTestedAt: new Date().toISOString(), lastError: undefined }
            : i
        ));
        
        // Auto-enable if not already enabled after successful test
        if (integration && !integration.isEnabled) {
          const enableResponse = await fetch('/api/integrations', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              integrationId,
              action: 'toggle',
              enabled: true,
            }),
          });
          
          if (enableResponse.ok) {
            toast.success(`${integration.name} has been automatically enabled!`);
            setIntegrations(prev => prev.map(i =>
              i.id === integrationId
                ? { ...i, isEnabled: true, status: 'connected' }
                : i
            ));
          }
        }
        
        // Refresh stats
        fetchIntegrations();
      } else {
        toast.error(data.error || "Connection test failed");
        setIntegrations(prev => prev.map(i =>
          i.id === integrationId
            ? { ...i, status: 'error', lastError: data.error }
            : i
        ));
      }
    } catch (error) {
      toast.error("Connection test failed");
    } finally {
      setIsTesting(null);
    }
  };

  const handleToggleIntegration = async (integration: Integration) => {
    if (!integration.isConfigured && !integration.isEnabled) {
      toast.error("Please configure credentials before enabling");
      return;
    }

    try {
      const response = await fetch('/api/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          integrationId: integration.id,
          action: 'toggle',
          enabled: !integration.isEnabled,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(`${integration.name} ${integration.isEnabled ? "disabled" : "enabled"}`);
        setIntegrations(prev => prev.map(i =>
          i.id === integration.id
            ? { ...i, isEnabled: !integration.isEnabled, status: data.integration.status }
            : i
        ));
        fetchIntegrations();
      } else {
        toast.error(data.error || "Failed to toggle integration");
      }
    } catch (error) {
      toast.error("Failed to toggle integration");
    }
  };

  const handleEnvironmentChange = async (
    integration: Integration,
    environment: string
  ) => {
    try {
      const response = await fetch('/api/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          integrationId: integration.id,
          action: 'set_environment',
          environment,
        }),
      });

      if (response.ok) {
        toast.success(`${integration.name} environment changed to ${environment.toUpperCase()}`);
        setIntegrations(prev => prev.map(i =>
          i.id === integration.id ? { ...i, environment } : i
        ));
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to change environment");
      }
    } catch (error) {
      toast.error("Failed to change environment");
    }
  };

  const toggleCredentialVisibility = (key: string) => {
    setVisibleCredentials((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const copyToClipboard = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getIntegrationsByCategory = () => {
    const grouped: Record<string, Integration[]> = {
      auth: [],
      maps: [],
      payment: [],
      otp: [],
      storage: [],
      ai: [],
      verification: [],
    };

    integrations.forEach((integration) => {
      if (grouped[integration.category]) {
        grouped[integration.category].push(integration);
      }
    });

    return grouped;
  };

  // Render a form field based on its type
  const renderFormField = (field: CredentialFieldSchema) => {
    const value = credentialValues[field.key] || "";

    switch (field.type) {
      case 'textarea':
        return (
          <Textarea
            id={field.key}
            placeholder={field.placeholder}
            value={value}
            onChange={(e) =>
              setCredentialValues((prev) => ({
                ...prev,
                [field.key]: e.target.value,
              }))
            }
            className="min-h-[120px] font-mono text-sm"
          />
        );

      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={field.key}
              checked={value === 'true'}
              onCheckedChange={(checked) =>
                setCredentialValues((prev) => ({
                  ...prev,
                  [field.key]: checked ? 'true' : 'false',
                }))
              }
            />
            <Label htmlFor={field.key} className="text-sm font-normal">
              {field.description || field.label}
            </Label>
          </div>
        );

      case 'select':
        return (
          <Select
            value={value}
            onValueChange={(val) =>
              setCredentialValues((prev) => ({
                ...prev,
                [field.key]: val,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder || `Select ${field.label}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'multiselect':
        const selectedValues = value ? value.split(',') : [];
        return (
          <div className="space-y-2">
            {field.options?.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`${field.key}-${option.value}`}
                  checked={selectedValues.includes(option.value)}
                  onCheckedChange={(checked) => {
                    const newValues = checked
                      ? [...selectedValues, option.value]
                      : selectedValues.filter(v => v !== option.value);
                    setCredentialValues((prev) => ({
                      ...prev,
                      [field.key]: newValues.join(','),
                    }));
                  }}
                />
                <Label htmlFor={`${field.key}-${option.value}`} className="text-sm font-normal">
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
        );

      case 'password':
        return (
          <div className="relative">
            <Input
              id={field.key}
              type={visibleCredentials[field.key] ? "text" : "password"}
              placeholder={field.placeholder}
              value={value}
              onChange={(e) =>
                setCredentialValues((prev) => ({
                  ...prev,
                  [field.key]: e.target.value,
                }))
              }
              className="pr-20"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => toggleCredentialVisibility(field.key)}
              >
                {visibleCredentials[field.key] ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </Button>
              {value && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => copyToClipboard(value, field.key)}
                >
                  {copiedKey === field.key ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              )}
            </div>
          </div>
        );

      default: // text, url, email
        return (
          <div className="relative">
            <Input
              id={field.key}
              type={field.type}
              placeholder={field.placeholder}
              value={value}
              onChange={(e) =>
                setCredentialValues((prev) => ({
                  ...prev,
                  [field.key]: e.target.value,
                }))
              }
              className="pr-10"
            />
            {value && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => copyToClipboard(value, field.key)}
              >
                {copiedKey === field.key ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            )}
          </div>
        );
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const groupedIntegrations = getIntegrationsByCategory();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Key className="w-6 h-6" />
            API Management
          </h2>
          <p className="text-muted-foreground">
            Configure and manage third-party service integrations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchIntegrations}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowAuditLogs(!showAuditLogs)}
          >
            <History className="w-4 h-4 mr-2" />
            Audit Logs
          </Button>
        </div>
      </div>

      {/* Security Notice */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4 flex items-start gap-3">
          <Shield className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-amber-800">Security Notice</h4>
            <p className="text-sm text-amber-700">
              All API credentials are encrypted and stored securely in the database. Secret values are never
              exposed in the UI. All configuration changes are logged for audit purposes.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Integration Status Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {Object.entries(categoryInfo).map(([category, info]) => {
          const catStats = stats?.byCategory[category] || { total: 0, connected: 0 };
          const categoryIntegrations = groupedIntegrations[category] || [];
          const total = categoryIntegrations.length || catStats.total;
          const connected = categoryIntegrations.filter(i => i.status === 'connected' && i.isEnabled).length || catStats.connected;

          return (
            <Card key={category}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${info.color}`}>{info.icon}</div>
                  <div>
                    <p className="text-xs text-muted-foreground">{info.label}</p>
                    <p className="text-lg font-semibold">
                      {connected}/{total}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Integrations List */}
      <Accordion type="multiple" defaultValue={["payment", "verification", "auth"]} className="space-y-4">
        {Object.entries(groupedIntegrations).map(([category, categoryIntegrations]) => {
          if (categoryIntegrations.length === 0) return null;

          const info = categoryInfo[category];
          const connectedCount = categoryIntegrations.filter(i => i.status === 'connected' && i.isEnabled).length;

          return (
            <AccordionItem
              key={category}
              value={category}
              className="border rounded-lg bg-white"
            >
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${info?.color || 'bg-gray-100'}`}>
                    {info?.icon || <Key className="w-5 h-5" />}
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold">{info?.label || category}</h3>
                    <p className="text-sm text-muted-foreground">
                      {connectedCount} of {categoryIntegrations.length} connected
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-4">
                  {categoryIntegrations.map((integration) => (
                    <Card key={integration.id} className="border">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="font-semibold">{integration.name}</h4>
                              <Badge
                                variant="outline"
                                className={statusStyles[integration.status]?.color || 'bg-gray-100'}
                              >
                                {statusStyles[integration.status]?.label || integration.status}
                              </Badge>
                              <Badge variant="secondary">
                                {integration.environment.toUpperCase()}
                              </Badge>
                              {!integration.isConfigured && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <AlertCircle className="w-4 h-4 text-yellow-500" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Configuration required</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mb-3">
                              {integration.description}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Provider: {integration.provider}
                              {integration.lastTestedAt && (
                                <span className="ml-3">
                                  Last tested:{" "}
                                  {formatDistance(
                                    new Date(integration.lastTestedAt),
                                    new Date(),
                                    { addSuffix: true }
                                  )}
                                </span>
                              )}
                            </p>
                            {integration.lastError && (
                              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                                {integration.lastError}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            {/* Explicit Enable/Disable Button */}
                            {integration.isConfigured && (
                              <Button
                                variant={integration.isEnabled ? "destructive" : "default"}
                                size="sm"
                                onClick={() => handleToggleIntegration(integration)}
                                className={integration.isEnabled ? "" : "bg-emerald-600 hover:bg-emerald-700"}
                              >
                                {integration.isEnabled ? (
                                  <>
                                    <XCircle className="w-4 h-4 mr-1" />
                                    Disable
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    Enable
                                  </>
                                )}
                              </Button>
                            )}
                            {!integration.isConfigured && (
                              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                                Configure First
                              </Badge>
                            )}
                            {/* Toggle switch as secondary control */}
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-2">
                                    <Switch
                                      checked={integration.isEnabled}
                                      onCheckedChange={() => handleToggleIntegration(integration)}
                                      disabled={!integration.isConfigured}
                                    />
                                    <span className="text-sm text-muted-foreground">
                                      {integration.isEnabled ? "Active" : "Inactive"}
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {integration.isConfigured
                                    ? integration.isEnabled
                                      ? "Click to disable integration"
                                      : "Click to enable integration"
                                    : "Save credentials first to enable"}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>

                        <Separator className="my-4" />

                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Environment Selector */}
                          {integration.schema && (
                            <Select
                              value={integration.environment}
                              onValueChange={(value) => handleEnvironmentChange(integration, value)}
                            >
                              <SelectTrigger className="w-[140px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {integration.schema.supportedEnvironments.map((env) => (
                                  <SelectItem key={env} value={env}>
                                    {env.charAt(0).toUpperCase() + env.slice(1)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}

                          {/* Configure Button */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedIntegration(integration);
                              setIsConfiguring(true);
                            }}
                          >
                            <Settings className="w-4 h-4 mr-2" />
                            Configure
                          </Button>

                          {/* Test Connection Button */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTestConnection(integration.id)}
                            disabled={!integration.isConfigured || isTesting === integration.id}
                          >
                            {isTesting === integration.id ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <TestTube className="w-4 h-4 mr-2" />
                            )}
                            Test Connection
                          </Button>

                          {/* Documentation Link */}
                          {integration.schema?.documentationUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              asChild
                            >
                              <a
                                href={integration.schema.documentationUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Docs
                              </a>
                            </Button>
                          )}

                          {/* Status Indicator */}
                          {integration.status === "connected" && (
                            <div className="flex items-center gap-1 text-sm text-emerald-600">
                              <CheckCircle className="w-4 h-4" />
                              <span>Connected</span>
                            </div>
                          )}
                          {integration.status === "error" && (
                            <div className="flex items-center gap-1 text-sm text-red-600">
                              <XCircle className="w-4 h-4" />
                              <span>Error</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {/* Configuration Dialog */}
      <Dialog open={isConfiguring} onOpenChange={setIsConfiguring}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Configure {selectedIntegration?.name}
            </DialogTitle>
            <DialogDescription>
              Enter your API credentials. Values are encrypted and stored securely.
            </DialogDescription>
          </DialogHeader>

          {selectedIntegration?.schema ? (
            <div className="space-y-4 py-4">
              {selectedIntegration.schema.fields.map((field) => (
                <div key={field.key} className="space-y-2">
                  {field.type !== 'boolean' && (
                    <div className="flex items-center justify-between">
                      <Label htmlFor={field.key} className="flex items-center gap-1">
                        {field.label}
                        {field.required && <span className="text-red-500">*</span>}
                      </Label>
                      {field.description && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="w-4 h-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>{field.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  )}
                  {renderFormField(field)}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <AlertCircle className="w-8 h-8 mx-auto mb-2" />
              <p>No configuration schema available for this integration.</p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfiguring(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCredentials} disabled={isSaving || !selectedIntegration?.schema}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Credentials"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Audit Logs Panel */}
      {showAuditLogs && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Integration Audit Logs
                </CardTitle>
                <CardDescription>
                  Track all API configuration changes
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAuditLogs(false)}
              >
                <XCircle className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {auditLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Audit logs are stored in the database.</p>
                <p className="text-sm">View the Admin Audit Logs section for full history.</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Integration</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Admin</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">
                          {format(new Date(log.timestamp), "MMM d, HH:mm")}
                        </TableCell>
                        <TableCell>{log.integrationName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {log.action.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>{log.adminName}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {log.details}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Reference */}
      <Card className="bg-gray-50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Info className="w-5 h-5" />
            Quick Reference
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2">Paystack</h4>
              <p className="text-muted-foreground">
                Get API keys from{" "}
                <a
                  href="https://dashboard.paystack.com/#/settings/developer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  Paystack Dashboard <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Smile Identity</h4>
              <p className="text-muted-foreground">
                Get credentials from{" "}
                <a
                  href="https://portal.smileidentity.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  Smile ID Portal <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Google Maps</h4>
              <p className="text-muted-foreground">
                Enable APIs in{" "}
                <a
                  href="https://console.cloud.google.com/google/maps-apis"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  Maps Platform <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Need Help?</h4>
              <p className="text-muted-foreground">
                Contact support at{" "}
                <a
                  href="mailto:support@markethub.gh"
                  className="text-blue-600 hover:underline"
                >
                  support@markethub.gh
                </a>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
