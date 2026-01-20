"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Loader2, Plus, Monitor, Smartphone, Variable, Save, X } from "lucide-react";
import { toast } from "sonner";
import "react-quill-new/dist/quill.snow.css";

const ReactQuill = dynamic(() => import("react-quill-new"), {
  ssr: false,
  loading: () => <div className="h-64 bg-gray-100 animate-pulse rounded" />,
});

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  variables?: string[];
  category: "order" | "payment" | "auth" | "notification" | "system";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const TEMPLATE_VARIABLES = [
  { key: "{{userName}}", label: "User Name", description: "Recipient's name" },
  { key: "{{userEmail}}", label: "User Email", description: "Recipient's email" },
  { key: "{{resetLink}}", label: "Reset Link", description: "Password reset URL" },
  { key: "{{orderNumber}}", label: "Order Number", description: "Order reference" },
  { key: "{{orderTotal}}", label: "Order Total", description: "Total amount" },
  { key: "{{vendorName}}", label: "Vendor Name", description: "Vendor's business name" },
  { key: "{{productName}}", label: "Product Name", description: "Product title" },
  { key: "{{trackingNumber}}", label: "Tracking Number", description: "Shipment tracking" },
  { key: "{{siteName}}", label: "Site Name", description: "MarketHub" },
  { key: "{{supportEmail}}", label: "Support Email", description: "Support contact" },
];

const CATEGORIES = [
  { value: "auth", label: "Authentication" },
  { value: "order", label: "Orders" },
  { value: "payment", label: "Payments" },
  { value: "notification", label: "Notifications" },
  { value: "system", label: "System" },
];

interface EmailTemplateEditorProps {
  template?: EmailTemplate | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function EmailTemplateEditor({
  template,
  isOpen,
  onClose,
  onSave,
}: EmailTemplateEditorProps) {
  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    bodyHtml: "",
    bodyText: "",
    category: "notification" as EmailTemplate["category"],
    isActive: true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [activeTab, setActiveTab] = useState("editor");

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name,
        subject: template.subject,
        bodyHtml: template.bodyHtml,
        bodyText: template.bodyText || "",
        category: template.category,
        isActive: template.isActive,
      });
    } else {
      setFormData({
        name: "",
        subject: "",
        bodyHtml: "",
        bodyText: "",
        category: "notification",
        isActive: true,
      });
    }
  }, [template, isOpen]);

  const insertVariable = (variable: string) => {
    setFormData((prev) => ({
      ...prev,
      bodyHtml: prev.bodyHtml + variable,
    }));
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.subject.trim() || !formData.bodyHtml.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSaving(true);
    try {
      const url = template
        ? `/api/admin/email/templates/${template.id}`
        : "/api/admin/email/templates";
      const method = template ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success(template ? "Template updated" : "Template created");
        onSave();
        onClose();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to save template");
      }
    } catch (error) {
      toast.error("Failed to save template");
    } finally {
      setIsSaving(false);
    }
  };

  const quillModules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline", "strike"],
        [{ color: [] }, { background: [] }],
        [{ list: "ordered" }, { list: "bullet" }],
        [{ align: [] }],
        ["link", "image"],
        ["clean"],
      ],
    }),
    []
  );

  const previewHtml = formData.bodyHtml
    .replace(/\{\{userName\}\}/g, "John Doe")
    .replace(/\{\{userEmail\}\}/g, "john@example.com")
    .replace(/\{\{resetLink\}\}/g, "https://markethub.com/reset?token=abc123")
    .replace(/\{\{orderNumber\}\}/g, "ORD-2024-001234")
    .replace(/\{\{orderTotal\}\}/g, "GHS 150.00")
    .replace(/\{\{vendorName\}\}/g, "TechStore Ghana")
    .replace(/\{\{productName\}\}/g, "Wireless Bluetooth Speaker")
    .replace(/\{\{trackingNumber\}\}/g, "GH123456789")
    .replace(/\{\{siteName\}\}/g, "MarketHub")
    .replace(/\{\{supportEmail\}\}/g, "support@markethub.com");

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {template ? "Edit Email Template" : "Create Email Template"}
          </DialogTitle>
          <DialogDescription>
            Design your email template with the rich text editor and preview it before saving.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="editor">Editor</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="editor" className="mt-4 overflow-auto max-h-[60vh]">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Template Name *</Label>
                  <Input
                    placeholder="e.g., Password Reset"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Category *</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) =>
                      setFormData({ ...formData, category: value as EmailTemplate["category"] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Subject Line *</Label>
                <Input
                  placeholder="e.g., Reset Your Password"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Email Body *</Label>
                  <div className="flex gap-1 flex-wrap">
                    {TEMPLATE_VARIABLES.slice(0, 5).map((v) => (
                      <Badge
                        key={v.key}
                        variant="outline"
                        className="cursor-pointer hover:bg-primary hover:text-primary-foreground text-xs"
                        onClick={() => insertVariable(v.key)}
                        title={v.description}
                      >
                        <Variable className="w-3 h-3 mr-1" />
                        {v.label}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="border rounded-md">
                  <ReactQuill
                    theme="snow"
                    value={formData.bodyHtml}
                    onChange={(value) => setFormData({ ...formData, bodyHtml: value })}
                    modules={quillModules}
                    className="min-h-[200px]"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Click variable badges above to insert dynamic content
                </p>
              </div>

              <div>
                <Label>Plain Text Version (optional)</Label>
                <textarea
                  className="w-full min-h-[100px] p-3 border rounded-md text-sm font-mono"
                  placeholder="Plain text fallback for email clients that don't support HTML..."
                  value={formData.bodyText}
                  onChange={(e) => setFormData({ ...formData, bodyText: e.target.value })}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="preview" className="mt-4 overflow-auto max-h-[60vh]">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Button
                  variant={previewMode === "desktop" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPreviewMode("desktop")}
                >
                  <Monitor className="w-4 h-4 mr-1" />
                  Desktop
                </Button>
                <Button
                  variant={previewMode === "mobile" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPreviewMode("mobile")}
                >
                  <Smartphone className="w-4 h-4 mr-1" />
                  Mobile
                </Button>
              </div>

              <Card>
                <CardContent className="p-0">
                  <div
                    className={`mx-auto bg-white border rounded-lg overflow-hidden ${
                      previewMode === "mobile" ? "max-w-[375px]" : "max-w-[600px]"
                    }`}
                  >
                    <div className="bg-gray-100 px-4 py-2 border-b">
                      <p className="text-xs text-gray-500">Subject:</p>
                      <p className="font-medium text-sm">{formData.subject || "(No subject)"}</p>
                    </div>
                    <div
                      className="p-4 prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: previewHtml || "<p>Start writing...</p>" }}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-1" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-1" />
            )}
            {template ? "Update Template" : "Create Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
