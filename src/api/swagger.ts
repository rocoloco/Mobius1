/**
 * OpenAPI/Swagger Configuration
 * API documentation and schema definitions
 */

import type { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { appConfig } from '../config/index.js';

/**
 * Register Swagger documentation
 */
export async function registerSwagger(fastify: FastifyInstance) {
  // Register Swagger plugin
  await fastify.register(swagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'Mobius 1 Platform API',
        description: 'Sovereign AI infrastructure platform for Spanish gestorías and expat agencies',
        version: '1.0.0',
        contact: {
          name: 'Mobius 1 Support',
          email: 'support@mobius1.example.com',
        },
        license: {
          name: 'Private',
        },
      },
      servers: [
        {
          url: `http://localhost:${appConfig.app.port}`,
          description: 'Development server',
        },
        {
          url: 'https://api.mobius1.example.com',
          description: 'Production server',
        },
      ],
      tags: [
        { name: 'Authentication', description: 'User authentication and authorization' },
        { name: 'Documents', description: 'Document upload and processing (PipesHub)' },
        { name: 'Templates', description: 'Workflow templates and execution' },
        { name: 'Forms', description: 'Spanish administrative form automation' },
        { name: 'Runtime', description: 'AI model runtime and inference' },
        { name: 'Compliance', description: 'AESIA compliance and audit reporting' },
        { name: 'Health', description: 'System health and monitoring' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT token obtained from /api/v1/auth/login',
          },
        },
        schemas: {
          Error: {
            type: 'object',
            required: ['code', 'message', 'timestamp'],
            properties: {
              code: {
                type: 'string',
                description: 'Machine-readable error code',
                example: 'E001',
              },
              message: {
                type: 'string',
                description: 'Human-readable error message',
                example: 'Validation error',
              },
              details: {
                type: 'object',
                description: 'Additional error details',
              },
              correlationId: {
                type: 'string',
                description: 'Request correlation ID for tracing',
              },
              timestamp: {
                type: 'string',
                format: 'date-time',
                description: 'Error timestamp',
              },
              path: {
                type: 'string',
                description: 'Request path that caused the error',
              },
            },
          },
          SuccessResponse: {
            type: 'object',
            required: ['success', 'timestamp'],
            properties: {
              success: {
                type: 'boolean',
                example: true,
              },
              data: {
                type: 'object',
                description: 'Response data',
              },
              meta: {
                type: 'object',
                description: 'Response metadata (pagination, etc.)',
              },
              timestamp: {
                type: 'string',
                format: 'date-time',
              },
              correlationId: {
                type: 'string',
              },
            },
          },
          PaginationMeta: {
            type: 'object',
            properties: {
              total: {
                type: 'integer',
                description: 'Total number of items',
              },
              limit: {
                type: 'integer',
                description: 'Items per page',
              },
              offset: {
                type: 'integer',
                description: 'Offset from start',
              },
              page: {
                type: 'integer',
                description: 'Current page number',
              },
              totalPages: {
                type: 'integer',
                description: 'Total number of pages',
              },
              hasMore: {
                type: 'boolean',
                description: 'Whether more items exist',
              },
              hasPrevious: {
                type: 'boolean',
                description: 'Whether previous page exists',
              },
            },
          },
        },
      },
      externalDocs: {
        url: 'https://docs.mobius1.example.com',
        description: 'Full documentation',
      },
    },
  });

  // Register Swagger UI
  await fastify.register(swaggerUI, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      syntaxHighlight: {
        activate: true,
        theme: 'monokai',
      },
    },
    staticCSP: true,
    transformStaticCSP: (header: string) => header,
  });
}
