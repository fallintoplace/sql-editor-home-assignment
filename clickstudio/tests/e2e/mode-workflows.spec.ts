import { test, expect, type Page } from '@playwright/test';
import { openWorkspacePanel, trust, trustCurrentConnection } from './helpers.js';

const generatedSql = 'SELECT day, events FROM demo.events ORDER BY day';

async function beginInCompactMode(page: Page) {
    await page.addInitScript(() => localStorage.setItem('clickstudio:experience', 'beginner'));
    await page.goto('/');
    await expect(page.getByRole('textbox', { name: 'SQL editor', exact: true })).toBeVisible();
    await expect(page.getByTestId('open-ai')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Describe your data question', exact: true })).toHaveCount(0);
    await trustCurrentConnection(page);
}

test('Compact opens on SQL and can run a query without opening AI', async ({ page }) => {
    let contextRequests = 0;
    page.on('request', request => {
        if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/assistant/context') contextRequests++;
    });
    await page.addInitScript(() => localStorage.setItem('clickstudio:experience', 'beginner'));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const editor = page.getByRole('textbox', { name: 'SQL editor', exact: true });
    await expect(editor).toBeVisible();
    await expect(editor).toContainText('SELECT');
    await expect(page.getByTestId('open-ai')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Describe your data question', exact: true })).toHaveCount(0);

    const runQuery = page.getByTestId('run-statement');
    if (await runQuery.isDisabled()) {
        await page.getByRole('button', { name: 'Start exploring', exact: true }).click();
        await expect(runQuery).toBeEnabled();
    }
    await runQuery.click();
    const results = page.getByRole('region', { name: 'Query results', exact: true });
    await expect(results.getByRole('table', { name: 'Retained query rows', exact: true })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Sample results were generated. Query SQL was not sent to ClickHouse.' })).toBeVisible();
    expect(contextRequests).toBe(0);
    await expect(results.getByRole('tab', { name: 'Insights', exact: true })).toHaveCount(0);

    const queryId = await page.locator('.execution-bar code').innerText();
    await page.getByText('Advanced', { exact: true }).click();
    await expect(page.locator('.cm-content')).toContainText('SELECT');
    await expect(page.locator('.execution-bar code')).toHaveText(queryId);
    await page.getByText('Compact', { exact: true }).click();
    await expect(page.locator('.execution-bar code')).toHaveText(queryId);
});

test('Compact AI proposal becomes the same query and run in Advanced mode', async ({ page }) => {
    const contexts: Record<string, unknown>[] = [];
    const proposals: Record<string, unknown>[] = [];
    let proposalBaseSql = '';
    await page.route('**/api/assistant/context', async route => {
        const body = route.request().postDataJSON() as Record<string, unknown>;
        contexts.push(body);
        proposalBaseSql = String(body.sql ?? '');
        await route.fulfill({ status: 201, json: { id: 'test-context', summary: ['Schema: demo.events', 'Only the selected question and schema are included.'] } });
    });
    await page.route('**/api/assistant/proposals', async route => {
        proposals.push(route.request().postDataJSON() as Record<string, unknown>);
        await route.fulfill({ json: {
            id: 'test-proposal', owner: 'local-owner', connectionId: 'demo', action: 'generate', createdAt: '2026-09-23T00:00:00.000Z',
            baseSql: proposalBaseSql, responseId: 'test-response', model: 'test-model', promptVersion: 'test', contextSummary: ['Fixture-backed mock'], decision: 'pending',
            sql: generatedSql, summary: 'Show the sample event counts by day.', assumptions: [], tables: ['demo.events'], caveats: ['The demo fixture does not evaluate SQL.'], clarification: null, findings: [],
            quality: { evaluatorVersion: 'test', evaluatedAt: '2026-09-23T00:00:00.000Z', status: 'pass', score: 100, checks: [] },
        } });
    });
    await page.route('**/api/assistant/proposals/test-proposal/decision', async route => {
        const body = route.request().postDataJSON() as { decision: 'accepted' | 'rejected' };
        await route.fulfill({ json: {
            id: 'test-proposal', owner: 'local-owner', connectionId: 'demo', action: 'generate', createdAt: '2026-09-23T00:00:00.000Z', decidedAt: '2026-09-23T00:00:01.000Z',
            baseSql: proposalBaseSql, responseId: 'test-response', model: 'test-model', promptVersion: 'test', contextSummary: ['Fixture-backed mock'], decision: body.decision,
            sql: generatedSql, summary: 'Show the sample event counts by day.', assumptions: [], tables: ['demo.events'], caveats: [], clarification: null, findings: [],
        } });
    });

    await beginInCompactMode(page);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'revision 1' })).toBeVisible();
    await page.getByTestId('open-ai').click();
    const prompt = page.getByRole('textbox', { name: 'Describe your data question', exact: true });
    await prompt.fill('Show event counts by day');
    await page.getByRole('button', { name: 'Review context', exact: true }).click();
    await expect(page.getByText(/Schema: demo\.events/)).toBeVisible();
    expect(contexts).toHaveLength(1);
    expect(contexts[0]).toMatchObject({ action: 'generate', question: 'Show event counts by day', connectionId: 'demo' });

    page.on('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Send to AI & propose', exact: true }).click();
    await expect(page.getByText('Show the sample event counts by day.', { exact: true })).toBeVisible();
    expect(proposals).toEqual([{ contextId: 'test-context', consent: true }]);
    await page.getByRole('button', { name: 'Use this query', exact: true }).click();
    await expect(page.getByText('Added to your SQL draft', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Run this query', exact: true }).click();

    const results = page.getByRole('region', { name: 'Query results', exact: true });
    await expect(results.locator('[data-run-status="succeeded"]')).toBeVisible();
    await expect(results.getByRole('cell', { name: '2026-01-01', exact: true })).toBeVisible();
    const queryId = await page.locator('.execution-bar code').innerText();
    await results.getByRole('tab', { name: 'Chart', exact: true }).click();
    await expect(results.locator('.chart-canvas svg[role="img"]')).toBeVisible();
    await expect(results.getByRole('tab', { name: 'Insights', exact: true })).toHaveCount(0);
    await page.getByText('Advanced', { exact: true }).click();
    await results.getByRole('tab', { name: 'Insights', exact: true }).click();
    const loadDetails = results.getByRole('button', { name: 'Load execution details', exact: true });
    if (await loadDetails.count()) await loadDetails.click();
    await expect(results.getByText('Execution time', { exact: true })).toBeVisible();

    await expect(page.locator('.cm-content')).toContainText(generatedSql);
    await expect(page.locator('.execution-bar code')).toHaveText(queryId);
    await page.getByText('Compact', { exact: true }).click();
    await page.getByTestId('open-ai').click();
    await expect(prompt).toHaveValue('Show event counts by day');
    await expect(page.locator('.execution-bar code')).toHaveText(queryId);
});

test('Advanced editor, insights, pipeline and AI copilot stay read-only until a user runs SQL', async ({ page }) => {
    const runRequests: unknown[] = [];
    const contexts: Record<string, unknown>[] = [];
    let activeRunId = '';
    let proposalRequests = 0;
    page.on('request', request => {
        if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/runs') runRequests.push(request.postDataJSON());
    });
    page.on('response', response => {
        if (response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/runs')
            void response.json().then(body => { activeRunId = body.id; });
    });
    await page.route('**/api/assistant/context', async route => {
        contexts.push(route.request().postDataJSON() as Record<string, unknown>);
        await route.fulfill({ status: 201, json: { id: 'expert-context', summary: ['Current SQL, schema, and selected retained result are included.'] } });
    });
    await page.route('**/api/assistant/proposals', async route => {
        proposalRequests++;
        await route.fulfill({ json: {
            id: 'expert-proposal', owner: 'local-owner', connectionId: 'demo', action: 'performance', createdAt: '2026-09-23T00:00:00.000Z',
            baseSql: String(contexts[0]?.sql ?? ''), responseId: 'test-response', model: 'test-model', promptVersion: 'test', contextSummary: ['Fixture-backed mock'], decision: 'pending',
            sql: null, summary: 'The fixture has no measured performance data.', assumptions: [], tables: [], caveats: ['Demo runs do not measure ClickHouse performance.'], clarification: null,
            findings: [{ severity: 'low', message: 'No slowdown can be inferred from fixture data.', evidence: 'The sample driver is not a ClickHouse server.' }],
        } });
    });

    await trust(page);
    const editor = page.getByRole('textbox', { name: 'SQL editor', exact: true });
    await expect(editor).toBeVisible();
    await page.getByTestId('run-statement').click();
    const results = page.getByRole('region', { name: 'Query results', exact: true });
    await expect(results.locator('[data-run-status="succeeded"]')).toBeVisible();
    const queryId = await page.locator('.execution-bar code').innerText();

    await results.getByRole('tab', { name: 'Insights', exact: true }).click();
    const loadDetails = results.getByRole('button', { name: 'Load execution details', exact: true });
    if (await loadDetails.count()) await loadDetails.click();
    await expect(results.getByText('Execution time', { exact: true })).toBeVisible();

    await openWorkspacePanel(page, 'pipeline');
    await expect(page.locator('.pipeline-stage').first()).toBeVisible();
    await page.getByRole('button', { name: 'Open operator graph in Insights', exact: true }).click();
    await expect(results.getByRole('region', { name: 'Scrollable operator graph', exact: true })).toBeVisible();
    await page.getByTestId('open-ai').click();
    await page.locator('.assistant-panel select').selectOption('performance');
    await page.locator('.assistant-panel textarea').fill('Why is this query slow?');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Preview what will be shared', exact: true }).click();
    await expect(page.getByText(/Current SQL, schema/)).toBeVisible();
    expect(contexts[0]).toMatchObject({ action: 'performance', question: 'Why is this query slow?', runId: activeRunId, includeResult: true });

    page.on('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Send to AI & propose', exact: true }).click();
    await expect(page.getByText('The fixture has no measured performance data.', { exact: true })).toBeVisible();
    expect(proposalRequests).toBe(1);
    expect(runRequests).toHaveLength(1);
    await expect(page.locator('.execution-bar code')).toHaveText(queryId);
});

test('Compact voice dictation fills the question without sending it automatically', async ({ page }) => {
    await page.addInitScript(() => {
        class MockRecognition {
            continuous = false;
            interimResults = false;
            lang = '';
            onresult?: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
            onend?: () => void;
            start() { (window as Window & { testRecognition?: MockRecognition }).testRecognition = this; }
            stop() { this.onend?.(); }
            abort() { this.onend?.(); }
        }
        (window as Window & { SpeechRecognition?: typeof MockRecognition }).SpeechRecognition = MockRecognition;
    });
    let contextRequests = 0;
    page.on('request', request => {
        if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/assistant/context') contextRequests++;
    });

    await beginInCompactMode(page);
    await page.getByTestId('open-ai').click();
    const prompt = page.getByRole('textbox', { name: 'Describe your data question', exact: true });
    await page.getByRole('button', { name: 'Dictate question', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Stop dictation', exact: true })).toBeVisible();
    await page.evaluate(() => {
        const recognition = (window as Window & { testRecognition?: { onresult?: (event: unknown) => void } }).testRecognition;
        recognition?.onresult?.({ results: [[{ transcript: 'show weekly revenue' }]] });
    });
    await expect(prompt).toHaveValue('show weekly revenue');
    await page.getByRole('button', { name: 'Stop dictation', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Dictate question', exact: true })).toBeVisible();
    expect(contextRequests).toBe(0);
});
