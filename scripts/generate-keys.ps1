# Generate cryptographic keys for compliance signing
# These keys are used for AESIA audit package signing

$ErrorActionPreference = "Stop"

$KEYS_DIR = ".\keys"
$DAYS_VALID = 3650  # 10 years

Write-Host "🔑 Generating compliance signing keys..." -ForegroundColor Cyan

# Create keys directory
if (-not (Test-Path $KEYS_DIR)) {
    New-Item -ItemType Directory -Path $KEYS_DIR | Out-Null
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

# Generate private key for compliance signing
Write-Host "📝 Generating RSA private key (4096-bit)..." -ForegroundColor Green
& openssl genrsa -out "$KEYS_DIR\compliance-private.pem" 4096

# Extract public key
Write-Host "📝 Extracting public key..." -ForegroundColor Green
& openssl rsa -in "$KEYS_DIR\compliance-private.pem" `
    -pubout -out "$KEYS_DIR\compliance-public.pem"

Write-Host ""
Write-Host "✅ Compliance keys generated successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📁 Key files:" -ForegroundColor Cyan
Write-Host "   Private Key: $KEYS_DIR\compliance-private.pem" -ForegroundColor White
Write-Host "   Public Key:  $KEYS_DIR\compliance-public.pem" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  IMPORTANT: Keep the private key secure!" -ForegroundColor Yellow
Write-Host "   - Never commit to version control" -ForegroundColor Yellow
Write-Host "   - Store in secure key management system in production" -ForegroundColor Yellow
Write-Host "   - Backup securely with encryption" -ForegroundColor Yellow
Write-Host ""
Write-Host "Update your .env:" -ForegroundColor Cyan
Write-Host "   COMPLIANCE_PRIVATE_KEY_PATH=./keys/compliance-private.pem" -ForegroundColor White
Write-Host "   COMPLIANCE_PUBLIC_KEY_PATH=./keys/compliance-public.pem" -ForegroundColor White
