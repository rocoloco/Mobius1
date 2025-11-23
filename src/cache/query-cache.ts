/**
 * Database Query Cache
 * 
 * Caches frequently accessed database queries to reduce database load
 * and improve response times. Implements smart invalidation strategies.
 */

import { cacheManager, DefaultTTL } from './cache-manager.js';
import { logger } from '../observability/logger.js';
import crypto from 'crypto';

export interface QueryCacheOptions {
  ttl?: number;
  tags?: string[]; // For tag-based invalidation
  workspaceId?: string;
}

class QueryCache {
  /**
   * Cache a database query result
   */
  async cacheQuery<T>(
    queryKey: string,
    queryFn: () => Promise<T>,
    options: QueryCacheOptions = {}
  ): Promise<T> {
    const cacheKey = this.buildQueryKey(queryKey, options.workspaceId);

    // Try to get from cache
    const cached = await cacheManager.get<T>(cacheKey);
    if (cached !== null) {
      logger.debug('Query cache hit', { queryKey });
      return cached;
    }

    // Execute query
    logger.debug('Query cache miss, executing query', { queryKey });
    const result = await queryFn();

    // Store in cache
    await cacheManager.set(cacheKey, result, {
      ttl: options.ttl || DefaultTTL.medium,
      namespace: 'query',
    });

    // Store tags for invalidation
    if (options.tags && options.tags.length > 0) {
      await this.storeTags(cacheKey, options.tags);
    }

    return result;
  }

  /**
   * Invalidate query cache by key
   */
  async invalidate(queryKey: string, workspaceId?: string): Promise<boolean> {
    const cacheKey = this.buildQueryKey(queryKey, workspaceId);
    const success = await cacheManager.delete(cacheKey, { namespace: 'query' });

    if (success) {
      logger.debug('Query cache invalidated', { queryKey });
    }

    return success;
  }

  /**
   * Invalidate all queries with a specific tag
   */
  async invalidateByTag(tag: string): Promise<number> {
    const tagKey = `query:tag:${tag}`;
    const queryKeys = await cacheManager.get<string[]>(tagKey);

    if (!queryKeys || queryKeys.length === 0) {
      return 0;
    }

    let count = 0;
    for (const queryKey of queryKeys) {
      const success = await cacheManager.delete(queryKey, { namespace: 'query' });
      if (success) count++;
    }

    // Clear the tag index
    await cacheManager.delete(tagKey);

    logger.info('Query cache invalidated by tag', { tag, count });
    return count;
  }

  /**
   * Invalidate all queries for a workspace
   */
  async invalidateWorkspace(workspaceId: string): Promise<number> {
    const pattern = `query:*:ws:${workspaceId}:*`;
    const count = await cacheManager.invalidatePattern(pattern);

    logger.info('Query cache invalidated for workspace', { workspaceId, count });
    return count;
  }

  /**
   * Cache user query
   */
  async cacheUser<T>(
    userId: string,
    queryFn: () => Promise<T>,
    ttl: number = DefaultTTL.medium
  ): Promise<T> {
    return this.cacheQuery(`user:${userId}`, queryFn, {
      ttl,
      tags: ['user', userId],
    });
  }

  /**
   * Cache workspace query
   */
  async cacheWorkspace<T>(
    workspaceId: string,
    queryFn: () => Promise<T>,
    ttl: number = DefaultTTL.medium
  ): Promise<T> {
    return this.cacheQuery(`workspace:${workspaceId}`, queryFn, {
      ttl,
      tags: ['workspace', workspaceId],
      workspaceId,
    });
  }

  /**
   * Cache document query
   */
  async cacheDocument<T>(
    documentId: string,
    workspaceId: string,
    queryFn: () => Promise<T>,
    ttl: number = DefaultTTL.long
  ): Promise<T> {
    return this.cacheQuery(`document:${documentId}`, queryFn, {
      ttl,
      tags: ['document', documentId, workspaceId],
      workspaceId,
    });
  }

  /**
   * Cache template query
   */
  async cacheTemplate<T>(
    templateId: string,
    queryFn: () => Promise<T>,
    ttl: number = DefaultTTL.day
  ): Promise<T> {
    return this.cacheQuery(`template:${templateId}`, queryFn, {
      ttl,
      tags: ['template', templateId],
    });
  }

  /**
   * Cache list query with pagination
   */
  async cacheList<T>(
    listKey: string,
    page: number,
    pageSize: number,
    queryFn: () => Promise<T>,
    options: QueryCacheOptions = {}
  ): Promise<T> {
    const paginatedKey = `${listKey}:page:${page}:size:${pageSize}`;
    return this.cacheQuery(paginatedKey, queryFn, options);
  }

  /**
   * Build cache key with workspace isolation
   */
  private buildQueryKey(queryKey: string, workspaceId?: string): string {
    if (workspaceId) {
      return `${queryKey}:ws:${workspaceId}`;
    }
    return queryKey;
  }

  /**
   * Store tags for a cache key
   */
  private async storeTags(cacheKey: string, tags: string[]): Promise<void> {
    for (const tag of tags) {
      const tagKey = `query:tag:${tag}`;
      const existingKeys = (await cacheManager.get<string[]>(tagKey)) || [];

      if (!existingKeys.includes(cacheKey)) {
        existingKeys.push(cacheKey);
        await cacheManager.set(tagKey, existingKeys, {
          ttl: DefaultTTL.day,
        });
      }
    }
  }

  /**
   * Generate cache key from query parameters
   */
  generateKey(base: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}:${params[key]}`)
      .join(':');

    const hash = crypto
      .createHash('md5')
      .update(sortedParams)
      .digest('hex')
      .substring(0, 8);

    return `${base}:${hash}`;
  }
}

// Singleton instance
export const queryCache = new QueryCache();
