/**
 * Dependency Validation Script
 * Validates all system dependencies before deployment
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

interface DependencyCheck {
  name: string;
  required: boolean;
  check: () => Promise<boolean>;
  version?: () => Promise<string>;
  installInstructions?: string;
}

interface ValidationResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  version?: string;
  message?: string;
}

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function execCommand(command: string): string | null {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: 'pipe' }).trim();
  } catch {
    return null;
  }
}

const dependencies: DependencyCheck[] = [
  {
    name: 'Node.js',
    required: true,
    check: async () => execCommand('node --version') !== null,
    version: async () => execCommand('node --version') || 'unknown',
    installInstructions: 'Install from https://nodejs.org/',
  },
  {
    name: 'npm',
    required: true,
    check: async () => execCommand('npm --version') !== null,
    version: async () => execCommand('npm --version') || 'unknown',
    installInstructions: 'Comes with Node.js',
  },
  {
    name: 'Docker',
    required: true,
    check: async () => execCommand('docker --version') !== null,
    version: async () => execCommand('docker --version') || 'unknown',
    installInstructions: 'Install from https://docs.docker.com/get-docker/',
  },
  {
    name: 'Docker Compose',
    required: true,
    check: async () => execCommand('docker-compose --version') !== null,
    version: async () => execCommand('docker-compose --version') || 'unknown',
    installInstructions: 'Install from https://docs.docker.com/compose/install/',
  },
  {
    name: 'Git',
    required: false,
    check: async () => execCommand('git --version') !== null,
    version: async () => execCommand('git --version') || 'unknown',
    installInstructions: 'Install from https://git-scm.com/',
  },
  {
    name: 'PostgreSQL Client',
    required: false,
    check: async () => execCommand('psql --version') !== null,
    version: async () => execCommand('psql --version') || 'unknown',
    installInstructions: 'Install from https://www.postgresql.org/download/',
  },
];

async function checkEnvironmentFile(): Promise<ValidationResult> {
  const envPath = join(process.cwd(), '.env');
  const envExamplePath = join(process.cwd(), '.env.example');

  if (existsSync(envPath)) {
    // Check if all required variables are set
    const envContent = readFileSync(envPath, 'utf-8');
    const requiredVars = [
      'DATABASE_URL',
      'REDIS_URL',
      'MINIO_ENDPOINT',
      'QDRANT_URL',
      'JWT_SECRET',
    ];

    const missingVars = requiredVars.filter(
      (varName) => !envContent.includes(`${varName}=`)
    );

    if (missingVars.length > 0) {
      return {
        name: 'Environment Configuration',
        status: 'warning',
        message: `Missing variables: ${missingVars.join(', ')}`,
      };
    }

    return {
      name: 'Environment Configuration',
      status: 'pass',
      message: 'All required variables present',
    };
  } else if (existsSync(envExamplePath)) {
    return {
      name: 'Environment Configuration',
      status: 'fail',
      message: '.env file not found. Copy .env.example to .env and configure',
    };
  } else {
    return {
      name: 'Environment Configuration',
      status: 'fail',
      message: 'Neither .env nor .env.example found',
    };
  }
}

async function checkNodeModules(): Promise<ValidationResult> {
  const nodeModulesPath = join(process.cwd(), 'node_modules');

  if (existsSync(nodeModulesPath)) {
    return {
      name: 'Node Modules',
      status: 'pass',
      message: 'Dependencies installed',
    };
  } else {
    return {
      name: 'Node Modules',
      status: 'fail',
      message: 'Run "npm install" to install dependencies',
    };
  }
}

async function checkPrismaClient(): Promise<ValidationResult> {
  const prismaClientPath = join(
    process.cwd(),
    'node_modules',
    '.prisma',
    'client'
  );

  if (existsSync(prismaClientPath)) {
    return {
      name: 'Prisma Client',
      status: 'pass',
      message: 'Generated',
    };
  } else {
    return {
      name: 'Prisma Client',
      status: 'warning',
      message: 'Run "npm run db:generate" to generate Prisma client',
    };
  }
}

async function checkDockerDaemon(): Promise<ValidationResult> {
  const result = execCommand('docker info');

  if (result) {
    return {
      name: 'Docker Daemon',
      status: 'pass',
      message: 'Running',
    };
  } else {
    return {
      name: 'Docker Daemon',
      status: 'fail',
      message: 'Docker daemon is not running. Please start Docker',
    };
  }
}

async function validateDependencies(): Promise<void> {
  log('\n========================================', 'blue');
  log('Mobius 1 Platform - Dependency Validation', 'blue');
  log('========================================\n', 'blue');

  const results: ValidationResult[] = [];

  // Check system dependencies
  log('Checking system dependencies...', 'blue');
  for (const dep of dependencies) {
    const isInstalled = await dep.check();
    const version = isInstalled && dep.version ? await dep.version() : undefined;

    if (isInstalled) {
      results.push({
        name: dep.name,
        status: 'pass',
        version,
      });
    } else {
      results.push({
        name: dep.name,
        status: dep.required ? 'fail' : 'warning',
        message: dep.installInstructions,
      });
    }
  }

  // Check environment configuration
  results.push(await checkEnvironmentFile());

  // Check node modules
  results.push(await checkNodeModules());

  // Check Prisma client
  results.push(await checkPrismaClient());

  // Check Docker daemon
  results.push(await checkDockerDaemon());

  // Display results
  log('\n========================================', 'blue');
  log('Validation Results', 'blue');
  log('========================================\n', 'blue');

  let hasFailures = false;
  let hasWarnings = false;

  for (const result of results) {
    const icon =
      result.status === 'pass' ? '✓' : result.status === 'fail' ? '✗' : '⚠';
    const color =
      result.status === 'pass'
        ? 'green'
        : result.status === 'fail'
          ? 'red'
          : 'yellow';

    const versionStr = result.version ? ` (${result.version})` : '';
    const messageStr = result.message ? ` - ${result.message}` : '';

    log(`${icon} ${result.name}${versionStr}${messageStr}`, color);

    if (result.status === 'fail') hasFailures = true;
    if (result.status === 'warning') hasWarnings = true;
  }

  log('\n========================================\n', 'blue');

  if (hasFailures) {
    log('❌ Validation failed. Please fix the errors above.', 'red');
    process.exit(1);
  } else if (hasWarnings) {
    log('⚠️  Validation passed with warnings.', 'yellow');
    log('Some optional dependencies are missing or need attention.', 'yellow');
    process.exit(0);
  } else {
    log('✅ All validations passed!', 'green');
    log('System is ready for deployment.', 'green');
    process.exit(0);
  }
}

// Run validation
validateDependencies().catch((error) => {
  log(`\n❌ Validation error: ${error.message}`, 'red');
  process.exit(1);
});
