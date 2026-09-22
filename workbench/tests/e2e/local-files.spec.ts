import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const sqlFile = (name: string, sql: string) => ({ name, mimeType: 'application/sql', buffer: Buffer.from(sql) });
const backupFile = (value: unknown) => ({ name: 'local-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
function sideEffects(page: Page) {
    const writes: string[] = [], importedRunReads: string[] = [];
    page.on('request', request => {
        const path = new URL(request.url()).pathname;
        if (['POST', 'PUT', 'DELETE'].includes(request.method()) && /^\/api\/(runs|scripts|documents|workspace|assistant|imports)/.test(path)) writes.push(`${request.method()} ${path}`);
        if (/\/api\/runs\/source-run/.test(path)) importedRunReads.push(path);
    });
    return { writes, importedRunReads };
}
async function open(page: Page) {
    await page.getByRole('button', { name: 'Open local files', exact: true }).click();
    return page.getByRole('dialog', { name: 'Open local files', exact: true });
}
const localInput = (page: Page) => page.locator('input[aria-label="Local SQL files or draft backups"]');
const tabs = (page: Page) => page.getByRole('tablist', { name: 'SQL documents' }).getByRole('tab');
const savedState = (page: Page) => page.evaluate(() => {
    window.dispatchEvent(new Event('pagehide'));
    return JSON.parse(localStorage.getItem('cathedral:local-owner:demo:v1')!);
});

test('SQL files are previewed before opening, with no replacement or automatic execution', async ({ page }) => {
    const effects = sideEffects(page);
    await page.goto('/');
    const original = await page.locator('.cm-content').innerText();
    const dialog = await open(page);
    await localInput(page).setInputFiles([sqlFile('first.sql', 'SELECT 11'), sqlFile('second.SQL', 'SELECT 22')]);
    await expect(dialog.getByRole('checkbox', { name: 'first.sql', exact: true })).toBeChecked();
    await expect(tabs(page)).toHaveCount(1);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.locator('.cm-content')).toHaveText(original);
    await open(page);
    await localInput(page).setInputFiles([sqlFile('first.sql', 'SELECT 11'), sqlFile('second.SQL', 'SELECT 22')]);
    await dialog.getByRole('button', { name: 'Open selected drafts', exact: true }).click();
    await expect(tabs(page)).toHaveCount(3);
    await expect(page.getByRole('textbox', { name: 'SQL document name', exact: true })).toHaveValue('first.sql');
    await expect(page.locator('.cm-content')).toHaveText('SELECT 11');
    await page.getByRole('tab', { name: 'second.SQL', exact: true }).click();
    await expect(page.locator('.cm-content')).toHaveText('SELECT 22');
    expect(effects.writes).toEqual([]);
});

test('A legacy backup restores open and closed text without importing execution or saved identity', async ({ page }) => {
    const effects = sideEffects(page);
    await page.goto('/');
    const dialog = await open(page);
    await localInput(page).setInputFiles(backupFile({ version: 1, tabs: [{ id: 'same-id', name: 'Restored.sql', sql: 'SELECT {id:UInt64}', parameters: { id: '9007199254740993' }, serverId: 'source-doc', baseRevision: 7, activeRunId: 'source-run', runIds: ['source-run'], scriptId: 'source-script', dependencies: ['source-dependency'], checkpoints: [{ id: 'old-checkpoint', reason: 'Before an edit', at: '2026-01-01T00:00:00Z', sql: 'SELECT 1', from: 0, to: 1, parentRevision: 7 }] }], closedTabs: [{ id: 'same-id', name: 'Closed backup.sql', sql: 'SELECT 33' }] }));
    await expect(dialog.getByText(/closed backup tab/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Open selected drafts', exact: true }).click();
    await expect(tabs(page)).toHaveCount(3);
    await expect(page.getByRole('textbox', { name: 'id : UInt64', exact: true })).toHaveValue('9007199254740993');
    await expect(page.getByRole('status', { name: 'Revision save status', exact: true })).toHaveText('Private local draft');
    const state = await savedState(page), restored = state.tabs.find((draft: { name: string }) => draft.name === 'Restored.sql');
    expect(restored.serverId).toBeUndefined(); expect(restored.activeRunId).toBeUndefined(); expect(restored.runIds).toEqual([]); expect(restored.dependencies).toEqual([]);
    expect(restored.checkpoints[0].sql).toBe('SELECT 1'); expect(restored.checkpoints[0].parentRevision).toBeUndefined();
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'id : UInt64', exact: true })).toHaveValue('9007199254740993');
    expect(effects.writes).toEqual([]); expect(effects.importedRunReads).toEqual([]);
});

test('Exported local backups round-trip through the file picker as independent drafts', async ({ page }) => {
    const effects = sideEffects(page);
    await page.goto('/');
    await page.getByRole('textbox', { name: 'SQL document name', exact: true }).fill('Original.sql');
    const before = await savedState(page);
    const waiting = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export local drafts', exact: true }).click();
    const download = await waiting, path = await download.path();
    expect(path).not.toBeNull();
    const backup = JSON.parse(await readFile(path!, 'utf8'));
    expect(backup.format).toBe('cathedral-local-drafts'); expect(backup.sourceConnection.id).toBe('demo');
    const dialog = await open(page);
    await localInput(page).setInputFiles(backupFile(backup));
    await expect(dialog.getByText(/Backup connections:/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Open selected drafts', exact: true }).click();
    const after = await savedState(page);
    expect(after.tabs).toHaveLength(2);
    expect(after.tabs[0].id).toBe(before.tabs[0].id);
    expect(after.tabs[1].id).not.toBe(before.tabs[0].id);
    expect(after.tabs[1].sql).toBe(before.tabs[0].sql);
    expect(effects.writes).toEqual([]);
});

test('An invalid sibling rejects a file batch without partially opening good files', async ({ page }) => {
    const effects = sideEffects(page);
    await page.goto('/');
    const dialog = await open(page);
    await localInput(page).setInputFiles([sqlFile('good.sql', 'SELECT 1'), backupFile({ version: 1, tabs: [null] })]);
    await expect(dialog.getByRole('alert')).toContainText('Nothing was imported');
    await expect(dialog.getByRole('button', { name: 'Open selected drafts', exact: true })).toBeDisabled();
    await expect(tabs(page)).toHaveCount(1);
    expect(effects.writes).toEqual([]);
});

test('Tab capacity requires an explicit smaller selection and never closes an existing draft', async ({ page }) => {
    await page.addInitScript(() => {
        const drafts = Array.from({ length: 29 }, (_, i) => ({ id: `existing-${i}`, name: `Existing ${i}.sql`, sql: `SELECT ${i}` }));
        localStorage.setItem('cathedral:local-owner:demo:v1', JSON.stringify({ version: 1, tabs: drafts, activeId: drafts[0]!.id }));
    });
    const effects = sideEffects(page);
    await page.goto('/');
    const dialog = await open(page);
    await localInput(page).setInputFiles([sqlFile('one.sql', 'SELECT 101'), sqlFile('two.sql', 'SELECT 102')]);
    await expect(dialog.getByRole('button', { name: 'Open selected drafts', exact: true })).toBeDisabled();
    await expect(dialog.getByText(/Choose at most 1 drafts/)).toBeVisible();
    await dialog.getByRole('checkbox', { name: 'two.sql', exact: true }).uncheck();
    await dialog.getByRole('button', { name: 'Open selected drafts', exact: true }).click();
    await expect(tabs(page)).toHaveCount(30);
    const state = await savedState(page);
    expect(state.tabs.filter((draft: { id: string }) => draft.id.startsWith('existing-'))).toHaveLength(29);
    expect(state.tabs.find((draft: { name: string }) => draft.name === 'two.sql')).toBeUndefined();
    expect(effects.writes).toEqual([]);
});

test('Invalid UTF-8 and non-local exports report actionable errors', async ({ page }) => {
    await page.goto('/');
    const dialog = await open(page);
    await localInput(page).setInputFiles({ name: 'bad.sql', mimeType: 'application/sql', buffer: Buffer.from([0xc3, 0x28]) });
    await expect(dialog.getByRole('alert')).toContainText('UTF-8');
    await localInput(page).setInputFiles(backupFile({ format: 'cathedral-workspace', version: 1, documents: [] }));
    await expect(dialog.getByRole('alert')).toContainText('revision library');
    await expect(dialog.getByRole('button', { name: 'Open selected drafts', exact: true })).toBeDisabled();
});

test('Cancelling a slow file read prevents a late preview from replacing the next selection', async ({ page }) => {
    await page.addInitScript(() => {
        const original = Blob.prototype.arrayBuffer;
        Blob.prototype.arrayBuffer = function () {
            if (this instanceof File && this.name === 'slow.sql') return new Promise<ArrayBuffer>((resolve, reject) => {
                (window as unknown as { finishLocalRead: () => Promise<void> }).finishLocalRead = async () => { try { resolve(await original.call(this)); } catch (e) { reject(e); } };
            });
            return original.call(this);
        };
    });
    const effects = sideEffects(page);
    await page.goto('/');
    const dialog = await open(page);
    await localInput(page).setInputFiles(sqlFile('slow.sql', 'SELECT 999'));
    await expect(dialog.getByText('Reading local files for preview…')).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await open(page);
    await localInput(page).setInputFiles(sqlFile('fast.sql', 'SELECT 123'));
    await expect(dialog.getByRole('checkbox', { name: 'fast.sql', exact: true })).toBeChecked();
    await page.evaluate(async () => { await (window as unknown as { finishLocalRead: () => Promise<void> }).finishLocalRead(); });
    await expect(dialog.getByRole('checkbox', { name: 'slow.sql', exact: true })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Open selected drafts', exact: true }).click();
    await expect(page.locator('.cm-content')).toHaveText('SELECT 123');
    expect(effects.writes).toEqual([]);
});

test('The command palette opens the file dialog with a clean focus handoff', async ({ page }) => {
    await page.goto('/');
    const trigger = page.getByRole('button', { name: 'Commands Ctrl/⌘K', exact: true });
    await trigger.click();
    await page.getByRole('combobox', { name: 'Search commands' }).fill('restore local draft');
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Open local files', exact: true });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Commands and Quick Open', exact: true })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(trigger).toBeFocused();
});

for (const theme of ['light', 'dark']) test(`Local-file preview remains contained at 390px in ${theme} mode`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    if (theme === 'dark') await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
    const dialog = await open(page);
    await localInput(page).setInputFiles(sqlFile(`${'long_file_name_'.repeat(10)}.sql`, "SELECT 'a very long value'"));
    await expect(dialog.getByRole('button', { name: 'Open selected drafts', exact: true })).toBeEnabled();
    const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(391);
    await page.screenshot({ path: testInfo.outputPath(`workbench-local-files-${theme}.png`), fullPage: true });
});
