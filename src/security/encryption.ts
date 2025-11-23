/**
 * Encryption Service for Mobius 1 Platform
 * Provides AES-256-GCM encryption for PII data with workspace-specific keys
 * Supports key rotation and envelope encryption pattern
 */

import crypto from 'crypto';
import { appConfig } from '../config/index.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Encrypted data structure
 */
export interface EncryptedData {
  ciphertext: string; // Base64 encoded
  iv: string; // Base64 encoded
  authTag: string; // Base64 encoded
  salt: string; // Base64 encoded
  version: string; // Encryption version for key rotation
}

/**
 * Key derivation using PBKDF2
 */
function deriveKey(masterKey: string, salt: Buffer, workspaceContext?: string): Buffer {
  const keyMaterial = workspaceContext ? `${masterKey}:${workspaceContext}` : masterKey;
  return crypto.pbkdf2Sync(keyMaterial, salt, 100000, 32, 'sha256');
}

/**
 * Encrypt sensitive data with AES-256-GCM
 * Uses workspace-specific encryption context for isolation
 */
export function encrypt(plaintext: string, workspaceContext?: string): EncryptedData {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveKey(appConfig.security.encryptionKey, salt, workspaceContext);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
  ciphertext += cipher.final('base64');
  
  const authTag = cipher.getAuthTag();

  return {
    ciphertext,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    salt: salt.toString('base64'),
    version: '1.0',
  };
}

/**
 * Decrypt encrypted data
 */
export function decrypt(encrypted: EncryptedData, workspaceContext?: string): string {
  const salt = Buffer.from(encrypted.salt, 'base64');
  const key = deriveKey(appConfig.security.encryptionKey, salt, workspaceContext);
  const iv = Buffer.from(encrypted.iv, 'base64');
  const authTag = Buffer.from(encrypted.authTag, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let plaintext = decipher.update(encrypted.ciphertext, 'base64', 'utf8');
  plaintext += decipher.final('utf8');

  return plaintext;
}

/**
 * Encrypt JSON data for database storage
 */
export function encryptJSON(data: any, workspaceContext?: string): string {
  const plaintext = JSON.stringify(data);
  const encrypted = encrypt(plaintext, workspaceContext);
  return JSON.stringify(encrypted);
}

/**
 * Decrypt JSON data from database
 */
export function decryptJSON<T = any>(encryptedString: string, workspaceContext?: string): T {
  const encrypted = JSON.parse(encryptedString) as EncryptedData;
  const plaintext = decrypt(encrypted, workspaceContext);
  return JSON.parse(plaintext);
}

/**
 * Hash sensitive data for comparison (one-way)
 * Used for content deduplication without storing plaintext
 */
export function hashData(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Generate secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
