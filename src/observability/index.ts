/**
 * Observability Module
 * 
 * Central export for all observability functionality including:
 * - OpenTelemetry tracing
 * - Metrics collection
 * - PII redaction
 * - Structured logging
 * - SLI/SLO monitoring
 */

export {
  initializeTelemetry,
  shutdownTelemetry,
  getTracer,
  createSpan,
  withSpan,
  addSpanEvent,
  recordSpanError,
  getTraceContext,
  type TelemetryConfig,
  type SpanAttributes,
} from './telemetry.js';

export {
  redactPII,
  redactPIIFromObject,
  containsPII,
  detectPIICategories,
} from './pii-redactor.js';

export {
  metricsCollector,
  measureDuration,
  checkSLO,
  SLO_DEFINITIONS,
  type SLOConfig,
  type MetricLabels,
} from './metrics.js';

export { logger, LogLevel, type LogContext, type LogEntry } from './logger.js';

export { default as telemetryPlugin, type TelemetryPluginOptions } from './fastify-plugin.js';
