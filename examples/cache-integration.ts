/**
 * Example: Cache Integration
 * 
 * Demonstrates how to integrate Redis caching, model caching,
 * and query caching in Mobius 1 for optimal performance.
 */

import Fastify from 'fastify';
import {
  initializeRedis,
  getRedisClient,
  cacheManager,
  modelCache,
  queryCache,
  CacheKeys,
  DefaultTTL,
} from '../src/cache/index.js';
import { initializeConnectionPool } from '../src/database/connection-pool.js';
import { logger } from '../src/observability/logger.js';

// Initialize Redis
initializeRedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  db: 0,
  keyPrefix: 'mobius1:',
});

// Initialize database connection pool
const prisma = initializeConnectionPool({
  connectionLimit: 10,
  poolTimeout: 10000,
  enableQueryLogging: process.env.NODE_ENV === 'development',
  slowQueryThreshold: 1000,
});

// Configure model cache
modelCache.configure({
  enabled: true,
  ttl: 3600, // 1 hour
  maxInputLength: 10000,
  minConfidence: 0.8,
});

const app = Fastify();

// Connect to Redis on startup
app.addHook('onReady', async () => {
  await getRedisClient().connect();
  logger.info('Redis connected');

  // Warm up cache with frequently accessed data
  await warmUpCache();
});

// Graceful shutdown
app.addHook('onClose', async () => {
  await getRedisClient().disconnect();
  logger.info('Redis disconnected');
});

/**
 * Example 1: API endpoint with cache
 */
app.get('/api/v1/workspaces/:id', async (request, reply) => {
  const { id } = request.params as { id: string };

  const workspace = await cacheManager.getOrSet(
    CacheKeys.workspace(id),
    async () => {
      logger.info('Cache miss, querying database', { workspaceId: id });
      
      return await prisma.workspace.findUnique({
        where: { id },
        include: {
          users: true,
          config: true,
        },
      });
    },
    { ttl: DefaultTTL.medium }
  );

  if (!workspace) {
    return reply.code(404).send({ error: 'Workspace not found' });
  }

  return reply.send(workspace);
});

/**
 * Example 2: Model inference with cache
 */
app.post('/api/v1/inference', async (request, reply) => {
  const { modelId, input, workspaceId } = request.body as {
    modelId: string;
    input: string;
    workspaceId: string;
  };

  // Check cache first
  const cached = await modelCache.get(modelId, input, workspaceId);
  if (cached) {
    logger.info('Model cache hit', { modelId, workspaceId });
    return reply.send({
      output: cached.output,
      cached: true,
      metadata: cached.metadata,
    });
  }

  // Simulate model inference
  logger.info('Model cache miss, running inference', { modelId, workspaceId });
  const startTime = Date.now();
  
  // In production, this would call the actual model
  const output = `Response to: ${input}`;
  const latencyMs = Date.now() - startTime;

  // Cache the result
  await modelCache.set(modelId, input, output, workspaceId, {
    tokens: Math.floor(output.length / 4),
    latencyMs,
    confidence: 0.95,
  });

  return reply.send({
    output,
    cached: false,
    metadata: {
      tokens: Math.floor(output.length / 4),
      latencyMs,
    },
  });
});

/**
 * Example 3: Document list with query cache
 */
app.get('/api/v1/workspaces/:workspaceId/documents', async (request, reply) => {
  const { workspaceId } = request.params as { workspaceId: string };
  const { page = 1, pageSize = 20 } = request.query as {
    page?: number;
    pageSize?: number;
  };

  const documents = await queryCache.cacheList(
    `documents:${workspaceId}`,
    page,
    pageSize,
    async () => {
      logger.info('Query cache miss, fetching documents', { workspaceId, page });
      
      return await prisma.document.findMany({
        where: { workspaceId },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      });
    },
    {
      tags: ['documents', workspaceId],
      ttl: DefaultTTL.medium,
      workspaceId,
    }
  );

  return reply.send({
    documents,
    page,
    pageSize,
    total: documents.length,
  });
});

/**
 * Example 4: Create document with cache invalidation
 */
app.post('/api/v1/workspaces/:workspaceId/documents', async (request, reply) => {
  const { workspaceId } = request.params as { workspaceId: string };
  const data = request.body as any;

  // Create document
  const document = await prisma.document.create({
    data: {
      ...data,
      workspaceId,
    },
  });

  // Invalidate related caches
  await queryCache.invalidateByTag(workspaceId);
  await queryCache.invalidateByTag('documents');

  logger.info('Document created, cache invalidated', {
    documentId: document.id,
    workspaceId,
  });

  return reply.code(201).send(document);
});

/**
 * Example 5: Rate limiting with cache
 */
app.get('/api/v1/rate-limited', async (request, reply) => {
  const userId = (request as any).userId || 'anonymous';
  const limit = 100;
  const windowSeconds = 60;

  const key = CacheKeys.rateLimit(userId, `${windowSeconds}s`);
  const count = await cacheManager.increment(key, { ttl: windowSeconds });

  const remaining = Math.max(0, limit - count);
  const allowed = count <= limit;

  reply.header('X-RateLimit-Limit', limit.toString());
  reply.header('X-RateLimit-Remaining', remaining.toString());
  reply.header('X-RateLimit-Reset', (Date.now() + windowSeconds * 1000).toString());

  if (!allowed) {
    return reply.code(429).send({
      error: 'Rate limit exceeded',
      retryAfter: windowSeconds,
    });
  }

  return reply.send({ message: 'Success', remaining });
});

/**
 * Example 6: Cache statistics endpoint
 */
app.get('/api/v1/cache/stats', async (request, reply) => {
  const stats = await cacheManager.getStats();
  const redisInfo = await getRedisClient().getInfo();

  return reply.send({
    cache: {
      hits: stats.hits,
      misses: stats.misses,
      hitRate: stats.hitRate,
      keys: stats.keys,
      memory: stats.memory,
    },
    redis: {
      connected_clients: redisInfo.connected_clients,
      used_memory_human: redisInfo.used_memory_human,
      uptime_in_seconds: redisInfo.uptime_in_seconds,
    },
  });
});

/**
 * Example 7: Cache invalidation endpoint
 */
app.delete('/api/v1/cache/workspaces/:workspaceId', async (request, reply) => {
  const { workspaceId } = request.params as { workspaceId: string };

  // Invalidate all caches for workspace
  const cacheCount = await cacheManager.invalidateWorkspace(workspaceId);
  const queryCount = await queryCache.invalidateWorkspace(workspaceId);
  const modelCount = await modelCache.invalidateWorkspace(workspaceId);

  logger.info('Workspace cache invalidated', {
    workspaceId,
    cacheCount,
    queryCount,
    modelCount,
  });

  return reply.send({
    message: 'Cache invalidated',
    invalidated: {
      cache: cacheCount,
      queries: queryCount,
      models: modelCount,
      total: cacheCount + queryCount + modelCount,
    },
  });
});

/**
 * Warm up cache with frequently accessed data
 */
async function warmUpCache(): Promise<void> {
  logger.info('Starting cache warm-up');

  try {
    // Warm up templates
    const templates = await prisma.template.findMany({
      where: { popular: true },
      take: 10,
    });

    await cacheManager.warmUp(
      templates.map((t) => ({
        key: CacheKeys.template(t.id),
        value: t,
        ttl: DefaultTTL.day,
      }))
    );

    // Warm up common model queries (Spanish administrative queries)
    const commonQueries = [
      {
        input: '¿Qué es el NIE?',
        output: 'El NIE (Número de Identidad de Extranjero) es un número de identificación único para extranjeros en España.',
      },
      {
        input: '¿Cómo solicitar el TIE?',
        output: 'Para solicitar el TIE (Tarjeta de Identidad de Extranjero), debe presentar su pasaporte, NIE, y documentación que justifique su residencia.',
      },
      {
        input: '¿Qué es el Modelo 303?',
        output: 'El Modelo 303 es la declaración trimestral del IVA que deben presentar los autónomos y empresas en España.',
      },
    ];

    await modelCache.warmUp(
      commonQueries.map((q) => ({
        modelId: 'llama-3-8b',
        input: q.input,
        output: q.output,
        workspaceId: 'default',
        metadata: { tokens: 50, latencyMs: 0 },
      }))
    );

    logger.info('Cache warm-up completed', {
      templates: templates.length,
      queries: commonQueries.length,
    });
  } catch (error) {
    logger.error('Cache warm-up failed', error as Error);
  }
}

// Start server
const start = async () => {
  try {
    await app.listen({ port: 3000, host: '0.0.0.0' });
    logger.info('Server started with caching enabled', { port: 3000 });
  } catch (error) {
    logger.error('Server startup failed', error as Error);
    process.exit(1);
  }
};

start();
