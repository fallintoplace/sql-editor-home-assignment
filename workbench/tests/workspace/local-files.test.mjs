import test from 'node:test';
import assert from 'node:assert/strict';
import { appendLocalDrafts, isolatedDraft, localDraftBackup, previewLocalFiles, MAX_LOCAL_FILE_BYTES, MAX_LOCAL_BATCH_BYTES } from '../../.workspace-build/web/local-files.js';
import { newDraft, recover, MAX_TABS } from '../../.workspace-build/web/workspace-state.js';
const file = (name, text) => new File([text], name);
const json = value => file('backup.json', JSON.stringify(value));
const raw = (patch = {}) => ({ ...newDraft('Saved.sql', 'SELECT {id:UInt64}'), parameters: { id: '9007199254740993' }, ...patch });
const state = () => { const draft = newDraft('Current.sql', 'SELECT 0'); return { version: 1, tabs: [draft], activeId: draft.id, closedTabs: [newDraft('Closed.sql', 'SELECT -1')] }; };

test('SQL files open in selection order with exact text, including empty drafts', async () => {
    const preview = await previewLocalFiles([file('one.SQL', 'SELECT 1;\n'), file('two.sql', '')]);
    assert.deepEqual(preview.candidates.map(c => [c.draft.name, c.draft.sql, c.origin]), [['one.SQL', 'SELECT 1;\n', 'sql'], ['two.sql', '', 'sql']]);
});
test('UTF-8 BOM is handled while Unicode and line endings are preserved', async () => {
    const sql = "SELECT 'Việt Nam 🐈';\r\n";
    const preview = await previewLocalFiles([file('unicode.sql', '\ufeff' + sql)]);
    assert.equal(preview.candidates[0].draft.sql, sql);
});
test('SQL file paths become ordinary document names', async () => {
    const preview = await previewLocalFiles([file('folder\\analysis.sql', 'SELECT 1')]);
    assert.equal(preview.candidates[0].draft.name, 'analysis.sql');
});
test('Legacy backups include open and closed drafts without changing their order', async () => {
    const preview = await previewLocalFiles([json({ version: 1, tabs: [raw()], closedTabs: [raw({ name: 'Closed.sql', sql: 'SELECT 2' })] })]);
    assert.deepEqual(preview.candidates.map(c => [c.origin, c.draft.name]), [['open', 'Saved.sql'], ['closed', 'Closed.sql']]);
});
test('A closed-only backup remains recoverable', async () => {
    const preview = await previewLocalFiles([json({ version: 1, closedTabs: [raw()] })]);
    assert.equal(preview.candidates.length, 1);
    assert.equal(preview.candidates[0].origin, 'closed');
});
test('Export/import round trip preserves content and includes destination-independent connection context', async () => {
    const current = state();
    current.tabs[0] = raw({ name: 'Metrics.sql', kind: 'metric', metric: { definition: 'Total', grain: 'daily', dimensions: ['day'], timezone: 'UTC', filters: '', nullTreatment: 'ignore', sourceColumns: ['db.events.value'] }, chart: { kind: 'bar', x: 0, ys: [1], title: 'Totals' }, from: 2, to: 5 });
    const backup = localDraftBackup(current, { id: 'source', name: 'Source connection', database: 'analytics', password: 'never-export' });
    assert.equal(backup.format, 'cathedral-local-drafts');
    assert.equal(backup.sourceConnection.password, undefined);
    const preview = await previewLocalFiles([json(backup)]);
    const restored = preview.candidates[0].draft;
    assert.equal(restored.sql, current.tabs[0].sql);
    assert.deepEqual(restored.parameters, { id: '9007199254740993' });
    assert.deepEqual(restored.chart, current.tabs[0].chart);
    assert.deepEqual(restored.metric, current.tabs[0].metric);
    assert.deepEqual([restored.from, restored.to], [2, 5]);
    assert.deepEqual(preview.sourceConnections, ['Source connection']);
    assert.notEqual(restored.id, current.tabs[0].id);
});
test('Imports do not inherit saved identity, runs, dependencies, approvals or checkpoint revision links', async () => {
    const source = raw({ serverId: 'document', baseRevision: 9, activeRunId: 'run', scriptId: 'script', runIds: ['run'], parentRunId: 'parent-run', parentDocumentId: 'parent-doc', dependencies: ['dependency'], verifiedRevision: 9, publishedRevision: 9,
        checkpoints: [{ id: 'point', sql: 'SELECT 1', at: '2026-01-01T00:00:00Z', reason: 'Before edit', from: 0, to: 8, parentRevision: 9 }] });
    const { draft } = (await previewLocalFiles([json({ version: 1, tabs: [source] })])).candidates[0];
    for (const key of ['serverId', 'baseRevision', 'activeRunId', 'scriptId', 'parentRunId', 'parentDocumentId', 'verifiedRevision', 'publishedRevision']) assert.equal(draft[key], undefined, key);
    assert.deepEqual(draft.runIds, []); assert.deepEqual(draft.dependencies, []);
    assert.equal(draft.checkpoints[0].sql, 'SELECT 1'); assert.equal(draft.checkpoints[0].parentRevision, undefined);
    assert.notEqual(draft.checkpoints[0].id, 'point');
});
test('Duplicate input IDs and names remain separate copies', async () => {
    const value = raw({ id: 'same' });
    const preview = await previewLocalFiles([json({ version: 1, tabs: [value, value] })]);
    assert.equal(preview.candidates.length, 2);
    assert.notEqual(preview.candidates[0].draft.id, preview.candidates[1].draft.id);
});
test('Optional chart metadata and invalid selections are safely normalized', async () => {
    const preview = await previewLocalFiles([json({ version: 1, tabs: [raw({ chart: { kind: 'unknown', x: -3, ys: null }, from: -100, to: 999999 })] })]);
    const draft = preview.candidates[0].draft;
    assert.deepEqual(draft.chart, { kind: 'table', x: 0, ys: [], title: 'Query result' });
    assert.equal(draft.from, 0); assert.equal(draft.to, draft.sql.length);
});
for (const value of [null, [], {}, { version: 2, tabs: [raw()] }, { version: 1, format: 'other', tabs: [raw()] }, { version: 1, tabs: {} }, { version: 1, tabs: [], closedTabs: {} }]) {
    test(`Unsupported backup shape rejects: ${JSON.stringify(value).slice(0, 80)}`, async () => {
        await assert.rejects(previewLocalFiles([json(value)]), /format|arrays/);
    });
}
test('Saved-workspace bundles point to the existing library importer', async () => {
    await assert.rejects(previewLocalFiles([json({ format: 'cathedral-workspace', version: 1, documents: [] })]), /revision library/);
});
test('Empty backups reject instead of inventing sample SQL', async () => {
    await assert.rejects(previewLocalFiles([json({ version: 1, tabs: [], closedTabs: [] })]), /no drafts/);
});
for (const patch of [{ sql: null }, { sql: 'x'.repeat(200001) }, { name: '' }, { name: ' ' }, { name: 'x'.repeat(181) }, { parameters: [] }, { parameters: { id: 9007199254740992 } }, { parameters: { id: 'x'.repeat(4001) } }, { parameters: { 'not a name': 'x' } }, { checkpoints: [null] }, { checkpoints: [ { sql: 123 } ] }, { checkpoints: Array.from({ length: 31 }, () => ({ sql: 'SELECT 1' })) }]) {
    test(`Malformed draft content rejects (${Object.keys(patch)[0]} ${JSON.stringify(patch).slice(0, 70)})`, async () => {
        await assert.rejects(previewLocalFiles([json({ version: 1, tabs: [raw(patch)] })]));
    });
}
for (const key of ['__proto__', 'constructor', 'prototype']) {
    test(`Reserved parameter ${key} cannot be imported`, async () => {
        const parameters = Object.fromEntries([[key, 'value']]);
        await assert.rejects(previewLocalFiles([json({ version: 1, tabs: [raw({ parameters })] })]), /parameter names/);
    });
}
test('More than 50 parameters is rejected without silently dropping values', async () => {
    await assert.rejects(previewLocalFiles([json({ version: 1, tabs: [raw({ parameters: Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`p${i}`, 'x'])) })] })]), /50 text values/);
});
test('One invalid sibling rejects the whole preview and does not mutate current tabs', async () => {
    const current = state(), before = structuredClone(current);
    await assert.rejects(previewLocalFiles([file('valid.sql', 'SELECT 1'), json({ version: 1, tabs: [raw(), null] })]));
    assert.deepEqual(current, before);
});
for (const name of ['file.csv', 'file.exe', 'file', 'file.sql.exe']) test(`Unsupported file ${name} rejects`, async () => {
    await assert.rejects(previewLocalFiles([file(name, 'SELECT 1')]), /choose a .sql file/);
});
test('Malformed UTF-8 fails rather than replacing characters in SQL', async () => {
    await assert.rejects(previewLocalFiles([file('broken.sql', new Uint8Array([0xc3, 0x28]))]), /UTF-8/);
});
test('Invalid JSON has an actionable error', async () => {
    await assert.rejects(previewLocalFiles([file('broken.json', '{')]), /invalid JSON/);
});
test('File read errors propagate without a partial preview', async () => {
    await assert.rejects(previewLocalFiles([{ name: 'file.sql', size: 2, arrayBuffer: async () => { throw new Error('read failed'); } }]), /read failed/);
});
test('All file sizes are validated before any content is read', async () => {
    let reads = 0;
    await assert.rejects(previewLocalFiles([{ name: 'first.sql', size: 1, arrayBuffer: async () => { reads++; return new ArrayBuffer(1); } }, { name: 'big.sql', size: MAX_LOCAL_FILE_BYTES + 1, arrayBuffer: async () => { reads++; } }]), /5 MB/);
    assert.equal(reads, 0);
});
test('Combined size limit is enforced before reading', async () => {
    let reads = 0;
    const files = Array.from({ length: 3 }, () => ({ name: 'large.sql', size: MAX_LOCAL_BATCH_BYTES / 2, arrayBuffer: async () => { reads++; } }));
    await assert.rejects(previewLocalFiles(files), /10 MB/); assert.equal(reads, 0);
});
test('Actual bytes must match the selected file metadata', async () => {
    await assert.rejects(previewLocalFiles([{ name: 'changed.sql', size: 3, arrayBuffer: async () => new ArrayBuffer(2) }]), /changed while reading/);
});
test('Empty selections and too many selected files reject', async () => {
    await assert.rejects(previewLocalFiles([]), /between 1 and 30/);
    await assert.rejects(previewLocalFiles(Array.from({ length: 31 }, () => file('q.sql', ''))), /between 1 and 30/);
});
test('Oversized backup queues reject rather than silently dropping drafts', async () => {
    await assert.rejects(previewLocalFiles([json({ version: 1, tabs: Array.from({ length: 31 }, () => raw()) })]), /30 open and 10 closed/);
    await assert.rejects(previewLocalFiles([json({ version: 1, tabs: [], closedTabs: Array.from({ length: 11 }, () => raw()) })]), /30 open and 10 closed/);
});
test('Forty backup drafts can be previewed but aggregate previews are bounded', async () => {
    const backup = json({ version: 1, tabs: Array.from({ length: 30 }, () => raw()), closedTabs: Array.from({ length: 10 }, () => raw()) });
    assert.equal((await previewLocalFiles([backup])).candidates.length, 40);
    await assert.rejects(previewLocalFiles([backup, file('extra.sql', '')]), /40 drafts/);
});
test('Aborted file selection does not read anything', async () => {
    const controller = new AbortController(); controller.abort();
    let reads = 0;
    await assert.rejects(previewLocalFiles([{ name: 'q.sql', size: 0, arrayBuffer: async () => { reads++; } }], controller.signal), { name: 'AbortError' });
    assert.equal(reads, 0);
});
test('Closing or changing selection during a read discards the late result', async () => {
    const controller = new AbortController();
    await assert.rejects(previewLocalFiles([{ name: 'q.sql', size: 0, arrayBuffer: async () => { controller.abort(); return new ArrayBuffer(0); } }], controller.signal), { name: 'AbortError' });
});
test('Appending is atomic and preserves existing tabs and closed history', () => {
    const current = state(), before = structuredClone(current), incoming = raw();
    const next = appendLocalDrafts(current, [incoming]);
    assert.deepEqual(current, before); assert.strictEqual(next.tabs[0], current.tabs[0]); assert.strictEqual(next.closedTabs, current.closedTabs);
    assert.equal(next.tabs.length, 2); assert.equal(next.activeId, next.tabs[1].id); assert.notEqual(next.tabs[1].id, incoming.id);
});
test('Appending rechecks capacity and never drops or closes existing tabs', () => {
    const current = state(); current.tabs = Array.from({ length: MAX_TABS }, () => raw()); current.activeId = current.tabs[0].id;
    const before = structuredClone(current);
    assert.throws(() => appendLocalDrafts(current, [raw()]), /0 tab slots/); assert.deepEqual(current, before);
    assert.throws(() => appendLocalDrafts(state(), []), /at least one/);
});
test('Appending at the exact capacity boundary succeeds', () => {
    const next = appendLocalDrafts(state(), Array.from({ length: MAX_TABS - 1 }, () => raw()));
    assert.equal(next.tabs.length, MAX_TABS); assert.equal(new Set(next.tabs.map(t => t.id)).size, MAX_TABS);
});
test('Independent copies cannot mutate each other or the preview', () => {
    const incoming = raw(), next = appendLocalDrafts(state(), [incoming, incoming]);
    next.tabs[1].parameters.id = 'changed'; next.tabs[1].chart.ys.push(5);
    assert.equal(incoming.parameters.id, '9007199254740993'); assert.equal(next.tabs[2].parameters.id, '9007199254740993');
    assert.deepEqual(next.tabs[2].chart.ys, []);
});
test('Appended drafts survive the existing persistence recovery without restoring server authority', async () => {
    const next = appendLocalDrafts(state(), [raw({ serverId: 'server', activeRunId: 'run' })]);
    const restored = recover('key', { getItem: () => JSON.stringify(next) });
    assert.equal(restored.tabs[1].sql, next.tabs[1].sql);
    assert.deepEqual(restored.tabs[1].parameters, next.tabs[1].parameters);
    assert.equal(restored.tabs[1].serverId, undefined); assert.equal(restored.tabs[1].activeRunId, undefined);
});
test('Isolated draft helper drops any extraneous fields by construction', () => {
    const copy = isolatedDraft(raw({ owner: 'someone-else', token: 'not-authority', connectionId: 'other' }));
    assert.equal(copy.owner, undefined); assert.equal(copy.token, undefined); assert.equal(copy.connectionId, undefined);
});
