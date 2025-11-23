/**
 * OpenTelemetry Instrumentation
 * 
 * Provides distributed tracing, metrics collection, and logging with PII redaction.
 * Implements NFR-009 observability requirements with automatic instrumentation.
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { trace, context, SpanStatusCode, Span } from '@opentelemetry/api';
import { redactPII } from './pii-redactor.js';

export interface TelemetryConfig {
  serviceName: string;
  serviceVersion: string;
  environment: string;
  otlpEndpoint?: string;
  enableAutoInstrumentation: boolean;
  enablePIIRedaction: boolean;
  exportIntervalMs?: number;
}

export interface SpanAttributes {
  'workspace.id'?: string;
  'user.id'?: string;
  'policy.residency_decision'?: boolean;
  'pii.redacted'?: boolean;
  'model.ref'?: string;
  'quota.bucket'?: string;
  'processing.time_ms'?: number;
  'error.type'?: string;
  'error.code'?: string;
  [key: string]: string | number | boolean | undefined;
}

let sdk: NodeSDK | null = null;
let isInitialized = false;

/**
 * Initialize OpenTelemetry SDK with automatic instrumentation
 */
export function initializeTelemetry(config: TelemetryConfig): void {
  if (isInitialized) {
    console.warn('Telemetry already initialized');
    return;
  }

  const resource = Resource.default().merge(
    new Resource({
      [SEMRESATTRS_SERVICE_NAME]: config.serviceName,
      [SEMRESATTRS_SERVICE_VERSION]: config.serviceVersion,
      'deployment.environment': config.environment,
    })
  );

  const traceExporter = new OTLPTraceExporter({
    url: config.otlpEndpoint || 'http://localhost:4318/v1/traces',
  });

  const metricExporter = new OTLPMetricExporter({
    url: config.otlpEndpoint || 'http://localhost:4318/v1/metrics',
  });

  sdk = new NodeSDK({
    resource,
    spanProcessor: new BatchSpanProcessor(traceExporter),
    metricReader: new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: config.exportIntervalMs || 60000,
    }),
    instrumentations: config.enableAutoInstrumentation
      ? [
          getNodeAutoInstrumentations({
            '@opentelemetry/instrumentation-fs': { enabled: false },
            '@opentelemetry/instrumentation-http': {
              ignoreIncomingRequestHook: (req) => {
                // Ignore health check endpoints
                return req.url?.includes('/health') || false;
              },
            },
          }),
        ]
      : [],
  });

  sdk.start();
  isInitialized = true;

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    await shutdownTelemetry();
  });
}

/**
 * Shutdown telemetry and flush remaining data
 */
export async function shutdownTelemetry(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    isInitialized = false;
  }
}

/**
 * Get the tracer instance for manual instrumentation
 */
export function getTracer(name: string = 'mobius1') {
  return trace.getTracer(name);
}

/**
 * Create a new span with automatic PII redaction
 */
export function createSpan(
  name: string,
  attributes: SpanAttributes = {},
  enablePIIRedaction: boolean = true
): Span {
  const tracer = getTracer();
  const span = tracer.startSpan(name);

  // Redact PII from attributes if enabled
  const sanitizedAttributes = enablePIIRedaction
    ? sanitizeAttributes(attributes)
    : attributes;

  // Set attributes
  Object.entries(sanitizedAttributes).forEach(([key, value]) => {
    if (value !== undefined) {
      span.setAttribute(key, value);
    }
  });

  return span;
}

/**
 * Execute a function within a traced span
 */
export async function withSpan<T>(
  name: string,
  attributes: SpanAttributes,
  fn: (span: Span) => Promise<T>,
  enablePIIRedaction: boolean = true
): Promise<T> {
  const span = createSpan(name, attributes, enablePIIRedaction);

  try {
    const result = await context.with(trace.setSpan(context.active(), span), () => fn(span));
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Sanitize span attributes to remove PII
 */
function sanitizeAttributes(attributes: SpanAttributes): SpanAttributes {
  const sanitized: SpanAttributes = {};

  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined) continue;

    // Redact string values that might contain PII
    if (typeof value === 'string') {
      sanitized[key] = redactPII(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Add event to current span with PII redaction
 */
export function addSpanEvent(
  name: string,
  attributes: Record<string, string | number | boolean> = {}
): void {
  const span = trace.getActiveSpan();
  if (span) {
    const sanitized = sanitizeAttributes(attributes);
    span.addEvent(name, sanitized);
  }
}

/**
 * Set error on current span
 */
export function recordSpanError(error: Error, attributes?: SpanAttributes): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });

    if (attributes) {
      const sanitized = sanitizeAttributes(attributes);
      Object.entries(sanitized).forEach(([key, value]) => {
        if (value !== undefined) {
          span.setAttribute(key, value);
        }
      });
    }
  }
}

/**
 * Get current trace context for correlation
 */
export function getTraceContext(): { traceId: string; spanId: string } | null {
  const span = trace.getActiveSpan();
  if (!span) return null;

  const spanContext = span.spanContext();
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
  };
}
