/**
 * Configuration Tests for Mobius 1 Platform
 * Tests environment variable parsing and validation
 */

import { describe, it, expect, beforeAll } from 'vitest';

import { appConfig, isSpainResidencyMode, isPIIRedactionEnabled } from '../src/config/index.js';

describe('Configuration Management', () => {
  beforeAll(() => {
    // Ensure test environment variables are set
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.MINIO_ENDPOINT = 'localhost';
    process.env.MINIO_PORT = '9000';
    process.env.MINIO_ACCESS_KEY = 'test';
    process.env.MINIO_SECRET_KEY = 'test';
    process.env.QDRANT_URL = 'http://localhost:6333';
    process.env.JWT_SECRET = 'test-jwt-secret-32-characters-long';
    process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';
  });

  it('should load and validate configuration', () => {
    expect(appConfig).toBeDefined();
    expect(appConfig.database.url).toContain('postgresql://');
    expect(appConfig.redis.url).toContain('redis://');
    expect(appConfig.security.jwtSecret).toHaveLength(32);
    expect(appConfig.security.encryptionKey).toHaveLength(32);
  });

  it('should validate Spain residency mode', () => {
    expect(typeof appConfig.compliance.spainResidencyMode).toBe('boolean');
    expect(typeof isSpainResidencyMode()).toBe('boolean');
  });

  it('should validate PII redaction settings', () => {
    expect(typeof appConfig.logging.redactPII).toBe('boolean');
    expect(typeof isPIIRedactionEnabled()).toBe('boolean');
  });

  it('should validate MinIO configuration', () => {
    expect(appConfig.minio.endpoint).toBe('localhost');
    expect(appConfig.minio.port).toBe(9000);
    expect(typeof appConfig.minio.useSSL).toBe('boolean');
  });

  it('should validate audit retention settings', () => {
    expect(appConfig.audit.retentionDays).toBeGreaterThan(0);
    expect(appConfig.audit.retentionDays).toBe(2555); // 7 years
  });
});