import test from 'node:test';
import assert from 'node:assert/strict';
import { executionLimitIssue, executionLimits, sameSavedContent, draftSaveStatus, scopedHistory, searchHistory, HISTORY_STATUSES } from '../../.workspace-build/shared/workspace-view.js';
import { HARD_LIMITS } from '../../.workspace-build/shared/types.js';

for (const field of ['rows', 'seconds']) {
    for (const value of ['', ' ', '0', '-1', '1.5', 'abc', 'NaN', 'Infinity', '-Infinity', '9007199254740993', String(HARD_LIMITS[field] + 1)]) {
        test(`${field} rejects ${JSON.stringify(value)} without coercing it into a valid limit`, () => {
            assert.match(executionLimitIssue(value, field), /must be a whole number/);
        });
    }
    for (const value of ['1', ' 2 ', String(HARD_LIMITS[field])]) {
        test(`${field} accepts ${JSON.stringify(value)}`, () => assert.equal(executionLimitIssue(value, field), undefined));
    }
}
test('Connection defaults are not mistaken for hard ceilings', () => {
    assert.deepEqual(executionLimits('10000', '60'), { rows: 10000, seconds: 60 });
});
test('Number formats already accepted by the execution payload remain supported', () => {
    assert.deepEqual(executionLimits('1e3', '30.0'), { rows: 1000, seconds: 30 });
});
test('Payload validation rejects either invalid field before building limits', () => {
    assert.throws(() => executionLimits('', '30'), /Maximum returned rows/);
    assert.throws(() => executionLimits('5000', 'NaN'), /Deadline/);
});

function saved(overrides = {}) {
    return { id: 'document-1', owner: 'local-owner', connectionId: 'demo', name: 'Analysis.sql',
        sql: 'SELECT {n:UInt64}', parameters: { n: '9007199254740993', country: 'DE' },
        chart: { kind: 'bar', x: 0, ys: [1, 2], title: 'Analysis' }, kind: 'query', dependencies: ['source'],
        runId: 'run-1', revision: 3, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z',
        ...overrides };
}
function draft(document = saved(), overrides = {}) {
    return { ...document, id: 'local-tab', serverId: document.id, baseRevision: document.revision, activeRunId: document.runId,
        from: 0, to: 0, runIds: ['run-1'], checkpoints: [], ...overrides };
}
test('A fresh draft is explicitly local, not falsely labelled saved', () => {
    assert.equal(draftSaveStatus(draft(saved(), { serverId: undefined }), 'demo').state, 'local');
});
test('Exact saved content has a saved revision label', () => {
    assert.equal(draftSaveStatus(draft(), 'demo', saved()).label, 'Matches saved revision r3');
});
for (const [field, change] of Object.entries({
    name: 'Renamed.sql', sql: 'SELECT 2', parameters: { n: '9007199254740994', country: 'DE' },
    chart: { kind: 'line', x: 0, ys: [1, 2], title: 'Analysis' }, kind: 'snippet', dependencies: ['other'],
    activeRunId: 'run-2', parentDocumentId: 'parent-2',
})) {
    test(`Changing ${field} marks the current draft unsaved`, () => {
        assert.equal(draftSaveStatus(draft(saved(), { [field]: change }), 'demo', saved()).state, 'changed');
    });
}
for (const [field, value] of Object.entries({ title: 'Different title', x: 1, ys: [2, 1] })) {
    test(`Chart ${field} participates in saved-state comparison`, () => {
        const d = draft(); d.chart = { ...d.chart, [field]: value };
        assert.equal(sameSavedContent(d, saved()), false);
    });
}
test('SQL whitespace edits still differ from the exact saved revision', () => {
    assert.equal(sameSavedContent(draft(saved(), { sql: ` ${saved().sql}` }), saved()), false);
});
test('Selection and checkpoints do not mark document content dirty', () => {
    assert.equal(sameSavedContent(draft(saved(), { from: 5, to: 9, checkpoints: [{ sql: 'SELECT 1' }], runIds: ['other'] }), saved()), true);
});
test('Parameter insertion order does not produce a false dirty state', () => {
    assert.equal(sameSavedContent(draft(saved(), { parameters: { country: 'DE', n: '9007199254740993' } }), saved()), true);
});
test('Cleared parameters do not equal a missing parameter key', () => {
    assert.equal(sameSavedContent(draft(saved(), { parameters: { n: '', country: 'DE' } }), saved()), false);
});
test('Review and publication markers are not editable content', () => {
    assert.equal(sameSavedContent(draft(), saved({ verifiedRevision: 3, publishedRevision: 3 })), true);
});
const metric = { definition: 'sum(amount)', grain: 'day', dimensions: ['country'], timezone: 'UTC', filters: '', nullTreatment: 'ignore', sourceColumns: ['amount'] };
for (const key of Object.keys(metric)) {
    test(`Metric ${key} edits are unsaved`, () => {
        const s = saved({ kind: 'metric', metric });
        const d = draft(s, { metric: { ...metric, [key]: Array.isArray(metric[key]) ? ['changed'] : 'changed' } });
        assert.equal(sameSavedContent(d, s), false);
    });
}
test('Metric key order does not produce a false change', () => {
    const s = saved({ kind: 'metric', metric });
    assert.equal(sameSavedContent(draft(s, { metric: Object.fromEntries(Object.entries(metric).reverse()) }), s), true);
});
test('Saving does not claim edits made during the request were saved', () => {
    const submitted = draft(), edited = { ...submitted, sql: 'SELECT 999' };
    assert.equal(draftSaveStatus(edited, 'demo', saved(), { saving: true }).state, 'saving');
    const response = saved({ revision: 4 });
    const current = { ...edited, baseRevision: response.revision };
    assert.equal(draftSaveStatus(current, 'demo', response).state, 'changed');
});
test('Failure to read a saved revision is not presented as saved', () => {
    assert.equal(draftSaveStatus(draft(), 'demo', saved(), { readError: true }).state, 'unavailable');
});
test('Loaded cached content stays verifiable during a background refresh', () => {
    assert.equal(draftSaveStatus(draft(), 'demo', saved(), { pending: true }).state, 'saved');
});
test('Initial loading is distinguished from a missing saved file', () => {
    assert.equal(draftSaveStatus(draft(), 'demo', undefined, { pending: true }).state, 'checking');
    assert.equal(draftSaveStatus(draft(), 'demo').state, 'unavailable');
});
test('A newer revision stays a conflict even when its SQL matches', () => {
    assert.equal(draftSaveStatus(draft(), 'demo', saved({ revision: 4 })).state, 'conflict');
});
test('Trash is distinct from a conflict or unsaved status', () => {
    assert.equal(draftSaveStatus(draft(), 'demo', saved({ deletedAt: '2026-01-03T00:00:00Z' })).state, 'deleted');
});
for (const other of [saved({ id: 'other' }), saved({ connectionId: 'other' }), saved({ revision: 2 })]) {
    test(`Mismatched baseline ${other.id}/${other.connectionId}/r${other.revision} is unavailable`, () => {
        assert.equal(draftSaveStatus(draft(), 'demo', other).state, 'unavailable');
    });
}
test('A missing base revision is not described as a known conflict', () => {
    assert.equal(draftSaveStatus(draft(saved(), { baseRevision: undefined }), 'demo', saved()).state, 'unavailable');
});

function run(id, options = {}) {
    return { id, queryId: `clickstudio-${id}`, connectionId: 'demo', sql: `SELECT '${id}'`, status: 'succeeded', createdAt: '2026-01-01T00:00:00Z', ...options };
}
const scope = { connectionId: 'demo', runIds: ['before-save'], allFiles: false };
test('Saving a local draft keeps its earlier unnamed run in current-file history', () => {
    const runs = [run('before-save'), run('after-save', { documentId: 'saved-1' }), run('unrelated')];
    assert.deepEqual(scopedHistory(runs, { ...scope, documentId: 'saved-1' }).map(r => r.id), ['before-save', 'after-save']);
});
test('Script run references participate in the same file scope', () => {
    assert.deepEqual(scopedHistory([run('statement-1'), run('statement-2'), run('other')], { ...scope, runIds: ['statement-1', 'statement-2'] }).map(r => r.id), ['statement-1', 'statement-2']);
});
test('All-file history cannot leak runs from another connection', () => {
    assert.deepEqual(scopedHistory([run('mine'), run('other', { connectionId: 'other' })], { ...scope, allFiles: true }).map(r => r.id), ['mine']);
});
test('A matching local reference does not override the connection scope', () => {
    assert.deepEqual(scopedHistory([run('before-save', { connectionId: 'other' })], scope), []);
});
test('Two undefined document IDs do not make unrelated drafts the same file', () => {
    assert.deepEqual(scopedHistory([run('before-save'), run('unrelated')], scope).map(r => r.id), ['before-save']);
});
test('A run referenced locally and by document identity appears once', () => {
    assert.equal(scopedHistory([run('before-save', { documentId: 'saved-1' })], { ...scope, documentId: 'saved-1' }).length, 1);
});
test('Search covers SQL and query IDs, ignoring case and word order', () => {
    const list = [run('invoice-42', { sql: 'SELECT sum(amount) FROM invoices' }), run('other')];
    assert.deepEqual(searchHistory(list, 'INVOICE-42 sum', 'all').map(r => r.id), ['invoice-42']);
});
test('Search and status filters compose', () => {
    const list = [run('ok'), run('bad', { status: 'failed' }), run('timeout', { status: 'timed_out' })];
    assert.deepEqual(searchHistory(list, 'select', 'failed').map(r => r.id), ['bad']);
});
for (const { value } of HISTORY_STATUSES.filter(s => s.value !== 'all')) {
    test(`History supports ${value} without grouping different outcomes`, () => {
        const list = HISTORY_STATUSES.filter(s => s.value !== 'all').map(s => run(s.value, { status: s.value }));
        assert.deepEqual(searchHistory(list, '', value).map(r => r.status), [value]);
    });
}
test('History is newest first without changing cached data order', () => {
    const list = Object.freeze([Object.freeze(run('old')), Object.freeze(run('new', { createdAt: '2026-02-01T00:00:00Z' }))]);
    assert.deepEqual(searchHistory(list, '', 'all').map(r => r.id), ['new', 'old']);
    assert.deepEqual(list.map(r => r.id), ['old', 'new']);
});
test('Equal timestamps have deterministic order', () => {
    assert.deepEqual(searchHistory([run('b'), run('a')], '', 'all').map(r => r.id), ['a', 'b']);
});
test('Missing timestamps sort last without breaking search', () => {
    assert.deepEqual(searchHistory([run('undated', { createdAt: '' }), run('dated')], '', 'all').map(r => r.id), ['dated', 'undated']);
});
test('Search finds a match beyond the initial fifty rendered runs', () => {
    const list = Array.from({ length: 100 }, (_, n) => run(`run-${n}`));
    assert.deepEqual(searchHistory(list, "'run-99'", 'all').map(r => r.id), ['run-99']);
});
test('Whitespace-only search preserves every loaded run', () => {
    assert.equal(searchHistory([run('a'), run('b')], ' \n\t ', 'all').length, 2);
});
test('No matching history is an empty list, not an execution or write operation', () => {
    assert.deepEqual(searchHistory([run('a')], 'nonexistent', 'all'), []);
});

const { rememberRunIds } = await import('../../.workspace-build/shared/workspace-view.js');
test('Script polling remembers only new statement IDs', () => {
    const previous = ['query-1'];
    assert.deepEqual(rememberRunIds(previous, ['script-1', 'script-1', 'script-2']), ['query-1', 'script-1', 'script-2']);
    assert.deepEqual(previous, ['query-1']);
});
test('Repeated script polling returns the original history reference', () => {
    const previous = ['script-1', 'script-2'];
    assert.equal(rememberRunIds(previous, ['script-1', 'script-2']), previous);
});
test('Remembered script history survives a later non-script run', () => {
    const ids = rememberRunIds(rememberRunIds([], ['script-1', 'script-2']), ['query-3']);
    const runs = [run('script-1'), run('script-2'), run('query-3'), run('other')];
    assert.deepEqual(scopedHistory(runs, { ...scope, runIds: ids }).map(r => r.id), ['script-1', 'script-2', 'query-3']);
});
test('Without a search, polling does not scan or lowercase every SQL document', () => {
    const candidate = run('large');
    Object.defineProperty(candidate, 'sql', { get() { throw new Error('Unnecessary SQL scan'); } });
    assert.equal(searchHistory([candidate], '', 'all').length, 1);
});
