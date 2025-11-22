/**
 * Policy Evaluator Tests
 * Tests for policy evaluation engine and RBAC/ABAC decisions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PolicyEvaluator } from '../../src/policy/evaluator.js';
import { UserRole } from '../../src/auth/types.js';
import { 
  PolicyRuleType, 
  PolicyEffect,
  PolicyOperator 
} from '../../src/policy/types.js';
import type { 
  EvaluationContext, 
  PolicyRule
} from '../../src/policy/types.js';

describe('PolicyEvaluator', () => {
  let evaluator: PolicyEvaluator;
  let mockContext: EvaluationContext;

  beforeEach(() => {
    evaluator = new PolicyEvaluator();
    
    mockContext = {
      request: {
        workspaceId: 'test-workspace',
        userId: 'test-user',
        roles: [UserRole.OPERATOR],
        clientIP: '127.0.0.1',
        userAgent: 'test-agent',
        correlationId: 'test-correlation',
        timestamp: new Date(),
      },
      resource: 'document',
      action: 'read',
      metadata: {
        workspaceId: 'test-workspace',
      },
    };
  });

  describe('RBAC Policy Evaluation', () => {
    it('should allow admin access to all resources', async () => {
      mockContext.request.roles = [UserRole.ADMIN];
      mockContext.action = 'manage';
      
      const result = await evaluator.evaluatePolicy(mockContext);
      
      expect(result.decision.allow).toBe(true);
      expect(result.appliedRules.some(r => r.name === 'Admin Full Access')).toBe(true);
    });

    it('should allow operator to read documents', async () => {
      mockContext.request.roles = [UserRole.OPERATOR];
      mockContext.resource = 'document';
      mockContext.action = 'read';
      
      const result = await evaluator.evaluatePolicy(mockContext);
      
      expect(result.decision.allow).toBe(true);
    });

    it('should deny viewer from creating documents', async () => {
      mockContext.request.roles = [UserRole.VIEWER];
      mockContext.resource = 'document';
      mockContext.action = 'create';
      
      const result = await evaluator.evaluatePolicy(mockContext);
      
      expect(result.decision.allow).toBe(false);
      expect(result.decision.reasons.some(r => r.includes('Insufficient permissions'))).toBe(true);
    });
  });

  describe('Workspace Isolation', () => {
    it('should allow access to same workspace resources', async () => {
      mockContext.request.workspaceId = 'workspace-1';
      mockContext.metadata = { workspaceId: 'workspace-1' };
      
      const result = await evaluator.evaluatePolicy(mockContext);
      
      expect(result.appliedRules.some(r => r.name === 'Workspace Isolation')).toBe(true);
    });

    it('should enforce workspace isolation', async () => {
      // This test would need more complex setup to test cross-workspace access
      // For now, we'll test that the workspace isolation rule exists
      const rules = evaluator.getAllRules();
      const isolationRule = rules.find(r => r.name === 'Workspace Isolation');
      
      expect(isolationRule).toBeDefined();
      expect(isolationRule?.type).toBe(PolicyRuleType.ABAC);
    });
  });

  describe('Residency Policy Enforcement', () => {
    it('should have Spain residency rule', () => {
      const rules = evaluator.getAllRules();
      const residencyRule = rules.find(r => r.name === 'Spain Residency Enforcement');
      
      expect(residencyRule).toBeDefined();
      expect(residencyRule?.type).toBe(PolicyRuleType.RESIDENCY);
      expect(residencyRule?.enabled).toBe(true);
    });
  });

  describe('PII Protection Policy', () => {
    it('should require PII redaction when PII is detected', async () => {
      mockContext.data = { containsPII: true };
      
      const result = await evaluator.evaluatePolicy(mockContext);
      
      const piiRule = result.appliedRules.find(r => r.name === 'PII Redaction Required');
      expect(piiRule).toBeDefined();
      expect(piiRule?.effect).toBe(PolicyEffect.REDACT);
    });

    it('should not trigger PII redaction when no PII detected', async () => {
      mockContext.data = { containsPII: false };
      
      const result = await evaluator.evaluatePolicy(mockContext);
      
      const piiRule = result.appliedRules.find(r => r.name === 'PII Redaction Required');
      expect(piiRule).toBeUndefined();
    });
  });

  describe('Security Policy Enforcement', () => {
    it('should deny untrusted content execution', async () => {
      mockContext.request = {
        ...mockContext.request,
        sourceType: 'untrusted' as any,
      };
      mockContext.action = 'execute';
      
      const result = await evaluator.evaluatePolicy(mockContext);
      
      expect(result.decision.allow).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it('should allow trusted content execution', async () => {
      mockContext.request = {
        ...mockContext.request,
        sourceType: 'trusted' as any,
      };
      mockContext.action = 'execute';
      
      const result = await evaluator.evaluatePolicy(mockContext);
      
      // Should not be blocked by security rule (may still be blocked by RBAC)
      const securityViolations = result.violations.filter(v => 
        v.ruleName === 'Deny Untrusted Content Execution'
      );
      expect(securityViolations).toHaveLength(0);
    });
  });

  describe('Custom Policy Rules', () => {
    it('should add custom policy rule', () => {
      const customRule: PolicyRule = {
        id: 'custom-test-rule',
        name: 'Test Rule',
        description: 'Test custom rule',
        type: PolicyRuleType.ABAC,
        conditions: [
          { field: 'user.id', operator: PolicyOperator.EQUALS, value: 'test-user' },
        ],
        effect: PolicyEffect.ALLOW,
        priority: 50,
        enabled: true,
      };

      evaluator.addRule(customRule);
      
      const retrievedRule = evaluator.getRule('custom-test-rule');
      expect(retrievedRule).toEqual(customRule);
    });

    it('should remove policy rule', () => {
      const customRule: PolicyRule = {
        id: 'removable-rule',
        name: 'Removable Rule',
        description: 'Rule to be removed',
        type: PolicyRuleType.ABAC,
        conditions: [],
        effect: PolicyEffect.DENY,
        priority: 10,
        enabled: true,
      };

      evaluator.addRule(customRule);
      expect(evaluator.getRule('removable-rule')).toBeDefined();
      
      const removed = evaluator.removeRule('removable-rule');
      expect(removed).toBe(true);
      expect(evaluator.getRule('removable-rule')).toBeUndefined();
    });

    it('should enable/disable rules', () => {
      const ruleId = 'rbac-admin-all';
      
      // Disable rule
      const disabled = evaluator.setRuleEnabled(ruleId, false);
      expect(disabled).toBe(true);
      
      const rule = evaluator.getRule(ruleId);
      expect(rule?.enabled).toBe(false);
      
      // Re-enable rule
      const enabled = evaluator.setRuleEnabled(ruleId, true);
      expect(enabled).toBe(true);
      expect(rule?.enabled).toBe(true);
    });
  });

  describe('Policy Condition Evaluation', () => {
    it('should evaluate EQUALS condition', async () => {
      const testRule: PolicyRule = {
        id: 'equals-test',
        name: 'Equals Test',
        description: 'Test equals condition',
        type: PolicyRuleType.ABAC,
        conditions: [
          { field: 'user.id', operator: PolicyOperator.EQUALS, value: 'test-user' },
        ],
        effect: PolicyEffect.ALLOW,
        priority: 50,
        enabled: true,
      };

      evaluator.addRule(testRule);
      
      const result = await evaluator.evaluatePolicy(mockContext);
      expect(result.appliedRules.some(r => r.id === 'equals-test')).toBe(true);
    });

    it('should evaluate CONTAINS condition for arrays', async () => {
      const testRule: PolicyRule = {
        id: 'contains-test',
        name: 'Contains Test',
        description: 'Test contains condition',
        type: PolicyRuleType.ABAC,
        conditions: [
          { field: 'user.roles', operator: PolicyOperator.CONTAINS, value: UserRole.OPERATOR },
        ],
        effect: PolicyEffect.ALLOW,
        priority: 50,
        enabled: true,
      };

      evaluator.addRule(testRule);
      
      const result = await evaluator.evaluatePolicy(mockContext);
      expect(result.appliedRules.some(r => r.id === 'contains-test')).toBe(true);
    });

    it('should evaluate IN condition', async () => {
      const testRule: PolicyRule = {
        id: 'in-test',
        name: 'In Test',
        description: 'Test in condition',
        type: PolicyRuleType.ABAC,
        conditions: [
          { field: 'resource', operator: PolicyOperator.IN, value: ['document', 'workflow'] },
        ],
        effect: PolicyEffect.ALLOW,
        priority: 50,
        enabled: true,
      };

      evaluator.addRule(testRule);
      
      const result = await evaluator.evaluatePolicy(mockContext);
      expect(result.appliedRules.some(r => r.id === 'in-test')).toBe(true);
    });

    it('should evaluate negated conditions', async () => {
      const testRule: PolicyRule = {
        id: 'negated-test',
        name: 'Negated Test',
        description: 'Test negated condition',
        type: PolicyRuleType.ABAC,
        conditions: [
          { 
            field: 'user.roles', 
            operator: PolicyOperator.CONTAINS, 
            value: UserRole.ADMIN,
            negate: true 
          },
        ],
        effect: PolicyEffect.ALLOW,
        priority: 50,
        enabled: true,
      };

      evaluator.addRule(testRule);
      
      const result = await evaluator.evaluatePolicy(mockContext);
      // Should match because user is NOT admin
      expect(result.appliedRules.some(r => r.id === 'negated-test')).toBe(true);
    });
  });

  describe('Rule Priority Handling', () => {
    it('should evaluate rules in priority order', async () => {
      const highPriorityRule: PolicyRule = {
        id: 'high-priority',
        name: 'High Priority Rule',
        description: 'High priority test rule',
        type: PolicyRuleType.ABAC,
        conditions: [
          { field: 'user.id', operator: PolicyOperator.EQUALS, value: 'test-user' },
        ],
        effect: PolicyEffect.DENY,
        priority: 200, // Higher than default rules
        enabled: true,
      };

      evaluator.addRule(highPriorityRule);
      
      const result = await evaluator.evaluatePolicy(mockContext);
      
      // High priority deny rule should take precedence
      expect(result.decision.allow).toBe(false);
      expect(result.appliedRules[0].id).toBe('high-priority');
    });
  });

  describe('Performance and Metrics', () => {
    it('should track evaluation time', async () => {
      const result = await evaluator.evaluatePolicy(mockContext);
      
      expect(result.decision.evaluationTimeMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.decision.evaluationTimeMs).toBe('number');
    });

    it('should handle multiple rules efficiently', async () => {
      // Add multiple test rules
      for (let i = 0; i < 10; i++) {
        const rule: PolicyRule = {
          id: `perf-test-${i}`,
          name: `Performance Test Rule ${i}`,
          description: 'Performance test rule',
          type: PolicyRuleType.ABAC,
          conditions: [
            { field: 'user.id', operator: PolicyOperator.EQUALS, value: `user-${i}` },
          ],
          effect: PolicyEffect.AUDIT,
          priority: i,
          enabled: true,
        };
        evaluator.addRule(rule);
      }

      const startTime = Date.now();
      const result = await evaluator.evaluatePolicy(mockContext);
      const endTime = Date.now();
      
      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(100); // 100ms
      expect(result.decision.evaluationTimeMs).toBeLessThan(100);
    });
  });
});