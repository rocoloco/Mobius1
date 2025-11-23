/**
 * Deployment Integration Tests
 * Tests complete deployment scenarios, health checks, and configuration validation
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { configValidator } from '../../src/config/validator.js';
import { secretsManager } from '../../src/config/secrets-manager.js';
import { rotationScheduler } from '../../src/config/rotation-scheduler.js';
import { createEnvironmentManager } from '../../src/config/environment-manager.js';

describe('Deployment Integration Tests', () => {
  describe('Configuration Validation', () => {
    it('should validate complete configuration successfully', async () => {
      const result = await configValidator.validate();

      expect(result).toBeDefined();
      expect(result.valid).toBeDefined();
      expect(result.errors).toBeInstanceOf(Array);
      expect(result.warnings).toBeInstanceOf(Array);
    });

    it('should detect missing JWT_SECRET', async () => {
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      const result = await configValidator.validate();

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.category === 'secrets')).toBe(true);

      // Restore
      if (originalSecret) {
        process.env.JWT_SECRET = originalSecret;
      }
    });

    it('should warn about weak JWT_SECRET', async () => {
      const originalSecret = process.env.JWT_SECRET;
      process.env.JWT_SECRET = 'short';

      const result = await configValidator.validate();

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.category === 'security')).toBe(true);

      // Restore
      if (originalSecret) {
        process.env.JWT_SECRET = originalSecret;
      }
    });

    it('should validate database URL format', async () => {
      const originalUrl = process.env.DATABASE_URL;
      process.env.DATABASE_URL = 'invalid-url';

      const result = await configValidator.validate();

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.category === 'database')).toBe(true);

      // Restore
      if (originalUrl) {
        process.env.DATABASE_URL = originalUrl;
      }
    });

    it('should provide fix suggestions for errors', async () => {
      const result = await configValidator.validate();

      result.errors.forEach((error) => {
        expect(error).toHaveProperty('category');
        expect(error).toHaveProperty('message');
        expect(error).toHaveProperty('severity');
        // Fix suggestions are optional but helpful
        if (error.fix) {
          expect(typeof error.fix).toBe('string');
        }
      });
    });

    it('should provide recommendations for warnings', async () => {
      const result = await configValidator.validate();

      result.warnings.forEach((warning) => {
        expect(warning).toHaveProperty('category');
        expect(warning).toHaveProperty('message');
        // Recommendations are optional
        if (warning.recommendation) {
          expect(typeof warning.recommendation).toBe('string');
        }
      });
    });
  });

  describe('Secrets Management', () => {
    beforeAll(async () => {
      await secretsManager.initialize();
    });

    afterAll(async () => {
      await secretsManager.shutdown();
    });

    it('should initialize secrets manager', async () => {
      // Already initialized in beforeAll
      expect(secretsManager).toBeDefined();
    });

    it('should retrieve secrets from environment', async () => {
      const secret = await secretsManager.getSecret('JWT_SECRET', 'test-user', 'test-workspace');

      expect(secret).toBeDefined();
      expect(typeof secret).toBe('string');
      expect(secret.length).toBeGreaterThan(0);
    });

    it('should cache secrets for performance', async () => {
      const start1 = Date.now();
      await secretsManager.getSecret('JWT_SECRET', 'test-user', 'test-workspace');
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      await secretsManager.getSecret('JWT_SECRET', 'test-user', 'test-workspace');
      const time2 = Date.now() - start2;

      // Cached access should be faster
      expect(time2).toBeLessThanOrEqual(time1);
    });

    it('should set and retrieve custom secrets', async () => {
      const testSecret = 'test-secret-value-' + Date.now();

      await secretsManager.setSecret(
        'TEST_SECRET',
        testSecret,
        'test-user',
        'test-workspace',
        90
      );

      // Clear cache to force reload
      secretsManager.clearCache();

      const retrieved = await secretsManager.getSecret(
        'TEST_SECRET',
        'test-user',
        'test-workspace'
      );

      expect(retrieved).toBe(testSecret);
    });

    it('should rotate secrets', async () => {
      const originalSecret = await secretsManager.getSecret(
        'TEST_SECRET',
        'test-user',
        'test-workspace'
      );

      const newSecret = await secretsManager.rotateSecret(
        'TEST_SECRET',
        'test-user',
        'test-workspace'
      );

      expect(newSecret).toBeDefined();
      expect(newSecret).not.toBe(originalSecret);
    });

    it('should clear cache on demand', () => {
      secretsManager.clearCache();
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('Rotation Scheduler', () => {
    beforeAll(async () => {
      await rotationScheduler.initialize();
    });

    afterAll(async () => {
      await rotationScheduler.shutdown();
    });

    it('should initialize with default policies', async () => {
      expect(rotationScheduler).toBeDefined();

      const jwtPolicy = rotationScheduler.getPolicy('JWT_SECRET');
      expect(jwtPolicy).toBeDefined();
      expect(jwtPolicy?.intervalDays).toBe(90);
      expect(jwtPolicy?.autoRotate).toBe(false);
    });

    it('should check rotation status', async () => {
      const statuses = await rotationScheduler.checkRotations();

      expect(statuses).toBeInstanceOf(Array);
      expect(statuses.length).toBeGreaterThan(0);

      statuses.forEach((status) => {
        expect(status).toHaveProperty('secretName');
        expect(status).toHaveProperty('lastRotated');
        expect(status).toHaveProperty('nextRotation');
        expect(status).toHaveProperty('daysUntilRotation');
        expect(status).toHaveProperty('status');
        expect(['current', 'warning', 'expired']).toContain(status.status);
      });
    });

    it('should add custom rotation policy', () => {
      rotationScheduler.addPolicy({
        secretName: 'CUSTOM_SECRET',
        intervalDays: 30,
        gracePeriodDays: 5,
        autoRotate: true,
        notifyBeforeDays: 7,
      });

      const policy = rotationScheduler.getPolicy('CUSTOM_SECRET');
      expect(policy).toBeDefined();
      expect(policy?.intervalDays).toBe(30);
      expect(policy?.autoRotate).toBe(true);
    });

    it('should get rotation statuses for all secrets', async () => {
      const statuses = await rotationScheduler.getRotationStatuses();

      expect(statuses).toBeInstanceOf(Array);
      expect(statuses.length).toBeGreaterThan(0);
    });
  });

  describe('Environment Manager', () => {
    it('should create environment manager for development', async () => {
      const envManager = createEnvironmentManager('development');
      await envManager.initialize();

      const config = envManager.getConfig();

      expect(config.environment).toBe('development');
      expect(config.features.aiCopilot).toBe(true);
      expect(config.limits.maxWorkspaces).toBe(10);
      expect(config.observability.logLevel).toBe('debug');
    });

    it('should create environment manager for production', async () => {
      const envManager = createEnvironmentManager('production');
      await envManager.initialize();

      const config = envManager.getConfig();

      expect(config.environment).toBe('production');
      expect(config.security.strictMode).toBe(true);
      expect(config.limits.maxWorkspaces).toBe(1000);
      expect(config.observability.logLevel).toBe('warn');
    });

    it('should validate configuration schema', async () => {
      const envManager = createEnvironmentManager('development');
      await envManager.initialize();

      const config = envManager.getConfig();
      const result = envManager.validate(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should detect invalid configuration', async () => {
      const envManager = createEnvironmentManager('development');
      await envManager.initialize();

      const invalidConfig = {
        environment: 'invalid-env',
        features: {},
      };

      const result = envManager.validate(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should update configuration', async () => {
      const envManager = createEnvironmentManager('test');
      await envManager.initialize();

      const originalConfig = envManager.getConfig();
      const originalMaxWorkspaces = originalConfig.limits.maxWorkspaces;

      await envManager.updateConfig({
        limits: {
          ...originalConfig.limits,
          maxWorkspaces: 999,
        },
      });

      const updatedConfig = envManager.getConfig();
      expect(updatedConfig.limits.maxWorkspaces).toBe(999);
      expect(updatedConfig.limits.maxWorkspaces).not.toBe(originalMaxWorkspaces);
    });

    it('should notify watchers on configuration change', async () => {
      const envManager = createEnvironmentManager('test');
      await envManager.initialize();

      let notified = false;
      const unwatch = envManager.watch((config) => {
        notified = true;
        expect(config.limits.maxWorkspaces).toBe(888);
      });

      await envManager.updateConfig({
        limits: {
          ...envManager.getConfig().limits,
          maxWorkspaces: 888,
        },
      });

      expect(notified).toBe(true);
      unwatch();
    });
  });

  describe('Deployment Health Checks', () => {
    it('should validate all required environment variables', () => {
      const requiredVars = [
        'DATABASE_URL',
        'REDIS_URL',
        'MINIO_ENDPOINT',
        'QDRANT_URL',
        'JWT_SECRET',
        'ENCRYPTION_KEY',
      ];

      requiredVars.forEach((varName) => {
        const value = process.env[varName];
        expect(value, `${varName} should be defined`).toBeDefined();
        expect(value!.length, `${varName} should not be empty`).toBeGreaterThan(0);
      });
    });

    it('should validate JWT_SECRET strength', () => {
      const jwtSecret = process.env.JWT_SECRET;
      expect(jwtSecret).toBeDefined();
      expect(jwtSecret!.length).toBeGreaterThanOrEqual(32);
    });

    it('should validate ENCRYPTION_KEY length', () => {
      const encryptionKey = process.env.ENCRYPTION_KEY;
      expect(encryptionKey).toBeDefined();
      expect(encryptionKey!.length).toBe(32);
    });

    it('should validate database URL format', () => {
      const dbUrl = process.env.DATABASE_URL;
      expect(dbUrl).toBeDefined();
      expect(dbUrl).toMatch(/^postgresql:\/\//);
    });

    it('should validate Redis URL format', () => {
      const redisUrl = process.env.REDIS_URL;
      expect(redisUrl).toBeDefined();
      expect(redisUrl).toMatch(/^redis:\/\//);
    });
  });

  describe('Configuration Recovery', () => {
    it('should handle missing configuration files gracefully', async () => {
      const envManager = createEnvironmentManager('test');

      // Should not throw even if file doesn't exist
      await expect(envManager.initialize()).resolves.not.toThrow();
    });

    it('should use defaults when configuration is missing', async () => {
      const envManager = createEnvironmentManager('test');
      await envManager.initialize();

      const config = envManager.getConfig();

      // Should have default values
      expect(config.environment).toBe('test');
      expect(config.features).toBeDefined();
      expect(config.limits).toBeDefined();
      expect(config.security).toBeDefined();
    });

    it('should handle secrets manager shutdown gracefully', async () => {
      await secretsManager.initialize();
      await expect(secretsManager.shutdown()).resolves.not.toThrow();
    });

    it('should handle rotation scheduler shutdown gracefully', async () => {
      await rotationScheduler.initialize();
      await expect(rotationScheduler.shutdown()).resolves.not.toThrow();
    });
  });
});
