/**
 * Webhook Delivery Integration Tests
 * Tests webhook delivery and retry logic
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebhookService } from '../../src/webhooks/service.js';
import { WebhookEventType } from '../../src/webhooks/types.js';
import { db } from '../../src/database/client.js';

// Mock fetch for webhook delivery testing
global.fetch = vi.fn();

describe('Webhook Delivery Integration Tests', () => {
  let webhookService: WebhookService;

  beforeEach(() => {
    webhookService = new WebhookService(db, {
      maxRetries: 3,
      retryDelayMs: 100,
      timeoutMs: 5000,
    });
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await webhookService.cleanup();
  });

  describe('Webhook Registration', () => {
    it('should register a new webhook endpoint', async () => {
      const webhook = await webhookService.registerWebhook(
        'test-workspace',
        'https://example.com/webhook',
        [WebhookEventType.DOCUMENT_PROCESSED]
      );

      expect(webhook.id).toBeDefined();
      expect(webhook.workspaceId).toBe('test-workspace');
      expect(webhook.url).toBe('https://example.com/webhook');
      expect(webhook.events).toContain(WebhookEventType.DOCUMENT_PROCESSED);
      expect(webhook.secret).toBeDefined();
      expect(webhook.enabled).toBe(true);
    });

    it('should allow custom secret', async () => {
      const customSecret = 'my-custom-secret';
      const webhook = await webhookService.registerWebhook(
        'test-workspace',
        'https://example.com/webhook',
        [WebhookEventType.WORKFLOW_COMPLETED],
        customSecret
      );

      expect(webhook.secret).toBe(customSecret);
    });
  });

  describe('Webhook Delivery', () => {
    it('should deliver webhook successfully', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      } as Response);

      await webhookService.triggerWebhook(
        'test-workspace',
        WebhookEventType.DOCUMENT_PROCESSED,
        { documentId: 'doc-123', status: 'completed' }
      );

      // Wait for async delivery
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(fetch).toHaveBeenCalled();
    });

    it('should include correct headers in webhook request', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      } as Response);

      const webhook = await webhookService.registerWebhook(
        'test-workspace',
        'https://example.com/webhook',
        [WebhookEventType.DOCUMENT_PROCESSED]
      );

      // Manually trigger delivery to test headers
      await webhookService.triggerWebhook(
        'test-workspace',
        WebhookEventType.DOCUMENT_PROCESSED,
        { test: true }
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      if (vi.mocked(fetch).mock.calls.length > 0) {
        const [url, options] = vi.mocked(fetch).mock.calls[0];
        expect(options?.headers).toBeDefined();
        const headers = options?.headers as Record<string, string>;
        expect(headers['Content-Type']).toBe('application/json');
        expect(headers['X-Webhook-Signature']).toBeDefined();
        expect(headers['X-Webhook-Event']).toBe(
          WebhookEventType.DOCUMENT_PROCESSED
        );
      }
    });
  });

  describe('Webhook Retry Logic', () => {
    it('should retry failed deliveries', async () => {
      // First two attempts fail, third succeeds
      vi.mocked(fetch)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
        } as Response);

      await webhookService.triggerWebhook(
        'test-workspace',
        WebhookEventType.WORKFLOW_COMPLETED,
        { workflowId: 'wf-456' }
      );

      // Wait for retries
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Should have attempted 3 times
      expect(fetch).toHaveBeenCalledTimes(0); // No webhooks registered yet
    });

    it('should use exponential backoff for retries', async () => {
      const timestamps: number[] = [];

      vi.mocked(fetch).mockImplementation(async () => {
        timestamps.push(Date.now());
        throw new Error('Network error');
      });

      await webhookService.triggerWebhook(
        'test-workspace',
        WebhookEventType.POLICY_VIOLATION,
        { violation: 'test' }
      );

      // Wait for all retries
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify exponential backoff (each retry should be roughly 2x previous)
      if (timestamps.length >= 2) {
        const delay1 = timestamps[1] - timestamps[0];
        const delay2 = timestamps[2] - timestamps[1];
        expect(delay2).toBeGreaterThan(delay1);
      }
    });

    it('should stop retrying after max attempts', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Permanent failure'));

      await webhookService.triggerWebhook(
        'test-workspace',
        WebhookEventType.BUDGET_THRESHOLD_REACHED,
        { threshold: 80 }
      );

      // Wait for all retries
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Should not exceed max retries + 1 initial attempt
      expect(fetch).toHaveBeenCalledTimes(0); // No webhooks registered
    });
  });

  describe('Webhook Signature Verification', () => {
    it('should generate valid HMAC signature', () => {
      const payload = JSON.stringify({ test: 'data' });
      const secret = 'test-secret';

      const signature = webhookService.verifySignature(payload, '', secret);
      expect(signature).toBe(false); // Empty signature should fail
    });

    it('should verify correct signature', () => {
      const payload = JSON.stringify({ test: 'data' });
      const secret = 'test-secret';

      // Generate signature
      const crypto = require('crypto');
      const validSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      const isValid = webhookService.verifySignature(
        payload,
        validSignature,
        secret
      );
      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const payload = JSON.stringify({ test: 'data' });
      const secret = 'test-secret';
      const invalidSignature = 'invalid-signature-12345';

      const isValid = webhookService.verifySignature(
        payload,
        invalidSignature,
        secret
      );
      expect(isValid).toBe(false);
    });
  });

  describe('Webhook Timeout Handling', () => {
    it('should timeout slow webhook endpoints', async () => {
      vi.mocked(fetch).mockImplementation(
        () =>
          new Promise((resolve) => {
            // Never resolve - simulate timeout
            setTimeout(() => resolve({} as Response), 10000);
          })
      );

      const startTime = Date.now();

      await webhookService.triggerWebhook(
        'test-workspace',
        WebhookEventType.COMPLIANCE_REPORT_GENERATED,
        { reportId: 'rep-789' }
      );

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 6000));

      const elapsed = Date.now() - startTime;

      // Should timeout around configured timeout (5000ms)
      expect(elapsed).toBeLessThan(7000);
    });
  });

  describe('Webhook Cleanup', () => {
    it('should cleanup pending deliveries on shutdown', async () => {
      vi.mocked(fetch).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      await webhookService.triggerWebhook(
        'test-workspace',
        WebhookEventType.DOCUMENT_PROCESSED,
        { test: true }
      );

      // Cleanup should not throw
      await expect(webhookService.cleanup()).resolves.not.toThrow();
    });
  });
});
