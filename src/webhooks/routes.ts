/**
 * Webhook Routes
 * API endpoints for webhook management
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { WebhookService } from './service.js';
import { WebhookEventType } from './types.js';
import { createSuccessResponse } from '../api/middleware.js';
import { APIException } from '../api/errors.js';

const RegisterWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.nativeEnum(WebhookEventType)),
  secret: z.string().optional(),
});

export async function registerWebhookRoutes(
  fastify: FastifyInstance,
  webhookService: WebhookService
) {
  /**
   * Register a new webhook endpoint
   */
  fastify.post('/webhooks', async (request, reply) => {
    const validation = RegisterWebhookSchema.safeParse(request.body);

    if (!validation.success) {
      throw new APIException(
        'E001',
        'Invalid webhook registration data',
        validation.error.errors,
        400
      );
    }

    const { url, events, secret } = validation.data;
    const workspaceId = (request as any).context?.workspaceId || 'default';

    const webhook = await webhookService.registerWebhook(
      workspaceId,
      url,
      events,
      secret
    );

    reply.status(201);
    return createSuccessResponse(
      {
        id: webhook.id,
        url: webhook.url,
        events: webhook.events,
        enabled: webhook.enabled,
        createdAt: webhook.createdAt,
      },
      undefined,
      (request.headers['x-correlation-id'] as string) || undefined
    );
  });

  /**
   * List webhooks for workspace
   */
  fastify.get('/webhooks', async (request, reply) => {
    const workspaceId = (request as any).context?.workspaceId || 'default';

    // In a real implementation, this would query the database
    return createSuccessResponse(
      [],
      undefined,
      (request.headers['x-correlation-id'] as string) || undefined
    );
  });

  /**
   * Delete a webhook
   */
  fastify.delete('/webhooks/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const workspaceId = (request as any).context?.workspaceId || 'default';

    // In a real implementation, this would delete from database
    reply.status(204);
  });

  /**
   * Test webhook delivery
   */
  fastify.post('/webhooks/:id/test', async (request, reply) => {
    const { id } = request.params as { id: string };
    const workspaceId = (request as any).context?.workspaceId || 'default';

    await webhookService.triggerWebhook(
      workspaceId,
      WebhookEventType.DOCUMENT_PROCESSED,
      { test: true, webhookId: id }
    );

    return createSuccessResponse(
      { message: 'Test webhook triggered' },
      undefined,
      (request.headers['x-correlation-id'] as string) || undefined
    );
  });
}
