/**
 * Environment Configuration Integration Tests
 * Tests environment-specific configurations and hot-reload functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEnvironmentManager, type Environment } from '../../src/config/environment-manager.js';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';

describe('Environment Configuration Integration Tests', () => {
  const testConfigPath = './config';

  afterEach(async () => {
    // Cleanup test config files
    try {
      await unlink(join(testConfigPath, 'test.json'));
    } catch {
      // Ignore if doesn't exist
    }
  });

  describe('Environment Loading', () => {
    it('should load development configuration', async () => {
      const envManager = createEnvironmentManager('development');
      await envManager.initialize();

      const config = envManager.getConfig();

      expect(config.environment).toBe('development');
      expect(config.limits.maxWorkspaces).toBe(10);
      expect(config.security.strictMode).toBe(false);
      expect(config.observability.logLevel).toBe('debug');
    });

    it('should load production configuration', async () => {
      const envManager = createEnvironmentManager('production');
      await envManager.initialize();

      const config = envManager.getConfig();

      expect(config.environment).toBe('production');
      expect(config.limits.maxWorkspaces).toBe(1000);
      expect(config.security.strictMode).toBe(true);
      expect(config.observability.logLevel).toBe('warn');
    });

    it('should load test configuration', async () => {
      const envManager = createEnvironmentManager('test');
      await envManager.initialize();

      const config = envManager.getConfig();

      expect(config.environment).toBe('test');
      expect(config.limits.maxWorkspaces).toBe(5);
      expect(config.performance.cacheEnabled).toBe(false);
      expect(config.observability.tracingEnabled).toBe(false);
    });

    it('should use defaults when config file missing', async () => {
      const envManager = createEnvironmentManager('test');
      await envManager.initialize();

      const config = envManager.getConfig();

      // Should have all required fields with defaults
      expect(config.environment).toBeDefined();
      expect(config.features).toBeDefined();
      expect(config.limits).toBeDefined();
      expect(config.performance).toBeDefined();
      expect(config.security).toBeDefined();
      expect(config.observability).toBeDefined();
    });
  });

  describe('Configuration Validation', () => {
    it('should validate correct configuration', async () => {
      const envManager = createEnvironmentManager('development');
      await envManager.initialize();

      const config = envManager.getConfig();
      const result = envManager.validate(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should reject invalid environment', async () => {
      const envManager = createEnvironmentManager('development');
      await envManager.initialize();

      const invalidConfig = {
        environment: 'invalid-env' as Environment,
        features: {},
        limits: {},
        performance: {},
        security: {},
        observability: {},
      };

      const result = envManager.validate(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should reject missing required fields', async () => {
      const envManager = createEnvironmentManager('development');
      await envManager.initialize();

      const invalidConfig = {
        environment: 'development' as Environment,
        // Missing other required fields
      };

      const result = envManager.validate(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject invalid data types', async () => {
      const envManager = createEnvironmentManager('development');
      await envManager.initialize();

      const config = envManager.getConfig();
      const invalidConfig = {
        ...config,
        limits: {
          ...config.limits,
          maxWorkspaces: 'not-a-number' as any,
        },
      };

      const result = envManager.validate(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should provide detailed error messages', async () => {
      const envManager = createEnvironmentManager('development');
      await envManager.initialize();

      const invalidConfig = {
        environment: 'invalid',
        features: { invalid: true },
      };

      const result = envManager.validate(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);

      result.errors!.forEach((error) => {
        expect(typeof error).toBe('string');
        expect(error.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration', async () => {
      const envManager = createEnvironmentManager('test');
      await envManager.initialize();

      const originalConfig = envManager.getConfig();
      const originalMaxWorkspaces = originalConfig.limits.maxWorkspaces;

      await envManager.updateConfig({
        limits: {
          ...originalConfig.limits,
          maxWorkspaces: 100,
        },
      });

      const updatedConfig = envManager.getConfig();
      expect(updatedConfig.limits.maxWorkspaces).toBe(100);
      expect(updatedConfig.limits.maxWorkspaces).not.toBe(originalMaxWorkspaces);
    });

    it('should update multiple fields', async () => {
      const envManager = createEnvironmentManager('test');
      await envManager.initialize();

      await envManager.updateConfig({
        limits: {
          ...envManager.getConfig().limits,
          maxWorkspaces: 200,
          maxUsersPerWorkspace: 50,
        },
        security: {
          ...envManager.getConfig().security,
          sessionTimeout: 3600,
        },
      });

      const config = envManager.getConfig();
      expect(config.limits.maxWorkspaces).toBe(200);
      expect(config.limits.maxUsersPerWorkspace).toBe(50);
      expect(config.security.sessionTimeout).toBe(3600);
    });

    it('should validate updates before applying', async () => {
      const envManager = createEnvironmentManager('test');
      await envManager.initialize();

      const invalidUpdate = {
        limits: {
          maxWorkspaces: -1, // Invalid negative value
        },
      };

      await expect(envManager.updateConfig(invalidUpdate as any)).rejects.toThrow();
    });

    it('should preserve other fields during update', async () => {
      const envManager = createEnvironmentManager('test');
      await envManager.initialize();

      const originalConfig = envManager.getConfig();

      await envManager.updateConfig({
        limits: {
          ...originalConfig.limits,
          maxWorkspaces: 150,
        },
      });

      const updatedConfig = envManager.getConfig();

      // Other fields should remain unchanged
      expect(updatedConfig.features).toEqual(originalConfig.features);
      expect(updatedConfig.security).toEqual(originalConfig.security);
      expect(updatedConfig.observability).toEqual(originalConfig.observability);
    });
  });

  describe('Configuration Watchers', () => {
    it('should notify watchers on configuration change', async () => {
      const envManager = createEnvironmentManager('test');
      await envManager.initialize();

      let notificationCount = 0;
      let lastConfig: any = null;

      const unwatch = envManager.watch((config) => {
        notificationCount++;
        lastConfig = config;
      });

      await envManager.updateConfig({
        limits: {
          ...envManager.getConfig().limits,
          maxWorkspaces: 300,
        },
      });

      expect(notificationCount).toBe(1);
      expect(lastConfig).toBeDefined();
      expect(lastConfig.limits.maxWorkspaces).toBe(300);

      unwatch();
    });

    it('should support multiple watchers', async () => {
      const envManager = createEnvironmentManager('test');
      await envManager.initialize();

      let watcher1Called = false;
      let watcher2Called = false;

      const unwatch1 = envManager.watch(() => {
        watcher1Called = true;
      });

      const unwatch2 = envManager.watch(() => {
        watcher2Called = true;
      });

      await envManager.updateConfig({
        limits: {
          ...envManager.getConfig().limits,
          maxWorkspaces: 400,
        },
      });

      expect(watcher1Called).toBe(true);
      expect(watcher2Called).toBe(true);

      unwatch1();
      unwatch2();
    });

    it('should stop notifying after unwatch', async () => {
      const envManager = createEnvironmentManager('test');
      await envManager.initialize();

      let notificationCount = 0;

      const unwatch = envManager.watch(() => {
        notificationCount++;
      });

      await envManager.updateConfig({
        limits: {
          ...envManager.getConfig().limits,
          maxWorkspaces: 500,
        },
      });

      expect(notificationCount).toBe(1);

      // Unwatch
      unwatch();

      // Update again
      await envManager.updateConfig({
        limits: {
          ...envManager.getConfig().limits,
          maxWorkspaces: 600,
        },
      });

      // Should still be 1
      expect(notificationCount).toBe(1);
    });

    it('should handle watcher errors gracefully', async () => {
      const envManager = createEnvironmentManager('test');
      await envManager.initialize();

      const unwatch = envManager.watch(() => {
        throw new Error('Watcher error');
      });

      // Should not throw even if watcher throws
      await expect(
        envManager.updateConfig({
          limits: {
            ...envManager.getConfig().limits,
            maxWorkspaces: 700,
          },
        })
      ).resolves.not.toThrow();

      unwatch();
    });
  });

  describe('Environment-Specific Behavior', () => {
    it('should have relaxed limits in development', async () => {
      const envManager = createEnvironmentManager('development');
      await envManager.initialize();

      const config = envManager.getConfig();

      expect(config.limits.maxWorkspaces).toBeLessThan(100);
      expect(config.security.strictMode).toBe(false);
      expect(config.security.allowedOrigins).toContain('*');
    });

    it('should have strict security in production', async () => {
      const envManager = createEnvironmentManager('production');
      await envManager.initialize();

      const config = envManager.getConfig();

      expect(config.security.strictMode).toBe(true);
      expect(config.security.allowedOrigins).not.toContain('*');
      expect(config.security.sessionTimeout).toBeLessThanOrEqual(1800);
      expect(config.security.maxLoginAttempts).toBeLessThanOrEqual(5);
    });

    it('should have optimized performance settings in production', async () => {
      const envManager = createEnvironmentManager('production');
      await envManager.initialize();

      const config = envManager.getConfig();

      expect(config.performance.cacheEnabled).toBe(true);
      expect(config.performance.cacheTTL).toBeGreaterThan(300);
      expect(config.performance.maxConcurrentRequests).toBeGreaterThan(50);
    });

    it('should have minimal observability in test', async () => {
      const envManager = createEnvironmentManager('test');
      await envManager.initialize();

      const config = envManager.getConfig();

      expect(config.observability.tracingEnabled).toBe(false);
      expect(config.observability.metricsEnabled).toBe(false);
      expect(config.observability.samplingRate).toBe(0);
    });

    it('should have debug logging in development', async () => {
      const envManager = createEnvironmentManager('development');
      await envManager.initialize();

      const config = envManager.getConfig();

      expect(config.observability.logLevel).toBe('debug');
      expect(config.observability.samplingRate).toBe(1.0);
    });
  });

  describe('Feature Flags', () => {
    it('should enable all features in development', async () => {
      const envManager = createEnvironmentManager('development');
      await envManager.initialize();

      const config = envManager.getConfig();

      expect(config.features.aiCopilot).toBe(true);
      expect(config.features.documentProcessing).toBe(true);
      expect(config.features.complianceExport).toBe(true);
      expect(config.features.webhooks).toBe(true);
    });

    it('should allow toggling features', async () => {
      const envManager = createEnvironmentManager('test');
      await envManager.initialize();

      await envManager.updateConfig({
        features: {
          aiCopilot: false,
          documentProcessing: true,
          complianceExport: true,
          webhooks: false,
        },
      });

      const config = envManager.getConfig();

      expect(config.features.aiCopilot).toBe(false);
      expect(config.features.documentProcessing).toBe(true);
      expect(config.features.webhooks).toBe(false);
    });
  });

  describe('Environment Variable Overrides', () => {
    it('should merge environment variable overrides', async () => {
      const originalFeature = process.env.FEATURE_AI_COPILOT;
      process.env.FEATURE_AI_COPILOT = 'false';

      const envManager = createEnvironmentManager('test');
      await envManager.initialize();

      const config = envManager.getConfig();

      // Should be overridden by env var
      expect(config.features.aiCopilot).toBe(false);

      // Restore
      if (originalFeature !== undefined) {
        process.env.FEATURE_AI_COPILOT = originalFeature;
      } else {
        delete process.env.FEATURE_AI_COPILOT;
      }
    });
  });
});
