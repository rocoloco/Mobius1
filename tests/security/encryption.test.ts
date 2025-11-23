/**
 * Encryption Service Tests
 * Tests AES-256-GCM encryption with workspace isolation
 */

import { describe, it, expect } from 'vitest';
import {
  encrypt,
  decrypt,
  encryptJSON,
  decryptJSON,
  hashData,
  generateSecureToken,
  secureCompare,
} from '../../src/security/encryption.js';

describe('Encryption Service', () => {
  const testData = 'Sensitive PII data: DNI 12345678Z';
  const workspaceContext = 'workspace-test-123';

  describe('Basic Encryption/Decryption', () => {
    it('should encrypt and decrypt data successfully', () => {
      const encrypted = encrypt(testData);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(testData);
    });

    it('should produce different ciphertext for same plaintext', () => {
      const encrypted1 = encrypt(testData);
      const encrypted2 = encrypt(testData);

      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });

    it('should fail decryption with wrong auth tag', () => {
      const encrypted = encrypt(testData);
      encrypted.authTag = Buffer.from('wrong-auth-tag-16b').toString('base64');

      expect(() => decrypt(encrypted)).toThrow();
    });

    it('should fail decryption with tampered ciphertext', () => {
      const encrypted = encrypt(testData);
      const tamperedCiphertext = Buffer.from(encrypted.ciphertext, 'base64');
      tamperedCiphertext[0] ^= 1; // Flip one bit
      encrypted.ciphertext = tamperedCiphertext.toString('base64');

      expect(() => decrypt(encrypted)).toThrow();
    });
  });

  describe('Workspace Isolation', () => {
    it('should encrypt with workspace context', () => {
      const encrypted = encrypt(testData, workspaceContext);
      const decrypted = decrypt(encrypted, workspaceContext);

      expect(decrypted).toBe(testData);
    });

    it('should fail decryption with wrong workspace context', () => {
      const encrypted = encrypt(testData, workspaceContext);

      expect(() => decrypt(encrypted, 'wrong-workspace')).toThrow();
    });

    it('should produce different ciphertext for different workspaces', () => {
      const encrypted1 = encrypt(testData, 'workspace-1');
      const encrypted2 = encrypt(testData, 'workspace-2');

      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
    });
  });

  describe('JSON Encryption', () => {
    const testObject = {
      dni: '12345678Z',
      name: 'Juan García',
      address: 'Calle Mayor 1, Madrid',
      birthDate: '1990-01-01',
    };

    it('should encrypt and decrypt JSON objects', () => {
      const encrypted = encryptJSON(testObject, workspaceContext);
      const decrypted = decryptJSON(encrypted, workspaceContext);

      expect(decrypted).toEqual(testObject);
    });

    it('should handle nested objects', () => {
      const nested = {
        user: testObject,
        metadata: {
          uploadedAt: new Date().toISOString(),
          source: 'manual',
        },
      };

      const encrypted = encryptJSON(nested, workspaceContext);
      const decrypted = decryptJSON(encrypted, workspaceContext);

      expect(decrypted).toEqual(nested);
    });

    it('should handle arrays', () => {
      const array = [testObject, { ...testObject, dni: '87654321A' }];

      const encrypted = encryptJSON(array, workspaceContext);
      const decrypted = decryptJSON(encrypted, workspaceContext);

      expect(decrypted).toEqual(array);
    });
  });

  describe('Hashing', () => {
    it('should produce consistent hashes', () => {
      const hash1 = hashData(testData);
      const hash2 = hashData(testData);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different data', () => {
      const hash1 = hashData('data1');
      const hash2 = hashData('data2');

      expect(hash1).not.toBe(hash2);
    });

    it('should produce 64-character hex string', () => {
      const hash = hashData(testData);

      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Token Generation', () => {
    it('should generate secure random tokens', () => {
      const token1 = generateSecureToken(32);
      const token2 = generateSecureToken(32);

      expect(token1).not.toBe(token2);
      expect(token1.length).toBe(64); // 32 bytes = 64 hex chars
    });

    it('should generate tokens of specified length', () => {
      const token16 = generateSecureToken(16);
      const token64 = generateSecureToken(64);

      expect(token16.length).toBe(32); // 16 bytes = 32 hex chars
      expect(token64.length).toBe(128); // 64 bytes = 128 hex chars
    });
  });

  describe('Secure Comparison', () => {
    it('should return true for identical strings', () => {
      const str = 'test-string';
      expect(secureCompare(str, str)).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(secureCompare('string1', 'string2')).toBe(false);
    });

    it('should return false for different length strings', () => {
      expect(secureCompare('short', 'longer-string')).toBe(false);
    });

    it('should be timing-safe', () => {
      // This is a basic test - true timing attack resistance requires specialized testing
      const str1 = 'a'.repeat(100);
      const str2 = 'b'.repeat(100);

      expect(secureCompare(str1, str2)).toBe(false);
    });
  });

  describe('Spanish Document PII', () => {
    it('should encrypt DNI numbers', () => {
      const dni = '12345678Z';
      const encrypted = encrypt(dni, workspaceContext);
      const decrypted = decrypt(encrypted, workspaceContext);

      expect(decrypted).toBe(dni);
      expect(encrypted.ciphertext).not.toContain(dni);
    });

    it('should encrypt NIE numbers', () => {
      const nie = 'X1234567L';
      const encrypted = encrypt(nie, workspaceContext);
      const decrypted = decrypt(encrypted, workspaceContext);

      expect(decrypted).toBe(nie);
      expect(encrypted.ciphertext).not.toContain(nie);
    });

    it('should encrypt passport numbers', () => {
      const passport = 'AAA123456';
      const encrypted = encrypt(passport, workspaceContext);
      const decrypted = decrypt(encrypted, workspaceContext);

      expect(decrypted).toBe(passport);
      expect(encrypted.ciphertext).not.toContain(passport);
    });

    it('should encrypt Spanish addresses', () => {
      const address = 'Calle de Alcalá 123, 28009 Madrid, España';
      const encrypted = encrypt(address, workspaceContext);
      const decrypted = decrypt(encrypted, workspaceContext);

      expect(decrypted).toBe(address);
    });
  });
});
