/**
 * Runtime Factory
 * 
 * Factory for creating and configuring runtime service instances
 */

import { RuntimeService } from './service.js';
import { loadRuntimeConfig, validateRuntimeConfig } from './config.js';
import type { RuntimeConfig, RuntimeAPI } from './types.js';

/**
 * Create a runtime service instance with default configuration
 */
export function createRuntimeService(appConfig?: any): RuntimeAPI {
  const config = loadRuntimeConfig(appConfig);
  validateRuntimeConfig(config);
  return new RuntimeService(config);
}

/**
 * Create a runtime service instance with custom configuration
 */
export function createRuntimeServiceWithConfig(config: RuntimeConfig): RuntimeAPI {
  validateRuntimeConfig(config);
  return new RuntimeService(config);
}

/**
 * Runtime factory singleton
 */
class RuntimeFactory {
  private static instance: RuntimeAPI | null = null;

  /**
   * Get or create the singleton runtime service instance
   */
  static getInstance(appConfig?: any): RuntimeAPI {
    if (!RuntimeFactory.instance) {
      RuntimeFactory.instance = createRuntimeService(appConfig);
    }
    return RuntimeFactory.instance;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static reset(): void {
    if (RuntimeFactory.instance && 'shutdown' in RuntimeFactory.instance) {
      (RuntimeFactory.instance as RuntimeService).shutdown();
    }
    RuntimeFactory.instance = null;
  }

  /**
   * Set a custom runtime service instance
   */
  static setInstance(runtime: RuntimeAPI): void {
    if (RuntimeFactory.instance && 'shutdown' in RuntimeFactory.instance) {
      (RuntimeFactory.instance as RuntimeService).shutdown();
    }
    RuntimeFactory.instance = runtime;
  }
}

export { RuntimeFactory };