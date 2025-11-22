/**
 * Runtime Layer Interface
 * 
 * Main interface for the AI model runtime system as specified in the design document.
 */

import type {
  ModelConfig,
  ModelInstance,
  ModelMetrics,
  InferenceParams,
  InferenceResult
} from './types.js';

/**
 * Main Runtime API interface as defined in the design document
 */
export interface RuntimeAPI {
  /**
   * Load a model with the specified configuration
   * @param modelConfig Configuration for the model to load
   * @returns Promise resolving to the loaded model instance
   */
  loadModel(modelConfig: ModelConfig): Promise<ModelInstance>;

  /**
   * Execute inference on a loaded model
   * @param prompt The input prompt for inference
   * @param parameters Inference parameters
   * @returns Promise resolving to the inference result
   */
  executeInference(prompt: string, parameters: InferenceParams): Promise<InferenceResult>;

  /**
   * Get performance metrics for a specific model
   * @param modelId The ID of the model to get metrics for
   * @returns Promise resolving to the model metrics
   */
  getModelMetrics(modelId: string): Promise<ModelMetrics>;

  /**
   * Unload a model to free resources
   * @param modelId The ID of the model to unload
   */
  unloadModel(modelId: string): Promise<void>;

  /**
   * List all loaded models
   * @returns Promise resolving to array of model instances
   */
  listModels(): Promise<ModelInstance[]>;

  /**
   * Check if the runtime is healthy
   * @returns Promise resolving to health status
   */
  healthCheck(): Promise<boolean>;
}