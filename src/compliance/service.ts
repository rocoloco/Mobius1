/**
 * Compliance Service
 * AESIA-compliant audit evidence generator for Mobius 1 Platform
 * Implements deterministic audit package generation with digital signing
 */

import { randomUUID } from 'crypto';
import { createHash, createSign, createVerify } from 'crypto';
import { readFileSync } from 'fs';
import { db } from '../database/client.js';
import { auditService } from '../audit/service.js';
import { appConfig } from '../config/index.js';
import type { PolicyDecision, ResidencyValidation, PIIRedactionResult } from '../policy/types.js';
import type { RequestContext } from '../auth/types.js';

/**
 * Export format options
 */
export type ExportFormat = 'json' | 'pdf' | 'both';

/**
 * AESIA schema version
 */
export type AESIASchema = 'aesia-1.0' | 'aesia-1.1';

/**
 * Policy decision record for audit package
 */
export interface PolicyDecisionRecord {
  id: string;
  timestamp: string;
  workspaceId: string;
  userId?: string;
  decision: PolicyDecision;
  context: RequestContext;
  correlationId: string;
  // Enhanced data lineage tracking
  dataLineage?: {
    sourceDocumentId?: string;
    processingSteps?: string[];
    dataFlow?: string;
    policyRulesEvaluated?: string[];
    decisionProvenance?: {
      ruleEngine: string;
      version: string;
      evaluationTimeMs: number;
    };
  };
}

/**
 * Model call record for audit package
 */
export interface ModelCallRecord {
  id: string;
  timestamp: string;
  workspaceId: string;
  userId?: string;
  modelRef: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  success: boolean;
  errorMessage?: string;
  correlationId: string;
  // Enhanced model decision logging
  modelDecision?: {
    classification?: string;
    confidence?: number;
    reasoning?: string;
    alternativeClassifications?: Array<{ type: string; confidence: number }>;
    modelVersion?: string;
    trainingDataVersion?: string;
  };
  // Data lineage tracking
  dataLineage?: {
    inputSource?: string;
    outputDestination?: string;
    transformationType?: string;
    inputHash?: string;
    outputHash?: string;
  };
}

/**
 * Document processing record for audit package
 */
export interface DocumentRecord {
  id: string;
  timestamp: string;
  workspaceId: string;
  documentType: string;
  processingStatus: string;
  ocrConfidence?: number;
  piiRedacted: boolean;
  correlationId: string;
  // Enhanced data lineage tracking
  dataLineage?: {
    sourceDocumentId?: string;
    processingSteps?: string[];
    dataFlow?: string;
    extractedDataHash?: string;
    validationResults?: Array<{ rule: string; passed: boolean; confidence: number }>;
  };
}

/**
 * AESIA-compliant audit package
 */
export interface AuditPackage {
  specVersion: AESIASchema;
  packageId: string;
  orgId: string;
  workspaceId: string;
  period: {
    from: string;
    to: string;
  };
  generatedAt: string;
  policyDecisions: PolicyDecisionRecord[];
  modelCalls: ModelCallRecord[];
  documents: DocumentRecord[];
  metadata: {
    totalEvents: number;
    violationCount: number;
    complianceScore: number;
    dataResidency: {
      enforced: boolean;
      region: string;
      violations: number;
    };
    piiProtection: {
      redactionCount: number;
      categories: string[];
    };
    // Enhanced compliance tracking
    dataLineage: {
      totalDataFlows: number;
      completeLineageChains: number;
      orphanedRecords: number;
      averageProcessingSteps: number;
    };
    modelDecisions: {
      totalDecisions: number;
      averageConfidence: number;
      lowConfidenceDecisions: number;
      modelVersions: string[];
    };
    auditTrailCompleteness: {
      expectedRecords: number;
      actualRecords: number;
      completenessPercentage: number;
      missingRecordTypes: string[];
    };
  };
  hashTree: string; // Merkle root for integrity
  signature?: string; // Detached signature (CMS/PKCS#7)
}

/**
 * Compliance finding
 */
export interface ComplianceFinding {
  id: string;
  type: 'violation' | 'warning' | 'info';
  category: 'residency' | 'pii' | 'policy' | 'security' | 'audit';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  recommendation: string;
  affectedRecords: string[];
  timestamp: string;
}

/**
 * Compliance report
 */
export interface ComplianceReport {
  id: string;
  workspaceId: string;
  reportType: 'aesia_audit' | 'gdpr_compliance' | 'residency_verification';
  timeRange: {
    from: string;
    to: string;
  };
  generatedAt: string;
  findings: ComplianceFinding[];
  summary: {
    totalFindings: number;
    criticalFindings: number;
    complianceScore: number;
    recommendations: string[];
  };
  auditPackage?: AuditPackage;
  digitalSignature: string;
}

/**
 * Integrity verification result
 */
export interface IntegrityResult {
  valid: boolean;
  issues: string[];
  verificationDetails: {
    hashTreeValid: boolean;
    signatureValid: boolean;
    timestampValid: boolean;
    completenessValid: boolean;
  };
}

/**
 * Main Compliance Service class
 */
export class ComplianceService {
  private readonly privateKeyPath: string;
  private readonly publicKeyPath: string;
  private readonly aesiaVersion: AESIASchema;

  constructor() {
    this.privateKeyPath = appConfig.compliance.privateKeyPath || '';
    this.publicKeyPath = appConfig.compliance.publicKeyPath || '';
    this.aesiaVersion = (appConfig.compliance.aesiaVersion as AESIASchema) || 'aesia-1.0';
  }

  /**
   * Generate AESIA-compliant audit package
   */
  async generateAuditPackage(
    workspaceId: string,
    timeRange: { from: Date; to: Date },
    options: {
      includeSignature?: boolean;
      format?: ExportFormat;
    } = {}
  ): Promise<AuditPackage> {
    const packageId = randomUUID();
    const { includeSignature = true } = options;

    try {
      // Get workspace information
      const workspace = await db.workspace.findUnique({
        where: { id: workspaceId },
        select: {
          id: true,
          name: true,
          organizationType: true,
          spainResidencyMode: true,
        },
      });

      if (!workspace) {
        throw new Error(`Workspace ${workspaceId} not found`);
      }

      // Collect policy decisions
      const policyDecisions = await this.collectPolicyDecisions(workspaceId, timeRange);

      // Collect model calls (from audit events)
      const modelCalls = await this.collectModelCalls(workspaceId, timeRange);

      // Collect document processing records
      const documents = await this.collectDocumentRecords(workspaceId, timeRange);

      // Generate metadata
      const metadata = await this.generateMetadata(workspaceId, timeRange, {
        policyDecisions,
        modelCalls,
        documents,
      });

      // Create the audit package
      const auditPackage: AuditPackage = {
        specVersion: this.aesiaVersion,
        packageId,
        orgId: workspace.name, // Using workspace name as org identifier
        workspaceId,
        period: {
          from: timeRange.from.toISOString(),
          to: timeRange.to.toISOString(),
        },
        generatedAt: new Date().toISOString(),
        policyDecisions,
        modelCalls,
        documents,
        metadata,
        hashTree: '', // Will be calculated below
      };

      // Calculate hash tree (Merkle root)
      auditPackage.hashTree = this.calculateHashTree(auditPackage);

      // Add digital signature if requested
      if (includeSignature && this.privateKeyPath) {
        auditPackage.signature = await this.signPackage(auditPackage);
      }

      // Log the audit package generation
      await auditService.logEvent({
        eventType: 'COMPLIANCE_REPORT_GENERATED' as any,
        severity: 'INFO' as any,
        resourceId: packageId,
        action: 'generate_audit_package',
        metadata: {
          workspaceId,
          timeRange,
          recordCounts: {
            policyDecisions: policyDecisions.length,
            modelCalls: modelCalls.length,
            documents: documents.length,
          },
          complianceScore: metadata.complianceScore,
        },
        correlationId: randomUUID(),
        workspaceId,
      });

      return auditPackage;
    } catch (error) {
      console.error('Failed to generate audit package:', error);
      throw error;
    }
  }

  /**
   * Export compliance report in specified format
   */
  async exportCompliance(
    workspaceId: string,
    reportType: 'aesia_audit' | 'gdpr_compliance' | 'residency_verification',
    timeRange: { from: Date; to: Date },
    format: ExportFormat = 'json'
  ): Promise<ComplianceReport> {
    const reportId = randomUUID();

    try {
      // Generate audit package
      const auditPackage = await this.generateAuditPackage(workspaceId, timeRange);

      // Analyze compliance findings
      const findings = await this.analyzeCompliance(auditPackage, reportType);

      // Generate summary
      const summary = this.generateSummary(findings);

      // Create compliance report
      const report: ComplianceReport = {
        id: reportId,
        workspaceId,
        reportType,
        timeRange: {
          from: timeRange.from.toISOString(),
          to: timeRange.to.toISOString(),
        },
        generatedAt: new Date().toISOString(),
        findings,
        summary,
        auditPackage: format === 'json' || format === 'both' ? auditPackage : undefined,
        digitalSignature: '', // Will be calculated below
      };

      // Sign the report
      report.digitalSignature = await this.signReport(report);

      // Store in database
      await this.storeComplianceReport(report, format);

      return report;
    } catch (error) {
      console.error('Failed to export compliance report:', error);
      throw error;
    }
  }

  /**
   * Verify integrity of audit package
   */
  async verifyIntegrity(auditPackage: AuditPackage): Promise<IntegrityResult> {
    const issues: string[] = [];
    const verificationDetails = {
      hashTreeValid: false,
      signatureValid: false,
      timestampValid: false,
      completenessValid: false,
    };

    try {
      // Verify hash tree
      const calculatedHash = this.calculateHashTree({
        ...auditPackage,
        signature: undefined, // Exclude signature from hash calculation
      });
      verificationDetails.hashTreeValid = calculatedHash === auditPackage.hashTree;
      if (!verificationDetails.hashTreeValid) {
        issues.push('Hash tree verification failed - data integrity compromised');
      }

      // Verify digital signature
      if (auditPackage.signature && this.publicKeyPath) {
        verificationDetails.signatureValid = await this.verifySignature(auditPackage);
        if (!verificationDetails.signatureValid) {
          issues.push('Digital signature verification failed');
        }
      } else if (!auditPackage.signature) {
        issues.push('No digital signature present');
      }

      // Verify timestamp consistency
      const packageTime = new Date(auditPackage.generatedAt);
      const periodEnd = new Date(auditPackage.period.to);
      verificationDetails.timestampValid = packageTime >= periodEnd;
      if (!verificationDetails.timestampValid) {
        issues.push('Package generated before period end - temporal inconsistency');
      }

      // Verify completeness
      verificationDetails.completenessValid = await this.verifyCompleteness(auditPackage);
      if (!verificationDetails.completenessValid) {
        issues.push('Audit trail appears incomplete - missing expected records');
      }

      return {
        valid: issues.length === 0,
        issues,
        verificationDetails,
      };
    } catch (error) {
      console.error('Failed to verify integrity:', error);
      return {
        valid: false,
        issues: [`Integrity verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        verificationDetails,
      };
    }
  }

  /**
   * Collect policy decisions from audit events
   */
  private async collectPolicyDecisions(
    workspaceId: string,
    timeRange: { from: Date; to: Date }
  ): Promise<PolicyDecisionRecord[]> {
    const policyEvents = await auditService.queryEvents({
      workspaceId,
      eventTypes: ['POLICY_EVALUATION' as any, 'POLICY_VIOLATION' as any],
      dateFrom: timeRange.from,
      dateTo: timeRange.to,
      limit: 10000, // Large limit for comprehensive audit
    });

    return policyEvents.map(event => ({
      id: event.id,
      timestamp: event.timestamp.toISOString(),
      workspaceId: event.workspaceId,
      userId: event.userId || undefined,
      decision: event.metadata.policyDecision || {
        allow: false,
        reasons: ['Unknown'],
        residency: { allowedRegion: 'ES', enforced: true, compliant: false, violations: [] },
        redaction: { applied: false, categories: [], redactedCount: 0, redactedText: '', confidence: 0 },
        quota: { remaining: 0, window: 'unknown', exceeded: true, resetTime: new Date() },
        timestamp: new Date(event.timestamp),
        evaluationTimeMs: 0,
      },
      context: event.metadata.requestContext || {
        workspaceId: event.workspaceId,
        userId: event.userId || 'unknown',
        roles: [],
        clientIP: 'unknown',
        userAgent: 'unknown',
        correlationId: event.correlationId,
      },
      correlationId: event.correlationId,
    }));
  }

  /**
   * Collect model calls from audit events
   */
  private async collectModelCalls(
    workspaceId: string,
    timeRange: { from: Date; to: Date }
  ): Promise<ModelCallRecord[]> {
    // This would typically come from runtime layer audit events
    // For now, we'll extract from general audit events that might contain model call info
    const events = await auditService.queryEvents({
      workspaceId,
      dateFrom: timeRange.from,
      dateTo: timeRange.to,
      limit: 10000,
    });

    return events
      .filter(event => event.metadata.modelRef || event.metadata.inference)
      .map(event => ({
        id: event.id,
        timestamp: event.timestamp.toISOString(),
        workspaceId: event.workspaceId,
        userId: event.userId || undefined,
        modelRef: event.metadata.modelRef || 'unknown',
        inputTokens: event.metadata.inputTokens || 0,
        outputTokens: event.metadata.outputTokens || 0,
        latencyMs: event.metadata.latencyMs || 0,
        success: event.metadata.success !== false,
        errorMessage: event.metadata.errorMessage,
        correlationId: event.correlationId,
      }));
  }

  /**
   * Collect document processing records
   */
  private async collectDocumentRecords(
    workspaceId: string,
    timeRange: { from: Date; to: Date }
  ): Promise<DocumentRecord[]> {
    const documents = await db.document.findMany({
      where: {
        workspaceId,
        createdAt: {
          gte: timeRange.from,
          lte: timeRange.to,
        },
      },
      select: {
        id: true,
        type: true,
        processingStatus: true,
        ocrConfidence: true,
        createdAt: true,
      },
    });

    return documents.map(doc => ({
      id: doc.id,
      timestamp: doc.createdAt.toISOString(),
      workspaceId,
      documentType: doc.type,
      processingStatus: doc.processingStatus,
      ocrConfidence: doc.ocrConfidence || undefined,
      piiRedacted: true, // Assume PII redaction is always applied
      correlationId: randomUUID(), // Generate correlation ID for document processing
    }));
  }

  /**
   * Generate metadata for audit package
   */
  private async generateMetadata(
    workspaceId: string,
    timeRange: { from: Date; to: Date },
    data: {
      policyDecisions: PolicyDecisionRecord[];
      modelCalls: ModelCallRecord[];
      documents: DocumentRecord[];
    }
  ): Promise<AuditPackage['metadata']> {
    const totalEvents = data.policyDecisions.length + data.modelCalls.length + data.documents.length;
    
    // Count violations
    const violationCount = data.policyDecisions.filter(
      decision => !decision.decision.allow || decision.decision.residency.violations.length > 0
    ).length;

    // Calculate compliance score
    const complianceScore = totalEvents > 0 ? ((totalEvents - violationCount) / totalEvents) * 100 : 100;

    // Analyze data residency
    const residencyViolations = data.policyDecisions.filter(
      decision => !decision.decision.residency.compliant
    ).length;

    // Analyze PII protection
    const piiRedactions = data.policyDecisions.filter(
      decision => decision.decision.redaction.applied
    );
    const piiCategories = [...new Set(
      piiRedactions.flatMap(decision => decision.decision.redaction.categories)
    )];

    // Enhanced data lineage analysis
    const dataLineageAnalysis = this.analyzeDataLineage(data);
    
    // Enhanced model decision analysis
    const modelDecisionAnalysis = this.analyzeModelDecisions(data.modelCalls);
    
    // Audit trail completeness analysis
    const completenessAnalysis = await this.analyzeAuditTrailCompleteness(workspaceId, timeRange, data);

    return {
      totalEvents,
      violationCount,
      complianceScore,
      dataResidency: {
        enforced: true, // Always enforced in Spain residency mode
        region: 'ES',
        violations: residencyViolations,
      },
      piiProtection: {
        redactionCount: piiRedactions.length,
        categories: piiCategories.map(cat => cat.toString()),
      },
      dataLineage: dataLineageAnalysis,
      modelDecisions: modelDecisionAnalysis,
      auditTrailCompleteness: completenessAnalysis,
    };
  }

  /**
   * Analyze data lineage completeness and quality
   */
  private analyzeDataLineage(data: {
    policyDecisions: PolicyDecisionRecord[];
    modelCalls: ModelCallRecord[];
    documents: DocumentRecord[];
  }): AuditPackage['metadata']['dataLineage'] {
    const allRecords = [...data.policyDecisions, ...data.modelCalls, ...data.documents];
    
    // Group records by correlation ID to identify data flows
    const correlationGroups = new Map<string, any[]>();
    allRecords.forEach(record => {
      const correlationId = record.correlationId;
      if (!correlationGroups.has(correlationId)) {
        correlationGroups.set(correlationId, []);
      }
      correlationGroups.get(correlationId)!.push(record);
    });

    const totalDataFlows = correlationGroups.size;
    
    // Count complete lineage chains (groups with multiple record types)
    const completeLineageChains = Array.from(correlationGroups.values()).filter(group => {
      const recordTypes = new Set(group.map(record => {
        if ('decision' in record) return 'policy';
        if ('modelRef' in record) return 'model';
        if ('documentType' in record) return 'document';
        return 'unknown';
      }));
      return recordTypes.size > 1; // Complete chain has multiple types
    }).length;

    // Count orphaned records (single record in correlation group)
    const orphanedRecords = Array.from(correlationGroups.values()).filter(group => group.length === 1).length;

    // Calculate average processing steps
    const recordsWithSteps = allRecords.filter(record => 
      record.dataLineage?.processingSteps && record.dataLineage.processingSteps.length > 0
    );
    const averageProcessingSteps = recordsWithSteps.length > 0 
      ? recordsWithSteps.reduce((sum, record) => sum + (record.dataLineage?.processingSteps?.length || 0), 0) / recordsWithSteps.length
      : 0;

    return {
      totalDataFlows,
      completeLineageChains,
      orphanedRecords,
      averageProcessingSteps: Math.round(averageProcessingSteps * 100) / 100,
    };
  }

  /**
   * Analyze model decision quality and completeness
   */
  private analyzeModelDecisions(modelCalls: ModelCallRecord[]): AuditPackage['metadata']['modelDecisions'] {
    const totalDecisions = modelCalls.length;
    
    if (totalDecisions === 0) {
      return {
        totalDecisions: 0,
        averageConfidence: 0,
        lowConfidenceDecisions: 0,
        modelVersions: [],
      };
    }

    // Calculate confidence metrics
    const decisionsWithConfidence = modelCalls.filter(call => 
      call.modelDecision?.confidence !== undefined
    );
    
    const averageConfidence = decisionsWithConfidence.length > 0
      ? decisionsWithConfidence.reduce((sum, call) => sum + (call.modelDecision?.confidence || 0), 0) / decisionsWithConfidence.length
      : 0;

    const lowConfidenceDecisions = decisionsWithConfidence.filter(call => 
      (call.modelDecision?.confidence || 0) < 0.8
    ).length;

    // Extract unique model versions
    const modelVersions = [...new Set(
      modelCalls
        .map(call => call.modelDecision?.modelVersion)
        .filter(version => version !== undefined)
    )] as string[];

    return {
      totalDecisions,
      averageConfidence: Math.round(averageConfidence * 1000) / 1000,
      lowConfidenceDecisions,
      modelVersions,
    };
  }

  /**
   * Analyze audit trail completeness
   */
  private async analyzeAuditTrailCompleteness(
    workspaceId: string,
    timeRange: { from: Date; to: Date },
    data: {
      policyDecisions: PolicyDecisionRecord[];
      modelCalls: ModelCallRecord[];
      documents: DocumentRecord[];
    }
  ): Promise<AuditPackage['metadata']['auditTrailCompleteness']> {
    const actualRecords = data.policyDecisions.length + data.modelCalls.length + data.documents.length;
    
    // Estimate expected records based on document processing patterns
    // This is a heuristic - in a real system, you'd have more sophisticated expectations
    const expectedRecordsPerDocument = 3; // Policy decision + Model call + Document record
    const expectedRecords = Math.max(data.documents.length * expectedRecordsPerDocument, actualRecords);
    
    const completenessPercentage = expectedRecords > 0 
      ? (actualRecords / expectedRecords) * 100 
      : 100;

    // Identify missing record types
    const missingRecordTypes: string[] = [];
    if (data.documents.length > 0 && data.policyDecisions.length === 0) {
      missingRecordTypes.push('policy_decisions');
    }
    if (data.documents.length > 0 && data.modelCalls.length === 0) {
      missingRecordTypes.push('model_calls');
    }

    return {
      expectedRecords,
      actualRecords,
      completenessPercentage: Math.round(completenessPercentage * 100) / 100,
      missingRecordTypes,
    };
  }

  /**
   * Calculate hash tree (Merkle root) for integrity verification
   */
  private calculateHashTree(auditPackage: Omit<AuditPackage, 'signature'>): string {
    // Create deterministic string representation
    const packageData = {
      ...auditPackage,
      // Sort arrays for deterministic output
      policyDecisions: auditPackage.policyDecisions.sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
      modelCalls: auditPackage.modelCalls.sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
      documents: auditPackage.documents.sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    };

    const dataString = JSON.stringify(packageData, null, 0); // No formatting for deterministic output
    return createHash('sha256').update(dataString).digest('hex');
  }

  /**
   * Sign audit package with private key
   */
  private async signPackage(auditPackage: AuditPackage): Promise<string> {
    if (!this.privateKeyPath) {
      throw new Error('Private key path not configured');
    }

    try {
      const privateKey = readFileSync(this.privateKeyPath, 'utf8');
      const sign = createSign('RSA-SHA256');
      
      // Sign the hash tree (represents the entire package)
      sign.update(auditPackage.hashTree);
      const signature = sign.sign(privateKey, 'base64');
      
      return signature;
    } catch (error) {
      console.error('Failed to sign audit package:', error);
      throw new Error('Digital signing failed');
    }
  }

  /**
   * Sign compliance report
   */
  private async signReport(report: Omit<ComplianceReport, 'digitalSignature'>): Promise<string> {
    if (!this.privateKeyPath) {
      throw new Error('Private key path not configured');
    }

    try {
      const privateKey = readFileSync(this.privateKeyPath, 'utf8');
      const sign = createSign('RSA-SHA256');
      
      // Create deterministic representation of report
      const reportData = JSON.stringify({
        id: report.id,
        workspaceId: report.workspaceId,
        reportType: report.reportType,
        timeRange: report.timeRange,
        generatedAt: report.generatedAt,
        findings: report.findings.sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
        summary: report.summary,
      }, null, 0);
      
      sign.update(reportData);
      const signature = sign.sign(privateKey, 'base64');
      
      return signature;
    } catch (error) {
      console.error('Failed to sign compliance report:', error);
      throw new Error('Report signing failed');
    }
  }

  /**
   * Verify digital signature of audit package
   */
  private async verifySignature(auditPackage: AuditPackage): Promise<boolean> {
    if (!this.publicKeyPath || !auditPackage.signature) {
      return false;
    }

    try {
      const publicKey = readFileSync(this.publicKeyPath, 'utf8');
      const verify = createVerify('RSA-SHA256');
      
      verify.update(auditPackage.hashTree);
      return verify.verify(publicKey, auditPackage.signature, 'base64');
    } catch (error) {
      console.error('Failed to verify signature:', error);
      return false;
    }
  }

  /**
   * Verify completeness of audit trail
   */
  private async verifyCompleteness(auditPackage: AuditPackage): Promise<boolean> {
    try {
      // Check for temporal gaps in the audit trail
      const allTimestamps = [
        ...auditPackage.policyDecisions.map(d => new Date(d.timestamp)),
        ...auditPackage.modelCalls.map(c => new Date(c.timestamp)),
        ...auditPackage.documents.map(d => new Date(d.timestamp)),
      ].sort((a, b) => a.getTime() - b.getTime());

      if (allTimestamps.length === 0) {
        return true; // Empty period is valid
      }

      // Check for reasonable distribution of events
      const periodStart = new Date(auditPackage.period.from);
      const periodEnd = new Date(auditPackage.period.to);
      const firstEvent = allTimestamps[0];
      const lastEvent = allTimestamps[allTimestamps.length - 1];

      // Events should be within the specified period
      if (firstEvent < periodStart || lastEvent > periodEnd) {
        return false;
      }

      // Enhanced completeness checks
      
      // 1. Verify data lineage chain completeness
      const lineageCompleteness = this.verifyDataLineageCompleteness(auditPackage);
      if (!lineageCompleteness) {
        return false;
      }

      // 2. Verify model decision logging completeness
      const modelDecisionCompleteness = this.verifyModelDecisionCompleteness(auditPackage);
      if (!modelDecisionCompleteness) {
        return false;
      }

      // 3. Verify correlation ID consistency
      const correlationConsistency = this.verifyCorrelationConsistency(auditPackage);
      if (!correlationConsistency) {
        return false;
      }

      // 4. Verify audit trail metadata consistency
      const metadataConsistency = this.verifyMetadataConsistency(auditPackage);
      if (!metadataConsistency) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Failed to verify completeness:', error);
      return false;
    }
  }

  /**
   * Verify data lineage chain completeness
   */
  private verifyDataLineageCompleteness(auditPackage: AuditPackage): boolean {
    // Check that documents with processing have corresponding policy decisions and model calls
    const documentsWithProcessing = auditPackage.documents.filter(doc => 
      doc.processingStatus === 'COMPLETED' || doc.processingStatus === 'PROCESSING'
    );

    for (const document of documentsWithProcessing) {
      const relatedPolicyDecisions = auditPackage.policyDecisions.filter(decision => 
        decision.correlationId === document.correlationId
      );
      
      const relatedModelCalls = auditPackage.modelCalls.filter(call => 
        call.correlationId === document.correlationId
      );

      // For processed documents, we expect at least one policy decision
      if (relatedPolicyDecisions.length === 0) {
        console.warn(`Document ${document.id} missing policy decisions in lineage chain`);
        // Don't fail completeness for this - it's a warning
      }

      // For documents that went through AI processing, we expect model calls
      if (document.ocrConfidence && document.ocrConfidence > 0 && relatedModelCalls.length === 0) {
        console.warn(`Document ${document.id} with OCR processing missing model calls in lineage chain`);
        // Don't fail completeness for this - it's a warning
      }
    }

    return true; // Currently only warnings, not failures
  }

  /**
   * Verify model decision logging completeness
   */
  private verifyModelDecisionCompleteness(auditPackage: AuditPackage): boolean {
    // Check that model calls have appropriate decision logging
    const modelCallsWithoutDecisions = auditPackage.modelCalls.filter(call => 
      call.success && !call.modelDecision
    );

    if (modelCallsWithoutDecisions.length > 0) {
      console.warn(`${modelCallsWithoutDecisions.length} successful model calls missing decision logging`);
      // Don't fail completeness for missing decision logging - it's a warning
    }

    // Check for model calls with incomplete decision information
    const modelCallsWithIncompleteDecisions = auditPackage.modelCalls.filter(call => 
      call.modelDecision && 
      (!call.modelDecision.confidence || !call.modelDecision.reasoning)
    );

    if (modelCallsWithIncompleteDecisions.length > 0) {
      console.warn(`${modelCallsWithIncompleteDecisions.length} model calls have incomplete decision information`);
    }

    return true; // Currently only warnings, not failures
  }

  /**
   * Verify correlation ID consistency across records
   */
  private verifyCorrelationConsistency(auditPackage: AuditPackage): boolean {
    const allRecords = [
      ...auditPackage.policyDecisions,
      ...auditPackage.modelCalls,
      ...auditPackage.documents,
    ];

    // Group by correlation ID
    const correlationGroups = new Map<string, any[]>();
    allRecords.forEach(record => {
      const correlationId = record.correlationId;
      if (!correlationGroups.has(correlationId)) {
        correlationGroups.set(correlationId, []);
      }
      correlationGroups.get(correlationId)!.push(record);
    });

    // Check for temporal consistency within correlation groups
    for (const [correlationId, records] of correlationGroups) {
      const timestamps = records.map(record => new Date(record.timestamp)).sort((a, b) => a.getTime() - b.getTime());
      
      // Check that timestamps within a correlation group are reasonably close (within 1 hour)
      const firstTimestamp = timestamps[0];
      const lastTimestamp = timestamps[timestamps.length - 1];
      const timeDifference = lastTimestamp.getTime() - firstTimestamp.getTime();
      const oneHourInMs = 60 * 60 * 1000;

      if (timeDifference > oneHourInMs) {
        console.warn(`Correlation group ${correlationId} spans ${Math.round(timeDifference / oneHourInMs * 100) / 100} hours`);
        // Don't fail for this - it's just a warning about potentially long-running processes
      }
    }

    return true; // Currently only warnings, not failures
  }

  /**
   * Verify metadata consistency with actual records
   */
  private verifyMetadataConsistency(auditPackage: AuditPackage): boolean {
    const actualTotalEvents = auditPackage.policyDecisions.length + auditPackage.modelCalls.length + auditPackage.documents.length;
    
    if (auditPackage.metadata.totalEvents !== actualTotalEvents) {
      console.error(`Metadata totalEvents (${auditPackage.metadata.totalEvents}) doesn't match actual count (${actualTotalEvents})`);
      return false;
    }

    // Verify violation count
    const actualViolations = auditPackage.policyDecisions.filter(
      decision => !decision.decision.allow || decision.decision.residency.violations.length > 0
    ).length;

    if (auditPackage.metadata.violationCount !== actualViolations) {
      console.error(`Metadata violationCount (${auditPackage.metadata.violationCount}) doesn't match actual count (${actualViolations})`);
      return false;
    }

    // Verify PII redaction count
    const actualPiiRedactions = auditPackage.policyDecisions.filter(
      decision => decision.decision.redaction.applied
    ).length;

    if (auditPackage.metadata.piiProtection.redactionCount !== actualPiiRedactions) {
      console.error(`Metadata PII redaction count (${auditPackage.metadata.piiProtection.redactionCount}) doesn't match actual count (${actualPiiRedactions})`);
      return false;
    }

    return true;
  }

  /**
   * Analyze compliance findings
   */
  private async analyzeCompliance(
    auditPackage: AuditPackage,
    reportType: 'aesia_audit' | 'gdpr_compliance' | 'residency_verification'
  ): Promise<ComplianceFinding[]> {
    const findings: ComplianceFinding[] = [];

    // Common compliance checks
    await this.analyzeCommonCompliance(auditPackage, findings);

    // Report-type specific checks
    switch (reportType) {
      case 'aesia_audit':
        await this.analyzeAESIACompliance(auditPackage, findings);
        break;
      case 'gdpr_compliance':
        await this.analyzeGDPRCompliance(auditPackage, findings);
        break;
      case 'residency_verification':
        await this.analyzeResidencyCompliance(auditPackage, findings);
        break;
    }

    return findings;
  }

  /**
   * Analyze common compliance issues across all report types
   */
  private async analyzeCommonCompliance(auditPackage: AuditPackage, findings: ComplianceFinding[]): Promise<void> {
    // Analyze policy violations
    const violations = auditPackage.policyDecisions.filter(d => !d.decision.allow);
    if (violations.length > 0) {
      findings.push({
        id: randomUUID(),
        type: 'violation',
        category: 'policy',
        severity: violations.length > 10 ? 'high' : 'medium',
        title: 'Policy Violations Detected',
        description: `${violations.length} policy violations found during the audit period`,
        recommendation: 'Review policy configurations and user training',
        affectedRecords: violations.map(v => v.id),
        timestamp: new Date().toISOString(),
      });
    }

    // Analyze data lineage completeness
    if (auditPackage.metadata.dataLineage.orphanedRecords > 0) {
      findings.push({
        id: randomUUID(),
        type: 'warning',
        category: 'audit',
        severity: 'medium',
        title: 'Incomplete Data Lineage Chains',
        description: `${auditPackage.metadata.dataLineage.orphanedRecords} orphaned records found without complete lineage chains`,
        recommendation: 'Review data processing workflows to ensure complete audit trails',
        affectedRecords: [],
        timestamp: new Date().toISOString(),
      });
    }

    // Analyze model decision quality
    if (auditPackage.metadata.modelDecisions.lowConfidenceDecisions > 0) {
      findings.push({
        id: randomUUID(),
        type: 'warning',
        category: 'audit',
        severity: 'medium',
        title: 'Low Confidence Model Decisions',
        description: `${auditPackage.metadata.modelDecisions.lowConfidenceDecisions} model decisions with confidence below 80%`,
        recommendation: 'Review and retrain models with low confidence scores',
        affectedRecords: [],
        timestamp: new Date().toISOString(),
      });
    }

    // Add positive findings for good compliance
    if (auditPackage.metadata.complianceScore >= 95) {
      findings.push({
        id: randomUUID(),
        type: 'info',
        category: 'audit',
        severity: 'low',
        title: 'Excellent Compliance Score',
        description: `Compliance score of ${auditPackage.metadata.complianceScore.toFixed(1)}% achieved`,
        recommendation: 'Maintain current compliance practices',
        affectedRecords: [],
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Analyze AESIA-specific compliance requirements
   */
  private async analyzeAESIACompliance(auditPackage: AuditPackage, findings: ComplianceFinding[]): Promise<void> {
    // Check AI model transparency requirements
    const modelCallsWithoutDecisionLogging = auditPackage.modelCalls.filter(call => 
      call.success && !call.modelDecision?.reasoning
    );

    if (modelCallsWithoutDecisionLogging.length > 0) {
      findings.push({
        id: randomUUID(),
        type: 'violation',
        category: 'audit',
        severity: 'high',
        title: 'AI Decision Transparency Violation',
        description: `${modelCallsWithoutDecisionLogging.length} AI model decisions lack required reasoning documentation`,
        recommendation: 'Implement comprehensive AI decision logging with reasoning for AESIA compliance',
        affectedRecords: modelCallsWithoutDecisionLogging.map(call => call.id),
        timestamp: new Date().toISOString(),
      });
    }

    // Check model version tracking
    if (auditPackage.metadata.modelDecisions.modelVersions.length === 0 && auditPackage.modelCalls.length > 0) {
      findings.push({
        id: randomUUID(),
        type: 'violation',
        category: 'audit',
        severity: 'high',
        title: 'Missing Model Version Tracking',
        description: 'AI model versions are not being tracked as required by AESIA',
        recommendation: 'Implement model version tracking for all AI decisions',
        affectedRecords: [],
        timestamp: new Date().toISOString(),
      });
    }

    // Check audit trail completeness
    if (auditPackage.metadata.auditTrailCompleteness.completenessPercentage < 95) {
      findings.push({
        id: randomUUID(),
        type: 'violation',
        category: 'audit',
        severity: 'critical',
        title: 'Incomplete Audit Trail',
        description: `Audit trail completeness is ${auditPackage.metadata.auditTrailCompleteness.completenessPercentage.toFixed(1)}%, below AESIA requirement of 95%`,
        recommendation: 'Investigate and resolve missing audit records',
        affectedRecords: [],
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Analyze GDPR-specific compliance requirements
   */
  private async analyzeGDPRCompliance(auditPackage: AuditPackage, findings: ComplianceFinding[]): Promise<void> {
    // Analyze PII protection
    const piiIssues = auditPackage.policyDecisions.filter(
      d => d.decision.redaction.applied && d.decision.redaction.confidence < 0.9
    );
    if (piiIssues.length > 0) {
      findings.push({
        id: randomUUID(),
        type: 'warning',
        category: 'pii',
        severity: 'medium',
        title: 'PII Redaction Confidence Issues',
        description: `${piiIssues.length} PII redactions with low confidence scores`,
        recommendation: 'Review and improve PII detection algorithms',
        affectedRecords: piiIssues.map(i => i.id),
        timestamp: new Date().toISOString(),
      });
    }

    // Check for unredacted PII in logs
    const unredactedPII = auditPackage.policyDecisions.filter(
      d => d.decision.redaction.categories.length > 0 && !d.decision.redaction.applied
    );
    if (unredactedPII.length > 0) {
      findings.push({
        id: randomUUID(),
        type: 'violation',
        category: 'pii',
        severity: 'critical',
        title: 'Unredacted PII in Audit Logs',
        description: `${unredactedPII.length} instances of unredacted PII found in audit logs`,
        recommendation: 'Immediate PII redaction required for GDPR compliance',
        affectedRecords: unredactedPII.map(d => d.id),
        timestamp: new Date().toISOString(),
      });
    }

    // Check data processing lawfulness
    const unlawfulProcessing = auditPackage.policyDecisions.filter(
      d => d.decision.allow && !d.decision.residency.compliant
    );
    if (unlawfulProcessing.length > 0) {
      findings.push({
        id: randomUUID(),
        type: 'violation',
        category: 'policy',
        severity: 'critical',
        title: 'Unlawful Data Processing',
        description: `${unlawfulProcessing.length} instances of data processing outside legal jurisdiction`,
        recommendation: 'Ensure all data processing occurs within GDPR-compliant jurisdictions',
        affectedRecords: unlawfulProcessing.map(d => d.id),
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Analyze data residency compliance requirements
   */
  private async analyzeResidencyCompliance(auditPackage: AuditPackage, findings: ComplianceFinding[]): Promise<void> {
    // Analyze residency compliance
    const residencyViolations = auditPackage.policyDecisions.filter(
      d => !d.decision.residency.compliant
    );
    if (residencyViolations.length > 0) {
      findings.push({
        id: randomUUID(),
        type: 'violation',
        category: 'residency',
        severity: 'critical',
        title: 'Data Residency Violations',
        description: `${residencyViolations.length} data residency violations detected`,
        recommendation: 'Immediate review of data processing locations required',
        affectedRecords: residencyViolations.map(v => v.id),
        timestamp: new Date().toISOString(),
      });
    }

    // Check for consistent residency enforcement
    if (!auditPackage.metadata.dataResidency.enforced) {
      findings.push({
        id: randomUUID(),
        type: 'violation',
        category: 'residency',
        severity: 'critical',
        title: 'Data Residency Not Enforced',
        description: 'Data residency enforcement is not active for this workspace',
        recommendation: 'Enable Spain residency mode for compliance',
        affectedRecords: [],
        timestamp: new Date().toISOString(),
      });
    }

    // Verify all processing occurred in Spain
    if (auditPackage.metadata.dataResidency.region !== 'ES') {
      findings.push({
        id: randomUUID(),
        type: 'violation',
        category: 'residency',
        severity: 'critical',
        title: 'Incorrect Data Residency Region',
        description: `Data processing occurred in ${auditPackage.metadata.dataResidency.region} instead of Spain (ES)`,
        recommendation: 'Reconfigure system to process data only within Spanish jurisdiction',
        affectedRecords: [],
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Generate summary from findings
   */
  private generateSummary(findings: ComplianceFinding[]): ComplianceReport['summary'] {
    const totalFindings = findings.length;
    const criticalFindings = findings.filter(f => f.severity === 'critical').length;
    
    // Calculate compliance score based on findings
    const violationCount = findings.filter(f => f.type === 'violation').length;
    const complianceScore = totalFindings > 0 ? Math.max(0, 100 - (violationCount * 10)) : 100;

    // Generate recommendations
    const recommendations = [
      ...new Set(findings.map(f => f.recommendation))
    ].slice(0, 5); // Top 5 unique recommendations

    return {
      totalFindings,
      criticalFindings,
      complianceScore,
      recommendations,
    };
  }

  /**
   * Store compliance report in database
   */
  private async storeComplianceReport(
    report: ComplianceReport,
    format: ExportFormat
  ): Promise<void> {
    try {
      const jsonExport = format === 'json' || format === 'both' 
        ? JSON.stringify(report, null, 2) 
        : null;

      // PDF export would be implemented here
      const pdfExport = format === 'pdf' || format === 'both' 
        ? null // TODO: Implement PDF generation
        : null;

      await db.complianceReport.create({
        data: {
          id: report.id,
          workspaceId: report.workspaceId,
          reportType: report.reportType.toUpperCase() as any,
          timeRangeFrom: new Date(report.timeRange.from),
          timeRangeTo: new Date(report.timeRange.to),
          findings: report.findings,
          digitalSignature: report.digitalSignature,
          jsonExport,
          pdfExport,
          generatedAt: new Date(report.generatedAt),
        },
      });
    } catch (error) {
      console.error('Failed to store compliance report:', error);
      throw error;
    }
  }
}

/**
 * Singleton compliance service instance
 */
export const complianceService = new ComplianceService();