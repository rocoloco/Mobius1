/**
 * Fastify Type Declarations
 * Extends Fastify types with custom decorations
 */

import { PrismaClient } from '@prisma/client';
import { PipesHubService } from '../pipeshub/service.js';
import { TemplateManager, WorkflowEngine } from '../template-layer/index.js';
import type { RuntimeAPI } from '../runtime/index.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: PrismaClient;
    pipesHub: PipesHubService;
    templateManager: TemplateManager;
    workflowEngine: WorkflowEngine;
    runtime: RuntimeAPI;
    authenticate: any; // JWT authentication hook
  }
}