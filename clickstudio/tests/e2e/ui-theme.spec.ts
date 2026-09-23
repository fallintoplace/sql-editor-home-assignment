import { test, expect } from '@playwright/test';

const themes = [
    { value: 'click-dark', dark: true, surface: '#101010', chrome: '#101010', logoColor: '#fff' },
    { value: 'click-light', dark: false, surface: '#e9eee9', chrome: '#f5f6f1', logoColor: '#161616' },
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
    const logoSvg = await page.locator('.brand-symbol').evaluate(image => decodeURIComponent(image.getAttribute('src')?.split(',')[1] ?? ''));
    expect(logoSvg).toContain(`fill: ${theme.logoColor}`);

    await page.reload();
    await expect(page.getByLabel('Theme')).toHaveValue(theme.value);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme.value);
});

test('an unknown saved theme falls back to ClickDark', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('clickstudio:theme', 'future-theme'));
    await page.goto('/');
    await expect(page.getByLabel('Theme')).toHaveValue('click-dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'click-dark');
});

for (const removedTheme of ['monokai', 'catppuccin-latte']) test(`a saved ${removedTheme} preference falls back to ClickDark`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem('clickstudio:theme', value), removedTheme);
    await page.goto('/');
    await expect(page.getByLabel('Theme')).toHaveValue('click-dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'click-dark');
});
