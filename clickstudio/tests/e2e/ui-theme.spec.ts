import { test, expect, type Page } from '@playwright/test';

const themes = [
    {
        value: 'click-dark',
        dark: true,
        surface: '#0c151c',
        panel: '#14232d',
        accent: '#68e5ff',
        action: '#e9f400',
        chrome: '#151515',
        logoColor: '#fff',
    },
    {
        value: 'click-light',
        dark: false,
        surface: '#edf4f6',
        panel: '#fcfeff',
        accent: '#08758d',
        action: '#e9f400',
        chrome: '#ffffff',
        logoColor: '#161616',
    },
] as const;

function themeOption(page: Page, value: string) {
    const label = value === 'click-dark' ? 'Dark theme' : 'Light theme';
    return page.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio', { name: label });
}

for (const theme of themes) test(`${theme.value} applies its palette and survives reload`, async ({ page }) => {
    await page.goto('/');
    const option = themeOption(page, theme.value);
    await expect(option).toBeVisible();
    await option.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme.value);

    const palette = await page.locator('html').evaluate(element => {
        const styles = getComputedStyle(element);
        return {
            colorScheme: styles.colorScheme,
            surface: styles.getPropertyValue('--page').trim(),
            panel: styles.getPropertyValue('--panel').trim(),
            accent: styles.getPropertyValue('--accent').trim(),
            action: styles.getPropertyValue('--accent-action').trim(),
        };
    });
    expect(palette.colorScheme).toBe(theme.dark ? 'dark' : 'light');
    expect(palette.surface).toBe(theme.surface);
    expect(palette.panel).toBe(theme.panel);
    expect(palette.accent).toBe(theme.accent);
    expect(palette.action).toBe(theme.action);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', theme.chrome);
    const logoSvg = await page.locator('.brand-symbol').evaluate(image => decodeURIComponent(image.getAttribute('src')?.split(',')[1] ?? ''));
    expect(logoSvg).toContain(`fill: ${theme.logoColor}`);

    await page.reload();
    await expect(themeOption(page, theme.value)).toBeChecked();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme.value);
});

test('an unknown saved theme falls back to ClickDark', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('clickstudio:theme', 'future-theme'));
    await page.goto('/');
    await expect(themeOption(page, 'click-dark')).toBeChecked();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'click-dark');
});

for (const removedTheme of ['monokai', 'catppuccin-latte']) test(`a saved ${removedTheme} preference falls back to ClickDark`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem('clickstudio:theme', value), removedTheme);
    await page.goto('/');
    await expect(themeOption(page, 'click-dark')).toBeChecked();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'click-dark');
});

test('localized desktop header keeps the theme switch in view', async ({ page }) => {
    await page.setViewportSize({ width: 2048, height: 900 });
    await page.goto('/');

    const localeSelect = page.locator('.topbar-preferences select');
    const topbar = page.locator('.topbar');
    const themeSwitch = page.locator('.theme-mode-control');

    for (const locale of ['en', 'de', 'es', 'nl', 'zh', 'ru']) {
        await localeSelect.selectOption(locale);
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        await expect(themeSwitch).toBeVisible();

        const headerSize = await topbar.evaluate(element => ({
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
        }));
        expect(headerSize.scrollWidth, `${locale} header overflow`).toBeLessThanOrEqual(headerSize.clientWidth);

        const themeBounds = await themeSwitch.evaluate(element => {
            const rect = element.getBoundingClientRect();
            return { left: rect.left, right: rect.right, viewportWidth: window.innerWidth };
        });
        expect(themeBounds.left, `${locale} theme switch left edge`).toBeGreaterThanOrEqual(0);
        expect(themeBounds.right, `${locale} theme switch right edge`).toBeLessThanOrEqual(themeBounds.viewportWidth);
    }
});
