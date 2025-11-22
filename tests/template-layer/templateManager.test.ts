/**
 * Template Manager Tests
 * 
 * Tests for workflow template management functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TemplateManager } from '../../src/template-layer/templateManager.js';
import { WorkflowCategory } from '@prisma/client';

describe('TemplateManager', () => {
  let templateManager: TemplateManager;

  beforeEach(() => {
    templateManager = new TemplateManager({
      templatesPath: 'templates/workflows',
      cacheEnabled: false,
      watchForChanges: false
    });
  });

  it('should load templates from directory', async () => {
    // Wait a bit for templates to load
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const templates = templateManager.getAllTemplates();
    expect(templates.length).toBeGreaterThan(0);
  });

  it('should find Modelo 303 template', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const template = templateManager.getTemplate('modelo-303-vat-return');
    expect(template).toBeDefined();
    expect(template?.name).toBe('Modelo 303 VAT Return Processing');
    expect(template?.category).toBe(WorkflowCategory.MODELO_303);
  });

  it('should find NIE/TIE template', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const template = templateManager.getTemplate('nie-tie-application');
    expect(template).toBeDefined();
    expect(template?.name).toBe('NIE/TIE Application Processing');
    expect(template?.category).toBe(WorkflowCategory.NIE_TIE);
  });

  it('should get templates by category', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const modelo303Templates = templateManager.getTemplatesByCategory(WorkflowCategory.MODELO_303);
    expect(modelo303Templates.length).toBeGreaterThan(0);
    
    const nieTieTemplates = templateManager.getTemplatesByCategory(WorkflowCategory.NIE_TIE);
    expect(nieTieTemplates.length).toBeGreaterThan(0);
  });

  it('should search templates by name', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const vatTemplates = templateManager.searchTemplates('VAT');
    expect(vatTemplates.length).toBeGreaterThan(0);
    expect(vatTemplates[0].name).toContain('VAT');
  });

  it('should validate template data', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const validData = {
      companyNIF: 'A12345678',
      companyName: 'Test Company',
      taxPeriod: '2024-01',
      totalSales: 10000,
      inputVAT: 2100
    };

    const result = await templateManager.validateTemplateData('modelo-303-vat-return', validData);
    expect(result.isValid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('should detect invalid template data', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const invalidData = {
      companyNIF: 'invalid-nif',
      // Missing required fields
    };

    const result = await templateManager.validateTemplateData('modelo-303-vat-return', invalidData);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should return statistics', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const stats = templateManager.getStatistics();
    expect(stats.totalTemplates).toBeGreaterThan(0);
    expect(stats.templatesByCategory).toBeDefined();
    expect(stats.averageStepsPerTemplate).toBeGreaterThan(0);
  });

  it('should validate Modelo 303 data correctly', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const validModelo303Data = {
      companyNIF: 'A12345678',
      companyName: 'Test Company SL',
      taxPeriod: '2024-01',
      totalSales: 10000,
      inputVAT: 2100,
      vatRate: 0.21,
      economicActivity: '6201',
      paymentMethod: 'bank_transfer'
    };

    const result = await templateManager.validateTemplateData('modelo-303-vat-return', validModelo303Data);
    expect(result.isValid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('should detect invalid Modelo 303 NIF format', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const invalidData = {
      companyNIF: 'invalid-nif-format',
      companyName: 'Test Company',
      taxPeriod: '2024-01',
      totalSales: 10000,
      inputVAT: 2100
    };

    const result = await templateManager.validateTemplateData('modelo-303-vat-return', invalidData);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should validate NIE/TIE application data correctly', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    
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
      }
    };

    const result = await templateManager.validateTemplateData('nie-tie-application', validNIETIEData);
    expect(result.isValid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('should detect invalid passport number format', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const invalidData = {
      applicantName: 'John Doe',
      birthDate: '15/01/1990',
      nationality: 'AMERICAN',
      passportNumber: '123', // Too short
      applicationType: 'nie',
      applicationReason: 'Work permit',
      currentAddress: {
        street: '123 Main St',
        city: 'NYC',
        country: 'USA'
      }
    };

    const result = await templateManager.validateTemplateData('nie-tie-application', invalidData);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should validate tax period format for Modelo 303', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const invalidPeriodData = {
      companyNIF: 'A12345678',
      companyName: 'Test Company',
      taxPeriod: '2024/01', // Wrong format
      totalSales: 10000,
      inputVAT: 2100
    };

    const result = await templateManager.validateTemplateData('modelo-303-vat-return', invalidPeriodData);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.message.includes('YYYY-MM'))).toBe(true);
  });

  it('should validate birth date format for NIE/TIE', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const invalidDateData = {
      applicantName: 'John Doe',
      birthDate: '1990-01-15', // Wrong format
      nationality: 'AMERICAN',
      passportNumber: 'AB123456',
      applicationType: 'nie',
      applicationReason: 'Work permit',
      currentAddress: {
        street: '123 Main St',
        city: 'NYC',
        country: 'USA'
      }
    };

    const result = await templateManager.validateTemplateData('nie-tie-application', invalidDateData);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.message.includes('DD/MM/YYYY'))).toBe(true);
  });
});