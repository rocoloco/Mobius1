/**
 * Workflow Processor Tests
 * 
 * Tests for Spanish administrative workflow processing functionality
 * Requirements: FR-006, FR-010
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrismaClient, WorkflowStatus } from '@prisma/client';
import { TemplateManager } from '../../src/template-layer/templateManager.js';
import { WorkflowEngine } from '../../src/template-layer/workflowEngine.js';
import { WorkflowProcessor } from '../../src/template-layer/workflowProcessor.js';
import { Modelo303Data, NIETIEApplicationData } from '../../src/template-layer/types.js';

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

describe('WorkflowProcessor', () => {
  let templateManager: TemplateManager;
  let workflowEngine: WorkflowEngine;
  let workflowProcessor: WorkflowProcessor;

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
      auditEnabled: false
    });

    workflowProcessor = new WorkflowProcessor(templateManager, workflowEngine);

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
    (mockPrismaClient.workflowExecution.findUnique as any).mockResolvedValue({
      id: 'test-execution-id',
      status: WorkflowStatus.COMPLETED,
      outputData: { success: true }
    });
  });

  describe('Modelo 303 Processing', () => {
    const validModelo303Data = {
      companyNIF: 'A12345678',
      companyName: 'Test Company SL',
      taxPeriod: '2024-01',
      totalSales: 10000,
      inputVAT: 500,
      vatRate: 0.21,
      economicActivity: '6201',
      paymentMethod: 'bank_transfer'
    };

    it('should process valid Modelo 303 data successfully', async () => {
      // Wait for templates to load
      await new Promise(resolve => setTimeout(resolve, 100));

      const result = await workflowProcessor.processModelo303(
        'test-workspace',
        'test-user',
        validModelo303Data,
        { validateOnly: true }
      );

      if (!result.success) {
        console.log('Validation errors:', result.validationErrors);
        console.log('Test data:', validModelo303Data);
      }

      expect(result.success).toBe(true);
      expect(result.workflowId).toBeDefined();
      expect(result.validationErrors).toHaveLength(0);
      expect(result.completenessScore).toBeGreaterThan(0.8);
      expect(result.formData).toBeDefined();
    });

    it('should provide recommendations for Modelo 303', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));

      const highAmountData = {
        ...validModelo303Data,
        totalSales: 25000 // High amount that will result in high VAT
      };

      const result = await workflowProcessor.processModelo303(
        'test-workspace',
        'test-user',
        highAmountData,
        { validateOnly: true, includeRecommendations: true }
      );

      expect(result.success).toBe(true);
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations.some(r => r.includes('pagos fraccionados'))).toBe(true);
    });

    it('should handle negative VAT amounts correctly', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));

      const negativeVATData = {
        ...validModelo303Data,
        totalSales: 1000,
        inputVAT: 1500 // Higher input VAT than output VAT (refund scenario)
      };

      const result = await workflowProcessor.processModelo303(
        'test-workspace',
        'test-user',
        negativeVATData,
        { validateOnly: true }
      );

      expect(result.success).toBe(true);
      expect(result.recommendations.some(r => r.includes('devolución'))).toBe(true);
    });

    it('should provide urgent deadline warnings', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));

      const urgentData = {
        ...validModelo303Data,
        submissionDeadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 3 days from now
      };

      const result = await workflowProcessor.processModelo303(
        'test-workspace',
        'test-user',
        urgentData,
        { validateOnly: true }
      );

      expect(result.success).toBe(true);
      expect(result.recommendations.some(r => r.includes('URGENTE'))).toBe(true);
    });

    it('should generate appropriate next steps for complete forms', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));

      const result = await workflowProcessor.processModelo303(
        'test-workspace',
        'test-user',
        validModelo303Data,
        { validateOnly: true }
      );

      expect(result.success).toBe(true);
      expect(result.nextSteps.length).toBeGreaterThan(0);
      expect(result.nextSteps[0]).toContain('Los datos son válidos');
    });

    it('should handle validation errors gracefully', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));

      const invalidData = {
        companyNIF: 'invalid-nif',
        companyName: '',
        taxPeriod: 'invalid-period'
      };

      const result = await workflowProcessor.processModelo303(
        'test-workspace',
        'test-user',
        invalidData
      );

      expect(result.success).toBe(false);
      expect(result.validationErrors.length).toBeGreaterThan(0);
      expect(result.nextSteps[0]).toContain('Corrija los errores');
    });

    it('should calculate processing time', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));

      const startTime = Date.now();
      const result = await workflowProcessor.processModelo303(
        'test-workspace',
        'test-user',
        validModelo303Data,
        { validateOnly: true }
      );
      const endTime = Date.now();

      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.processingTime).toBeLessThan(endTime - startTime + 100); // Allow some margin
    });
  });

  describe('NIE/TIE Application Processing', () => {
    const validNIETIEData = {
      applicantName: 'John Doe Smith',
      birthDate: '15/01/1990',
      nationality: 'AMERICAN',
      passportNumber: 'AB123456',
      applicationType: 'nie',
      applicationReason: 'Work permit application',
      currentAddress: {
        street: '123 Main Street',
        city: 'New York',
        country: 'USA'
      },
      supportingDocuments: ['passport_copy', 'work_contract']
    };

    it('should process valid NIE/TIE application successfully', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));

      const result = await workflowProcessor.processNIETIEApplication(
        'test-workspace',
        'test-user',
        validNIETIEData,
        { validateOnly: true }
      );

      expect(result.success).toBe(true);
      expect(result.workflowId).toBeDefined();
      expect(result.validationErrors).toHaveLength(0);
      expect(result.completenessScore).toBeGreaterThan(0.7);
      expect(result.formData).toBeDefined();
    });

    it('should provide TIE-specific recommendations', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));

      const tieData = {
        ...validNIETIEData,
        applicationType: 'tie_initial'
        // Missing Spanish address
      };

      const result = await workflowProcessor.processNIETIEApplication(
        'test-workspace',
        'test-user',
        tieData,
        { validateOnly: true }
      );

      expect(result.success).toBe(true);
      expect(result.recommendations.some(r => r.includes('dirección de residencia en España'))).toBe(true);
    });

    it('should recommend document preparation', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));

      const dataWithoutDocs = {
        ...validNIETIEData,
        supportingDocuments: []
      };

      const result = await workflowProcessor.processNIETIEApplication(
        'test-workspace',
        'test-user',
        dataWithoutDocs,
        { validateOnly: true }
      );

      expect(result.success).toBe(true);
      expect(result.recommendations.some(r => r.includes('documentos justificativos'))).toBe(true);
    });

    it('should generate different documents for different application types', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));

      const nieResult = await workflowProcessor.processNIETIEApplication(
        'test-workspace',
        'test-user',
        { ...validNIETIEData, applicationType: 'nie' },
        { validateOnly: true }
      );

      const tieResult = await workflowProcessor.processNIETIEApplication(
        'test-workspace',
        'test-user',
        { ...validNIETIEData, applicationType: 'tie_initial' },
        { validateOnly: true }
      );

      expect(nieResult.generatedDocuments).not.toEqual(tieResult.generatedDocuments);
      expect(nieResult.generatedDocuments.some(doc => doc.includes('nie'))).toBe(true);
      expect(tieResult.generatedDocuments.some(doc => doc.includes('tie'))).toBe(true);
    });

    it('should provide appropriate next steps for complete applications', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));

      const result = await workflowProcessor.processNIETIEApplication(
        'test-workspace',
        'test-user',
        validNIETIEData,
        { validateOnly: true }
      );

      expect(result.success).toBe(true);
      expect(result.nextSteps.length).toBeGreaterThan(0);
      expect(result.nextSteps[0]).toContain('Los datos son válidos');
    });

    it('should handle incomplete applications', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));

      const incompleteData = {
        applicantName: 'John Doe',
        birthDate: '15/01/1990',
        nationality: 'AMERICAN'
        // Missing required fields
      };

      const result = await workflowProcessor.processNIETIEApplication(
        'test-workspace',
        'test-user',
        incompleteData
      );

      expect(result.success).toBe(false);
      expect(result.validationErrors.length).toBeGreaterThan(0);
      expect(result.nextSteps[0]).toContain('Corrija los errores');
    });

    it('should suggest TIE for Spanish residents applying for NIE', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));

      const spanishResidentData = {
        ...validNIETIEData,
        applicationType: 'nie',
        currentAddress: {
          ...validNIETIEData.currentAddress,
          country: 'ES' // Already in Spain
        }
      };

      const result = await workflowProcessor.processNIETIEApplication(
        'test-workspace',
        'test-user',
        spanishResidentData,
        { validateOnly: true }
      );

      expect(result.success).toBe(true);
      expect(result.recommendations.some(r => r.includes('considere solicitar TIE'))).toBe(true);
    });
  });

  describe('Processing Statistics', () => {
    it('should return processing statistics', async () => {
      const stats = await workflowProcessor.getProcessingStatistics('test-workspace');

      expect(stats).toBeDefined();
      expect(stats.totalProcessed).toBeDefined();
      expect(stats.successRate).toBeDefined();
      expect(stats.averageProcessingTime).toBeDefined();
      expect(stats.mostCommonErrors).toBeDefined();
      expect(stats.processingByType).toBeDefined();
      
      expect(typeof stats.successRate).toBe('number');
      expect(stats.successRate).toBeGreaterThanOrEqual(0);
      expect(stats.successRate).toBeLessThanOrEqual(1);
    });

    it('should include processing breakdown by type', async () => {
      const stats = await workflowProcessor.getProcessingStatistics('test-workspace');

      expect(stats.processingByType).toHaveProperty('modelo_303');
      expect(stats.processingByType).toHaveProperty('nie_tie_application');
    });

    it('should provide common error information', async () => {
      const stats = await workflowProcessor.getProcessingStatistics('test-workspace');

      expect(Array.isArray(stats.mostCommonErrors)).toBe(true);
      expect(stats.mostCommonErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle template not found errors', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));

      // Mock template manager to return undefined
      vi.spyOn(templateManager, 'getTemplate').mockReturnValue(undefined);

      const result = await workflowProcessor.processModelo303(
        'test-workspace',
        'test-user',
        {} as Modelo303Data
      );

      expect(result.success).toBe(false);
      expect(result.validationErrors.some(e => e.includes('template not found'))).toBe(true);
    });

    it('should handle workflow execution errors gracefully', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));

      // Mock workflow engine to throw error
      vi.spyOn(workflowEngine, 'startExecution').mockRejectedValue(new Error('Execution failed'));

      const result = await workflowProcessor.processModelo303(
        'test-workspace',
        'test-user',
        {
          nif: 'A12345678',
          companyName: 'Test Company',
          taxPeriod: '2024-01',
          vatBase: 10000,
          deductibleVAT: 500
        } as Modelo303Data,
        { validateOnly: false }
      );

      expect(result.success).toBe(false);
      expect(result.validationErrors.length).toBeGreaterThan(0);
    });

    it('should provide meaningful error messages', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));

      const result = await workflowProcessor.processModelo303(
        'test-workspace',
        'test-user',
        {} as Modelo303Data // Empty data
      );

      expect(result.success).toBe(false);
      expect(result.validationErrors.length).toBeGreaterThan(0);
      expect(result.validationErrors[0]).toBeTruthy();
      expect(typeof result.validationErrors[0]).toBe('string');
    });
  });
});