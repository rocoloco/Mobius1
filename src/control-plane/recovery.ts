/**
 * Self-Healing and Recovery System
 * Implements automated recovery capabilities for FR-008 (Self-Healing Infrastructure)
 */

import { healthCheckService, type HealthCheckResult } from '../health/index.js';
import { appConfig } from '../config/index.js';
import type {
  RecoveryAction,
  RecoveryConfig,
  RecoveryAttemptResult,
  RecoveryCondition,
} from './types.js';
import { FailureType } from './types.js';

/**
 * Recovery Strategy Registry
 * Maps failure types to recovery configurations
 */
const RECOVERY_STRATEGIES: Map<FailureType, RecoveryConfig[]> = new Map([
  [FailureType.DATABASE_CONNECTION, [
    {
      action: 'reconnect_database',
      maxAttempts: 3,
      backoffMultiplier: 2,
      initialDelay: 1000,
      maxDelay: 10000,
      conditions: [
        { type: 'health_check_failed', threshold: 1, duration: 30 }
      ],
    },
    {
      action: 'restart_service',
      maxAttempts: 2,
      backoffMultiplier: 2,
      initialDelay: 5000,
      maxDelay: 30000,
      conditions: [
        { type: 'health_check_failed', threshold: 3, duration: 60 }
      ],
    },
  ]],
  
  [FailureType.REDIS_CONNECTION, [
    {
      action: 'clear_cache',
      maxAttempts: 2,
      backoffMultiplier: 1.5,
      initialDelay: 500,
      maxDelay: 5000,
      conditions: [
        { type: 'health_check_failed', threshold: 1, duration: 15 }
      ],
    },
    {
      action: 'restart_service',
      maxAttempts: 2,
      backoffMultiplier: 2,
      initialDelay: 2000,
      maxDelay: 15000,
      conditions: [
        { type: 'health_check_failed', threshold: 2, duration: 45 }
      ],
    },
  ]],
  
  [FailureType.HIGH_ERROR_RATE, [
    {
      action: 'clear_cache',
      maxAttempts: 1,
      backoffMultiplier: 1,
      initialDelay: 1000,
      maxDelay: 1000,
      conditions: [
        { type: 'error_rate_high', threshold: 0.1, duration: 60 }
      ],
    },
    {
      action: 'scale_up',
      maxAttempts: 2,
      backoffMultiplier: 2,
      initialDelay: 5000,
      maxDelay: 20000,
      conditions: [
        { type: 'error_rate_high', threshold: 0.2, duration: 120 }
      ],
    },
  ]],
  
  [FailureType.HIGH_RESPONSE_TIME, [
    {
      action: 'scale_up',
      maxAttempts: 2,
      backoffMultiplier: 1.5,
      initialDelay: 3000,
      maxDelay: 15000,
      conditions: [
        { type: 'response_time_high', threshold: 5000, duration: 180 }
      ],
    },
  ]],
  
  [FailureType.RESOURCE_EXHAUSTION, [
    {
      action: 'clear_cache',
      maxAttempts: 1,
      backoffMultiplier: 1,
      initialDelay: 500,
      maxDelay: 500,
      conditions: [
        { type: 'resource_exhausted', threshold: 0.9, duration: 60 }
      ],
    },
    {
      action: 'scale_up',
      maxAttempts: 2,
      backoffMultiplier: 2,
      initialDelay: 2000,
      maxDelay: 10000,
      conditions: [
        { type: 'resource_exhausted', threshold: 0.95, duration: 120 }
      ],
    },
  ]],
]);

/**
 * Recovery Manager
 * Handles automated recovery attempts for system failures
 */
export class RecoveryManager {
  private activeRecoveries = new Map<string, RecoveryAttempt>();
  private recoveryHistory = new Map<string, RecoveryAttemptResult[]>();
  private cooldownPeriods = new Map<string, Date>();

  /**
   * Attempt recovery for a specific failure
   * Implements 2-minute MTTR requirement from FR-008
   */
  async attemptRecovery(failureType: FailureType, context?: any): Promise<RecoveryAttemptResult> {
    const recoveryKey = `${failureType}-${context?.component || 'system'}`;
    
    // Check if recovery is already in progress
    if (this.activeRecoveries.has(recoveryKey)) {
      throw new Error(`Recovery already in progress for ${recoveryKey}`);
    }

    // Check cooldown period
    if (this.isInCooldown(recoveryKey)) {
      const cooldownEnd = this.cooldownPeriods.get(recoveryKey)!;
      throw new Error(`Recovery in cooldown until ${cooldownEnd.toISOString()}`);
    }

    const strategies = RECOVERY_STRATEGIES.get(failureType) || [];
    if (strategies.length === 0) {
      throw new Error(`No recovery strategy defined for failure type: ${failureType}`);
    }

    // Try each recovery strategy in order
    for (const strategy of strategies) {
      if (this.shouldAttemptRecovery(strategy, recoveryKey)) {
        const attempt = new RecoveryAttempt(strategy, recoveryKey);
        this.activeRecoveries.set(recoveryKey, attempt);

        try {
          const result = await this.executeRecoveryAction(strategy.action, context);
          this.recordRecoveryResult(recoveryKey, result);
          this.activeRecoveries.delete(recoveryKey);
          
          if (result.success) {
            return result;
          }
        } catch (error) {
          const result: RecoveryAttemptResult = {
            success: false,
            action: strategy.action,
            startTime: attempt.startTime,
            endTime: new Date(),
            duration: Date.now() - attempt.startTime.getTime(),
            error: error instanceof Error ? error.message : 'Unknown recovery error',
          };
          
          this.recordRecoveryResult(recoveryKey, result);
          this.activeRecoveries.delete(recoveryKey);
        }
      }
    }

    // All strategies failed - enter cooldown
    this.enterCooldown(recoveryKey);
    
    throw new Error(`All recovery strategies failed for ${failureType}`);
  }

  /**
   * Execute specific recovery action
   */
  private async executeRecoveryAction(
    action: RecoveryAction,
    context?: any
  ): Promise<RecoveryAttemptResult> {
    const startTime = new Date();

    try {
      switch (action) {
        case 'restart_service':
          await this.restartService(context?.service || 'unknown');
          break;
          
        case 'clear_cache':
          await this.clearCache();
          break;
          
        case 'reconnect_database':
          await this.reconnectDatabase();
          break;
          
        case 'scale_up':
          await this.scaleUp(context?.component || 'system');
          break;
          
        case 'scale_down':
          await this.scaleDown(context?.component || 'system');
          break;
          
        case 'failover':
          await this.performFailover(context?.service || 'unknown');
          break;
          
        case 'rollback':
          await this.performRollback(context?.version || 'previous');
          break;
          
        default:
          throw new Error(`Unknown recovery action: ${action}`);
      }

      const endTime = new Date();
      return {
        success: true,
        action,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
      };

    } catch (error) {
      const endTime = new Date();
      return {
        success: false,
        action,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Restart a service
   */
  private async restartService(serviceName: string): Promise<void> {
    // In a real implementation, this would restart the actual service
    // For now, simulate the restart process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verify service is healthy after restart
    const health = await healthCheckService.checkSystemHealth();
    const serviceHealth = health.checks.find(check => 
      check.service.toLowerCase().includes(serviceName.toLowerCase())
    );
    
    if (serviceHealth && serviceHealth.status !== 'healthy') {
      throw new Error(`Service ${serviceName} failed to restart properly`);
    }
  }

  /**
   * Clear system cache
   */
  private async clearCache(): Promise<void> {
    // In a real implementation, this would clear Redis cache
    // For now, simulate cache clearing
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  /**
   * Reconnect to database
   */
  private async reconnectDatabase(): Promise<void> {
    try {
      // Test database connection
      const isConnected = await healthCheckService.checkSystemHealth();
      const dbHealth = isConnected.checks.find(check => check.service === 'database');
      
      if (!dbHealth || dbHealth.status !== 'healthy') {
        throw new Error('Database reconnection failed');
      }
    } catch (error) {
      throw new Error(`Database reconnection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Scale up a component
   */
  private async scaleUp(component: string): Promise<void> {
    // In a real implementation, this would scale up the component
    // For now, simulate scaling
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  /**
   * Scale down a component
   */
  private async scaleDown(component: string): Promise<void> {
    // In a real implementation, this would scale down the component
    // For now, simulate scaling
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  /**
   * Perform failover to backup service
   */
  private async performFailover(service: string): Promise<void> {
    // In a real implementation, this would failover to backup
    // For now, simulate failover
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  /**
   * Perform rollback to previous version
   */
  private async performRollback(version: string): Promise<void> {
    // In a real implementation, this would rollback deployment
    // For now, simulate rollback
    await new Promise(resolve => setTimeout(resolve, 10000));
  }

  /**
   * Check if recovery should be attempted based on strategy conditions
   */
  private shouldAttemptRecovery(strategy: RecoveryConfig, recoveryKey: string): boolean {
    const history = this.recoveryHistory.get(recoveryKey) || [];
    const recentAttempts = history.filter(attempt => 
      attempt.action === strategy.action &&
      Date.now() - attempt.startTime.getTime() < 3600000 // Last hour
    );

    return recentAttempts.length < strategy.maxAttempts;
  }

  /**
   * Record recovery attempt result
   */
  private recordRecoveryResult(recoveryKey: string, result: RecoveryAttemptResult): void {
    if (!this.recoveryHistory.has(recoveryKey)) {
      this.recoveryHistory.set(recoveryKey, []);
    }
    
    const history = this.recoveryHistory.get(recoveryKey)!;
    history.push(result);
    
    // Keep only last 10 attempts
    if (history.length > 10) {
      history.splice(0, history.length - 10);
    }
  }

  /**
   * Check if recovery is in cooldown period
   */
  private isInCooldown(recoveryKey: string): boolean {
    const cooldownEnd = this.cooldownPeriods.get(recoveryKey);
    return cooldownEnd ? Date.now() < cooldownEnd.getTime() : false;
  }

  /**
   * Enter cooldown period after failed recovery
   */
  private enterCooldown(recoveryKey: string): void {
    const cooldownDuration = 300000; // 5 minutes
    const cooldownEnd = new Date(Date.now() + cooldownDuration);
    this.cooldownPeriods.set(recoveryKey, cooldownEnd);
  }

  /**
   * Get recovery history for a specific key
   */
  getRecoveryHistory(recoveryKey: string): RecoveryAttemptResult[] {
    return this.recoveryHistory.get(recoveryKey) || [];
  }

  /**
   * Get active recoveries
   */
  getActiveRecoveries(): string[] {
    return Array.from(this.activeRecoveries.keys());
  }

  /**
   * Clear recovery history (for testing)
   */
  clearHistory(): void {
    this.recoveryHistory.clear();
    this.cooldownPeriods.clear();
    this.activeRecoveries.clear();
  }
}

/**
 * Recovery Attempt tracking class
 */
class RecoveryAttempt {
  public readonly startTime: Date;
  public readonly strategy: RecoveryConfig;
  public readonly key: string;

  constructor(strategy: RecoveryConfig, key: string) {
    this.startTime = new Date();
    this.strategy = strategy;
    this.key = key;
  }
}

/**
 * Failure Detection System
 * Monitors system health and triggers recovery when needed
 */
export class FailureDetector {
  private healthHistory = new Map<string, HealthCheckResult[]>();
  private thresholds = {
    errorRate: 0.05, // 5% error rate threshold
    responseTime: 2000, // 2 second response time threshold
    healthCheckFailures: 3, // 3 consecutive failures
  };

  /**
   * Analyze health check results and detect failures
   */
  analyzeHealthResults(results: HealthCheckResult[]): FailureType[] {
    const failures: FailureType[] = [];

    for (const result of results) {
      // Update health history
      this.updateHealthHistory(result);

      // Check for specific failure patterns
      if (result.status === 'unhealthy') {
        const failureType = this.mapServiceToFailureType(result.service);
        if (failureType && this.isConsistentFailure(result.service)) {
          failures.push(failureType);
        }
      }

      // Check response time threshold
      if (result.responseTime > this.thresholds.responseTime) {
        failures.push(FailureType.HIGH_RESPONSE_TIME);
      }
    }

    return Array.from(new Set(failures)); // Remove duplicates
  }

  /**
   * Update health history for a service
   */
  private updateHealthHistory(result: HealthCheckResult): void {
    if (!this.healthHistory.has(result.service)) {
      this.healthHistory.set(result.service, []);
    }

    const history = this.healthHistory.get(result.service)!;
    history.push(result);

    // Keep only last 10 results
    if (history.length > 10) {
      history.splice(0, history.length - 10);
    }
  }

  /**
   * Check if failure is consistent across multiple checks
   */
  private isConsistentFailure(service: string): boolean {
    const history = this.healthHistory.get(service) || [];
    if (history.length < this.thresholds.healthCheckFailures) {
      return false;
    }

    const recentResults = history.slice(-this.thresholds.healthCheckFailures);
    return recentResults.every(result => result.status === 'unhealthy');
  }

  /**
   * Map service name to failure type
   */
  private mapServiceToFailureType(service: string): FailureType | null {
    const mapping = {
      database: FailureType.DATABASE_CONNECTION,
      redis: FailureType.REDIS_CONNECTION,
      minio: FailureType.MINIO_CONNECTION,
      qdrant: FailureType.QDRANT_CONNECTION,
    };

    return mapping[service as keyof typeof mapping] || null;
  }

  /**
   * Clear health history (for testing)
   */
  clearHistory(): void {
    this.healthHistory.clear();
  }
}

/**
 * Global recovery manager instance
 */
export const recoveryManager = new RecoveryManager();

/**
 * Global failure detector instance
 */
export const failureDetector = new FailureDetector();