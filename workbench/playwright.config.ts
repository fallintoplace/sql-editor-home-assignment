import { defineConfig } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const webPort = Number(process.env.WORKBENCH_WEB_PORT ?? 5173);
const apiPort = Number(process.env.WORKBENCH_API_PORT ?? 8080);
const baseURL = `http://localhost:${webPort}`;
export default defineConfig({
    testDir: './tests/e2e', fullyParallel: false, workers: 1, retries: 0, timeout: 30000,
    use: { baseURL, trace: 'retain-on-failure', storageState: { cookies: [], origins: [{ origin: baseURL, localStorage: [{ name: 'cathedral:experience', value: 'expert' }] }] } },
    webServer: { command: 'npm run dev', url: baseURL, reuseExistingServer: false, timeout: 60000,
        env: { DEMO_MODE: 'true', HOST: '127.0.0.1', PORT: String(apiPort), WORKBENCH_API_PORT: String(apiPort), WORKBENCH_WEB_PORT: String(webPort), APP_ORIGIN: baseURL, WORKBENCH_TOKEN: '', OPENAI_API_KEY: '', DATA_DIR: mkdtempSync(join(tmpdir(), 'cathedral-e2e-')) } },
});
