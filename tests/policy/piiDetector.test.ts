/**
 * PII Detector Tests
 * Tests for Spanish PII detection and redaction functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PIIDetector } from '../../src/policy/piiDetector.js';
import { PIICategory } from '../../src/policy/types.js';

describe('PIIDetector', () => {
  let detector: PIIDetector;

  beforeEach(() => {
    detector = new PIIDetector();
  });

  describe('Spanish DNI Detection', () => {
    it('should detect valid DNI numbers', () => {
      const text = 'Mi DNI es 12345678Z y mi número de teléfono es 612345678';
      const results = detector.detectPII(text);
      
      const dniResults = results.filter(r => r.category === PIICategory.DNI);
      expect(dniResults).toHaveLength(1);
      expect(dniResults[0].match).toBe('12345678Z');
      expect(dniResults[0].confidence).toBeGreaterThan(0.8);
    });

    it('should not detect invalid DNI numbers', () => {
      const text = 'Número inválido: 12345678A'; // Invalid check digit
      const results = detector.detectPII(text);
      
      const dniResults = results.filter(r => r.category === PIICategory.DNI);
      expect(dniResults).toHaveLength(0);
    });

    it('should detect multiple DNI numbers', () => {
      const text = 'DNI 1: 12345678Z, DNI 2: 87654321X';
      const results = detector.detectPII(text);
      
      const dniResults = results.filter(r => r.category === PIICategory.DNI);
      expect(dniResults).toHaveLength(2);
    });
  });

  describe('Spanish NIE/TIE Detection', () => {
    it('should detect valid NIE numbers', () => {
      const text = 'Mi NIE es X1234567L';
      const results = detector.detectPII(text);
      
      const nieResults = results.filter(r => r.category === PIICategory.NIE_TIE);
      expect(nieResults).toHaveLength(1);
      expect(nieResults[0].match).toBe('X1234567L');
    });

    it('should detect Y and Z prefix NIE numbers', () => {
      const text = 'NIE Y: Y1234567L, NIE Z: Z1234567R';
      const results = detector.detectPII(text);
      
      const nieResults = results.filter(r => r.category === PIICategory.NIE_TIE);
      expect(nieResults.length).toBeGreaterThan(0);
    });
  });

  describe('Spanish Phone Number Detection', () => {
    it('should detect Spanish mobile numbers', () => {
      const text = 'Llámame al 612345678 o al +34 687654321';
      const results = detector.detectPII(text);
      
      const phoneResults = results.filter(r => r.category === PIICategory.PHONE);
      expect(phoneResults).toHaveLength(2);
    });

    it('should detect landline numbers', () => {
      const text = 'Teléfono fijo: 914567890';
      const results = detector.detectPII(text);
      
      const phoneResults = results.filter(r => r.category === PIICategory.PHONE);
      expect(phoneResults).toHaveLength(1);
    });
  });

  describe('Email Detection', () => {
    it('should detect email addresses', () => {
      const text = 'Contacto: usuario@ejemplo.es y admin@gestoria.com';
      const results = detector.detectPII(text);
      
      const emailResults = results.filter(r => r.category === PIICategory.EMAIL);
      expect(emailResults).toHaveLength(2);
    });
  });

  describe('Spanish IBAN Detection', () => {
    it('should detect valid Spanish IBAN', () => {
      const text = 'Mi cuenta: ES91 2100 0418 4502 0005 1332';
      const results = detector.detectPII(text);
      
      const ibanResults = results.filter(r => r.category === PIICategory.BANK_ACCOUNT);
      expect(ibanResults).toHaveLength(1);
    });

    it('should detect IBAN without spaces', () => {
      const text = 'IBAN: ES9121000418450200051332';
      const results = detector.detectPII(text);
      
      const ibanResults = results.filter(r => r.category === PIICategory.BANK_ACCOUNT);
      expect(ibanResults).toHaveLength(1);
    });
  });

  describe('PII Redaction', () => {
    it('should redact DNI preserving format', () => {
      const text = 'Mi DNI es 12345678Z';
      const result = detector.redactPII(text);
      
      expect(result.applied).toBe(true);
      expect(result.redactedText).toBe('Mi DNI es ********Z');
      expect(result.categories).toContain(PIICategory.DNI);
      expect(result.redactedCount).toBe(1);
    });

    it('should redact phone numbers preserving format', () => {
      const text = 'Teléfono: +34 612345678';
      const result = detector.redactPII(text);
      
      expect(result.applied).toBe(true);
      expect(result.redactedText).toBe('Teléfono: +34 6********');
      expect(result.categories).toContain(PIICategory.PHONE);
    });

    it('should redact email preserving domain', () => {
      const text = 'Email: usuario@ejemplo.es';
      const result = detector.redactPII(text);
      
      expect(result.applied).toBe(true);
      expect(result.redactedText).toBe('Email: u*****o@ejemplo.es');
      expect(result.categories).toContain(PIICategory.EMAIL);
    });

    it('should redact multiple PII types', () => {
      const text = 'DNI: 12345678Z, Teléfono: 612345678, Email: test@example.com';
      const result = detector.redactPII(text);
      
      expect(result.applied).toBe(true);
      expect(result.redactedCount).toBe(3);
      expect(result.categories).toHaveLength(3);
    });

    it('should return original text when no PII detected', () => {
      const text = 'Este texto no contiene información personal';
      const result = detector.redactPII(text);
      
      expect(result.applied).toBe(false);
      expect(result.redactedText).toBe(text);
      expect(result.redactedCount).toBe(0);
    });
  });

  describe('Redaction Validation', () => {
    it('should validate successful redaction', () => {
      const original = 'DNI: 12345678Z';
      const redacted = 'DNI: ********Z';
      
      const validation = detector.validateRedaction(original, redacted);
      expect(validation.valid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should detect failed redaction', () => {
      const original = 'DNI: 12345678Z';
      const redacted = 'DNI: 12345678Z'; // Not redacted
      
      const validation = detector.validateRedaction(original, redacted);
      expect(validation.valid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration', () => {
    it('should respect confidence threshold', () => {
      const lowConfidenceDetector = new PIIDetector({
        confidenceThreshold: 0.99, // Very high threshold
      });
      
      const text = 'Posible DNI: 12345678Z';
      const results = lowConfidenceDetector.detectPII(text);
      
      // Should detect fewer results with high threshold
      expect(results.length).toBeLessThanOrEqual(1);
    });

    it('should respect enabled categories', () => {
      const limitedDetector = new PIIDetector({
        enabledCategories: [PIICategory.DNI], // Only DNI
      });
      
      const text = 'DNI: 12345678Z, Teléfono: 612345678';
      const results = limitedDetector.detectPII(text);
      
      expect(results).toHaveLength(1);
      expect(results[0].category).toBe(PIICategory.DNI);
    });

    it('should use custom redaction character', () => {
      const customDetector = new PIIDetector({
        redactionChar: 'X',
      });
      
      const text = 'DNI: 12345678Z';
      const result = customDetector.redactPII(text);
      
      expect(result.redactedText).toBe('DNI: XXXXXXXXZ');
    });
  });
});