/**
 * Fastify OpenTelemetry Plugin
 * 
 * Integrates OpenTelemetry tracing and metrics with Fastify HTTP server.
 * Automatically instruments all routes with distributed tracing.
 */

import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { getTracer, getTraceContext } from './telemetry.js';
import { metricsCollector } from './metrics.js';
import { redactPII } from './pii-redactor.js';

export interface TelemetryPluginOptions {
  enablePIIRedaction?: boolean;
  ignoreRoutes?: string[];
  serviceName?: string;
}

const telemetryPlugin: FastifyPluginAsync<TelemetryPluginOptions> = async (
  fastify,
  options
) => {
  const {
    enablePIIRedaction = true,
    ignoreRoutes = ['/health', '/metrics'],
    serviceName = 'mobius1-api',
  } = options;

  const tracer = getTracer(serviceName);

  // Add trace context to request
  fastify.decorateRequest('traceContext', null);

  // Hook: onRequest - Start span
  fastify.addHook('onRequest', async (request, reply) => {
    // Skip ignored routes
    if (ignoreRoutes.some((route) => request.url.startsWith(route))) {
      return;
    }

    const spanName = `${request.method} ${request.routeOptions.url || request.url}`;
    const span = tracer.startSpan(spanName, {
      attributes: {
        'http.method': request.method,
        'http.url': enablePIIRedaction ? redactPII(request.url) : request.url,
        'http.target': request.routeOptions.url || request.url,
        'http.user_agent': request.headers['user-agent'] || 'unknown',
        'http.client_ip': request.ip,
      },
    });

    // Store span in request context
    (request as any).span = span;
    (request as any).traceContext = getTraceContext();

    // Add trace ID to reply headers
    const traceCtx = getTraceContext();
    if (traceCtx) {
      reply.header('X-Trace-Id', traceCtx.traceId);
      reply.header('X-Span-Id', traceCtx.spanId);
    }

    // Record request metric
    metricsCollector.recordRequest({
      service: serviceName,
      endpoint: request.routeOptions.url || request.url,
      method: request.method,
    });
  });

  // Hook: preHandler - Add workspace context
  fastify.addHook('preHandler', async (request) => {
    const span = (request as any).span;
    if (!span) return;

    // Add workspace and user context if available
    const workspaceId = (request as any).workspaceId;
    const userId = (request as any).userId;

    if (workspaceId) {
      span.setAttribute('workspace.id', workspaceId);
    }
    if (userId) {
      span.setAttribute('user.id', userId);
    }
  });

  // Hook: onResponse - End span and record metrics
  fastify.addHook('onResponse', async (request, reply) => {
    const span = (request as any).span;
    if (!span) return;

    const duration = reply.elapsedTime;

    // Set span attributes
    span.setAttribute('http.status_code', reply.statusCode);
    span.setAttribute('http.response_time_ms', duration);

    // Set span status based on HTTP status code
    if (reply.statusCode >= 400) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `HTTP ${reply.statusCode}`,
      });

      // Record error metric
      metricsCollector.recordError({
        service: serviceName,
        endpoint: request.routeOptions.url || request.url,
        status: reply.statusCode.toString(),
      });
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
    }

    // End span
    span.end();

    // Record request duration metric
    metricsCollector.recordRequestDuration(duration, {
      service: serviceName,
      endpoint: request.routeOptions.url || request.url,
      method: request.method,
      status: reply.statusCode.toString(),
    });
  });

  // Hook: onError - Record error in span
  fastify.addHook('onError', async (request, reply, error) => {
    const span = (request as any).span;
    if (!span) return;

    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });

    // Record error metric
    metricsCollector.recordError({
      service: serviceName,
      endpoint: request.routeOptions.url || request.url,
      error_type: error.name,
    });
  });

  // Decorate fastify instance with telemetry utilities
  fastify.decorate('telemetry', {
    getTracer: () => tracer,
    getTraceContext,
    createSpan: (name: string, attributes: Record<string, any> = {}) => {
      return tracer.startSpan(name, { attributes });
    },
    recordMetric: (metricType: string, value: number, labels: Record<string, string> = {}) => {
      switch (metricType) {
        case 'inference':
          metricsCollector.recordInferenceDuration(value, labels);
          break;
        case 'ocr':
          metricsCollector.recordOCRDuration(value, labels);
          break;
        case 'policy':
          metricsCollector.recordPolicyEvaluationDuration(value, labels);
          break;
      }
    },
  });
};

export default fp(telemetryPlugin, {
  name: 'telemetry',
  fastify: '4.x',
});
