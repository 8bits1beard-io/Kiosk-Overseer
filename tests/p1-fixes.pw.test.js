const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Helper: switch to a specific tab
async function switchTab(page, tabName) {
    await page.click(`[data-action="switchTab"][data-arg="${tabName}"]`);
    await page.waitForSelector(`#tab-${tabName}.active`, { timeout: 2000 });
}

test.describe('Fix 1: Collapsible section headers keyboard support', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.setItem('welcomeDismissed', '1'));
        await page.reload();
        await page.waitForSelector('#xmlPreview', { timeout: 5000 });
    });

    test('collapsible header has role="button" and tabindex="0"', async ({ page }) => {
        // Switch to multi-app mode to show layout tab with collapsible headers
        await page.click('[data-action="setMode"][data-arg="multi"]');
        await switchTab(page, 'layout');

        const header = page.locator('legend.collapsible-header').first();
        await expect(header).toHaveAttribute('role', 'button');
        await expect(header).toHaveAttribute('tabindex', '0');
    });

    test('collapsible header has aria-controls pointing to content section', async ({ page }) => {
        await page.click('[data-action="setMode"][data-arg="multi"]');
        await switchTab(page, 'layout');

        const header = page.locator('legend.collapsible-header').first();
        const controlsId = await header.getAttribute('aria-controls');
        expect(controlsId).toBeTruthy();

        // The controlled element should exist
        const controlled = page.locator(`#${controlsId}`);
        await expect(controlled).toBeAttached();
    });

    test('collapsible header can be focused via Tab', async ({ page }) => {
        await page.click('[data-action="setMode"][data-arg="multi"]');
        await switchTab(page, 'layout');

        const header = page.locator('legend.collapsible-header').first();
        await header.focus();

        const isFocused = await page.evaluate(() =>
            document.activeElement?.classList.contains('collapsible-header')
        );
        expect(isFocused).toBe(true);
    });

    test('Enter key toggles collapsible section', async ({ page }) => {
        await page.click('[data-action="setMode"][data-arg="multi"]');
        await switchTab(page, 'layout');

        const header = page.locator('legend.collapsible-header').first();
        await expect(header).toHaveAttribute('aria-expanded', 'true');

        // Press Enter to collapse
        await header.focus();
        await page.keyboard.press('Enter');
        await expect(header).toHaveAttribute('aria-expanded', 'false');

        // Press Enter again to expand
        await page.keyboard.press('Enter');
        await expect(header).toHaveAttribute('aria-expanded', 'true');
    });

    test('Space key toggles collapsible section', async ({ page }) => {
        await page.click('[data-action="setMode"][data-arg="multi"]');
        await switchTab(page, 'layout');

        const header = page.locator('legend.collapsible-header').first();
        await expect(header).toHaveAttribute('aria-expanded', 'true');

        await header.focus();
        await page.keyboard.press('Space');
        await expect(header).toHaveAttribute('aria-expanded', 'false');

        await page.keyboard.press('Space');
        await expect(header).toHaveAttribute('aria-expanded', 'true');
    });

    test('aria-expanded updates correctly on toggle', async ({ page }) => {
        await page.click('[data-action="setMode"][data-arg="multi"]');
        await switchTab(page, 'layout');

        const header = page.locator('legend.collapsible-header').first();

        // Initially expanded
        await expect(header).toHaveAttribute('aria-expanded', 'true');

        // Click to collapse
        await header.click();
        await expect(header).toHaveAttribute('aria-expanded', 'false');

        // The content should have the collapsed class
        const controlsId = await header.getAttribute('aria-controls');
        const content = page.locator(`#${controlsId}`);
        await expect(content).toHaveClass(/collapsed/);
    });
});

test.describe('Fix 2: Dynamic validation errors ARIA association', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.setItem('welcomeDismissed', '1'));
        await page.reload();
        await page.waitForSelector('#xmlPreview', { timeout: 5000 });
    });

    test('validation error creates span with unique id and role="alert"', async ({ page }) => {
        // Go to Account tab and trigger a validation error on profileId
        await switchTab(page, 'account');

        // Set an invalid profile ID (not a GUID)
        await page.fill('#profileId', 'not-a-guid');
        // Blur to trigger validation
        await page.locator('#profileId').blur();

        const errorSpan = page.locator('.field-error');
        await expect(errorSpan).toBeVisible({ timeout: 1000 });

        // Should have a unique id
        const errorId = await errorSpan.getAttribute('id');
        expect(errorId).toBe('error-profileId');

        // Should have role="alert"
        await expect(errorSpan).toHaveAttribute('role', 'alert');
    });

    test('input gets aria-describedby pointing to error span', async ({ page }) => {
        await switchTab(page, 'account');

        await page.fill('#profileId', 'not-a-guid');
        await page.locator('#profileId').blur();

        const input = page.locator('#profileId');
        const describedBy = await input.getAttribute('aria-describedby');
        expect(describedBy).toBe('error-profileId');

        // The error span with that id should exist
        const errorSpan = page.locator(`#${describedBy}`);
        await expect(errorSpan).toBeAttached();
    });

    test('clearing the error removes aria-describedby from input', async ({ page }) => {
        await switchTab(page, 'account');

        // Trigger error
        await page.fill('#profileId', 'not-a-guid');
        await page.locator('#profileId').blur();
        await expect(page.locator('.field-error')).toBeVisible({ timeout: 1000 });

        // Fix the value with a valid GUID
        await page.fill('#profileId', '{12345678-1234-1234-1234-123456789abc}');
        await page.locator('#profileId').blur();

        // Error should be removed
        await expect(page.locator('.field-error')).toHaveCount(0, { timeout: 1000 });

        // aria-describedby should be removed
        const describedBy = await page.locator('#profileId').getAttribute('aria-describedby');
        expect(describedBy).toBeNull();
    });

    test('error id links correctly between input and error span', async ({ page }) => {
        await switchTab(page, 'account');

        await page.fill('#profileId', 'invalid');
        await page.locator('#profileId').blur();

        // Verify the link chain: input -> aria-describedby -> error span id
        const describedBy = await page.locator('#profileId').getAttribute('aria-describedby');
        const errorText = await page.locator(`#${describedBy}`).textContent();
        expect(errorText).toBeTruthy();
        expect(errorText.length).toBeGreaterThan(0);
    });

    test('input has invalid class when error is present', async ({ page }) => {
        await switchTab(page, 'account');

        await page.fill('#profileId', 'bad');
        await page.locator('#profileId').blur();

        await expect(page.locator('#profileId')).toHaveClass(/invalid/);
    });
});

test.describe('Fix 3: Common app filter uses classList instead of style.display', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.setItem('welcomeDismissed', '1'));
        await page.reload();
        await page.waitForSelector('#xmlPreview', { timeout: 5000 });
        // Switch to multi-app mode and apps tab
        await page.click('[data-action="setMode"][data-arg="multi"]');
        await switchTab(page, 'apps');
    });

    test('filtering hides non-matching buttons with hidden class', async ({ page }) => {
        // Type a filter that matches only "Edge"
        await page.fill('#commonAppSearch', 'Edge');

        // Edge button should be visible
        const edgeBtn = page.locator('[data-action="addCommonApp"][data-arg="edge"]');
        await expect(edgeBtn).not.toHaveClass(/hidden/);

        // Calculator button should be hidden
        const calcBtn = page.locator('[data-action="addCommonApp"][data-arg="calculator"]');
        await expect(calcBtn).toHaveClass(/hidden/);
    });

    test('clearing filter shows all buttons without hidden class', async ({ page }) => {
        // Filter then clear
        await page.fill('#commonAppSearch', 'Edge');
        await page.fill('#commonAppSearch', '');

        // All buttons should be visible
        const hiddenBtns = page.locator('[data-action="addCommonApp"].hidden');
        await expect(hiddenBtns).toHaveCount(0);
    });

    test('hidden buttons have display:none via CSS class', async ({ page }) => {
        await page.fill('#commonAppSearch', 'Edge');

        const calcBtn = page.locator('[data-action="addCommonApp"][data-arg="calculator"]');
        const display = await calcBtn.evaluate(el => getComputedStyle(el).display);
        expect(display).toBe('none');
    });

    test('category headers hide when all children are hidden', async ({ page }) => {
        // Filter to something that won't match productivity apps
        await page.fill('#commonAppSearch', 'Firefox');

        // Productivity category should be hidden
        const categories = page.locator('.common-app-category');
        const hiddenCategories = page.locator('.common-app-category.hidden');
        const hiddenCount = await hiddenCategories.count();
        const totalCount = await categories.count();

        // Most categories should be hidden since only Firefox matches
        expect(hiddenCount).toBeGreaterThan(0);
        expect(hiddenCount).toBeLessThan(totalCount); // At least Browsers category visible
    });

    test('no style.display show/hide patterns in apps.js (source scan)', async () => {
        const appsJs = fs.readFileSync(path.join(__dirname, '..', 'apps.js'), 'utf8');

        // Check for style.display = 'none' or style.display = '' patterns
        // (excluding comments)
        const lines = appsJs.split('\n');
        const violations = [];
        lines.forEach((line, idx) => {
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
            if (/\.style\.display\s*=\s*['"](?:none|)['"]/.test(line)) {
                violations.push(`apps.js:${idx + 1}: ${trimmed}`);
            }
        });

        expect(violations).toEqual([]);
    });
});
