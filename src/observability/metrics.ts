/**
 * Metrics Collection and SLI/SLO Monitoring
 * 
 * Implements performance metrics, service level indicators (SLIs),
 * and service level objectives (SLOs) monitoring per NFR-001, NFR-002.
 */

import { metrics, ValueType } from '@opentelemetry/api';

export interface SLOConfig {
  name: string;
  target: number; // Target percentage (e.g., 99.9 for 99.9%)
  alertThreshold: number; // Alert when below this percentage
  window: string; // Time window (e.g., '1h', '24h', '30d')
}

export interface MetricLabels {
  workspace_id?: string;
  service?: string;
  endpoint?: string;
  status?: string;
  error_type?: string;
  [key: string]: string | undefined;
}

/**
 * Service Level Objectives (SLOs) per component
 */
export const SLO_DEFINITIONS: Record<string, SLOConfig> = {
  policy_gateway_latency: {
    name: 'Policy Gateway p95 Latency',
    target: 150, // ms
    alertThreshold: 200, // ms
    window: '5m',
  },
  runtime_inference_latency: {
    name: 'Runtime Inference p95 Latency',
    target: 2000, // ms for 1k tokens
    alertThreshold: 3000, // ms
    window: '5m',
  },
  pipeshub_classification_time: {
    name: 'PipesHub Classification Time',
    target: 10000, // ms
    alertThreshold: 15000, // ms
    window: '5m',
  },
  control_plane_health_check: {
    name: 'Control Plane Health Check',
    target: 5000, // ms
    alertThreshold: 10000, // ms
    window: '1m',
  },
  system_availability: {
    name: 'Overall System Availability',
    target: 99.9, // %
    alertThreshold: 99.5, // %
    window: '30d',
  },
};

class MetricsCollector {
  private meter = metrics.getMeter('mobius1-metrics');
  
  // Counters
  private requestCounter = this.meter.createCounter('http.requests.total', {
    description: 'Total HTTP requests',
    valueType: ValueType.INT,
  });

  private errorCounter = this.meter.createCounter('http.errors.total', {
    description: 'Total HTTP errors',
    valueType: ValueType.INT,
  });

  private policyViolationCounter = this.meter.createCounter('policy.violations.total', {
    description: 'Total policy violations',
    valueType: ValueType.INT,
  });

  private piiRedactionCounter = this.meter.createCounter('pii.redactions.total', {
    description: 'Total PII redactions performed',
    valueType: ValueType.INT,
  });

  private quotaExceededCounter = this.meter.createCounter('quota.exceeded.total', {
    description: 'Total quota exceeded events',
    valueType: ValueType.INT,
  });

  // Histograms
  private requestDuration = this.meter.createHistogram('http.request.duration', {
    description: 'HTTP request duration in milliseconds',
    unit: 'ms',
    valueType: ValueType.DOUBLE,
  });

  private inferenceDuration = this.meter.createHistogram('inference.duration', {
    description: 'AI inference duration in milliseconds',
    unit: 'ms',
    valueType: ValueType.DOUBLE,
  });

  private ocrProcessingDuration = this.meter.createHistogram('ocr.processing.duration', {
    description: 'OCR processing duration in milliseconds',
    unit: 'ms',
    valueType: ValueType.DOUBLE,
  });

  private policyEvaluationDuration = this.meter.createHistogram('policy.evaluation.duration', {
    description: 'Policy evaluation duration in milliseconds',
    unit: 'ms',
    valueType: ValueType.DOUBLE,
  });

  // Gauges (via observable gauges)
  private activeConnections = this.meter.createObservableGauge('http.connections.active', {
    description: 'Number of active HTTP connections',
    valueType: ValueType.INT,
  });

  private memoryUsage = this.meter.createObservableGauge('process.memory.usage', {
    description: 'Process memory usage in bytes',
    unit: 'bytes',
    valueType: ValueType.INT,
  });

  private cpuUsage = this.meter.createObservableGauge('process.cpu.usage', {
    description: 'Process CPU usage percentage',
    unit: '%',
    valueType: ValueType.DOUBLE,
  });

  constructor() {
    this.setupObservableMetrics();
  }

  /**
   * Setup observable metrics that are collected periodically
   */
  private setupObservableMetrics(): void {
    this.memoryUsage.addCallback((result) => {
      const usage = process.memoryUsage();
      result.observe(usage.heapUsed, { type: 'heap' });
      result.observe(usage.rss, { type: 'rss' });
      result.observe(usage.external, { type: 'external' });
    });

    this.cpuUsage.addCallback((result) => {
      const usage = process.cpuUsage();
      const totalUsage = (usage.user + usage.system) / 1000000; // Convert to seconds
      result.observe(totalUsage);
    });
  }

  /**
   * Record HTTP request
   */
  recordRequest(labels: MetricLabels): void {
    this.requestCounter.add(1, labels);
  }

  /**
   * Record HTTP error
   */
  recordError(labels: MetricLabels): void {
    this.errorCounter.add(1, labels);
  }

  /**
   * Record request duration
   */
  recordRequestDuration(durationMs: number, labels: MetricLabels): void {
    this.requestDuration.record(durationMs, labels);
  }

  /**
   * Record inference duration
   */
  recordInferenceDuration(durationMs: number, labels: MetricLabels): void {
    this.inferenceDuration.record(durationMs, labels);
  }

  /**
   * Record OCR processing duration
   */
  recordOCRDuration(durationMs: number, labels: MetricLabels): void {
    this.ocrProcessingDuration.record(durationMs, labels);
  }

  /**
   * Record policy evaluation duration
   */
  recordPolicyEvaluationDuration(durationMs: number, labels: MetricLabels): void {
    this.policyEvaluationDuration.record(durationMs, labels);
  }

  /**
   * Record policy violation
   */
  recordPolicyViolation(violationType: string, labels: MetricLabels = {}): void {
    this.policyViolationCounter.add(1, { ...labels, violation_type: violationType });
  }

  /**
   * Record PII redaction
   */
  recordPIIRedaction(category: string, labels: MetricLabels = {}): void {
    this.piiRedactionCounter.add(1, { ...labels, pii_category: category });
  }

  /**
   * Record quota exceeded event
   */
  recordQuotaExceeded(labels: MetricLabels): void {
    this.quotaExceededCounter.add(1, labels);
  }
}

// Singleton instance
export const metricsCollector = new MetricsCollector();

/**
 * Measure execution time of a function
 */
export async function measureDuration<T>(
  fn: () => Promise<T>,
  metricName: 'request' | 'inference' | 'ocr' | 'policy',
  labels: MetricLabels = {}
): Promise<T> {
  const start = Date.now();
  
  try {
    const result = await fn();
    const duration = Date.now() - start;
    
    switch (metricName) {
      case 'request':
        metricsCollector.recordRequestDuration(duration, labels);
        break;
      case 'inference':
        metricsCollector.recordInferenceDuration(duration, labels);
        break;
      case 'ocr':
        metricsCollector.recordOCRDuration(duration, labels);
        break;
      case 'policy':
        metricsCollector.recordPolicyEvaluationDuration(duration, labels);
        break;
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    
    // Still record duration even on error
    switch (metricName) {
      case 'request':
        metricsCollector.recordRequestDuration(duration, { ...labels, status: 'error' });
        break;
      case 'inference':
        metricsCollector.recordInferenceDuration(duration, { ...labels, status: 'error' });
        break;
      case 'ocr':
        metricsCollector.recordOCRDuration(duration, { ...labels, status: 'error' });
        break;
      case 'policy':
        metricsCollector.recordPolicyEvaluationDuration(duration, { ...labels, status: 'error' });
        break;
    }
    
    throw error;
  }
}

/**
 * Check if SLO is met
 */
export function checkSLO(sloKey: keyof typeof SLO_DEFINITIONS, actualValue: number): {
  met: boolean;
  shouldAlert: boolean;
  slo: SLOConfig;
  actualValue: number;
} {
  const slo = SLO_DEFINITIONS[sloKey];
  
  return {
    met: actualValue <= slo.target,
    shouldAlert: actualValue > slo.alertThreshold,
    slo,
    actualValue,
  };
}
