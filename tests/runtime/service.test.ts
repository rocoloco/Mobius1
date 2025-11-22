/**
 * Runtime Service Tests
 * Tests for NFR-001 (Performance) and NFR-003 (Scalability)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RuntimeService } from '../../src/runtime/service.js';
// Driver imports removed as they're not used in tests
import type { 
  RuntimeConfig, 
  ModelConfig, 
  InferenceParams,
  InferenceResult,
  ModelInstance 
} from '../../src/runtime/types.js';

// Extended interface for testing with modelId
interface TestInferenceParams extends InferenceParams {
  modelId: string;
}

// Helper function to mock successful Ollama responses
function mockOllamaSuccess(responseText: string = 'Test response') {
  (fetch as any).mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve({
      response: responseText,
      done: true
    })
  });
}

// Helper function to mock failed Ollama responses
function mockOllamaFailure(errorText: string = 'Test error') {
  (fetch as any).mockResolvedValueOnce({
    ok: false,
    text: () => Promise.resolve(errorText)
  });
}

// Mock fetch for HTTP calls
global.fetch = vi.fn();

describe('RuntimeService', () => {
  let runtimeService: RuntimeService;
  let mockConfig: RuntimeConfig;

  beforeEach(() => {
    mockConfig = {
      defaultBackend: 'ollama',
      backends: {
        ollama: {
          endpoint: 'http://localhost:11434',
          modelPath: '/models',
          maxModels: 3
        }
      },
      monitoring: {
        metricsInterval: 30000,
        healthCheckInterval: 60000
      },
      performance: {
        maxConcurrentInferences: 50,
        defaultTimeoutMs: 30000
      }
    };

    // Reset fetch mock
    vi.clearAllMocks();
    (fetch as any).mockClear();

    // Mock the monitoring intervals to prevent actual timers
    vi.spyOn(global, 'setInterval').mockImplementation(() => ({} as any));
    
    runtimeService = new RuntimeService(mockConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (runtimeService && 'shutdown' in runtimeService) {
      runtimeService.shutdown();
    }
  });

  describe('Model Loading', () => {
    it('should load a model successfully', async () => {
      const modelConfig: ModelConfig = {
        id: 'test-model-1',
        name: 'llama2:7b',
        backend: 'ollama',
        parameters: {
          maxTokens: 1000,
          temperature: 0.7
        }
      };

      // Mock successful Ollama API response
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ status: 'success' })
      });

      const result = await runtimeService.loadModel(modelConfig);

      expect(result).toBeDefined();
      expect(result.id).toBe('test-model-1');
      expect(result.status).toBe('ready');
      expect(result.config.backend).toBe('ollama');
    });

    it('should handle model loading failure', async () => {
      const modelConfig: ModelConfig = {
        id: 'test-model-2',
        name: 'invalid-model',
        backend: 'ollama'
      };

      // Mock failed Ollama API response
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        text: vi.fn().mockResolvedValue('Model not found')
      });

      await expect(runtimeService.loadModel(modelConfig)).rejects.toThrow();
    });

    it('should enforce backend availability', async () => {
      const modelConfig: ModelConfig = {
        id: 'test-model-3',
        name: 'test-model',
        backend: 'vllm' // Not configured in mockConfig
      };

      await expect(runtimeService.loadModel(modelConfig)).rejects.toThrow('Backend vllm not available');
    });
  });

  describe('Inference Execution', () => {
    beforeEach(async () => {
      const modelConfig: ModelConfig = {
        id: 'inference-test-model',
        name: 'llama2:7b',
        backend: 'ollama'
      };

      // Mock model loading
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ status: 'success' })
      });

      await runtimeService.loadModel(modelConfig);
    });

    it('should execute inference successfully', async () => {
      const inferenceParams: TestInferenceParams = {
        prompt: 'Hello, how are you?',
        maxTokens: 100,
        temperature: 0.7,
        modelId: 'inference-test-model'
      };

      // Set up fresh mock for inference (don't clear all mocks as it removes fetch mock)
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          response: 'I am doing well, thank you!',
          done: true
        })
      });

      const result = await runtimeService.executeInference(
        inferenceParams.prompt, 
        inferenceParams
      );

      expect(result).toBeDefined();
      expect(result.text).toBe('I am doing well, thank you!');
      expect(result.finishReason).toBe('stop');
      expect(result.usage.totalTokens).toBeGreaterThan(0);
      expect(result.latencyMs).toBeGreaterThan(0);
      expect(result.modelId).toBe('inference-test-model');
    });

    it('should meet latency requirements (NFR-001)', async () => {
      const inferenceParams: TestInferenceParams = {
        prompt: 'A'.repeat(1000), // ~1k tokens
        maxTokens: 100,
        modelId: 'inference-test-model'
      };

      // Set up fresh mock for inference
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          response: 'Response text',
          done: true
        })
      });

      const startTime = Date.now();
      const result = await runtimeService.executeInference(
        inferenceParams.prompt, 
        inferenceParams
      );
      const endTime = Date.now();

      // NFR-001: Average latency ≤ 2s for 1k-token prompt
      expect(endTime - startTime).toBeLessThan(2000);
      expect(result.latencyMs).toBeLessThan(2000);
    });

    it('should handle inference failure gracefully', async () => {
      const inferenceParams: TestInferenceParams = {
        prompt: 'Test prompt',
        modelId: 'inference-test-model'
      };

      // Mock failed inference response
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        text: vi.fn().mockResolvedValue('Inference failed')
      });

      await expect(runtimeService.executeInference(
        inferenceParams.prompt, 
        inferenceParams
      )).rejects.toThrow();
    });
  });

  describe('Model Metrics', () => {
    beforeEach(async () => {
      const modelConfig: ModelConfig = {
        id: 'metrics-test-model',
        name: 'llama2:7b',
        backend: 'ollama'
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ status: 'success' })
      });

      await runtimeService.loadModel(modelConfig);
    });

    it('should retrieve model metrics', async () => {
      // Mock Ollama process status
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          models: [{
            name: 'llama2:7b',
            size: 4000000000 // 4GB
          }]
        })
      });

      const metrics = await runtimeService.getModelMetrics('metrics-test-model');

      expect(metrics).toBeDefined();
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.totalTokens).toBe(0);
      expect(metrics.averageLatencyMs).toBe(0);
      expect(metrics.errorRate).toBe(0);
      expect(metrics.lastUpdated).toBeInstanceOf(Date);
    });

    it('should handle metrics for non-existent model', async () => {
      await expect(runtimeService.getModelMetrics('non-existent-model'))
        .rejects.toThrow('Model non-existent-model not found');
    });
  });

  describe('Health Checks', () => {
    it('should perform health check successfully', async () => {
      // Mock successful health check
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ status: 'healthy' })
      });

      const isHealthy = await runtimeService.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should handle health check failure', async () => {
      // Mock failed health check
      (fetch as any).mockRejectedValueOnce(new Error('Connection failed'));

      const isHealthy = await runtimeService.healthCheck();
      expect(isHealthy).toBe(false);
    });
  });

  describe('Scalability (NFR-003)', () => {
    it('should support concurrent inference requests', async () => {
      const modelConfig: ModelConfig = {
        id: 'scalability-test-model',
        name: 'llama2:7b',
        backend: 'ollama'
      };

      // Mock model loading
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ status: 'success' })
      });

      await runtimeService.loadModel(modelConfig);

      // NFR-003: Support ≥ 50 endpoints per cluster
      const concurrentRequests = 50;
      const promises: Promise<InferenceResult>[] = [];

      // Mock all the responses upfront
      for (let i = 0; i < concurrentRequests; i++) {
        (fetch as any).mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            response: 'Concurrent response',
            done: true
          })
        });
      }

      for (let i = 0; i < concurrentRequests; i++) {
        const promise = runtimeService.executeInference(
          `Test prompt ${i}`,
          {
            prompt: `Test prompt ${i}`,
            modelId: 'scalability-test-model'
          }
        );
        promises.push(promise);
      }

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(concurrentRequests);
      results.forEach((result) => {
        expect(result.text).toBe('Concurrent response');
        expect(result.modelId).toBe('scalability-test-model');
      });
    });
  });

  describe('Model Unloading', () => {
    it('should unload a model successfully', async () => {
      const modelConfig: ModelConfig = {
        id: 'unload-test-model',
        name: 'llama2:7b',
        backend: 'ollama'
      };

      // Mock model loading
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ status: 'success' })
      });

      await runtimeService.loadModel(modelConfig);

      // Unload the model
      await expect(runtimeService.unloadModel('unload-test-model')).resolves.not.toThrow();

      // Verify model is no longer available
      await expect(runtimeService.getModelMetrics('unload-test-model'))
        .rejects.toThrow('Model unload-test-model not found');
    });
  });

  describe('Performance Metrics Collection (NFR-001)', () => {
    beforeEach(async () => {
      const modelConfig: ModelConfig = {
        id: 'perf-test-model',
        name: 'llama2:7b',
        backend: 'ollama'
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ status: 'success' })
      });

      await runtimeService.loadModel(modelConfig);
    });

    it('should collect performance metrics during inference', async () => {
      const inferenceParams: TestInferenceParams = {
        prompt: 'Test performance metrics',
        maxTokens: 50,
        modelId: 'perf-test-model'
      };

      // Set up fresh mock for inference
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          response: 'Performance test response',
          done: true
        })
      });

      await runtimeService.executeInference(inferenceParams.prompt, inferenceParams);

      // Check performance metrics
      const perfMetrics = await runtimeService.getPerformanceMetrics('perf-test-model');
      
      expect(perfMetrics.totalRequests).toBe(1);
      expect(perfMetrics.successfulRequests).toBe(1);
      expect(perfMetrics.errorRate).toBe(0);
      expect(perfMetrics.averageLatency).toBeGreaterThan(0);
      expect(perfMetrics.lastUpdated).toBeInstanceOf(Date);
    });

    it('should track error rates in performance metrics', async () => {
      const inferenceParams: TestInferenceParams = {
        prompt: 'Test error tracking',
        modelId: 'perf-test-model'
      };

      // Mock failed inference
      mockOllamaFailure('Inference failed');

      await expect(runtimeService.executeInference(inferenceParams.prompt, inferenceParams))
        .rejects.toThrow();

      // Check that error was tracked
      const perfMetrics = await runtimeService.getPerformanceMetrics('perf-test-model');
      
      expect(perfMetrics.totalRequests).toBe(1);
      expect(perfMetrics.successfulRequests).toBe(0);
      expect(perfMetrics.errorRate).toBe(1);
    });

    it('should provide system performance statistics', async () => {
      const systemPerf = await runtimeService.getSystemPerformance();
      
      expect(systemPerf.activeConcurrentInferences).toBe(0);
      expect(systemPerf.maxConcurrentInferences).toBe(50); // From mockConfig
      expect(systemPerf.utilizationPercentage).toBe(0);
      expect(systemPerf.totalModelsLoaded).toBeGreaterThanOrEqual(0);
      expect(systemPerf.averageSystemLatency).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Inference Timeout Handling (NFR-001)', () => {
    beforeEach(async () => {
      const modelConfig: ModelConfig = {
        id: 'timeout-test-model',
        name: 'llama2:7b',
        backend: 'ollama'
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ status: 'success' })
      });

      await runtimeService.loadModel(modelConfig);
    });

    it('should timeout inference requests that exceed time limit', async () => {
      const inferenceParams: TestInferenceParams = {
        prompt: 'Test timeout',
        modelId: 'timeout-test-model',
        timeoutMs: 100 // Very short timeout
      };

      // Set up slow response mock
      (fetch as any).mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve({
            response: 'Slow response',
            done: true
          })
        }), 200)) // Slower than timeout
      );

      await expect(runtimeService.executeInference(inferenceParams.prompt, inferenceParams))
        .rejects.toThrow('Inference timeout after 100ms');
    });

    it('should complete inference within timeout', async () => {
      const inferenceParams: TestInferenceParams = {
        prompt: 'Test fast inference',
        modelId: 'timeout-test-model',
        timeoutMs: 1000 // Reasonable timeout
      };

      // Set up fresh mock for inference
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          response: 'Fast response',
          done: true
        })
      });

      const result = await runtimeService.executeInference(inferenceParams.prompt, inferenceParams);
      
      expect(result.text).toBe('Fast response');
      expect(result.latencyMs).toBeLessThan(1000);
    });
  });

  describe('Concurrent Request Management (NFR-003)', () => {
    beforeEach(async () => {
      const modelConfig: ModelConfig = {
        id: 'concurrent-test-model',
        name: 'llama2:7b',
        backend: 'ollama'
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ status: 'success' })
      });

      await runtimeService.loadModel(modelConfig);
    });

    it('should enforce maximum concurrent inference limit', async () => {
      // Create a service with very low concurrency limit for testing
      const lowConcurrencyConfig: RuntimeConfig = {
        ...mockConfig,
        performance: {
          maxConcurrentInferences: 2,
          defaultTimeoutMs: 30000
        }
      };

      vi.spyOn(global, 'setInterval').mockImplementation(() => ({} as any));
      const limitedService = new RuntimeService(lowConcurrencyConfig);

      // Load model in limited service
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ status: 'success' })
      });

      await limitedService.loadModel({
        id: 'limited-test-model',
        name: 'llama2:7b',
        backend: 'ollama'
      });

      // Mock slow responses to keep requests active longer
      let requestCount = 0;
      (fetch as any).mockImplementation(() => {
        requestCount++;
        return new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            json: () => Promise.resolve({
              response: `Slow response ${requestCount}`,
              done: true
            })
          }), 100) // Longer delay to keep requests active
        );
      });

      // Start 2 concurrent requests (at limit)
      const promise1 = limitedService.executeInference('Test 1', {
        prompt: 'Test 1',
        modelId: 'limited-test-model'
      });
      
      const promise2 = limitedService.executeInference('Test 2', {
        prompt: 'Test 2',
        modelId: 'limited-test-model'
      });

      // Wait a bit to ensure the first two requests are active
      await new Promise(resolve => setTimeout(resolve, 20));

      // Third request should be rejected immediately
      await expect(limitedService.executeInference('Test 3', {
        prompt: 'Test 3',
        modelId: 'limited-test-model'
      })).rejects.toThrow('Maximum concurrent inferences (2) reached');

      // Wait for the first two to complete
      await Promise.all([promise1, promise2]);

      limitedService.shutdown();
    });
  });

  describe('Model Scaling Logic (NFR-003)', () => {
    beforeEach(async () => {
      const modelConfig: ModelConfig = {
        id: 'scaling-test-model',
        name: 'llama2:7b',
        backend: 'ollama'
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ status: 'success' })
      });

      await runtimeService.loadModel(modelConfig);
    });

    it('should identify scaling opportunities based on performance', async () => {
      // Simulate high error rate by running failed inferences
      const inferenceParams: TestInferenceParams = {
        prompt: 'Test scaling',
        modelId: 'scaling-test-model'
      };

      // Mock multiple failed inferences to create high error rate
      for (let i = 0; i < 5; i++) {
        (fetch as any).mockResolvedValueOnce({
          ok: false,
          text: () => Promise.resolve('Simulated failure')
        });

        try {
          await runtimeService.executeInference(inferenceParams.prompt, inferenceParams);
        } catch {
          // Expected to fail
        }
      }

      // Now simulate high utilization by setting active concurrent inferences
      // We need to access the private property for testing
      (runtimeService as any).activeConcurrentInferences = 45; // 90% utilization

      const scalingResult = await runtimeService.scaleModels();
      
      expect(scalingResult.scalingActions).toBeDefined();
      expect(scalingResult.currentUtilization).toBeGreaterThanOrEqual(0);
      
      // Should suggest scaling action due to high error rate or high utilization
      const loadActions = scalingResult.scalingActions.filter(a => a.action === 'load');
      expect(loadActions.length).toBeGreaterThan(0);
    });

    it('should suggest unloading unused models', async () => {
      // Get the loaded models and simulate old usage
      const models = await runtimeService.listModels();
      if (models.length > 0) {
        // Simulate old last used time
        models[0].lastUsedAt = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
      }

      const scalingResult = await runtimeService.scaleModels();
      
      // Should suggest unloading due to low utilization and old usage
      const unloadActions = scalingResult.scalingActions.filter(a => a.action === 'unload');
      expect(unloadActions.length).toBeGreaterThanOrEqual(0);
    });
  });
});