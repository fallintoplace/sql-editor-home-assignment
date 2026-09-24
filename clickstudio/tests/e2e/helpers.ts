import { expect, type Page } from '@playwright/test';

export const runStatementButton = (page: Page) => page.getByTestId('run-statement');

export async function openBlankSql(page: Page) {
    await page.getByTestId('new-sql').click();
    await page.getByTestId('blank-sql').click();
}

export async function openWorkspacePanel(page: Page, panel: string) {
    await page.getByTestId('workspace-panels').click();
    await page.getByTestId(`workspace-panel-${panel}`).click();
}

export async function trust(page: Page) {
    await page.goto('/');
    await trustCurrentConnection(page);
    await expect(runStatementButton(page)).toBeEnabled();
}

export async function trustCurrentConnection(page: Page) {
    const trigger = page.locator('.connection-trigger');
    await expect(trigger).toBeVisible();
    await trigger.click();
    const details = page.getByRole('dialog', { name: 'Connection details', exact: true });
    const start = details.getByRole('button', { name: 'Start exploring', exact: true });
    if (await start.isVisible()) await start.click();
    if (await trigger.getAttribute('aria-expanded') === 'true') await trigger.click();
}

export async function runScript(page: Page) {
    await page.getByRole('button', { name: /^Run script/ }).click();
}
