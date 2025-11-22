/**
 * Template Validation Service
 * 
 * Validates extracted document data against predefined templates
 * for Spanish administrative documents
 */

import * as yaml from 'js-yaml';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DocumentTypeEnum } from '@prisma/client';
import { ExtractedDocumentData, ProcessingError } from './types.js';

export interface DocumentTemplate {
  name: string;
  type: string;
  category: string;
  version: string;
  required_fields: string[];
  optional_fields: string[];
  validation_rules: Record<string, ValidationRule>;
  confidence_thresholds: {
    minimum: number;
    target: number;
  };
  ocr_patterns: {
    document_indicators: string[];
    field_indicators: Record<string, string[]>;
  };
}

export interface ValidationRule {
  pattern?: string;
  min_length?: number;
  max_length?: number;
  allowed_values?: string[];
  description: string;
  validator?: string;
}

export interface ValidationResult {
  isValid: boolean;
  score: number; // 0-1 score based on field completeness and accuracy
  errors: ProcessingError[];
  warnings: string[];
  missingFields: string[];
  invalidFields: string[];
}

export class TemplateValidator {
  private templates: Map<DocumentTypeEnum, DocumentTemplate> = new Map();
  private readonly templatesPath = path.join(process.cwd(), 'templates');

  constructor() {
    this.loadTemplates();
  }

  /**
   * Load document templates from YAML files
   */
  private async loadTemplates(): Promise<void> {
    try {
      const templateFiles = [
        { file: 'dni-template.yaml', type: DocumentTypeEnum.DNI },
        { file: 'nie-tie-template.yaml', type: DocumentTypeEnum.NIE_TIE },
        { file: 'passport-template.yaml', type: DocumentTypeEnum.PASSPORT }
      ];

      for (const { file, type } of templateFiles) {
        try {
          const filePath = path.join(this.templatesPath, file);
          const content = await fs.readFile(filePath, 'utf8');
          const template = yaml.load(content) as DocumentTemplate;
          this.templates.set(type, template);
        } catch (error) {
          console.warn(`Failed to load template ${file}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  }

  /**
   * Validate extracted data against document template
   */
  async validateAgainstTemplate(
    extractedData: ExtractedDocumentData,
    documentType: DocumentTypeEnum,
    ocrConfidence: number
  ): Promise<ValidationResult> {
    const template = this.templates.get(documentType);
    
    if (!template) {
      return {
        isValid: false,
        score: 0,
        errors: [{
          code: 'TEMPLATE_NOT_FOUND',
          message: `No template found for document type ${documentType}`,
          timestamp: new Date()
        }],
        warnings: [],
        missingFields: [],
        invalidFields: []
      };
    }

    const errors: ProcessingError[] = [];
    const warnings: string[] = [];
    const missingFields: string[] = [];
    const invalidFields: string[] = [];

    // Check OCR confidence against template thresholds
    if (ocrConfidence < template.confidence_thresholds.minimum) {
      errors.push({
        code: 'CONFIDENCE_BELOW_MINIMUM',
        message: `OCR confidence ${(ocrConfidence * 100).toFixed(1)}% is below minimum ${(template.confidence_thresholds.minimum * 100)}%`,
        timestamp: new Date()
      });
    } else if (ocrConfidence < template.confidence_thresholds.target) {
      warnings.push(`OCR confidence ${(ocrConfidence * 100).toFixed(1)}% is below target ${(template.confidence_thresholds.target * 100)}%`);
    }

    // Validate required fields
    for (const field of template.required_fields) {
      if (!extractedData[field] || extractedData[field] === '') {
        missingFields.push(field);
        errors.push({
          code: 'MISSING_REQUIRED_FIELD',
          message: `Required field '${field}' is missing`,
          details: { field },
          timestamp: new Date()
        });
      } else {
        // Validate field against rules
        const validationResult = this.validateField(field, extractedData[field], template.validation_rules[field]);
        if (!validationResult.isValid) {
          invalidFields.push(field);
          errors.push({
            code: 'INVALID_FIELD_VALUE',
            message: `Field '${field}' has invalid value: ${validationResult.error}`,
            details: { field, value: extractedData[field] },
            timestamp: new Date()
          });
        }
      }
    }

    // Validate optional fields if present
    for (const field of template.optional_fields) {
      if (extractedData[field] && extractedData[field] !== '') {
        const validationResult = this.validateField(field, extractedData[field], template.validation_rules[field]);
        if (!validationResult.isValid) {
          warnings.push(`Optional field '${field}' has invalid value: ${validationResult.error}`);
        }
      }
    }

    // Calculate validation score
    const totalFields = template.required_fields.length + template.optional_fields.length;
    const presentFields = template.required_fields.filter(f => extractedData[f]).length + 
                         template.optional_fields.filter(f => extractedData[f]).length;
    const validFields = presentFields - invalidFields.length;
    
    const completenessScore = presentFields / totalFields;
    const accuracyScore = validFields / Math.max(presentFields, 1);
    const confidenceScore = Math.min(ocrConfidence / template.confidence_thresholds.target, 1);
    
    const score = (completenessScore * 0.4 + accuracyScore * 0.4 + confidenceScore * 0.2);

    return {
      isValid: errors.length === 0,
      score,
      errors,
      warnings,
      missingFields,
      invalidFields
    };
  }

  /**
   * Validate individual field against its rules
   */
  private validateField(fieldName: string, value: any, rule?: ValidationRule): { isValid: boolean; error?: string } {
    if (!rule) {
      return { isValid: true };
    }

    const stringValue = String(value);

    // Check pattern
    if (rule.pattern) {
      const regex = new RegExp(rule.pattern);
      if (!regex.test(stringValue)) {
        return { isValid: false, error: `Does not match pattern ${rule.pattern}` };
      }
    }

    // Check length constraints
    if (rule.min_length && stringValue.length < rule.min_length) {
      return { isValid: false, error: `Too short (minimum ${rule.min_length} characters)` };
    }

    if (rule.max_length && stringValue.length > rule.max_length) {
      return { isValid: false, error: `Too long (maximum ${rule.max_length} characters)` };
    }

    // Check allowed values
    if (rule.allowed_values && !rule.allowed_values.includes(stringValue)) {
      return { isValid: false, error: `Not in allowed values: ${rule.allowed_values.join(', ')}` };
    }

    // Apply custom validators
    if (rule.validator) {
      const validatorResult = this.applyCustomValidator(rule.validator, stringValue);
      if (!validatorResult.isValid) {
        return validatorResult;
      }
    }

    return { isValid: true };
  }

  /**
   * Apply custom validation logic
   */
  private applyCustomValidator(validator: string, value: string): { isValid: boolean; error?: string } {
    switch (validator) {
      case 'dni_checksum':
        return this.validateDNIChecksum(value);
      
      case 'nie_checksum':
        return this.validateNIEChecksum(value);
      
      case 'valid_date':
        return this.validateDate(value);
      
      case 'future_date':
        return this.validateFutureDate(value);
      
      default:
        console.warn(`Unknown validator: ${validator}`);
        return { isValid: true };
    }
  }

  /**
   * Validate DNI checksum
   */
  private validateDNIChecksum(dni: string): { isValid: boolean; error?: string } {
    if (!/^\d{8}[A-Z]$/.test(dni)) {
      return { isValid: false, error: 'Invalid DNI format' };
    }

    const letters = 'TRWAGMYFPDXBNJZSQVHLCKE';
    const number = parseInt(dni.substring(0, 8), 10);
    const letter = dni.charAt(8);
    const expectedLetter = letters.charAt(number % 23);

    if (letter !== expectedLetter) {
      return { isValid: false, error: `Invalid DNI checksum. Expected ${expectedLetter}, got ${letter}` };
    }

    return { isValid: true };
  }

  /**
   * Validate NIE checksum
   */
  private validateNIEChecksum(nie: string): { isValid: boolean; error?: string } {
    if (!/^[XY]\d{7}[A-Z]$/.test(nie)) {
      return { isValid: false, error: 'Invalid NIE format' };
    }

    const letters = 'TRWAGMYFPDXBNJZSQVHLCKE';
    let number = nie.substring(1, 8);
    
    // Convert X/Y to numbers
    if (nie.charAt(0) === 'X') number = '0' + number;
    if (nie.charAt(0) === 'Y') number = '1' + number;
    
    const numValue = parseInt(number, 10);
    const letter = nie.charAt(8);
    const expectedLetter = letters.charAt(numValue % 23);

    if (letter !== expectedLetter) {
      return { isValid: false, error: `Invalid NIE checksum. Expected ${expectedLetter}, got ${letter}` };
    }

    return { isValid: true };
  }

  /**
   * Validate date format and reasonableness
   */
  private validateDate(dateStr: string): { isValid: boolean; error?: string } {
    const dateRegex = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
    if (!dateRegex.test(dateStr)) {
      return { isValid: false, error: 'Invalid date format. Expected DD/MM/YYYY' };
    }

    const [day, month, year] = dateStr.split('/').map(Number);
    const date = new Date(year, month - 1, day);

    // Check if date is valid
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return { isValid: false, error: 'Invalid date' };
    }

    // Check reasonable date range
    if (year < 1900 || year > new Date().getFullYear() + 10) {
      return { isValid: false, error: 'Date is outside reasonable range' };
    }

    return { isValid: true };
  }

  /**
   * Validate that date is in the future
   */
  private validateFutureDate(dateStr: string): { isValid: boolean; error?: string } {
    const dateValidation = this.validateDate(dateStr);
    if (!dateValidation.isValid) {
      return dateValidation;
    }

    const [day, month, year] = dateStr.split('/').map(Number);
    const date = new Date(year, month - 1, day);
    const now = new Date();

    if (date <= now) {
      return { isValid: false, error: 'Date must be in the future' };
    }

    return { isValid: true };
  }

  /**
   * Get template for document type
   */
  getTemplate(documentType: DocumentTypeEnum): DocumentTemplate | undefined {
    return this.templates.get(documentType);
  }

  /**
   * Check if text contains document indicators from template
   */
  matchesDocumentIndicators(text: string, documentType: DocumentTypeEnum): boolean {
    const template = this.templates.get(documentType);
    if (!template) return false;

    const upperText = text.toUpperCase();
    return template.ocr_patterns.document_indicators.some(indicator => 
      upperText.includes(indicator.toUpperCase())
    );
  }
}