/**
 * HTML Sanitization Utility
 * 
 * Provides secure HTML sanitization to prevent XSS attacks
 * when rendering user-generated or admin-created HTML content.
 */

import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = [
  'p', 'br', 'span', 'div', 'a', 'b', 'i', 'u', 'strong', 'em',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'img', 'figure', 'figcaption',
  'hr', 'sup', 'sub', 'mark'
];

const ALLOWED_ATTR = [
  'href', 'target', 'rel', 'class', 'id', 'style',
  'src', 'alt', 'title', 'width', 'height',
  'colspan', 'rowspan', 'align', 'valign'
];

const ALLOWED_URI_REGEXP = /^(?:(?:https?|mailto|tel):)/i;

/**
 * Sanitize HTML content to prevent XSS attacks
 * Use this for any user-generated or admin HTML content before rendering
 */
export function sanitizeHTML(html: string | null | undefined): string {
  if (!html) return '';
  
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP,
    ADD_ATTR: ['target'],
    FORCE_BODY: true,
  });
}

/**
 * Sanitize HTML with stricter rules (for comments, reviews, etc.)
 * Only allows basic text formatting
 */
export function sanitizeBasicHTML(html: string | null | undefined): string {
  if (!html) return '';
  
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'u', 'strong', 'em', 'a', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOWED_URI_REGEXP,
  });
}

/**
 * Strip all HTML tags, returning plain text only
 * Use for previews, excerpts, meta descriptions
 */
export function stripHTML(html: string | null | undefined): string {
  if (!html) return '';
  
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
}

/**
 * Sanitize email template HTML
 * Allows more tags/attributes for rich email content
 */
export function sanitizeEmailHTML(html: string | null | undefined): string {
  if (!html) return '';
  
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      ...ALLOWED_TAGS,
      'html', 'head', 'body', 'style', 'meta', 'title',
      'center', 'font', 'section', 'article', 'header', 'footer', 'main', 'nav',
      'button'
    ],
    ALLOWED_ATTR: [
      ...ALLOWED_ATTR,
      'bgcolor', 'cellpadding', 'cellspacing', 'border',
      'face', 'size', 'color', 'background',
      'data-*', 'aria-*', 'role'
    ],
    WHOLE_DOCUMENT: true,
    ADD_ATTR: ['target'],
    ALLOWED_URI_REGEXP,
  });
}
