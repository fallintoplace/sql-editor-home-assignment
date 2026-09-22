import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLocalFile, appendImportedDrafts, localDraftBackup, MAX_IMPORT_BYTES } from '../../.workspace-build/web/local-import.js';
import { newDraft } from '../../.workspace-build/web/workspace-state.js';
const encode = value => new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value));
const workspace = () => { const draft = newDraft('Existing.sql', 'SELECT 0'); return { version: 1, tabs: [draft], activeId: draft.id, closedTabs: [newDraft('Closed.sql', 'SELECT 9')] }; };
const parse = (value, filename = 'backup.json') => parseLocalFile(filename, encode(value));
const legacy = draft => ({ version: 1, tabs: [draft], closedTabs: [] });

test('SQL import preserves exact Unicode, comments, CRLF and large literals without executing', () => {
    const sql = "-- résumé\r\nSELECT '9007199254740993', '世界';\r\n";
    const preview = parse(sql, 'analysis.SQL');
    assert.equal(preview.entries.length, 1);
    assert.equal(preview.entries[0].draft.sql, sql);
    assert.equal(preview.entries[0].draft.name, 'analysis.SQL');
    assert.deepEqual(preview.entries[0].draft.runIds, []);
});
test('UTF-8 BOM is removed before decoding SQL and JSON', () => {
    assert.equal(parse('\ufeffSELECT 1', 'a.sql').entries[0].draft.sql, 'SELECT 1');
    assert.equal(parse('\ufeff' + JSON.stringify(legacy(newDraft()))).entries.length, 1);
});
for (const [name, bytes, pattern] of [
    ['too large', new Uint8Array(MAX_IMPORT_BYTES + 1), /5 MB/],
    ['invalid UTF-8', new Uint8Array([0xff, 0xfe, 0x61]), /UTF-8/],
    ['binary SQL', encode('SELECT\0'), /null bytes/],
    ['too long SQL', encode('x'.repeat(200001)), /200,000/],
    ['empty SQL', encode(' \r\n'), /empty/],
]) test(`Reject ${name} without creating a draft`, () => assert.throws(() => parseLocalFile('x.sql', bytes), pattern));
for (const filename of ['x.csv', 'x.sql.exe', 'x', 'x.png']) test(`Reject unsupported file ${filename}`, () => assert.throws(() => parse('SELECT 1', filename), /\.sql or \.json/));
for (const value of [null, [], 1, { version: 2, tabs: [] }, { version: 1, documents: [] }, { version: 1, tabs: [] }, { version: 1, tabs: [null] }, { version: 1, tabs: [{ sql: 42 }] }, { version: 1, tabs: [], closedTabs: 'bad' }])
    test(`Reject malformed backup ${JSON.stringify(value)}`, () => assert.throws(() => parse(value)));
test('Malformed second draft rejects the whole preview rather than partially importing', () => assert.throws(() => parse({ version: 1, tabs: [newDraft(), { sql: null }] })));
test('Invalid JSON reports a readable parse error', () => assert.throws(() => parse('{ bad'), /valid JSON/));
test('Legacy backups recover open and recently closed drafts as selectable entries', () => {
    const state = workspace(), preview = parse(state);
    assert.deepEqual(preview.entries.map(entry => entry.source), ['open', 'closed']);
    assert.deepEqual(preview.entries.map(entry => entry.draft.sql), ['SELECT 0', 'SELECT 9']);
});
test('Closed-only backup is supported without inventing a getting-started draft', () => {
    const preview = parse({ version: 1, closedTabs: [newDraft('Recovered.sql', '')] });
    assert.equal(preview.entries.length, 1);
    assert.equal(preview.entries[0].draft.sql, '');
});
test('New backup envelope records connection identity, not host or credentials', () => {
    const state = workspace(), backup = localDraftBackup(state, { id: 'a', name: 'Local', host: 'secret', password: 'secret' });
    assert.deepEqual(backup.connection, { id: 'a', name: 'Local' });
    const preview = parse(backup);
    assert.deepEqual(preview.sourceConnection, { id: 'a', name: 'Local' });
    assert.equal(preview.entries.length, 2);
    assert.equal(JSON.stringify(backup).includes('secret'), false);
});
for (const overrides of [{ format: 'other' }, { version: 2 }, { connection: { id: 1, name: 'x' } }, { workspace: null }])
    test(`Reject malformed envelope ${JSON.stringify(overrides)}`, () => assert.throws(() => parse({ ...localDraftBackup(workspace(), { id: 'a', name: 'A' }), ...overrides })));
test('Preview strips all imported server, run, ownership and review references', () => {
    const draft = { ...newDraft(), serverId: 'remote', baseRevision: 5, activeRunId: 'run', runIds: ['run'], scriptId: 'script', parentRunId: 'parent', parentDocumentId: 'doc', dependencies: ['doc'], owner: 'someone', verifiedRevision: 5, publishedRevision: 5, checkpoints: [{ id: 'cp', at: 'today', reason: 'old', sql: 'SELECT 2', from: 0, to: 2, parentRevision: 5 }] };
    const imported = parse(legacy(draft)).entries[0].draft;
    for (const key of ['serverId', 'baseRevision', 'activeRunId', 'scriptId', 'parentRunId', 'parentDocumentId', 'owner', 'verifiedRevision', 'publishedRevision']) assert.equal(imported[key], undefined, key);
    assert.deepEqual(imported.runIds, []);
    assert.deepEqual(imported.dependencies, []);
    assert.equal(imported.checkpoints[0].parentRevision, undefined);
    assert.equal(imported.checkpoints[0].sql, 'SELECT 2');
});
test('SQL, exact parameter strings, chart and metric definition survive importing', () => {
    const draft = { ...newDraft(), parameters: { value: '9007199254740993' }, kind: 'metric', metric: { definition: 'Count', grain: 'day', dimensions: ['day'], timezone: 'UTC', filters: '', nullTreatment: 'ignore', sourceColumns: ['events'] }, chart: { kind: 'line', title: 'Events', x: 0, ys: [1] } };
    const restored = parse(legacy(draft)).entries[0].draft;
    assert.deepEqual(restored.parameters, draft.parameters);
    assert.deepEqual(restored.metric, draft.metric);
    assert.deepEqual(restored.chart, draft.chart);
});
for (const parameters of [{ value: 9007199254740992 }, { value: null }, [], { 'bad key': 'x' }, JSON.parse('{"__proto__":"x"}'), { constructor: 'x' }, { prototype: 'x' }, { value: 'x'.repeat(4001) }, Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`p${i}`, '']))])
    test(`Reject parameter corruption ${Object.keys(parameters).slice(0, 2).join(',')}`, () => assert.throws(() => parse(legacy({ ...newDraft(), parameters })), /parameter/i));
test('Optional layout metadata can be repaired and the preview reports it', () => {
    const preview = parse(legacy({ sql: 'SELECT 1', from: -50, to: 500, chart: null }));
    assert.equal(preview.entries[0].draft.from, 0);
    assert.equal(preview.entries[0].draft.to, 8);
    assert.equal(preview.entries[0].draft.chart.kind, 'table');
    assert.ok(preview.warnings.length > 0);
});
test('Oversized tab queues reject rather than silently truncate', () => {
    assert.throws(() => parse({ version: 1, tabs: Array.from({ length: 31 }, () => newDraft()) }), /30/);
    assert.throws(() => parse({ version: 1, closedTabs: Array.from({ length: 11 }, () => newDraft()) }), /10/);
});
test('Appending selected drafts preserves existing tabs and closed history', () => {
    const state = workspace(), before = structuredClone(state), preview = parse(workspace());
    const next = appendImportedDrafts(state, preview.entries, [1]);
    assert.deepEqual(state, before);
    assert.deepEqual(next.tabs[0], state.tabs[0]);
    assert.deepEqual(next.closedTabs, state.closedTabs);
    assert.equal(next.tabs[1].sql, 'SELECT 9');
    assert.equal(next.activeId, next.tabs[1].id);
    assert.notEqual(next.tabs[1].id, preview.entries[1].draft.id);
});
test('Repeated imports allocate independent local identities and mutable data', () => {
    const preview = parse(legacy({ ...newDraft(), parameters: { p: 'x' } }));
    const state = appendImportedDrafts(workspace(), preview.entries, [0]);
    const next = appendImportedDrafts(state, preview.entries, [0]);
    assert.notEqual(next.tabs[1].id, next.tabs[2].id);
    next.tabs[2].parameters.p = 'changed';
    assert.equal(next.tabs[1].parameters.p, 'x');
    assert.equal(preview.entries[0].draft.parameters.p, 'x');
});
for (const selection of [[], [-1], [1], [0, 0], [NaN], [0.5]]) test(`Reject invalid selection ${String(selection)}`, () => assert.throws(() => appendImportedDrafts(workspace(), parse('SELECT 1', 'a.sql').entries, selection)));
test('Capacity is checked at confirmation, with no partial append or state mutation', () => {
    const state = workspace(); state.tabs = Array.from({ length: 29 }, () => newDraft()); state.activeId = state.tabs[0].id;
    const preview = parse(workspace()), before = structuredClone(state);
    assert.throws(() => appendImportedDrafts(state, preview.entries, [0, 1]), /1 open tab slot/);
    assert.deepEqual(state, before);
    assert.equal(appendImportedDrafts(state, preview.entries, [1]).tabs.length, 30);
});
test('Import preview leaves original object data unchanged', () => {
    const state = workspace(), before = JSON.stringify(state);
    parse(state);
    assert.equal(JSON.stringify(state), before);
});
