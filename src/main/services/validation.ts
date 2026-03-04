/**
 * IPC Input Validation Schemas
 * 
 * Provides lightweight validation for all IPC handlers.
 * Prevents renderer-triggered crashes from malformed data.
 */

import { createLogger } from './logger';

const logger = createLogger('validation');

export class ValidationError extends Error {
    constructor(public field: string, message: string) {
        super(`Validation failed on ${field}: ${message}`);
        this.name = 'ValidationError';
    }
}

// ── Type Guards ────────────────────────────────────────────

export function isString(val: unknown): val is string {
    return typeof val === 'string';
}

export function isNumber(val: unknown): val is number {
    return typeof val === 'number' && !isNaN(val);
}

export function isBoolean(val: unknown): val is boolean {
    return typeof val === 'boolean';
}

export function isArray(val: unknown): val is unknown[] {
    return Array.isArray(val);
}

export function isObject(val: unknown): val is Record<string, unknown> {
    return val !== null && typeof val === 'object' && !Array.isArray(val);
}

// ── Validators ─────────────────────────────────────────────

export function validateString(val: unknown, field: string, opts?: { minLength?: number; maxLength?: number; pattern?: RegExp }): string {
    if (!isString(val)) {
        throw new ValidationError(field, `expected string, got ${typeof val}`);
    }
    
    if (opts?.minLength !== undefined && val.length < opts.minLength) {
        throw new ValidationError(field, `string too short (min ${opts.minLength})`);
    }
    
    if (opts?.maxLength !== undefined && val.length > opts.maxLength) {
        throw new ValidationError(field, `string too long (max ${opts.maxLength})`);
    }
    
    if (opts?.pattern && !opts.pattern.test(val)) {
        throw new ValidationError(field, `does not match pattern ${opts.pattern}`);
    }
    
    return val;
}

export function validateNumber(val: unknown, field: string, opts?: { min?: number; max?: number; isInteger?: boolean }): number {
    if (!isNumber(val)) {
        throw new ValidationError(field, `expected number, got ${typeof val}`);
    }
    
    if (opts?.isInteger === true && !Number.isInteger(val)) {
        throw new ValidationError(field, `expected integer`);
    }
    
    if (opts?.min !== undefined && val < opts.min) {
        throw new ValidationError(field, `number too small (min ${opts.min})`);
    }
    
    if (opts?.max !== undefined && val > opts.max) {
        throw new ValidationError(field, `number too large (max ${opts.max})`);
    }
    
    return val;
}

export function validateBoolean(val: unknown, field: string): boolean {
    if (!isBoolean(val)) {
        throw new ValidationError(field, `expected boolean, got ${typeof val}`);
    }
    return val;
}

export function validateArray(val: unknown, field: string, opts?: { minLength?: number; maxLength?: number; itemType?: string }): unknown[] {
    if (!isArray(val)) {
        throw new ValidationError(field, `expected array, got ${typeof val}`);
    }
    
    if (opts?.minLength !== undefined && val.length < opts.minLength) {
        throw new ValidationError(field, `array too short (min ${opts.minLength})`);
    }
    
    if (opts?.maxLength !== undefined && val.length > opts.maxLength) {
        throw new ValidationError(field, `array too long (max ${opts.maxLength})`);
    }
    
    if (opts?.itemType === 'string') {
        for (let i = 0; i < val.length; i++) {
            if (!isString(val[i])) {
                throw new ValidationError(`${field}[${i}]`, `expected string, got ${typeof val[i]}`);
            }
        }
    }
    
    return val;
}

export function validateStringArray(val: unknown, field: string, opts?: { minLength?: number; maxLength?: number }): string[] {
    return validateArray(val, field, { ...opts, itemType: 'string' }) as string[];
}

export function validateUUID(val: unknown, field: string): string {
    const str = validateString(val, field);
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(str)) {
        throw new ValidationError(field, `invalid UUID format`);
    }
    return str;
}

export function validateFilePath(val: unknown, field: string): string {
    const str = validateString(val, field, { maxLength: 4096 });
    // Basic safety checks
    if (str.includes('..') || str.includes('\0')) {
        throw new ValidationError(field, `path contains suspicious characters`);
    }
    return str;
}

export function validateOptional<T>(val: unknown, validator: (v: unknown) => T): T | undefined {
    if (val === null || val === undefined) {
        return undefined;
    }
    return validator(val);
}

// ── Object Validation ──────────────────────────────────────

export interface Schema<T> {
    validate(data: unknown): T;
}

export function object<T>(shape: { [K in keyof T]: (val: unknown) => T[K] }): Schema<T> {
    return {
        validate(data: unknown): T {
            if (!isObject(data)) {
                throw new ValidationError('root', `expected object, got ${typeof data}`);
            }
            
            const result: any = {};
            for (const [key, validator] of Object.entries(shape)) {
                try {
                    result[key] = validator((data as any)[key]);
                } catch (err) {
                    if (err instanceof ValidationError) {
                        throw err;
                    }
                    throw new ValidationError(String(key), String(err));
                }
            }
            
            return result as T;
        }
    };
}

// ── Safe Handler Wrapper ──────────────────────────────────

export function withValidation<TArgs, TReturn>(
    validator: Schema<TArgs>,
    handler: (args: TArgs) => TReturn | Promise<TReturn>
) {
    return async (_event: any, ...args: unknown[]): Promise<TReturn> => {
        try {
            // If multiple args, wrap in object; if single, validate directly
            const toValidate = args.length === 1 ? args[0] : { args };
            const validated = validator.validate(toValidate);
            return await Promise.resolve(handler(validated));
        } catch (err) {
            if (err instanceof ValidationError) {
                logger.warn('IPC validation failed', err, { field: err.field });
                throw new Error(`Invalid input: ${err.message}`);
            }
            throw err;
        }
    };
}
