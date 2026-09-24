import { test, expect } from '@playwright/test';
import { trust } from './helpers.js';

test('SQL examples open in a new tab without changing or running the current query', async ({ page }) => {
    let runRequests = 0;
    page.on('request', request => {
        if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/runs') runRequests++;
    });

    await trust(page);
    const tabs = page.getByRole('tablist', { name: 'SQL documents', exact: true }).getByRole('tab');
    const originalTab = tabs.first();
    const originalName = await originalTab.getAttribute('aria-label');
    const originalSql = await page.locator('.cm-content').innerText();
    await page.getByRole('button', { name: 'Collapse SQL query', exact: true }).click();
    await expect(page.locator('#sql-editor-content')).toBeHidden();

    await page.getByTestId('new-sql').click();
    const dialog = page.getByRole('dialog', { name: 'SQL examples', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Sample data', { exact: true })).toBeVisible();
    await dialog.getByTestId('sql-example-search').fill('Top countries');
    const example = dialog.getByTestId('sql-example-preview-starter-top-countries');
    await expect(example).toBeVisible();
    await example.click();
    await expect(dialog.locator('.sql-example-preview code')).toContainText('FROM events');
    await dialog.getByTestId('open-sql-example').click();

    await expect(tabs.last()).toHaveAttribute('aria-label', 'Top countries.sql');
    await expect(page.locator('.cm-content')).toContainText('FROM events');
    await expect(page.locator('#sql-editor-content')).toBeVisible();
    await expect(page.locator('.cm-content')).toBeFocused();
    await expect(page.locator('.execution-bar')).toHaveAttribute('data-run-status', 'ready');
    await expect(page.locator('.execution-bar code')).toHaveCount(0);
    expect(originalName).not.toBeNull();
    await page.getByRole('tab', { name: originalName!, exact: true }).click();
    await expect.poll(() => page.locator('.cm-content').evaluate(element => (element as HTMLElement).innerText)).toBe(originalSql);
    expect(runRequests).toBe(0);
    await expect(dialog).toHaveCount(0);
});

test('SQL examples search handles no matches and Escape restores focus', async ({ page }) => {
    await trust(page);
    const trigger = page.getByTestId('new-sql');
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'SQL examples', exact: true });
    const search = dialog.getByTestId('sql-example-search');
    await search.fill('query-with-no-matching-example');
    await expect(dialog.getByRole('status')).toHaveText('No examples match your search.');
    await search.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
});
