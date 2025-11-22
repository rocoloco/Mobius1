/**
 * Gateway Service
 * Central policy enforcement point for AI model access with security controls
 */

import { randomUUID } from 'crypto';
import { db } from '../database/client.js';
import { promptSanitizer, toolValidator } from './security/index.js';
import type { 
  SanitizationResult, 
  ToolExecutionRequest, 
  ToolValidationResult 
} from './security/index.js';
import type { RequestContext } from '../auth/types.js';

/**
 * AI model request structure
 */
export interface AIModelRequest {
  prompt: string;
  systemPrompt?: string;
  context: RequestContext;
  untrustedContent?: string[];
  toolRequests?: ToolExecutionRequest[];
  maxTokens?: number;
  temperature?: number;
}

/**
 * AI model response structure
 */
export interface AIModelResponse {
  response: string;
  tokensUsed: number;
  processingTimeMs: number;
  sanitizationApplied: boolean;
  toolExecutions: ToolExecutionResult[];
  canaryDetected: boolean;
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  toolName: string;
  success: boolean;
  result?: any;
  error?: string;
  denied?: boolean;
  denyReason?: string;
}

/**
 * Gateway processing result
 */
export interface GatewayProcessingResult {
  processedPrompt: string;
  sanitizationResults: SanitizationResult[];
  toolValidations: ToolValidationResult[];
  canarySecrets: Record<string, string>;
  blocked: boolean;
  blockReason?: string;
}

/**
 * Gateway service class
 */
export class GatewayService {
  private canarySecrets: Record<string, string>;

  constructor() {
    this.canarySecrets = promptSanitizer.generateCanarySecrets();
  }

  /**
   * Process AI model request through security pipeline
   */
  async processRequest(request: AIModelRequest): Promise<GatewayProcessingResult> {
    const startTime = Date.now();
    const correlationId = request.context.correlationId;

    try {
      // Step 1: Sanitize untrusted content
      const sanitizationResults: SanitizationResult[] = [];
      let processedPrompt = request.prompt;

      if (request.untrustedContent && request.untrustedContent.length > 0) {
        for (const content of request.untrustedContent) {
          const sanitizationResult = promptSanitizer.sanitizeContext(content);
          sanitizationResults.push(sanitizationResult);

          // Wrap sanitized content in untrusted markers
          const wrappedContent = promptSanitizer.wrapUntrustedContent(sanitizationResult.sanitizedText);
          processedPrompt += '\n\n' + wrappedContent;

          // Log sanitization if removals occurred
          if (sanitizationResult.removalsCount > 0) {
            await this.logPromptInjectionAttempt(
              request.context,
              'sanitization_applied',
              {
                removalsCount: sanitizationResult.removalsCount,
                removedPatterns: sanitizationResult.removedPatterns,
                truncated: sanitizationResult.truncated,
              }
            );
          }
        }
      }

      // Step 2: Create protected system prompt
      const baseSystemPrompt = request.systemPrompt || 'You are a helpful AI assistant for Spanish administrative processes.';
      const protectedSystemPrompt = promptSanitizer.createProtectedSystemPrompt(baseSystemPrompt);

      // Step 3: Validate tool execution requests
      const toolValidations: ToolValidationResult[] = [];
      if (request.toolRequests && request.toolRequests.length > 0) {
        for (const toolRequest of request.toolRequests) {
          const validation = toolValidator.canExecuteTool(toolRequest);
          toolValidations.push(validation);

          if (!validation.allowed) {
            await this.logPromptInjectionAttempt(
              request.context,
              'tool_execution_denied',
              {
                toolName: toolRequest.toolName,
                reason: validation.reason,
                errorCode: validation.errorCode,
              }
            );
          }
        }
      }

      // Step 4: Check for canary secrets in processed content
      const canariesFound = promptSanitizer.containsCanarySecrets(processedPrompt, this.canarySecrets);
      if (canariesFound.length > 0) {
        await this.logPromptInjectionAttempt(
          request.context,
          'canary_detected',
          {
            canariesFound,
            prompt: processedPrompt.substring(0, 500), // Log first 500 chars for analysis
          }
        );
      }

      // Step 5: Final security check - block if high-risk patterns detected
      const injectionAttempts = promptSanitizer.detectInjectionAttempts(processedPrompt);
      if (injectionAttempts.length > 0) {
        await this.logPromptInjectionAttempt(
          request.context,
          'injection_blocked',
          {
            detectedPatterns: injectionAttempts,
          }
        );

        return {
          processedPrompt: '',
          sanitizationResults,
          toolValidations,
          canarySecrets: this.canarySecrets,
          blocked: true,
          blockReason: 'Potential prompt injection detected',
        };
      }

      // Combine system prompt with processed prompt
      const finalPrompt = `${protectedSystemPrompt}\n\n${processedPrompt}`;

      return {
        processedPrompt: finalPrompt,
        sanitizationResults,
        toolValidations,
        canarySecrets: this.canarySecrets,
        blocked: false,
      };

    } catch (error) {
      // Log processing error
      await this.logPromptInjectionAttempt(
        request.context,
        'processing_error',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      );

      throw error;
    }
  }

  /**
   * Execute validated tools
   */
  async executeTools(toolRequests: ToolExecutionRequest[], validations: ToolValidationResult[]): Promise<ToolExecutionResult[]> {
    const results: ToolExecutionResult[] = [];

    for (let i = 0; i < toolRequests.length; i++) {
      const request = toolRequests[i];
      const validation = validations[i];

      if (!validation.allowed) {
        results.push({
          toolName: request.toolName,
          success: false,
          denied: true,
          denyReason: validation.reason,
        });
        continue;
      }

      try {
        // Execute the tool (placeholder implementation)
        const result = await this.executeTool(request);
        results.push({
          toolName: request.toolName,
          success: true,
          result,
        });
      } catch (error) {
        results.push({
          toolName: request.toolName,
          success: false,
          error: error instanceof Error ? error.message : 'Tool execution failed',
        });
      }
    }

    return results;
  }

  /**
   * Execute individual tool (placeholder implementation)
   */
  private async executeTool(request: ToolExecutionRequest): Promise<any> {
    // TODO: Implement actual tool execution logic
    // This would integrate with the specific tool implementations
    
    switch (request.toolName) {
      case 'fill_form':
        return { formId: randomUUID(), status: 'completed' };
      case 'calc_vat':
        return { totalVat: 1000, period: request.arguments.period };
      case 'fetch_appointment_slots':
        return { slots: [], nextAvailable: new Date() };
      default:
        throw new Error(`Unknown tool: ${request.toolName}`);
    }
  }

  /**
   * Log prompt injection attempts to audit system
   */
  private async logPromptInjectionAttempt(
    context: RequestContext,
    eventType: string,
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      // Use the audit service for comprehensive security event logging
      const { auditService, AuditEventType, AuditSeverity } = await import('../audit/service.js');
      
      await auditService.logSecurityEvent({
        eventType: AuditEventType.PROMPT_INJECTION_ATTEMPT,
        severity: AuditSeverity.ERROR,
        resourceId: 'gateway',
        action: 'prompt_injection_mitigation',
        metadata: {
          subType: eventType,
          timestamp: new Date().toISOString(),
          correlationId: context.correlationId,
          clientIP: context.clientIP,
          userAgent: context.userAgent,
          ...metadata,
        },
        correlationId: context.correlationId,
        workspaceId: context.workspaceId,
        userId: context.userId,
        securityContext: {
          threatType: 'prompt_injection',
          riskLevel: this.mapEventTypeToRiskLevel(eventType),
          mitigationApplied: true,
          additionalDetails: {
            eventType,
            detectionMethod: 'security_pipeline',
            ...metadata,
          },
        },
      });
    } catch (error) {
      console.error('Failed to log prompt injection attempt:', error);
      
      // Fallback to direct database logging
      try {
        await db.auditEvent.create({
          data: {
            workspaceId: context.workspaceId,
            userId: context.userId,
            eventType: 'POLICY_VIOLATION',
            resourceId: 'gateway',
            action: 'prompt_injection_mitigation',
            metadata: {
              subType: eventType,
              timestamp: new Date().toISOString(),
              correlationId: context.correlationId,
              clientIP: context.clientIP,
              userAgent: context.userAgent,
              ...metadata,
            },
            correlationId: context.correlationId,
          },
        });
      } catch (fallbackError) {
        console.error('Failed to log prompt injection attempt (fallback):', fallbackError);
      }
    }
  }

  /**
   * Map event type to risk level for security events
   */
  private mapEventTypeToRiskLevel(eventType: string): 'low' | 'medium' | 'high' | 'critical' {
    switch (eventType) {
      case 'canary_detected':
      case 'injection_blocked':
        return 'critical';
      case 'tool_execution_denied':
        return 'high';
      case 'sanitization_applied':
        return 'medium';
      case 'processing_error':
        return 'low';
      default:
        return 'medium';
    }
  }

  /**
   * Update canary secrets (should be called periodically)
   */
  refreshCanarySecrets(): void {
    this.canarySecrets = promptSanitizer.generateCanarySecrets();
  }

  /**
   * Get current canary secrets for monitoring
   */
  getCanarySecrets(): Record<string, string> {
    return { ...this.canarySecrets };
  }

  /**
   * Check if response contains canary secrets
   */
  validateResponse(response: string, context: RequestContext): boolean {
    const canariesFound = promptSanitizer.containsCanarySecrets(response, this.canarySecrets);
    
    if (canariesFound.length > 0) {
      // Log canary detection in response
      this.logPromptInjectionAttempt(
        context,
        'canary_in_response',
        {
          canariesFound,
          responseLength: response.length,
        }
      );
      return false;
    }

    return true;
  }
}

/**
 * Singleton gateway service instance
 */
export const gatewayService = new GatewayService();