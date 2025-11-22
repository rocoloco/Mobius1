/**
 * Authentication Service
 * Handles user authentication, password validation, and session management
 */

import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { db } from '../database/client.js';
import { jwtService } from './jwt.js';
import type { AuthResult, LoginRequest, UserRole } from './types.js';

/**
 * Authentication service
 */
export class AuthService {
  /**
   * Authenticate user with email and password
   */
  async authenticate(loginRequest: LoginRequest): Promise<AuthResult> {
    try {
      // Find user by email
      const user = await db.user.findUnique({
        where: { email: loginRequest.email },
        include: {
          workspace: {
            select: {
              id: true,
              name: true,
              spainResidencyMode: true,
            },
          },
        },
      });

      if (!user) {
        return {
          success: false,
          error: 'Invalid credentials',
        };
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(loginRequest.password, user.password);
      if (!isValidPassword) {
        return {
          success: false,
          error: 'Invalid credentials',
        };
      }

      // Parse roles from database
      const roles = user.roles as UserRole[];

      // Generate JWT token
      const token = jwtService.generateToken(user.id, user.workspaceId, roles);

      // Update last login timestamp
      await db.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      // Log authentication event
      await this.logAuthEvent(user.id, user.workspaceId, 'USER_LOGIN');

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          workspaceId: user.workspaceId,
          roles,
        },
        token,
      };
    } catch (error) {
      console.error('Authentication error:', error);
      return {
        success: false,
        error: 'Authentication failed',
      };
    }
  }

  /**
   * Validate user session and extract context
   */
  async validateSession(token: string): Promise<AuthResult> {
    const validation = jwtService.validateToken(token);

    if (!validation.valid || !validation.payload) {
      return {
        success: false,
        error: validation.error || 'Invalid token',
      };
    }

    try {
      // Verify user still exists and is active
      const user = await db.user.findUnique({
        where: { id: validation.payload.sub },
        include: {
          workspace: {
            select: {
              id: true,
              name: true,
              spainResidencyMode: true,
            },
          },
        },
      });

      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      // Verify workspace matches token
      if (user.workspaceId !== validation.payload.workspaceId) {
        return {
          success: false,
          error: 'Workspace mismatch',
        };
      }

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          workspaceId: user.workspaceId,
          roles: validation.payload.roles,
        },
      };
    } catch (error) {
      console.error('Session validation error:', error);
      return {
        success: false,
        error: 'Session validation failed',
      };
    }
  }

  /**
   * Hash password for storage
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Log authentication events for audit trail
   */
  private async logAuthEvent(
    userId: string,
    workspaceId: string,
    eventType: 'USER_LOGIN' | 'USER_LOGOUT',
    metadata: any = {}
  ): Promise<void> {
    try {
      // Use the audit service for comprehensive logging
      const { auditService, AuditEventType, AuditSeverity } = await import('../audit/service.js');
      
      // Map event type to audit event type
      const auditEventType = eventType === 'USER_LOGIN' ? AuditEventType.USER_LOGIN : AuditEventType.USER_LOGOUT;
      
      await auditService.logEvent({
        eventType: auditEventType,
        severity: AuditSeverity.INFO,
        resourceId: userId,
        action: eventType.toLowerCase(),
        metadata: {
          ...metadata,
          authMethod: 'jwt',
          source: 'auth_service',
          timestamp: new Date().toISOString(),
        },
        correlationId: metadata.correlationId || randomUUID(),
        workspaceId,
        userId,
      });
    } catch (error) {
      console.error('Failed to log authentication event:', error);
      
      // Fallback to direct database logging if audit service fails
      try {
        await db.auditEvent.create({
          data: {
            workspaceId,
            userId,
            eventType,
            resourceId: userId,
            action: eventType.toLowerCase(),
            metadata: {
              timestamp: new Date().toISOString(),
              source: 'auth_service',
              ...metadata,
            },
            correlationId: metadata.correlationId || randomUUID(),
          },
        });
      } catch (fallbackError) {
        console.error('Failed to log authentication event (fallback):', fallbackError);
      }
    }
  }

  /**
   * Logout user and log event
   */
  async logout(userId: string, workspaceId: string): Promise<void> {
    await this.logAuthEvent(userId, workspaceId, 'USER_LOGOUT');
  }
}

/**
 * Singleton authentication service instance
 */
export const authService = new AuthService();