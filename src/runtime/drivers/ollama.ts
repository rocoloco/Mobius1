/**
 * Ollama Runtime Driver
 * 
 * Driver for Ollama backend supporting local model execution
 */

import type {
  ModelConfig,
  ModelInstance,
  InferenceParams,
  InferenceResult,
  ModelMetrics,
  OllamaConfig
} from '../types.js';
import { RuntimeErrorCode } from '../types.js';
import { BaseRuntimeDriver } from './base.js';

export class OllamaDriver extends BaseRuntimeDriver {
  readonly name = 'ollama' as const;
  private config: OllamaConfig;

  constructor(config: OllamaConfig) {
    super();
    this.config = config;
  }

  async loadModel(config: ModelConfig): Promise<ModelInstance> {
    this.validateConfig(config);

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

      // Pull/load model via Ollama API
      const response = await fetch(`${this.config.endpoint}/api/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: config.name,
          stream: false
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
      // Ollama doesn't have explicit unload, but we can remove from our tracking
      this.models.delete(modelId);
    } catch (error) {
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
      const response = await fetch(`${this.config.endpoint}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model.config.name,
          prompt: params.prompt,
          stream: false,
          options: {
            num_predict: params.maxTokens || model.config.parameters?.maxTokens || 1000,
            temperature: params.temperature || model.config.parameters?.temperature || 0.7,
            top_p: params.topP || model.config.parameters?.topP || 1.0,
            top_k: params.topK || model.config.parameters?.topK || 40,
            stop: params.stopSequences || model.config.parameters?.stopSequences
          }
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

      // Estimate token counts (Ollama doesn't always provide exact counts)
      const promptTokens = Math.ceil(params.prompt.length / 4); // Rough estimate
      const completionTokens = Math.ceil(data.response.length / 4);

      const result: InferenceResult = {
        text: data.response,
        finishReason: data.done ? 'stop' : 'length',
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens
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
      // Try to get system info from Ollama
      const response = await fetch(`${this.config.endpoint}/api/ps`);
      
      if (response.ok) {
        const data = await response.json();
        const modelInfo = data.models?.find((m: any) => m.name === model.config.name);
        
        if (modelInfo) {
          return {
            ...model.metrics,
            memoryUsageMB: Math.round(modelInfo.size / (1024 * 1024))
          };
        }
      }
    } catch {
      // Fallback to stored metrics if Ollama API is not available
    }

    return model.metrics;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.endpoint}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }
}