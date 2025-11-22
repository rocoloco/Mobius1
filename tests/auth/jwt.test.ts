/**
 * JWT Service Unit Tests
 * Tests JWT token generation, validation, and workspace context
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { JWTService } from '../../src/auth/jwt.js';
import { UserRole } from '../../src/auth/types.js';

describe('JWTService', () => {
  let jwtService: JWTService;
  const testUserId = 'user-123';
  const testWorkspaceId = 'workspace-456';
  const testRoles = [UserRole.OPERATOR, UserRole.VIEWER];

  beforeEach(() => {
    // Set test JWT secret
    process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-characters-long';
    jwtService = new JWTService();
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token with workspace context', () => {
      const token = jwtService.generateToken(testUserId, testWorkspaceId, testRoles);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include correct payload in generated token', () => {
      const token = jwtService.generateToken(testUserId, testWorkspaceId, testRoles);
      const validation = jwtService.validateToken(token);
      
      expect(validation.valid).toBe(true);
      expect(validation.payload).toBeDefined();
      expect(validation.payload!.sub).toBe(testUserId);
      expect(validation.payload!.workspaceId).toBe(testWorkspaceId);
      expect(validation.payload!.roles).toEqual(testRoles);
      expect(validation.payload!.iss).toBe('mobius1-platform');
    });
  });

  describe('validateToken', () => {
    it('should validate a valid token successfully', () => {
      const token = jwtService.generateToken(testUserId, testWorkspaceId, testRoles);
      const result = jwtService.validateToken(token);
      
      expect(result.valid).toBe(true);
      expect(result.payload).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should reject an invalid token', () => {
      const result = jwtService.validateToken('invalid-token');
      
      expect(result.valid).toBe(false);
      expect(result.payload).toBeUndefined();
      expect(result.error).toBe('Invalid token');
    });

    it('should reject a token with invalid signature', () => {
      const token = jwtService.generateToken(testUserId, testWorkspaceId, testRoles);
      const tamperedToken = token.slice(0, -5) + 'xxxxx';
      const result = jwtService.validateToken(tamperedToken);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid token');
    });

    it('should reject a token with missing required fields', () => {
      // Create a token with incomplete payload
      const incompletePayload = { sub: testUserId }; // missing workspaceId and roles
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(incompletePayload, process.env.JWT_SECRET, {
        issuer: 'mobius1-platform',
      });
      
      const result = jwtService.validateToken(token);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid token');
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from valid Bearer header', () => {
      const token = 'test-token-123';
      const header = `Bearer ${token}`;
      
      const extracted = jwtService.extractTokenFromHeader(header);
      
      expect(extracted).toBe(token);
    });

    it('should return null for missing header', () => {
      const extracted = jwtService.extractTokenFromHeader(undefined);
      
      expect(extracted).toBeNull();
    });

    it('should return null for invalid header format', () => {
      const extracted = jwtService.extractTokenFromHeader('InvalidFormat token');
      
      expect(extracted).toBeNull();
    });

    it('should return null for header without Bearer prefix', () => {
      const extracted = jwtService.extractTokenFromHeader('token-without-bearer');
      
      expect(extracted).toBeNull();
    });
  });

  describe('refreshToken', () => {
    it('should generate new token with same payload', async () => {
      const originalToken = jwtService.generateToken(testUserId, testWorkspaceId, testRoles);
      
      // Wait a small amount to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1100)); // Wait more than 1 second to ensure different iat
      
      const result = jwtService.refreshToken(originalToken);
      
      expect(result.valid).toBe(true);
      expect(result.newToken).toBeDefined();
      expect(result.newToken).not.toBe(originalToken);
      
      // Validate new token has same payload
      const newValidation = jwtService.validateToken(result.newToken!);
      expect(newValidation.valid).toBe(true);
      expect(newValidation.payload!.sub).toBe(testUserId);
      expect(newValidation.payload!.workspaceId).toBe(testWorkspaceId);
      expect(newValidation.payload!.roles).toEqual(testRoles);
    });

    it('should fail to refresh invalid token', () => {
      const result = jwtService.refreshToken('invalid-token');
      
      expect(result.valid).toBe(false);
      expect(result.newToken).toBeUndefined();
      expect(result.error).toBe('Invalid token');
    });
  });

  describe('workspace isolation', () => {
    it('should maintain workspace context in token lifecycle', () => {
      const workspace1 = 'workspace-1';
      const workspace2 = 'workspace-2';
      
      const token1 = jwtService.generateToken(testUserId, workspace1, testRoles);
      const token2 = jwtService.generateToken(testUserId, workspace2, testRoles);
      
      const validation1 = jwtService.validateToken(token1);
      const validation2 = jwtService.validateToken(token2);
      
      expect(validation1.payload!.workspaceId).toBe(workspace1);
      expect(validation2.payload!.workspaceId).toBe(workspace2);
      expect(validation1.payload!.workspaceId).not.toBe(validation2.payload!.workspaceId);
    });
  });
});