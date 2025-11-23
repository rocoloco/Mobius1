# Air-Gapped Deployment Guide

## Overview

Mobius 1 Platform supports air-gapped deployment mode for high-security environments requiring complete network isolation. This mode ensures:

- **Network Isolation**: All external network traffic blocked
- **Offline Updates**: Secure update mechanism without internet access
- **Integrity Verification**: System integrity checks without external CAs
- **Audit Trail**: Complete logging of all network attempts and system changes

## Features

### Network Isolation
- Blocks all external network connections
- Allowlist for internal services only
- DNS resolution blocking
- Real-time monitoring of connection attempts

### Offline Updates
- Cryptographically signed update packages
- Checksum verification
- Rollback capability
- Version tracking

### Integrity Verification
- File integrity checking
- Self-signed certificate validation
- Tamper detection
- Periodic integrity scans

## Configuration

### Environment Variables

Add to `.env`:

```bash
# Enable air-gapped mode
AIRGAP_MODE=true

# Enable network isolation
AIRGAP_NETWORK_ISOLATION=true

# Enable integrity checks
AIRGAP_INTEGRITY_CHECKS=true
```

### Allowed Hosts

Configure allowed internal hosts in air-gap configuration:

```typescript
{
  allowedHosts: [
    'localhost',
    '127.0.0.1',
    '::1',
    '*.local',
    '10.*',          // Private network
    '172.16.*',      // Private network
    '192.168.*'      // Private network
  ],
  allowedPorts: [
    5432,  // PostgreSQL
    6379,  // Redis
    9000,  // MinIO
    6333,  // Qdrant
    3000   // Application
  ]
}
```

## CLI Commands

### Status Check

```bash
npm run airgap:control status
```

Output:
```
📊 Air-Gap Status:

✅ Air-Gap Mode: ENABLED
✅ Network Isolated: YES
✅ Integrity Verified: YES
📦 Current Version: 0.0.1
🚫 Blocked Attempts: 0
🔍 Last Integrity Check: 2024-01-15T10:30:00.000Z
```

### Enable Air-Gapped Mode

```bash
npm run airgap:control enable
```

This will:
1. Enable network isolation
2. Block external connections
3. Initialize integrity verifier
4. Start periodic integrity checks

### Disable Air-Gapped Mode

```bash
npm run airgap:control disable
```

⚠️ **Warning**: Only disable in secure environments!

### Check System Integrity

```bash
npm run airgap:control check
```

Verifies:
- File checksums
- File sizes
- Missing files
- Unauthorized modifications

### View Blocked Attempts

```bash
npm run airgap:control blocked
```

Shows recent blocked network connection attempts with:
- Timestamp
- Target host and port
- Block reason

## Offline Updates

### Creating Update Package

1. **Prepare update files**:
```bash
mkdir -p updates/v1.0.1
```

2. **Generate integrity manifest**:
```bash
npm run airgap:control generate-manifest src/ dist/
```

3. **Create update package** (JSON format):
```json
{
  "version": "1.0.1",
  "timestamp": "2024-01-15T10:00:00.000Z",
  "files": [
    {
      "path": "src/index.ts",
      "content": "...",
      "checksum": "sha256-hash"
    }
  ],
  "signature": "base64-signature",
  "checksum": "package-checksum"
}
```

4. **Sign package** with private key:
```bash
openssl dgst -sha256 -sign keys/update-private.pem \
  -out updates/v1.0.1.sig updates/v1.0.1.json
```

### Applying Update

1. **Transfer package** to air-gapped system (USB, secure transfer)

2. **Apply update**:
```bash
npm run airgap:control update ./updates/v1.0.1.json
```

3. **Verify integrity**:
```bash
npm run airgap:control check
```

4. **Restart services**:
```bash
npm run docker:down
npm run docker:up
```

### Rollback

If update fails:

```bash
npm run airgap:control rollback
```

This restores the previous version from backup.

## Security Best Practices

### Pre-Deployment

- [ ] Generate update signing keys
- [ ] Create initial integrity manifest
- [ ] Configure allowed hosts/ports
- [ ] Test update process in staging
- [ ] Document rollback procedures

### Key Management

```bash
# Generate update signing keys
openssl genrsa -out keys/update-private.pem 4096
openssl rsa -in keys/update-private.pem \
  -pubout -out keys/update-public.pem

# Secure permissions
chmod 600 keys/update-private.pem
chmod 644 keys/update-public.pem
```

⚠️ **Critical**: Store private key securely, never on air-gapped system!

### Certificate Management

For self-signed certificates:

```bash
# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 \
  -keyout keys/airgap-key.pem \
  -out keys/airgap-cert.pem \
  -days 3650 -nodes \
  -subj "/CN=mobius1-airgap"
```

### Integrity Monitoring

Set up periodic integrity checks:

```typescript
// In application startup
await airGapManager.initialize(true);

// Checks run automatically every hour
// Or manually trigger:
await airGapManager.runIntegrityCheck();
```

## Operational Procedures

### Initial Deployment

1. **Prepare system**:
```bash
# Install dependencies offline
npm ci --offline

# Generate keys
npm run security:generate-keys

# Generate integrity manifest
npm run airgap:control generate-manifest src/ dist/
```

2. **Enable air-gap mode**:
```bash
npm run airgap:control enable
```

3. **Verify status**:
```bash
npm run airgap:control status
npm run airgap:control check
```

### Regular Maintenance

**Daily**:
- Check blocked attempts
- Review audit logs

**Weekly**:
- Run integrity checks
- Review system status

**Monthly**:
- Plan updates
- Test rollback procedures

### Update Workflow

1. **Prepare update** (on connected system):
   - Build new version
   - Generate update package
   - Sign package
   - Test in staging

2. **Transfer** (secure method):
   - USB drive
   - Secure file transfer
   - Physical media

3. **Apply** (on air-gapped system):
   - Validate package
   - Apply update
   - Verify integrity
   - Test functionality

4. **Rollback** (if needed):
   - Execute rollback
   - Verify system
   - Investigate issues

## Monitoring

### Audit Events

Air-gap operations generate audit events:

```typescript
// Network isolation
'airgap.network.initialized'
'airgap.connection.blocked'
'airgap.policy.updated'

// Updates
'airgap.package.validated'
'airgap.update.applied'
'airgap.update.rolledback'

// Integrity
'airgap.integrity.verified'
'airgap.manifest.generated'
'airgap.certificate.verified'

// Mode changes
'airgap.mode.enabled'
'airgap.mode.disabled'
```

### Metrics

Monitor:
- Blocked connection attempts
- Integrity check results
- Update success/failure rate
- System uptime

## Troubleshooting

### Network Connection Blocked

**Symptom**: Service can't connect to database

**Solution**:
1. Check if host is in allowlist
2. Verify port is allowed
3. Update policy if needed:

```bash
# Add host to allowlist
# Edit config and restart
```

### Integrity Check Failed

**Symptom**: Files modified unexpectedly

**Solution**:
1. Review modified files
2. Determine if changes are legitimate
3. If unauthorized, investigate security breach
4. Restore from backup if needed

### Update Failed

**Symptom**: Update package validation fails

**Solution**:
1. Verify package signature
2. Check package checksum
3. Ensure correct public key
4. Re-transfer package if corrupted

### Rollback Failed

**Symptom**: Cannot restore previous version

**Solution**:
1. Check backup exists
2. Verify backup integrity
3. Manual restoration if needed
4. Contact support

## API Reference

### AirGapManager

```typescript
import { airGapManager } from './airgap/airgap-manager';

// Initialize
await airGapManager.initialize(true);

// Get status
const status = await airGapManager.getStatus();

// Validate connection
const allowed = await airGapManager.validateConnection('10.0.0.1', 5432);

// Apply update
const result = await airGapManager.applyUpdate('./update.json');

// Run integrity check
const check = await airGapManager.runIntegrityCheck();
```

### NetworkIsolator

```typescript
import { networkIsolator } from './airgap/network-isolator';

// Check connection
const allowed = await networkIsolator.isConnectionAllowed('host', 5432);

// Validate URL
const result = await networkIsolator.validateUrl('http://internal.local');

// Get blocked attempts
const attempts = networkIsolator.getBlockedAttempts(100);
```

### OfflineUpdater

```typescript
import { offlineUpdater } from './airgap/offline-updater';

// Validate package
const validation = await offlineUpdater.validatePackage('./update.json');

// Apply update
const result = await offlineUpdater.applyUpdate('./update.json');

// Rollback
await offlineUpdater.rollback();
```

### IntegrityVerifier

```typescript
import { integrityVerifier } from './airgap/integrity-verifier';

// Generate manifest
const manifest = await integrityVerifier.generateManifest(['src/', 'dist/']);

// Verify integrity
const result = await integrityVerifier.verifyIntegrity();

// Verify specific file
const fileResult = await integrityVerifier.verifyFile('src/index.ts');
```

## Compliance

### Spain Residency Mode

Air-gapped mode works with Spain residency requirements:

```bash
SPAIN_RESIDENCY_MODE=true
AIRGAP_MODE=true
```

Ensures:
- Data stays in Spain
- No external data transfer
- Complete audit trail
- GDPR compliance

### AESIA Compliance

Air-gapped deployments support AESIA requirements:
- Deterministic audit exports
- Digital signing
- Integrity verification
- Complete traceability

## Support

For air-gapped deployment support:
1. Review audit logs
2. Check integrity status
3. Verify configuration
4. Contact support with logs (if possible)

## Summary

Air-gapped mode provides maximum security for sensitive deployments:

✅ Complete network isolation
✅ Secure offline updates
✅ System integrity verification
✅ Full audit trail
✅ Rollback capability
✅ Spain residency compatible
✅ AESIA compliant

Perfect for:
- Government deployments
- Financial institutions
- Healthcare systems
- High-security environments
