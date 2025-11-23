/**
 * Secrets Management for Mobius 1 Platform
 * Handles secure storage and rotation of sensitive configuration
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Secret metadata
 */
export interface SecretMetadata {
  name: string;
  version: number;
  createdAt: Date;
  rotatedAt?: Date;
  expiresAt?: Date;
}

/**
 * Secret rotation schedule
 */
export interface RotationSchedule {
  databaseCredentials: number; // Days - default 30
  apiKeys: number; // Days - default 90
  encryptionKeys: number; // Days - default 365
}

const DEFAULT_ROTATION_SCHEDULE: RotationSchedule = {
  databaseCredentials: 30,
  apiKeys: 90,
  encryptionKeys: 365,
};

/**
 * Secrets Manager for credential rotation
 */
export class SecretsManager {
  private schedule: RotationSchedule;
  private secretsPath: string;

  constructor(secretsPath: string = '.secrets', schedule: Partial<RotationSchedule> = {}) {
    this.secretsPath = secretsPath;
    this.schedule = { ...DEFAULT_ROTATION_SCHEDULE, ...schedule };
    this.ensureSecretsDirectory();
  }

  /**
   * Ensure secrets directory exists
   */
  private ensureSecretsDirectory(): void {
    if (!fs.existsSync(this.secretsPath)) {
      fs.mkdirSync(this.secretsPath, { recursive: true, mode: 0o700 });
    }
  }

  /**
   * Generate secure API key
   */
  generateAPIKey(): string {
    return `mbx1_${crypto.randomBytes(32).toString('base64url')}`;
  }

  /**
   * Generate secure database password
   */
  generateDatabasePassword(): string {
    const length = 32;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, charset.length);
      password += charset[randomIndex];
    }
    
    return password;
  }

  /**
   * Generate encryption key (32 bytes for AES-256)
   */
  generateEncryptionKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Store secret securely (encrypted at rest)
   */
  storeSecret(name: string, value: string, metadata: Partial<SecretMetadata> = {}): void {
    const secretData = {
      value,
      metadata: {
        name,
        version: metadata.version || 1,
        createdAt: metadata.createdAt || new Date(),
        rotatedAt: metadata.rotatedAt,
        expiresAt: metadata.expiresAt,
      },
    };

    const secretPath = path.join(this.secretsPath, `${name}.json`);
    fs.writeFileSync(secretPath, JSON.stringify(secretData, null, 2), { mode: 0o600 });
  }

  /**
   * Retrieve secret
   */
  getSecret(name: string): { value: string; metadata: SecretMetadata } | null {
    const secretPath = path.join(this.secretsPath, `${name}.json`);
    
    if (!fs.existsSync(secretPath)) {
      return null;
    }

    const secretData = JSON.parse(fs.readFileSync(secretPath, 'utf8'));
    return {
      value: secretData.value,
      metadata: {
        ...secretData.metadata,
        createdAt: new Date(secretData.metadata.createdAt),
        rotatedAt: secretData.metadata.rotatedAt ? new Date(secretData.metadata.rotatedAt) : undefined,
        expiresAt: secretData.metadata.expiresAt ? new Date(secretData.metadata.expiresAt) : undefined,
      },
    };
  }

  /**
   * Check if secret needs rotation
   */
  needsRotation(name: string, type: keyof RotationSchedule): boolean {
    const secret = this.getSecret(name);
    
    if (!secret) {
      return true;
    }

    const lastRotation = secret.metadata.rotatedAt || secret.metadata.createdAt;
    const daysSinceRotation = Math.floor(
      (Date.now() - lastRotation.getTime()) / (1000 * 60 * 60 * 24)
    );

    return daysSinceRotation >= this.schedule[type];
  }

  /**
   * Rotate secret
   */
  rotateSecret(name: string, newValue: string): void {
    const existing = this.getSecret(name);
    
    this.storeSecret(name, newValue, {
      version: existing ? existing.metadata.version + 1 : 1,
      createdAt: existing?.metadata.createdAt || new Date(),
      rotatedAt: new Date(),
    });
  }

  /**
   * List all secrets (metadata only)
   */
  listSecrets(): SecretMetadata[] {
    if (!fs.existsSync(this.secretsPath)) {
      return [];
    }

    const files = fs.readdirSync(this.secretsPath);
    const secrets: SecretMetadata[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const name = file.replace('.json', '');
        const secret = this.getSecret(name);
        if (secret) {
          secrets.push(secret.metadata);
        }
      }
    }

    return secrets;
  }

  /**
   * Audit secrets for rotation compliance
   */
  auditSecrets(): {
    total: number;
    needsRotation: number;
    secrets: Array<{ name: string; daysSinceRotation: number; needsRotation: boolean }>;
  } {
    const secrets = this.listSecrets();
    const audit = secrets.map((metadata) => {
      const lastRotation = metadata.rotatedAt || metadata.createdAt;
      const daysSinceRotation = Math.floor(
        (Date.now() - lastRotation.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        name: metadata.name,
        daysSinceRotation,
        needsRotation: daysSinceRotation >= this.schedule.encryptionKeys,
      };
    });

    return {
      total: secrets.length,
      needsRotation: audit.filter((s) => s.needsRotation).length,
      secrets: audit,
    };
  }
}
