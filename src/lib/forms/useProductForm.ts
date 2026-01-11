"use client";

import { useForm } from "react-hook-form";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  productFormSchema,
  DefaultProductValues,
  getDefaultProductValues,
  transformFormToApiPayload,
  UNSET_VALUE,
} from "./product";

export interface UseProductFormOptions {
  defaultValues?: Partial<DefaultProductValues>;
  mode?: "create" | "edit";
}

export function useProductForm(options: UseProductFormOptions = {}) {
  const { defaultValues, mode = "create" } = options;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<DefaultProductValues>({
    defaultValues: {
      ...getDefaultProductValues(),
      ...defaultValues,
    },
    mode: "onBlur",
  });

  useEffect(() => {
    if (defaultValues && mode === "edit") {
      form.reset({
        ...getDefaultProductValues(),
        ...defaultValues,
      });
    }
  }, [defaultValues, mode, form]);

  const scrollToFirstError = useCallback(() => {
    const errors = form.formState.errors;
    const errorKeys = Object.keys(errors);
    
    if (errorKeys.length === 0) return;

    // Build a flat list of all error paths and their messages (including nested categoryAttributes)
    const errorPaths: { path: string; message: string }[] = [];
    
    for (const key of errorKeys) {
      if (key === "categoryAttributes" && errors.categoryAttributes) {
        // Handle nested categoryAttributes errors
        const attrErrors = errors.categoryAttributes as Record<string, { message?: string }>;
        for (const nestedKey of Object.keys(attrErrors)) {
          if (nestedKey !== 'message' && nestedKey !== 'type' && nestedKey !== 'ref') {
            const nestedError = attrErrors[nestedKey];
            errorPaths.push({
              path: `categoryAttributes.${nestedKey}`,
              message: nestedError?.message || `${nestedKey} has an error`,
            });
          }
        }
      } else {
        const fieldError = errors[key as keyof typeof errors];
        const message = fieldError && typeof fieldError === 'object' && 'message' in fieldError
          ? (fieldError.message as string)
          : `${key} has an error`;
        errorPaths.push({ path: key, message });
      }
    }

    // Try to find and scroll to the first error field
    for (const { path: fieldPath, message } of errorPaths) {
      const element = document.querySelector(
        `[name="${fieldPath}"], [data-field="${fieldPath}"], #${fieldPath}`
      );
      
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => {
          if (element instanceof HTMLElement) {
            element.focus();
          }
        }, 300);
        return;
      }
    }

    // Fallback: If no element found, show toast with first error message
    if (errorPaths.length > 0) {
      const firstError = errorPaths[0];
      const fieldName = firstError.path.replace(/^categoryAttributes\./, '').replace(/([A-Z])/g, ' $1').trim();
      toast.error(`Please fix: ${firstError.message}`, {
        description: `Check the "${fieldName}" field`,
      });
    }
  }, [form.formState.errors]);

  const validateForPublish = useCallback(async (): Promise<boolean> => {
    const values = form.getValues();
    
    try {
      const result = productFormSchema.safeParse(values);
      
      if (!result.success) {
        const zodErrors = result.error.flatten().fieldErrors;
        
        for (const [field, messages] of Object.entries(zodErrors)) {
          if (messages && messages.length > 0) {
            form.setError(field as keyof DefaultProductValues, {
              type: "manual",
              message: messages[0],
            });
          }
        }
        
        setTimeout(scrollToFirstError, 100);
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }, [form, scrollToFirstError]);

  const validateForDraft = useCallback(async (): Promise<boolean> => {
    const values = form.getValues();
    const name = values.name?.trim();
    
    if (!name || name.length < 2) {
      form.setError("name", {
        type: "manual",
        message: "Product name is required (minimum 2 characters)",
      });
      setTimeout(scrollToFirstError, 100);
      return false;
    }
    
    return true;
  }, [form, scrollToFirstError]);

  const getApiPayload = useCallback(() => {
    return transformFormToApiPayload(form.getValues());
  }, [form]);

  const resetToDefaults = useCallback(() => {
    form.reset(getDefaultProductValues());
  }, [form]);

  return {
    form,
    isSubmitting,
    setIsSubmitting,
    validateForPublish,
    validateForDraft,
    getApiPayload,
    scrollToFirstError,
    resetToDefaults,
    UNSET_VALUE,
  };
}
