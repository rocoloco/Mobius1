/**
 * Runtime Layer Types
 * 
 * Defines interfaces and types for the pluggable AI model runtime system
 * supporting vLLM, Ollama, and NVIDIA NIM backends.
 */

export interface ModelConfig {
  id: string;
  name: string;
  backend: RuntimeBackend;
  endpoint?: string;
  modelPath?: string;
  parameters?: ModelParameters;
  resourceLimits?: ResourceLimits;
}

export interface ModelParameters {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  repetitionPenalty?: number;
  stopSequences?: string[];
}

export interface ResourceLimits {
  maxMemoryMB?: number;
  maxGpuMemoryMB?: number;
  maxConcurrentRequests?: number;
  timeoutMs?: number;
}

export interface InferenceParams {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
  stream?: boolean;
  timeoutMs?: number;
}

export interface InferenceResult {
  text: string;
  finishReason: 'stop' | 'length' | 'error';
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
  modelId: string;
}

export interface ModelInstance {
  id: string;
  config: ModelConfig;
  status: ModelStatus;
  loadedAt: Date;
  lastUsedAt: Date;
  metrics: ModelMetrics;
}

export interface ModelMetrics {
  totalRequests: number;
  totalTokens: number;
  averageLatencyMs: number;
  errorRate: number;
  memoryUsageMB: number;
  gpuMemoryUsageMB?: number;
  lastUpdated: Date;
}

export type ModelStatus = 'loading' | 'ready' | 'error' | 'unloaded';

export type RuntimeBackend = 'vllm' | 'ollama' | 'nvidia-nim';

export interface RuntimeAPI {
  loadModel(modelConfig: ModelConfig): Promise<ModelInstance>;
  executeInference(prompt: string, parameters: InferenceParams): Promise<InferenceResult>;
  getModelMetrics(modelId: string): Promise<ModelMetrics>;
  unloadModel(modelId: string): Promise<void>;
  listModels(): Promise<ModelInstance[]>;
  healthCheck(): Promise<boolean>;
}

export interface RuntimeBackendDriver {
  name: RuntimeBackend;
  loadModel(config: ModelConfig): Promise<ModelInstance>;
  unloadModel(modelId: string): Promise<void>;
  executeInference(modelId: string, params: InferenceParams): Promise<InferenceResult>;
  getModelMetrics(modelId: string): Promise<ModelMetrics>;
  healthCheck(): Promise<boolean>;
}

export interface RuntimeConfig {
  defaultBackend: RuntimeBackend;
  backends: {
    vllm?: VLLMConfig;
    ollama?: OllamaConfig;
    'nvidia-nim'?: NvidiaConfig;
  };
  monitoring: {
    metricsInterval: number;
    healthCheckInterval: number;
  };
  performance: {
    maxConcurrentInferences: number;
    defaultTimeoutMs: number;
  };
}

export interface VLLMConfig {
  endpoint: string;
  apiKey?: string;
  maxModels: number;
}

export interface OllamaConfig {
  endpoint: string;
  modelPath: string;
  maxModels: number;
}

export interface NvidiaConfig {
  endpoint: string;
  apiKey: string;
  organizationId?: string;
}

export interface RuntimeError extends Error {
  code: RuntimeErrorCode;
  modelId?: string;
  backend?: RuntimeBackend;
  details?: any;
}

export enum RuntimeErrorCode {
  MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
  MODEL_LOAD_FAILED = 'MODEL_LOAD_FAILED',
  INFERENCE_FAILED = 'INFERENCE_FAILED',
  BACKEND_UNAVAILABLE = 'BACKEND_UNAVAILABLE',
  RESOURCE_EXHAUSTED = 'RESOURCE_EXHAUSTED',
  TIMEOUT = 'TIMEOUT',
  INVALID_CONFIG = 'INVALID_CONFIG'
}