import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

test('Static Vercel preview loads the native parser and exports retained sample results', async ({ page }) => {
    const wasmResponsePromise = page.waitForResponse(response => new URL(response.url()).pathname === '/assets/clickhouse-parser.wasm');
    await page.goto('/');

    const wasmResponse = await wasmResponsePromise;
    expect(wasmResponse.status()).toBe(200);
    expect(wasmResponse.headers()['content-type']).toMatch(/^application\/wasm/);
    expect(Array.from((await wasmResponse.body()).subarray(0, 4))).toEqual([0, 97, 115, 109]);

    await page.getByRole('button', { name: 'More workspace panels', exact: true }).click();
    await page.getByRole('menuitem', { name: 'ClickHouse parser', exact: true }).click();
    await expect(page.getByText('Ready · local WebAssembly')).toBeVisible();
    await expect(page.getByText('Valid ClickHouse SQL')).toBeVisible();

    const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: 'Export', exact: true }).click(),
    ]);
    const csv = await readFile(await download.path(), 'utf8');
    expect(csv.split('\r\n')[0]).toContain('day');
    expect(csv).toContain('events');
});
