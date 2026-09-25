import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { openWorkspacePanel } from './helpers.js';

test('Static Vercel preview loads the native parser and exports retained sample results', async ({ page }) => {
    const documentationRequests: string[] = [];
    page.on('request', request => {
        const payload = `${request.url()}\n${request.postData() ?? ''}`;
        if (payload.includes('system.documentation')) documentationRequests.push(payload);
    });
    const wasmResponsePromise = page.waitForResponse(response => new URL(response.url()).pathname === '/assets/clickhouse-parser.wasm');
    await page.goto('/');

    const wasmResponse = await wasmResponsePromise;
    expect(wasmResponse.status()).toBe(200);
    expect(wasmResponse.headers()['content-type']).toMatch(/^application\/wasm/);
    expect(Array.from((await wasmResponse.body()).subarray(0, 4))).toEqual([0, 97, 115, 109]);

    await openWorkspacePanel(page, 'parser');
    await expect(page.getByText('Ready · local WebAssembly')).toBeVisible();
    await expect(page.getByText('Valid ClickHouse SQL')).toBeVisible();

    await page.locator('.connection-trigger').click();
    await page.getByRole('dialog', { name: 'Data source options' })
        .getByRole('button', { name: /Sample data/ }).click();

    await page.getByRole('button', { name: 'Reference', exact: true }).click();
    await expect(page.getByTestId('reference-source')).toContainText('Offline ClickHouse reference');
    await page.getByTestId('reference-search').fill('MergeTree');
    const mergeTree = page.getByRole('option', { name: /MergeTree Table Engine/ }).first();
    await expect(mergeTree).toBeVisible();
    await mergeTree.click();
    const article = page.getByRole('article', { name: 'Table Engine: MergeTree' });
    await expect(article).toContainText('general-purpose engine');
    await expect(article.locator('.reference-markdown code')).toContainText('ORDER BY');
    await article.getByRole('button', { name: 'Insert name', exact: true }).click();
    await expect(page.locator('.cm-content')).toContainText('MergeTree');
    expect(documentationRequests).toEqual([]);

    await page.getByRole('button', { name: 'Objects', exact: true }).click();
    await page.getByTestId('schema-search').fill('events');
    const table = page.getByRole('button', { name: 'events MergeTree', exact: true });
    await expect(table).toBeVisible();
    await table.click();
    await page.getByRole('button', { name: 'Engine reference', exact: true }).click();
    await expect(page.getByRole('article', { name: 'Table Engine: MergeTree' })).toBeVisible();

    const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('.inspector-footer').getByRole('button', { name: 'Export', exact: true }).click(),
    ]);
    const csv = await readFile(await download.path(), 'utf8');
    expect(csv.split('\r\n')[0]).toContain('day');
    expect(csv).toContain('events');
});

test('Static Vercel preview searches native Playground docs with bound query parameters', async ({ page }) => {
    const requests: Array<{ url: string; sql: string }> = [];
    await page.route('https://sql-clickhouse.clickhouse.com:8443/**', async route => {
        const request = route.request();
        const sql = request.postData() ?? '';
        if (!sql.includes('system.documentation')) return route.continue();
        requests.push({ url: request.url(), sql });
        const details = sql.includes('version() AS serverVersion');
        const columns = details ? ['name', 'type', 'description', 'source', 'serverVersion'] : ['name', 'type', 'source'];
        const values = details ? ['MergeTree', 'Table Engine', 'MergeTree docs. Use `ORDER BY` for the sorting key.', 'src/Storages/MergeTree', '24.6-test'] : ['MergeTree', 'Table Engine', 'src/Storages/MergeTree'];
        const body = [JSON.stringify(columns), JSON.stringify(columns.map(() => 'String')), JSON.stringify(values), ''].join('\n');
        await route.fulfill({ status: 200, headers: { 'content-type': 'text/plain; charset=utf-8', 'access-control-allow-origin': '*' }, body });
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Reference', exact: true }).click();
    await page.getByTestId('reference-search').fill('MergeTree');
    const mergeTree = page.getByRole('option', { name: /MergeTree Table Engine/ }).first();
    await expect(mergeTree).toBeVisible();
    await mergeTree.click();
    const article = page.getByRole('article', { name: 'Table Engine: MergeTree' });
    await expect(article).toContainText('MergeTree docs.');
    await expect(article.locator('.reference-markdown code')).toContainText('ORDER BY');
    expect(requests.some(request => request.sql.includes('{search:String}') && new URL(request.url).searchParams.get('param_search') === 'MergeTree')).toBe(true);
    expect(requests.some(request => request.sql.includes('name = {name:String}') && new URL(request.url).searchParams.get('param_name') === 'MergeTree')).toBe(true);
});

test('Playground examples preview real SQL and open a draft without executing it', async ({ page }) => {
    const exampleSqlRequests: string[] = [];
    page.on('request', request => {
        const requestText = `${request.url()}\n${request.postData() ?? ''}`;
        if (new URL(request.url()).hostname === 'sql-clickhouse.clickhouse.com' && requestText.includes('toDate(created_at) AS day'))
            exampleSqlRequests.push(requestText);
    });
    await page.goto('/');
    await page.getByTestId('new-sql').click();

    const dialog = page.getByRole('dialog', { name: 'SQL examples', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('ClickHouse Playground', { exact: true })).toBeVisible();
    await dialog.getByTestId('sql-example-category-openSource').click();
    const dailyActivity = dialog.getByTestId('sql-example-github-daily-activity');
    await expect(dailyActivity).toBeVisible();
    await dailyActivity.click();
    await expect(dialog.locator('.sql-example-preview code')).toContainText('FROM github.events');
    await dialog.getByTestId('open-sql-example').click();

    await expect(page.getByRole('tab', { name: 'Daily activity.sql', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.cm-content')).toContainText('FROM github.events');
    await expect(page.locator('.execution-bar')).toHaveAttribute('data-run-status', 'ready');
    await expect(page.locator('.execution-bar code')).toHaveCount(0);
    expect(exampleSqlRequests).toEqual([]);
});

test('Charts filter opens a localized chart example in a new SQL tab without executing it', async ({ page }) => {
    const exampleSqlRequests: string[] = [];
    page.on('request', request => {
        const requestText = `${request.url()}\n${request.postData() ?? ''}`;
        if (new URL(request.url()).hostname === 'sql-clickhouse.clickhouse.com' && requestText.includes('toStartOfMonth(datetime) AS month'))
            exampleSqlRequests.push(requestText);
    });

    await page.goto('/');
    await page.getByTestId('new-sql').click();
    const dialog = page.getByRole('dialog', { name: 'SQL examples', exact: true });
    await dialog.getByTestId('sql-example-category-charts').click();

    const forexExample = dialog.getByTestId('sql-example-forex-eur-usd-monthly');
    await expect(forexExample).toBeVisible();
    await forexExample.click();
    await expect(dialog.locator('.sql-example-preview')).toContainText('Forex');
    await expect(dialog.locator('.sql-example-preview code')).toContainText('FROM forex.forex');
    await expect(dialog.locator('.sql-example-readonly')).toHaveText('Line chart');
    await dialog.getByTestId('open-sql-example').click();

    await expect(page.getByRole('tab', { name: 'EUR/USD monthly midpoint.sql', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.cm-content')).toContainText('FROM forex.forex');
    await expect(page.locator('.execution-bar')).toHaveAttribute('data-run-status', 'ready');
    expect(exampleSqlRequests).toEqual([]);
});
