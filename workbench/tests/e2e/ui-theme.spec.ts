import { test, expect } from '@playwright/test';

for (const theme of ['light', 'dark']) test(`Click UI controls retain their design-system styles in ${theme} mode`, async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/not live data/i).first()).toBeVisible();
    if (theme === 'dark') await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
    const action = page.getByRole('button', { name: 'Test connection', exact: true });
    await expect(action).toBeVisible();
    // A later Tailwind reset previously won over the Click UI cascade layer.
    // Check rendered affordances, not a class name or a particular theme color.
    const styles = await action.evaluate(element => {
        const css = getComputedStyle(element);
        return { padding: parseFloat(css.paddingLeft), radius: parseFloat(css.borderRadius), height: element.getBoundingClientRect().height };
    });
    expect(styles.padding).toBeGreaterThan(0);
    expect(styles.radius).toBeGreaterThan(0);
    expect(styles.height).toBeGreaterThanOrEqual(32);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
});
