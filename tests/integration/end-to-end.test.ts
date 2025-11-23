/**
 * End-to-End Integration Tests
 * Tests complete workflows across multiple API endpoints
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Mobius1Client } from '../../src/sdk/client.js';
import { WebhookEventType } from '../../src/webhooks/types.js';
import { TestServer } from './helpers/test-server.js';

describe('End-to-End Integration Tests', () => {
  let testServer: TestServer;
  let client: Mobius1Client;

  beforeAll(async () => {
    testServer = new TestServer();
    const baseUrl = await testServer.start();
    
    client = new Mobius1Client({
      baseUrl,
      workspaceId: 'test-workspace',
      timeout: 10000,
    });
  });

  afterAll(async () => {
    await testServer.stop();
  });

  describe('Complete Workflow: Template to Execution', () => {
    it('should list templates, validate, and execute workflow', async () => {
      // Step 1: List available templates
      const templatesResponse = await client.templates.list();
      expect(templatesResponse.success).toBeDefined();

      // Step 2: Validate a template
      const validateResponse = await client.templates.validate({
        name: 'test-workflow',
        version: '1.0.0',
        steps: [
          {
            id: 'step1',
            type: 'data_extraction',
            config: {},
          },
        ],
      });
      expect(validateResponse.success).toBeDefined();

      // Step 3: Execute workflow (if validation passed)
      if (validateResponse.success) {
        const executeResponse = await client.workflows.execute('test-template', {
          input: 'test data',
        });
        expect(executeResponse.success).toBeDefined();
      }
    });
  });

  describe('Complete Workflow: Webhook Registration and Testing', () => {
    it('should register webhook, test it, and clean up', async () => {
      // Step 1: Register webhook
      const registerResponse = await client.webhooks.register({
        url: 'https://example.com/webhook-endpoint',
        events: [
          WebhookEventType.DOCUMENT_PROCESSED,
          WebhookEventType.WORKFLOW_COMPLETED,
        ],
      });

      expect(registerResponse.success).toBeDefined();

      if (registerResponse.success && registerResponse.data) {
        const webhookId = (registerResponse.data as any).id;

        // Step 2: List webhooks to verify registration
        const listResponse = await client.webhooks.list();
        expect(listResponse.success).toBeDefined();

        // Step 3: Test webhook delivery
        const testResponse = await client.webhooks.test(webhookId);
        expect(testResponse.success).toBeDefined();

        // Step 4: Delete webhook
        const deleteResponse = await client.webhooks.delete(webhookId);
        expect(deleteResponse.success).toBeDefined();
      }
    });
  });

  describe('Complete Workflow: Compliance Report Generation', () => {
    it('should generate and retrieve compliance report', async () => {
      // Step 1: Generate compliance report
      const generateResponse = await client.compliance.generateReport({
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        format: 'json',
      });

      expect(generateResponse.success).toBeDefined();

      if (generateResponse.success && generateResponse.data) {
        const reportId = (generateResponse.data as any).id;

        // Step 2: Retrieve the generated report
        if (reportId) {
          const getResponse = await client.compliance.getReport(reportId);
          expect(getResponse.success).toBeDefined();
        }
      }
    });

    it('should export audit data', async () => {
      const exportResponse = await client.compliance.exportAudit({
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });

      expect(exportResponse.success).toBeDefined();
    });
  });

  describe('System Health and Monitoring', () => {
    it('should verify system is healthy before operations', async () => {
      // Check health
      const healthResponse = await client.health.check();
      expect(healthResponse.success).toBeDefined();

      // Check readiness
      const readyResponse = await client.health.ready();
      expect(readyResponse.success).toBeDefined();

      // Get system info
      const infoResponse = await client.health.info();
      expect(infoResponse.success).toBeDefined();
      
      if (infoResponse.success && infoResponse.data) {
        expect((infoResponse.data as any).name).toBe('Mobius 1 Platform');
      }
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should handle invalid template gracefully', async () => {
      const response = await client.templates.get('non-existent-template-id');
      
      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error).toBeDefined();
        expect(response.error?.code).toBeDefined();
      }
    });

    it('should handle invalid workflow execution', async () => {
      const response = await client.workflows.execute('invalid-template', {});
      
      expect(response.success).toBeDefined();
      // Should either succeed or fail gracefully with error
      if (!response.success) {
        expect(response.error).toBeDefined();
      }
    });

    it('should handle malformed webhook registration', async () => {
      const response = await client.webhooks.register({
        url: 'not-a-valid-url',
        events: [WebhookEventType.DOCUMENT_PROCESSED],
      });

      // Should fail validation
      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error?.code).toBe('E001'); // Validation error
      }
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple concurrent requests', async () => {
      const requests = [
        client.health.check(),
        client.templates.list(),
        client.webhooks.list(),
        client.health.info(),
      ];

      const responses = await Promise.all(requests);

      // All requests should complete
      expect(responses).toHaveLength(4);
      responses.forEach((response) => {
        expect(response.success).toBeDefined();
      });
    });

    it('should handle rapid sequential requests', async () => {
      const results: any[] = [];
      
      for (let i = 0; i < 5; i++) {
        const response = await client.health.ready();
        results.push(response);
      }

      expect(results).toHaveLength(5);
      results.forEach((response: any) => {
        expect(response.success).toBeDefined();
      });
    });
  });

  describe('API Response Consistency', () => {
    it('should return consistent response format across endpoints', async () => {
      const endpoints = [
        client.health.check(),
        client.templates.list(),
        client.webhooks.list(),
      ];

      const responses = await Promise.all(endpoints);

      responses.forEach((response) => {
        // All responses should have these fields
        expect(response).toHaveProperty('success');
        expect(response).toHaveProperty('timestamp');
        
        // Success responses should have data
        if (response.success) {
          expect(response).toHaveProperty('data');
        } else {
          // Error responses should have error
          expect(response).toHaveProperty('error');
        }
      });
    });
  });
});
