/**
 * API Endpoints Integration Tests
 * Tests REST API endpoints end-to-end
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { db } from '../../src/database/client.js';
import { PipesHubService } from '../../src/pipeshub/index.js';
import { TemplateManager, WorkflowEngine } from '../../src/template-layer/index.js';
import { RuntimeFactory } from '../../src/runtime/index.js';
import { WebhookService } from '../../src/webhooks/service.js';
import { registerV1Routes } from '../../src/api/routes/index.js';
import { registerPlugins } from '../../src/api/plugins.js';
import { appConfig } from '../../src/config/index.js';

describe('API Endpoints Integration Tests', () => {
  let app: FastifyInstance;

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
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Endpoints', () => {
    it('should return health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBeDefined();
      expect(body.timestamp).toBeDefined();
    });

    it('should return ready status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/ready',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ready).toBe(true);
    });

    it('should return application info', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/info',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe('Mobius 1 Platform');
      expect(body.version).toBeDefined();
    });
  });

  describe('Template Endpoints', () => {
    it('should list available templates', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/templates',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('should validate template structure', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/templates/validate',
        payload: {
          name: 'test-template',
          version: '1.0.0',
          steps: [],
        },
      });

      expect([200, 400]).toContain(response.statusCode);
    });
  });

  describe('Compliance Endpoints', () => {
    it('should generate compliance report', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/compliance/reports',
        payload: {
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          format: 'json',
        },
      });

      expect([200, 201]).toContain(response.statusCode);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent endpoints', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/non-existent',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return validation error for invalid payload', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/templates/validate',
        payload: {
          // Missing required fields
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('CORS and Security Headers', () => {
    it('should include CORS headers', async () => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/api/v1/templates',
        headers: {
          origin: 'http://localhost:3000',
        },
      });

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    it('should include security headers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });
});
