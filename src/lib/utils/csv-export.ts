/**
 * CSV Export Utility
 *
 * Generates CSV files from data arrays and triggers download in browser.
 */

import { formatCurrency } from './currency';
export { formatCurrency };

export interface CSVColumn<T> {
  header: string;
  accessor: keyof T | ((row: T) => string | number | null | undefined);
}

function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

export function generateCSV<T>(
  data: T[],
  columns: CSVColumn<T>[]
): string {
  const headers = columns.map(col => escapeCSVValue(col.header)).join(',');

  const rows = data.map(row => {
    return columns.map(col => {
      let value: unknown;
      if (typeof col.accessor === 'function') {
        value = col.accessor(row);
      } else {
        value = row[col.accessor];
      }
      return escapeCSVValue(value);
    }).join(',');
  });

  return [headers, ...rows].join('\n');
}

export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

export function exportToCSV<T>(
  data: T[],
  columns: CSVColumn<T>[],
  filename: string
): void {
  const csvContent = generateCSV(data, columns);
  downloadCSV(csvContent, filename);
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export const PRODUCT_EXPORT_COLUMNS = [
  { header: 'Product ID', accessor: 'id' as const },
  { header: 'Name', accessor: 'name' as const },
  { header: 'Category', accessor: 'category' as const },
  { header: 'Price', accessor: (row: Record<string, unknown>) => formatCurrency(row.price as number) },
  { header: 'Quantity', accessor: 'quantity' as const },
  { header: 'Status', accessor: 'status' as const },
  { header: 'SKU', accessor: 'sku' as const },
  { header: 'Created', accessor: (row: Record<string, unknown>) => formatDate(row.createdAt as string || row.created_at as string) },
];

export const ORDER_EXPORT_COLUMNS = [
  { header: 'Order ID', accessor: 'id' as const },
  { header: 'Date', accessor: (row: Record<string, unknown>) => formatDateTime(row.createdAt as string || row.created_at as string) },
  { header: 'Customer', accessor: (row: Record<string, unknown>) => row.buyerName as string || row.buyer_name as string || '' },
  { header: 'Status', accessor: 'status' as const },
  { header: 'Payment Status', accessor: (row: Record<string, unknown>) => row.paymentStatus as string || row.payment_status as string || '' },
  { header: 'Fulfillment', accessor: (row: Record<string, unknown>) => row.fulfillmentStatus as string || row.fulfillment_status as string || '' },
  { header: 'Items', accessor: (row: Record<string, unknown>) => {
    const items = row.items as unknown[];
    return items?.length || 0;
  }},
  { header: 'Subtotal', accessor: (row: Record<string, unknown>) => formatCurrency(row.subtotal as number) },
  { header: 'Shipping', accessor: (row: Record<string, unknown>) => formatCurrency((row.shippingFee || row.shipping_fee) as number) },
  { header: 'Discount', accessor: (row: Record<string, unknown>) => formatCurrency((row.discountTotal || row.discount_total) as number) },
  { header: 'Total', accessor: (row: Record<string, unknown>) => formatCurrency(row.total as number) },
];

export const PAYOUT_EXPORT_COLUMNS = [
  { header: 'Payout ID', accessor: 'id' as const },
  { header: 'Date', accessor: (row: Record<string, unknown>) => formatDateTime(row.createdAt as string || row.created_at as string) },
  { header: 'Vendor', accessor: (row: Record<string, unknown>) => row.vendorName as string || row.vendor_name as string || '' },
  { header: 'Amount', accessor: (row: Record<string, unknown>) => formatCurrency(row.amount as number) },
  { header: 'Status', accessor: 'status' as const },
  { header: 'Bank/Provider', accessor: (row: Record<string, unknown>) => row.bankName as string || row.bank_name as string || row.mobileMoneyProvider as string || '' },
  { header: 'Account', accessor: (row: Record<string, unknown>) => row.accountNumber as string || row.account_number as string || '' },
  { header: 'Processed At', accessor: (row: Record<string, unknown>) => formatDateTime(row.processedAt as string || row.processed_at as string) },
];
