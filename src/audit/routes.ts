/**
 * Audit Routes
 * REST API endpoints for audit event querying and management
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { auditService, AuditEventType, AuditSeverity } from './service.js';
import { authMiddleware } from '../auth/middleware.js';
import { UserRole } from '../auth/types.js';
import type { AuthenticatedRequest } from '../auth/middleware.js';

/**
 * Query parameters schema for audit events
 */
const auditQuerySchema = z.object({
  eventTypes: z.string().optional().transform(val => 
    val ? val.split(',').map(t => t.trim() as AuditEventType) : undefined
  ),
  severity: z.string().optional().transform(val => 
    val ? val.split(',').map(s => s.trim() as AuditSeverity) : undefined
  ),
  correlationId: z.string().optional(),
  resourceId: z.string().optional(),
  userId: z.string().optional(),
  dateFrom: z.string().optional().transform(val => val ? new Date(val) : undefined),
  dateTo: z.string().optional().transform(val => val ? new Date(val) : undefined),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * Statistics query schema
 */
const statisticsQuerySchema = z.object({
  dateFrom: z.string().optional().transform(val => val ? new Date(val) : undefined),
  dateTo: z.string().optional().transform(val => val ? new Date(val) : undefined),
});

/**
 * Integrity validation schema
 */
const integrityQuerySchema = z.object({
  dateFrom: z.string().transform(val => new Date(val)),
  dateTo: z.string().transform(val => new Date(val)),
});

/**
 * Register audit routes
 */
export async function auditRoutes(fastify: FastifyInstance) {
  // Apply authentication middleware to all audit routes
  await fastify.register(async function auditRoutesPlugin(fastify) {
    // Require manager or admin role for audit access
    fastify.addHook('preHandler', authMiddleware.managerOrAdmin);

    /**
     * GET /audit/events - Query audit events
     */
    fastify.get('/events', {
      schema: {
        description: 'Query audit events with filters',
        tags: ['audit'],
        querystring: {
          type: 'object',
          properties: {
            eventTypes: { type: 'string', description: 'Comma-separated event types' },
            severity: { type: 'string', description: 'Comma-separated severity levels' },
            correlationId: { type: 'string', description: 'Correlation ID for tracing' },
            resourceId: { type: 'string', description: 'Resource identifier' },
            userId: { type: 'string', description: 'User identifier' },
            dateFrom: { type: 'string', format: 'date-time', description: 'Start date' },
            dateTo: { type: 'string', format: 'date-time', description: 'End date' },
            limit: { type: 'integer', minimum: 1, maximum: 1000, default: 100 },
            offset: { type: 'integer', minimum: 0, default: 0 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              events: { type: 'array' },
              total: { type: 'integer' },
              limit: { type: 'integer' },
              offset: { type: 'integer' },
            },
          },
        },
      },
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      const authRequest = request as AuthenticatedRequest;
      
      try {
        const query = auditQuerySchema.parse(request.query);
        
        // Ensure workspace isolation - users can only see their workspace events
        const filters = {
          ...query,
          workspaceId: authRequest.context.workspaceId,
        };

        const events = await auditService.queryEvents(filters);
        
        // Get total count for pagination
        const totalFilters = { ...filters };
        delete totalFilters.limit;
        delete totalFilters.offset;
        const allEvents = await auditService.queryEvents(totalFilters);
        
        reply.send({
          events,
          total: allEvents.length,
          limit: query.limit,
          offset: query.offset,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          reply.status(400).send({
            error: 'Invalid query parameters',
            details: error.errors,
          });
        } else {
          request.log.error('Failed to query audit events:', error);
          reply.status(500).send({
            error: 'Failed to query audit events',
          });
        }
      }
    });

    /**
     * GET /audit/events/:correlationId - Get events by correlation ID
     */
    fastify.get('/events/:correlationId', {
      schema: {
        description: 'Get all events for a correlation ID (distributed tracing)',
        tags: ['audit'],
        params: {
          type: 'object',
          properties: {
            correlationId: { type: 'string' },
          },
          required: ['correlationId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              events: { type: 'array' },
              correlationId: { type: 'string' },
            },
          },
        },
      },
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      const authRequest = request as AuthenticatedRequest;
      const { correlationId } = request.params as { correlationId: string };
      
      try {
        const events = await auditService.getEventsByCorrelation(correlationId);
        
        // Filter events to only include those from the user's workspace
        const workspaceEvents = events.filter(event => 
          event.workspaceId === authRequest.context.workspaceId
        );
        
        reply.send({
          events: workspaceEvents,
          correlationId,
        });
      } catch (error) {
        request.log.error('Failed to get events by correlation ID:', error);
        reply.status(500).send({
          error: 'Failed to get events by correlation ID',
        });
      }
    });

    /**
     * GET /audit/statistics - Get audit statistics
     */
    fastify.get('/statistics', {
      schema: {
        description: 'Get audit statistics for the workspace',
        tags: ['audit'],
        querystring: {
          type: 'object',
          properties: {
            dateFrom: { type: 'string', format: 'date-time' },
            dateTo: { type: 'string', format: 'date-time' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              totalEvents: { type: 'integer' },
              eventsByType: { type: 'object' },
              eventsBySeverity: { type: 'object' },
              violationCount: { type: 'integer' },
              complianceScore: { type: 'number' },
              timeRange: {
                type: 'object',
                properties: {
                  from: { type: 'string', format: 'date-time' },
                  to: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      const authRequest = request as AuthenticatedRequest;
      
      try {
        const query = statisticsQuerySchema.parse(request.query);
        
        const statistics = await auditService.getStatistics(
          authRequest.context.workspaceId,
          query.dateFrom,
          query.dateTo
        );
        
        reply.send(statistics);
      } catch (error) {
        if (error instanceof z.ZodError) {
          reply.status(400).send({
            error: 'Invalid query parameters',
            details: error.errors,
          });
        } else {
          request.log.error('Failed to get audit statistics:', error);
          reply.status(500).send({
            error: 'Failed to get audit statistics',
          });
        }
      }
    });

    /**
     * POST /audit/validate-integrity - Validate audit trail integrity
     */
    fastify.post('/validate-integrity', {
      schema: {
        description: 'Validate audit trail integrity for a date range',
        tags: ['audit'],
        body: {
          type: 'object',
          properties: {
            dateFrom: { type: 'string', format: 'date-time' },
            dateTo: { type: 'string', format: 'date-time' },
          },
          required: ['dateFrom', 'dateTo'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              valid: { type: 'boolean' },
              issues: { type: 'array', items: { type: 'string' } },
              eventCount: { type: 'integer' },
            },
          },
        },
      },
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      const authRequest = request as AuthenticatedRequest;
      
      // Only admins can validate integrity
      if (!authRequest.context.roles.includes(UserRole.ADMIN)) {
        reply.status(403).send({
          error: 'Admin role required for integrity validation',
        });
        return;
      }
      
      try {
        const body = integrityQuerySchema.parse(request.body);
        
        const result = await auditService.validateIntegrity(
          authRequest.context.workspaceId,
          body.dateFrom,
          body.dateTo
        );
        
        reply.send(result);
      } catch (error) {
        if (error instanceof z.ZodError) {
          reply.status(400).send({
            error: 'Invalid request body',
            details: error.errors,
          });
        } else {
          request.log.error('Failed to validate audit integrity:', error);
          reply.status(500).send({
            error: 'Failed to validate audit integrity',
          });
        }
      }
    });

    /**
     * DELETE /audit/cleanup - Clean up old audit events (admin only)
     */
    fastify.delete('/cleanup', {
      schema: {
        description: 'Clean up old audit events based on retention policy',
        tags: ['audit'],
        response: {
          200: {
            type: 'object',
            properties: {
              deletedCount: { type: 'integer' },
              message: { type: 'string' },
            },
          },
        },
      },
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      const authRequest = request as AuthenticatedRequest;
      
      // Only admins can perform cleanup
      if (!authRequest.context.roles.includes(UserRole.ADMIN)) {
        reply.status(403).send({
          error: 'Admin role required for audit cleanup',
        });
        return;
      }
      
      try {
        const result = await auditService.cleanupOldEvents();
        
        reply.send({
          deletedCount: result.deletedCount,
          message: `Successfully cleaned up ${result.deletedCount} old audit events`,
        });
      } catch (error) {
        request.log.error('Failed to cleanup audit events:', error);
        reply.status(500).send({
          error: 'Failed to cleanup audit events',
        });
      }
    });

    /**
     * GET /audit/event-types - Get available event types
     */
    fastify.get('/event-types', {
      schema: {
        description: 'Get list of available audit event types',
        tags: ['audit'],
        response: {
          200: {
            type: 'object',
            properties: {
              eventTypes: { type: 'array', items: { type: 'string' } },
              severityLevels: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      reply.send({
        eventTypes: Object.values(AuditEventType),
        severityLevels: Object.values(AuditSeverity),
      });
    });

    /**
     * GET /audit/health - Audit system health check
     */
    fastify.get('/health', {
      schema: {
        description: 'Check audit system health',
        tags: ['audit'],
        response: {
          200: {
            type: 'object',
            properties: {
              healthy: { type: 'boolean' },
              status: { type: 'string' },
              lastEventTime: { type: 'string', format: 'date-time' },
              eventCount24h: { type: 'integer' },
            },
          },
        },
      },
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      const authRequest = request as AuthenticatedRequest;
      
      try {
        // Get recent events to check system health
        const last24h = new Date();
        last24h.setHours(last24h.getHours() - 24);
        
        const recentEvents = await auditService.queryEvents({
          workspaceId: authRequest.context.workspaceId,
          dateFrom: last24h,
          limit: 1000,
        });
        
        const lastEvent = recentEvents[0];
        
        reply.send({
          healthy: true,
          status: 'operational',
          lastEventTime: lastEvent?.timestamp || null,
          eventCount24h: recentEvents.length,
        });
      } catch (error) {
        request.log.error('Audit health check failed:', error);
        reply.status(500).send({
          healthy: false,
          status: 'error',
          lastEventTime: null,
          eventCount24h: 0,
        });
      }
    });
  });
}