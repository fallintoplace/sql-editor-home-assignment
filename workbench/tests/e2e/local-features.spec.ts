import { test, expect, type Page, type Download } from '@playwright/test';
import type { Result } from '../../shared/types';

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
async function openFile(page: Page, name: string, text: string) {
    await page.getByRole('button', { name: 'Import SQL / backup', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Import SQL or local backup', exact: true });
    await dialog.getByLabel('Choose local SQL or backup file').setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(text) });
    return dialog;
}
async function trust(page: Page) {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Run statement', exact: true })).toBeVisible();
    const button = page.getByRole('button', { name: 'Trust connection', exact: true });
    if (await button.isVisible()) {
        await button.click();
        await page.getByRole('dialog').getByRole('textbox').fill('demo');
        await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
    }
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
const localDraft = (id: string, sql: string) => ({ id, name: `${id}.sql`, sql, parameters: {}, chart: { kind: 'table', title: 'Result', x: 0, ys: [] }, runIds: [], from: 0, to: 0, checkpoints: [], kind: 'query', dependencies: [] });

test('SQL file import previews first, creates a new local tab, and preserves the existing draft', async ({ page }) => {
    const calls = countWrites(page);
    await page.goto('/');
    await expect(page.locator('.cm-content')).toBeVisible();
    const original = await page.locator('.cm-content').innerText();
    const dialog = await openFile(page, 'portable.sql', 'SELECT {id:UInt64}');
    await expect(dialog.getByText('1 selected · 29 open tab slots available')).toBeVisible();
    await expect(page.locator('.cm-content')).toHaveText(original);
    expect(calls).toEqual({ runs: 0, documents: 0, imports: 0 });
    await dialog.getByRole('button', { name: 'Import selected drafts', exact: true }).click();
    await expect(page.getByRole('tab')).toHaveCount(2);
    await expect(page.locator('.cm-content')).toHaveText('SELECT {id:UInt64}');
    await expect(page.getByRole('status', { name: 'Revision save status', exact: true })).toHaveText('Private local draft');
    await page.getByRole('tab').first().click();
    await expect(page.locator('.cm-content')).toHaveText(original);
    expect(calls).toEqual({ runs: 0, documents: 0, imports: 0 });
});

test('Cancel and malformed file replacement keep the workspace unchanged', async ({ page }) => {
    const calls = countWrites(page);
    await page.goto('/');
    await expect(page.locator('.cm-content')).toBeVisible();
    const original = await page.locator('.cm-content').innerText();
    const dialog = await openFile(page, 'preview.sql', 'SELECT 88');
    await expect(dialog.getByRole('button', { name: 'Import selected drafts', exact: true })).toBeEnabled();
    await dialog.getByLabel('Choose local SQL or backup file').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{bad') });
    await expect(dialog.getByRole('alert')).toContainText('not valid JSON');
    await expect(dialog.getByRole('button', { name: 'Import selected drafts', exact: true })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Cancel import', exact: true }).click();
    await expect(page.getByRole('tab')).toHaveCount(1);
    await expect(page.locator('.cm-content')).toHaveText(original);
    expect(calls).toEqual({ runs: 0, documents: 0, imports: 0 });
});

test('Backup import warns about another connection and drops old execution and saved-revision links', async ({ page }) => {
    const calls = countWrites(page);
    await page.goto('/');
    const imported = { ...localDraft('portable', 'SELECT {id:UInt64}'), serverId: 'old-document', baseRevision: 4, activeRunId: 'old-run', runIds: ['old-run'], scriptId: 'old-script', parentDocumentId: 'old-parent', parameters: { id: '9007199254740993' } };
    const backup = { format: 'cathedral-local-drafts', version: 1, connection: { id: 'other', name: 'Other database' }, workspace: { version: 1, tabs: [imported], closedTabs: [localDraft('closed', 'SELECT 99')] } };
    const dialog = await openFile(page, 'backup.json', JSON.stringify(backup));
    await expect(dialog.getByText(/Different source connection/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Import selected drafts', exact: true }).click();
    await expect(page.getByRole('tab')).toHaveCount(3);
    await expect(page.getByRole('textbox', { name: 'id : UInt64', exact: true })).toHaveValue('9007199254740993');
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    const state = await page.evaluate(() => JSON.parse(localStorage.getItem('cathedral:local-owner:demo:v1')!));
    const copy = state.tabs.find((draft: { name: string }) => draft.name === 'portable.sql');
    expect(copy.id).not.toBe('portable');
    expect(copy.runIds).toEqual([]);
    expect(copy.serverId).toBeUndefined();
    expect(copy.activeRunId).toBeUndefined();
    expect(copy.scriptId).toBeUndefined();
    expect(copy.parentDocumentId).toBeUndefined();
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'id : UInt64', exact: true })).toHaveValue('9007199254740993');
    expect(calls).toEqual({ runs: 0, documents: 0, imports: 0 });
});

test('Backup selection fits the remaining capacity without silently dropping drafts', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('cathedral:local-owner:demo:v1', JSON.stringify({ version: 1, activeId: 'tab0', tabs: Array.from({ length: 29 }, (_, index) => ({ id: `tab${index}`, name: `tab${index}.sql`, sql: `SELECT ${index}` })) })));
    const calls = countWrites(page);
    await page.goto('/');
    const dialog = await openFile(page, 'backup.json', JSON.stringify({ version: 1, tabs: [localDraft('one', 'SELECT 101'), localDraft('two', 'SELECT 202')] }));
    await expect(dialog.getByRole('button', { name: 'Import selected drafts', exact: true })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Select draft 1: one.sql', exact: true }).click();
    await dialog.getByRole('button', { name: 'Import selected drafts', exact: true }).click();
    await expect(page.getByRole('tab')).toHaveCount(30);
    await expect(page.locator('.cm-content')).toHaveText('SELECT 202');
    expect(calls).toEqual({ runs: 0, documents: 0, imports: 0 });
});

test('A slower earlier file read cannot replace a newer preview', async ({ page }) => {
    await page.addInitScript(() => {
        const original = File.prototype.arrayBuffer;
        File.prototype.arrayBuffer = async function () {
            const buffer = await original.call(this);
            if (this.name === 'slow.sql') await new Promise<void>(resolve => { (window as Window & { releaseLocalRead?: () => void }).releaseLocalRead = resolve; });
            return buffer;
        };
    });
    await page.goto('/');
    const dialog = await openFile(page, 'slow.sql', 'SELECT 111');
    await expect.poll(() => page.evaluate(() => Boolean((window as Window & { releaseLocalRead?: () => void }).releaseLocalRead))).toBe(true);
    await dialog.getByLabel('Choose local SQL or backup file').setInputFiles({ name: 'fast.sql', mimeType: 'text/plain', buffer: Buffer.from('SELECT 222') });
    await expect(dialog.getByRole('button', { name: 'Select draft 1: fast.sql', exact: true })).toBeVisible();
    await page.evaluate(() => (window as Window & { releaseLocalRead?: () => void }).releaseLocalRead?.());
    await dialog.getByRole('button', { name: 'Import selected drafts', exact: true }).click();
    await expect(page.locator('.cm-content')).toHaveText('SELECT 222');
});

test('Local backup export can be previewed again without changing the workspace', async ({ page }) => {
    const calls = countWrites(page);
    await page.goto('/');
    await expect(page.locator('.cm-content')).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export local drafts', exact: true }).click()]);
    const text = await downloadedText(download);
    expect(JSON.parse(text).format).toBe('cathedral-local-drafts');
    const dialog = await openFile(page, 'roundtrip.json', text);
    await expect(dialog.getByText('1 selected · 29 open tab slots available')).toBeVisible();
    await expect(page.getByRole('tab')).toHaveCount(1);
    await dialog.getByRole('button', { name: 'Cancel import', exact: true }).click();
    expect(calls).toEqual({ runs: 0, documents: 0, imports: 0 });
});

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
    const dialog = await openFile(page, 'long-name.sql', 'SELECT ' + 'very_long_identifier_'.repeat(50));
    await expect(dialog.getByRole('button', { name: 'Import selected drafts', exact: true })).toBeEnabled();
    const size = await dialog.boundingBox();
    expect(size!.x).toBeGreaterThanOrEqual(0);
    expect(size!.x + size!.width).toBeLessThanOrEqual(391);
    expect(await dialog.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
});
