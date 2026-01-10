/**
 * Select Guard Utility
 * 
 * CRITICAL: Radix UI Select crashes when any SelectItem receives value=""
 * This utility provides defensive guards for Select components.
 * 
 * Use this to:
 * - Validate arrays before mapping to SelectItems
 * - Assert values are safe at runtime
 */

/**
 * Filter an array of values to only include safe Select values
 * Removes: null, undefined, empty strings, whitespace-only strings
 * 
 * @example
 * const categories = filterSelectValues(products.map(p => p.category));
 * // Returns only valid strings
 */
export function filterSelectValues(
  values: (string | null | undefined)[]
): string[] {
  return values.filter(
    (val): val is string => typeof val === 'string' && val.trim().length > 0
  );
}

/**
 * Assert a value is safe for use in a SelectItem
 * Throws if the value would crash Radix Select
 * 
 * @example
 * assertSelectValue(category, 'category');
 * // Throws: "SelectItem value for category cannot be empty"
 */
export function assertSelectValue(
  value: unknown,
  fieldName: string = 'field'
): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(
      `SelectItem value for ${fieldName} cannot be empty. ` +
      `Received: ${JSON.stringify(value)}`
    );
  }
}

/**
 * Check if a value is safe for use in a SelectItem
 * Returns false for: null, undefined, empty strings, whitespace-only strings
 */
export function isValidSelectValue(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Get unique, valid Select values from an array
 * Filters out invalid values and removes duplicates
 * 
 * @example
 * const categories = getUniqueSelectValues(products.map(p => p.category));
 */
export function getUniqueSelectValues(
  values: (string | null | undefined)[]
): string[] {
  const validValues = filterSelectValues(values);
  return [...new Set(validValues)].sort();
}
