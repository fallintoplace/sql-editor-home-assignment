import { test, expect, type Page } from '@playwright/test';
import { trust, trustCurrentConnection } from './helpers.js';

async function replaceSql(page: Page, sql: string) {
    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.insertText(sql);
    await expect.poll(async () => (await editor.innerText()).replace(/\s/g, ''))
        .toContain(sql.replace(/\s/g, ''));
}

async function runQuery(page: Page) {
    const runResponse = page.waitForResponse(response => {
        const request = response.request();
        return request.method() === 'POST' && new URL(response.url()).pathname === '/api/runs';
    });
    await page.getByRole('button', { name: 'Run statement', exact: true }).click();
    const run = await (await runResponse).json() as { queryId: string };
    await expect(page.locator('.execution-bar code')).toHaveText(run.queryId);
    const results = page.getByRole('region', { name: 'Query results', exact: true });
    await expect(results.getByRole('table', { name: 'Retained query rows' })).toBeVisible();
    return results;
}

test('Run evidence stays with its draft through tab and mode switches', async ({ page }) => {
    let runRequests = 0;
    page.on('request', request => {
        if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/runs') runRequests++;
    });
    await trust(page);
    const results = await runQuery(page);
    const firstQueryId = await page.locator('.execution-bar code').innerText();

    await page.getByRole('button', { name: 'New SQL tab' }).click();
    const secondResults = page.getByRole('region', { name: 'Query results', exact: true });
    await expect(secondResults.getByRole('table', { name: 'Retained query rows' })).toHaveCount(0);
    await expect(page.locator('.execution-bar')).toHaveCount(0);

    await runQuery(page);
    const secondQueryId = await page.locator('.execution-bar code').innerText();
    expect(secondQueryId).not.toBe(firstQueryId);

    await page.getByRole('tab').filter({ hasText: 'Getting started.sql' }).click();
    await expect(results.getByRole('table', { name: 'Retained query rows' })).toBeVisible();
    await expect(page.locator('.execution-bar code')).toHaveText(firstQueryId);
    await page.getByText('Beginner', { exact: true }).click();
    await expect(page.locator('.execution-bar code')).toHaveText(firstQueryId);
    await page.getByText('Expert', { exact: true }).click();
    await expect(page.locator('.execution-bar code')).toHaveText(firstQueryId);
    await expect(page.getByRole('group', { name: 'Workspace layouts' })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Inspector panels' })).toBeVisible();
    expect(runRequests).toBe(2);
});

test('Connection switches keep run evidence isolated and recover each connection workspace', async ({ page }) => {
    await trust(page);
    await runQuery(page);
    const firstQueryId = await page.locator('.execution-bar code').innerText();

    const picker = page.locator('.connection-trigger');
    await picker.click();
    await page.getByRole('dialog', { name: 'Connection details' }).getByRole('button', { name: /Another sample/ }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('connection')).toBe('demo-second');
    await expect(page.locator('.execution-bar')).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Query results', exact: true }).getByRole('table', { name: 'Retained query rows' })).toHaveCount(0);
    await page.reload();
    await expect(page.locator('.connection-trigger')).toContainText('Another sample');
    await trustCurrentConnection(page);
    await runQuery(page);
    const secondQueryId = await page.locator('.execution-bar code').innerText();
    expect(secondQueryId).not.toBe(firstQueryId);

    await picker.click();
    await page.getByRole('dialog', { name: 'Connection details' }).getByRole('button', { name: /Sample data/ }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('connection')).toBe('demo');
    await expect(page.locator('.execution-bar code')).toHaveText(firstQueryId);
});

test('Insights compare one run with its ClickHouse pipeline evidence', async ({ page }) => {
    await trust(page);
    const startedRunResponse = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/runs');
    const results = await runQuery(page);
    const startedRun = await (await startedRunResponse).json() as { id: string; queryId: string };
    const queryPlan = page.getByRole('region', { name: 'Run and query plan comparison' });

    await results.getByRole('tab', { name: 'Insights', exact: true }).click();
    await expect(queryPlan).toContainText(startedRun.queryId);
    const pipelineRequest = page.waitForRequest(request => new URL(request.url()).pathname === `/api/runs/${startedRun.id}/profile/pipeline`);
    await queryPlan.getByRole('button', { name: 'Load ClickHouse pipeline', exact: true }).click();
    await pipelineRequest;
    await expect(queryPlan).toContainText('EXPLAIN PIPELINE');
    await expect(queryPlan).toContainText('ReadFromFixture');
    await expect(page.locator('.execution-bar code')).toHaveText(startedRun.queryId);
});

test('Result filtering searches only the visible retained page without mutating the run', async ({ page }) => {
    await trust(page);
    const results = await runQuery(page);
    const queryId = await page.locator('.execution-bar code').innerText();
    const rows = results.locator('tbody tr');
    const filter = results.getByRole('searchbox', { name: 'Filter current page' });
    await expect(rows).toHaveCount(7);

    await filter.fill('2026-01-02');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('2026-01-02');
    await expect(results).toContainText('1 matches on this page');
    await filter.fill('no matching value');
    await expect(rows).toHaveCount(0);
    await expect(results).toContainText('No rows match on this page.');
    await expect(page.locator('.execution-bar code')).toHaveText(queryId);
});

test('SQL and parameter edits label old results without changing their run evidence', async ({ page }) => {
    let runRequests = 0;
    let submittedSql = '';
    page.on('request', request => {
        if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/runs') {
            runRequests++;
            submittedSql = (request.postDataJSON() as { sql: string }).sql;
        }
    });
    await trust(page);
    const results = await runQuery(page);
    const queryId = await page.locator('.execution-bar code').innerText();

    await replaceSql(page, 'SELECT 42');
    await expect(results.locator('.result-provenance')).toContainText('Result from previous execution');
    await expect(page.locator('.execution-bar code')).toHaveText(queryId);
    await replaceSql(page, submittedSql);
    await expect(results.locator('.result-provenance')).toHaveCount(0);

    await replaceSql(page, 'SELECT {threshold:UInt64}');
    await page.getByRole('textbox', { name: 'threshold:UInt64', exact: true }).fill('9007199254740993');
    await runQuery(page);
    const parameterRunId = await page.locator('.execution-bar code').innerText();
    await page.getByRole('textbox', { name: 'threshold:UInt64', exact: true }).fill('9007199254740994');
    await expect(results.locator('.result-provenance')).toContainText('bound parameters changed');
    await expect(page.locator('.execution-bar code')).toHaveText(parameterRunId);
    expect(runRequests).toBe(2);
});

test('Charts keep NULL missing and plot nullable negative values from zero', async ({ page }) => {
    await page.route('**/api/runs/*/snapshot', async route => {
        const response = await route.fetch();
        const result = await response.json();
        await route.fulfill({ response, json: {
            ...result,
            columns: [{ name: 'label', type: 'String' }, { name: 'value', type: 'Nullable(Int64)' }],
            rows: [['negative', -6], ['missing', null], ['positive', 4]],
            totalRows: 3,
        } });
    });
    await trust(page);
    const results = await runQuery(page);
    await results.getByRole('tab', { name: 'Chart', exact: true }).click();
    await expect(results.locator('.chart-canvas svg[role="img"]')).toBeVisible();
    const measure = results.getByLabel('Measure');
    await expect(measure.locator('option', { hasText: 'value' })).toBeEnabled();
    await expect(results.locator('.chart-footer')).toContainText('2 plotted points');
    await measure.selectOption('1');
    await results.getByLabel('Type').selectOption('bar');
    const bars = results.locator('.chart-bar');
    await expect(bars).toHaveCount(2);
    expect(Number(await bars.nth(0).getAttribute('y'))).toBeCloseTo(100, 0);
    expect(Number(await bars.nth(1).getAttribute('y'))).toBeCloseTo(40, 0);
    await expect(results.locator('.chart-zero-line')).toHaveAttribute('y1', '100');
});

test('Charts sample the full retained range and report the sampled row count', async ({ page }) => {
    await page.route('**/api/runs/*/snapshot', async route => {
        const response = await route.fetch();
        const result = await response.json();
        await route.fulfill({ response, json: {
            ...result,
            columns: [{ name: 'label', type: 'String' }, { name: 'value', type: 'Int64' }],
            rows: Array.from({ length: 350 }, (_, index) => [`row-${index + 1}`, index === 349 ? 1000000 : 1]),
            completeness: 'complete',
        } });
    });
    await trust(page);
    const results = await runQuery(page);
    await results.getByRole('tab', { name: 'Chart', exact: true }).click();
    await expect(results.locator('.chart-bar')).toHaveCount(240);
    await expect(results.locator('.chart-footer')).toContainText('240 sampled rows from 350 retained rows');
    await expect(results.locator('.chart-x-labels span').last()).toHaveText('row-350');
    expect(Number(await results.locator('.chart-bar').last().getAttribute('y'))).toBeCloseTo(40, 0);
});

test('Single-row numeric results render as a number and expose only supported chart types', async ({ page }) => {
    await page.route('**/api/runs/*/snapshot', async route => {
        const response = await route.fetch();
        const result = await response.json();
        await route.fulfill({ response, json: {
            ...result,
            columns: [{ name: 'event_count', type: 'UInt64' }],
            rows: [['42']],
            completeness: 'complete',
        } });
    });
    await trust(page);
    const results = await runQuery(page);
    await results.getByRole('tab', { name: 'Chart', exact: true }).click();
    await expect(results.locator('.chart-number-card')).toContainText('42');
    await expect(results.getByLabel('Type').locator('option')).toHaveText(['Number', 'Line', 'Bar']);
});

test('A delayed chart snapshot cannot update the draft after selecting another script result', async ({ page }) => {
    let releaseSnapshot!: () => void;
    const snapshotGate = new Promise<void>(resolve => { releaseSnapshot = resolve; });
    let notifySnapshotStarted!: () => void;
    const snapshotStarted = new Promise<void>(resolve => { notifySnapshotStarted = resolve; });
    let notifySnapshotFinished!: () => void;
    const snapshotFinished = new Promise<void>(resolve => { notifySnapshotFinished = resolve; });
    let savePayload: Record<string, unknown> | undefined;
    await page.route('**/api/runs/*/snapshot', async route => {
        const response = await route.fetch();
        const result = await response.json();
        notifySnapshotStarted();
        await snapshotGate;
        await route.fulfill({ response, json: { ...result, columns: [{ name: 'value', type: 'UInt64' }], rows: [['42']], completeness: 'complete' } });
        notifySnapshotFinished();
    });
    await page.route(url => url.pathname === '/api/documents', async route => {
        if (route.request().method() !== 'POST') return route.continue();
        savePayload = route.request().postDataJSON() as Record<string, unknown>;
        await route.continue();
    });
    try {
        await trust(page);
        await replaceSql(page, 'SELECT 1; SELECT 2;');
        await page.getByRole('button', { name: 'Run script', exact: true }).click();
        const results = page.getByRole('region', { name: 'Query results', exact: true });
        const first = results.getByRole('button', { name: 'Statement 1: succeeded', exact: true });
        const second = results.getByRole('button', { name: 'Statement 2: succeeded', exact: true });
        await expect(first).toBeVisible();
        await expect(second).toBeVisible();
        await first.click();
        await results.getByRole('tab', { name: 'Chart', exact: true }).click();
        await snapshotStarted;
        await second.click();
        await expect(second).toHaveAttribute('aria-pressed', 'true');
        releaseSnapshot();
        await snapshotFinished;
        await page.getByRole('button', { name: 'Save revision', exact: true }).click();
        await expect.poll(() => savePayload).toBeDefined();
        expect((savePayload?.chart as { kind: string }).kind).toBe('table');
    } finally {
        releaseSnapshot();
    }
});

test('Refreshing run history replaces the visible list with the latest response', async ({ page }) => {
    let refreshed = false;
    const run = {
        id: 'history-refresh-run', status: 'succeeded', sql: 'SELECT refreshed_history_entry',
        createdAt: '2026-09-23T00:00:00.000Z', elapsedMs: 12, rowCount: 7,
    };
    await page.route(/\/api\/runs\?connectionId=demo$/, route => route.fulfill({ json: refreshed ? [run] : [] }));
    await trust(page);
    await page.getByRole('button', { name: 'Runs', exact: true }).click();
    await expect(page.getByText('No runs yet')).toBeVisible();
    refreshed = true;
    await page.getByRole('button', { name: /Refresh/ }).click();
    await expect(page.getByText('SELECT refreshed_history_entry')).toBeVisible();
});

test('A late AI context preview cannot attach to an edited question', async ({ page }) => {
    let release!: () => void;
    const responseGate = new Promise<void>(resolve => { release = resolve; });
    let requestReceived!: () => void;
    const received = new Promise<void>(resolve => { requestReceived = resolve; });
    await page.route('**/api/assistant/context', async route => {
        requestReceived();
        await responseGate;
        await route.fulfill({ status: 201, json: { id: 'old-context', summary: ['Context for the old question'] } });
    });
    await trust(page);
    await page.getByText('Beginner', { exact: true }).click();
    const question = page.getByRole('textbox', { name: 'Describe your data question', exact: true });
    await question.fill('Show the old question');
    await page.getByRole('button', { name: 'Create query', exact: true }).click();
    await received;
    await question.fill('Show a different question');
    release();
    await expect(page.getByText('Context for the old question', { exact: true })).toHaveCount(0);
    await expect(question).toHaveValue('Show a different question');
    await expect(page.getByRole('button', { name: 'Send to AI & propose', exact: true })).toHaveCount(0);
});

test('Scripts show each statement outcome and open that statement’s retained result', async ({ page }) => {
    await trust(page);
    await replaceSql(page, 'SELECT 1; SELECT fixture_error; SELECT 3;');
    await page.getByRole('button', { name: 'Run script', exact: true }).click();

    const results = page.getByRole('region', { name: 'Query results', exact: true });
    await expect(results.getByLabel('Script statement results')).toContainText('partial');
    const first = results.getByRole('button', { name: 'Statement 1: succeeded', exact: true });
    const second = results.getByRole('button', { name: 'Statement 2: failed', exact: true });
    await expect(first).toBeVisible();
    await expect(second).toBeVisible();
    await expect(results.getByRole('button', { name: 'Statement 3: skipped', exact: true })).toBeVisible();

    await first.click();
    await expect(results.getByRole('table', { name: 'Retained query rows' })).toBeVisible();
    await expect(results.locator('.result-provenance')).toHaveCount(0);
    await second.click();
    await expect(results.locator('.result-empty-state')).toContainText('FIXTURE_ERROR');
    await expect(page.locator('.cm-content')).toContainText('SELECT 1; SELECT fixture_error; SELECT 3;');
});

test('Script polling persists every statement run ID, including fast intermediate results', async ({ page }) => {
    await trust(page);
    const sql = 'SELECT 1; SELECT 2; SELECT 3;';
    await replaceSql(page, sql);
    const created = {
        id: 'script-fast', owner: 'local-owner', connectionId: 'demo', sql, createdAt: '2026-09-23T00:00:00.000Z',
        status: 'running', stopOnError: true, cancelled: false,
        statements: [
            { sql: 'SELECT 1', from: 0, to: 8, runId: 'run-a', status: 'succeeded' },
            { sql: 'SELECT 2', from: 10, to: 18, status: 'pending' },
            { sql: 'SELECT 3', from: 20, to: 28, status: 'pending' },
        ],
    };
    const completed = {
        ...created,
        status: 'succeeded',
        statements: [
            { sql: 'SELECT 1', from: 0, to: 8, runId: 'run-a', status: 'succeeded' },
            { sql: 'SELECT 2', from: 10, to: 18, runId: 'run-b', status: 'succeeded' },
            { sql: 'SELECT 3', from: 20, to: 28, runId: 'run-c', status: 'succeeded' },
        ],
    };
    await page.route('**/api/scripts', route => route.fulfill({ status: 202, json: created }));
    await page.route('**/api/scripts/script-fast', route => route.fulfill({ json: completed }));
    await page.getByRole('button', { name: 'Run script', exact: true }).click();

    const results = page.getByRole('region', { name: 'Query results', exact: true });
    await expect(results.getByRole('button', { name: 'Statement 3: succeeded', exact: true })).toBeVisible();
    const runIds = async () => page.evaluate(() => {
        const value = localStorage.getItem('clickstudio:workspace:demo:v1');
        if (!value) return [];
        const workspace = JSON.parse(value) as { tabs: { id: string; runIds: string[]; activeRunId?: string }[]; activeId: string };
        return workspace.tabs.find(tab => tab.id === workspace.activeId)?.runIds ?? [];
    });
    await expect.poll(runIds).toEqual(['run-a', 'run-b', 'run-c']);
    await expect.poll(async () => page.evaluate(() => {
        const workspace = JSON.parse(localStorage.getItem('clickstudio:workspace:demo:v1') ?? 'null');
        return workspace?.tabs.find((tab: { id: string }) => tab.id === workspace.activeId)?.activeRunId;
    })).toBe('run-c');

    await page.reload();
    await expect.poll(runIds).toEqual(['run-a', 'run-b', 'run-c']);
    await expect.poll(async () => page.evaluate(() => {
        const workspace = JSON.parse(localStorage.getItem('clickstudio:workspace:demo:v1') ?? 'null');
        return workspace?.tabs.find((tab: { id: string }) => tab.id === workspace.activeId)?.activeRunId;
    })).toBe('run-c');
});

test('Selecting an earlier script statement stops automatic following while later work runs', async ({ page }) => {
    await trust(page);
    await replaceSql(page, 'SELECT 1; SELECT fixture_slow;');
    await page.getByRole('button', { name: 'Run script', exact: true }).click();

    const results = page.getByRole('region', { name: 'Query results', exact: true });
    const first = results.getByRole('button', { name: 'Statement 1: succeeded', exact: true });
    const second = results.getByRole('button', { name: 'Statement 2: running', exact: true });
    await expect(second).toHaveAttribute('aria-pressed', 'true');
    const nextPoll = page.waitForResponse(response => response.request().method() === 'GET' && new URL(response.url()).pathname.startsWith('/api/scripts/'));
    await first.click();
    await expect(first).toHaveAttribute('aria-pressed', 'true');
    await nextPoll;
    await expect(first).toHaveAttribute('aria-pressed', 'true');
    await expect(second).toHaveAttribute('aria-pressed', 'false');
});

test('Cancelling a long-running query reaches a terminal cancelled state', async ({ page }) => {
    await trust(page);
    await replaceSql(page, 'SELECT fixture_slow');
    await page.getByRole('button', { name: 'Run statement', exact: true }).click();
    const cancel = page.locator('.execution-bar').getByRole('button', { name: 'Cancel', exact: true });
    await expect(cancel).toBeVisible();
    await cancel.click();
    await expect(page.locator('.execution-bar')).toContainText('cancelled', { timeout: 10000 });
});

test('A query and its local draft recover after reload without rerunning', async ({ page }) => {
    let runRequests = 0;
    page.on('request', request => {
        if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/runs') runRequests++;
    });
    await trust(page);
    await page.getByRole('textbox', { name: 'SQL document name', exact: true }).fill('Interview demo.sql');
    await replaceSql(page, "SELECT 'draft survives reload'");
    const results = await runQuery(page);
    const queryId = await page.locator('.execution-bar code').innerText();
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await page.reload();

    await expect(page.getByRole('textbox', { name: 'SQL document name', exact: true })).toHaveValue('Interview demo.sql');
    await expect(page.locator('.cm-content')).toContainText("SELECT 'draft survives reload'");
    await expect(page.getByRole('region', { name: 'Query results', exact: true }).getByRole('table', { name: 'Retained query rows' })).toBeVisible();
    await expect(page.locator('.execution-bar code')).toHaveText(queryId);
    expect(runRequests).toBe(1);
    await expect(results).toHaveCount(1);
});
