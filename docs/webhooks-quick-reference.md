# Webhooks Quick Reference

## Registering a Webhook

### Using REST API

```bash
curl -X POST https://your-instance.com/api/v1/webhooks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "url": "https://your-app.com/webhook",
    "events": ["document.processed", "workflow.completed"],
    "secret": "your-webhook-secret"
  }'
```

### Using SDK

```typescript
import { Mobius1Client, WebhookEventType } from '@mobius1/sdk';

const client = new Mobius1Client({
  baseUrl: 'https://your-instance.com',
  apiKey: 'YOUR_API_KEY',
});

const webhook = await client.webhooks.register({
  url: 'https://your-app.com/webhook',
  events: [
    WebhookEventType.DOCUMENT_PROCESSED,
    WebhookEventType.WORKFLOW_COMPLETED,
  ],
  secret: 'your-webhook-secret',
});
```

## Webhook Event Types

| Event Type | Description | Payload Example |
|------------|-------------|-----------------|
| `document.processed` | Document processing completed | `{ documentId, status, extractedData }` |
| `workflow.completed` | Workflow execution completed | `{ workflowId, executionId, result }` |
| `workflow.failed` | Workflow execution failed | `{ workflowId, executionId, error }` |
| `compliance.report_generated` | Compliance report generated | `{ reportId, format, downloadUrl }` |
| `budget.threshold_reached` | Budget threshold reached | `{ threshold, currentUsage, workspaceId }` |
| `policy.violation` | Policy violation detected | `{ violationType, details, timestamp }` |

## Receiving Webhooks

### Node.js/Express

```typescript
import express from 'express';
import crypto from 'crypto';

const app = express();
app.use(express.json());

function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

app.post('/webhook', (req, res) => {
  const signature = req.headers['x-webhook-signature'] as string;
  const payload = JSON.stringify(req.body);
  
  if (!verifySignature(payload, signature, process.env.WEBHOOK_SECRET!)) {
    return res.status(401).send('Invalid signature');
  }
  
  const { event, data } = req.body;
  
  switch (event) {
    case 'document.processed':
      console.log('Document processed:', data.documentId);
      break;
    case 'workflow.completed':
      console.log('Workflow completed:', data.workflowId);
      break;
    // Handle other events...
  }
  
  res.status(200).send('OK');
});
```

### Python/Flask

```python
import hmac
import hashlib
from flask import Flask, request

app = Flask(__name__)

def verify_signature(payload: str, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)

@app.route('/webhook', methods=['POST'])
def webhook():
    signature = request.headers.get('X-Webhook-Signature')
    payload = request.get_data(as_text=True)
    
    if not verify_signature(payload, signature, WEBHOOK_SECRET):
        return 'Invalid signature', 401
    
    data = request.json
    event = data['event']
    
    if event == 'document.processed':
        print(f"Document processed: {data['data']['documentId']}")
    elif event == 'workflow.completed':
        print(f"Workflow completed: {data['data']['workflowId']}")
    
    return 'OK', 200
```

## Webhook Headers

All webhook requests include these headers:

| Header | Description | Example |
|--------|-------------|---------|
| `Content-Type` | Always `application/json` | `application/json` |
| `X-Webhook-Signature` | HMAC-SHA256 signature | `a1b2c3d4...` |
| `X-Webhook-Event` | Event type | `document.processed` |
| `X-Webhook-Delivery-Id` | Unique delivery ID | `uuid-v4` |

## Webhook Payload Format

```json
{
  "id": "evt_1234567890",
  "event": "document.processed",
  "workspaceId": "ws_abc123",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "documentId": "doc_xyz789",
    "status": "completed",
    "extractedData": {
      "name": "John Doe",
      "documentType": "dni"
    }
  }
}
```

## Retry Behavior

- **Max Retries**: 3 attempts
- **Backoff**: Exponential (5s, 10s, 20s)
- **Timeout**: 10 seconds per attempt
- **Success**: HTTP 2xx response
- **Failure**: HTTP 4xx/5xx or timeout

## Testing Webhooks

### Test Delivery

```bash
curl -X POST https://your-instance.com/api/v1/webhooks/{webhook-id}/test \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Using SDK

```typescript
await client.webhooks.test('webhook-id');
```

### Local Testing with ngrok

```bash
# Start ngrok
ngrok http 3000

# Register webhook with ngrok URL
curl -X POST https://your-instance.com/api/v1/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-ngrok-url.ngrok.io/webhook",
    "events": ["document.processed"]
  }'
```

## Managing Webhooks

### List Webhooks

```bash
curl https://your-instance.com/api/v1/webhooks \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Delete Webhook

```bash
curl -X DELETE https://your-instance.com/api/v1/webhooks/{webhook-id} \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Best Practices

1. **Always verify signatures** - Prevents unauthorized requests
2. **Respond quickly** - Return 200 OK within 10 seconds
3. **Process asynchronously** - Queue webhook data for processing
4. **Handle duplicates** - Use delivery ID for idempotency
5. **Log failures** - Monitor webhook delivery issues
6. **Use HTTPS** - Webhook URLs must use HTTPS in production
7. **Rotate secrets** - Periodically update webhook secrets

## Troubleshooting

### Webhook Not Receiving Events

1. Check webhook is enabled
2. Verify URL is accessible from Mobius instance
3. Check event type matches registered events
4. Review webhook delivery logs

### Signature Verification Failing

1. Ensure using raw request body (not parsed JSON)
2. Verify secret matches registration
3. Check signature header name is correct
4. Use timing-safe comparison

### Timeouts

1. Respond with 200 OK immediately
2. Process webhook data asynchronously
3. Increase timeout if needed (contact support)

## Support

For webhook issues:
- Check logs: `/api/v1/webhooks/{id}/deliveries`
- Review documentation: `/docs/webhooks`
- Contact support: support@mobius1.com
