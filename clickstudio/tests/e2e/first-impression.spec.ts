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
    await expect(browser.getByRole('button', { name: 'Objects', exact: true })).toBeVisible();
    await expect(browser.getByRole('button', { name: 'Reference', exact: true })).toBeVisible();
    await expect(browser.getByRole('button', { name: 'Queries', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ask AI', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save revision', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Run statement', exact: true })).toBeVisible();
});

test('Run, script, and explain actions stay visible beside the primary Run button', async ({ page }) => {
    await trust(page);
    const actions = page.getByRole('group', { name: 'Run actions', exact: true });
    const runScript = actions.getByRole('button', { name: /^Run script/ });
    await expect(actions.getByRole('button', { name: 'Run statement', exact: true })).toBeVisible();
    await expect(runScript).toBeVisible();
    await expect(actions.getByRole('button', { name: 'EXPLAIN INDEXES', exact: true })).toBeVisible();
    await expect(actions.getByRole('button', { name: 'EXPLAIN PLAN', exact: true })).toBeVisible();
    await expect(actions.getByRole('button', { name: 'EXPLAIN PIPELINE', exact: true })).toBeVisible();
    await expect(runScript).toBeEnabled();
    await runScript.focus();
    await expect(runScript).toBeFocused();
});

test('EXPLAIN PLAN opens a structured tree and keeps the raw result available', async ({ page }) => {
    await trust(page);
    await page.getByTestId('run-action-explain-plan').click();

    const plan = page.getByRole('region', { name: 'Logical query plan', exact: true });
    await expect(plan).toContainText('Expression');
    await expect(plan).toContainText('ReadFromFixture');
    await expect(plan).toContainText('Fixture only; the SQL was not evaluated.');

    await page.getByRole('tab', { name: 'Results', exact: true }).click();
    await expect(page.getByRole('table', { name: 'Retained query rows' })).toBeVisible();
});

test('EXPLAIN PIPELINE opens an interactive ClickHouse operator graph', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 644 });
    await trust(page);
    await page.getByTestId('run-action-explain-pipeline').click();

    const graph = page.getByRole('region', { name: 'Scrollable operator graph', exact: true });
    const controls = page.getByRole('group', { name: 'Graph view controls', exact: true });
    const initiallySelected = graph.locator('[data-node-id][aria-pressed="true"]');
    await expect(initiallySelected).toBeVisible();
    const selectedIsInGraphViewport = await graph.evaluate(element => {
        const selectedNode = element.querySelector('[data-node-id][aria-pressed="true"]');
        if (!selectedNode) return false;
        const viewport = element.getBoundingClientRect();
        const node = selectedNode.getBoundingClientRect();
        return node.right > viewport.left && node.left < viewport.right && node.bottom > viewport.top && node.top < viewport.bottom;
    });
    expect(selectedIsInGraphViewport).toBe(true);
    const filter = graph.locator('[data-node-id]').filter({ hasText: 'FilterTransform' });
    await expect(filter).toBeVisible();
    await filter.click();
    await expect(page.locator('.pipeline-node-inspector')).toContainText('FilterTransform');
    await expect(page.locator('.pipeline-node-inspector')).toContainText('planned');

    const graphMetrics = await graph.evaluate(element => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight }));
    expect(graphMetrics.scrollHeight).toBeGreaterThan(graphMetrics.clientHeight);
    const lastNode = graph.locator('[data-node-id]').last();
    await graph.evaluate(element => { element.scrollTop = element.scrollHeight; });
    await expect(lastNode).toBeInViewport();

    const svg = graph.locator('svg');
    const initialWidth = Number(await svg.getAttribute('width'));
    await controls.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await expect.poll(async () => Number(await svg.getAttribute('width'))).toBeGreaterThan(initialWidth);
    await controls.getByRole('button', { name: 'Focus node', exact: true }).click();
    await expect(controls.getByLabel('Zoom level')).toHaveText('100%');
    await controls.getByRole('button', { name: 'Fit graph', exact: true }).click();
    await expect(controls.getByLabel('Zoom level')).not.toHaveText('100%');

    const resultsContent = page.locator('#query-results-content');
    const resultsMetrics = await resultsContent.evaluate(element => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight }));
    expect(resultsMetrics.scrollHeight).toBeGreaterThan(resultsMetrics.clientHeight);
    await resultsContent.evaluate(element => { element.scrollTop = element.scrollHeight; });
    await expect(page.locator('.pipeline-node-inspector')).toBeInViewport();
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

    await page.locator('.icon-rail').getByRole('button', { name: 'Objects', exact: true }).click();
    const drawer = page.locator('.inspector-pane.is-drawer');
    await expect(drawer).toBeVisible();
    const browser = drawer.getByRole('navigation', { name: 'Workspace browser', exact: true });
    await expect(browser.getByRole('button', { name: 'Objects', exact: true })).toBeVisible();
    await expect(browser.getByRole('button', { name: 'Reference', exact: true })).toBeVisible();
    await expect(browser.getByRole('button', { name: 'Queries', exact: true })).toBeVisible();
    await browser.getByRole('button', { name: 'Reference', exact: true }).click();
    await expect(drawer.locator('.inspector-header h2')).toHaveText('Reference');
    await browser.getByRole('button', { name: 'Queries', exact: true }).click();
    await expect(drawer.locator('.inspector-header h2')).toHaveText('Queries');
    await drawer.getByRole('button', { name: 'Close inspector', exact: true }).click();
    await expect(drawer).toHaveCount(0);
});
