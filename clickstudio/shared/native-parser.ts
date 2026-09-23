export type NativeParserStatus = 'loading' | 'ready' | 'unavailable';

export interface NativeParserFeatures {
    format: boolean;
    dcl: boolean;
    astJson: boolean;
}

export function nativeParserFeaturesFromFlags(flags: number): NativeParserFeatures {
    if (!Number.isSafeInteger(flags) || flags < 0)
        throw new Error('ClickHouse parser returned invalid feature flags');
    return { format: (flags & 1) !== 0, dcl: (flags & 2) !== 0, astJson: (flags & 4) !== 0 };
}

export interface NativeParseError {
    message: string;
    begin?: number;
    end?: number;
    line?: number;
    column?: number;
    expected?: string[];
}

export type NativeHighlightType =
    | 'keyword'
    | 'identifier'
    | 'function'
    | 'alias'
    | 'substitution'
    | 'number'
    | 'string'
    | 'string_escape'
    | 'string_metacharacter';

export interface NativeHighlight {
    begin: number;
    end: number;
    type: NativeHighlightType;
}

export interface NativeParseResult {
    error?: NativeParseError;
    highlights?: NativeHighlight[];
    ast?: unknown | null;
    ast_error?: string;
}

export interface NativeParseStatement {
    from: number;
    to: number;
    sql: string;
    result: NativeParseResult;
}

export interface NativeParseSnapshot {
    statements: NativeParseStatement[];
    elapsedMs: number;
}

export interface NativeHighlightRange {
    from: number;
    to: number;
    type: NativeHighlightType;
}

export interface NativeFormatResult {
    sql?: string;
    error?: NativeParseError;
}

export interface NativeDiagnostic {
    from: number;
    to: number;
    message: string;
}

const encoder = new TextEncoder();
const nativeHighlightTypes = new Set<NativeHighlightType>([
    'keyword', 'identifier', 'function', 'alias', 'substitution', 'number', 'string', 'string_escape', 'string_metacharacter',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseNativeError(value: unknown): NativeParseError | undefined {
    if (!isRecord(value) || typeof value.message !== 'string')
        return undefined;
    const expected = Array.isArray(value.expected)
        ? value.expected.filter((item): item is string => typeof item === 'string')
        : undefined;
    return {
        message: value.message,
        ...(typeof value.begin === 'number' ? { begin: value.begin } : {}),
        ...(typeof value.end === 'number' ? { end: value.end } : {}),
        ...(typeof value.line === 'number' ? { line: value.line } : {}),
        ...(typeof value.column === 'number' ? { column: value.column } : {}),
        ...(expected?.length ? { expected } : {}),
    };
}

function parseNativeHighlight(value: unknown): NativeHighlight | undefined {
    if (!isRecord(value) || !Number.isInteger(value.begin) || !Number.isInteger(value.end)
        || (value.begin as number) < 0 || (value.end as number) <= (value.begin as number)
        || typeof value.type !== 'string' || !nativeHighlightTypes.has(value.type as NativeHighlightType))
        return undefined;
    return { begin: value.begin as number, end: value.end as number, type: value.type as NativeHighlightType };
}

export function parseNativeParseResult(value: unknown): NativeParseResult {
    if (!isRecord(value))
        throw new Error('ClickHouse parser returned an invalid response');
    const error = value.error === undefined ? undefined : parseNativeError(value.error);
    if (value.error !== undefined && !error)
        throw new Error('ClickHouse parser returned invalid diagnostics');
    const highlights = value.highlights === undefined ? undefined
        : Array.isArray(value.highlights) ? value.highlights.map(parseNativeHighlight).filter((item): item is NativeHighlight => Boolean(item))
            : undefined;
    const result: NativeParseResult = {};
    if (error)
        result.error = error;
    if (highlights)
        result.highlights = highlights;
    if (Object.hasOwn(value, 'ast'))
        result.ast = value.ast;
    if (typeof value.ast_error === 'string')
        result.ast_error = value.ast_error;
    return result;
}

export function utf8ByteOffsetToUtf16Index(value: string, byteOffset: number): number {
    if (!Number.isFinite(byteOffset) || byteOffset <= 0)
        return 0;
    let bytes = 0, index = 0;
    for (const character of value) {
        const width = encoder.encode(character).length;
        if (bytes + width > byteOffset)
            break;
        bytes += width;
        index += character.length;
    }
    return Math.min(index, value.length);
}

export function sourcePositionFromUtf8ByteOffset(value: string, byteOffset: number, sourceFrom: number, sourceTo: number, prefixBytes = 0): number {
    const localPosition = utf8ByteOffsetToUtf16Index(value, byteOffset - prefixBytes);
    return Math.max(sourceFrom, Math.min(sourceTo, sourceFrom + localPosition));
}

function offsetFromLineColumn(value: string, line: number | undefined, column: number | undefined): number {
    if (line === undefined || column === undefined || line < 1 || column < 1)
        return 0;
    let start = 0, current = 1;
    while (current < line) {
        const next = value.indexOf('\n', start);
        if (next < 0)
            return value.length;
        start = next + 1;
        current++;
    }
    const end = value.indexOf('\n', start);
    const text = value.slice(start, end < 0 ? value.length : end);
    return start + utf8ByteOffsetToUtf16Index(text, column - 1);
}

export function nativeDiagnosticForStatement(sql: string, statementFrom: number, error: NativeParseError): NativeDiagnostic {
    const localFrom = error.begin === undefined
        ? offsetFromLineColumn(sql, error.line, error.column)
        : utf8ByteOffsetToUtf16Index(sql, error.begin);
    const localTo = error.end === undefined
        ? Math.min(sql.length, localFrom + 1)
        : utf8ByteOffsetToUtf16Index(sql, error.end);
    return {
        from: statementFrom + localFrom,
        to: statementFrom + Math.max(localFrom, localTo),
        message: error.expected?.length
            ? `${error.message}\nExpected: ${error.expected.slice(0, 8).join(' · ')}${error.expected.length > 8 ? ' · …' : ''}`
            : error.message,
    };
}

export function nativeHighlightRanges(sql: string, statementFrom: number, highlights: readonly NativeHighlight[] = []): NativeHighlightRange[] {
    const byteLength = encoder.encode(sql).length;
    return highlights.flatMap(highlight => {
        if (highlight.begin < 0 || highlight.end <= highlight.begin || highlight.end > byteLength)
            return [];
        const from = statementFrom + utf8ByteOffsetToUtf16Index(sql, highlight.begin);
        const to = statementFrom + utf8ByteOffsetToUtf16Index(sql, highlight.end);
        return to > from ? [{ from, to, type: highlight.type }] : [];
    });
}
