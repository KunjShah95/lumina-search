export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
};

function resolveLogLevel(): LogLevel {
    const raw = (process.env.LOG_LEVEL || '').toLowerCase().trim();
    if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') {
        return raw;
    }

    return process.env.NODE_ENV === 'development' ? 'debug' : 'info';
}

const activeLevel = resolveLogLevel();

function isEnabled(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[activeLevel];
}

function toErrorDetails(error: unknown): unknown {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack,
        };
    }
    return error;
}

function write(level: LogLevel, scope: string, message: string, meta?: Record<string, unknown>): void {
    if (!isEnabled(level)) {
        return;
    }

    const payload: Record<string, unknown> = {
        ts: new Date().toISOString(),
        level,
        scope,
        msg: message,
    };

    if (meta && Object.keys(meta).length > 0) {
        payload.meta = meta;
    }

    const line = JSON.stringify(payload);

    if (level === 'error') {
        console.error(line);
        return;
    }

    if (level === 'warn') {
        console.warn(line);
        return;
    }

    console.log(line);
}

export interface Logger {
    debug(message: string, meta?: Record<string, unknown>): void;
    info(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    error(message: string, error?: unknown, meta?: Record<string, unknown>): void;
    child(scopeSuffix: string): Logger;
}

class ScopedLogger implements Logger {
    constructor(private readonly scope: string) { }

    debug(message: string, meta?: Record<string, unknown>): void {
        write('debug', this.scope, message, meta);
    }

    info(message: string, meta?: Record<string, unknown>): void {
        write('info', this.scope, message, meta);
    }

    warn(message: string, meta?: Record<string, unknown>): void {
        write('warn', this.scope, message, meta);
    }

    error(message: string, error?: unknown, meta?: Record<string, unknown>): void {
        write('error', this.scope, message, {
            ...meta,
            error: toErrorDetails(error),
        });
    }

    child(scopeSuffix: string): Logger {
        return new ScopedLogger(`${this.scope}:${scopeSuffix}`);
    }
}

export function createLogger(scope: string): Logger {
    return new ScopedLogger(scope);
}
