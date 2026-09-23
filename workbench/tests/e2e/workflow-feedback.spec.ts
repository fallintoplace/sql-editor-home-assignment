import { test, expect, type Page } from '@playwright/test';
import type { QueryDocument, Run } from '../../shared/types';
import { runScript, trust } from './helpers.js';
async function replaceSql(page: Page, sql: string) {
    await page.locator('.cm-content').click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.insertText(sql);
    await expect(page.locator('.cm-content')).toContainText(sql);
}
function requests(page: Page) {
    const executions: unknown[] = [];
    const writes: unknown[] = [];
    page.on('request', request => {
        const path = new URL(request.url()).pathname;
        if (request.method() === 'POST' && (path === '/api/runs' || path === '/api/scripts')) executions.push(request.postDataJSON());
        if (['POST', 'PUT'].includes(request.method()) && /^\/api\/documents(?:\/[^/]+)?$/.test(path)) writes.push(request.postDataJSON());
    });
    return { executions, writes };
}
const saveStatus = (page: Page) => page.getByRole('status', { name: 'Revision save status', exact: true });
const history = (page: Page) => page.getByRole('region', { name: 'Query history', exact: true });
async function runStatement(page: Page) {
    await page.getByRole('button', { name: 'Run statement', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Query results' }).getByText('succeeded', { exact: true })).toBeVisible();
}

test('Reopening and saving a metric keeps its saved contract and dependency', async ({ page }) => {
    const savedDocument: QueryDocument = {
        id: 'saved-metric', owner: 'local-owner', name: 'Daily revenue', connectionId: 'demo', sql: 'SELECT {currency:String}', revision: 4,
        createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z', parameters: { currency: 'USD' },
        chart: { kind: 'line', x: 0, ys: [1], title: 'Revenue by day' }, runId: 'saved-metric-run', parentDocumentId: 'metric-parent',
        dependencies: ['metric-source'], kind: 'metric',
        metric: { definition: 'sum(amount)', grain: 'day', dimensions: ['region'], timezone: 'UTC', filters: 'paid', nullTreatment: 'exclude', sourceColumns: ['orders.amount'] },
    };
    const savedRun: Run = {
        id: 'saved-metric-run', queryId: 'saved-metric-query', owner: 'local-owner', connectionId: 'demo', dataSource: 'fixture',
        sql: savedDocument.sql, kind: 'query', parameters: savedDocument.parameters,
        limits: { rows: 5000, bytes: 2000000, seconds: 30, memory: 536870912, threads: 4 }, tags: {}, status: 'succeeded',
        createdAt: savedDocument.createdAt, elapsedMs: 12, rowCount: 1, bytes: 8, columns: [{ name: 'amount', type: 'UInt64' }],
        warnings: [], sequence: 1, resultState: 'expired', requestedBy: 'local-owner', executedAs: 'fixture-reader',
        permissionSnapshot: { readonly: true, role: 'owner' }, retryPolicy: 'never',
    };
    let savePayload: Record<string, unknown> | undefined;
    await page.route(url => url.pathname === '/api/documents' && url.searchParams.get('trash') === 'true', route => route.fulfill({ json: [savedDocument] }));
    await page.route('**/api/runs/saved-metric-run', route => route.fulfill({ json: savedRun }));
    await page.route(url => url.pathname === '/api/documents/saved-metric' && url.searchParams.size === 0, async route => {
        if (route.request().method() !== 'PUT') return route.continue();
        savePayload = route.request().postDataJSON() as Record<string, unknown>;
        await route.fulfill({ json: { ...savedDocument, ...savePayload, revision: 5, updatedAt: '2026-01-03T00:00:00.000Z' } });
    });
    await trust(page);
    await page.getByRole('navigation', { name: 'Workspace browser', exact: true }).getByRole('button', { name: 'Queries', exact: true }).click();
    await page.getByRole('button', { name: /Daily revenue/ }).click();
    await expect(page.locator('.cm-content')).toContainText(savedDocument.sql);
    await expect(page.locator('.execution-bar code')).toHaveText(savedRun.queryId);
    await page.getByRole('button', { name: 'Save revision', exact: true }).click();
    await expect.poll(() => savePayload).toBeDefined();
    expect(savePayload).toMatchObject({
        baseRevision: 4,
        parameters: savedDocument.parameters,
        chart: savedDocument.chart,
        runId: savedDocument.runId,
        parentDocumentId: savedDocument.parentDocumentId,
        kind: 'metric',
        metric: savedDocument.metric,
        dependencies: savedDocument.dependencies,
    });
});

test('Revision status tracks content changes, reverts and explicit saves', async ({ page }) => {
    const counts = requests(page);
    await trust(page);
    await expect(saveStatus(page)).toHaveText('Private local draft');
    const original = 'SELECT 111';
    await replaceSql(page, original);
    await page.getByRole('button', { name: 'Save revision', exact: true }).click();
    await expect(saveStatus(page)).toHaveText('Matches saved revision r1');
    await page.locator('.cm-content').click();
    await page.keyboard.press('ArrowLeft');
    await expect(saveStatus(page)).toHaveText('Matches saved revision r1');
    await replaceSql(page, 'SELECT 4242');
    await expect(saveStatus(page)).toHaveText('Unsaved changes since r1');
    await replaceSql(page, original);
    await expect(saveStatus(page)).toHaveText('Matches saved revision r1');
    expect(counts.writes).toHaveLength(1);
    expect(counts.executions).toHaveLength(0);
});

test('Editing during a delayed save is not falsely presented as saved', async ({ page }) => {
    const counts = requests(page);
    await trust(page);
    let release!: () => void;
    const wait = new Promise<void>(resolve => { release = resolve; });
    await page.route(url => url.pathname === '/api/documents', async route => {
        if (route.request().method() === 'POST') await wait;
        await route.continue();
    });
    try {
        await replaceSql(page, 'SELECT 111');
        await page.getByRole('button', { name: 'Save revision', exact: true }).click();
        await expect(saveStatus(page)).toHaveText('Saving revision…');
        await replaceSql(page, 'SELECT 222');
        release();
        await expect(saveStatus(page)).toHaveText('Unsaved changes since r1');
        await expect(page.locator('.cm-content')).toContainText('SELECT 222');
        expect(counts.writes).toHaveLength(1);
        expect(counts.writes[0]).toMatchObject({ sql: 'SELECT 111' });
        expect(counts.executions).toHaveLength(0);
    } finally { release(); }
});

test('Saved-file read failures show an explicit retry instead of saved status', async ({ page }) => {
    await trust(page);
    await page.getByRole('button', { name: 'Save revision', exact: true }).click();
    await expect(saveStatus(page)).toHaveText('Matches saved revision r1');
    let failing = true;
    await page.route(url => url.pathname === '/api/documents' && url.searchParams.get('trash') === 'true', async route => {
        if (failing) await route.fulfill({ status: 503, json: { error: { code: 'TEMPORARY', message: 'Temporary document read failure' } } });
        else await route.continue();
    });
    const counts = requests(page);
    await page.reload();
    await expect(saveStatus(page)).toHaveText('Saved revision could not be checked');
    failing = false;
    await page.getByRole('button', { name: 'Check saved revision', exact: true }).click();
    await expect(saveStatus(page)).toHaveText('Matches saved revision r1');
    expect(counts.executions).toHaveLength(0);
    expect(counts.writes).toHaveLength(0);
});

test('A newer saved revision is visible without overwriting the local draft', async ({ page }) => {
    await trust(page);
    await page.getByRole('button', { name: 'Save revision', exact: true }).click();
    await expect(saveStatus(page)).toHaveText('Matches saved revision r1');
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    const documentId = await page.evaluate(() => {
        const state = JSON.parse(localStorage.getItem('cathedral:local-owner:demo:v1')!);
        return state.tabs.find((tab: { id: string }) => tab.id === state.activeId).serverId as string;
    });
    await page.route(url => url.pathname === '/api/documents' && url.searchParams.get('trash') === 'true', async route => {
        const response = await route.fetch();
        const documents = await response.json();
        await route.fulfill({ response, json: documents.map((document: { id: string }) => document.id === documentId ? { ...document, revision: 2, sql: 'SELECT 999' } : document) });
    });
    const counts = requests(page);
    await page.reload();
    await expect(saveStatus(page)).toHaveText('Newer saved revision r2');
    await expect(page.locator('.cm-content')).not.toContainText('SELECT 999');
    await page.getByRole('button', { name: 'Open revision library', exact: true }).click();
    await expect(page.getByRole('complementary', { name: 'Inspector', exact: true })).toBeVisible();
    expect(counts.writes).toHaveLength(0);
    expect(counts.executions).toHaveLength(0);
});

test('Invalid limits explain the problem and block buttons, keyboard and palette', async ({ page }) => {
    const counts = requests(page);
    await trust(page);
    const rows = page.getByRole('textbox', { name: 'Maximum returned rows', exact: true });
    await rows.fill('20001');
    await expect(rows).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('Maximum returned rows must be a whole number from 1 to 20,000.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Run statement', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'More run options', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: 'Run script', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Save revision', exact: true })).toBeEnabled();
    await page.locator('.cm-content').click();
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(page.getByRole('alert').filter({ hasText: /Maximum returned rows/ })).toBeVisible();
    await expect(rows).toBeFocused();
    await page.keyboard.press('ControlOrMeta+k');
    const palette = page.getByRole('dialog', { name: 'Commands and Quick Open' });
    await palette.getByRole('combobox', { name: 'Search commands' }).fill('Run selected');
    await expect(palette.getByRole('option')).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('Enter');
    await expect(palette).toBeVisible();
    await page.keyboard.press('Escape');
    expect(counts.executions).toHaveLength(0);
});

test('Reset restores configured limits and does not run SQL', async ({ page }) => {
    const counts = requests(page);
    await trust(page);
    const rows = page.getByRole('textbox', { name: 'Maximum returned rows', exact: true });
    const seconds = page.getByRole('textbox', { name: 'Deadline (seconds)', exact: true });
    const originalRows = await rows.inputValue(), originalSeconds = await seconds.inputValue();
    await rows.fill(''); await seconds.fill('NaN');
    await expect(rows).toHaveAttribute('aria-invalid', 'true');
    await expect(seconds).toHaveAttribute('aria-invalid', 'true');
    await page.getByRole('button', { name: 'Reset limits', exact: true }).click();
    await expect(rows).toHaveValue(originalRows); await expect(seconds).toHaveValue(originalSeconds);
    await expect(page.getByRole('button', { name: 'Run statement', exact: true })).toBeEnabled();
    expect(counts.executions).toHaveLength(0);
});

test('Valid limits above connection defaults reach the normal execution path', async ({ page }) => {
    const counts = requests(page);
    await trust(page);
    await page.getByRole('textbox', { name: 'Maximum returned rows', exact: true }).fill('10000');
    await page.getByRole('textbox', { name: 'Deadline (seconds)', exact: true }).fill('60');
    await runStatement(page);
    expect(counts.executions).toHaveLength(1);
    expect(counts.executions[0]).toMatchObject({ limits: { rows: 10000, seconds: 60 } });
});

test('A run remains in current-file history after the first save', async ({ page }) => {
    const counts = requests(page);
    await trust(page); await runStatement(page);
    const queryId = await page.getByRole('region', { name: 'Query results' }).locator('.run-facts code').innerText();
    await expect(history(page).locator('code')).toContainText([queryId]);
    await page.getByRole('button', { name: 'Save revision', exact: true }).click();
    await expect(saveStatus(page)).toHaveText('Matches saved revision r1');
    await expect(history(page).locator('code')).toContainText([queryId]);
    expect(counts.executions).toHaveLength(1);
});

function historyRun(index: number): Run {
    return { id: `history-${index}`, queryId: `history-query-${index}`, connectionId: 'demo', dataSource: 'fixture', owner: 'local-owner',
        sql: `SELECT 'loaded-history-${index}'`, kind: 'query', parameters: {}, limits: { rows: 5000, bytes: 2000000, seconds: 30, memory: 536870912, threads: 4 },
        tags: {}, status: index === 59 ? 'failed' : 'succeeded', createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
        elapsedMs: 10, rowCount: 7, bytes: 100, columns: [], warnings: [], sequence: 1, resultState: 'expired', requestedBy: 'local-owner',
        executedAs: 'fixture-reader', permissionSnapshot: { readonly: true, role: 'owner' }, retryPolicy: 'never' };
}
async function loadedHistory(page: Page) {
    await page.route(url => url.pathname === '/api/runs', async route => {
        if (route.request().method() === 'GET') await route.fulfill({ json: Array.from({ length: 60 }, (_, index) => historyRun(index)) });
        else await route.continue();
    });
    await trust(page);
    await history(page).getByRole('button', { name: 'Show all workspace files', exact: true }).click();
}
test('An older run-history refresh cannot replace a newer response', async ({ page }) => {
    let requestCount = 0, refreshRequested = false;
    let markFirstRequest!: () => void, releaseFirstRequest!: () => void;
    const firstRequest = new Promise<void>(resolve => { markFirstRequest = resolve; });
    const firstResponseGate = new Promise<void>(resolve => { releaseFirstRequest = resolve; });
    await page.route(url => url.pathname === '/api/runs' && url.searchParams.has('connectionId'), async route => {
        requestCount++;
        if (requestCount === 1) {
            markFirstRequest();
            await firstResponseGate;
            await route.fulfill({ json: [historyRun(0)] });
        } else {
            await route.fulfill({ json: [historyRun(refreshRequested ? 1 : 0)] });
        }
    });
    try {
        await trust(page);
        await firstRequest;
        await page.getByRole('button', { name: 'More workspace panels', exact: true }).click();
        await page.getByRole('menuitem', { name: 'Run history', exact: true }).click();
        const pane = page.locator('.inspector-pane');
        refreshRequested = true;
        await pane.getByRole('button', { name: '↻ Refresh', exact: true }).click();
        await expect(pane.locator('.history-card')).toContainText("loaded-history-1");
        releaseFirstRequest();
        await expect(pane.locator('.history-card')).toContainText("loaded-history-1");
        await expect(pane.locator('.history-card')).not.toContainText("loaded-history-0");
    } finally {
        releaseFirstRequest();
    }
});

test('An older saved-document refresh cannot replace a newer response', async ({ page }) => {
    const savedDocument = (id: string, name: string): QueryDocument => ({
        id, owner: 'local-owner', name, connectionId: 'demo', sql: 'SELECT 1', revision: 1,
        createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
        parameters: {}, chart: { kind: 'table', x: 0, ys: [], title: 'Query result' }, dependencies: [], kind: 'query',
    });
    let requestCount = 0, refreshRequested = false;
    let markFirstRequest!: () => void, releaseFirstRequest!: () => void;
    const firstRequest = new Promise<void>(resolve => { markFirstRequest = resolve; });
    const firstResponseGate = new Promise<void>(resolve => { releaseFirstRequest = resolve; });
    await page.route(url => url.pathname === '/api/documents' && url.searchParams.get('trash') === 'true', async route => {
        requestCount++;
        if (requestCount === 1) {
            markFirstRequest();
            await firstResponseGate;
            await route.fulfill({ json: [savedDocument('saved-old', 'Old saved query.sql')] });
        } else {
            const document = refreshRequested ? savedDocument('saved-new', 'Fresh saved query.sql') : savedDocument('saved-old', 'Old saved query.sql');
            await route.fulfill({ json: [document] });
        }
    });
    try {
        await trust(page);
        await firstRequest;
        await page.getByRole('navigation', { name: 'Workspace browser', exact: true }).getByRole('button', { name: 'Queries', exact: true }).click();
        const pane = page.locator('.inspector-pane');
        refreshRequested = true;
        await pane.getByRole('button', { name: '↻ Refresh', exact: true }).click();
        await expect(pane.locator('.document-card')).toContainText('Fresh saved query.sql');
        releaseFirstRequest();
        await expect(pane.locator('.document-card')).toContainText('Fresh saved query.sql');
        await expect(pane.locator('.document-card')).not.toContainText('Old saved query.sql');
    } finally {
        releaseFirstRequest();
    }
});
test('History filters search SQL and IDs across every loaded run', async ({ page }) => {
    const counts = requests(page);
    await loadedHistory(page);
    const pane = history(page);
    await expect(pane.locator('.history-entry')).toHaveCount(50);
    await pane.getByRole('textbox', { name: 'Search query history', exact: true }).fill("'loaded-history-0'");
    await expect(pane.locator('.history-entry')).toHaveCount(1);
    await expect(pane.locator('.history-entry code')).toHaveText('history-query-0');
    await pane.getByRole('textbox', { name: 'Search query history', exact: true }).fill('HISTORY-query-59 SELECT');
    await pane.getByRole('button', { name: 'Run status', exact: true }).click();
    await page.getByRole('dialog').getByText('Failed', { exact: true }).click();
    await expect(pane.locator('.history-entry')).toHaveCount(1);
    await expect(pane.locator('code')).toHaveText('history-query-59');
    await pane.getByRole('button', { name: 'Clear history filters', exact: true }).click();
    await expect(pane.locator('.history-entry')).toHaveCount(50);
    expect(counts.executions).toHaveLength(0);
    expect(counts.writes).toHaveLength(0);
});

test('More loaded history can be revealed without new execution or writes', async ({ page }) => {
    const counts = requests(page);
    await loadedHistory(page);
    await history(page).getByRole('button', { name: 'Show 10 more runs', exact: true }).click();
    await expect(history(page).locator('.history-entry')).toHaveCount(60);
    await expect(history(page).getByRole('button', { name: 'Show 10 more runs', exact: true })).toHaveCount(0);
    expect(counts.executions).toHaveLength(0);
    expect(counts.writes).toHaveLength(0);
});

test('History failure offers a read-only retry without inventing an empty result', async ({ page }) => {
    const counts = requests(page);
    let failing = true;
    await page.route(url => url.pathname === '/api/runs', async route => {
        await route.fulfill(failing
            ? { status: 503, json: { error: { code: 'TEMPORARY', message: 'Temporary history failure' } } }
            : { json: [] });
    });
    await trust(page);
    await expect(history(page).getByRole('alert')).toContainText('Temporary history failure');
    await expect(history(page).getByText('No runs in this history view yet.')).toHaveCount(0);
    failing = false;
    await history(page).getByRole('button', { name: 'Retry history', exact: true }).click();
    await expect(history(page).getByRole('alert')).toHaveCount(0);
    expect(counts.executions).toHaveLength(0);
});

test('Script history survives a later query and a reload', async ({ page }) => {
    const counts = requests(page);
    await trust(page);
    await replaceSql(page, 'SELECT 1; SELECT fixture_error; SELECT 3;');
    await runScript(page);
    await expect(page.getByRole('button', { name: /Statement 2: failed/ })).toBeVisible();
    await expect(history(page).locator('.history-entry')).toHaveCount(2, { timeout: 10000 });
    await replaceSql(page, 'SELECT 4'); await runStatement(page);
    await expect(history(page).locator('.history-entry')).toHaveCount(3, { timeout: 10000 });
    await page.reload();
    await expect(history(page).locator('.history-entry')).toHaveCount(3);
    expect(counts.executions).toHaveLength(2);
});

for (const theme of ['light', 'dark']) {
    test(`New feedback controls stay contained at 390px in ${theme} mode`, async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await loadedHistory(page);
        if (theme === 'dark') await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
        await page.getByRole('button', { name: 'Focus mode', exact: true }).click();
        await page.getByRole('textbox', { name: 'Maximum returned rows', exact: true }).fill('invalid');
        await history(page).scrollIntoViewIfNeeded();
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
        await expect(history(page).getByRole('textbox', { name: 'Search query history', exact: true })).toBeVisible();
    });
}
