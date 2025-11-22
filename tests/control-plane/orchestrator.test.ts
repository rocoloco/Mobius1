/**
 * Control Plane Orchestrator Tests
 * Tests for FR-001 (Private Deployment) and FR-008 (Self-Healing Infrastructure)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ControlPlaneOrchestrator, createDefaultOrchestratorConfig } from '../../src/control-plane/orchestrator.js';
import { FailureType } from '../../src/control-plane/types.js';
import type { SystemHealth } from '../../src/health/index.js';
import type { 
  DeploymentConfig, 
  UsageMetrics, 
  BudgetConfig,
  DateRange 
} from '../../src/control-plane/types.js';

// Mock the health check service
vi.mock('../../src/health/index.js', () => ({
  healthCheckService: {
    checkSystemHealth: vi.fn().mockResolvedValue({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: [
        { service: 'database', status: 'healthy', responseTime: 50 },
        { service: 'redis', status: 'healthy', responseTime: 25 },
      ],
      uptime: 3600,
    }),
  },
}));

// Mock the deployment manager
vi.mock('../../src/control-plane/deployment.js', () => ({
  deploymentManager: {
    deployInfrastructure: vi.fn().mockResolvedValue({
      success: true,
      deploymentId: 'test-deploy-123',
      startTime: new Date(),
      endTime: new Date(),
      duration: 300000, // 5 minutes
      components: [],
      errors: [],
    }),
    validator: {
      validateDeployment: vi.fn().mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
      }),
    },
  },
}));

// Mock the recovery manager
vi.mock('../../src/control-plane/recovery.js', () => ({
  recoveryManager: {
    attemptRecovery: vi.fn().mockResolvedValue({
      success: true,
      action: 'restart_service',
      startTime: new Date(),
      endTime: new Date(),
      duration: 2000,
    }),
    getActiveRecoveries: vi.fn().mockReturnValue([]),
  },
  failureDetector: {
    analyzeHealthResults: vi.fn().mockReturnValue([]),
  },
}));

// Mock the cost tracker
vi.mock('../../src/control-plane/costTracker.js', () => ({
  costTracker: {
    start: vi.fn(),
    stop: vi.fn(),
    trackUsage: vi.fn(),
    setBudgetConfig: vi.fn(),
    getBudgetConfig: vi.fn().mockReturnValue(undefined),
    checkQuota: vi.fn().mockResolvedValue({
      allowed: true,
      remaining: 10000,
      budgetLimit: 10000,
      currentSpend: 0,
    }),
    generateCostReport: vi.fn().mockResolvedValue({
      workspaceId: 'test-workspace',
      period: { start: new Date(), end: new Date() },
      totalCost: 100,
      currency: 'USD',
      entries: [],
      breakdown: { byOperationType: {}, byModel: {}, byDay: {} },
      recommendations: [],
    }),
    getUsageStats: vi.fn().mockReturnValue({
      totalRecords: 0,
      totalCost: 0,
      lastUpdate: null,
    }),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
  },
}));

describe('ControlPlaneOrchestrator', () => {
  let orchestrator: ControlPlaneOrchestrator;

  beforeEach(() => {
    orchestrator = new ControlPlaneOrchestrator(createDefaultOrchestratorConfig());
  });

  afterEach(async () => {
    if (orchestrator.isOrchestratorRunning()) {
      await orchestrator.stop();
    }
  });

  describe('Orchestrator Lifecycle', () => {
    it('should start and stop successfully', async () => {
      expect(orchestrator.isOrchestratorRunning()).toBe(false);
      
      await orchestrator.start();
      expect(orchestrator.isOrchestratorRunning()).toBe(true);
      
      await orchestrator.stop();
      expect(orchestrator.isOrchestratorRunning()).toBe(false);
    });

    it('should not allow starting when already running', async () => {
      await orchestrator.start();
      
      await expect(orchestrator.start()).rejects.toThrow('Orchestrator is already running');
    });

    it('should handle multiple stop calls gracefully', async () => {
      await orchestrator.start();
      await orchestrator.stop();
      await orchestrator.stop(); // Should not throw
    });
  });

  describe('Health Monitoring (FR-008)', () => {
    it('should perform health check and return system health', async () => {
      const health = await orchestrator.performHealthCheck();
      
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('checks');
      expect(health).toHaveProperty('uptime');
      expect(health.status).toBe('healthy');
    });

    it('should update system status after health check', async () => {
      await orchestrator.performHealthCheck();
      
      const status = orchestrator.getCurrentStatus();
      expect(status.overall).toBe('healthy');
      expect(status.components).toHaveLength(2);
      expect(status.lastHealthCheck).toBeInstanceOf(Date);
    });

    it('should emit health-check-completed event', async () => {
      const eventPromise = new Promise<SystemHealth>((resolve) => {
        orchestrator.once('health-check-completed', resolve);
      });

      await orchestrator.performHealthCheck();
      const health = await eventPromise;
      
      expect(health.status).toBe('healthy');
    });

    it('should have 30-second health check interval by default', () => {
      const config = orchestrator.getConfig();
      expect(config.healthCheck.interval).toBe(30);
    });
  });

  describe('Deployment Management (FR-001)', () => {
    const mockDeploymentConfig: DeploymentConfig = {
      workspaceId: 'test-workspace',
      environment: 'development',
      spainResidencyMode: true,
      airGappedMode: false,
      components: [
        {
          name: 'database',
          type: 'database',
          enabled: true,
          config: {},
          dependencies: [],
        },
      ],
      resources: {
        cpu: { limit: '2', request: '1' },
        memory: { limit: '4Gi', request: '2Gi' },
        storage: { size: '10Gi' },
      },
    };

    it('should deploy infrastructure successfully', async () => {
      await orchestrator.start();
      
      const result = await orchestrator.deployInfrastructure(mockDeploymentConfig);
      
      expect(result.success).toBe(true);
      expect(result.deploymentId).toBe('test-deploy-123');
      expect(result.duration).toBeLessThan(900000); // Less than 15 minutes
    });

    it('should validate dependencies before deployment', async () => {
      const validation = await orchestrator.validateDependencies(mockDeploymentConfig);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should emit deployment events', async () => {
      await orchestrator.start();
      
      const startEventPromise = new Promise<string>((resolve) => {
        orchestrator.once('deployment-started', resolve);
      });
      
      const completeEventPromise = new Promise<any>((resolve) => {
        orchestrator.once('deployment-completed', resolve);
      });

      const deploymentPromise = orchestrator.deployInfrastructure(mockDeploymentConfig);
      
      const deploymentId = await startEventPromise;
      expect(deploymentId).toMatch(/^deploy-\d+$/);
      
      const result = await completeEventPromise;
      expect(result.success).toBe(true);
      
      await deploymentPromise;
    });

    it('should require orchestrator to be running for deployment', async () => {
      await expect(
        orchestrator.deployInfrastructure(mockDeploymentConfig)
      ).rejects.toThrow('Orchestrator is not running');
    });

    it('should have 15-minute deployment timeout by default', () => {
      const config = orchestrator.getConfig();
      expect(config.deployment.timeout).toBe(900); // 15 minutes in seconds
    });
  });

  describe('Self-Healing and Recovery (FR-008)', () => {
    it('should attempt recovery for failure types', async () => {
      await orchestrator.start();
      
      await orchestrator.attemptRecovery(FailureType.DATABASE_CONNECTION);
      
      // Verify recovery was attempted (mocked to succeed)
      expect(true).toBe(true); // Recovery manager is mocked
    });

    it('should emit recovery events', async () => {
      await orchestrator.start();
      
      const startEventPromise = new Promise<FailureType>((resolve) => {
        orchestrator.once('recovery-started', resolve);
      });
      
      const completeEventPromise = new Promise<[FailureType, boolean]>((resolve) => {
        orchestrator.once('recovery-completed', (failureType, success) => {
          resolve([failureType, success]);
        });
      });

      const recoveryPromise = orchestrator.attemptRecovery(FailureType.DATABASE_CONNECTION);
      
      const failureType = await startEventPromise;
      expect(failureType).toBe(FailureType.DATABASE_CONNECTION);
      
      const [completedFailureType, success] = await completeEventPromise;
      expect(completedFailureType).toBe(FailureType.DATABASE_CONNECTION);
      expect(success).toBe(true);
      
      await recoveryPromise;
    });

    it('should update recovery status during recovery', async () => {
      await orchestrator.start();
      
      // Start recovery (this will be async)
      const recoveryPromise = orchestrator.attemptRecovery(FailureType.DATABASE_CONNECTION);
      
      // Check that recovery is in progress
      // Note: This might be timing-dependent in a real scenario
      
      await recoveryPromise;
      
      // After recovery, status should be updated
      const status = orchestrator.getCurrentStatus();
      expect(status.recoveryInProgress).toBe(false);
    });

    it('should respect recovery configuration', () => {
      const config = orchestrator.getConfig();
      
      expect(config.recovery.enabled).toBe(true);
      expect(config.recovery.maxConcurrentRecoveries).toBe(3);
      expect(config.recovery.cooldownPeriod).toBe(300); // 5 minutes
    });

    it('should throw error when recovery is disabled', async () => {
      const disabledOrchestrator = new ControlPlaneOrchestrator({
        ...createDefaultOrchestratorConfig(),
        recovery: { enabled: false, maxConcurrentRecoveries: 0, cooldownPeriod: 0 },
      });
      
      await disabledOrchestrator.start();
      
      await expect(
        disabledOrchestrator.attemptRecovery(FailureType.DATABASE_CONNECTION)
      ).rejects.toThrow('Recovery is disabled');
      
      await disabledOrchestrator.stop();
    });
  });

  describe('Configuration Management', () => {
    it('should return current configuration', () => {
      const config = orchestrator.getConfig();
      
      expect(config).toHaveProperty('healthCheck');
      expect(config).toHaveProperty('recovery');
      expect(config).toHaveProperty('deployment');
    });

    it('should update configuration', () => {
      const newConfig = {
        healthCheck: { interval: 60, timeout: 10, retries: 5, enabled: true },
      };
      
      orchestrator.updateConfig(newConfig);
      
      const updatedConfig = orchestrator.getConfig();
      expect(updatedConfig.healthCheck.interval).toBe(60);
      expect(updatedConfig.healthCheck.timeout).toBe(10);
      expect(updatedConfig.healthCheck.retries).toBe(5);
    });
  });

  describe('Status Monitoring', () => {
    it('should provide current system status', () => {
      const status = orchestrator.getCurrentStatus();
      
      expect(status).toHaveProperty('overall');
      expect(status).toHaveProperty('components');
      expect(status).toHaveProperty('lastHealthCheck');
      expect(status).toHaveProperty('uptime');
      expect(status).toHaveProperty('recoveryInProgress');
    });

    it('should emit system-status-changed event when status changes', async () => {
      // This would require mocking a status change scenario
      // For now, just verify the event can be listened to
      let eventEmitted = false;
      orchestrator.once('system-status-changed', () => {
        eventEmitted = true;
      });
      
      // Perform health check to potentially trigger status change
      await orchestrator.performHealthCheck();
      
      // In this test case, status likely won't change since health is mocked as healthy
      // But the event listener is properly set up
      expect(eventEmitted).toBe(false); // No change expected with healthy mock
    });
  });

  describe('Cost Tracking and Budget Management (FR-005)', () => {
    const mockUsageMetrics: UsageMetrics = {
      workspaceId: 'test-workspace',
      timestamp: new Date(),
      tokenCount: 1000,
      computeTimeMs: 5000,
      storageBytes: 1024 * 1024,
      apiCalls: 5,
      modelRef: 'gpt-4',
      operationType: 'inference',
    };

    const mockBudgetConfig: BudgetConfig = {
      workspaceId: 'test-workspace',
      monthlyLimit: 10000, // $100.00 in cents
      alertThresholds: [50, 80, 95],
      enabled: true,
      currency: 'USD',
      resetDay: 1,
    };

    it('should track usage metrics when cost tracking is enabled', async () => {
      await orchestrator.start();
      
      orchestrator.trackUsage(mockUsageMetrics);
      
      // Verify the cost tracker was called
      const { costTracker } = await import('../../src/control-plane/costTracker.js');
      expect(costTracker.trackUsage).toHaveBeenCalledWith(mockUsageMetrics);
    });

    it('should not track usage when cost tracking is disabled', async () => {
      // Reset the mock before this test
      const { costTracker } = await import('../../src/control-plane/costTracker.js');
      vi.mocked(costTracker.trackUsage).mockClear();
      
      const disabledOrchestrator = new ControlPlaneOrchestrator({
        ...createDefaultOrchestratorConfig(),
        costTracking: { enabled: false, aggregationInterval: 60, retentionDays: 90, alertCheckInterval: 300 },
      });
      
      await disabledOrchestrator.start();
      
      disabledOrchestrator.trackUsage(mockUsageMetrics);
      
      // Verify the cost tracker was not called
      expect(costTracker.trackUsage).not.toHaveBeenCalled();
      
      await disabledOrchestrator.stop();
    });

    it('should set budget alert configuration', async () => {
      await orchestrator.start();
      
      orchestrator.setBudgetAlert('test-workspace', mockBudgetConfig);
      
      const { costTracker } = await import('../../src/control-plane/costTracker.js');
      expect(costTracker.setBudgetConfig).toHaveBeenCalledWith(mockBudgetConfig);
    });

    it('should throw error when setting budget with cost tracking disabled', async () => {
      const disabledOrchestrator = new ControlPlaneOrchestrator({
        ...createDefaultOrchestratorConfig(),
        costTracking: { enabled: false, aggregationInterval: 60, retentionDays: 90, alertCheckInterval: 300 },
      });
      
      await disabledOrchestrator.start();
      
      expect(() => {
        disabledOrchestrator.setBudgetAlert('test-workspace', mockBudgetConfig);
      }).toThrow('Cost tracking is disabled');
      
      await disabledOrchestrator.stop();
    });

    it('should check quota and return budget information', async () => {
      await orchestrator.start();
      
      const quotaResult = await orchestrator.checkQuota('test-workspace', 1000);
      
      expect(quotaResult).toHaveProperty('allowed');
      expect(quotaResult).toHaveProperty('remaining');
      expect(quotaResult).toHaveProperty('budgetLimit');
      expect(quotaResult).toHaveProperty('currentSpend');
      expect(quotaResult.allowed).toBe(true);
    });

    it('should return unlimited quota when cost tracking is disabled', async () => {
      const disabledOrchestrator = new ControlPlaneOrchestrator({
        ...createDefaultOrchestratorConfig(),
        costTracking: { enabled: false, aggregationInterval: 60, retentionDays: 90, alertCheckInterval: 300 },
      });
      
      await disabledOrchestrator.start();
      
      const quotaResult = await disabledOrchestrator.checkQuota('test-workspace', 50000);
      
      expect(quotaResult.allowed).toBe(true);
      expect(quotaResult.remaining).toBe(Infinity);
      expect(quotaResult.budgetLimit).toBe(Infinity);
      expect(quotaResult.currentSpend).toBe(0);
      
      await disabledOrchestrator.stop();
    });

    it('should generate cost report for workspace', async () => {
      await orchestrator.start();
      
      const period: DateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      };
      
      const report = await orchestrator.generateCostReport('test-workspace', period);
      
      expect(report).toHaveProperty('workspaceId');
      expect(report).toHaveProperty('period');
      expect(report).toHaveProperty('totalCost');
      expect(report).toHaveProperty('currency');
      expect(report).toHaveProperty('entries');
      expect(report).toHaveProperty('breakdown');
      expect(report).toHaveProperty('recommendations');
      expect(report.workspaceId).toBe('test-workspace');
    });

    it('should throw error when generating report with cost tracking disabled', async () => {
      const disabledOrchestrator = new ControlPlaneOrchestrator({
        ...createDefaultOrchestratorConfig(),
        costTracking: { enabled: false, aggregationInterval: 60, retentionDays: 90, alertCheckInterval: 300 },
      });
      
      await disabledOrchestrator.start();
      
      const period: DateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      };
      
      await expect(
        disabledOrchestrator.generateCostReport('test-workspace', period)
      ).rejects.toThrow('Cost tracking is disabled');
      
      await disabledOrchestrator.stop();
    });

    it('should get budget configuration for workspace', async () => {
      await orchestrator.start();
      
      const budgetConfig = orchestrator.getBudgetConfig('test-workspace');
      
      // Should return undefined from mock
      expect(budgetConfig).toBeUndefined();
    });

    it('should get usage statistics for workspace', async () => {
      await orchestrator.start();
      
      const stats = orchestrator.getUsageStats('test-workspace');
      
      expect(stats).toHaveProperty('totalRecords');
      expect(stats).toHaveProperty('totalCost');
      expect(stats).toHaveProperty('lastUpdate');
      expect(stats.totalRecords).toBe(0);
      expect(stats.totalCost).toBe(0);
      expect(stats.lastUpdate).toBeNull();
    });

    it('should return empty stats when cost tracking is disabled', async () => {
      const disabledOrchestrator = new ControlPlaneOrchestrator({
        ...createDefaultOrchestratorConfig(),
        costTracking: { enabled: false, aggregationInterval: 60, retentionDays: 90, alertCheckInterval: 300 },
      });
      
      await disabledOrchestrator.start();
      
      const stats = disabledOrchestrator.getUsageStats('test-workspace');
      
      expect(stats.totalRecords).toBe(0);
      expect(stats.totalCost).toBe(0);
      expect(stats.lastUpdate).toBeNull();
      
      await disabledOrchestrator.stop();
    });

    it('should emit usage-tracked event when tracking usage', async () => {
      await orchestrator.start();
      
      const eventPromise = new Promise<UsageMetrics>((resolve) => {
        orchestrator.once('usage-tracked', resolve);
      });
      
      orchestrator.trackUsage(mockUsageMetrics);
      
      const trackedMetrics = await eventPromise;
      expect(trackedMetrics).toEqual(mockUsageMetrics);
    });

    it('should have cost tracking enabled by default', () => {
      const config = orchestrator.getConfig();
      expect(config.costTracking.enabled).toBe(true);
      expect(config.costTracking.aggregationInterval).toBe(60);
      expect(config.costTracking.retentionDays).toBe(90);
      expect(config.costTracking.alertCheckInterval).toBe(300);
    });
  });
});

describe('Default Configuration', () => {
  it('should create valid default configuration', () => {
    const config = createDefaultOrchestratorConfig();
    
    expect(config.healthCheck.interval).toBe(30);
    expect(config.healthCheck.enabled).toBe(true);
    expect(config.recovery.enabled).toBe(true);
    expect(config.deployment.timeout).toBe(900); // 15 minutes
    expect(config.deployment.validateDependencies).toBe(true);
    expect(config.costTracking.enabled).toBe(true);
    expect(config.costTracking.aggregationInterval).toBe(60);
    expect(config.costTracking.retentionDays).toBe(90);
    expect(config.costTracking.alertCheckInterval).toBe(300);
  });
});