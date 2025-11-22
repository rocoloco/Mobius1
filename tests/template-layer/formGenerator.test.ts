/**
 * Form Generator Tests
 * 
 * Tests for Spanish administrative form generation functionality
 * Requirements: FR-006, FR-010
 */

import { describe, it, expect } from 'vitest';
import { FormGenerator } from '../../src/template-layer/formGenerator.js';
import { Modelo303Data, NIETIEApplicationData } from '../../src/template-layer/types.js';

describe('FormGenerator', () => {
  describe('Modelo 303 VAT Return Generation', () => {
    const validModelo303Data: Modelo303Data = {
      nif: 'A12345678',
      companyName: 'Test Company SL',
      taxPeriod: '2024-01',
      vatBase: 10000,
      vatRate: 0.21,
      vatAmount: 2100,
      deductibleVAT: 500,
      netVATAmount: 1600,
      economicActivity: '6201',
      paymentMethod: 'bank_transfer',
      preparationDate: '2024-02-15',
      submissionDeadline: '2024-04-20'
    };

    it('should generate valid Modelo 303 form with complete data', () => {
      const result = FormGenerator.generateModelo303(validModelo303Data);

      expect(result.success).toBe(true);
      expect(result.formData).toBeDefined();
      expect(result.validationErrors).toHaveLength(0);
      expect(result.completenessScore).toBe(1.0);
      expect(result.formType).toBe('modelo_303');

      // Check form structure
      expect(result.formData.formType).toBe('MODELO_303');
      expect(result.formData.nif).toBe('A12345678');
      expect(result.formData.companyName).toBe('Test Company SL');
      expect(result.formData.taxPeriod).toBe('2024-01');
      expect(result.formData.taxQuarter).toBe('1T');
    });

    it('should calculate VAT amounts correctly', () => {
      const dataWithoutCalculations: Modelo303Data = {
        nif: 'B87654321',
        companyName: 'Another Company SL',
        taxPeriod: '2024-02',
        vatBase: 5000,
        deductibleVAT: 300,
        economicActivity: '6201',
        paymentMethod: 'direct_debit',
        preparationDate: '2024-03-15',
        submissionDeadline: '2024-07-20'
      };

      const result = FormGenerator.generateModelo303(dataWithoutCalculations);

      expect(result.success).toBe(true);
      expect(result.formData.sections.taxableOperations.vatAmount).toBe(1050); // 5000 * 0.21
      expect(result.formData.sections.settlement.netVATAmount).toBe(750); // 1050 - 300
    });

    it('should determine correct tax quarter', () => {
      const testCases = [
        { taxPeriod: '2024-01', expectedQuarter: '1T' },
        { taxPeriod: '2024-03', expectedQuarter: '1T' },
        { taxPeriod: '2024-04', expectedQuarter: '2T' },
        { taxPeriod: '2024-06', expectedQuarter: '2T' },
        { taxPeriod: '2024-07', expectedQuarter: '3T' },
        { taxPeriod: '2024-09', expectedQuarter: '3T' },
        { taxPeriod: '2024-10', expectedQuarter: '4T' },
        { taxPeriod: '2024-12', expectedQuarter: '4T' }
      ];

      testCases.forEach(({ taxPeriod, expectedQuarter }) => {
        const data = { ...validModelo303Data, taxPeriod };
        const result = FormGenerator.generateModelo303(data);
        expect(result.formData.taxQuarter).toBe(expectedQuarter);
      });
    });

    it('should validate required fields', () => {
      const invalidData = {
        nif: 'invalid-nif',
        companyName: '',
        taxPeriod: 'invalid-period',
        vatBase: -100,
        deductibleVAT: 500
      } as Modelo303Data;

      const result = FormGenerator.generateModelo303(invalidData);

      expect(result.success).toBe(false);
      expect(result.validationErrors.length).toBeGreaterThan(0);
      expect(result.validationErrors).toContain('NIF must be in format A12345678 or 12345678A');
      expect(result.validationErrors).toContain('Company name must be at least 2 characters');
      expect(result.validationErrors).toContain('Tax period must be in YYYY-MM format');
    });

    it('should format currency amounts correctly', () => {
      const result = FormGenerator.generateModelo303(validModelo303Data);

      expect(result.formData.vatBase).toMatch(/€/);
      expect(result.formData.netVATAmount).toMatch(/€/);
      expect(result.formData.deductibleVAT).toMatch(/€/);
    });

    it('should calculate submission deadline correctly', () => {
      const testCases = [
        { taxPeriod: '2024-01', expectedDeadline: '2024-04-20' }, // Q1 -> April
        { taxPeriod: '2024-04', expectedDeadline: '2024-07-20' }, // Q2 -> July
        { taxPeriod: '2024-07', expectedDeadline: '2024-10-20' }, // Q3 -> October
        { taxPeriod: '2024-10', expectedDeadline: '2025-01-20' }  // Q4 -> January next year
      ];

      testCases.forEach(({ taxPeriod, expectedDeadline }) => {
        const data = { ...validModelo303Data, taxPeriod, submissionDeadline: undefined };
        const result = FormGenerator.generateModelo303(data);
        expect(result.formData.submissionDeadline).toBe(expectedDeadline);
      });
    });
  });

  describe('NIE/TIE Application Generation', () => {
    const validNIETIEData: NIETIEApplicationData = {
      fullName: 'John Doe Smith',
      dateOfBirth: '15/01/1990',
      placeOfBirth: 'New York',
      nationality: 'AMERICAN',
      passportNumber: 'AB123456',
      applicationType: 'nie',
      reasonForApplication: 'Work permit application',
      intendedStayDuration: '2 years',
      currentAddress: {
        street: '123 Main Street',
        number: '456',
        city: 'New York',
        postalCode: '10001',
        province: 'NY',
        country: 'USA'
      },
      spanishAddress: {
        street: 'Calle Mayor',
        number: '10',
        floor: '2',
        door: 'A',
        city: 'Madrid',
        postalCode: '28001',
        province: 'Madrid',
        country: 'España'
      },
      supportingDocuments: ['passport_copy', 'work_contract', 'bank_statements'],
      appointmentOffice: 'Madrid Centro',
      preferredAppointmentDate: '2024-03-15'
    };

    it('should generate valid NIE application form', () => {
      const result = FormGenerator.generateNIETIEApplication(validNIETIEData);

      expect(result.success).toBe(true);
      expect(result.formData).toBeDefined();
      expect(result.validationErrors).toHaveLength(0);
      expect(result.formType).toBe('nie_tie_application');

      // Check form structure
      expect(result.formData.formType).toBe('NIE');
      expect(result.formData.fullName).toBe('John Doe Smith');
      expect(result.formData.nationality).toBe('AMERICAN');
      expect(result.formData.applicationType).toBe('nie');
    });

    it('should calculate correct application fees', () => {
      const testCases = [
        { applicationType: 'nie', expectedFee: 12.00 },
        { applicationType: 'tie_initial', expectedFee: 15.30 },
        { applicationType: 'tie_renewal', expectedFee: 10.20 }
      ];

      testCases.forEach(({ applicationType, expectedFee }) => {
        const data = { ...validNIETIEData, applicationType } as NIETIEApplicationData;
        const result = FormGenerator.generateNIETIEApplication(data);
        expect(result.formData.applicationFee).toBe(expectedFee);
      });
    });

    it('should generate correct required documents list', () => {
      const nieData = { ...validNIETIEData, applicationType: 'nie' } as NIETIEApplicationData;
      const nieResult = FormGenerator.generateNIETIEApplication(nieData);
      
      expect(nieResult.formData.requiredDocuments).toContain('Formulario de solicitud cumplimentado');
      expect(nieResult.formData.requiredDocuments).toContain('Justificación de la necesidad de obtener el NIE');

      const tieData = { ...validNIETIEData, applicationType: 'tie_initial' } as NIETIEApplicationData;
      const tieResult = FormGenerator.generateNIETIEApplication(tieData);
      
      expect(tieResult.formData.requiredDocuments).toContain('Autorización de residencia');
      expect(tieResult.formData.requiredDocuments).toContain('Certificado de empadronamiento');
    });

    it('should validate required personal information', () => {
      const invalidData = {
        fullName: 'A', // Too short
        dateOfBirth: '1990-01-15', // Wrong format
        nationality: '',
        passportNumber: '123', // Too short
        applicationType: 'invalid_type',
        reasonForApplication: 'Work', // Too short
        currentAddress: {
          street: '123 Main St',
          city: 'NYC',
          country: 'USA'
        }
      } as NIETIEApplicationData;

      const result = FormGenerator.generateNIETIEApplication(invalidData);

      expect(result.success).toBe(false);
      expect(result.validationErrors.length).toBeGreaterThan(0);
      expect(result.validationErrors).toContain('Full name must be at least 2 characters');
      expect(result.validationErrors).toContain('Date of birth must be in DD/MM/YYYY format');
      expect(result.validationErrors).toContain('Passport number must be 6-12 alphanumeric characters');
    });

    it('should format addresses correctly', () => {
      const result = FormGenerator.generateNIETIEApplication(validNIETIEData);

      expect(result.formData.currentAddress).toContain('123 Main Street');
      expect(result.formData.currentAddress).toContain('New York');
      expect(result.formData.currentAddress).toContain('USA');

      expect(result.formData.spanishAddress).toContain('Calle Mayor');
      expect(result.formData.spanishAddress).toContain('2º');
      expect(result.formData.spanishAddress).toContain('28001');
    });

    it('should calculate completeness score correctly', () => {
      // Complete data should have high score
      const completeResult = FormGenerator.generateNIETIEApplication(validNIETIEData);
      expect(completeResult.completenessScore).toBeGreaterThan(0.9);

      // Minimal data should have lower score
      const minimalData: NIETIEApplicationData = {
        fullName: 'John Doe',
        dateOfBirth: '15/01/1990',
        nationality: 'AMERICAN',
        passportNumber: 'AB123456',
        applicationType: 'nie',
        reasonForApplication: 'Work permit',
        currentAddress: {
          street: '123 Main St',
          number: '1',
          city: 'NYC',
          postalCode: '10001',
          province: 'NY',
          country: 'USA'
        },
        supportingDocuments: []
      };

      const minimalResult = FormGenerator.generateNIETIEApplication(minimalData);
      expect(minimalResult.completenessScore).toBeLessThan(completeResult.completenessScore);
    });
  });

  describe('Form Completeness Validation', () => {
    it('should validate Modelo 303 completeness correctly', () => {
      const completeFormData = {
        nif: 'A12345678',
        companyName: 'Test Company',
        taxPeriod: '2024-01',
        vatBase: 10000,
        netVATAmount: 1600,
        bankAccount: 'ES1234567890123456789012',
        economicActivity: '6201'
      };

      const result = FormGenerator.validateFormCompleteness(completeFormData, 'modelo_303');

      expect(result.isComplete).toBe(true);
      expect(result.completenessScore).toBe(1.0);
      expect(result.missingFields).toHaveLength(0);
    });

    it('should identify missing fields in Modelo 303', () => {
      const incompleteFormData = {
        nif: 'A12345678',
        companyName: 'Test Company'
        // Missing required fields
      };

      const result = FormGenerator.validateFormCompleteness(incompleteFormData, 'modelo_303');

      expect(result.isComplete).toBe(false);
      expect(result.completenessScore).toBeLessThan(0.8);
      expect(result.missingFields.length).toBeGreaterThan(0);
      expect(result.missingFields).toContain('taxPeriod');
    });

    it('should provide recommendations for form improvement', () => {
      const formDataWithHighAmount = {
        nif: 'A12345678',
        companyName: 'Test Company',
        taxPeriod: '2024-01',
        vatBase: 10000,
        netVATAmount: 5000, // High amount
        paymentMethod: 'direct_debit'
        // Missing bank account for direct debit
      };

      const result = FormGenerator.validateFormCompleteness(formDataWithHighAmount, 'modelo_303');

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations.some(r => r.includes('cuenta bancaria'))).toBe(true);
    });

    it('should validate NIE/TIE application completeness', () => {
      const completeFormData = {
        fullName: 'John Doe',
        dateOfBirth: '15/01/1990',
        nationality: 'AMERICAN',
        passportNumber: 'AB123456',
        applicationType: 'tie_initial',
        reasonForApplication: 'Work permit',
        spanishAddress: 'Calle Mayor 10, Madrid',
        appointmentOffice: 'Madrid Centro'
      };

      const result = FormGenerator.validateFormCompleteness(completeFormData, 'nie_tie_application');

      expect(result.isComplete).toBe(true);
      expect(result.completenessScore).toBeGreaterThan(0.8);
    });

    it('should recommend Spanish address for TIE applications', () => {
      const tieDataWithoutSpanishAddress = {
        fullName: 'John Doe',
        dateOfBirth: '15/01/1990',
        nationality: 'AMERICAN',
        passportNumber: 'AB123456',
        applicationType: 'tie_initial',
        reasonForApplication: 'Work permit'
        // Missing Spanish address
      };

      const result = FormGenerator.validateFormCompleteness(tieDataWithoutSpanishAddress, 'nie_tie_application');

      expect(result.recommendations.some(r => r.includes('dirección en España'))).toBe(true);
    });
  });
});