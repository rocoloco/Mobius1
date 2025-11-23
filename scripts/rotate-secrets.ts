#!/usr/bin/env tsx
/**
 * Manual Secrets Rotation Script
 * Allows operators to manually rotate secrets with validation
 */

import { secretsManager } from '../src/config/secrets-manager.js';
import { rotationScheduler } from '../src/config/rotation-scheduler.js';
import { auditLogger } from '../src/audit/logger.js';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  console.log('🔄 Mobius 1 Secrets Rotation Tool\n');

  try {
    await secretsManager.initialize();
    await rotationScheduler.initialize();

    switch (command) {
      case 'status':
        await showRotationStatus();
        break;
      case 'rotate':
        await rotateSecret(args[1]);
        break;
      case 'check':
        await checkRotations();
        break;
      default:
        showUsage();
    }

    await secretsManager.shutdown();
    await rotationScheduler.shutdown();
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function showRotationStatus() {
  console.log('📊 Rotation Status:\n');
  const statuses = await rotationScheduler.getRotationStatuses();

  for (const status of statuses) {
    const icon = status.status === 'current' ? '✅' : status.status === 'warning' ? '⚠️' : '❌';
    console.log(`${icon} ${status.secretName}`);
    console.log(`   Last Rotated: ${status.lastRotated.toISOString()}`);
    console.log(`   Next Rotation: ${status.nextRotation.toISOString()}`);
    console.log(`   Days Until: ${status.daysUntilRotation}`);
    console.log(`   Status: ${status.status.toUpperCase()}\n`);
  }
}

async function rotateSecret(secretName: string) {
  if (!secretName) {
    console.error('❌ Secret name required');
    console.log('Usage: npm run secrets:rotate rotate <secret-name>');
    process.exit(1);
  }

  console.log(`🔄 Rotating secret: ${secretName}\n`);

  const policy = rotationScheduler.getPolicy(secretName);
  if (!policy) {
    console.error(`❌ No rotation policy found for ${secretName}`);
    process.exit(1);
  }

  // Confirm rotation
  console.log('⚠️  This will rotate the secret and may require service restart.');
  console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

  await new Promise((resolve) => setTimeout(resolve, 5000));

  await rotationScheduler.rotateSecret(secretName, 'operator', 'system');

  console.log('✅ Secret rotated successfully!');
  console.log('\n⚠️  Important:');
  console.log('   1. Update .env file with new secret value');
  console.log('   2. Restart all services');
  console.log('   3. Verify services are running correctly');
}

async function checkRotations() {
  console.log('🔍 Checking rotation requirements...\n');
  const statuses = await rotationScheduler.checkRotations();

  const needsRotation = statuses.filter((s) => s.status === 'expired');
  const warnings = statuses.filter((s) => s.status === 'warning');

  if (needsRotation.length > 0) {
    console.log('❌ Secrets requiring immediate rotation:');
    needsRotation.forEach((s) => console.log(`   - ${s.secretName}`));
    console.log('');
  }

  if (warnings.length > 0) {
    console.log('⚠️  Secrets approaching rotation:');
    warnings.forEach((s) => console.log(`   - ${s.secretName} (${s.daysUntilRotation} days)`));
    console.log('');
  }

  if (needsRotation.length === 0 && warnings.length === 0) {
    console.log('✅ All secrets are current');
  }
}

function showUsage() {
  console.log('Usage:');
  console.log('  npm run secrets:rotate status          - Show rotation status');
  console.log('  npm run secrets:rotate rotate <name>   - Rotate a specific secret');
  console.log('  npm run secrets:rotate check           - Check rotation requirements');
  console.log('');
  console.log('Examples:');
  console.log('  npm run secrets:rotate status');
  console.log('  npm run secrets:rotate rotate JWT_SECRET');
}

main();
