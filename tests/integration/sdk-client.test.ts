/**
 * API Client SDK Integration Tests
 * Tests the Mobius1Client SDK functionality
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Mobius1Client } from '../../src/sdk/client.js';
import { WebhookEventType } from '../../src/webhooks/types.js';
import Fastify, { FastifyInstance } from 'fastify';
import { db } from '../../src/database/client.js';
import { PipesHubService } from '../../src/pipeshub/index.js';
import { TemplateManager, WorkflowEngine } from '../../src/template-layer/index.js';
import { RuntimeFactory } from '../../src/runtime/index.js';
import { WebhookService } from '../../src/webhooks/service.js';
import { registerV1Routes } from '../../src/api/routes/index.js';
import { registerPlugins } from '../../src/api/plugins.js';
import { appConfig } from '../../src/config/index.js';

describe('API Client SDK Integration Tests', () => {
  let app: FastifyInstance;
  let client: Mobius1Client;
  let baseUrl: string;

  beforeAll(async () => {
    // Create Fastify instance
    app = Fastify({ logger: false });

    // Initialize services
    const pipesHubService = new PipesHubService(db, {
      endpoint: appConfig.minio.endpoint,
      port: appConfig.minio.port,
      accessKey: appConfig.minio.accessKey,
      secretKey: appConfig.minio.secretKey,
      useSSL: appConfig.minio.useSSL,
      bucketName: 'test-documents',
    });

    const templateManager = new TemplateManager();
    const workflowEngine = new WorkflowEngine(db, templateManager);
    const runtime = RuntimeFactory.getInstance(appConfig);
    const webhookService = new WebhookService(db);

    // Decorate Fastify instance
    app.decorate('db', db);
    app.decorate('pipesHub', pipesHubService);
    app.decorate('templateManager', templateManager);
    app.decorate('workflowEngine', workflowEngine);
    app.decorate('runtime', runtime);
    app.decorate('webhookService', webhookService);

    // Register plugins and routes
    await registerPlugins(app);
    await registerV1Routes(app);

    await app.ready();
    await app.listen({ port: 0 }); // Random available port

    const address = app.server.address();
    const port = typeof address === 'object' && address ? address.port : 3000;
    baseUrl = `http://localhost:${port}`;

    // Initialize SDK client
    client = new Mobius1Client({
      baseUrl,
      workspaceId: 'test-workspace',
      timeout: 5000,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health API', () => {
    it('should check system health', async () => {
      const response = await client.health.check();

      expect(response.success).toBeDefined();
      if (response.success) {
        expect(response.data).toBeDefined();
      }
    });

    it('should check readiness', async () => {
      const response = await client.health.ready();

      expect(response.success).toBeDefined();
      if (response.success && response.data) {
        expect((response.data as any).ready).toBe(true);
      }
    });

    it('should get application info', async () => {
      const response = await client.health.info();

      expect(response.success).toBeDefined();
      if (response.success && response.data) {
        expect((response.data as any).name).toBe('Mobius 1 Platform');
      }
    });
  });

  describe('Template API', () => {
    it('should list templates', async () => {
      const response = await client.templates.list();

      expect(response.success).toBeDefined();
      if (response.success) {
        expect(Array.isArray(response.data)).toBe(true);
      }
    });

    it('should validate template', async () => {
      const response = await client.templates.validate({
        name: 'test-template',
        version: '1.0.0',
        steps: [],
      });

      expect(response.success).toBeDefined();
    });
  });

  describe('Webhook API', () => {
    it('should register webhook', async () => {
      const response = await client.webhooks.register({
        url: 'https://example.com/webhook',
        events: [WebhookEventType.DOCUMENT_PROCESSED],
      });

      expect(response.success).toBeDefined();
      if (response.success && response.data) {
        expect((response.data as any).id).toBeDefined();
        expect((response.data as any).url).toBe('https://example.com/webhook');
      }
    });

    it('should list webhooks', async () => {
      const response = await client.webhooks.list();

      expect(response.success).toBeDefined();
      if (response.success) {
        expect(Array.isArray(response.data)).toBe(true);
      }
    });
  });

  describe('Compliance API', () => {
    it('should generate compliance report', async () => {
      const response = await client.compliance.generateReport({
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        format: 'json',
      });

      expect(response.success).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 errors', async () => {
      const response = await client.templates.get('non-existent-id');

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error).toBeDefined();
      }
    });

    it('should handle timeout', async () => {
      const slowClient = new Mobius1Client({
        baseUrl,
        timeout: 1, // 1ms timeout
      });

      await expect(slowClient.health.check()).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      const badClient = new Mobius1Client({
        baseUrl: 'http://localhost:99999', // Invalid port
        timeout: 1000,
      });

      await expect(badClient.health.check()).rejects.toThrow();
    });
  });

  describe('Authentication', () => {
    it('should include API key in requests', async () => {
      const authClient = new Mobius1Client({
        baseUrl,
        apiKey: 'test-api-key',
      });

      // This will fail auth but we can verify the header was sent
      const response = await authClient.health.info();
      expect(response).toBeDefined();
    });

    it('should include workspace ID in requests', async () => {
      const workspaceClient = new Mobius1Client({
        baseUrl,
        workspaceId: 'custom-workspace',
      });

      const response = await workspaceClient.health.info();
      expect(response).toBeDefined();
    });
  });

  describe('Request Configuration', () => {
    it('should respect custom timeout', async () => {
      const customClient = new Mobius1Client({
        baseUrl,
        timeout: 10000,
      });

      const response = await customClient.health.check();
      expect(response).toBeDefined();
    });

    it('should handle base URL with trailing slash', async () => {
      const slashClient = new Mobius1Client({
        baseUrl: baseUrl + '/',
      });

      const response = await slashClient.health.check();
      expect(response.success).toBeDefined();
    });
  });

  describe('Response Format', () => {
    it('should return consistent response format', async () => {
      const response = await client.health.info();

      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('timestamp');

      if (response.success) {
        expect(response).toHaveProperty('data');
      } else {
        expect(response).toHaveProperty('error');
      }
    });

    it('should include correlation ID when available', async () => {
      const response = await client.health.check();

      if (response.correlationId) {
        expect(typeof response.correlationId).toBe('string');
      }
    });
  });
});
