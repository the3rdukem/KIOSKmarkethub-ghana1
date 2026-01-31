/**
 * Currency Formatting Utility
 *
 * Provides consistent currency formatting across the entire application.
 * Default currency is GHS (Ghanaian Cedi).
 */

export type SupportedCurrency = 'GHS' | 'USD';

export interface FormatCurrencyOptions {
  currency?: SupportedCurrency;
  showSymbol?: boolean;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

const CURRENCY_SYMBOLS: Record<SupportedCurrency, string> = {
  GHS: 'GHS',
  USD: '$',
};

const DEFAULT_OPTIONS: Required<FormatCurrencyOptions> = {
  currency: 'GHS',
  showSymbol: true,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
};

export function formatCurrency(
  amount: number | null | undefined,
  options: FormatCurrencyOptions = {}
): string {
  if (amount === null || amount === undefined) {
    return '';
  }

  const opts = { ...DEFAULT_OPTIONS, ...options };

  const formattedNumber = amount.toLocaleString('en-GB', {
    minimumFractionDigits: opts.minimumFractionDigits,
    maximumFractionDigits: opts.maximumFractionDigits,
  });

  if (!opts.showSymbol) {
    return formattedNumber;
  }

  const symbol = CURRENCY_SYMBOLS[opts.currency];
  return `${symbol} ${formattedNumber}`;
}

export function formatPrice(price: number | null | undefined): string {
  return formatCurrency(price);
}

export function formatPriceCompact(price: number | null | undefined): string {
  if (price === null || price === undefined) {
    return '';
  }

  if (price >= 1000000) {
    return `GHS ${(price / 1000000).toFixed(1)}M`;
  }

  if (price >= 1000) {
    return `GHS ${(price / 1000).toFixed(1)}K`;
  }

  return formatCurrency(price);
}

export function parseCurrencyInput(input: string): number | null {
  const cleaned = input.replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}
