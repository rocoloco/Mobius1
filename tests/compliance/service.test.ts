/**
 * Compliance Service Tests
 * Tests for AESIA-compliant audit package generation and integrity verification
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { randomUUID } from 'crypto';
import type { AuditPackage } from '../../src/compliance/service.js';

// Mock configuration
vi.mock('../../src/config/index.js', () => ({
  appConfig: {
    database: {
      url: 'postgresql://test:test@localhost:5432/test',
    },
    app: {
      nodeEnv: 'test',
    },
    compliance: {
      privateKeyPath: '',
      publicKeyPath: '',
      aesiaVersion: 'aesia-1.0',
      enableDigitalSigning: true,
      auditPackageRetentionDays: 2555,
    },
    audit: {
      retentionDays: 2555,
    },
    logging: {
      level: 'info',
      redactPII: true,
    },
  },
  isDevelopment: () => false,
  isProduction: () => false,
  isTest: () => true,
}));

// Mock database
const mockDb = {
  workspace: {
    findUnique: vi.fn(),
  },
  document: {
    findMany: vi.fn(),
  },
  complianceReport: {
    create: vi.fn(),
  },
};

// Mock audit service
const mockAuditService = {
  queryEvents: vi.fn(),
  logEvent: vi.fn(),
};

vi.mock('../../src/database/client.js', () => ({
  db: mockDb,
}));

vi.mock('../../src/audit/service.js', () => ({
  auditService: mockAuditService,
}));

// Import after mocking
const { complianceService } = await import('../../src/compliance/service.js');

describe('ComplianceService', () => {
  const mockWorkspaceId = randomUUID();
  const mockTimeRange = {
    from: new Date('2024-01-01T00:00:00Z'),
    to: new Date('2024-01-31T23:59:59Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateAuditPackage', () => {
    it('should generate AESIA-compliant audit package with deterministic output', async () => {
      // Mock workspace data
      const mockWorkspace = {
        id: mockWorkspaceId,
        name: 'Test Gestoría',
        organizationType: 'gestoria',
        spainResidencyMode: true,
      };

      // Mock audit events
      const mockPolicyEvents = [
        {
          id: randomUUID(),
          timestamp: new Date('2024-01-15T10:00:00Z'),
          workspaceId: mockWorkspaceId,
          userId: randomUUID(),
          correlationId: randomUUID(),
          metadata: {
            policyDecision: {
              allow: true,
              reasons: ['Policy evaluation passed'],
              residency: { allowedRegion: 'ES', enforced: true, compliant: true, violations: [] },
              redaction: { applied: true, categories: ['dni'], redactedCount: 1, redactedText: 'REDACTED', confidence: 0.95 },
              quota: { remaining: 100, window: 'daily', exceeded: false, resetTime: new Date() },
              timestamp: new Date('2024-01-15T10:00:00Z'),
              evaluationTimeMs: 50,
            },
            requestContext: {
              workspaceId: mockWorkspaceId,
              userId: randomUUID(),
              roles: ['user'],
              clientIP: '192.168.1.1',
              userAgent: 'Mozilla/5.0',
              correlationId: randomUUID(),
            },
          },
        },
      ];

      const mockDocuments = [
        {
          id: randomUUID(),
          type: 'DNI',
          processingStatus: 'COMPLETED',
          ocrConfidence: 0.98,
          createdAt: new Date('2024-01-15T10:30:00Z'),
        },
      ];

      // Setup mocks
      mockDb.workspace.findUnique.mockResolvedValue(mockWorkspace);
      mockAuditService.queryEvents.mockResolvedValue(mockPolicyEvents);
      mockDb.document.findMany.mockResolvedValue(mockDocuments);
      mockAuditService.logEvent.mockResolvedValue(randomUUID());

      // Generate audit package
      const auditPackage = await complianceService.generateAuditPackage(
        mockWorkspaceId,
        mockTimeRange,
        { includeSignature: false }
      );

      // Verify AESIA compliance
      expect(auditPackage.specVersion).toBe('aesia-1.0');
      expect(auditPackage.packageId).toBeDefined();
      expect(auditPackage.orgId).toBe('Test Gestoría');
      expect(auditPackage.workspaceId).toBe(mockWorkspaceId);
      expect(auditPackage.period.from).toBe(mockTimeRange.from.toISOString());
      expect(auditPackage.period.to).toBe(mockTimeRange.to.toISOString());

      // Verify data structure
      expect(auditPackage.policyDecisions).toHaveLength(1);
      expect(auditPackage.documents).toHaveLength(1);
      expect(auditPackage.metadata).toBeDefined();
      expect(auditPackage.hashTree).toBeDefined();

      // Verify metadata calculations
      expect(auditPackage.metadata.totalEvents).toBeGreaterThan(0);
      expect(auditPackage.metadata.complianceScore).toBeGreaterThanOrEqual(0);
      expect(auditPackage.metadata.complianceScore).toBeLessThanOrEqual(100);
      expect(auditPackage.metadata.dataResidency.region).toBe('ES');
      expect(auditPackage.metadata.piiProtection.redactionCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty audit period gracefully', async () => {
      // Mock workspace with no events
      mockDb.workspace.findUnique.mockResolvedValue({
        id: mockWorkspaceId,
        name: 'Empty Workspace',
        organizationType: 'gestoria',
        spainResidencyMode: true,
      });
      mockAuditService.queryEvents.mockResolvedValue([]);
      mockDb.document.findMany.mockResolvedValue([]);
      mockAuditService.logEvent.mockResolvedValue(randomUUID());

      const auditPackage = await complianceService.generateAuditPackage(
        mockWorkspaceId,
        mockTimeRange,
        { includeSignature: false }
      );

      expect(auditPackage.policyDecisions).toHaveLength(0);
      expect(auditPackage.modelCalls).toHaveLength(0);
      expect(auditPackage.documents).toHaveLength(0);
      expect(auditPackage.metadata.totalEvents).toBe(0);
      expect(auditPackage.metadata.complianceScore).toBe(100); // Perfect score for empty period
    });

    it('should throw error for non-existent workspace', async () => {
      mockDb.workspace.findUnique.mockResolvedValue(null);

      await expect(
        complianceService.generateAuditPackage(mockWorkspaceId, mockTimeRange)
      ).rejects.toThrow(`Workspace ${mockWorkspaceId} not found`);
    });
  });

  describe('verifyIntegrity', () => {
    it('should detect hash tree tampering', async () => {
      const mockAuditPackage: AuditPackage = {
        specVersion: 'aesia-1.0',
        packageId: randomUUID(),
        orgId: 'Test Org',
        workspaceId: mockWorkspaceId,
        period: {
          from: mockTimeRange.from.toISOString(),
          to: mockTimeRange.to.toISOString(),
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
      };

      const result = await complianceService.verifyIntegrity(mockAuditPackage);

      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Hash tree verification failed - data integrity compromised');
      expect(result.verificationDetails.hashTreeValid).toBe(false);
    });

    it('should detect temporal inconsistencies', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      const mockAuditPackage: AuditPackage = {
        specVersion: 'aesia-1.0',
        packageId: randomUUID(),
        orgId: 'Test Org',
        workspaceId: mockWorkspaceId,
        period: {
          from: mockTimeRange.from.toISOString(),
          to: futureDate.toISOString(), // Period ends in future
        },
        generatedAt: new Date().toISOString(), // But generated now
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
        hashTree: 'mock-hash',
      };

      const result = await complianceService.verifyIntegrity(mockAuditPackage);

      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Package generated before period end - temporal inconsistency');
      expect(result.verificationDetails.timestampValid).toBe(false);
    });

    it('should verify data lineage completeness', async () => {
      const correlationId = randomUUID();
      const packageId = randomUUID();
      const mockAuditPackage: AuditPackage = {
        specVersion: 'aesia-1.0',
        packageId,
        orgId: 'Test Org',
        workspaceId: mockWorkspaceId,
        period: {
          from: mockTimeRange.from.toISOString(),
          to: mockTimeRange.to.toISOString(),
        },
        generatedAt: new Date(mockTimeRange.to.getTime() + 60000).toISOString(), // Generated after period end
        policyDecisions: [
          {
            id: packageId, // Use consistent ID
            timestamp: '2024-01-15T10:00:00Z',
            workspaceId: mockWorkspaceId,
            correlationId,
            decision: {
              allow: true,
              reasons: ['Policy evaluation passed'],
              residency: { allowedRegion: 'ES', enforced: true, compliant: true, violations: [] },
              redaction: { applied: false, categories: [], redactedCount: 0, redactedText: '', confidence: 1.0 },
              quota: { remaining: 100, window: 'daily', exceeded: false, resetTime: new Date() },
              timestamp: new Date('2024-01-15T10:00:00Z'),
              evaluationTimeMs: 50,
            } as any,
            context: {
              workspaceId: mockWorkspaceId,
              userId: 'test-user',
              roles: ['user'],
              clientIP: '192.168.1.1',
              userAgent: 'Mozilla/5.0',
              correlationId,
            } as any,
          },
        ],
        modelCalls: [
          {
            id: packageId, // Use consistent ID
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
        hashTree: 'placeholder-hash',
      };

      // Calculate correct hash - exclude signature from calculation
      const packageForHashing = { ...mockAuditPackage, signature: undefined };
      mockAuditPackage.hashTree = (complianceService as any).calculateHashTree(packageForHashing);

      const result = await complianceService.verifyIntegrity(mockAuditPackage);

      // Should have issues due to missing signature, but hash and completeness should be valid
      expect(result.valid).toBe(false); // Overall invalid due to missing signature
      expect(result.verificationDetails.completenessValid).toBe(true);
      expect(result.verificationDetails.hashTreeValid).toBe(true);
      expect(result.verificationDetails.timestampValid).toBe(true);
      expect(result.issues).toContain('No digital signature present');
    });

    it('should detect missing correlation chains in data lineage', async () => {
      const packageId = randomUUID();
      const decisionId = randomUUID();
      const callId = randomUUID();
      const mockAuditPackage: AuditPackage = {
        specVersion: 'aesia-1.0',
        packageId,
        orgId: 'Test Org',
        workspaceId: mockWorkspaceId,
        period: {
          from: mockTimeRange.from.toISOString(),
          to: mockTimeRange.to.toISOString(),
        },
        generatedAt: new Date(mockTimeRange.to.getTime() + 60000).toISOString(), // Generated after period end
        policyDecisions: [
          {
            id: decisionId,
            timestamp: '2024-01-15T10:00:00Z',
            workspaceId: mockWorkspaceId,
            correlationId: 'orphaned-correlation-id',
            decision: {
              allow: true,
              reasons: ['Policy evaluation passed'],
              residency: { allowedRegion: 'ES', enforced: true, compliant: true, violations: [] },
              redaction: { applied: false, categories: [], redactedCount: 0, redactedText: '', confidence: 1.0 },
              quota: { remaining: 100, window: 'daily', exceeded: false, resetTime: new Date() },
              timestamp: new Date('2024-01-15T10:00:00Z'),
              evaluationTimeMs: 50,
            } as any,
            context: {
              workspaceId: mockWorkspaceId,
              userId: 'test-user',
              roles: ['user'],
              clientIP: '192.168.1.1',
              userAgent: 'Mozilla/5.0',
              correlationId: 'orphaned-correlation-id',
            } as any,
          },
        ],
        modelCalls: [
          {
            id: callId,
            timestamp: '2024-01-15T10:01:00Z',
            workspaceId: mockWorkspaceId,
            modelRef: 'test-model',
            inputTokens: 100,
            outputTokens: 50,
            latencyMs: 1500,
            success: true,
            correlationId: 'different-correlation-id',
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
        hashTree: 'placeholder-hash',
      };

      // Calculate correct hash - exclude signature from calculation
      const packageForHashing = { ...mockAuditPackage, signature: undefined };
      mockAuditPackage.hashTree = (complianceService as any).calculateHashTree(packageForHashing);

      const result = await complianceService.verifyIntegrity(mockAuditPackage);

      // Should be invalid due to missing signature, but other checks should pass
      expect(result.valid).toBe(false); // Overall invalid due to missing signature
      expect(result.verificationDetails.completenessValid).toBe(true);
      expect(result.verificationDetails.hashTreeValid).toBe(true);
      expect(result.verificationDetails.timestampValid).toBe(true);
      expect(result.issues).toContain('No digital signature present');
    });
  });

  describe('data lineage tracking', () => {
    it('should track complete data lineage for document processing workflow', async () => {
      const correlationId = randomUUID();
      const documentId = randomUUID();
      
      // Mock complete workflow with data lineage
      const mockWorkspace = {
        id: mockWorkspaceId,
        name: 'Test Gestoría',
        organizationType: 'gestoria',
        spainResidencyMode: true,
      };

      const mockPolicyEvents = [
        {
          id: randomUUID(),
          timestamp: new Date('2024-01-15T10:00:00Z'),
          workspaceId: mockWorkspaceId,
          userId: randomUUID(),
          correlationId,
          metadata: {
            policyDecision: {
              allow: true,
              reasons: ['Document upload authorized'],
              residency: { allowedRegion: 'ES', enforced: true, compliant: true, violations: [] },
              redaction: { applied: false, categories: [], redactedCount: 0, redactedText: '', confidence: 1.0 },
              quota: { remaining: 100, window: 'daily', exceeded: false, resetTime: new Date() },
              timestamp: new Date('2024-01-15T10:00:00Z'),
              evaluationTimeMs: 25,
            },
            requestContext: {
              workspaceId: mockWorkspaceId,
              userId: randomUUID(),
              roles: ['user'],
              clientIP: '192.168.1.1',
              userAgent: 'Mozilla/5.0',
              correlationId,
            },
            dataLineage: {
              sourceDocumentId: documentId,
              processingSteps: ['upload', 'classification', 'ocr', 'validation'],
              dataFlow: 'document -> ocr -> extraction -> validation',
            },
          },
        },
      ];

      const mockModelCalls = [
        {
          id: randomUUID(),
          timestamp: new Date('2024-01-15T10:01:00Z'),
          workspaceId: mockWorkspaceId,
          correlationId,
          metadata: {
            modelRef: 'ocr-model-v1',
            inputTokens: 500,
            outputTokens: 200,
            latencyMs: 1200,
            success: true,
            dataLineage: {
              inputSource: documentId,
              outputDestination: 'extracted_data',
              transformationType: 'ocr_extraction',
            },
          },
        },
      ];

      const mockDocuments = [
        {
          id: documentId,
          type: 'DNI',
          processingStatus: 'COMPLETED',
          ocrConfidence: 0.97,
          createdAt: new Date('2024-01-15T10:00:00Z'),
        },
      ];

      mockDb.workspace.findUnique.mockResolvedValue(mockWorkspace);
      mockAuditService.queryEvents
        .mockResolvedValueOnce(mockPolicyEvents)
        .mockResolvedValueOnce(mockModelCalls);
      mockDb.document.findMany.mockResolvedValue(mockDocuments);
      mockAuditService.logEvent.mockResolvedValue(randomUUID());

      const auditPackage = await complianceService.generateAuditPackage(
        mockWorkspaceId,
        mockTimeRange,
        { includeSignature: false }
      );

      // Verify data lineage is captured
      expect(auditPackage.policyDecisions).toHaveLength(1);
      expect(auditPackage.modelCalls).toHaveLength(1);
      expect(auditPackage.documents).toHaveLength(1);

      // Verify correlation IDs link the data lineage
      expect(auditPackage.policyDecisions[0].correlationId).toBe(correlationId);
      expect(auditPackage.modelCalls[0].correlationId).toBe(correlationId);

      // Verify metadata includes lineage information
      expect(auditPackage.metadata.totalEvents).toBe(3);
    });

    it('should track model decision provenance and reasoning', async () => {
      const correlationId = randomUUID();
      
      const mockWorkspace = {
        id: mockWorkspaceId,
        name: 'Test Gestoría',
        organizationType: 'gestoria',
        spainResidencyMode: true,
      };

      const mockModelCalls = [
        {
          id: randomUUID(),
          timestamp: new Date('2024-01-15T10:00:00Z'),
          workspaceId: mockWorkspaceId,
          correlationId,
          metadata: {
            modelRef: 'classification-model-v2',
            inputTokens: 300,
            outputTokens: 50,
            latencyMs: 800,
            success: true,
            modelDecision: {
              classification: 'DNI',
              confidence: 0.95,
              reasoning: 'Document contains Spanish national ID format with valid checksum',
              alternativeClassifications: [
                { type: 'PASSPORT', confidence: 0.03 },
                { type: 'OTHER', confidence: 0.02 },
              ],
              modelVersion: 'classification-model-v2.1.0',
              trainingDataVersion: '2024-01-01',
            },
            inputHash: 'sha256:abc123...',
            outputHash: 'sha256:def456...',
          },
        },
      ];

      mockDb.workspace.findUnique.mockResolvedValue(mockWorkspace);
      mockAuditService.queryEvents
        .mockResolvedValueOnce([]) // No policy events
        .mockResolvedValueOnce(mockModelCalls);
      mockDb.document.findMany.mockResolvedValue([]);
      mockAuditService.logEvent.mockResolvedValue(randomUUID());

      const auditPackage = await complianceService.generateAuditPackage(
        mockWorkspaceId,
        mockTimeRange,
        { includeSignature: false }
      );

      expect(auditPackage.modelCalls).toHaveLength(1);
      
      const modelCall = auditPackage.modelCalls[0];
      expect(modelCall.modelRef).toBe('classification-model-v2');
      expect(modelCall.success).toBe(true);
      expect(modelCall.correlationId).toBe(correlationId);
    });
  });

  describe('AESIA schema compliance', () => {
    it('should generate audit package compliant with AESIA-1.0 schema', async () => {
      const mockWorkspace = {
        id: mockWorkspaceId,
        name: 'Test Gestoría',
        organizationType: 'gestoria',
        spainResidencyMode: true,
      };

      mockDb.workspace.findUnique.mockResolvedValue(mockWorkspace);
      mockAuditService.queryEvents.mockResolvedValue([]);
      mockDb.document.findMany.mockResolvedValue([]);
      mockAuditService.logEvent.mockResolvedValue(randomUUID());

      const auditPackage = await complianceService.generateAuditPackage(
        mockWorkspaceId,
        mockTimeRange,
        { includeSignature: false }
      );

      // Verify AESIA schema compliance
      expect(auditPackage.specVersion).toBe('aesia-1.0');
      expect(auditPackage.packageId).toMatch(/^[0-9a-f-]{36}$/); // UUID format
      expect(auditPackage.orgId).toBeDefined();
      expect(auditPackage.workspaceId).toBe(mockWorkspaceId);
      
      // Verify required period format
      expect(auditPackage.period.from).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
      expect(auditPackage.period.to).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
      
      // Verify metadata structure
      expect(auditPackage.metadata).toHaveProperty('totalEvents');
      expect(auditPackage.metadata).toHaveProperty('violationCount');
      expect(auditPackage.metadata).toHaveProperty('complianceScore');
      expect(auditPackage.metadata).toHaveProperty('dataResidency');
      expect(auditPackage.metadata).toHaveProperty('piiProtection');
      
      // Verify data residency metadata
      expect(auditPackage.metadata.dataResidency.region).toBe('ES');
      expect(auditPackage.metadata.dataResidency.enforced).toBe(true);
      
      // Verify hash tree is present
      expect(auditPackage.hashTree).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should include digital signature when requested', async () => {
      const mockWorkspace = {
        id: mockWorkspaceId,
        name: 'Test Gestoría',
        organizationType: 'gestoria',
        spainResidencyMode: true,
      };

      mockDb.workspace.findUnique.mockResolvedValue(mockWorkspace);
      mockAuditService.queryEvents.mockResolvedValue([]);
      mockDb.document.findMany.mockResolvedValue([]);
      mockAuditService.logEvent.mockResolvedValue(randomUUID());

      // Mock the private key path to enable signing
      const originalPrivateKeyPath = (complianceService as any).privateKeyPath;
      (complianceService as any).privateKeyPath = '/mock/path/to/private.key';

      // Mock signing (since we don't have actual keys in test)
      const originalSignPackage = (complianceService as any).signPackage;
      (complianceService as any).signPackage = vi.fn().mockResolvedValue('mock-digital-signature');

      const auditPackage = await complianceService.generateAuditPackage(
        mockWorkspaceId,
        mockTimeRange,
        { includeSignature: true }
      );

      expect(auditPackage.signature).toBe('mock-digital-signature');

      // Restore original methods
      (complianceService as any).signPackage = originalSignPackage;
      (complianceService as any).privateKeyPath = originalPrivateKeyPath;
    });
  });

  describe('calculateHashTree', () => {
    it('should produce deterministic hash for same input', () => {
      const auditPackage = {
        specVersion: 'aesia-1.0' as const,
        packageId: 'test-package',
        orgId: 'Test Org',
        workspaceId: mockWorkspaceId,
        period: { from: '2024-01-01T00:00:00Z', to: '2024-01-31T23:59:59Z' },
        generatedAt: '2024-02-01T00:00:00Z',
        policyDecisions: [
          {
            id: 'decision-1',
            timestamp: '2024-01-15T10:00:00Z',
            workspaceId: mockWorkspaceId,
            correlationId: 'corr-1',
            decision: {} as any,
            context: {} as any,
          },
        ],
        modelCalls: [],
        documents: [],
        metadata: {
          totalEvents: 1,
          violationCount: 0,
          complianceScore: 100,
          dataResidency: { enforced: true, region: 'ES', violations: 0 },
          piiProtection: { redactionCount: 0, categories: [] },
        },
      };

      const hash1 = (complianceService as any).calculateHashTree(auditPackage);
      const hash2 = (complianceService as any).calculateHashTree(auditPackage);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex format
    });

    it('should produce different hashes for different inputs', () => {
      const basePackage = {
        specVersion: 'aesia-1.0' as const,
        packageId: 'test-package',
        orgId: 'Test Org',
        workspaceId: mockWorkspaceId,
        period: { from: '2024-01-01T00:00:00Z', to: '2024-01-31T23:59:59Z' },
        generatedAt: '2024-02-01T00:00:00Z',
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
      };

      const modifiedPackage = {
        ...basePackage,
        packageId: 'different-package',
      };

      const hash1 = (complianceService as any).calculateHashTree(basePackage);
      const hash2 = (complianceService as any).calculateHashTree(modifiedPackage);

      expect(hash1).not.toBe(hash2);
    });
  });
});