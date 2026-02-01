"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface AttributeOption {
  id: string;
  value: string;
  parentOptionId: string | null;
  level: number;
}

interface CascadingSelectProps {
  categoryId: string;
  fieldKey: string;
  label: string;
  required?: boolean;
  value: string | undefined;
  onChange: (value: string, optionId?: string) => void;
  parentValue?: string | undefined;
  parentOptionId?: string | undefined;
  dependsOn?: string;
  disabled?: boolean;
  error?: string;
  placeholder?: string;
}

export function CascadingSelect({
  categoryId,
  fieldKey,
  label,
  required = false,
  value,
  onChange,
  parentValue,
  parentOptionId,
  dependsOn,
  disabled = false,
  error,
  placeholder,
}: CascadingSelectProps) {
  const [options, setOptions] = useState<AttributeOption[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchOptions = useCallback(async () => {
    if (!categoryId || !fieldKey) return;
    
    if (dependsOn && !parentValue) {
      setOptions([]);
      return;
    }

    setLoading(true);
    try {
      let url = `/api/attribute-options?categoryId=${categoryId}&fieldKey=${fieldKey}`;
      if (parentOptionId) {
        url += `&parentOptionId=${parentOptionId}`;
      }
      
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.options) {
        setOptions(data.options);
      }
    } catch (error) {
      console.error("Failed to fetch cascading options:", error);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [categoryId, fieldKey, parentOptionId, dependsOn, parentValue]);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  useEffect(() => {
    if (dependsOn && !parentValue && value) {
      onChange("", undefined);
    }
  }, [parentValue, dependsOn, value, onChange]);

  const isDisabled = disabled || loading || Boolean(dependsOn && !parentValue);

  return (
    <div>
      <Label>
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      <div className="relative">
        <Select
          value={value || ""}
          onValueChange={(selectedValue) => {
            const selectedOption = options.find(o => o.value === selectedValue);
            onChange(selectedValue, selectedOption?.id);
          }}
          disabled={isDisabled}
        >
          <SelectTrigger className={error ? "border-red-500" : ""}>
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-muted-foreground">Loading...</span>
              </div>
            ) : (
              <SelectValue
                placeholder={
                  dependsOn && !parentValue
                    ? `Select ${dependsOn} first`
                    : placeholder || `Select ${label.toLowerCase()}`
                }
              />
            )}
          </SelectTrigger>
          <SelectContent>
            {options.length === 0 ? (
              <div className="py-2 px-3 text-sm text-muted-foreground">
                No options available
              </div>
            ) : (
              options.map((option) => (
                <SelectItem key={option.id} value={option.value}>
                  {option.value}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

interface CascadingSelectGroupProps {
  categoryId: string;
  fields: Array<{
    key: string;
    label: string;
    required: boolean;
    dependsOn?: string;
    level?: number;
  }>;
  values: Record<string, string>;
  onChange: (key: string, value: string, optionLabel?: string) => void;
  errors?: Record<string, string>;
}

export function CascadingSelectGroup({
  categoryId,
  fields,
  values,
  onChange,
  errors = {},
}: CascadingSelectGroupProps) {
  const [optionLookup, setOptionLookup] = useState<Record<string, AttributeOption[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [valueToIdMap, setValueToIdMap] = useState<Record<string, Record<string, string>>>({});

  const fetchOptionsForField = useCallback(async (fieldKey: string, parentId?: string) => {
    setLoading(prev => ({ ...prev, [fieldKey]: true }));
    try {
      let url = `/api/attribute-options?categoryId=${categoryId}&fieldKey=${fieldKey}`;
      if (parentId) {
        url += `&parentOptionId=${parentId}`;
      }
      
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.options) {
        setOptionLookup(prev => ({ ...prev, [fieldKey]: data.options }));
        const idMap: Record<string, string> = {};
        data.options.forEach((opt: AttributeOption) => {
          idMap[opt.value] = opt.id;
        });
        setValueToIdMap(prev => ({ ...prev, [fieldKey]: idMap }));
      }
    } catch (error) {
      console.error(`Failed to fetch options for ${fieldKey}:`, error);
    } finally {
      setLoading(prev => ({ ...prev, [fieldKey]: false }));
    }
  }, [categoryId]);

  useEffect(() => {
    const rootFields = fields.filter(f => !f.dependsOn);
    rootFields.forEach(field => {
      fetchOptionsForField(field.key);
    });
  }, [categoryId, fields, fetchOptionsForField]);

  const handleChange = (field: typeof fields[0], selectedValue: string) => {
    const options = optionLookup[field.key] || [];
    const selectedOption = options.find(o => o.value === selectedValue);
    
    onChange(field.key, selectedValue, selectedValue);
    
    const childFields = fields.filter(f => f.dependsOn === field.key);
    childFields.forEach(childField => {
      onChange(childField.key, "", undefined);
      if (selectedOption) {
        fetchOptionsForField(childField.key, selectedOption.id);
      } else {
        setOptionLookup(prev => ({ ...prev, [childField.key]: [] }));
      }
    });
  };

  return (
    <div className="space-y-4">
      {fields.map((field) => {
        const options = optionLookup[field.key] || [];
        const parentValue = field.dependsOn ? values[field.dependsOn] : undefined;
        const isDisabled = loading[field.key] || Boolean(field.dependsOn && !parentValue);
        const currentValue = values[field.key];

        return (
          <div key={field.key}>
            <Label>
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </Label>
            <Select
              value={currentValue || ""}
              onValueChange={(v) => handleChange(field, v)}
              disabled={isDisabled}
            >
              <SelectTrigger className={errors[field.key] ? "border-red-500" : ""}>
                {loading[field.key] ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-muted-foreground">Loading...</span>
                  </div>
                ) : (
                  <SelectValue
                    placeholder={
                      field.dependsOn && !parentValue
                        ? `Select ${fields.find(f => f.key === field.dependsOn)?.label || field.dependsOn} first`
                        : `Select ${field.label.toLowerCase()}`
                    }
                  />
                )}
              </SelectTrigger>
              <SelectContent>
                {options.length === 0 ? (
                  <div className="py-2 px-3 text-sm text-muted-foreground">
                    {field.dependsOn && !parentValue
                      ? `Select ${fields.find(f => f.key === field.dependsOn)?.label || field.dependsOn} first`
                      : "No options available"}
                  </div>
                ) : (
                  options.map((option) => (
                    <SelectItem key={option.id} value={option.value}>
                      {option.value}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {errors[field.key] && (
              <p className="text-red-500 text-xs mt-1">{errors[field.key]}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
