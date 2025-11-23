# TLS Configuration Guide - Mobius 1 Platform

## Overview

Mobius 1 enforces TLS 1.3 for all production deployments to ensure encrypted communications. This guide covers certificate generation, configuration, and troubleshooting.

## TLS Requirements

### Protocol Version

- **Minimum**: TLS 1.3
- **Disabled**: SSLv2, SSLv3, TLS 1.0, TLS 1.1, TLS 1.2

### Cipher Suites (NIST Recommended)

1. `TLS_AES_256_GCM_SHA384` (preferred)
2. `TLS_CHACHA20_POLY1305_SHA256`
3. `TLS_AES_128_GCM_SHA256`

### Certificate Requirements

- **Key Size**: Minimum 2048-bit RSA (4096-bit recommended)
- **Signature Algorithm**: SHA-256 or stronger
- **Validity**: Maximum 397 days (per CA/Browser Forum)
- **Subject Alternative Names (SAN)**: Required for all hostnames

## Development Setup

### Generate Self-Signed Certificates

For local development only:

```bash
npm run security:generate-certs
```

This creates:
- `certs/ca.crt` - Certificate Authority
- `certs/server.crt` - Server certificate
- `certs/server.key` - Server private key

### Enable TLS in Development

Update `.env`:

```bash
TLS_ENABLED=true
TLS_CERT_PATH=./certs/server.crt
TLS_KEY_PATH=./certs/server.key
TLS_CA_PATH=./certs/ca.crt
```

Start the server:

```bash
npm run dev
```

Access via: `https://localhost:3000`

**Note**: Your browser will show a security warning because the certificate is self-signed. This is expected in development.

## Production Setup

### Option 1: Let's Encrypt (Recommended)

Free, automated certificates from Let's Encrypt:

```bash
# Install certbot
sudo apt-get install certbot

# Generate certificate
sudo certbot certonly --standalone \
  -d mobius1.yourdomain.com \
  --email admin@yourdomain.com \
  --agree-tos

# Certificates will be in:
# /etc/letsencrypt/live/mobius1.yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/mobius1.yourdomain.com/privkey.pem
```

Update `.env`:

```bash
TLS_ENABLED=true
TLS_CERT_PATH=/etc/letsencrypt/live/mobius1.yourdomain.com/fullchain.pem
TLS_KEY_PATH=/etc/letsencrypt/live/mobius1.yourdomain.com/privkey.pem
```

### Option 2: Commercial CA

Purchase certificate from trusted CA (DigiCert, GlobalSign, etc.):

1. Generate Certificate Signing Request (CSR)
2. Submit CSR to CA
3. Receive signed certificate
4. Install certificate and private key

```bash
TLS_ENABLED=true
TLS_CERT_PATH=/path/to/certificate.crt
TLS_KEY_PATH=/path/to/private.key
TLS_CA_PATH=/path/to/ca-bundle.crt
```

### Option 3: Internal PKI

For air-gapped or internal deployments:

1. Set up internal Certificate Authority
2. Generate and sign certificates
3. Distribute CA certificate to all clients
4. Configure Mobius 1 with internal certificates

## Mutual TLS (mTLS)

For enhanced security, require client certificates:

```bash
TLS_ENABLED=true
TLS_CERT_PATH=./certs/server.crt
TLS_KEY_PATH=./certs/server.key
TLS_CA_PATH=./certs/ca.crt  # CA that signed client certs
```

The platform will:
- Request client certificate during TLS handshake
- Verify certificate against CA
- Reject connections without valid client certificate

## Certificate Rotation

### Automated Rotation (Let's Encrypt)

```bash
# Test renewal
sudo certbot renew --dry-run

# Set up automatic renewal (cron)
sudo crontab -e

# Add line:
0 0 * * * certbot renew --quiet --post-hook "systemctl restart mobius1"
```

### Manual Rotation

1. Generate new certificate
2. Update `.env` with new paths
3. Restart Mobius 1 platform
4. Verify new certificate:

```bash
openssl s_client -connect localhost:3000 -showcerts
```

## Verification

### Check TLS Version

```bash
openssl s_client -connect localhost:3000 -tls1_3
```

Expected output:
```
Protocol  : TLSv1.3
Cipher    : TLS_AES_256_GCM_SHA384
```

### Check Certificate Details

```bash
openssl x509 -in certs/server.crt -text -noout
```

Verify:
- Subject Alternative Names include your domain
- Validity dates are current
- Signature algorithm is SHA-256 or stronger

### Test with curl

```bash
# Development (self-signed)
curl -k https://localhost:3000/health

# Production (trusted CA)
curl https://mobius1.yourdomain.com/health
```

## Spain Residency Mode

When `SPAIN_RESIDENCY_MODE=true`, ensure:

1. **Certificate Issued in Spain**: Use Spanish CA or Let's Encrypt
2. **Server Location**: TLS termination occurs in Spain
3. **No CDN Bypass**: If using CDN, ensure Spain-only PoPs

## Troubleshooting

### Error: Certificate file not found

**Symptom**: Platform fails to start with certificate error

**Solution**:
```bash
# Verify files exist
ls -la certs/

# Check permissions
chmod 600 certs/server.key
chmod 644 certs/server.crt
```

### Error: Certificate verification failed

**Symptom**: Clients cannot connect, certificate errors

**Causes**:
1. Expired certificate
2. Hostname mismatch
3. Missing intermediate certificates

**Solution**:
```bash
# Check expiration
openssl x509 -in certs/server.crt -noout -dates

# Check SAN
openssl x509 -in certs/server.crt -noout -ext subjectAltName

# Include full chain
cat server.crt intermediate.crt > fullchain.crt
```

### Error: TLS handshake failed

**Symptom**: Connection drops during handshake

**Solution**:
```bash
# Test TLS 1.3 support
openssl s_client -connect localhost:3000 -tls1_3

# Check cipher compatibility
openssl ciphers -v 'TLS_AES_256_GCM_SHA384'
```

## Security Best Practices

### DO

✅ Use TLS 1.3 in production  
✅ Rotate certificates before expiration  
✅ Use 4096-bit RSA keys  
✅ Enable HSTS headers  
✅ Monitor certificate expiration  

### DON'T

❌ Use self-signed certificates in production  
❌ Commit private keys to version control  
❌ Allow TLS 1.2 or older  
❌ Use weak cipher suites  
❌ Skip certificate validation  

## Compliance

| Requirement | Implementation |
|-------------|----------------|
| GDPR Art. 32 | TLS 1.3 for data in transit |
| AESIA Baseline | Strong cipher suites |
| PCI DSS | TLS 1.2+ (we use 1.3) |
| Spain Residency | TLS termination in Spain |

## References

- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
- [NIST SP 800-52 Rev. 2](https://csrc.nist.gov/publications/detail/sp/800-52/rev-2/final)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [TLS 1.3 RFC 8446](https://datatracker.ietf.org/doc/html/rfc8446)
