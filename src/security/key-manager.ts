/**
 * Key Management Service for Mobius 1 Platform
 * Handles encryption key rotation and workspace key derivation
 */

import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { generateSecureToken } from './encryption.js';

/**
 * Key metadata stored in database
 */
export interface KeyMetadata {
  id: string;
  workspaceId: string;
  version: number;
  createdAt: Date;
  rotatedAt?: Date;
  status: 'active' | 'rotating' | 'retired';
}

/**
 * Key rotation policy
 */
export interface KeyRotationPolicy {
  workspaceKeyRotationDays: number; // Default: 90 days
  masterKeyRotationDays: number; // Default: 365 days
  retiredKeyRetentionDays: number; // Default: 30 days
}

const DEFAULT_ROTATION_POLICY: KeyRotationPolicy = {
  workspaceKeyRotationDays: 90,
  masterKeyRotationDays: 365,
  retiredKeyRetentionDays: 30,
};

/**
 * Key Manager for encryption key lifecycle
 */
export class KeyManager {
  private db: PrismaClient;
  private policy: KeyRotationPolicy;

  constructor(db: PrismaClient, policy: Partial<KeyRotationPolicy> = {}) {
    this.db = db;
    this.policy = { ...DEFAULT_ROTATION_POLICY, ...policy };
  }

  /**
   * Generate workspace-specific encryption context
   * This is used as additional authenticated data (AAD) for encryption
   */
  generateWorkspaceContext(workspaceId: string): string {
    return crypto
      .createHash('sha256')
      .update(`workspace:${workspaceId}`)
      .digest('hex')
      .substring(0, 32);
  }

  /**
   * Check if workspace key needs rotation
   */
  async needsRotation(workspaceId: string): Promise<boolean> {
    const workspace = await this.db.workspace.findUnique({
      where: { id: workspaceId },
      select: { updatedAt: true },
    });

    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    const daysSinceUpdate = Math.floor(
      (Date.now() - workspace.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    return daysSinceUpdate >= this.policy.workspaceKeyRotationDays;
  }

  /**
   * Rotate workspace encryption context
   * This triggers re-encryption of all workspace data
   */
  async rotateWorkspaceKey(workspaceId: string): Promise<string> {
    const newContext = generateSecureToken(32);

    await this.db.workspace.update({
      where: { id: workspaceId },
      data: {
        encryptionContext: newContext,
        updatedAt: new Date(),
      },
    });

    return newContext;
  }

  /**
   * Get active encryption context for workspace
   */
  async getWorkspaceContext(workspaceId: string): Promise<string> {
    const workspace = await this.db.workspace.findUnique({
      where: { id: workspaceId },
      select: { encryptionContext: true },
    });

    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    return workspace.encryptionContext;
  }

  /**
   * Audit key usage for compliance reporting
   */
  async auditKeyUsage(workspaceId: string): Promise<{
    workspaceId: string;
    encryptionContext: string;
    lastRotation: Date;
    daysSinceRotation: number;
    needsRotation: boolean;
  }> {
    const workspace = await this.db.workspace.findUnique({
      where: { id: workspaceId },
      select: { encryptionContext: true, updatedAt: true },
    });

    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    const daysSinceRotation = Math.floor(
      (Date.now() - workspace.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      workspaceId,
      encryptionContext: workspace.encryptionContext,
      lastRotation: workspace.updatedAt,
      daysSinceRotation,
      needsRotation: daysSinceRotation >= this.policy.workspaceKeyRotationDays,
    };
  }
}
