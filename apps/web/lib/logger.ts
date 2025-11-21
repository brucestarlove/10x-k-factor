import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isTest ? 'silent' : 'info'),
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      '*.password',
      '*.token',
      '*.secret',
      '*.authorization',
      '*.cookie',
      'req.headers.authorization',
      'req.headers.cookie'
    ],
    remove: true,
  },
  ...(isDevelopment && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  }),
});

/**
 * Create a child logger with context
 * @param context - Context string (e.g., 'api:challenges')
 * @returns Child logger instance
 */
export function createLogger(context: string) {
  return logger.child({ context });
}

/**
 * Log levels:
 * - trace: Very detailed logs
 * - debug: Debug information
 * - info: General information
 * - warn: Warning messages
 * - error: Error messages
 * - fatal: Fatal errors
 *
 * Usage:
 * ```typescript
 * import { createLogger } from '@/lib/logger';
 * const log = createLogger('api:challenges');
 *
 * log.info({ challengeId, userId }, 'Challenge completed');
 * log.error({ error, challengeId }, 'Failed to update challenge');
 * log.warn({ userId }, 'Rate limit approaching');
 * ```
 */
