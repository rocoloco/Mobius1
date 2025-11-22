/**
 * Gateway Chat Routes
 * Handles AI model requests with policy enforcement and security controls
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { gatewayService, type AIModelRequest } from '../service.js';
import { authMiddleware, type AuthenticatedRequest } from '../../auth/middleware.js';

/**
 * Chat request schema
 */
const ChatRequestSchema = z.object({
  prompt: z.string().min(1).max(50000),
  systemPrompt: z.string().optional(),
  untrustedContent: z.array(z.string()).optional(),
  maxTokens: z.number().int().positive().max(4000).optional(),
  temperature: z.number().min(0).max(2).optional(),
});

type ChatRequest = z.infer<typeof ChatRequestSchema>;

/**
 * Chat response schema
 */
interface ChatResponse {
  response: string;
  tokensUsed: number;
  processingTimeMs: number;
  sanitizationApplied: boolean;
  canaryDetected: boolean;
  correlationId: string;
}

/**
 * Register chat routes
 */
export async function registerChatRoutes(fastify: FastifyInstance): Promise<void> {
  
  /**
   * POST /gateway/chat
   * Process AI model request through security pipeline
   */
  fastify.post<{
    Body: ChatRequest;
  }>('/gateway/chat', {
    preHandler: authMiddleware.full,
    schema: {
      body: {
        type: 'object',
        properties: {
          prompt: { type: 'string', minLength: 1, maxLength: 50000 },
          systemPrompt: { type: 'string' },
          untrustedContent: {
            type: 'array',
            items: { type: 'string' },
          },
          maxTokens: { type: 'number', minimum: 1, maximum: 4000 },
          temperature: { type: 'number', minimum: 0, maximum: 2 },
        },
        required: ['prompt'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            response: { type: 'string' },
            tokensUsed: { type: 'number' },
            processingTimeMs: { type: 'number' },
            sanitizationApplied: { type: 'boolean' },
            canaryDetected: { type: 'boolean' },
            correlationId: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: ChatRequest }>, reply: FastifyReply) => {
    const startTime = Date.now();
    const authRequest = request as AuthenticatedRequest;
    const { prompt, systemPrompt, untrustedContent, maxTokens, temperature } = request.body;

    try {
      // Build AI model request
      const aiRequest: AIModelRequest = {
        prompt,
        systemPrompt,
        context: authRequest.context,
        untrustedContent,
        maxTokens,
        temperature,
      };

      // Process through gateway security pipeline
      const processingResult = await gatewayService.processRequest(aiRequest);

      if (processingResult.blocked) {
        reply.status(400).send({
          error: 'Request blocked by security policy',
          reason: processingResult.blockReason,
          correlationId: authRequest.context.correlationId,
        });
        return;
      }

      // Add OpenTelemetry attributes for monitoring
      const sanitizationApplied = processingResult.sanitizationResults.some(r => r.removalsCount > 0);
      const totalRemovals = processingResult.sanitizationResults.reduce((sum, r) => sum + r.removalsCount, 0);

      // Set telemetry attributes (would integrate with actual OpenTelemetry)
      request.log.info({
        'prompt_injection.sanitized': sanitizationApplied,
        'prompt_injection.removals_total': totalRemovals,
        correlationId: authRequest.context.correlationId,
      }, 'Gateway processing telemetry');

      // TODO: Integrate with actual AI model service
      // For now, simulate AI response
      const mockResponse = await simulateAIResponse(processingResult.processedPrompt);

      // Validate response doesn't contain canary secrets
      const responseValid = gatewayService.validateResponse(mockResponse.response, authRequest.context);
      
      if (!responseValid) {
        reply.status(500).send({
          error: 'Response validation failed',
          correlationId: authRequest.context.correlationId,
        });
        return;
      }

      const processingTimeMs = Date.now() - startTime;

      const response: ChatResponse = {
        response: mockResponse.response,
        tokensUsed: mockResponse.tokensUsed,
        processingTimeMs,
        sanitizationApplied,
        canaryDetected: false, // Would be set based on actual canary detection
        correlationId: authRequest.context.correlationId,
      };

      reply.send(response);

    } catch (error) {
      request.log.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId: authRequest.context.correlationId,
      }, 'Gateway chat processing error');

      reply.status(500).send({
        error: 'Internal server error',
        correlationId: authRequest.context.correlationId,
      });
    }
  });

  /**
   * POST /gateway/chat/validate
   * Validate prompt without processing (for testing)
   */
  fastify.post<{
    Body: { prompt: string; untrustedContent?: string[] };
  }>('/gateway/chat/validate', {
    preHandler: authMiddleware.required,
    schema: {
      body: {
        type: 'object',
        properties: {
          prompt: { type: 'string', minLength: 1, maxLength: 50000 },
          untrustedContent: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['prompt'],
      },
    },
  }, async (request: FastifyRequest<{ Body: { prompt: string; untrustedContent?: string[] } }>, reply: FastifyReply) => {
    const authRequest = request as AuthenticatedRequest;
    const { prompt, untrustedContent } = request.body;

    try {
      const aiRequest: AIModelRequest = {
        prompt,
        context: authRequest.context,
        untrustedContent,
      };

      const processingResult = await gatewayService.processRequest(aiRequest);

      reply.send({
        valid: !processingResult.blocked,
        blocked: processingResult.blocked,
        blockReason: processingResult.blockReason,
        sanitizationResults: processingResult.sanitizationResults,
        toolValidations: processingResult.toolValidations,
        correlationId: authRequest.context.correlationId,
      });

    } catch (error) {
      request.log.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId: authRequest.context.correlationId,
      }, 'Gateway validation error');

      reply.status(500).send({
        error: 'Validation failed',
        correlationId: authRequest.context.correlationId,
      });
    }
  });
}

/**
 * Simulate AI response (placeholder for actual AI integration)
 */
async function simulateAIResponse(prompt: string): Promise<{ response: string; tokensUsed: number }> {
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 100));

  // Generate mock response based on prompt content
  let response = 'I understand you need help with Spanish administrative processes. ';
  
  if (prompt.toLowerCase().includes('modelo 303')) {
    response += 'For Modelo 303 (VAT return), you need to submit quarterly declarations. The key information required includes your VAT number, period covered, and detailed breakdown of taxable operations.';
  } else if (prompt.toLowerCase().includes('nie') || prompt.toLowerCase().includes('tie')) {
    response += 'For NIE/TIE applications, you need to schedule an appointment at the immigration office, prepare required documentation including passport, application form, and proof of purpose for residence.';
  } else if (prompt.toLowerCase().includes('empadronamiento')) {
    response += 'For empadronamiento (municipal registration), visit your local town hall with proof of residence, identification documents, and completed application form.';
  } else {
    response += 'I can help you with various Spanish administrative procedures including tax forms, residency applications, and municipal registrations. Please provide more specific details about what you need assistance with.';
  }

  return {
    response,
    tokensUsed: Math.floor(response.length / 4), // Rough token estimation
  };
}