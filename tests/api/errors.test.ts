/**
 * API Error Handling Tests
 */

import { describe, it, expect } from 'vitest';
import {
  APIErrorCode,
  createErrorResponse,
  getStatusCodeForError,
  APIException,
} from '../../src/api/errors.js';

describe('API Error Handling', () => {
  describe('createErrorResponse', () => {
    it('should create error response with required fields', () => {
      const error = createErrorResponse(
        APIErrorCode.VALIDATION_ERROR,
        'Invalid input'
      );

      expect(error.code).toBe(APIErrorCode.VALIDATION_ERROR);
      expect(error.message).toBe('Invalid input');
      expect(error.timestamp).toBeDefined();
      expect(new Date(error.timestamp)).toBeInstanceOf(Date);
    });

    it('should include optional fields when provided', () => {
      const error = createErrorResponse(
        APIErrorCode.RESOURCE_NOT_FOUND,
        'User not found',
        { userId: '123' },
        'corr-123',
        '/api/v1/users/123'
      );

      expect(error.details).toEqual({ userId: '123' });
      expect(error.correlationId).toBe('corr-123');
      expect(error.path).toBe('/api/v1/users/123');
    });
  });

  describe('getStatusCodeForError', () => {
    it('should return 400 for validation errors', () => {
      expect(getStatusCodeForError(APIErrorCode.VALIDATION_ERROR)).toBe(400);
      expect(getStatusCodeForError(APIErrorCode.INVALID_REQUEST)).toBe(400);
    });

    it('should return 403 for policy violations', () => {
      expect(getStatusCodeForError(APIErrorCode.POLICY_VIOLATION)).toBe(403);
      expect(getStatusCodeForError(APIErrorCode.RESIDENCY_VIOLATION)).toBe(403);
    });

    it('should return 404 for resource not found', () => {
      expect(getStatusCodeForError(APIErrorCode.RESOURCE_NOT_FOUND)).toBe(404);
    });

    it('should return 409 for resource conflicts', () => {
      expect(getStatusCodeForError(APIErrorCode.RESOURCE_ALREADY_EXISTS)).toBe(409);
      expect(getStatusCodeForError(APIErrorCode.RESOURCE_CONFLICT)).toBe(409);
    });

    it('should return 401 for authentication errors', () => {
      expect(getStatusCodeForError(APIErrorCode.UNAUTHORIZED)).toBe(401);
      expect(getStatusCodeForError(APIErrorCode.TOKEN_EXPIRED)).toBe(401);
    });

    it('should return 403 for authorization errors', () => {
      expect(getStatusCodeForError(APIErrorCode.FORBIDDEN)).toBe(403);
    });

    it('should return 429 for rate limiting', () => {
      expect(getStatusCodeForError(APIErrorCode.RATE_LIMIT_EXCEEDED)).toBe(429);
      expect(getStatusCodeForError(APIErrorCode.QUOTA_EXCEEDED)).toBe(429);
    });

    it('should return 500 for system errors', () => {
      expect(getStatusCodeForError(APIErrorCode.INTERNAL_ERROR)).toBe(500);
      expect(getStatusCodeForError(APIErrorCode.DATABASE_ERROR)).toBe(500);
    });

    it('should return 503 for service unavailable', () => {
      expect(getStatusCodeForError(APIErrorCode.SERVICE_UNAVAILABLE)).toBe(503);
    });

    it('should return 422 for processing errors', () => {
      expect(getStatusCodeForError(APIErrorCode.PROCESSING_FAILED)).toBe(422);
      expect(getStatusCodeForError(APIErrorCode.OCR_FAILED)).toBe(422);
    });
  });

  describe('APIException', () => {
    it('should create exception with correct properties', () => {
      const exception = new APIException(
        APIErrorCode.VALIDATION_ERROR,
        'Invalid data',
        { field: 'email' }
      );

      expect(exception.code).toBe(APIErrorCode.VALIDATION_ERROR);
      expect(exception.message).toBe('Invalid data');
      expect(exception.details).toEqual({ field: 'email' });
      expect(exception.statusCode).toBe(400);
      expect(exception.name).toBe('APIException');
    });

    it('should use custom status code if provided', () => {
      const exception = new APIException(
        'CUSTOM_ERROR',
        'Custom error',
        undefined,
        418
      );

      expect(exception.statusCode).toBe(418);
    });

    it('should serialize to JSON correctly', () => {
      const exception = new APIException(
        APIErrorCode.RESOURCE_NOT_FOUND,
        'Document not found',
        { documentId: 'doc-123' }
      );

      const json = exception.toJSON();

      expect(json.code).toBe(APIErrorCode.RESOURCE_NOT_FOUND);
      expect(json.message).toBe('Document not found');
      expect(json.details).toEqual({ documentId: 'doc-123' });
      expect(json.timestamp).toBeDefined();
    });
  });

  describe('Error Code Patterns', () => {
    it('should have consistent error code format', () => {
      const codes = Object.values(APIErrorCode);

      codes.forEach(code => {
        expect(code).toMatch(/^E\d{3}$/);
      });
    });

    it('should have unique error codes', () => {
      const codes = Object.values(APIErrorCode);
      const uniqueCodes = new Set(codes);

      expect(uniqueCodes.size).toBe(codes.length);
    });
  });
});
