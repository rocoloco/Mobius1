/**
 * Control Plane Orchestrator
 * Central orchestration system managing deployment, configuration, and lifecycle operations
 * Implements FR-001 (Private Deployment) and FR-008 (Self-Healing Infrastructure)
 */

import { EventEmitter } from 'events';
import { healthCheckService, type SystemHealth } from '../health/index.js';
import { deploymentManager } from './deployment.js';
import { recoveryManager, failureDetector } from './recovery.js';
import { costTracker } from './costTracker.js';
import type {
  DeploymentConfig,
  DeploymentResult,
  ValidationResult,
  SystemStatus,
  ComponentStatus,
  OrchestratorConfig,
  HealthCheckConfig,
  UsageMetrics,
  BudgetConfig,
  BudgetAlert,
  CostReport,
  DateRange,
} from './types.js';
import { FailureType } from './types.js';

/**
 * Control Plane Orchestrator Events
 */
export interface OrchestratorEvents {
  'health-check-completed': (health: SystemHealth) => void;
  'failure-detected': (failures: FailureType[]) => void;
  'recovery-started': (failureType: FailureType) => void;
  'recovery-completed': (failureType: FailureType, success: boolean) => void;
  'deployment-started': (deploymentId: string) => void;
  'deployment-completed': (result: DeploymentResult) => void;
  'system-status-changed': (status: SystemStatus) => void;
  'usage-tracked': (metrics: UsageMetrics) => void;
  'budget-alert': (alert: BudgetAlert) => void;
  'budget-exceeded': (alert: BudgetAlert) => void;
  'cost-report-generated': (report: CostReport) => void;
}

/**
 * Control Plane Orchestrator
 * Main orchestration class that coordinates all control plane operations
 */
export class ControlPlaneOrchestrator extends EventEmitter {
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private currentStatus: SystemStatus;
  private config: OrchestratorConfig;
  private isRunning = false;

  constructor(config?: Partial<OrchestratorConfig>) {
    super();
    
    this.config = {
      healthCheck: {
        interval: 30, // 30 seconds as per FR-008
        timeout: 5,
        retries: 3,
        enabled: true,
      },
      recovery: {
        enabled: true,
        maxConcurrentRecoveries: 3,
        cooldownPeriod: 300, // 5 minutes
      },
      deployment: {
        timeout: 900, // 15 minutes as per FR-001
        maxRetries: 3,
        validateDependencies: true,
      },
      costTracking: {
        enabled: true,
        aggregationInterval: 60, // 1 minute
        retentionDays: 90,
        alertCheckInterval: 300, // 5 minutes
      },
      ...config,
    };

    this.currentStatus = {
      overall: 'healthy',
      components: [],
      lastHealthCheck: new Date(),
      uptime: 0,
      recoveryInProgress: false,
    };
  }

  /**
   * Start the orchestrator
   * Begins health monitoring and self-healing processes
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Orchestrator is already running');
    }

    this.isRunning = true;

    // Perform initial health check
    await this.performHealthCheck();

    // Start periodic health checks if enabled
    if (this.config.healthCheck.enabled) {
      this.startHealthMonitoring();
    }

    // Start cost tracking if enabled
    if (this.config.costTracking.enabled) {
      this.startCostTracking();
    }

    this.emit('orchestrator-started');
  }

  /**
   * Stop the orchestrator
   * Stops all monitoring and cleanup resources
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Stop health monitoring
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Stop cost tracking
    if (this.config.costTracking.enabled) {
      this.stopCostTracking();
    }

    this.emit('orchestrator-stopped');
  }

  /**
   * Deploy infrastructure
   * Implements FR-001 requirement for 15-minute deployment
   */
  async deployInfrastructure(config: DeploymentConfig): Promise<DeploymentResult> {
    if (!this.isRunning) {
      throw new Error('Orchestrator is not running');
    }

    this.emit('deployment-started', `deploy-${Date.now()}`);

    try {
      const result = await deploymentManager.deployInfrastructure(config);
      this.emit('deployment-completed', result);
      
      // Perform health check after deployment
      if (result.success) {
        await this.performHealthCheck();
      }
      
      return result;
    } catch (error) {
      const failedResult: DeploymentResult = {
        success: false,
        deploymentId: `deploy-${Date.now()}`,
        startTime: new Date(),
        endTime: new Date(),
        duration: 0,
        components: [],
        errors: [{
          component: 'orchestrator',
          error: error instanceof Error ? error.message : 'Unknown deployment error',
          remediation: 'Check orchestrator logs and retry deployment',
          recoverable: true,
        }],
      };
      
      this.emit('deployment-completed', failedResult);
      return failedResult;
    }
  }

  /**
   * Validate deployment configuration
   */
  async validateDependencies(config: DeploymentConfig): Promise<ValidationResult> {
    return await deploymentManager['validator'].validateDeployment(config);
  }

  /**
   * Get current system health status
   */
  async getHealthStatus(): Promise<SystemHealth> {
    return await healthCheckService.checkSystemHealth();
  }

  /**
   * Get current system status
   */
  getCurrentStatus(): SystemStatus {
    return { ...this.currentStatus };
  }

  /**
   * Perform manual health check
   */
  async performHealthCheck(): Promise<SystemHealth> {
    try {
      const health = await healthCheckService.checkSystemHealth();
      
      // Update current status
      this.updateSystemStatus(health);
      
      // Detect failures and trigger recovery if needed
      if (this.config.recovery.enabled) {
        await this.handleHealthCheckResults(health);
      }
      
      this.emit('health-check-completed', health);
      return health;
      
    } catch (error) {
      const errorHealth: SystemHealth = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: [],
        uptime: process.uptime(),
      };
      
      this.updateSystemStatus(errorHealth);
      this.emit('health-check-completed', errorHealth);
      
      throw error;
    }
  }

  /**
   * Attempt recovery for specific failure type
   */
  async attemptRecovery(failureType: FailureType, context?: any): Promise<void> {
    if (!this.config.recovery.enabled) {
      throw new Error('Recovery is disabled');
    }

    this.currentStatus.recoveryInProgress = true;
    this.emit('recovery-started', failureType);

    try {
      const result = await recoveryManager.attemptRecovery(failureType, context);
      this.emit('recovery-completed', failureType, result.success);
      
      // Perform health check after recovery
      if (result.success) {
        await this.performHealthCheck();
      }
      
    } catch (error) {
      this.emit('recovery-completed', failureType, false);
      throw error;
    } finally {
      this.currentStatus.recoveryInProgress = false;
    }
  }

  /**
   * Start periodic health monitoring
   * Implements 30-second health check requirement from FR-008
   */
  private startHealthMonitoring(): void {
    const intervalMs = this.config.healthCheck.interval * 1000;
    
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        // Log error but continue monitoring
        console.error('Health check failed:', error);
      }
    }, intervalMs);
  }

  /**
   * Handle health check results and trigger recovery if needed
   */
  private async handleHealthCheckResults(health: SystemHealth): Promise<void> {
    // Detect failures from health check results
    const failures = failureDetector.analyzeHealthResults(health.checks);
    
    if (failures.length > 0) {
      this.emit('failure-detected', failures);
      
      // Attempt recovery for each detected failure
      for (const failure of failures) {
        try {
          await this.attemptRecovery(failure);
        } catch (error) {
          console.error(`Recovery failed for ${failure}:`, error);
        }
      }
    }
  }

  /**
   * Update system status based on health check results
   */
  private updateSystemStatus(health: SystemHealth): void {
    const previousStatus = this.currentStatus.overall;
    
    this.currentStatus = {
      overall: health.status,
      components: health.checks.map(check => ({
        name: check.service,
        status: check.status,
        responseTime: check.responseTime,
        lastCheck: new Date(),
        error: check.error,
        recoveryAttempts: 0, // This would be tracked separately in a real implementation
      })),
      lastHealthCheck: new Date(),
      uptime: health.uptime,
      recoveryInProgress: this.currentStatus.recoveryInProgress,
    };

    // Emit status change event if status changed
    if (previousStatus !== this.currentStatus.overall) {
      this.emit('system-status-changed', this.currentStatus);
    }
  }

  /**
   * Get orchestrator configuration
   */
  getConfig(): OrchestratorConfig {
    return { ...this.config };
  }

  /**
   * Update orchestrator configuration
   */
  updateConfig(newConfig: Partial<OrchestratorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart health monitoring if interval changed
    if (this.healthCheckInterval && newConfig.healthCheck?.interval) {
      this.stopHealthMonitoring();
      this.startHealthMonitoring();
    }
  }

  /**
   * Stop health monitoring
   */
  private stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Get recovery history
   */
  getRecoveryHistory(): any {
    return {
      activeRecoveries: recoveryManager.getActiveRecoveries(),
      // Additional recovery history would be implemented here
    };
  }

  /**
   * Check if orchestrator is running
   */
  isOrchestratorRunning(): boolean {
    return this.isRunning;
  }

  // ============================================================================
  // COST TRACKING AND BUDGET MANAGEMENT (FR-005)
  // ============================================================================

  /**
   * Track usage metrics for cost calculation
   * Implements real-time usage tracking per workspace
   */
  trackUsage(metrics: UsageMetrics): void {
    if (!this.config.costTracking.enabled) {
      return;
    }

    costTracker.trackUsage(metrics);
    this.emit('usage-tracked', metrics);
  }

  /**
   * Set budget alert configuration for workspace
   * Implements budget alert system with 80% threshold notifications
   */
  setBudgetAlert(workspaceId: string, budgetConfig: BudgetConfig): void {
    if (!this.config.costTracking.enabled) {
      throw new Error('Cost tracking is disabled');
    }

    costTracker.setBudgetConfig(budgetConfig);
  }

  /**
   * Check quota for workspace before processing
   * Returns whether request should be allowed based on budget
   */
  async checkQuota(workspaceId: string, estimatedCost: number): Promise<{
    allowed: boolean;
    remaining: number;
    budgetLimit: number;
    currentSpend: number;
  }> {
    if (!this.config.costTracking.enabled) {
      return {
        allowed: true,
        remaining: Infinity,
        budgetLimit: Infinity,
        currentSpend: 0,
      };
    }

    return await costTracker.checkQuota(workspaceId, estimatedCost);
  }

  /**
   * Generate cost report for workspace
   * Implements cost reporting and optimization recommendations
   */
  async generateCostReport(workspaceId: string, period: DateRange): Promise<CostReport> {
    if (!this.config.costTracking.enabled) {
      throw new Error('Cost tracking is disabled');
    }

    const report = await costTracker.generateCostReport(workspaceId, period);
    this.emit('cost-report-generated', report);
    return report;
  }

  /**
   * Get budget configuration for workspace
   */
  getBudgetConfig(workspaceId: string): BudgetConfig | undefined {
    if (!this.config.costTracking.enabled) {
      return undefined;
    }

    return costTracker.getBudgetConfig(workspaceId);
  }

  /**
   * Get usage statistics for workspace
   */
  getUsageStats(workspaceId: string): {
    totalRecords: number;
    totalCost: number;
    lastUpdate: Date | null;
  } {
    if (!this.config.costTracking.enabled) {
      return { totalRecords: 0, totalCost: 0, lastUpdate: null };
    }

    return costTracker.getUsageStats(workspaceId);
  }

  /**
   * Start cost tracking service
   */
  private startCostTracking(): void {
    costTracker.start();

    // Forward cost tracker events
    costTracker.on('budget-alert', (alert) => {
      this.emit('budget-alert', alert);
    });

    costTracker.on('budget-exceeded', (alert) => {
      this.emit('budget-exceeded', alert);
    });

    costTracker.on('cost-report-generated', (report) => {
      this.emit('cost-report-generated', report);
    });
  }

  /**
   * Stop cost tracking service
   */
  private stopCostTracking(): void {
    costTracker.stop();
    costTracker.removeAllListeners();
  }
}

/**
 * Create default orchestrator configuration
 */
export function createDefaultOrchestratorConfig(): OrchestratorConfig {
  return {
    healthCheck: {
      interval: 30, // 30 seconds as per FR-008
      timeout: 5,
      retries: 3,
      enabled: true,
    },
    recovery: {
      enabled: true,
      maxConcurrentRecoveries: 3,
      cooldownPeriod: 300, // 5 minutes
    },
    deployment: {
      timeout: 900, // 15 minutes as per FR-001
      maxRetries: 3,
      validateDependencies: true,
    },
    costTracking: {
      enabled: true,
      aggregationInterval: 60, // 1 minute
      retentionDays: 90,
      alertCheckInterval: 300, // 5 minutes
    },
  };
}

/**
 * Global orchestrator instance
 */
export const controlPlaneOrchestrator = new ControlPlaneOrchestrator(
  createDefaultOrchestratorConfig()
);

// Type augmentation for EventEmitter
interface ControlPlaneOrchestratorInterface {
  on<K extends keyof OrchestratorEvents>(event: K, listener: OrchestratorEvents[K]): this;
  emit<K extends keyof OrchestratorEvents>(event: K, ...args: Parameters<OrchestratorEvents[K]>): boolean;
}