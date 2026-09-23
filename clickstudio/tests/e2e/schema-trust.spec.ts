import { test, expect, type Page, type Route } from '@playwright/test';

const schema = {
    connectionId: 'live',
    fetchedAt: '2026-09-23T00:00:00.000Z',
    tables: [{ database: 'analytics', name: 'events', engine: 'MergeTree', orderBy: '(tenant_id, day)', primaryKey: 'tenant_id, day', partitionKey: 'toYYYYMM(day)', samplingKey: 'tenant_id', ttlConfigured: true, rowEstimate: '1200000', sizeBytes: '1610612736', uncompressedBytes: '4294967296', parts: '20', activeParts: '18', projections: [{ name: 'by_day', type: 'Normal', sortingKey: 'day' }], skipIndexes: [{ name: 'tenant_bloom', type: 'bloom_filter', expression: 'tenant_id', granularity: '4' }] }],
    columns: [{ database: 'analytics', table: 'events', name: 'day', type: 'Date', defaultKind: '', comment: 'Event date' }],
    dictionaries: [{ database: 'analytics', name: 'campaign_lookup', status: 'LOADED', type: 'Hashed', keyColumns: 'campaign_id UInt64', attributeColumns: 'campaign_name String', elementCount: '18240', memoryBytes: '5242880', lastSuccessfulUpdate: '2026-09-23 08:15:00' }],
    warnings: [],
    truncated: false,
};

async function mockLiveWorkspace(page: Page, respondToSchema: (route: Route) => Promise<void>) {
    let trusted = true;
    let schemaRequests = 0;
    await page.route('**/api/session', route => route.fulfill({ json: { principal: { id: 'test-owner', role: 'owner' }, requiresLogin: false, demo: false } }));
    await page.route('**/api/connections', route => route.fulfill({ json: [{
        id: 'live', name: 'Test database', host: 'https://clickhouse.example', database: 'analytics', username: 'reader', readonly: true, trusted,
        limits: { rows: 5000, bytes: 2000000, seconds: 30, memory: 536870912, threads: 4 },
        manifest: { version: 1, serverVersion: '26.1', testedAt: '2026-09-23T00:00:00.000Z', schema: { available: true }, progress: { available: true }, cancellation: { available: true }, explain: { available: true }, pipeline: { available: true }, queryLog: { available: true }, documentation: { available: false }, import: { available: false }, scripts: { available: true }, parameters: { available: true } },
    }] }));
    await page.route('**/api/connections/live/trust', async route => {
        trusted = Boolean((route.request().postDataJSON() as { trusted?: unknown }).trusted);
        await route.fulfill({ json: { trusted } });
    });
    await page.route('**/api/connections/live/schema', async route => {
        schemaRequests++;
        await respondToSchema(route);
    });
    await page.route('**/api/runs**', route => route.fulfill({ json: [] }));
    await page.route('**/api/documents**', route => route.fulfill({ json: [] }));
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Run statement', exact: true })).toBeEnabled();
    return { get schemaRequests() { return schemaRequests; } };
}

async function revokeAccess(page: Page) {
    await page.locator('.connection-trigger').click();
    await page.getByRole('dialog', { name: 'Connection details' }).getByRole('button', { name: 'Turn off read-only access', exact: true }).click();
    await expect(page.locator('.connection-quick-status')).toHaveText('Review needed');
    await expect(page.getByText('Schema is private', { exact: true })).toBeVisible();
}

async function replaceSql(page: Page, sql: string) {
    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.insertText(sql);
    await expect(editor).toContainText(sql);
}

async function hoverToken(page: Page, token: string) {
    const point = await page.locator('.cm-content').evaluate((root, value) => {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node: Node | null;
        while ((node = walker.nextNode())) {
            const text = node.textContent ?? '', start = text.indexOf(value);
            if (start < 0) continue;
            const range = document.createRange();
            range.setStart(node, start);
            range.setEnd(node, start + value.length);
            const bounds = range.getBoundingClientRect();
            return { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
        }
        return undefined;
    }, token);
    if (!point) throw new Error(`Could not find SQL token ${token}`);
    await page.mouse.move(point.x, point.y);
}

test('Revoking trust removes loaded schema from editor completion and hover', async ({ page }) => {
    await mockLiveWorkspace(page, route => route.fulfill({ json: schema }));
    await expect(page.getByText('events', { exact: true }).first()).toBeVisible();
    await replaceSql(page, 'SELECT day FROM events');
    await hoverToken(page, 'day');
    await expect(page.locator('.sql-hover')).toContainText('Date');

    await revokeAccess(page);
    await replaceSql(page, 'SELECT * FROM ev');
    await page.keyboard.press('Control+Space');
    await expect(page.getByRole('option').filter({ hasText: 'events' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.mouse.move(0, 0);
    await replaceSql(page, 'SELECT day FROM events');
    await hoverToken(page, 'day');
    await expect(page.locator('.sql-hover')).toHaveCount(0);
});

test('Schema inspector shows ClickHouse keys, storage, indexes, and dictionaries', async ({ page }) => {
    await mockLiveWorkspace(page, route => route.fulfill({ json: schema }));
    const table = page.locator('.schema-table').filter({ hasText: 'events' });
    await expect(table).toBeVisible();
    await table.locator('summary').click();

    await expect(table).toContainText('MergeTree');
    await expect(table).toContainText('ORDER BY');
    await expect(table).toContainText('(tenant_id, day)');
    await expect(table).toContainText('PRIMARY KEY');
    await expect(table).toContainText('PARTITION BY');
    await expect(table).toContainText('SAMPLE BY');
    await expect(table).toContainText('Configured');
    await expect(table).toContainText('1.2M rows');
    await expect(table).toContainText('1.5 GiB');
    await expect(table).toContainText('18 active');
    await expect(table).toContainText('by_day');
    await expect(table).toContainText('tenant_bloom');
    await expect(page.getByText('campaign_lookup', { exact: true })).toBeVisible();
    await expect(page.getByText('18.2K entries')).toBeVisible();

    const search = page.getByRole('textbox', { name: 'Search schema' });
    await search.fill('tenant_bloom');
    await expect(page.locator('.schema-table')).toHaveCount(1);
    await search.fill('campaign_lookup');
    await expect(page.locator('.schema-table')).toHaveCount(0);
    await expect(page.getByText('campaign_lookup', { exact: true })).toBeVisible();
});

test('A schema response arriving after trust is revoked cannot restore editor metadata', async ({ page }) => {
    let releaseSchema!: () => void;
    let notifyStarted!: () => void;
    const gate = new Promise<void>(resolve => { releaseSchema = resolve; });
    const started = new Promise<void>(resolve => { notifyStarted = resolve; });
    const state = await mockLiveWorkspace(page, async route => {
        notifyStarted();
        await gate;
        await route.fulfill({ json: schema });
    });
    await started;
    expect(state.schemaRequests).toBeGreaterThan(0);
    await revokeAccess(page);
    releaseSchema();
    await expect(page.getByText('Schema is private', { exact: true })).toBeVisible();
    await replaceSql(page, 'SELECT * FROM ev');
    await page.keyboard.press('Control+Space');
    await expect(page.getByRole('option').filter({ hasText: 'events' })).toHaveCount(0);
});
