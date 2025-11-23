/**
 * Tests for Cache Manager
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeRedis, disconnectRedis, getRedisClient } from '../../src/cache/redis-client.js';
import { cacheManager, CacheKeys, DefaultTTL } from '../../src/cache/cache-manager.js';

describe('Cache Manager', () => {
  beforeAll(async () => {
    // Initialize Redis for testing
    initializeRedis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      db: 15, // Use separate DB for tests
    });

    await getRedisClient().connect();
  });

  afterAll(async () => {
    await disconnectRedis();
  });

  beforeEach(async () => {
    // Clear test database before each test
    await getRedisClient().getClient().flushdb();
  });

  describe('Basic Operations', () => {
    it('should set and get a value', async () => {
      const key = 'test:key';
      const value = { data: 'test value' };

      await cacheManager.set(key, value);
      const retrieved = await cacheManager.get(key);

      expect(retrieved).toEqual(value);
    });

    it('should return null for non-existent key', async () => {
      const result = await cacheManager.get('non:existent');
      expect(result).toBeNull();
    });

    it('should delete a value', async () => {
      const key = 'test:delete';
      await cacheManager.set(key, { data: 'test' });

      const deleted = await cacheManager.delete(key);
      expect(deleted).toBe(true);

      const retrieved = await cacheManager.get(key);
      expect(retrieved).toBeNull();
    });

    it('should check if key exists', async () => {
      const key = 'test:exists';
      
      let exists = await cacheManager.exists(key);
      expect(exists).toBe(false);

      await cacheManager.set(key, { data: 'test' });
      
      exists = await cacheManager.exists(key);
      expect(exists).toBe(true);
    });
  });

  describe('TTL Management', () => {
    it('should expire key after TTL', async () => {
      const key = 'test:ttl';
      const value = { data: 'expires' };

      await cacheManager.set(key, value, { ttl: 1 }); // 1 second

      // Should exist immediately
      let retrieved = await cacheManager.get(key);
      expect(retrieved).toEqual(value);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should be expired
      retrieved = await cacheManager.get(key);
      expect(retrieved).toBeNull();
    });

    it('should get TTL for a key', async () => {
      const key = 'test:get-ttl';
      await cacheManager.set(key, { data: 'test' }, { ttl: 60 });

      const ttl = await cacheManager.getTTL(key);
      expect(ttl).toBeGreaterThan(50);
      expect(ttl).toBeLessThanOrEqual(60);
    });
  });

  describe('Get or Set Pattern', () => {
    it('should compute and cache value on first call', async () => {
      const key = 'test:getOrSet';
      let computeCount = 0;

      const factory = async () => {
        computeCount++;
        return { data: 'computed', count: computeCount };
      };

      const result1 = await cacheManager.getOrSet(key, factory);
      expect(result1.count).toBe(1);
      expect(computeCount).toBe(1);

      // Second call should use cache
      const result2 = await cacheManager.getOrSet(key, factory);
      expect(result2.count).toBe(1); // Same as first
      expect(computeCount).toBe(1); // Factory not called again
    });
  });

  describe('Pattern Invalidation', () => {
    it('should invalidate keys by pattern', async () => {
      await cacheManager.set('user:1:profile', { name: 'User 1' });
      await cacheManager.set('user:2:profile', { name: 'User 2' });
      await cacheManager.set('workspace:1:config', { setting: 'value' });

      const count = await cacheManager.invalidatePattern('*user:*');
      expect(count).toBe(2);

      // User keys should be gone
      expect(await cacheManager.get('user:1:profile')).toBeNull();
      expect(await cacheManager.get('user:2:profile')).toBeNull();

      // Workspace key should remain
      expect(await cacheManager.get('workspace:1:config')).not.toBeNull();
    });

    it('should invalidate workspace cache', async () => {
      const workspaceId = 'ws-123';
      
      await cacheManager.set(`workspace:${workspaceId}:config`, { data: 'test' });
      await cacheManager.set(`workspace:${workspaceId}:users`, ['user1', 'user2']);

      const count = await cacheManager.invalidateWorkspace(workspaceId);
      expect(count).toBeGreaterThan(0);

      expect(await cacheManager.get(`workspace:${workspaceId}:config`)).toBeNull();
    });
  });

  describe('Counters', () => {
    it('should increment counter', async () => {
      const key = 'test:counter';

      const val1 = await cacheManager.increment(key);
      expect(val1).toBe(1);

      const val2 = await cacheManager.increment(key);
      expect(val2).toBe(2);

      const val3 = await cacheManager.increment(key);
      expect(val3).toBe(3);
    });

    it('should decrement counter', async () => {
      const key = 'test:decrement';

      await cacheManager.increment(key);
      await cacheManager.increment(key);
      await cacheManager.increment(key); // Now at 3

      const val1 = await cacheManager.decrement(key);
      expect(val1).toBe(2);

      const val2 = await cacheManager.decrement(key);
      expect(val1).toBe(1);
    });

    it('should set TTL on counter increment', async () => {
      const key = 'test:counter-ttl';

      await cacheManager.increment(key, { ttl: 60 });

      const ttl = await cacheManager.getTTL(key);
      expect(ttl).toBeGreaterThan(50);
    });
  });

  describe('Cache Keys', () => {
    it('should generate correct user key', () => {
      const key = CacheKeys.user('user-123');
      expect(key).toBe('user:user-123');
    });

    it('should generate correct workspace key', () => {
      const key = CacheKeys.workspace('ws-456');
      expect(key).toBe('workspace:ws-456');
    });

    it('should generate correct policy decision key', () => {
      const key = CacheKeys.policyDecision('ws-123', 'read');
      expect(key).toBe('policy:ws-123:read');
    });

    it('should generate correct model cache key', () => {
      const key = CacheKeys.modelCache('llama-3', 'abc123');
      expect(key).toBe('model:llama-3:abc123');
    });
  });

  describe('Statistics', () => {
    it('should track cache hits and misses', async () => {
      cacheManager.resetStats();

      // Miss
      await cacheManager.get('non:existent');

      // Hit
      await cacheManager.set('test:stats', { data: 'test' });
      await cacheManager.get('test:stats');

      const stats = await cacheManager.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(50);
    });

    it('should reset statistics', async () => {
      await cacheManager.get('test:key');
      cacheManager.resetStats();

      const stats = await cacheManager.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('Namespace Support', () => {
    it('should isolate keys by namespace', async () => {
      const key = 'test:namespace';
      const value1 = { data: 'namespace1' };
      const value2 = { data: 'namespace2' };

      await cacheManager.set(key, value1, { namespace: 'ns1' });
      await cacheManager.set(key, value2, { namespace: 'ns2' });

      const retrieved1 = await cacheManager.get(key, { namespace: 'ns1' });
      const retrieved2 = await cacheManager.get(key, { namespace: 'ns2' });

      expect(retrieved1).toEqual(value1);
      expect(retrieved2).toEqual(value2);
    });
  });

  describe('Warm Up', () => {
    it('should warm up cache with multiple entries', async () => {
      const data = [
        { key: 'warm:1', value: { data: 'value1' }, ttl: 60 },
        { key: 'warm:2', value: { data: 'value2' }, ttl: 60 },
        { key: 'warm:3', value: { data: 'value3' }, ttl: 60 },
      ];

      await cacheManager.warmUp(data);

      for (const entry of data) {
        const retrieved = await cacheManager.get(entry.key);
        expect(retrieved).toEqual(entry.value);
      }
    });
  });
});
