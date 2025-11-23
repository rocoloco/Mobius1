/**
 * Tests for Database Query Cache
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeRedis, disconnectRedis, getRedisClient } from '../../src/cache/redis-client.js';
import { queryCache } from '../../src/cache/query-cache.js';

describe('Query Cache', () => {
  beforeAll(async () => {
    initializeRedis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      db: 15,
    });

    await getRedisClient().connect();
  });

  afterAll(async () => {
    await disconnectRedis();
  });

  beforeEach(async () => {
    await getRedisClient().getClient().flushdb();
  });

  describe('Basic Query Caching', () => {
    it('should cache query result', async () => {
      let queryExecutions = 0;

      const queryFn = async () => {
        queryExecutions++;
        return { data: 'test result', count: queryExecutions };
      };

      // First call - should execute query
      const result1 = await queryCache.cacheQuery('test:query', queryFn);
      expect(result1.count).toBe(1);
      expect(queryExecutions).toBe(1);

      // Second call - should use cache
      const result2 = await queryCache.cacheQuery('test:query', queryFn);
      expect(result2.count).toBe(1); // Same as first
      expect(queryExecutions).toBe(1); // Query not executed again
    });

    it('should execute query on cache miss', async () => {
      const queryFn = async () => ({ data: 'fresh data' });

      const result = await queryCache.cacheQuery('new:query', queryFn);
      expect(result.data).toBe('fresh data');
    });
  });

  describe('Invalidation', () => {
    it('should invalidate specific query', async () => {
      let executions = 0;
      const queryFn = async () => ({ count: ++executions });

      await queryCache.cacheQuery('test:invalidate', queryFn);
      expect(executions).toBe(1);

      // Invalidate
      await queryCache.invalidate('test:invalidate');

      // Should execute query again
      await queryCache.cacheQuery('test:invalidate', queryFn);
      expect(executions).toBe(2);
    });

    it('should invalidate by tag', async () => {
      let executions = 0;
      const queryFn = async () => ({ count: ++executions });

      await queryCache.cacheQuery('query:1', queryFn, {
        tags: ['user', 'user-123'],
      });

      await queryCache.cacheQuery('query:2', queryFn, {
        tags: ['user', 'user-123'],
      });

      expect(executions).toBe(2);

      // Invalidate by tag
      const count = await queryCache.invalidateByTag('user-123');
      expect(count).toBeGreaterThan(0);

      // Both queries should execute again
      await queryCache.cacheQuery('query:1', queryFn, {
        tags: ['user', 'user-123'],
      });
      await queryCache.cacheQuery('query:2', queryFn, {
        tags: ['user', 'user-123'],
      });

      expect(executions).toBe(4);
    });

    it('should invalidate workspace queries', async () => {
      const workspaceId = 'ws-123';
      let executions = 0;
      const queryFn = async () => ({ count: ++executions });

      await queryCache.cacheQuery('query:1', queryFn, { workspaceId });
      await queryCache.cacheQuery('query:2', queryFn, { workspaceId });

      expect(executions).toBe(2);

      const count = await queryCache.invalidateWorkspace(workspaceId);
      expect(count).toBeGreaterThan(0);

      // Queries should execute again
      await queryCache.cacheQuery('query:1', queryFn, { workspaceId });
      expect(executions).toBe(3);
    });
  });

  describe('Specialized Cache Methods', () => {
    it('should cache user query', async () => {
      let executions = 0;
      const queryFn = async () => ({ userId: 'user-123', count: ++executions });

      const result1 = await queryCache.cacheUser('user-123', queryFn);
      expect(result1.count).toBe(1);

      const result2 = await queryCache.cacheUser('user-123', queryFn);
      expect(result2.count).toBe(1); // Cached
      expect(executions).toBe(1);
    });

    it('should cache workspace query', async () => {
      let executions = 0;
      const queryFn = async () => ({ workspaceId: 'ws-123', count: ++executions });

      const result1 = await queryCache.cacheWorkspace('ws-123', queryFn);
      expect(result1.count).toBe(1);

      const result2 = await queryCache.cacheWorkspace('ws-123', queryFn);
      expect(result2.count).toBe(1); // Cached
      expect(executions).toBe(1);
    });

    it('should cache document query', async () => {
      let executions = 0;
      const queryFn = async () => ({ documentId: 'doc-123', count: ++executions });

      const result1 = await queryCache.cacheDocument('doc-123', 'ws-123', queryFn);
      expect(result1.count).toBe(1);

      const result2 = await queryCache.cacheDocument('doc-123', 'ws-123', queryFn);
      expect(result2.count).toBe(1); // Cached
      expect(executions).toBe(1);
    });

    it('should cache template query', async () => {
      let executions = 0;
      const queryFn = async () => ({ templateId: 'tpl-123', count: ++executions });

      const result1 = await queryCache.cacheTemplate('tpl-123', queryFn);
      expect(result1.count).toBe(1);

      const result2 = await queryCache.cacheTemplate('tpl-123', queryFn);
      expect(result2.count).toBe(1); // Cached
      expect(executions).toBe(1);
    });
  });

  describe('List Caching with Pagination', () => {
    it('should cache paginated list queries', async () => {
      let executions = 0;
      const queryFn = async () => ({
        items: ['item1', 'item2'],
        count: ++executions,
      });

      // Page 1
      const result1 = await queryCache.cacheList('users', 1, 10, queryFn);
      expect(result1.count).toBe(1);

      // Same page - should use cache
      const result2 = await queryCache.cacheList('users', 1, 10, queryFn);
      expect(result2.count).toBe(1);
      expect(executions).toBe(1);

      // Different page - should execute query
      const result3 = await queryCache.cacheList('users', 2, 10, queryFn);
      expect(result3.count).toBe(2);
      expect(executions).toBe(2);
    });

    it('should cache different page sizes separately', async () => {
      let executions = 0;
      const queryFn = async () => ({ count: ++executions });

      await queryCache.cacheList('items', 1, 10, queryFn);
      await queryCache.cacheList('items', 1, 20, queryFn);

      expect(executions).toBe(2); // Different page sizes
    });
  });

  describe('Key Generation', () => {
    it('should generate consistent keys for same parameters', () => {
      const params1 = { userId: '123', status: 'active' };
      const params2 = { status: 'active', userId: '123' }; // Different order

      const key1 = queryCache.generateKey('users', params1);
      const key2 = queryCache.generateKey('users', params2);

      expect(key1).toBe(key2); // Should be same despite order
    });

    it('should generate different keys for different parameters', () => {
      const params1 = { userId: '123' };
      const params2 = { userId: '456' };

      const key1 = queryCache.generateKey('users', params1);
      const key2 = queryCache.generateKey('users', params2);

      expect(key1).not.toBe(key2);
    });
  });

  describe('Workspace Isolation', () => {
    it('should isolate queries between workspaces', async () => {
      let executions = 0;
      const queryFn = async () => ({ count: ++executions });

      await queryCache.cacheQuery('same:query', queryFn, {
        workspaceId: 'ws-1',
      });

      await queryCache.cacheQuery('same:query', queryFn, {
        workspaceId: 'ws-2',
      });

      // Both should execute (different workspaces)
      expect(executions).toBe(2);
    });
  });

  describe('TTL Configuration', () => {
    it('should respect custom TTL', async () => {
      const queryFn = async () => ({ data: 'test' });

      await queryCache.cacheQuery('test:ttl', queryFn, { ttl: 1 });

      // Should exist immediately
      let result = await queryCache.cacheQuery('test:ttl', queryFn);
      expect(result.data).toBe('test');

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should execute query again
      let executions = 0;
      const newQueryFn = async () => ({ data: 'new', count: ++executions });
      
      result = await queryCache.cacheQuery('test:ttl', newQueryFn, { ttl: 60 });
      expect(executions).toBe(1); // Query executed
    });
  });
});
