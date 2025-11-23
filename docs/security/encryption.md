# Encryption Architecture - Mobius 1 Platform

## Overview

Mobius 1 implements defense-in-depth encryption to protect sensitive PII data for Spanish gestorías and expat agencies. All encryption follows GDPR Article 32 requirements and AESIA compliance standards.

## Encryption Standards

### Algorithms

- **Symmetric Encryption**: AES-256-GCM (Galois/Counter Mode)
- **Key Derivation**: PBKDF2 with SHA-256 (100,000 iterations)
- **Hashing**: SHA-256 for content deduplication
- **Random Generation**: `crypto.randomBytes()` for cryptographically secure randomness

### Key Sizes

- **Master Encryption Key**: 32 bytes (256 bits)
- **Workspace Context**: 32 bytes (256 bits)
- **Initialization Vector (IV)**: 16 bytes (128 bits)
- **Authentication Tag**: 16 bytes (128 bits)
- **Salt**: 32 bytes (256 bits)

## Architecture

### Envelope Encryption Pattern

```
┌─────────────────────────────────────────────────────────┐
│                    Master Key (ENV)                      │
│                  ENCRYPTION_KEY (32 bytes)               │
└────────────────────┬────────────────────────────────────┘
                     │
                     ├─────────────────────────────────────┐
                     │                                     │
         ┌───────────▼──────────┐           ┌─────────────▼──────────┐
         │  Workspace Context 1  │           │  Workspace Context 2   │
         │   (32 bytes, unique)  │           │   (32 bytes, unique)   │
         └───────────┬───────────┘           └─────────────┬──────────┘
                     │                                     │
         ┌───────────▼──────────┐           ┌─────────────▼──────────┐
         │  Document Data 1     │           │  Document Data 2       │
         │  (encrypted PII)     │           │  (encrypted PII)       │
         └──────────────────────┘           └────────────────────────┘
```

### Workspace Isolation

Each workspace has a unique encryption context derived from:
- Master encryption key (from environment)
- Workspace ID (unique identifier)
- Salt (random per encryption operation)

This ensures:
1. **Data Isolation**: Workspace A cannot decrypt Workspace B's data
2. **Key Rotation**: Individual workspace keys can be rotated independently
3. **Compliance**: Spain residency mode enforced per workspace

## Column-Level Encryption

### Encrypted Fields

The following database columns contain encrypted PII:

| Table | Column | Content Type |
|-------|--------|--------------|
| `documents` | `extractedData` | DNI, NIE, passport numbers, addresses |
| `audit_events` | `metadata` | User actions with potential PII |

### Encryption Flow

```typescript
// Encryption
const plaintext = { dni: '12345678Z', name: 'Juan García' };
const workspaceContext = await keyManager.getWorkspaceContext(workspaceId);
const encrypted = encryptJSON(plaintext, workspaceContext);
// Store encrypted string in database

// Decryption
const encrypted = document.extractedData;
const workspaceContext = await keyManager.getWorkspaceContext(workspaceId);
const plaintext = decryptJSON(encrypted, workspaceContext);
```

## Key Management

### Key Rotation Policy

| Key Type | Rotation Period | Retention |
|----------|----------------|-----------|
| Workspace Keys | 90 days | 30 days |
| Master Key | 365 days | 90 days |
| Database Credentials | 30 days | 7 days |
| API Keys | 90 days | 30 days |

### Rotation Process

1. **Detection**: `KeyManager.needsRotation()` checks last rotation date
2. **Generation**: New workspace context generated
3. **Re-encryption**: All documents re-encrypted with new context
4. **Verification**: Integrity checks confirm successful re-encryption
5. **Audit**: Rotation logged to audit trail

### Key Storage

**Development**:
- Master key in `.env` file (never committed)
- Workspace contexts in PostgreSQL `workspaces.encryptionContext`

**Production**:
- Master key in HashiCorp Vault or AWS Secrets Manager
- Workspace contexts in PostgreSQL (encrypted at rest)
- Hardware Security Module (HSM) for key generation

**Air-Gapped**:
- Master key in sealed secrets with local key management
- Offline key rotation via secure media transfer

## PII Protection

### Spanish Document Types

Encrypted PII includes:

- **DNI**: Spanish national ID (e.g., `12345678Z`)
- **NIE**: Foreigner ID (e.g., `X1234567L`)
- **TIE**: Residence card numbers
- **Passport**: International passport numbers
- **Addresses**: Full Spanish addresses
- **Birth Dates**: Personal dates of birth
- **Tax IDs**: NIF, CIF for companies

### Redaction in Logs

PII is redacted **before** logging:

```typescript
// BAD - PII in logs
logger.info({ dni: '12345678Z' }, 'Document processed');

// GOOD - PII redacted
logger.info({ dni: '[REDACTED]' }, 'Document processed');
```

Fastify logger configured with redaction paths:
```typescript
redact: ['req.headers.authorization', 'req.body.password', 'req.body.dni']
```

## Content Deduplication

Documents are deduplicated using SHA-256 hashing:

```typescript
const contentHash = hashData(JSON.stringify(extractedData));
// Store hash in documents.contentHash for deduplication
// Original data encrypted and stored separately
```

This allows:
- Duplicate detection without storing plaintext
- Integrity verification on decryption
- Compliance with data minimization (GDPR Article 5)

## Security Best Practices

### DO

✅ Use workspace context for all document encryption  
✅ Rotate keys according to policy  
✅ Verify integrity after decryption  
✅ Log all encryption/decryption operations to audit trail  
✅ Use constant-time comparison for sensitive strings  

### DON'T

❌ Store plaintext PII in logs or traces  
❌ Reuse IVs or salts  
❌ Commit encryption keys to version control  
❌ Share workspace contexts between workspaces  
❌ Skip integrity verification  

## Compliance Mapping

| Requirement | Implementation |
|-------------|----------------|
| GDPR Art. 32 | AES-256-GCM encryption at rest |
| GDPR Art. 5 | Data minimization via hashing |
| AESIA Baseline | Audit trail for all key operations |
| Spain Residency | Workspace-level enforcement |

## Testing

Encryption tests cover:

- ✅ Basic encryption/decryption
- ✅ Workspace isolation
- ✅ Authentication tag verification
- ✅ Tampering detection
- ✅ Spanish PII types (DNI, NIE, passport)
- ✅ Key rotation and re-encryption
- ✅ Integrity verification

Run tests:
```bash
npm test tests/security/encryption.test.ts
```

## Troubleshooting

### Decryption Fails

**Symptom**: `Error: Unsupported state or unable to authenticate data`

**Causes**:
1. Wrong workspace context
2. Corrupted ciphertext
3. Tampered authentication tag
4. Key rotation in progress

**Solution**:
```typescript
const verification = await documentEncryption.verifyDocumentEncryption(
  documentId,
  workspaceId
);
if (!verification.valid) {
  console.error('Integrity check failed:', verification.error);
}
```

### Key Rotation Stuck

**Symptom**: Re-encryption fails for some documents

**Solution**:
```typescript
const results = await documentEncryption.reencryptWorkspaceDocuments(workspaceId);
console.log(`Reencrypted: ${results.reencrypted}, Failed: ${results.failed}`);
// Review results.errors for specific failures
```

## References

- [NIST SP 800-38D](https://csrc.nist.gov/publications/detail/sp/800-38d/final) - GCM Mode
- [GDPR Article 32](https://gdpr-info.eu/art-32-gdpr/) - Security of Processing
- [OWASP Cryptographic Storage](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
