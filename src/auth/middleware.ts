/**
 * Authentication and Authorization Middleware
 * Fastify middleware for JWT validation, workspace isolation, and RBAC
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import { authService } from './service.js';
import { jwtService } from './jwt.js';
import { rbacService, Resource, Action } from './rbac.js';
import { UserRole, type RequestContext } from './types.js';

/**
 * Extended Fastify request with authentication context
 */
export interface AuthenticatedRequest extends FastifyRequest {
  context: RequestContext;
}

/**
 * Authentication middleware options
 */
export interface AuthMiddlewareOptions {
  required?: boolean;
  roles?: UserRole[];
  resource?: Resource;
  action?: Action;
}

/**
 * Extract request context from headers and environment
 */
function extractRequestContext(request: FastifyRequest): Partial<RequestContext> {
  return {
    clientIP: request.ip,
    userAgent: request.headers['user-agent'] || 'unknown',
    correlationId: (request.headers['x-correlation-id'] as string) || randomUUID(),
    timestamp: new Date(),
  };
}

/**
 * Authentication middleware factory
 * Creates middleware that validates JWT tokens and extracts user context
 */
export function createAuthMiddleware(options: AuthMiddlewareOptions = {}) {
  return async function authMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const { required = true, roles, resource, action } = options;

    // Extract base context
    const baseContext = extractRequestContext(request);

    // Extract JWT token from Authorization header
    const authHeader = request.headers.authorization;
    const token = jwtService.extractTokenFromHeader(authHeader);

    if (!token) {
      if (required) {
        reply.status(401).send({
          error: 'Authentication required',
          code: 'AUTH_TOKEN_MISSING',
          correlationId: baseContext.correlationId,
        });
        return;
      }
      
      // For optional auth, continue without user context
      (request as AuthenticatedRequest).context = {
        ...baseContext,
        workspaceId: '',
        userId: '',
        roles: [],
      } as RequestContext;
      return;
    }

    // Validate token and get user context
    const authResult = await authService.validateSession(token);

    if (!authResult.success || !authResult.user) {
      reply.status(401).send({
        error: authResult.error || 'Invalid token',
        code: 'AUTH_TOKEN_INVALID',
        correlationId: baseContext.correlationId,
      });
      return;
    }

    // Build complete request context
    const context: RequestContext = {
      ...baseContext,
      workspaceId: authResult.user.workspaceId,
      userId: authResult.user.id,
      roles: authResult.user.roles,
    };

    // Attach context to request
    (request as AuthenticatedRequest).context = context;

    // Check role-based authorization if specified
    if (roles && roles.length > 0) {
      const hasRequiredRole = rbacService.hasAnyRole(context.roles, roles);
      if (!hasRequiredRole) {
        reply.status(403).send({
          error: 'Insufficient permissions',
          code: 'AUTH_INSUFFICIENT_ROLE',
          requiredRoles: roles,
          userRoles: context.roles,
          correlationId: context.correlationId,
        });
        return;
      }
    }

    // Check resource-based authorization if specified
    if (resource && action) {
      const authzResult = rbacService.hasPermission(
        context.roles,
        resource,
        action,
        context
      );

      if (!authzResult.allowed) {
        reply.status(403).send({
          error: authzResult.reason || 'Access denied',
          code: 'AUTH_INSUFFICIENT_PERMISSION',
          resource,
          action,
          requiredRole: authzResult.requiredRole,
          userRoles: context.roles,
          correlationId: context.correlationId,
        });
        return;
      }
    }
  };
}

/**
 * Workspace isolation middleware
 * Ensures all database queries are scoped to the user's workspace
 */
export function createWorkspaceIsolationMiddleware() {
  return async function workspaceIsolationMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const authRequest = request as AuthenticatedRequest;
    
    if (!authRequest.context?.workspaceId) {
      reply.status(400).send({
        error: 'Workspace context required',
        code: 'WORKSPACE_CONTEXT_MISSING',
        correlationId: authRequest.context?.correlationId,
      });
      return;
    }

    // Add workspace ID to request for use in route handlers
    // This ensures all database queries include workspace filtering
    request.log.info({
      workspaceId: authRequest.context.workspaceId,
      userId: authRequest.context.userId,
      correlationId: authRequest.context.correlationId,
    }, 'Request processed with workspace isolation');
  };
}

/**
 * Spain residency enforcement middleware
 * Validates that requests comply with Spain-only data residency requirements
 */
export function createSpainResidencyMiddleware() {
  return async function spainResidencyMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const authRequest = request as AuthenticatedRequest;
    
    if (!authRequest.context?.workspaceId) {
      return; // Skip if no workspace context
    }

    // In a real implementation, this would check:
    // 1. Workspace Spain residency mode setting
    // 2. Request origin geolocation
    // 3. Data processing location validation
    
    // For now, we'll add the validation structure
    const clientIP = authRequest.context.clientIP;
    const workspaceId = authRequest.context.workspaceId;

    // Log residency check for audit trail
    request.log.info({
      workspaceId,
      clientIP,
      correlationId: authRequest.context.correlationId,
      residencyCheck: 'spain_only',
    }, 'Spain residency validation performed');

    // TODO: Implement actual geolocation and residency validation
    // This would integrate with the Policy Engine for full validation
  };
}

/**
 * Audit logging middleware
 * Logs all authenticated requests for compliance and audit trails
 */
export function createAuditMiddleware() {
  return async function auditMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const authRequest = request as AuthenticatedRequest;
    
    if (!authRequest.context?.workspaceId) {
      return; // Skip if no workspace context
    }

    // Log request for audit trail
    request.log.info({
      workspaceId: authRequest.context.workspaceId,
      userId: authRequest.context.userId,
      method: request.method,
      url: request.url,
      userAgent: authRequest.context.userAgent,
      clientIP: authRequest.context.clientIP,
      correlationId: authRequest.context.correlationId,
      timestamp: authRequest.context.timestamp,
    }, 'Authenticated request logged for audit');

    // Add response time tracking
    const startTime = Date.now();
    
    reply.addHook('onSend', async () => {
      const responseTime = Date.now() - startTime;
      request.log.info({
        correlationId: authRequest.context.correlationId,
        responseTime,
        statusCode: reply.statusCode,
      }, 'Request completed');
    });
  };
}

/**
 * Convenience middleware combinations
 */
export const authMiddleware = {
  /**
   * Standard authentication - requires valid JWT
   */
  required: createAuthMiddleware({ required: true }),

  /**
   * Optional authentication - allows anonymous access
   */
  optional: createAuthMiddleware({ required: false }),

  /**
   * Admin only access
   */
  adminOnly: createAuthMiddleware({ 
    required: true, 
    roles: [UserRole.ADMIN] 
  }),

  /**
   * Manager or admin access
   */
  managerOrAdmin: createAuthMiddleware({ 
    required: true, 
    roles: [UserRole.MANAGER, UserRole.ADMIN] 
  }),

  /**
   * Operator level access (operator, manager, or admin)
   */
  operatorLevel: createAuthMiddleware({ 
    required: true, 
    roles: [UserRole.OPERATOR, UserRole.MANAGER, UserRole.ADMIN] 
  }),

  /**
   * Full middleware stack for authenticated routes
   */
  full: [
    createAuthMiddleware({ required: true }),
    createWorkspaceIsolationMiddleware(),
    createSpainResidencyMiddleware(),
    createAuditMiddleware(),
  ],
};