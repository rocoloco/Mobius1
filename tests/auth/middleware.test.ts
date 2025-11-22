/**
 * Authentication Middleware Unit Tests
 * Tests JWT validation, workspace isolation, and request context extraction
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FastifyRequest, FastifyReply } from 'fastify';
import { createAuthMiddleware, createWorkspaceIsolationMiddleware } from '../../src/auth/middleware.js';
import { UserRole } from '../../src/auth/types.js';
import { jwtService } from '../../src/auth/jwt.js';
import { authService } from '../../src/auth/service.js';

// Mock the auth services
vi.mock('../../src/auth/jwt.js');
vi.mock('../../src/auth/service.js');

describe('Authentication Middleware', () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let replyStatusSpy: ReturnType<typeof vi.fn>;
  let replySendSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Setup mock reply
    replyStatusSpy = vi.fn().mockReturnThis();
    replySendSpy = vi.fn().mockReturnThis();
    
    mockReply = {
      status: replyStatusSpy,
      send: replySendSpy,
    };

    // Setup mock request
    mockRequest = {
      ip: '127.0.0.1',
      headers: {},
      log: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      } as any,
    };
  });

  describe('createAuthMiddleware', () => {
    describe('required authentication', () => {
      it('should reject request without authorization header', async () => {
        const middleware = createAuthMiddleware({ required: true });
        
        vi.mocked(jwtService.extractTokenFromHeader).mockReturnValue(null);
        
        await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
        
        expect(replyStatusSpy).toHaveBeenCalledWith(401);
        expect(replySendSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            error: 'Authentication required',
            code: 'AUTH_TOKEN_MISSING',
          })
        );
      });

      it('should reject request with invalid token', async () => {
        const middleware = createAuthMiddleware({ required: true });
        
        mockRequest.headers = { authorization: 'Bearer invalid-token' };
        
        vi.mocked(jwtService.extractTokenFromHeader).mockReturnValue('invalid-token');
        vi.mocked(authService.validateSession).mockResolvedValue({
          success: false,
          error: 'Invalid token',
        });
        
        await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
        
        expect(replyStatusSpy).toHaveBeenCalledWith(401);
        expect(replySendSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            error: 'Invalid token',
            code: 'AUTH_TOKEN_INVALID',
          })
        );
      });

      it('should accept request with valid token and set context', async () => {
        const middleware = createAuthMiddleware({ required: true });
        
        mockRequest.headers = { authorization: 'Bearer valid-token' };
        
        vi.mocked(jwtService.extractTokenFromHeader).mockReturnValue('valid-token');
        vi.mocked(authService.validateSession).mockResolvedValue({
          success: true,
          user: {
            id: 'user-123',
            email: 'test@example.com',
            workspaceId: 'workspace-456',
            roles: [UserRole.OPERATOR],
          },
        });
        
        await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
        
        expect(replyStatusSpy).not.toHaveBeenCalled();
        expect(replySendSpy).not.toHaveBeenCalled();
        
        // Check that context was set
        const authRequest = mockRequest as any;
        expect(authRequest.context).toBeDefined();
        expect(authRequest.context.userId).toBe('user-123');
        expect(authRequest.context.workspaceId).toBe('workspace-456');
        expect(authRequest.context.roles).toEqual([UserRole.OPERATOR]);
      });
    });

    describe('optional authentication', () => {
      it('should allow request without token when authentication is optional', async () => {
        const middleware = createAuthMiddleware({ required: false });
        
        vi.mocked(jwtService.extractTokenFromHeader).mockReturnValue(null);
        
        await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
        
        expect(replyStatusSpy).not.toHaveBeenCalled();
        expect(replySendSpy).not.toHaveBeenCalled();
        
        // Check that empty context was set
        const authRequest = mockRequest as any;
        expect(authRequest.context).toBeDefined();
        expect(authRequest.context.userId).toBe('');
        expect(authRequest.context.workspaceId).toBe('');
        expect(authRequest.context.roles).toEqual([]);
      });
    });

    describe('role-based authorization', () => {
      it('should reject user without required role', async () => {
        const middleware = createAuthMiddleware({ 
          required: true, 
          roles: [UserRole.ADMIN] 
        });
        
        mockRequest.headers = { authorization: 'Bearer valid-token' };
        
        vi.mocked(jwtService.extractTokenFromHeader).mockReturnValue('valid-token');
        vi.mocked(authService.validateSession).mockResolvedValue({
          success: true,
          user: {
            id: 'user-123',
            email: 'test@example.com',
            workspaceId: 'workspace-456',
            roles: [UserRole.VIEWER], // Not admin
          },
        });
        
        await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
        
        expect(replyStatusSpy).toHaveBeenCalledWith(403);
        expect(replySendSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            error: 'Insufficient permissions',
            code: 'AUTH_INSUFFICIENT_ROLE',
            requiredRoles: [UserRole.ADMIN],
            userRoles: [UserRole.VIEWER],
          })
        );
      });

      it('should accept user with required role', async () => {
        const middleware = createAuthMiddleware({ 
          required: true, 
          roles: [UserRole.OPERATOR, UserRole.ADMIN] 
        });
        
        mockRequest.headers = { authorization: 'Bearer valid-token' };
        
        vi.mocked(jwtService.extractTokenFromHeader).mockReturnValue('valid-token');
        vi.mocked(authService.validateSession).mockResolvedValue({
          success: true,
          user: {
            id: 'user-123',
            email: 'test@example.com',
            workspaceId: 'workspace-456',
            roles: [UserRole.OPERATOR], // Has required role
          },
        });
        
        await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
        
        expect(replyStatusSpy).not.toHaveBeenCalled();
        expect(replySendSpy).not.toHaveBeenCalled();
      });
    });

    describe('request context extraction', () => {
      it('should extract client IP and user agent', async () => {
        const middleware = createAuthMiddleware({ required: true });
        
        mockRequest.ip = '192.168.1.100';
        mockRequest.headers = { 
          authorization: 'Bearer valid-token',
          'user-agent': 'Mozilla/5.0 Test Browser',
          'x-correlation-id': 'test-correlation-123',
        };
        
        vi.mocked(jwtService.extractTokenFromHeader).mockReturnValue('valid-token');
        vi.mocked(authService.validateSession).mockResolvedValue({
          success: true,
          user: {
            id: 'user-123',
            email: 'test@example.com',
            workspaceId: 'workspace-456',
            roles: [UserRole.OPERATOR],
          },
        });
        
        await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
        
        const authRequest = mockRequest as any;
        expect(authRequest.context.clientIP).toBe('192.168.1.100');
        expect(authRequest.context.userAgent).toBe('Mozilla/5.0 Test Browser');
        expect(authRequest.context.correlationId).toBe('test-correlation-123');
        expect(authRequest.context.timestamp).toBeInstanceOf(Date);
      });

      it('should generate correlation ID if not provided', async () => {
        const middleware = createAuthMiddleware({ required: true });
        
        mockRequest.headers = { authorization: 'Bearer valid-token' };
        
        vi.mocked(jwtService.extractTokenFromHeader).mockReturnValue('valid-token');
        vi.mocked(authService.validateSession).mockResolvedValue({
          success: true,
          user: {
            id: 'user-123',
            email: 'test@example.com',
            workspaceId: 'workspace-456',
            roles: [UserRole.OPERATOR],
          },
        });
        
        await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
        
        const authRequest = mockRequest as any;
        expect(authRequest.context.correlationId).toBeDefined();
        expect(typeof authRequest.context.correlationId).toBe('string');
        expect(authRequest.context.correlationId.length).toBeGreaterThan(0);
      });
    });
  });

  describe('createWorkspaceIsolationMiddleware', () => {
    it('should reject request without workspace context', async () => {
      const middleware = createWorkspaceIsolationMiddleware();
      
      // Request without context
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
      
      expect(replyStatusSpy).toHaveBeenCalledWith(400);
      expect(replySendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Workspace context required',
          code: 'WORKSPACE_CONTEXT_MISSING',
        })
      );
    });

    it('should accept request with valid workspace context', async () => {
      const middleware = createWorkspaceIsolationMiddleware();
      
      // Add context to request
      (mockRequest as any).context = {
        workspaceId: 'workspace-123',
        userId: 'user-456',
        roles: [UserRole.OPERATOR],
        clientIP: '127.0.0.1',
        userAgent: 'test-agent',
        correlationId: 'test-correlation',
        timestamp: new Date(),
      };
      
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
      
      expect(replyStatusSpy).not.toHaveBeenCalled();
      expect(replySendSpy).not.toHaveBeenCalled();
      expect(mockRequest.log?.info).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'workspace-123',
          userId: 'user-456',
        }),
        'Request processed with workspace isolation'
      );
    });
  });

  describe('workspace isolation enforcement', () => {
    it('should ensure workspace context is maintained throughout request', async () => {
      const authMiddleware = createAuthMiddleware({ required: true });
      const isolationMiddleware = createWorkspaceIsolationMiddleware();
      
      mockRequest.headers = { authorization: 'Bearer valid-token' };
      
      vi.mocked(jwtService.extractTokenFromHeader).mockReturnValue('valid-token');
      vi.mocked(authService.validateSession).mockResolvedValue({
        success: true,
        user: {
          id: 'user-123',
          email: 'test@example.com',
          workspaceId: 'workspace-456',
          roles: [UserRole.OPERATOR],
        },
      });
      
      // Run auth middleware first
      await authMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
      
      // Then run isolation middleware
      await isolationMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
      
      // Both should succeed
      expect(replyStatusSpy).not.toHaveBeenCalled();
      expect(replySendSpy).not.toHaveBeenCalled();
      
      const authRequest = mockRequest as any;
      expect(authRequest.context.workspaceId).toBe('workspace-456');
    });
  });
});