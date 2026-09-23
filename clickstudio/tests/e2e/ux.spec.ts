import { test, expect, type Page } from '@playwright/test';
import type { Result } from '../../shared/types';
import { trust } from './helpers.js';
function requests(page: Page) {
    const count = { runs: 0, saves: 0 };
    page.on('request', request => {
        const path = new URL(request.url()).pathname;
        if (request.method() === 'POST' && path === '/api/runs') count.runs++;
        if (['POST', 'PUT'].includes(request.method()) && /^\/api\/documents(?:\/[^/]+)?$/.test(path)) count.saves++;
    });
    return count;
}
async function run(page: Page) {
    await page.getByRole('button', { name: 'Run statement', exact: true }).click();
    const results = page.getByRole('region', { name: 'Query results' });
    await expect(results.getByText('succeeded', { exact: true })).toBeVisible();
    return results;
}
async function openCommands(page: Page) {
    await page.getByRole('button', { name: 'Commands Ctrl/⌘K', exact: true }).click();
    const search = page.getByRole('combobox', { name: 'Search commands', exact: true });
    await expect(search).toBeFocused();
    return search;
}
async function snapshot(page: Page, change: (result: Result) => Result) {
    await page.route('**/api/runs/*/snapshot', async route => {
        const response = await route.fetch();
        await route.fulfill({ response, json: change(await response.json() as Result) });
    });
}

test('Command search supports keyboard navigation, empty states and focus restoration', async ({ page }) => {
    const count = requests(page);
    await trust(page);
    const opener = page.getByRole('button', { name: 'Commands Ctrl/⌘K', exact: true });
    const search = await openCommands(page);
    const options = page.getByRole('option');
    await expect(options.first()).toHaveAttribute('aria-selected', 'true');
    await search.press('ArrowDown');
    await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(search).toBeFocused();
    await search.fill('no-command-can-match-this');
    await expect(page.getByText('No matching commands. Try a different search.')).toBeVisible();
    await search.press('Enter');
    await expect(search).toBeVisible();
    await search.press('Escape');
    await expect(opener).toBeFocused();
    await openCommands(page);
    await expect(search).toHaveValue('');
    await search.fill('SQL new');
    await expect(page.getByRole('option')).toHaveCount(1);
    await search.press('Enter');
    await expect(page.getByRole('tab', { name: 'Untitled.sql', exact: true })).toHaveAttribute('aria-selected', 'true');
    expect(count.runs).toBe(0);
    expect(count.saves).toBe(0);
});

test('Unavailable commands explain the requirement and cannot execute from Enter', async ({ page }) => {
    const count = requests(page);
    await page.route('**/api/connections', async route => {
        const response = await route.fetch();
        const connections = await response.json() as { trusted: boolean }[];
        await route.fulfill({ response, json: connections.map(connection => ({ ...connection, trusted: false })) });
    });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Run statement', exact: true })).toBeDisabled();
    const search = await openCommands(page);
    await search.fill('Run selected');
    const option = page.getByRole('option');
    await expect(option).toHaveAttribute('aria-disabled', 'true');
    await expect(option).toContainText('Trust this connection before running SQL.');
    await search.press('Enter');
    await expect(search).toBeVisible();
    expect(count.runs).toBe(0);
});

test('Saved files with identical names remain distinct command choices', async ({ page }) => {
    await page.route('**/api/documents?trash=true', route => route.fulfill({ json: [11, 22].map(value => ({
        id: `ux-duplicate-${value}`, owner: 'local-owner', name: 'Duplicate.sql', connectionId: 'demo',
        sql: `SELECT ${value}`, revision: 1, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
        parameters: {}, chart: { kind: 'table', x: 0, ys: [], title: 'Query result' }, dependencies: [], kind: 'query',
    })) }));
    await trust(page);
    const search = await openCommands(page);
    await search.fill('Open Duplicate');
    await expect(page.getByRole('option')).toHaveCount(2);
    await search.press('ArrowDown');
    await search.press('Enter');
    await expect(page.locator('.cm-content')).toHaveText('SELECT 22');
});

test('Choosing Publish from commands transfers focus to its confirmation', async ({ page }) => {
    const count = requests(page);
    await trust(page);
    await run(page);
    const search = await openCommands(page);
    await search.fill('Publish');
    await search.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Publish an evidence snapshot' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('seven days');
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(count.saves).toBe(0);
    expect(count.runs).toBe(1);
});

test('Focus mode widens the editor and preserves inspector and file-search drafts', async ({ page }) => {
    const count = requests(page);
    await trust(page);
    const question = page.getByRole('textbox', { name: 'Question or instruction', exact: true });
    const search = page.getByRole('textbox', { name: 'Search files and schema', exact: true });
    await question.fill('Keep my unfinished analysis question');
    await search.fill('events');
    const before = (await page.locator('.editor-column').boundingBox())!;
    await page.getByRole('button', { name: 'Focus mode', exact: true }).click();
    await expect(page.getByRole('complementary', { name: 'Inspector' })).toBeHidden();
    await expect(page.getByRole('complementary', { name: 'Files and schema' })).toBeHidden();
    const focused = (await page.locator('.editor-column').boundingBox())!;
    expect(focused.width).toBeGreaterThan(before.width);
    await page.getByRole('button', { name: 'Exit focus mode', exact: true }).click();
    await expect(question).toHaveValue('Keep my unfinished analysis question');
    await expect(search).toHaveValue('events');
    await page.getByRole('button', { name: 'Hide files', exact: true }).click();
    await expect(search).toBeHidden();
    await page.getByRole('button', { name: 'Show files', exact: true }).click();
    await expect(search).toHaveValue('events');
    expect(count.runs).toBe(0);
});

test('Save shortcut saves exactly one revision and never executes the draft', async ({ page }) => {
    const count = requests(page);
    await trust(page);
    await page.getByRole('textbox', { name: 'SQL document name', exact: true }).fill('Keyboard saved.sql');
    const editor = page.locator('.cm-content');
    await editor.click();
    await editor.press('ControlOrMeta+s');
    await expect(page.getByRole('status').filter({ hasText: 'Saved Keyboard saved.sql as revision 1.' })).toBeVisible();
    expect(count.saves).toBe(1);
    expect(count.runs).toBe(0);
});

test('SQL tabs support Home, End, wrapping arrows and named panels', async ({ page }) => {
    await trust(page);
    await page.getByRole('button', { name: 'New SQL tab', exact: true }).click();
    await page.getByRole('button', { name: 'New SQL tab', exact: true }).click();
    const tabs = page.getByRole('tablist', { name: 'SQL documents' }).getByRole('tab');
    await tabs.first().focus();
    await tabs.first().press('End');
    await expect(tabs.last()).toBeFocused();
    await expect(tabs.last()).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel')).toHaveCount(1);
    await tabs.last().press('Home');
    await expect(tabs.first()).toBeFocused();
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
    await tabs.first().press('ArrowLeft');
    await expect(tabs.last()).toBeFocused();
    await expect(tabs.last()).toHaveAttribute('aria-selected', 'true');
    await tabs.last().press('ArrowRight');
    await expect(tabs.first()).toBeFocused();
});

test('No filter matches is distinct from zero query rows and can be cleared without running', async ({ page }) => {
    const count = requests(page);
    await trust(page);
    const results = await run(page);
    const filter = results.getByRole('textbox', { name: 'Filter retained rows' });
    await filter.fill('never-matches-the-fixture');
    await expect(results.getByText('No retained rows match this filter.')).toBeVisible();
    await expect(results.getByText('This query returned no rows.')).toHaveCount(0);
    await results.getByRole('button', { name: 'Clear filter', exact: true }).click();
    await expect(results.locator('tbody tr')).toHaveCount(7);
    await filter.fill('another nonmatch');
    await filter.press('Escape');
    await expect(filter).toHaveValue('');
    await expect(results.locator('tbody tr')).toHaveCount(7);
    expect(count.runs).toBe(1);
});

test('An empty retained result explains the empty query outcome accurately', async ({ page }) => {
    await snapshot(page, result => ({ ...result, rows: [] }));
    await trust(page);
    const results = await run(page);
    await expect(results.getByText('This query returned no rows.')).toBeVisible();
    await expect(results.getByText('No retained rows match this filter.')).toHaveCount(0);
    await expect(results.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
});

test('Table and chart are exclusive views while table filters survive switching', async ({ page }) => {
    const count = requests(page);
    await trust(page);
    const results = await run(page);
    const filter = results.getByRole('textbox', { name: 'Filter retained rows' });
    await filter.fill('2026-01-01');
    await expect(results.locator('tbody tr')).toHaveCount(1);
    await results.getByRole('button', { name: 'Chart', exact: true }).click();
    await expect(results.locator('canvas')).toBeVisible();
    await expect(results.getByRole('table')).toHaveCount(0);
    await expect(results.getByRole('button', { name: 'Chart', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(results.getByText(/Exports include all 7 retained rows/)).toBeVisible();
    await results.getByRole('button', { name: 'Table', exact: true }).click();
    await expect(filter).toHaveValue('2026-01-01');
    await expect(results.locator('tbody tr')).toHaveCount(1);
    await expect(results.locator('canvas')).toHaveCount(0);
    expect(count.runs).toBe(1);
});

test('Pagination stays bounded and local filters reset to the first page', async ({ page }) => {
    const count = requests(page);
    await snapshot(page, result => ({ ...result, columns: [{ name: 'label', type: 'String' }], rows: Array.from({ length: 450 }, (_, i) => [`row-${i}`]) }));
    await trust(page);
    const results = await run(page);
    await expect(results.locator('tbody tr')).toHaveCount(200);
    await results.getByRole('button', { name: 'Last', exact: true }).click();
    await expect(results.locator('tbody tr')).toHaveCount(50);
    await expect(results.getByRole('navigation', { name: 'Result pages' })).toContainText('Rows 401-450 of 450');
    await results.getByRole('textbox', { name: 'Filter retained rows' }).fill('row-449');
    await expect(results.locator('tbody tr')).toHaveCount(1);
    await expect(results.getByRole('navigation', { name: 'Result pages' })).toContainText('Page 1 of 1');
    await results.getByRole('button', { name: 'Clear filter', exact: true }).click();
    await expect(results.locator('tbody tr')).toHaveCount(200);
    expect(count.runs).toBe(1);
});

test('Keyboard cell inspection copies exact UInt64 strings and restores focus', async ({ page }) => {
    const count = requests(page);
    await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
        writeText: async (value: string) => { (window as Window & { copiedCell?: string }).copiedCell = value; },
    } }));
    await snapshot(page, result => ({ ...result, columns: [{ name: 'large_id', type: 'UInt64' }], rows: [['9007199254740993']] }));
    await trust(page);
    const results = await run(page);
    const cell = results.getByRole('cell', { name: '9007199254740993', exact: true });
    await cell.focus();
    await cell.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Inspect cell' });
    await expect(dialog.getByLabel('Full cell value')).toHaveText('9007199254740993');
    await dialog.getByRole('button', { name: 'Copy value', exact: true }).click();
    await expect(dialog.getByText('Cell value copied.')).toBeVisible();
    expect(await page.evaluate(() => (window as Window & { copiedCell?: string }).copiedCell)).toBe('9007199254740993');
    await dialog.press('Escape');
    await expect(cell).toBeFocused();
    expect(count.runs).toBe(1);
});

test('Clipboard failure offers manual copy and a filtered draft remains an explicit action', async ({ page }) => {
    const count = requests(page);
    await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
        writeText: async () => { throw new Error('Clipboard denied'); },
    } }));
    await trust(page);
    const results = await run(page);
    await results.getByRole('cell', { name: '2026-01-01', exact: true }).dblclick();
    const dialog = page.getByRole('dialog', { name: 'Inspect cell' });
    await dialog.getByRole('button', { name: 'Copy value', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText('Select and copy the full value below.');
    await dialog.getByRole('button', { name: 'Create filtered draft', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Filter day.sql', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.cm-content')).toContainText('WHERE');
    expect(count.runs).toBe(1);
    expect(count.saves).toBe(0);
});

test('Retrying a failed snapshot read does not rerun the query', async ({ page }) => {
    const count = requests(page);
    let reads = 0;
    await page.route('**/api/runs/*/snapshot', async route => {
        if (++reads === 1) await route.fulfill({ status: 503, json: { error: { code: 'TEMPORARY', message: 'Temporary snapshot read failure' } } });
        else await route.continue();
    });
    await trust(page);
    const results = await run(page);
    await results.getByRole('button', { name: 'Retry loading result', exact: true }).click();
    await expect(results.locator('tbody tr')).toHaveCount(7);
    expect(count.runs).toBe(1);
    expect(reads).toBe(2);
});

test('Schema column search respects database identity and explains no matches', async ({ page }) => {
    await page.route('**/api/connections/demo/schema', async route => {
        const response = await route.fetch();
        await route.fulfill({ response, json: { ...(await response.json()),
            tables: ['alpha', 'beta'].map(database => ({ database, name: 'events', engine: 'Memory' })),
            columns: [{ database: 'alpha', table: 'events', name: 'only_alpha', type: 'String', defaultKind: '', comment: '' }],
        } });
    });
    await trust(page);
    const sidebar = page.getByRole('complementary', { name: 'Files and schema' });
    const search = sidebar.getByRole('textbox', { name: 'Search files and schema' });
    await search.fill('only_alpha');
    await expect(sidebar.getByText('alpha.events', { exact: true })).toBeVisible();
    await expect(sidebar.getByText('beta.events', { exact: true })).toHaveCount(0);
    await search.fill('nothing-matches-this');
    await expect(sidebar.getByText('No tables or columns match this search.')).toBeVisible();
});

for (const theme of ['light', 'dark']) test(`Narrow ${theme} layout contains results without page-level horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await trust(page);
    if (theme === 'dark') await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
    await page.getByRole('textbox', { name: 'SQL document name', exact: true }).fill('A very long document name that must not force horizontal page overflow.sql');
    const results = await run(page);
    await expect(results.locator('tbody tr')).toHaveCount(7);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.getByRole('button', { name: 'Focus mode', exact: true }).click();
    await expect(page.locator('.cm-content')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Exit focus mode', exact: true })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath(`clickstudio-${theme}-390.png`), fullPage: true });
});
