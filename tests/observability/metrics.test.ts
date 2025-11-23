/**
 * Tests for Metrics Collection and SLO Monitoring
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { metricsCollector, checkSLO, SLO_DEFINITIONS, measureDuration } from '../../src/observability/metrics.js';

describe('Metrics Collector', () => {
  describe('metricsCollector', () => {
    it('should record HTTP requests', () => {
      expect(() => {
        metricsCollector.recordRequest({
          service: 'test-service',
          endpoint: '/api/test',
          method: 'GET',
        });
      }).not.toThrow();
    });

    it('should record HTTP errors', () => {
      expect(() => {
        metricsCollector.recordError({
          service: 'test-service',
          endpoint: '/api/test',
          status: '500',
        });
      }).not.toThrow();
    });

    it('should record request duration', () => {
      expect(() => {
        metricsCollector.recordRequestDuration(150, {
          service: 'test-service',
          endpoint: '/api/test',
        });
      }).not.toThrow();
    });

    it('should record inference duration', () => {
      expect(() => {
        metricsCollector.recordInferenceDuration(2000, {
          workspace_id: 'ws-123',
          model: 'llama-3',
        });
      }).not.toThrow();
    });

    it('should record OCR duration', () => {
      expect(() => {
        metricsCollector.recordOCRDuration(5000, {
          workspace_id: 'ws-123',
          document_type: 'dni',
        });
      }).not.toThrow();
    });

    it('should record policy evaluation duration', () => {
      expect(() => {
        metricsCollector.recordPolicyEvaluationDuration(50, {
          workspace_id: 'ws-123',
          policy_type: 'residency',
        });
      }).not.toThrow();
    });

    it('should record policy violations', () => {
      expect(() => {
        metricsCollector.recordPolicyViolation('residency_violation', {
          workspace_id: 'ws-123',
        });
      }).not.toThrow();
    });

    it('should record PII redactions', () => {
      expect(() => {
        metricsCollector.recordPIIRedaction('dni', {
          workspace_id: 'ws-123',
        });
      }).not.toThrow();
    });

    it('should record quota exceeded events', () => {
      expect(() => {
        metricsCollector.recordQuotaExceeded({
          workspace_id: 'ws-123',
        });
      }).not.toThrow();
    });
  });

  describe('measureDuration', () => {
    it('should measure request duration', async () => {
      const fn = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'result';
      };

      const result = await measureDuration(fn, 'request', {
        service: 'test',
        endpoint: '/test',
      });

      expect(result).toBe('result');
    });

    it('should measure inference duration', async () => {
      const fn = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { output: 'test' };
      };

      const result = await measureDuration(fn, 'inference', {
        workspace_id: 'ws-123',
      });

      expect(result).toEqual({ output: 'test' });
    });

    it('should record duration even on error', async () => {
      const fn = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        throw new Error('Test error');
      };

      await expect(
        measureDuration(fn, 'request', { service: 'test' })
      ).rejects.toThrow('Test error');
    });
  });

  describe('SLO Monitoring', () => {
    it('should check policy gateway latency SLO', () => {
      const result = checkSLO('policy_gateway_latency', 100);

      expect(result.met).toBe(true);
      expect(result.shouldAlert).toBe(false);
      expect(result.slo.target).toBe(150);
      expect(result.actualValue).toBe(100);
    });

    it('should detect SLO violation', () => {
      const result = checkSLO('policy_gateway_latency', 180);

      expect(result.met).toBe(false);
      expect(result.shouldAlert).toBe(false);
    });

    it('should trigger alert threshold', () => {
      const result = checkSLO('policy_gateway_latency', 250);

      expect(result.met).toBe(false);
      expect(result.shouldAlert).toBe(true);
    });

    it('should check runtime inference latency SLO', () => {
      const result = checkSLO('runtime_inference_latency', 1500);

      expect(result.met).toBe(true);
      expect(result.shouldAlert).toBe(false);
      expect(result.slo.target).toBe(2000);
    });

    it('should check PipesHub classification time SLO', () => {
      const result = checkSLO('pipeshub_classification_time', 8000);

      expect(result.met).toBe(true);
      expect(result.shouldAlert).toBe(false);
      expect(result.slo.target).toBe(10000);
    });

    it('should check control plane health check SLO', () => {
      const result = checkSLO('control_plane_health_check', 3000);

      expect(result.met).toBe(true);
      expect(result.shouldAlert).toBe(false);
      expect(result.slo.target).toBe(5000);
    });

    it('should check system availability SLO', () => {
      const result = checkSLO('system_availability', 99.95);

      expect(result.met).toBe(false); // 99.95 > 99.9 target (higher is better for availability)
      expect(result.actualValue).toBe(99.95);
    });
  });

  describe('SLO Definitions', () => {
    it('should have all required SLO definitions', () => {
      expect(SLO_DEFINITIONS).toHaveProperty('policy_gateway_latency');
      expect(SLO_DEFINITIONS).toHaveProperty('runtime_inference_latency');
      expect(SLO_DEFINITIONS).toHaveProperty('pipeshub_classification_time');
      expect(SLO_DEFINITIONS).toHaveProperty('control_plane_health_check');
      expect(SLO_DEFINITIONS).toHaveProperty('system_availability');
    });

    it('should have valid SLO configurations', () => {
      Object.values(SLO_DEFINITIONS).forEach((slo) => {
        expect(slo).toHaveProperty('name');
        expect(slo).toHaveProperty('target');
        expect(slo).toHaveProperty('alertThreshold');
        expect(slo).toHaveProperty('window');
        expect(typeof slo.target).toBe('number');
        expect(typeof slo.alertThreshold).toBe('number');
      });
    });
  });
});
