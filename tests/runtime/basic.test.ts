/**
 * Basic Runtime Tests
 * Simple tests to verify core functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RuntimeService } from '../../src/runtime/service.js';
import type { RuntimeConfig, ModelConfig } from '../../src/runtime/types.js';

// Mock fetch for HTTP calls
global.fetch = vi.fn();

describe('Basic Runtime Tests', () => {
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

  it('should create runtime service successfully', () => {
    expect(runtimeService).toBeDefined();
  });

  it('should perform health check', async () => {
    // Mock successful health check
    (fetch as any).mockResolvedValueOnce({
      ok: true
    });

    const isHealthy = await runtimeService.healthCheck();
    expect(typeof isHealthy).toBe('boolean');
  });

  it('should load a model', async () => {
    const modelConfig: ModelConfig = {
      id: 'test-model',
      name: 'llama2:7b',
      backend: 'ollama'
    };

    // Mock successful Ollama API response
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ status: 'success' })
    });

    const result = await runtimeService.loadModel(modelConfig);

    expect(result).toBeDefined();
    expect(result.id).toBe('test-model');
    expect(result.status).toBe('ready');
  });
});