
/**
 * Mobius 1 Platform - Main Application Entry Point
 * Sovereign AI infrastructure platform for Spanish gestorías and expat agencies
 */

import Fastify from 'fastify';

import { appConfig, isDevelopment } from './config/index.js';
import { healthCheckService } from './health/index.js';
import { db } from './database/client.js';
import { registerAuthRoutes } from './auth/index.js';
import { controlPlaneOrchestrator } from './control-plane/index.js';
import { PipesHubService } from './pipeshub/index.js';
import { pipesHubRoutes } from './pipeshub/routes.js';
import { TemplateManager, WorkflowEngine } from './template-layer/index.js';
import { registerTemplateRoutes } from './template-layer/routes.js';
import { RuntimeFactory } from './runtime/index.js';
import { registerRuntimeRoutes } from './runtime/routes.js';
import { complianceRoutes } from './compliance/routes.js';

/**
 * Create and configure Fastify application
 */
const app = Fastify({
  logger: {
    level: appConfig.logging.level,
    redact: appConfig.logging.redactPII ? ['req.headers.authorization', 'req.body.password'] : [],
  },
});

// Add database to Fastify instance for use in routes
app.decorate('db', db);

// Initialize PipesHub service
const pipesHubService = new PipesHubService(db, {
  endpoint: appConfig.minio.endpoint,
  port: appConfig.minio.port,
  accessKey: appConfig.minio.accessKey,
  secretKey: appConfig.minio.secretKey,
  useSSL: appConfig.minio.useSSL,
  bucketName: 'mobius1v3-documents'
});

// Initialize Template Layer services
const templateManager = new TemplateManager();
const workflowEngine = new WorkflowEngine(db, templateManager);

// Initialize Runtime Layer
const runtime = RuntimeFactory.getInstance(appConfig);

// Add services to Fastify instance
app.decorate('pipesHub', pipesHubService);
app.decorate('templateManager', templateManager);
app.decorate('workflowEngine', workflowEngine);
app.decorate('runtime', runtime);

/**
 * Health check endpoint
 * Provides comprehensive system health status
 */
app.get('/health', async (request, reply) => {
  try {
    const health = await healthCheckService.checkSystemHealth();
    
    // Set appropriate HTTP status based on health
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;
    
    reply.status(statusCode);
    return health;
  } catch (error) {
    app.log.error({ error }, 'Health check failed');
    reply.status(503);
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      uptime: process.uptime(),
    };
  }
});

/**
 * Basic readiness check
 * Simple endpoint for load balancer health checks
 */
app.get('/ready', async () => {
  return { ready: true, timestamp: new Date().toISOString() };
});

/**
 * Application info endpoint
 */
app.get('/info', async () => {
  return {
    name: 'Mobius 1 Platform',
    version: '1.0.0',
    environment: appConfig.app.nodeEnv,
    spainResidencyMode: appConfig.compliance.spainResidencyMode,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };
});

/**
 * Control Plane status endpoint
 * Provides orchestrator status and configuration
 */
app.get('/control-plane/status', async () => {
  const status = controlPlaneOrchestrator.getCurrentStatus();
  const config = controlPlaneOrchestrator.getConfig();
  
  return {
    orchestrator: {
      running: controlPlaneOrchestrator.isOrchestratorRunning(),
      status,
      config: {
        healthCheckInterval: config.healthCheck.interval,
        recoveryEnabled: config.recovery.enabled,
        deploymentTimeout: config.deployment.timeout,
      },
    },
    timestamp: new Date().toISOString(),
  };
});

/**
 * Manual health check endpoint
 * Triggers immediate health check via Control Plane
 */
app.post('/control-plane/health-check', async (request, reply) => {
  try {
    const health = await controlPlaneOrchestrator.performHealthCheck();
    return {
      message: 'Health check completed',
      health,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    reply.status(500);
    return {
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }
});

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal: string) {
  app.log.info(`Received ${signal}, starting graceful shutdown...`);
  
  try {
    // Stop Control Plane Orchestrator
    await controlPlaneOrchestrator.stop();
    app.log.info('Control Plane Orchestrator stopped');
    
    // Shutdown Runtime Layer
    if ('shutdown' in runtime) {
      await (runtime as any).shutdown();
      app.log.info('Runtime Layer shutdown');
    }
    
    // Close Fastify server
    await app.close();
    app.log.info('Fastify server closed');
    
    // Close health check service
    await healthCheckService.cleanup();
    app.log.info('Health check service closed');
    
    // Close database connection
    await db.$disconnect();
    app.log.info('Database connection closed');
    
    app.log.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    app.log.error({ error }, 'Error during graceful shutdown');
    process.exit(1);
  }
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

/**
 * Start the application
 */
async function start() {
  try {
    // Test database connection on startup
    app.log.info('Testing database connection...');
    await db.$queryRaw`SELECT 1`;
    app.log.info('Database connection successful');

    // Start Control Plane Orchestrator
    app.log.info('Starting Control Plane Orchestrator...');
    await controlPlaneOrchestrator.start();
    app.log.info('Control Plane Orchestrator started - health monitoring active');

    // Register authentication routes
    await registerAuthRoutes(app);
    app.log.info('Authentication routes registered');

    // Register PipesHub routes
    await app.register(pipesHubRoutes, { prefix: '/api/v1/pipeshub' });
    app.log.info('PipesHub routes registered');

    // Register Template Layer routes
    await app.register(async (fastify) => {
      await registerTemplateRoutes(fastify, templateManager, workflowEngine);
    }, { prefix: '/api/v1/templates' });
    app.log.info('Template Layer routes registered');

    // Register Runtime Layer routes
    await app.register(registerRuntimeRoutes, { prefix: '/api/v1' });
    app.log.info('Runtime Layer routes registered');

    // Register Compliance routes
    await app.register(complianceRoutes, { prefix: '/api/v1/compliance' });
    app.log.info('Compliance routes registered');

    // Start the server
    await app.listen({
      port: appConfig.app.port,
      host: appConfig.app.host,
    });

    app.log.info(`Mobius 1 Platform listening on ${appConfig.app.host}:${appConfig.app.port}`);
    app.log.info(`Environment: ${appConfig.app.nodeEnv}`);
    app.log.info(`Spain Residency Mode: ${appConfig.compliance.spainResidencyMode}`);
    
    if (isDevelopment()) {
      app.log.info('Development mode - detailed logging enabled');
    }
  } catch (error) {
    app.log.error({ error }, 'Failed to start application');
    process.exit(1);
  }
}

// Start the application
start();
