/**
 * PII Redaction for Observability
 * 
 * Redacts sensitive information from traces, logs, and metrics before export.
 * Ensures compliance with FR-004 and NFR-004 privacy requirements.
 */

/**
 * PII patterns for Spanish documents
 */
const PII_PATTERNS = {
  // Spanish DNI/NIE format: 12345678A or X1234567A
  dni: /\b[XYZ]?\d{7,8}[A-Z]\b/gi,
  
  // Spanish passport: AAA123456
  passport: /\b[A-Z]{3}\d{6}\b/gi,
  
  // Spanish phone numbers: +34 XXX XXX XXX or 6XX XXX XXX
  phone: /(\+34|0034)?\s*[6-9]\d{2}\s*\d{3}\s*\d{3}\b/gi,
  
  // Email addresses
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
  
  // Spanish postal codes: 28001
  postalCode: /\b\d{5}\b/g,
  
  // Credit card numbers (basic pattern)
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  
  // IBAN
  iban: /\b[A-Z]{2}\d{2}[\s]?[\dA-Z]{4}[\s]?[\dA-Z]{4}[\s]?[\dA-Z]{4}[\s]?[\dA-Z]{4}[\s]?[\dA-Z]{0,2}\b/gi,
  
  // IP addresses (for privacy)
  ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
};

/**
 * Redaction replacements
 */
const REDACTION_REPLACEMENTS: Record<keyof typeof PII_PATTERNS, string> = {
  dni: '[DNI_REDACTED]',
  passport: '[PASSPORT_REDACTED]',
  phone: '[PHONE_REDACTED]',
  email: '[EMAIL_REDACTED]',
  postalCode: '[POSTAL_REDACTED]',
  creditCard: '[CARD_REDACTED]',
  iban: '[IBAN_REDACTED]',
  ipAddress: '[IP_REDACTED]',
};

/**
 * Redact PII from a string
 */
export function redactPII(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  let redacted = text;

  // Apply all PII patterns
  for (const [key, pattern] of Object.entries(PII_PATTERNS)) {
    const replacement = REDACTION_REPLACEMENTS[key as keyof typeof PII_PATTERNS];
    redacted = redacted.replace(pattern, replacement);
  }

  return redacted;
}

/**
 * Redact PII from an object (recursive)
 */
export function redactPIIFromObject<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const redacted: any = Array.isArray(obj) ? [] : {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      redacted[key] = value;
    } else if (typeof value === 'string') {
      redacted[key] = redactPII(value);
    } else if (typeof value === 'object') {
      redacted[key] = redactPIIFromObject(value);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

/**
 * Check if text contains PII
 */
export function containsPII(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }

  return Object.values(PII_PATTERNS).some((pattern) => pattern.test(text));
}

/**
 * Get PII categories found in text
 */
export function detectPIICategories(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const categories: string[] = [];

  for (const [key, pattern] of Object.entries(PII_PATTERNS)) {
    if (pattern.test(text)) {
      categories.push(key);
    }
  }

  return categories;
}
