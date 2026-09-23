import { test, expect, type Page, type Download } from '@playwright/test';
import type { Result } from '../../shared/types';
import { trust } from './helpers.js';

function countWrites(page: Page) {
    const calls = { runs: 0, documents: 0, imports: 0 };
    page.on('request', request => {
        const path = new URL(request.url()).pathname;
        if (request.method() === 'POST' && ['/api/runs', '/api/scripts'].includes(path)) calls.runs++;
        if (['POST', 'PUT'].includes(request.method()) && /^\/api\/documents(?:\/[^/]+)?$/.test(path)) calls.documents++;
        if (request.method() === 'POST' && path.startsWith('/api/import')) calls.imports++;
    });
    return calls;
}
async function snapshot(page: Page, transform: (result: Result) => Result) {
    await page.route('**/api/runs/*/snapshot', async route => {
        const response = await route.fetch();
        await route.fulfill({ response, json: transform(await response.json()) });
    });
}
async function run(page: Page) {
    await page.getByRole('button', { name: 'Run statement', exact: true }).click();
    const results = page.getByRole('region', { name: 'Query results', exact: true });
    await expect(results.getByRole('table', { name: 'Retained query rows' })).toBeVisible();
    return results;
}
async function downloadedText(download: Download): Promise<string> {
    const stream = await download.createReadStream();
    if (!stream) throw new Error('Download stream unavailable');
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks).toString('utf8');
}
test('Duplicate column names retain their positions and cell inspection reads the correct value', async ({ page }) => {
    const calls = countWrites(page);
    await snapshot(page, result => ({ ...result, columns: [{ name: 'same', type: 'String' }, { name: 'same', type: 'UInt64' }], rows: [['text', '9007199254740993']] }));
    await trust(page);
    const results = await run(page);
    await results.locator('.result-column-controls > summary').click();
    await results.getByRole('button', { name: 'Column 1: same', exact: true }).click();
    await expect(results.getByRole('table').locator('thead th')).toHaveCount(2);
    await expect(results.getByRole('button', { name: 'Column 2: same', exact: true })).toBeDisabled();
    const cell = results.getByRole('cell', { name: '9007199254740993', exact: true });
    await cell.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Inspect cell' });
    await expect(dialog.getByLabel('Full cell value')).toHaveText('9007199254740993');
    await expect(dialog).toContainText('UInt64');
    await dialog.press('Escape');
    await results.getByRole('button', { name: 'Show all columns', exact: true }).click();
    await expect(results.getByRole('table').locator('thead th')).toHaveCount(3);
    expect(calls).toEqual({ runs: 1, documents: 0, imports: 0 });
});

test('Filtered CSV exports visible columns across all matching pages while full exports stay complete', async ({ page }) => {
    const calls = countWrites(page);
    await snapshot(page, result => ({ ...result, columns: [{ name: 'label', type: 'String' }, { name: 'id', type: 'UInt64' }, { name: 'group', type: 'String' }], rows: Array.from({ length: 450 }, (_, index) => [`item-${index}`, String(9007199254740993n + BigInt(index)), index < 300 ? 'keep' : 'other']) }));
    await trust(page);
    const results = await run(page);
    await results.getByRole('textbox', { name: 'Filter retained rows', exact: true }).fill('keep');
    await results.locator('.result-column-controls > summary').click();
    await results.getByRole('button', { name: 'Column 3: group', exact: true }).click();
    await results.getByRole('button', { name: 'Last', exact: true }).click();
    await expect(results.locator('tbody tr')).toHaveCount(100);
    const [filteredDownload] = await Promise.all([page.waitForEvent('download'), results.getByRole('button', { name: 'Filtered CSV', exact: true }).click()]);
    const filtered = await downloadedText(filteredDownload);
    expect(filtered.split('\r\n')).toHaveLength(301);
    expect(filtered.split('\r\n')[0]).toBe('label,id');
    expect(filtered).toContain('9007199254740993');
    const [fullDownload] = await Promise.all([page.waitForEvent('download'), results.getByRole('button', { name: 'CSV', exact: true }).click()]);
    const full = await downloadedText(fullDownload);
    expect(full.split('\r\n')).toHaveLength(451);
    expect(full.split('\r\n')[0]).toBe('label,id,group');
    const [jsonDownload] = await Promise.all([page.waitForEvent('download'), results.getByRole('button', { name: 'Evidence JSON', exact: true }).click()]);
    const evidence = JSON.parse(await downloadedText(jsonDownload));
    expect(evidence.result.rows).toHaveLength(450);
    expect(evidence.result.columns).toHaveLength(3);
    expect(calls).toEqual({ runs: 1, documents: 0, imports: 0 });
});

test('Column choices survive view switches but do not leak to a new execution', async ({ page }) => {
    await trust(page);
    const results = await run(page);
    const queryId = await results.locator('.run-facts code').innerText();
    await results.locator('.result-column-controls > summary').click();
    await results.getByRole('button', { name: 'Column 1: day', exact: true }).click();
    await results.getByRole('button', { name: 'Chart', exact: true }).click();
    await expect(results.locator('canvas')).toBeVisible();
    await results.getByRole('button', { name: 'Table', exact: true }).click();
    await expect(results.locator('.result-column-controls > summary')).toHaveText('Columns · 1 of 2 visible');
    await page.getByRole('button', { name: 'Run statement', exact: true }).click();
    await expect(results.locator('.run-facts code')).not.toHaveText(queryId);
    await expect(results.getByRole('table')).toBeVisible();
    await expect(results.locator('.result-column-controls > summary')).toHaveText('Columns · 2 of 2 visible');
});

for (const mode of ['light', 'dark']) test(`Import preview remains contained in a 390px ${mode} viewport`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    if (mode === 'dark') await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
    await page.getByRole('button', { name: 'Open local files', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Open local files', exact: true });
    await dialog.locator('input[aria-label="Local SQL files or draft backups"]').setInputFiles({ name: 'long-name.sql', mimeType: 'text/plain', buffer: Buffer.from('SELECT ' + 'very_long_identifier_'.repeat(50)) });
    await expect(dialog.getByRole('button', { name: 'Open selected drafts', exact: true })).toBeEnabled();
    const size = await dialog.boundingBox();
    expect(size!.x).toBeGreaterThanOrEqual(0);
    expect(size!.x + size!.width).toBeLessThanOrEqual(391);
    expect(await dialog.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
});
