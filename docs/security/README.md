# Security Documentation - Mobius 1 Platform

## Overview

Mobius 1 implements comprehensive security controls to protect sensitive PII data for Spanish gestorías and expat agencies. This documentation covers encryption, TLS, key management, and compliance requirements.

## Quick Start

### Development Setup

1. **Generate encryption keys**:
```bash
# Generate compliance signing keys
npm run security:generate-keys

# Generate TLS certificates (development only)
npm run security:generate-certs
```

2. **Configure environment**:
```bash
cp .env.example .env
# Edit .env and set:
# - JWT_SECRET (min 32 chars)
# - ENCRYPTION_KEY (exactly 32 chars)
# - TLS_ENABLED=true (optional for dev)
```

3. **Run security tests**:
```bash
npm test tests/security/
```

## Security Components

### 1. Encryption Service

**Purpose**: AES-256-GCM encryption for PII data with workspace isolation

**Key Features**:
- Column-level encryption for sensitive database fields
- Workspace-specific encryption contexts
- Content deduplication via SHA-256 hashing
- Authenticated encryption with GCM mode

**Documentation**: [encryption.md](./encryption.md)

**Usage**:
```typescript
import { encrypt, decrypt, encryptJSON, decryptJSON } from './security/encryption.js';

// Encrypt sensitive data
const encrypted = encryptJSON({ dni: '12345678Z' }, workspaceContext);

// Decrypt when needed
const decrypted = decryptJSON(encrypted, workspaceContext);
```

### 2. TLS Configuration

**Purpose**: TLS 1.3 enforcement for encrypted communications

**Key Features**:
- TLS 1.3 minimum version
- NIST-recommended cipher suites
- Mutual TLS (mTLS) support
- Certificate validation

**Documentation**: [tls-setup.md](./tls-setup.md)

**Usage**:
```bash
# Development
npm run security:generate-certs
TLS_ENABLED=true npm run dev

# Production
TLS_ENABLED=true
TLS_CERT_PATH=/etc/letsencrypt/live/domain/fullchain.pem
TLS_KEY_PATH=/etc/letsencrypt/live/domain/privkey.pem
```

### 3. Key Manager

**Purpose**: Encryption key lifecycle and rotation management

**Key Features**:
- Workspace-specific key derivation
- Automated rotation detection
- Key usage auditing
- Re-encryption after rotation

**Usage**:
```typescript
import { KeyManager } from './security/key-manager.js';

const keyManager = new KeyManager(db);

// Check if rotation needed
const needsRotation = await keyManager.needsRotation(workspaceId);

// Rotate key
if (needsRotation) {
  await keyManager.rotateWorkspaceKey(workspaceId);
}
```

### 4. Secrets Manager

**Purpose**: Secure credential storage and rotation

**Key Features**:
- API key generation
- Database password generation
- Rotation scheduling
- Audit trail

**Usage**:
```typescript
import { SecretsManager } from './security/secrets.js';

const secretsManager = new SecretsManager();

// Generate and store API key
const apiKey = secretsManager.generateAPIKey();
secretsManager.storeSecret('api-key', apiKey);

// Check rotation status
const audit = secretsManager.auditSecrets();
```

### 5. Document Encryption Service

**Purpose**: Column-level encryption for document PII

**Key Features**:
- Workspace-isolated encryption
- Integrity verification
- Bulk re-encryption
- Content hash validation

**Usage**:
```typescript
import { DocumentEncryptionService } from './security/document-encryption.js';

const docEncryption = new DocumentEncryptionService(db, keyManager);

// Encrypt document data
const { encrypted, contentHash } = await docEncryption.encryptDocumentData(
  workspaceId,
  extractedData
);

// Decrypt document data
const decrypted = await docEncryption.decryptDocumentData(
  workspaceId,
  encrypted
);
```

## Security Policies

### Key Rotation Schedule

| Key Type | Rotation Period | Retention |
|----------|----------------|-----------|
| Workspace Keys | 90 days | 30 days |
| Master Key | 365 days | 90 days |
| Database Credentials | 30 days | 7 days |
| API Keys | 90 days | 30 days |

### Encryption Standards

- **Algorithm**: AES-256-GCM
- **Key Derivation**: PBKDF2-SHA256 (100,000 iterations)
- **Random Generation**: `crypto.randomBytes()`
- **Hashing**: SHA-256

### TLS Requirements

- **Minimum Version**: TLS 1.3
- **Cipher Suites**: NIST-recommended only
- **Certificate Key Size**: 4096-bit RSA
- **Certificate Validity**: Maximum 397 days

## Compliance Mapping

| Requirement | Implementation | Documentation |
|-------------|----------------|---------------|
| GDPR Art. 32 | AES-256-GCM encryption | [encryption.md](./encryption.md) |
| GDPR Art. 5 | Data minimization via hashing | [encryption.md](./encryption.md) |
| AESIA Baseline | Audit trail for key operations | [encryption.md](./encryption.md) |
| Spain Residency | Workspace-level enforcement | [encryption.md](./encryption.md) |
| TLS 1.3 | Enforced in production | [tls-setup.md](./tls-setup.md) |

## Testing

### Run All Security Tests

```bash
npm test tests/security/
```

### Individual Test Suites

```bash
# Encryption tests
npm test tests/security/encryption.test.ts

# Key manager tests
npm test tests/security/key-manager.test.ts

# Secrets manager tests
npm test tests/security/secrets.test.ts

# TLS configuration tests
npm test tests/security/tls.test.ts
```

### Coverage Requirements

- **Target**: ≥80% code coverage
- **Critical Paths**: 100% coverage for encryption/decryption
- **Edge Cases**: Authentication tag tampering, wrong workspace context

## Security Checklist

### Development

- [ ] `.env` file created with secure values
- [ ] Encryption key is exactly 32 characters
- [ ] JWT secret is at least 32 characters
- [ ] TLS certificates generated (if testing HTTPS)
- [ ] Security tests passing

### Production

- [ ] Master encryption key stored in Vault/Secrets Manager
- [ ] TLS 1.3 enabled with valid certificates
- [ ] Certificate auto-renewal configured
- [ ] Key rotation schedule configured
- [ ] Audit logging enabled
- [ ] PII redaction enabled in logs
- [ ] Spain residency mode enabled (if required)
- [ ] Security audit completed

### Air-Gapped

- [ ] Offline bundle generated and signed
- [ ] Trust chain certificates included
- [ ] Network isolation verified
- [ ] Offline update mechanism tested
- [ ] Local key management configured

## Troubleshooting

### Common Issues

1. **Decryption fails**: Check workspace context matches encryption context
2. **TLS handshake fails**: Verify certificate validity and TLS 1.3 support
3. **Key rotation stuck**: Review re-encryption errors in audit log
4. **Certificate expired**: Renew certificate and restart platform

### Debug Mode

Enable detailed security logging:

```bash
LOG_LEVEL=debug npm run dev
```

### Audit Trail

All security operations are logged to `audit_events` table:

```sql
SELECT * FROM audit_events 
WHERE event_type IN ('PII_REDACTION', 'POLICY_VIOLATION')
ORDER BY timestamp DESC 
LIMIT 100;
```

## Best Practices

### DO

✅ Rotate keys according to schedule  
✅ Use workspace context for all document encryption  
✅ Verify integrity after decryption  
✅ Enable TLS 1.3 in production  
✅ Monitor certificate expiration  
✅ Audit key usage regularly  

### DON'T

❌ Commit secrets to version control  
❌ Store plaintext PII in logs  
❌ Reuse IVs or salts  
❌ Skip certificate validation  
❌ Use self-signed certificates in production  
❌ Share workspace contexts between workspaces  

## References

- [NIST Cryptographic Standards](https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines)
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [GDPR Article 32](https://gdpr-info.eu/art-32-gdpr/)
- [TLS 1.3 RFC 8446](https://datatracker.ietf.org/doc/html/rfc8446)
- [AESIA Compliance Guidelines](https://www.aesia.gob.es/)

## Support

For security issues or questions:

1. Review this documentation
2. Check troubleshooting section
3. Review audit logs
4. Contact security team

**Security Vulnerabilities**: Report privately to security team, do not create public issues.
