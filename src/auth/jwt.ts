/**
 * JWT Token Management
 * Handles JWT token generation, validation, and workspace context
 */

import jwt from 'jsonwebtoken';
import { appConfig } from '../config/index.js';
import type { JWTPayload, TokenValidationResult, UserRole } from './types.js';

/**
 * JWT service for token operations
 */
export class JWTService {
  private readonly secret: string;
  private readonly issuer: string = 'mobius1-platform';
  private readonly expiresIn: string = '24h';

  constructor() {
    this.secret = appConfig.security.jwtSecret;
  }

  /**
   * Generate JWT token with workspace context
   */
  generateToken(userId: string, workspaceId: string, roles: UserRole[]): string {
    const payload = {
      sub: userId,
      workspaceId,
      roles,
    };

    return jwt.sign(payload, this.secret, {
      expiresIn: this.expiresIn,
      issuer: this.issuer,
    });
  }

  /**
   * Validate and decode JWT token
   */
  validateToken(token: string): TokenValidationResult {
    try {
      const payload = jwt.verify(token, this.secret, {
        issuer: this.issuer,
      }) as JWTPayload;

      // Validate payload structure
      if (!payload.sub || !payload.workspaceId || !payload.roles) {
        return {
          valid: false,
          error: 'Invalid token payload structure',
        };
      }

      return {
        valid: true,
        payload,
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return {
          valid: false,
          error: 'Token expired',
        };
      }

      if (error instanceof jwt.JsonWebTokenError) {
        return {
          valid: false,
          error: 'Invalid token',
        };
      }

      return {
        valid: false,
        error: 'Token validation failed',
      };
    }
  }

  /**
   * Extract token from Authorization header
   */
  extractTokenFromHeader(authHeader?: string): string | null {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }

  /**
   * Refresh token (generate new token with same payload but extended expiry)
   */
  refreshToken(token: string): TokenValidationResult & { newToken?: string } {
    const validation = this.validateToken(token);
    
    if (!validation.valid || !validation.payload) {
      return validation;
    }

    const newToken = this.generateToken(
      validation.payload.sub,
      validation.payload.workspaceId,
      validation.payload.roles
    );

    return {
      valid: true,
      payload: validation.payload,
      newToken,
    };
  }
}

/**
 * Singleton JWT service instance
 */
export const jwtService = new JWTService();