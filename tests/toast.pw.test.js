const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Helper: switch to a specific tab
async function switchTab(page, tabName) {
    await page.click(`[data-action="switchTab"][data-arg="${tabName}"]`);
    // Wait for tab content to be visible
    await page.waitForSelector(`#tab-${tabName}.active`, { timeout: 2000 });
}

// Helper: switch to multi-app mode and add calculator
async function setupMultiAppWithCalculator(page) {
    // Mode tab is active by default — switch to multi-app
    await page.click('[data-action="setMode"][data-arg="multi"]');
    // Switch to Apps tab where common apps buttons live
    await switchTab(page, 'apps');
    // Add calculator
    await page.click('[data-action="addCommonApp"][data-arg="calculator"]');
}

test.describe('Toast Notification System', () => {

    test.beforeEach(async ({ page }) => {
        // Pre-dismiss welcome modal via localStorage before page load
        await page.goto('/');
        await page.evaluate(() => localStorage.setItem('welcomeDismissed', '1'));
        await page.reload();
        // Wait for app to initialize
        await page.waitForSelector('#xmlPreview', { timeout: 5000 });
    });

    // ========================================================================
    // 1. Toast appears for validation errors (pins.js - addPin)
    // ========================================================================
    test('shows error toast when adding start pin without selecting an app', async ({ page }) => {
        await setupMultiAppWithCalculator(page);
        await switchTab(page, 'layout');

        // Try to add a start pin without selecting an app from the dropdown
        await page.click('[data-action="addPin"]');

        const toast = page.locator('.toast-error');
        await expect(toast).toBeVisible({ timeout: 2000 });
        await expect(toast.locator('.toast-message')).toHaveText('Please select an allowed app.');
    });

    // ========================================================================
    // 2. Toast appears for validation errors (config.js - invalid JSON)
    // ========================================================================
    test('shows error toast when loading invalid JSON config', async ({ page }) => {
        await page.evaluate(() => {
            const blob = new Blob(['not valid json'], { type: 'application/json' });
            const file = new File([blob], 'test.json', { type: 'application/json' });
            const input = document.getElementById('configImportInput');
            const dt = new DataTransfer();
            dt.items.add(file);
            input.files = dt.files;
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });

        const toast = page.locator('.toast-error');
        await expect(toast).toBeVisible({ timeout: 2000 });
        await expect(toast.locator('.toast-message')).toHaveText('This file is not valid JSON.');
    });

    // ========================================================================
    // 3. Toast appears for info messages (exports.js - shortcuts in single-app)
    // ========================================================================
    test('shows info toast when downloading shortcuts in single-app mode', async ({ page }) => {
        await switchTab(page, 'summary');
        await page.click('[data-action="downloadShortcutsScript"]');

        const toast = page.locator('.toast-info');
        await expect(toast).toBeVisible({ timeout: 2000 });
        await expect(toast.locator('.toast-message')).toContainText('Shortcut Creator is not needed');
    });

    // ========================================================================
    // 4. Toast appears for duplicate pin detection (pins.js)
    // ========================================================================
    test('shows toast when pinning already-pinned app to Start', async ({ page }) => {
        await setupMultiAppWithCalculator(page);
        await switchTab(page, 'layout');

        // Select calculator in pin dropdown and add
        await page.selectOption('#pinTargetPreset', { index: 1 });
        await page.click('[data-action="addPin"]');

        // Try to add the same pin again
        await page.selectOption('#pinTargetPreset', { index: 1 });
        await page.click('[data-action="addPin"]');

        const toast = page.locator('.toast').last();
        await expect(toast).toBeVisible({ timeout: 2000 });
        await expect(toast.locator('.toast-message')).toContainText('already exists');
    });

    // ========================================================================
    // 5. Toast has correct ARIA attributes
    // ========================================================================
    test('error toast has role="alert" for assertive announcement', async ({ page }) => {
        await setupMultiAppWithCalculator(page);
        await switchTab(page, 'layout');
        await page.click('[data-action="addPin"]');

        const toast = page.locator('.toast-error');
        await expect(toast).toBeVisible({ timeout: 2000 });
        await expect(toast).toHaveAttribute('role', 'alert');

        // Container should switch to assertive for errors
        const container = page.locator('#toastContainer');
        await expect(container).toHaveAttribute('aria-live', 'assertive');
    });

    test('info toast has role="status" for polite announcement', async ({ page }) => {
        await switchTab(page, 'summary');
        await page.click('[data-action="downloadShortcutsScript"]');

        const toast = page.locator('.toast-info');
        await expect(toast).toBeVisible({ timeout: 2000 });
        await expect(toast).toHaveAttribute('role', 'status');
    });

    // ========================================================================
    // 6. Toast auto-dismisses after expected duration
    // ========================================================================
    test('info toast auto-dismisses after ~4 seconds', async ({ page }) => {
        await switchTab(page, 'summary');
        await page.click('[data-action="downloadShortcutsScript"]');

        const toast = page.locator('.toast-info');
        await expect(toast).toBeVisible({ timeout: 2000 });

        // Should be gone by 5.5s (4s duration + 0.2s exit animation + margin)
        await expect(toast).toBeHidden({ timeout: 6000 });
    });

    // ========================================================================
    // 7. Toast close button works
    // ========================================================================
    test('toast close button dismisses immediately', async ({ page }) => {
        await setupMultiAppWithCalculator(page);
        await switchTab(page, 'layout');
        await page.click('[data-action="addPin"]');

        const toast = page.locator('.toast-error');
        await expect(toast).toBeVisible({ timeout: 2000 });

        // Click close button
        await toast.locator('.toast-close').click();

        // Toast should disappear (animation takes 0.2s)
        await expect(toast).toBeHidden({ timeout: 1000 });
    });

    test('toast close button has accessible label', async ({ page }) => {
        await setupMultiAppWithCalculator(page);
        await switchTab(page, 'layout');
        await page.click('[data-action="addPin"]');

        const closeBtn = page.locator('.toast-error .toast-close');
        await expect(closeBtn).toBeVisible({ timeout: 2000 });
        await expect(closeBtn).toHaveAttribute('aria-label', 'Dismiss notification');
    });

    // ========================================================================
    // 8. Multiple toasts stack without overlapping
    // ========================================================================
    test('multiple toasts stack vertically', async ({ page }) => {
        await setupMultiAppWithCalculator(page);
        await switchTab(page, 'layout');

        // Trigger multiple toasts quickly
        await page.click('[data-action="addPin"]'); // error: no app selected
        await page.click('[data-action="addEdgeSecondaryTile"]'); // error: name/url required

        const toasts = page.locator('.toast');
        await expect(toasts).toHaveCount(2, { timeout: 2000 });

        // Verify they don't overlap: second toast should be below the first
        const boxes = await toasts.evaluateAll(els =>
            els.map(el => el.getBoundingClientRect())
        );
        if (boxes.length >= 2) {
            expect(boxes[1].top).toBeGreaterThanOrEqual(boxes[0].bottom - 1);
        }
    });

    // ========================================================================
    // 9. Toast works with Fluent theme
    // ========================================================================
    test('toast renders correctly in Fluent theme', async ({ page }) => {
        // Switch to Fluent theme
        await page.click('[data-action="toggleTheme"]');

        // Trigger a toast
        await setupMultiAppWithCalculator(page);
        await switchTab(page, 'layout');
        await page.click('[data-action="addPin"]');

        const toast = page.locator('.toast-error');
        await expect(toast).toBeVisible({ timeout: 2000 });

        // Verify it uses theme CSS variables (border should be visible)
        const borderColor = await toast.evaluate(el =>
            getComputedStyle(el).borderColor
        );
        expect(borderColor).toBeTruthy();
    });

    // ========================================================================
    // 10. Success toast works (config load)
    // ========================================================================
    test('shows success toast when loading valid config', async ({ page }) => {
        await page.evaluate(() => {
            const config = {
                schemaVersion: 1,
                name: 'Test',
                savedAt: new Date().toISOString(),
                payload: {
                    state: {
                        mode: 'single',
                        accountType: 'auto',
                        allowedApps: [],
                        startPins: [],
                        taskbarPins: [],
                        autoLaunchApp: null
                    },
                    formValues: {}
                }
            };
            const blob = new Blob([JSON.stringify(config)], { type: 'application/json' });
            const file = new File([blob], 'test.kioskoverseer.json', { type: 'application/json' });
            const input = document.getElementById('configImportInput');
            const dt = new DataTransfer();
            dt.items.add(file);
            input.files = dt.files;
            window.confirm = () => true;
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });

        const toast = page.locator('.toast-success');
        await expect(toast).toBeVisible({ timeout: 3000 });
        await expect(toast.locator('.toast-message')).toHaveText('Configuration loaded.');
    });

    // ========================================================================
    // 11. No remaining alert() calls in source files
    // ========================================================================
    test('no alert() calls remain in any JS source file', async () => {
        const jsDir = path.join(__dirname, '..');
        const jsFiles = ['app.js', 'apps.js', 'pins.js', 'config.js', 'exports.js',
                         'helpers.js', 'dom.js', 'state.js', 'validation.js'];

        const violations = [];

        for (const file of jsFiles) {
            const filePath = path.join(jsDir, file);
            if (!fs.existsSync(filePath)) continue;
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
                const trimmed = line.trim();
                // Skip comments
                if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
                if (/\balert\s*\(/.test(line)) {
                    violations.push(`${file}:${idx + 1}: ${trimmed}`);
                }
            });
        }

        expect(violations).toEqual([]);
    });

    // ========================================================================
    // 12. Toast container exists in DOM
    // ========================================================================
    test('toast container exists with correct ARIA attributes', async ({ page }) => {
        const container = page.locator('#toastContainer');
        await expect(container).toBeAttached();
        await expect(container).toHaveAttribute('aria-live', 'polite');
        await expect(container).toHaveAttribute('aria-relevant', 'additions');
        await expect(container).toHaveClass(/toast-container/);
    });

    // ========================================================================
    // 13. Toast progress bar exists for auto-dismiss
    // ========================================================================
    test('toast has progress bar for auto-dismiss timer', async ({ page }) => {
        await switchTab(page, 'summary');
        await page.click('[data-action="downloadShortcutsScript"]');

        const toast = page.locator('.toast-info');
        await expect(toast).toBeVisible({ timeout: 2000 });

        const progress = toast.locator('.toast-progress');
        await expect(progress).toBeAttached();
    });
});
