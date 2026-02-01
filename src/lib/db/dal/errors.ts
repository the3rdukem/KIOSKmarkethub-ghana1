import { createLogger } from '@/lib/utils/logger';

export type DALErrorCode = 
  | 'NOT_FOUND'
  | 'DUPLICATE'
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'DATABASE_ERROR'
  | 'TRANSACTION_FAILED'
  | 'CONSTRAINT_VIOLATION';

export interface DALError {
  code: DALErrorCode;
  message: string;
  details?: string;
  field?: string;
}

export interface DALResult<T> {
  success: boolean;
  data?: T;
  error?: DALError;
}

export function createDALError(
  code: DALErrorCode,
  message: string,
  details?: string,
  field?: string
): DALError {
  return { code, message, details, field };
}

export function success<T>(data: T): DALResult<T> {
  return { success: true, data };
}

export function failure<T>(error: DALError): DALResult<T> {
  return { success: false, error };
}

export function handleDALError(
  logger: ReturnType<typeof createLogger>,
  operation: string,
  error: unknown
): DALError {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorDetails = error instanceof Error ? error.stack : undefined;

  logger.error(`${operation} failed`, { operation }, error);

  if (errorMessage.includes('duplicate key') || errorMessage.includes('unique constraint')) {
    return createDALError('DUPLICATE', 'A record with this value already exists', errorDetails);
  }

  if (errorMessage.includes('foreign key') || errorMessage.includes('violates')) {
    return createDALError('CONSTRAINT_VIOLATION', 'Operation violates data constraints', errorDetails);
  }

  if (errorMessage.includes('not found') || errorMessage.includes('no rows')) {
    return createDALError('NOT_FOUND', 'Record not found', errorDetails);
  }

  return createDALError('DATABASE_ERROR', 'Database operation failed', errorDetails);
}

export function getHttpStatus(code: DALErrorCode): number {
  switch (code) {
    case 'NOT_FOUND': return 404;
    case 'DUPLICATE': return 409;
    case 'VALIDATION': return 400;
    case 'UNAUTHORIZED': return 401;
    case 'FORBIDDEN': return 403;
    case 'CONSTRAINT_VIOLATION': return 422;
    case 'DATABASE_ERROR': return 500;
    case 'TRANSACTION_FAILED': return 500;
    default: return 500;
  }
}
