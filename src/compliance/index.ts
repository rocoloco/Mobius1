/**
 * Compliance Module
 * Exports compliance service and types for AESIA-compliant audit reporting
 */

export { 
  complianceService,
  ComplianceService,
  type AuditPackage,
  type ComplianceReport,
  type ComplianceFinding,
  type IntegrityResult,
  type ExportFormat,
  type AESIASchema,
  type PolicyDecisionRecord,
  type ModelCallRecord,
  type DocumentRecord,
} from './service.js';

export { complianceRoutes } from './routes.js';