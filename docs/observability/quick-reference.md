# Observability Quick Reference

## Initialization

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

## Logging

```typescript
import { logger } from './observability/index.js';

// Info logging
logger.info('User action', { workspaceId: 'ws-123', action: 'login' });

// Error logging
logger.error('Operation failed', error, { workspaceId: 'ws-123' });

// Warning
logger.warn('High latency detected', { latency: 2500, threshold: 2000 });

// Debug (when LOG_LEVEL=debug)
logger.debug('Processing step', { step: 'validation', data: {...} });
```

## Tracing

```typescript
import { withSpan } from './observability/index.js';

// Automatic span management
const result = await withSpan(
  'operation-name',
  {
    'workspace.id': workspaceId,
    'user.id': userId,
  },
  async (span) => {
    span.addEvent('step-1-started');
    // Your logic here
    span.addEvent('step-1-completed');
    return result;
  }
);
```

## Metrics

```typescript
import { metricsCollector, measureDuration } from './observability/index.js';

// Record custom metrics
metricsCollector.recordInferenceDuration(1500, {
  workspace_id: 'ws-123',
  model: 'llama-3',
});

metricsCollector.recordPolicyViolation('residency_violation', {
  workspace_id: 'ws-123',
});

metricsCollector.recordPIIRedaction('dni', {
  workspace_id: 'ws-123',
});

// Measure function duration
const result = await measureDuration(
  async () => await processData(),
  'ocr',
  { workspace_id: 'ws-123' }
);
```

## SLO Monitoring

```typescript
import { checkSLO } from './observability/index.js';

const latency = Date.now() - startTime;
const sloCheck = checkSLO('policy_gateway_latency', latency);

if (sloCheck.shouldAlert) {
  logger.warn('SLO violated', {
    slo: sloCheck.slo.name,
    actual: sloCheck.actualValue,
    target: sloCheck.slo.target,
  });
}
```

## PII Redaction

```typescript
import { redactPII, containsPII } from './observability/index.js';

// Redact PII from string
const safe = redactPII('DNI: 12345678A, Email: user@example.com');
// Result: 'DNI: [DNI_REDACTED], Email: [EMAIL_REDACTED]'

// Check if text contains PII
if (containsPII(userInput)) {
  logger.warn('PII detected in user input');
}
```

## Fastify Integration

```typescript
import telemetryPlugin from './observability/fastify-plugin.js';

await app.register(telemetryPlugin, {
  enablePIIRedaction: true,
  ignoreRoutes: ['/health', '/metrics'],
  serviceName: 'mobius1-api',
});
```

## Environment Variables

```bash
# Telemetry
OTLP_ENDPOINT=http://localhost:4318
ENABLE_AUTO_INSTRUMENTATION=true
ENABLE_PII_REDACTION=true

# Logging
LOG_LEVEL=info  # debug, info, warn, error
```

## SLO Targets

| Component | Target | Alert |
|-----------|--------|-------|
| Policy Gateway | ≤ 150ms | > 200ms |
| Runtime Inference | ≤ 2s | > 3s |
| PipesHub Classification | ≤ 10s | > 15s |
| Control Plane Health | ≤ 5s | > 10s |
| System Availability | 99.9% | < 99.5% |

## Common Patterns

### Pattern 1: API Endpoint with Full Observability

```typescript
app.post('/api/v1/resource', async (request, reply) => {
  const { workspaceId, data } = request.body;

  logger.info('Processing request', { workspaceId });

  try {
    const result = await withSpan(
      'process-resource',
      { 'workspace.id': workspaceId },
      async (span) => {
        const processed = await measureDuration(
          async () => await process(data),
          'request',
          { workspace_id: workspaceId }
        );
        
        span.addEvent('processing-completed');
        return processed;
      }
    );

    logger.info('Request completed', { workspaceId });
    return reply.code(200).send(result);
  } catch (error) {
    logger.error('Request failed', error, { workspaceId });
    metricsCollector.recordError({
      service: 'api',
      endpoint: '/api/v1/resource',
    });
    return reply.code(500).send({ error: 'Processing failed' });
  }
});
```

### Pattern 2: Policy Evaluation with Metrics

```typescript
async function evaluatePolicy(workspaceId: string, action: string) {
  return await withSpan(
    'policy-evaluation',
    {
      'workspace.id': workspaceId,
      'policy.action': action,
    },
    async (span) => {
      const decision = await measureDuration(
        async () => await policyEngine.evaluate(workspaceId, action),
        'policy',
        { workspace_id: workspaceId }
      );

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

### Pattern 3: Background Job with Monitoring

```typescript
async function processBackgroundJob(jobId: string, workspaceId: string) {
  logger.info('Starting background job', { jobId, workspaceId });

  try {
    await withSpan(
      'background-job',
      {
        'job.id': jobId,
        'workspace.id': workspaceId,
      },
      async (span) => {
        const startTime = Date.now();

        // Process job
        await processJob(jobId);

        const duration = Date.now() - startTime;
        span.setAttribute('job.duration_ms', duration);

        // Check SLO
        const sloCheck = checkSLO('control_plane_health_check', duration);
        if (sloCheck.shouldAlert) {
          logger.warn('Job duration exceeded SLO', {
            jobId,
            duration,
            target: sloCheck.slo.target,
          });
        }
      }
    );

    logger.info('Background job completed', { jobId, workspaceId });
  } catch (error) {
    logger.error('Background job failed', error, { jobId, workspaceId });
    throw error;
  }
}
```

## Troubleshooting

### No traces appearing in Jaeger

1. Check OTLP endpoint: `curl http://localhost:4318/v1/traces`
2. Verify telemetry initialization in startup code
3. Check logs for export errors

### PII appearing in logs

1. Verify `ENABLE_PII_REDACTION=true`
2. Check `logger.setPIIRedaction(true)` is called
3. Test redaction: `console.log(redactPII('DNI: 12345678A'))`

### High memory usage

1. Reduce export interval: `exportIntervalMs: 30000`
2. Limit span attributes
3. Check for span leaks (spans not ended)

### Metrics not updating

1. Verify Prometheus scraping configuration
2. Check metric export interval
3. Ensure metrics are being recorded in code
