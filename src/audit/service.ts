/**
 * Audit Service
 * Comprehensive audit logging and compliance tracking for Mobius 1 Platform
 * Implements immutable audit trail with correlation IDs and partitioning strategy
 */

import { randomUUID } from 'crypto';
import { db } from '../database/client.js';
import { appConfig } from '../config/index.js';
import type { RequestContext } from '../auth/types.js';
import type { 
  PolicyDecision, 
  ResidencyValidation, 
  PIIRedactionResult 
} from '../policy/types.js';

/**
 * Audit event types for comprehensive tracking
 */
export enum AuditEventType {
  // Authentication events
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  AUTH_FAILURE = 'AUTH_FAILURE',
  SESSION_EXPIRED = 'SESSION_EXPIRED',

  // Document processing events
  DOCUMENT_UPLOAD = 'DOCUMENT_UPLOAD',
  DOCUMENT_PROCESS = 'DOCUMENT_PROCESS',
  DOCUMENT_DELETE = 'DOCUMENT_DELETE',
  OCR_EXTRACTION = 'OCR_EXTRACTION',

  // Workflow events
  WORKFLOW_START = 'WORKFLOW_START',
  WORKFLOW_COMPLETE = 'WORKFLOW_COMPLETE',
  WORKFLOW_FAILED = 'WORKFLOW_FAILED',
  TEMPLATE_VALIDATION = 'TEMPLATE_VALIDATION',

  // Policy and compliance events
  POLICY_EVALUATION = 'POLICY_EVALUATION',
  POLICY_VIOLATION = 'POLICY_VIOLATION',
  RESIDENCY_CHECK = 'RESIDENCY_CHECK',
  RESIDENCY_VIOLATION = 'RESIDENCY_VIOLATION',
  PII_REDACTION = 'PII_REDACTION',
  PII_DETECTION = 'PII_DETECTION',

  // Budget and quota events
  BUDGET_ALERT = 'BUDGET_ALERT',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  USAGE_TRACKING = 'USAGE_TRACKING',

  // System events
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  HEALTH_CHECK = 'HEALTH_CHECK',
  DEPLOYMENT_EVENT = 'DEPLOYMENT_EVENT',
  CONFIGURATION_CHANGE = 'CONFIGURATION_CHANGE',

  // Security events
  PROMPT_INJECTION_ATTEMPT = 'PROMPT_INJECTION_ATTEMPT',
  TOOL_VALIDATION_FAILURE = 'TOOL_VALIDATION_FAILURE',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',

  // Compliance events
  COMPLIANCE_REPORT_GENERATED = 'COMPLIANCE_REPORT_GENERATED',
  AUDIT_EXPORT = 'AUDIT_EXPORT',
  DATA_RETENTION_CLEANUP = 'DATA_RETENTION_CLEANUP',
}

/**
 * Audit event severity levels
 */
export enum AuditSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Base audit event interface
 */
export interface BaseAuditEvent {
  eventType: AuditEventType;
  severity: AuditSeverity;
  resourceId: string;
  action: string;
  metadata: Record<string, any>;
  correlationId: string;
  workspaceId: string;
  userId?: string;
  timestamp?: Date;
}

/**
 * Policy-specific audit event
 */
export interface PolicyAuditEvent extends BaseAuditEvent {
  eventType: AuditEventType.POLICY_EVALUATION | AuditEventType.POLICY_VIOLATION;
  policyDecision: PolicyDecision;
  requestContext: RequestContext;
}

/**
 * Residency-specific audit event
 */
export interface ResidencyAuditEvent extends BaseAuditEvent {
  eventType: AuditEventType.RESIDENCY_CHECK | AuditEventType.RESIDENCY_VIOLATION;
  residencyValidation: ResidencyValidation;
  requestedOperation: string;
  clientLocation?: {
    ip: string;
    country?: string;
    region?: string;
  };
}

/**
 * PII-specific audit event
 */
export interface PIIAuditEvent extends BaseAuditEvent {
  eventType: AuditEventType.PII_REDACTION | AuditEventType.PII_DETECTION;
  redactionResult: PIIRedactionResult;
  documentType?: string;
  processingContext: string;
}

/**
 * Security-specific audit event
 */
export interface SecurityAuditEvent extends BaseAuditEvent {
  eventType: AuditEventType.PROMPT_INJECTION_ATTEMPT | AuditEventType.TOOL_VALIDATION_FAILURE | AuditEventType.UNAUTHORIZED_ACCESS;
  securityContext: {
    threatType: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    mitigationApplied: boolean;
    additionalDetails: Record<string, any>;
  };
}

/**
 * Audit event creation options
 */
export interface AuditEventOptions {
  includeRequestContext?: boolean;
  includePIIRedaction?: boolean;
  customCorrelationId?: string;
  additionalMetadata?: Record<string, any>;
}

/**
 * Audit query filters
 */
export interface AuditQueryFilters {
  workspaceId?: string;
  userId?: string;
  eventTypes?: AuditEventType[];
  severity?: AuditSeverity[];
  correlationId?: string;
  resourceId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Audit statistics
 */
export interface AuditStatistics {
  totalEvents: number;
  eventsByType: Record<AuditEventType, number>;
  eventsBySeverity: Record<AuditSeverity, number>;
  violationCount: number;
  complianceScore: number;
  timeRange: {
    from: Date;
    to: Date;
  };
}

/**
 * Main Audit Service class
 */
export class AuditService {
  private readonly retentionDays: number;

  constructor() {
    this.retentionDays = appConfig.audit.retentionDays;
  }

  /**
   * Log a general audit event
   */
  async logEvent(event: BaseAuditEvent, options: AuditEventOptions = {}): Promise<string> {
    const eventId = randomUUID();
    const timestamp = event.timestamp || new Date();
    const correlationId = options.customCorrelationId || event.correlationId;

    // Merge additional metadata
    const metadata = {
      ...event.metadata,
      ...options.additionalMetadata,
    };

    try {
      await db.auditEvent.create({
        data: {
          id: eventId,
          workspaceId: event.workspaceId,
          userId: event.userId || null,
          eventType: event.eventType as any, // Type assertion for Prisma enum
          resourceId: event.resourceId,
          action: event.action,
          metadata,
          correlationId,
          timestamp,
          piiRedacted: options.includePIIRedaction || false,
        },
      });

      return eventId;
    } catch (error) {
      console.error('Failed to log audit event:', {
        eventId,
        eventType: event.eventType,
        workspaceId: event.workspaceId,
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Log a policy evaluation event
   */
  async logPolicyEvent(event: PolicyAuditEvent, options: AuditEventOptions = {}): Promise<string> {
    const enhancedMetadata = {
      ...event.metadata,
      policyDecision: {
        allow: event.policyDecision.allow,
        reasons: event.policyDecision.reasons,
        evaluationTimeMs: event.policyDecision.evaluationTimeMs,
      },
      requestContext: {
        method: event.requestContext.clientIP ? 'authenticated' : 'anonymous',
        userAgent: event.requestContext.userAgent,
        clientIP: event.requestContext.clientIP,
      },
    };

    return this.logEvent({
      ...event,
      metadata: enhancedMetadata,
    }, {
      ...options,
      includePIIRedaction: event.policyDecision.redaction.applied,
      additionalMetadata: {
        residencyValidation: event.policyDecision.residency,
        quotaStatus: event.policyDecision.quota,
      },
    });
  }

  /**
   * Log a residency validation event
   */
  async logResidencyEvent(event: ResidencyAuditEvent, options: AuditEventOptions = {}): Promise<string> {
    const enhancedMetadata = {
      ...event.metadata,
      residencyValidation: event.residencyValidation,
      requestedOperation: event.requestedOperation,
      clientLocation: event.clientLocation,
    };

    return this.logEvent({
      ...event,
      metadata: enhancedMetadata,
      severity: event.residencyValidation.compliant ? AuditSeverity.INFO : AuditSeverity.ERROR,
    }, options);
  }

  /**
   * Log a PII redaction event
   */
  async logPIIEvent(event: PIIAuditEvent, options: AuditEventOptions = {}): Promise<string> {
    const enhancedMetadata = {
      ...event.metadata,
      redactionResult: {
        applied: event.redactionResult.applied,
        categories: event.redactionResult.categories,
        redactedCount: event.redactionResult.redactedCount,
        confidence: event.redactionResult.confidence,
      },
      documentType: event.documentType,
      processingContext: event.processingContext,
    };

    return this.logEvent({
      ...event,
      metadata: enhancedMetadata,
    }, {
      ...options,
      includePIIRedaction: true,
    });
  }

  /**
   * Log a security event
   */
  async logSecurityEvent(event: SecurityAuditEvent, options: AuditEventOptions = {}): Promise<string> {
    const enhancedMetadata = {
      ...event.metadata,
      securityContext: event.securityContext,
    };

    return this.logEvent({
      ...event,
      metadata: enhancedMetadata,
      severity: this.mapRiskLevelToSeverity(event.securityContext.riskLevel),
    }, options);
  }

  /**
   * Query audit events with filters
   */
  async queryEvents(filters: AuditQueryFilters = {}): Promise<any[]> {
    const {
      workspaceId,
      userId,
      eventTypes,
      severity,
      correlationId,
      resourceId,
      dateFrom,
      dateTo,
      limit = 100,
      offset = 0,
    } = filters;

    const where: any = {};

    if (workspaceId) where.workspaceId = workspaceId;
    if (userId) where.userId = userId;
    if (correlationId) where.correlationId = correlationId;
    if (resourceId) where.resourceId = resourceId;

    if (eventTypes && eventTypes.length > 0) {
      where.eventType = { in: eventTypes };
    }

    if (dateFrom || dateTo) {
      where.timestamp = {};
      if (dateFrom) where.timestamp.gte = dateFrom;
      if (dateTo) where.timestamp.lte = dateTo;
    }

    try {
      return await db.auditEvent.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
          workspace: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    } catch (error) {
      console.error('Failed to query audit events:', error);
      throw error;
    }
  }

  /**
   * Get audit statistics for a workspace
   */
  async getStatistics(workspaceId: string, dateFrom?: Date, dateTo?: Date): Promise<AuditStatistics> {
    const where: any = { workspaceId };

    if (dateFrom || dateTo) {
      where.timestamp = {};
      if (dateFrom) where.timestamp.gte = dateFrom;
      if (dateTo) where.timestamp.lte = dateTo;
    }

    try {
      // Get total count
      const totalEvents = await db.auditEvent.count({ where });

      // Get events by type
      const eventsByTypeRaw = await db.auditEvent.groupBy({
        by: ['eventType'],
        where,
        _count: { eventType: true },
      });

      const eventsByType = eventsByTypeRaw.reduce((acc, item) => {
        acc[item.eventType as AuditEventType] = item._count.eventType;
        return acc;
      }, {} as Record<AuditEventType, number>);

      // Count violations
      const violationTypes = [
        AuditEventType.POLICY_VIOLATION,
        AuditEventType.RESIDENCY_VIOLATION,
        AuditEventType.PROMPT_INJECTION_ATTEMPT,
        AuditEventType.UNAUTHORIZED_ACCESS,
      ];

      const violationCount = await db.auditEvent.count({
        where: {
          ...where,
          eventType: { in: violationTypes },
        },
      });

      // Calculate compliance score (percentage of non-violation events)
      const complianceScore = totalEvents > 0 ? ((totalEvents - violationCount) / totalEvents) * 100 : 100;

      return {
        totalEvents,
        eventsByType,
        eventsBySeverity: {} as Record<AuditSeverity, number>, // Would need to be calculated from metadata
        violationCount,
        complianceScore,
        timeRange: {
          from: dateFrom || new Date(0),
          to: dateTo || new Date(),
        },
      };
    } catch (error) {
      console.error('Failed to get audit statistics:', error);
      throw error;
    }
  }

  /**
   * Get events by correlation ID for tracing
   */
  async getEventsByCorrelation(correlationId: string): Promise<any[]> {
    try {
      return await db.auditEvent.findMany({
        where: { correlationId },
        orderBy: { timestamp: 'asc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });
    } catch (error) {
      console.error('Failed to get events by correlation ID:', error);
      throw error;
    }
  }

  /**
   * Clean up old audit events based on retention policy
   */
  async cleanupOldEvents(): Promise<{ deletedCount: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

    try {
      const result = await db.auditEvent.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
        },
      });

      // Log the cleanup operation
      await this.logEvent({
        eventType: AuditEventType.DATA_RETENTION_CLEANUP,
        severity: AuditSeverity.INFO,
        resourceId: 'audit_events',
        action: 'cleanup',
        metadata: {
          cutoffDate: cutoffDate.toISOString(),
          deletedCount: result.count,
          retentionDays: this.retentionDays,
        },
        correlationId: randomUUID(),
        workspaceId: 'system',
      });

      return { deletedCount: result.count };
    } catch (error) {
      console.error('Failed to cleanup old audit events:', error);
      throw error;
    }
  }

  /**
   * Validate audit trail integrity
   */
  async validateIntegrity(workspaceId: string, dateFrom: Date, dateTo: Date): Promise<{
    valid: boolean;
    issues: string[];
    eventCount: number;
  }> {
    const issues: string[] = [];

    try {
      // Check for gaps in correlation IDs
      const events = await this.queryEvents({
        workspaceId,
        dateFrom,
        dateTo,
        limit: 10000, // Large limit for integrity check
      });

      const eventCount = events.length;

      // Check for duplicate correlation IDs within the same workspace
      const correlationIds = events.map(e => e.correlationId);
      const uniqueCorrelationIds = new Set(correlationIds);
      
      if (correlationIds.length !== uniqueCorrelationIds.size) {
        issues.push('Duplicate correlation IDs detected');
      }

      // Check for events without proper metadata
      const eventsWithoutMetadata = events.filter(e => !e.metadata || Object.keys(e.metadata).length === 0);
      if (eventsWithoutMetadata.length > 0) {
        issues.push(`${eventsWithoutMetadata.length} events missing metadata`);
      }

      // Check for temporal consistency
      const sortedEvents = events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      for (let i = 1; i < sortedEvents.length; i++) {
        if (sortedEvents[i].timestamp < sortedEvents[i - 1].timestamp) {
          issues.push('Temporal inconsistency detected in audit trail');
          break;
        }
      }

      return {
        valid: issues.length === 0,
        issues,
        eventCount,
      };
    } catch (error) {
      console.error('Failed to validate audit integrity:', error);
      return {
        valid: false,
        issues: [`Integrity validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        eventCount: 0,
      };
    }
  }

  /**
   * Map risk level to audit severity
   */
  private mapRiskLevelToSeverity(riskLevel: string): AuditSeverity {
    switch (riskLevel) {
      case 'low': return AuditSeverity.INFO;
      case 'medium': return AuditSeverity.WARNING;
      case 'high': return AuditSeverity.ERROR;
      case 'critical': return AuditSeverity.CRITICAL;
      default: return AuditSeverity.INFO;
    }
  }
}

/**
 * Singleton audit service instance
 */
export const auditService = new AuditService();