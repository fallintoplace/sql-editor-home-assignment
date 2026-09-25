import { test, expect, type Page } from '@playwright/test';
import { trust, trustCurrentConnection } from './helpers.js';

function countRunRequests(page: Page) {
    let count = 0;
    page.on('request', request => {
        if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/runs') count++;
    });
    return () => count;
}

async function switchConnection(page: Page, name: string) {
    const picker = page.locator('.connection-trigger');
    await picker.click();
    await page.getByRole('dialog', { name: 'Connection details', exact: true }).getByRole('button').filter({ hasText: name }).click();
    await expect(picker).toContainText(name);
}

test('Run, chart, save and reload preserve the same execution evidence', async ({ page }) => {
    const runs = countRunRequests(page);
    await trust(page);
    await page.getByTestId('run-statement').click();
    const results = page.getByRole('region', { name: 'Query results' });
    await expect(results.locator('[data-run-status="succeeded"]')).toBeVisible();
    await expect(results.getByRole('cell', { name: '2026-01-01', exact: true })).toBeVisible();
    const queryId = await page.locator('.execution-bar code').innerText();
    await results.getByRole('tab', { name: 'Chart', exact: true }).click();
    await expect(results.locator('svg[role="img"]')).toBeVisible();
    await page.getByTestId('save-query').click();
    await expect(page.locator('.draft-status')).toHaveText('Saved r1');
    await page.reload();
    const recovered = page.getByRole('region', { name: 'Query results' });
    await expect(recovered.locator('[data-run-status="succeeded"]')).toBeVisible();
    await expect(recovered.getByRole('cell', { name: '2026-01-01', exact: true })).toBeVisible();
    await expect(page.locator('.execution-bar code')).toHaveText(queryId);
    expect(runs()).toBe(1);
});

test('Switching connections never reuses another connection\'s result', async ({ page }) => {
    await trust(page);
    await page.getByTestId('run-statement').click();
    await expect(page.getByRole('region', { name: 'Query results' }).locator('[data-run-status="succeeded"]')).toBeVisible();
    await switchConnection(page, 'Another sample');
    await trustCurrentConnection(page);
    await expect(page.getByRole('region', { name: 'Query results' })).toHaveCount(0);
    await switchConnection(page, 'Sample data');
    await expect(page.getByRole('region', { name: 'Query results' }).getByRole('cell', { name: '2026-01-01', exact: true })).toBeVisible();
});

test('Closing and reopening a result tab does not execute SQL again', async ({ page }) => {
    const runs = countRunRequests(page);
    await trust(page);
    await page.getByRole('textbox', { name: 'SQL document name', exact: true }).fill('Recoverable.sql');
    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.insertText('SELECT {value:UInt64}');
    await expect(editor).toContainText('SELECT {value:UInt64}');
    await page.getByRole('textbox', { name: 'value:UInt64', exact: true }).fill('9007199254740993');
    await page.getByTestId('run-statement').click();
    const results = page.getByRole('region', { name: 'Query results' });
    await expect(results.locator('[data-run-status="succeeded"]')).toBeVisible();
    const queryId = await page.locator('.execution-bar code').innerText();
    await page.getByRole('button', { name: 'Close Recoverable.sql', exact: true }).click();
    await expect(results).toHaveCount(0);
    const restoreTrigger = page.getByRole('button', { name: 'Restore', exact: true });
    await restoreTrigger.click();
    const restoreMenu = page.getByRole('menu', { name: 'Recently closed SQL tabs', exact: true });
    const placement = await restoreMenu.evaluate(element => {
        const trigger = document.querySelector<HTMLElement>('.restore-sql-trigger');
        if (!trigger) throw new Error('Restore trigger missing');
        const menuRect = element.getBoundingClientRect();
        const triggerRect = trigger.getBoundingClientRect();
        return {
            menuLeft: menuRect.left,
            menuRight: menuRect.right,
            triggerLeft: triggerRect.left,
            triggerRight: triggerRect.right,
            viewportWidth: window.innerWidth,
        };
    });
    expect(placement.menuLeft).toBeGreaterThanOrEqual(0);
    expect(placement.menuRight).toBeLessThanOrEqual(placement.viewportWidth);
    expect(placement.menuRight).toBeLessThanOrEqual(placement.triggerRight + 1);
    expect(placement.menuLeft).toBeLessThan(placement.triggerLeft);
    await restoreMenu.getByRole('menuitem', { name: /Recoverable\.sql/ }).click();
    await expect(page.getByRole('textbox', { name: 'SQL document name', exact: true })).toHaveValue('Recoverable.sql');
    await expect(page.getByRole('textbox', { name: 'value:UInt64', exact: true })).toHaveValue('9007199254740993');
    await expect(page.locator('.execution-bar code')).toHaveText(queryId);
    expect(runs()).toBe(1);
});
