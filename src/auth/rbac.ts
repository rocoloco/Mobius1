/**
 * Role-Based Access Control (RBAC) System
 * Defines roles, permissions, and authorization logic
 */

import { 
  UserRole, 
  type Permission, 
  type RoleDefinition, 
  type AuthorizationResult, 
  type RequestContext 
} from './types.js';

/**
 * Resource types in the system
 */
export enum Resource {
  WORKSPACE = 'workspace',
  USER = 'user',
  DOCUMENT = 'document',
  WORKFLOW = 'workflow',
  AUDIT = 'audit',
  COMPLIANCE = 'compliance',
  POLICY = 'policy',
  SYSTEM = 'system',
}

/**
 * Action types
 */
export enum Action {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  EXECUTE = 'execute',
  MANAGE = 'manage',
}

/**
 * Role definitions with permissions
 */
const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    name: UserRole.ADMIN,
    description: 'Full system access including user management and system configuration',
    permissions: [
      { resource: Resource.WORKSPACE, action: Action.MANAGE },
      { resource: Resource.USER, action: Action.MANAGE },
      { resource: Resource.DOCUMENT, action: Action.MANAGE },
      { resource: Resource.WORKFLOW, action: Action.MANAGE },
      { resource: Resource.AUDIT, action: Action.MANAGE },
      { resource: Resource.COMPLIANCE, action: Action.MANAGE },
      { resource: Resource.POLICY, action: Action.MANAGE },
      { resource: Resource.SYSTEM, action: Action.MANAGE },
    ],
  },
  {
    name: UserRole.MANAGER,
    description: 'Workspace management and operational oversight',
    permissions: [
      { resource: Resource.WORKSPACE, action: Action.READ },
      { resource: Resource.WORKSPACE, action: Action.UPDATE },
      { resource: Resource.USER, action: Action.READ },
      { resource: Resource.USER, action: Action.CREATE },
      { resource: Resource.USER, action: Action.UPDATE },
      { resource: Resource.DOCUMENT, action: Action.MANAGE },
      { resource: Resource.WORKFLOW, action: Action.MANAGE },
      { resource: Resource.AUDIT, action: Action.READ },
      { resource: Resource.COMPLIANCE, action: Action.READ },
      { resource: Resource.POLICY, action: Action.READ },
    ],
  },
  {
    name: UserRole.OPERATOR,
    description: 'Day-to-day operations including document processing and workflow execution',
    permissions: [
      { resource: Resource.WORKSPACE, action: Action.READ },
      { resource: Resource.DOCUMENT, action: Action.CREATE },
      { resource: Resource.DOCUMENT, action: Action.READ },
      { resource: Resource.DOCUMENT, action: Action.UPDATE },
      { resource: Resource.WORKFLOW, action: Action.CREATE },
      { resource: Resource.WORKFLOW, action: Action.READ },
      { resource: Resource.WORKFLOW, action: Action.EXECUTE },
      { resource: Resource.AUDIT, action: Action.READ, conditions: { own: true } },
    ],
  },
  {
    name: UserRole.VIEWER,
    description: 'Read-only access to workspace data',
    permissions: [
      { resource: Resource.WORKSPACE, action: Action.READ },
      { resource: Resource.DOCUMENT, action: Action.READ },
      { resource: Resource.WORKFLOW, action: Action.READ },
      { resource: Resource.AUDIT, action: Action.READ, conditions: { own: true } },
    ],
  },
];

/**
 * RBAC service for authorization decisions
 */
export class RBACService {
  private rolePermissions: Map<UserRole, Permission[]>;

  constructor() {
    this.rolePermissions = new Map();
    this.initializeRoles();
  }

  /**
   * Initialize role permissions map
   */
  private initializeRoles(): void {
    for (const roleDef of ROLE_DEFINITIONS) {
      this.rolePermissions.set(roleDef.name, roleDef.permissions);
    }
  }

  /**
   * Check if user has permission for a specific action on a resource
   */
  hasPermission(
    userRoles: UserRole[],
    resource: Resource,
    action: Action,
    context?: RequestContext,
    resourceOwnerId?: string
  ): AuthorizationResult {
    // Check each role for the required permission
    for (const role of userRoles) {
      const permissions = this.rolePermissions.get(role);
      if (!permissions) continue;

      for (const permission of permissions) {
        if (this.matchesPermission(permission, resource, action, context, resourceOwnerId)) {
          return { allowed: true };
        }
      }
    }

    // Find the minimum required role for this permission
    const requiredRole = this.findMinimumRequiredRole(resource, action);

    return {
      allowed: false,
      reason: `Insufficient permissions for ${action} on ${resource}`,
      requiredRole,
    };
  }

  /**
   * Check if a permission matches the requested resource and action
   */
  private matchesPermission(
    permission: Permission,
    resource: Resource,
    action: Action,
    context?: RequestContext,
    resourceOwnerId?: string
  ): boolean {
    // Check resource match - exact match required unless permission has MANAGE action
    if (permission.resource !== resource) {
      return false;
    }

    // Check action match (MANAGE allows all actions on the resource)
    if (permission.action !== action && permission.action !== Action.MANAGE) {
      return false;
    }

    // Check conditions if present
    if (permission.conditions) {
      return this.evaluateConditions(permission.conditions, context, resourceOwnerId);
    }

    return true;
  }

  /**
   * Evaluate permission conditions
   */
  private evaluateConditions(
    conditions: Record<string, any>,
    context?: RequestContext,
    resourceOwnerId?: string
  ): boolean {
    // Check "own" condition - user can only access their own resources
    if (conditions.own === true) {
      if (!context || !resourceOwnerId) {
        return false;
      }
      return context.userId === resourceOwnerId;
    }

    // Check workspace isolation
    if (conditions.workspace === true) {
      if (!context) {
        return false;
      }
      // This would be checked against the resource's workspace
      // For now, we assume workspace isolation is handled at the data layer
      return true;
    }

    return true;
  }

  /**
   * Find the minimum role required for a permission
   */
  private findMinimumRequiredRole(resource: Resource, action: Action): UserRole | undefined {
    const roleHierarchy = [UserRole.VIEWER, UserRole.OPERATOR, UserRole.MANAGER, UserRole.ADMIN];

    for (const role of roleHierarchy) {
      const permissions = this.rolePermissions.get(role);
      if (!permissions) continue;

      const hasPermission = permissions.some(
        (p) =>
          p.resource === resource &&
          (p.action === action || p.action === Action.MANAGE)
      );

      if (hasPermission) {
        return role;
      }
    }

    return undefined;
  }

  /**
   * Get all permissions for a role
   */
  getRolePermissions(role: UserRole): Permission[] {
    return this.rolePermissions.get(role) || [];
  }

  /**
   * Get role definition
   */
  getRoleDefinition(role: UserRole): RoleDefinition | undefined {
    return ROLE_DEFINITIONS.find((def) => def.name === role);
  }

  /**
   * Get all role definitions
   */
  getAllRoleDefinitions(): RoleDefinition[] {
    return [...ROLE_DEFINITIONS];
  }

  /**
   * Check if user has any of the specified roles
   */
  hasAnyRole(userRoles: UserRole[], requiredRoles: UserRole[]): boolean {
    return requiredRoles.some((role) => userRoles.includes(role));
  }

  /**
   * Check if user has all of the specified roles
   */
  hasAllRoles(userRoles: UserRole[], requiredRoles: UserRole[]): boolean {
    return requiredRoles.every((role) => userRoles.includes(role));
  }
}

/**
 * Singleton RBAC service instance
 */
export const rbacService = new RBACService();