/**
 * vLLM Runtime Driver
 * 
 * Driver for vLLM backend supporting high-performance inference
 */

import type {
  ModelConfig,
  ModelInstance,
  InferenceParams,
  InferenceResult,
  ModelMetrics,
  VLLMConfig
} from '../types.js';
import { RuntimeErrorCode } from '../types.js';
import { BaseRuntimeDriver } from './base.js';

export class VLLMDriver extends BaseRuntimeDriver {
  readonly name = 'vllm' as const;
  private config: VLLMConfig;

  constructor(config: VLLMConfig) {
    super();
    this.config = config;
  }

  async loadModel(config: ModelConfig): Promise<ModelInstance> {
    this.validateConfig(config);

    const startTime = Date.now();
    
    try {
      // Check if model is already loaded
      if (this.models.has(config.id)) {
        return this.models.get(config.id)!;
      }

      // Check capacity
      if (this.models.size >= this.config.maxModels) {
        throw this.createError(
          RuntimeErrorCode.RESOURCE_EXHAUSTED,
          `Maximum models (${this.config.maxModels}) already loaded`
        );
      }

      // Load model via vLLM API
      const response = await fetch(`${this.config.endpoint}/v1/models`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
        },
        body: JSON.stringify({
          model: config.name,
          model_path: config.modelPath,
          max_model_len: config.parameters?.maxTokens,
          gpu_memory_utilization: config.resourceLimits?.maxGpuMemoryMB ? 
            config.resourceLimits.maxGpuMemoryMB / 1024 : undefined
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw this.createError(
          RuntimeErrorCode.MODEL_LOAD_FAILED,
          `Failed to load model: ${error}`
        );
      }

      const modelInstance: ModelInstance = {
        id: config.id,
        config,
        status: 'ready',
        loadedAt: new Date(),
        lastUsedAt: new Date(),
        metrics: this.createInitialMetrics()
      };

      this.models.set(config.id, modelInstance);
      return modelInstance;

    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw this.createError(
        RuntimeErrorCode.MODEL_LOAD_FAILED,
        `Failed to load model: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async unloadModel(modelId: string): Promise<void> {
    const model = this.getModel(modelId);
    
    try {
      const response = await fetch(`${this.config.endpoint}/v1/models/${modelId}`, {
        method: 'DELETE',
        headers: {
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
        }
      });

      if (!response.ok) {
        const error = await response.text();
        throw this.createError(
          RuntimeErrorCode.MODEL_LOAD_FAILED,
          `Failed to unload model: ${error}`
        );
      }

      this.models.delete(modelId);
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw this.createError(
        RuntimeErrorCode.MODEL_LOAD_FAILED,
        `Failed to unload model: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async executeInference(modelId: string, params: InferenceParams): Promise<InferenceResult> {
    const model = this.getModel(modelId);
    const startTime = Date.now();

    try {
      const response = await fetch(`${this.config.endpoint}/v1/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
        },
        body: JSON.stringify({
          model: model.config.name,
          prompt: params.prompt,
          max_tokens: params.maxTokens || model.config.parameters?.maxTokens || 1000,
          temperature: params.temperature || model.config.parameters?.temperature || 0.7,
          top_p: params.topP || model.config.parameters?.topP || 1.0,
          top_k: params.topK || model.config.parameters?.topK || -1,
          stop: params.stopSequences || model.config.parameters?.stopSequences,
          stream: params.stream || false
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw this.createError(
          RuntimeErrorCode.INFERENCE_FAILED,
          `Inference failed: ${error}`
        );
      }

      const data = await response.json();
      const latencyMs = Date.now() - startTime;

      const result: InferenceResult = {
        text: data.choices[0].text,
        finishReason: data.choices[0].finish_reason === 'stop' ? 'stop' : 
                     data.choices[0].finish_reason === 'length' ? 'length' : 'error',
        usage: {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        },
        latencyMs,
        modelId
      };

      this.updateModelMetrics(modelId, result);
      return result;

    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      throw this.createError(
        RuntimeErrorCode.INFERENCE_FAILED,
        `Inference failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async getModelMetrics(modelId: string): Promise<ModelMetrics> {
    const model = this.getModel(modelId);
    
    try {
      // Get additional metrics from vLLM if available
      const response = await fetch(`${this.config.endpoint}/v1/models/${modelId}/metrics`, {
        headers: {
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
        }
      });

      if (response.ok) {
        const vllmMetrics = await response.json();
        return {
          ...model.metrics,
          memoryUsageMB: vllmMetrics.memory_usage_mb || model.metrics.memoryUsageMB,
          gpuMemoryUsageMB: vllmMetrics.gpu_memory_usage_mb
        };
      }
    } catch {
      // Fallback to stored metrics if vLLM metrics endpoint is not available
    }

    return model.metrics;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.endpoint}/health`, {
        method: 'GET',
        headers: {
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
        }
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}