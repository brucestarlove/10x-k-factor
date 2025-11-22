/**
 * Base application error class
 * All custom errors should extend this class
 */
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    // Maintains proper stack trace for where error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      statusCode: this.statusCode,
      ...(this.metadata && { metadata: this.metadata }),
    };
  }
}

/**
 * Validation error (400)
 * Use when request validation fails
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', { details });
    this.name = 'ValidationError';
  }
}

/**
 * Unauthorized error (401)
 * Use when authentication is required but not provided
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

/**
 * Forbidden error (403)
 * Use when user is authenticated but doesn't have permission
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

/**
 * Not found error (404)
 * Use when a resource cannot be found
 */
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      `${resource} not found${id ? `: ${id}` : ''}`,
      404,
      'NOT_FOUND',
      { resource, id }
    );
    this.name = 'NotFoundError';
  }
}

/**
 * Conflict error (409)
 * Use when a resource already exists or there's a conflict
 */
export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 409, 'CONFLICT', { details });
    this.name = 'ConflictError';
  }
}

/**
 * Rate limit error (429)
 * Use when rate limit is exceeded
 */
export class RateLimitError extends AppError {
  constructor(resetAt?: Date) {
    super(
      'Rate limit exceeded',
      429,
      'RATE_LIMIT_EXCEEDED',
      { resetAt: resetAt?.toISOString() }
    );
    this.name = 'RateLimitError';
  }
}

/**
 * Internal server error (500)
 * Use for unexpected errors
 */
export class InternalError extends AppError {
  constructor(message: string = 'Internal server error', metadata?: Record<string, unknown>) {
    super(message, 500, 'INTERNAL_ERROR', metadata);
    this.name = 'InternalError';
  }
}

/**
 * Service unavailable error (503)
 * Use when a dependent service is unavailable
 */
export class ServiceUnavailableError extends AppError {
  constructor(service: string, message?: string) {
    super(
      message || `Service unavailable: ${service}`,
      503,
      'SERVICE_UNAVAILABLE',
      { service }
    );
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Type guard to check if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
