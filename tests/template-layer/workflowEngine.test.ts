/**
 * Workflow Engine Tests
 * 
 * Tests for workflow execution functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrismaClient, WorkflowStatus } from '@prisma/client';
import { TemplateManager } from '../../src/template-layer/templateManager.js';
import { WorkflowEngine } from '../../src/template-layer/workflowEngine.js';

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

describe('WorkflowEngine', () => {
  let templateManager: TemplateManager;
  let workflowEngine: WorkflowEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    
    templateManager = new TemplateManager({
      templatesPath: 'templates/workflows',
      cacheEnabled: false,
      watchForChanges: false
    });
    
    workflowEngine = new WorkflowEngine(mockPrismaClient, templateManager, {
      maxConcurrentExecutions: 5,
      defaultTimeout: 30,
      enableMetrics: true,
      auditEnabled: false // Disable for testing
    });

    // Mock database responses
    (mockPrismaClient.workflowExecution.create as any).mockResolvedValue({
      id: 'test-execution-id',
      templateId: 'modelo-303-vat-return',
      workspaceId: 'test-workspace',
      status: WorkflowStatus.PENDING,
      currentStep: 0,
      inputData: {},
      outputData: null,
      errorMessage: null,
      retryCount: 0,
      startedAt: new Date(),
      completedAt: null
    });

    (mockPrismaClient.workflowExecution.update as any).mockResolvedValue({});
  });

  it('should start workflow execution', async () => {
    // Wait for templates to load
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const inputData = {
      companyNIF: 'A12345678',
      companyName: 'Test Company',
      taxPeriod: '2024-01',
      totalSales: 10000,
      inputVAT: 2100
    };

    const execution = await workflowEngine.startExecution(
      'modelo-303-vat-return',
      'test-workspace',
      'test-user',
      inputData
    );

    expect(execution).toBeDefined();
    expect(execution.templateId).toBe('modelo-303-vat-return');
    expect(execution.workspaceId).toBe('test-workspace');
    expect(execution.status).toBe(WorkflowStatus.PENDING);
    expect(execution.inputData).toEqual(inputData);
  });

  it('should reject execution with invalid template', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    await expect(
      workflowEngine.startExecution(
        'non-existent-template',
        'test-workspace',
        'test-user',
        {}
      )
    ).rejects.toThrow('Template non-existent-template not found');
  });

  it('should reject execution with invalid input data', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const invalidData = {
      companyNIF: 'invalid-format'
      // Missing required fields
    };

    await expect(
      workflowEngine.startExecution(
        'modelo-303-vat-return',
        'test-workspace',
        'test-user',
        invalidData
      )
    ).rejects.toThrow('Input validation failed');
  });

  it('should track active executions', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const initialCount = workflowEngine.getActiveExecutionsCount();
    
    const inputData = {
      companyNIF: 'A12345678',
      companyName: 'Test Company',
      taxPeriod: '2024-01',
      totalSales: 10000,
      inputVAT: 2100
    };

    await workflowEngine.startExecution(
      'modelo-303-vat-return',
      'test-workspace',
      'test-user',
      inputData
    );

    // Give execution time to start
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const activeCount = workflowEngine.getActiveExecutionsCount();
    expect(activeCount).toBeGreaterThanOrEqual(initialCount);
  });

  it('should enforce concurrent execution limit', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const inputData = {
      companyNIF: 'A12345678',
      companyName: 'Test Company',
      taxPeriod: '2024-01',
      totalSales: 10000,
      inputVAT: 2100
    };

    // Start multiple executions up to the limit
    const promises = [];
    for (let i = 0; i < 6; i++) { // One more than the limit of 5
      promises.push(
        workflowEngine.startExecution(
          'modelo-303-vat-return',
          'test-workspace',
          'test-user',
          inputData
        )
      );
    }

    // At least one should be rejected due to limit
    const results = await Promise.allSettled(promises);
    const rejected = results.filter(r => r.status === 'rejected');
    expect(rejected.length).toBeGreaterThan(0);
  });

  it('should validate NIE/TIE application data', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const validData = {
      applicantName: 'John Doe',
      birthDate: '01/01/1990',
      nationality: 'AMERICAN',
      passportNumber: 'AB123456',
      applicationType: 'nie',
      applicationReason: 'Work permit',
      currentAddress: {
        street: '123 Main St',
        city: 'New York',
        country: 'USA'
      }
    };

    const execution = await workflowEngine.startExecution(
      'nie-tie-application',
      'test-workspace',
      'test-user',
      validData
    );

    expect(execution).toBeDefined();
    expect(execution.templateId).toBe('nie-tie-application');
    expect(execution.inputData).toEqual(validData);
  });

  it('should handle Modelo 303 workflow execution', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const modelo303Data = {
      companyNIF: 'A12345678',
      companyName: 'Test Company SL',
      taxPeriod: '2024-01',
      totalSales: 10000,
      inputVAT: 2100,
      vatRate: 0.21,
      economicActivity: '6201'
    };

    const execution = await workflowEngine.startExecution(
      'modelo-303-vat-return',
      'test-workspace',
      'test-user',
      modelo303Data
    );

    expect(execution).toBeDefined();
    expect(execution.templateId).toBe('modelo-303-vat-return');
    expect(execution.status).toBe(WorkflowStatus.PENDING);
    expect(execution.inputData).toEqual(modelo303Data);
  });

  it('should validate required fields for Modelo 303', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const incompleteData = {
      companyNIF: 'A12345678',
      companyName: 'Test Company'
      // Missing required fields
    };

    await expect(
      workflowEngine.startExecution(
        'modelo-303-vat-return',
        'test-workspace',
        'test-user',
        incompleteData
      )
    ).rejects.toThrow('Input validation failed');
  });

  it('should validate required fields for NIE/TIE application', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const incompleteData = {
      applicantName: 'John Doe',
      nationality: 'AMERICAN'
      // Missing required fields
    };

    await expect(
      workflowEngine.startExecution(
        'nie-tie-application',
        'test-workspace',
        'test-user',
        incompleteData
      )
    ).rejects.toThrow('Input validation failed');
  });

  it('should handle different NIE/TIE application types', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const applicationTypes = ['nie', 'tie_initial', 'tie_renewal'];
    
    for (const applicationType of applicationTypes) {
      const validData = {
        applicantName: 'John Doe',
        birthDate: '01/01/1990',
        nationality: 'AMERICAN',
        passportNumber: 'AB123456',
        applicationType,
        applicationReason: 'Work permit',
        currentAddress: {
          street: '123 Main St',
          city: 'New York',
          country: 'USA'
        }
      };

      const execution = await workflowEngine.startExecution(
        'nie-tie-application',
        'test-workspace',
        'test-user',
        validData
      );

      expect(execution).toBeDefined();
      expect(execution.inputData.applicationType).toBe(applicationType);
    }
  });

  it('should track execution metrics for Spanish forms', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const validData = {
      companyNIF: 'A12345678',
      companyName: 'Test Company',
      taxPeriod: '2024-01',
      totalSales: 10000,
      inputVAT: 2100
    };

    const execution = await workflowEngine.startExecution(
      'modelo-303-vat-return',
      'test-workspace',
      'test-user',
      validData
    );

    // Give execution time to start
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const metrics = workflowEngine.getExecutionMetrics(execution.id);
    expect(metrics).toBeDefined();
    expect(metrics?.templateId).toBe('modelo-303-vat-return');
    expect(metrics?.status).toBeDefined();
  });
});