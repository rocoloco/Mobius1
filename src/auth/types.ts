/**
 * Authentication and Authorization Types
 * Core types for JWT tokens, user context, and RBAC
 */

import { z } from 'zod';

/**
 * User roles in the system
 */
export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  OPERATOR = 'operator',
  VIEWER = 'viewer',
}

/**
 * Request context extracted from JWT and middleware
 */
export interface RequestContext {
  workspaceId: string;
  userId: string;
  roles: UserRole[];
  clientIP: string;
  userAgent: string;
  correlationId: string;
  timestamp: Date;
}

/**
 * JWT payload structure
 */
export interface JWTPayload {
  sub: string; // userId
  workspaceId: string;
  roles: UserRole[];
  iat: number;
  exp: number;
  iss: string;
}

/**
 * Authentication result
 */
export interface AuthResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
    workspaceId: string;
    roles: UserRole[];
  };
  token?: string;
  error?: string;
}

/**
 * Login request schema
 */
export const LoginRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

/**
 * Token validation result
 */
export interface TokenValidationResult {
  valid: boolean;
  payload?: JWTPayload;
  error?: string;
}

/**
 * RBAC permission structure
 */
export interface Permission {
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

/**
 * Role definition with permissions
 */
export interface RoleDefinition {
  name: UserRole;
  permissions: Permission[];
  description: string;
}

/**
 * Authorization result
 */
export interface AuthorizationResult {
  allowed: boolean;
  reason?: string;
  requiredRole?: UserRole;
}