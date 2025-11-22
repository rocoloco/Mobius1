/**
 * Policy Evaluation Engine
 * RBAC/ABAC policy evaluation with support for complex rules and conditions
 */

import { rbacService, Resource, Action } from '../auth/rbac.js';
import { UserRole } from '../auth/types.js';
import type { RequestContext } from '../auth/types.js';
import {
  PolicyRuleType,
  PolicyEffect,
  PolicyOperator,
  ViolationSeverity,
} from './types.js';
import type {
  PolicyRule,
  PolicyCondition,
  EvaluationContext,
  PolicyResult,
  PolicyDecision,
  PolicyViolation,
  PolicyAuditEvent,
} from './types.js';

/**
 * Default policy rules for the system
 */
const DEFAULT_POLICY_RULES: PolicyRule[] = [
  {
    id: 'rbac-admin-all',
    name: 'Admin Full Access',
    description: 'Administrators have full access to all resources',
    type: PolicyRuleType.RBAC,
    conditions: [
      { field: 'user.roles', operator: PolicyOperator.CONTAINS, value: UserRole.ADMIN },
    ],
    effect: PolicyEffect.ALLOW,
    priority: 100,
    enabled: true,
  },
  {
    id: 'rbac-workspace-isolation',
    name: 'Workspace Isolation',
    description: 'Users can only access resources in their workspace',
    type: PolicyRuleType.ABAC,
    conditions: [
      { field: 'resourceObj.workspaceId', operator: PolicyOperator.EQUALS, value: '${user.workspaceId}' },
    ],
    effect: PolicyEffect.ALLOW,
    priority: 90,
    enabled: true,
  },
  {
    id: 'residency-spain-only',
    name: 'Spain Residency Enforcement',
    description: 'All processing must occur within Spanish jurisdiction',
    type: PolicyRuleType.RESIDENCY,
    conditions: [
      { field: 'workspace.spainResidencyMode', operator: PolicyOperator.EQUALS, value: true },
      { field: 'request.location.country', operator: PolicyOperator.EQUALS, value: 'ES' },
    ],
    effect: PolicyEffect.ALLOW,
    priority: 95,
    enabled: true,
  },
  {
    id: 'pii-redaction-required',
    name: 'PII Redaction Required',
    description: 'All PII must be redacted in logs and responses',
    type: PolicyRuleType.PII_PROTECTION,
    conditions: [
      { field: 'data.containsPII', operator: PolicyOperator.EQUALS, value: true },
    ],
    effect: PolicyEffect.REDACT,
    priority: 99,
    enabled: true,
  },
  {
    id: 'security-deny-untrusted',
    name: 'Deny Untrusted Content Execution',
    description: 'Block execution of commands from untrusted content',
    type: PolicyRuleType.SECURITY,
    conditions: [
      { field: 'request.sourceType', operator: PolicyOperator.EQUALS, value: 'untrusted' },
      { field: 'request.action', operator: PolicyOperator.IN, value: ['execute', 'create', 'delete'] },
    ],
    effect: PolicyEffect.DENY,
    priority: 98,
    enabled: true,
  },
];

/**
 * Policy evaluator class
 */
export class PolicyEvaluator {
  private rules: Map<string, PolicyRule>;

  constructor(customRules: PolicyRule[] = []) {
    this.rules = new Map();
    
    // Load default rules
    for (const rule of DEFAULT_POLICY_RULES) {
      this.rules.set(rule.id, rule);
    }
    
    // Load custom rules (can override defaults)
    for (const rule of customRules) {
      this.rules.set(rule.id, rule);
    }
  }

  /**
   * Evaluate policies for a request
   */
  async evaluatePolicy(context: EvaluationContext): Promise<PolicyResult> {
    const startTime = Date.now();
    const appliedRules: PolicyRule[] = [];
    const violations: PolicyViolation[] = [];
    const auditEvents: PolicyAuditEvent[] = [];

    // Get applicable rules sorted by priority (highest first)
    const applicableRules = this.getApplicableRules(context);
    
    let finalDecision: PolicyEffect | null = null; // No default decision
    const reasons: string[] = [];

    // Evaluate each rule
    for (const rule of applicableRules) {
      const ruleResult = await this.evaluateRule(rule, context);
      
      if (ruleResult.matches) {
        appliedRules.push(rule);
        
        switch (rule.effect) {
          case PolicyEffect.ALLOW:
            if (finalDecision !== PolicyEffect.DENY) {
              finalDecision = PolicyEffect.ALLOW;
              reasons.push(`Allowed by rule: ${rule.name}`);
            }
            break;
            
          case PolicyEffect.DENY:
            finalDecision = PolicyEffect.DENY;
            reasons.push(`Denied by rule: ${rule.name}`);
            violations.push({
              ruleId: rule.id,
              ruleName: rule.name,
              severity: ViolationSeverity.HIGH,
              message: `Access denied by policy rule: ${rule.description}`,
              context,
              timestamp: new Date(),
            });
            // DENY rules take precedence, break early
            break;
            
          case PolicyEffect.AUDIT:
            auditEvents.push({
              id: crypto.randomUUID(),
              workspaceId: context.request.workspaceId,
              userId: context.request.userId,
              eventType: 'policy_evaluation',
              decision: {
                allow: finalDecision === PolicyEffect.ALLOW,
                reasons: [`Audit triggered by rule: ${rule.name}`],
                residency: { allowedRegion: 'ES', enforced: true, compliant: true, violations: [] },
                redaction: { applied: false, categories: [], redactedCount: 0, redactedText: '', confidence: 1 },
                quota: { remaining: 1000, window: 'daily', exceeded: false, resetTime: new Date() },
                timestamp: new Date(),
                evaluationTimeMs: 0,
              },
              context,
              correlationId: context.request.correlationId,
              timestamp: new Date(),
            });
            break;
            
          case PolicyEffect.REDACT:
            // Redaction is handled by the PII detector
            reasons.push(`Redaction required by rule: ${rule.name}`);
            break;
        }
      }
    }

    // Always check RBAC for permission validation, unless explicitly denied by policy
    if (finalDecision !== PolicyEffect.DENY) {
      const rbacResult = this.evaluateRBAC(context);
      if (!rbacResult.allowed) {
        finalDecision = PolicyEffect.DENY;
        reasons.push(rbacResult.reason || 'Denied by RBAC');
      } else if (finalDecision !== PolicyEffect.ALLOW) {
        finalDecision = PolicyEffect.ALLOW;
        reasons.push('Allowed by RBAC');
      }
    }

    const evaluationTimeMs = Date.now() - startTime;

    const decision: PolicyDecision = {
      allow: finalDecision === PolicyEffect.ALLOW,
      reasons,
      residency: { allowedRegion: 'ES', enforced: true, compliant: true, violations: [] },
      redaction: { applied: false, categories: [], redactedCount: 0, redactedText: '', confidence: 1 },
      quota: { remaining: 1000, window: 'daily', exceeded: false, resetTime: new Date() },
      timestamp: new Date(),
      evaluationTimeMs,
    };

    return {
      decision,
      appliedRules,
      violations,
      auditEvents,
    };
  }

  /**
   * Evaluate a single policy rule
   */
  private async evaluateRule(rule: PolicyRule, context: EvaluationContext): Promise<{ matches: boolean; reason?: string }> {
    if (!rule.enabled) {
      return { matches: false, reason: 'Rule is disabled' };
    }

    // Evaluate all conditions (AND logic)
    for (const condition of rule.conditions) {
      const conditionResult = this.evaluateCondition(condition, context);
      if (!conditionResult) {
        return { matches: false, reason: `Condition failed: ${condition.field} ${condition.operator} ${condition.value}` };
      }
    }

    return { matches: true };
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: PolicyCondition, context: EvaluationContext): boolean {
    // Special handling for workspace isolation
    if (condition.field === 'resourceObj.workspaceId' && condition.operator === PolicyOperator.EQUALS && condition.value === '${user.workspaceId}') {
      const resourceWorkspaceId = context.metadata?.workspaceId || context.request.workspaceId;
      const userWorkspaceId = context.request.workspaceId;
      const result = resourceWorkspaceId === userWorkspaceId;
      return condition.negate ? !result : result;
    }

    const fieldValue = this.getFieldValue(condition.field, context);
    const result = this.compareValues(fieldValue, condition.operator, condition.value);
    
    return condition.negate ? !result : result;
  }

  /**
   * Get field value from context using dot notation
   */
  private getFieldValue(field: string, context: EvaluationContext): any {
    const parts = field.split('.');
    let value: any = {
      user: {
        id: context.request.userId,
        workspaceId: context.request.workspaceId,
        roles: context.request.roles,
      },
      request: {
        ...context.request,
        action: context.action, // Include action from context
      },
      resource: context.resource, // Direct access to resource string
      resourceObj: {
        type: context.resource,
        workspaceId: context.request.workspaceId,
        ...context.metadata,
      },
      data: context.data,
    };

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Compare values using the specified operator
   */
  private compareValues(fieldValue: any, operator: PolicyOperator, expectedValue: any): boolean {
    // Handle variable substitution
    if (typeof expectedValue === 'string' && expectedValue.startsWith('${')) {
      // This would implement variable substitution from context
      // For now, we'll skip this advanced feature
    }

    switch (operator) {
      case PolicyOperator.EQUALS:
        return fieldValue === expectedValue;
        
      case PolicyOperator.NOT_EQUALS:
        return fieldValue !== expectedValue;
        
      case PolicyOperator.CONTAINS:
        if (Array.isArray(fieldValue)) {
          return fieldValue.includes(expectedValue);
        }
        if (typeof fieldValue === 'string') {
          return fieldValue.includes(expectedValue);
        }
        return false;
        
      case PolicyOperator.NOT_CONTAINS:
        if (Array.isArray(fieldValue)) {
          return !fieldValue.includes(expectedValue);
        }
        if (typeof fieldValue === 'string') {
          return !fieldValue.includes(expectedValue);
        }
        return true;
        
      case PolicyOperator.STARTS_WITH:
        return typeof fieldValue === 'string' && fieldValue.startsWith(expectedValue);
        
      case PolicyOperator.ENDS_WITH:
        return typeof fieldValue === 'string' && fieldValue.endsWith(expectedValue);
        
      case PolicyOperator.REGEX:
        if (typeof fieldValue === 'string') {
          const regex = new RegExp(expectedValue);
          return regex.test(fieldValue);
        }
        return false;
        
      case PolicyOperator.IN:
        return Array.isArray(expectedValue) && expectedValue.includes(fieldValue);
        
      case PolicyOperator.NOT_IN:
        return Array.isArray(expectedValue) && !expectedValue.includes(fieldValue);
        
      case PolicyOperator.GREATER_THAN:
        return typeof fieldValue === 'number' && fieldValue > expectedValue;
        
      case PolicyOperator.LESS_THAN:
        return typeof fieldValue === 'number' && fieldValue < expectedValue;
        
      case PolicyOperator.EXISTS:
        return fieldValue !== undefined && fieldValue !== null;
        
      case PolicyOperator.NOT_EXISTS:
        return fieldValue === undefined || fieldValue === null;
        
      default:
        return false;
    }
  }

  /**
   * Get applicable rules for the context
   */
  private getApplicableRules(context: EvaluationContext): PolicyRule[] {
    return Array.from(this.rules.values())
      .filter(rule => rule.enabled)
      .sort((a, b) => b.priority - a.priority); // Highest priority first
  }

  /**
   * Evaluate RBAC permissions
   */
  private evaluateRBAC(context: EvaluationContext): { allowed: boolean; reason?: string } {
    try {
      // Map resource string to RBAC Resource enum
      const resourceMap: Record<string, Resource> = {
        workspace: Resource.WORKSPACE,
        user: Resource.USER,
        document: Resource.DOCUMENT,
        workflow: Resource.WORKFLOW,
        audit: Resource.AUDIT,
        compliance: Resource.COMPLIANCE,
        policy: Resource.POLICY,
        system: Resource.SYSTEM,
      };

      // Map action string to RBAC Action enum
      const actionMap: Record<string, Action> = {
        create: Action.CREATE,
        read: Action.READ,
        update: Action.UPDATE,
        delete: Action.DELETE,
        execute: Action.EXECUTE,
        manage: Action.MANAGE,
      };

      const resource = resourceMap[context.resource] || Resource.SYSTEM;
      const action = actionMap[context.action] || Action.READ;

      return rbacService.hasPermission(
        context.request.roles,
        resource,
        action,
        context.request
      );
    } catch (error) {
      return {
        allowed: false,
        reason: `RBAC evaluation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Add or update a policy rule
   */
  addRule(rule: PolicyRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Remove a policy rule
   */
  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  /**
   * Get all rules
   */
  getAllRules(): PolicyRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get rule by ID
   */
  getRule(ruleId: string): PolicyRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Enable or disable a rule
   */
  setRuleEnabled(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
      return true;
    }
    return false;
  }
}

/**
 * Singleton policy evaluator instance
 */
export const policyEvaluator = new PolicyEvaluator();