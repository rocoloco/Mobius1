/**
 * Audit Module
 * Exports audit service and types for comprehensive audit logging
 */

export { 
  auditService,
  AuditService,
  AuditEventType,
  AuditSeverity,
  type BaseAuditEvent,
  type PolicyAuditEvent,
  type ResidencyAuditEvent,
  type PIIAuditEvent,
  type SecurityAuditEvent,
  type AuditEventOptions,
  type AuditQueryFilters,
  type AuditStatistics,
} from './service.js';

export { auditMiddleware } from './middleware.js';
export { auditRoutes } from './routes.js';