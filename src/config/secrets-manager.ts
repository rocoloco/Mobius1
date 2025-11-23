/**
 * Secrets Manager for Mobius 1 Platform
 * Handles secure secrets storage, rotation, and lifecycle management
 * 
 * Features:
 * - Automated secret rotation with configurable intervals
 * - Secure in-memory caching with TTL
 * - Audit logging for all secret access
 * - Support for multiple secret backends (file, env, external vault)
 */

import { readFile, writeFile, access, constants } from 'fs/promises';
import { createHash, randomBytes } from 'crypto';
import { join } from 'path';
import { auditLogger } from '../audit/logger.js';
import { appConfig } from './index.js';

export interface SecretMetadata {
  name: string;
  version: number;
  createdAt: Date;
  expiresAt: Date;
  rotationInterval: number; // in days
  lastRotated: Date;
  algorithm?: string;
}

export interface SecretValue {
  value: string;
  metadata: SecretMetadata;
}

interface CachedSecret {
  value: string;
  expiresAt: number;
}

/**
 * Secrets Manager Service
 * Manages lifecycle of cryptographic secrets and sensitive configuration
 */
export class SecretsManager {
  private cache = new Map<string, CachedSecret>();
  private readonly cacheTTL = 300000; // 5 minutes
  private readonly secretsPath: string;
  private rotationTimers = new Map<string, NodeJS.Timeout>();

  constructor(secretsPath = './keys') {
    this.secretsPath = secretsPath;
  }

  /**
   * Initialize secrets manager and start rotation timers
   */
  async initialize(): Promise<void> {
    await auditLogger.log({
      eventType: 'secrets.manager.initialized',
      userId: 'system',
      workspaceId: 'system',
      resourceType: 'secrets',
      resourceId: 'manager',
      action: 'initialize',
      outcome: 'success',
      metadata: { secretsPath: this.secretsPath },
    });
  }

  /**
   * Get a secret by name with caching
   */
  async getSecret(name: string, userId: string, workspaceId: string): Promise<string> {
    // Check cache first
    const cached = this.cache.get(name);
    if (cached && cached.expiresAt > Date.now()) {
      await this.auditSecretAccess(name, userId, workspaceId, 'cache_hit');
      return cached.value;
    }

    // Load from storage
    const secret = await this.loadSecret(name);
    
    // Cache the value
    this.cache.set(name, {
      value: secret,
      expiresAt: Date.now() + this.cacheTTL,
    });

    await this.auditSecretAccess(name, userId, workspaceId, 'loaded');
    return secret;
  }

  /**
   * Set or update a secret
   */
  async setSecret(
    name: string,
    value: string,
    userId: string,
    workspaceId: string,
    rotationInterval = 90
  ): Promise<void> {
    const metadata: SecretMetadata = {
      name,
      version: 1,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + rotationInterval * 24 * 60 * 60 * 1000),
      rotationInterval,
      lastRotated: new Date(),
    };

    await this.saveSecret(name, value, metadata);
    
    // Invalidate cache
    this.cache.delete(name);

    await auditLogger.log({
      eventType: 'secrets.secret.updated',
      userId,
      workspaceId,
      resourceType: 'secret',
      resourceId: name,
      action: 'update',
      outcome: 'success',
      metadata: { rotationInterval },
    });
  }

  /**
   * Rotate a secret (generate new value)
   */
  async rotateSecret(
    name: string,
    userId: string,
    workspaceId: string,
    generator?: () => Promise<string>
  ): Promise<string> {
    const newValue = generator ? await generator() : this.generateSecureSecret();
    
    const metadata = await this.getSecretMetadata(name);
    metadata.version += 1;
    metadata.lastRotated = new Date();
    metadata.expiresAt = new Date(
      Date.now() + metadata.rotationInterval * 24 * 60 * 60 * 1000
    );

    await this.saveSecret(name, newValue, metadata);
    this.cache.delete(name);

    await auditLogger.log({
      eventType: 'secrets.secret.rotated',
      userId,
      workspaceId,
      resourceType: 'secret',
      resourceId: name,
      action: 'rotate',
      outcome: 'success',
      metadata: { version: metadata.version },
    });

    return newValue;
  }

  /**
   * Schedule automatic rotation for a secret
   */
  scheduleRotation(
    name: string,
    intervalDays: number,
    userId: string,
    workspaceId: string,
    generator?: () => Promise<string>
  ): void {
    // Clear existing timer if any
    const existingTimer = this.rotationTimers.get(name);
    if (existingTimer) {
      clearInterval(existingTimer);
    }

    // Schedule new rotation
    const intervalMs = intervalDays * 24 * 60 * 60 * 1000;
    const timer = setInterval(async () => {
      try {
        await this.rotateSecret(name, userId, workspaceId, generator);
      } catch (error) {
        await auditLogger.log({
          eventType: 'secrets.rotation.failed',
          userId,
          workspaceId,
          resourceType: 'secret',
          resourceId: name,
          action: 'rotate',
          outcome: 'failure',
          metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
        });
      }
    }, intervalMs);

    this.rotationTimers.set(name, timer);
  }

  /**
   * Check if secrets need rotation
   */
  async checkRotationNeeded(): Promise<string[]> {
    const needsRotation: string[] = [];
    
    // This would scan all secrets and check expiration
    // For now, return empty array as placeholder
    
    return needsRotation;
  }

  /**
   * Generate a cryptographically secure secret
   */
  private generateSecureSecret(length = 32): string {
    return randomBytes(length).toString('base64');
  }

  /**
   * Load secret from storage
   */
  private async loadSecret(name: string): Promise<string> {
    // Try environment variable first
    const envValue = process.env[name];
    if (envValue) {
      return envValue;
    }

    // Try file-based secret
    const secretPath = join(this.secretsPath, `${name}.secret`);
    try {
      await access(secretPath, constants.R_OK);
      const content = await readFile(secretPath, 'utf-8');
      return content.trim();
    } catch {
      throw new Error(`Secret not found: ${name}`);
    }
  }

  /**
   * Save secret to storage
   */
  private async saveSecret(
    name: string,
    value: string,
    metadata: SecretMetadata
  ): Promise<void> {
    const secretPath = join(this.secretsPath, `${name}.secret`);
    const metadataPath = join(this.secretsPath, `${name}.meta.json`);

    await writeFile(secretPath, value, { mode: 0o600 });
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2), { mode: 0o600 });
  }

  /**
   * Get secret metadata
   */
  private async getSecretMetadata(name: string): Promise<SecretMetadata> {
    const metadataPath = join(this.secretsPath, `${name}.meta.json`);
    try {
      const content = await readFile(metadataPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      // Return default metadata if not found
      return {
        name,
        version: 0,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        rotationInterval: 90,
        lastRotated: new Date(),
      };
    }
  }

  /**
   * Audit secret access
   */
  private async auditSecretAccess(
    name: string,
    userId: string,
    workspaceId: string,
    source: string
  ): Promise<void> {
    await auditLogger.log({
      eventType: 'secrets.secret.accessed',
      userId,
      workspaceId,
      resourceType: 'secret',
      resourceId: name,
      action: 'read',
      outcome: 'success',
      metadata: { source },
    });
  }

  /**
   * Clear cache (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Cleanup and stop all rotation timers
   */
  async shutdown(): Promise<void> {
    for (const timer of this.rotationTimers.values()) {
      clearInterval(timer);
    }
    this.rotationTimers.clear();
    this.cache.clear();

    await auditLogger.log({
      eventType: 'secrets.manager.shutdown',
      userId: 'system',
      workspaceId: 'system',
      resourceType: 'secrets',
      resourceId: 'manager',
      action: 'shutdown',
      outcome: 'success',
      metadata: {},
    });
  }
}

/**
 * Singleton instance
 */
export const secretsManager = new SecretsManager();
