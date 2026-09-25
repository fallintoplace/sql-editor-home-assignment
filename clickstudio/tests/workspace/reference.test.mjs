import test from 'node:test';
import assert from 'node:assert/strict';
import { REFERENCE_CATEGORIES, REFERENCE_TYPES_BY_CATEGORY, buildReferenceEntryQuery, buildReferenceSearchQuery, isReferenceCategory, referenceId } from '../../.workspace-build/shared/reference.js';
import { BUNDLED_REFERENCE, findBundledReference, searchBundledReference } from '../../.workspace-build/web/reference-data.js';

test('Reference categories stay explicit and reject unknown URL values', () => {
    assert.deepEqual(REFERENCE_CATEGORIES, ['all', 'functions', 'types', 'engines', 'settings', 'system']);
    assert.equal(isReferenceCategory('system'), true);
    assert.equal(isReferenceCategory('Functions'), false);
    assert.equal(isReferenceCategory('unknown'), false);
    assert.ok(REFERENCE_TYPES_BY_CATEGORY.engines.includes('Table Engine'));
});

test('Reference search keeps user text in query parameters and caps the catalog response', () => {
    const input = "%' OR 1 = 1 --";
    const query = buildReferenceSearchQuery(input, 'all');
    assert.equal(query.parameters.search, input);
    assert.equal(query.sql.includes(input), false);
    assert.match(query.sql, /LIMIT 30$/);
    assert.match(query.sql, /positionCaseInsensitive\(name, \{search:String\}\)/);
    assert.match(query.sql, /lower\(name\) = lower\(\{search:String\}\)/);
});

test('Reference search ranks popular empty-query results and scopes category filters', () => {
    const popular = buildReferenceSearchQuery('', 'all');
    assert.match(popular.sql, /tuple\(toString\(type\), name\) IN/);
    assert.match(popular.sql, /indexOf\(\['Aggregate Function:quantileExact'/);
    assert.equal(popular.parameters.search, '');

    const engines = buildReferenceSearchQuery('Merge', 'engines');
    assert.match(engines.sql, /type IN \('Table Engine', 'Database Engine'/);
    assert.equal(engines.parameters.search, 'Merge');
    assert.doesNotMatch(buildReferenceSearchQuery('q'.repeat(200), 'all').parameters.search, /q{129}/);
    assert.equal(buildReferenceSearchQuery('q'.repeat(200), 'all').parameters.search.length, 128);
});

test('Reference entry SQL parameterizes identity and supports servers without source metadata', () => {
    const withSource = buildReferenceEntryQuery();
    const withoutSource = buildReferenceEntryQuery(false);
    assert.match(withSource, /name = \{name:String\} AND toString\(type\) = \{type:String\}/);
    assert.match(withSource, /description, source, version\(\) AS serverVersion/);
    assert.doesNotMatch(withoutSource, /source/);
});

test('Reference identifiers keep types distinct when names overlap', () => {
    assert.notEqual(referenceId({ name: 'MergeTree', type: 'Table Engine' }), referenceId({ name: 'MergeTree', type: 'Function' }));
});

test('Bundled references include practical SQL examples in a bounded offline catalog', () => {
    assert.equal(BUNDLED_REFERENCE.length, 30);
    assert.equal(new Set(BUNDLED_REFERENCE.map(referenceId)).size, BUNDLED_REFERENCE.length);
    assert.ok(BUNDLED_REFERENCE.every(entry => entry.origin === 'bundled' && entry.serverVersion === 'Demo catalog'));
    assert.ok(BUNDLED_REFERENCE.every(entry => entry.description.includes('```sql')));
    assert.match(findBundledReference('query_log', 'System Table').description, /query_log/);
    assert.equal(findBundledReference('query_log', 'Table Engine'), undefined);
});

test('Bundled search ranks popular entries and preserves category boundaries', () => {
    const all = searchBundledReference('', 'all');
    assert.deepEqual(all.slice(0, 3).map(entry => entry.name), ['quantileExact', 'uniq', 'MergeTree']);
    assert.ok(searchBundledReference('', 'engines').every(entry => entry.type.includes('Engine')));
    assert.ok(searchBundledReference('system.query_log', 'system').some(entry => entry.name === 'query_log'));
    assert.ok(searchBundledReference('system.columns', 'system').some(entry => entry.name === 'columns'));
    assert.ok(searchBundledReference('max_execution_time', 'settings').some(entry => entry.name === 'max_execution_time'));
    assert.ok(searchBundledReference('AggregatingMergeTree', 'engines').some(entry => entry.name === 'AggregatingMergeTree'));
    assert.ok(searchBundledReference('distinct values', 'functions').some(entry => entry.name === 'uniq'));
    assert.deepEqual(searchBundledReference('no such reference', 'all'), []);
});
