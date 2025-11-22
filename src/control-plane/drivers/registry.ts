/**
 * Deployment Driver Registry
 * 
 * Manages multiple deployment drivers (Coolify, K8s, Nomad)
 * Provides unified interface for driver selection and management
 */

import { DeploymentDriver, DriverFactory, DriverRegistry, DeploymentDriverConfig } from './types.js';
import { CoolifyDriver, CoolifyConfig } from './coolify.js';
import { z } from 'zod';

/**
 * Driver type aliases for normalization
 */
const DRIVER_TYPE_ALIASES = new Map([
  ['k8s', 'kubernetes'],
  ['kube', 'kubernetes'],
  ['k3s', 'kubernetes'],
]);

/**
 * Normalize driver type to canonical form
 */
export function canonicalDriverType(type: string): string {
  const normalized = type.toLowerCase().trim();
  return DRIVER_TYPE_ALIASES.get(normalized) ?? normalized;
}

/**
 * Base driver configuration schema
 */
const BaseDriverConfigSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  environment: z.enum(['development', 'production', 'test']),
  spainResidencyMode: z.boolean(),
  airGappedMode: z.boolean(),
}).strict();

/**
 * Coolify-specific configuration schema
 */
const CoolifyConfigSchema = BaseDriverConfigSchema.extend({
  coolifyUrl: z.string().url(),
  apiToken: z.string().min(1),
  projectId: z.string().min(1),
  serverId: z.string().min(1),
  networkName: z.string().optional(),
  domain: z.string().optional(),
  enableTraefik: z.boolean(),
  enableSSL: z.boolean(),
}).strict();

/**
 * Coolify driver factory
 */
export class CoolifyDriverFactory implements DriverFactory {
  createDriver(config: DeploymentDriverConfig): DeploymentDriver {
    if (!this.isCoolifyConfig(config)) {
      throw new Error('Invalid Coolify configuration');
    }
    return new CoolifyDriver(config);
  }

  getSupportedTypes(): string[] {
    return ['coolify'];
  }

  async validateConfig(config: DeploymentDriverConfig): Promise<boolean> {
    try {
      // Strict schema validation with no unknown keys
      CoolifyConfigSchema.parse(config);
      return true;
    } catch (error) {
      console.warn('Coolify config validation failed:', error);
      return false;
    }
  }

  private isCoolifyConfig(config: DeploymentDriverConfig): config is CoolifyConfig {
    return 'coolifyUrl' in config && 'apiToken' in config;
  }
}

/**
 * Kubernetes driver factory (placeholder for future implementation)
 */
export class KubernetesDriverFactory implements DriverFactory {
  createDriver(config: DeploymentDriverConfig): DeploymentDriver {
    throw new Error('Kubernetes driver not yet implemented');
  }

  getSupportedTypes(): string[] {
    return ['kubernetes', 'k8s'];
  }

  async validateConfig(config: DeploymentDriverConfig): Promise<boolean> {
    // Kubernetes validation would go here
    return false;
  }
}

/**
 * Nomad driver factory (placeholder for future implementation)
 */
export class NomadDriverFactory implements DriverFactory {
  createDriver(config: DeploymentDriverConfig): DeploymentDriver {
    throw new Error('Nomad driver not yet implemented');
  }

  getSupportedTypes(): string[] {
    return ['nomad'];
  }

  async validateConfig(config: DeploymentDriverConfig): Promise<boolean> {
    // Nomad validation would go here
    return false;
  }
}

/**
 * Default deployment driver registry implementation
 */
export class DefaultDriverRegistry implements DriverRegistry {
  private readonly factories = new Map<string, DriverFactory>();

  constructor() {
    // Register built-in drivers
    this.registerBuiltInDrivers();
  }

  /**
   * Register built-in driver factories
   */
  private registerBuiltInDrivers(): void {
    const coolifyFactory = new CoolifyDriverFactory();
    const kubernetesFactory = new KubernetesDriverFactory();
    const nomadFactory = new NomadDriverFactory();

    // Register Coolify driver
    for (const type of coolifyFactory.getSupportedTypes()) {
      this.factories.set(type, coolifyFactory);
    }

    // Register Kubernetes driver
    for (const type of kubernetesFactory.getSupportedTypes()) {
      this.factories.set(type, kubernetesFactory);
    }

    // Register Nomad driver
    for (const type of nomadFactory.getSupportedTypes()) {
      this.factories.set(type, nomadFactory);
    }
  }

  /**
   * Register a driver factory
   */
  registerDriver(type: string, factory: DriverFactory): void {
    this.factories.set(type.toLowerCase(), factory);
  }

  /**
   * Get driver factory by type (with alias normalization)
   */
  getDriverFactory(type: string): DriverFactory | undefined {
    const canonicalType = canonicalDriverType(type);
    return this.factories.get(canonicalType);
  }

  /**
   * Get all registered driver types
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.factories.keys());
  }

  /**
   * Create driver instance
   */
  async createDriver(type: string, config: DeploymentDriverConfig): Promise<DeploymentDriver> {
    const factory = this.getDriverFactory(type);
    if (!factory) {
      throw new Error(`Unknown driver type: ${type}. Supported types: ${this.getRegisteredTypes().join(', ')}`);
    }

    // Validate configuration
    const isValid = await factory.validateConfig(config);
    if (!isValid) {
      throw new Error(`Invalid configuration for driver type: ${type}`);
    }

    // Create and initialize driver
    const driver = factory.createDriver(config);
    await driver.initialize();

    return driver;
  }

  /**
   * Get driver recommendations based on environment and requirements
   */
  getRecommendedDriver(
    environment: 'development' | 'production' | 'test',
    requirements: {
      spainResidencyMode?: boolean;
      airGappedMode?: boolean;
      scalability?: 'low' | 'medium' | 'high';
      complexity?: 'simple' | 'moderate' | 'complex';
    }
  ): string {
    // Simple recommendation logic
    if (requirements.complexity === 'simple' || environment === 'development') {
      return 'coolify';
    }

    if (requirements.scalability === 'high' || requirements.complexity === 'complex') {
      return 'kubernetes';
    }

    if (requirements.airGappedMode) {
      return 'nomad'; // Nomad is often preferred for air-gapped deployments
    }

    // Default to Coolify for most use cases
    return 'coolify';
  }

  /**
   * Validate driver availability and configuration
   */
  async validateDriverSetup(type: string, config: DeploymentDriverConfig): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const factory = this.getDriverFactory(type);
      if (!factory) {
        errors.push(`Driver type '${type}' is not registered`);
        return { valid: false, errors, warnings };
      }

      // Validate configuration
      const isValid = await factory.validateConfig(config);
      if (!isValid) {
        errors.push(`Configuration validation failed for driver '${type}'`);
      }

      // Try to create and initialize driver
      try {
        const driver = factory.createDriver(config);
        await driver.initialize();
        
        // Perform health check
        const healthCheck = await driver.healthCheck();
        if (!healthCheck.healthy) {
          warnings.push(`Driver health check failed: ${healthCheck.error || 'Unknown error'}`);
        }
      } catch (error) {
        errors.push(`Driver initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

    } catch (error) {
      errors.push(`Driver validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

/**
 * Global driver registry instance
 */
export const driverRegistry = new DefaultDriverRegistry();

/**
 * Convenience function to create a driver
 */
export async function createDeploymentDriver(
  type: string,
  config: DeploymentDriverConfig
): Promise<DeploymentDriver> {
  return driverRegistry.createDriver(type, config);
}

/**
 * Convenience function to get driver recommendations
 */
export function getRecommendedDriver(
  environment: 'development' | 'production' | 'test',
  requirements: {
    spainResidencyMode?: boolean;
    airGappedMode?: boolean;
    scalability?: 'low' | 'medium' | 'high';
    complexity?: 'simple' | 'moderate' | 'complex';
  } = {}
): string {
  return driverRegistry.getRecommendedDriver(environment, requirements);
}

/**
 * Convenience function to validate driver setup
 */
export async function validateDriverSetup(
  type: string,
  config: DeploymentDriverConfig
): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
}> {
  return driverRegistry.validateDriverSetup(type, config);
}