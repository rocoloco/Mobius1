/**
 * Audit Middleware
 * Enhanced audit logging middleware with comprehensive event tracking
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import { auditService, AuditEventType, AuditSeverity } from './service.js';
import type { AuthenticatedRequest } from '../auth/middleware.js';

/**
 * Audit middleware options
 */
export interface AuditMiddlewareOptions {
  logAllRequests?: boolean;
  logResponseBodies?: boolean;
  logRequestBodies?: boolean;
  excludePaths?: string[];
  includePerformanceMetrics?: boolean;
}

/**
 * Enhanced audit middleware that logs comprehensive request information
 */
export function createAuditMiddleware(options: AuditMiddlewareOptions = {}) {
  const {
    logAllRequests = true,
    logResponseBodies = false,
    logRequestBodies = false,
    excludePaths = ['/health', '/metrics'],
    includePerformanceMetrics = true,
  } = options;

  return async function auditMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const authRequest = request as AuthenticatedRequest;
    
    // Skip audit logging for excluded paths
    if (excludePaths.some(path => request.url.startsWith(path))) {
      return;
    }

    // Skip if no workspace context (unless it's a system-level request)
    if (!authRequest.context?.workspaceId && !request.url.startsWith('/auth')) {
      return;
    }

    const startTime = Date.now();
    const correlationId = authRequest.context?.correlationId || randomUUID();

    // Log request start if configured
    if (logAllRequests) {
      try {
        await auditService.logEvent({
          eventType: AuditEventType.SYSTEM_ERROR, // Will be updated to a proper request type
          severity: AuditSeverity.INFO,
          resourceId: request.url,
          action: request.method,
          metadata: {
            url: request.url,
            method: request.method,
            userAgent: authRequest.context?.userAgent || request.headers['user-agent'],
            clientIP: authRequest.context?.clientIP || request.ip,
            headers: filterSensitiveHeaders(request.headers),
            query: request.query,
            ...(logRequestBodies && request.body ? { requestBody: sanitizeRequestBody(request.body) } : {}),
          },
          correlationId,
          workspaceId: authRequest.context?.workspaceId || 'anonymous',
          userId: authRequest.context?.userId,
        });
      } catch (error) {
        // Don't fail the request if audit logging fails
        request.log.error('Failed to log audit event for request start:', error);
      }
    }

    // Add response completion logging
    reply.addHook('onSend', async (request, reply, payload) => {
      const responseTime = Date.now() - startTime;
      
      try {
        const metadata: any = {
          statusCode: reply.statusCode,
          responseTime,
          contentLength: payload ? Buffer.byteLength(payload.toString()) : 0,
        };

        if (includePerformanceMetrics) {
          metadata.performanceMetrics = {
            responseTime,
            memoryUsage: process.memoryUsage(),
            cpuUsage: process.cpuUsage(),
          };
        }

        if (logResponseBodies && payload && reply.statusCode >= 400) {
          metadata.responseBody = sanitizeResponseBody(payload.toString());
        }

        // Determine event type based on response
        let eventType = AuditEventType.SYSTEM_ERROR; // Default
        let severity = AuditSeverity.INFO;

        if (reply.statusCode >= 500) {
          eventType = AuditEventType.SYSTEM_ERROR;
          severity = AuditSeverity.ERROR;
        } else if (reply.statusCode >= 400) {
          if (reply.statusCode === 401 || reply.statusCode === 403) {
            eventType = AuditEventType.UNAUTHORIZED_ACCESS;
            severity = AuditSeverity.WARNING;
          } else {
            eventType = AuditEventType.SYSTEM_ERROR;
            severity = AuditSeverity.WARNING;
          }
        }

        await auditService.logEvent({
          eventType,
          severity,
          resourceId: request.url,
          action: `${request.method}_RESPONSE`,
          metadata,
          correlationId,
          workspaceId: authRequest.context?.workspaceId || 'anonymous',
          userId: authRequest.context?.userId,
        });

      } catch (error) {
        request.log.error('Failed to log audit event for response:', error);
      }
    });

    // Add error logging
    reply.addHook('onError', async (request, reply, error) => {
      try {
        await auditService.logEvent({
          eventType: AuditEventType.SYSTEM_ERROR,
          severity: AuditSeverity.ERROR,
          resourceId: request.url,
          action: `${request.method}_ERROR`,
          metadata: {
            error: {
              name: error.name,
              message: error.message,
              stack: error.stack,
              statusCode: error.statusCode || 500,
            },
            url: request.url,
            method: request.method,
            userAgent: authRequest.context?.userAgent || request.headers['user-agent'],
            clientIP: authRequest.context?.clientIP || request.ip,
          },
          correlationId,
          workspaceId: authRequest.context?.workspaceId || 'system',
          userId: authRequest.context?.userId,
        });
      } catch (auditError) {
        request.log.error('Failed to log audit event for error:', auditError);
      }
    });
  };
}

/**
 * Audit middleware for authentication events
 */
export function createAuthAuditMiddleware() {
  return async function authAuditMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const authRequest = request as AuthenticatedRequest;
    
    // Log successful authentication
    if (authRequest.context?.userId) {
      try {
        await auditService.logEvent({
          eventType: AuditEventType.USER_LOGIN,
          severity: AuditSeverity.INFO,
          resourceId: authRequest.context.userId,
          action: 'LOGIN_SUCCESS',
          metadata: {
            userAgent: authRequest.context.userAgent,
            clientIP: authRequest.context.clientIP,
            roles: authRequest.context.roles,
            loginMethod: 'jwt',
          },
          correlationId: authRequest.context.correlationId,
          workspaceId: authRequest.context.workspaceId,
          userId: authRequest.context.userId,
        });
      } catch (error) {
        request.log.error('Failed to log authentication audit event:', error);
      }
    }

    // Add logout detection
    reply.addHook('onSend', async (request, reply) => {
      // Check if this is a logout endpoint
      if (request.url.includes('/logout') && reply.statusCode === 200) {
        try {
          await auditService.logEvent({
            eventType: AuditEventType.USER_LOGOUT,
            severity: AuditSeverity.INFO,
            resourceId: authRequest.context?.userId || 'unknown',
            action: 'LOGOUT',
            metadata: {
              userAgent: authRequest.context?.userAgent,
              clientIP: authRequest.context?.clientIP,
              sessionDuration: 'unknown', // Could be calculated if session start time is tracked
            },
            correlationId: authRequest.context?.correlationId || randomUUID(),
            workspaceId: authRequest.context?.workspaceId || 'unknown',
            userId: authRequest.context?.userId,
          });
        } catch (error) {
          request.log.error('Failed to log logout audit event:', error);
        }
      }
    });
  };
}

/**
 * Audit middleware for policy violations
 */
export function createPolicyViolationAuditMiddleware() {
  return async function policyViolationAuditMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    // This middleware would be called when policy violations are detected
    // It integrates with the policy engine to log violations
    
    reply.addHook('onSend', async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      
      // Check for policy violation indicators in response
      if (reply.statusCode === 403 && reply.getHeader('x-policy-violation')) {
        try {
          await auditService.logEvent({
            eventType: AuditEventType.POLICY_VIOLATION,
            severity: AuditSeverity.ERROR,
            resourceId: request.url,
            action: request.method,
            metadata: {
              violationType: reply.getHeader('x-policy-violation'),
              url: request.url,
              method: request.method,
              userAgent: authRequest.context?.userAgent,
              clientIP: authRequest.context?.clientIP,
            },
            correlationId: authRequest.context?.correlationId || randomUUID(),
            workspaceId: authRequest.context?.workspaceId || 'unknown',
            userId: authRequest.context?.userId,
          });
        } catch (error) {
          request.log.error('Failed to log policy violation audit event:', error);
        }
      }
    });
  };
}

/**
 * Filter sensitive headers from audit logs
 */
function filterSensitiveHeaders(headers: any): any {
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
  const filtered = { ...headers };
  
  sensitiveHeaders.forEach(header => {
    if (filtered[header]) {
      filtered[header] = '[REDACTED]';
    }
  });
  
  return filtered;
}

/**
 * Sanitize request body for audit logging
 */
function sanitizeRequestBody(body: any): any {
  if (!body) return body;
  
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
  
  if (typeof body === 'object') {
    const sanitized = { ...body };
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });
    return sanitized;
  }
  
  return body;
}

/**
 * Sanitize response body for audit logging
 */
function sanitizeResponseBody(body: string): any {
  try {
    const parsed = JSON.parse(body);
    return sanitizeRequestBody(parsed);
  } catch {
    // If not JSON, return truncated string
    return body.length > 1000 ? body.substring(0, 1000) + '...' : body;
  }
}

/**
 * Pre-configured audit middleware instances
 */
export const auditMiddleware = {
  /**
   * Standard audit logging for all requests
   */
  standard: createAuditMiddleware({
    logAllRequests: true,
    includePerformanceMetrics: true,
  }),

  /**
   * Minimal audit logging (errors and violations only)
   */
  minimal: createAuditMiddleware({
    logAllRequests: false,
    includePerformanceMetrics: false,
  }),

  /**
   * Comprehensive audit logging with request/response bodies
   */
  comprehensive: createAuditMiddleware({
    logAllRequests: true,
    logRequestBodies: true,
    logResponseBodies: true,
    includePerformanceMetrics: true,
  }),

  /**
   * Authentication-specific audit logging
   */
  auth: createAuthAuditMiddleware(),

  /**
   * Policy violation audit logging
   */
  policyViolation: createPolicyViolationAuditMiddleware(),
};