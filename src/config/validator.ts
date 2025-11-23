/**
 * Configuration Validator for Mobius 1 Platform
 * Validates deployment configuration and dependencies before startup
 * 
 * Features:
 * - Pre-deployment validation checks
 * - Dependency verification (database, Redis, MinIO, Qdrant)
 * - Security configuration validation
 * - Environment consistency checks
 */

import { z } from 'zod';
import { appConfig } from './index.js';
import { auditLogger } from '../audit/logger.js';
import { readFile, access, constants } from 'fs/promises';
import { createConnection } from 'net';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  category: string;
  message: string;
  severity: 'critical' | 'error';
  fix?: string;
}

export interface ValidationWarning {
  category: string;
  message: string;
  recommendation?: string;
}

/**
 * Configuration Validator Service
 */
export class ConfigValidator {
  /**
   * Run all validation checks
   */
  async validate(): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Run all validation checks
    await this.validateSecurityConfig(errors, warnings);
    await this.validateDatabaseConfig(errors, warnings);
    await this.validateRedisConfig(errors, warnings);
    await this.validateMinIOConfig(errors, warnings);
    await this.validateQdrantConfig(errors, warnings);
    await this.validateComplianceConfig(errors, warnings);
    await this.validateRuntimeConfig(errors, warnings);
    await this.validateSecretsPresence(errors, warnings);

    const valid = errors.length === 0;

    await auditLogger.log({
      eventType: 'config.validation.completed',
      userId: 'system',
      workspaceId: 'system',
      resourceType: 'configuration',
      resourceId: 'validator',
      action: 'validate',
      outcome: valid ? 'success' : 'failure',
      metadata: {
        errorCount: errors.length,
        warningCount: warnings.length,
      },
    });

    return { valid, errors, warnings };
  }

  /**
   * Validate security configuration
   */
  private async validateSecurityConfig(
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    // Check JWT secret strength
    if (appConfig.security.jwtSecret.length < 32) {
      errors.push({
        category: 'security',
        message: 'JWT_SECRET must be at least 32 characters',
        severity: 'critical',
        fix: 'Generate a strong secret: openssl rand -base64 32',
      });
    }

    // Check encryption key
    if (appConfig.security.encryptionKey.length !== 32) {
      errors.push({
        category: 'security',
        message: 'ENCRYPTION_KEY must be exactly 32 characters for AES-256',
        severity: 'critical',
        fix: 'Generate encryption key: openssl rand -hex 16',
      });
    }

    // Check TLS configuration in production
    if (appConfig.app.nodeEnv === 'production' && !appConfig.security.tlsEnabled) {
      warnings.push({
        category: 'security',
        message: 'TLS is not enabled in production',
        recommendation: 'Enable TLS for production deployments',
      });
    }

    // Validate TLS certificates if enabled
    if (appConfig.security.tlsEnabled) {
      try {
        await access(appConfig.security.tlsCertPath, constants.R_OK);
        await access(appConfig.security.tlsKeyPath, constants.R_OK);
      } catch {
        errors.push({
          category: 'security',
          message: 'TLS certificates not found or not readable',
          severity: 'error',
          fix: 'Run: npm run security:generate-certs',
        });
      }
    }
  }

  /**
   * Validate database configuration
   */
  private async validateDatabaseConfig(
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    try {
      const url = new URL(appConfig.database.url);
      
      if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
        errors.push({
          category: 'database',
          message: 'Invalid database protocol, must be PostgreSQL',
          severity: 'critical',
        });
      }

      // Check if using default credentials in production
      if (appConfig.app.nodeEnv === 'production') {
        if (url.password === 'mobius1_dev' || url.username === 'mobius1') {
          warnings.push({
            category: 'database',
            message: 'Using default database credentials in production',
            recommendation: 'Change to secure credentials',
          });
        }
      }
    } catch {
      errors.push({
        category: 'database',
        message: 'Invalid DATABASE_URL format',
        severity: 'critical',
        fix: 'Format: postgresql://user:password@host:port/database',
      });
    }
  }

  /**
   * Validate Redis configuration
   */
  private async validateRedisConfig(
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    try {
      const url = new URL(appConfig.redis.url);
      
      if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') {
        errors.push({
          category: 'redis',
          message: 'Invalid Redis protocol',
          severity: 'error',
        });
      }

      // Warn about unencrypted Redis in production
      if (appConfig.app.nodeEnv === 'production' && url.protocol === 'redis:') {
        warnings.push({
          category: 'redis',
          message: 'Using unencrypted Redis connection in production',
          recommendation: 'Use rediss:// for TLS-encrypted connections',
        });
      }
    } catch {
      errors.push({
        category: 'redis',
        message: 'Invalid REDIS_URL format',
        severity: 'error',
        fix: 'Format: redis://host:port or rediss://host:port',
      });
    }
  }

  /**
   * Validate MinIO configuration
   */
  private async validateMinIOConfig(
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    if (!appConfig.minio.endpoint) {
      errors.push({
        category: 'minio',
        message: 'MINIO_ENDPOINT is required',
        severity: 'error',
      });
    }

    if (appConfig.minio.port <= 0 || appConfig.minio.port > 65535) {
      errors.push({
        category: 'minio',
        message: 'Invalid MINIO_PORT',
        severity: 'error',
      });
    }

    // Check default credentials in production
    if (appConfig.app.nodeEnv === 'production') {
      if (
        appConfig.minio.accessKey === 'minioadmin' ||
        appConfig.minio.secretKey === 'minioadmin'
      ) {
        warnings.push({
          category: 'minio',
          message: 'Using default MinIO credentials in production',
          recommendation: 'Change to secure credentials',
        });
      }
    }

    // Warn about SSL in production
    if (appConfig.app.nodeEnv === 'production' && !appConfig.minio.useSSL) {
      warnings.push({
        category: 'minio',
        message: 'MinIO SSL is disabled in production',
        recommendation: 'Enable SSL for production deployments',
      });
    }
  }

  /**
   * Validate Qdrant configuration
   */
  private async validateQdrantConfig(
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    try {
      const url = new URL(appConfig.qdrant.url);
      
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        errors.push({
          category: 'qdrant',
          message: 'Invalid Qdrant URL protocol',
          severity: 'error',
        });
      }

      // Warn about HTTP in production
      if (appConfig.app.nodeEnv === 'production' && url.protocol === 'http:') {
        warnings.push({
          category: 'qdrant',
          message: 'Using unencrypted Qdrant connection in production',
          recommendation: 'Use HTTPS for production deployments',
        });
      }
    } catch {
      errors.push({
        category: 'qdrant',
        message: 'Invalid QDRANT_URL format',
        severity: 'error',
        fix: 'Format: http://host:port or https://host:port',
      });
    }
  }

  /**
   * Validate compliance configuration
   */
  private async validateComplianceConfig(
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    // Check compliance keys if signing is enabled
    if (appConfig.compliance.enableSigning) {
      try {
        await access(appConfig.compliance.privateKeyPath, constants.R_OK);
        await access(appConfig.compliance.publicKeyPath, constants.R_OK);
      } catch {
        errors.push({
          category: 'compliance',
          message: 'Compliance signing keys not found',
          severity: 'error',
          fix: 'Run: npm run security:generate-keys',
        });
      }
    }

    // Validate audit retention
    if (appConfig.compliance.auditRetentionDays < 2555) {
      warnings.push({
        category: 'compliance',
        message: 'Audit retention is less than 7 years (GDPR requirement)',
        recommendation: 'Set COMPLIANCE_AUDIT_RETENTION_DAYS to at least 2555',
      });
    }
  }

  /**
   * Validate runtime configuration
   */
  private async validateRuntimeConfig(
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    const backend = appConfig.runtime.defaultBackend;

    if (backend === 'vllm' && !appConfig.runtime.vllm.enabled) {
      errors.push({
        category: 'runtime',
        message: 'vLLM is set as default backend but not enabled',
        severity: 'error',
        fix: 'Set VLLM_ENABLED=true or change RUNTIME_DEFAULT_BACKEND',
      });
    }

    if (backend === 'nvidia-nim' && !appConfig.runtime.nvidia.enabled) {
      errors.push({
        category: 'runtime',
        message: 'NVIDIA NIM is set as default backend but not enabled',
        severity: 'error',
        fix: 'Set NVIDIA_NIM_ENABLED=true or change RUNTIME_DEFAULT_BACKEND',
      });
    }
  }

  /**
   * Validate presence of required secrets
   */
  private async validateSecretsPresence(
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    const requiredSecrets = ['JWT_SECRET', 'ENCRYPTION_KEY'];

    for (const secret of requiredSecrets) {
      if (!process.env[secret]) {
        errors.push({
          category: 'secrets',
          message: `Required secret ${secret} is not set`,
          severity: 'critical',
          fix: `Set ${secret} in .env file`,
        });
      }
    }
  }

  /**
   * Test connectivity to a service
   */
  private async testConnection(host: string, port: number, timeout = 5000): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = createConnection({ host, port, timeout });
      
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });

      socket.on('error', () => {
        resolve(false);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
    });
  }
}

/**
 * Singleton instance
 */
export const configValidator = new ConfigValidator();

/**
 * Validate configuration and throw if invalid
 */
export async function validateOrThrow(): Promise<void> {
  const result = await configValidator.validate();

  if (!result.valid) {
    const errorMessages = result.errors.map(
      (e) => `[${e.category}] ${e.message}${e.fix ? ` - Fix: ${e.fix}` : ''}`
    );
    throw new Error(`Configuration validation failed:\n${errorMessages.join('\n')}`);
  }

  // Log warnings
  if (result.warnings.length > 0) {
    console.warn('Configuration warnings:');
    result.warnings.forEach((w) => {
      console.warn(`[${w.category}] ${w.message}`);
      if (w.recommendation) {
        console.warn(`  Recommendation: ${w.recommendation}`);
      }
    });
  }
}
