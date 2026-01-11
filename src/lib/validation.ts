/**
 * Centralized Validation Module
 * 
 * Server-side validation utilities for:
 * - Phone number validation (Ghana/E.164 format)
 * - Content safety (profanity, contact info, URLs)
 * - Address validation
 * 
 * All validation returns structured error responses.
 */

export interface ValidationResult {
  valid: boolean;
  code?: string;
  message?: string;
}

// Ghana phone number prefixes for mobile operators
const GHANA_MOBILE_PREFIXES = [
  '020', '023', '024', '025', '026', '027', '028', '029', // MTN
  '050', '054', '055', '059', // MTN
  '030', '031', '032', '033', '034', '035', '036', '037', '038', '039', // Landlines
];

/**
 * Validate phone number in Ghana format or E.164
 * Ghana format: 0XX XXX XXXX (10 digits starting with 0)
 * E.164: +233 XX XXX XXXX
 */
export function validatePhone(phone: string | null | undefined): ValidationResult {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, code: 'INVALID_PHONE', message: 'Phone number is required' };
  }

  // Normalize: remove spaces, dashes, parentheses
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');

  // Check for invalid characters (only digits and optional leading +)
  if (!/^\+?\d+$/.test(cleaned)) {
    return { valid: false, code: 'INVALID_PHONE', message: 'Phone number can only contain digits' };
  }

  // E.164 format for Ghana: +233XXXXXXXXX (12 digits)
  if (cleaned.startsWith('+233')) {
    if (cleaned.length !== 13) {
      return { valid: false, code: 'INVALID_PHONE', message: 'Please enter a valid Ghana phone number (+233XXXXXXXXX)' };
    }
    return { valid: true };
  }

  // Reject non-Ghana international numbers (Ghana-only marketplace)
  if (cleaned.startsWith('+') && !cleaned.startsWith('+233')) {
    return { valid: false, code: 'INVALID_PHONE', message: 'Only Ghana phone numbers are accepted (+233 or 0XX format)' };
  }

  // Ghana local format: 0XXXXXXXXX (10 digits)
  if (cleaned.startsWith('0')) {
    if (cleaned.length !== 10) {
      return { valid: false, code: 'INVALID_PHONE', message: 'Please enter a valid 10-digit phone number' };
    }
    // Check if prefix is valid
    const prefix = cleaned.substring(0, 3);
    if (!GHANA_MOBILE_PREFIXES.includes(prefix)) {
      return { valid: false, code: 'INVALID_PHONE', message: 'Please enter a valid Ghana phone number' };
    }
    return { valid: true };
  }

  // Ghana without leading 0 (9 digits)
  if (cleaned.length === 9) {
    const withZero = '0' + cleaned;
    const prefix = withZero.substring(0, 3);
    if (GHANA_MOBILE_PREFIXES.includes(prefix)) {
      return { valid: true };
    }
  }

  return { valid: false, code: 'INVALID_PHONE', message: 'Please enter a valid phone number' };
}

/**
 * Normalize phone number to consistent format for storage
 * Converts to +233 format for Ghana numbers
 */
export function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  
  // Already E.164
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  
  // Ghana local format with leading 0
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return '+233' + cleaned.substring(1);
  }
  
  // Ghana without leading 0
  if (cleaned.length === 9) {
    return '+233' + cleaned;
  }
  
  return cleaned;
}

// Profanity word list - common offensive terms
const PROFANITY_PATTERNS = [
  /\bf+u+c+k+/i,
  /\bs+h+i+t+/i,
  /\bb+i+t+c+h+/i,
  /\ba+s+s+h+o+l+e+/i,
  /\bd+a+m+n+/i,
  /\bc+u+n+t+/i,
  /\bd+i+c+k+/i,
  /\bp+u+s+s+y+/i,
  /\bc+o+c+k+/i,
  /\bn+i+g+g+/i,
  /\bf+a+g+/i,
  /\bw+h+o+r+e+/i,
  /\bs+l+u+t+/i,
  /\bb+a+s+t+a+r+d+/i,
  /\bp+o+r+n+/i,
  /\bs+e+x+y+/i,
  /\bn+u+d+e+/i,
  /\bx+x+x+/i,
];

// Contact info patterns
const CONTACT_PATTERNS = {
  // Email pattern
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
  // Phone number patterns (various formats)
  phoneWithPlus: /\+\d{10,15}/,
  phoneWithSpaces: /\d{3}[\s\-]?\d{3}[\s\-]?\d{4}/,
  phoneGhana: /(?:0|\+233)\s*\d{2}\s*\d{3}\s*\d{4}/,
  // URL patterns
  url: /(?:https?:\/\/|www\.)[^\s]+/i,
  // Social media handles - use word boundaries to avoid false positives like "Midnight" matching "ig"
  // The shorthand patterns (ig, fb) require whitespace, punctuation, or @ after the keyword to distinguish from words
  whatsapp: /\bwhatsapp\s*[:\-]?\s*[\d\+]+|wa\.me\/\d+/i,
  telegram: /\btelegram\s*[:\-]?\s*@?\w+|t\.me\/\w+/i,
  instagram: /\binstagram\s*[:\-]?\s*@?\w+|\big(?:\s+|[:\-]|@)\s*@?\w+/i,  // "ig handle", "ig: handle", "ig@handle" but not "midnight"
  facebook: /\bfacebook\s*[:\-]?\s*@?\w+|\bfb(?:\s+|[:\-]|@)\s*@?\w+/i,   // "fb handle", "fb: handle", "fb@page" but not words ending in fb
  twitter: /\btwitter\s*[:\-]?\s*@?\w+|(?:^|[^\w])@\w{3,}/i,  // @handle at word boundary (min 3 chars to avoid false positives)
};

// Hate speech patterns
const HATE_SPEECH_PATTERNS = [
  /\bkill\s+(?:you|them|all)/i,
  /\bdie\b/i,
  /\bhate\s+(?:you|them|all)/i,
  /\bterrorist/i,
];

export interface ContentSafetyResult extends ValidationResult {
  blockedType?: 'profanity' | 'contact_info' | 'url' | 'hate_speech' | 'social_handle';
}

/**
 * Normalize text for content safety checks
 * - Lowercase
 * - Remove accents/diacritics
 * - Collapse repeated characters
 * - Remove common obfuscation (l33t speak, spacing)
 */
function normalizeForSafety(text: string): string {
  return text
    .toLowerCase()
    // Remove accents
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Collapse repeated chars (e.g., "fuuuuck" -> "fuck")
    .replace(/(.)\1{2,}/g, '$1$1')
    // Common l33t speak substitutions
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's')
    // Remove spaces between letters (e.g., "f u c k" -> "fuck")
    .replace(/(\w)\s+(?=\w)/g, '$1');
}

/**
 * Check content for prohibited material
 * - Profanity
 * - Contact information (phones, emails)
 * - URLs
 * - Social media handles
 * - Hate speech
 */
export function validateContentSafety(content: string | null | undefined): ContentSafetyResult {
  if (!content || typeof content !== 'string') {
    return { valid: true };
  }

  // Normalize for safety checks
  const text = normalizeForSafety(content);

  // Check for profanity
  for (const pattern of PROFANITY_PATTERNS) {
    if (pattern.test(text)) {
      return {
        valid: false,
        code: 'UNSAFE_CONTENT',
        message: 'This field contains prohibited or unsafe content',
        blockedType: 'profanity',
      };
    }
  }

  // Check for hate speech
  for (const pattern of HATE_SPEECH_PATTERNS) {
    if (pattern.test(text)) {
      return {
        valid: false,
        code: 'UNSAFE_CONTENT',
        message: 'This field contains prohibited or unsafe content',
        blockedType: 'hate_speech',
      };
    }
  }

  // Check for contact info
  if (CONTACT_PATTERNS.email.test(content)) {
    return {
      valid: false,
      code: 'UNSAFE_CONTENT',
      message: 'Contact information (email addresses) is not allowed in this field',
      blockedType: 'contact_info',
    };
  }

  // Check for phone numbers in text (not for phone fields)
  if (CONTACT_PATTERNS.phoneGhana.test(content) || 
      CONTACT_PATTERNS.phoneWithPlus.test(content) ||
      CONTACT_PATTERNS.phoneWithSpaces.test(content)) {
    return {
      valid: false,
      code: 'UNSAFE_CONTENT',
      message: 'Contact information (phone numbers) is not allowed in this field',
      blockedType: 'contact_info',
    };
  }

  // Check for URLs
  if (CONTACT_PATTERNS.url.test(content)) {
    return {
      valid: false,
      code: 'UNSAFE_CONTENT',
      message: 'URLs and links are not allowed in this field',
      blockedType: 'url',
    };
  }

  // Check for social media handles
  if (CONTACT_PATTERNS.whatsapp.test(content) ||
      CONTACT_PATTERNS.telegram.test(content) ||
      CONTACT_PATTERNS.instagram.test(content) ||
      CONTACT_PATTERNS.facebook.test(content) ||
      CONTACT_PATTERNS.twitter.test(content)) {
    return {
      valid: false,
      code: 'UNSAFE_CONTENT',
      message: 'Social media handles are not allowed in this field',
      blockedType: 'social_handle',
    };
  }

  return { valid: true };
}

// Garbage input patterns - enhanced detection
const GARBAGE_PATTERNS = [
  /^(.)\1{4,}/, // Same character repeated 5+ times at start
  /(.)\1{5,}/, // Same character repeated 6+ times anywhere
  /^[a-z]{10,}$/i, // Just random letters 10+ chars with no spaces
  /^\d{8,}$/, // Just numbers 8+ digits
  /^\d[\d\s\-\.]+\d$/, // Numbers with separators only (like "1-2-3-4-5")
  /^[^a-zA-Z0-9]+$/, // Only symbols/punctuation
  /^[^a-zA-Z]*$/, // No letters at all (just numbers/symbols)
  /^asdf/i, // Common keyboard mashing
  /^qwer/i,
  /^zxcv/i,
  /^hjkl/i,
  /^test+$/i,
  /^xxx+$/i,
  /^abc+$/i,
  /^n\/a$/i,
  /^na$/i,
  /^none$/i,
  /^\?+$/, // Just question marks
  /^\.+$/, // Just dots
  /^[!@#$%^&*()_+=]+$/, // Just special chars
];

/**
 * Validate address field
 * - Required fields must not be empty
 * - Reject garbage input
 * - Minimum length check
 */
export function validateAddress(address: string | null | undefined, fieldName: string = 'Address'): ValidationResult {
  if (!address || typeof address !== 'string') {
    return { valid: false, code: 'INVALID_ADDRESS', message: `${fieldName} is required` };
  }

  // Normalize whitespace
  const cleaned = address.trim().replace(/\s+/g, ' ');

  if (!cleaned) {
    return { valid: false, code: 'INVALID_ADDRESS', message: `${fieldName} is required` };
  }

  // Minimum length (reasonable address should be at least 5 characters)
  if (cleaned.length < 5) {
    return { valid: false, code: 'INVALID_ADDRESS', message: `${fieldName} is too short` };
  }

  // Check for garbage input
  for (const pattern of GARBAGE_PATTERNS) {
    if (pattern.test(cleaned.replace(/\s/g, ''))) {
      return { valid: false, code: 'INVALID_ADDRESS', message: `Please enter a valid ${fieldName.toLowerCase()}` };
    }
  }

  return { valid: true };
}

/**
 * Validate city name
 */
export function validateCity(city: string | null | undefined): ValidationResult {
  if (!city || typeof city !== 'string') {
    return { valid: false, code: 'INVALID_CITY', message: 'City is required' };
  }

  const cleaned = city.trim();
  
  if (!cleaned) {
    return { valid: false, code: 'INVALID_CITY', message: 'City is required' };
  }

  if (cleaned.length < 2) {
    return { valid: false, code: 'INVALID_CITY', message: 'City name is too short' };
  }

  // Check for garbage input
  for (const pattern of GARBAGE_PATTERNS) {
    if (pattern.test(cleaned)) {
      return { valid: false, code: 'INVALID_CITY', message: 'Please enter a valid city name' };
    }
  }

  return { valid: true };
}

/**
 * Validate region/state
 */
export function validateRegion(region: string | null | undefined): ValidationResult {
  if (!region || typeof region !== 'string') {
    return { valid: false, code: 'INVALID_REGION', message: 'Region is required' };
  }

  const cleaned = region.trim();
  
  if (!cleaned) {
    return { valid: false, code: 'INVALID_REGION', message: 'Region is required' };
  }

  return { valid: true };
}

/**
 * Normalize address for storage
 * - Trim whitespace
 * - Normalize multiple spaces
 */
export function normalizeAddress(address: string): string {
  return address.trim().replace(/\s+/g, ' ');
}

/**
 * Combined validation for product/promo text fields
 * Checks both required status and content safety
 */
export function validateTextField(
  value: string | null | undefined,
  fieldName: string,
  options: { required?: boolean; minLength?: number; maxLength?: number } = {}
): ValidationResult {
  const { required = false, minLength = 0, maxLength = 10000 } = options;

  if (!value || typeof value !== 'string') {
    if (required) {
      return { valid: false, code: 'REQUIRED_FIELD', message: `${fieldName} is required` };
    }
    return { valid: true };
  }

  const cleaned = value.trim();

  if (required && !cleaned) {
    return { valid: false, code: 'REQUIRED_FIELD', message: `${fieldName} is required` };
  }

  if (cleaned.length < minLength) {
    return { valid: false, code: 'TOO_SHORT', message: `${fieldName} must be at least ${minLength} characters` };
  }

  if (cleaned.length > maxLength) {
    return { valid: false, code: 'TOO_LONG', message: `${fieldName} must be less than ${maxLength} characters` };
  }

  // Check content safety
  const safetyResult = validateContentSafety(cleaned);
  if (!safetyResult.valid) {
    return safetyResult;
  }

  return { valid: true };
}

/**
 * Validate email format and detect garbage/spam-like emails
 * - RFC-compliant email check
 * - Reject excessively long local parts
 * - Reject high-entropy random characters
 * - Reject auto-generated looking emails
 */
export function validateEmail(email: string | null | undefined): ValidationResult {
  if (!email || typeof email !== 'string') {
    return { valid: false, code: 'INVALID_EMAIL', message: 'Email is required' };
  }

  const trimmed = email.trim().toLowerCase();
  
  // Basic RFC email check
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, code: 'INVALID_EMAIL', message: 'Please enter a valid email address' };
  }

  const [localPart] = trimmed.split('@');
  
  // Reject excessively long local parts (spam indicator)
  if (localPart.length > 30) {
    return { valid: false, code: 'INVALID_EMAIL', message: 'Please enter a valid, human-readable email address' };
  }

  // Check for high-entropy garbage (mostly consonants, no vowels, random patterns)
  const vowelCount = (localPart.match(/[aeiou]/gi) || []).length;
  const consonantCount = (localPart.match(/[bcdfghjklmnpqrstvwxyz]/gi) || []).length;
  
  // If very long and mostly consonants with few vowels, likely garbage
  if (localPart.length > 15 && consonantCount > 0) {
    const vowelRatio = vowelCount / consonantCount;
    if (vowelRatio < 0.15) {
      return { valid: false, code: 'INVALID_EMAIL', message: 'Please enter a valid, human-readable email address' };
    }
  }

  // Check for repeated character patterns (like "aaaaa" or "xyzxyz")
  if (/(.)\1{4,}/.test(localPart)) {
    return { valid: false, code: 'INVALID_EMAIL', message: 'Please enter a valid, human-readable email address' };
  }

  // Check for keyboard mashing patterns
  const keyboardPatterns = ['qwer', 'asdf', 'zxcv', 'hjkl', 'yuio'];
  for (const pattern of keyboardPatterns) {
    if (localPart.includes(pattern)) {
      return { valid: false, code: 'INVALID_EMAIL', message: 'Please enter a valid, human-readable email address' };
    }
  }

  return { valid: true };
}

/**
 * Validate person name (first name, last name)
 * - Min/max length
 * - Content safety
 * - Garbage detection
 */
export function validateName(name: string | null | undefined, fieldName: string = 'Name'): ValidationResult {
  if (!name || typeof name !== 'string') {
    return { valid: false, code: 'INVALID_NAME', message: `${fieldName} is required` };
  }

  const trimmed = name.trim();
  
  if (!trimmed) {
    return { valid: false, code: 'INVALID_NAME', message: `${fieldName} is required` };
  }

  if (trimmed.length < 2) {
    return { valid: false, code: 'INVALID_NAME', message: `${fieldName} is too short` };
  }

  if (trimmed.length > 50) {
    return { valid: false, code: 'INVALID_NAME', message: `${fieldName} is too long` };
  }

  // Check for garbage patterns
  for (const pattern of GARBAGE_PATTERNS) {
    if (pattern.test(trimmed.replace(/\s/g, ''))) {
      return { valid: false, code: 'INVALID_NAME', message: `Please enter a valid ${fieldName.toLowerCase()}` };
    }
  }

  // Content safety check
  const safetyResult = validateContentSafety(trimmed);
  if (!safetyResult.valid) {
    return { 
      valid: false, 
      code: 'UNSAFE_CONTENT', 
      message: `${fieldName} contains prohibited or unsafe content` 
    };
  }

  return { valid: true };
}

/**
 * Validate product name - RELAXED validation for marketplace products
 * 
 * VALID product names:
 * - 2-120 characters
 * - Letters, numbers, spaces, and common symbols: - & / ( ) . ' "
 * - Brand names like "Mercedes Benz", "iPhone 14 Pro", etc.
 * 
 * INVALID only if:
 * - Contains profanity
 * - Contains contact info (email, phone, URL, social handles)
 * - Is pure garbage (single repeated character 8+ times, keyboard mashing at START)
 */
export function validateProductName(name: string | null | undefined): ValidationResult {
  if (!name || typeof name !== 'string') {
    return { valid: false, code: 'REQUIRED_FIELD', message: 'Product name is required' };
  }

  const trimmed = name.trim();
  
  if (!trimmed) {
    return { valid: false, code: 'REQUIRED_FIELD', message: 'Product name is required' };
  }

  // Length check: 2-120 characters
  if (trimmed.length < 2) {
    return { valid: false, code: 'INVALID_NAME', message: 'Product name must be at least 2 characters' };
  }

  if (trimmed.length > 120) {
    return { valid: false, code: 'INVALID_NAME', message: 'Product name must be 120 characters or less' };
  }

  // Content safety check (profanity, contact info, URLs, social handles)
  // This is important and should be kept
  const safetyResult = validateContentSafety(trimmed);
  if (!safetyResult.valid) {
    return { 
      valid: false, 
      code: 'UNSAFE_CONTENT', 
      message: 'Product name contains prohibited or unsafe content' 
    };
  }

  // MINIMAL garbage detection - only catch obvious garbage, not brand names
  // Only reject: single character repeated 8+ times at start
  if (/^(.)\1{7,}/.test(trimmed)) {
    return { valid: false, code: 'INVALID_NAME', message: 'Please enter a valid product name' };
  }

  // Only reject keyboard mashing if the ENTIRE name is keyboard mash (not just starts with)
  const keyboardPatterns = [
    /^asdf+$/i,
    /^qwer+$/i,
    /^zxcv+$/i,
    /^hjkl+$/i,
  ];
  for (const pattern of keyboardPatterns) {
    if (pattern.test(trimmed.replace(/\s/g, ''))) {
      return { valid: false, code: 'INVALID_NAME', message: 'Please enter a valid product name' };
    }
  }

  return { valid: true };
}

/**
 * Validate business/store name - RELAXED validation matching product names
 * Allows normal multi-word business names like "Theory Business", "Mercedes Benz Ghana"
 * Only rejects: profanity, contact info, URLs, obvious garbage (keyboard mash, repeated chars)
 */
export function validateBusinessName(name: string | null | undefined, fieldName: string = 'Business name'): ValidationResult {
  if (!name || typeof name !== 'string') {
    return { valid: false, code: 'INVALID_BUSINESS_NAME', message: `${fieldName} is required` };
  }

  const trimmed = name.trim();
  
  if (!trimmed) {
    return { valid: false, code: 'INVALID_BUSINESS_NAME', message: `${fieldName} is required` };
  }

  if (trimmed.length < 2) {
    return { valid: false, code: 'INVALID_BUSINESS_NAME', message: `${fieldName} is too short` };
  }

  if (trimmed.length > 120) {
    return { valid: false, code: 'INVALID_BUSINESS_NAME', message: `${fieldName} is too long` };
  }

  // Content safety check (profanity, contact info, URLs, social handles)
  const safetyResult = validateContentSafety(trimmed);
  if (!safetyResult.valid) {
    return { 
      valid: false, 
      code: 'UNSAFE_CONTENT', 
      message: `${fieldName} contains prohibited or unsafe content` 
    };
  }

  // MINIMAL garbage detection - only catch obvious garbage, not normal business names
  // Only reject: single character repeated 8+ times at start
  if (/^(.)\1{7,}/.test(trimmed)) {
    return { valid: false, code: 'INVALID_BUSINESS_NAME', message: `Please enter a valid ${fieldName.toLowerCase()}` };
  }

  // Only reject keyboard mashing if the ENTIRE name is keyboard mash (not just starts with)
  const keyboardPatterns = [
    /^asdf+$/i,
    /^qwer+$/i,
    /^zxcv+$/i,
    /^hjkl+$/i,
  ];
  for (const pattern of keyboardPatterns) {
    if (pattern.test(trimmed.replace(/\s/g, ''))) {
      return { valid: false, code: 'INVALID_BUSINESS_NAME', message: `Please enter a valid ${fieldName.toLowerCase()}` };
    }
  }

  return { valid: true };
}

/**
 * Validate multiple fields at once
 * Returns first error found or success
 */
export function validateFields(validations: ValidationResult[]): ValidationResult {
  for (const result of validations) {
    if (!result.valid) {
      return result;
    }
  }
  return { valid: true };
}

/**
 * Collect all validation errors (for multi-field forms)
 */
export function collectValidationErrors(validations: { field: string; result: ValidationResult }[]): {
  valid: boolean;
  errors: { field: string; code: string; message: string }[];
} {
  const errors: { field: string; code: string; message: string }[] = [];
  
  for (const { field, result } of validations) {
    if (!result.valid && result.code && result.message) {
      errors.push({ field, code: result.code, message: result.message });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
