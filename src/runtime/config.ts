/**
 * Runtime Configuration
 * 
 * Configuration management for the runtime layer
 */

import type { RuntimeConfig, RuntimeBackend } from './types.js';

/**
 * Default runtime configuration
 */
export const defaultRuntimeConfig: RuntimeConfig = {
  defaultBackend: 'ollama',
  backends: {
    ollama: {
      endpoint: process.env.OLLAMA_ENDPOINT || 'http://localhost:11434',
      modelPath: process.env.OLLAMA_MODEL_PATH || '/models',
      maxModels: parseInt(process.env.OLLAMA_MAX_MODELS || '3')
    }
  },
  monitoring: {
    metricsInterval: parseInt(process.env.RUNTIME_METRICS_INTERVAL || '30000'), // 30 seconds
    healthCheckInterval: parseInt(process.env.RUNTIME_HEALTH_CHECK_INTERVAL || '60000') // 1 minute
  },
  performance: {
    maxConcurrentInferences: parseInt(process.env.RUNTIME_MAX_CONCURRENT || '50'),
    defaultTimeoutMs: parseInt(process.env.RUNTIME_DEFAULT_TIMEOUT || '30000') // 30 seconds
  }
};

/**
 * Load runtime configuration from app config
 */
export function loadRuntimeConfig(appConfig?: any): RuntimeConfig {
  const config: RuntimeConfig = {
    ...defaultRuntimeConfig
  };

  // Use app config if provided, otherwise fall back to environment variables
  if (appConfig?.runtime) {
    const runtimeConfig = appConfig.runtime;
    
    config.defaultBackend = runtimeConfig.defaultBackend;
    config.monitoring.metricsInterval = runtimeConfig.metricsInterval;
    config.monitoring.healthCheckInterval = runtimeConfig.healthCheckInterval;
    config.performance.maxConcurrentInferences = runtimeConfig.maxConcurrentInferences;
    config.performance.defaultTimeoutMs = runtimeConfig.defaultTimeoutMs;

    // Configure vLLM if enabled
    if (runtimeConfig.vllmEnabled && runtimeConfig.vllmEndpoint) {
      config.backends.vllm = {
        endpoint: runtimeConfig.vllmEndpoint,
        apiKey: runtimeConfig.vllmApiKey,
        maxModels: runtimeConfig.vllmMaxModels || 5
      };
    }

    // Configure NVIDIA NIM if enabled
    if (runtimeConfig.nvidiaEnabled) {
      if (!runtimeConfig.nvidiaApiKey) {
        throw new Error('NVIDIA_NIM_API_KEY is required when NVIDIA_NIM_ENABLED=true');
      }
      
      config.backends['nvidia-nim'] = {
        endpoint: runtimeConfig.nvidiaEndpoint || 'https://api.nvidia.com/nim',
        apiKey: runtimeConfig.nvidiaApiKey,
        organizationId: runtimeConfig.nvidiaOrgId
      };
    }

    // Always configure Ollama as fallback
    config.backends.ollama = {
      endpoint: runtimeConfig.ollamaEndpoint || 'http://localhost:11434',
      modelPath: runtimeConfig.ollamaModelPath || '/models',
      maxModels: runtimeConfig.ollamaMaxModels || 3
    };
  } else {
    // Fallback to environment variables
    if (process.env.VLLM_ENABLED === 'true') {
      config.backends.vllm = {
        endpoint: process.env.VLLM_ENDPOINT || 'http://localhost:8000',
        apiKey: process.env.VLLM_API_KEY,
        maxModels: parseInt(process.env.VLLM_MAX_MODELS || '5')
      };
    }

    if (process.env.NVIDIA_NIM_ENABLED === 'true') {
      if (!process.env.NVIDIA_NIM_API_KEY) {
        throw new Error('NVIDIA_NIM_API_KEY is required when NVIDIA_NIM_ENABLED=true');
      }
      
      config.backends['nvidia-nim'] = {
        endpoint: process.env.NVIDIA_NIM_ENDPOINT || 'https://api.nvidia.com/nim',
        apiKey: process.env.NVIDIA_NIM_API_KEY,
        organizationId: process.env.NVIDIA_NIM_ORG_ID
      };
    }
  }

  return config;
}

/**
 * Validate runtime configuration
 */
export function validateRuntimeConfig(config: RuntimeConfig): void {
  // Ensure at least one backend is configured
  const configuredBackends = Object.keys(config.backends).filter(
    backend => config.backends[backend as RuntimeBackend] !== undefined
  );

  if (configuredBackends.length === 0) {
    throw new Error('At least one runtime backend must be configured');
  }

  // Ensure default backend is configured
  if (!config.backends[config.defaultBackend]) {
    throw new Error(`Default backend ${config.defaultBackend} is not configured`);
  }

  // Validate performance settings
  if (config.performance.maxConcurrentInferences < 1) {
    throw new Error('maxConcurrentInferences must be at least 1');
  }

  if (config.performance.defaultTimeoutMs < 1000) {
    throw new Error('defaultTimeoutMs must be at least 1000ms');
  }

  // Validate monitoring settings
  if (config.monitoring.metricsInterval < 5000) {
    throw new Error('metricsInterval must be at least 5000ms');
  }

  if (config.monitoring.healthCheckInterval < 10000) {
    throw new Error('healthCheckInterval must be at least 10000ms');
  }
}