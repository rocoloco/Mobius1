#!/usr/bin/env tsx
/**
 * Security Audit Script for Mobius 1 Platform
 * Checks security configuration and identifies potential issues
 */

import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

config();

interface AuditResult {
  category: string;
  check: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
}

const results: AuditResult[] = [];

function audit(category: string, check: string, status: 'pass' | 'warn' | 'fail', message: string) {
  results.push({ category, check, status, message });
}

console.log('🔍 Running Mobius 1 Security Audit...\n');

// ============================================================================
// Environment Configuration
// ============================================================================

console.log('📋 Checking Environment Configuration...');

// Check .env exists
if (!fs.existsSync('.env')) {
  audit('Environment', '.env file', 'fail', '.env file not found. Copy .env.example to .env');
} else {
  audit('Environment', '.env file', 'pass', '.env file exists');
}

// Check JWT_SECRET
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  audit('Environment', 'JWT_SECRET', 'fail', 'JWT_SECRET not set');
} else if (jwtSecret.length < 32) {
  audit('Environment', 'JWT_SECRET', 'fail', `JWT_SECRET too short (${jwtSecret.length} chars, need 32+)`);
} else if (jwtSecret === 'your-super-secret-jwt-key-change-this-in-production-min-32-chars') {
  audit('Environment', 'JWT_SECRET', 'warn', 'JWT_SECRET is default value - change in production!');
} else {
  audit('Environment', 'JWT_SECRET', 'pass', 'JWT_SECRET configured correctly');
}

// Check ENCRYPTION_KEY
const encryptionKey = process.env.ENCRYPTION_KEY;
if (!encryptionKey) {
  audit('Environment', 'ENCRYPTION_KEY', 'fail', 'ENCRYPTION_KEY not set');
} else if (encryptionKey.length !== 32) {
  audit('Environment', 'ENCRYPTION_KEY', 'fail', `ENCRYPTION_KEY wrong length (${encryptionKey.length} chars, need exactly 32)`);
} else if (encryptionKey === '12345678901234567890123456789012') {
  audit('Environment', 'ENCRYPTION_KEY', 'fail', 'ENCRYPTION_KEY is default value - MUST change!');
} else {
  audit('Environment', 'ENCRYPTION_KEY', 'pass', 'ENCRYPTION_KEY configured correctly');
}

// Check NODE_ENV
const nodeEnv = process.env.NODE_ENV || 'development';
if (nodeEnv === 'production') {
  audit('Environment', 'NODE_ENV', 'pass', 'Running in production mode');
} else {
  audit('Environment', 'NODE_ENV', 'warn', `Running in ${nodeEnv} mode`);
}

// ============================================================================
// TLS Configuration
// ============================================================================

console.log('🔒 Checking TLS Configuration...');

const tlsEnabled = process.env.TLS_ENABLED === 'true';
if (!tlsEnabled) {
  if (nodeEnv === 'production') {
    audit('TLS', 'TLS Enabled', 'fail', 'TLS not enabled in production!');
  } else {
    audit('TLS', 'TLS Enabled', 'warn', 'TLS not enabled (OK for development)');
  }
} else {
  audit('TLS', 'TLS Enabled', 'pass', 'TLS enabled');

  // Check certificate files
  const certPath = process.env.TLS_CERT_PATH;
  const keyPath = process.env.TLS_KEY_PATH;

  if (!certPath || !fs.existsSync(certPath)) {
    audit('TLS', 'Certificate', 'fail', `Certificate not found: ${certPath}`);
  } else {
    audit('TLS', 'Certificate', 'pass', 'Certificate file exists');
  }

  if (!keyPath || !fs.existsSync(keyPath)) {
    audit('TLS', 'Private Key', 'fail', `Private key not found: ${keyPath}`);
  } else {
    // Check key permissions
    const stats = fs.statSync(keyPath);
    const mode = stats.mode & 0o777;
    if (mode !== 0o600) {
      audit('TLS', 'Key Permissions', 'warn', `Private key permissions too open (${mode.toString(8)}), should be 600`);
    } else {
      audit('TLS', 'Private Key', 'pass', 'Private key exists with correct permissions');
    }
  }
}

// ============================================================================
// Compliance Configuration
// ============================================================================

console.log('⚖️  Checking Compliance Configuration...');

const spainResidencyMode = process.env.SPAIN_RESIDENCY_MODE === 'true';
audit('Compliance', 'Spain Residency Mode', spainResidencyMode ? 'pass' : 'warn', 
  spainResidencyMode ? 'Spain residency mode enabled' : 'Spain residency mode disabled');

const piiRedaction = process.env.LOG_REDACT_PII === 'true';
audit('Compliance', 'PII Redaction', piiRedaction ? 'pass' : 'fail',
  piiRedaction ? 'PII redaction enabled' : 'PII redaction disabled - MUST enable!');

const complianceSigning = process.env.COMPLIANCE_ENABLE_SIGNING === 'true';
if (complianceSigning) {
  const privateKeyPath = process.env.COMPLIANCE_PRIVATE_KEY_PATH;
  const publicKeyPath = process.env.COMPLIANCE_PUBLIC_KEY_PATH;

  if (!privateKeyPath || !fs.existsSync(privateKeyPath)) {
    audit('Compliance', 'Signing Keys', 'fail', 'Compliance private key not found');
  } else if (!publicKeyPath || !fs.existsSync(publicKeyPath)) {
    audit('Compliance', 'Signing Keys', 'fail', 'Compliance public key not found');
  } else {
    audit('Compliance', 'Signing Keys', 'pass', 'Compliance signing keys configured');
  }
} else {
  audit('Compliance', 'Digital Signing', 'warn', 'Digital signing disabled');
}

// ============================================================================
// File Security
// ============================================================================

console.log('📁 Checking File Security...');

// Check .gitignore
if (fs.existsSync('.gitignore')) {
  const gitignore = fs.readFileSync('.gitignore', 'utf8');
  const requiredPatterns = ['keys/', 'certs/', '.secrets/', '*.pem', '*.key'];
  const missing = requiredPatterns.filter(pattern => !gitignore.includes(pattern));
  
  if (missing.length > 0) {
    audit('Files', '.gitignore', 'warn', `Missing patterns: ${missing.join(', ')}`);
  } else {
    audit('Files', '.gitignore', 'pass', 'Sensitive files excluded from git');
  }
}

// Check for accidentally committed secrets
const dangerousFiles = [
  'keys/compliance-private.pem',
  'certs/server.key',
  '.secrets/',
  '.env'
];

for (const file of dangerousFiles) {
  if (fs.existsSync(file)) {
    // Check if tracked by git
    try {
      const { execSync } = require('child_process');
      execSync(`git ls-files --error-unmatch ${file}`, { stdio: 'ignore' });
      audit('Files', `Git Tracking: ${file}`, 'fail', `DANGER: ${file} is tracked by git!`);
    } catch {
      // Not tracked - good
      audit('Files', `Git Tracking: ${file}`, 'pass', `${file} not tracked by git`);
    }
  }
}

// ============================================================================
// Dependencies
// ============================================================================

console.log('📦 Checking Dependencies...');

if (fs.existsSync('package.json')) {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  // Check for security-related dependencies
  const securityDeps = ['bcryptjs', 'jsonwebtoken'];
  const hasDeps = securityDeps.every(dep => 
    pkg.dependencies?.[dep] || pkg.devDependencies?.[dep]
  );
  
  if (hasDeps) {
    audit('Dependencies', 'Security Libraries', 'pass', 'Security dependencies installed');
  } else {
    audit('Dependencies', 'Security Libraries', 'warn', 'Some security dependencies missing');
  }
}

// ============================================================================
// Print Results
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('📊 Audit Results\n');

const grouped = results.reduce((acc, result) => {
  if (!acc[result.category]) acc[result.category] = [];
  acc[result.category].push(result);
  return acc;
}, {} as Record<string, AuditResult[]>);

for (const [category, checks] of Object.entries(grouped)) {
  console.log(`\n${category}:`);
  for (const check of checks) {
    const icon = check.status === 'pass' ? '✅' : check.status === 'warn' ? '⚠️ ' : '❌';
    console.log(`  ${icon} ${check.check}: ${check.message}`);
  }
}

// Summary
const passed = results.filter(r => r.status === 'pass').length;
const warned = results.filter(r => r.status === 'warn').length;
const failed = results.filter(r => r.status === 'fail').length;

console.log('\n' + '='.repeat(80));
console.log(`\n📈 Summary: ${passed} passed, ${warned} warnings, ${failed} failed\n`);

if (failed > 0) {
  console.log('❌ Security audit FAILED - address critical issues before deployment!');
  process.exit(1);
} else if (warned > 0) {
  console.log('⚠️  Security audit passed with warnings - review before production deployment');
  process.exit(0);
} else {
  console.log('✅ Security audit PASSED - all checks successful!');
  process.exit(0);
}
