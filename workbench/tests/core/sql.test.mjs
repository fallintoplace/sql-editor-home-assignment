import test from 'node:test';
import assert from 'node:assert/strict';
import { splitSql, selectedStatement, parameterNames, quoteIdentifier, insertChildFilter } from '../../.core-build/shared/sql.js';
import { guardSql } from '../../.core-build/core/guards.js';
import { limits, runRequest, validateJson } from '../../.core-build/core/validation.js';
const cases = [
    ["SELECT ';'; SELECT 2", 2], ["SELECT 'it\\\'s;ok'; SELECT 2", 2],
    ["SELECT 'it''s;ok'; SELECT 2", 2], ['SELECT `a;b`; SELECT "c;d"', 2],
    ['-- ;\nSELECT 1; -- only comment;', 1], ['/* outer ; /* inner ; */ */ SELECT 1; SELECT 2', 2],
    ['SELECT $tag$a;b$tag$; SELECT $$c;d$$;', 2], ['# comment;\nSELECT 1;', 1], ['-- comment only', 0],
    ['; ; SELECT 1;;;', 1], ['SELECT 1 /* ; */; SELECT 2', 2], ['SELECT [1,2]; SELECT {value:String}', 2],
];
for (const [sql, n] of cases)
    test(`SQL boundaries: ${sql}`, () => assert.equal(splitSql(sql).length, n));
for (const sql of ["SELECT 'oops", 'SELECT `oops', 'SELECT $$oops', 'SELECT 1 /*oops'])
    test(`Unclosed tokens reject: ${sql}`, () => assert.throws(() => splitSql(sql)));
test('Ranges preserve original source', () => { const sql = '  -- hello\nSELECT 1;\n SELECT 2;'; for (const s of splitSql(sql))
    assert.equal(sql.slice(s.from, s.to), s.sql); });
test('Current statement and selected range', () => {
    const sql = 'SELECT 1;\nSELECT 2';
    assert.equal(selectedStatement(sql, 12, 12).sql, 'SELECT 2');
    assert.equal(selectedStatement(sql, 7, 8).sql, '1');
});
test('Typed parameters ignore comments and literals', () => assert.deepEqual(parameterNames("SELECT {a:Nullable(UInt64)}, '{b:String}' -- {c:Int32}"), [{ name: 'a', type: 'Nullable(UInt64)' }]));
test('Inconsistent parameter types reject', () => assert.throws(() => parameterNames('SELECT {a:Int32}, {a:String}')));
test('Identifier quoting cannot end the identifier', () => assert.equal(quoteIdentifier('a`b'), '`a\\`b`'));
for (const sql of ['SELECT 1', 'SELECT * FROM system.tables', "SELECT 'DROP'", 'WITH 1 AS n SELECT n', 'EXPLAIN SELECT 1'])
    test(`Read-only accepts ${sql}`, () => assert.doesNotThrow(() => guardSql(sql)));
for (const sql of ['DELETE FROM t', 'SELECT 1; DROP TABLE t', 'SELECT 1 SETTINGS readonly=0', "SELECT * FROM url('http://example.invalid')", 'SELECT 1 FORMAT CSV'])
    test(`Read-only guard rejects ${sql}`, () => assert.throws(() => guardSql(sql)));
test('Missing named parameter is explicit', () => assert.throws(() => guardSql('SELECT {n:UInt64}'), { code: 'MISSING_PARAMETER' }));
test('Child filter is bound, not interpolated', () => { const f = insertChildFilter('SELECT x FROM t', 'x', "x' OR 1=1"); assert.ok(!f.sql.includes("OR 1=1")); assert.equal(f.parameters.wb_filter, "x' OR 1=1"); });
test('Hard limits cannot be raised', () => assert.throws(() => limits({ rows: 1e8 })));
test('Unknown limit cannot exploit prototype', () => assert.throws(() => limits(JSON.parse('{"__proto__":1}'))));
test('Unsafe JSON integers reject rather than lose precision', () => assert.throws(() => validateJson(JSON.parse('{"id":18446744073709551615}'))));
test('Int64 encoded as a string remains lossless', () => assert.equal(validateJson({ id: '18446744073709551615' }).id, '18446744073709551615'));
test('Request tags cannot smuggle arbitrary secret fields', () => assert.throws(() => runRequest({ clientRequestId: 'a', connectionId: 'local', sql: 'SELECT 1', tags: { password: 'x' } })));
