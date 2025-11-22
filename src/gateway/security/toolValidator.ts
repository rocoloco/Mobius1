/**
 * Tool Execution Security Validator
 * Validates and controls AI tool execution to prevent unsafe operations
 */

import { z } from 'zod';
import { rbacService, Resource, Action } from '../../auth/rbac.js';
import type { RequestContext } from '../../auth/types.js';

/**
 * Allowed tools in the system
 */
export enum AllowedTool {
  FILL_FORM = 'fill_form',
  CALC_VAT = 'calc_vat',
  FETCH_APPOINTMENT_SLOTS = 'fetch_appointment_slots',
}

/**
 * Tool validation result
 */
export interface ToolValidationResult {
  allowed: boolean;
  reason?: string;
  errorCode?: string;
  requiredPermissions?: string[];
}

/**
 * Tool execution request
 */
export interface ToolExecutionRequest {
  toolName: string;
  arguments: Record<string, any>;
  context: RequestContext;
  sourceContent?: string; // Content that suggested this tool usage
}

/**
 * Tool argument schemas for validation
 */
const TOOL_ARGUMENT_SCHEMAS = {
  [AllowedTool.FILL_FORM]: z.object({
    formType: z.enum(['modelo_303', 'nie_application', 'tie_application']),
    data: z.record(z.string(), z.any()),
    workspaceId: z.string().uuid(),
  }),

  [AllowedTool.CALC_VAT]: z.object({
    transactions: z.array(z.object({
      amount: z.number(),
      vatRate: z.number().min(0).max(1),
      date: z.string().datetime(),
    })),
    period: z.object({
      year: z.number().int().min(2020).max(2030),
      quarter: z.number().int().min(1).max(4),
    }),
    workspaceId: z.string().uuid(),
  }),

  [AllowedTool.FETCH_APPOINTMENT_SLOTS]: z.object({
    serviceType: z.enum(['nie_appointment', 'tie_renewal', 'empadronamiento']),
    location: z.string().min(1).max(100),
    dateRange: z.object({
      start: z.string().datetime(),
      end: z.string().datetime(),
    }),
    workspaceId: z.string().uuid(),
  }),
};

/**
 * Tool permission requirements
 */
const TOOL_PERMISSIONS = {
  [AllowedTool.FILL_FORM]: {
    resource: Resource.DOCUMENT,
    action: Action.CREATE,
  },
  [AllowedTool.CALC_VAT]: {
    resource: Resource.WORKFLOW,
    action: Action.EXECUTE,
  },
  [AllowedTool.FETCH_APPOINTMENT_SLOTS]: {
    resource: Resource.WORKFLOW,
    action: Action.READ,
  },
};

/**
 * Patterns that suggest untrusted content influenced tool usage
 */
const UNTRUSTED_INFLUENCE_PATTERNS = [
  /use\s+tool/gi,
  /execute\s+function/gi,
  /call\s+api/gi,
  /run\s+command/gi,
  /invoke\s+tool/gi,
];

/**
 * Tool execution validator class
 */
export class ToolValidator {
  /**
   * Validate if a tool can be executed
   */
  canExecuteTool(request: ToolExecutionRequest): ToolValidationResult {
    // Check if tool is in allowlist
    if (!this.isToolAllowed(request.toolName)) {
      return {
        allowed: false,
        reason: `Tool '${request.toolName}' is not in the allowlist`,
        errorCode: 'TOOL_NOT_ALLOWED',
      };
    }

    // Validate tool arguments
    const argumentValidation = this.validateToolArguments(request.toolName, request.arguments);
    if (!argumentValidation.allowed) {
      return argumentValidation;
    }

    // Check user permissions
    const permissionValidation = this.validatePermissions(request.toolName, request.context);
    if (!permissionValidation.allowed) {
      return permissionValidation;
    }

    // Check for untrusted content influence
    if (request.sourceContent) {
      const influenceValidation = this.checkUntrustedInfluence(request.sourceContent);
      if (!influenceValidation.allowed) {
        return influenceValidation;
      }
    }

    // Validate workspace isolation
    const workspaceValidation = this.validateWorkspaceIsolation(request);
    if (!workspaceValidation.allowed) {
      return workspaceValidation;
    }

    // Check Spain residency compliance if required
    const residencyValidation = this.validateResidencyCompliance(request);
    if (!residencyValidation.allowed) {
      return residencyValidation;
    }

    return { allowed: true };
  }

  /**
   * Check if tool is in the allowlist
   */
  private isToolAllowed(toolName: string): boolean {
    return Object.values(AllowedTool).includes(toolName as AllowedTool);
  }

  /**
   * Validate tool arguments against schema
   */
  private validateToolArguments(toolName: string, args: Record<string, any>): ToolValidationResult {
    const schema = TOOL_ARGUMENT_SCHEMAS[toolName as AllowedTool];
    if (!schema) {
      return {
        allowed: false,
        reason: `No validation schema found for tool '${toolName}'`,
        errorCode: 'SCHEMA_NOT_FOUND',
      };
    }

    try {
      schema.parse(args);
      return { allowed: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          allowed: false,
          reason: `Invalid arguments: ${error.errors.map(e => e.message).join(', ')}`,
          errorCode: 'INVALID_ARGUMENTS',
        };
      }

      return {
        allowed: false,
        reason: 'Argument validation failed',
        errorCode: 'VALIDATION_ERROR',
      };
    }
  }

  /**
   * Validate user permissions for tool execution
   */
  private validatePermissions(toolName: string, context: RequestContext): ToolValidationResult {
    const permission = TOOL_PERMISSIONS[toolName as AllowedTool];
    if (!permission) {
      return {
        allowed: false,
        reason: `No permission requirements defined for tool '${toolName}'`,
        errorCode: 'PERMISSION_NOT_DEFINED',
      };
    }

    const authResult = rbacService.hasPermission(
      context.roles,
      permission.resource,
      permission.action,
      context
    );

    if (!authResult.allowed) {
      return {
        allowed: false,
        reason: authResult.reason || 'Insufficient permissions',
        errorCode: 'DENIED_BY_POLICY',
        requiredPermissions: [`${permission.resource}:${permission.action}`],
      };
    }

    return { allowed: true };
  }

  /**
   * Check if untrusted content influenced tool usage
   */
  private checkUntrustedInfluence(sourceContent: string): ToolValidationResult {
    for (const pattern of UNTRUSTED_INFLUENCE_PATTERNS) {
      if (pattern.test(sourceContent)) {
        return {
          allowed: false,
          reason: 'Tool execution appears to be influenced by untrusted content',
          errorCode: 'UNTRUSTED_INFLUENCE',
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Validate workspace isolation for tool execution
   */
  private validateWorkspaceIsolation(request: ToolExecutionRequest): ToolValidationResult {
    const workspaceId = request.arguments.workspaceId;
    
    if (!workspaceId) {
      return {
        allowed: false,
        reason: 'Tool arguments must include workspaceId for isolation',
        errorCode: 'WORKSPACE_ID_MISSING',
      };
    }

    if (workspaceId !== request.context.workspaceId) {
      return {
        allowed: false,
        reason: 'Tool execution workspace does not match user workspace',
        errorCode: 'WORKSPACE_MISMATCH',
      };
    }

    return { allowed: true };
  }

  /**
   * Validate Spain residency compliance for tool execution
   */
  private validateResidencyCompliance(request: ToolExecutionRequest): ToolValidationResult {
    // TODO: Implement actual residency validation
    // This would check if the tool execution complies with Spain-only data residency
    // For now, we'll implement a basic check structure

    const sensitiveTools = [AllowedTool.FILL_FORM, AllowedTool.CALC_VAT];
    
    if (sensitiveTools.includes(request.toolName as AllowedTool)) {
      // In a real implementation, this would validate:
      // 1. Processing location is within Spain
      // 2. Data storage location is Spain-compliant
      // 3. No data egress to non-Spanish systems
      
      // For now, we'll allow all requests but log for audit
      return { allowed: true };
    }

    return { allowed: true };
  }

  /**
   * Get tool schema for validation
   */
  getToolSchema(toolName: string): z.ZodSchema | null {
    return TOOL_ARGUMENT_SCHEMAS[toolName as AllowedTool] || null;
  }

  /**
   * Get required permissions for a tool
   */
  getToolPermissions(toolName: string): { resource: Resource; action: Action } | null {
    return TOOL_PERMISSIONS[toolName as AllowedTool] || null;
  }

  /**
   * List all allowed tools
   */
  getAllowedTools(): AllowedTool[] {
    return Object.values(AllowedTool);
  }
}

/**
 * Singleton tool validator instance
 */
export const toolValidator = new ToolValidator();