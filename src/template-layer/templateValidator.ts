/**
 * Template Validator - Schema validation and enforcement
 * 
 * Validates workflow templates and input data against schemas
 * to ensure correctness and compliance.
 */

import { 
  WorkflowTemplate, 
  ValidationSchema, 
  SchemaProperty,
  TemplateValidationResult,
  TemplateValidationError,
  ValidationWarning,
  WorkflowStep,
  StepType
} from './types.js';

export class TemplateValidator {
  private readonly REQUIRED_TEMPLATE_FIELDS = [
    'id', 'name', 'category', 'steps'
  ];
  
  private readonly REQUIRED_STEP_FIELDS = [
    'id', 'name', 'type', 'configuration'
  ];
  
  private readonly VALID_STEP_TYPES: StepType[] = [
    'data_extraction',
    'validation',
    'form_generation',
    'api_call',
    'calculation',
    'document_merge',
    'notification'
  ];

  /**
   * Validate a workflow template structure
   */
  async validateTemplate(templateData: any): Promise<TemplateValidationResult> {
    const errors: TemplateValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let score = 1.0;

    // Check required fields
    for (const field of this.REQUIRED_TEMPLATE_FIELDS) {
      if (!templateData[field]) {
        errors.push({
          code: 'MISSING_REQUIRED_FIELD',
          message: `Required field '${field}' is missing`,
          path: field,
          severity: 'error'
        });
        score -= 0.2;
      }
    }

    // Validate template ID
    if (templateData.id && typeof templateData.id !== 'string') {
      errors.push({
        code: 'INVALID_FIELD_TYPE',
        message: 'Template ID must be a string',
        path: 'id',
        severity: 'error'
      });
    }

    // Validate steps array
    if (templateData.steps) {
      if (!Array.isArray(templateData.steps)) {
        errors.push({
          code: 'INVALID_FIELD_TYPE',
          message: 'Steps must be an array',
          path: 'steps',
          severity: 'error'
        });
        score -= 0.3;
      } else {
        const stepValidation = this.validateSteps(templateData.steps);
        errors.push(...stepValidation.errors);
        warnings.push(...stepValidation.warnings);
        score *= stepValidation.score;
      }
    }

    // Validate validation schema if present
    if (templateData.validationSchema) {
      const schemaValidation = this.validateValidationSchema(templateData.validationSchema);
      errors.push(...schemaValidation.errors);
      warnings.push(...schemaValidation.warnings);
      score *= schemaValidation.score;
    }

    // Validate output format if present
    if (templateData.outputFormat) {
      const outputValidation = this.validateOutputFormat(templateData.outputFormat);
      errors.push(...outputValidation.errors);
      warnings.push(...outputValidation.warnings);
      score *= outputValidation.score;
    }

    // Check for circular dependencies in steps
    if (templateData.steps && Array.isArray(templateData.steps)) {
      const circularDeps = this.checkCircularDependencies(templateData.steps);
      if (circularDeps.length > 0) {
        errors.push({
          code: 'CIRCULAR_DEPENDENCY',
          message: `Circular dependencies detected: ${circularDeps.join(', ')}`,
          path: 'steps',
          severity: 'error',
          details: { circularDependencies: circularDeps }
        });
        score -= 0.2;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score: Math.max(0, score)
    };
  }

  /**
   * Validate workflow steps
   */
  private validateSteps(steps: any[]): TemplateValidationResult {
    const errors: TemplateValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let score = 1.0;
    const stepIds = new Set<string>();

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepPath = `steps[${i}]`;

      // Check required step fields
      for (const field of this.REQUIRED_STEP_FIELDS) {
        if (!step[field]) {
          errors.push({
            code: 'MISSING_REQUIRED_FIELD',
            message: `Required field '${field}' is missing in step ${i}`,
            path: `${stepPath}.${field}`,
            severity: 'error'
          });
          score -= 0.1;
        }
      }

      // Validate step ID uniqueness
      if (step.id) {
        if (stepIds.has(step.id)) {
          errors.push({
            code: 'DUPLICATE_STEP_ID',
            message: `Duplicate step ID '${step.id}' found`,
            path: `${stepPath}.id`,
            severity: 'error'
          });
          score -= 0.1;
        } else {
          stepIds.add(step.id);
        }
      }

      // Validate step type
      if (step.type && !this.VALID_STEP_TYPES.includes(step.type)) {
        errors.push({
          code: 'INVALID_STEP_TYPE',
          message: `Invalid step type '${step.type}'. Valid types: ${this.VALID_STEP_TYPES.join(', ')}`,
          path: `${stepPath}.type`,
          severity: 'error'
        });
        score -= 0.1;
      }

      // Validate step configuration
      if (step.configuration) {
        const configValidation = this.validateStepConfiguration(step.type, step.configuration, stepPath);
        errors.push(...configValidation.errors);
        warnings.push(...configValidation.warnings);
        score *= configValidation.score;
      }

      // Validate dependencies
      if (step.dependencies && Array.isArray(step.dependencies)) {
        for (const depId of step.dependencies) {
          if (typeof depId !== 'string') {
            errors.push({
              code: 'INVALID_DEPENDENCY_TYPE',
              message: `Dependency ID must be a string, got ${typeof depId}`,
              path: `${stepPath}.dependencies`,
              severity: 'error'
            });
          }
        }
      }

      // Check for reasonable timeout values
      if (step.timeout && (step.timeout < 1 || step.timeout > 3600)) {
        warnings.push({
          code: 'UNUSUAL_TIMEOUT',
          message: `Step timeout of ${step.timeout}s seems unusual (recommended: 1-3600s)`,
          path: `${stepPath}.timeout`,
          suggestion: 'Consider using a timeout between 1 and 3600 seconds'
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score: Math.max(0, score)
    };
  }

  /**
   * Validate step configuration based on step type
   */
  private validateStepConfiguration(stepType: string, config: any, stepPath: string): TemplateValidationResult {
    const errors: TemplateValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let score = 1.0;

    switch (stepType) {
      case 'data_extraction':
        if (!config.extractionRules && !config.sourceFields) {
          warnings.push({
            code: 'MISSING_EXTRACTION_CONFIG',
            message: 'Data extraction step should have extractionRules or sourceFields',
            path: `${stepPath}.configuration`,
            suggestion: 'Add extractionRules or sourceFields to define what data to extract'
          });
        }
        break;

      case 'validation':
        if (!config.validationRules && !config.requiredFields) {
          warnings.push({
            code: 'MISSING_VALIDATION_CONFIG',
            message: 'Validation step should have validationRules or requiredFields',
            path: `${stepPath}.configuration`,
            suggestion: 'Add validationRules or requiredFields to define validation criteria'
          });
        }
        break;

      case 'form_generation':
        if (!config.templatePath && !config.outputFormat) {
          errors.push({
            code: 'MISSING_FORM_CONFIG',
            message: 'Form generation step requires templatePath or outputFormat',
            path: `${stepPath}.configuration`,
            severity: 'error'
          });
          score -= 0.2;
        }
        break;

      case 'api_call':
        if (!config.endpoint) {
          errors.push({
            code: 'MISSING_API_ENDPOINT',
            message: 'API call step requires endpoint configuration',
            path: `${stepPath}.configuration`,
            severity: 'error'
          });
          score -= 0.2;
        }
        if (config.method && !['GET', 'POST', 'PUT', 'DELETE'].includes(config.method)) {
          errors.push({
            code: 'INVALID_HTTP_METHOD',
            message: `Invalid HTTP method '${config.method}'`,
            path: `${stepPath}.configuration.method`,
            severity: 'error'
          });
        }
        break;

      case 'calculation':
        if (!config.formula && !config.inputFields) {
          errors.push({
            code: 'MISSING_CALCULATION_CONFIG',
            message: 'Calculation step requires formula or inputFields',
            path: `${stepPath}.configuration`,
            severity: 'error'
          });
          score -= 0.2;
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score: Math.max(0, score)
    };
  }

  /**
   * Validate validation schema structure
   */
  private validateValidationSchema(schema: any): TemplateValidationResult {
    const errors: TemplateValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let score = 1.0;

    if (typeof schema !== 'object' || schema === null) {
      errors.push({
        code: 'INVALID_SCHEMA_TYPE',
        message: 'Validation schema must be an object',
        path: 'validationSchema',
        severity: 'error'
      });
      return { isValid: false, errors, warnings, score: 0 };
    }

    // Check required schema fields
    if (schema.type !== 'object') {
      errors.push({
        code: 'INVALID_SCHEMA_TYPE',
        message: 'Root schema type must be "object"',
        path: 'validationSchema.type',
        severity: 'error'
      });
      score -= 0.2;
    }

    if (!schema.properties || typeof schema.properties !== 'object') {
      warnings.push({
        code: 'MISSING_SCHEMA_PROPERTIES',
        message: 'Schema should define properties',
        path: 'validationSchema.properties',
        suggestion: 'Add properties to define the expected data structure'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score: Math.max(0, score)
    };
  }

  /**
   * Validate output format structure
   */
  private validateOutputFormat(outputFormat: any): TemplateValidationResult {
    const errors: TemplateValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let score = 1.0;

    if (typeof outputFormat !== 'object' || outputFormat === null) {
      errors.push({
        code: 'INVALID_OUTPUT_FORMAT_TYPE',
        message: 'Output format must be an object',
        path: 'outputFormat',
        severity: 'error'
      });
      return { isValid: false, errors, warnings, score: 0 };
    }

    const validTypes = ['pdf', 'xml', 'json', 'form'];
    if (!outputFormat.type || !validTypes.includes(outputFormat.type)) {
      errors.push({
        code: 'INVALID_OUTPUT_TYPE',
        message: `Output type must be one of: ${validTypes.join(', ')}`,
        path: 'outputFormat.type',
        severity: 'error'
      });
      score -= 0.2;
    }

    if (!outputFormat.fields || !Array.isArray(outputFormat.fields)) {
      warnings.push({
        code: 'MISSING_OUTPUT_FIELDS',
        message: 'Output format should define fields',
        path: 'outputFormat.fields',
        suggestion: 'Add fields array to define the output structure'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score: Math.max(0, score)
    };
  }

  /**
   * Check for circular dependencies in workflow steps
   */
  private checkCircularDependencies(steps: WorkflowStep[]): string[] {
    const stepMap = new Map<string, string[]>();
    const circularDeps: string[] = [];

    // Build dependency map
    for (const step of steps) {
      stepMap.set(step.id, step.dependencies || []);
    }

    // Check each step for circular dependencies
    for (const step of steps) {
      const visited = new Set<string>();
      const recursionStack = new Set<string>();
      
      if (this.hasCycle(step.id, stepMap, visited, recursionStack)) {
        circularDeps.push(step.id);
      }
    }

    return circularDeps;
  }

  /**
   * Detect cycles in dependency graph using DFS
   */
  private hasCycle(
    stepId: string, 
    stepMap: Map<string, string[]>, 
    visited: Set<string>, 
    recursionStack: Set<string>
  ): boolean {
    if (recursionStack.has(stepId)) {
      return true; // Cycle detected
    }
    
    if (visited.has(stepId)) {
      return false; // Already processed
    }

    visited.add(stepId);
    recursionStack.add(stepId);

    const dependencies = stepMap.get(stepId) || [];
    for (const depId of dependencies) {
      if (this.hasCycle(depId, stepMap, visited, recursionStack)) {
        return true;
      }
    }

    recursionStack.delete(stepId);
    return false;
  }

  /**
   * Validate data against a validation schema
   */
  async validateData(data: Record<string, any>, schema: ValidationSchema): Promise<TemplateValidationResult> {
    const errors: TemplateValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let score = 1.0;

    // Check required fields
    for (const requiredField of schema.required || []) {
      if (!(requiredField in data) || data[requiredField] === null || data[requiredField] === undefined) {
        errors.push({
          code: 'MISSING_REQUIRED_FIELD',
          message: `Required field '${requiredField}' is missing`,
          path: requiredField,
          severity: 'error'
        });
        score -= 0.1;
      }
    }

    // Validate each property
    for (const [fieldName, fieldValue] of Object.entries(data)) {
      const propertySchema = schema.properties?.[fieldName];
      
      if (!propertySchema) {
        if (!schema.additionalProperties) {
          warnings.push({
            code: 'UNEXPECTED_FIELD',
            message: `Unexpected field '${fieldName}' found`,
            path: fieldName,
            suggestion: 'Remove this field or add it to the schema'
          });
        }
        continue;
      }

      const fieldValidation = this.validateFieldValue(fieldName, fieldValue, propertySchema);
      errors.push(...fieldValidation.errors);
      warnings.push(...fieldValidation.warnings);
      score *= fieldValidation.score;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score: Math.max(0, score)
    };
  }

  /**
   * Validate a single field value against its schema property
   */
  private validateFieldValue(fieldName: string, value: any, property: SchemaProperty): TemplateValidationResult {
    const errors: TemplateValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let score = 1.0;

    // Type validation
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (property.type && actualType !== property.type) {
      errors.push({
        code: 'INVALID_FIELD_TYPE',
        message: `Field '${fieldName}' should be ${property.type}, got ${actualType}`,
        path: fieldName,
        severity: 'error'
      });
      score -= 0.2;
      return { isValid: false, errors, warnings, score };
    }

    // Pattern validation for strings
    if (property.type === 'string' && property.pattern && typeof value === 'string') {
      const regex = new RegExp(property.pattern);
      if (!regex.test(value)) {
        errors.push({
          code: 'PATTERN_MISMATCH',
          message: `Field '${fieldName}' does not match required pattern: ${property.pattern}`,
          path: fieldName,
          severity: 'error'
        });
        score -= 0.1;
      }
    }

    // Range validation for numbers
    if (property.type === 'number' && typeof value === 'number') {
      if (property.minimum !== undefined && value < property.minimum) {
        errors.push({
          code: 'VALUE_TOO_SMALL',
          message: `Field '${fieldName}' value ${value} is below minimum ${property.minimum}`,
          path: fieldName,
          severity: 'error'
        });
        score -= 0.1;
      }
      
      if (property.maximum !== undefined && value > property.maximum) {
        errors.push({
          code: 'VALUE_TOO_LARGE',
          message: `Field '${fieldName}' value ${value} is above maximum ${property.maximum}`,
          path: fieldName,
          severity: 'error'
        });
        score -= 0.1;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score: Math.max(0, score)
    };
  }
}