/**
 * Secrets Manager Tests
 * Tests secure credential storage and rotation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SecretsManager } from '../../src/security/secrets.js';
import fs from 'fs';
import path from 'path';

const TEST_SECRETS_PATH = '.test-secrets';

describe('SecretsManager', () => {
  let secretsManager: SecretsManager;

  beforeEach(() => {
    // Clean up test directory
    if (fs.existsSync(TEST_SECRETS_PATH)) {
      fs.rmSync(TEST_SECRETS_PATH, { recursive: true, force: true });
    }

    secretsManager = new SecretsManager(TEST_SECRETS_PATH, {
      databaseCredentials: 30,
      apiKeys: 90,
      encryptionKeys: 365,
    });
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(TEST_SECRETS_PATH)) {
      fs.rmSync(TEST_SECRETS_PATH, { recursive: true, force: true });
    }
  });

  describe('API Key Generation', () => {
    it('should generate API keys with correct prefix', () => {
      const apiKey = secretsManager.generateAPIKey();

      expect(apiKey).toMatch(/^mbx1_[A-Za-z0-9_-]+$/);
    });

    it('should generate unique API keys', () => {
      const key1 = secretsManager.generateAPIKey();
      const key2 = secretsManager.generateAPIKey();

      expect(key1).not.toBe(key2);
    });

    it('should generate keys of sufficient length', () => {
      const apiKey = secretsManager.generateAPIKey();

      expect(apiKey.length).toBeGreaterThan(40);
    });
  });

  describe('Database Password Generation', () => {
    it('should generate secure passwords', () => {
      const password = secretsManager.generateDatabasePassword();

      expect(password.length).toBe(32);
    });

    it('should generate unique passwords', () => {
      const pass1 = secretsManager.generateDatabasePassword();
      const pass2 = secretsManager.generateDatabasePassword();

      expect(pass1).not.toBe(pass2);
    });

    it('should include mixed character types', () => {
      const password = secretsManager.generateDatabasePassword();

      expect(password).toMatch(/[a-z]/); // lowercase
      expect(password).toMatch(/[A-Z]/); // uppercase
      expect(password).toMatch(/[0-9]/); // numbers
    });
  });

  describe('Encryption Key Generation', () => {
    it('should generate 32-byte encryption keys', () => {
      const key = secretsManager.generateEncryptionKey();

      expect(key.length).toBe(64); // 32 bytes = 64 hex chars
    });

    it('should generate unique keys', () => {
      const key1 = secretsManager.generateEncryptionKey();
      const key2 = secretsManager.generateEncryptionKey();

      expect(key1).not.toBe(key2);
    });

    it('should generate hex strings', () => {
      const key = secretsManager.generateEncryptionKey();

      expect(key).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Secret Storage', () => {
    it('should store and retrieve secrets', () => {
      const secretValue = 'test-secret-value';
      secretsManager.storeSecret('test-secret', secretValue);

      const retrieved = secretsManager.getSecret('test-secret');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.value).toBe(secretValue);
    });

    it('should store metadata with secrets', () => {
      secretsManager.storeSecret('test-secret', 'value', {
        version: 2,
        createdAt: new Date('2024-01-01'),
      });

      const retrieved = secretsManager.getSecret('test-secret');

      expect(retrieved?.metadata.version).toBe(2);
      expect(retrieved?.metadata.createdAt).toEqual(new Date('2024-01-01'));
    });

    it('should return null for non-existent secrets', () => {
      const retrieved = secretsManager.getSecret('non-existent');

      expect(retrieved).toBeNull();
    });

    it('should create secrets directory with secure permissions', () => {
      const stats = fs.statSync(TEST_SECRETS_PATH);
      const mode = stats.mode & 0o777;

      expect(mode).toBe(0o700); // Owner read/write/execute only
    });
  });

  describe('Secret Rotation', () => {
    it('should detect secrets needing rotation', () => {
      secretsManager.storeSecret('old-secret', 'value', {
        createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000), // 100 days ago
      });

      const needsRotation = secretsManager.needsRotation('old-secret', 'apiKeys');

      expect(needsRotation).toBe(true); // 100 days > 90 days policy
    });

    it('should not rotate recent secrets', () => {
      secretsManager.storeSecret('new-secret', 'value');

      const needsRotation = secretsManager.needsRotation('new-secret', 'apiKeys');

      expect(needsRotation).toBe(false);
    });

    it('should rotate secrets and increment version', () => {
      secretsManager.storeSecret('test-secret', 'old-value');
      secretsManager.rotateSecret('test-secret', 'new-value');

      const retrieved = secretsManager.getSecret('test-secret');

      expect(retrieved?.value).toBe('new-value');
      expect(retrieved?.metadata.version).toBe(2);
      expect(retrieved?.metadata.rotatedAt).toBeDefined();
    });

    it('should preserve creation date on rotation', () => {
      const createdAt = new Date('2024-01-01');
      secretsManager.storeSecret('test-secret', 'old-value', { createdAt });
      secretsManager.rotateSecret('test-secret', 'new-value');

      const retrieved = secretsManager.getSecret('test-secret');

      expect(retrieved?.metadata.createdAt).toEqual(createdAt);
    });
  });

  describe('Secret Listing', () => {
    it('should list all secrets', () => {
      secretsManager.storeSecret('secret1', 'value1');
      secretsManager.storeSecret('secret2', 'value2');
      secretsManager.storeSecret('secret3', 'value3');

      const secrets = secretsManager.listSecrets();

      expect(secrets.length).toBe(3);
      expect(secrets.map((s) => s.name)).toContain('secret1');
      expect(secrets.map((s) => s.name)).toContain('secret2');
      expect(secrets.map((s) => s.name)).toContain('secret3');
    });

    it('should return empty array when no secrets exist', () => {
      const secrets = secretsManager.listSecrets();

      expect(secrets).toEqual([]);
    });
  });

  describe('Secret Audit', () => {
    it('should audit all secrets', () => {
      secretsManager.storeSecret('secret1', 'value1');
      secretsManager.storeSecret('secret2', 'value2', {
        createdAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000), // 400 days ago
      });

      const audit = secretsManager.auditSecrets();

      expect(audit.total).toBe(2);
      expect(audit.needsRotation).toBe(1); // secret2 needs rotation
    });

    it('should calculate days since rotation', () => {
      secretsManager.storeSecret('test-secret', 'value', {
        createdAt: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000), // 50 days ago
      });

      const audit = secretsManager.auditSecrets();

      expect(audit.secrets[0].daysSinceRotation).toBeGreaterThanOrEqual(49);
      expect(audit.secrets[0].daysSinceRotation).toBeLessThanOrEqual(51);
    });
  });
});
