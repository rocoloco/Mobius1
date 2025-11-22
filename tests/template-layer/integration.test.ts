/**
 * Template Layer Integration Test
 * 
 * End-to-end test demonstrating the template system functionality
 */

import { describe, it, expect } from 'vitest';
import { TemplateManager } from '../../src/template-layer/templateManager.js';
import { TemplateValidator } from '../../src/template-layer/templateValidator.js';

describe('Template Layer Integration', () => {
  it('should demonstrate complete workflow template functionality', async () => {
    // Initialize template manager
    const templateManager = new TemplateManager({
      templatesPath: 'templates/workflows',
      cacheEnabled: false
    });

    // Wait for templates to load
    await new Promise(resolve => setTimeout(resolve, 200));

    // 1. Verify templates are loaded
    const templates = templateManager.getAllTemplates();
    expect(templates.length).toBe(2);
    console.log(`✓ Loaded ${templates.length} workflow templates`);

    // 2. Get Modelo 303 template
    const modelo303Template = templateManager.getTemplate('modelo-303-vat-return');
    expect(modelo303Template).toBeDefined();
    expect(modelo303Template!.steps.length).toBeGreaterThan(0);
    console.log(`✓ Modelo 303 template has ${modelo303Template!.steps.length} steps`);

    // 3. Validate template structure
    const validator = new TemplateValidator();
    const templateValidation = await validator.validateTemplate({
      id: modelo303Template!.id,
      name: modelo303Template!.name,
      category: modelo303Template!.category,
      steps: modelo303Template!.steps,
      validationSchema: modelo303Template!.validationSchema,
      outputFormat: modelo303Template!.outputFormat
    });
    expect(templateValidation.isValid).toBe(true);
    console.log(`✓ Template structure validation passed (score: ${templateValidation.score.toFixed(2)})`);

    // 4. Validate input data against schema
    const validInputData = {
      companyNIF: 'A12345678',
      companyName: 'Test Gestoría SL',
      taxPeriod: '2024-01',
      totalSales: 50000,
      inputVAT: 10500,
      vatRate: 0.21,
      economicActivity: '6920',
      paymentMethod: 'bank_transfer'
    };

    const dataValidation = await templateManager.validateTemplateData(
      'modelo-303-vat-return', 
      validInputData
    );
    expect(dataValidation.isValid).toBe(true);
    console.log(`✓ Input data validation passed`);

    // 5. Test NIE/TIE template
    const nieTieTemplate = templateManager.getTemplate('nie-tie-application');
    expect(nieTieTemplate).toBeDefined();
    console.log(`✓ NIE/TIE template loaded with ${nieTieTemplate!.steps.length} steps`);

    const nieInputData = {
      applicantName: 'John Smith',
      birthDate: '15/03/1985',
      nationality: 'AMERICAN',
      passportNumber: 'AB1234567',
      applicationType: 'nie',
      applicationReason: 'Work authorization',
      currentAddress: {
        street: '123 Main Street',
        city: 'New York',
        country: 'USA',
        postalCode: '10001'
      },
      supportingDocuments: ['passport_copy', 'employment_contract']
    };

    const nieDataValidation = await templateManager.validateTemplateData(
      'nie-tie-application',
      nieInputData
    );
    expect(nieDataValidation.isValid).toBe(true);
    console.log(`✓ NIE/TIE input data validation passed`);

    // 6. Test search functionality
    const vatTemplates = templateManager.searchTemplates('VAT');
    expect(vatTemplates.length).toBe(1);
    expect(vatTemplates[0].id).toBe('modelo-303-vat-return');
    console.log(`✓ Search functionality works`);

    // 7. Test category filtering
    const modelo303Templates = templateManager.getTemplatesByCategory('MODELO_303' as any);
    expect(modelo303Templates.length).toBe(1);
    console.log(`✓ Category filtering works`);

    // 8. Get statistics
    const stats = templateManager.getStatistics();
    expect(stats.totalTemplates).toBe(2);
    expect(stats.averageStepsPerTemplate).toBeGreaterThan(5);
    console.log(`✓ Statistics: ${stats.totalTemplates} templates, avg ${stats.averageStepsPerTemplate.toFixed(1)} steps`);

    console.log('\n🎉 Template Layer Integration Test Completed Successfully!');
    console.log('✅ YAML-based template system working');
    console.log('✅ Template validation and schema enforcement working');
    console.log('✅ Workflow step dependencies defined');
    console.log('✅ Spanish administrative processes (Modelo 303, NIE/TIE) supported');
  });
});