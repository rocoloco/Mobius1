/**
 * Template Layer Routes Test
 * 
 * Tests for the REST API endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { TemplateManager } from '../../src/template-layer/templateManager.js';
import { WorkflowEngine } from '../../src/template-layer/workflowEngine.js';
import { registerTemplateRoutes } from '../../src/template-layer/routes.js';

// Mock PrismaClient
const mockPrismaClient = {
  workflowExecution: {
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn()
  },
  auditEvent: {
    create: vi.fn()
  }
} as unknown as PrismaClient;

describe('Template Layer Routes', () => {
  let app: FastifyInstance;
  let templateManager: TemplateManager;
  let workflowEngine: WorkflowEngine;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    
    templateManager = new TemplateManager({
      templatesPath: 'templates/workflows',
      cacheEnabled: false,
      watchForChanges: false
    });
    
    workflowEngine = new WorkflowEngine(mockPrismaClient, templateManager, {
      auditEnabled: false
    });

    // Wait for templates to load
    await new Promise(resolve => setTimeout(resolve, 100));

    await registerTemplateRoutes(app, templateManager, workflowEngine);
  });

  it('should get all templates', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/templates'
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.templates).toBeDefined();
    expect(body.count).toBeGreaterThan(0);
    expect(body.templates.length).toBe(body.count);
  });

  it('should get template by ID', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/templates/modelo-303-vat-return'
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.template).toBeDefined();
    expect(body.template.id).toBe('modelo-303-vat-return');
    expect(body.template.name).toBe('Modelo 303 VAT Return Processing');
  });

  it('should return 404 for non-existent template', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/templates/non-existent'
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Template not found');
  });

  it('should search templates', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/templates/search?q=VAT'
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.templates).toBeDefined();
    expect(body.query).toBe('VAT');
    expect(body.count).toBeGreaterThan(0);
  });

  it('should validate template data', async () => {
    const validData = {
      companyNIF: 'A12345678',
      companyName: 'Test Company',
      taxPeriod: '2024-01',
      totalSales: 10000,
      inputVAT: 2100
    };

    const response = await app.inject({
      method: 'POST',
      url: '/templates/validate',
      payload: {
        templateId: 'modelo-303-vat-return',
        data: validData
      }
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.validationResult).toBeDefined();
    expect(body.validationResult.isValid).toBe(true);
  });

  it('should get template statistics', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/templates/stats'
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.statistics).toBeDefined();
    expect(body.statistics.totalTemplates).toBeGreaterThan(0);
    expect(body.activeExecutions).toBeDefined();
  });

  it('should check health', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/templates/health'
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('healthy');
    expect(body.templateCount).toBeGreaterThan(0);
  });
});