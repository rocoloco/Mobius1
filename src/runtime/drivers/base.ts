/**
 * Base Runtime Driver
 * 
 * Abstract base class for runtime backend drivers
 */

import type {
  RuntimeBackendDriver,
  RuntimeBackend,
  ModelConfig,
  ModelInstance,
  InferenceParams,
  InferenceResult,
  ModelMetrics,
  RuntimeError
} from '../types.js';
import { RuntimeErrorCode } from '../types.js';

export abstract class BaseRuntimeDriver implements RuntimeBackendDriver {
  abstract readonly name: RuntimeBackend;
  protected models = new Map<string, ModelInstance>();

  abstract loadModel(config: ModelConfig): Promise<ModelInstance>;
  abstract unloadModel(modelId: string): Promise<void>;
  abstract executeInference(modelId: string, params: InferenceParams): Promise<InferenceResult>;
  abstract getModelMetrics(modelId: string): Promise<ModelMetrics>;
  abstract healthCheck(): Promise<boolean>;

  /**
   * Get a loaded model instance
   */
  protected getModel(modelId: string): ModelInstance {
    const model = this.models.get(modelId);
    if (!model) {
      throw this.createError(RuntimeErrorCode.MODEL_NOT_FOUND, `Model ${modelId} not found`);
    }
    return model;
  }

  /**
   * Update model metrics after inference
   */
  protected updateModelMetrics(modelId: string, result: InferenceResult): void {
    const model = this.models.get(modelId);
    if (!model) return;

    model.lastUsedAt = new Date();
    model.metrics.totalRequests++;
    model.metrics.totalTokens += result.usage.totalTokens;
    
    // Update average latency using exponential moving average
    const alpha = 0.1;
    model.metrics.averageLatencyMs = 
      (1 - alpha) * model.metrics.averageLatencyMs + alpha * result.latencyMs;
    
    model.metrics.lastUpdated = new Date();
  }

  /**
   * Create a runtime error with consistent structure
   */
  protected createError(code: RuntimeErrorCode, message: string, details?: any): RuntimeError {
    const error = new Error(message) as RuntimeError;
    error.code = code;
    error.backend = this.name;
    error.details = details;
    return error;
  }

  /**
   * Validate model configuration
   */
  protected validateConfig(config: ModelConfig): void {
    if (!config.id) {
      throw this.createError(RuntimeErrorCode.INVALID_CONFIG, 'Model ID is required');
    }
    if (!config.name) {
      throw this.createError(RuntimeErrorCode.INVALID_CONFIG, 'Model name is required');
    }
    if (config.backend !== this.name) {
      throw this.createError(
        RuntimeErrorCode.INVALID_CONFIG, 
        `Backend mismatch: expected ${this.name}, got ${config.backend}`
      );
    }
  }

  /**
   * Create initial model metrics
   */
  protected createInitialMetrics(): ModelMetrics {
    return {
      totalRequests: 0,
      totalTokens: 0,
      averageLatencyMs: 0,
      errorRate: 0,
      memoryUsageMB: 0,
      lastUpdated: new Date()
    };
  }
}