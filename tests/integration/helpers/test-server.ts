/**
 * Integration Test Server Helper
 * Provides utilities for setting up test servers
 */

import Fastify, { FastifyInstance } from 'fastify';
import { db } from '../../../src/database/client.js';
import { PipesHubService } from '../../../src/pipeshub/index.js';
import { TemplateManager, WorkflowEngine } from '../../../src/template-layer/index.js';
import { RuntimeFactory } from '../../../src/runtime/index.js';
import { WebhookService } from '../../../src/webhooks/service.js';
import { registerV1Routes } from '../../../src/api/routes/index.js';
import { registerPlugins } from '../../../src/api/plugins.js';
import { appConfig } from '../../../src/config/index.js';

export interface TestServerConfig {
  logger?: boolean;
  port?: number;
}

export class TestServer {
  private app: FastifyInstance | null = null;
  private baseUrl: string = '';

  async start(config: TestServerConfig = {}): Promise<string> {
    this.app = Fastify({ logger: config.logger ?? false });

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
    this.app.decorate('db', db);
    this.app.decorate('pipesHub', pipesHubService);
    this.app.decorate('templateManager', templateManager);
    this.app.decorate('workflowEngine', workflowEngine);
    this.app.decorate('runtime', runtime);
    this.app.decorate('webhookService', webhookService);

    // Register plugins and routes
    await registerPlugins(this.app);
    await registerV1Routes(this.app);

    await this.app.ready();

    if (config.port !== undefined) {
      await this.app.listen({ port: config.port });
      this.baseUrl = `http://localhost:${config.port}`;
    } else {
      await this.app.listen({ port: 0 }); // Random port
      const address = this.app.server.address();
      const port = typeof address === 'object' && address ? address.port : 3000;
      this.baseUrl = `http://localhost:${port}`;
    }

    return this.baseUrl;
  }

  async stop(): Promise<void> {
    if (this.app) {
      await this.app.close();
      this.app = null;
    }
  }

  getApp(): FastifyInstance {
    if (!this.app) {
      throw new Error('Test server not started');
    }
    return this.app;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  async inject(options: any) {
    if (!this.app) {
      throw new Error('Test server not started');
    }
    return this.app.inject(options);
  }
}

/**
 * Create a test server instance
 */
export function createTestServer(config?: TestServerConfig): TestServer {
  return new TestServer();
}
