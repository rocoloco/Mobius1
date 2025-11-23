#!/bin/bash
# Generate cryptographic keys for compliance signing
# These keys are used for AESIA audit package signing

set -e

KEYS_DIR="./keys"
DAYS_VALID=3650  # 10 years

echo "🔑 Generating compliance signing keys..."

# Create keys directory
mkdir -p "$KEYS_DIR"

# Generate private key for compliance signing
echo "📝 Generating RSA private key (4096-bit)..."
openssl genrsa -out "$KEYS_DIR/compliance-private.pem" 4096

# Extract public key
echo "📝 Extracting public key..."
openssl rsa -in "$KEYS_DIR/compliance-private.pem" \
  -pubout -out "$KEYS_DIR/compliance-public.pem"

# Set secure permissions
chmod 600 "$KEYS_DIR/compliance-private.pem"
chmod 644 "$KEYS_DIR/compliance-public.pem"

echo "✅ Compliance keys generated successfully!"
echo ""
echo "📁 Key files:"
echo "   Private Key: $KEYS_DIR/compliance-private.pem"
echo "   Public Key:  $KEYS_DIR/compliance-public.pem"
echo ""
echo "⚠️  IMPORTANT: Keep the private key secure!"
echo "   - Never commit to version control"
echo "   - Store in secure key management system in production"
echo "   - Backup securely with encryption"
echo ""
echo "Update your .env:"
echo "   COMPLIANCE_PRIVATE_KEY_PATH=./keys/compliance-private.pem"
echo "   COMPLIANCE_PUBLIC_KEY_PATH=./keys/compliance-public.pem"
