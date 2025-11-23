/**
 * Example: Observability Integration
 * 
 * Demonstrates how to integrate OpenTelemetry instrumentation,
 * metrics collection, and structured logging in Mobius 1.
 */

import Fastify from 'fastify';
import {
  initializeTelemetry,
  shutdownTelemetry,
  telemetryPlugin,
  logger,
  withSpan,
  metricsCollector,
  measureDuration,
  checkSLO,
} from '../src/observability/index.js';

// Initialize telemetry on startup
initializeTelemetry({
  serviceName: 'mobius1-api',
  serviceVersion: '1.0.0',
  environment: process.env.NODE_ENV || 'development',
  otlpEndpoint: process.env.OTLP_ENDPOINT || 'http://localhost:4318',
  enableAutoInstrumentation: true,
  enablePIIRedaction: true,
  exportIntervalMs: 60000,
});

logger.info('Telemetry initialized', {
  service: 'mobius1-api',
  environment: process.env.NODE_ENV || 'development',
});

// Create Fastify app
const app = Fastify({
  logger: false, // Use our custom logger instead
});

// Register telemetry plugin
await app.register(telemetryPlugin, {
  enablePIIRedaction: true,
  ignoreRoutes: ['/health', '/metrics'],
  serviceName: 'mobius1-api',
});

// Example route: Process document with tracing
app.post('/api/v1/documents/process', async (request, reply) => {
  const { workspaceId, documentId, documentType } = request.body as any;

  logger.info('Processing document', {
    workspaceId,
    documentId,
    documentType,
  });

  try {
    // Use withSpan for automatic tracing
    const result = await withSpan(
      'process-document',
      {
        'workspace.id': workspaceId,
        'document.id': documentId,
        'document.type': documentType,
      },
      async (span) => {
        // Simulate OCR processing
        span.addEvent('ocr-started');
        
        const ocrResult = await measureDuration(
          async () => {
            // Simulate OCR work
            await new Promise((resolve) => setTimeout(resolve, 100));
            return {
              text: 'Extracted text from document',
              confidence: 0.95,
            };
          },
          'ocr',
          {
            workspace_id: workspaceId,
            document_type: documentType,
          }
        );

        span.addEvent('ocr-completed', {
          confidence: ocrResult.confidence,
        });

        // Check SLO for OCR processing
        const sloCheck = checkSLO('pipeshub_classification_time', 100);
        if (sloCheck.shouldAlert) {
          logger.warn('OCR processing SLO violated', {
            workspaceId,
            slo: sloCheck.slo.name,
            actual: sloCheck.actualValue,
            target: sloCheck.slo.target,
          });
        }

        // Simulate policy evaluation
        span.addEvent('policy-evaluation-started');
        
        await measureDuration(
          async () => {
            await new Promise((resolve) => setTimeout(resolve, 50));
          },
          'policy',
          {
            workspace_id: workspaceId,
            policy_type: 'residency',
          }
        );

        span.addEvent('policy-evaluation-completed');

        return {
          documentId,
          status: 'processed',
          extractedData: ocrResult,
        };
      }
    );

    logger.info('Document processing completed', {
      workspaceId,
      documentId,
      status: result.status,
    });

    return reply.code(200).send(result);
  } catch (error) {
    logger.error('Document processing failed', error as Error, {
      workspaceId,
      documentId,
    });

    metricsCollector.recordError({
      service: 'mobius1-api',
      endpoint: '/api/v1/documents/process',
      error_type: (error as Error).name,
    });

    return reply.code(500).send({
      error: 'Processing failed',
      message: (error as Error).message,
    });
  }
});

// Example route: Policy evaluation with metrics
app.post('/api/v1/policy/evaluate', async (request, reply) => {
  const { workspaceId, action, userId } = request.body as any;

  logger.info('Evaluating policy', {
    workspaceId,
    action,
    userId,
  });

  try {
    const decision = await withSpan(
      'policy-evaluation',
      {
        'workspace.id': workspaceId,
        'user.id': userId,
        'policy.action': action,
      },
      async (span) => {
        // Simulate policy evaluation
        await new Promise((resolve) => setTimeout(resolve, 30));

        const decision = {
          allow: true,
          residency: { enforced: true, region: 'ES' },
          redaction: { applied: true, categories: ['dni', 'email'] },
        };

        span.setAttribute('policy.residency_decision', decision.residency.enforced);
        span.setAttribute('pii.redacted', decision.redaction.applied);

        // Record PII redactions
        decision.redaction.categories.forEach((category) => {
          metricsCollector.recordPIIRedaction(category, {
            workspace_id: workspaceId,
          });
        });

        return decision;
      }
    );

    logger.info('Policy evaluation completed', {
      workspaceId,
      action,
      decision: decision.allow,
    });

    return reply.code(200).send(decision);
  } catch (error) {
    logger.error('Policy evaluation failed', error as Error, {
      workspaceId,
      action,
    });

    return reply.code(500).send({
      error: 'Evaluation failed',
      message: (error as Error).message,
    });
  }
});

// Health check endpoint (not traced)
app.get('/health', async (request, reply) => {
  return reply.code(200).send({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

// Metrics endpoint
app.get('/metrics', async (request, reply) => {
  // In production, this would expose Prometheus metrics
  return reply.code(200).send({
    message: 'Metrics available at /metrics endpoint',
    slos: Object.keys(require('../src/observability/metrics.js').SLO_DEFINITIONS),
  });
});

// Start server
const start = async () => {
  try {
    await app.listen({ port: 3000, host: '0.0.0.0' });
    
    logger.info('Server started', {
      port: 3000,
      environment: process.env.NODE_ENV || 'development',
    });
  } catch (error) {
    logger.error('Server startup failed', error as Error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  await app.close();
  await shutdownTelemetry();
  
  logger.info('Shutdown complete');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  await app.close();
  await shutdownTelemetry();
  
  logger.info('Shutdown complete');
  process.exit(0);
});

// Start the server
start();
