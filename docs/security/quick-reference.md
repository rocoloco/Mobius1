# Security Quick Reference - Mobius 1 Platform

## 🔐 Encryption

### Encrypt Data
```typescript
import { encryptJSON, decryptJSON } from './security/encryption.js';

// Encrypt
const encrypted = encryptJSON(data, workspaceContext);

// Decrypt
const decrypted = decryptJSON(encrypted, workspaceContext);
```

### Hash Content
```typescript
import { hashData } from './security/encryption.js';

const hash = hashData(JSON.stringify(data)); // SHA-256
```

### Generate Token
```typescript
import { generateSecureToken } from './security/encryption.js';

const token = generateSecureToken(32); // 64 hex chars
```

## 🔑 Key Management

### Check Rotation
```typescript
const keyManager = new KeyManager(db);
const needsRotation = await keyManager.needsRotation(workspaceId);
```

### Rotate Key
```typescript
await keyManager.rotateWorkspaceKey(workspaceId);
```

### Audit Keys
```typescript
const audit = await keyManager.auditKeyUsage(workspaceId);
console.log(`Days since rotation: ${audit.daysSinceRotation}`);
```

## 🔒 Document Encryption

### Encrypt Document
```typescript
const docEncryption = new DocumentEncryptionService(db, keyManager);

const { encrypted, contentHash } = await docEncryption.encryptDocumentData(
  workspaceId,
  extractedData
);
```

### Verify Integrity
```typescript
const verification = await docEncryption.verifyDocumentEncryption(
  documentId,
  workspaceId
);

if (!verification.valid) {
  console.error(verification.error);
}
```

### Re-encrypt After Rotation
```typescript
const results = await docEncryption.reencryptWorkspaceDocuments(workspaceId);
console.log(`Success: ${results.reencrypted}, Failed: ${results.failed}`);
```

## 🔐 Secrets Management

### Generate Credentials
```typescript
const secretsManager = new SecretsManager();

const apiKey = secretsManager.generateAPIKey();
const dbPassword = secretsManager.generateDatabasePassword();
const encKey = secretsManager.generateEncryptionKey();
```

### Store Secret
```typescript
secretsManager.storeSecret('api-key', apiKey, {
  version: 1,
  createdAt: new Date(),
});
```

### Check Rotation
```typescript
const needsRotation = secretsManager.needsRotation('api-key', 'apiKeys');
```

### Audit Secrets
```typescript
const audit = secretsManager.auditSecrets();
console.log(`Total: ${audit.total}, Needs rotation: ${audit.needsRotation}`);
```

## 🌐 TLS Configuration

### Development
```bash
npm run security:generate-certs
TLS_ENABLED=true npm run dev
```

### Production
```bash
# .env
TLS_ENABLED=true
TLS_CERT_PATH=/path/to/cert.pem
TLS_KEY_PATH=/path/to/key.pem
```

### Verify TLS
```bash
openssl s_client -connect localhost:3000 -tls1_3
```

## 📋 Environment Variables

### Required
```bash
JWT_SECRET=your-secret-min-32-chars
ENCRYPTION_KEY=exactly-32-characters-here!
```

### Optional (TLS)
```bash
TLS_ENABLED=true
TLS_CERT_PATH=./certs/server.crt
TLS_KEY_PATH=./certs/server.key
TLS_CA_PATH=./certs/ca.crt
```

### Optional (Compliance)
```bash
COMPLIANCE_PRIVATE_KEY_PATH=./keys/compliance-private.pem
COMPLIANCE_PUBLIC_KEY_PATH=./keys/compliance-public.pem
```

## 🧪 Testing

### Run All Security Tests
```bash
npm test tests/security/
```

### Individual Tests
```bash
npm test tests/security/encryption.test.ts
npm test tests/security/key-manager.test.ts
npm test tests/security/secrets.test.ts
npm test tests/security/tls.test.ts
```

## 🔍 Debugging

### Enable Debug Logging
```bash
LOG_LEVEL=debug npm run dev
```

### Check Audit Trail
```sql
SELECT * FROM audit_events 
WHERE event_type = 'PII_REDACTION'
ORDER BY timestamp DESC;
```

## ⚠️ Common Errors

### "Decryption failed"
- Check workspace context matches
- Verify data not corrupted
- Ensure key not rotated mid-operation

### "Certificate not found"
- Run `npm run security:generate-certs`
- Check file paths in `.env`
- Verify file permissions (600 for keys)

### "Key rotation stuck"
- Check re-encryption errors
- Verify database connectivity
- Review audit logs

## 📊 Rotation Schedule

| Type | Period | Command |
|------|--------|---------|
| Workspace Keys | 90 days | `keyManager.rotateWorkspaceKey()` |
| Master Key | 365 days | Update `ENCRYPTION_KEY` + re-encrypt |
| DB Credentials | 30 days | `secretsManager.rotateSecret()` |
| API Keys | 90 days | `secretsManager.rotateSecret()` |

## ✅ Security Checklist

### Development
- [ ] `.env` configured
- [ ] Keys generated
- [ ] Tests passing

### Production
- [ ] TLS 1.3 enabled
- [ ] Valid certificates
- [ ] Key rotation scheduled
- [ ] Audit logging enabled
- [ ] PII redaction enabled

## 🆘 Emergency Procedures

### Suspected Key Compromise
1. Rotate affected key immediately
2. Re-encrypt all data
3. Audit access logs
4. Notify security team

### Certificate Expired
1. Renew certificate
2. Update `.env` paths
3. Restart platform
4. Verify with `openssl s_client`

### Data Integrity Issue
1. Run integrity verification
2. Check audit logs
3. Restore from backup if needed
4. Investigate root cause
