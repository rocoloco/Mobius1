/**
 * API Middleware
 * Request/response middleware for API layer
 */

import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { APIErrorCode, createErrorResponse } from './errors.js';
import { generateSecureToken } from '../security/encryption.js';

/**
 * Add correlation ID to all requests
 */
export async function correlationIdMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const correlationId =
    (request.headers['x-correlation-id'] as string) ||
    (request.headers['x-request-id'] as string) ||
    generateSecureToken(16);

  request.headers['x-correlation-id'] = correlationId;
  reply.header('x-correlation-id', correlationId);
}

/**
 * Add standard response headers
 */
export async function responseHeadersMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  reply.header('x-api-version', 'v1');
  reply.header('x-powered-by', 'Mobius1');
}

/**
 * Idempotency key validation
 */
export async function idempotencyMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Only apply to POST, PUT, PATCH, DELETE
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    return;
  }

  const idempotencyKey = request.headers['idempotency-key'] as string;
  
  if (!idempotencyKey) {
    // Idempotency key is optional but recommended
    return;
  }

  // TODO: Check Redis cache for previous response with this key
  // For now, just validate format
  if (idempotencyKey.length < 16 || idempotencyKey.length > 255) {
    reply.status(400).send(
      createErrorResponse(
        APIErrorCode.INVALID_REQUEST,
        'Idempotency-Key must be between 16 and 255 characters',
        { header: 'Idempotency-Key' },
        request.headers['x-correlation-id'] as string,
        request.url
      )
    );
    return;
  }
}

/**
 * Request validation middleware
 */
export async function requestValidationMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Validate Content-Type for POST/PUT/PATCH
  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    const contentType = request.headers['content-type'];
    
    if (!contentType) {
      reply.status(400).send(
        createErrorResponse(
          APIErrorCode.INVALID_REQUEST,
          'Content-Type header is required',
          { header: 'Content-Type' },
          request.headers['x-correlation-id'] as string,
          request.url
        )
      );
      return;
    }

    // Allow application/json and multipart/form-data
    const validTypes = ['application/json', 'multipart/form-data'];
    const isValid = validTypes.some(type => contentType.includes(type));
    
    if (!isValid) {
      reply.status(415).send(
        createErrorResponse(
          APIErrorCode.INVALID_REQUEST,
          `Unsupported Content-Type. Supported types: ${validTypes.join(', ')}`,
          { contentType, supportedTypes: validTypes },
          request.headers['x-correlation-id'] as string,
          request.url
        )
      );
      return;
    }
  }
}

/**
 * Pagination helper
 */
export interface PaginationParams {
  limit: number;
  offset: number;
  page?: number;
}

export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
  hasPrevious: boolean;
}

export function parsePaginationParams(query: any): PaginationParams {
  const limit = Math.min(Math.max(parseInt(query.limit) || 50, 1), 100);
  const offset = Math.max(parseInt(query.offset) || 0, 0);
  const page = Math.max(parseInt(query.page) || 1, 1);

  return {
    limit,
    offset: query.page ? (page - 1) * limit : offset,
    page,
  };
}

export function createPaginationMeta(
  total: number,
  params: PaginationParams
): PaginationMeta {
  const totalPages = Math.ceil(total / params.limit);
  const currentPage = params.page || Math.floor(params.offset / params.limit) + 1;

  return {
    total,
    limit: params.limit,
    offset: params.offset,
    page: currentPage,
    totalPages,
    hasMore: params.offset + params.limit < total,
    hasPrevious: params.offset > 0,
  };
}

/**
 * Standard API response wrapper
 */
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: any;
  meta?: any;
  timestamp: string;
  correlationId?: string;
}

export function createSuccessResponse<T>(
  data: T,
  meta?: any,
  correlationId?: string
): APIResponse<T> {
  return {
    success: true,
    data,
    meta,
    timestamp: new Date().toISOString(),
    correlationId,
  };
}

export function createErrorResponseWrapper(
  error: any,
  correlationId?: string
): APIResponse {
  return {
    success: false,
    error,
    timestamp: new Date().toISOString(),
    correlationId,
  };
}
