/**
 * Configuration Management for Mobius 1 Platform
 * Handles environment variables, secrets, and application configuration
 * with validation and type safety.
 */

import { config } from 'dotenv';
import { z } from 'zod';

// Load environment variables
config();

/**
 * Configuration schema with validation
 * Ensures all required environment variables are present and valid
 */
const configSchema = z.object({
  // Database Configuration
  database: z.object({
    url: z.string().url('Invalid DATABASE_URL'),
  }),

  // Redis Configuration
  redis: z.object({
    url: z.string().url('Invalid REDIS_URL'),
  }),

  // MinIO Configuration
  minio: z.object({
    endpoint: z.string().min(1, 'MINIO_ENDPOINT is required'),
    port: z.coerce.number().int().positive('Invalid MINIO_PORT'),
    accessKey: z.string().min(1, 'MINIO_ACCESS_KEY is required'),
    secretKey: z.string().min(1, 'MINIO_SECRET_KEY is required'),
    useSSL: z.coerce.boolean(),
  }),

  // Qdrant Configuration
  qdrant: z.object({
    url: z.string().url('Invalid QDRANT_URL'),
  }),

  // Application Configuration
  app: z.object({
    nodeEnv: z.enum(['development', 'production', 'test']),
    port: z.coerce.number().int().positive('Invalid PORT'),
    host: z.string().min(1, 'HOST is required'),
  }),

  // Security Configuration
  security: z.object({
    jwtSecret: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    encryptionKey: z.string().length(32, 'ENCRYPTION_KEY must be exactly 32 characters'),
  }),

  // Compliance Configuration
  compliance: z.object({
    spainResidencyMode: z.coerce.boolean(),
    aesiaVersion: z.enum(['aesia-1.0', 'aesia-1.1']),
    privateKeyPath: z.string().optional(),
    publicKeyPath: z.string().optional(),
    enableDigitalSigning: z.coerce.boolean(),
    auditPackageRetentionDays: z.coerce.number().int().positive(),
  }),

  // Logging Configuration
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']),
    redactPII: z.coerce.boolean(),
  }),

  // Audit Configuration
  audit: z.object({
    retentionDays: z.coerce.number().int().positive('Invalid AUDIT_RETENTION_DAYS'),
  }),

  // Runtime Configuration
  runtime: z.object({
    defaultBackend: z.enum(['vllm', 'ollama', 'nvidia-nim']),
    vllmEnabled: z.coerce.boolean(),
    vllmEndpoint: z.string().optional(),
    vllmApiKey: z.string().optional(),
    vllmMaxModels: z.coerce.number().int().positive().optional(),
    ollamaEndpoint: z.string().optional(),
    ollamaModelPath: z.string().optional(),
    ollamaMaxModels: z.coerce.number().int().positive().optional(),
    nvidiaEnabled: z.coerce.boolean(),
    nvidiaEndpoint: z.string().optional(),
    nvidiaApiKey: z.string().optional(),
    nvidiaOrgId: z.string().optional(),
    metricsInterval: z.coerce.number().int().positive(),
    healthCheckInterval: z.coerce.number().int().positive(),
    maxConcurrentInferences: z.coerce.number().int().positive(),
    defaultTimeoutMs: z.coerce.number().int().positive(),
  }),
});

/**
 * Parse and validate configuration from environment variables
 */
function parseConfig() {
  const rawConfig = {
    database: {
      url: process.env.DATABASE_URL,
    },
    redis: {
      url: process.env.REDIS_URL,
    },
    minio: {
      endpoint: process.env.MINIO_ENDPOINT,
      port: process.env.MINIO_PORT,
      accessKey: process.env.MINIO_ACCESS_KEY,
      secretKey: process.env.MINIO_SECRET_KEY,
      useSSL: process.env.MINIO_USE_SSL,
    },
    qdrant: {
      url: process.env.QDRANT_URL,
    },
    app: {
      nodeEnv: process.env.NODE_ENV || 'development',
      port: process.env.PORT || '3000',
      host: process.env.HOST || '0.0.0.0',
    },
    security: {
      jwtSecret: process.env.JWT_SECRET,
      encryptionKey: process.env.ENCRYPTION_KEY,
    },
    compliance: {
      spainResidencyMode: process.env.SPAIN_RESIDENCY_MODE || 'true',
      aesiaVersion: process.env.AESIA_VERSION || 'aesia-1.0',
      privateKeyPath: process.env.COMPLIANCE_PRIVATE_KEY_PATH,
      publicKeyPath: process.env.COMPLIANCE_PUBLIC_KEY_PATH,
      enableDigitalSigning: process.env.COMPLIANCE_ENABLE_SIGNING || 'true',
      auditPackageRetentionDays: process.env.COMPLIANCE_AUDIT_RETENTION_DAYS || '2555',
    },
    logging: {
      level: process.env.LOG_LEVEL || 'info',
      redactPII: process.env.LOG_REDACT_PII || 'true',
    },
    audit: {
      retentionDays: process.env.AUDIT_RETENTION_DAYS || '2555',
    },
    runtime: {
      defaultBackend: process.env.RUNTIME_DEFAULT_BACKEND || 'ollama',
      vllmEnabled: process.env.VLLM_ENABLED || 'false',
      vllmEndpoint: process.env.VLLM_ENDPOINT,
      vllmApiKey: process.env.VLLM_API_KEY,
      vllmMaxModels: process.env.VLLM_MAX_MODELS || '5',
      ollamaEndpoint: process.env.OLLAMA_ENDPOINT || 'http://localhost:11434',
      ollamaModelPath: process.env.OLLAMA_MODEL_PATH || '/models',
      ollamaMaxModels: process.env.OLLAMA_MAX_MODELS || '3',
      nvidiaEnabled: process.env.NVIDIA_NIM_ENABLED || 'false',
      nvidiaEndpoint: process.env.NVIDIA_NIM_ENDPOINT,
      nvidiaApiKey: process.env.NVIDIA_NIM_API_KEY,
      nvidiaOrgId: process.env.NVIDIA_NIM_ORG_ID,
      metricsInterval: process.env.RUNTIME_METRICS_INTERVAL || '30000',
      healthCheckInterval: process.env.RUNTIME_HEALTH_CHECK_INTERVAL || '60000',
      maxConcurrentInferences: process.env.RUNTIME_MAX_CONCURRENT || '50',
      defaultTimeoutMs: process.env.RUNTIME_DEFAULT_TIMEOUT || '30000',
    },
  };

  try {
    return configSchema.parse(rawConfig);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map((err) => `${err.path.join('.')}: ${err.message}`);
      throw new Error(`Configuration validation failed:\n${errorMessages.join('\n')}`);
    }
    throw error;
  }
}

/**
 * Application configuration singleton
 * Validated configuration object available throughout the application
 */
export const appConfig = parseConfig();

/**
 * Type definition for the configuration object
 */
export type AppConfig = typeof appConfig;

/**
 * Utility function to check if running in production
 */
export const isProduction = () => appConfig.app.nodeEnv === 'production';

/**
 * Utility function to check if running in development
 */
export const isDevelopment = () => appConfig.app.nodeEnv === 'development';

/**
 * Utility function to check if running in test mode
 */
export const isTest = () => appConfig.app.nodeEnv === 'test';

/**
 * Utility function to check if Spain residency mode is enabled
 */
export const isSpainResidencyMode = () => appConfig.compliance.spainResidencyMode;

/**
 * Utility function to check if PII redaction is enabled
 */
export const isPIIRedactionEnabled = () => appConfig.logging.redactPII;