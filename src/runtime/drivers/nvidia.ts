/**
 * NVIDIA NIM Runtime Driver
 * 
 * Driver for NVIDIA NIM backend supporting enterprise deployments
 */

import type {
  ModelConfig,
  ModelInstance,
  InferenceParams,
  InferenceResult,
  ModelMetrics,
  NvidiaConfig
} from '../types.js';
import { RuntimeErrorCode } from '../types.js';
import { BaseRuntimeDriver } from './base.js';

export class NvidiaDriver extends BaseRuntimeDriver {
  readonly name = 'nvidia-nim' as const;
  private config: NvidiaConfig;

  constructor(config: NvidiaConfig) {
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

      // For NVIDIA NIM, models are typically pre-deployed
      // We just need to verify the model is available
      const response = await fetch(`${this.config.endpoint}/v1/models`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          ...(this.config.organizationId && { 'OpenAI-Organization': this.config.organizationId })
        }
      });

      if (!response.ok) {
        const error = await response.text();
        throw this.createError(
          RuntimeErrorCode.MODEL_LOAD_FAILED,
          `Failed to verify model availability: ${error}`
        );
      }

      const data = await response.json();
      const availableModel = data.data?.find((m: any) => m.id === config.name);
      
      if (!availableModel) {
        throw this.createError(
          RuntimeErrorCode.MODEL_NOT_FOUND,
          `Model ${config.name} not available in NVIDIA NIM`
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
      // NVIDIA NIM models are managed by the service, we just remove from tracking
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
      const response = await fetch(`${this.config.endpoint}/v1/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          ...(this.config.organizationId && { 'OpenAI-Organization': this.config.organizationId })
        },
        body: JSON.stringify({
          model: model.config.name,
          prompt: params.prompt,
          max_tokens: params.maxTokens || model.config.parameters?.maxTokens || 1000,
          temperature: params.temperature || model.config.parameters?.temperature || 0.7,
          top_p: params.topP || model.config.parameters?.topP || 1.0,
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
    
    // NVIDIA NIM doesn't expose detailed metrics via API
    // Return the metrics we track internally
    return model.metrics;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.endpoint}/v1/models`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          ...(this.config.organizationId && { 'OpenAI-Organization': this.config.organizationId })
        }
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}