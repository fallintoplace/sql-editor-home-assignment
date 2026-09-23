import { expect, type Page } from '@playwright/test';

export async function trust(page: Page) {
    await page.goto('/');
    await trustCurrentConnection(page);
    await expect(page.getByRole('button', { name: 'Run statement', exact: true })).toBeEnabled();
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
    await page.getByRole('button', { name: 'More run options', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Run script' }).click();
}
