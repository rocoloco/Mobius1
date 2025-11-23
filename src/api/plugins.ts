/**
 * Fastify Plugins Configuration
 * CORS, rate limiting, helmet, etc.
 */

import type { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { appConfig } from '../config/index.js';

/**
 * Register security and utility plugins
 */
export async function registerPlugins(fastify: FastifyInstance) {
  // CORS configuration
  await fastify.register(cors, {
    origin: (origin: string | undefined, cb: (err: Error | null, allow: boolean) => void) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) {
        cb(null, true);
        return;
      }

      // In development, allow all origins
      if (appConfig.app.nodeEnv === 'development') {
        cb(null, true);
        return;
      }

      // In production, whitelist specific origins
      const allowedOrigins = [
        'https://mobius1.example.com',
        'https://app.mobius1.example.com',
      ];

      if (allowedOrigins.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Correlation-ID',
      'X-Request-ID',
      'Idempotency-Key',
      'X-Workspace-ID',
    ],
    exposedHeaders: [
      'X-Correlation-ID',
      'X-API-Version',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
    ],
  });

  // Helmet for security headers
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
  });

  // Rate limiting
  await fastify.register(rateLimit, {
    global: true,
    max: 100, // 100 requests
    timeWindow: '1 minute',
    cache: 10000, // Cache 10k rate limit records
    allowList: ['127.0.0.1'], // Whitelist localhost
    redis: appConfig.redis.url ? undefined : undefined, // TODO: Use Redis for distributed rate limiting
    skipOnError: true, // Don't block requests if rate limiter fails
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
    errorResponseBuilder: (request: any, context: any) => {
      return {
        success: false,
        error: {
          code: 'E400',
          message: 'Rate limit exceeded',
          details: {
            limit: context.max,
            window: context.after,
            retryAfter: context.ttl,
          },
          timestamp: new Date().toISOString(),
          correlationId: request.headers['x-correlation-id'],
        },
      };
    },
  });
}
