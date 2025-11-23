/**
 * Model Inference Cache
 * 
 * Caches AI model inference results to reduce latency and computational costs.
 * Implements intelligent cache invalidation and hit rate optimization.
 */

import crypto from 'crypto';
import { cacheManager, CacheKeys, DefaultTTL } from './cache-manager.js';
import { logger } from '../observability/logger.js';
import { metricsCollector } from '../observability/metrics.js';

export interface ModelCacheEntry {
  modelId: string;
  input: string;
  inputHash: string;
  output: string;
  metadata: {
    tokens: number;
    latencyMs: number;
    timestamp: string;
  };
}

export interface ModelCacheConfig {
  enabled: boolean;
  ttl: number;
  maxInputLength: number;
  minConfidence: number;
}

class ModelCache {
  private config: ModelCacheConfig = {
    enabled: true,
    ttl: DefaultTTL.long, // 1 hour default
    maxInputLength: 10000, // Don't cache very long inputs
    minConfidence: 0.8, // Only cache high-confidence results
  };

  /**
   * Configure model cache
   */
  configure(config: Partial<ModelCacheConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Model cache configured', this.config);
  }

  /**
   * Get cached inference result
   */
  async get(
    modelId: string,
    input: string,
    workspaceId: string
  ): Promise<ModelCacheEntry | null> {
    if (!this.config.enabled) {
      return null;
    }

    if (input.length > this.config.maxInputLength) {
      logger.debug('Input too long for caching', {
        length: input.length,
        max: this.config.maxInputLength,
      });
      return null;
    }

    const inputHash = this.hashInput(input);
    const key = CacheKeys.modelCache(modelId, inputHash);

    const cached = await cacheManager.get<ModelCacheEntry>(key, {
      namespace: `workspace:${workspaceId}`,
    });

    if (cached) {
      logger.info('Model cache hit', {
        modelId,
        workspaceId,
        inputHash,
      });

      metricsCollector.recordInferenceDuration(0, {
        workspace_id: workspaceId,
        model: modelId,
        cached: 'true',
      });
    }

    return cached;
  }

  /**
   * Store inference result in cache
   */
  async set(
    modelId: string,
    input: string,
    output: string,
    workspaceId: string,
    metadata: {
      tokens: number;
      latencyMs: number;
      confidence?: number;
    }
  ): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    if (input.length > this.config.maxInputLength) {
      return false;
    }

    // Only cache high-confidence results
    if (metadata.confidence && metadata.confidence < this.config.minConfidence) {
      logger.debug('Confidence too low for caching', {
        confidence: metadata.confidence,
        min: this.config.minConfidence,
      });
      return false;
    }

    const inputHash = this.hashInput(input);
    const key = CacheKeys.modelCache(modelId, inputHash);

    const entry: ModelCacheEntry = {
      modelId,
      input,
      inputHash,
      output,
      metadata: {
        tokens: metadata.tokens,
        latencyMs: metadata.latencyMs,
        timestamp: new Date().toISOString(),
      },
    };

    const success = await cacheManager.set(key, entry, {
      namespace: `workspace:${workspaceId}`,
      ttl: this.config.ttl,
    });

    if (success) {
      logger.info('Model result cached', {
        modelId,
        workspaceId,
        inputHash,
        tokens: metadata.tokens,
      });
    }

    return success;
  }

  /**
   * Invalidate cache for a specific model
   */
  async invalidateModel(modelId: string, workspaceId: string): Promise<number> {
    const pattern = `workspace:${workspaceId}:model:${modelId}:*`;
    const count = await cacheManager.invalidatePattern(pattern);

    logger.info('Model cache invalidated', {
      modelId,
      workspaceId,
      count,
    });

    return count;
  }

  /**
   * Invalidate all model cache for a workspace
   */
  async invalidateWorkspace(workspaceId: string): Promise<number> {
    const pattern = `workspace:${workspaceId}:model:*`;
    return await cacheManager.invalidatePattern(pattern);
  }

  /**
   * Get cache statistics for a model
   */
  async getModelStats(modelId: string, workspaceId: string): Promise<{
    cachedEntries: number;
    totalSize: number;
  }> {
    // This is a simplified version - in production, you'd track this more precisely
    const stats = await cacheManager.getStats();
    
    return {
      cachedEntries: 0, // Would need to scan keys
      totalSize: stats.memory,
    };
  }

  /**
   * Hash input for cache key generation
   */
  private hashInput(input: string): string {
    return crypto
      .createHash('sha256')
      .update(input)
      .digest('hex')
      .substring(0, 16); // Use first 16 chars for shorter keys
  }

  /**
   * Pre-warm cache with common queries
   */
  async warmUp(
    entries: Array<{
      modelId: string;
      input: string;
      output: string;
      workspaceId: string;
      metadata: { tokens: number; latencyMs: number };
    }>
  ): Promise<void> {
    logger.info('Model cache warm-up started', { count: entries.length });

    const promises = entries.map((entry) =>
      this.set(
        entry.modelId,
        entry.input,
        entry.output,
        entry.workspaceId,
        entry.metadata
      )
    );

    await Promise.all(promises);

    logger.info('Model cache warm-up completed', { count: entries.length });
  }
}

// Singleton instance
export const modelCache = new ModelCache();
