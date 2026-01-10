"use client";

import { useForm } from "react-hook-form";
import { useCallback, useEffect, useState } from "react";
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

    // Build a flat list of all error paths (including nested categoryAttributes)
    const errorPaths: string[] = [];
    
    for (const key of errorKeys) {
      if (key === "categoryAttributes" && errors.categoryAttributes) {
        // Handle nested categoryAttributes errors
        const attrErrors = errors.categoryAttributes as Record<string, unknown>;
        for (const nestedKey of Object.keys(attrErrors)) {
          if (nestedKey !== 'message' && nestedKey !== 'type' && nestedKey !== 'ref') {
            errorPaths.push(`categoryAttributes.${nestedKey}`);
          }
        }
      } else {
        errorPaths.push(key);
      }
    }

    // Try to find and scroll to the first error field
    for (const fieldPath of errorPaths) {
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
