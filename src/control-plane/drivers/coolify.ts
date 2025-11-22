/**
 * Coolify Deployment Driver
 * 
 * Implements deployment driver for Coolify v4+ with local container orchestration
 * Provides unified interface matching K8s/Nomad adapters per NFR-008
 * Supports health monitoring and self-healing capabilities per FR-008
 */

import { DeploymentDriver, DeploymentDriverConfig, DeploymentStatus, ServiceDefinition, HealthCheckResult } from './types';
import type {
  DeploymentConfig,
  DeploymentResult,
  ComponentConfig,
  ComponentDeploymentResult,
  DeploymentError,
  SystemStatus,
  ComponentStatus,
} from '../types';
import * as crypto from 'crypto';

/**
 * Deployment options with idempotency
 */
export interface CoolifyDeploymentOptions {
  idempotencyKey?: string;
  retries?: number;
  timeout?: number;
  rollbackOnFailure?: boolean;
}

/**
 * Rollback operation record
 */
export interface RollbackOperation {
  type: 'create_service' | 'update_service' | 'delete_service' | 'set_env' | 'create_route';
  resourceId: string;
  undoData: any;
  timestamp: Date;
}

/**
 * Circuit breaker state
 */
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private readonly failureThreshold = 5,
    private readonly recoveryTimeout = 60000 // 1 minute
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open - too many failures');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
    }
  }
}

/**
 * Coolify-specific configuration
 */
export interface CoolifyConfig extends DeploymentDriverConfig {
  coolifyUrl: string;
  apiToken: string;
  projectId: string;
  serverId: string;
  networkName?: string;
  domain?: string;
  enableTraefik: boolean;
  enableSSL: boolean;
}

/**
 * Coolify service configuration
 */
export interface CoolifyServiceConfig {
  name: string;
  image: string;
  tag: string;
  ports: Array<{
    internal: number;
    external?: number;
    protocol: 'tcp' | 'udp';
  }>;
  environment: Record<string, string>;
  volumes: Array<{
    source: string;
    target: string;
    type: 'bind' | 'volume';
  }>;
  networks: string[];
  healthCheck?: {
    test: string[];
    interval: string;
    timeout: string;
    retries: number;
    startPeriod: string;
  };
  resources: {
    cpuLimit?: string;
    memoryLimit?: string;
    cpuReservation?: string;
    memoryReservation?: string;
  };
  labels: Record<string, string>;
  dependencies: string[];
}

/**
 * Coolify API client for v4+ API
 */
export class CoolifyAPIClient {
  private readonly baseUrl: string;
  private readonly apiToken: string;
  private readonly headers: Record<string, string>;

  constructor(coolifyUrl: string, apiToken: string) {
    this.baseUrl = coolifyUrl.replace(/\/$/, '');
    this.apiToken = apiToken;
    this.headers = {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/health`, {
        method: 'GET',
        headers: this.headers,
      });
      return response.ok;
    } catch (error) {
      console.error('Coolify connection test failed:', error);
      return false;
    }
  }

  /**
   * Get project information
   */
  async getProject(projectId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/v1/projects/${projectId}`, {
      method: 'GET',
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to get project: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Create or update service
   */
  async deployService(projectId: string, serviceConfig: CoolifyServiceConfig): Promise<any> {
    const payload = {
      name: serviceConfig.name,
      image: `${serviceConfig.image}:${serviceConfig.tag}`,
      ports: serviceConfig.ports,
      environment: serviceConfig.environment,
      volumes: serviceConfig.volumes,
      networks: serviceConfig.networks,
      healthcheck: serviceConfig.healthCheck,
      resources: serviceConfig.resources,
      labels: serviceConfig.labels,
    };

    const response = await fetch(`${this.baseUrl}/api/v1/projects/${projectId}/services`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Failed to deploy service ${serviceConfig.name}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get service status
   */
  async getServiceStatus(projectId: string, serviceName: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/v1/projects/${projectId}/services/${serviceName}`, {
      method: 'GET',
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to get service status: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Start service
   */
  async startService(projectId: string, serviceName: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/v1/projects/${projectId}/services/${serviceName}/start`, {
      method: 'POST',
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to start service ${serviceName}: ${response.statusText}`);
    }
  }

  /**
   * Stop service
   */
  async stopService(projectId: string, serviceName: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/v1/projects/${projectId}/services/${serviceName}/stop`, {
      method: 'POST',
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to stop service ${serviceName}: ${response.statusText}`);
    }
  }

  /**
   * Restart service
   */
  async restartService(projectId: string, serviceName: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/v1/projects/${projectId}/services/${serviceName}/restart`, {
      method: 'POST',
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to restart service ${serviceName}: ${response.statusText}`);
    }
  }

  /**
   * Get service logs
   */
  async getServiceLogs(projectId: string, serviceName: string, lines: number = 100): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/v1/projects/${projectId}/services/${serviceName}/logs?lines=${lines}`, {
      method: 'GET',
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to get service logs: ${response.statusText}`);
    }

    const data = await response.json();
    return data.logs || '';
  }

  /**
   * Delete service
   */
  async deleteService(projectId: string, serviceName: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/v1/projects/${projectId}/services/${serviceName}`, {
      method: 'DELETE',
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to delete service ${serviceName}: ${response.statusText}`);
    }
  }
}

/**
 * Coolify capabilities detected from API
 */
export interface CoolifyCapabilities {
  version: string;
  features: {
    deployHooks: boolean;
    healthChecks: boolean;
    secrets: boolean;
    volumes: boolean;
    networks: boolean;
  };
  limits: {
    maxServices: number;
    maxEnvVars: number;
  };
}

/**
 * Canonical deployment status
 */
export enum DeploymentStatusEnum {
  PENDING = 'PENDING',
  READY = 'READY', 
  DEGRADED = 'DEGRADED',
  FAILED = 'FAILED',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Coolify Deployment Driver
 * Implements unified deployment interface for Coolify v4+
 */
export class CoolifyDriver implements DeploymentDriver {
  private readonly config: CoolifyConfig;
  private readonly apiClient: CoolifyAPIClient;
  private readonly serviceConfigs: Map<string, CoolifyServiceConfig> = new Map();
  private capabilities: CoolifyCapabilities | null = null;
  private readonly secretMask = '***REDACTED***';
  private readonly circuitBreaker = new CircuitBreaker();
  private readonly rollbackOperations: Map<string, RollbackOperation[]> = new Map();

  constructor(config: CoolifyConfig) {
    this.config = config;
    this.apiClient = new CoolifyAPIClient(config.coolifyUrl, config.apiToken);
  }

  /**
   * Get driver name
   */
  getName(): string {
    return 'coolify';
  }

  /**
   * Get driver version
   */
  getVersion(): string {
    return '4.0.0';
  }

  /**
   * Initialize driver with version/capability probing
   */
  async initialize(): Promise<void> {
    try {
      // Test connection to Coolify
      const isConnected = await this.apiClient.testConnection();
      if (!isConnected) {
        throw new Error('Failed to connect to Coolify API');
      }

      // Probe version and capabilities
      await this.probeCapabilities();

      // Verify project exists
      await this.apiClient.getProject(this.config.projectId);

      // Validate air-gapped mode constraints
      if (this.config.airGappedMode) {
        await this.validateAirGappedMode();
      }

    } catch (error) {
      const sanitizedError = this.sanitizeError(error);
      throw new Error(`Coolify driver initialization failed: ${sanitizedError}`);
    }
  }

  /**
   * Probe Coolify API for version and capabilities
   */
  private async probeCapabilities(): Promise<void> {
    try {
      // Get Coolify version and features
      const response = await fetch(`${this.config.coolifyUrl}/api/v1/version`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`,
          'Accept': 'application/json',
        },
      });

      if (response && response.ok) {
        const versionData = await response.json();
        this.capabilities = {
          version: versionData.version || '4.0.0',
          features: {
            deployHooks: versionData.features?.deployHooks ?? true,
            healthChecks: versionData.features?.healthChecks ?? true,
            secrets: versionData.features?.secrets ?? true,
            volumes: versionData.features?.volumes ?? true,
            networks: versionData.features?.networks ?? true,
          },
          limits: {
            maxServices: versionData.limits?.maxServices ?? 50,
            maxEnvVars: versionData.limits?.maxEnvVars ?? 100,
          },
        };
      } else {
        // Fallback to default capabilities for older versions
        this.capabilities = {
          version: '4.0.0',
          features: {
            deployHooks: true,
            healthChecks: true,
            secrets: true,
            volumes: true,
            networks: true,
          },
          limits: {
            maxServices: 50,
            maxEnvVars: 100,
          },
        };
      }

      // Validate version compatibility
      if (!this.isVersionSupported(this.capabilities.version)) {
        console.warn(`Coolify version ${this.capabilities.version} is outside tested range. Use --force to proceed.`);
      }

    } catch (error) {
      console.warn('Failed to probe Coolify capabilities, using defaults:', error);
      this.capabilities = {
        version: '4.0.0',
        features: { deployHooks: true, healthChecks: true, secrets: true, volumes: true, networks: true },
        limits: { maxServices: 50, maxEnvVars: 100 },
      };
    }
  }

  /**
   * Check if Coolify version is supported
   */
  private isVersionSupported(version: string): boolean {
    const [major, minor] = version.split('.').map(Number);
    return major >= 4 && (major > 4 || minor >= 0);
  }

  /**
   * Validate air-gapped mode constraints
   */
  private async validateAirGappedMode(): Promise<void> {
    if (!this.config.airGappedMode) return;

    // Check for network-dependent features
    const networkFeatures = [];
    if (this.config.enableTraefik) networkFeatures.push('Traefik routing');
    if (this.config.enableSSL) networkFeatures.push('SSL certificate management');

    if (networkFeatures.length > 0) {
      throw new Error(
        `Air-gapped mode incompatible with: ${networkFeatures.join(', ')}. ` +
        'Remediation: disable external features or use local registry mirror.'
      );
    }
  }

  /**
   * Sanitize error messages to remove secrets
   */
  private sanitizeError(error: unknown): string {
    if (!(error instanceof Error)) {
      return 'Unknown error';
    }

    let message = error.message;
    
    // Remove API tokens and other secrets
    message = message.replace(/Bearer\s+[A-Za-z0-9_-]+/g, `Bearer ${this.secretMask}`);
    message = message.replace(/token[=:]\s*[A-Za-z0-9_-]+/gi, `token=${this.secretMask}`);
    message = message.replace(/password[=:]\s*[^\s]+/gi, `password=${this.secretMask}`);
    message = message.replace(/secret[=:]\s*[^\s]+/gi, `secret=${this.secretMask}`);
    
    return message;
  }

  /**
   * Deploy infrastructure with idempotency and rollback
   */
  async deploy(deploymentConfig: DeploymentConfig, options: CoolifyDeploymentOptions = {}): Promise<DeploymentResult> {
    const startTime = new Date();
    const idempotencyKey = options.idempotencyKey || crypto.randomUUID();
    const deploymentId = `coolify-${idempotencyKey}`;
    
    const errors: DeploymentError[] = [];
    const componentResults: ComponentDeploymentResult[] = [];
    const rollbackOps: RollbackOperation[] = [];

    try {
      // Convert components to Coolify service configurations
      const serviceConfigs = this.convertComponentsToServices(deploymentConfig.components);
      
      // Deploy services in dependency order
      const sortedServices = this.sortServicesByDependencies(serviceConfigs);
      
      for (const serviceConfig of sortedServices) {
        try {
          const componentResult = await this.deployServiceWithRetry(serviceConfig, idempotencyKey, options.retries || 3);
          componentResults.push(componentResult);

          if (componentResult.status === 'failed') {
            errors.push({
              component: serviceConfig.name,
              error: componentResult.error || 'Unknown deployment error',
              remediation: this.getRemediationForService(serviceConfig.name),
              recoverable: true,
            });

            // Rollback on failure if enabled
            if (options.rollbackOnFailure !== false) {
              await this.executeRollback(idempotencyKey);
              break;
            }
          } else {
            // Record successful deployment for potential rollback
            rollbackOps.push({
              type: 'create_service',
              resourceId: serviceConfig.name,
              undoData: { projectId: this.config.projectId, serviceName: serviceConfig.name },
              timestamp: new Date(),
            });
          }

          // Store service config for health monitoring
          this.serviceConfigs.set(serviceConfig.name, serviceConfig);

        } catch (error) {
          const sanitizedError = this.sanitizeError(error);
          errors.push({
            component: serviceConfig.name,
            error: sanitizedError,
            remediation: this.getRemediationForService(serviceConfig.name),
            recoverable: true,
          });

          if (options.rollbackOnFailure !== false) {
            await this.executeRollback(idempotencyKey);
            break;
          }
        }
      }

      // Store rollback operations
      this.rollbackOperations.set(idempotencyKey, rollbackOps);

      const success = errors.length === 0;
      const endTime = new Date();

      return {
        success,
        deploymentId,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        components: componentResults,
        errors,
      };

    } catch (error) {
      const endTime = new Date();
      
      return {
        success: false,
        deploymentId,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        components: componentResults,
        errors: [{
          component: 'coolify-driver',
          error: error instanceof Error ? error.message : 'Unknown deployment error',
          remediation: 'Check Coolify API connectivity and configuration',
          recoverable: true,
        }],
      };
    }
  }

  /**
   * Deploy service with exponential backoff retry
   */
  private async deployServiceWithRetry(
    serviceConfig: CoolifyServiceConfig, 
    idempotencyKey: string,
    maxRetries: number
  ): Promise<ComponentDeploymentResult> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.circuitBreaker.execute(() => 
          this.deployService(serviceConfig, idempotencyKey)
        );
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Don't retry on 4xx errors (client errors)
        if (error instanceof Error && error.message.includes('4')) {
          break;
        }
        
        if (attempt < maxRetries) {
          const delay = this.calculateBackoffDelay(attempt);
          console.log(`Deployment attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    const endTime = new Date();
    return {
      name: serviceConfig.name,
      status: 'failed',
      startTime: new Date(),
      endTime,
      duration: 0,
      error: this.sanitizeError(lastError),
    };
  }

  /**
   * Calculate exponential backoff delay with jitter
   */
  private calculateBackoffDelay(attempt: number): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    
    // Add jitter (±25%)
    const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
    return Math.max(100, exponentialDelay + jitter);
  }

  /**
   * Deploy individual service with idempotency
   */
  private async deployService(serviceConfig: CoolifyServiceConfig, idempotencyKey: string): Promise<ComponentDeploymentResult> {
    const startTime = new Date();

    try {
      // Check if service already exists (idempotency)
      const existingService = await this.checkServiceExists(serviceConfig.name);
      if (existingService) {
        console.log(`Service ${serviceConfig.name} already exists, skipping deployment`);
        const endTime = new Date();
        return {
          name: serviceConfig.name,
          status: 'success',
          startTime,
          endTime,
          duration: endTime.getTime() - startTime.getTime(),
        };
      }

      // Validate residency policy before deployment
      if (this.config.spainResidencyMode) {
        await this.validateResidencyPolicy(serviceConfig);
      }

      // Emit audit event: deploy start
      await this.emitAuditEvent('deploy:start', {
        serviceName: serviceConfig.name,
        idempotencyKey,
        blueprintHash: this.calculateBlueprintHash(serviceConfig),
        driverVersion: this.getVersion(),
      });

      // Deploy service via Coolify API with idempotency key
      const deployPayload = {
        ...this.sanitizeServiceConfig(serviceConfig),
        idempotencyKey,
      };
      
      await this.apiClient.deployService(this.config.projectId, deployPayload);
      
      // Start the service
      await this.apiClient.startService(this.config.projectId, serviceConfig.name);
      
      // Wait for service to be healthy with readiness gates
      await this.waitForServiceReadiness(serviceConfig.name, 60000);

      // Emit audit event: deploy success
      await this.emitAuditEvent('deploy:success', {
        serviceName: serviceConfig.name,
        idempotencyKey,
        duration: Date.now() - startTime.getTime(),
      });

      const endTime = new Date();
      return {
        name: serviceConfig.name,
        status: 'success',
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
      };

    } catch (error) {
      const endTime = new Date();
      const sanitizedError = this.sanitizeError(error);
      
      // Emit audit event: deploy failure
      await this.emitAuditEvent('deploy:fail', {
        serviceName: serviceConfig.name,
        idempotencyKey,
        error: sanitizedError,
        duration: endTime.getTime() - startTime.getTime(),
      });

      return {
        name: serviceConfig.name,
        status: 'failed',
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        error: sanitizedError,
      };
    }
  }

  /**
   * Wait for service to become healthy
   */
  private async waitForServiceHealth(serviceName: string, timeoutMs: number): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 5000; // 5 seconds

    while (Date.now() - startTime < timeoutMs) {
      try {
        const status = await this.apiClient.getServiceStatus(this.config.projectId, serviceName);
        
        if (status.state === 'running' && status.health === 'healthy') {
          return;
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        // Continue polling on API errors
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    throw new Error(`Service ${serviceName} did not become healthy within ${timeoutMs}ms`);
  }

  /**
   * Get deployment status with canonical mapping
   */
  async getStatus(): Promise<DeploymentStatus> {
    const lastCheck = new Date();
    
    try {
      const services = Array.from(this.serviceConfigs.keys());
      const serviceStatuses = await Promise.all(
        services.map(async (serviceName) => {
          try {
            const status = await this.apiClient.getServiceStatus(this.config.projectId, serviceName);
            const canonicalStatus = this.mapToCanonicaStatus(status.state);
            
            return {
              name: serviceName,
              status: this.mapCanonicalToServiceStatus(canonicalStatus),
              health: this.mapHealthStatus(status.health),
              lastProbe: lastCheck,
              failingComponent: canonicalStatus === DeploymentStatusEnum.FAILED ? serviceName : undefined,
            };
          } catch (error) {
            return {
              name: serviceName,
              status: 'failed' as const,
              health: 'unhealthy' as const,
              lastProbe: lastCheck,
              failingComponent: serviceName,
              error: this.sanitizeError(error),
            };
          }
        })
      );

      // Determine overall status
      const failedServices = serviceStatuses.filter(s => s.status === 'failed');
      const readyServices = serviceStatuses.filter(s => s.status === 'running' && s.health === 'healthy');
      
      let overall: 'healthy' | 'degraded' | 'failed';
      if (failedServices.length > 0) {
        overall = 'failed';
      } else if (readyServices.length === serviceStatuses.length) {
        overall = 'healthy';
      } else {
        overall = 'degraded';
      }

      return {
        overall,
        services: serviceStatuses,
        lastCheck,
      };

    } catch (error) {
      return {
        overall: 'failed',
        services: [],
        lastCheck,
        error: this.sanitizeError(error),
      };
    }
  }

  /**
   * Map canonical status to service status
   */
  private mapCanonicalToServiceStatus(canonical: DeploymentStatusEnum): 'running' | 'stopped' | 'failed' | 'pending' {
    switch (canonical) {
      case DeploymentStatusEnum.READY: return 'running';
      case DeploymentStatusEnum.PENDING: return 'pending';
      case DeploymentStatusEnum.FAILED: return 'failed';
      case DeploymentStatusEnum.DEGRADED: return 'running'; // Still running but degraded
      default: return 'pending';
    }
  }

  /**
   * Map health status to canonical form
   */
  private mapHealthStatus(health: string | undefined): 'healthy' | 'unhealthy' | 'unknown' {
    if (!health) return 'unknown';
    
    const healthMap: Record<string, 'healthy' | 'unhealthy' | 'unknown'> = {
      'healthy': 'healthy',
      'passing': 'healthy',
      'ok': 'healthy',
      'unhealthy': 'unhealthy',
      'failing': 'unhealthy',
      'critical': 'unhealthy',
      'error': 'unhealthy',
    };

    return healthMap[health.toLowerCase()] || 'unknown';
  }

  /**
   * Perform health check
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const status = await this.getStatus();
      const responseTime = Date.now() - startTime;

      return {
        healthy: status.overall === 'healthy',
        responseTime,
        details: {
          driver: 'coolify',
          services: status.services.length,
          healthyServices: status.services.filter((s: any) => s.health === 'healthy').length,
          lastCheck: status.lastCheck,
        },
        error: status.error,
      };

    } catch (error) {
      return {
        healthy: false,
        responseTime: Date.now() - startTime,
        details: {
          driver: 'coolify',
          services: 0,
          healthyServices: 0,
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Scale service
   */
  async scale(serviceName: string, replicas: number): Promise<void> {
    // Coolify v4 scaling would be implemented here
    // For now, throw not implemented error
    throw new Error('Service scaling not yet implemented for Coolify driver');
  }

  /**
   * Restart service
   */
  async restart(serviceName: string): Promise<void> {
    try {
      await this.apiClient.restartService(this.config.projectId, serviceName);
    } catch (error) {
      throw new Error(`Failed to restart service ${serviceName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get service logs
   */
  async getLogs(serviceName: string, lines?: number): Promise<string> {
    try {
      return await this.apiClient.getServiceLogs(this.config.projectId, serviceName, lines);
    } catch (error) {
      throw new Error(`Failed to get logs for service ${serviceName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Cleanup deployment
   */
  async cleanup(): Promise<void> {
    const services = Array.from(this.serviceConfigs.keys());
    
    for (const serviceName of services) {
      try {
        await this.apiClient.deleteService(this.config.projectId, serviceName);
      } catch (error) {
        console.warn(`Failed to delete service ${serviceName}:`, error);
      }
    }

    this.serviceConfigs.clear();
  }

  /**
   * Convert Mobius components to Coolify service configurations
   */
  private convertComponentsToServices(components: ComponentConfig[]): CoolifyServiceConfig[] {
    return components.map(component => this.convertComponentToService(component));
  }

  /**
   * Convert individual component to Coolify service
   */
  private convertComponentToService(component: ComponentConfig): CoolifyServiceConfig {
    const baseConfig: CoolifyServiceConfig = {
      name: component.name,
      image: this.getImageForComponent(component.type),
      tag: component.config?.tag || 'latest',
      ports: this.getPortsForComponent(component.type),
      environment: component.config?.environment || {},
      volumes: component.config?.volumes || [],
      networks: [this.config.networkName || 'mobius-network'],
      resources: {
        cpuLimit: component.config?.resources?.cpu?.limit,
        memoryLimit: component.config?.resources?.memory?.limit,
        cpuReservation: component.config?.resources?.cpu?.request,
        memoryReservation: component.config?.resources?.memory?.request,
      },
      labels: {
        'mobius.component': component.type,
        'mobius.name': component.name,
        'traefik.enable': this.config.enableTraefik ? 'true' : 'false',
        ...component.config?.labels,
      },
      dependencies: component.dependencies || [],
    };

    // Add health check if supported
    const healthCheck = this.getHealthCheckForComponent(component.type);
    if (healthCheck) {
      baseConfig.healthCheck = healthCheck;
    }

    // Add Traefik labels for web services
    if (this.isWebService(component.type) && this.config.enableTraefik) {
      baseConfig.labels = {
        ...baseConfig.labels,
        'traefik.http.routers.${component.name}.rule': `Host(\`${component.name}.${this.config.domain || 'localhost'}\`)`,
        'traefik.http.services.${component.name}.loadbalancer.server.port': String(this.getMainPortForComponent(component.type)),
      };

      if (this.config.enableSSL) {
        baseConfig.labels['traefik.http.routers.${component.name}.tls'] = 'true';
      }
    }

    return baseConfig;
  }

  /**
   * Get Docker image for component type
   */
  private getImageForComponent(type: string): string {
    const images = {
      database: 'postgres',
      redis: 'redis',
      minio: 'minio/minio',
      qdrant: 'qdrant/qdrant',
      gateway: 'mobius/gateway',
      runtime: 'mobius/runtime',
    };

    return images[type as keyof typeof images] || 'alpine';
  }

  /**
   * Get port configuration for component type
   */
  private getPortsForComponent(type: string): Array<{ internal: number; external?: number; protocol: 'tcp' | 'udp' }> {
    const portConfigs = {
      database: [{ internal: 5432, protocol: 'tcp' as const }],
      redis: [{ internal: 6379, protocol: 'tcp' as const }],
      minio: [
        { internal: 9000, protocol: 'tcp' as const },
        { internal: 9001, protocol: 'tcp' as const }
      ],
      qdrant: [{ internal: 6333, protocol: 'tcp' as const }],
      gateway: [{ internal: 3000, external: 3000, protocol: 'tcp' as const }],
      runtime: [{ internal: 8000, protocol: 'tcp' as const }],
    };

    return portConfigs[type as keyof typeof portConfigs] || [];
  }

  /**
   * Get main port for component (for load balancer configuration)
   */
  private getMainPortForComponent(type: string): number {
    const mainPorts = {
      database: 5432,
      redis: 6379,
      minio: 9000,
      qdrant: 6333,
      gateway: 3000,
      runtime: 8000,
    };

    return mainPorts[type as keyof typeof mainPorts] || 80;
  }

  /**
   * Get health check configuration for component type
   */
  private getHealthCheckForComponent(type: string): CoolifyServiceConfig['healthCheck'] | undefined {
    const healthChecks = {
      database: {
        test: ['CMD-SHELL', 'pg_isready -U postgres'],
        interval: '30s',
        timeout: '10s',
        retries: 3,
        startPeriod: '60s',
      },
      redis: {
        test: ['CMD', 'redis-cli', 'ping'],
        interval: '30s',
        timeout: '10s',
        retries: 3,
        startPeriod: '30s',
      },
      minio: {
        test: ['CMD', 'curl', '-f', 'http://localhost:9000/minio/health/live'],
        interval: '30s',
        timeout: '10s',
        retries: 3,
        startPeriod: '30s',
      },
      qdrant: {
        test: ['CMD', 'curl', '-f', 'http://localhost:6333/health'],
        interval: '30s',
        timeout: '10s',
        retries: 3,
        startPeriod: '30s',
      },
    };

    return healthChecks[type as keyof typeof healthChecks];
  }

  /**
   * Check if component is a web service (needs Traefik routing)
   */
  private isWebService(type: string): boolean {
    const webServices = ['gateway', 'runtime', 'minio'];
    return webServices.includes(type);
  }

  /**
   * Sort services by dependencies (topological sort)
   */
  private sortServicesByDependencies(services: CoolifyServiceConfig[]): CoolifyServiceConfig[] {
    const graph = new Map<string, CoolifyServiceConfig>();
    const inDegree = new Map<string, number>();
    
    // Initialize graph and in-degree count
    for (const service of services) {
      graph.set(service.name, service);
      inDegree.set(service.name, 0);
    }

    // Calculate in-degrees
    for (const service of services) {
      for (const dep of service.dependencies) {
        if (inDegree.has(service.name)) {
          inDegree.set(service.name, (inDegree.get(service.name) || 0) + 1);
        }
      }
    }

    // Kahn's algorithm for topological sorting
    const queue: string[] = [];
    const result: CoolifyServiceConfig[] = [];

    // Find all nodes with no incoming edges
    for (const [name, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(name);
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      const service = graph.get(current)!;
      result.push(service);

      // For each dependent of current service
      for (const other of services) {
        if (other.dependencies.includes(current)) {
          const newDegree = (inDegree.get(other.name) || 0) - 1;
          inDegree.set(other.name, newDegree);
          
          if (newDegree === 0) {
            queue.push(other.name);
          }
        }
      }
    }

    return result;
  }

  /**
   * Map Coolify service state to deployment status
   */
  private mapCoolifyStatusToDeploymentStatus(coolifyState: string): 'running' | 'stopped' | 'failed' | 'pending' {
    const statusMap: Record<string, 'running' | 'stopped' | 'failed' | 'pending'> = {
      'running': 'running',
      'stopped': 'stopped',
      'exited': 'failed',
      'restarting': 'pending',
      'paused': 'stopped',
      'dead': 'failed',
    };

    return statusMap[coolifyState] || 'pending';
  }

  /**
   * Check if service already exists
   */
  private async checkServiceExists(serviceName: string): Promise<boolean> {
    try {
      await this.apiClient.getServiceStatus(this.config.projectId, serviceName);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Wait for service readiness with per-service timeouts
   */
  private async waitForServiceReadiness(serviceName: string, timeoutMs: number): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 5000; // 5 seconds
    const serviceTimeout = this.getServiceTimeout(serviceName);
    const effectiveTimeout = Math.min(timeoutMs, serviceTimeout);

    while (Date.now() - startTime < effectiveTimeout) {
      try {
        const status = await this.apiClient.getServiceStatus(this.config.projectId, serviceName);
        const canonicalStatus = this.mapToCanonicaStatus(status.state);
        
        if (canonicalStatus === DeploymentStatusEnum.READY) {
          return;
        }
        
        if (canonicalStatus === DeploymentStatusEnum.FAILED) {
          throw new Error(`Service ${serviceName} failed to start`);
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        // Continue polling on API errors
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    throw new Error(`Service ${serviceName} did not become ready within ${effectiveTimeout}ms`);
  }

  /**
   * Get service-specific timeout
   */
  private getServiceTimeout(serviceName: string): number {
    const timeouts: Record<string, number> = {
      database: 120000,    // 2 minutes
      redis: 60000,        // 1 minute
      minio: 90000,        // 1.5 minutes
      qdrant: 120000,      // 2 minutes
      gateway: 90000,      // 1.5 minutes
      runtime: 180000,     // 3 minutes (AI models take longer)
    };

    const serviceType = serviceName.split('-')[0];
    return timeouts[serviceType] || 60000;
  }

  /**
   * Map Coolify status to canonical status
   */
  private mapToCanonicaStatus(coolifyState: string): DeploymentStatusEnum {
    const statusMap: Record<string, DeploymentStatusEnum> = {
      'running': DeploymentStatusEnum.READY,
      'healthy': DeploymentStatusEnum.READY,
      'starting': DeploymentStatusEnum.PENDING,
      'pending': DeploymentStatusEnum.PENDING,
      'stopped': DeploymentStatusEnum.FAILED,
      'exited': DeploymentStatusEnum.FAILED,
      'failed': DeploymentStatusEnum.FAILED,
      'error': DeploymentStatusEnum.FAILED,
      'degraded': DeploymentStatusEnum.DEGRADED,
    };

    return statusMap[coolifyState.toLowerCase()] || DeploymentStatusEnum.UNKNOWN;
  }

  /**
   * Execute rollback operations
   */
  private async executeRollback(idempotencyKey: string): Promise<void> {
    const operations = this.rollbackOperations.get(idempotencyKey);
    if (!operations || operations.length === 0) {
      return;
    }

    console.log(`Executing rollback for deployment ${idempotencyKey}...`);
    
    // Execute rollback operations in reverse order
    for (const operation of operations.reverse()) {
      try {
        switch (operation.type) {
          case 'create_service':
            await this.apiClient.deleteService(
              operation.undoData.projectId,
              operation.undoData.serviceName
            );
            break;
          // Add other rollback operation types as needed
        }
      } catch (error) {
        console.warn(`Rollback operation failed for ${operation.resourceId}:`, error);
      }
    }

    // Clear rollback operations
    this.rollbackOperations.delete(idempotencyKey);
  }

  /**
   * Get remediation advice for service
   */
  private getRemediationForService(serviceName: string): string {
    return `Check Coolify dashboard for service ${serviceName} status and logs. Verify service configuration and dependencies.`;
  }

  /**
   * Validate residency policy for service deployment
   */
  private async validateResidencyPolicy(serviceConfig: CoolifyServiceConfig): Promise<void> {
    if (!this.config.spainResidencyMode) {
      return;
    }

    // Check for egress endpoints that violate Spain residency
    const egressEndpoints = this.extractEgressEndpoints(serviceConfig);
    const blockedEndpoints = egressEndpoints.filter(endpoint => !this.isSpainResidencyCompliant(endpoint));

    if (blockedEndpoints.length > 0) {
      const decision = {
        allowed: false,
        reason: 'Spain residency mode blocks external endpoints',
        blockedEndpoints,
        timestamp: new Date(),
      };

      // Log policy decision for audit
      await this.emitAuditEvent('policy:residency_block', {
        serviceName: serviceConfig.name,
        decision,
        blockedEndpoints,
      });

      throw new Error(
        `Deployment blocked by Spain residency policy. ` +
        `Blocked endpoints: ${blockedEndpoints.join(', ')}. ` +
        `Remediation: remove external dependencies or disable Spain residency mode.`
      );
    }

    // Log policy decision for audit (allowed)
    await this.emitAuditEvent('policy:residency_allow', {
      serviceName: serviceConfig.name,
      decision: {
        allowed: true,
        reason: 'No external endpoints detected',
        timestamp: new Date(),
      },
    });
  }

  /**
   * Extract potential egress endpoints from service config
   */
  private extractEgressEndpoints(serviceConfig: CoolifyServiceConfig): string[] {
    const endpoints: string[] = [];
    
    // Check environment variables for external URLs
    for (const [key, value] of Object.entries(serviceConfig.environment)) {
      if (this.isExternalUrl(value)) {
        endpoints.push(`${key}=${value}`);
      }
    }

    // Check image registry
    if (this.isExternalRegistry(serviceConfig.image)) {
      endpoints.push(`image=${serviceConfig.image}`);
    }

    return endpoints;
  }

  /**
   * Check if URL is external (non-Spain)
   */
  private isExternalUrl(value: string): boolean {
    try {
      const url = new URL(value);
      // Allow localhost, internal networks, and .es domains
      const allowedPatterns = [
        /^localhost$/,
        /^127\./,
        /^192\.168\./,
        /^10\./,
        /^172\.(1[6-9]|2[0-9]|3[01])\./,
        /\.es$/,
        /\.spain$/,
      ];

      return !allowedPatterns.some(pattern => pattern.test(url.hostname));
    } catch {
      return false; // Not a URL
    }
  }

  /**
   * Check if image registry is external
   */
  private isExternalRegistry(image: string): boolean {
    // Allow local registries and Spanish registries
    const allowedRegistries = [
      'localhost',
      'registry.es',
      'harbor.spain.local',
    ];

    const registry = image.split('/')[0];
    return !allowedRegistries.some(allowed => registry.includes(allowed)) && 
           !registry.includes('localhost') && 
           registry.includes('.');
  }

  /**
   * Check if endpoint is Spain residency compliant
   */
  private isSpainResidencyCompliant(endpoint: string): boolean {
    // For Spain residency mode, only allow internal and .es domains
    return endpoint.includes('localhost') || 
           endpoint.includes('127.0.0.1') || 
           endpoint.includes('.es') ||
           endpoint.includes('.spain') ||
           endpoint.includes('192.168.') ||
           endpoint.includes('10.') ||
           endpoint.includes('172.');
  }

  /**
   * Sanitize service config to remove secrets
   */
  private sanitizeServiceConfig(serviceConfig: CoolifyServiceConfig): any {
    const sanitized = { ...serviceConfig };
    
    // Sanitize environment variables
    sanitized.environment = { ...serviceConfig.environment };
    for (const [key, value] of Object.entries(sanitized.environment)) {
      if (this.isSecretKey(key)) {
        sanitized.environment[key] = this.secretMask;
      }
    }

    return sanitized;
  }

  /**
   * Check if environment key contains secrets
   */
  private isSecretKey(key: string): boolean {
    const secretPatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /key/i,
      /credential/i,
      /auth/i,
    ];

    return secretPatterns.some(pattern => pattern.test(key));
  }

  /**
   * Calculate blueprint hash for audit trail
   */
  private calculateBlueprintHash(serviceConfig: CoolifyServiceConfig): string {
    const sanitizedConfig = this.sanitizeServiceConfig(serviceConfig);
    const configString = JSON.stringify(sanitizedConfig, Object.keys(sanitizedConfig).sort());
    return crypto.createHash('sha256').update(configString).digest('hex').substring(0, 16);
  }

  /**
   * Emit structured audit event
   */
  private async emitAuditEvent(eventType: string, data: any): Promise<void> {
    try {
      const auditEvent = {
        timestamp: new Date().toISOString(),
        driver: 'coolify',
        driverVersion: this.getVersion(),
        eventType,
        workspaceId: this.config.projectId, // Use project ID as workspace identifier
        ...data,
      };

      // In a real implementation, this would send to audit service
      console.log(`[AUDIT] ${eventType}:`, JSON.stringify(auditEvent, null, 2));
      
      // TODO: Integrate with actual audit service
      // await auditService.logEvent(auditEvent);
      
    } catch (error) {
      console.error('Failed to emit audit event:', error);
      // Don't throw - audit failures shouldn't break deployment
    }
  }
}