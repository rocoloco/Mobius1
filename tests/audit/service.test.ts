/**
 * Audit Service Tests
 * Comprehensive tests for audit logging and compliance tracking
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { 
  auditService, 
  AuditEventType, 
  AuditSeverity,
  type BaseAuditEvent,
  type PolicyAuditEvent,
  type ResidencyAuditEvent,
  type PIIAuditEvent,
  type SecurityAuditEvent,
} from '../../src/audit/service.js';
import { db } from '../../src/database/client.js';
import type { PolicyDecision, ResidencyValidation, PIIRedactionResult } from '../../src/policy/types.js';
import type { RequestContext } from '../../src/auth/types.js';

// Mock the database
vi.mock('../../src/database/client.js', () => ({
  db: {
    auditEvent: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

// Mock the config
vi.mock('../../src/config/index.js', () => ({
  appConfig: {
    audit: {
      retentionDays: 2555, // 7 years
    },
  },
}));

describe('AuditService', () => {
  const mockWorkspaceId = randomUUID();
  const mockUserId = randomUUID();
  const mockCorrelationId = randomUUID();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('logEvent', () => {
    it('should log a basic audit event', async () => {
      const mockEvent: BaseAuditEvent = {
        eventType: AuditEventType.USER_LOGIN,
        severity: AuditSeverity.INFO,
        resourceId: mockUserId,
        action: 'login',
        metadata: { loginMethod: 'jwt' },
        correlationId: mockCorrelationId,
        workspaceId: mockWorkspaceId,
        userId: mockUserId,
      };

      const mockDbResponse = { id: randomUUID() };
      (db.auditEvent.create as any).mockResolvedValue(mockDbResponse);

      const eventId = await auditService.logEvent(mockEvent);

      expect(db.auditEvent.create).toHaveBeenCalledWith({
        data: {
          id: expect.any(String),
          workspaceId: mockWorkspaceId,
          userId: mockUserId,
          eventType: AuditEventType.USER_LOGIN,
          resourceId: mockUserId,
          action: 'login',
          metadata: { loginMethod: 'jwt' },
          correlationId: mockCorrelationId,
          timestamp: expect.any(Date),
          piiRedacted: false,
        },
      });

      expect(typeof eventId).toBe('string');
    });

    it('should handle database errors gracefully', async () => {
      const mockEvent: BaseAuditEvent = {
        eventType: AuditEventType.SYSTEM_ERROR,
        severity: AuditSeverity.ERROR,
        resourceId: 'test-resource',
        action: 'test-action',
        metadata: {},
        correlationId: mockCorrelationId,
        workspaceId: mockWorkspaceId,
      };

      const dbError = new Error('Database connection failed');
      (db.auditEvent.create as any).mockRejectedValue(dbError);

      await expect(auditService.logEvent(mockEvent)).rejects.toThrow(dbError);
    });

    it('should merge additional metadata from options', async () => {
      const mockEvent: BaseAuditEvent = {
        eventType: AuditEventType.DOCUMENT_UPLOAD,
        severity: AuditSeverity.INFO,
        resourceId: 'document-123',
        action: 'upload',
        metadata: { originalName: 'test.pdf' },
        correlationId: mockCorrelationId,
        workspaceId: mockWorkspaceId,
        userId: mockUserId,
      };

      const options = {
        additionalMetadata: { fileSize: 1024, contentType: 'application/pdf' },
        includePIIRedaction: true,
      };

      (db.auditEvent.create as any).mockResolvedValue({ id: randomUUID() });

      await auditService.logEvent(mockEvent, options);

      expect(db.auditEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: {
            originalName: 'test.pdf',
            fileSize: 1024,
            contentType: 'application/pdf',
          },
          piiRedacted: true,
        }),
      });
    });
  });

  describe('logPolicyEvent', () => {
    it('should log a policy evaluation event with enhanced metadata', async () => {
      const mockRequestContext: RequestContext = {
        workspaceId: mockWorkspaceId,
        userId: mockUserId,
        roles: ['user'],
        clientIP: '192.168.1.1',
        userAgent: 'test-agent',
        correlationId: mockCorrelationId,
        timestamp: new Date(),
      };

      const mockPolicyDecision: PolicyDecision = {
        allow: true,
        reasons: ['All checks passed'],
        residency: {
          allowedRegion: 'ES',
          enforced: true,
          compliant: true,
          violations: [],
        },
        redaction: {
          applied: false,
          categories: [],
          redactedCount: 0,
          redactedText: '',
          confidence: 1.0,
        },
        quota: {
          remaining: 1000,
          window: 'daily',
          exceeded: false,
          resetTime: new Date(),
        },
        timestamp: new Date(),
        evaluationTimeMs: 50,
      };

      const mockPolicyEvent: PolicyAuditEvent = {
        eventType: AuditEventType.POLICY_EVALUATION,
        severity: AuditSeverity.INFO,
        resourceId: 'test-resource',
        action: 'evaluate',
        metadata: {},
        correlationId: mockCorrelationId,
        workspaceId: mockWorkspaceId,
        userId: mockUserId,
        policyDecision: mockPolicyDecision,
        requestContext: mockRequestContext,
      };

      (db.auditEvent.create as any).mockResolvedValue({ id: randomUUID() });

      await auditService.logPolicyEvent(mockPolicyEvent);

      expect(db.auditEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: AuditEventType.POLICY_EVALUATION,
          metadata: expect.objectContaining({
            policyDecision: expect.objectContaining({
              allow: true,
              reasons: ['All checks passed'],
              evaluationTimeMs: 50,
            }),
            requestContext: expect.objectContaining({
              method: 'authenticated',
              clientIP: '192.168.1.1',
            }),
            residencyValidation: mockPolicyDecision.residency,
            quotaStatus: mockPolicyDecision.quota,
          }),
          piiRedacted: false,
        }),
      });
    });
  });

  describe('logResidencyEvent', () => {
    it('should log a residency validation event', async () => {
      const mockResidencyValidation: ResidencyValidation = {
        allowedRegion: 'ES',
        enforced: true,
        compliant: false,
        violations: ['Data processing outside Spain detected'],
        currentLocation: {
          country: 'FR',
          region: 'Île-de-France',
          city: 'Paris',
        },
      };

      const mockResidencyEvent: ResidencyAuditEvent = {
        eventType: AuditEventType.RESIDENCY_VIOLATION,
        severity: AuditSeverity.ERROR,
        resourceId: 'data-processing-job',
        action: 'process_document',
        metadata: {},
        correlationId: mockCorrelationId,
        workspaceId: mockWorkspaceId,
        userId: mockUserId,
        residencyValidation: mockResidencyValidation,
        requestedOperation: 'document_ocr',
        clientLocation: {
          ip: '192.168.1.1',
          country: 'FR',
        },
      };

      (db.auditEvent.create as any).mockResolvedValue({ id: randomUUID() });

      await auditService.logResidencyEvent(mockResidencyEvent);

      expect(db.auditEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: AuditEventType.RESIDENCY_VIOLATION,
          metadata: expect.objectContaining({
            residencyValidation: mockResidencyValidation,
            requestedOperation: 'document_ocr',
            clientLocation: {
              ip: '192.168.1.1',
              country: 'FR',
            },
          }),
        }),
      });
    });
  });

  describe('logPIIEvent', () => {
    it('should log a PII redaction event', async () => {
      const mockRedactionResult: PIIRedactionResult = {
        applied: true,
        categories: ['dni', 'phone'],
        redactedCount: 2,
        redactedText: 'Name: John Doe, DNI: ******, Phone: ******',
        confidence: 0.95,
      };

      const mockPIIEvent: PIIAuditEvent = {
        eventType: AuditEventType.PII_REDACTION,
        severity: AuditSeverity.INFO,
        resourceId: 'document-456',
        action: 'redact_pii',
        metadata: {},
        correlationId: mockCorrelationId,
        workspaceId: mockWorkspaceId,
        userId: mockUserId,
        redactionResult: mockRedactionResult,
        documentType: 'DNI',
        processingContext: 'ocr_extraction',
      };

      (db.auditEvent.create as any).mockResolvedValue({ id: randomUUID() });

      await auditService.logPIIEvent(mockPIIEvent);

      expect(db.auditEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: AuditEventType.PII_REDACTION,
          metadata: expect.objectContaining({
            redactionResult: {
              applied: true,
              categories: ['dni', 'phone'],
              redactedCount: 2,
              confidence: 0.95,
            },
            documentType: 'DNI',
            processingContext: 'ocr_extraction',
          }),
          piiRedacted: true,
        }),
      });
    });
  });

  describe('logSecurityEvent', () => {
    it('should log a security event with proper severity mapping', async () => {
      const mockSecurityEvent: SecurityAuditEvent = {
        eventType: AuditEventType.PROMPT_INJECTION_ATTEMPT,
        severity: AuditSeverity.CRITICAL,
        resourceId: 'gateway',
        action: 'block_injection',
        metadata: {},
        correlationId: mockCorrelationId,
        workspaceId: mockWorkspaceId,
        userId: mockUserId,
        securityContext: {
          threatType: 'prompt_injection',
          riskLevel: 'critical',
          mitigationApplied: true,
          additionalDetails: {
            injectionPattern: 'ignore_previous_instructions',
            detectionMethod: 'pattern_matching',
          },
        },
      };

      (db.auditEvent.create as any).mockResolvedValue({ id: randomUUID() });

      await auditService.logSecurityEvent(mockSecurityEvent);

      expect(db.auditEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: AuditEventType.PROMPT_INJECTION_ATTEMPT,
          metadata: expect.objectContaining({
            securityContext: mockSecurityEvent.securityContext,
          }),
        }),
      });
    });
  });

  describe('queryEvents', () => {
    it('should query events with filters', async () => {
      const mockEvents = [
        {
          id: randomUUID(),
          workspaceId: mockWorkspaceId,
          eventType: AuditEventType.USER_LOGIN,
          timestamp: new Date(),
          user: { id: mockUserId, email: 'test@example.com' },
          workspace: { id: mockWorkspaceId, name: 'Test Workspace' },
        },
      ];

      (db.auditEvent.findMany as any).mockResolvedValue(mockEvents);

      const filters = {
        workspaceId: mockWorkspaceId,
        eventTypes: [AuditEventType.USER_LOGIN],
        limit: 50,
      };

      const result = await auditService.queryEvents(filters);

      expect(db.auditEvent.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: mockWorkspaceId,
          eventType: { in: [AuditEventType.USER_LOGIN] },
        },
        orderBy: { timestamp: 'desc' },
        take: 50,
        skip: 0,
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

      expect(result).toEqual(mockEvents);
    });

    it('should handle date range filters', async () => {
      const dateFrom = new Date('2024-01-01');
      const dateTo = new Date('2024-01-31');

      (db.auditEvent.findMany as any).mockResolvedValue([]);

      await auditService.queryEvents({
        workspaceId: mockWorkspaceId,
        dateFrom,
        dateTo,
      });

      expect(db.auditEvent.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: mockWorkspaceId,
          timestamp: {
            gte: dateFrom,
            lte: dateTo,
          },
        },
        orderBy: { timestamp: 'desc' },
        take: 100,
        skip: 0,
        include: expect.any(Object),
      });
    });
  });

  describe('getStatistics', () => {
    it('should calculate audit statistics', async () => {
      (db.auditEvent.count as any).mockResolvedValue(1000);
      (db.auditEvent.groupBy as any).mockResolvedValue([
        { eventType: AuditEventType.USER_LOGIN, _count: { eventType: 500 } },
        { eventType: AuditEventType.DOCUMENT_UPLOAD, _count: { eventType: 300 } },
        { eventType: AuditEventType.POLICY_VIOLATION, _count: { eventType: 10 } },
      ]);

      // Mock violation count query
      (db.auditEvent.count as any)
        .mockResolvedValueOnce(1000) // Total events
        .mockResolvedValueOnce(10);  // Violation events

      const stats = await auditService.getStatistics(mockWorkspaceId);

      expect(stats).toEqual({
        totalEvents: 1000,
        eventsByType: {
          [AuditEventType.USER_LOGIN]: 500,
          [AuditEventType.DOCUMENT_UPLOAD]: 300,
          [AuditEventType.POLICY_VIOLATION]: 10,
        },
        eventsBySeverity: {},
        violationCount: 10,
        complianceScore: 99, // (1000 - 10) / 1000 * 100
        timeRange: {
          from: expect.any(Date),
          to: expect.any(Date),
        },
      });
    });
  });

  describe('getEventsByCorrelation', () => {
    it('should retrieve events by correlation ID', async () => {
      const mockEvents = [
        {
          id: randomUUID(),
          correlationId: mockCorrelationId,
          eventType: AuditEventType.POLICY_EVALUATION,
          timestamp: new Date(),
          user: { id: mockUserId, email: 'test@example.com' },
        },
      ];

      (db.auditEvent.findMany as any).mockResolvedValue(mockEvents);

      const result = await auditService.getEventsByCorrelation(mockCorrelationId);

      expect(db.auditEvent.findMany).toHaveBeenCalledWith({
        where: { correlationId: mockCorrelationId },
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

      expect(result).toEqual(mockEvents);
    });
  });

  describe('cleanupOldEvents', () => {
    it('should clean up old events and log the operation', async () => {
      const deletedCount = 500;
      (db.auditEvent.deleteMany as any).mockResolvedValue({ count: deletedCount });
      (db.auditEvent.create as any).mockResolvedValue({ id: randomUUID() });

      const result = await auditService.cleanupOldEvents();

      expect(result.deletedCount).toBe(deletedCount);

      // Verify cleanup operation was logged
      expect(db.auditEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: AuditEventType.DATA_RETENTION_CLEANUP,
          resourceId: 'audit_events',
          action: 'cleanup',
          workspaceId: 'system',
          metadata: expect.objectContaining({
            deletedCount,
            retentionDays: 2555,
          }),
        }),
      });
    });
  });

  describe('validateIntegrity', () => {
    it('should validate audit trail integrity', async () => {
      const mockEvents = [
        {
          id: randomUUID(),
          correlationId: randomUUID(),
          timestamp: new Date('2024-01-01T10:00:00Z'),
          metadata: { test: 'data' },
        },
        {
          id: randomUUID(),
          correlationId: randomUUID(),
          timestamp: new Date('2024-01-01T11:00:00Z'),
          metadata: { test: 'data2' },
        },
      ];

      (db.auditEvent.findMany as any).mockResolvedValue(mockEvents);

      const dateFrom = new Date('2024-01-01');
      const dateTo = new Date('2024-01-02');

      const result = await auditService.validateIntegrity(mockWorkspaceId, dateFrom, dateTo);

      expect(result).toEqual({
        valid: true,
        issues: [],
        eventCount: 2,
      });
    });

    it('should detect integrity issues', async () => {
      const duplicateCorrelationId = randomUUID();
      const mockEvents = [
        {
          id: randomUUID(),
          correlationId: duplicateCorrelationId,
          timestamp: new Date('2024-01-01T10:00:00Z'),
          metadata: { test: 'data' },
        },
        {
          id: randomUUID(),
          correlationId: duplicateCorrelationId, // Duplicate!
          timestamp: new Date('2024-01-01T11:00:00Z'),
          metadata: null, // Missing metadata!
        },
      ];

      (db.auditEvent.findMany as any).mockResolvedValue(mockEvents);

      const result = await auditService.validateIntegrity(
        mockWorkspaceId,
        new Date('2024-01-01'),
        new Date('2024-01-02')
      );

      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Duplicate correlation IDs detected');
      expect(result.issues).toContain('1 events missing metadata');
    });
  });
});