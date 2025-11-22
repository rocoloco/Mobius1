/**
 * PII Detection and Redaction System
 * Real-time detection and redaction of Spanish PII in documents and text
 */

import { PIICategory } from './types.js';
import type { 
  PIIDetectionResult, 
  PIIRedactionResult, 
  RedactionConfig 
} from './types.js';

/**
 * Default redaction configuration
 */
export const DEFAULT_REDACTION_CONFIG: RedactionConfig = {
  enabledCategories: [
    PIICategory.DNI,
    PIICategory.PASSPORT,
    PIICategory.NIE_TIE,
    PIICategory.PHONE,
    PIICategory.EMAIL,
    PIICategory.BANK_ACCOUNT,
    PIICategory.TAX_ID,
  ],
  redactionChar: '*',
  preserveFormat: true,
  auditRedactions: true,
  confidenceThreshold: 0.8,
};

/**
 * Spanish PII detection patterns
 */
const PII_PATTERNS = {
  [PIICategory.DNI]: {
    pattern: /\b\d{8}[A-Z]\b/g,
    validator: (match: string) => validateDNI(match),
    description: 'Spanish DNI (8 digits + letter)',
  },
  [PIICategory.NIE_TIE]: {
    pattern: /\b[XYZ]\d{7}[A-Z]\b/g,
    validator: (match: string) => validateNIE(match),
    description: 'Spanish NIE/TIE (X/Y/Z + 7 digits + letter)',
  },
  [PIICategory.PASSPORT]: {
    pattern: /\b[A-Z]{3}\d{6}\b/g,
    validator: (match: string) => validatePassport(match),
    description: 'Spanish passport (3 letters + 6 digits)',
  },
  [PIICategory.PHONE]: {
    pattern: /(?:\+34|0034)?\s*[6-9]\d{8}\b/g,
    validator: (match: string) => validateSpanishPhone(match),
    description: 'Spanish phone number',
  },
  [PIICategory.EMAIL]: {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    validator: () => true, // Basic email format is sufficient
    description: 'Email address',
  },
  [PIICategory.BANK_ACCOUNT]: {
    pattern: /\bES\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b/g,
    validator: (match: string) => validateIBAN(match),
    description: 'Spanish IBAN',
  },
  [PIICategory.TAX_ID]: {
    pattern: /\b[A-Z]\d{8}\b/g,
    validator: (match: string) => validateCIF(match),
    description: 'Spanish CIF/NIF',
  },
  [PIICategory.SOCIAL_SECURITY]: {
    pattern: /\b\d{2}\s?\d{10}\s?\d{2}\b/g,
    validator: (match: string) => validateSocialSecurity(match),
    description: 'Spanish Social Security Number',
  },
};

/**
 * PII detection result for a single match
 */
export interface PIIDetectionResult {
  category: PIICategory;
  match: string;
  startIndex: number;
  endIndex: number;
  confidence: number;
  context?: string;
}

/**
 * PII detector class
 */
export class PIIDetector {
  private config: RedactionConfig;

  constructor(config: Partial<RedactionConfig> = {}) {
    this.config = { ...DEFAULT_REDACTION_CONFIG, ...config };
  }

  /**
   * Detect PII in text
   */
  detectPII(text: string): PIIDetectionResult[] {
    const results: PIIDetectionResult[] = [];

    for (const category of this.config.enabledCategories) {
      const pattern = PII_PATTERNS[category];
      if (!pattern) continue;

      const matches = Array.from(text.matchAll(pattern.pattern));
      
      for (const match of matches) {
        if (match.index === undefined) continue;

        const matchText = match[0];
        const confidence = pattern.validator(matchText) ? 0.95 : 0.7;

        if (confidence >= this.config.confidenceThreshold) {
          results.push({
            category,
            match: matchText,
            startIndex: match.index,
            endIndex: match.index + matchText.length,
            confidence,
            context: this.extractContext(text, match.index, matchText.length),
          });
        }
      }
    }

    // Sort by start index for consistent processing
    return results.sort((a, b) => a.startIndex - b.startIndex);
  }

  /**
   * Redact PII in text
   */
  redactPII(text: string): PIIRedactionResult {
    const detectedPII = this.detectPII(text);
    
    if (detectedPII.length === 0) {
      return {
        applied: false,
        categories: [],
        redactedCount: 0,
        redactedText: text,
        confidence: 1.0,
      };
    }

    let redactedText = text;
    let offset = 0;
    const categories = new Set<PIICategory>();

    // Process matches in reverse order to maintain indices
    for (const detection of detectedPII.reverse()) {
      const redactedValue = this.generateRedaction(detection);
      
      redactedText = 
        redactedText.slice(0, detection.startIndex) +
        redactedValue +
        redactedText.slice(detection.endIndex);

      categories.add(detection.category);
    }

    const avgConfidence = detectedPII.reduce((sum, d) => sum + d.confidence, 0) / detectedPII.length;

    return {
      applied: true,
      categories: Array.from(categories),
      redactedCount: detectedPII.length,
      originalText: this.config.auditRedactions ? text : undefined,
      redactedText,
      confidence: avgConfidence,
    };
  }

  /**
   * Generate redacted value preserving format if configured
   */
  private generateRedaction(detection: PIIDetectionResult): string {
    if (!this.config.preserveFormat) {
      return `[${detection.category.toUpperCase()}_REDACTED]`;
    }

    const { match, category } = detection;

    switch (category) {
      case PIICategory.DNI:
        return match.replace(/\d/g, this.config.redactionChar);
      
      case PIICategory.NIE_TIE:
        return match.charAt(0) + match.slice(1, -1).replace(/\d/g, this.config.redactionChar) + match.slice(-1);
      
      case PIICategory.PASSPORT:
        return match.slice(0, 3) + match.slice(3).replace(/\d/g, this.config.redactionChar);
      
      case PIICategory.PHONE:
        // Keep country code and first digit, redact the rest
        const cleaned = match.replace(/\D/g, '');
        if (cleaned.startsWith('34')) {
          return '+34 ' + cleaned.charAt(2) + this.config.redactionChar.repeat(8);
        }
        return cleaned.charAt(0) + this.config.redactionChar.repeat(cleaned.length - 1);
      
      case PIICategory.EMAIL:
        const [local, domain] = match.split('@');
        const redactedLocal = local.charAt(0) + this.config.redactionChar.repeat(Math.max(1, local.length - 2)) + (local.length > 1 ? local.slice(-1) : '');
        return `${redactedLocal}@${domain}`;
      
      case PIICategory.BANK_ACCOUNT:
        // Keep ES and first 4 digits, redact the rest
        return match.replace(/(\d{4})\s?(\d{4})\s?(\d{4})\s?(\d{4})/, (_, g1, g2, g3, g4) => 
          g1 + ' ' + this.config.redactionChar.repeat(4) + ' ' + 
          this.config.redactionChar.repeat(4) + ' ' + this.config.redactionChar.repeat(4)
        );
      
      default:
        return this.config.redactionChar.repeat(match.length);
    }
  }

  /**
   * Extract context around PII match
   */
  private extractContext(text: string, startIndex: number, length: number, contextSize = 20): string {
    const start = Math.max(0, startIndex - contextSize);
    const end = Math.min(text.length, startIndex + length + contextSize);
    
    return text.slice(start, startIndex) + 
           '[PII]' + 
           text.slice(startIndex + length, end);
  }

  /**
   * Validate redaction quality
   */
  validateRedaction(originalText: string, redactedText: string): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    
    // Check if any PII patterns still exist in redacted text
    for (const category of this.config.enabledCategories) {
      const pattern = PII_PATTERNS[category];
      if (!pattern) continue;

      const matches = Array.from(redactedText.matchAll(pattern.pattern));
      for (const match of matches) {
        if (pattern.validator(match[0])) {
          issues.push(`Unredacted ${category} found: ${match[0]}`);
        }
      }
    }

    // Check for common redaction failures
    if (redactedText.includes('undefined') || redactedText.includes('null')) {
      issues.push('Redaction process introduced undefined/null values');
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Update redaction configuration
   */
  updateConfig(config: Partial<RedactionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): RedactionConfig {
    return { ...this.config };
  }

  /**
   * Get supported PII categories
   */
  getSupportedCategories(): PIICategory[] {
    return Object.keys(PII_PATTERNS) as PIICategory[];
  }
}

/**
 * DNI validation using check digit algorithm
 */
function validateDNI(dni: string): boolean {
  if (!/^\d{8}[A-Z]$/.test(dni)) return false;
  
  const letters = 'TRWAGMYFPDXBNJZSQVHLCKE';
  const number = parseInt(dni.slice(0, 8), 10);
  const letter = dni.charAt(8);
  
  return letters.charAt(number % 23) === letter;
}

/**
 * NIE validation using check digit algorithm
 */
function validateNIE(nie: string): boolean {
  if (!/^[XYZ]\d{7}[A-Z]$/.test(nie)) return false;
  
  const letters = 'TRWAGMYFPDXBNJZSQVHLCKE';
  const prefixMap: Record<string, string> = { X: '0', Y: '1', Z: '2' };
  
  const number = parseInt(prefixMap[nie.charAt(0)] + nie.slice(1, 8), 10);
  const letter = nie.charAt(8);
  
  return letters.charAt(number % 23) === letter;
}

/**
 * Spanish passport validation (basic format check)
 */
function validatePassport(passport: string): boolean {
  return /^[A-Z]{3}\d{6}$/.test(passport);
}

/**
 * Spanish phone number validation
 */
function validateSpanishPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  
  // Remove country code if present
  const number = cleaned.startsWith('34') ? cleaned.slice(2) : cleaned;
  
  // Spanish mobile numbers start with 6, 7, 8, or 9 and have 9 digits
  return /^[6-9]\d{8}$/.test(number);
}

/**
 * IBAN validation using mod-97 algorithm
 */
function validateIBAN(iban: string): boolean {
  const cleaned = iban.replace(/\s/g, '');
  if (!/^ES\d{22}$/.test(cleaned)) return false;
  
  // Move first 4 characters to end and convert letters to numbers
  const rearranged = cleaned.slice(4) + cleaned.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (char) => (char.charCodeAt(0) - 55).toString());
  
  // Calculate mod 97
  let remainder = '';
  for (let i = 0; i < numeric.length; i++) {
    remainder = ((remainder + numeric.charAt(i)) as any) % 97;
  }
  
  return remainder === 1;
}

/**
 * CIF validation (basic format check)
 */
function validateCIF(cif: string): boolean {
  return /^[A-Z]\d{8}$/.test(cif);
}

/**
 * Spanish Social Security Number validation (basic format check)
 */
function validateSocialSecurity(ssn: string): boolean {
  const cleaned = ssn.replace(/\s/g, '');
  return /^\d{12}$/.test(cleaned);
}

/**
 * Singleton PII detector instance
 */
export const piiDetector = new PIIDetector();