# Mobius 1 Platform API Documentation

## Overview

The Mobius 1 Platform provides a comprehensive REST API for managing AI-powered document processing, workflow automation, and compliance reporting for Spanish gestorías and expat agencies.

**Base URL**: `https://api.mobius1.example.com/api/v1`  
**API Version**: v1  
**Authentication**: Bearer JWT tokens  
**Documentation**: Available at `/docs` (Swagger UI)

## Quick Start

### 1. Authentication

```bash
# Login to get JWT token
curl -X POST https://api.mobius1.example.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "your-password"
  }'

# Response
{
  "success": true,
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "workspaceId": "workspace-456",
    "roles": ["admin"]
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 2. Make Authenticated Requests

```bash
# Use token in Authorization header
curl -X GET https://api.mobius1.example.com/api/v1/documents \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## API Features

### ✅ Versioning

- **Current Version**: v1
- **URL Pattern**: `/api/v1/*`
- **Version Header**: `X-API-Version: v1`

### ✅ Error Handling

All errors follow a standard format:

```json
{
  "code": "E001",
  "message": "Validation error",
  "details": {
    "field": "email",
    "reason": "Invalid format"
  },
  "correlationId": "abc-123",
  "timestamp": "2024-01-15T10:30:00Z",
  "path": "/api/v1/users"
}
```

**Error Codes**:
- `E001-E099`: Validation errors (400)
- `E100-E199`: Policy violations (403)
- `E200-E299`: Resource errors (404, 409)
- `E300-E399`: Authentication/Authorization (401, 403)
- `E400-E499`: Rate limiting (429)
- `E500-E599`: System errors (500, 503)
- `E600-E699`: Processing errors (422)

### ✅ Pagination

All list endpoints support pagination:

```bash
# Using limit and offset
GET /api/v1/documents?limit=50&offset=100

# Using page number
GET /api/v1/documents?limit=50&page=3
```

**Response**:
```json
{
  "success": true,
  "data": [...],
  "meta": {
    "total": 250,
    "limit": 50,
    "offset": 100,
    "page": 3,
    "totalPages": 5,
    "hasMore": true,
    "hasPrevious": true
  }
}
```

### ✅ Rate Limiting

- **Default**: 100 requests per minute per IP
- **Headers**:
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Requests remaining
  - `X-RateLimit-Reset`: Time when limit resets

**Rate Limit Exceeded**:
```json
{
  "success": false,
  "error": {
    "code": "E400",
    "message": "Rate limit exceeded",
    "details": {
      "limit": 100,
      "window": "1 minute",
      "retryAfter": 45
    }
  }
}
```

### ✅ Idempotency

For safe retries on POST/PUT/PATCH/DELETE:

```bash
curl -X POST https://api.mobius1.example.com/api/v1/documents/upload \
  -H "Authorization: Bearer TOKEN" \
  -H "Idempotency-Key: unique-key-123" \
  -F "document=@file.pdf"
```

- Same `Idempotency-Key` returns cached response
- Keys must be 16-255 characters
- Keys expire after 24 hours

### ✅ Correlation IDs

Every request gets a correlation ID for tracing:

```bash
# Provide your own
curl -H "X-Correlation-ID: my-trace-id" ...

# Or one is generated automatically
# Response includes: X-Correlation-ID: abc-123-def-456
```

### ✅ CORS

- **Development**: All origins allowed
- **Production**: Whitelist specific domains
- **Credentials**: Supported
- **Methods**: GET, POST, PUT, PATCH, DELETE, OPTIONS

### ✅ Security Headers

- **Helmet**: Security headers enabled
- **HSTS**: Strict-Transport-Security enforced
- **CSP**: Content-Security-Policy configured
- **X-Frame-Options**: DENY
- **X-Content-Type-Options**: nosniff

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Login and get JWT token |
| POST | `/auth/logout` | Logout current session |
| POST | `/auth/refresh` | Refresh JWT token |
| GET | `/auth/profile` | Get current user profile |
| POST | `/auth/validate` | Validate JWT token |

### Documents (PipesHub)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/documents/upload` | Upload document for processing |
| GET | `/api/v1/documents` | List documents with filtering |
| GET | `/api/v1/documents/:id` | Get document by ID |
| DELETE | `/api/v1/documents/:id` | Delete document |
| POST | `/api/v1/documents/:id/reprocess` | Reprocess document |
| GET | `/api/v1/documents/stats` | Get processing statistics |

### Templates & Workflows

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/templates` | List all templates |
| GET | `/api/v1/templates/:id` | Get template by ID |
| GET | `/api/v1/templates/category/:category` | Get templates by category |
| GET | `/api/v1/templates/search?q=query` | Search templates |
| POST | `/api/v1/templates/validate` | Validate data against template |
| POST | `/api/v1/executions` | Start workflow execution |
| GET | `/api/v1/executions/:id` | Get execution status |
| DELETE | `/api/v1/executions/:id` | Cancel execution |
| GET | `/api/v1/executions/:id/metrics` | Get execution metrics |

### Spanish Forms

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/forms/modelo-303/process` | Process Modelo 303 VAT return |
| POST | `/api/v1/forms/modelo-303/generate` | Generate Modelo 303 form |
| POST | `/api/v1/forms/nie-tie/process` | Process NIE/TIE application |
| POST | `/api/v1/forms/nie-tie/generate` | Generate NIE/TIE form |
| POST | `/api/v1/forms/:type/validate-completeness` | Validate form completeness |
| GET | `/api/v1/forms/statistics/:workspaceId` | Get processing statistics |

### Runtime (AI Models)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/runtime/models` | Load AI model |
| GET | `/api/v1/runtime/models` | List loaded models |
| GET | `/api/v1/runtime/models/:id/metrics` | Get model metrics |
| DELETE | `/api/v1/runtime/models/:id` | Unload model |
| POST | `/api/v1/runtime/inference` | Execute inference |
| GET | `/api/v1/runtime/health` | Runtime health check |

### Compliance

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/compliance/audit-package` | Generate AESIA audit package |
| POST | `/api/v1/compliance/export` | Export compliance report |
| POST | `/api/v1/compliance/verify` | Verify audit package integrity |
| GET | `/api/v1/compliance/reports` | List compliance reports |
| GET | `/api/v1/compliance/reports/:id` | Get specific report |
| POST | `/api/v1/compliance/data-lineage` | Generate data lineage report |

### Health & Monitoring

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Comprehensive system health |
| GET | `/ready` | Readiness probe |
| GET | `/info` | Application info |
| GET | `/control-plane/status` | Control plane status |
| POST | `/control-plane/health-check` | Manual health check |

## Response Format

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "meta": {
    // Metadata (pagination, etc.)
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "correlationId": "abc-123"
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "E001",
    "message": "Error description",
    "details": {},
    "correlationId": "abc-123",
    "timestamp": "2024-01-15T10:30:00Z",
    "path": "/api/v1/endpoint"
  }
}
```

## Best Practices

### DO ✅

- Include `Authorization` header with Bearer token
- Use `Idempotency-Key` for safe retries
- Provide `X-Correlation-ID` for request tracing
- Handle rate limiting with exponential backoff
- Check `X-RateLimit-*` headers
- Validate responses against OpenAPI schema
- Use pagination for large datasets
- Handle errors gracefully

### DON'T ❌

- Hardcode API tokens in code
- Ignore rate limit headers
- Skip error handling
- Make requests without authentication
- Exceed rate limits
- Store sensitive data in logs
- Use GET for mutations
- Skip idempotency keys for critical operations

## Code Examples

### JavaScript/TypeScript

```typescript
// Login
const response = await fetch('https://api.mobius1.example.com/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password'
  })
});

const { token } = await response.json();

// Upload document
const formData = new FormData();
formData.append('document', file);

const uploadResponse = await fetch('https://api.mobius1.example.com/api/v1/documents/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Idempotency-Key': crypto.randomUUID()
  },
  body: formData
});
```

### Python

```python
import requests

# Login
response = requests.post(
    'https://api.mobius1.example.com/auth/login',
    json={'email': 'user@example.com', 'password': 'password'}
)
token = response.json()['token']

# List documents
headers = {'Authorization': f'Bearer {token}'}
response = requests.get(
    'https://api.mobius1.example.com/api/v1/documents',
    headers=headers,
    params={'limit': 50, 'page': 1}
)
documents = response.json()['data']
```

### cURL

```bash
# Login
TOKEN=$(curl -s -X POST https://api.mobius1.example.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}' \
  | jq -r '.token')

# Upload document
curl -X POST https://api.mobius1.example.com/api/v1/documents/upload \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -F "document=@document.pdf"
```

## OpenAPI Specification

Full OpenAPI 3.0 specification available at:
- **Swagger UI**: `https://api.mobius1.example.com/docs`
- **JSON**: `https://api.mobius1.example.com/docs/json`
- **YAML**: `https://api.mobius1.example.com/docs/yaml`

## Support

- **Documentation**: https://docs.mobius1.example.com
- **API Status**: https://status.mobius1.example.com
- **Support Email**: support@mobius1.example.com

## Changelog

### v1.0.0 (2024-01-15)
- Initial API release
- Authentication endpoints
- Document processing (PipesHub)
- Template & workflow management
- Spanish form automation
- AI model runtime
- Compliance reporting
- OpenAPI documentation
- Rate limiting
- Idempotency support
