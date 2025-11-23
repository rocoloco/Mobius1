#!/usr/bin/env tsx
/**
 * Air-Gap Control Tool
 * CLI for managing air-gapped deployment mode
 */

import { airGapManager } from '../src/airgap/airgap-manager.js';
import { integrityVerifier } from '../src/airgap/integrity-verifier.js';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  console.log('🔒 Mobius 1 Air-Gap Control\n');

  try {
    await airGapManager.initialize(false);

    switch (command) {
      case 'status':
        await showStatus();
        break;
      case 'enable':
        await enableAirGap();
        break;
      case 'disable':
        await disableAirGap();
        break;
      case 'check':
        await checkIntegrity();
        break;
      case 'blocked':
        await showBlockedAttempts();
        break;
      case 'update':
        await applyUpdate(args[1]);
        break;
      case 'rollback':
        await rollbackUpdate();
        break;
      case 'generate-manifest':
        await generateManifest(args.slice(1));
        break;
      default:
        showUsage();
    }

    await airGapManager.shutdown();
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function showStatus() {
  console.log('📊 Air-Gap Status:\n');
  const status = await airGapManager.getStatus();

  const enabledIcon = status.enabled ? '✅' : '❌';
  const isolatedIcon = status.networkIsolated ? '✅' : '❌';
  const integrityIcon = status.integrityVerified ? '✅' : '⚠️';

  console.log(`${enabledIcon} Air-Gap Mode: ${status.enabled ? 'ENABLED' : 'DISABLED'}`);
  console.log(`${isolatedIcon} Network Isolated: ${status.networkIsolated ? 'YES' : 'NO'}`);
  console.log(`${integrityIcon} Integrity Verified: ${status.integrityVerified ? 'YES' : 'NO'}`);
  console.log(`📦 Current Version: ${status.currentVersion}`);
  console.log(`🚫 Blocked Attempts: ${status.blockedAttempts}`);

  if (status.lastIntegrityCheck) {
    console.log(`🔍 Last Integrity Check: ${status.lastIntegrityCheck.toISOString()}`);
  }
}

async function enableAirGap() {
  console.log('🔒 Enabling air-gapped mode...\n');

  await airGapManager.enableAirGapMode();

  console.log('✅ Air-gapped mode enabled!');
  console.log('\n⚠️  Important:');
  console.log('   - All external network connections are now blocked');
  console.log('   - Only internal services are accessible');
  console.log('   - Updates must be applied via offline packages');
  console.log('   - Integrity checks will run periodically');
}

async function disableAirGap() {
  console.log('🔓 Disabling air-gapped mode...\n');

  await airGapManager.disableAirGapMode();

  console.log('✅ Air-gapped mode disabled!');
  console.log('\n⚠️  Warning:');
  console.log('   - External network connections are now allowed');
  console.log('   - System is no longer in isolated mode');
}

async function checkIntegrity() {
  console.log('🔍 Running integrity check...\n');

  const result = await airGapManager.runIntegrityCheck();

  if (result.valid) {
    console.log('✅ System integrity verified!');
    console.log(`   Files checked: ${result.filesChecked}`);
  } else {
    console.log('❌ Integrity check failed!');
    console.log(`   Files checked: ${result.filesChecked}`);
    console.log(`   Issues found: ${result.issues.length}\n`);

    result.issues.forEach((issue) => {
      console.log(`   - ${issue}`);
    });
  }
}

async function showBlockedAttempts() {
  console.log('🚫 Blocked Network Attempts:\n');

  const attempts = airGapManager.getBlockedAttempts(20);

  if (attempts.length === 0) {
    console.log('No blocked attempts recorded.');
    return;
  }

  attempts.forEach((attempt) => {
    console.log(`[${attempt.timestamp.toISOString()}]`);
    console.log(`   Host: ${attempt.host}:${attempt.port}`);
    if (attempt.reason) {
      console.log(`   Reason: ${attempt.reason}`);
    }
    console.log('');
  });
}

async function applyUpdate(packagePath: string) {
  if (!packagePath) {
    console.error('❌ Update package path required');
    console.log('Usage: npm run airgap:control update <package-path>');
    process.exit(1);
  }

  console.log(`📦 Applying update from: ${packagePath}\n`);

  const result = await airGapManager.applyUpdate(packagePath);

  if (result.success) {
    console.log('✅ Update applied successfully!');
    console.log(`   Version: ${result.version}`);
    console.log('\n⚠️  Important:');
    console.log('   - Restart services to apply changes');
    console.log('   - Verify system functionality');
  } else {
    console.log('❌ Update failed!');
    console.log('\nErrors:');
    result.errors.forEach((error) => {
      console.log(`   - ${error}`);
    });
  }
}

async function rollbackUpdate() {
  console.log('⏪ Rolling back update...\n');

  console.log('⚠️  This will restore the previous version.');
  console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

  await new Promise((resolve) => setTimeout(resolve, 5000));

  const result = await airGapManager.rollbackUpdate();

  if (result.success) {
    console.log('✅ Rollback completed successfully!');
    console.log('\n⚠️  Important:');
    console.log('   - Restart services');
    console.log('   - Verify system functionality');
  } else {
    console.log('❌ Rollback failed!');
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  }
}

async function generateManifest(paths: string[]) {
  if (paths.length === 0) {
    console.error('❌ At least one path required');
    console.log('Usage: npm run airgap:control generate-manifest <path1> [path2] ...');
    process.exit(1);
  }

  console.log('📝 Generating integrity manifest...\n');

  await integrityVerifier.initialize();
  const manifest = await integrityVerifier.generateManifest(paths);

  console.log('✅ Manifest generated!');
  console.log(`   Version: ${manifest.version}`);
  console.log(`   Files: ${manifest.files.length}`);
  console.log(`   Timestamp: ${manifest.timestamp.toISOString()}`);
}

function showUsage() {
  console.log('Usage:');
  console.log('  npm run airgap:control status                    - Show air-gap status');
  console.log('  npm run airgap:control enable                    - Enable air-gapped mode');
  console.log('  npm run airgap:control disable                   - Disable air-gapped mode');
  console.log('  npm run airgap:control check                     - Run integrity check');
  console.log('  npm run airgap:control blocked                   - Show blocked attempts');
  console.log('  npm run airgap:control update <package>          - Apply offline update');
  console.log('  npm run airgap:control rollback                  - Rollback update');
  console.log('  npm run airgap:control generate-manifest <paths> - Generate manifest');
  console.log('');
  console.log('Examples:');
  console.log('  npm run airgap:control status');
  console.log('  npm run airgap:control enable');
  console.log('  npm run airgap:control update ./updates/v1.0.1.json');
}

main();
