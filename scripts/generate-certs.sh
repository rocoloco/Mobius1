#!/bin/bash
# Generate self-signed TLS certificates for development
# DO NOT use these certificates in production!

set -e

CERTS_DIR="./certs"
DAYS_VALID=365

echo "🔐 Generating self-signed TLS certificates for development..."

# Create certs directory
mkdir -p "$CERTS_DIR"

# Generate CA private key
echo "📝 Generating CA private key..."
openssl genrsa -out "$CERTS_DIR/ca.key" 4096

# Generate CA certificate
echo "📝 Generating CA certificate..."
openssl req -new -x509 -days $DAYS_VALID -key "$CERTS_DIR/ca.key" \
  -out "$CERTS_DIR/ca.crt" \
  -subj "/C=ES/ST=Madrid/L=Madrid/O=Mobius1 Dev/CN=Mobius1 Dev CA"

# Generate server private key
echo "📝 Generating server private key..."
openssl genrsa -out "$CERTS_DIR/server.key" 4096

# Generate server certificate signing request
echo "📝 Generating server CSR..."
openssl req -new -key "$CERTS_DIR/server.key" \
  -out "$CERTS_DIR/server.csr" \
  -subj "/C=ES/ST=Madrid/L=Madrid/O=Mobius1 Dev/CN=localhost"

# Create extensions file for SAN
cat > "$CERTS_DIR/server.ext" << EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
IP.1 = 127.0.0.1
IP.2 = ::1
EOF

# Sign server certificate with CA
echo "📝 Signing server certificate..."
openssl x509 -req -in "$CERTS_DIR/server.csr" \
  -CA "$CERTS_DIR/ca.crt" -CAkey "$CERTS_DIR/ca.key" \
  -CAcreateserial -out "$CERTS_DIR/server.crt" \
  -days $DAYS_VALID -sha256 \
  -extfile "$CERTS_DIR/server.ext"

# Clean up temporary files
rm "$CERTS_DIR/server.csr" "$CERTS_DIR/server.ext" "$CERTS_DIR/ca.srl"

# Set secure permissions
chmod 600 "$CERTS_DIR"/*.key
chmod 644 "$CERTS_DIR"/*.crt

echo "✅ Certificates generated successfully!"
echo ""
echo "📁 Certificate files:"
echo "   CA Certificate:     $CERTS_DIR/ca.crt"
echo "   Server Certificate: $CERTS_DIR/server.crt"
echo "   Server Private Key: $CERTS_DIR/server.key"
echo ""
echo "⚠️  WARNING: These are self-signed certificates for DEVELOPMENT ONLY!"
echo "   Do NOT use in production. Use proper certificates from a trusted CA."
echo ""
echo "To enable TLS in development, update your .env:"
echo "   TLS_ENABLED=true"
echo "   TLS_CERT_PATH=./certs/server.crt"
echo "   TLS_KEY_PATH=./certs/server.key"
echo "   TLS_CA_PATH=./certs/ca.crt"
