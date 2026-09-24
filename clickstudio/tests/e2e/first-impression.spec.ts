import { test, expect } from '@playwright/test';
import { trust } from './helpers.js';

test('Advanced mode gives the editor the full work area before the first run', async ({ page }) => {
    await trust(page);

    const content = page.locator('.workspace-content');
    await expect(content).not.toHaveClass(/has-run/);
    await expect(page.getByRole('region', { name: 'Query results', exact: true })).toHaveCount(0);
    await expect(page.locator('.empty-workspace')).toHaveCount(0);
    await expect(page.locator('.icon-rail')).toBeHidden();

    const browser = page.getByRole('navigation', { name: 'Workspace browser', exact: true });
    await expect(browser.getByRole('button', { name: 'Tables', exact: true })).toBeVisible();
    await expect(browser.getByRole('button', { name: 'Queries', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ask AI', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save revision', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Run statement', exact: true })).toBeVisible();
});

test('Run script and explain actions stay visible beside the primary Run button', async ({ page }) => {
    await trust(page);
    const actions = page.getByRole('group', { name: 'Run actions', exact: true });
    const runScript = actions.getByRole('button', { name: /^Run script/ });
    await expect(actions.getByRole('button', { name: 'Run statement', exact: true })).toBeVisible();
    await expect(runScript).toBeVisible();
    await expect(actions.getByRole('button', { name: 'EXPLAIN', exact: true })).toBeVisible();
    await expect(actions.getByRole('button', { name: 'EXPLAIN PIPELINE', exact: true })).toBeVisible();
    await expect(runScript).toBeEnabled();
    await runScript.focus();
    await expect(runScript).toBeFocused();
});

test('Advanced panels stay reachable through Ask AI and More', async ({ page }) => {
    await trust(page);
    await page.getByRole('button', { name: 'More workspace panels', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Runs', exact: true }).click();
    await expect(page.locator('.inspector-header h2')).toHaveText('Run history');

    await page.getByRole('button', { name: 'Ask AI', exact: true }).click();
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
