/**
 * Coolify Driver Tests
 * Tests for Coolify v4+ deployment driver implementation
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CoolifyDriver, CoolifyAPIClient } from '../../src/control-plane/drivers/coolify.js';
import type { CoolifyConfig } from '../../src/control-plane/drivers/coolify.js';
import type { DeploymentConfig, ComponentConfig } from '../../src/control-plane/types.js';
import { DocumentTypeEnum, DocumentCategory } from '@prisma/client';

// Mock fetch for API calls
global.fetch = vi.fn();

describe('CoolifyAPIClient', () => {
  let apiClient: CoolifyAPIClient;
  const mockFetch = vi.mocked(fetch);

  beforeEach(() => {
    apiClient = new CoolifyAPIClient('https://coolify.example.com', 'test-token');
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Connection Testing', () => {
    it('should test connection successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'healthy' }),
      } as Response);

      const result = await apiClient.testConnection();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://coolify.example.com/api/v1/health',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
          }),
        })
      );
    });

    it('should handle connection failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await apiClient.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('Project Management', () => {
    it('should get project information', async () => {
      const mockProject = { id: 'project-1', name: 'Test Project' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockProject,
      } as Response);

      const result = await apiClient.getProject('project-1');

      expect(result).toEqual(mockProject);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://coolify.example.com/api/v1/projects/project-1',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should handle project not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
      } as Response);

      await expect(apiClient.getProject('nonexistent')).rejects.toThrow('Failed to get project: Not Found');
    });
  });

  describe('Service Management', () => {
    it('should deploy service successfully', async () => {
      const serviceConfig = {
        name: 'test-service',
        image: 'nginx',
        tag: 'latest',
        ports: [{ internal: 80, protocol: 'tcp' as const }],
        environment: { ENV: 'test' },
        volumes: [],
        networks: ['test-network'],
        resources: {},
        labels: {},
        dependencies: [],
      };

      const mockResponse = { id: 'service-1', status: 'deployed' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await apiClient.deployService('project-1', serviceConfig);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://coolify.example.com/api/v1/projects/project-1/services',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('nginx:latest'),
        })
      );
    });

    it('should get service status', async () => {
      const mockStatus = { state: 'running', health: 'healthy' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatus,
      } as Response);

      const result = await apiClient.getServiceStatus('project-1', 'test-service');

      expect(result).toEqual(mockStatus);
    });

    it('should start service', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      } as Response);

      await expect(apiClient.startService('project-1', 'test-service')).resolves.not.toThrow();
    });

    it('should restart service', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      } as Response);

      await expect(apiClient.restartService('project-1', 'test-service')).resolves.not.toThrow();
    });

    it('should get service logs', async () => {
      const mockLogs = { logs: 'Service started successfully\nListening on port 80' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockLogs,
      } as Response);

      const result = await apiClient.getServiceLogs('project-1', 'test-service', 50);

      expect(result).toBe(mockLogs.logs);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://coolify.example.com/api/v1/projects/project-1/services/test-service/logs?lines=50',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });
  });
});

describe('CoolifyDriver', () => {
  let driver: CoolifyDriver;
  let mockConfig: CoolifyConfig;
  const mockFetch = vi.mocked(fetch);

  beforeEach(() => {
    mockConfig = {
      name: 'coolify-test',
      version: '4.0.0',
      environment: 'test',
      spainResidencyMode: false,
      airGappedMode: false,
      coolifyUrl: 'https://coolify.example.com',
      apiToken: 'test-token',
      projectId: 'project-1',
      serverId: 'server-1',
      networkName: 'mobius-network',
      domain: 'example.com',
      enableTraefik: true,
      enableSSL: false,
    };

    driver = new CoolifyDriver(mockConfig);
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Driver Information', () => {
    it('should return correct driver name', () => {
      expect(driver.getName()).toBe('coolify');
    });

    it('should return correct driver version', () => {
      expect(driver.getVersion()).toBe('4.0.0');
    });
  });

  describe('Driver Initialization', () => {
    it('should initialize successfully', async () => {
      // Mock connection test
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'healthy' }),
      } as Response);

      // Mock probe capabilities
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          version: '4.0.0',
          features: { deployHooks: true, healthChecks: true, secrets: true, volumes: true, networks: true },
          limits: { maxServices: 50, maxEnvVars: 100 }
        }),
      } as Response);

      // Mock project get
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'project-1', name: 'Test Project' }),
      } as Response);

      await expect(driver.initialize()).resolves.not.toThrow();
    });

    it('should fail initialization on connection error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(driver.initialize()).rejects.toThrow('Failed to connect to Coolify API');
    });

    it('should fail initialization on invalid project', async () => {
      // Mock connection test success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'healthy' }),
      } as Response);

      // Mock probe capabilities
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          version: '4.0.0',
          features: { deployHooks: true, healthChecks: true, secrets: true, volumes: true, networks: true },
          limits: { maxServices: 50, maxEnvVars: 100 }
        }),
      } as Response);

      // Mock project get failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
      } as Response);

      await expect(driver.initialize()).rejects.toThrow('Failed to get project');
    });
  });

  describe('Deployment', () => {
    const mockDeploymentConfig: DeploymentConfig = {
      workspaceId: 'workspace-1',
      environment: 'test',
      spainResidencyMode: false,
      airGappedMode: false,
      components: [
        {
          name: 'database',
          type: 'database',
          enabled: true,
          config: {
            tag: '13',
            environment: {
              POSTGRES_DB: 'mobius',
              POSTGRES_USER: 'mobius',
              POSTGRES_PASSWORD: 'secret',
            },
          },
          dependencies: [],
        },
        {
          name: 'redis',
          type: 'redis',
          enabled: true,
          config: {
            tag: '7-alpine',
          },
          dependencies: [],
        },
        {
          name: 'gateway',
          type: 'gateway',
          enabled: true,
          config: {
            tag: 'latest',
          },
          dependencies: ['database', 'redis'],
        },
      ],
      resources: {
        cpu: { limit: '2', request: '1' },
        memory: { limit: '4Gi', request: '2Gi' },
        storage: { size: '10Gi' },
      },
    };

    it('should deploy infrastructure successfully', async () => {
      // Mock service deployments
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'db-1' }) } as Response) // deploy database
        .mockResolvedValueOnce({ ok: true } as Response) // start database
        .mockResolvedValueOnce({ ok: true, json: async () => ({ state: 'running', health: 'healthy' }) } as Response) // status database
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'redis-1' }) } as Response) // deploy redis
        .mockResolvedValueOnce({ ok: true } as Response) // start redis
        .mockResolvedValueOnce({ ok: true, json: async () => ({ state: 'running', health: 'healthy' }) } as Response) // status redis
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'gateway-1' }) } as Response) // deploy gateway
        .mockResolvedValueOnce({ ok: true } as Response) // start gateway
        .mockResolvedValueOnce({ ok: true, json: async () => ({ state: 'running', health: 'healthy' }) } as Response); // status gateway

      const result = await driver.deploy(mockDeploymentConfig);

      expect(result.success).toBe(true);
      expect(result.components).toHaveLength(3);
      expect(result.components.every(c => c.status === 'success')).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle deployment failures', async () => {
      // Mock database deployment failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      } as Response);

      const result = await driver.deploy(mockDeploymentConfig);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].component).toBe('database');
    });
  });

  describe('Health Monitoring', () => {
    beforeEach(async () => {
      // Initialize driver with mocked responses
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'healthy' }) } as Response)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ 
          version: '4.0.0',
          features: { deployHooks: true, healthChecks: true, secrets: true, volumes: true, networks: true },
          limits: { maxServices: 50, maxEnvVars: 100 }
        }) } as Response)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'project-1' }) } as Response);
      
      await driver.initialize();
    });

    it('should perform health check successfully', async () => {
      const result = await driver.healthCheck();

      expect(result.healthy).toBe(true);
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.details.driver).toBe('coolify');
    });

    it('should get deployment status', async () => {
      // Mock service status calls (no services deployed yet)
      const result = await driver.getStatus();

      expect(result.overall).toBe('healthy');
      expect(result.services).toHaveLength(0);
      expect(result.lastCheck).toBeInstanceOf(Date);
    });
  });

  describe('Service Operations', () => {
    beforeEach(async () => {
      // Initialize driver
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'healthy' }) } as Response)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ 
          version: '4.0.0',
          features: { deployHooks: true, healthChecks: true, secrets: true, volumes: true, networks: true },
          limits: { maxServices: 50, maxEnvVars: 100 }
        }) } as Response)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'project-1' }) } as Response);
      
      await driver.initialize();
    });

    it('should restart service', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true } as Response);

      await expect(driver.restart('test-service')).resolves.not.toThrow();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://coolify.example.com/api/v1/projects/project-1/services/test-service/restart',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should get service logs', async () => {
      const mockLogs = { logs: 'Service logs here' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockLogs,
      } as Response);

      const result = await driver.getLogs('test-service', 100);

      expect(result).toBe(mockLogs.logs);
    });

    it('should handle service scaling (not implemented)', async () => {
      await expect(driver.scale('test-service', 3)).rejects.toThrow('Service scaling not yet implemented');
    });
  });

  describe('Component Conversion', () => {
    it('should convert database component correctly', () => {
      const component: ComponentConfig = {
        name: 'postgres',
        type: 'database',
        enabled: true,
        config: {
          tag: '13',
          environment: {
            POSTGRES_DB: 'mobius',
            POSTGRES_USER: 'mobius',
          },
        },
        dependencies: [],
      };

      const driver = new CoolifyDriver(mockConfig);
      const serviceConfig = (driver as any).convertComponentToService(component);

      expect(serviceConfig.name).toBe('postgres');
      expect(serviceConfig.image).toBe('postgres');
      expect(serviceConfig.tag).toBe('13');
      expect(serviceConfig.ports).toEqual([{ internal: 5432, protocol: 'tcp' }]);
      expect(serviceConfig.environment).toEqual(component.config.environment);
      expect(serviceConfig.healthCheck).toBeDefined();
      expect(serviceConfig.healthCheck?.test.join(' ')).toContain('pg_isready');
    });

    it('should convert gateway component with Traefik labels', () => {
      const component: ComponentConfig = {
        name: 'api-gateway',
        type: 'gateway',
        enabled: true,
        config: { tag: 'latest' },
        dependencies: ['database'],
      };

      const driver = new CoolifyDriver(mockConfig);
      const serviceConfig = (driver as any).convertComponentToService(component);

      expect(serviceConfig.name).toBe('api-gateway');
      expect(serviceConfig.image).toBe('mobius/gateway');
      expect(serviceConfig.labels['traefik.enable']).toBe('true');
      expect(serviceConfig.dependencies).toContain('database');
    });
  });

  describe('Spain Residency Mode', () => {
    it('should handle Spain residency mode configuration', () => {
      const spainConfig: CoolifyConfig = {
        ...mockConfig,
        spainResidencyMode: true,
      };

      const spainDriver = new CoolifyDriver(spainConfig);
      expect(spainDriver.getName()).toBe('coolify');
      // Additional Spain-specific validation would be tested here
    });
  });

  describe('Air-Gapped Mode', () => {
    it('should handle air-gapped mode configuration', () => {
      const airGappedConfig: CoolifyConfig = {
        ...mockConfig,
        airGappedMode: true,
      };

      const airGappedDriver = new CoolifyDriver(airGappedConfig);
      expect(airGappedDriver.getName()).toBe('coolify');
      // Additional air-gapped specific validation would be tested here
    });
  });
});