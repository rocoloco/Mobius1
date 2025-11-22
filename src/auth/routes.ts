/**
 * Authentication Routes
 * API endpoints for login, logout, token refresh, and user management
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authService } from './service.js';
import { jwtService } from './jwt.js';
import { LoginRequestSchema } from './types.js';
import { authMiddleware, AuthenticatedRequest } from './middleware.js';

/**
 * Register authentication routes
 */
export async function registerAuthRoutes(fastify: FastifyInstance) {
  // Login endpoint
  fastify.post('/auth/login', {
    schema: {
      body: LoginRequestSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                workspaceId: { type: 'string' },
                roles: { type: 'array', items: { type: 'string' } },
              },
            },
            token: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            code: { type: 'string' },
          },
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            code: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const loginData = LoginRequestSchema.parse(request.body);
      const result = await authService.authenticate(loginData);

      if (!result.success) {
        reply.status(401).send({
          error: result.error || 'Authentication failed',
          code: 'AUTH_FAILED',
        });
        return;
      }

      reply.send({
        success: true,
        user: result.user,
        token: result.token,
      });
    } catch (error) {
      fastify.log.error({ error }, 'Login error');
      reply.status(400).send({
        error: 'Invalid request data',
        code: 'VALIDATION_ERROR',
      });
    }
  });

  // Logout endpoint
  fastify.post('/auth/logout', {
    preHandler: authMiddleware.required,
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const authRequest = request as AuthenticatedRequest;
    
    try {
      await authService.logout(
        authRequest.context.userId,
        authRequest.context.workspaceId
      );

      reply.send({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      fastify.log.error({ error }, 'Logout error');
      reply.status(500).send({
        error: 'Logout failed',
        code: 'LOGOUT_ERROR',
      });
    }
  });

  // Token refresh endpoint
  fastify.post('/auth/refresh', {
    schema: {
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' },
        },
        required: ['authorization'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            token: { type: 'string' },
          },
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            code: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authHeader = request.headers.authorization;
      const token = jwtService.extractTokenFromHeader(authHeader);

      if (!token) {
        reply.status(401).send({
          error: 'Token required for refresh',
          code: 'TOKEN_MISSING',
        });
        return;
      }

      const result = jwtService.refreshToken(token);

      if (!result.valid || !result.newToken) {
        reply.status(401).send({
          error: result.error || 'Token refresh failed',
          code: 'TOKEN_REFRESH_FAILED',
        });
        return;
      }

      reply.send({
        success: true,
        token: result.newToken,
      });
    } catch (error) {
      fastify.log.error({ error }, 'Token refresh error');
      reply.status(500).send({
        error: 'Token refresh failed',
        code: 'REFRESH_ERROR',
      });
    }
  });

  // Get current user profile
  fastify.get('/auth/profile', {
    preHandler: authMiddleware.required,
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                workspaceId: { type: 'string' },
                roles: { type: 'array', items: { type: 'string' } },
                lastLoginAt: { type: 'string', format: 'date-time' },
              },
            },
            workspace: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                spainResidencyMode: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const authRequest = request as AuthenticatedRequest;
    
    try {
      // Get user details from database
      const user = await fastify.db.user.findUnique({
        where: { id: authRequest.context.userId },
        include: {
          workspace: {
            select: {
              id: true,
              name: true,
              spainResidencyMode: true,
            },
          },
        },
      });

      if (!user) {
        reply.status(404).send({
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        });
        return;
      }

      reply.send({
        user: {
          id: user.id,
          email: user.email,
          workspaceId: user.workspaceId,
          roles: user.roles,
          lastLoginAt: user.lastLoginAt?.toISOString(),
        },
        workspace: user.workspace,
      });
    } catch (error) {
      fastify.log.error({ error }, 'Profile fetch error');
      reply.status(500).send({
        error: 'Failed to fetch profile',
        code: 'PROFILE_ERROR',
      });
    }
  });

  // Validate token endpoint (for other services)
  fastify.post('/auth/validate', {
    schema: {
      body: {
        type: 'object',
        properties: {
          token: { type: 'string' },
        },
        required: ['token'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            valid: { type: 'boolean' },
            payload: {
              type: 'object',
              properties: {
                sub: { type: 'string' },
                workspaceId: { type: 'string' },
                roles: { type: 'array', items: { type: 'string' } },
                iat: { type: 'number' },
                exp: { type: 'number' },
                iss: { type: 'string' },
              },
            },
          },
        },
        400: {
          type: 'object',
          properties: {
            valid: { type: 'boolean' },
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { token } = request.body as { token: string };
      const result = jwtService.validateToken(token);

      if (result.valid) {
        reply.send({
          valid: true,
          payload: result.payload,
        });
      } else {
        reply.status(400).send({
          valid: false,
          error: result.error,
        });
      }
    } catch (error) {
      fastify.log.error({ error }, 'Token validation error');
      reply.status(500).send({
        valid: false,
        error: 'Token validation failed',
      });
    }
  });
}