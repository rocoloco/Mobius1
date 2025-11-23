#!/usr/bin/env tsx
/**
 * Configuration Validation Script
 * Validates deployment configuration before startup
 */

import { configValidator } from '../src/config/validator.js';

async function main() {
  console.log('🔍 Validating Mobius 1 Configuration...\n');

  try {
    const result = await configValidator.validate();

    // Display errors
    if (result.errors.length > 0) {
      console.log('❌ Configuration Errors:\n');
      result.errors.forEach((error) => {
        console.log(`[${error.severity.toUpperCase()}] ${error.category}: ${error.message}`);
        if (error.fix) {
          console.log(`   Fix: ${error.fix}`);
        }
        console.log('');
      });
    }

    // Display warnings
    if (result.warnings.length > 0) {
      console.log('⚠️  Configuration Warnings:\n');
      result.warnings.forEach((warning) => {
        console.log(`[${warning.category}] ${warning.message}`);
        if (warning.recommendation) {
          console.log(`   Recommendation: ${warning.recommendation}`);
        }
        console.log('');
      });
    }

    // Summary
    console.log('─'.repeat(60));
    if (result.valid) {
      console.log('✅ Configuration is valid!');
      console.log(`   Warnings: ${result.warnings.length}`);
      process.exit(0);
    } else {
      console.log('❌ Configuration validation failed!');
      console.log(`   Errors: ${result.errors.length}`);
      console.log(`   Warnings: ${result.warnings.length}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Validation error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
