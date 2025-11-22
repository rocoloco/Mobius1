/**
 * Audit Middleware Tests
 * Tests for audit logging middleware functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import { 
  createAuditMiddleware, 
  createAuthAuditMiddleware,
  createPolicyViolationAuditMiddleware,
  auditMiddleware,
} from '../../src/audit/middleware.js';
import { auditService, AuditEventType, AuditSeverity } from '../../src/audit/service.js';
import type { AuthenticatedRequest } from '../../src/auth/middleware.js';
import type { RequestContext } from '../../src/auth/types.js';

// Mock the audit service
vi.mock('../../src/audit/service.js', () => ({
  auditService: {
    logEvent: vi.fn(),
    logSecurityEvent: vi.fn(),
  },
  AuditEventType: {
    USER_LOGIN: 'USER_LOGIN',
    USER_LOGOUT: 'USER_LOGOUT',
    SYSTEM_ERROR: 'SYSTEM_ERROR',
    UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',
    PROMPT_INJECTION_ATTEMPT: 'PROMPT_INJECTION_ATTEMPT',
    POLICY_VIOLATION: 'POLICY_VIOLATION',
  },
  AuditSeverity: {
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    CRITICAL: 'critical',
  },
}));

describe('Audit Middleware', () => {
  const mockWorkspaceId = randomUUID();
  const mockUserId = randomUUID();
  const mockCorrelationId = randomUUID();

  let mockRequest: Partial<AuthenticatedRequest>;
  let mockReply: Partial<FastifyReply>;

  beforeEach(() => {
    vi.clearAllMocks();

    const mockContext: RequestContext = {
      workspaceId: mockWorkspaceId,
      userId: mockUserId,
      roles: ['user'],
      clientIP: '192.168.1.1',
      userAgent: 'test-agent/1.0',
      correlationId: mockCorrelationId,
      timestamp: new Date(),
    };

    mockRequest = {
      context: mockContext,
      url: '/api/test',
      method: 'GET',
      ip: '192.168.1.1',
      headers: {
        'user-agent': 'test-agent/1.0',
        'authorization': 'Bearer token123',
      },
      query: { param1: 'value1' },
      body: { data: 'test' },
      log: {
        info: vi.fn(),
        error: vi.fn(),
      } as any,
    };

    mockReply = {
      statusCode: 200,
      addHook: vi.fn(),
      getHeader: vi.fn(),
      send: vi.fn(),
      status: vi.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createAuditMiddleware', () => {
    it('should log request start when logAllRequests is enabled', async () => {
      const middleware = createAuditMiddleware({ logAllRequests: true });
      
      (auditService.logEvent as any).mockResolvedValue('event-id');

      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(auditService.logEvent).toHaveBeenCalledWith({
        eventType: AuditEventType.SYSTEM_ERROR, // Will be updated to proper request type
        severity: AuditSeverity.INFO,
        resourceId: '/api/test',
        action: 'GET',
        metadata: {
          url: '/api/test',
          method: 'GET',
          userAgent: 'test-agent/1.0',
          clientIP: '192.168.1.1',
          headers: {
            'user-agent': 'test-agent/1.0',
            'authorization': '[REDACTED]',
          },
          query: { param1: 'value1' },
        },
        correlationId: mockCorrelationId,
        workspaceId: mockWorkspaceId,
        userId: mockUserId,
      });
    });

    it('should skip logging for excluded paths', async () => {
      const middleware = createAuditMiddleware({ 
        logAllRequests: true,
        excludePaths: ['/health', '/metrics'],
      });

      mockRequest.url = '/health';

      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(auditService.logEvent).not.toHaveBeenCalled();
    });

    it('should skip logging when no workspace context', async () => {
      const middleware = createAuditMiddleware({ logAllRequests: true });
      
      mockRequest.context = undefined;
      mockRequest.url = '/api/test'; // Not an auth endpoint

      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(auditService.logEvent).not.toHaveBeenCalled();
    });

    it('should set up response logging hooks', async () => {
      const middleware = createAuditMiddleware({ logAllRequests: true });
      
      (auditService.logEvent as any).mockResolvedValue('event-id');

      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      // Verify hooks were added
      expect(mockReply.addHook).toHaveBeenCalledWith('onSend', expect.any(Function));
      expect(mockReply.addHook).toHaveBeenCalledWith('onError', expect.any(Function));
    });

    it('should include request body when logRequestBodies is enabled', async () => {
      const middleware = createAuditMiddleware({ 
        logAllRequests: true,
        logRequestBodies: true,
      });
      
      (auditService.logEvent as any).mockResolvedValue('event-id');

      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            requestBody: { data: 'test' },
          }),
        })
      );
    });

    it('should handle audit logging errors gracefully', async () => {
      const middleware = createAuditMiddleware({ logAllRequests: true });
      
      const auditError = new Error('Audit service unavailable');
      (auditService.logEvent as any).mockRejectedValue(auditError);

      // Should not throw
      await expect(
        middleware(mockRequest as FastifyRequest, mockReply as FastifyReply)
      ).resolves.toBeUndefined();

      expect(mockRequest.log?.error).toHaveBeenCalledWith(
        'Failed to log audit event for request start:',
        auditError
      );
    });
  });

  describe('createAuthAuditMiddleware', () => {
    it('should log successful authentication', async () => {
      const middleware = createAuthAuditMiddleware();
      
      (auditService.logEvent as any).mockResolvedValue('event-id');

      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(auditService.logEvent).toHaveBeenCalledWith({
        eventType: AuditEventType.USER_LOGIN,
        severity: AuditSeverity.INFO,
        resourceId: mockUserId,
        action: 'LOGIN_SUCCESS',
        metadata: {
          userAgent: 'test-agent/1.0',
          clientIP: '192.168.1.1',
          roles: ['user'],
          loginMethod: 'jwt',
        },
        correlationId: mockCorrelationId,
        workspaceId: mockWorkspaceId,
        userId: mockUserId,
      });
    });

    it('should skip logging when no user context', async () => {
      const middleware = createAuthAuditMiddleware();
      
      mockRequest.context!.userId = '';

      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(auditService.logEvent).not.toHaveBeenCalled();
    });

    it('should set up logout detection hook', async () => {
      const middleware = createAuthAuditMiddleware();
      
      (auditService.logEvent as any).mockResolvedValue('event-id');

      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.addHook).toHaveBeenCalledWith('onSend', expect.any(Function));
    });
  });

  describe('createPolicyViolationAuditMiddleware', () => {
    it('should log policy violations based on response headers', async () => {
      const middleware = createPolicyViolationAuditMiddleware();
      
      // Mock a policy violation response
      mockReply.statusCode = 403;
      (mockReply.getHeader as any).mockReturnValue('residency_violation');
      (auditService.logEvent as any).mockResolvedValue('event-id');

      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      // Verify hook was set up
      expect(mockReply.addHook).toHaveBeenCalledWith('onSend', expect.any(Function));

      // Simulate the onSend hook execution
      const onSendHook = (mockReply.addHook as any).mock.calls[0][1];
      await onSendHook(mockRequest, mockReply);

      expect(auditService.logEvent).toHaveBeenCalledWith({
        eventType: AuditEventType.POLICY_VIOLATION,
        severity: AuditSeverity.ERROR,
        resourceId: '/api/test',
        action: 'GET',
        metadata: {
          violationType: 'residency_violation',
          url: '/api/test',
          method: 'GET',
          userAgent: 'test-agent/1.0',
          clientIP: '192.168.1.1',
        },
        correlationId: mockCorrelationId,
        workspaceId: mockWorkspaceId,
        userId: mockUserId,
      });
    });

    it('should not log when no policy violation header present', async () => {
      const middleware = createPolicyViolationAuditMiddleware();
      
      mockReply.statusCode = 200;
      (mockReply.getHeader as any).mockReturnValue(undefined);

      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      // Simulate the onSend hook execution
      const onSendHook = (mockReply.addHook as any).mock.calls[0][1];
      await onSendHook(mockRequest, mockReply);

      expect(auditService.logEvent).not.toHaveBeenCalled();
    });
  });

  describe('filterSensitiveHeaders', () => {
    it('should redact sensitive headers', async () => {
      const middleware = createAuditMiddleware({ logAllRequests: true });
      
      mockRequest.headers = {
        'authorization': 'Bearer secret-token',
        'cookie': 'session=abc123',
        'x-api-key': 'api-key-123',
        'content-type': 'application/json',
        'user-agent': 'test-agent',
      };

      (auditService.logEvent as any).mockResolvedValue('event-id');

      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            headers: {
              'authorization': '[REDACTED]',
              'cookie': '[REDACTED]',
              'x-api-key': '[REDACTED]',
              'content-type': 'application/json',
              'user-agent': 'test-agent',
            },
          }),
        })
      );
    });
  });

  describe('sanitizeRequestBody', () => {
    it('should redact sensitive fields in request body', async () => {
      const middleware = createAuditMiddleware({ 
        logAllRequests: true,
        logRequestBodies: true,
      });
      
      mockRequest.body = {
        username: 'testuser',
        password: 'secret123',
        token: 'jwt-token',
        data: 'normal-data',
      };

      (auditService.logEvent as any).mockResolvedValue('event-id');

      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            requestBody: {
              username: 'testuser',
              password: '[REDACTED]',
              token: '[REDACTED]',
              data: 'normal-data',
            },
          }),
        })
      );
    });
  });

  describe('pre-configured middleware instances', () => {
    it('should provide standard audit middleware', () => {
      expect(auditMiddleware.standard).toBeDefined();
      expect(typeof auditMiddleware.standard).toBe('function');
    });

    it('should provide minimal audit middleware', () => {
      expect(auditMiddleware.minimal).toBeDefined();
      expect(typeof auditMiddleware.minimal).toBe('function');
    });

    it('should provide comprehensive audit middleware', () => {
      expect(auditMiddleware.comprehensive).toBeDefined();
      expect(typeof auditMiddleware.comprehensive).toBe('function');
    });

    it('should provide auth audit middleware', () => {
      expect(auditMiddleware.auth).toBeDefined();
      expect(typeof auditMiddleware.auth).toBe('function');
    });

    it('should provide policy violation audit middleware', () => {
      expect(auditMiddleware.policyViolation).toBeDefined();
      expect(typeof auditMiddleware.policyViolation).toBe('function');
    });
  });
});