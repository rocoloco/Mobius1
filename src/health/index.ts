/**
 * Health Check System for Mobius 1 Platform
 * Validates connectivity and status of all infrastructure components
 * Required for FR-008 (Self-Healing Infrastructure)
 */

import Redis from 'ioredis';

import { DatabaseClient } from '../database/client.js';
import { appConfig } from '../config/index.js';

/**
 * Health check result interface
 */
export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  error?: string;
  details?: any;
}

/**
 * Overall system health status
 */
export interface SystemHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  checks: HealthCheckResult[];
  uptime: number;
}

/**
 * Health Check Service
 * Performs comprehensive health checks on all system components
 */
export class HealthCheckService {
  private redis: Redis | null = null;

  constructor() {
    // Initialize Redis client for health checks
    this.redis = new Redis(appConfig.redis.url, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
  }

  /**
   * Perform comprehensive system health check
   */
  async checkSystemHealth(): Promise<SystemHealth> {
    const checks: HealthCheckResult[] = [];

    // Run all health checks in parallel
    const [
      databaseCheck,
      redisCheck,
      minioCheck,
      qdrantCheck,
    ] = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkMinIO(),
      this.checkQdrant(),
    ]);

    // Process results
    checks.push(this.processCheckResult('database', databaseCheck));
    checks.push(this.processCheckResult('redis', redisCheck));
    checks.push(this.processCheckResult('minio', minioCheck));
    checks.push(this.processCheckResult('qdrant', qdrantCheck));

    // Determine overall system status
    const overallStatus = this.determineOverallStatus(checks);

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
      uptime: process.uptime(),
    };
  }

  /**
   * Check PostgreSQL database connectivity
   */
  private async checkDatabase(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const isConnected = await DatabaseClient.testConnection();
      const responseTime = Date.now() - startTime;

      if (isConnected) {
        return {
          service: 'database',
          status: 'healthy',
          responseTime,
          details: { url: appConfig.database.url.replace(/:[^:@]*@/, ':***@') },
        };
      } else {
        return {
          service: 'database',
          status: 'unhealthy',
          responseTime,
          error: 'Database connection failed',
        };
      }
    } catch (error) {
      return {
        service: 'database',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown database error',
      };
    }
  }

  /**
   * Check Redis connectivity
   */
  private async checkRedis(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      if (!this.redis) {
        throw new Error('Redis client not initialized');
      }

      const result = await this.redis.ping();
      const responseTime = Date.now() - startTime;

      if (result === 'PONG') {
        return {
          service: 'redis',
          status: 'healthy',
          responseTime,
          details: { url: appConfig.redis.url.replace(/:[^:@]*@/, ':***@') },
        };
      } else {
        return {
          service: 'redis',
          status: 'unhealthy',
          responseTime,
          error: 'Redis ping failed',
        };
      }
    } catch (error) {
      return {
        service: 'redis',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown Redis error',
      };
    }
  }

  /**
   * Check MinIO object storage connectivity
   */
  private async checkMinIO(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const protocol = appConfig.minio.useSSL ? 'https' : 'http';
      const url = `${protocol}://${appConfig.minio.endpoint}:${appConfig.minio.port}/minio/health/live`;
      
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        return {
          service: 'minio',
          status: 'healthy',
          responseTime,
          details: { endpoint: `${appConfig.minio.endpoint}:${appConfig.minio.port}` },
        };
      } else {
        return {
          service: 'minio',
          status: 'unhealthy',
          responseTime,
          error: `MinIO health check failed: ${response.status} ${response.statusText}`,
        };
      }
    } catch (error) {
      return {
        service: 'minio',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown MinIO error',
      };
    }
  }

  /**
   * Check Qdrant vector database connectivity
   */
  private async checkQdrant(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const url = `${appConfig.qdrant.url}/health`;
      
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        return {
          service: 'qdrant',
          status: 'healthy',
          responseTime,
          details: { url: appConfig.qdrant.url },
        };
      } else {
        return {
          service: 'qdrant',
          status: 'unhealthy',
          responseTime,
          error: `Qdrant health check failed: ${response.status} ${response.statusText}`,
        };
      }
    } catch (error) {
      return {
        service: 'qdrant',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown Qdrant error',
      };
    }
  }

  /**
   * Process settled promise result into health check result
   */
  private processCheckResult(
    service: string,
    result: PromiseSettledResult<HealthCheckResult>
  ): HealthCheckResult {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        service,
        status: 'unhealthy',
        responseTime: 0,
        error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
      };
    }
  }

  /**
   * Determine overall system status based on individual checks
   */
  private determineOverallStatus(checks: HealthCheckResult[]): 'healthy' | 'unhealthy' | 'degraded' {
    const unhealthyCount = checks.filter(check => check.status === 'unhealthy').length;
    const degradedCount = checks.filter(check => check.status === 'degraded').length;

    if (unhealthyCount === 0 && degradedCount === 0) {
      return 'healthy';
    } else if (unhealthyCount > 0) {
      return 'unhealthy';
    } else {
      return 'degraded';
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
  }
}

/**
 * Global health check service instance
 */
export const healthCheckService = new HealthCheckService();