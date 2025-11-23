/**
 * Tests for PII Redaction
 */

import { describe, it, expect } from 'vitest';
import {
  redactPII,
  redactPIIFromObject,
  containsPII,
  detectPIICategories,
} from '../../src/observability/pii-redactor.js';

describe('PII Redactor', () => {
  describe('redactPII', () => {
    it('should redact Spanish DNI numbers', () => {
      const text = 'My DNI is 12345678A and my friend has 87654321B';
      const redacted = redactPII(text);
      
      expect(redacted).toBe('My DNI is [DNI_REDACTED] and my friend has [DNI_REDACTED]');
      expect(redacted).not.toContain('12345678A');
      expect(redacted).not.toContain('87654321B');
    });

    it('should redact Spanish NIE numbers', () => {
      const text = 'NIE: X1234567A, Y7654321B, Z9876543C';
      const redacted = redactPII(text);
      
      expect(redacted).toBe('NIE: [DNI_REDACTED], [DNI_REDACTED], [DNI_REDACTED]');
    });

    it('should redact Spanish passport numbers', () => {
      const text = 'Passport AAA123456 for travel';
      const redacted = redactPII(text);
      
      expect(redacted).toBe('Passport [PASSPORT_REDACTED] for travel');
    });

    it('should redact phone numbers', () => {
      const text = 'Call me at +34 612 345 678 or 699123456';
      const redacted = redactPII(text);
      
      expect(redacted).toContain('[PHONE_REDACTED]');
      expect(redacted).not.toContain('612 345 678');
    });

    it('should redact email addresses', () => {
      const text = 'Contact: user@example.com or admin@domain.es';
      const redacted = redactPII(text);
      
      expect(redacted).toBe('Contact: [EMAIL_REDACTED] or [EMAIL_REDACTED]');
    });

    it('should redact IBAN numbers', () => {
      const text = 'IBAN: ES91 2100 0418 4502 0005 1332';
      const redacted = redactPII(text);
      
      expect(redacted).toContain('[IBAN_REDACTED]');
    });

    it('should redact credit card numbers', () => {
      const text = 'Card: 4532-1234-5678-9010';
      const redacted = redactPII(text);
      
      expect(redacted).toContain('[CARD_REDACTED]');
    });

    it('should redact IP addresses', () => {
      const text = 'Request from 192.168.1.100';
      const redacted = redactPII(text);
      
      expect(redacted).toBe('Request from [IP_REDACTED]');
    });

    it('should handle text without PII', () => {
      const text = 'This is a normal message without sensitive data';
      const redacted = redactPII(text);
      
      expect(redacted).toBe(text);
    });

    it('should handle empty strings', () => {
      expect(redactPII('')).toBe('');
    });

    it('should handle multiple PII types in one string', () => {
      const text = 'DNI: 12345678A, Email: test@example.com, Phone: +34 612345678';
      const redacted = redactPII(text);
      
      expect(redacted).toContain('[DNI_REDACTED]');
      expect(redacted).toContain('[EMAIL_REDACTED]');
      expect(redacted).toContain('[PHONE_REDACTED]');
    });
  });

  describe('redactPIIFromObject', () => {
    it('should redact PII from object properties', () => {
      const obj = {
        name: 'John Doe',
        dni: '12345678A',
        email: 'john@example.com',
        phone: '+34 612345678',
      };

      const redacted = redactPIIFromObject(obj);

      expect(redacted.name).toBe('John Doe');
      expect(redacted.dni).toBe('[DNI_REDACTED]');
      expect(redacted.email).toBe('[EMAIL_REDACTED]');
      expect(redacted.phone).toContain('[PHONE_REDACTED]');
    });

    it('should handle nested objects', () => {
      const obj = {
        user: {
          name: 'Jane',
          contact: {
            email: 'jane@example.com',
            dni: '87654321B',
          },
        },
      };

      const redacted = redactPIIFromObject(obj);

      expect(redacted.user.name).toBe('Jane');
      expect(redacted.user.contact.email).toBe('[EMAIL_REDACTED]');
      expect(redacted.user.contact.dni).toBe('[DNI_REDACTED]');
    });

    it('should handle arrays', () => {
      const obj = {
        users: [
          { dni: '12345678A' },
          { dni: '87654321B' },
        ],
      };

      const redacted = redactPIIFromObject(obj);

      expect(redacted.users[0].dni).toBe('[DNI_REDACTED]');
      expect(redacted.users[1].dni).toBe('[DNI_REDACTED]');
    });

    it('should handle null and undefined values', () => {
      const obj = {
        value1: null,
        value2: undefined,
        value3: 'test',
      };

      const redacted = redactPIIFromObject(obj);

      expect(redacted.value1).toBeNull();
      expect(redacted.value2).toBeUndefined();
      expect(redacted.value3).toBe('test');
    });
  });

  describe('containsPII', () => {
    it('should detect PII in text', () => {
      expect(containsPII('DNI: 12345678A')).toBe(true);
      expect(containsPII('Email: test@example.com')).toBe(true);
      expect(containsPII('Phone: +34 612345678')).toBe(true);
    });

    it('should return false for text without PII', () => {
      expect(containsPII('This is a normal message')).toBe(false);
      expect(containsPII('No sensitive data here')).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(containsPII('')).toBe(false);
    });
  });

  describe('detectPIICategories', () => {
    it('should detect DNI category', () => {
      const categories = detectPIICategories('DNI: 12345678A');
      expect(categories).toContain('dni');
    });

    it('should detect email category', () => {
      const categories = detectPIICategories('Email: test@example.com');
      expect(categories).toContain('email');
    });

    it('should detect multiple categories', () => {
      const categories = detectPIICategories('DNI: 12345678A, Email: test@example.com');
      expect(categories).toContain('dni');
      expect(categories).toContain('email');
    });

    it('should return empty array for text without PII', () => {
      const categories = detectPIICategories('Normal text');
      expect(categories).toEqual([]);
    });
  });
});
