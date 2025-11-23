# Generate self-signed TLS certificates for development
# DO NOT use these certificates in production!

$ErrorActionPreference = "Stop"

$CERTS_DIR = ".\certs"
$DAYS_VALID = 365

Write-Host "🔐 Generating self-signed TLS certificates for development..." -ForegroundColor Cyan

# Create certs directory
if (-not (Test-Path $CERTS_DIR)) {
    New-Item -ItemType Directory -Path $CERTS_DIR | Out-Null
}

# Check if OpenSSL is available
$opensslPath = Get-Command openssl -ErrorAction SilentlyContinue

if (-not $opensslPath) {
    Write-Host "❌ OpenSSL not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install OpenSSL:" -ForegroundColor Yellow
    Write-Host "  Option 1: Install Git for Windows (includes OpenSSL)" -ForegroundColor Yellow
    Write-Host "    https://git-scm.com/download/win" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Option 2: Install OpenSSL directly" -ForegroundColor Yellow
    Write-Host "    https://slproweb.com/products/Win32OpenSSL.html" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Option 3: Use Chocolatey" -ForegroundColor Yellow
    Write-Host "    choco install openssl" -ForegroundColor Yellow
    exit 1
}

# Generate CA private key
Write-Host "📝 Generating CA private key..." -ForegroundColor Green
& openssl genrsa -out "$CERTS_DIR\ca.key" 4096

# Generate CA certificate
Write-Host "📝 Generating CA certificate..." -ForegroundColor Green
& openssl req -new -x509 -days $DAYS_VALID -key "$CERTS_DIR\ca.key" `
    -out "$CERTS_DIR\ca.crt" `
    -subj "/C=ES/ST=Madrid/L=Madrid/O=Mobius1 Dev/CN=Mobius1 Dev CA"

# Generate server private key
Write-Host "📝 Generating server private key..." -ForegroundColor Green
& openssl genrsa -out "$CERTS_DIR\server.key" 4096

# Generate server certificate signing request
Write-Host "📝 Generating server CSR..." -ForegroundColor Green
& openssl req -new -key "$CERTS_DIR\server.key" `
    -out "$CERTS_DIR\server.csr" `
    -subj "/C=ES/ST=Madrid/L=Madrid/O=Mobius1 Dev/CN=localhost"

# Create extensions file for SAN
$extContent = @"
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
IP.1 = 127.0.0.1
IP.2 = ::1
"@

Set-Content -Path "$CERTS_DIR\server.ext" -Value $extContent

# Sign server certificate with CA
Write-Host "📝 Signing server certificate..." -ForegroundColor Green
& openssl x509 -req -in "$CERTS_DIR\server.csr" `
    -CA "$CERTS_DIR\ca.crt" -CAkey "$CERTS_DIR\ca.key" `
    -CAcreateserial -out "$CERTS_DIR\server.crt" `
    -days $DAYS_VALID -sha256 `
    -extfile "$CERTS_DIR\server.ext"

# Clean up temporary files
Remove-Item "$CERTS_DIR\server.csr" -ErrorAction SilentlyContinue
Remove-Item "$CERTS_DIR\server.ext" -ErrorAction SilentlyContinue
Remove-Item "$CERTS_DIR\ca.srl" -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "✅ Certificates generated successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📁 Certificate files:" -ForegroundColor Cyan
Write-Host "   CA Certificate:     $CERTS_DIR\ca.crt" -ForegroundColor White
Write-Host "   Server Certificate: $CERTS_DIR\server.crt" -ForegroundColor White
Write-Host "   Server Private Key: $CERTS_DIR\server.key" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  WARNING: These are self-signed certificates for DEVELOPMENT ONLY!" -ForegroundColor Yellow
Write-Host "   Do NOT use in production. Use proper certificates from a trusted CA." -ForegroundColor Yellow
Write-Host ""
Write-Host "To enable TLS in development, update your .env:" -ForegroundColor Cyan
Write-Host "   TLS_ENABLED=true" -ForegroundColor White
Write-Host "   TLS_CERT_PATH=./certs/server.crt" -ForegroundColor White
Write-Host "   TLS_KEY_PATH=./certs/server.key" -ForegroundColor White
Write-Host "   TLS_CA_PATH=./certs/ca.crt" -ForegroundColor White
