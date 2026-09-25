import test from 'node:test';
import assert from 'node:assert/strict';
import { isSchema } from '../../.core-build/shared/schema.js';

const baseSchema = () => ({
    connectionId: 'playground',
    fetchedAt: '2026-09-25T00:00:00.000Z',
    columns: [{ database: 'github', table: 'events', name: 'event_type', type: 'String', defaultKind: '', comment: '' }],
    tables: [{ database: 'github', name: 'events', engine: 'MergeTree' }],
    warnings: [],
    truncated: false,
});

test('Schema wire guard accepts complete optional metadata', () => {
    const schema = {
        ...baseSchema(),
        tables: [{
            database: 'github', name: 'events', engine: 'MergeTree',
            orderBy: 'created_at', primaryKey: 'created_at', partitionKey: '', samplingKey: '',
            ttlConfigured: false, materializedViewTarget: '', rowEstimate: null, sizeBytes: '12',
            uncompressedBytes: '24', parts: '1', activeParts: '1', skipIndexTypes: ['minmax'],
            projections: [{ name: 'by_actor', type: 'Projection', sortingKey: 'actor_login' }],
            skipIndexes: [{ name: 'event_idx', type: 'set', expression: 'event_type', granularity: '1' }],
        }],
        dictionaries: [{
            database: 'github', name: 'actors', status: 'LOADED', type: 'HASHED',
            keyColumns: 'id', attributeColumns: 'name', elementCount: '10',
            memoryBytes: '128', lastSuccessfulUpdate: '2026-09-25T00:00:00.000Z',
        }],
        systemTableDocumentationNames: ['tables'],
        metadataWarnings: ['Metadata is partial'],
    };
    assert.equal(isSchema(schema), true);
});

test('Schema wire guard rejects malformed nested cache data', () => {
    const invalid = [
        { ...baseSchema(), columns: [{ database: 'github', table: 'events', name: 'event_type', type: 1, defaultKind: '', comment: '' }] },
        { ...baseSchema(), tables: [{ database: 'github', name: 'events', engine: 'MergeTree', rowEstimate: 42 }] },
        { ...baseSchema(), warnings: ['ok', 1] },
        { ...baseSchema(), tables: [{ database: 'github', name: 'events', engine: 'MergeTree', projections: [{ name: 'p', type: 'Projection' }] }] },
        { ...baseSchema(), dictionaries: [{ database: 'github', name: 'actors', status: 'LOADED', type: 'HASHED', keyColumns: 'id', attributeColumns: 'name', elementCount: 10, memoryBytes: '128', lastSuccessfulUpdate: 'now' }] },
    ];
    for (const value of invalid)
        assert.equal(isSchema(value), false);
});
