import { test, expect, type Page } from '@playwright/test';
import { runScript, trust, trustCurrentConnection } from './helpers.js';
test('Run, chart, save, reload and retain the same run evidence', async ({ page }) => {
    const runs = countRunRequests(page);
    await trust(page);
    await page.getByRole('button', { name: 'Run statement', exact: true }).click();
    await expect(page.getByText('succeeded', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: '2026-01-01', exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Chart', exact: true }).click();
    await expect(page.locator('.chart-canvas svg[role="img"]')).toBeVisible();
    await page.getByRole('button', { name: 'Save revision', exact: true }).click();
    await expect(page.getByRole('status')).toContainText(/Saved .+ · revision/);
    const queryId = await page.locator('.execution-bar code').innerText();
    await page.reload();
    await expect(page.getByText('succeeded', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: '2026-01-01', exact: true })).toBeVisible();
    await expect(page.locator('.execution-bar code')).toHaveText(queryId);
    expect(runs()).toBe(1);
});
test('A script exposes its failed run without losing editor text', async ({ page }) => {
    await trust(page);
    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.insertText('SELECT 1; SELECT fixture_error; SELECT 3;');
    await runScript(page);
    await expect(page.getByRole('status')).toContainText('Script started');
    await expect(page.getByRole('region', { name: 'Query results' })).toContainText('FIXTURE_ERROR: Deliberate fixture error');
    await expect(page.getByText('failed', { exact: true }).first()).toBeVisible();
    await expect(editor).toContainText('SELECT 1; SELECT fixture_error; SELECT 3;');
});
test('Connection switching does not reuse another connection’s result', async ({ page }) => {
    await trust(page);
    await page.getByRole('button', { name: 'Run statement', exact: true }).click();
    await expect(page.getByText('succeeded', { exact: true }).first()).toBeVisible();
    await switchConnection(page, 'Another sample');
    await trustCurrentConnection(page);
    await expect(page.getByRole('cell', { name: '2026-01-01', exact: true })).toHaveCount(0);
    await expect(page.getByRole('table', { name: 'Retained query rows' })).toHaveCount(0);
    await switchConnection(page, 'Sample data');
    await expect(page.getByRole('cell', { name: '2026-01-01', exact: true })).toBeVisible();
});

// Click UI 0.12 uses a labelled button and a popover dialog, not a combobox.
async function switchConnection(page: Page, name: string) {
    const picker = page.locator('.connection-trigger');
    await picker.click();
    await page.getByRole('dialog', { name: 'Connection details', exact: true }).getByRole('button').filter({ hasText: name }).click();
    await expect(picker).toContainText(name);
}

async function replaceSql(page: Page, sql: string) {
    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.insertText(sql);
    await expect(editor).toContainText(sql);
}

function countRunRequests(page: Page) {
    let count = 0;
    page.on('request', request => {
        if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/runs') count++;
    });
    return () => count;
}

test('Pending edits survive page suspension and a reload', async ({ page }) => {
    await trust(page);
    const title = page.getByRole('textbox', { name: 'SQL document name', exact: true });
    await title.fill('Do not lose this draft.sql');
    await replaceSql(page, "SELECT 'saved before leaving'");
    // Trigger the real pagehide listener without closing the browser context.
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('clickstudio:local-owner:demo:v1')!));
    expect(saved.tabs.find((t: { id: string }) => t.id === saved.activeId).sql).toBe("SELECT 'saved before leaving'");
    await page.reload();
    await expect(title).toHaveValue('Do not lose this draft.sql');
    await expect(page.locator('.cm-content')).toContainText("SELECT 'saved before leaving'");
});

test('Close, reload and reopen retain the full unsaved tab without rerunning SQL', async ({ page }) => {
    const runs = countRunRequests(page);
    await trust(page);
    await page.getByRole('textbox', { name: 'SQL document name', exact: true }).fill('Unfinished.sql');
    await replaceSql(page, 'SELECT {value:UInt64}');
    await page.getByRole('textbox', { name: 'value : UInt64', exact: true }).fill('9007199254740993');
    await page.getByRole('button', { name: 'Run statement', exact: true }).click();
    const results = page.getByRole('region', { name: 'Query results' });
    await expect(results.getByText('succeeded', { exact: true })).toBeVisible();
    const queryId = await results.locator('.run-facts code').innerText();
    await page.getByRole('button', { name: 'Close tab', exact: true }).click();
    await expect(results).toHaveCount(0);
    await page.reload();
    await page.getByRole('button', { name: 'Reopen closed tab', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'SQL document name', exact: true })).toHaveValue('Unfinished.sql');
    await expect(page.locator('.cm-content')).toContainText('SELECT {value:UInt64}');
    await expect(page.getByRole('textbox', { name: 'value : UInt64', exact: true })).toHaveValue('9007199254740993');
    await expect(results.locator('.run-facts code')).toHaveText(queryId);
    expect(runs()).toBe(1);
});

test('Changed parameters mark retained results stale without changing execution evidence', async ({ page }) => {
    const runs = countRunRequests(page);
    await trust(page);
    await replaceSql(page, 'SELECT {threshold:UInt64}');
    const parameter = page.getByRole('textbox', { name: 'threshold : UInt64', exact: true });
    await parameter.fill('9007199254740993');
    await page.getByRole('button', { name: 'Run statement', exact: true }).click();
    const results = page.getByRole('region', { name: 'Query results' });
    await expect(results.getByText('succeeded', { exact: true })).toBeVisible();
    const queryId = await results.locator('.run-facts code').innerText();
    await parameter.fill('9007199254740994');
    await expect(results.getByText(/different bound parameters/)).toBeVisible();
    await results.getByRole('button', { name: 'Executed SQL', exact: true }).click();
    await expect(results.getByLabel('Executed parameters')).toContainText('9007199254740993');
    await expect(results.getByLabel('Executed parameters')).not.toContainText('9007199254740994');
    await expect(results.locator('.run-facts code')).toHaveText(queryId);
    expect(runs()).toBe(1);
    await parameter.fill('9007199254740993');
    await expect(results.getByText(/different bound parameters/)).toHaveCount(0);
});

test('Malformed saved metadata preserves valid SQL and leaves the editor usable', async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem('clickstudio:local-owner:demo:v1', JSON.stringify({
            version: 1, activeId: 'recover-me', tabs: [null, {
                id: 'recover-me', name: 'Recovered.sql', sql: 'SELECT 4242',
                parameters: [], chart: { ys: 'invalid' }, checkpoints: [null], runIds: null,
                dependencies: null, from: -10, to: 999999,
            }],
        }));
    });
    const runs = countRunRequests(page);
    await trust(page);
    await expect(page.locator('.cm-content')).toContainText('SELECT 4242');
    await expect(page.getByRole('textbox', { name: 'SQL document name', exact: true })).toHaveValue('Recovered.sql');
    await expect(page.getByText(/Some stored tabs could not be recovered/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'The workspace could not render.' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Branch experiment', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Recovered experiment.sql', exact: true })).toBeVisible();
    expect(runs()).toBe(0);
});

test('Published shares stay frozen after draft edits', async ({ page, context }) => {
    const runs = countRunRequests(page);
    await trust(page);
    await page.getByRole('button', { name: 'Run statement', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Query results' }).getByText('succeeded', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Publish / share', exact: true }).click();
    await page.getByRole('dialog', { name: 'Publish an evidence snapshot' }).getByRole('button', { name: 'Confirm', exact: true }).click();
    await page.getByRole('dialog', { name: 'Create a read-only share link' }).getByRole('button', { name: 'Confirm', exact: true }).click();
    const link = page.getByRole('textbox', { name: 'Read-only share link', exact: true });
    await expect(link).toHaveValue(/\/share\//);
    const shared = await context.newPage();
    await shared.goto(await link.inputValue());
    await expect(shared.getByRole('heading', { name: 'Query Studio · shared result' })).toBeVisible();
    await expect(shared.getByText(/DEMO SNAPSHOT/)).toBeVisible();
    await expect(shared.getByRole('cell', { name: '2026-01-01', exact: true })).toBeVisible();
    await expect(shared.getByRole('button', { name: 'Run statement', exact: true })).toHaveCount(0);
    await replaceSql(page, 'SELECT 999');
    await shared.reload();
    await expect(shared.locator('pre')).toContainText("toDate('2026-01-01')");
    await expect(shared.locator('pre')).not.toContainText('SELECT 999');
    expect(runs()).toBe(1);
});

test('Stale SQL publication does not create a saved revision or open confirmation', async ({ page }) => {
    let writes = 0;
    page.on('request', request => {
        if (['POST', 'PUT'].includes(request.method()) && /^\/api\/documents(?:\/|$)/.test(new URL(request.url()).pathname)) writes++;
    });
    await trust(page);
    await page.getByRole('button', { name: 'Run statement', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Query results' }).getByText('succeeded', { exact: true })).toBeVisible();
    await replaceSql(page, 'SELECT 12345');
    await page.getByRole('button', { name: 'Publish / share', exact: true }).click();
    await expect(page.getByText(/Run this exact SQL and bound parameters before publishing/)).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(writes).toBe(0);
});

test('Stale parameters cannot create a revision through publication', async ({ page }) => {
    let writes = 0;
    page.on('request', request => {
        if (['POST', 'PUT'].includes(request.method()) && /^\/api\/documents(?:\/|$)/.test(new URL(request.url()).pathname)) writes++;
    });
    await trust(page);
    await replaceSql(page, 'SELECT {n:UInt64}');
    const parameter = page.getByRole('textbox', { name: 'n : UInt64', exact: true });
    await parameter.fill('9007199254740993');
    await page.getByRole('button', { name: 'Run statement', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Query results' }).getByText('succeeded', { exact: true })).toBeVisible();
    await parameter.fill('9007199254740994');
    await page.getByRole('button', { name: 'Publish / share', exact: true }).click();
    await expect(page.getByText(/Run this exact SQL and bound parameters before publishing/)).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(writes).toBe(0);
});

test('Closed history remains recoverable when all open drafts are damaged', async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem('clickstudio:local-owner:demo:v1', JSON.stringify({
            version: 1, tabs: [null, { sql: 1 }], closedTabs: [{
                id: 'closed-survivor', name: 'Still here.sql', sql: 'SELECT {n:UInt64}',
                parameters: { n: '9007199254740993' },
            }],
        }));
    });
    const runs = countRunRequests(page);
    await trust(page);
    await page.getByRole('button', { name: 'Reopen closed tab', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'SQL document name', exact: true })).toHaveValue('Still here.sql');
    await expect(page.locator('.cm-content')).toContainText('SELECT {n:UInt64}');
    await expect(page.getByRole('textbox', { name: 'n : UInt64', exact: true })).toHaveValue('9007199254740993');
    expect(runs()).toBe(0);
});

test('Reopening cached completed results does not create another event stream', async ({ page }) => {
    await page.addInitScript(() => {
        const NativeEventSource = window.EventSource;
        window.EventSource = class extends NativeEventSource {
            constructor(url: string | URL, init?: EventSourceInit) {
                super(url, init);
                const root = document.documentElement;
                root.dataset.testEventStreams = String(Number(root.dataset.testEventStreams ?? '0') + 1);
            }
        };
    });
    const runs = countRunRequests(page);
    await trust(page);
    await page.getByRole('button', { name: 'Run statement', exact: true }).click();
    const results = page.getByRole('region', { name: 'Query results' });
    await expect(results.getByText('succeeded', { exact: true })).toBeVisible();
    const queryId = await results.locator('.run-facts code').innerText();
    const streams = await page.locator('html').getAttribute('data-test-event-streams') ?? '0';
    await page.getByRole('button', { name: 'Close tab', exact: true }).click();
    await expect(results).toHaveCount(0);
    await page.getByRole('button', { name: 'Reopen closed tab', exact: true }).click();
    await expect(results.getByText('succeeded', { exact: true })).toBeVisible();
    await expect(results.locator('.run-facts code')).toHaveText(queryId);
    expect(await page.locator('html').getAttribute('data-test-event-streams') ?? '0').toBe(streams);
    expect(runs()).toBe(1);
});
