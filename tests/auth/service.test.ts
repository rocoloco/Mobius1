/**
 * Authentication Service Unit Tests
 * Tests user authentication, password validation, and session management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { AuthService } from '../../src/auth/service.js';
import { UserRole } from '../../src/auth/types.js';
import { jwtService } from '../../src/auth/jwt.js';

// Mock dependencies
vi.mock('../../src/database/client.js', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    auditEvent: {
      create: vi.fn(),
    },
  },
}));

vi.mock('../../src/auth/jwt.js');
vi.mock('bcryptjs');

// Import mocked db after mocking
import { db } from '../../src/database/client.js';

describe('AuthService', () => {
  let authService: AuthService;
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    password: 'hashed-password',
    roles: [UserRole.OPERATOR],
    workspaceId: 'workspace-456',
    lastLoginAt: null,
    workspace: {
      id: 'workspace-456',
      name: 'Test Workspace',
      spainResidencyMode: true,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    authService = new AuthService();
  });

  describe('authenticate', () => {
    const loginRequest = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should authenticate user with valid credentials', async () => {
      // Mock database response
      vi.mocked(db.user.findUnique).mockResolvedValue(mockUser);
      
      // Mock password comparison
      vi.mocked(bcrypt.compare).mockResolvedValue(true);
      
      // Mock JWT generation
      vi.mocked(jwtService.generateToken).mockReturnValue('jwt-token-123');
      
      // Mock database update
      vi.mocked(db.user.update).mockResolvedValue(mockUser);
      
      // Mock audit event creation
      vi.mocked(db.auditEvent.create).mockResolvedValue({} as any);

      const result = await authService.authenticate(loginRequest);

      expect(result.success).toBe(true);
      expect(result.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        workspaceId: mockUser.workspaceId,
        roles: mockUser.roles,
      });
      expect(result.token).toBe('jwt-token-123');
      expect(result.error).toBeUndefined();

      // Verify JWT was generated with correct parameters
      expect(jwtService.generateToken).toHaveBeenCalledWith(
        mockUser.id,
        mockUser.workspaceId,
        mockUser.roles
      );

      // Verify last login was updated
      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { lastLoginAt: expect.any(Date) },
      });

      // Verify audit event was logged
      expect(db.auditEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId: mockUser.workspaceId,
          userId: mockUser.id,
          eventType: 'USER_LOGIN',
          resourceId: mockUser.id,
          action: 'user_login',
        }),
      });
    });

    it('should reject authentication with invalid email', async () => {
      // Mock user not found
      vi.mocked(db.user.findUnique).mockResolvedValue(null);

      const result = await authService.authenticate(loginRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
      expect(result.user).toBeUndefined();
      expect(result.token).toBeUndefined();
    });

    it('should reject authentication with invalid password', async () => {
      // Mock database response
      vi.mocked(db.user.findUnique).mockResolvedValue(mockUser);
      
      // Mock password comparison failure
      vi.mocked(bcrypt.compare).mockResolvedValue(false);

      const result = await authService.authenticate(loginRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
      expect(result.user).toBeUndefined();
      expect(result.token).toBeUndefined();
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error
      vi.mocked(db.user.findUnique).mockRejectedValue(new Error('Database error'));

      const result = await authService.authenticate(loginRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication failed');
    });
  });

  describe('validateSession', () => {
    const validToken = 'valid-jwt-token';

    it('should validate session with valid token', async () => {
      // Mock JWT validation
      vi.mocked(jwtService.validateToken).mockReturnValue({
        valid: true,
        payload: {
          sub: mockUser.id,
          workspaceId: mockUser.workspaceId,
          roles: mockUser.roles,
          iat: Date.now(),
          exp: Date.now() + 3600000,
          iss: 'mobius1-platform',
        },
      });

      // Mock database response
      vi.mocked(db.user.findUnique).mockResolvedValue(mockUser);

      const result = await authService.validateSession(validToken);

      expect(result.success).toBe(true);
      expect(result.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        workspaceId: mockUser.workspaceId,
        roles: mockUser.roles,
      });
    });

    it('should reject session with invalid token', async () => {
      // Mock JWT validation failure
      vi.mocked(jwtService.validateToken).mockReturnValue({
        valid: false,
        error: 'Invalid token',
      });

      const result = await authService.validateSession('invalid-token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid token');
    });

    it('should reject session when user not found', async () => {
      // Mock JWT validation success
      vi.mocked(jwtService.validateToken).mockReturnValue({
        valid: true,
        payload: {
          sub: 'non-existent-user',
          workspaceId: mockUser.workspaceId,
          roles: mockUser.roles,
          iat: Date.now(),
          exp: Date.now() + 3600000,
          iss: 'mobius1-platform',
        },
      });

      // Mock user not found
      vi.mocked(db.user.findUnique).mockResolvedValue(null);

      const result = await authService.validateSession(validToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
    });

    it('should reject session with workspace mismatch', async () => {
      // Mock JWT validation with different workspace
      vi.mocked(jwtService.validateToken).mockReturnValue({
        valid: true,
        payload: {
          sub: mockUser.id,
          workspaceId: 'different-workspace',
          roles: mockUser.roles,
          iat: Date.now(),
          exp: Date.now() + 3600000,
          iss: 'mobius1-platform',
        },
      });

      // Mock database response
      vi.mocked(db.user.findUnique).mockResolvedValue(mockUser);

      const result = await authService.validateSession(validToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Workspace mismatch');
    });
  });

  describe('hashPassword', () => {
    it('should hash password with bcrypt', async () => {
      const password = 'password123';
      const hashedPassword = 'hashed-password-result';

      vi.mocked(bcrypt.hash).mockResolvedValue(hashedPassword);

      const result = await authService.hashPassword(password);

      expect(result).toBe(hashedPassword);
      expect(bcrypt.hash).toHaveBeenCalledWith(password, 12);
    });
  });

  describe('logout', () => {
    it('should log logout event', async () => {
      const userId = 'user-123';
      const workspaceId = 'workspace-456';

      vi.mocked(db.auditEvent.create).mockResolvedValue({} as any);

      await authService.logout(userId, workspaceId);

      expect(db.auditEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId,
          userId,
          eventType: 'USER_LOGOUT',
          resourceId: userId,
          action: 'user_logout',
        }),
      });
    });

    it('should handle audit logging errors gracefully', async () => {
      const userId = 'user-123';
      const workspaceId = 'workspace-456';

      vi.mocked(db.auditEvent.create).mockRejectedValue(new Error('Audit error'));

      // Should not throw
      await expect(authService.logout(userId, workspaceId)).resolves.toBeUndefined();
    });
  });

  describe('workspace isolation', () => {
    it('should maintain workspace context in authentication flow', async () => {
      const workspace1User = { ...mockUser, workspaceId: 'workspace-1' };
      const workspace2User = { ...mockUser, workspaceId: 'workspace-2' };

      // Test authentication for workspace 1
      vi.mocked(db.user.findUnique).mockResolvedValueOnce(workspace1User);
      vi.mocked(bcrypt.compare).mockResolvedValue(true);
      vi.mocked(jwtService.generateToken).mockReturnValue('token-1');
      vi.mocked(db.user.update).mockResolvedValue(workspace1User);
      vi.mocked(db.auditEvent.create).mockResolvedValue({} as any);

      const result1 = await authService.authenticate({
        email: 'user1@example.com',
        password: 'password',
      });

      expect(result1.success).toBe(true);
      expect(result1.user?.workspaceId).toBe('workspace-1');

      // Test authentication for workspace 2
      vi.mocked(db.user.findUnique).mockResolvedValueOnce(workspace2User);

      const result2 = await authService.authenticate({
        email: 'user2@example.com',
        password: 'password',
      });

      expect(result2.success).toBe(true);
      expect(result2.user?.workspaceId).toBe('workspace-2');

      // Verify JWT tokens were generated with correct workspace contexts
      expect(jwtService.generateToken).toHaveBeenCalledWith(
        workspace1User.id,
        'workspace-1',
        workspace1User.roles
      );
      expect(jwtService.generateToken).toHaveBeenCalledWith(
        workspace2User.id,
        'workspace-2',
        workspace2User.roles
      );
    });
  });
});