import { describe, it, expect } from 'vitest'
import { 
    isString, isNumber, isBoolean, isArray, isObject,
    validateString, validateNumber, validateBoolean, validateArray,
    validateStringArray, validateUUID, validateFilePath,
    object, ValidationError
} from '../src/main/services/validation'

describe('Validation Service', () => {
    describe('Type Guards', () => {
        it('isString correctly identifies strings', () => {
            expect(isString('hello')).toBe(true)
            expect(isString('')).toBe(true)
            expect(isString(123)).toBe(false)
            expect(isString(null)).toBe(false)
        })

        it('isNumber correctly identifies numbers', () => {
            expect(isNumber(123)).toBe(true)
            expect(isNumber(0)).toBe(true)
            expect(isNumber(-1.5)).toBe(true)
            expect(isNumber('123')).toBe(false)
            expect(isNumber(NaN)).toBe(false)
        })

        it('isBoolean correctly identifies booleans', () => {
            expect(isBoolean(true)).toBe(true)
            expect(isBoolean(false)).toBe(true)
            expect(isBoolean(1)).toBe(false)
            expect(isBoolean('true')).toBe(false)
        })

        it('isArray correctly identifies arrays', () => {
            expect(isArray([])).toBe(true)
            expect(isArray([1, 2, 3])).toBe(true)
            expect(isArray({})).toBe(false)
            expect(isArray('[]')).toBe(false)
        })

        it('isObject correctly identifies objects', () => {
            expect(isObject({})).toBe(true)
            expect(isObject({ a: 1 })).toBe(true)
            expect(isObject([])).toBe(false)
            expect(isObject(null)).toBe(false)
            expect(isObject('{}')).toBe(false)
        })
    })

    describe('validateString', () => {
        it('validates string type', () => {
            expect(validateString('test', 'field')).toBe('test')
        })

        it('throws for non-string', () => {
            expect(() => validateString(123, 'field')).toThrow(ValidationError)
        })

        it('enforces minLength', () => {
            expect(() => validateString('ab', 'field', { minLength: 3 })).toThrow('too short')
        })

        it('enforces maxLength', () => {
            expect(() => validateString('abcdef', 'field', { maxLength: 3 })).toThrow('too long')
        })

        it('enforces pattern', () => {
            expect(() => validateString('abc', 'field', { pattern: /^\d+$/ })).toThrow('pattern')
            expect(validateString('123', 'field', { pattern: /^\d+$/ })).toBe('123')
        })
    })

    describe('validateNumber', () => {
        it('validates number type', () => {
            expect(validateNumber(42, 'field')).toBe(42)
        })

        it('throws for non-number', () => {
            expect(() => validateNumber('42', 'field')).toThrow(ValidationError)
        })

        it('enforces min/max', () => {
            expect(() => validateNumber(1, 'field', { min: 5 })).toThrow('too small')
            expect(() => validateNumber(100, 'field', { max: 50 })).toThrow('too large')
        })

        it('enforces integer', () => {
            expect(() => validateNumber(3.14, 'field', { isInteger: true })).toThrow('integer')
            expect(validateNumber(42, 'field', { isInteger: true })).toBe(42)
        })
    })

    describe('validateBoolean', () => {
        it('validates boolean type', () => {
            expect(validateBoolean(true, 'field')).toBe(true)
            expect(validateBoolean(false, 'field')).toBe(false)
        })

        it('throws for non-boolean', () => {
            expect(() => validateBoolean(1, 'field')).toThrow(ValidationError)
            expect(() => validateBoolean('true', 'field')).toThrow(ValidationError)
        })
    })

    describe('validateArray', () => {
        it('validates array type', () => {
            expect(validateArray([1, 2], 'field')).toEqual([1, 2])
        })

        it('throws for non-array', () => {
            expect(() => validateArray('[]', 'field')).toThrow(ValidationError)
        })

        it('validates array item type', () => {
            expect(() => validateArray([1, 'a'], 'field', { itemType: 'string' })).toThrow()
            expect(validateArray(['a', 'b'], 'field', { itemType: 'string' })).toEqual(['a', 'b'])
        })
    })

    describe('validateStringArray', () => {
        it('validates string array', () => {
            expect(validateStringArray(['a', 'b'], 'field')).toEqual(['a', 'b'])
        })

        it('throws for non-string items', () => {
            expect(() => validateStringArray([1, 2], 'field')).toThrow()
        })
    })

    describe('validateUUID', () => {
        it('validates UUID format', () => {
            expect(validateUUID('550e8400-e29b-41d4-a716-446655440000', 'field')).toBe('550e8400-e29b-41d4-a716-446655440000')
        })

        it('throws for invalid UUID', () => {
            expect(() => validateUUID('not-a-uuid', 'field')).toThrow('UUID')
            expect(() => validateUUID('550e8400-e29b-41d4', 'field')).toThrow('UUID')
        })
    })

    describe('validateFilePath', () => {
        it('validates safe file paths', () => {
            expect(validateFilePath('/path/to/file.txt', 'field')).toBe('/path/to/file.txt')
            expect(validateFilePath('relative/path.txt', 'field')).toBe('relative/path.txt')
        })

        it('rejects path traversal', () => {
            expect(() => validateFilePath('../etc/passwd', 'field')).toThrow('suspicious')
        })

        it('rejects null bytes', () => {
            expect(() => validateFilePath('file\x00.txt', 'field')).toThrow('suspicious')
        })
    })

    describe('object schema validation', () => {
        it('validates object shape', () => {
            const schema = object({
                name: (v) => validateString(v, 'name', { minLength: 1 }),
                age: (v) => validateNumber(v, 'age', { min: 0 })
            })

            const result = schema.validate({ name: 'John', age: 30 })
            expect(result.name).toBe('John')
            expect(result.age).toBe(30)
        })

        it('throws on missing required fields', () => {
            const schema = object({
                name: (v) => validateString(v, 'name'),
                age: (v) => validateNumber(v, 'age')
            })

            expect(() => schema.validate({ name: 'John' })).toThrow(ValidationError)
        })

        it('throws on non-object input', () => {
            const schema = object({
                name: (v) => validateString(v, 'name')
            })

            expect(() => schema.validate('string')).toThrow('object')
            expect(() => schema.validate(null)).toThrow('object')
        })
    })

    describe('ValidationError', () => {
        it('creates error with field and message', () => {
            const error = new ValidationError('email', 'invalid format')
            expect(error.field).toBe('email')
            expect(error.message).toContain('email')
            expect(error.message).toContain('invalid format')
        })
    })
})
