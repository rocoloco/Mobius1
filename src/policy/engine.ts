/**
 * Policy Engine Core
 * Main orchestrator for policy evaluation, residency validation, and PII redaction
 */

import { residencyValidator } from './residencyValidator.js';
import { piiDetector } from './piiDetector.js';
import { policyEvaluator } from './evaluator.js';
import type {
  PolicyDecision,
  ResidencyValidation,
  PIIRedactionResult,
  EvaluationContext,
  PolicyResult,
  GeographicLocation,
} from './types.js';

/**
 * Policy engine configuration
 */
export interface PolicyEngineConfig {
  enableResidencyValidation: boolean;
  enablePIIRedaction: boolean;
  enablePolicyEvaluation: boolean;
  auditAllDecisions: boolean;
  strictMode: boolean;
}

/**
 * Default policy engine configuration
 */
export const DEFAULT_POLICY_ENGINE_CONFIG: PolicyEngineConfig = {
  enableResidencyValidation: true,
  enablePIIRedaction: true,
  enablePolicyEvaluation: true,
  auditAllDecisions: true,
  strictMode: true,
};

/**
 * Policy engine request
 */
export interface PolicyEngineRequest {
  context: EvaluationContext;
  data?: string;
  location?: GeographicLocation;
  operation?: string;
}

/**
 * Main Policy Engine class
 */
export class PolicyEngine {
  private config: PolicyEngineConfig;

  constructor(config: Partial<PolicyEngineConfig> = {}) {
    this.config = { ...DEFAULT_POLICY_ENGINE_CONFIG, ...config };
  }

  /**
   * Evaluate a complete policy decision
   */
  async evaluate(request: PolicyEngineRequest): Promise<PolicyDecision> {
    const startTime = Date.now();
    
    try {
      // 1. Evaluate core policy rules (RBAC/ABAC)
      const policyResult = await this.evaluatePolicies(request.context);
      
      // 2. Validate residency compliance
      const residencyResult = await this.validateResidency(
        request.operation || 'unknown',
        request.location,
        request.context.request.workspaceId
      );
      
      // 3. Detect and redact PII
      const redactionResult = await this.detectAndRedactPII(request.data || '');
      
      // 4. Check quota limits (placeholder for now)
      const quotaResult = {
        remaining: 1000,
        window: 'daily',
        exceeded: false,
        resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      // 5. Make final decision
      const finalDecision = this.makeFinalDecision(
        policyResult,
        residencyResult,
        redactionResult,
        quotaResult
      );

      const evaluationTimeMs = Date.now() - startTime;

      const decision: PolicyDecision = {
        allow: finalDecision.allow,
        reasons: finalDecision.reasons,
        residency: residencyResult,
        redaction: redactionResult,
        quota: quotaResult,
        timestamp: new Date(),
        evaluationTimeMs,
      };

      // 6. Audit the decision if configured
      if (this.config.auditAllDecisions) {
        await this.auditDecision(decision, request.context);
      }

      return decision;

    } catch (error) {
      // Handle evaluation errors
      const evaluationTimeMs = Date.now() - startTime;
      
      return {
        allow: false,
        reasons: [`Policy evaluation error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        residency: {
          allowedRegion: 'ES',
          enforced: this.config.enableResidencyValidation,
          compliant: false,
          violations: ['Policy evaluation failed'],
        },
        redaction: {
          applied: false,
          categories: [],
          redactedCount: 0,
          redactedText: request.data || '',
          confidence: 0,
        },
        quota: {
          remaining: 0,
          window: 'daily',
          exceeded: true,
          resetTime: new Date(),
        },
        timestamp: new Date(),
        evaluationTimeMs,
      };
    }
  }

  /**
   * Evaluate policy rules
   */
  private async evaluatePolicies(context: EvaluationContext): Promise<PolicyResult> {
    if (!this.config.enablePolicyEvaluation) {
      return {
        decision: {
          allow: true,
          reasons: ['Policy evaluation disabled'],
          residency: { allowedRegion: 'ES', enforced: false, compliant: true, violations: [] },
          redaction: { applied: false, categories: [], redactedCount: 0, redactedText: '', confidence: 1 },
          quota: { remaining: 1000, window: 'daily', exceeded: false, resetTime: new Date() },
          timestamp: new Date(),
          evaluationTimeMs: 0,
        },
        appliedRules: [],
        violations: [],
        auditEvents: [],
      };
    }

    return await policyEvaluator.evaluatePolicy(context);
  }

  /**
   * Validate residency compliance
   */
  private async validateResidency(
    operation: string,
    location?: GeographicLocation,
    workspaceId?: string
  ): Promise<ResidencyValidation> {
    if (!this.config.enableResidencyValidation) {
      return {
        allowedRegion: 'GLOBAL',
        enforced: false,
        compliant: true,
        violations: [],
      };
    }

    return await residencyValidator.validateResidency(operation, location, workspaceId);
  }

  /**
   * Detect and redact PII
   */
  private async detectAndRedactPII(data: string): Promise<PIIRedactionResult> {
    if (!this.config.enablePIIRedaction || !data) {
      return {
        applied: false,
        categories: [],
        redactedCount: 0,
        redactedText: data,
        confidence: 1.0,
      };
    }

    return piiDetector.redactPII(data);
  }

  /**
   * Make final policy decision
   */
  private makeFinalDecision(
    policyResult: PolicyResult,
    residencyResult: ResidencyValidation,
    redactionResult: PIIRedactionResult,
    quotaResult: any
  ): { allow: boolean; reasons: string[] } {
    const reasons: string[] = [];
    let allow = true;

    // Check policy evaluation result
    if (!policyResult.decision.allow) {
      allow = false;
      reasons.push(...policyResult.decision.reasons);
    }

    // Check residency compliance
    if (residencyResult.enforced && !residencyResult.compliant) {
      allow = false;
      reasons.push('Residency compliance violation');
      reasons.push(...residencyResult.violations);
    }

    // Check quota limits
    if (quotaResult.exceeded) {
      allow = false;
      reasons.push('Quota limit exceeded');
    }

    // In strict mode, any violation denies access
    if (this.config.strictMode && (policyResult.violations.length > 0 || residencyResult.violations.length > 0)) {
      allow = false;
      reasons.push('Strict mode: violations detected');
    }

    // If allowing, add positive reasons
    if (allow && reasons.length === 0) {
      reasons.push('All policy checks passed');
    }

    return { allow, reasons };
  }

  /**
   * Audit policy decision
   */
  private async auditDecision(decision: PolicyDecision, context: EvaluationContext): Promise<void> {
    try {
      // Import audit service dynamically to avoid circular dependencies
      const { auditService, AuditEventType, AuditSeverity } = await import('../audit/service.js');
      
      // Determine event type and severity based on decision
      const eventType = decision.allow ? AuditEventType.POLICY_EVALUATION : AuditEventType.POLICY_VIOLATION;
      const severity = decision.allow ? AuditSeverity.INFO : AuditSeverity.ERROR;
      
      // Log policy evaluation event
      await auditService.logPolicyEvent({
        eventType,
        severity,
        resourceId: context.resource,
        action: context.action,
        metadata: {
          evaluationTimeMs: decision.evaluationTimeMs,
          residencyEnforced: decision.residency.enforced,
          piiRedactionApplied: decision.redaction.applied,
          quotaRemaining: decision.quota.remaining,
        },
        correlationId: context.request.correlationId,
        workspaceId: context.request.workspaceId,
        userId: context.request.userId,
        policyDecision: decision,
        requestContext: context.request,
      });

      // Log residency validation if enforced
      if (decision.residency.enforced) {
        const { auditService: auditSvc } = await import('../audit/service.js');
        await auditSvc.logResidencyEvent({
          eventType: decision.residency.compliant ? AuditEventType.RESIDENCY_CHECK : AuditEventType.RESIDENCY_VIOLATION,
          severity: decision.residency.compliant ? AuditSeverity.INFO : AuditSeverity.ERROR,
          resourceId: context.resource,
          action: `residency_validation_${context.action}`,
          metadata: {
            operation: context.action,
            violations: decision.residency.violations,
          },
          correlationId: context.request.correlationId,
          workspaceId: context.request.workspaceId,
          userId: context.request.userId,
          residencyValidation: decision.residency,
          requestedOperation: context.action,
          clientLocation: {
            ip: context.request.clientIP,
          },
        });
      }

      // Log PII redaction if applied
      if (decision.redaction.applied) {
        const { auditService: auditSvc } = await import('../audit/service.js');
        await auditSvc.logPIIEvent({
          eventType: AuditEventType.PII_REDACTION,
          severity: AuditSeverity.INFO,
          resourceId: context.resource,
          action: `pii_redaction_${context.action}`,
          metadata: {
            categoriesRedacted: decision.redaction.categories,
            redactionCount: decision.redaction.redactedCount,
            confidence: decision.redaction.confidence,
          },
          correlationId: context.request.correlationId,
          workspaceId: context.request.workspaceId,
          userId: context.request.userId,
          redactionResult: decision.redaction,
          processingContext: `policy_evaluation_${context.action}`,
        });
      }

    } catch (error) {
      // Don't fail policy evaluation if audit logging fails
      console.error('Failed to audit policy decision:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId: context.request.correlationId,
        workspaceId: context.request.workspaceId,
      });
    }
  }

  /**
   * Quick policy check for simple allow/deny decisions
   */
  async quickCheck(context: EvaluationContext): Promise<boolean> {
    const decision = await this.evaluate({ context });
    return decision.allow;
  }

  /**
   * Validate data residency for a specific operation
   */
  async validateDataResidency(
    operation: string,
    workspaceId: string,
    location?: GeographicLocation
  ): Promise<ResidencyValidation> {
    return await this.validateResidency(operation, location, workspaceId);
  }

  /**
   * Redact PII from text
   */
  async redactPII(text: string): Promise<PIIRedactionResult> {
    return await this.detectAndRedactPII(text);
  }

  /**
   * Get current configuration
   */
  getConfig(): PolicyEngineConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PolicyEngineConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Health check for policy engine components
   */
  async healthCheck(): Promise<{ healthy: boolean; components: Record<string, boolean>; errors: string[] }> {
    const errors: string[] = [];
    const components = {
      residencyValidator: true,
      piiDetector: true,
      policyEvaluator: true,
    };

    try {
      // Test residency validator
      await residencyValidator.validateResidency('test', undefined, 'test-workspace');
    } catch (error) {
      components.residencyValidator = false;
      errors.push(`Residency validator error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    try {
      // Test PII detector
      piiDetector.detectPII('test text');
    } catch (error) {
      components.piiDetector = false;
      errors.push(`PII detector error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    try {
      // Test policy evaluator
      const testContext: EvaluationContext = {
        request: {
          workspaceId: 'test',
          userId: 'test',
          roles: [],
          clientIP: '127.0.0.1',
          userAgent: 'test',
          correlationId: 'test',
          timestamp: new Date(),
        },
        resource: 'test',
        action: 'read',
      };
      await policyEvaluator.evaluatePolicy(testContext);
    } catch (error) {
      components.policyEvaluator = false;
      errors.push(`Policy evaluator error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    const healthy = Object.values(components).every(status => status);

    return {
      healthy,
      components,
      errors,
    };
  }
}

/**
 * Singleton policy engine instance
 */
export const policyEngine = new PolicyEngine();