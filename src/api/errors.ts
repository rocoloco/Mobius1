/**
 * API Error Handling
 * Standardized error codes and error response formatting
 */

/**
 * Standard API error codes
 */
export enum APIErrorCode {
  // Validation Errors (E001-E099)
  VALIDATION_ERROR = 'E001',
  INVALID_REQUEST = 'E002',
  MISSING_REQUIRED_FIELD = 'E003',
  INVALID_FORMAT = 'E004',
  
  // Policy Violations (E100-E199)
  POLICY_VIOLATION = 'E100',
  RESIDENCY_VIOLATION = 'E101',
  PII_VIOLATION = 'E102',
  
  // Resource Errors (E200-E299)
  RESOURCE_NOT_FOUND = 'E200',
  RESOURCE_ALREADY_EXISTS = 'E201',
  RESOURCE_CONFLICT = 'E202',
  
  // Authentication/Authorization (E300-E399)
  UNAUTHORIZED = 'E300',
  FORBIDDEN = 'E301',
  TOKEN_EXPIRED = 'E302',
  TOKEN_INVALID = 'E303',
  
  // Rate Limiting (E400-E499)
  RATE_LIMIT_EXCEEDED = 'E400',
  QUOTA_EXCEEDED = 'E401',
  BUDGET_EXCEEDED = 'E402',
  
  // System Errors (E500-E599)
  INTERNAL_ERROR = 'E500',
  SERVICE_UNAVAILABLE = 'E501',
  DATABASE_ERROR = 'E502',
  EXTERNAL_SERVICE_ERROR = 'E503',
  
  // Processing Errors (E600-E699)
  PROCESSING_FAILED = 'E600',
  OCR_FAILED = 'E601',
  WORKFLOW_FAILED = 'E602',
  INFERENCE_FAILED = 'E603',
}

/**
 * Standard API error response
 */
export interface APIError {
  code: APIErrorCode | string;
  message: string;
  details?: any;
  correlationId?: string;
  timestamp: string;
  path?: string;
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  code: APIErrorCode | string,
  message: string,
  details?: any,
  correlationId?: string,
  path?: string
): APIError {
  return {
    code,
    message,
    details,
    correlationId,
    timestamp: new Date().toISOString(),
    path,
  };
}

/**
 * Map HTTP status codes to error codes
 */
export function getStatusCodeForError(code: APIErrorCode | string): number {
  const codeStr = code.toString();
  
  // Validation errors
  if (codeStr.startsWith('E00')) return 400;
  
  // Policy violations
  if (codeStr.startsWith('E1')) return 403;
  
  // Resource errors
  if (codeStr.startsWith('E2')) {
    if (code === APIErrorCode.RESOURCE_NOT_FOUND) return 404;
    if (code === APIErrorCode.RESOURCE_ALREADY_EXISTS) return 409;
    if (code === APIErrorCode.RESOURCE_CONFLICT) return 409;
    return 400;
  }
  
  // Authentication/Authorization
  if (codeStr.startsWith('E3')) {
    if (code === APIErrorCode.UNAUTHORIZED) return 401;
    if (code === APIErrorCode.FORBIDDEN) return 403;
    return 401;
  }
  
  // Rate limiting
  if (codeStr.startsWith('E4')) return 429;
  
  // System errors
  if (codeStr.startsWith('E5')) {
    if (code === APIErrorCode.SERVICE_UNAVAILABLE) return 503;
    return 500;
  }
  
  // Processing errors
  if (codeStr.startsWith('E6')) return 422;
  
  // Default
  return 500;
}

/**
 * Custom error class for API errors
 */
export class APIException extends Error {
  constructor(
    public code: APIErrorCode | string,
    message: string,
    public details?: any,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'APIException';
    this.statusCode = statusCode || getStatusCodeForError(code);
  }

  toJSON(): APIError {
    return createErrorResponse(this.code, this.message, this.details);
  }
}
