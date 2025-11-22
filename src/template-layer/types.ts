/**
 * Type definitions for Template Layer workflow management system
 */

import { WorkflowCategory, WorkflowStatus } from '@prisma/client';

// ============================================================================
// WORKFLOW TEMPLATE TYPES
// ============================================================================

export interface WorkflowTemplate {
  id: string;
  name: string;
  category: WorkflowCategory;
  version: string;
  description?: string;
  steps: WorkflowStep[];
  validationSchema: ValidationSchema;
  outputFormat: OutputFormat;
  metadata: TemplateMetadata;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: StepType;
  description?: string;
  configuration: StepConfiguration;
  dependencies: string[]; // Step IDs this step depends on
  optional: boolean;
  timeout?: number; // Timeout in seconds
  retryPolicy?: RetryPolicy;
}

export type StepType = 
  | 'data_extraction'
  | 'validation' 
  | 'form_generation'
  | 'api_call'
  | 'calculation'
  | 'document_merge'
  | 'notification';

export interface StepConfiguration {
  // Data extraction configuration
  extractionRules?: ExtractionRule[];
  sourceFields?: string[];
  
  // Validation configuration
  validationRules?: ValidationRule[];
  requiredFields?: string[];
  
  // Form generation configuration
  templatePath?: string;
  outputFormat?: 'pdf' | 'xml' | 'json';
  
  // API call configuration
  endpoint?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  
  // Calculation configuration
  formula?: string;
  inputFields?: string[];
  outputField?: string;
  
  // Custom configuration
  [key: string]: any;
}

export interface ExtractionRule {
  field: string;
  source: string;
  pattern?: string;
  transformer?: string;
  required: boolean;
}

export interface ValidationRule {
  field: string;
  type: 'required' | 'pattern' | 'range' | 'custom';
  value?: any;
  message: string;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number;
  backoffMultiplier: number;
}

export interface ValidationSchema {
  type: 'object';
  properties: Record<string, SchemaProperty>;
  required: string[];
  additionalProperties: boolean;
}

export interface SchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  format?: string;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  items?: SchemaProperty;
  properties?: Record<string, SchemaProperty>;
  description?: string;
}

export interface OutputFormat {
  type: 'pdf' | 'xml' | 'json' | 'form';
  template?: string;
  fields: OutputField[];
  metadata: {
    title: string;
    description: string;
    version: string;
  };
}

export interface OutputField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'select';
  required: boolean;
  validation?: ValidationRule[];
  options?: string[]; // For select fields
}

export interface TemplateMetadata {
  author: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  regulations: string[]; // Legal references
  applicableRegions: string[];
}

// ============================================================================
// WORKFLOW EXECUTION TYPES
// ============================================================================

export interface WorkflowExecution {
  id: string;
  templateId: string;
  workspaceId: string;
  status: WorkflowStatus;
  currentStep: number;
  inputData: Record<string, any>;
  outputData?: Record<string, any>;
  stepResults: StepResult[];
  errorMessage?: string;
  retryCount: number;
  startedAt: Date;
  completedAt?: Date;
}

export interface StepResult {
  stepId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: Date;
  completedAt?: Date;
  inputData: Record<string, any>;
  outputData?: Record<string, any>;
  errorMessage?: string;
  retryCount: number;
  duration?: number; // milliseconds
}

export interface ExecutionContext {
  workspaceId: string;
  userId: string;
  correlationId: string;
  data: Record<string, any>;
  metadata: Record<string, any>;
}

// ============================================================================
// SPANISH ADMINISTRATIVE PROCESS TYPES
// ============================================================================

// Modelo 303 VAT Return specific types
export interface Modelo303Data {
  // Company information
  nif: string;
  companyName: string;
  taxPeriod: string; // YYYY-MM format
  
  // VAT calculations
  vatBase: number;
  vatRate: number;
  vatAmount: number;
  deductibleVAT: number;
  netVATAmount: number;
  
  // Additional information
  economicActivity: string;
  paymentMethod: 'bank_transfer' | 'direct_debit';
  bankAccount?: string;
  
  // Metadata
  preparationDate: string;
  submissionDeadline: string;
}

// NIE/TIE Application specific types
export interface NIETIEApplicationData {
  // Personal information
  fullName: string;
  dateOfBirth: string;
  placeOfBirth: string;
  nationality: string;
  passportNumber: string;
  
  // Application details
  applicationType: 'nie' | 'tie_initial' | 'tie_renewal';
  reasonForApplication: string;
  intendedStayDuration?: string;
  
  // Address information
  currentAddress: Address;
  spanishAddress?: Address;
  
  // Supporting documents
  supportingDocuments: string[];
  
  // Appointment information
  appointmentOffice?: string;
  preferredAppointmentDate?: string;
}

export interface Address {
  street: string;
  number: string;
  floor?: string;
  door?: string;
  postalCode: string;
  city: string;
  province: string;
  country: string;
}

// ============================================================================
// TEMPLATE VALIDATION TYPES
// ============================================================================

export interface TemplateValidationResult {
  isValid: boolean;
  errors: TemplateValidationError[];
  warnings: ValidationWarning[];
  score: number; // 0-1 completeness score
}

export interface TemplateValidationError {
  code: string;
  message: string;
  path: string;
  severity: 'error' | 'warning';
  details?: any;
}

export interface ValidationWarning {
  code: string;
  message: string;
  path: string;
  suggestion?: string;
}

// ============================================================================
// TEMPLATE STORAGE TYPES
// ============================================================================

export interface TemplateStorageConfig {
  templatesPath: string;
  cacheEnabled: boolean;
  cacheTTL: number; // seconds
  watchForChanges: boolean;
}

export interface TemplateLoadResult {
  template: WorkflowTemplate;
  source: 'file' | 'database' | 'cache';
  loadedAt: Date;
  checksum: string;
}

// ============================================================================
// EXECUTION ENGINE TYPES
// ============================================================================

export interface ExecutionEngineConfig {
  maxConcurrentExecutions: number;
  defaultTimeout: number; // seconds
  retryPolicy: RetryPolicy;
  enableMetrics: boolean;
  auditEnabled: boolean;
}

export interface ExecutionMetrics {
  executionId: string;
  templateId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // milliseconds
  stepMetrics: StepMetrics[];
  status: WorkflowStatus;
  errorCount: number;
  retryCount: number;
}

export interface StepMetrics {
  stepId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // milliseconds
  status: 'completed' | 'failed' | 'skipped';
  retryCount: number;
  memoryUsage?: number; // bytes
  cpuTime?: number; // milliseconds
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class TemplateError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'TemplateError';
  }
}

export class WorkflowExecutionError extends Error {
  constructor(
    message: string,
    public code: string,
    public stepId?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'WorkflowExecutionError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public path: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}