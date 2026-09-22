import { test, expect } from '@playwright/test';

const themes = [
    { value: 'monokai', dark: true, surface: '#101412', chrome: '#101412' },
    { value: 'catppuccin-latte', dark: false, surface: '#f1f3ee', chrome: '#f1f3ee' },
    { value: 'click-dark', dark: true, surface: '#0d1012', chrome: '#0d1012' },
    { value: 'click-light', dark: false, surface: '#f3f5f7', chrome: '#f3f5f7' },
] as const;

for (const theme of themes) test(`${theme.value} applies its palette and survives reload`, async ({ page }) => {
    await page.goto('/');
    const picker = page.getByLabel('Theme');
    await expect(picker).toBeVisible();
    await picker.selectOption(theme.value);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme.value);

    const palette = await page.locator('html').evaluate(element => ({
        colorScheme: getComputedStyle(element).colorScheme,
        surface: getComputedStyle(element).getPropertyValue('--page').trim(),
    }));
    expect(palette.colorScheme).toBe(theme.dark ? 'dark' : 'light');
    expect(palette.surface).toBe(theme.surface);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', theme.chrome);
    await expect(page.locator('.brand-symbol')).toHaveAttribute('src', new RegExp(`clickhouse-logomark-${theme.dark ? 'dark' : 'light'}`));

    await page.reload();
    await expect(page.getByLabel('Theme')).toHaveValue(theme.value);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme.value);
});

test('an unknown saved theme falls back to Monokai', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('cathedral:theme', 'future-theme'));
    await page.goto('/');
    await expect(page.getByLabel('Theme')).toHaveValue('monokai');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'monokai');
});
