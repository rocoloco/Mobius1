/**
 * Database Connection Pool Optimization
 * 
 * Optimizes Prisma connection pooling for high-performance database access.
 * Implements connection lifecycle management and monitoring.
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../observability/logger.js';
import { metricsCollector } from '../observability/metrics.js';

export interface ConnectionPoolConfig {
  connectionLimit?: number;
  poolTimeout?: number;
  idleTimeout?: number;
  maxLifetime?: number;
  enableQueryLogging?: boolean;
  slowQueryThreshold?: number; // ms
}

class DatabaseConnectionPool {
  private prisma: PrismaClient | null = null;
  private config: ConnectionPoolConfig;
  private queryCount: number = 0;
  private slowQueryCount: number = 0;

  constructor(config: ConnectionPoolConfig = {}) {
    this.config = {
      connectionLimit: config.connectionLimit || 10,
      poolTimeout: config.poolTimeout || 10000,
      idleTimeout: config.idleTimeout || 60000,
      maxLifetime: config.maxLifetime || 3600000,
      enableQueryLogging: config.enableQueryLogging ?? false,
      slowQueryThreshold: config.slowQueryThreshold || 1000,
    };
  }

  /**
   * Initialize Prisma client with optimized connection pool
   */
  initialize(): PrismaClient {
    if (this.prisma) {
      logger.warn('Database connection pool already initialized');
      return this.prisma;
    }

    const databaseUrl = this.buildConnectionString();

    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
      log: this.config.enableQueryLogging
        ? [
            { level: 'query', emit: 'event' },
            { level: 'error', emit: 'event' },
            { level: 'warn', emit: 'event' },
          ]
        : [],
    });

    // Set up query logging
    if (this.config.enableQueryLogging) {
      this.setupQueryLogging();
    }

    logger.info('Database connection pool initialized', {
      connectionLimit: this.config.connectionLimit,
      poolTimeout: this.config.poolTimeout,
    });

    return this.prisma;
  }

  /**
   * Get Prisma client instance
   */
  getClient(): PrismaClient {
    if (!this.prisma) {
      throw new Error('Database connection pool not initialized');
    }
    return this.prisma;
  }

  /**
   * Disconnect from database
   */
  async disconnect(): Promise<void> {
    if (this.prisma) {
      await this.prisma.$disconnect();
      this.prisma = null;
      logger.info('Database connection pool disconnected');
    }
  }

  /**
   * Execute query with automatic retry
   */
  async executeWithRetry<T>(
    operation: (prisma: PrismaClient) => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    const prisma = this.getClient();
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation(prisma);
      } catch (error) {
        lastError = error as Error;
        
        logger.warn('Database operation failed, retrying', {
          attempt,
          maxRetries,
          error: lastError.message,
        });

        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.min(100 * Math.pow(2, attempt - 1), 1000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    logger.error('Database operation failed after retries', lastError!, {
      maxRetries,
    });
    throw lastError;
  }

  /**
   * Execute transaction with retry
   */
  async transaction<T>(
    operations: (prisma: PrismaClient) => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    return this.executeWithRetry(
      async (prisma) => {
        return await prisma.$transaction(async (tx) => {
          return await operations(tx as PrismaClient);
        });
      },
      maxRetries
    );
  }

  /**
   * Get connection pool statistics
   */
  getStats(): {
    queryCount: number;
    slowQueryCount: number;
    slowQueryRate: number;
  } {
    const slowQueryRate =
      this.queryCount > 0 ? (this.slowQueryCount / this.queryCount) * 100 : 0;

    return {
      queryCount: this.queryCount,
      slowQueryCount: this.slowQueryCount,
      slowQueryRate: Math.round(slowQueryRate * 100) / 100,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.queryCount = 0;
    this.slowQueryCount = 0;
  }

  /**
   * Build optimized connection string
   */
  private buildConnectionString(): string {
    const baseUrl = process.env.DATABASE_URL || '';
    
    // Add connection pool parameters
    const params = new URLSearchParams({
      connection_limit: this.config.connectionLimit!.toString(),
      pool_timeout: this.config.poolTimeout!.toString(),
      connect_timeout: '10',
      socket_timeout: '30',
    });

    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}${params.toString()}`;
  }

  /**
   * Setup query logging and monitoring
   */
  private setupQueryLogging(): void {
    if (!this.prisma) return;

    // @ts-ignore - Prisma event types
    this.prisma.$on('query', (e: any) => {
      this.queryCount++;

      const duration = e.duration;
      
      if (duration > this.config.slowQueryThreshold!) {
        this.slowQueryCount++;
        
        logger.warn('Slow query detected', {
          query: e.query,
          duration,
          params: e.params,
        });

        metricsCollector.recordError({
          service: 'database',
          error_type: 'slow_query',
        });
      }

      if (this.config.enableQueryLogging) {
        logger.debug('Database query executed', {
          query: e.query,
          duration,
        });
      }
    });

    // @ts-ignore
    this.prisma.$on('error', (e: any) => {
      logger.error('Database error', new Error(e.message), {
        target: e.target,
      });
    });

    // @ts-ignore
    this.prisma.$on('warn', (e: any) => {
      logger.warn('Database warning', {
        message: e.message,
      });
    });
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const prisma = this.getClient();
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      logger.error('Database health check failed', error as Error);
      return false;
    }
  }
}

// Singleton instance
let connectionPool: DatabaseConnectionPool | null = null;

/**
 * Initialize database connection pool
 */
export function initializeConnectionPool(
  config: ConnectionPoolConfig = {}
): PrismaClient {
  if (!connectionPool) {
    connectionPool = new DatabaseConnectionPool(config);
  }
  return connectionPool.initialize();
}

/**
 * Get database connection pool
 */
export function getConnectionPool(): DatabaseConnectionPool {
  if (!connectionPool) {
    throw new Error('Connection pool not initialized');
  }
  return connectionPool;
}

/**
 * Disconnect database connection pool
 */
export async function disconnectConnectionPool(): Promise<void> {
  if (connectionPool) {
    await connectionPool.disconnect();
    connectionPool = null;
  }
}
