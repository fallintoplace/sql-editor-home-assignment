import test from 'node:test';
import assert from 'node:assert/strict';
import { visibleColumns, toggleColumn, projectResultColumns, matchingColumns } from '../../.workspace-build/shared/result-columns.js';
import { exportCsv, filterRows } from '../../.workspace-build/shared/results.js';
const columns = [{ name: 'same', type: 'String' }, { name: 'same', type: 'UInt64' }, { name: 'nested', type: 'JSON' }];
test('Columns use positional identity, including duplicate names', () => {
    assert.deepEqual(visibleColumns(3, []), [0, 1, 2]);
    assert.deepEqual(visibleColumns(3, [1]), [0, 2]);
    assert.deepEqual(visibleColumns(3, [2, 0]), [1]);
});
test('Invalid stale hidden indexes do not hide unrelated columns', () => assert.deepEqual(visibleColumns(3, [-1, NaN, 100, 0.5, 1, 1]), [0, 2]));
test('Empty schema has an empty visible set', () => assert.deepEqual(visibleColumns(0, []), []));
test('Toggle hides and shows just the requested column without changing caller state', () => {
    const hidden = [1]; assert.deepEqual(toggleColumn(3, hidden, 2), [1, 2]); assert.deepEqual(hidden, [1]);
    assert.deepEqual(toggleColumn(3, hidden, 1), []);
});
test('Last visible column cannot be hidden', () => assert.deepEqual(toggleColumn(3, [0, 1], 2), [0, 1]));
for (const index of [-1, 3, 1.5, NaN]) test(`Invalid toggle ${index} is a no-op`, () => assert.deepEqual(toggleColumn(3, [0], index), [0]));
test('Column search includes labels, types and position without merging duplicate names', () => {
    assert.deepEqual(matchingColumns(columns, 'same'), [0, 1]);
    assert.deepEqual(matchingColumns(columns, 'uint64 same'), [1]);
    assert.deepEqual(matchingColumns(columns, '3'), [2]);
    assert.deepEqual(matchingColumns(columns, '  '), [0, 1, 2]);
    assert.deepEqual(matchingColumns(columns, 'not here'), []);
});
test('Projection preserves null, exact integer strings and nested JSON', () => {
    const result = { columns, rows: [['a', '9007199254740993', { k: [1, null, '世界'] }], [null, '9007199254740994', []]] };
    const before = structuredClone(result), projected = projectResultColumns(result, [1, 2]);
    assert.deepEqual(projected.rows, [['9007199254740993', { k: [1, null, '世界'] }], ['9007199254740994', []]]);
    assert.deepEqual(result, before);
    assert.equal(projected.columns[0].name, 'same');
});
for (const indexes of [[], [0, 0], [-1], [3], [0.5], [NaN]]) test(`Reject invalid projection ${String(indexes)}`, () => assert.throws(() => projectResultColumns({ columns, rows: [] }, indexes)));
test('Export keeps all filtered rows, not only the first rendered page', () => {
    const result = { columns, rows: Array.from({ length: 450 }, (_, i) => [String(i), String(9000 + i), null]) };
    const filtered = filterRows(result.rows, '9');
    const csv = exportCsv(projectResultColumns({ columns, rows: filtered }, [1]));
    assert.equal(csv.split('\r\n').length, filtered.length + 1);
    assert.ok(filtered.length > 200);
    assert.equal(result.rows.length, 450);
});
test('Filtered CSV retains existing escaping and formula precautions', () => {
    const csv = exportCsv(projectResultColumns({ columns, rows: [['=2+2', '9007199254740993', null], ['comma,"quote"\nnew', '1', []]] }, [0, 1]));
    assert.ok(csv.includes("'=2+2"));
    assert.ok(csv.includes('9007199254740993'));
    assert.ok(csv.includes('"comma,""quote""\nnew"'));
});
test('Empty filtered CSV exports the selected headers', () => assert.equal(exportCsv(projectResultColumns({ columns, rows: [] }, [1, 0])), 'same,same'));
test('Full evidence and full CSV do not change after projection', () => {
    const result = { columns, rows: [['a', '9007199254740993', null]] }, before = JSON.stringify(result), full = exportCsv(result);
    projectResultColumns(result, [1]);
    assert.equal(JSON.stringify(result), before); assert.equal(exportCsv(result), full);
});
