/**
 * Policy Engine Types
 * Core types for policy evaluation, residency validation, and PII redaction
 */

import type { RequestContext, UserRole } from '../auth/types.js';

/**
 * Policy decision result
 */
export interface PolicyDecision {
  allow: boolean;
  reasons: string[];
  residency: ResidencyValidation;
  redaction: PIIRedactionResult;
  quota: QuotaDecision;
  timestamp: Date;
  evaluationTimeMs: number;
}

/**
 * Residency validation result
 */
export interface ResidencyValidation {
  allowedRegion: 'ES' | 'EU' | 'GLOBAL';
  enforced: boolean;
  currentLocation?: GeographicLocation;
  compliant: boolean;
  violations: string[];
}

/**
 * Geographic location information
 */
export interface GeographicLocation {
  country: string;
  region?: string;
  city?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  dataCenter?: string;
  provider?: string;
}

/**
 * PII redaction result
 */
export interface PIIRedactionResult {
  applied: boolean;
  categories: PIICategory[];
  redactedCount: number;
  originalText?: string; // Only for audit purposes, never logged
  redactedText: string;
  confidence: number;
}

/**
 * PII categories for Spanish documents
 */
export enum PIICategory {
  DNI = 'dni',
  PASSPORT = 'passport',
  NIE_TIE = 'nie_tie',
  PHONE = 'phone',
  EMAIL = 'email',
  ADDRESS = 'address',
  BANK_ACCOUNT = 'bank_account',
  TAX_ID = 'tax_id',
  SOCIAL_SECURITY = 'social_security',
  NAME = 'name',
  DATE_OF_BIRTH = 'date_of_birth',
}

/**
 * Quota decision result
 */
export interface QuotaDecision {
  remaining: number;
  window: string;
  exceeded: boolean;
  resetTime: Date;
}

/**
 * Policy evaluation context
 */
export interface EvaluationContext {
  request: RequestContext;
  resource: string;
  action: string;
  data?: any;
  metadata?: Record<string, any>;
}

/**
 * Policy rule definition
 */
export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  type: PolicyRuleType;
  conditions: PolicyCondition[];
  effect: PolicyEffect;
  priority: number;
  enabled: boolean;
}

/**
 * Policy rule types
 */
export enum PolicyRuleType {
  RBAC = 'rbac',
  ABAC = 'abac',
  RESIDENCY = 'residency',
  PII_PROTECTION = 'pii_protection',
  QUOTA = 'quota',
  SECURITY = 'security',
}

/**
 * Policy effects
 */
export enum PolicyEffect {
  ALLOW = 'allow',
  DENY = 'deny',
  AUDIT = 'audit',
  REDACT = 'redact',
}

/**
 * Policy condition
 */
export interface PolicyCondition {
  field: string;
  operator: PolicyOperator;
  value: any;
  negate?: boolean;
}

/**
 * Policy operators
 */
export enum PolicyOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
  REGEX = 'regex',
  IN = 'in',
  NOT_IN = 'not_in',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  EXISTS = 'exists',
  NOT_EXISTS = 'not_exists',
}

/**
 * Residency configuration
 */
export interface ResidencyConfig {
  enforceSpainOnly: boolean;
  allowedCountries: string[];
  allowedRegions: string[];
  strictMode: boolean;
  auditAllRequests: boolean;
}

/**
 * PII redaction configuration
 */
export interface RedactionConfig {
  enabledCategories: PIICategory[];
  redactionChar: string;
  preserveFormat: boolean;
  auditRedactions: boolean;
  confidenceThreshold: number;
}

/**
 * Budget configuration
 */
export interface BudgetConfig {
  monthlyLimit: number;
  dailyLimit: number;
  alertThresholds: number[];
  currency: string;
  costPerToken: number;
  costPerRequest: number;
}

/**
 * Compliance configuration
 */
export interface ComplianceConfig {
  gdprEnabled: boolean;
  aesiaEnabled: boolean;
  auditRetentionDays: number;
  requireExplicitConsent: boolean;
  dataSubjectRights: boolean;
}

/**
 * Audit event for policy decisions
 */
export interface PolicyAuditEvent {
  id: string;
  workspaceId: string;
  userId?: string;
  eventType: 'policy_evaluation' | 'policy_violation' | 'residency_check' | 'pii_redaction';
  decision: PolicyDecision;
  context: EvaluationContext;
  correlationId: string;
  timestamp: Date;
}

/**
 * Policy evaluation result
 */
export interface PolicyResult {
  decision: PolicyDecision;
  appliedRules: PolicyRule[];
  violations: PolicyViolation[];
  auditEvents: PolicyAuditEvent[];
}

/**
 * Policy violation
 */
export interface PolicyViolation {
  ruleId: string;
  ruleName: string;
  severity: ViolationSeverity;
  message: string;
  context: EvaluationContext;
  timestamp: Date;
}

/**
 * Violation severity levels
 */
export enum ViolationSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}