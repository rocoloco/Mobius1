/**
 * Redis Client Configuration
 * 
 * Provides Redis connection management with automatic reconnection,
 * error handling, and connection pooling for optimal performance.
 */

import Redis, { RedisOptions } from 'ioredis';
import { logger } from '../observability/logger.js';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  maxRetriesPerRequest?: number;
  enableReadyCheck?: boolean;
  enableOfflineQueue?: boolean;
  connectTimeout?: number;
  lazyConnect?: boolean;
}

class RedisClient {
  private client: Redis | null = null;
  private config: RedisConfig;
  private isConnected: boolean = false;

  constructor(config: RedisConfig) {
    this.config = config;
  }

  /**
   * Initialize Redis connection
   */
  async connect(): Promise<void> {
    if (this.client && this.isConnected) {
      logger.warn('Redis client already connected');
      return;
    }

    const options: RedisOptions = {
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      db: this.config.db || 0,
      keyPrefix: this.config.keyPrefix || 'mobius1:',
      maxRetriesPerRequest: this.config.maxRetriesPerRequest || 3,
      enableReadyCheck: this.config.enableReadyCheck ?? true,
      enableOfflineQueue: this.config.enableOfflineQueue ?? true,
      connectTimeout: this.config.connectTimeout || 10000,
      lazyConnect: this.config.lazyConnect ?? false,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        logger.warn('Redis connection retry', { attempt: times, delay });
        return delay;
      },
    };

    this.client = new Redis(options);

    // Event handlers
    this.client.on('connect', () => {
      logger.info('Redis client connecting');
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      logger.info('Redis client ready', {
        host: this.config.host,
        port: this.config.port,
        db: this.config.db,
      });
    });

    this.client.on('error', (error) => {
      logger.error('Redis client error', error, {
        host: this.config.host,
        port: this.config.port,
      });
    });

    this.client.on('close', () => {
      this.isConnected = false;
      logger.warn('Redis client connection closed');
    });

    this.client.on('reconnecting', () => {
      logger.info('Redis client reconnecting');
    });

    // Wait for connection if not lazy
    if (!this.config.lazyConnect) {
      await this.client.connect();
    }
  }

  /**
   * Disconnect Redis client
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
      logger.info('Redis client disconnected');
    }
  }

  /**
   * Get Redis client instance
   */
  getClient(): Redis {
    if (!this.client) {
      throw new Error('Redis client not initialized. Call connect() first.');
    }
    return this.client;
  }

  /**
   * Check if Redis is connected
   */
  isReady(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * Ping Redis server
   */
  async ping(): Promise<boolean> {
    try {
      if (!this.client) return false;
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis ping failed', error as Error);
      return false;
    }
  }

  /**
   * Get Redis info
   */
  async getInfo(): Promise<Record<string, string>> {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }

    const info = await this.client.info();
    const lines = info.split('\r\n');
    const result: Record<string, string> = {};

    for (const line of lines) {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        if (key && value) {
          result[key] = value;
        }
      }
    }

    return result;
  }

  /**
   * Flush all keys in current database
   */
  async flushDb(): Promise<void> {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }
    await this.client.flushdb();
    logger.warn('Redis database flushed', { db: this.config.db });
  }

  /**
   * Get memory usage statistics
   */
  async getMemoryStats(): Promise<{
    used: number;
    peak: number;
    fragmentation: number;
  }> {
    const info = await this.getInfo();
    return {
      used: parseInt(info.used_memory || '0', 10),
      peak: parseInt(info.used_memory_peak || '0', 10),
      fragmentation: parseFloat(info.mem_fragmentation_ratio || '0'),
    };
  }
}

// Singleton instance
let redisClient: RedisClient | null = null;

/**
 * Initialize Redis client with configuration
 */
export function initializeRedis(config: RedisConfig): RedisClient {
  if (redisClient) {
    logger.warn('Redis client already initialized');
    return redisClient;
  }

  redisClient = new RedisClient(config);
  return redisClient;
}

/**
 * Get Redis client instance
 */
export function getRedisClient(): RedisClient {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call initializeRedis() first.');
  }
  return redisClient;
}

/**
 * Disconnect Redis client
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.disconnect();
    redisClient = null;
  }
}
