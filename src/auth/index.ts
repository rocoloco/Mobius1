/**
 * Authentication Module Exports
 * Central export point for all authentication functionality
 */

// Core services
export { authService } from './service.js';
export { jwtService } from './jwt.js';
export { rbacService } from './rbac.js';

// Middleware
export { 
  authMiddleware,
  createAuthMiddleware,
  createWorkspaceIsolationMiddleware,
  createSpainResidencyMiddleware,
  createAuditMiddleware,
  type AuthenticatedRequest,
  type AuthMiddlewareOptions,
} from './middleware.js';

// Routes
export { registerAuthRoutes } from './routes.js';

// Types
export type {
  UserRole,
  RequestContext,
  JWTPayload,
  AuthResult,
  LoginRequest,
  TokenValidationResult,
  Permission,
  RoleDefinition,
  AuthorizationResult,
} from './types.js';

export { UserRole } from './types.js';

// RBAC exports
export { Resource, Action } from './rbac.js';