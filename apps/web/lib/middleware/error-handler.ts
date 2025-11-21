import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AppError, ValidationError } from '@/lib/errors';
import { createLogger } from '@/lib/logger';

const log = createLogger('middleware:error-handler');

/**
 * Handle errors and return appropriate NextResponse
 * @param error - Error to handle
 * @returns NextResponse with error details
 */
export function handleError(error: unknown): NextResponse {
  // Handle AppError instances
  if (error instanceof AppError) {
    log.warn(
      {
        error: error.message,
        code: error.code,
        statusCode: error.statusCode,
        metadata: error.metadata,
      },
      'Application error'
    );

    return NextResponse.json(error.toJSON(), { status: error.statusCode });
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    log.warn({ errors: error.errors }, 'Validation error');

    const validationError = new ValidationError('Validation failed', error.errors);
    return NextResponse.json(validationError.toJSON(), { status: 400 });
  }

  // Handle unknown errors
  log.error(
    {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    },
    'Unexpected error'
  );

  return NextResponse.json(
    {
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    },
    { status: 500 }
  );
}

/**
 * Wrap an async handler with error handling
 * @param handler - Async handler function
 * @returns Wrapped handler with error handling
 *
 * @example
 * export async function GET(req: NextRequest) {
 *   return withErrorHandler(async () => {
 *     const data = await fetchData();
 *     return NextResponse.json(data);
 *   });
 * }
 */
export async function withErrorHandler(
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    return await handler();
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Wrap a handler with error handling and logging
 * Includes request/response logging for debugging
 * @param handler - Handler function
 * @param context - Context for logging (e.g., 'api:challenges')
 * @returns Wrapped handler with error handling and logging
 */
export function withErrorHandlerAndLogging(
  handler: (req: any) => Promise<NextResponse>,
  context: string
) {
  const logger = createLogger(context);

  return async (req: any, ...args: any[]) => {
    const startTime = Date.now();

    try {
      logger.debug(
        {
          method: req.method,
          url: req.url,
        },
        'Request received'
      );

      const response = await handler(req, ...args);
      const duration = Date.now() - startTime;

      logger.info(
        {
          method: req.method,
          url: req.url,
          status: response.status,
          duration,
        },
        'Request completed'
      );

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error(
        {
          method: req.method,
          url: req.url,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration,
        },
        'Request failed'
      );

      return handleError(error);
    }
  };
}
