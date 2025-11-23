/**
 * Key Manager Tests
 * Tests encryption key lifecycle and rotation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { KeyManager } from '../../src/security/key-manager.js';

// Mock Prisma Client
const mockDb = {
  workspace: {
    findUnique: async ({ where }: any) => {
      if (where.id === 'test-workspace') {
        return {
          id: 'test-workspace',
          encryptionContext: 'test-context-32-chars-long-hex',
          updatedAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000), // 100 days ago
        };
      }
      return null;
    },
    update: async ({ where, data }: any) => {
      return {
        id: where.id,
        encryptionContext: data.encryptionContext,
        updatedAt: data.updatedAt,
      };
    },
  },
} as unknown as PrismaClient;

describe('KeyManager', () => {
  let keyManager: KeyManager;

  beforeEach(() => {
    keyManager = new KeyManager(mockDb, {
      workspaceKeyRotationDays: 90,
      masterKeyRotationDays: 365,
      retiredKeyRetentionDays: 30,
    });
  });

  describe('Workspace Context Generation', () => {
    it('should generate workspace-specific context', () => {
      const context1 = keyManager.generateWorkspaceContext('workspace-1');
      const context2 = keyManager.generateWorkspaceContext('workspace-2');

      expect(context1).not.toBe(context2);
      expect(context1.length).toBe(32);
      expect(context2.length).toBe(32);
    });

    it('should generate consistent context for same workspace', () => {
      const context1 = keyManager.generateWorkspaceContext('workspace-1');
      const context2 = keyManager.generateWorkspaceContext('workspace-1');

      expect(context1).toBe(context2);
    });

    it('should generate hex string', () => {
      const context = keyManager.generateWorkspaceContext('test');
      expect(context).toMatch(/^[a-f0-9]{32}$/);
    });
  });

  describe('Key Rotation Detection', () => {
    it('should detect when key needs rotation', async () => {
      const needsRotation = await keyManager.needsRotation('test-workspace');
      expect(needsRotation).toBe(true); // 100 days > 90 days policy
    });

    it('should throw error for non-existent workspace', async () => {
      await expect(keyManager.needsRotation('non-existent')).rejects.toThrow(
        'Workspace not found'
      );
    });
  });

  describe('Key Rotation', () => {
    it('should rotate workspace key', async () => {
      const newContext = await keyManager.rotateWorkspaceKey('test-workspace');

      expect(newContext).toBeDefined();
      expect(newContext.length).toBeGreaterThan(0);
    });

    it('should generate different context on rotation', async () => {
      const context1 = await keyManager.getWorkspaceContext('test-workspace');
      const context2 = await keyManager.rotateWorkspaceKey('test-workspace');

      expect(context1).not.toBe(context2);
    });
  });

  describe('Context Retrieval', () => {
    it('should retrieve workspace context', async () => {
      const context = await keyManager.getWorkspaceContext('test-workspace');

      expect(context).toBe('test-context-32-chars-long-hex');
    });

    it('should throw error for non-existent workspace', async () => {
      await expect(keyManager.getWorkspaceContext('non-existent')).rejects.toThrow(
        'Workspace not found'
      );
    });
  });

  describe('Key Usage Audit', () => {
    it('should audit key usage', async () => {
      const audit = await keyManager.auditKeyUsage('test-workspace');

      expect(audit.workspaceId).toBe('test-workspace');
      expect(audit.encryptionContext).toBe('test-context-32-chars-long-hex');
      expect(audit.daysSinceRotation).toBeGreaterThan(90);
      expect(audit.needsRotation).toBe(true);
    });

    it('should calculate days since rotation correctly', async () => {
      const audit = await keyManager.auditKeyUsage('test-workspace');

      expect(audit.daysSinceRotation).toBeGreaterThanOrEqual(99);
      expect(audit.daysSinceRotation).toBeLessThanOrEqual(101);
    });
  });
});
