/**
 * Form Generator - Spanish Administrative Form Generation
 * 
 * Handles generation of official Spanish administrative forms including
 * Modelo 303 VAT returns and NIE/TIE applications with validation and
 * completeness checking.
 * 
 * Requirements: FR-006, FR-010
 */

import { WorkflowTemplate, Modelo303Data, NIETIEApplicationData, Address } from './types.js';

export interface FormGenerationResult {
  success: boolean;
  formData: Record<string, any>;
  validationErrors: string[];
  completenessScore: number; // 0-1 scale
  missingFields: string[];
  generatedAt: Date;
  formType: string;
}

export interface FormValidationRule {
  field: string;
  required: boolean;
  pattern?: RegExp;
  validator?: (value: any) => boolean;
  errorMessage: string;
}

export class FormGenerator {
  private static readonly MODELO_303_VALIDATION_RULES: FormValidationRule[] = [
    {
      field: 'nif',
      required: true,
      pattern: /^[A-Z]\d{8}$|^\d{8}[A-Z]$/,
      errorMessage: 'NIF must be in format A12345678 or 12345678A'
    },
    {
      field: 'companyName',
      required: true,
      validator: (value: string) => value && value.trim().length >= 2,
      errorMessage: 'Company name must be at least 2 characters'
    },
    {
      field: 'taxPeriod',
      required: true,
      pattern: /^\d{4}-(0[1-9]|1[0-2])$/,
      errorMessage: 'Tax period must be in YYYY-MM format'
    },
    {
      field: 'vatBase',
      required: true,
      validator: (value: number) => typeof value === 'number' && value >= 0,
      errorMessage: 'VAT base must be a non-negative number'
    },
    {
      field: 'netVATAmount',
      required: true,
      validator: (value: number) => typeof value === 'number',
      errorMessage: 'Net VAT amount must be a number'
    }
  ];

  private static readonly NIE_TIE_VALIDATION_RULES: FormValidationRule[] = [
    {
      field: 'fullName',
      required: true,
      validator: (value: string) => value && value.trim().length >= 2,
      errorMessage: 'Full name must be at least 2 characters'
    },
    {
      field: 'dateOfBirth',
      required: true,
      pattern: /^\d{1,2}\/\d{1,2}\/\d{4}$/,
      errorMessage: 'Date of birth must be in DD/MM/YYYY format'
    },
    {
      field: 'nationality',
      required: true,
      validator: (value: string) => value && value.trim().length >= 2,
      errorMessage: 'Nationality must be specified'
    },
    {
      field: 'passportNumber',
      required: true,
      pattern: /^[A-Z0-9]{6,12}$/,
      errorMessage: 'Passport number must be 6-12 alphanumeric characters'
    },
    {
      field: 'applicationType',
      required: true,
      validator: (value: string) => ['nie', 'tie_initial', 'tie_renewal'].includes(value),
      errorMessage: 'Application type must be nie, tie_initial, or tie_renewal'
    },
    {
      field: 'reasonForApplication',
      required: true,
      validator: (value: string) => value && value.trim().length >= 5,
      errorMessage: 'Reason for application must be at least 5 characters'
    }
  ];

  /**
   * Generate Modelo 303 VAT return form
   */
  static generateModelo303(data: Modelo303Data): FormGenerationResult {
    // Create a copy with required fields filled in
    const processedData = {
      ...data,
      vatRate: data.vatRate || 0.21,
      vatAmount: data.vatAmount || (data.vatBase * (data.vatRate || 0.21)),
      netVATAmount: data.netVATAmount || ((data.vatAmount || (data.vatBase * (data.vatRate || 0.21))) - data.deductibleVAT)
    };

    const validationResult = this.validateFormData(processedData, this.MODELO_303_VALIDATION_RULES);
    
    if (!validationResult.isValid) {
      return {
        success: false,
        formData: {},
        validationErrors: validationResult.errors,
        completenessScore: validationResult.completenessScore,
        missingFields: validationResult.missingFields,
        generatedAt: new Date(),
        formType: 'modelo_303'
      };
    }

    // Calculate VAT amounts if not provided
    const vatRate = processedData.vatRate;
    const vatAmount = processedData.vatAmount;
    const netVATAmount = processedData.netVATAmount;

    // Generate form data structure
    const formData = {
      // Header information
      formType: 'MODELO_303',
      formVersion: '2024',
      generatedAt: new Date().toISOString(),
      
      // Company identification
      nif: processedData.nif.toUpperCase(),
      companyName: processedData.companyName.trim(),
      economicActivity: processedData.economicActivity || '',
      
      // Tax period
      taxPeriod: processedData.taxPeriod,
      taxYear: processedData.taxPeriod.split('-')[0],
      taxQuarter: this.getTaxQuarter(processedData.taxPeriod),
      
      // VAT calculations
      vatBase: this.formatCurrency(processedData.vatBase),
      vatRate: this.formatPercentage(vatRate),
      vatAmount: this.formatCurrency(vatAmount),
      deductibleVAT: this.formatCurrency(processedData.deductibleVAT),
      netVATAmount: this.formatCurrency(netVATAmount),
      
      // Payment information
      paymentMethod: processedData.paymentMethod || 'bank_transfer',
      bankAccount: processedData.bankAccount || '',
      
      // Dates
      preparationDate: processedData.preparationDate || new Date().toISOString().split('T')[0],
      submissionDeadline: processedData.submissionDeadline || this.calculateSubmissionDeadline(processedData.taxPeriod),
      
      // Form sections (Spanish tax form structure)
      sections: {
        identification: {
          nif: processedData.nif.toUpperCase(),
          companyName: processedData.companyName.trim(),
          economicActivity: processedData.economicActivity || ''
        },
        taxableOperations: {
          vatBase: processedData.vatBase,
          vatRate: vatRate,
          vatAmount: vatAmount
        },
        deductions: {
          deductibleVAT: processedData.deductibleVAT,
          otherDeductions: 0
        },
        settlement: {
          grossVAT: vatAmount,
          totalDeductions: processedData.deductibleVAT,
          netVATAmount: netVATAmount,
          paymentMethod: processedData.paymentMethod || 'bank_transfer'
        }
      },
      
      // Validation metadata
      validationPassed: true,
      completenessScore: 1.0,
      generatedBy: 'Mobius1-Platform'
    };

    return {
      success: true,
      formData,
      validationErrors: [],
      completenessScore: 1.0,
      missingFields: [],
      generatedAt: new Date(),
      formType: 'modelo_303'
    };
  }

  /**
   * Generate NIE/TIE application form
   */
  static generateNIETIEApplication(data: NIETIEApplicationData): FormGenerationResult {
    const validationResult = this.validateFormData(data, this.NIE_TIE_VALIDATION_RULES);
    
    if (!validationResult.isValid) {
      return {
        success: false,
        formData: {},
        validationErrors: validationResult.errors,
        completenessScore: validationResult.completenessScore,
        missingFields: validationResult.missingFields,
        generatedAt: new Date(),
        formType: 'nie_tie_application'
      };
    }

    // Calculate application fee based on type
    const applicationFee = this.calculateNIETIEFee(data.applicationType);
    
    // Generate form data structure
    const formData = {
      // Header information
      formType: data.applicationType.toUpperCase(),
      formVersion: '2024',
      generatedAt: new Date().toISOString(),
      
      // Personal identification
      fullName: data.fullName.trim(),
      dateOfBirth: data.dateOfBirth,
      placeOfBirth: data.placeOfBirth || '',
      nationality: data.nationality.toUpperCase(),
      passportNumber: data.passportNumber.toUpperCase(),
      
      // Application details
      applicationType: data.applicationType,
      reasonForApplication: data.reasonForApplication.trim(),
      intendedStayDuration: data.intendedStayDuration || '',
      
      // Address information
      currentAddress: this.formatAddress(data.currentAddress),
      spanishAddress: data.spanishAddress ? this.formatAddress(data.spanishAddress) : null,
      
      // Supporting documents
      supportingDocuments: data.supportingDocuments || [],
      requiredDocuments: this.getRequiredDocuments(data.applicationType),
      
      // Appointment information
      appointmentOffice: data.appointmentOffice || '',
      preferredAppointmentDate: data.preferredAppointmentDate || '',
      
      // Fees
      applicationFee: applicationFee,
      feeDescription: this.getFeeDescription(data.applicationType),
      
      // Form sections (Spanish immigration form structure)
      sections: {
        personalData: {
          fullName: data.fullName.trim(),
          dateOfBirth: data.dateOfBirth,
          placeOfBirth: data.placeOfBirth || '',
          nationality: data.nationality.toUpperCase(),
          passportNumber: data.passportNumber.toUpperCase()
        },
        applicationDetails: {
          applicationType: data.applicationType,
          reasonForApplication: data.reasonForApplication.trim(),
          intendedStayDuration: data.intendedStayDuration || ''
        },
        addresses: {
          current: this.formatAddress(data.currentAddress),
          spanish: data.spanishAddress ? this.formatAddress(data.spanishAddress) : null
        },
        documentation: {
          supportingDocuments: data.supportingDocuments || [],
          requiredDocuments: this.getRequiredDocuments(data.applicationType)
        }
      },
      
      // Validation metadata
      validationPassed: true,
      completenessScore: this.calculateCompletenessScore(data),
      generatedBy: 'Mobius1-Platform'
    };

    return {
      success: true,
      formData,
      validationErrors: [],
      completenessScore: this.calculateCompletenessScore(data),
      missingFields: [],
      generatedAt: new Date(),
      formType: 'nie_tie_application'
    };
  }

  /**
   * Validate form data against rules
   */
  private static validateFormData(
    data: Record<string, any>, 
    rules: FormValidationRule[]
  ): {
    isValid: boolean;
    errors: string[];
    completenessScore: number;
    missingFields: string[];
  } {
    const errors: string[] = [];
    const missingFields: string[] = [];
    let validFields = 0;

    for (const rule of rules) {
      const value = this.getNestedValue(data, rule.field);
      
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(rule.errorMessage);
        missingFields.push(rule.field);
        continue;
      }

      if (value !== undefined && value !== null && value !== '') {
        validFields++;
        
        // Pattern validation
        if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
          errors.push(rule.errorMessage);
          continue;
        }
        
        // Custom validator
        if (rule.validator && !rule.validator(value)) {
          errors.push(rule.errorMessage);
          continue;
        }
      }
    }

    const completenessScore = rules.length > 0 ? validFields / rules.length : 1;

    return {
      isValid: errors.length === 0,
      errors,
      completenessScore,
      missingFields
    };
  }

  /**
   * Get nested value from object using dot notation
   */
  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Format currency amount for Spanish forms
   */
  private static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  /**
   * Format percentage for Spanish forms
   */
  private static formatPercentage(rate: number): string {
    return new Intl.NumberFormat('es-ES', {
      style: 'percent',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(rate);
  }

  /**
   * Get tax quarter from tax period
   */
  private static getTaxQuarter(taxPeriod: string): string {
    const month = parseInt(taxPeriod.split('-')[1]);
    if (month <= 3) return '1T';
    if (month <= 6) return '2T';
    if (month <= 9) return '3T';
    return '4T';
  }

  /**
   * Calculate submission deadline for Modelo 303
   */
  private static calculateSubmissionDeadline(taxPeriod: string): string {
    const [year, month] = taxPeriod.split('-').map(Number);
    
    // Modelo 303 deadlines: 20th of the month following the quarter
    let deadlineMonth: number;
    if (month <= 3) deadlineMonth = 4; // Q1 -> April
    else if (month <= 6) deadlineMonth = 7; // Q2 -> July
    else if (month <= 9) deadlineMonth = 10; // Q3 -> October
    else deadlineMonth = 1; // Q4 -> January of next year
    
    const deadlineYear = deadlineMonth === 1 ? year + 1 : year;
    
    return `${deadlineYear}-${deadlineMonth.toString().padStart(2, '0')}-20`;
  }

  /**
   * Calculate NIE/TIE application fee
   */
  private static calculateNIETIEFee(applicationType: string): number {
    switch (applicationType) {
      case 'nie':
        return 12.00;
      case 'tie_initial':
        return 15.30;
      case 'tie_renewal':
        return 10.20;
      default:
        return 12.00;
    }
  }

  /**
   * Get fee description for NIE/TIE application
   */
  private static getFeeDescription(applicationType: string): string {
    switch (applicationType) {
      case 'nie':
        return 'Tasa por expedición del NIE';
      case 'tie_initial':
        return 'Tasa por expedición inicial de la TIE';
      case 'tie_renewal':
        return 'Tasa por renovación de la TIE';
      default:
        return 'Tasa por trámite de extranjería';
    }
  }

  /**
   * Get required documents for NIE/TIE application
   */
  private static getRequiredDocuments(applicationType: string): string[] {
    const baseDocuments = [
      'Formulario de solicitud cumplimentado',
      'Pasaporte original y fotocopia',
      'Fotografía tamaño carnet'
    ];

    switch (applicationType) {
      case 'nie':
        return [
          ...baseDocuments,
          'Justificación de la necesidad de obtener el NIE',
          'Documentación acreditativa del motivo de la solicitud'
        ];
      case 'tie_initial':
        return [
          ...baseDocuments,
          'Autorización de residencia',
          'Certificado de empadronamiento',
          'Seguro médico'
        ];
      case 'tie_renewal':
        return [
          ...baseDocuments,
          'TIE anterior',
          'Certificado de empadronamiento actualizado',
          'Justificación de medios económicos'
        ];
      default:
        return baseDocuments;
    }
  }

  /**
   * Format address for Spanish forms
   */
  private static formatAddress(address: Address): string {
    const parts = [
      address.street,
      address.number,
      address.floor && `${address.floor}º`,
      address.door && `${address.door}`,
      address.postalCode,
      address.city,
      address.province,
      address.country
    ].filter(Boolean);

    return parts.join(', ');
  }

  /**
   * Calculate completeness score for NIE/TIE application
   */
  private static calculateCompletenessScore(data: NIETIEApplicationData): number {
    const requiredFields = [
      'fullName', 'dateOfBirth', 'nationality', 'passportNumber',
      'applicationType', 'reasonForApplication', 'currentAddress'
    ];
    
    const optionalFields = [
      'placeOfBirth', 'intendedStayDuration', 'spanishAddress',
      'supportingDocuments', 'appointmentOffice', 'preferredAppointmentDate'
    ];

    let score = 0;
    let totalWeight = 0;

    // Required fields (weight: 1.0 each)
    for (const field of requiredFields) {
      totalWeight += 1.0;
      const value = this.getNestedValue(data, field);
      if (value !== undefined && value !== null && value !== '') {
        score += 1.0;
      }
    }

    // Optional fields (weight: 0.5 each)
    for (const field of optionalFields) {
      totalWeight += 0.5;
      const value = this.getNestedValue(data, field);
      if (value !== undefined && value !== null && value !== '') {
        score += 0.5;
      }
    }

    return totalWeight > 0 ? score / totalWeight : 0;
  }

  /**
   * Validate form completeness
   */
  static validateFormCompleteness(
    formData: Record<string, any>,
    formType: 'modelo_303' | 'nie_tie_application'
  ): {
    isComplete: boolean;
    completenessScore: number;
    missingFields: string[];
    recommendations: string[];
  } {
    const rules = formType === 'modelo_303' 
      ? this.MODELO_303_VALIDATION_RULES 
      : this.NIE_TIE_VALIDATION_RULES;

    const validationResult = this.validateFormData(formData, rules);
    const recommendations: string[] = [];

    // Add specific recommendations based on form type
    if (formType === 'modelo_303') {
      if (!formData.bankAccount && formData.paymentMethod === 'direct_debit') {
        recommendations.push('Proporcione número de cuenta bancaria para domiciliación');
      }
      if (formData.netVATAmount > 3000 && !formData.economicActivity) {
        recommendations.push('Especifique la actividad económica para importes elevados');
      }
    } else if (formType === 'nie_tie_application') {
      if (!formData.spanishAddress && formData.applicationType !== 'nie') {
        recommendations.push('Proporcione dirección en España para solicitudes de TIE');
      }
      if (!formData.appointmentOffice) {
        recommendations.push('Seleccione oficina de extranjería preferida');
      }
    }

    return {
      isComplete: validationResult.isValid && validationResult.completenessScore >= 0.8,
      completenessScore: validationResult.completenessScore,
      missingFields: validationResult.missingFields,
      recommendations
    };
  }
}