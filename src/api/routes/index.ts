/**
 * API Routes Index
 * Central registration point for all API routes
 */

import type { FastifyInstance } from 'fastify';
import { registerAuthRoutes } from '../../auth/index.js';
import { pipesHubRoutes } from '../../pipeshub/routes.js';
import { registerTemplateRoutes } from '../../template-layer/routes.js';
import { registerRuntimeRoutes } from '../../runtime/routes.js';
import { complianceRoutes } from '../../compliance/routes.js';

/**
 * Register all v1 API routes
 */
export async function registerV1Routes(fastify: FastifyInstance) {
  // Authentication routes (no /api/v1 prefix, at root level)
  await registerAuthRoutes(fastify);

  // API v1 routes
  await fastify.register(async (api) => {
    // Documents/PipesHub routes
    await api.register(pipesHubRoutes, { prefix: '/documents' });

    // Template Layer routes
    await api.register(async (templates) => {
      const templateManager = fastify.templateManager;
      const workflowEngine = fastify.workflowEngine;
      await registerTemplateRoutes(templates, templateManager, workflowEngine);
    }, { prefix: '/templates' });

    // Runtime Layer routes
    await api.register(registerRuntimeRoutes);

    // Compliance routes
    await api.register(complianceRoutes, { prefix: '/compliance' });
  }, { prefix: '/api/v1' });
}
