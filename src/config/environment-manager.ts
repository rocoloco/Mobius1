/**
 * Environment Configuration Manager for Mobius 1 Platform
 * Handles environment-specific configuration with validation and hot-reloading
 * 
 * Features:
 * - Multi-environment support (dev, staging, production)
 * - Configuration validation and schema enforcement
 * - Hot-reload capability for non-critical settings
 * - Environment variable override support
 */

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { z } from 'zod';
import { auditLogger } from '../audit/logger.js';

export type Environment = 'development' | 'staging' | 'production' | 'test';

/**
 * Environment-specific configuration schema
 */
const environmentConfigSchema = z.object({
  environment: z.enum(['development', 'staging', 'production', 'test']),
  
  features: z.object({
    aiCopilot: z.boolean().default(true),
    documentProcessing: z.boolean().default(true),
    complianceExport: z.boolean().default(true),
    webhooks: z.boolean().default(true),
  }),

  limits: z.object({
    maxWorkspaces: z.number().int().positive().default(100),
    maxUsersPerWorkspace: z.number().int().positive().default(50),
    maxDocumentsPerWorkspace: z.number().int().positive().default(10000),
    maxApiRequestsPerMinute: z.number().int().positive().default(1000),
  }),

  performance: z.object({
    cacheEnabled: z.boolean().default(true),
    cacheTTL: z.number().int().positive().default(300),
    maxConcurrentRequests: z.number().int().positive().default(50),
    requestTimeout: z.number().int().positive().default(30000),
  }),

  security: z.object({
    strictMode: z.boolean().default(false),
    allowedOrigins: z.array(z.string()).default(['*']),
    sessionTimeout: z.number().int().positive().default(3600),
    maxLoginAttempts: z.number().int().positive().default(5),
  }),

  observability: z.object({
    tracingEnabled: z.boolean().default(true),
    metricsEnabled: z.boolean().default(true),
    logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    samplingRate: z.number().min(0).max(1).default(1.0),
  }),
});

export type EnvironmentConfig = z.infer<typeof environmentConfigSchema>;

/**
 * Default configurations for each environment
 */
const defaultConfigs: Record<Environment, Partial<EnvironmentConfig>> = {
  development: {
    environment: 'development',
    features: {
      aiCopilot: true,
      documentProcessing: true,
      complianceExport: true,
      webhooks: true,
    },
    limits: {
      maxWorkspaces: 10,
      maxUsersPerWorkspace: 5,
      maxDocumentsPerWorkspace: 1000,
      maxApiRequestsPerMinute: 100,
    },
    performance: {
      cacheEnabled: true,
      cacheTTL: 60,
      maxConcurrentRequests: 10,
      requestTimeout: 30000,
    },
    security: {
      strictMode: false,
      allowedOrigins: ['*'],
      sessionTimeout: 7200,
      maxLoginAttempts: 10,
    },
    observability: {
      tracingEnabled: true,
      metricsEnabled: true,
      logLevel: 'debug',
      samplingRate: 1.0,
    },
  },
  staging: {
    environment: 'staging',
    features: {
      aiCopilot: true,
      documentProcessing: true,
      complianceExport: true,
      webhooks: true,
    },
    limits: {
      maxWorkspaces: 50,
      maxUsersPerWorkspace: 25,
      maxDocumentsPerWorkspace: 5000,
      maxApiRequestsPerMinute: 500,
    },
    performance: {
      cacheEnabled: true,
      cacheTTL: 300,
      maxConcurrentRequests: 30,
      requestTimeout: 30000,
    },
    security: {
      strictMode: true,
      allowedOrigins: ['https://staging.example.com'],
      sessionTimeout: 3600,
      maxLoginAttempts: 5,
    },
    observability: {
      tracingEnabled: true,
      metricsEnabled: true,
      logLevel: 'info',
      samplingRate: 0.5,
    },
  },
  production: {
    environment: 'production',
    features: {
      aiCopilot: true,
      documentProcessing: true,
      complianceExport: true,
      webhooks: true,
    },
    limits: {
      maxWorkspaces: 1000,
      maxUsersPerWorkspace: 100,
      maxDocumentsPerWorkspace: 50000,
      maxApiRequestsPerMinute: 5000,
    },
    performance: {
      cacheEnabled: true,
      cacheTTL: 600,
      maxConcurrentRequests: 100,
      requestTimeout: 30000,
    },
    security: {
      strictMode: true,
      allowedOrigins: ['https://app.example.com'],
      sessionTimeout: 1800,
      maxLoginAttempts: 3,
    },
    observability: {
      tracingEnabled: true,
      metricsEnabled: true,
      logLevel: 'warn',
      samplingRate: 0.1,
    },
  },
  test: {
    environment: 'test',
    features: {
      aiCopilot: true,
      documentProcessing: true,
      complianceExport: true,
      webhooks: false,
    },
    limits: {
      maxWorkspaces: 5,
      maxUsersPerWorkspace: 3,
      maxDocumentsPerWorkspace: 100,
      maxApiRequestsPerMinute: 1000,
    },
    performance: {
      cacheEnabled: false,
      cacheTTL: 10,
      maxConcurrentRequests: 5,
      requestTimeout: 5000,
    },
    security: {
      strictMode: false,
      allowedOrigins: ['*'],
      sessionTimeout: 3600,
      maxLoginAttempts: 100,
    },
    observability: {
      tracingEnabled: false,
      metricsEnabled: false,
      logLevel: 'error',
      samplingRate: 0,
    },
  },
};

/**
 * Environment Configuration Manager
 */
export class EnvironmentManager {
  private config: EnvironmentConfig;
  private configPath: string;
  private watchers: Array<(config: EnvironmentConfig) => void> = [];

  constructor(environment: Environment, configPath = './config') {
    this.configPath = join(configPath, `${environment}.json`);
    this.config = environmentConfigSchema.parse(defaultConfigs[environment]);
  }

  /**
   * Initialize and load configuration
   */
  async initialize(): Promise<void> {
    try {
      const fileConfig = await this.loadConfigFromFile();
      this.config = this.mergeWithEnvironmentVariables(fileConfig);
      
      await auditLogger.log({
        eventType: 'config.environment.loaded',
        userId: 'system',
        workspaceId: 'system',
        resourceType: 'configuration',
        resourceId: this.config.environment,
        action: 'load',
        outcome: 'success',
        metadata: { environment: this.config.environment },
      });
    } catch (error) {
      // Use defaults if file doesn't exist
      await auditLogger.log({
        eventType: 'config.environment.default',
        userId: 'system',
        workspaceId: 'system',
        resourceType: 'configuration',
        resourceId: this.config.environment,
        action: 'load',
        outcome: 'success',
        metadata: { 
          reason: 'file_not_found',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): EnvironmentConfig {
    return { ...this.config };
  }

  /**
   * Update configuration (hot-reload)
   */
  async updateConfig(updates: Partial<EnvironmentConfig>): Promise<void> {
    const newConfig = environmentConfigSchema.parse({
      ...this.config,
      ...updates,
    });

    this.config = newConfig;
    await this.saveConfigToFile(newConfig);

    // Notify watchers
    this.watchers.forEach((watcher) => watcher(newConfig));

    await auditLogger.log({
      eventType: 'config.environment.updated',
      userId: 'system',
      workspaceId: 'system',
      resourceType: 'configuration',
      resourceId: this.config.environment,
      action: 'update',
      outcome: 'success',
      metadata: { updates: Object.keys(updates) },
    });
  }

  /**
   * Watch for configuration changes
   */
  watch(callback: (config: EnvironmentConfig) => void): () => void {
    this.watchers.push(callback);
    return () => {
      this.watchers = this.watchers.filter((w) => w !== callback);
    };
  }

  /**
   * Validate configuration against schema
   */
  validate(config: unknown): { valid: boolean; errors?: string[] } {
    try {
      environmentConfigSchema.parse(config);
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
        };
      }
      return { valid: false, errors: ['Unknown validation error'] };
    }
  }

  /**
   * Load configuration from file
   */
  private async loadConfigFromFile(): Promise<EnvironmentConfig> {
    const content = await readFile(this.configPath, 'utf-8');
    const parsed = JSON.parse(content);
    return environmentConfigSchema.parse(parsed);
  }

  /**
   * Save configuration to file
   */
  private async saveConfigToFile(config: EnvironmentConfig): Promise<void> {
    await writeFile(this.configPath, JSON.stringify(config, null, 2), { mode: 0o644 });
  }

  /**
   * Merge file config with environment variable overrides
   */
  private mergeWithEnvironmentVariables(config: EnvironmentConfig): EnvironmentConfig {
    // Allow specific overrides via environment variables
    const overrides: Partial<EnvironmentConfig> = {};

    if (process.env.FEATURE_AI_COPILOT) {
      overrides.features = {
        ...config.features,
        aiCopilot: process.env.FEATURE_AI_COPILOT === 'true',
      };
    }

    if (process.env.MAX_WORKSPACES) {
      overrides.limits = {
        ...config.limits,
        maxWorkspaces: parseInt(process.env.MAX_WORKSPACES, 10),
      };
    }

    if (process.env.CACHE_ENABLED) {
      overrides.performance = {
        ...config.performance,
        cacheEnabled: process.env.CACHE_ENABLED === 'true',
      };
    }

    return environmentConfigSchema.parse({ ...config, ...overrides });
  }
}

/**
 * Create environment manager for current environment
 */
export function createEnvironmentManager(env?: Environment): EnvironmentManager {
  const environment = (env || process.env.NODE_ENV || 'development') as Environment;
  return new EnvironmentManager(environment);
}
