import { defineConfig } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export default defineConfig({
    testDir: './tests/e2e', fullyParallel: false, workers: 1, retries: 0, timeout: 30000,
    use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure' },
    webServer: { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: false, timeout: 60000,
        env: { DEMO_MODE: 'true', HOST: '127.0.0.1', PORT: '8080', APP_ORIGIN: 'http://localhost:5173', WORKBENCH_TOKEN: '', OPENAI_API_KEY: '', DATA_DIR: mkdtempSync(join(tmpdir(), 'cathedral-e2e-')) } },
});
