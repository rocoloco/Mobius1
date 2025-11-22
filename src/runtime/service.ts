/**
 * Runtime Service
 * 
 * Main service that orchestrates AI model runtime operations across different backends
 */

import type {
  RuntimeAPI,
  ModelConfig,
  ModelInstance,
  ModelMetrics,
  InferenceParams,
  InferenceResult,
  RuntimeConfig,
  RuntimeBackendDriver,
  RuntimeBackend,
  RuntimeError
} from './types.js';
import { RuntimeErrorCode } from './types.js';
import { VLLMDriver } from './drivers/vllm.js';
import { OllamaDriver } from './drivers/ollama.js';
import { NvidiaDriver } from './drivers/nvidia.js';

export class RuntimeService implements RuntimeAPI {
  private drivers = new Map<RuntimeBackend, RuntimeBackendDriver>();
  private config: RuntimeConfig;
  private healthCheckInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;
  private activeConcurrentInferences = 0;
  private performanceMetrics = new Map<string, {
    totalRequests: number;
    successfulRequests: number;
    totalLatency: number;
    averageLatency: number;
    lastUpdated: Date;
  }>();

  constructor(config: RuntimeConfig) {
    this.config = config;
    this.initializeDrivers();
    this.startMonitoring();
  }

  private initializeDrivers(): void {
    // Initialize vLLM driver if configured
    if (this.config.backends.vllm) {
      this.drivers.set('vllm', new VLLMDriver(this.config.backends.vllm));
    }

    // Initialize Ollama driver if configured
    if (this.config.backends.ollama) {
      this.drivers.set('ollama', new OllamaDriver(this.config.backends.ollama));
    }

    // Initialize NVIDIA NIM driver if configured
    if (this.config.backends['nvidia-nim']) {
      this.drivers.set('nvidia-nim', new NvidiaDriver(this.config.backends['nvidia-nim']));
    }

    if (this.drivers.size === 0) {
      throw new Error('No runtime backends configured');
    }
  }

  private startMonitoring(): void {
    // Start health check monitoring
    this.healthCheckInterval = setInterval(
      () => this.performHealthChecks(),
      this.config.monitoring.healthCheckInterval
    );

    // Start metrics collection
    this.metricsInterval = setInterval(
      () => this.collectMetrics(),
      this.config.monitoring.metricsInterval
    );
  }

  private async performHealthChecks(): Promise<void> {
    for (const [backend, driver] of Array.from(this.drivers.entries())) {
      try {
        const isHealthy = await driver.healthCheck();
        if (!isHealthy) {
          console.warn(`Runtime backend ${backend} health check failed`);
        }
      } catch (error) {
        console.error(`Health check error for ${backend}:`, error);
      }
    }
  }

  private async collectMetrics(): Promise<void> {
    // Metrics collection is handled by individual drivers
    // This could be extended to aggregate metrics across backends
  }

  async loadModel(modelConfig: ModelConfig): Promise<ModelInstance> {
    const driver = this.getDriver(modelConfig.backend);
    
    try {
      // Check if model is already loaded
      const existingModel = await this.findLoadedModel(modelConfig.id);
      if (existingModel) {
        return existingModel;
      }

      // Load the model
      const modelInstance = await driver.loadModel(modelConfig);
      
      // Initialize performance metrics for the new model
      this.performanceMetrics.set(modelConfig.id, {
        totalRequests: 0,
        successfulRequests: 0,
        totalLatency: 0,
        averageLatency: 0,
        lastUpdated: new Date()
      });

      return modelInstance;
    } catch (error) {
      throw this.wrapError(error, modelConfig.backend);
    }
  }

  private async findLoadedModel(modelId: string): Promise<ModelInstance | null> {
    for (const driver of Array.from(this.drivers.values())) {
      try {
        const metrics = await driver.getModelMetrics(modelId);
        // If we can get metrics, the model is loaded
        const model = (driver as any).models?.get(modelId);
        if (model) {
          return model;
        }
      } catch {
        // Model not found in this driver, continue
      }
    }
    return null;
  }

  async executeInference(prompt: string, parameters: InferenceParams): Promise<InferenceResult> {
    const startTime = Date.now();
    
    // For this method, we need to determine which model to use
    // This implementation assumes the modelId is passed in parameters
    // In a real implementation, you might want to modify the interface
    const modelId = (parameters as any).modelId;
    if (!modelId) {
      throw this.createError(
        RuntimeErrorCode.INVALID_CONFIG,
        'Model ID must be specified for inference'
      );
    }

    // Check if we're at capacity for concurrent inferences
    if (this.activeConcurrentInferences >= this.config.performance.maxConcurrentInferences) {
      throw this.createError(
        RuntimeErrorCode.RESOURCE_EXHAUSTED,
        `Maximum concurrent inferences (${this.config.performance.maxConcurrentInferences}) reached`
      );
    }

    // Find the driver that has this model loaded
    let targetDriver: RuntimeBackendDriver | undefined;
    for (const driver of Array.from(this.drivers.values())) {
      try {
        await driver.getModelMetrics(modelId);
        targetDriver = driver;
        break;
      } catch {
        // Model not found in this driver, continue
      }
    }

    if (!targetDriver) {
      throw this.createError(
        RuntimeErrorCode.MODEL_NOT_FOUND,
        `Model ${modelId} not found in any backend`
      );
    }

    // Track concurrent inference
    this.activeConcurrentInferences++;
    
    try {
      // Set timeout for inference to meet ≤2s latency requirement (NFR-001)
      const timeoutMs = parameters.timeoutMs || this.config.performance.defaultTimeoutMs;
      const inferencePromise = targetDriver.executeInference(modelId, parameters);
      
      const result = await Promise.race([
        inferencePromise,
        this.createTimeoutPromise(timeoutMs)
      ]);

      // Update performance metrics
      const totalLatency = Date.now() - startTime;
      this.updatePerformanceMetrics(modelId, totalLatency, true);
      
      return result;
    } catch (error) {
      const totalLatency = Date.now() - startTime;
      this.updatePerformanceMetrics(modelId, totalLatency, false);
      throw this.wrapError(error, targetDriver.name);
    } finally {
      this.activeConcurrentInferences--;
    }
  }

  async getModelMetrics(modelId: string): Promise<ModelMetrics> {
    // Find the driver that has this model loaded
    for (const driver of Array.from(this.drivers.values())) {
      try {
        return await driver.getModelMetrics(modelId);
      } catch {
        // Model not found in this driver, continue
      }
    }

    throw this.createError(
      RuntimeErrorCode.MODEL_NOT_FOUND,
      `Model ${modelId} not found in any backend`
    );
  }

  async unloadModel(modelId: string): Promise<void> {
    // Find the driver that has this model loaded
    for (const driver of Array.from(this.drivers.values())) {
      try {
        await driver.getModelMetrics(modelId); // Check if model exists
        await driver.unloadModel(modelId);
        return;
      } catch {
        // Model not found in this driver, continue
      }
    }

    throw this.createError(
      RuntimeErrorCode.MODEL_NOT_FOUND,
      `Model ${modelId} not found in any backend`
    );
  }

  async listModels(): Promise<ModelInstance[]> {
    const allModels: ModelInstance[] = [];
    
    for (const driver of Array.from(this.drivers.values())) {
      // Access the models map from each driver
      const driverModels = (driver as any).models;
      if (driverModels && driverModels instanceof Map) {
        for (const model of driverModels.values()) {
          allModels.push(model);
        }
      }
    }

    return allModels;
  }

  async healthCheck(): Promise<boolean> {
    const healthChecks = await Promise.allSettled(
      Array.from(this.drivers.values()).map(driver => driver.healthCheck())
    );

    // Return true if at least one backend is healthy
    return healthChecks.some(result => 
      result.status === 'fulfilled' && result.value === true
    );
  }

  /**
   * Get runtime statistics across all backends
   */
  async getRuntimeStats(): Promise<{
    totalModels: number;
    healthyBackends: number;
    totalBackends: number;
    backendStatus: Record<RuntimeBackend, boolean>;
  }> {
    const backendStatus: Record<string, boolean> = {};
    let healthyBackends = 0;

    for (const [backend, driver] of Array.from(this.drivers.entries())) {
      try {
        const isHealthy = await driver.healthCheck();
        backendStatus[backend] = isHealthy;
        if (isHealthy) healthyBackends++;
      } catch {
        backendStatus[backend] = false;
      }
    }

    return {
      totalModels: 0, // Would need to implement model counting
      healthyBackends,
      totalBackends: this.drivers.size,
      backendStatus: backendStatus as Record<RuntimeBackend, boolean>
    };
  }

  /**
   * Shutdown the runtime service
   */
  async shutdown(): Promise<void> {
    // Clear monitoring intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // Shutdown all drivers (if they support it)
    // This could be extended to gracefully shutdown backends
  }

  private getDriver(backend: RuntimeBackend): RuntimeBackendDriver {
    const driver = this.drivers.get(backend);
    if (!driver) {
      throw this.createError(
        RuntimeErrorCode.BACKEND_UNAVAILABLE,
        `Backend ${backend} not available`
      );
    }
    return driver;
  }

  private createError(code: RuntimeErrorCode, message: string, details?: any): RuntimeError {
    const error = new Error(message) as RuntimeError;
    error.code = code;
    error.details = details;
    return error;
  }

  private wrapError(error: unknown, backend?: RuntimeBackend): RuntimeError {
    if (error instanceof Error && 'code' in error) {
      const runtimeError = error as RuntimeError;
      runtimeError.backend = backend;
      return runtimeError;
    }
    
    return this.createError(
      RuntimeErrorCode.INFERENCE_FAILED,
      error instanceof Error ? error.message : String(error),
      { backend }
    );
  }

  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(this.createError(
          RuntimeErrorCode.TIMEOUT,
          `Inference timeout after ${timeoutMs}ms`
        ));
      }, timeoutMs);
    });
  }

  private updatePerformanceMetrics(modelId: string, latencyMs: number, success: boolean): void {
    const existing = this.performanceMetrics.get(modelId) || {
      totalRequests: 0,
      successfulRequests: 0,
      totalLatency: 0,
      averageLatency: 0,
      lastUpdated: new Date()
    };

    existing.totalRequests++;
    if (success) {
      existing.successfulRequests++;
    }
    existing.totalLatency += latencyMs;
    existing.averageLatency = existing.totalLatency / existing.totalRequests;
    existing.lastUpdated = new Date();

    this.performanceMetrics.set(modelId, existing);
  }

  /**
   * Get performance metrics for a specific model
   */
  async getPerformanceMetrics(modelId: string): Promise<{
    totalRequests: number;
    successfulRequests: number;
    errorRate: number;
    averageLatency: number;
    lastUpdated: Date;
  }> {
    const metrics = this.performanceMetrics.get(modelId);
    if (!metrics) {
      throw this.createError(
        RuntimeErrorCode.MODEL_NOT_FOUND,
        `No performance metrics found for model ${modelId}`
      );
    }

    return {
      totalRequests: metrics.totalRequests,
      successfulRequests: metrics.successfulRequests,
      errorRate: metrics.totalRequests > 0 ? 
        (metrics.totalRequests - metrics.successfulRequests) / metrics.totalRequests : 0,
      averageLatency: metrics.averageLatency,
      lastUpdated: metrics.lastUpdated
    };
  }

  /**
   * Get current system performance statistics
   */
  async getSystemPerformance(): Promise<{
    activeConcurrentInferences: number;
    maxConcurrentInferences: number;
    utilizationPercentage: number;
    totalModelsLoaded: number;
    averageSystemLatency: number;
  }> {
    let totalLatency = 0;
    let totalRequests = 0;
    
    for (const metrics of this.performanceMetrics.values()) {
      totalLatency += metrics.totalLatency;
      totalRequests += metrics.totalRequests;
    }

    return {
      activeConcurrentInferences: this.activeConcurrentInferences,
      maxConcurrentInferences: this.config.performance.maxConcurrentInferences,
      utilizationPercentage: (this.activeConcurrentInferences / this.config.performance.maxConcurrentInferences) * 100,
      totalModelsLoaded: this.getTotalLoadedModels(),
      averageSystemLatency: totalRequests > 0 ? totalLatency / totalRequests : 0
    };
  }

  private getTotalLoadedModels(): number {
    let total = 0;
    for (const driver of this.drivers.values()) {
      // This would require extending the driver interface to count models
      // For now, we'll use a simple count based on our tracking
      total += (driver as any).models?.size || 0;
    }
    return total;
  }

  /**
   * Scale model instances based on current load and performance metrics
   * This implements basic auto-scaling logic for NFR-003 (Scalability)
   */
  async scaleModels(): Promise<{
    scalingActions: Array<{
      modelId: string;
      action: 'load' | 'unload';
      reason: string;
    }>;
    currentUtilization: number;
  }> {
    const scalingActions: Array<{
      modelId: string;
      action: 'load' | 'unload';
      reason: string;
    }> = [];

    const systemPerf = await this.getSystemPerformance();
    
    // If utilization is high (>80%), we might need to scale up
    if (systemPerf.utilizationPercentage > 80) {
      // Find models with high error rates or high latency that might benefit from scaling
      for (const [modelId, metrics] of this.performanceMetrics.entries()) {
        const errorRate = metrics.totalRequests > 0 ? 
          (metrics.totalRequests - metrics.successfulRequests) / metrics.totalRequests : 0;
        
        if (errorRate > 0.1 || metrics.averageLatency > 2000) { // NFR-001: ≤2s latency
          scalingActions.push({
            modelId,
            action: 'load',
            reason: `High error rate (${(errorRate * 100).toFixed(1)}%) or latency (${metrics.averageLatency.toFixed(0)}ms)`
          });
        }
      }
    }

    // If utilization is low (<20%), we might unload unused models
    if (systemPerf.utilizationPercentage < 20) {
      const now = Date.now();
      const models = await this.listModels();
      
      for (const model of models) {
        const timeSinceLastUse = now - model.lastUsedAt.getTime();
        const fiveMinutes = 5 * 60 * 1000;
        
        if (timeSinceLastUse > fiveMinutes) {
          scalingActions.push({
            modelId: model.id,
            action: 'unload',
            reason: `Unused for ${Math.round(timeSinceLastUse / 60000)} minutes`
          });
        }
      }
    }

    return {
      scalingActions,
      currentUtilization: systemPerf.utilizationPercentage
    };
  }

  /**
   * Execute scaling actions returned by scaleModels()
   */
  async executeScaling(actions: Array<{
    modelId: string;
    action: 'load' | 'unload';
    reason: string;
  }>): Promise<{
    successful: number;
    failed: number;
    errors: string[];
  }> {
    let successful = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const action of actions) {
      try {
        if (action.action === 'unload') {
          await this.unloadModel(action.modelId);
          successful++;
        }
        // Note: For 'load' actions, we would need the model config
        // This would typically be stored in a model registry
      } catch (error) {
        failed++;
        errors.push(`Failed to ${action.action} model ${action.modelId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return { successful, failed, errors };
  }
}