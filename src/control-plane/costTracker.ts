/**
 * Cost Tracking Service
 * Implements FR-005 (Cost Governance and Budget Alerts)
 * Real-time usage tracking per workspace with budget alerts
 */

import { EventEmitter } from 'events';
import type {
  UsageMetrics,
  BudgetConfig,
  BudgetAlert,
  CostReport,
  CostReportEntry,
  CostOptimizationRecommendation,
  DateRange,
} from './types.js';

/**
 * Cost tracking events
 */
export interface CostTrackerEvents {
  'usage-tracked': (metrics: UsageMetrics) => void;
  'budget-alert': (alert: BudgetAlert) => void;
  'budget-exceeded': (alert: BudgetAlert) => void;
  'cost-report-generated': (report: CostReport) => void;
}

/**
 * Pricing configuration for different operations
 */
interface PricingConfig {
  tokenPricing: {
    [modelRef: string]: {
      inputTokens: number; // cost per 1k tokens in cents
      outputTokens: number; // cost per 1k tokens in cents
    };
  };
  computePricing: {
    cpuPerHour: number; // cost per CPU hour in cents
    gpuPerHour: number; // cost per GPU hour in cents
  };
  storagePricing: {
    perGbMonth: number; // cost per GB per month in cents
  };
  apiPricing: {
    perCall: number; // cost per API call in cents
  };
}

/**
 * Usage aggregation for efficient storage
 */
interface UsageAggregation {
  workspaceId: string;
  date: Date; // truncated to day
  operationType: string;
  modelRef?: string;
  totalTokens: number;
  totalComputeMs: number;
  totalStorageBytes: number;
  totalApiCalls: number;
  totalCost: number;
  recordCount: number;
}

/**
 * Cost Tracking Service
 * Provides real-time usage tracking and budget management
 */
export class CostTracker extends EventEmitter {
  private usageBuffer: UsageMetrics[] = [];
  private budgetConfigs = new Map<string, BudgetConfig>();
  private usageAggregations = new Map<string, UsageAggregation>();
  private lastBudgetCheck = new Map<string, Date>();
  
  private aggregationInterval: NodeJS.Timeout | null = null;
  private budgetCheckInterval: NodeJS.Timeout | null = null;
  
  private readonly pricingConfig: PricingConfig;
  private readonly config: {
    aggregationInterval: number;
    retentionDays: number;
    alertCheckInterval: number;
  };

  constructor(config: {
    aggregationInterval: number;
    retentionDays: number;
    alertCheckInterval: number;
  }) {
    super();
    
    this.config = config;
    
    // Default pricing configuration
    this.pricingConfig = {
      tokenPricing: {
        'gpt-4': { inputTokens: 3, outputTokens: 6 }, // $0.03/$0.06 per 1k tokens
        'gpt-3.5-turbo': { inputTokens: 0.15, outputTokens: 0.2 }, // $0.0015/$0.002 per 1k tokens
        'claude-3': { inputTokens: 1.5, outputTokens: 7.5 }, // $0.015/$0.075 per 1k tokens
        'llama-2-70b': { inputTokens: 0.65, outputTokens: 0.8 }, // $0.0065/$0.008 per 1k tokens
        'default': { inputTokens: 1, outputTokens: 2 }, // Default pricing
      },
      computePricing: {
        cpuPerHour: 10, // $0.10 per CPU hour
        gpuPerHour: 150, // $1.50 per GPU hour
      },
      storagePricing: {
        perGbMonth: 2, // $0.02 per GB per month
      },
      apiPricing: {
        perCall: 0.1, // $0.001 per API call (0.1 cents)
      },
    };
  }

  /**
   * Start cost tracking service
   */
  start(): void {
    // Start aggregation interval
    this.aggregationInterval = setInterval(() => {
      this.aggregateUsage();
    }, this.config.aggregationInterval * 1000);

    // Start budget check interval
    this.budgetCheckInterval = setInterval(() => {
      this.checkBudgetAlerts();
    }, this.config.alertCheckInterval * 1000);
  }

  /**
   * Stop cost tracking service
   */
  stop(): void {
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
      this.aggregationInterval = null;
    }

    if (this.budgetCheckInterval) {
      clearInterval(this.budgetCheckInterval);
      this.budgetCheckInterval = null;
    }

    // Final aggregation before stopping
    this.aggregateUsage();
  }

  /**
   * Track usage metrics
   * Implements real-time usage tracking per workspace
   */
  trackUsage(metrics: UsageMetrics): void {
    // Add to buffer for aggregation
    this.usageBuffer.push(metrics);
    
    // Calculate cost for this usage
    const cost = this.calculateUsageCost(metrics);
    
    // Emit usage tracked event
    this.emit('usage-tracked', { ...metrics, cost } as any);

    // Check if immediate budget alert is needed (for critical thresholds)
    this.checkImmediateBudgetAlert(metrics.workspaceId, cost);
  }

  /**
   * Set budget configuration for workspace
   */
  setBudgetConfig(config: BudgetConfig): void {
    this.budgetConfigs.set(config.workspaceId, config);
  }

  /**
   * Get budget configuration for workspace
   */
  getBudgetConfig(workspaceId: string): BudgetConfig | undefined {
    return this.budgetConfigs.get(workspaceId);
  }

  /**
   * Check quota for workspace
   * Returns remaining budget and whether request should be allowed
   */
  async checkQuota(workspaceId: string, estimatedCost: number): Promise<{
    allowed: boolean;
    remaining: number;
    budgetLimit: number;
    currentSpend: number;
  }> {
    const budgetConfig = this.budgetConfigs.get(workspaceId);
    
    if (!budgetConfig || !budgetConfig.enabled) {
      return {
        allowed: true,
        remaining: Infinity,
        budgetLimit: Infinity,
        currentSpend: 0,
      };
    }

    const currentSpend = await this.getCurrentMonthSpend(workspaceId);
    const projectedSpend = currentSpend + estimatedCost;
    const remaining = budgetConfig.monthlyLimit - currentSpend;

    return {
      allowed: projectedSpend <= budgetConfig.monthlyLimit,
      remaining: Math.max(0, remaining),
      budgetLimit: budgetConfig.monthlyLimit,
      currentSpend,
    };
  }

  /**
   * Generate cost report for workspace
   */
  async generateCostReport(workspaceId: string, period: DateRange): Promise<CostReport> {
    const entries = await this.getCostEntries(workspaceId, period);
    const totalCost = entries.reduce((sum, entry) => sum + entry.cost, 0);
    
    // Calculate breakdowns
    const byOperationType: Record<string, number> = {};
    const byModel: Record<string, number> = {};
    const byDay: Record<string, number> = {};

    entries.forEach(entry => {
      // By operation type
      byOperationType[entry.operationType] = (byOperationType[entry.operationType] || 0) + entry.cost;
      
      // By model
      if (entry.modelRef) {
        byModel[entry.modelRef] = (byModel[entry.modelRef] || 0) + entry.cost;
      }
      
      // By day
      const dayKey = entry.date.toISOString().split('T')[0];
      byDay[dayKey] = (byDay[dayKey] || 0) + entry.cost;
    });

    // Generate recommendations
    const recommendations = this.generateOptimizationRecommendations(entries, byOperationType, byModel);

    const report: CostReport = {
      workspaceId,
      period,
      totalCost,
      currency: 'USD',
      entries,
      breakdown: {
        byOperationType,
        byModel,
        byDay,
      },
      recommendations,
    };

    this.emit('cost-report-generated', report);
    return report;
  }

  /**
   * Get current month spend for workspace
   */
  private async getCurrentMonthSpend(workspaceId: string): Promise<number> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const entries = await this.getCostEntries(workspaceId, {
      start: monthStart,
      end: monthEnd,
    });

    return entries.reduce((sum, entry) => sum + entry.cost, 0);
  }

  /**
   * Calculate cost for usage metrics
   */
  private calculateUsageCost(metrics: UsageMetrics): number {
    let cost = 0;

    switch (metrics.operationType) {
      case 'inference':
        const modelPricing = this.pricingConfig.tokenPricing[metrics.modelRef || 'default'] || 
                           this.pricingConfig.tokenPricing.default;
        
        // Assume 50/50 split between input and output tokens for simplicity
        const inputTokens = metrics.tokenCount * 0.5;
        const outputTokens = metrics.tokenCount * 0.5;
        
        cost += (inputTokens / 1000) * modelPricing.inputTokens;
        cost += (outputTokens / 1000) * modelPricing.outputTokens;
        
        // Add compute cost
        const computeHours = metrics.computeTimeMs / (1000 * 60 * 60);
        cost += computeHours * this.pricingConfig.computePricing.gpuPerHour;
        break;

      case 'storage':
        const storageGb = metrics.storageBytes / (1024 * 1024 * 1024);
        const storageMonths = 1 / 30; // Assume daily storage cost
        cost += storageGb * storageMonths * this.pricingConfig.storagePricing.perGbMonth;
        break;

      case 'api':
        cost += metrics.apiCalls * this.pricingConfig.apiPricing.perCall;
        break;

      default:
        // Default compute pricing
        const defaultComputeHours = metrics.computeTimeMs / (1000 * 60 * 60);
        cost += defaultComputeHours * this.pricingConfig.computePricing.cpuPerHour;
    }

    return Math.round(cost * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Aggregate usage metrics for efficient storage
   */
  private aggregateUsage(): void {
    if (this.usageBuffer.length === 0) {
      return;
    }

    const buffer = [...this.usageBuffer];
    this.usageBuffer = [];

    // Group by workspace, date, operation type, and model
    const aggregationMap = new Map<string, UsageAggregation>();

    buffer.forEach(metrics => {
      const cost = this.calculateUsageCost(metrics);
      const date = new Date(metrics.timestamp);
      date.setHours(0, 0, 0, 0); // Truncate to day
      
      const key = `${metrics.workspaceId}-${date.toISOString()}-${metrics.operationType}-${metrics.modelRef || 'none'}`;
      
      const existing = aggregationMap.get(key);
      if (existing) {
        existing.totalTokens += metrics.tokenCount;
        existing.totalComputeMs += metrics.computeTimeMs;
        existing.totalStorageBytes += metrics.storageBytes;
        existing.totalApiCalls += metrics.apiCalls;
        existing.totalCost += cost;
        existing.recordCount += 1;
      } else {
        aggregationMap.set(key, {
          workspaceId: metrics.workspaceId,
          date,
          operationType: metrics.operationType,
          modelRef: metrics.modelRef,
          totalTokens: metrics.tokenCount,
          totalComputeMs: metrics.computeTimeMs,
          totalStorageBytes: metrics.storageBytes,
          totalApiCalls: metrics.apiCalls,
          totalCost: cost,
          recordCount: 1,
        });
      }
    });

    // Store aggregations (in a real implementation, this would go to a database)
    aggregationMap.forEach((aggregation, key) => {
      this.usageAggregations.set(key, aggregation);
    });
  }

  /**
   * Check for immediate budget alerts (critical thresholds)
   */
  private checkImmediateBudgetAlert(workspaceId: string, additionalCost: number): void {
    const budgetConfig = this.budgetConfigs.get(workspaceId);
    if (!budgetConfig || !budgetConfig.enabled) {
      return;
    }

    // Only check for critical threshold (95%) for immediate alerts
    const criticalThreshold = Math.max(...budgetConfig.alertThresholds);
    if (criticalThreshold < 95) {
      return;
    }

    // This is a simplified check - in production, you'd query the database
    this.getCurrentMonthSpend(workspaceId).then(currentSpend => {
      const projectedSpend = currentSpend + additionalCost;
      const percentage = (projectedSpend / budgetConfig.monthlyLimit) * 100;

      if (percentage >= criticalThreshold) {
        const alert: BudgetAlert = {
          workspaceId,
          currentSpend: projectedSpend,
          budgetLimit: budgetConfig.monthlyLimit,
          threshold: criticalThreshold,
          alertType: percentage >= 100 ? 'exceeded' : 'critical',
          timestamp: new Date(),
          period: this.getCurrentMonthPeriod(),
        };

        this.emit(percentage >= 100 ? 'budget-exceeded' : 'budget-alert', alert);
      }
    });
  }

  /**
   * Check budget alerts for all workspaces
   * Implements 80% threshold notifications as per FR-005
   */
  private async checkBudgetAlerts(): Promise<void> {
    for (const [workspaceId, budgetConfig] of this.budgetConfigs) {
      if (!budgetConfig.enabled) {
        continue;
      }

      const lastCheck = this.lastBudgetCheck.get(workspaceId);
      const now = new Date();
      
      // Check at most once per hour to avoid spam
      if (lastCheck && (now.getTime() - lastCheck.getTime()) < 60 * 60 * 1000) {
        continue;
      }

      try {
        const currentSpend = await this.getCurrentMonthSpend(workspaceId);
        const percentage = (currentSpend / budgetConfig.monthlyLimit) * 100;

        // Check each threshold
        for (const threshold of budgetConfig.alertThresholds) {
          if (percentage >= threshold) {
            const alert: BudgetAlert = {
              workspaceId,
              currentSpend,
              budgetLimit: budgetConfig.monthlyLimit,
              threshold,
              alertType: percentage >= 100 ? 'exceeded' : 
                        percentage >= 95 ? 'critical' : 'warning',
              timestamp: now,
              period: this.getCurrentMonthPeriod(),
            };

            this.emit(percentage >= 100 ? 'budget-exceeded' : 'budget-alert', alert);
            break; // Only emit the highest threshold reached
          }
        }

        this.lastBudgetCheck.set(workspaceId, now);
      } catch (error) {
        console.error(`Failed to check budget for workspace ${workspaceId}:`, error);
      }
    }
  }

  /**
   * Get cost entries for workspace and period
   * In production, this would query the database
   */
  private async getCostEntries(workspaceId: string, period: DateRange): Promise<CostReportEntry[]> {
    const entries: CostReportEntry[] = [];

    // Convert aggregations to cost entries
    for (const [key, aggregation] of this.usageAggregations) {
      if (aggregation.workspaceId === workspaceId &&
          aggregation.date >= period.start &&
          aggregation.date <= period.end) {
        
        entries.push({
          workspaceId: aggregation.workspaceId,
          date: aggregation.date,
          operationType: aggregation.operationType,
          cost: aggregation.totalCost,
          usage: {
            tokens: aggregation.totalTokens || undefined,
            computeMs: aggregation.totalComputeMs || undefined,
            storageBytes: aggregation.totalStorageBytes || undefined,
            apiCalls: aggregation.totalApiCalls || undefined,
          },
          modelRef: aggregation.modelRef,
        });
      }
    }

    return entries.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Generate cost optimization recommendations
   */
  private generateOptimizationRecommendations(
    entries: CostReportEntry[],
    byOperationType: Record<string, number>,
    byModel: Record<string, number>
  ): CostOptimizationRecommendation[] {
    const recommendations: CostOptimizationRecommendation[] = [];

    // Model optimization recommendations
    const totalInferenceCost = byOperationType['inference'] || 0;
    if (totalInferenceCost > 100) { // $1.00 threshold
      const mostExpensiveModel = Object.entries(byModel)
        .sort(([,a], [,b]) => b - a)[0];
      
      if (mostExpensiveModel && mostExpensiveModel[1] > totalInferenceCost * 0.5) {
        recommendations.push({
          type: 'model_optimization',
          title: 'Consider using a more cost-effective model',
          description: `${mostExpensiveModel[0]} accounts for ${Math.round((mostExpensiveModel[1] / totalInferenceCost) * 100)}% of inference costs. Consider using a smaller model for non-critical tasks.`,
          potentialSavings: mostExpensiveModel[1] * 0.3, // Estimate 30% savings
          priority: 'medium',
          actionRequired: false,
        });
      }
    }

    // Usage pattern recommendations
    const totalCost = Object.values(byOperationType).reduce((sum, cost) => sum + cost, 0);
    if (totalCost > 500) { // $5.00 threshold
      recommendations.push({
        type: 'usage_pattern',
        title: 'High usage detected',
        description: 'Your usage is above average. Consider implementing caching or batch processing to reduce costs.',
        potentialSavings: totalCost * 0.2, // Estimate 20% savings
        priority: 'high',
        actionRequired: true,
      });
    }

    // Caching recommendations
    const apiCost = byOperationType['api'] || 0;
    if (apiCost > 50) { // $0.50 threshold
      recommendations.push({
        type: 'caching',
        title: 'Implement response caching',
        description: 'High API usage detected. Implementing response caching could significantly reduce costs.',
        potentialSavings: apiCost * 0.4, // Estimate 40% savings from caching
        priority: 'medium',
        actionRequired: false,
      });
    }

    return recommendations;
  }

  /**
   * Get current month period
   */
  private getCurrentMonthPeriod(): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    return { start, end };
  }

  /**
   * Get usage statistics for workspace
   */
  getUsageStats(workspaceId: string): {
    totalRecords: number;
    totalCost: number;
    lastUpdate: Date | null;
  } {
    let totalRecords = 0;
    let totalCost = 0;
    let lastUpdate: Date | null = null;

    for (const aggregation of this.usageAggregations.values()) {
      if (aggregation.workspaceId === workspaceId) {
        totalRecords += aggregation.recordCount;
        totalCost += aggregation.totalCost;
        
        if (!lastUpdate || aggregation.date > lastUpdate) {
          lastUpdate = aggregation.date;
        }
      }
    }

    return { totalRecords, totalCost, lastUpdate };
  }
}

/**
 * Global cost tracker instance
 */
export const costTracker = new CostTracker({
  aggregationInterval: 60, // 1 minute
  retentionDays: 90,
  alertCheckInterval: 300, // 5 minutes
});

// Type augmentation for EventEmitter
interface CostTrackerInterface {
  on<K extends keyof CostTrackerEvents>(event: K, listener: CostTrackerEvents[K]): this;
  emit<K extends keyof CostTrackerEvents>(event: K, ...args: Parameters<CostTrackerEvents[K]>): boolean;
}