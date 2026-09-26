import { test, expect, type Page } from '@playwright/test';
import { trust } from './helpers.js';

function readSql(page: Page) {
    return page.locator('.cm-content').evaluate(editor => Array.from(editor.querySelectorAll('.cm-line')).map(line => line.textContent ?? '').join('\n'));
}

async function replaceSql(page: Page, sql: string) {
    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.insertText(sql);
    await expect.poll(() => readSql(page)).toBe(sql);
}

test('navigate and select statements without executing SQL', async ({ page }) => {
    await trust(page);
    let runs = 0;
    page.on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/runs') runs++; });
    const sql = "SELECT 'a;b';\nSELECT 2;\nSELECT 3;";
    await replaceSql(page, sql);
    const tools = page.getByTestId('sql-editor-tools');
    await page.keyboard.press('Alt+PageUp');
    await page.keyboard.press('Alt+PageUp');
    await expect(tools.getByRole('button', { name: /Previous SQL statement/ })).toBeDisabled();
    await tools.getByRole('button', { name: /Next SQL statement/ }).click();
    await page.keyboard.press('Alt+PageDown');
    await page.keyboard.press('Alt+PageUp');
    await tools.getByRole('button', { name: 'Select current SQL statement', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('SELECT 2');
    await expect.poll(() => readSql(page)).toBe(sql);
    expect(runs).toBe(0);
});

test('snippets preserve the existing query, offer linked fields, and undo', async ({ page }) => {
    await trust(page);
    let runs = 0;
    page.on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/runs') runs++; });
    await replaceSql(page, 'SELECT 1 -- keep this');
    const editor = page.locator('.cm-content');
    const tools = page.getByTestId('sql-editor-tools');
    await tools.getByRole('combobox', { name: 'SQL template', exact: true }).selectOption('ch_time_series');
    await expect(editor).toHaveText('SELECT 1 -- keep this');
    await tools.getByRole('button', { name: 'Add as new query' }).click();
    await expect.poll(async () => (await readSql(page)).split('\n').map(line => line.trim()).filter(Boolean).slice(0, 3)).toEqual(['SELECT 1 -- keep this', ';', 'SELECT']);
    await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('event_time');
    await page.keyboard.insertText('created_at');
    await expect.poll(async () => ((await readSql(page)).match(/created_at/g) ?? []).length).toBe(2);
    await page.keyboard.press('Tab');
    await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('events');
    await page.keyboard.press('Escape');
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(() => readSql(page)).toContain('event_time');
    await expect.poll(() => readSql(page)).toContain('SELECT 1 -- keep this');
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(() => readSql(page)).toBe('SELECT 1 -- keep this');
    expect(runs).toBe(0);
});

test('incomplete SQL disables query tools but remains editable', async ({ page }) => {
    await trust(page);
    await replaceSql(page, "SELECT 'unfinished");
    const tools = page.getByTestId('sql-editor-tools');
    await tools.getByRole('combobox', { name: 'SQL template', exact: true }).selectOption('ch_top_values');
    await expect(tools.getByRole('button', { name: 'Add as new query' })).toBeDisabled();
    await expect(tools.getByRole('status')).toContainText('Unclosed quoted');
    await replaceSql(page, "SELECT 'finished'");
    await expect(tools.getByRole('button', { name: 'Add as new query' })).toBeEnabled();
});

test('keyword completion is available outside strings and comments', async ({ page }) => {
    await trust(page);
    await replaceSql(page, 'SEL');
    await page.keyboard.press('Control+Space');
    await expect(page.getByRole('option', { name: 'SELECT', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await replaceSql(page, '-- SEL');
    await page.keyboard.press('Control+Space');
    await expect(page.locator('.cm-tooltip-autocomplete')).toHaveCount(0);
    await replaceSql(page, "SELECT 'SEL");
    await page.keyboard.press('Control+Space');
    await expect(page.locator('.cm-tooltip-autocomplete')).toHaveCount(0);
});
