import test from 'node:test';
import assert from 'node:assert/strict';
import { DemoPreviewApi } from '../../.workspace-build/web/demo-preview.js';

test('Static preview scripts keep semicolons inside strings and comments', async () => {
    const api = new DemoPreviewApi();
    const sql = "SELECT 'first;value' AS label;\n-- the ; here is a comment\nSELECT 2 /* and ; this is a block comment */";
    const script = await api.request('/scripts', { method: 'POST', body: { sql } });

    assert.equal(script.statements.length, 2);
    assert.deepEqual(script.statements.map(statement => statement.sql), [
        "SELECT 'first;value' AS label",
        '-- the ; here is a comment\nSELECT 2 /* and ; this is a block comment */',
    ]);
    for (const statement of script.statements)
        assert.equal(sql.slice(statement.from, statement.to), statement.sql);
});

test('New offline examples reopen with fixture rows matching their result columns', async () => {
    const api = new DemoPreviewApi();
    const documents = await api.request('/documents?connectionId=demo');
    const byId = new Map(documents.map(document => [document.id, document]));
    const cases = [
        ['preview-starter-monthly-revenue', ['month', 'completed_orders', 'revenue']],
        ['preview-starter-channel-conversion', ['channel', 'sessions', 'conversions', 'conversion_rate_pct']],
        ['preview-starter-signup-cohorts', ['cohort_month', 'plan', 'new_users', 'average_lifetime_value']],
        ['preview-starter-product-page-conversion', ['page_path', 'page_views', 'purchasers', 'conversion_rate_pct']],
    ];

    for (const [id, expectedColumns] of cases) {
        const document = byId.get(id);
        assert.ok(document, `missing offline example ${id}`);
        assert.ok(document.runId, `${id} should retain a sample run`);
        const result = await api.request(`/runs/${document.runId}/result?count=100`);
        assert.deepEqual(result.columns.map(column => column.name), expectedColumns);
        assert.ok(result.rows.length > 0, `${id} should have sample rows`);
    }
});
