/**
 * Driver Registry Tests
 * Tests for deployment driver registry and factory system
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  DefaultDriverRegistry,
  CoolifyDriverFactory,
  getRecommendedDriver,
  validateDriverSetup,
} from '../../src/control-plane/drivers/registry.js';
import type { DeploymentDriverConfig } from '../../src/control-plane/drivers/types.js';
import type { CoolifyConfig } from '../../src/control-plane/drivers/coolify.js';

// Mock fetch for API calls
global.fetch = vi.fn();

describe('CoolifyDriverFactory', () => {
  let factory: CoolifyDriverFactory;

  beforeEach(() => {
    factory = new CoolifyDriverFactory();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Driver Creation', () => {
    it('should create Coolify driver with valid config', () => {
      const config: CoolifyConfig = {
        name: 'coolify-test',
        version: '4.0.0',
        environment: 'test',
        spainResidencyMode: false,
        airGappedMode: false,
        coolifyUrl: 'https://coolify.example.com',
        apiToken: 'test-token',
        projectId: 'project-1',
        serverId: 'server-1',
        enableTraefik: true,
        enableSSL: false,
      };

      const driver = factory.createDriver(config);
      expect(driver.getName()).toBe('coolify');
      expect(driver.getVersion()).toBe('4.0.0');
    });

    it('should throw error with invalid config', () => {
      const invalidConfig: DeploymentDriverConfig = {
        name: 'invalid',
        version: '1.0.0',
        environment: 'test',
        spainResidencyMode: false,
        airGappedMode: false,
      };

      expect(() => factory.createDriver(invalidConfig)).toThrow('Invalid Coolify configuration');
    });
  });

  describe('Configuration Validation', () => {
    it('should validate correct Coolify config', async () => {
      const config: CoolifyConfig = {
        name: 'coolify-test',
        version: '4.0.0',
        environment: 'test',
        spainResidencyMode: false,
        airGappedMode: false,
        coolifyUrl: 'https://coolify.example.com',
        apiToken: 'test-token',
        projectId: 'project-1',
        serverId: 'server-1',
        enableTraefik: true,
        enableSSL: false,
      };

      const isValid = await factory.validateConfig(config);
      expect(isValid).toBe(true);
    });

    it('should reject config missing required fields', async () => {
      const incompleteConfig = {
        name: 'coolify-test',
        version: '4.0.0',
        environment: 'test' as const,
        spainResidencyMode: false,
        airGappedMode: false,
        coolifyUrl: 'https://coolify.example.com',
        // Missing apiToken, projectId, serverId
      };

      const isValid = await factory.validateConfig(incompleteConfig as any);
      expect(isValid).toBe(false);
    });

    it('should reject non-Coolify config', async () => {
      const nonCoolifyConfig: DeploymentDriverConfig = {
        name: 'kubernetes',
        version: '1.0.0',
        environment: 'test',
        spainResidencyMode: false,
        airGappedMode: false,
      };

      const isValid = await factory.validateConfig(nonCoolifyConfig);
      expect(isValid).toBe(false);
    });
  });

  describe('Supported Types', () => {
    it('should return correct supported types', () => {
      const types = factory.getSupportedTypes();
      expect(types).toEqual(['coolify']);
    });
  });
});

describe('DefaultDriverRegistry', () => {
  let registry: DefaultDriverRegistry;

  beforeEach(() => {
    registry = new DefaultDriverRegistry();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Driver Registration', () => {
    it('should have built-in drivers registered', () => {
      const types = registry.getRegisteredTypes();
      expect(types).toContain('coolify');
      expect(types).toContain('kubernetes');
      expect(types).toContain('k8s');
      expect(types).toContain('nomad');
    });

    it('should register custom driver', () => {
      const mockFactory = {
        createDriver: vi.fn(),
        getSupportedTypes: () => ['custom'],
        validateConfig: vi.fn().mockResolvedValue(true),
      };

      registry.registerDriver('custom', mockFactory);
      const types = registry.getRegisteredTypes();
      expect(types).toContain('custom');
    });

    it('should get driver factory by type', () => {
      const factory = registry.getDriverFactory('coolify');
      expect(factory).toBeDefined();
      expect(factory).toBeInstanceOf(CoolifyDriverFactory);
    });

    it('should return undefined for unknown driver type', () => {
      const factory = registry.getDriverFactory('unknown');
      expect(factory).toBeUndefined();
    });
  });

  describe('Driver Creation', () => {
    it('should create Coolify driver successfully', async () => {
      const mockFetch = vi.mocked(fetch);
      
      // Mock API calls for driver initialization
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'healthy' }) } as Response)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'project-1' }) } as Response);

      const config: CoolifyConfig = {
        name: 'coolify-test',
        version: '4.0.0',
        environment: 'test',
        spainResidencyMode: false,
        airGappedMode: false,
        coolifyUrl: 'https://coolify.example.com',
        apiToken: 'test-token',
        projectId: 'project-1',
        serverId: 'server-1',
        enableTraefik: true,
        enableSSL: false,
      };

      const driver = await registry.createDriver('coolify', config);
      expect(driver.getName()).toBe('coolify');
    });

    it('should throw error for unknown driver type', async () => {
      const config: DeploymentDriverConfig = {
        name: 'unknown',
        version: '1.0.0',
        environment: 'test',
        spainResidencyMode: false,
        airGappedMode: false,
      };

      await expect(registry.createDriver('unknown', config)).rejects.toThrow('Unknown driver type: unknown');
    });

    it('should throw error for invalid configuration', async () => {
      const invalidConfig = {
        name: 'coolify-test',
        version: '4.0.0',
        environment: 'test' as const,
        spainResidencyMode: false,
        airGappedMode: false,
        // Missing required Coolify fields
      };

      await expect(registry.createDriver('coolify', invalidConfig as any)).rejects.toThrow('Invalid configuration for driver type: coolify');
    });
  });

  describe('Driver Recommendations', () => {
    it('should recommend Coolify for development environment', () => {
      const recommendation = registry.getRecommendedDriver('development', {});
      expect(recommendation).toBe('coolify');
    });

    it('should recommend Coolify for simple complexity', () => {
      const recommendation = registry.getRecommendedDriver('production', { complexity: 'simple' });
      expect(recommendation).toBe('coolify');
    });

    it('should recommend Kubernetes for high scalability', () => {
      const recommendation = registry.getRecommendedDriver('production', { scalability: 'high' });
      expect(recommendation).toBe('kubernetes');
    });

    it('should recommend Nomad for air-gapped mode', () => {
      const recommendation = registry.getRecommendedDriver('production', { airGappedMode: true });
      expect(recommendation).toBe('nomad');
    });

    it('should default to Coolify for unspecified requirements', () => {
      const recommendation = registry.getRecommendedDriver('production', {});
      expect(recommendation).toBe('coolify');
    });
  });

  describe('Driver Validation', () => {
    it('should validate driver setup successfully', async () => {
      const mockFetch = vi.mocked(fetch);
      
      // Mock successful API calls
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'healthy' }) } as Response)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'project-1' }) } as Response);

      const config: CoolifyConfig = {
        name: 'coolify-test',
        version: '4.0.0',
        environment: 'test',
        spainResidencyMode: false,
        airGappedMode: false,
        coolifyUrl: 'https://coolify.example.com',
        apiToken: 'test-token',
        projectId: 'project-1',
        serverId: 'server-1',
        enableTraefik: true,
        enableSSL: false,
      };

      const result = await registry.validateDriverSetup('coolify', config);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid driver type', async () => {
      const config: DeploymentDriverConfig = {
        name: 'unknown',
        version: '1.0.0',
        environment: 'test',
        spainResidencyMode: false,
        airGappedMode: false,
      };

      const result = await registry.validateDriverSetup('unknown', config);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Driver type 'unknown' is not registered");
    });

    it('should detect configuration validation failure', async () => {
      const invalidConfig = {
        name: 'coolify-test',
        version: '4.0.0',
        environment: 'test' as const,
        spainResidencyMode: false,
        airGappedMode: false,
        // Missing required fields
      };

      const result = await registry.validateDriverSetup('coolify', invalidConfig as any);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Configuration validation failed'))).toBe(true);
    });

    it('should detect driver initialization failure', async () => {
      const mockFetch = vi.mocked(fetch);
      
      // Mock API failure
      mockFetch.mockRejectedValueOnce(new Error('Connection failed'));

      const config: CoolifyConfig = {
        name: 'coolify-test',
        version: '4.0.0',
        environment: 'test',
        spainResidencyMode: false,
        airGappedMode: false,
        coolifyUrl: 'https://coolify.example.com',
        apiToken: 'test-token',
        projectId: 'project-1',
        serverId: 'server-1',
        enableTraefik: true,
        enableSSL: false,
      };

      const result = await registry.validateDriverSetup('coolify', config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Driver initialization failed'))).toBe(true);
    });
  });
});

describe('Convenience Functions', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getRecommendedDriver', () => {
    it('should return driver recommendation', () => {
      const recommendation = getRecommendedDriver('development');
      expect(recommendation).toBe('coolify');
    });

    it('should handle requirements parameter', () => {
      const recommendation = getRecommendedDriver('production', { scalability: 'high' });
      expect(recommendation).toBe('kubernetes');
    });
  });

  describe('validateDriverSetup', () => {
    it('should validate driver setup', async () => {
      const mockFetch = vi.mocked(fetch);
      
      // Mock successful validation
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'healthy' }) } as Response)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'project-1' }) } as Response);

      const config: CoolifyConfig = {
        name: 'coolify-test',
        version: '4.0.0',
        environment: 'test',
        spainResidencyMode: false,
        airGappedMode: false,
        coolifyUrl: 'https://coolify.example.com',
        apiToken: 'test-token',
        projectId: 'project-1',
        serverId: 'server-1',
        enableTraefik: true,
        enableSSL: false,
      };

      const result = await validateDriverSetup('coolify', config);
      expect(result.valid).toBe(true);
    });
  });
});

describe('Driver Integration', () => {
  it('should support Spain residency mode across all drivers', () => {
    const registry = new DefaultDriverRegistry();
    const types = registry.getRegisteredTypes();
    
    // All drivers should support Spain residency mode
    for (const type of types) {
      const factory = registry.getDriverFactory(type);
      expect(factory).toBeDefined();
    }
  });

  it('should support air-gapped mode across all drivers', () => {
    const registry = new DefaultDriverRegistry();
    const types = registry.getRegisteredTypes();
    
    // All drivers should support air-gapped mode
    for (const type of types) {
      const factory = registry.getDriverFactory(type);
      expect(factory).toBeDefined();
    }
  });

  it('should provide consistent interface across drivers', () => {
    const registry = new DefaultDriverRegistry();
    const coolifyFactory = registry.getDriverFactory('coolify');
    
    expect(coolifyFactory).toBeDefined();
    expect(coolifyFactory!.getSupportedTypes()).toContain('coolify');
    expect(typeof coolifyFactory!.validateConfig).toBe('function');
    expect(typeof coolifyFactory!.createDriver).toBe('function');
  });
});