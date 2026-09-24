import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesDraft, sameParameters } from '../../.workspace-build/shared/evidence.js';

for (const [title, left, right, expected] of [
    ['Empty parameters match', {}, {}, true],
    ['Insertion order does not change evidence', { a: '1', b: '2' }, { b: '2', a: '1' }, true],
    ['Changed parameter makes evidence stale', { value: 'before' }, { value: 'after' }, false],
    ['Missing key is not an empty value', { value: '' }, {}, false],
    ['Additional parameter is detected', {}, { value: '' }, false],
    ['UInt64 strings remain exact', { n: '18446744073709551615' }, { n: '18446744073709551614' }, false],
    ['Only own keys participate', { toString: 'x' }, {}, false],
]) test(title, () => assert.equal(sameParameters(left, right), expected));

test('Draft matching checks both SQL and bound values without mutating evidence', () => {
    const run = Object.freeze({ sql: 'SELECT {n:UInt64}', parameters: Object.freeze({ n: '1' }) });
    assert.equal(matchesDraft(run, '\nSELECT {n:UInt64}\n', { n: '1' }), true);
    assert.equal(matchesDraft(run, run.sql, { n: '2' }), false);
    assert.equal(matchesDraft(run, 'SELECT 2', { n: '1' }), false);
    assert.deepEqual(run.parameters, { n: '1' });
});

// Publication preflight must reject unusable evidence before saving another revision.
const { publicationIssue } = await import('../../.workspace-build/shared/evidence.js');
const completed = { id: 'run-1', connectionId: 'demo', sql: 'SELECT {n:UInt64}', parameters: { n: '9007199254740993' },
    kind: 'query', status: 'succeeded', resultState: 'reopenable' };
const draft = { activeRunId: completed.id, connectionId: completed.connectionId, sql: completed.sql, parameters: completed.parameters };

test('Completed matching evidence passes publication preflight', () => {
    assert.equal(publicationIssue(completed, draft), undefined);
    assert.equal(publicationIssue({ ...completed, status: 'truncated' }, draft), undefined);
});

test('Missing, unloaded and differently selected runs fail preflight', () => {
    assert.match(publicationIssue(undefined, draft), /Select a completed/);
    assert.match(publicationIssue(completed, { ...draft, activeRunId: undefined }), /Select a completed/);
    assert.match(publicationIssue(completed, { ...draft, activeRunId: 'other' }), /Select a completed/);
});

test('Changed SQL, exact parameters and connection fail preflight', () => {
    assert.match(publicationIssue(completed, { ...draft, sql: 'SELECT 2' }), /exact SQL and bound parameters/);
    assert.match(publicationIssue(completed, { ...draft, parameters: { n: '9007199254740994' } }), /exact SQL and bound parameters/);
    assert.match(publicationIssue(completed, { ...draft, connectionId: 'other' }), /different draft or connection/);
});

for (const kind of ['explain', 'plan', 'pipeline']) {
    test(`${kind} output is not publishable query evidence`, () => {
        assert.match(publicationIssue({ ...completed, kind }, draft), /query itself/);
    });
}

for (const status of ['queued', 'running', 'failed', 'cancelled', 'timed_out', 'interrupted']) {
    test(`${status} runs fail publication preflight`, () => {
        assert.match(publicationIssue({ ...completed, status }, draft), /successful query result/);
    });
}

for (const resultState of ['pending', 'expired', 'unavailable']) {
    test(`${resultState} result data fails publication preflight`, () => {
        assert.match(publicationIssue({ ...completed, resultState }, draft), /unavailable or expired/);
    });
}

test('Preflight treats reordered parameter maps as the same values and changes nothing', () => {
    const run = { ...completed, parameters: { n: '9007199254740993', region: 'east' } };
    const current = { ...draft, parameters: { region: 'east', n: '9007199254740993' } };
    const before = structuredClone({ run, current });
    assert.equal(publicationIssue(run, current), undefined);
    assert.deepEqual({ run, current }, before);
});
