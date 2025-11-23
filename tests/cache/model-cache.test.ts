/**
 * Tests for Model Inference Cache
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeRedis, disconnectRedis, getRedisClient } from '../../src/cache/redis-client.js';
import { modelCache } from '../../src/cache/model-cache.js';

describe('Model Cache', () => {
  const workspaceId = 'ws-test-123';
  const modelId = 'llama-3-8b';

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
    
    // Reset configuration
    modelCache.configure({
      enabled: true,
      ttl: 3600,
      maxInputLength: 10000,
      minConfidence: 0.8,
    });
  });

  describe('Basic Caching', () => {
    it('should cache and retrieve inference result', async () => {
      const input = 'What is the capital of Spain?';
      const output = 'The capital of Spain is Madrid.';

      await modelCache.set(modelId, input, output, workspaceId, {
        tokens: 50,
        latencyMs: 1500,
      });

      const cached = await modelCache.get(modelId, input, workspaceId);

      expect(cached).not.toBeNull();
      expect(cached!.output).toBe(output);
      expect(cached!.metadata.tokens).toBe(50);
      expect(cached!.metadata.latencyMs).toBe(1500);
    });

    it('should return null for cache miss', async () => {
      const input = 'Non-cached query';
      const cached = await modelCache.get(modelId, input, workspaceId);

      expect(cached).toBeNull();
    });

    it('should use input hash for cache key', async () => {
      const input = 'Test input for hashing';
      const output = 'Test output';

      await modelCache.set(modelId, input, output, workspaceId, {
        tokens: 10,
        latencyMs: 100,
      });

      // Same input should hit cache
      const cached = await modelCache.get(modelId, input, workspaceId);
      expect(cached).not.toBeNull();
      expect(cached!.output).toBe(output);
    });
  });

  describe('Configuration', () => {
    it('should not cache when disabled', async () => {
      modelCache.configure({ enabled: false });

      const input = 'Test input';
      const output = 'Test output';

      const success = await modelCache.set(modelId, input, output, workspaceId, {
        tokens: 10,
        latencyMs: 100,
      });

      expect(success).toBe(false);

      const cached = await modelCache.get(modelId, input, workspaceId);
      expect(cached).toBeNull();
    });

    it('should not cache inputs exceeding max length', async () => {
      modelCache.configure({ maxInputLength: 50 });

      const longInput = 'a'.repeat(100);
      const output = 'Test output';

      const success = await modelCache.set(modelId, longInput, output, workspaceId, {
        tokens: 10,
        latencyMs: 100,
      });

      expect(success).toBe(false);
    });

    it('should not cache low confidence results', async () => {
      modelCache.configure({ minConfidence: 0.8 });

      const input = 'Test input';
      const output = 'Low confidence output';

      const success = await modelCache.set(modelId, input, output, workspaceId, {
        tokens: 10,
        latencyMs: 100,
        confidence: 0.5, // Below threshold
      });

      expect(success).toBe(false);
    });

    it('should cache high confidence results', async () => {
      modelCache.configure({ minConfidence: 0.8 });

      const input = 'Test input';
      const output = 'High confidence output';

      const success = await modelCache.set(modelId, input, output, workspaceId, {
        tokens: 10,
        latencyMs: 100,
        confidence: 0.95, // Above threshold
      });

      expect(success).toBe(true);

      const cached = await modelCache.get(modelId, input, workspaceId);
      expect(cached).not.toBeNull();
    });
  });

  describe('Invalidation', () => {
    it('should invalidate cache for specific model', async () => {
      const input1 = 'Query 1';
      const input2 = 'Query 2';

      await modelCache.set(modelId, input1, 'Output 1', workspaceId, {
        tokens: 10,
        latencyMs: 100,
      });

      await modelCache.set(modelId, input2, 'Output 2', workspaceId, {
        tokens: 10,
        latencyMs: 100,
      });

      const count = await modelCache.invalidateModel(modelId, workspaceId);
      expect(count).toBeGreaterThan(0);

      // Both should be invalidated
      expect(await modelCache.get(modelId, input1, workspaceId)).toBeNull();
      expect(await modelCache.get(modelId, input2, workspaceId)).toBeNull();
    });

    it('should invalidate all model cache for workspace', async () => {
      const model1 = 'model-1';
      const model2 = 'model-2';

      await modelCache.set(model1, 'Input 1', 'Output 1', workspaceId, {
        tokens: 10,
        latencyMs: 100,
      });

      await modelCache.set(model2, 'Input 2', 'Output 2', workspaceId, {
        tokens: 10,
        latencyMs: 100,
      });

      const count = await modelCache.invalidateWorkspace(workspaceId);
      expect(count).toBeGreaterThan(0);

      // All should be invalidated
      expect(await modelCache.get(model1, 'Input 1', workspaceId)).toBeNull();
      expect(await modelCache.get(model2, 'Input 2', workspaceId)).toBeNull();
    });
  });

  describe('Workspace Isolation', () => {
    it('should isolate cache between workspaces', async () => {
      const workspace1 = 'ws-1';
      const workspace2 = 'ws-2';
      const input = 'Same input';

      await modelCache.set(modelId, input, 'Output for WS1', workspace1, {
        tokens: 10,
        latencyMs: 100,
      });

      await modelCache.set(modelId, input, 'Output for WS2', workspace2, {
        tokens: 10,
        latencyMs: 100,
      });

      const cached1 = await modelCache.get(modelId, input, workspace1);
      const cached2 = await modelCache.get(modelId, input, workspace2);

      expect(cached1!.output).toBe('Output for WS1');
      expect(cached2!.output).toBe('Output for WS2');
    });
  });

  describe('Warm Up', () => {
    it('should warm up cache with common queries', async () => {
      const entries = [
        {
          modelId: 'model-1',
          input: 'Common query 1',
          output: 'Answer 1',
          workspaceId,
          metadata: { tokens: 10, latencyMs: 100 },
        },
        {
          modelId: 'model-1',
          input: 'Common query 2',
          output: 'Answer 2',
          workspaceId,
          metadata: { tokens: 15, latencyMs: 150 },
        },
      ];

      await modelCache.warmUp(entries);

      for (const entry of entries) {
        const cached = await modelCache.get(entry.modelId, entry.input, workspaceId);
        expect(cached).not.toBeNull();
        expect(cached!.output).toBe(entry.output);
      }
    });
  });

  describe('Metadata Storage', () => {
    it('should store and retrieve metadata', async () => {
      const input = 'Test input';
      const output = 'Test output';
      const metadata = {
        tokens: 42,
        latencyMs: 1234,
      };

      await modelCache.set(modelId, input, output, workspaceId, metadata);

      const cached = await modelCache.get(modelId, input, workspaceId);

      expect(cached!.metadata.tokens).toBe(metadata.tokens);
      expect(cached!.metadata.latencyMs).toBe(metadata.latencyMs);
      expect(cached!.metadata.timestamp).toBeDefined();
    });
  });
});
