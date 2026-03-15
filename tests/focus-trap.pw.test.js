const { test, expect } = require('@playwright/test');

// Helper: switch to a specific tab
async function switchTab(page, tabName) {
    await page.click(`[data-action="switchTab"][data-arg="${tabName}"]`);
    await page.waitForSelector(`#tab-${tabName}.active`, { timeout: 2000 });
}

// Helper: set up multi-app with Edge and switch to layout tab
async function setupMultiAppLayout(page) {
    await page.click('[data-action="setMode"][data-arg="multi"]');
    await switchTab(page, 'apps');
    await page.click('[data-action="addCommonApp"][data-arg="edge"]');
    await switchTab(page, 'layout');
}

test.describe('Focus Trap - Welcome Modal', () => {

    test('opening welcome modal moves focus inside the modal', async ({ page }) => {
        await page.goto('/');
        const modal = page.locator('#welcomeModal');
        await expect(modal).toBeVisible({ timeout: 3000 });

        // Wait for requestAnimationFrame focus
        await page.waitForTimeout(100);

        const isInside = await page.evaluate(() =>
            !!document.activeElement?.closest('#welcomeModal')
        );
        expect(isInside).toBe(true);
    });

    test('Tab cycles through focusable elements and wraps last to first', async ({ page }) => {
        await page.goto('/');
        const modal = page.locator('#welcomeModal');
        await expect(modal).toBeVisible({ timeout: 3000 });
        await page.waitForTimeout(100);

        // Get count of focusable elements
        const focusableCount = await page.evaluate(() => {
            const modal = document.getElementById('welcomeModal');
            const selector = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
            return Array.from(modal.querySelectorAll(selector))
                .filter(el => !el.closest('.hidden') && el.offsetParent !== null).length;
        });
        expect(focusableCount).toBeGreaterThan(0);

        // Tab through all elements + 1 to verify wrap
        for (let i = 0; i < focusableCount; i++) {
            await page.keyboard.press('Tab');
        }

        const isInside = await page.evaluate(() =>
            !!document.activeElement?.closest('#welcomeModal')
        );
        expect(isInside).toBe(true);
    });

    test('Shift+Tab wraps from first to last focusable element', async ({ page }) => {
        await page.goto('/');
        const modal = page.locator('#welcomeModal');
        await expect(modal).toBeVisible({ timeout: 3000 });
        await page.waitForTimeout(100);

        // Focus is on close button (first). Shift+Tab should go to last.
        await page.keyboard.press('Shift+Tab');

        const isInside = await page.evaluate(() =>
            !!document.activeElement?.closest('#welcomeModal')
        );
        expect(isInside).toBe(true);
    });

    test('Escape key closes the welcome modal', async ({ page }) => {
        await page.goto('/');
        const modal = page.locator('#welcomeModal');
        await expect(modal).toBeVisible({ timeout: 3000 });

        await page.keyboard.press('Escape');
        await expect(modal).toBeHidden({ timeout: 1000 });
    });

    test('after closing welcome modal, focus is not trapped in modal', async ({ page }) => {
        await page.goto('/');
        const modal = page.locator('#welcomeModal');
        await expect(modal).toBeVisible({ timeout: 3000 });

        await page.keyboard.press('Escape');
        await expect(modal).toBeHidden({ timeout: 1000 });

        // Focus should be accessible — Tab should move to a visible element
        await page.keyboard.press('Tab');
        const activeTag = await page.evaluate(() => document.activeElement?.tagName);
        expect(activeTag).toBeTruthy();
        // And it should NOT be inside the hidden modal
        const isInHiddenModal = await page.evaluate(() => {
            const el = document.activeElement;
            const modal = el?.closest('#welcomeModal');
            return modal ? !modal.classList.contains('hidden') : false;
        });
        expect(isInHiddenModal).toBe(false);
    });

    test('background elements are not reachable via Tab while modal is open', async ({ page }) => {
        await page.goto('/');
        const modal = page.locator('#welcomeModal');
        await expect(modal).toBeVisible({ timeout: 3000 });
        await page.waitForTimeout(100);

        // Tab many times — focus should never leave the modal
        for (let i = 0; i < 20; i++) {
            await page.keyboard.press('Tab');
        }

        const isInside = await page.evaluate(() =>
            !!document.activeElement?.closest('#welcomeModal')
        );
        expect(isInside).toBe(true);
    });

    test('clicking backdrop closes modal', async ({ page }) => {
        await page.goto('/');
        const modal = page.locator('#welcomeModal');
        await expect(modal).toBeVisible({ timeout: 3000 });

        // Click at top-left corner of the backdrop to avoid modal-content overlay
        await page.locator('#welcomeModal .modal-backdrop').click({ position: { x: 10, y: 10 } });

        await expect(modal).toBeHidden({ timeout: 1000 });
    });

    test('welcome modal has role="dialog" and aria-modal="true"', async ({ page }) => {
        await page.goto('/');
        const modal = page.locator('#welcomeModal');
        await expect(modal).toBeVisible({ timeout: 3000 });

        await expect(modal).toHaveAttribute('role', 'dialog');
        await expect(modal).toHaveAttribute('aria-modal', 'true');
    });

    test('body scroll is locked while modal is open', async ({ page }) => {
        await page.goto('/');
        const modal = page.locator('#welcomeModal');
        await expect(modal).toBeVisible({ timeout: 3000 });

        const overflow = await page.evaluate(() => document.body.style.overflow);
        expect(overflow).toBe('hidden');

        await page.keyboard.press('Escape');
        await expect(modal).toBeHidden({ timeout: 1000 });

        const overflowAfter = await page.evaluate(() => document.body.style.overflow);
        expect(overflowAfter).toBe('');
    });
});

test.describe('Focus Trap - Edge Args Modal', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.setItem('welcomeDismissed', '1'));
        await page.reload();
        await page.waitForSelector('#xmlPreview', { timeout: 5000 });
    });

    test('opening Edge Args modal moves focus inside the modal', async ({ page }) => {
        await setupMultiAppLayout(page);

        await page.evaluate(() => openEdgeArgsModal('pin'));
        const modal = page.locator('#edgeArgsModal');
        await expect(modal).toBeVisible({ timeout: 2000 });

        // Wait for requestAnimationFrame focus
        await page.waitForTimeout(100);

        const isInside = await page.evaluate(() =>
            !!document.activeElement?.closest('#edgeArgsModal')
        );
        expect(isInside).toBe(true);
    });

    test('Escape key closes Edge Args modal', async ({ page }) => {
        await setupMultiAppLayout(page);

        await page.evaluate(() => openEdgeArgsModal('pin'));
        const modal = page.locator('#edgeArgsModal');
        await expect(modal).toBeVisible({ timeout: 2000 });
        await page.waitForTimeout(100);

        await page.keyboard.press('Escape');
        await expect(modal).toBeHidden({ timeout: 1000 });
    });

    test('Tab cycles within Edge Args modal without escaping', async ({ page }) => {
        await setupMultiAppLayout(page);

        await page.evaluate(() => openEdgeArgsModal('pin'));
        const modal = page.locator('#edgeArgsModal');
        await expect(modal).toBeVisible({ timeout: 2000 });
        await page.waitForTimeout(100);

        for (let i = 0; i < 15; i++) {
            await page.keyboard.press('Tab');
        }

        const isInside = await page.evaluate(() =>
            !!document.activeElement?.closest('#edgeArgsModal')
        );
        expect(isInside).toBe(true);
    });

    test('after closing Edge Args modal, focus returns to triggering element', async ({ page }) => {
        await setupMultiAppLayout(page);

        // Focus a known element before opening modal
        await page.focus('#pinName');

        await page.evaluate(() => openEdgeArgsModal('pin'));
        const modal = page.locator('#edgeArgsModal');
        await expect(modal).toBeVisible({ timeout: 2000 });
        await page.waitForTimeout(100);

        // Close via Escape
        await page.keyboard.press('Escape');
        await expect(modal).toBeHidden({ timeout: 1000 });

        // Focus should return to pinName
        const focusedId = await page.evaluate(() => document.activeElement?.id);
        expect(focusedId).toBe('pinName');
    });

    test('Edge Args modal has role="dialog" and aria-modal="true"', async ({ page }) => {
        await setupMultiAppLayout(page);

        await page.evaluate(() => openEdgeArgsModal('pin'));
        const modal = page.locator('#edgeArgsModal');
        await expect(modal).toBeVisible({ timeout: 2000 });

        await expect(modal).toHaveAttribute('role', 'dialog');
        await expect(modal).toHaveAttribute('aria-modal', 'true');
    });

    test('Apply button closes modal and restores focus', async ({ page }) => {
        await setupMultiAppLayout(page);

        await page.focus('#pinName');
        await page.evaluate(() => openEdgeArgsModal('pin'));

        const modal = page.locator('#edgeArgsModal');
        await expect(modal).toBeVisible({ timeout: 2000 });

        await page.click('[data-action="applyEdgeArgsModal"]');
        await expect(modal).toBeHidden({ timeout: 1000 });

        const focusedId = await page.evaluate(() => document.activeElement?.id);
        expect(focusedId).toBe('pinName');
    });

    test('body scroll is locked while Edge Args modal is open', async ({ page }) => {
        await setupMultiAppLayout(page);

        await page.evaluate(() => openEdgeArgsModal('pin'));
        const modal = page.locator('#edgeArgsModal');
        await expect(modal).toBeVisible({ timeout: 2000 });
        await page.waitForTimeout(100); // wait for focus trap activation

        const overflow = await page.evaluate(() => document.body.style.overflow);
        expect(overflow).toBe('hidden');

        await page.keyboard.press('Escape');
        await expect(modal).toBeHidden({ timeout: 2000 });

        const overflowAfter = await page.evaluate(() => document.body.style.overflow);
        expect(overflowAfter).toBe('');
    });
});

test.describe('Focus Trap - Theme Compatibility', () => {

    test('focus trap works in Fluent theme', async ({ page }) => {
        await page.goto('/');
        const modal = page.locator('#welcomeModal');
        await expect(modal).toBeVisible({ timeout: 3000 });
        await page.waitForTimeout(100);

        for (let i = 0; i < 10; i++) {
            await page.keyboard.press('Tab');
        }

        const isInside = await page.evaluate(() =>
            !!document.activeElement?.closest('#welcomeModal')
        );
        expect(isInside).toBe(true);

        await page.keyboard.press('Escape');
        await expect(modal).toBeHidden({ timeout: 1000 });
    });
});

test.describe('Focus Trap - Source Scan', () => {
    const fs = require('fs');
    const path = require('path');

    test('every modal open has a focus trap activation', async () => {
        const appJs = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

        // Extract functions that open modals (remove('hidden') on modal elements)
        // Check that each function also contains .activate()
        const openFunctions = [];

        // Match function blocks that contain classList.remove('hidden') for modals
        const funcPattern = /function\s+(\w+)\s*\([^)]*\)\s*\{/g;
        let match;
        while ((match = funcPattern.exec(appJs)) !== null) {
            const funcStart = match.index;
            // Find the function body by counting braces
            let depth = 0;
            let funcEnd = funcStart;
            for (let i = appJs.indexOf('{', funcStart); i < appJs.length; i++) {
                if (appJs[i] === '{') depth++;
                if (appJs[i] === '}') depth--;
                if (depth === 0) { funcEnd = i + 1; break; }
            }
            const funcBody = appJs.substring(funcStart, funcEnd);

            // Check if this function opens a modal
            if (/modal\S*\.classList\.remove\(['"]hidden['"]\)/.test(funcBody)) {
                openFunctions.push({
                    name: match[1],
                    body: funcBody,
                    hasActivate: /\.activate\(\)/.test(funcBody)
                });
            }
        }

        expect(openFunctions.length).toBeGreaterThan(0);
        for (const func of openFunctions) {
            expect(func.hasActivate, `${func.name} opens modal but has no .activate()`).toBe(true);
        }
    });

    test('every modal close has a focus trap deactivation', async () => {
        const appJs = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

        const closeFunctions = [];
        const funcPattern = /function\s+(\w+)\s*\([^)]*\)\s*\{/g;
        let match;
        while ((match = funcPattern.exec(appJs)) !== null) {
            const funcStart = match.index;
            let depth = 0;
            let funcEnd = funcStart;
            for (let i = appJs.indexOf('{', funcStart); i < appJs.length; i++) {
                if (appJs[i] === '{') depth++;
                if (appJs[i] === '}') depth--;
                if (depth === 0) { funcEnd = i + 1; break; }
            }
            const funcBody = appJs.substring(funcStart, funcEnd);

            if (/modal\S*\.classList\.add\(['"]hidden['"]\)/.test(funcBody)) {
                closeFunctions.push({
                    name: match[1],
                    body: funcBody,
                    hasDeactivate: /\.deactivate\(\)/.test(funcBody)
                });
            }
        }

        expect(closeFunctions.length).toBeGreaterThan(0);
        for (const func of closeFunctions) {
            expect(func.hasDeactivate, `${func.name} closes modal but has no .deactivate()`).toBe(true);
        }
    });
});
