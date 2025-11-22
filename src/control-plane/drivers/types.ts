/**
 * Deployment Driver Interface Types
 * 
 * Unified interface for deployment drivers (Coolify, K8s, Nomad)
 * Implements NFR-008 requirement for identical blueprint deployability
 */

import type {
  DeploymentConfig,
  DeploymentResult,
  SystemStatus,
} from '../types.js';

/**
 * Base deployment driver configuration
 */
export interface DeploymentDriverConfig {
  name: string;
  version: string;
  environment: 'development' | 'production' | 'test';
  spainResidencyMode: boolean;
  airGappedMode: boolean;
}

/**
 * Deployment status information
 */
export interface DeploymentStatus {
  overall: 'healthy' | 'degraded' | 'failed';
  services: ServiceStatus[];
  lastCheck: Date;
  error?: string;
}

/**
 * Service status information
 */
export interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'failed' | 'pending';
  health: 'healthy' | 'unhealthy' | 'unknown';
  error?: string;
}

/**
 * Service definition for deployment
 */
export interface ServiceDefinition {
  name: string;
  type: string;
  image: string;
  tag: string;
  ports: ServicePort[];
  environment: Record<string, string>;
  volumes: ServiceVolume[];
  resources: ServiceResources;
  healthCheck?: ServiceHealthCheck;
  dependencies: string[];
}

/**
 * Service port configuration
 */
export interface ServicePort {
  internal: number;
  external?: number;
  protocol: 'tcp' | 'udp';
}

/**
 * Service volume configuration
 */
export interface ServiceVolume {
  source: string;
  target: string;
  type: 'bind' | 'volume';
  readOnly?: boolean;
}

/**
 * Service resource configuration
 */
export interface ServiceResources {
  cpuLimit?: string;
  memoryLimit?: string;
  cpuRequest?: string;
  memoryRequest?: string;
}

/**
 * Service health check configuration
 */
export interface ServiceHealthCheck {
  test: string[];
  interval: string;
  timeout: string;
  retries: number;
  startPeriod: string;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  healthy: boolean;
  responseTime: number;
  details: Record<string, any>;
  error?: string;
}

/**
 * Deployment driver interface
 * All drivers (Coolify, K8s, Nomad) must implement this interface
 */
export interface DeploymentDriver {
  /**
   * Get driver name
   */
  getName(): string;

  /**
   * Get driver version
   */
  getVersion(): string;

  /**
   * Initialize the driver
   */
  initialize(): Promise<void>;

  /**
   * Deploy infrastructure based on configuration
   */
  deploy(config: DeploymentConfig): Promise<DeploymentResult>;

  /**
   * Get current deployment status
   */
  getStatus(): Promise<DeploymentStatus>;

  /**
   * Perform health check
   */
  healthCheck(): Promise<HealthCheckResult>;

  /**
   * Scale a service to specified number of replicas
   */
  scale(serviceName: string, replicas: number): Promise<void>;

  /**
   * Restart a service
   */
  restart(serviceName: string): Promise<void>;

  /**
   * Get service logs
   */
  getLogs(serviceName: string, lines?: number): Promise<string>;

  /**
   * Cleanup deployment resources
   */
  cleanup(): Promise<void>;
}

/**
 * Driver factory interface
 */
export interface DriverFactory {
  /**
   * Create driver instance
   */
  createDriver(config: DeploymentDriverConfig): DeploymentDriver;

  /**
   * Get supported driver types
   */
  getSupportedTypes(): string[];

  /**
   * Validate driver configuration
   */
  validateConfig(config: DeploymentDriverConfig): Promise<boolean>;
}

/**
 * Driver registry for managing multiple deployment drivers
 */
export interface DriverRegistry {
  /**
   * Register a driver factory
   */
  registerDriver(type: string, factory: DriverFactory): void;

  /**
   * Get driver factory by type
   */
  getDriverFactory(type: string): DriverFactory | undefined;

  /**
   * Get all registered driver types
   */
  getRegisteredTypes(): string[];

  /**
   * Create driver instance
   */
  createDriver(type: string, config: DeploymentDriverConfig): Promise<DeploymentDriver>;
}

/**
 * Deployment orchestration options
 */
export interface DeploymentOptions {
  driverType: 'coolify' | 'kubernetes' | 'nomad';
  driverConfig: DeploymentDriverConfig;
  timeout?: number;
  retries?: number;
  validateOnly?: boolean;
  dryRun?: boolean;
}

/**
 * Multi-driver deployment result
 */
export interface MultiDriverDeploymentResult {
  primary: DeploymentResult;
  fallback?: DeploymentResult;
  driverUsed: string;
  fallbackUsed: boolean;
  totalDuration: number;
}