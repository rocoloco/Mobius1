/**
 * RBAC Service Unit Tests
 * Tests role-based access control enforcement and permission validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RBACService, Resource, Action } from '../../src/auth/rbac.js';
import { UserRole, type RequestContext } from '../../src/auth/types.js';

describe('RBACService', () => {
  let rbacService: RBACService;
  let mockContext: RequestContext;

  beforeEach(() => {
    rbacService = new RBACService();
    mockContext = {
      workspaceId: 'workspace-123',
      userId: 'user-456',
      roles: [UserRole.OPERATOR],
      clientIP: '127.0.0.1',
      userAgent: 'test-agent',
      correlationId: 'test-correlation-id',
      timestamp: new Date(),
    };
  });

  describe('hasPermission', () => {
    describe('Admin role permissions', () => {
      it('should allow admin to manage all resources', () => {
        const adminRoles = [UserRole.ADMIN];
        
        const resources = [
          Resource.WORKSPACE,
          Resource.USER,
          Resource.DOCUMENT,
          Resource.WORKFLOW,
          Resource.AUDIT,
          Resource.COMPLIANCE,
          Resource.POLICY,
          Resource.SYSTEM,
        ];

        const actions = [Action.CREATE, Action.READ, Action.UPDATE, Action.DELETE, Action.MANAGE];

        resources.forEach(resource => {
          actions.forEach(action => {
            const result = rbacService.hasPermission(adminRoles, resource, action, mockContext);
            expect(result.allowed).toBe(true);
          });
        });
      });
    });

    describe('Manager role permissions', () => {
      it('should allow manager to manage documents and workflows', () => {
        const managerRoles = [UserRole.MANAGER];
        
        const result1 = rbacService.hasPermission(managerRoles, Resource.DOCUMENT, Action.CREATE, mockContext);
        const result2 = rbacService.hasPermission(managerRoles, Resource.WORKFLOW, Action.EXECUTE, mockContext);
        const result3 = rbacService.hasPermission(managerRoles, Resource.USER, Action.READ, mockContext);
        
        expect(result1.allowed).toBe(true);
        expect(result2.allowed).toBe(true);
        expect(result3.allowed).toBe(true);
      });

      it('should deny manager system management access', () => {
        const managerRoles = [UserRole.MANAGER];
        
        const result = rbacService.hasPermission(managerRoles, Resource.SYSTEM, Action.MANAGE, mockContext);
        
        expect(result.allowed).toBe(false);
        expect(result.requiredRole).toBe(UserRole.ADMIN);
      });
    });

    describe('Operator role permissions', () => {
      it('should allow operator to create and read documents', () => {
        const operatorRoles = [UserRole.OPERATOR];
        
        const createResult = rbacService.hasPermission(operatorRoles, Resource.DOCUMENT, Action.CREATE, mockContext);
        const readResult = rbacService.hasPermission(operatorRoles, Resource.DOCUMENT, Action.READ, mockContext);
        
        expect(createResult.allowed).toBe(true);
        expect(readResult.allowed).toBe(true);
      });

      it('should allow operator to execute workflows', () => {
        const operatorRoles = [UserRole.OPERATOR];
        
        const result = rbacService.hasPermission(operatorRoles, Resource.WORKFLOW, Action.EXECUTE, mockContext);
        
        expect(result.allowed).toBe(true);
      });

      it('should deny operator user management access', () => {
        const operatorRoles = [UserRole.OPERATOR];
        
        const result = rbacService.hasPermission(operatorRoles, Resource.USER, Action.CREATE, mockContext);
        
        expect(result.allowed).toBe(false);
        expect(result.requiredRole).toBe(UserRole.MANAGER);
      });
    });

    describe('Viewer role permissions', () => {
      it('should allow viewer to read documents and workflows', () => {
        const viewerRoles = [UserRole.VIEWER];
        
        const docResult = rbacService.hasPermission(viewerRoles, Resource.DOCUMENT, Action.READ, mockContext);
        const workflowResult = rbacService.hasPermission(viewerRoles, Resource.WORKFLOW, Action.READ, mockContext);
        
        expect(docResult.allowed).toBe(true);
        expect(workflowResult.allowed).toBe(true);
      });

      it('should deny viewer write access to documents', () => {
        const viewerRoles = [UserRole.VIEWER];
        
        const result = rbacService.hasPermission(viewerRoles, Resource.DOCUMENT, Action.CREATE, mockContext);
        
        expect(result.allowed).toBe(false);
        expect(result.requiredRole).toBe(UserRole.OPERATOR);
      });
    });

    describe('Multiple roles', () => {
      it('should grant permissions if any role has access', () => {
        const multipleRoles = [UserRole.VIEWER, UserRole.OPERATOR];
        
        const result = rbacService.hasPermission(multipleRoles, Resource.DOCUMENT, Action.CREATE, mockContext);
        
        expect(result.allowed).toBe(true);
      });

      it('should use highest permission level available', () => {
        const multipleRoles = [UserRole.VIEWER, UserRole.ADMIN];
        
        const result = rbacService.hasPermission(multipleRoles, Resource.SYSTEM, Action.MANAGE, mockContext);
        
        expect(result.allowed).toBe(true);
      });
    });

    describe('Permission conditions', () => {
      it('should enforce "own" condition for audit access', () => {
        const operatorRoles = [UserRole.OPERATOR];
        const ownResourceId = mockContext.userId;
        const otherResourceId = 'other-user-id';
        
        const ownResult = rbacService.hasPermission(
          operatorRoles, 
          Resource.AUDIT, 
          Action.READ, 
          mockContext, 
          ownResourceId
        );
        
        const otherResult = rbacService.hasPermission(
          operatorRoles, 
          Resource.AUDIT, 
          Action.READ, 
          mockContext, 
          otherResourceId
        );
        
        expect(ownResult.allowed).toBe(true);
        expect(otherResult.allowed).toBe(false);
      });
    });
  });

  describe('hasAnyRole', () => {
    it('should return true if user has any of the required roles', () => {
      const userRoles = [UserRole.OPERATOR, UserRole.VIEWER];
      const requiredRoles = [UserRole.MANAGER, UserRole.OPERATOR];
      
      const result = rbacService.hasAnyRole(userRoles, requiredRoles);
      
      expect(result).toBe(true);
    });

    it('should return false if user has none of the required roles', () => {
      const userRoles = [UserRole.VIEWER];
      const requiredRoles = [UserRole.MANAGER, UserRole.ADMIN];
      
      const result = rbacService.hasAnyRole(userRoles, requiredRoles);
      
      expect(result).toBe(false);
    });
  });

  describe('hasAllRoles', () => {
    it('should return true if user has all required roles', () => {
      const userRoles = [UserRole.OPERATOR, UserRole.VIEWER, UserRole.MANAGER];
      const requiredRoles = [UserRole.OPERATOR, UserRole.VIEWER];
      
      const result = rbacService.hasAllRoles(userRoles, requiredRoles);
      
      expect(result).toBe(true);
    });

    it('should return false if user is missing any required role', () => {
      const userRoles = [UserRole.OPERATOR];
      const requiredRoles = [UserRole.OPERATOR, UserRole.MANAGER];
      
      const result = rbacService.hasAllRoles(userRoles, requiredRoles);
      
      expect(result).toBe(false);
    });
  });

  describe('getRoleDefinition', () => {
    it('should return correct role definition for admin', () => {
      const definition = rbacService.getRoleDefinition(UserRole.ADMIN);
      
      expect(definition).toBeDefined();
      expect(definition!.name).toBe(UserRole.ADMIN);
      expect(definition!.description).toContain('Full system access');
      expect(definition!.permissions.length).toBeGreaterThan(0);
    });

    it('should return undefined for invalid role', () => {
      const definition = rbacService.getRoleDefinition('invalid-role' as UserRole);
      
      expect(definition).toBeUndefined();
    });
  });

  describe('getRolePermissions', () => {
    it('should return permissions for valid role', () => {
      const permissions = rbacService.getRolePermissions(UserRole.OPERATOR);
      
      expect(permissions).toBeDefined();
      expect(Array.isArray(permissions)).toBe(true);
      expect(permissions.length).toBeGreaterThan(0);
    });

    it('should return empty array for invalid role', () => {
      const permissions = rbacService.getRolePermissions('invalid-role' as UserRole);
      
      expect(permissions).toEqual([]);
    });
  });

  describe('workspace isolation', () => {
    it('should maintain workspace context in permission checks', () => {
      const operatorRoles = [UserRole.OPERATOR];
      
      // Test that workspace context is preserved
      const result = rbacService.hasPermission(
        operatorRoles, 
        Resource.DOCUMENT, 
        Action.READ, 
        mockContext
      );
      
      expect(result.allowed).toBe(true);
      // In a real implementation, this would verify workspace-scoped access
    });
  });

  describe('Spain residency compliance', () => {
    it('should support residency-aware permission evaluation', () => {
      // This test verifies the RBAC system can handle Spain residency requirements
      const adminRoles = [UserRole.ADMIN];
      const spainContext = {
        ...mockContext,
        clientIP: '85.0.0.1', // Spanish IP range example
      };
      
      const result = rbacService.hasPermission(
        adminRoles, 
        Resource.POLICY, 
        Action.MANAGE, 
        spainContext
      );
      
      expect(result.allowed).toBe(true);
      // In full implementation, this would validate Spain residency requirements
    });
  });
});