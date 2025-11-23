/**
 * Cache Module
 * 
 * Central export for all caching functionality including:
 * - Redis client management
 * - General-purpose cache manager
 * - Model inference caching
 * - Database query caching
 */

export {
  initializeRedis,
  getRedisClient,
  disconnectRedis,
  type RedisConfig,
} from './redis-client.js';

export {
  cacheManager,
  CacheKeys,
  DefaultTTL,
  type CacheOptions,
  type CacheStats,
} from './cache-manager.js';

export {
  modelCache,
  type ModelCacheEntry,
  type ModelCacheConfig,
} from './model-cache.js';

export {
  queryCache,
  type QueryCacheOptions,
} from './query-cache.js';
