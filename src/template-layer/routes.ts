/**
 * Template Layer API Routes
 * 
 * REST API endpoints for workflow template management and execution
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient, WorkflowCategory } from '@prisma/client';
import { TemplateManager } from './templateManager.js';
import { WorkflowEngine } from './workflowEngine.js';
import { WorkflowProcessor } from './workflowProcessor.js';
import { FormGenerator } from './formGenerator.js';
import { TemplateError, WorkflowExecutionError, Modelo303Data, NIETIEApplicationData } from './types.js';

interface TemplateRouteParams {
  templateId: string;
}

interface ExecutionRouteParams {
  executionId: string;
}

interface StartExecutionBody {
  templateId: string;
  inputData: Record<string, any>;
  correlationId?: string;
}

interface ValidateDataBody {
  templateId: string;
  data: Record<string, any>;
}

/**
 * Register template layer routes
 */
export async function registerTemplateRoutes(
  fastify: FastifyInstance,
  templateManager: TemplateManager,
  workflowEngine: WorkflowEngine,
  workflowProcessor?: WorkflowProcessor
): Promise<void> {
  
  // Get all templates
  fastify.get('/templates', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const templates = templateManager.getAllTemplates();
      return {
        templates,
        count: templates.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      reply.status(500);
      return {
        error: 'Failed to retrieve templates',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Get template by ID
  fastify.get<{ Params: TemplateRouteParams }>('/templates/:templateId', 
    async (request: FastifyRequest<{ Params: TemplateRouteParams }>, reply: FastifyReply) => {
      try {
        const { templateId } = request.params;
        const template = templateManager.getTemplate(templateId);
        
        if (!template) {
          reply.status(404);
          return {
            error: 'Template not found',
            templateId
          };
        }
        
        return {
          template,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        reply.status(500);
        return {
          error: 'Failed to retrieve template',
          message: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  );

  // Get templates by category
  fastify.get<{ Params: { category: WorkflowCategory } }>('/templates/category/:category',
    async (request: FastifyRequest<{ Params: { category: WorkflowCategory } }>, reply: FastifyReply) => {
      try {
        const { category } = request.params;
        const templates = templateManager.getTemplatesByCategory(category);
        
        return {
          templates,
          category,
          count: templates.length,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        reply.status(500);
        return {
          error: 'Failed to retrieve templates by category',
          message: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  );

  // Search templates
  fastify.get<{ Querystring: { q: string } }>('/templates/search',
    async (request: FastifyRequest<{ Querystring: { q: string } }>, reply: FastifyReply) => {
      try {
        const { q } = request.query;
        
        if (!q || q.trim().length === 0) {
          reply.status(400);
          return {
            error: 'Search query is required',
            message: 'Provide a search query using the "q" parameter'
          };
        }
        
        const templates = templateManager.searchTemplates(q);
        
        return {
          templates,
          query: q,
          count: templates.length,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        reply.status(500);
        return {
          error: 'Failed to search templates',
          message: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  );

  // Validate data against template schema
  fastify.post<{ Body: ValidateDataBody }>('/templates/validate',
    async (request: FastifyRequest<{ Body: ValidateDataBody }>, reply: FastifyReply) => {
      try {
        const { templateId, data } = request.body;
        
        if (!templateId || !data) {
          reply.status(400);
          return {
            error: 'Missing required fields',
            message: 'Both templateId and data are required'
          };
        }
        
        const validationResult = await templateManager.validateTemplateData(templateId, data);
        
        return {
          validationResult,
          templateId,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        if (error instanceof TemplateError) {
          reply.status(400);
          return {
            error: error.message,
            code: error.code,
            details: error.details
          };
        }
        
        reply.status(500);
        return {
          error: 'Validation failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  );

  // Start workflow execution
  fastify.post<{ Body: StartExecutionBody }>('/executions',
    async (request: FastifyRequest<{ Body: StartExecutionBody }>, reply: FastifyReply) => {
      try {
        const { templateId, inputData, correlationId } = request.body;
        
        if (!templateId || !inputData) {
          reply.status(400);
          return {
            error: 'Missing required fields',
            message: 'Both templateId and inputData are required'
          };
        }

        // Extract workspace and user from request context
        // In a real implementation, this would come from authentication middleware
        const workspaceId = request.headers['x-workspace-id'] as string || 'default-workspace';
        const userId = request.headers['x-user-id'] as string || 'system-user';
        
        const execution = await workflowEngine.startExecution(
          templateId,
          workspaceId,
          userId,
          inputData,
          correlationId
        );
        
        reply.status(201);
        return {
          execution,
          message: 'Workflow execution started',
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        if (error instanceof TemplateError || error instanceof WorkflowExecutionError) {
          reply.status(400);
          return {
            error: error.message,
            code: error.code,
            details: error instanceof WorkflowExecutionError ? { stepId: error.stepId } : error.details
          };
        }
        
        reply.status(500);
        return {
          error: 'Failed to start execution',
          message: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  );

  // Get execution status
  fastify.get<{ Params: ExecutionRouteParams }>('/executions/:executionId',
    async (request: FastifyRequest<{ Params: ExecutionRouteParams }>, reply: FastifyReply) => {
      try {
        const { executionId } = request.params;
        const execution = await workflowEngine.getExecution(executionId);
        
        if (!execution) {
          reply.status(404);
          return {
            error: 'Execution not found',
            executionId
          };
        }
        
        return {
          execution,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        reply.status(500);
        return {
          error: 'Failed to retrieve execution',
          message: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  );

  // Cancel execution
  fastify.delete<{ Params: ExecutionRouteParams }>('/executions/:executionId',
    async (request: FastifyRequest<{ Params: ExecutionRouteParams }>, reply: FastifyReply) => {
      try {
        const { executionId } = request.params;
        const cancelled = await workflowEngine.cancelExecution(executionId);
        
        if (!cancelled) {
          reply.status(404);
          return {
            error: 'Execution not found or cannot be cancelled',
            executionId
          };
        }
        
        return {
          message: 'Execution cancelled successfully',
          executionId,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        reply.status(500);
        return {
          error: 'Failed to cancel execution',
          message: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  );

  // Get execution metrics
  fastify.get<{ Params: ExecutionRouteParams }>('/executions/:executionId/metrics',
    async (request: FastifyRequest<{ Params: ExecutionRouteParams }>, reply: FastifyReply) => {
      try {
        const { executionId } = request.params;
        const metrics = workflowEngine.getExecutionMetrics(executionId);
        
        if (!metrics) {
          reply.status(404);
          return {
            error: 'Execution metrics not found',
            executionId
          };
        }
        
        return {
          metrics,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        reply.status(500);
        return {
          error: 'Failed to retrieve execution metrics',
          message: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  );

  // Get template statistics
  fastify.get('/templates/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const statistics = templateManager.getStatistics();
      
      return {
        statistics,
        activeExecutions: workflowEngine.getActiveExecutionsCount(),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      reply.status(500);
      return {
        error: 'Failed to retrieve statistics',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Reload templates from disk
  fastify.post('/templates/reload', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await templateManager.reloadTemplates();
      
      return {
        message: 'Templates reloaded successfully',
        count: templateManager.getAllTemplates().length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      reply.status(500);
      return {
        error: 'Failed to reload templates',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Health check for template layer
  fastify.get('/templates/health', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const templateCount = templateManager.getAllTemplates().length;
      const activeExecutions = workflowEngine.getActiveExecutionsCount();
      
      return {
        status: 'healthy',
        templateCount,
        activeExecutions,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      reply.status(503);
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  });

  // Spanish Administrative Form Automation Routes
  if (workflowProcessor) {
    
    // Process Modelo 303 VAT return
    fastify.post<{ Body: { workspaceId: string; data: Modelo303Data; options?: any } }>('/forms/modelo-303/process',
      async (request: FastifyRequest<{ Body: { workspaceId: string; data: Modelo303Data; options?: any } }>, reply: FastifyReply) => {
        try {
          const { workspaceId, data, options = {} } = request.body;
          const userId = request.headers['x-user-id'] as string || 'system-user';

          const result = await workflowProcessor.processModelo303(workspaceId, userId, data, options);

          if (!result.success) {
            reply.status(400);
            return {
              error: 'Modelo 303 processing failed',
              details: result.validationErrors,
              result
            };
          }

          return {
            result,
            message: 'Modelo 303 processed successfully',
            timestamp: new Date().toISOString()
          };
        } catch (error) {
          reply.status(500);
          return {
            error: 'Failed to process Modelo 303',
            message: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }
    );

    // Process NIE/TIE application
    fastify.post<{ Body: { workspaceId: string; data: NIETIEApplicationData; options?: any } }>('/forms/nie-tie/process',
      async (request: FastifyRequest<{ Body: { workspaceId: string; data: NIETIEApplicationData; options?: any } }>, reply: FastifyReply) => {
        try {
          const { workspaceId, data, options = {} } = request.body;
          const userId = request.headers['x-user-id'] as string || 'system-user';

          const result = await workflowProcessor.processNIETIEApplication(workspaceId, userId, data, options);

          if (!result.success) {
            reply.status(400);
            return {
              error: 'NIE/TIE processing failed',
              details: result.validationErrors,
              result
            };
          }

          return {
            result,
            message: 'NIE/TIE application processed successfully',
            timestamp: new Date().toISOString()
          };
        } catch (error) {
          reply.status(500);
          return {
            error: 'Failed to process NIE/TIE application',
            message: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }
    );

    // Get processing statistics
    fastify.get<{ Params: { workspaceId: string } }>('/forms/statistics/:workspaceId',
      async (request: FastifyRequest<{ Params: { workspaceId: string } }>, reply: FastifyReply) => {
        try {
          const stats = await workflowProcessor.getProcessingStatistics(request.params.workspaceId);
          return {
            statistics: stats,
            timestamp: new Date().toISOString()
          };
        } catch (error) {
          reply.status(500);
          return {
            error: 'Failed to retrieve processing statistics',
            message: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }
    );
  }

  // Generate Modelo 303 form only (no workflow processor needed)
  fastify.post<{ Body: Modelo303Data }>('/forms/modelo-303/generate',
    async (request: FastifyRequest<{ Body: Modelo303Data }>, reply: FastifyReply) => {
      try {
        const result = FormGenerator.generateModelo303(request.body);

        if (!result.success) {
          reply.status(400);
          return {
            error: 'Form generation failed',
            details: result.validationErrors,
            result
          };
        }

        return {
          result,
          message: 'Modelo 303 form generated successfully',
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        reply.status(500);
        return {
          error: 'Failed to generate Modelo 303 form',
          message: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  );

  // Generate NIE/TIE application form only
  fastify.post<{ Body: NIETIEApplicationData }>('/forms/nie-tie/generate',
    async (request: FastifyRequest<{ Body: NIETIEApplicationData }>, reply: FastifyReply) => {
      try {
        const result = FormGenerator.generateNIETIEApplication(request.body);

        if (!result.success) {
          reply.status(400);
          return {
            error: 'Form generation failed',
            details: result.validationErrors,
            result
          };
        }

        return {
          result,
          message: 'NIE/TIE application form generated successfully',
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        reply.status(500);
        return {
          error: 'Failed to generate NIE/TIE application form',
          message: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  );

  // Validate form completeness
  fastify.post<{ Params: { type: 'modelo-303' | 'nie-tie' }; Body: Record<string, any> }>('/forms/:type/validate-completeness',
    async (request: FastifyRequest<{ Params: { type: 'modelo-303' | 'nie-tie' }; Body: Record<string, any> }>, reply: FastifyReply) => {
      try {
        const formType = request.params.type === 'modelo-303' ? 'modelo_303' : 'nie_tie_application';
        const result = FormGenerator.validateFormCompleteness(request.body, formType);

        return {
          validation: result,
          formType: request.params.type,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        reply.status(500);
        return {
          error: 'Failed to validate form completeness',
          message: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  );
}