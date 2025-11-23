# Mobius 1 Platform SDK

TypeScript/JavaScript client library for interacting with the Mobius 1 Platform API.

## Installation

```bash
npm install @mobius1/sdk
```

## Quick Start

```typescript
import { Mobius1Client } from '@mobius1/sdk';

const client = new Mobius1Client({
  baseUrl: 'https://your-mobius-instance.com',
  apiKey: 'your-api-key',
  workspaceId: 'your-workspace-id',
  timeout: 30000, // Optional, default 30s
});

// Check system health
const health = await client.health.check();
console.log(health);

// List templates
const templates = await client.templates.list();
console.log(templates.data);
```

## API Reference

### Configuration

```typescript
interface ClientConfig {
  baseUrl: string;        // Base URL of Mobius 1 instance
  apiKey?: string;        // Optional API key for authentication
  workspaceId?: string;   // Optional workspace ID
  timeout?: number;       // Request timeout in milliseconds (default: 30000)
}
```

### Health API

```typescript
// Check system health
await client.health.check();

// Check readiness
await client.health.ready();

// Get application info
await client.health.info();
```

### Document Processing API

```typescript
// Upload document
await client.documents.upload(file, { type: 'dni' });

// Classify document
await client.documents.classify('document-id');

// Extract data from document
await client.documents.extract('document-id');

// Get document details
await client.documents.get('document-id');

// List documents
await client.documents.list({ limit: 50, offset: 0 });
```

### Template & Workflow API

```typescript
// List templates
await client.templates.list();

// Get template details
await client.templates.get('template-id');

// Validate template
await client.templates.validate(templateData);

// Execute workflow
await client.workflows.execute('template-id', inputData);

// Get workflow status
await client.workflows.getStatus('execution-id');
```

### Compliance API

```typescript
// Generate compliance report
await client.compliance.generateReport({
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  format: 'json', // or 'pdf'
});

// Get report
await client.compliance.getReport('report-id');

// Export audit data
await client.compliance.exportAudit({
  startDate: '2024-01-01',
  endDate: '2024-12-31',
});
```

### Webhook API

```typescript
import { WebhookEventType } from '@mobius1/sdk';

// Register webhook
await client.webhooks.register({
  url: 'https://your-app.com/webhook',
  events: [
    WebhookEventType.DOCUMENT_PROCESSED,
    WebhookEventType.WORKFLOW_COMPLETED,
  ],
  secret: 'optional-webhook-secret',
});

// List webhooks
await client.webhooks.list();

// Delete webhook
await client.webhooks.delete('webhook-id');

// Test webhook
await client.webhooks.test('webhook-id');
```

## Webhook Events

Available webhook event types:

- `DOCUMENT_PROCESSED` - Document processing completed
- `WORKFLOW_COMPLETED` - Workflow execution completed
- `WORKFLOW_FAILED` - Workflow execution failed
- `COMPLIANCE_REPORT_GENERATED` - Compliance report generated
- `BUDGET_THRESHOLD_REACHED` - Budget threshold reached
- `POLICY_VIOLATION` - Policy violation detected

## Error Handling

All API methods return a consistent response format:

```typescript
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
  correlationId?: string;
}
```

Example error handling:

```typescript
const response = await client.templates.get('template-id');

if (response.success) {
  console.log('Template:', response.data);
} else {
  console.error('Error:', response.error?.message);
  console.error('Code:', response.error?.code);
}
```

## Webhook Signature Verification

When receiving webhooks, verify the signature:

```typescript
import crypto from 'crypto';

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// In your webhook handler
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const payload = JSON.stringify(req.body);
  
  if (!verifyWebhookSignature(payload, signature, webhookSecret)) {
    return res.status(401).send('Invalid signature');
  }
  
  // Process webhook
  console.log('Event:', req.body.event);
  console.log('Data:', req.body.data);
  
  res.status(200).send('OK');
});
```

## TypeScript Support

The SDK is written in TypeScript and includes full type definitions. All API responses are properly typed for better IDE support and type safety.

## License

MIT
