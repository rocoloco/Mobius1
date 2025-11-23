# Observability & Monitoring

Comprehensive observability implementation for Mobius 1 platform with OpenTelemetry instrumentation, metrics collection, and PII-safe logging.

## Overview

The observability module provides:

- **Distributed Tracing**: OpenTelemetry-based tracing with automatic instrumentation
- **Metrics Collection**: Performance metrics, SLIs, and SLO monitoring
- **Structured Logging**: JSON-formatted logs with automatic PII redaction
- **PII Protection**: Automatic redaction of sensitive data in traces, logs, and metrics

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Application Layer                      │
│  (Fastify, Policy Engine, Runtime, PipesHub, etc.)     │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              Observability Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Tracing    │  │   Metrics    │  │   Logging    │ │
│  │ (OpenTelemetry)│  │ (Prometheus) │  │  (Structured)│ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                  │                  │          │
│  ┌──────▼──────────────────▼──────────────────▼──────┐ │
│  │           PII Redaction Layer                      │ │
│  │  (Automatic redaction before export)               │ │
│  └────────────────────────────────────────────────────┘ │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              Export Layer                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ OTLP Exporter│  │ Prometheus   │  │ Log Aggregator│ │
│  │ (Jaeger/Tempo)│  │   Exporter   │  │ (ELK/Loki)   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Initialize Telemetry

```typescript
import { initializeTelemetry } from './observability/index.js';

initializeTelemetry({
  serviceName: 'mobius1-api',
  serviceVersion: '1.0.0',
  environment: 'production',
  otlpEndpoint: 'http://localhost:4318',
  enableAutoInstrumentation: true,
  enablePIIRedaction: true,
});
```

### 2. Add Fastify Plugin

```typescript
import Fastify from 'fastify';
import telemetryPlugin from './observability/fastify-plugin.js';

const app = Fastify();

await app.register(telemetryPlugin, {
  enablePIIRedaction: true,
  ignoreRoutes: ['/health', '/metrics'],
  serviceName: 'mobius1-api',
});
```

### 3. Use Structured Logger

```typescript
import { logger } from './observability/index.js';

logger.info('Processing document', {
  workspaceId: 'ws-123',
  documentType: 'dni',
});

logger.error('Processing failed', error, {
  workspaceId: 'ws-123',
  operation: 'ocr-extraction',
});
```

### 4. Manual Tracing

```typescript
import { withSpan } from './observability/index.js';

const result = await withSpan(
  'process-document',
  {
    'workspace.id': workspaceId,
    'document.type': 'dni',
  },
  async (span) => {
    // Your processing logic
    span.addEvent('extraction-started');
    const data = await extractData();
    span.addEvent('extraction-completed');
    return data;
  }
);
```

### 5. Record Metrics

```typescript
import { metricsCollector, measureDuration } from './observability/index.js';

// Record custom metric
metricsCollector.recordInferenceDuration(1500, {
  workspace_id: 'ws-123',
  model: 'llama-3',
});

// Measure function duration
const result = await measureDuration(
  async () => await processDocument(),
  'ocr',
  { workspace_id: 'ws-123' }
);
```

## Features

### Distributed Tracing

Automatic instrumentation of:
- HTTP requests/responses
- Database queries (PostgreSQL via Prisma)
- Redis operations
- External API calls

Manual instrumentation:
- Custom spans for business logic
- Span events for important milestones
- Error recording with stack traces

### Metrics Collection

**Counters**:
- `http.requests.total` - Total HTTP requests
- `http.errors.total` - Total HTTP errors
- `policy.violations.total` - Policy violations
- `pii.redactions.total` - PII redactions performed
- `quota.exceeded.total` - Quota exceeded events

**Histograms**:
- `http.request.duration` - HTTP request latency
- `inference.duration` - AI inference latency
- `ocr.processing.duration` - OCR processing time
- `policy.evaluation.duration` - Policy evaluation time

**Gauges**:
- `http.connections.active` - Active connections
- `process.memory.usage` - Memory usage
- `process.cpu.usage` - CPU usage

### Service Level Objectives (SLOs)

| Component | SLI | Target | Alert Threshold |
|-----------|-----|--------|----------------|
| Policy Gateway | p95 latency | ≤ 150ms | > 200ms |
| Runtime Layer | p95 inference | ≤ 2s | > 3s |
| PipesHub | Classification time | ≤ 10s | > 15s |
| Control Plane | Health check | ≤ 5s | > 10s |
| System | Availability | 99.9% | < 99.5% |

### PII Redaction

Automatically redacts:
- Spanish DNI/NIE numbers (12345678A, X1234567A)
- Passport numbers (AAA123456)
- Phone numbers (+34 612 345 678)
- Email addresses
- IBAN numbers
- Credit card numbers
- IP addresses
- Postal codes

Redaction occurs **before** export to ensure no PII leaves the system.

### Structured Logging

All logs are JSON-formatted with:
- ISO 8601 timestamps
- Log levels (DEBUG, INFO, WARN, ERROR)
- Trace correlation (traceId, spanId)
- Workspace and user context
- Automatic PII redaction

## Configuration

### Environment Variables

```bash
# Telemetry
OTLP_ENDPOINT=http://localhost:4318
ENABLE_AUTO_INSTRUMENTATION=true
ENABLE_PII_REDACTION=true

# Logging
LOG_LEVEL=info  # debug, info, warn, error
```

### Docker Compose Setup

```yaml
services:
  # Jaeger for distributed tracing
  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686"  # UI
      - "4318:4318"    # OTLP HTTP receiver
    environment:
      - COLLECTOR_OTLP_ENABLED=true

  # Prometheus for metrics
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  # Grafana for visualization
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_AUTH_ANONYMOUS_ENABLED=true
```

## Usage Examples

### Example 1: Policy Evaluation Tracing

```typescript
import { withSpan, metricsCollector } from './observability/index.js';

async function evaluatePolicy(workspaceId: string, action: string) {
  return await withSpan(
    'policy-evaluation',
    {
      'workspace.id': workspaceId,
      'policy.action': action,
    },
    async (span) => {
      const decision = await policyEngine.evaluate(workspaceId, action);
      
      span.setAttribute('policy.residency_decision', decision.residency.enforced);
      span.setAttribute('pii.redacted', decision.redaction.applied);
      
      if (!decision.allow) {
        metricsCollector.recordPolicyViolation('access_denied', {
          workspace_id: workspaceId,
        });
      }
      
      return decision;
    }
  );
}
```

### Example 2: OCR Processing with Metrics

```typescript
import { measureDuration, logger } from './observability/index.js';

async function processDocument(documentId: string, workspaceId: string) {
  logger.info('Starting document processing', {
    workspaceId,
    documentId,
  });

  const result = await measureDuration(
    async () => {
      const extracted = await ocrEngine.extract(documentId);
      return extracted;
    },
    'ocr',
    {
      workspace_id: workspaceId,
      document_type: 'dni',
    }
  );

  logger.info('Document processing completed', {
    workspaceId,
    documentId,
    confidence: result.confidence,
  });

  return result;
}
```

### Example 3: SLO Monitoring

```typescript
import { checkSLO, logger } from './observability/index.js';

async function monitorInferenceLatency(latencyMs: number) {
  const sloCheck = checkSLO('runtime_inference_latency', latencyMs);
  
  if (sloCheck.shouldAlert) {
    logger.warn('Inference latency SLO violated', {
      slo: sloCheck.slo.name,
      target: sloCheck.slo.target,
      actual: sloCheck.actualValue,
      threshold: sloCheck.slo.alertThreshold,
    });
    
    // Trigger alert to monitoring system
    await alertingService.send({
      severity: 'warning',
      message: `Inference latency exceeded threshold: ${latencyMs}ms`,
    });
  }
}
```

## Best Practices

### 1. Always Use Structured Logging

❌ **Bad**:
```typescript
console.log('User 12345678A logged in');
```

✅ **Good**:
```typescript
logger.info('User logged in', {
  userId: 'user-123',  // Use IDs, not PII
  workspaceId: 'ws-456',
});
```

### 2. Add Context to Spans

❌ **Bad**:
```typescript
const span = createSpan('process');
```

✅ **Good**:
```typescript
const span = createSpan('process-document', {
  'workspace.id': workspaceId,
  'document.type': documentType,
  'processing.stage': 'extraction',
});
```

### 3. Record Business Metrics

```typescript
// Record important business events
metricsCollector.recordPolicyViolation('residency_violation', {
  workspace_id: workspaceId,
});

metricsCollector.recordPIIRedaction('dni', {
  workspace_id: workspaceId,
  document_type: 'passport',
});
```

### 4. Use Correlation IDs

```typescript
const correlationId = crypto.randomUUID();

logger.info('Starting workflow', {
  correlationId,
  workspaceId,
});

// Pass correlationId through the call chain
await processStep1(correlationId);
await processStep2(correlationId);
```

### 5. Monitor SLOs Continuously

```typescript
// Check SLOs after critical operations
const latency = Date.now() - startTime;
const sloCheck = checkSLO('policy_gateway_latency', latency);

if (!sloCheck.met) {
  logger.warn('SLO not met', {
    slo: sloCheck.slo.name,
    actual: sloCheck.actualValue,
    target: sloCheck.slo.target,
  });
}
```

## Troubleshooting

### Traces Not Appearing

1. Check OTLP endpoint is accessible:
   ```bash
   curl http://localhost:4318/v1/traces
   ```

2. Verify telemetry initialization:
   ```typescript
   initializeTelemetry({ ... });
   ```

3. Check for errors in logs:
   ```bash
   docker logs mobius1-api | grep -i "telemetry\|otlp"
   ```

### High Memory Usage

1. Adjust export interval:
   ```typescript
   initializeTelemetry({
     exportIntervalMs: 30000,  // Export every 30s instead of 60s
   });
   ```

2. Reduce span attributes:
   - Only include essential attributes
   - Avoid large string values

### PII Leaking in Logs

1. Verify PII redaction is enabled:
   ```typescript
   logger.setPIIRedaction(true);
   ```

2. Add custom PII patterns if needed:
   ```typescript
   // Edit src/observability/pii-redactor.ts
   ```

3. Test redaction:
   ```typescript
   import { redactPII } from './observability/index.js';
   console.log(redactPII('DNI: 12345678A'));  // Should output: DNI: [DNI_REDACTED]
   ```

## Compliance

This observability implementation ensures:

- **FR-004**: Automatic PII redaction in all logs and traces
- **NFR-004**: No data egress without explicit whitelisting
- **NFR-009**: OpenTelemetry traces with redaction filters active by default
- **GDPR Art. 32**: Appropriate technical measures for data protection

All PII is redacted **before** export, ensuring compliance with Spanish data protection regulations and AESIA requirements.

## References

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Jaeger Tracing](https://www.jaegertracing.io/)
- [Prometheus Metrics](https://prometheus.io/)
- [Grafana Dashboards](https://grafana.com/)
