type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLogLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[currentLogLevel];
}

function formatError(error: unknown): LogEntry['error'] | undefined {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    };
  }
  if (error) {
    return {
      name: 'UnknownError',
      message: String(error),
    };
  }
  return undefined;
}

function createLogEntry(
  level: LogLevel,
  component: string,
  message: string,
  context?: LogContext,
  error?: unknown
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    component,
    message,
    ...(context && Object.keys(context).length > 0 ? { context } : {}),
    ...(error ? { error: formatError(error) } : {}),
  };
}

function outputLog(entry: LogEntry): void {
  const output = JSON.stringify(entry);
  switch (entry.level) {
    case 'error':
      console.error(output);
      break;
    case 'warn':
      console.warn(output);
      break;
    default:
      console.log(output);
  }
}

export function createLogger(component: string) {
  return {
    debug(message: string, context?: LogContext) {
      if (shouldLog('debug')) {
        outputLog(createLogEntry('debug', component, message, context));
      }
    },
    info(message: string, context?: LogContext) {
      if (shouldLog('info')) {
        outputLog(createLogEntry('info', component, message, context));
      }
    },
    warn(message: string, context?: LogContext, error?: unknown) {
      if (shouldLog('warn')) {
        outputLog(createLogEntry('warn', component, message, context, error));
      }
    },
    error(message: string, context?: LogContext, error?: unknown) {
      if (shouldLog('error')) {
        outputLog(createLogEntry('error', component, message, context, error));
      }
    },
  };
}

export type Logger = ReturnType<typeof createLogger>;
