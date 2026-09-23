export type NativeParserStatus = 'loading' | 'ready' | 'unavailable';

export interface NativeParseError {
    message: string;
    begin?: number;
    end?: number;
    line?: number;
    column?: number;
    expected?: string[];
}

export interface NativeParseResult {
    error?: NativeParseError;
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
        message: error.message,
    };
}
