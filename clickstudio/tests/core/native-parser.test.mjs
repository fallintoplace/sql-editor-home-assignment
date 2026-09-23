import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeDiagnosticForStatement, nativeHighlightRanges, nativeParserFeaturesFromFlags, parseNativeParseResult, sourcePositionFromUtf8ByteOffset, utf8ByteOffsetToUtf16Index } from '../../.core-build/shared/native-parser.js';

const bytes = value => new TextEncoder().encode(value).length;

test('native parser feature flags expose only capabilities present in the build', () => {
    assert.deepEqual(nativeParserFeaturesFromFlags(7), { format: true, dcl: true, astJson: true });
    assert.deepEqual(nativeParserFeaturesFromFlags(1), { format: true, dcl: false, astJson: false });
    assert.deepEqual(nativeParserFeaturesFromFlags(8), { format: false, dcl: false, astJson: false });
    assert.throws(() => nativeParserFeaturesFromFlags(-1), /invalid feature flags/);
    assert.throws(() => nativeParserFeaturesFromFlags(1.5), /invalid feature flags/);
});

test('UTF-8 parser offsets map to JavaScript UTF-16 indices', () => {
    const value = "SELECT '你好🙂' FROM events";
    const beforeEmoji = "SELECT '你好";
    assert.equal(utf8ByteOffsetToUtf16Index(value, bytes(beforeEmoji)), beforeEmoji.length);
    assert.equal(utf8ByteOffsetToUtf16Index(value, bytes(beforeEmoji + '🙂')), (beforeEmoji + '🙂').length);
});

test('ClickHouse byte offsets map to source positions after Unicode and EXPLAIN prefixes', () => {
    const sql = "SELECT 'é你好🙂' FORM events";
    const failingPrefix = "SELECT 'é你好🙂' FORM";
    const explainPrefix = 'EXPLAIN PIPELINE\n';
    const sourceFrom = 25;
    assert.equal(
        sourcePositionFromUtf8ByteOffset(sql, bytes(explainPrefix + failingPrefix), sourceFrom, sourceFrom + sql.length, bytes(explainPrefix)),
        sourceFrom + failingPrefix.length,
    );
});

test('ClickHouse byte offsets clamp to the selected statement source range', () => {
    assert.equal(sourcePositionFromUtf8ByteOffset('SELECT 1', 0, 12, 20), 12);
    assert.equal(sourcePositionFromUtf8ByteOffset('SELECT 1', 100, 12, 20), 20);
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

test('native parse envelopes retain ClickHouse highlights, AST, and expected tokens', () => {
    const parsed = parseNativeParseResult({
        ast: { type: 'SelectWithUnionQuery', children: [] },
        highlights: [{ begin: 0, end: 6, type: 'keyword' }, { begin: 7, end: 8, type: 'number' }],
    });
    assert.deepEqual(parsed, {
        ast: { type: 'SelectWithUnionQuery', children: [] },
        highlights: [{ begin: 0, end: 6, type: 'keyword' }, { begin: 7, end: 8, type: 'number' }],
    });
    assert.deepEqual(parseNativeParseResult({ error: { message: 'Syntax error', expected: ['FROM', 'WHERE'] } }), {
        error: { message: 'Syntax error', expected: ['FROM', 'WHERE'] },
    });
});

test('native parse envelopes reject invalid errors and discard malformed highlight ranges', () => {
    assert.throws(() => parseNativeParseResult(null), /invalid response/);
    assert.throws(() => parseNativeParseResult({ error: 'broken' }), /invalid diagnostics/);
    assert.deepEqual(parseNativeParseResult({ highlights: [
        { begin: 0, end: 3, type: 'function' },
        { begin: 3, end: 3, type: 'alias' },
        { begin: -1, end: 4, type: 'keyword' },
        { begin: 0, end: 2, type: 'not-a-native-token' },
    ] }).highlights, [{ begin: 0, end: 3, type: 'function' }]);
});

test('native semantic highlights map UTF-8 ranges to statement-relative UTF-16 positions', () => {
    const sql = "SELECT '🙂', uniqExact(user_id)";
    const prefix = "SELECT '🙂', ";
    assert.deepEqual(nativeHighlightRanges(sql, 25, [
        { begin: bytes(prefix), end: bytes(prefix + 'uniqExact'), type: 'function' },
        { begin: bytes(prefix + 'uniqExact('), end: bytes(prefix + 'uniqExact(user_id'), type: 'identifier' },
        { begin: bytes(sql) + 1, end: bytes(sql) + 2, type: 'string' },
    ]), [
        { from: 25 + prefix.length, to: 25 + prefix.length + 'uniqExact'.length, type: 'function' },
        { from: 25 + prefix.length + 'uniqExact('.length, to: 25 + prefix.length + 'uniqExact(user_id'.length, type: 'identifier' },
    ]);
});

test('native diagnostics show a bounded expected-token hint', () => {
    const expected = ['FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'SETTINGS', 'FORMAT', 'UNION', 'INTO'];
    const diagnostic = nativeDiagnosticForStatement('SELECT 1', 0, { message: 'Syntax error', expected });
    assert.equal(diagnostic.message, 'Syntax error\nExpected: FROM · WHERE · GROUP BY · HAVING · ORDER BY · LIMIT · SETTINGS · FORMAT · …');
});
