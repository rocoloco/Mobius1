/**
 * TLS Configuration for Mobius 1 Platform
 * Enforces TLS 1.3 with secure cipher suites
 */

import fs from 'fs';
import { SecureContextOptions } from 'tls';

/**
 * TLS 1.3 cipher suites (recommended by NIST)
 */
const TLS_13_CIPHER_SUITES = [
  'TLS_AES_256_GCM_SHA384',
  'TLS_CHACHA20_POLY1305_SHA256',
  'TLS_AES_128_GCM_SHA256',
].join(':');

/**
 * TLS configuration options
 */
export interface TLSConfig {
  certPath?: string;
  keyPath?: string;
  caPath?: string;
  minVersion?: string;
  cipherSuites?: string;
}

/**
 * Create secure TLS options for Fastify
 */
export function createTLSOptions(config: TLSConfig): SecureContextOptions | null {
  // Skip TLS in development if no certs provided
  if (!config.certPath || !config.keyPath) {
    return null;
  }

  try {
    const options: SecureContextOptions = {
      cert: fs.readFileSync(config.certPath),
      key: fs.readFileSync(config.keyPath),
      minVersion: 'TLSv1.3',
      ciphers: TLS_13_CIPHER_SUITES,
      honorCipherOrder: true,
      secureOptions: 
        // Disable older protocols
        crypto.constants.SSL_OP_NO_SSLv2 |
        crypto.constants.SSL_OP_NO_SSLv3 |
        crypto.constants.SSL_OP_NO_TLSv1 |
        crypto.constants.SSL_OP_NO_TLSv1_1 |
        crypto.constants.SSL_OP_NO_TLSv1_2,
    };

    // Add CA certificate if provided (for mutual TLS)
    if (config.caPath) {
      options.ca = fs.readFileSync(config.caPath);
      options.requestCert = true;
      options.rejectUnauthorized = true;
    }

    return options;
  } catch (error) {
    throw new Error(`Failed to load TLS certificates: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate TLS configuration
 */
export function validateTLSConfig(config: TLSConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.certPath && !fs.existsSync(config.certPath)) {
    errors.push(`Certificate file not found: ${config.certPath}`);
  }

  if (config.keyPath && !fs.existsSync(config.keyPath)) {
    errors.push(`Private key file not found: ${config.keyPath}`);
  }

  if (config.caPath && !fs.existsSync(config.caPath)) {
    errors.push(`CA certificate file not found: ${config.caPath}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

import crypto from 'crypto';
