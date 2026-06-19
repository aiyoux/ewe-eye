export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const RUNTIME_NOTICE_EVENT = '__modular_runtime_notice__';

const LOG_PRIORITY: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

function shouldLog(current: LogLevel, target: LogLevel) {
  return LOG_PRIORITY[current] >= LOG_PRIORITY[target];
}

function normalizeArg(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  if (arg instanceof Error) return arg.message;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

function emitRuntimeNotice(scope: string, level: 'error' | 'warn', message: string, args: unknown[]) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(RUNTIME_NOTICE_EVENT, {
      detail: {
        scope,
        level,
        message,
        detail: args.map(normalizeArg).filter(Boolean).join(' ')
      }
    })
  );
}

export function createLogger(scope: string, level: LogLevel) {
  const prefix = `[${scope}]`;

  return {
    error(message: string, ...args: unknown[]) {
      emitRuntimeNotice(scope, 'error', message, args);
      if (shouldLog(level, 'error')) console.error(prefix, message, ...args);
    },
    warn(message: string, ...args: unknown[]) {
      emitRuntimeNotice(scope, 'warn', message, args);
      if (shouldLog(level, 'warn')) console.warn(prefix, message, ...args);
    },
    info(message: string, ...args: unknown[]) {
      if (shouldLog(level, 'info')) console.info(prefix, message, ...args);
    },
    debug(message: string, ...args: unknown[]) {
      if (shouldLog(level, 'debug')) console.debug(prefix, message, ...args);
    }
  };
}
