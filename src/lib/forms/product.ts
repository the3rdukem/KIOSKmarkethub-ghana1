import { z } from "zod";
import { validateContentSafety, validateTextField as validateTextContent } from "@/lib/validation";

export const UNSET_VALUE = "__unset__";

const requiredSelectField = (fieldName: string) =>
  z.string().refine((val) => val !== UNSET_VALUE && val.trim() !== "", {
    message: `${fieldName} is required`,
  });

const requiredTextField = (fieldName: string, minLength = 1) =>
  z
    .string()
    .min(minLength, `${fieldName} is required`)
    .refine((val) => {
      const result = validateContentSafety(val);
      return result.valid;
    }, {
      message: "Contains prohibited or unsafe content",
    });

const optionalTextField = () =>
  z
    .string()
    .optional()
    .transform((val) => (val?.trim() === "" ? undefined : val))
    .refine((val) => {
      if (!val) return true;
      const result = validateContentSafety(val);
      return result.valid;
    }, {
      message: "Contains prohibited or unsafe content",
    });

// Simple optional text field without content safety validation
// Used for color names like "Midnight Blue" that may be falsely flagged
const simpleOptionalTextField = () =>
  z
    .string()
    .optional()
    .transform((val) => (val?.trim() === "" ? undefined : val));

const machineIdentifierField = () =>
  z
    .string()
    .optional()
    .transform((val) => (val?.trim() === "" ? undefined : val));

const requiredPriceField = () =>
  z
    .string()
    .min(1, "Price is required")
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
      message: "Price must be greater than 0",
    });

const requiredQuantityField = () =>
  z
    .string()
    .min(1, "Quantity is required")
    .refine((val) => !isNaN(parseInt(val, 10)) && parseInt(val, 10) >= 0, {
      message: "Quantity must be 0 or greater",
    });

const optionalPriceField = () =>
  z
    .string()
    .optional()
    .transform((val) => (val?.trim() === "" ? undefined : val))
    .refine(
      (val) => !val || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0),
      { message: "Must be a valid price" }
    );

export const productFormSchema = z.object({
  name: requiredTextField("Product name", 2),
  description: requiredTextField("Description", 1),
  category: requiredSelectField("Category"),
  // CONDITION REFACTOR: Condition now lives in categoryAttributes when category schema defines it
  price: requiredPriceField(),
  comparePrice: optionalPriceField(),
  costPerItem: optionalPriceField(),
  quantity: requiredQuantityField(),
  trackQuantity: z.boolean().default(true),
  sku: machineIdentifierField(),
  barcode: machineIdentifierField(),
  weight: z.string().optional(),
  dimensions: z
    .object({
      length: z.string().optional(),
      width: z.string().optional(),
      height: z.string().optional(),
    })
    .optional(),
  requiresShipping: z.boolean().default(true),
  tags: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  status: z.enum(["active", "draft", "archived"]).default("draft"),
  color: simpleOptionalTextField(),
  brand: simpleOptionalTextField(),
  continueSellingWhenOutOfStock: z.boolean().default(false),
  categoryAttributes: z.record(z.string(), z.union([z.string(), z.boolean()])).optional(),
});

export const draftProductFormSchema = z.object({
  name: requiredTextField("Product name", 2),
  description: z.string().optional(),
  category: z.string().optional(),
  // CONDITION REFACTOR: Condition now lives in categoryAttributes when category schema defines it
  price: z.string().optional(),
  comparePrice: z.string().optional(),
  costPerItem: z.string().optional(),
  quantity: z.string().optional(),
  trackQuantity: z.boolean().default(true),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  weight: z.string().optional(),
  dimensions: z
    .object({
      length: z.string().optional(),
      width: z.string().optional(),
      height: z.string().optional(),
    })
    .optional(),
  requiresShipping: z.boolean().default(true),
  tags: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  status: z.enum(["active", "draft", "archived"]).default("draft"),
  color: z.string().optional(),
  brand: z.string().optional(),
  continueSellingWhenOutOfStock: z.boolean().default(false),
  categoryAttributes: z.record(z.string(), z.union([z.string(), z.boolean()])).optional(),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;

export interface DefaultProductValues {
  name: string;
  description: string;
  category: string;
  // CONDITION REFACTOR: Condition now lives in categoryAttributes when category schema defines it
  price: string;
  comparePrice: string;
  costPerItem: string;
  quantity: string;
  trackQuantity: boolean;
  sku: string;
  barcode: string;
  weight: string;
  dimensions: {
    length: string;
    width: string;
    height: string;
  };
  requiresShipping: boolean;
  tags: string;
  metaTitle: string;
  metaDescription: string;
  status: "active" | "draft" | "archived";
  color: string;
  brand: string;
  continueSellingWhenOutOfStock: boolean;
  categoryAttributes: Record<string, string | boolean>;
}

export function getDefaultProductValues(): DefaultProductValues {
  return {
    name: "",
    description: "",
    category: UNSET_VALUE,
    // CONDITION REFACTOR: Condition now lives in categoryAttributes when category schema defines it
    price: "",
    comparePrice: "",
    costPerItem: "",
    quantity: "",
    trackQuantity: true,
    sku: "",
    barcode: "",
    weight: "",
    dimensions: {
      length: "",
      width: "",
      height: "",
    },
    requiresShipping: true,
    tags: "",
    metaTitle: "",
    metaDescription: "",
    status: "draft",
    color: "",
    brand: "",
    continueSellingWhenOutOfStock: false,
    categoryAttributes: {},
  };
}

export function transformFormToApiPayload(values: DefaultProductValues) {
  const tagsArray = values.tags
    ? values.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
    : [];

  // PHASE 1.2: Filter out __unset__ values from categoryAttributes
  // This prevents optional fields from blocking server submission
  // CONDITION REFACTOR: condition now lives in categoryAttributes when category schema defines it
  const categoryAttrsTransformed: Record<string, string | boolean> = {};
  for (const [key, value] of Object.entries(values.categoryAttributes || {})) {
    // Only include values that are actually set (not sentinel values)
    if (value !== UNSET_VALUE && value !== "") {
      categoryAttrsTransformed[key] = value;
    }
  }

  return {
    name: values.name.trim(),
    description: values.description.trim(),
    category: values.category, // Pass through as-is, server will reject __unset__
    // CONDITION REFACTOR: condition now lives in categoryAttributes when category schema defines it
    price: parseFloat(values.price) || 0,
    comparePrice: values.comparePrice ? parseFloat(values.comparePrice) : null,
    costPerItem: values.costPerItem ? parseFloat(values.costPerItem) : null,
    quantity: parseInt(values.quantity, 10) || 0,
    trackQuantity: values.trackQuantity,
    sku: values.sku.trim() || null,
    barcode: values.barcode.trim() || null,
    weight: values.weight ? parseFloat(values.weight) : null,
    dimensions: values.dimensions,
    requiresShipping: values.requiresShipping,
    tags: tagsArray,
    metaTitle: values.metaTitle.trim() || null,
    metaDescription: values.metaDescription.trim() || null,
    status: values.status,
    color: values.color?.trim() || null,
    brand: values.brand?.trim() || null,
    continueSellingWhenOutOfStock: values.continueSellingWhenOutOfStock,
    categoryAttributes: categoryAttrsTransformed,
  };
}

export function transformApiToFormValues(product: Record<string, unknown>): DefaultProductValues {
  // CONDITION REFACTOR: condition now lives in categoryAttributes when category schema defines it
  const categoryAttrs = product.categoryAttributes as Record<string, string | boolean> | undefined;

  return {
    name: (product.name as string) ?? "",
    description: (product.description as string) ?? "",
    category: (product.category as string) || UNSET_VALUE,
    // CONDITION REFACTOR: condition now lives in categoryAttributes when category schema defines it
    price: product.price != null ? String(product.price) : "",
    comparePrice: product.comparePrice != null ? String(product.comparePrice) : "",
    costPerItem: product.costPerItem != null ? String(product.costPerItem) : "",
    quantity: product.quantity != null ? String(product.quantity) : "",
    trackQuantity: (product.trackQuantity as boolean) ?? true,
    sku: (product.sku as string) ?? "",
    barcode: (product.barcode as string) ?? "",
    weight: product.weight != null ? String(product.weight) : "",
    dimensions: (product.dimensions as { length: string; width: string; height: string }) ?? {
      length: "",
      width: "",
      height: "",
    },
    requiresShipping: (product.requiresShipping as boolean) ?? true,
    tags: Array.isArray(product.tags) ? (product.tags as string[]).join(", ") : "",
    metaTitle: (product.metaTitle as string) ?? "",
    metaDescription: (product.metaDescription as string) ?? "",
    status: ((product.status as string) === "active" ||
      (product.status as string) === "draft" ||
      (product.status as string) === "archived"
      ? (product.status as "active" | "draft" | "archived")
      : "draft"),
    color: (product.color as string) ?? "",
    brand: (product.brand as string) ?? "",
    continueSellingWhenOutOfStock: (product.continueSellingWhenOutOfStock as boolean) ?? false,
    categoryAttributes: categoryAttrs ?? {},
  };
}

export const FIELD_LABELS: Record<string, string> = {
  name: "Product Name",
  description: "Description",
  category: "Category",
  // CONDITION REFACTOR: condition now lives in categoryAttributes when category schema defines it
  price: "Price",
  comparePrice: "Compare Price",
  costPerItem: "Cost Per Item",
  quantity: "Quantity",
  sku: "SKU",
  barcode: "Barcode",
  color: "Color",
  brand: "Brand",
  tags: "Tags",
};
