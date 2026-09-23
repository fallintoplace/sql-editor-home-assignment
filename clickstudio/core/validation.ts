import { DEFAULT_LIMITS, HARD_LIMITS, type Limits, type RunRequest, type Json } from '../shared/types.js';
import { AppError, requireThat } from './errors.js';
export function record(value: unknown, name = 'request'): Record<string, unknown> {
    requireThat(value !== null && typeof value === 'object' && !Array.isArray(value), 400, 'INVALID_REQUEST', `${name} must be an object`);
    return value as Record<string, unknown>;
}
export function text(value: unknown, name: string, max = 1000, allowEmpty = false): string {
    requireThat(typeof value === 'string' && (allowEmpty || value.trim().length > 0) && value.length <= max, 400, 'INVALID_REQUEST', `${name} must be ${allowEmpty ? '0' : '1'}–${max} characters`);
    return value;
}
export function identifier(value: unknown, name: string): string {
    const id = text(value, name, 128);
    requireThat(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(id), 400, 'INVALID_ID', `Invalid ${name}`);
    return id;
}
export function integer(value: unknown, name: string, min: number, max: number): number {
    requireThat(typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max, 400, 'INVALID_REQUEST', `${name} must be an integer between ${min} and ${max}`);
    return value;
}
export function stringMap(value: unknown, name: string, maxEntries = 50): Record<string, string> {
    const source = value === undefined ? {} : record(value, name), out: Record<string, string> = Object.create(null);
    requireThat(Object.keys(source).length <= maxEntries, 400, 'INVALID_REQUEST', `Too many ${name}`);
    for (const [key, value] of Object.entries(source)) {
        requireThat(/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(key) && !['__proto__', 'constructor', 'prototype'].includes(key), 400, 'INVALID_REQUEST', `Invalid ${name} key`);
        out[key] = text(value, name, 4000, true);
    }
    return out;
}
export function limits(value: unknown, defaults: Limits = { ...DEFAULT_LIMITS }): Limits {
    const source = value === undefined ? {} : record(value, 'limits'), out = { ...defaults };
    requireThat(Object.keys(source).every(k => Object.hasOwn(HARD_LIMITS, k)), 400, 'INVALID_LIMIT', 'Unknown limit');
    for (const key of Object.keys(HARD_LIMITS) as (keyof Limits)[]) {
        if (source[key] !== undefined)
            out[key] = integer(source[key], key, 1, HARD_LIMITS[key]);
    }
    return out;
}
export function runRequest(value: unknown): RunRequest {
    const v = record(value);
    const kind = v.kind ?? 'query';
    requireThat(['query', 'explain', 'pipeline'].includes(String(kind)), 400, 'INVALID_KIND', 'Unknown run kind');
    const tags = stringMap(v.tags, 'tags', 5);
    requireThat(Object.keys(tags).every(k => ['workspace', 'owner', 'artifact', 'environment', 'cost_center', 'experience'].includes(k)), 400, 'INVALID_TAG', 'Unsupported query tag');
    for (const t of Object.values(tags))
        requireThat(/^[A-Za-z0-9_. :/-]{0,80}$/.test(t), 400, 'INVALID_TAG', 'Tags must be short, non-secret labels');
    const requestedLimits = v.limits === undefined ? undefined : record(v.limits, 'limits');
    const checkedLimits = limits(requestedLimits);
    const sourceFrom = v.sourceFrom === undefined ? undefined : integer(v.sourceFrom, 'sourceFrom', 0, 200000);
    const sourceTo = v.sourceTo === undefined ? undefined : integer(v.sourceTo, 'sourceTo', 0, 200000);
    requireThat(sourceFrom === undefined ? sourceTo === undefined : sourceTo !== undefined && sourceTo >= sourceFrom, 400, 'INVALID_SOURCE_RANGE', 'sourceTo must be greater than or equal to sourceFrom');
    return {
        clientRequestId: identifier(v.clientRequestId, 'clientRequestId'),
        connectionId: identifier(v.connectionId, 'connectionId'), sql: text(v.sql, 'SQL', 200000),
        kind: kind as RunRequest['kind'], parameters: stringMap(v.parameters, 'parameters'),
        limits: requestedLimits === undefined ? undefined : Object.fromEntries(Object.keys(requestedLimits).map(k => [k, checkedLimits[k as keyof Limits]])), tags,
        ...(sourceFrom === undefined ? {} : { sourceFrom, sourceTo }),
        ...(v.documentId !== undefined ? { documentId: identifier(v.documentId, 'documentId') } : {}),
        ...(v.parentRunId !== undefined ? { parentRunId: identifier(v.parentRunId, 'parentRunId') } : {}),
    };
}
export function validateJson(value: unknown, depth = 0): Json {
    if (depth > 30)
        throw new AppError(400, 'INVALID_JSON', 'JSON nesting is too deep');
    if (value === null || typeof value === 'string' || typeof value === 'boolean')
        return value;
    if (typeof value === 'number') {
        requireThat(Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value)), 400, 'UNSAFE_NUMBER', 'Encode 64-bit integers as JSON strings to avoid precision loss');
        return value;
    }
    if (Array.isArray(value))
        return value.map(v => validateJson(v, depth + 1));
    const out: {
        [key: string]: Json;
    } = Object.create(null);
    for (const [key, v] of Object.entries(record(value)))
        out[key] = validateJson(v, depth + 1);
    return out;
}
