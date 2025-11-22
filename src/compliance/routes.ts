/**
 * Compliance Routes
 * REST API endpoints for AESIA compliance and audit reporting
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { complianceService } from './service.js';
import type { ExportFormat } from './service.js';

/**
 * Request schemas for compliance endpoints
 */
const generateAuditPackageSchema = {
  body: {
    type: 'object',
    required: ['timeRange'],
    properties: {
      timeRange: {
        type: 'object',
        required: ['from', 'to'],
        properties: {
          from: { type: 'string', format: 'date-time' },
          to: { type: 'string', format: 'date-time' },
        },
      },
      includeSignature: { type: 'boolean', default: true },
      format: { type: 'string', enum: ['json', 'pdf', 'both'], default: 'json' },
    },
  },
};

const exportComplianceSchema = {
  body: {
    type: 'object',
    required: ['reportType', 'timeRange'],
    properties: {
      reportType: {
        type: 'string',
        enum: ['aesia_audit', 'gdpr_compliance', 'residency_verification'],
      },
      timeRange: {
        type: 'object',
        required: ['from', 'to'],
        properties: {
          from: { type: 'string', format: 'date-time' },
          to: { type: 'string', format: 'date-time' },
        },
      },
      format: { type: 'string', enum: ['json', 'pdf', 'both'], default: 'json' },
    },
  },
};

const verifyIntegritySchema = {
  body: {
    type: 'object',
    required: ['auditPackage'],
    properties: {
      auditPackage: {
        type: 'object',
        // Full audit package schema would be defined here
        // For brevity, using minimal validation
        required: ['specVersion', 'packageId', 'hashTree'],
        properties: {
          specVersion: { type: 'string' },
          packageId: { type: 'string' },
          hashTree: { type: 'string' },
        },
      },
    },
  },
};

/**
 * Request interfaces
 */
interface GenerateAuditPackageRequest extends FastifyRequest {
  body: {
    timeRange: {
      from: string;
      to: string;
    };
    includeSignature?: boolean;
    format?: ExportFormat;
  };
}

interface ExportComplianceRequest extends FastifyRequest {
  body: {
    reportType: 'aesia_audit' | 'gdpr_compliance' | 'residency_verification';
    timeRange: {
      from: string;
      to: string;
    };
    format?: ExportFormat;
  };
}

interface VerifyIntegrityRequest extends FastifyRequest {
  body: {
    auditPackage: any; // Full AuditPackage type
  };
}

/**
 * Register compliance routes
 */
export async function complianceRoutes(fastify: FastifyInstance) {
  // Generate AESIA-compliant audit package
  fastify.post<{ Body: GenerateAuditPackageRequest['body'] }>(
    '/audit-package',
    {
      schema: generateAuditPackageSchema,
      preHandler: [fastify.authenticate, fastify.authorize(['admin', 'compliance_officer'])],
    },
    async (request: GenerateAuditPackageRequest, reply: FastifyReply) => {
      try {
        const { timeRange, includeSignature = true, format = 'json' } = request.body;
        const workspaceId = request.user.workspaceId;

        const auditPackage = await complianceService.generateAuditPackage(
          workspaceId,
          {
            from: new Date(timeRange.from),
            to: new Date(timeRange.to),
          },
          {
            includeSignature,
            format,
          }
        );

        reply.code(200).send({
          success: true,
          data: auditPackage,
          metadata: {
            packageId: auditPackage.packageId,
            recordCount: auditPackage.metadata.totalEvents,
            complianceScore: auditPackage.metadata.complianceScore,
            signed: !!auditPackage.signature,
          },
        });
      } catch (error) {
        fastify.log.error('Failed to generate audit package:', error);
        reply.code(500).send({
          success: false,
          error: {
            code: 'AUDIT_PACKAGE_GENERATION_FAILED',
            message: 'Failed to generate audit package',
            details: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    }
  );

  // Export compliance report
  fastify.post<{ Body: ExportComplianceRequest['body'] }>(
    '/export',
    {
      schema: exportComplianceSchema,
      preHandler: [fastify.authenticate, fastify.authorize(['admin', 'compliance_officer'])],
    },
    async (request: ExportComplianceRequest, reply: FastifyReply) => {
      try {
        const { reportType, timeRange, format = 'json' } = request.body;
        const workspaceId = request.user.workspaceId;

        const complianceReport = await complianceService.exportCompliance(
          workspaceId,
          reportType,
          {
            from: new Date(timeRange.from),
            to: new Date(timeRange.to),
          },
          format
        );

        reply.code(200).send({
          success: true,
          data: complianceReport,
          metadata: {
            reportId: complianceReport.id,
            findingsCount: complianceReport.findings.length,
            criticalFindings: complianceReport.summary.criticalFindings,
            complianceScore: complianceReport.summary.complianceScore,
          },
        });
      } catch (error) {
        fastify.log.error('Failed to export compliance report:', error);
        reply.code(500).send({
          success: false,
          error: {
            code: 'COMPLIANCE_EXPORT_FAILED',
            message: 'Failed to export compliance report',
            details: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    }
  );

  // Verify audit package integrity
  fastify.post<{ Body: VerifyIntegrityRequest['body'] }>(
    '/verify',
    {
      schema: verifyIntegritySchema,
      preHandler: [fastify.authenticate, fastify.authorize(['admin', 'compliance_officer', 'auditor'])],
    },
    async (request: VerifyIntegrityRequest, reply: FastifyReply) => {
      try {
        const { auditPackage } = request.body;

        const integrityResult = await complianceService.verifyIntegrity(auditPackage);

        reply.code(200).send({
          success: true,
          data: integrityResult,
          metadata: {
            packageId: auditPackage.packageId,
            verificationTime: new Date().toISOString(),
            valid: integrityResult.valid,
            issueCount: integrityResult.issues.length,
          },
        });
      } catch (error) {
        fastify.log.error('Failed to verify audit package integrity:', error);
        reply.code(500).send({
          success: false,
          error: {
            code: 'INTEGRITY_VERIFICATION_FAILED',
            message: 'Failed to verify audit package integrity',
            details: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    }
  );

  // Get compliance reports for workspace
  fastify.get(
    '/reports',
    {
      preHandler: [fastify.authenticate, fastify.authorize(['admin', 'compliance_officer', 'auditor'])],
      schema: {
        querystring: {
          type: 'object',
          properties: {
            reportType: {
              type: 'string',
              enum: ['aesia_audit', 'gdpr_compliance', 'residency_verification'],
            },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            offset: { type: 'integer', minimum: 0, default: 0 },
            from: { type: 'string', format: 'date-time' },
            to: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    async (request: FastifyRequest<{
      Querystring: {
        reportType?: 'aesia_audit' | 'gdpr_compliance' | 'residency_verification';
        limit?: number;
        offset?: number;
        from?: string;
        to?: string;
      };
    }>, reply: FastifyReply) => {
      try {
        const { reportType, limit = 20, offset = 0, from, to } = request.query;
        const workspaceId = request.user.workspaceId;

        const where: any = { workspaceId };
        
        if (reportType) {
          where.reportType = reportType.toUpperCase();
        }
        
        if (from || to) {
          where.generatedAt = {};
          if (from) where.generatedAt.gte = new Date(from);
          if (to) where.generatedAt.lte = new Date(to);
        }

        const [reports, total] = await Promise.all([
          fastify.db.complianceReport.findMany({
            where,
            select: {
              id: true,
              reportType: true,
              timeRangeFrom: true,
              timeRangeTo: true,
              findings: true,
              digitalSignature: true,
              generatedAt: true,
            },
            orderBy: { generatedAt: 'desc' },
            take: limit,
            skip: offset,
          }),
          fastify.db.complianceReport.count({ where }),
        ]);

        reply.code(200).send({
          success: true,
          data: reports,
          metadata: {
            total,
            limit,
            offset,
            hasMore: offset + limit < total,
          },
        });
      } catch (error) {
        fastify.log.error('Failed to get compliance reports:', error);
        reply.code(500).send({
          success: false,
          error: {
            code: 'COMPLIANCE_REPORTS_FETCH_FAILED',
            message: 'Failed to fetch compliance reports',
            details: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    }
  );

  // Get specific compliance report
  fastify.get<{ Params: { reportId: string } }>(
    '/reports/:reportId',
    {
      preHandler: [fastify.authenticate, fastify.authorize(['admin', 'compliance_officer', 'auditor'])],
      schema: {
        params: {
          type: 'object',
          required: ['reportId'],
          properties: {
            reportId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { reportId: string } }>, reply: FastifyReply) => {
      try {
        const { reportId } = request.params;
        const workspaceId = request.user.workspaceId;

        const report = await fastify.db.complianceReport.findFirst({
          where: {
            id: reportId,
            workspaceId,
          },
        });

        if (!report) {
          reply.code(404).send({
            success: false,
            error: {
              code: 'COMPLIANCE_REPORT_NOT_FOUND',
              message: 'Compliance report not found',
            },
          });
          return;
        }

        reply.code(200).send({
          success: true,
          data: report,
        });
      } catch (error) {
        fastify.log.error('Failed to get compliance report:', error);
        reply.code(500).send({
          success: false,
          error: {
            code: 'COMPLIANCE_REPORT_FETCH_FAILED',
            message: 'Failed to fetch compliance report',
            details: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    }
  );

  // Generate data lineage report
  fastify.post(
    '/data-lineage',
    {
      preHandler: [fastify.authenticate, fastify.authorize(['admin', 'compliance_officer', 'auditor'])],
      schema: {
        body: {
          type: 'object',
          required: ['timeRange'],
          properties: {
            timeRange: {
              type: 'object',
              required: ['from', 'to'],
              properties: {
                from: { type: 'string', format: 'date-time' },
                to: { type: 'string', format: 'date-time' },
              },
            },
            correlationId: { type: 'string' },
            documentId: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest<{
      Body: {
        timeRange: { from: string; to: string };
        correlationId?: string;
        documentId?: string;
      };
    }>, reply: FastifyReply) => {
      try {
        const { timeRange, correlationId, documentId } = request.body;
        const workspaceId = request.user.workspaceId;

        // Generate audit package to get data lineage information
        const auditPackage = await complianceService.generateAuditPackage(
          workspaceId,
          {
            from: new Date(timeRange.from),
            to: new Date(timeRange.to),
          },
          { includeSignature: false }
        );

        // Filter data lineage based on optional parameters
        let filteredPolicyDecisions = auditPackage.policyDecisions;
        let filteredModelCalls = auditPackage.modelCalls;
        let filteredDocuments = auditPackage.documents;

        if (correlationId) {
          filteredPolicyDecisions = filteredPolicyDecisions.filter(d => d.correlationId === correlationId);
          filteredModelCalls = filteredModelCalls.filter(c => c.correlationId === correlationId);
          filteredDocuments = filteredDocuments.filter(d => d.correlationId === correlationId);
        }

        if (documentId) {
          // Find correlation IDs associated with the document
          const documentCorrelationIds = filteredDocuments
            .filter(d => d.id === documentId)
            .map(d => d.correlationId);
          
          filteredPolicyDecisions = filteredPolicyDecisions.filter(d => 
            documentCorrelationIds.includes(d.correlationId)
          );
          filteredModelCalls = filteredModelCalls.filter(c => 
            documentCorrelationIds.includes(c.correlationId)
          );
          filteredDocuments = filteredDocuments.filter(d => 
            documentCorrelationIds.includes(d.correlationId)
          );
        }

        // Build data lineage graph
        const lineageGraph = {
          nodes: [
            ...filteredDocuments.map(d => ({
              id: d.id,
              type: 'document',
              label: `Document: ${d.documentType}`,
              timestamp: d.timestamp,
              correlationId: d.correlationId,
              metadata: {
                documentType: d.documentType,
                processingStatus: d.processingStatus,
                ocrConfidence: d.ocrConfidence,
                dataLineage: d.dataLineage,
              },
            })),
            ...filteredPolicyDecisions.map(d => ({
              id: d.id,
              type: 'policy_decision',
              label: `Policy: ${d.decision.allow ? 'Allow' : 'Deny'}`,
              timestamp: d.timestamp,
              correlationId: d.correlationId,
              metadata: {
                decision: d.decision,
                dataLineage: d.dataLineage,
              },
            })),
            ...filteredModelCalls.map(c => ({
              id: c.id,
              type: 'model_call',
              label: `Model: ${c.modelRef}`,
              timestamp: c.timestamp,
              correlationId: c.correlationId,
              metadata: {
                modelRef: c.modelRef,
                success: c.success,
                latencyMs: c.latencyMs,
                modelDecision: c.modelDecision,
                dataLineage: c.dataLineage,
              },
            })),
          ],
          edges: [],
        };

        // Build edges based on correlation IDs and timestamps
        const correlationGroups = new Map<string, any[]>();
        lineageGraph.nodes.forEach(node => {
          if (!correlationGroups.has(node.correlationId)) {
            correlationGroups.set(node.correlationId, []);
          }
          correlationGroups.get(node.correlationId)!.push(node);
        });

        // Create edges within correlation groups based on temporal order
        correlationGroups.forEach(nodes => {
          const sortedNodes = nodes.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          for (let i = 0; i < sortedNodes.length - 1; i++) {
            lineageGraph.edges.push({
              from: sortedNodes[i].id,
              to: sortedNodes[i + 1].id,
              type: 'temporal_sequence',
              correlationId: sortedNodes[i].correlationId,
            });
          }
        });

        reply.code(200).send({
          success: true,
          data: {
            lineageGraph,
            summary: {
              totalNodes: lineageGraph.nodes.length,
              totalEdges: lineageGraph.edges.length,
              correlationGroups: correlationGroups.size,
              nodeTypes: {
                documents: filteredDocuments.length,
                policyDecisions: filteredPolicyDecisions.length,
                modelCalls: filteredModelCalls.length,
              },
            },
            metadata: auditPackage.metadata.dataLineage,
          },
        });
      } catch (error) {
        fastify.log.error('Failed to generate data lineage report:', error);
        reply.code(500).send({
          success: false,
          error: {
            code: 'DATA_LINEAGE_GENERATION_FAILED',
            message: 'Failed to generate data lineage report',
            details: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    }
  );
}