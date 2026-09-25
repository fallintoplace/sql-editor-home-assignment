import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCompressionRatio, parseMergeTreeParts, scalePartMetrics } from '../../.core-build/shared/parts.js';

const part = (overrides = {}) => ({
    partition: '202609', name: '202609_1_1_0', rows: '9000', marks: '2',
    compressed_bytes: '1000', uncompressed_bytes: '4000', level: '0',
    modified_at: '2026-09-24 08:00:00', total_parts: '1', ...overrides,
});

test('Parts parser keeps UInt64 counters exact and computes exact totals', () => {
    const largest = '18446744073709551615';
    const snapshot = parseMergeTreeParts('analytics', 'events', [
        part({ rows: largest, compressed_bytes: largest, uncompressed_bytes: largest }),
        part({ name: 'part-2', rows: '2', compressed_bytes: '3', uncompressed_bytes: '4' }),
    ]);
    assert.equal(snapshot.parts[0].rows, largest);
    assert.equal(snapshot.parts[0].compressedBytes, largest);
    assert.equal(snapshot.totals.rows, '18446744073709551617');
    assert.equal(snapshot.totals.compressedBytes, '18446744073709551618');
    assert.equal(formatCompressionRatio(snapshot.parts[0]), '1.00×');
});

test('Parts parser enforces the cap, keeps server total, and normalizes unsafe values', () => {
    const snapshot = parseMergeTreeParts('analytics', 'events', [
        part({ rows: '-1', compressed_bytes: '1.5', uncompressed_bytes: '999999999999999999999999999999999999999999999999999999999999999999999999999999999', total_parts: '4' }),
        part({ name: 'part-2', total_parts: '4' }),
        part({ name: 'part-3', total_parts: '4' }),
        part({ name: 'part-4', total_parts: '4' }),
    ], 2);
    assert.equal(snapshot.parts.length, 2);
    assert.equal(snapshot.totalParts, '4');
    assert.equal(snapshot.truncated, true);
    assert.equal(snapshot.parts[0].rows, '0');
    assert.equal(snapshot.parts[0].compressedBytes, '0');
    assert.equal(snapshot.parts[0].uncompressedBytes, '0');
});

test('Part treemap weights stay finite for very large values and retain zero-size parts', () => {
    const parts = parseMergeTreeParts('db', 'events', [
        part({ compressed_bytes: '18446744073709551615' }),
        part({ name: 'zero-size', compressed_bytes: '0' }),
    ]).parts;
    const values = scalePartMetrics(parts, 'compressedBytes');
    assert.equal(values[0] > 0, true);
    assert.equal(values[1], 0);
    assert.ok(values.every(value => Number.isFinite(value) && value <= 2 ** 48));
    assert.equal(scalePartMetrics(parts, 'rows').length, 2);
    assert.equal(scalePartMetrics(parts, 'marks').length, 2);
});

test('Empty and malformed rows produce a safe empty snapshot', () => {
    const snapshot = parseMergeTreeParts('db', 'events', [null, 4, 'ignored']);
    assert.equal(snapshot.parts.length, 0);
    assert.equal(snapshot.totalParts, '0');
    assert.equal(snapshot.truncated, false);
    assert.equal(snapshot.totals.compressedBytes, '0');
});
