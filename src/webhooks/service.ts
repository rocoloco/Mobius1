/**
 * Webhook Service
 * Manages webhook delivery with retry logic
 */

import crypto from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type {
  WebhookEndpoint,
  WebhookPayload,
  WebhookDelivery,
  WebhookConfig,
  WebhookEventType,
} from './types.js';

export class WebhookService {
  private config: WebhookConfig;
  private deliveryQueue: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    private db: PrismaClient,
    config?: Partial<WebhookConfig>
  ) {
    this.config = {
      maxRetries: config?.maxRetries ?? 3,
      retryDelayMs: config?.retryDelayMs ?? 5000,
      timeoutMs: config?.timeoutMs ?? 10000,
      maxPayloadSize: config?.maxPayloadSize ?? 1024 * 1024, // 1MB
    };
  }

  /**
   * Register a new webhook endpoint
   */
  async registerWebhook(
    workspaceId: string,
    url: string,
    events: WebhookEventType[],
    secret?: string
  ): Promise<WebhookEndpoint> {
    const webhookSecret = secret || this.generateSecret();

    // In a real implementation, this would use Prisma
    // For now, return a mock object
    const webhook: WebhookEndpoint = {
      id: crypto.randomUUID(),
      workspaceId,
      url,
      events,
      secret: webhookSecret,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return webhook;
  }

  /**
   * Trigger webhook for an event
   */
  async triggerWebhook(
    workspaceId: string,
    event: WebhookEventType,
    data: any
  ): Promise<void> {
    // Find all webhooks for this workspace and event
    const webhooks = await this.getWebhooksForEvent(workspaceId, event);

    const payload: WebhookPayload = {
      id: crypto.randomUUID(),
      event,
      workspaceId,
      timestamp: new Date().toISOString(),
      data,
    };

    // Queue delivery for each webhook
    for (const webhook of webhooks) {
      await this.queueDelivery(webhook, payload);
    }
  }

  /**
   * Queue webhook delivery with retry logic
   */
  private async queueDelivery(
    webhook: WebhookEndpoint,
    payload: WebhookPayload
  ): Promise<void> {
    const delivery: WebhookDelivery = {
      id: crypto.randomUUID(),
      webhookId: webhook.id,
      payload,
      status: 'pending',
      attempts: 0,
      maxAttempts: this.config.maxRetries,
      createdAt: new Date(),
    };

    // Attempt immediate delivery
    await this.attemptDelivery(webhook, delivery);
  }

  /**
   * Attempt webhook delivery
   */
  private async attemptDelivery(
    webhook: WebhookEndpoint,
    delivery: WebhookDelivery
  ): Promise<void> {
    delivery.attempts++;

    try {
      const signature = this.generateSignature(
        JSON.stringify(delivery.payload),
        webhook.secret
      );

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.config.timeoutMs
      );

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': delivery.payload.event,
          'X-Webhook-Delivery-Id': delivery.id,
        },
        body: JSON.stringify(delivery.payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        delivery.status = 'success';
        delivery.completedAt = new Date();
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      delivery.lastError =
        error instanceof Error ? error.message : 'Unknown error';

      if (delivery.attempts < delivery.maxAttempts) {
        // Schedule retry with exponential backoff
        const retryDelay =
          this.config.retryDelayMs * Math.pow(2, delivery.attempts - 1);
        delivery.nextRetryAt = new Date(Date.now() + retryDelay);
        delivery.status = 'pending';

        // Schedule retry
        const timeoutId = setTimeout(() => {
          this.attemptDelivery(webhook, delivery);
          this.deliveryQueue.delete(delivery.id);
        }, retryDelay);

        this.deliveryQueue.set(delivery.id, timeoutId);
      } else {
        delivery.status = 'failed';
        delivery.completedAt = new Date();
      }
    }
  }

  /**
   * Generate HMAC signature for webhook payload
   */
  private generateSignature(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * Verify webhook signature
   */
  verifySignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Generate webhook secret
   */
  private generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Get webhooks for a specific event
   */
  private async getWebhooksForEvent(
    workspaceId: string,
    event: WebhookEventType
  ): Promise<WebhookEndpoint[]> {
    // In a real implementation, this would query the database
    // For now, return empty array
    return [];
  }

  /**
   * Cleanup pending deliveries
   */
  async cleanup(): Promise<void> {
    for (const timeoutId of this.deliveryQueue.values()) {
      clearTimeout(timeoutId);
    }
    this.deliveryQueue.clear();
  }
}
