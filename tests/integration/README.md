# Integration Tests

Comprehensive integration tests for the Mobius 1 Platform API.

## Overview

The integration test suite validates:
- REST API endpoints end-to-end
- Webhook delivery and retry logic
- API client SDK functionality
- Complete workflows across multiple components
- Error handling and resilience
- Concurrent operations

## Test Structure

```
tests/integration/
├── api-endpoints.test.ts      # REST API endpoint tests
├── webhook-delivery.test.ts   # Webhook system tests
├── sdk-client.test.ts         # SDK client tests
├── end-to-end.test.ts         # Complete workflow tests
├── helpers/
│   └── test-server.ts         # Test server utilities
└── README.md                  # This file
```

## Running Tests

```bash
# Run all integration tests
npm test -- tests/integration

# Run specific test file
npm test -- tests/integration/api-endpoints.test.ts

# Run with coverage
npm run test:coverage -- tests/integration
```

## Test Categories

### 1. API Endpoints Tests (`api-endpoints.test.ts`)

Tests all REST API endpoints including:
- Health and readiness checks
- Template management
- Compliance reporting
- Error handling
- CORS and security headers

### 2. Webhook Delivery Tests (`webhook-delivery.test.ts`)

Tests webhook system functionality:
- Webhook registration
- Delivery with retry logic
- Exponential backoff
- Signature verification
- Timeout handling
- Cleanup on shutdown

### 3. SDK Client Tests (`sdk-client.test.ts`)

Tests the Mobius1Client SDK:
- Health API
- Template API
- Webhook API
- Compliance API
- Error handling
- Authentication
- Request configuration

### 4. End-to-End Tests (`end-to-end.test.ts`)

Tests complete workflows:
- Template validation and execution
- Webhook registration and testing
- Compliance report generation
- System health monitoring
- Error recovery
- Concurrent operations
- Response consistency

## Test Helpers

### TestServer

Utility class for creating test server instances:

```typescript
import { TestServer } from './helpers/test-server';

const testServer = new TestServer();
const baseUrl = await testServer.start();

// Use the test server
const response = await testServer.inject({
  method: 'GET',
  url: '/health',
});

// Clean up
await testServer.stop();
```

## Writing New Integration Tests

### Basic Structure

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestServer } from './helpers/test-server';
import { Mobius1Client } from '../../src/sdk/client';

describe('My Integration Test', () => {
  let testServer: TestServer;
  let client: Mobius1Client;

  beforeAll(async () => {
    testServer = new TestServer();
    const baseUrl = await testServer.start();
    client = new Mobius1Client({ baseUrl });
  });

  afterAll(async () => {
    await testServer.stop();
  });

  it('should test something', async () => {
    const response = await client.health.check();
    expect(response.success).toBe(true);
  });
});
```

### Testing Webhooks

```typescript
import { vi } from 'vitest';
import { WebhookService } from '../../src/webhooks/service';

// Mock fetch for webhook testing
global.fetch = vi.fn();

it('should deliver webhook', async () => {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    status: 200,
  } as Response);

  await webhookService.triggerWebhook(
    'workspace-id',
    WebhookEventType.DOCUMENT_PROCESSED,
    { data: 'test' }
  );

  expect(fetch).toHaveBeenCalled();
});
```

## Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Cleanup**: Always clean up resources in `afterAll` or `afterEach`
3. **Mocking**: Mock external services (MinIO, Redis) when appropriate
4. **Assertions**: Use specific assertions rather than generic ones
5. **Error Cases**: Test both success and failure scenarios
6. **Timeouts**: Set appropriate timeouts for async operations
7. **Concurrency**: Test concurrent operations to catch race conditions

## Troubleshooting

### Tests Timing Out

Increase timeout in test configuration:

```typescript
it('should complete long operation', async () => {
  // Test code
}, 30000); // 30 second timeout
```

### Database Connection Issues

Ensure PostgreSQL is running:

```bash
docker-compose up -d postgres
```

### Port Conflicts

TestServer uses random ports by default. If you need a specific port:

```typescript
await testServer.start({ port: 3001 });
```

## Coverage Goals

- **API Endpoints**: 100% of routes tested
- **Webhook System**: All delivery scenarios covered
- **SDK Client**: All methods tested
- **Error Handling**: All error codes validated
- **Integration Flows**: Key workflows end-to-end

## CI/CD Integration

Integration tests run automatically on:
- Pull requests
- Main branch commits
- Release tags

Tests must pass before merging to main.

## Related Documentation

- [API Documentation](../../docs/api/README.md)
- [SDK Documentation](../../src/sdk/README.md)
- [Webhook Documentation](../../docs/webhooks.md)
- [Testing Strategy](../../docs/testing-strategy.md)
