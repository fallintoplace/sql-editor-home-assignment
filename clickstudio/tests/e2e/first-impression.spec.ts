import { test, expect } from '@playwright/test';
import { trust } from './helpers.js';

test('Expert mode gives the editor the full work area before the first run', async ({ page }) => {
    await trust(page);

    const content = page.locator('.workspace-content');
    await expect(content).not.toHaveClass(/has-run/);
    await expect(page.getByRole('region', { name: 'Query results', exact: true })).toHaveCount(0);
    await expect(page.locator('.empty-workspace')).toHaveCount(0);
    await expect(page.locator('.icon-rail')).toBeHidden();

    const browser = page.getByRole('navigation', { name: 'Workspace browser', exact: true });
    await expect(browser.getByRole('button', { name: 'Tables', exact: true })).toBeVisible();
    await expect(browser.getByRole('button', { name: 'Queries', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'SQL AI', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save revision', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Run statement', exact: true })).toBeVisible();
});

test('Run options preserve script and explain actions behind the primary Run button', async ({ page }) => {
    await trust(page);
    const trigger = page.getByRole('button', { name: 'More run options', exact: true });
    await trigger.click();

    const menu = page.getByRole('menu', { name: 'Run options', exact: true });
    await expect(menu.locator('.run-action-item > span')).toHaveText(['Run script', 'EXPLAIN', 'EXPLAIN PIPELINE']);
    await expect(menu.getByRole('menuitem', { name: 'Run script' })).toBeEnabled();
    await expect(menu.getByRole('menuitem', { name: 'Run script' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(menu.getByRole('menuitem', { name: 'EXPLAIN', exact: true })).toBeFocused();
    await page.keyboard.press('End');
    await expect(menu.getByRole('menuitem', { name: 'EXPLAIN PIPELINE', exact: true })).toBeFocused();
    await page.keyboard.press('Home');
    await expect(menu.getByRole('menuitem', { name: 'Run script' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();
});

test('Expert panels stay reachable through SQL AI and More', async ({ page }) => {
    await trust(page);
    await page.getByRole('button', { name: 'More workspace panels', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Run history', exact: true }).click();
    await expect(page.locator('.inspector-header h2')).toHaveText('Run history');

    await page.getByRole('button', { name: 'SQL AI', exact: true }).click();
    await expect(page.locator('.inspector-header h2')).toHaveText('AI copilot');
    await expect(page.locator('.assistant-panel')).toBeVisible();
    await expect(page.locator('.cm-content')).toContainText('SELECT');
});

test('Mobile expert navigation opens the browser drawer and keeps its tabs usable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await trust(page);

    await page.locator('.icon-rail').getByRole('button', { name: 'Schema', exact: true }).click();
    const drawer = page.locator('.inspector-pane.is-drawer');
    await expect(drawer).toBeVisible();
    await drawer.getByRole('navigation', { name: 'Workspace browser', exact: true }).getByRole('button', { name: 'Queries', exact: true }).click();
    await expect(drawer.locator('.inspector-header h2')).toHaveText('Queries');
    await drawer.getByRole('button', { name: 'Close inspector', exact: true }).click();
    await expect(drawer).toHaveCount(0);
});
