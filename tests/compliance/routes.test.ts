/**
 * Compliance Routes Integration Tests
 * Tests for AESIA compliance REST API endpoints
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { randomUUID } from 'crypto';
import Fastify from 'fastify';
import { complianceRoutes } from '../../src/compliance/routes.js';
import { complianceService } from '../../src/compliance/service.js';
import type { AuditPackage, ComplianceReport } from '../../src/compliance/service.js';

// Mock the compliance service
vi.mock('../../src/compliance/service.js');

describe('Compliance Routes', () => {
  let app: any;
  const mockWorkspaceId = randomUUID();
  const mockUserId = randomUUID();

  beforeEach(async () => {
    app = Fastify();
    
    // Mock authentication and authorization
    app.decorate('authenticate', async (request: any) => {
      request.user = {
        id: mockUserId,
        workspaceId: mockWorkspaceId,
        roles: ['admin'],
      };
    });
    
    app.decorate('authorize', (roles: string[]) => async (request: any) => {
      // Mock authorization - always allow for tests
    });

    // Mock database
    app.decorate('db', {
      complianceReport: {
        findMany: vi.fn(),
        count: vi.fn(),
        findFirst: vi.fn(),
      },
    });

    await app.register(complianceRoutes);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  describe('POST /audit-package', () => {
    it('should generate audit package successfully', async () => {
      const mockAuditPackage: AuditPackage = {
        specVersion: 'aesia-1.0',
        packageId: randomUUID(),
        orgId: 'Test Org',
        workspaceId: mockWorkspaceId,
        period: {
          from: '2024-01-01T00:00:00Z',
          to: '2024-01-31T23:59:59Z',
        },
        generatedAt: new Date().toISOString(),
        policyDecisions: [],
        modelCalls: [],
        documents: [],
        metadata: {
          totalEvents: 0,
          violationCount: 0,
          complianceScore: 100,
          dataResidency: { enforced: true, region: 'ES', violations: 0 },
          piiProtection: { redactionCount: 0, categories: [] },
        },
        hashTree: 'mock-hash-tree',
        signature: 'mock-signature',
      };

      vi.mocked(complianceService.generateAuditPackage).mockResolvedValue(mockAuditPackage);

      const response = await app.inject({
        method: 'POST',
        url: '/audit-package',
        payload: {
          timeRange: {
            from: '2024-01-01T00:00:00Z',
            to: '2024-01-31T23:59:59Z',
          },
          includeSignature: true,
          format: 'json',
        },
      });

      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual(mockAuditPackage);
      expect(body.metadata.packageId).toBe(mockAuditPackage.packageId);
      expect(body.metadata.recordCount).toBe(0);
      expect(body.metadata.complianceScore).toBe(100);
      expect(body.metadata.signed).toBe(true);

      expect(complianceService.generateAuditPackage).toHaveBeenCalledWith(
        mockWorkspaceId,
        {
          from: new Date('2024-01-01T00:00:00Z'),
          to: new Date('2024-01-31T23:59:59Z'),
        },
        {
          includeSignature: true,
          format: 'json',
        }
      );
    });

    it('should handle audit package generation failure', async () => {
      vi.mocked(complianceService.generateAuditPackage).mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await app.inject({
        method: 'POST',
        url: '/audit-package',
        payload: {
          timeRange: {
            from: '2024-01-01T00:00:00Z',
            to: '2024-01-31T23:59:59Z',
          },
        },
      });

      expect(response.statusCode).toBe(500);
      
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('AUDIT_PACKAGE_GENERATION_FAILED');
      expect(body.error.message).toBe('Failed to generate audit package');
      expect(body.error.details).toBe('Database connection failed');
    });

    it('should validate request payload', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/audit-package',
        payload: {
          // Missing required timeRange
          includeSignature: true,
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /export', () => {
    it('should export AESIA compliance report successfully', async () => {
      const mockReport: ComplianceReport = {
        id: randomUUID(),
        workspaceId: mockWorkspaceId,
        reportType: 'aesia_audit',
        timeRange: {
          from: '2024-01-01T00:00:00Z',
          to: '2024-01-31T23:59:59Z',
        },
        generatedAt: new Date().toISOString(),
        findings: [
          {
            id: randomUUID(),
            type: 'info',
            category: 'audit',
            severity: 'low',
            title: 'Excellent Compliance',
            description: 'No violations found',
            recommendation: 'Continue current practices',
            affectedRecords: [],
            timestamp: new Date().toISOString(),
          },
        ],
        summary: {
          totalFindings: 1,
          criticalFindings: 0,
          complianceScore: 100,
          recommendations: ['Continue current practices'],
        },
        digitalSignature: 'mock-signature',
      };

      vi.mocked(complianceService.exportCompliance).mockResolvedValue(mockReport);

      const response = await app.inject({
        method: 'POST',
        url: '/export',
        payload: {
          reportType: 'aesia_audit',
          timeRange: {
            from: '2024-01-01T00:00:00Z',
            to: '2024-01-31T23:59:59Z',
          },
          format: 'json',
        },
      });

      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual(mockReport);
      expect(body.metadata.reportId).toBe(mockReport.id);
      expect(body.metadata.findingsCount).toBe(1);
      expect(body.metadata.criticalFindings).toBe(0);
      expect(body.metadata.complianceScore).toBe(100);

      expect(complianceService.exportCompliance).toHaveBeenCalledWith(
        mockWorkspaceId,
        'aesia_audit',
        {
          from: new Date('2024-01-01T00:00:00Z'),
          to: new Date('2024-01-31T23:59:59Z'),
        },
        'json'
      );
    });

    it('should support different report types', async () => {
      const mockReport: ComplianceReport = {
        id: randomUUID(),
        workspaceId: mockWorkspaceId,
        reportType: 'gdpr_compliance',
        timeRange: {
          from: '2024-01-01T00:00:00Z',
          to: '2024-01-31T23:59:59Z',
        },
        generatedAt: new Date().toISOString(),
        findings: [],
        summary: {
          totalFindings: 0,
          criticalFindings: 0,
          complianceScore: 100,
          recommendations: [],
        },
        digitalSignature: 'gdpr-signature',
      };

      vi.mocked(complianceService.exportCompliance).mockResolvedValue(mockReport);

      const response = await app.inject({
        method: 'POST',
        url: '/export',
        payload: {
          reportType: 'gdpr_compliance',
          timeRange: {
            from: '2024-01-01T00:00:00Z',
            to: '2024-01-31T23:59:59Z',
          },
        },
      });

      expect(response.statusCode).toBe(200);
      expect(complianceService.exportCompliance).toHaveBeenCalledWith(
        mockWorkspaceId,
        'gdpr_compliance',
        expect.any(Object),
        'json'
      );
    });

    it('should validate report type', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/export',
        payload: {
          reportType: 'invalid_type',
          timeRange: {
            from: '2024-01-01T00:00:00Z',
            to: '2024-01-31T23:59:59Z',
          },
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /verify', () => {
    it('should verify audit package integrity successfully', async () => {
      const mockAuditPackage: AuditPackage = {
        specVersion: 'aesia-1.0',
        packageId: randomUUID(),
        orgId: 'Test Org',
        workspaceId: mockWorkspaceId,
        period: {
          from: '2024-01-01T00:00:00Z',
          to: '2024-01-31T23:59:59Z',
        },
        generatedAt: new Date().toISOString(),
        policyDecisions: [],
        modelCalls: [],
        documents: [],
        metadata: {
          totalEvents: 0,
          violationCount: 0,
          complianceScore: 100,
          dataResidency: { enforced: true, region: 'ES', violations: 0 },
          piiProtection: { redactionCount: 0, categories: [] },
        },
        hashTree: 'valid-hash',
        signature: 'valid-signature',
      };

      const mockIntegrityResult = {
        valid: true,
        issues: [],
        verificationDetails: {
          hashTreeValid: true,
          signatureValid: true,
          timestampValid: true,
          completenessValid: true,
        },
      };

      vi.mocked(complianceService.verifyIntegrity).mockResolvedValue(mockIntegrityResult);

      const response = await app.inject({
        method: 'POST',
        url: '/verify',
        payload: {
          auditPackage: mockAuditPackage,
        },
      });

      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual(mockIntegrityResult);
      expect(body.metadata.packageId).toBe(mockAuditPackage.packageId);
      expect(body.metadata.valid).toBe(true);
      expect(body.metadata.issueCount).toBe(0);

      expect(complianceService.verifyIntegrity).toHaveBeenCalledWith(mockAuditPackage);
    });

    it('should detect integrity violations', async () => {
      const mockAuditPackage: AuditPackage = {
        specVersion: 'aesia-1.0',
        packageId: randomUUID(),
        orgId: 'Test Org',
        workspaceId: mockWorkspaceId,
        period: {
          from: '2024-01-01T00:00:00Z',
          to: '2024-01-31T23:59:59Z',
        },
        generatedAt: new Date().toISOString(),
        policyDecisions: [],
        modelCalls: [],
        documents: [],
        metadata: {
          totalEvents: 0,
          violationCount: 0,
          complianceScore: 100,
          dataResidency: { enforced: true, region: 'ES', violations: 0 },
          piiProtection: { redactionCount: 0, categories: [] },
        },
        hashTree: 'tampered-hash',
        signature: 'invalid-signature',
      };

      const mockIntegrityResult = {
        valid: false,
        issues: [
          'Hash tree verification failed - data integrity compromised',
          'Digital signature verification failed',
        ],
        verificationDetails: {
          hashTreeValid: false,
          signatureValid: false,
          timestampValid: true,
          completenessValid: true,
        },
      };

      vi.mocked(complianceService.verifyIntegrity).mockResolvedValue(mockIntegrityResult);

      const response = await app.inject({
        method: 'POST',
        url: '/verify',
        payload: {
          auditPackage: mockAuditPackage,
        },
      });

      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.valid).toBe(false);
      expect(body.data.issues).toHaveLength(2);
      expect(body.metadata.valid).toBe(false);
      expect(body.metadata.issueCount).toBe(2);
    });

    it('should verify data lineage completeness in audit packages', async () => {
      const correlationId = randomUUID();
      const mockAuditPackage: AuditPackage = {
        specVersion: 'aesia-1.0',
        packageId: randomUUID(),
        orgId: 'Test Org',
        workspaceId: mockWorkspaceId,
        period: {
          from: '2024-01-01T00:00:00Z',
          to: '2024-01-31T23:59:59Z',
        },
        generatedAt: new Date().toISOString(),
        policyDecisions: [
          {
            id: randomUUID(),
            timestamp: '2024-01-15T10:00:00Z',
            workspaceId: mockWorkspaceId,
            correlationId,
            decision: {} as any,
            context: {} as any,
          },
        ],
        modelCalls: [
          {
            id: randomUUID(),
            timestamp: '2024-01-15T10:01:00Z',
            workspaceId: mockWorkspaceId,
            modelRef: 'test-model',
            inputTokens: 100,
            outputTokens: 50,
            latencyMs: 1500,
            success: true,
            correlationId,
          },
        ],
        documents: [],
        metadata: {
          totalEvents: 2,
          violationCount: 0,
          complianceScore: 100,
          dataResidency: { enforced: true, region: 'ES', violations: 0 },
          piiProtection: { redactionCount: 0, categories: [] },
        },
        hashTree: 'valid-hash',
        signature: 'valid-signature',
      };

      const mockIntegrityResult = {
        valid: true,
        issues: [],
        verificationDetails: {
          hashTreeValid: true,
          signatureValid: true,
          timestampValid: true,
          completenessValid: true,
        },
      };

      vi.mocked(complianceService.verifyIntegrity).mockResolvedValue(mockIntegrityResult);

      const response = await app.inject({
        method: 'POST',
        url: '/verify',
        payload: {
          auditPackage: mockAuditPackage,
        },
      });

      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.valid).toBe(true);
      expect(body.data.verificationDetails.completenessValid).toBe(true);
    });

    it('should detect missing model decision logging', async () => {
      const mockAuditPackage: AuditPackage = {
        specVersion: 'aesia-1.0',
        packageId: randomUUID(),
        orgId: 'Test Org',
        workspaceId: mockWorkspaceId,
        period: {
          from: '2024-01-01T00:00:00Z',
          to: '2024-01-31T23:59:59Z',
        },
        generatedAt: new Date().toISOString(),
        policyDecisions: [
          {
            id: randomUUID(),
            timestamp: '2024-01-15T10:00:00Z',
            workspaceId: mockWorkspaceId,
            correlationId: 'policy-correlation',
            decision: {} as any,
            context: {} as any,
          },
        ],
        modelCalls: [], // Missing model calls that should correlate
        documents: [],
        metadata: {
          totalEvents: 1,
          violationCount: 0,
          complianceScore: 100,
          dataResidency: { enforced: true, region: 'ES', violations: 0 },
          piiProtection: { redactionCount: 0, categories: [] },
        },
        hashTree: 'valid-hash',
        signature: 'valid-signature',
      };

      const mockIntegrityResult = {
        valid: false,
        issues: [
          'Audit trail appears incomplete - missing expected model decision records',
        ],
        verificationDetails: {
          hashTreeValid: true,
          signatureValid: true,
          timestampValid: true,
          completenessValid: false,
        },
      };

      vi.mocked(complianceService.verifyIntegrity).mockResolvedValue(mockIntegrityResult);

      const response = await app.inject({
        method: 'POST',
        url: '/verify',
        payload: {
          auditPackage: mockAuditPackage,
        },
      });

      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.valid).toBe(false);
      expect(body.data.verificationDetails.completenessValid).toBe(false);
      expect(body.data.issues).toContain('Audit trail appears incomplete - missing expected model decision records');
    });
  });

  describe('GET /reports', () => {
    it('should fetch compliance reports for workspace', async () => {
      const mockReports = [
        {
          id: randomUUID(),
          reportType: 'AESIA_AUDIT',
          timeRangeFrom: '2024-01-01T00:00:00.000Z',
          timeRangeTo: '2024-01-31T00:00:00.000Z',
          findings: [],
          digitalSignature: 'signature-1',
          generatedAt: '2024-02-01T00:00:00.000Z',
        },
        {
          id: randomUUID(),
          reportType: 'GDPR_COMPLIANCE',
          timeRangeFrom: '2024-02-01T00:00:00.000Z',
          timeRangeTo: '2024-02-28T00:00:00.000Z',
          findings: [],
          digitalSignature: 'signature-2',
          generatedAt: '2024-03-01T00:00:00.000Z',
        },
      ];

      app.db.complianceReport.findMany.mockResolvedValue(mockReports);
      app.db.complianceReport.count.mockResolvedValue(2);

      const response = await app.inject({
        method: 'GET',
        url: '/reports?limit=10&offset=0',
      });

      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual(mockReports);
      expect(body.metadata.total).toBe(2);
      expect(body.metadata.limit).toBe(10);
      expect(body.metadata.offset).toBe(0);
      expect(body.metadata.hasMore).toBe(false);
    });

    it('should filter reports by type', async () => {
      const mockReports = [
        {
          id: randomUUID(),
          reportType: 'AESIA_AUDIT',
          timeRangeFrom: '2024-01-01T00:00:00.000Z',
          timeRangeTo: '2024-01-31T00:00:00.000Z',
          findings: [],
          digitalSignature: 'signature-1',
          generatedAt: '2024-02-01T00:00:00.000Z',
        },
      ];

      app.db.complianceReport.findMany.mockResolvedValue(mockReports);
      app.db.complianceReport.count.mockResolvedValue(1);

      const response = await app.inject({
        method: 'GET',
        url: '/reports?reportType=aesia_audit',
      });

      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body.data).toEqual(mockReports);
      
      expect(app.db.complianceReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            reportType: 'AESIA_AUDIT',
          }),
        })
      );
    });
  });

  describe('GET /reports/:reportId', () => {
    it('should fetch specific compliance report', async () => {
      const reportId = randomUUID();
      const mockReport = {
        id: reportId,
        workspaceId: mockWorkspaceId,
        reportType: 'AESIA_AUDIT',
        timeRangeFrom: '2024-01-01T00:00:00.000Z',
        timeRangeTo: '2024-01-31T00:00:00.000Z',
        findings: [],
        digitalSignature: 'signature',
        generatedAt: '2024-02-01T00:00:00.000Z',
      };

      app.db.complianceReport.findFirst.mockResolvedValue(mockReport);

      const response = await app.inject({
        method: 'GET',
        url: `/reports/${reportId}`,
      });

      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual(mockReport);

      expect(app.db.complianceReport.findFirst).toHaveBeenCalledWith({
        where: {
          id: reportId,
          workspaceId: mockWorkspaceId,
        },
      });
    });

    it('should return 404 for non-existent report', async () => {
      const reportId = randomUUID();
      app.db.complianceReport.findFirst.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: `/reports/${reportId}`,
      });

      expect(response.statusCode).toBe(404);
      
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('COMPLIANCE_REPORT_NOT_FOUND');
    });
  });
});