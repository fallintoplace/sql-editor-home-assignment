import { test, expect, type Page } from '@playwright/test';
async function trust(page: Page) {
    await page.goto('/');
    await expect(page.getByText(/not live data/i).first()).toBeVisible();
    const button = page.getByRole('button', { name: 'Trust connection', exact: true });
    if (await button.isVisible()) {
        await button.click();
        const dialog = page.getByRole('dialog');
        await dialog.getByRole('textbox').fill('demo');
        await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
    }
    await expect(page.getByRole('button', { name: 'Run statement', exact: true })).toBeEnabled();
}
test('Run, chart, save, reload and inspect retained evidence', async ({ page }) => {
    await trust(page);
    await page.getByRole('button', { name: 'Run statement', exact: true }).click();
    await expect(page.getByText('succeeded', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: '2026-01-01', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Chart', exact: true }).click();
    await expect(page.locator('canvas')).toBeVisible();
    await page.getByRole('button', { name: 'Save revision', exact: true }).click();
    await expect(page.getByText(/Saved .+ as revision/)).toBeVisible();
    await page.reload();
    await expect(page.getByText('succeeded', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Executed SQL', exact: true }).click();
    await expect(page.locator('.results pre')).toContainText('SELECT');
});
test('A script shows partial failure without losing editor text', async ({ page }) => {
    await trust(page);
    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.insertText('SELECT 1; SELECT fixture_error; SELECT 3;');
    await page.getByRole('button', { name: 'Run script', exact: true }).click();
    await expect(page.getByRole('button', { name: /Statement 2: failed/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Statement 3: skipped/ })).toBeVisible();
    await expect(editor).toContainText('SELECT fixture_error');
});
test('Connection switching does not reuse another connection’s result', async ({ page }) => {
    await trust(page);
    await page.getByRole('button', { name: 'Run statement', exact: true }).click();
    await expect(page.getByText('succeeded', { exact: true }).first()).toBeVisible();
    const combo = page.getByRole('combobox').first();
    await combo.click();
    await page.getByRole('option', { name: 'Second isolated fixture' }).click();
    await expect(page.getByRole('button', { name: 'Trust connection', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: '2026-01-01', exact: true })).toHaveCount(0);
});
