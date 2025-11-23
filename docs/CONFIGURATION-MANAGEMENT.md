# Configuration Management Guide

## Overview

Mobius 1 Platform uses a multi-layered configuration management system with:

- **Environment-specific configurations** (dev, staging, production)
- **Secrets management** with automated rotation
- **Configuration validation** before deployment
- **Hot-reload capability** for non-critical settings

## Configuration Files

### Environment Variables (.env)

Core secrets and connection strings stored in `.env`:

```bash
# Security
JWT_SECRET=your-secret-key-min-32-chars
ENCRYPTION_KEY=32-character-hex-string

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# Redis
REDIS_URL=redis://localhost:6379

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# Qdrant
QDRANT_URL=http://localhost:6333
```

### Environment Configurations (config/)

Environment-specific settings in `config/{environment}.json`:

```json
{
  "environment": "production",
  "features": {
    "aiCopilot": true,
    "documentProcessing": true
  },
  "limits": {
    "maxWorkspaces": 1000,
    "maxApiRequestsPerMinute": 5000
  },
  "security": {
    "strictMode": true,
    "sessionTimeout": 1800
  }
}
```

## Secrets Management

### Secrets Rotation

Automated rotation with configurable policies:

```bash
# Check rotation status
npm run secrets:rotate status

# Manually rotate a secret
npm run secrets:rotate rotate JWT_SECRET

# Check which secrets need rotation
npm run secrets:rotate check
```

### Rotation Policies

Default rotation intervals:

- **JWT_SECRET**: 90 days (manual approval required)
- **ENCRYPTION_KEY**: 180 days (manual approval required)
- **MINIO_SECRET_KEY**: 90 days (auto-rotate)

### Generating Secrets

```bash
# Generate compliance signing keys
npm run security:generate-keys

# Generate TLS certificates
npm run security:generate-certs

# Generate random secret
openssl rand -base64 32

# Generate encryption key (32 chars)
openssl rand -hex 16
```

## Configuration Validation

### Pre-Deployment Validation

Run before deployment to catch configuration errors:

```bash
npm run config:validate
```

Validates:
- ✅ Security configuration (JWT, encryption, TLS)
- ✅ Database connection strings
- ✅ Redis configuration
- ✅ MinIO credentials and SSL
- ✅ Qdrant endpoints
- ✅ Compliance keys and retention
- ✅ Runtime backend configuration
- ✅ Secrets presence and strength

### Validation Output

```
🔍 Validating Mobius 1 Configuration...

❌ Configuration Errors:

[CRITICAL] security: JWT_SECRET must be at least 32 characters
   Fix: Generate a strong secret: openssl rand -base64 32

⚠️  Configuration Warnings:

[security] TLS is not enabled in production
   Recommendation: Enable TLS for production deployments

────────────────────────────────────────────────────────
❌ Configuration validation failed!
   Errors: 1
   Warnings: 1
```

## Environment-Specific Configuration

### Development

```json
{
  "limits": {
    "maxWorkspaces": 10,
    "maxApiRequestsPerMinute": 100
  },
  "security": {
    "strictMode": false,
    "sessionTimeout": 7200
  },
  "observability": {
    "logLevel": "debug",
    "samplingRate": 1.0
  }
}
```

### Production

```json
{
  "limits": {
    "maxWorkspaces": 1000,
    "maxApiRequestsPerMinute": 5000
  },
  "security": {
    "strictMode": true,
    "sessionTimeout": 1800
  },
  "observability": {
    "logLevel": "warn",
    "samplingRate": 0.1
  }
}
```

## Hot-Reload Configuration

Update configuration without restart:

```typescript
import { createEnvironmentManager } from './config/environment-manager';

const envManager = createEnvironmentManager();
await envManager.initialize();

// Update configuration
await envManager.updateConfig({
  limits: {
    maxApiRequestsPerMinute: 10000
  }
});

// Watch for changes
envManager.watch((config) => {
  console.log('Configuration updated:', config);
});
```

## Deployment Integration

Configuration validation is integrated into deployment scripts:

```bash
# Bash deployment
./scripts/deploy.sh

# PowerShell deployment
./scripts/deploy.ps1
```

Deployment flow:
1. ✅ Validate prerequisites
2. ✅ Validate environment configuration
3. ✅ Check secrets rotation status
4. ✅ Verify Docker daemon
5. 🚀 Start deployment

## Security Best Practices

### Never Commit Secrets

`.gitignore` excludes:
- `.env` files
- `keys/` directory
- `certs/` directory
- `.secrets/` directory
- `*.pem`, `*.key`, `*.crt` files

### Production Checklist

- [ ] Change default credentials (database, MinIO, Redis)
- [ ] Generate strong JWT_SECRET (≥32 chars)
- [ ] Generate encryption key (32 chars)
- [ ] Enable TLS for all services
- [ ] Generate compliance signing keys
- [ ] Set audit retention to 2555 days (7 years)
- [ ] Configure Spain residency mode if required
- [ ] Enable PII redaction in logs
- [ ] Set strict security mode
- [ ] Configure allowed origins (no wildcards)
- [ ] Reduce session timeout (≤30 minutes)
- [ ] Limit login attempts (≤3)

### Secrets Storage

**Development:**
- Store in `.env` file (gitignored)
- Use file-based secrets in `keys/` directory

**Production:**
- Use external secrets manager (HashiCorp Vault, AWS Secrets Manager)
- Mount secrets as files or environment variables
- Enable automated rotation
- Implement secret versioning

## Troubleshooting

### Configuration Validation Fails

```bash
# Run validation to see specific errors
npm run config:validate

# Check environment variables
cat .env

# Verify secrets exist
ls -la keys/
```

### Secrets Rotation Issues

```bash
# Check rotation status
npm run secrets:rotate status

# View audit logs
# Check src/audit logs for rotation events
```

### Missing Configuration Files

```bash
# Create from example
cp .env.example .env

# Generate default environment config
# Will be created automatically on first run
```

## API Reference

### SecretsManager

```typescript
import { secretsManager } from './config/secrets-manager';

// Initialize
await secretsManager.initialize();

// Get secret
const secret = await secretsManager.getSecret('JWT_SECRET', userId, workspaceId);

// Set secret
await secretsManager.setSecret('API_KEY', 'value', userId, workspaceId, 90);

// Rotate secret
await secretsManager.rotateSecret('JWT_SECRET', userId, workspaceId);

// Schedule rotation
secretsManager.scheduleRotation('JWT_SECRET', 90, userId, workspaceId);
```

### EnvironmentManager

```typescript
import { createEnvironmentManager } from './config/environment-manager';

const envManager = createEnvironmentManager('production');
await envManager.initialize();

// Get configuration
const config = envManager.getConfig();

// Update configuration
await envManager.updateConfig({ limits: { maxWorkspaces: 2000 } });

// Validate configuration
const result = envManager.validate(config);
```

### ConfigValidator

```typescript
import { configValidator, validateOrThrow } from './config/validator';

// Validate and get results
const result = await configValidator.validate();
console.log(result.errors, result.warnings);

// Validate and throw on error
await validateOrThrow();
```

## Compliance Notes

### Spain Residency Mode

When `SPAIN_RESIDENCY_MODE=true`:
- All data must remain in Spain-only infrastructure
- PII redaction is enforced in logs and traces
- Audit events track all data access

### GDPR Requirements

- Audit retention: 7 years (2555 days)
- PII redaction in logs
- Data lineage tracking
- Right to erasure support

### AESIA Compliance

- Digital signing of audit packages
- Deterministic export generation
- Integrity verification
- Model decision logging
