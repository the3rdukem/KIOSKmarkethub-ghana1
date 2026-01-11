import { z } from "zod";

export const UNSET_VALUE = "__unset__" as const;

export const PRODUCT_STATUS = ["draft", "active", "archived", "suspended", "pending_approval", "rejected"] as const;
export type ProductStatus = (typeof PRODUCT_STATUS)[number];

export const CONDITION_VALUES = ["new", "like_new", "good", "fair", "poor"] as const;
export type ProductCondition = (typeof CONDITION_VALUES)[number];

export const ProductContractSchema = z.object({
  id: z.string(),
  vendorId: z.string(),
  vendorName: z.string(),
  name: z.string().min(2, "Product name is required (minimum 2 characters)"),
  description: z.string().nullable(),
  category: z.string().nullable(),
  condition: z.string().nullable(),
  price: z.number().min(0),
  comparePrice: z.number().nullable(),
  costPerItem: z.number().nullable(),
  sku: z.string().nullable(),
  barcode: z.string().nullable(),
  quantity: z.number().int().min(0).default(0),
  trackQuantity: z.boolean().default(true),
  images: z.array(z.string()).default([]),
  weight: z.number().nullable(),
  dimensions: z.object({
    length: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
  }).nullable(),
  tags: z.array(z.string()).default([]),
  status: z.enum(PRODUCT_STATUS).default("draft"),
  categoryAttributes: z.record(z.string(), z.union([z.string(), z.boolean(), z.number()])).default({}),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Product = z.infer<typeof ProductContractSchema>;

export interface ProductLike {
  id?: string;
  vendor_id?: string;
  vendorId?: string;
  vendor_name?: string;
  vendorName?: string;
  name?: string;
  description?: string | null;
  category?: string | null;
  condition?: string | null;
  price?: number;
  compare_price?: number | null;
  comparePrice?: number | null;
  cost_per_item?: number | null;
  costPerItem?: number | null;
  sku?: string | null;
  barcode?: string | null;
  quantity?: number;
  track_quantity?: number | boolean;
  trackQuantity?: boolean;
  images?: string | string[] | null;
  weight?: number | null;
  dimensions?: string | { length?: number; width?: number; height?: number } | null;
  tags?: string | string[] | null;
  status?: string;
  category_attributes?: string | Record<string, unknown> | null;
  categoryAttributes?: Record<string, unknown>;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  is_featured?: number;
  isFeatured?: boolean;
}

function parseJsonArray(val: unknown): string[] {
  if (Array.isArray(val)) return val as string[];
  if (typeof val === "string" && val.trim()) {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseJsonObject<T>(val: unknown): T | null {
  if (val && typeof val === "object" && !Array.isArray(val)) return val as T;
  if (typeof val === "string" && val.trim()) {
    try {
      return JSON.parse(val) as T;
    } catch {
      return null;
    }
  }
  return null;
}

function normalizeNullable(val: unknown): string | null {
  if (val === undefined || val === null || val === "") return null;
  return String(val);
}

function normalizeCondition(val: unknown): string | null {
  if (val === undefined || val === null || val === "") return null;
  const strVal = String(val).toLowerCase().trim();
  // Map legacy capitalized/spaced values to canonical lowercase
  const conditionMap: Record<string, string> = {
    "new": "new",
    "like new": "like_new",
    "like_new": "like_new",
    "good": "good",
    "fair": "fair",
    "poor": "poor",
    "used": "poor", // Legacy mapping
  };
  return conditionMap[strVal] || (CONDITION_VALUES.includes(strVal as any) ? strVal : null);
}

function normalizeNumber(val: unknown): number | null {
  if (val === undefined || val === null || val === "") return null;
  const num = Number(val);
  return isNaN(num) ? null : num;
}

export function normalizeProductForApi(product: ProductLike): Product {
  const p = product as ProductLike;
  
  const rawCategoryAttributes = p.category_attributes ?? p.categoryAttributes;
  let parsedCategoryAttrs: Record<string, string | boolean | number> = {};
  
  if (typeof rawCategoryAttributes === "string") {
    try {
      parsedCategoryAttrs = JSON.parse(rawCategoryAttributes);
    } catch {
      parsedCategoryAttrs = {};
    }
  } else if (rawCategoryAttributes && typeof rawCategoryAttributes === "object") {
    parsedCategoryAttrs = { ...(rawCategoryAttributes as Record<string, string | boolean | number>) };
  }

  const extractedCondition = parsedCategoryAttrs.condition;
  if (extractedCondition !== undefined) {
    delete parsedCategoryAttrs.condition;
  }

  const topLevelCondition = p.condition as string | undefined | null;
  const rawFinalCondition = topLevelCondition || (extractedCondition as string | undefined) || null;

  const parsedImages = parseJsonArray(p.images);
  const parsedTags = parseJsonArray(p.tags);
  const parsedDimensions = parseJsonObject<{ length?: number; width?: number; height?: number }>(
    p.dimensions
  );

  const trackQuantityRaw = p.track_quantity ?? p.trackQuantity;
  const trackQuantity = trackQuantityRaw === 1 || trackQuantityRaw === true;

  return {
    id: String(p.id || ""),
    vendorId: String(p.vendor_id ?? p.vendorId ?? ""),
    vendorName: String(p.vendor_name ?? p.vendorName ?? ""),
    name: String(p.name || ""),
    description: normalizeNullable(p.description),
    category: normalizeNullable(p.category),
    condition: normalizeCondition(rawFinalCondition),
    price: Number(p.price) || 0,
    comparePrice: normalizeNumber(p.compare_price ?? p.comparePrice),
    costPerItem: normalizeNumber(p.cost_per_item ?? p.costPerItem),
    sku: normalizeNullable(p.sku),
    barcode: normalizeNullable(p.barcode),
    quantity: Number(p.quantity) || 0,
    trackQuantity: trackQuantity,
    images: parsedImages,
    weight: normalizeNumber(p.weight),
    dimensions: parsedDimensions,
    tags: parsedTags,
    status: (p.status as ProductStatus) || "draft",
    categoryAttributes: parsedCategoryAttrs,
    createdAt: String(p.created_at ?? p.createdAt ?? new Date().toISOString()),
    updatedAt: String(p.updated_at ?? p.updatedAt ?? new Date().toISOString()),
  };
}

export const CreateProductInputSchema = z.object({
  name: z.string().min(2, "Product name is required"),
  description: z.string().optional(),
  category: z.string().optional().nullable(),
  condition: z.string().optional().nullable(),
  price: z.number().min(0, "Price must be 0 or greater"),
  comparePrice: z.number().optional().nullable(),
  costPerItem: z.number().optional().nullable(),
  sku: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  quantity: z.number().int().min(0).default(0),
  trackQuantity: z.boolean().default(true),
  images: z.array(z.string()).default([]),
  weight: z.number().optional().nullable(),
  dimensions: z.object({
    length: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
  }).optional().nullable(),
  tags: z.array(z.string()).default([]),
  status: z.enum(["draft", "active"]).default("draft"),
  categoryAttributes: z.record(z.string(), z.union([z.string(), z.boolean(), z.number()])).default({}),
});

export type CreateProductInput = z.infer<typeof CreateProductInputSchema>;

export const UpdateProductInputSchema = CreateProductInputSchema.partial();
export type UpdateProductInput = z.infer<typeof UpdateProductInputSchema>;

export function normalizeInputForDatabase(input: CreateProductInput | UpdateProductInput): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (input.name !== undefined) result.name = input.name;
  if (input.description !== undefined) result.description = input.description || null;
  if (input.category !== undefined) result.category = input.category || null;
  if (input.condition !== undefined) {
    const cond = input.condition;
    if (cond === UNSET_VALUE || cond === "") {
      result.condition = null;
    } else {
      result.condition = cond;
    }
  }
  if (input.price !== undefined) result.price = input.price;
  if (input.comparePrice !== undefined) result.compare_price = input.comparePrice || null;
  if (input.costPerItem !== undefined) result.cost_per_item = input.costPerItem || null;
  if (input.sku !== undefined) result.sku = input.sku || null;
  if (input.barcode !== undefined) result.barcode = input.barcode || null;
  if (input.quantity !== undefined) result.quantity = input.quantity;
  if (input.trackQuantity !== undefined) result.track_quantity = input.trackQuantity ? 1 : 0;
  if (input.images !== undefined) result.images = JSON.stringify(input.images);
  if (input.weight !== undefined) result.weight = input.weight || null;
  if (input.dimensions !== undefined) result.dimensions = input.dimensions ? JSON.stringify(input.dimensions) : null;
  if (input.tags !== undefined) result.tags = JSON.stringify(input.tags);
  if (input.status !== undefined) result.status = input.status;
  if (input.categoryAttributes !== undefined) {
    const attrs = { ...input.categoryAttributes };
    delete (attrs as Record<string, unknown>).condition;
    result.category_attributes = JSON.stringify(attrs);
  }

  return result;
}

export function validateForPublish(product: Partial<CreateProductInput>): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!product.name || product.name.trim().length < 2) {
    errors.name = "Product name is required (minimum 2 characters)";
  }

  if (!product.category || product.category === UNSET_VALUE) {
    errors.category = "Category is required";
  }

  if (!product.condition || product.condition === UNSET_VALUE) {
    errors.condition = "Condition is required";
  }

  if (product.price === undefined || product.price <= 0) {
    errors.price = "Price must be greater than 0";
  }

  if (product.quantity === undefined || product.quantity < 0) {
    errors.quantity = "Quantity must be 0 or greater";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateForDraft(product: Partial<CreateProductInput>): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!product.name || product.name.trim().length < 2) {
    errors.name = "Product name is required (minimum 2 characters)";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
