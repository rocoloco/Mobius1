#!/bin/bash
# Verify security implementation
# Quick check that all security files are in place

set -e

echo "🔍 Verifying Security Implementation..."
echo ""

# Check source files
echo "📁 Checking source files..."
files=(
  "src/security/encryption.ts"
  "src/security/tls.ts"
  "src/security/key-manager.ts"
  "src/security/secrets.ts"
  "src/security/document-encryption.ts"
  "src/security/index.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✅ $file"
  else
    echo "  ❌ $file - MISSING!"
    exit 1
  fi
done

# Check test files
echo ""
echo "🧪 Checking test files..."
test_files=(
  "tests/security/encryption.test.ts"
  "tests/security/key-manager.test.ts"
  "tests/security/secrets.test.ts"
  "tests/security/tls.test.ts"
)

for file in "${test_files[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✅ $file"
  else
    echo "  ❌ $file - MISSING!"
    exit 1
  fi
done

# Check documentation
echo ""
echo "📚 Checking documentation..."
doc_files=(
  "docs/security/README.md"
  "docs/security/encryption.md"
  "docs/security/tls-setup.md"
  "docs/security/quick-reference.md"
  "docs/security/IMPLEMENTATION.md"
)

for file in "${doc_files[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✅ $file"
  else
    echo "  ❌ $file - MISSING!"
    exit 1
  fi
done

# Check scripts
echo ""
echo "🔧 Checking scripts..."
script_files=(
  "scripts/generate-keys.sh"
  "scripts/generate-certs.sh"
  "scripts/security-audit.ts"
)

for file in "${script_files[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✅ $file"
  else
    echo "  ❌ $file - MISSING!"
    exit 1
  fi
done

# Check configuration
echo ""
echo "⚙️  Checking configuration..."
if [ -f ".env.example" ]; then
  echo "  ✅ .env.example"
  
  # Check for required security variables
  required_vars=(
    "JWT_SECRET"
    "ENCRYPTION_KEY"
    "TLS_ENABLED"
    "COMPLIANCE_ENABLE_SIGNING"
  )
  
  for var in "${required_vars[@]}"; do
    if grep -q "$var" .env.example; then
      echo "  ✅ $var in .env.example"
    else
      echo "  ❌ $var missing from .env.example"
      exit 1
    fi
  done
else
  echo "  ❌ .env.example - MISSING!"
  exit 1
fi

# Check .gitignore
echo ""
echo "🔒 Checking .gitignore..."
if [ -f ".gitignore" ]; then
  sensitive_patterns=(
    "keys/"
    "certs/"
    ".secrets/"
    "*.pem"
    "*.key"
  )
  
  for pattern in "${sensitive_patterns[@]}"; do
    if grep -q "$pattern" .gitignore; then
      echo "  ✅ $pattern excluded"
    else
      echo "  ⚠️  $pattern not in .gitignore"
    fi
  done
else
  echo "  ❌ .gitignore - MISSING!"
  exit 1
fi

echo ""
echo "✅ Security implementation verification PASSED!"
echo ""
echo "Next steps:"
echo "  1. Run: npm run security:generate-keys"
echo "  2. Run: npm run security:generate-certs"
echo "  3. Configure .env with secure values"
echo "  4. Run: npm test tests/security/"
echo "  5. Run: npm run security:check"
