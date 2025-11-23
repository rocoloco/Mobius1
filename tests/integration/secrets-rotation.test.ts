/**
 * Secrets Rotation Integration Tests
 * Tests automated rotation, policies, and lifecycle management
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { secretsManager } from '../../src/config/secrets-manager.js';
import { rotationScheduler } from '../../src/config/rotation-scheduler.js';
import { randomBytes } from 'crypto';

describe('Secrets Rotation Integration Tests', () => {
  beforeAll(async () => {
    await secretsManager.initialize();
    await rotationScheduler.initialize();
  });

  afterAll(async () => {
    await secretsManager.shutdown();
    await rotationScheduler.shutdown();
  });

  beforeEach(() => {
    secretsManager.clearCache();
  });

  describe('Manual Rotation', () => {
    it('should rotate secret manually', async () => {
      const secretName = 'TEST_MANUAL_ROTATION';
      const initialValue = randomBytes(16).toString('base64');

      await secretsManager.setSecret(
        secretName,
        initialValue,
        'test-user',
        'test-workspace',
        90
      );

      const rotatedValue = await secretsManager.rotateSecret(
        secretName,
        'test-user',
        'test-workspace'
      );

      expect(rotatedValue).toBeDefined();
      expect(rotatedValue).not.toBe(initialValue);
      expect(rotatedValue.length).toBeGreaterThan(0);
    });

    it('should generate cryptographically secure secrets', async () => {
      const secret1 = await secretsManager.rotateSecret(
        'TEST_CRYPTO_1',
        'test-user',
        'test-workspace'
      );

      const secret2 = await secretsManager.rotateSecret(
        'TEST_CRYPTO_2',
        'test-user',
        'test-workspace'
      );

      // Should be different
      expect(secret1).not.toBe(secret2);

      // Should be base64 encoded
      expect(secret1).toMatch(/^[A-Za-z0-9+/]+=*$/);
      expect(secret2).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });

    it('should use custom generator for rotation', async () => {
      const customGenerator = async () => 'custom-secret-value';

      const rotatedValue = await secretsManager.rotateSecret(
        'TEST_CUSTOM_GEN',
        'test-user',
        'test-workspace',
        customGenerator
      );

      expect(rotatedValue).toBe('custom-secret-value');
    });

    it('should invalidate cache after rotation', async () => {
      const secretName = 'TEST_CACHE_INVALIDATION';
      const initialValue = 'initial-value';

      await secretsManager.setSecret(
        secretName,
        initialValue,
        'test-user',
        'test-workspace',
        90
      );

      // Get secret to cache it
      const cached = await secretsManager.getSecret(secretName, 'test-user', 'test-workspace');
      expect(cached).toBe(initialValue);

      // Rotate
      const rotated = await secretsManager.rotateSecret(
        secretName,
        'test-user',
        'test-workspace',
        async () => 'rotated-value'
      );

      // Get again - should return new value
      const afterRotation = await secretsManager.getSecret(
        secretName,
        'test-user',
        'test-workspace'
      );

      expect(afterRotation).toBe('rotated-value');
      expect(afterRotation).not.toBe(initialValue);
    });
  });

  describe('Rotation Policies', () => {
    it('should have default policy for JWT_SECRET', () => {
      const policy = rotationScheduler.getPolicy('JWT_SECRET');

      expect(policy).toBeDefined();
      expect(policy?.secretName).toBe('JWT_SECRET');
      expect(policy?.intervalDays).toBe(90);
      expect(policy?.autoRotate).toBe(false);
      expect(policy?.notifyBeforeDays).toBe(14);
    });

    it('should have default policy for ENCRYPTION_KEY', () => {
      const policy = rotationScheduler.getPolicy('ENCRYPTION_KEY');

      expect(policy).toBeDefined();
      expect(policy?.secretName).toBe('ENCRYPTION_KEY');
      expect(policy?.intervalDays).toBe(180);
      expect(policy?.autoRotate).toBe(false);
      expect(policy?.notifyBeforeDays).toBe(30);
    });

    it('should have default policy for MINIO_SECRET_KEY', () => {
      const policy = rotationScheduler.getPolicy('MINIO_SECRET_KEY');

      expect(policy).toBeDefined();
      expect(policy?.secretName).toBe('MINIO_SECRET_KEY');
      expect(policy?.intervalDays).toBe(90);
      expect(policy?.autoRotate).toBe(true);
    });

    it('should allow adding custom policies', () => {
      rotationScheduler.addPolicy({
        secretName: 'CUSTOM_API_KEY',
        intervalDays: 60,
        gracePeriodDays: 10,
        autoRotate: true,
        notifyBeforeDays: 15,
      });

      const policy = rotationScheduler.getPolicy('CUSTOM_API_KEY');

      expect(policy).toBeDefined();
      expect(policy?.intervalDays).toBe(60);
      expect(policy?.gracePeriodDays).toBe(10);
      expect(policy?.autoRotate).toBe(true);
      expect(policy?.notifyBeforeDays).toBe(15);
    });

    it('should override existing policies', () => {
      rotationScheduler.addPolicy({
        secretName: 'JWT_SECRET',
        intervalDays: 30,
        gracePeriodDays: 5,
        autoRotate: true,
        notifyBeforeDays: 7,
      });

      const policy = rotationScheduler.getPolicy('JWT_SECRET');

      expect(policy?.intervalDays).toBe(30);
      expect(policy?.autoRotate).toBe(true);

      // Restore default
      rotationScheduler.addPolicy({
        secretName: 'JWT_SECRET',
        intervalDays: 90,
        gracePeriodDays: 7,
        autoRotate: false,
        notifyBeforeDays: 14,
      });
    });
  });

  describe('Rotation Status', () => {
    it('should check rotation status for all secrets', async () => {
      const statuses = await rotationScheduler.checkRotations();

      expect(statuses).toBeInstanceOf(Array);
      expect(statuses.length).toBeGreaterThan(0);

      statuses.forEach((status) => {
        expect(status.secretName).toBeDefined();
        expect(status.lastRotated).toBeInstanceOf(Date);
        expect(status.nextRotation).toBeInstanceOf(Date);
        expect(typeof status.daysUntilRotation).toBe('number');
        expect(['current', 'warning', 'expired']).toContain(status.status);
      });
    });

    it('should calculate days until rotation correctly', async () => {
      const statuses = await rotationScheduler.checkRotations();

      statuses.forEach((status) => {
        const now = new Date();
        const expectedDays = Math.floor(
          (status.nextRotation.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
        );

        // Allow 1 day tolerance for timing
        expect(Math.abs(status.daysUntilRotation - expectedDays)).toBeLessThanOrEqual(1);
      });
    });

    it('should identify secrets needing rotation', async () => {
      const statuses = await rotationScheduler.checkRotations();

      const needsRotation = statuses.filter((s) => s.status === 'expired');
      const warnings = statuses.filter((s) => s.status === 'warning');
      const current = statuses.filter((s) => s.status === 'current');

      // All statuses should be categorized
      expect(needsRotation.length + warnings.length + current.length).toBe(statuses.length);
    });

    it('should get rotation statuses via dedicated method', async () => {
      const statuses = await rotationScheduler.getRotationStatuses();

      expect(statuses).toBeInstanceOf(Array);
      expect(statuses.length).toBeGreaterThan(0);
    });
  });

  describe('Scheduled Rotation', () => {
    it('should schedule rotation for a secret', () => {
      const secretName = 'TEST_SCHEDULED';

      // Should not throw
      expect(() => {
        rotationScheduler.scheduleRotation(secretName, 1, 'test-user', 'test-workspace');
      }).not.toThrow();
    });

    it('should replace existing schedule when rescheduling', () => {
      const secretName = 'TEST_RESCHEDULE';

      // Schedule first time
      rotationScheduler.scheduleRotation(secretName, 30, 'test-user', 'test-workspace');

      // Reschedule - should not throw
      expect(() => {
        rotationScheduler.scheduleRotation(secretName, 60, 'test-user', 'test-workspace');
      }).not.toThrow();
    });
  });

  describe('Secret Lifecycle', () => {
    it('should handle complete secret lifecycle', async () => {
      const secretName = 'TEST_LIFECYCLE';
      const initialValue = 'initial-secret';

      // 1. Create secret
      await secretsManager.setSecret(
        secretName,
        initialValue,
        'test-user',
        'test-workspace',
        90
      );

      // 2. Retrieve secret
      const retrieved = await secretsManager.getSecret(
        secretName,
        'test-user',
        'test-workspace'
      );
      expect(retrieved).toBe(initialValue);

      // 3. Rotate secret
      const rotated = await secretsManager.rotateSecret(
        secretName,
        'test-user',
        'test-workspace'
      );
      expect(rotated).not.toBe(initialValue);

      // 4. Verify new value
      secretsManager.clearCache();
      const afterRotation = await secretsManager.getSecret(
        secretName,
        'test-user',
        'test-workspace'
      );
      expect(afterRotation).toBe(rotated);
    });

    it('should maintain secret metadata through rotation', async () => {
      const secretName = 'TEST_METADATA';

      await secretsManager.setSecret(
        secretName,
        'value1',
        'test-user',
        'test-workspace',
        90
      );

      // Rotate multiple times
      await secretsManager.rotateSecret(secretName, 'test-user', 'test-workspace');
      await secretsManager.rotateSecret(secretName, 'test-user', 'test-workspace');

      // Should still be accessible
      const final = await secretsManager.getSecret(secretName, 'test-user', 'test-workspace');
      expect(final).toBeDefined();
      expect(final.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle rotation of non-existent secret', async () => {
      await expect(
        rotationScheduler.rotateSecret('NON_EXISTENT_SECRET', 'test-user', 'test-workspace')
      ).rejects.toThrow();
    });

    it('should handle missing rotation policy gracefully', () => {
      const policy = rotationScheduler.getPolicy('NON_EXISTENT_POLICY');
      expect(policy).toBeUndefined();
    });

    it('should handle scheduler shutdown during rotation', async () => {
      await rotationScheduler.shutdown();
      await rotationScheduler.initialize();

      // Should still work after restart
      const statuses = await rotationScheduler.checkRotations();
      expect(statuses).toBeInstanceOf(Array);
    });
  });

  describe('Performance', () => {
    it('should cache secrets for fast retrieval', async () => {
      const secretName = 'TEST_PERFORMANCE';
      await secretsManager.setSecret(
        secretName,
        'cached-value',
        'test-user',
        'test-workspace',
        90
      );

      // First access
      const start1 = Date.now();
      await secretsManager.getSecret(secretName, 'test-user', 'test-workspace');
      const time1 = Date.now() - start1;

      // Second access (cached)
      const start2 = Date.now();
      await secretsManager.getSecret(secretName, 'test-user', 'test-workspace');
      const time2 = Date.now() - start2;

      // Cached should be faster or equal
      expect(time2).toBeLessThanOrEqual(time1);
    });

    it('should handle multiple concurrent secret accesses', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        secretsManager.getSecret(`TEST_CONCURRENT_${i}`, 'test-user', 'test-workspace')
      );

      await expect(Promise.all(promises)).resolves.toBeDefined();
    });

    it('should handle rapid rotation requests', async () => {
      const secretName = 'TEST_RAPID_ROTATION';
      await secretsManager.setSecret(
        secretName,
        'initial',
        'test-user',
        'test-workspace',
        90
      );

      const rotations = Array.from({ length: 5 }, () =>
        secretsManager.rotateSecret(secretName, 'test-user', 'test-workspace')
      );

      const results = await Promise.all(rotations);

      // All should succeed
      expect(results.length).toBe(5);
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThan(0);
      });
    });
  });
});
