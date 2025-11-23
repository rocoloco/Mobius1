# Verify security implementation
# Quick check that all security files are in place

$ErrorActionPreference = "Stop"

Write-Host "🔍 Verifying Security Implementation..." -ForegroundColor Cyan
Write-Host ""

$allPassed = $true

# Check source files
Write-Host "📁 Checking source files..." -ForegroundColor Cyan
$sourceFiles = @(
    "src\security\encryption.ts",
    "src\security\tls.ts",
    "src\security\key-manager.ts",
    "src\security\secrets.ts",
    "src\security\document-encryption.ts",
    "src\security\index.ts"
)

foreach ($file in $sourceFiles) {
    if (Test-Path $file) {
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file - MISSING!" -ForegroundColor Red
        $allPassed = $false
    }
}

# Check test files
Write-Host ""
Write-Host "🧪 Checking test files..." -ForegroundColor Cyan
$testFiles = @(
    "tests\security\encryption.test.ts",
    "tests\security\key-manager.test.ts",
    "tests\security\secrets.test.ts",
    "tests\security\tls.test.ts"
)

foreach ($file in $testFiles) {
    if (Test-Path $file) {
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file - MISSING!" -ForegroundColor Red
        $allPassed = $false
    }
}

# Check documentation
Write-Host ""
Write-Host "📚 Checking documentation..." -ForegroundColor Cyan
$docFiles = @(
    "docs\security\README.md",
    "docs\security\encryption.md",
    "docs\security\tls-setup.md",
    "docs\security\quick-reference.md",
    "docs\security\IMPLEMENTATION.md"
)

foreach ($file in $docFiles) {
    if (Test-Path $file) {
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file - MISSING!" -ForegroundColor Red
        $allPassed = $false
    }
}

# Check scripts
Write-Host ""
Write-Host "🔧 Checking scripts..." -ForegroundColor Cyan
$scriptFiles = @(
    "scripts\generate-keys.ps1",
    "scripts\generate-certs.ps1",
    "scripts\security-audit.ts"
)

foreach ($file in $scriptFiles) {
    if (Test-Path $file) {
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file - MISSING!" -ForegroundColor Red
        $allPassed = $false
    }
}

# Check configuration
Write-Host ""
Write-Host "⚙️  Checking configuration..." -ForegroundColor Cyan
if (Test-Path ".env.example") {
    Write-Host "  ✅ .env.example" -ForegroundColor Green
    
    # Check for required security variables
    $envContent = Get-Content ".env.example" -Raw
    $requiredVars = @(
        "JWT_SECRET",
        "ENCRYPTION_KEY",
        "TLS_ENABLED",
        "COMPLIANCE_ENABLE_SIGNING"
    )
    
    foreach ($var in $requiredVars) {
        if ($envContent -match $var) {
            Write-Host "  ✅ $var in .env.example" -ForegroundColor Green
        } else {
            Write-Host "  ❌ $var missing from .env.example" -ForegroundColor Red
            $allPassed = $false
        }
    }
} else {
    Write-Host "  ❌ .env.example - MISSING!" -ForegroundColor Red
    $allPassed = $false
}

# Check .gitignore
Write-Host ""
Write-Host "🔒 Checking .gitignore..." -ForegroundColor Cyan
if (Test-Path ".gitignore") {
    $gitignoreContent = Get-Content ".gitignore" -Raw
    $sensitivePatterns = @(
        "keys/",
        "certs/",
        ".secrets/",
        "*.pem",
        "*.key"
    )
    
    foreach ($pattern in $sensitivePatterns) {
        if ($gitignoreContent -match [regex]::Escape($pattern)) {
            Write-Host "  ✅ $pattern excluded" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  $pattern not in .gitignore" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "  ❌ .gitignore - MISSING!" -ForegroundColor Red
    $allPassed = $false
}

Write-Host ""
if ($allPassed) {
    Write-Host "✅ Security implementation verification PASSED!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Install Node.js 20+ from https://nodejs.org/" -ForegroundColor White
    Write-Host "  2. Run: npm install" -ForegroundColor White
    Write-Host "  3. Run: .\scripts\generate-keys.ps1" -ForegroundColor White
    Write-Host "  4. Run: .\scripts\generate-certs.ps1" -ForegroundColor White
    Write-Host "  5. Configure .env with secure values" -ForegroundColor White
    Write-Host "  6. Run: npm test tests/security/" -ForegroundColor White
    Write-Host "  7. Run: npm run security:check" -ForegroundColor White
    exit 0
} else {
    Write-Host "❌ Security implementation verification FAILED!" -ForegroundColor Red
    Write-Host "Please review the errors above." -ForegroundColor Yellow
    exit 1
}
