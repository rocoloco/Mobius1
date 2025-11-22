/**
 * Type definitions for Control Plane operations
 */

/**
 * Deployment configuration interface
 */
export interface DeploymentConfig {
  workspaceId: string;
  environment: 'development' | 'production' | 'test';
  spainResidencyMode: boolean;
  airGappedMode: boolean;
  components: ComponentConfig[];
  resources: ResourceConfig;
}

/**
 * Component configuration
 */
export interface ComponentConfig {
  name: string;
  type: 'database' | 'redis' | 'minio' | 'qdrant' | 'gateway' | 'runtime';
  enabled: boolean;
  config: Record<string, any>;
  dependencies: string[];
}

/**
 * Resource configuration
 */
export interface ResourceConfig {
  cpu: {
    limit: string;
    request: string;
  };
  memory: {
    limit: string;
    request: string;
  };
  storage: {
    size: string;
    class?: string;
  };
}

/**
 * Deployment result
 */
export interface DeploymentResult {
  success: boolean;
  deploymentId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  components: ComponentDeploymentResult[];
  errors: DeploymentError[];
}

/**
 * Component deployment result
 */
export interface ComponentDeploymentResult {
  name: string;
  status: 'success' | 'failed' | 'skipped';
  startTime: Date;
  endTime: Date;
  duration: number;
  error?: string;
}

/**
 * Deployment error
 */
export interface DeploymentError {
  component: string;
  error: string;
  remediation?: string;
  recoverable: boolean;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  component: string;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  component: string;
  field: string;
  message: string;
  recommendation?: string;
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  interval: number; // seconds
  timeout: number; // seconds
  retries: number;
  enabled: boolean;
}

/**
 * Recovery action types
 */
export type RecoveryAction = 
  | 'restart_service'
  | 'clear_cache'
  | 'reconnect_database'
  | 'scale_up'
  | 'scale_down'
  | 'failover'
  | 'rollback';

/**
 * Recovery configuration
 */
export interface RecoveryConfig {
  action: RecoveryAction;
  maxAttempts: number;
  backoffMultiplier: number;
  initialDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  conditions: RecoveryCondition[];
}

/**
 * Recovery condition
 */
export interface RecoveryCondition {
  type: 'health_check_failed' | 'error_rate_high' | 'response_time_high' | 'resource_exhausted';
  threshold: number;
  duration: number; // seconds
}

/**
 * Recovery attempt result
 */
export interface RecoveryAttemptResult {
  success: boolean;
  action: RecoveryAction;
  startTime: Date;
  endTime: Date;
  duration: number;
  error?: string;
  nextAttemptDelay?: number;
}

/**
 * System status
 */
export interface SystemStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  components: ComponentStatus[];
  lastHealthCheck: Date;
  uptime: number;
  recoveryInProgress: boolean;
}

/**
 * Component status
 */
export interface ComponentStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  lastCheck: Date;
  error?: string;
  recoveryAttempts: number;
}

/**
 * Failure type enumeration
 */
export enum FailureType {
  DATABASE_CONNECTION = 'database_connection',
  REDIS_CONNECTION = 'redis_connection',
  MINIO_CONNECTION = 'minio_connection',
  QDRANT_CONNECTION = 'qdrant_connection',
  HIGH_ERROR_RATE = 'high_error_rate',
  HIGH_RESPONSE_TIME = 'high_response_time',
  RESOURCE_EXHAUSTION = 'resource_exhaustion',
  SERVICE_UNAVAILABLE = 'service_unavailable',
}

/**
 * Usage metrics for cost tracking
 */
export interface UsageMetrics {
  workspaceId: string;
  timestamp: Date;
  tokenCount: number;
  computeTimeMs: number;
  storageBytes: number;
  apiCalls: number;
  modelRef?: string;
  operationType: 'inference' | 'training' | 'storage' | 'api';
}

/**
 * Budget configuration
 */
export interface BudgetConfig {
  workspaceId: string;
  monthlyLimit: number; // in cents
  alertThresholds: number[]; // percentages (e.g., [50, 80, 95])
  enabled: boolean;
  currency: string;
  resetDay: number; // day of month (1-31)
}

/**
 * Budget alert
 */
export interface BudgetAlert {
  workspaceId: string;
  currentSpend: number;
  budgetLimit: number;
  threshold: number; // percentage
  alertType: 'warning' | 'critical' | 'exceeded';
  timestamp: Date;
  period: {
    start: Date;
    end: Date;
  };
}

/**
 * Cost report entry
 */
export interface CostReportEntry {
  workspaceId: string;
  date: Date;
  operationType: string;
  cost: number;
  usage: {
    tokens?: number;
    computeMs?: number;
    storageBytes?: number;
    apiCalls?: number;
  };
  modelRef?: string;
}

/**
 * Cost report
 */
export interface CostReport {
  workspaceId: string;
  period: {
    start: Date;
    end: Date;
  };
  totalCost: number;
  currency: string;
  entries: CostReportEntry[];
  breakdown: {
    byOperationType: Record<string, number>;
    byModel: Record<string, number>;
    byDay: Record<string, number>;
  };
  recommendations: CostOptimizationRecommendation[];
}

/**
 * Cost optimization recommendation
 */
export interface CostOptimizationRecommendation {
  type: 'model_optimization' | 'usage_pattern' | 'resource_scaling' | 'caching';
  title: string;
  description: string;
  potentialSavings: number;
  priority: 'low' | 'medium' | 'high';
  actionRequired: boolean;
}

/**
 * Date range for reports
 */
export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  healthCheck: HealthCheckConfig;
  recovery: {
    enabled: boolean;
    maxConcurrentRecoveries: number;
    cooldownPeriod: number; // seconds
  };
  deployment: {
    timeout: number; // seconds
    maxRetries: number;
    validateDependencies: boolean;
  };
  costTracking: {
    enabled: boolean;
    aggregationInterval: number; // seconds
    retentionDays: number;
    alertCheckInterval: number; // seconds
  };
}