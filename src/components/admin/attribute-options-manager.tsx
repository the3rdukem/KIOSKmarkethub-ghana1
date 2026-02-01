"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Plus, Trash2, ChevronRight, Loader2, FolderTree, Settings2
} from "lucide-react";
import { toast } from "sonner";

interface AttributeOption {
  id: string;
  categoryId: string;
  fieldKey: string;
  value: string;
  parentOptionId: string | null;
  level: number;
  displayOrder: number;
  isActive: boolean;
  children?: AttributeOption[];
}

interface CategoryFormField {
  key: string;
  label: string;
  type: string;
  required: boolean;
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
  formSchema: CategoryFormField[] | null;
}

interface AttributeOptionsManagerProps {
  category: ApiCategory;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSchemaUpdate?: () => void;
}

export function AttributeOptionsManager({ 
  category, 
  open, 
  onOpenChange,
  onSchemaUpdate 
}: AttributeOptionsManagerProps) {
  const [options, setOptions] = useState<AttributeOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [selectedFieldKey, setSelectedFieldKey] = useState<string>("");
  const [newValue, setNewValue] = useState("");
  const [selectedParent, setSelectedParent] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<number>(1);

  const dependentFields = useMemo(() => 
    (category.formSchema || []).filter(f => f.type === 'dependent_select'),
    [category.formSchema]
  );

  const selectFields = useMemo(() => 
    (category.formSchema || []).filter(f => f.type === 'select' || f.type === 'dependent_select'),
    [category.formSchema]
  );

  const fetchOptions = useCallback(async () => {
    if (!category.id) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/attribute-options?categoryId=${category.id}`);
      const data = await res.json();
      if (data.options) {
        setOptions(data.options);
      }
    } catch (error) {
      console.error("Failed to fetch options:", error);
      toast.error("Failed to load attribute options");
    } finally {
      setLoading(false);
    }
  }, [category.id]);

  useEffect(() => {
    if (open && category.id) {
      fetchOptions();
    }
  }, [open, category.id, fetchOptions]);

  useEffect(() => {
    if (open && selectFields.length > 0 && !selectedFieldKey) {
      setSelectedFieldKey(selectFields[0].key);
    }
  }, [open, selectFields, selectedFieldKey]);

  function getFieldLabel(fieldKey: string): string {
    const field = category.formSchema?.find(f => f.key === fieldKey);
    return field?.label || fieldKey;
  }

  function getOptionsForField(fieldKey: string, parentId?: string | null): AttributeOption[] {
    return options.filter(
      o => o.fieldKey === fieldKey && 
           (parentId === undefined || o.parentOptionId === parentId)
    );
  }

  function getLevel1Options(fieldKey: string): AttributeOption[] {
    return options.filter(o => o.fieldKey === fieldKey && o.level === 1);
  }

  function getChildField(parentFieldKey: string): CategoryFormField | undefined {
    return category.formSchema?.find(f => f.dependsOn === parentFieldKey);
  }

  async function handleAddOption() {
    if (!newValue.trim() || !selectedFieldKey) {
      toast.error("Please enter a value");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/attribute-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          categoryId: category.id,
          fieldKey: selectedFieldKey,
          value: newValue.trim(),
          parentOptionId: selectedParent || null,
          level: selectedLevel,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add option");
      }

      toast.success("Option added");
      setNewValue("");
      fetchOptions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add option");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteOption(optionId: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/attribute-options?id=${optionId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete option");
      }

      toast.success("Option deleted");
      fetchOptions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete option");
    } finally {
      setSaving(false);
    }
  }

  function renderOptionTree(fieldKey: string, parentId: string | null = null, depth: number = 0) {
    const fieldOptions = options.filter(
      o => o.fieldKey === fieldKey && o.parentOptionId === parentId
    ).sort((a, b) => a.displayOrder - b.displayOrder);

    const childField = getChildField(fieldKey);

    if (fieldOptions.length === 0) {
      if (depth === 0) {
        return (
          <p className="text-sm text-muted-foreground italic py-2">
            No options defined yet. Add your first option below.
          </p>
        );
      }
      return null;
    }

    return (
      <div className={`space-y-1 ${depth > 0 ? 'ml-6 border-l pl-3' : ''}`}>
        {fieldOptions.map((option) => (
          <div key={option.id}>
            <div className="flex items-center justify-between py-1.5 px-2 hover:bg-gray-50 rounded group">
              <div className="flex items-center gap-2">
                {depth > 0 && <ChevronRight className="w-3 h-3 text-gray-400" />}
                <span className="text-sm">{option.value}</span>
                <Badge variant="outline" className="text-xs">
                  L{option.level}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 group-hover:opacity-100"
                onClick={() => handleDeleteOption(option.id)}
                disabled={saving}
              >
                <Trash2 className="w-3 h-3 text-red-500" />
              </Button>
            </div>
            {childField && renderChildOptions(option, childField)}
          </div>
        ))}
      </div>
    );
  }

  function renderChildOptions(parentOption: AttributeOption, childField: CategoryFormField) {
    const childOptions = options.filter(
      o => o.fieldKey === childField.key && o.parentOptionId === parentOption.id
    ).sort((a, b) => a.displayOrder - b.displayOrder);

    const grandchildField = getChildField(childField.key);

    if (childOptions.length === 0) return null;

    return (
      <div className="ml-6 border-l pl-3">
        {childOptions.map((childOption) => (
          <div key={childOption.id}>
            <div className="flex items-center justify-between py-1.5 px-2 hover:bg-gray-50 rounded group">
              <div className="flex items-center gap-2">
                <ChevronRight className="w-3 h-3 text-gray-400" />
                <span className="text-sm">{childOption.value}</span>
                <Badge variant="outline" className="text-xs">
                  L{childOption.level}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 group-hover:opacity-100"
                onClick={() => handleDeleteOption(childOption.id)}
                disabled={saving}
              >
                <Trash2 className="w-3 h-3 text-red-500" />
              </Button>
            </div>
            {grandchildField && renderChildOptions(childOption, grandchildField)}
          </div>
        ))}
      </div>
    );
  }

  function getAvailableParents(): { id: string; label: string }[] {
    const currentField = category.formSchema?.find(f => f.key === selectedFieldKey);
    if (!currentField?.dependsOn) return [];

    const parentField = category.formSchema?.find(f => f.key === currentField.dependsOn);
    if (!parentField) return [];

    const parentFieldLevel = parentField.level || 1;
    const parentOptions = options.filter(
      o => o.fieldKey === parentField.key && o.level === parentFieldLevel
    );

    const grandparentField = category.formSchema?.find(f => f.key === parentField.dependsOn);
    
    const result: { id: string; label: string }[] = [];
    
    parentOptions.forEach(po => {
      if (grandparentField) {
        const grandparent = options.find(o => o.id === po.parentOptionId);
        result.push({
          id: po.id,
          label: grandparent ? `${grandparent.value} > ${po.value}` : po.value
        });
      } else {
        result.push({ id: po.id, label: po.value });
      }
    });

    return result;
  }

  const currentField = category.formSchema?.find(f => f.key === selectedFieldKey);
  const requiresParent = currentField?.dependsOn ? true : false;
  const availableParents = getAvailableParents();

  useEffect(() => {
    if (currentField) {
      setSelectedLevel(currentField.level || 1);
      if (!currentField.dependsOn) {
        setSelectedParent(null);
      }
    }
  }, [selectedFieldKey, currentField]);

  if (selectFields.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Attribute Options</DialogTitle>
            <DialogDescription>Category: {category.name}</DialogDescription>
          </DialogHeader>
          <div className="py-8 text-center">
            <Settings2 className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-muted-foreground">
              This category has no select or dependent select fields configured.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Add select fields to the category schema first, then manage their options here.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderTree className="w-5 h-5" />
            Manage Attribute Options
          </DialogTitle>
          <DialogDescription>
            Configure hierarchical options for {category.name}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Add New Option</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Field</Label>
                    <Select value={selectedFieldKey} onValueChange={setSelectedFieldKey}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select field" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectFields.map((field) => (
                          <SelectItem key={field.key} value={field.key}>
                            {field.label} {field.dependsOn && `(depends on ${getFieldLabel(field.dependsOn)})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {requiresParent && (
                    <div>
                      <Label>Parent Option</Label>
                      <Select 
                        value={selectedParent || ""} 
                        onValueChange={(v) => setSelectedParent(v || null)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select parent" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableParents.map((parent) => (
                            <SelectItem key={parent.id} value={parent.id}>
                              {parent.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label>Value</Label>
                    <Input
                      placeholder="Enter option value"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !saving) {
                          handleAddOption();
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleAddOption} disabled={saving || !newValue.trim()}>
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      <span className="ml-2">Add</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Current Options</CardTitle>
                <CardDescription>
                  {options.length} option{options.length !== 1 ? 's' : ''} defined
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" className="w-full">
                  {selectFields.filter(f => !f.dependsOn).map((field) => {
                    const fieldOptions = getLevel1Options(field.key);
                    return (
                      <AccordionItem key={field.key} value={field.key}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center gap-2">
                            <span>{field.label}</span>
                            <Badge variant="secondary" className="text-xs">
                              {fieldOptions.length} options
                            </Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          {renderOptionTree(field.key)}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </CardContent>
            </Card>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
