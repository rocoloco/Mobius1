/**
 * Runtime Layer Routes
 * 
 * HTTP API routes for runtime management and inference
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { RuntimeFactory } from './factory.js';
import type { ModelConfig, InferenceParams } from './types.js';

// Request/Response schemas
const ModelConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  backend: z.enum(['vllm', 'ollama', 'nvidia-nim']),
  endpoint: z.string().optional(),
  modelPath: z.string().optional(),
  parameters: z.object({
    maxTokens: z.number().optional(),
    temperature: z.number().min(0).max(2).optional(),
    topP: z.number().min(0).max(1).optional(),
    topK: z.number().optional(),
    repetitionPenalty: z.number().optional(),
    stopSequences: z.array(z.string()).optional()
  }).optional(),
  resourceLimits: z.object({
    maxMemoryMB: z.number().optional(),
    maxGpuMemoryMB: z.number().optional(),
    maxConcurrentRequests: z.number().optional(),
    timeoutMs: z.number().optional()
  }).optional()
});

const InferenceRequestSchema = z.object({
  modelId: z.string(),
  prompt: z.string(),
  maxTokens: z.number().optional(),
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  topK: z.number().optional(),
  stopSequences: z.array(z.string()).optional(),
  stream: z.boolean().optional()
});

interface LoadModelRequest {
  Body: z.infer<typeof ModelConfigSchema>;
}

interface InferenceRequest {
  Body: z.infer<typeof InferenceRequestSchema>;
}

interface ModelParamsRequest {
  Params: {
    modelId: string;
  };
}

/**
 * Register runtime routes with Fastify instance
 */
export async function registerRuntimeRoutes(fastify: FastifyInstance): Promise<void> {
  const runtime = RuntimeFactory.getInstance();

  // Load a model
  fastify.post<LoadModelRequest>('/runtime/models', {
    schema: {
      body: ModelConfigSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            status: { type: 'string' },
            loadedAt: { type: 'string' },
            config: { type: 'object' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<LoadModelRequest>, reply: FastifyReply) => {
    try {
      const modelConfig = request.body as ModelConfig;
      const modelInstance = await runtime.loadModel(modelConfig);
      
      return {
        id: modelInstance.id,
        status: modelInstance.status,
        loadedAt: modelInstance.loadedAt.toISOString(),
        config: modelInstance.config
      };
    } catch (error) {
      const runtimeError = error as any;
      reply.status(400).send({
        error: runtimeError.code || 'RUNTIME_ERROR',
        message: runtimeError.message,
        details: runtimeError.details
      });
    }
  });

  // Execute inference
  fastify.post<InferenceRequest>('/runtime/inference', {
    schema: {
      body: InferenceRequestSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            finishReason: { type: 'string' },
            usage: {
              type: 'object',
              properties: {
                promptTokens: { type: 'number' },
                completionTokens: { type: 'number' },
                totalTokens: { type: 'number' }
              }
            },
            latencyMs: { type: 'number' },
            modelId: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<InferenceRequest>, reply: FastifyReply) => {
    try {
      const { modelId, prompt, ...params } = request.body;
      
      // Add modelId to parameters for the service
      const inferenceParams: InferenceParams & { modelId: string } = {
        prompt,
        ...params,
        modelId
      };
      
      const result = await runtime.executeInference(prompt, inferenceParams);
      return result;
    } catch (error) {
      const runtimeError = error as any;
      reply.status(400).send({
        error: runtimeError.code || 'INFERENCE_ERROR',
        message: runtimeError.message,
        details: runtimeError.details
      });
    }
  });

  // Get model metrics
  fastify.get<ModelParamsRequest>('/runtime/models/:modelId/metrics', {
    schema: {
      params: {
        type: 'object',
        properties: {
          modelId: { type: 'string' }
        },
        required: ['modelId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            totalRequests: { type: 'number' },
            totalTokens: { type: 'number' },
            averageLatencyMs: { type: 'number' },
            errorRate: { type: 'number' },
            memoryUsageMB: { type: 'number' },
            gpuMemoryUsageMB: { type: 'number' },
            lastUpdated: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<ModelParamsRequest>, reply: FastifyReply) => {
    try {
      const { modelId } = request.params;
      const metrics = await runtime.getModelMetrics(modelId);
      
      return {
        ...metrics,
        lastUpdated: metrics.lastUpdated.toISOString()
      };
    } catch (error) {
      const runtimeError = error as any;
      reply.status(404).send({
        error: runtimeError.code || 'MODEL_NOT_FOUND',
        message: runtimeError.message
      });
    }
  });

  // Unload a model
  fastify.delete<ModelParamsRequest>('/runtime/models/:modelId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          modelId: { type: 'string' }
        },
        required: ['modelId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<ModelParamsRequest>, reply: FastifyReply) => {
    try {
      const { modelId } = request.params;
      await runtime.unloadModel(modelId);
      
      return {
        success: true,
        message: `Model ${modelId} unloaded successfully`
      };
    } catch (error) {
      const runtimeError = error as any;
      reply.status(404).send({
        error: runtimeError.code || 'MODEL_NOT_FOUND',
        message: runtimeError.message
      });
    }
  });

  // List all models
  fastify.get('/runtime/models', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            models: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  status: { type: 'string' },
                  loadedAt: { type: 'string' },
                  lastUsedAt: { type: 'string' },
                  backend: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const models = await runtime.listModels();
      
      return {
        models: models.map(model => ({
          id: model.id,
          status: model.status,
          loadedAt: model.loadedAt.toISOString(),
          lastUsedAt: model.lastUsedAt.toISOString(),
          backend: model.config.backend
        }))
      };
    } catch (error) {
      const runtimeError = error as any;
      reply.status(500).send({
        error: 'RUNTIME_ERROR',
        message: runtimeError.message
      });
    }
  });

  // Runtime health check
  fastify.get('/runtime/health', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            healthy: { type: 'boolean' },
            backends: { type: 'object' },
            timestamp: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const healthy = await runtime.healthCheck();
      
      // Get detailed backend status if available
      let backendStatus = {};
      if ('getRuntimeStats' in runtime) {
        const stats = await (runtime as any).getRuntimeStats();
        backendStatus = stats.backendStatus;
      }
      
      return {
        healthy,
        backends: backendStatus,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      reply.status(500).send({
        healthy: false,
        error: 'Health check failed',
        timestamp: new Date().toISOString()
      });
    }
  });
}