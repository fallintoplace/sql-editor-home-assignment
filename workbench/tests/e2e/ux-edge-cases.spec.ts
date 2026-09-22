import { test, expect, type Page } from '@playwright/test';
import { trust } from './helpers.js';

test('Empty truncated evidence never claims the query matched no rows', async ({ page }) => {
    await page.route('**/api/runs/*/snapshot', async route => {
        const response = await route.fetch();
        await route.fulfill({ response, json: { ...(await response.json()), rows: [], completeness: 'truncated' } });
    });
    await trust(page);
    await page.getByRole('button', { name: 'Run statement', exact: true }).click();
    const results = page.getByRole('region', { name: 'Query results' });
    await expect(results.getByText('No rows fit in the retained result.')).toBeVisible();
    await expect(results.getByText('This query returned no rows.')).toHaveCount(0);
    await expect(results.getByText(/does not mean the query matched no rows/)).toBeVisible();
});

test('Selecting table in chart configuration returns to the table view', async ({ page }) => {
    let runs = 0;
    page.on('request', request => {
        if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/runs') runs++;
    });
    await trust(page);
    await page.getByRole('button', { name: 'Run statement', exact: true }).click();
    const results = page.getByRole('region', { name: 'Query results' });
    await results.getByRole('button', { name: 'Chart', exact: true }).click();
    await expect(results.locator('canvas')).toBeVisible();
    await results.getByRole('button', { name: 'Chart type', exact: true }).click();
    await page.getByRole('dialog').getByText('table', { exact: true }).click();
    await expect(results.getByRole('table', { name: 'Retained query rows' })).toBeVisible();
    await expect(results.getByRole('button', { name: 'Table', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(results.locator('canvas')).toHaveCount(0);
    expect(runs).toBe(1);
    await page.screenshot({ path: test.info().outputPath('workbench-desktop-results.png'), fullPage: true });
});
