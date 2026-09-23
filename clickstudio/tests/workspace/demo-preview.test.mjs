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
