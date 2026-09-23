import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeDiagnosticForStatement, utf8ByteOffsetToUtf16Index } from '../../.core-build/shared/native-parser.js';

const bytes = value => new TextEncoder().encode(value).length;

test('UTF-8 parser offsets map to JavaScript UTF-16 indices', () => {
    const value = "SELECT '你好🙂' FROM events";
    const beforeEmoji = "SELECT '你好";
    assert.equal(utf8ByteOffsetToUtf16Index(value, bytes(beforeEmoji)), beforeEmoji.length);
    assert.equal(utf8ByteOffsetToUtf16Index(value, bytes(beforeEmoji + '🙂')), (beforeEmoji + '🙂').length);
});

test('native diagnostics preserve statement offsets for non-ASCII SQL', () => {
    const sql = "SELECT '你好🙂' FORM events";
    const prefix = "SELECT '你好🙂' ";
    const diagnostic = nativeDiagnosticForStatement(sql, 40, {
        message: 'Expected FROM',
        begin: bytes(prefix),
        end: bytes(prefix + 'FORM'),
    });
    assert.deepEqual(diagnostic, {
        from: 40 + prefix.length,
        to: 40 + prefix.length + 4,
        message: 'Expected FROM',
    });
});

test('line and byte-column fallback maps parser positions without corrupting Unicode', () => {
    const sql = "SELECT 1\nSELECT '你' FORM events";
    const linePrefix = "SELECT '你' ";
    const diagnostic = nativeDiagnosticForStatement(sql, 0, {
        message: 'Expected FROM',
        line: 2,
        column: bytes(linePrefix) + 1,
    });
    assert.equal(diagnostic.from, 'SELECT 1\n'.length + linePrefix.length);
});
