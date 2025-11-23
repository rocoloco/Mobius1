/**
 * API Middleware Tests
 */

import { describe, it, expect } from 'vitest';
import {
  parsePaginationParams,
  createPaginationMeta,
  createSuccessResponse,
  createErrorResponseWrapper,
} from '../../src/api/middleware.js';

describe('API Middleware', () => {
  describe('parsePaginationParams', () => {
    it('should use default values when no params provided', () => {
      const params = parsePaginationParams({});

      expect(params.limit).toBe(50);
      expect(params.offset).toBe(0);
      expect(params.page).toBe(1);
    });

    it('should parse limit and offset', () => {
      const params = parsePaginationParams({
        limit: '25',
        offset: '100',
      });

      expect(params.limit).toBe(25);
      expect(params.offset).toBe(100);
    });

    it('should enforce minimum limit of 1', () => {
      const params = parsePaginationParams({ limit: '0' });
      expect(params.limit).toBe(1);

      const params2 = parsePaginationParams({ limit: '-5' });
      expect(params2.limit).toBe(1);
    });

    it('should enforce maximum limit of 100', () => {
      const params = parsePaginationParams({ limit: '200' });
      expect(params.limit).toBe(100);
    });

    it('should enforce minimum offset of 0', () => {
      const params = parsePaginationParams({ offset: '-10' });
      expect(params.offset).toBe(0);
    });

    it('should calculate offset from page number', () => {
      const params = parsePaginationParams({
        page: '3',
        limit: '20',
      });

      expect(params.offset).toBe(40); // (3-1) * 20
      expect(params.page).toBe(3);
    });

    it('should prefer explicit offset over page', () => {
      const params = parsePaginationParams({
        page: '2',
        offset: '75',
        limit: '25',
      });

      expect(params.offset).toBe(75);
    });
  });

  describe('createPaginationMeta', () => {
    it('should create pagination metadata', () => {
      const meta = createPaginationMeta(150, {
        limit: 50,
        offset: 0,
        page: 1,
      });

      expect(meta.total).toBe(150);
      expect(meta.limit).toBe(50);
      expect(meta.offset).toBe(0);
      expect(meta.page).toBe(1);
      expect(meta.totalPages).toBe(3);
      expect(meta.hasMore).toBe(true);
      expect(meta.hasPrevious).toBe(false);
    });

    it('should indicate no more pages on last page', () => {
      const meta = createPaginationMeta(150, {
        limit: 50,
        offset: 100,
        page: 3,
      });

      expect(meta.hasMore).toBe(false);
      expect(meta.hasPrevious).toBe(true);
    });

    it('should handle empty results', () => {
      const meta = createPaginationMeta(0, {
        limit: 50,
        offset: 0,
        page: 1,
      });

      expect(meta.total).toBe(0);
      expect(meta.totalPages).toBe(0);
      expect(meta.hasMore).toBe(false);
      expect(meta.hasPrevious).toBe(false);
    });

    it('should calculate current page from offset', () => {
      const meta = createPaginationMeta(200, {
        limit: 25,
        offset: 75,
      });

      expect(meta.page).toBe(4); // floor(75/25) + 1
    });
  });

  describe('createSuccessResponse', () => {
    it('should create success response with data', () => {
      const response = createSuccessResponse({ id: '123', name: 'Test' });

      expect(response.success).toBe(true);
      expect(response.data).toEqual({ id: '123', name: 'Test' });
      expect(response.timestamp).toBeDefined();
      expect(new Date(response.timestamp)).toBeInstanceOf(Date);
    });

    it('should include metadata when provided', () => {
      const response = createSuccessResponse(
        [{ id: '1' }, { id: '2' }],
        { total: 2, page: 1 }
      );

      expect(response.meta).toEqual({ total: 2, page: 1 });
    });

    it('should include correlation ID when provided', () => {
      const response = createSuccessResponse(
        { result: 'ok' },
        undefined,
        'corr-456'
      );

      expect(response.correlationId).toBe('corr-456');
    });
  });

  describe('createErrorResponseWrapper', () => {
    it('should create error response wrapper', () => {
      const response = createErrorResponseWrapper({
        code: 'E001',
        message: 'Validation failed',
      });

      expect(response.success).toBe(false);
      expect(response.error).toEqual({
        code: 'E001',
        message: 'Validation failed',
      });
      expect(response.timestamp).toBeDefined();
    });

    it('should include correlation ID', () => {
      const response = createErrorResponseWrapper(
        { code: 'E500', message: 'Server error' },
        'corr-789'
      );

      expect(response.correlationId).toBe('corr-789');
    });
  });

  describe('Pagination Edge Cases', () => {
    it('should handle single page of results', () => {
      const meta = createPaginationMeta(25, {
        limit: 50,
        offset: 0,
        page: 1,
      });

      expect(meta.totalPages).toBe(1);
      expect(meta.hasMore).toBe(false);
      expect(meta.hasPrevious).toBe(false);
    });

    it('should handle exact page boundary', () => {
      const meta = createPaginationMeta(100, {
        limit: 50,
        offset: 50,
        page: 2,
      });

      expect(meta.totalPages).toBe(2);
      expect(meta.hasMore).toBe(false);
      expect(meta.hasPrevious).toBe(true);
    });

    it('should handle large datasets', () => {
      const meta = createPaginationMeta(10000, {
        limit: 100,
        offset: 5000,
        page: 51,
      });

      expect(meta.totalPages).toBe(100);
      expect(meta.hasMore).toBe(true);
      expect(meta.hasPrevious).toBe(true);
    });
  });
});
