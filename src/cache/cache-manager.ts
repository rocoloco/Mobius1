/**
 * Cache Manager
 * 
 * High-level caching interface with TTL management, cache invalidation,
 * and automatic serialization/deserialization.
 */

import { getRedisClient } from './redis-client.js';
import { logger } from '../observability/logger.js';
import { metricsCollector } from '../observability/metrics.js';
import { redactPII } from '../observability/pii-redactor.js';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  namespace?: string; // Cache key namespace
  compress?: boolean; // Compress large values
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  keys: number;
  memory: number;
}

/**
 * Cache key patterns for different data types
 */
export const CacheKeys = {
  // User and workspace
  user: (userId: string) => `user:${userId}`,
  workspace: (workspaceId: string) => `workspace:${workspaceId}`,
  workspaceConfig: (workspaceId: string) => `workspace:${workspaceId}:config`,
  
  // Policy decisions
  policyDecision: (workspaceId: string, action: string) => 
    `policy:${workspaceId}:${action}`,
  
  // Documents
  document: (documentId: string) => `document:${documentId}`,
  documentMetadata: (documentId: string) => `document:${documentId}:metadata`,
  
  // Templates
  template: (templateId: string) => `template:${templateId}`,
  templateList: (category: string) => `templates:${category}`,
  
  // Model inference
  modelCache: (modelId: string, inputHash: string) => 
    `model:${modelId}:${inputHash}`,
  
  // Session and auth
  session: (sessionId: string) => `session:${sessionId}`,
  authToken: (tokenHash: string) => `auth:${tokenHash}`,
  
  // Rate limiting
  rateLimit: (identifier: string, window: string) => 
    `ratelimit:${identifier}:${window}`,
};

/**
 * Default TTL values (in seconds)
 */
export const DefaultTTL = {
  short: 60, // 1 minute
  medium: 300, // 5 minutes
  long: 3600, // 1 hour
  day: 86400, // 24 hours
  week: 604800, // 7 days
};

class CacheManager {
  private hits: number = 0;
  private misses: number = 0;

  /**
   * Get value from cache
   */
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    try {
      const redis = getRedisClient().getClient();
      const fullKey = this.buildKey(key, options.namespace);
      
      const value = await redis.get(fullKey);
      
      if (value === null) {
        this.misses++;
        logger.debug('Cache miss', { key: redactPII(fullKey) });
        return null;
      }

      this.hits++;
      logger.debug('Cache hit', { key: redactPII(fullKey) });
      
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Cache get error', error as Error, { key: redactPII(key) });
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<boolean> {
    try {
      const redis = getRedisClient().getClient();
      const fullKey = this.buildKey(key, options.namespace);
      const serialized = JSON.stringify(value);
      
      const ttl = options.ttl || DefaultTTL.medium;
      
      await redis.setex(fullKey, ttl, serialized);
      
      logger.debug('Cache set', { 
        key: redactPII(fullKey), 
        ttl,
        size: serialized.length,
      });
      
      return true;
    } catch (error) {
      logger.error('Cache set error', error as Error, { key: redactPII(key) });
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      const redis = getRedisClient().getClient();
      const fullKey = this.buildKey(key, options.namespace);
      
      const result = await redis.del(fullKey);
      
      logger.debug('Cache delete', { 
        key: redactPII(fullKey),
        deleted: result > 0,
      });
      
      return result > 0;
    } catch (error) {
      logger.error('Cache delete error', error as Error, { key: redactPII(key) });
      return false;
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      const redis = getRedisClient().getClient();
      const fullKey = this.buildKey(key, options.namespace);
      
      const result = await redis.exists(fullKey);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error', error as Error, { key: redactPII(key) });
      return false;
    }
  }

  /**
   * Get or set pattern - fetch from cache or compute and cache
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    // Compute value
    const value = await factory();

    // Store in cache
    await this.set(key, value, options);

    return value;
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidatePattern(pattern: string): Promise<number> {
    try {
      const redis = getRedisClient().getClient();
      const keys = await redis.keys(pattern);
      
      if (keys.length === 0) {
        return 0;
      }

      const result = await redis.del(...keys);
      
      logger.info('Cache pattern invalidated', {
        pattern: redactPII(pattern),
        count: result,
      });
      
      return result;
    } catch (error) {
      logger.error('Cache invalidate pattern error', error as Error, {
        pattern: redactPII(pattern),
      });
      return 0;
    }
  }

  /**
   * Invalidate all cache for a workspace
   */
  async invalidateWorkspace(workspaceId: string): Promise<number> {
    const pattern = `*workspace:${workspaceId}*`;
    return await this.invalidatePattern(pattern);
  }

  /**
   * Set with expiration time
   */
  async setWithExpiry(
    key: string,
    value: any,
    expiryMs: number,
    options: CacheOptions = {}
  ): Promise<boolean> {
    try {
      const redis = getRedisClient().getClient();
      const fullKey = this.buildKey(key, options.namespace);
      const serialized = JSON.stringify(value);
      
      await redis.psetex(fullKey, expiryMs, serialized);
      
      logger.debug('Cache set with expiry', {
        key: redactPII(fullKey),
        expiryMs,
      });
      
      return true;
    } catch (error) {
      logger.error('Cache set with expiry error', error as Error, {
        key: redactPII(key),
      });
      return false;
    }
  }

  /**
   * Increment counter
   */
  async increment(key: string, options: CacheOptions = {}): Promise<number> {
    try {
      const redis = getRedisClient().getClient();
      const fullKey = this.buildKey(key, options.namespace);
      
      const result = await redis.incr(fullKey);
      
      // Set TTL if specified
      if (options.ttl) {
        await redis.expire(fullKey, options.ttl);
      }
      
      return result;
    } catch (error) {
      logger.error('Cache increment error', error as Error, { key: redactPII(key) });
      return 0;
    }
  }

  /**
   * Decrement counter
   */
  async decrement(key: string, options: CacheOptions = {}): Promise<number> {
    try {
      const redis = getRedisClient().getClient();
      const fullKey = this.buildKey(key, options.namespace);
      
      const result = await redis.decr(fullKey);
      
      return result;
    } catch (error) {
      logger.error('Cache decrement error', error as Error, { key: redactPII(key) });
      return 0;
    }
  }

  /**
   * Get TTL for a key
   */
  async getTTL(key: string, options: CacheOptions = {}): Promise<number> {
    try {
      const redis = getRedisClient().getClient();
      const fullKey = this.buildKey(key, options.namespace);
      
      return await redis.ttl(fullKey);
    } catch (error) {
      logger.error('Cache get TTL error', error as Error, { key: redactPII(key) });
      return -1;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    try {
      const redis = getRedisClient().getClient();
      const info = await redis.info('stats');
      const dbSize = await redis.dbsize();
      const memory = await redis.info('memory');

      const total = this.hits + this.misses;
      const hitRate = total > 0 ? (this.hits / total) * 100 : 0;

      // Parse memory usage
      const memoryMatch = memory.match(/used_memory:(\d+)/);
      const memoryUsed = memoryMatch ? parseInt(memoryMatch[1], 10) : 0;

      return {
        hits: this.hits,
        misses: this.misses,
        hitRate: Math.round(hitRate * 100) / 100,
        keys: dbSize,
        memory: memoryUsed,
      };
    } catch (error) {
      logger.error('Cache get stats error', error as Error);
      return {
        hits: this.hits,
        misses: this.misses,
        hitRate: 0,
        keys: 0,
        memory: 0,
      };
    }
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Build full cache key with namespace
   */
  private buildKey(key: string, namespace?: string): string {
    if (namespace) {
      return `${namespace}:${key}`;
    }
    return key;
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmUp(data: Array<{ key: string; value: any; ttl?: number }>): Promise<void> {
    logger.info('Cache warm-up started', { count: data.length });

    const promises = data.map(({ key, value, ttl }) =>
      this.set(key, value, { ttl: ttl || DefaultTTL.long })
    );

    await Promise.all(promises);

    logger.info('Cache warm-up completed', { count: data.length });
  }
}

// Singleton instance
export const cacheManager = new CacheManager();
