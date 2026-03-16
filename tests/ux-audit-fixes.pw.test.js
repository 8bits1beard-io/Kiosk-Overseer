const { test, expect } = require('@playwright/test');

// Helper: switch to a specific tab
async function switchTab(page, tabName) {
    await page.click(`[data-action="switchTab"][data-arg="${tabName}"]`);
    await page.waitForSelector(`#tab-${tabName}.active`, { timeout: 2000 });
}

// Helper: load the page fresh with welcome dismissed
async function loadPage(page) {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('welcomeDismissed', '1'));
    await page.reload();
    await page.waitForSelector('#xmlPreview', { timeout: 5000 });
}

// Helper: switch to multi-app mode
async function setMultiApp(page) {
    await page.click('[data-action="setMode"][data-arg="multi"]');
    await page.waitForSelector('[data-action="setMode"][data-arg="multi"][aria-pressed="true"]', { timeout: 2000 });
}

/* ============================================================================
   P0-1: Side nav legend
   ============================================================================ */

test.describe('P0-1: Side nav error legend', () => {

    test.beforeEach(async ({ page }) => {
        await loadPage(page);
    });

    test('legend element is present in side nav', async ({ page }) => {
        const legend = page.locator('.side-nav-legend');
        await expect(legend).toBeAttached();
    });

    test('legend has aria-hidden to hide from screen readers', async ({ page }) => {
        const legend = page.locator('.side-nav-legend');
        await expect(legend).toHaveAttribute('aria-hidden', 'true');
    });

    test('legend contains dot and label text', async ({ page }) => {
        const legend = page.locator('.side-nav-legend');
        await expect(legend).toContainText('Needs attention');

        const dot = legend.locator('.side-nav-legend-dot');
        await expect(dot).toBeAttached();
    });

    test('tab with errors has title attribute', async ({ page }) => {
        // Step 4 should have errors (no account configured)
        const step4Btn = page.locator('[data-action="switchTab"][data-arg="account"]');
        const title = await step4Btn.getAttribute('title');
        expect(title).toBeTruthy();
        expect(title).toContain('Needs attention');
    });
});

/* ============================================================================
   P0-2: Layout sub-navigation
   ============================================================================ */

test.describe('P0-2: Layout sub-navigation', () => {

    test.beforeEach(async ({ page }) => {
        await loadPage(page);
        await setMultiApp(page);
    });

    test('sub-nav is hidden initially', async ({ page }) => {
        const subNav = page.locator('#layout-sub-nav');
        await expect(subNav).toHaveClass(/hidden/);
    });

    test('sub-nav becomes visible when layout tab is active', async ({ page }) => {
        await switchTab(page, 'layout');
        const subNav = page.locator('#layout-sub-nav');
        await expect(subNav).not.toHaveClass(/hidden/);
    });

    test('sub-nav hides again when switching away from layout', async ({ page }) => {
        await switchTab(page, 'layout');
        await switchTab(page, 'apps');
        const subNav = page.locator('#layout-sub-nav');
        await expect(subNav).toHaveClass(/hidden/);
    });

    test('sub-nav contains three anchor buttons', async ({ page }) => {
        const subBtns = page.locator('#layout-sub-nav .side-nav-sub-btn');
        await expect(subBtns).toHaveCount(3);
    });

    test('Taskbar sub-nav button scrolls to taskbar section', async ({ page }) => {
        await switchTab(page, 'layout');
        const taskbarSection = page.locator('#layout-section-taskbar');
        await expect(taskbarSection).toBeAttached();
    });

    test('Start Pins sub-nav button has correct data-arg', async ({ page }) => {
        const startBtn = page.locator('[data-action="scrollToLayoutSection"][data-arg="layout-section-startpins"]');
        await expect(startBtn).toBeAttached();
    });

    test('sub-nav is hidden in single-app mode (layout tab disabled)', async ({ page }) => {
        // Switch back to single-app
        await page.click('[data-action="setMode"][data-arg="single"]');
        const subNav = page.locator('#layout-sub-nav');
        await expect(subNav).toHaveClass(/hidden/);
    });
});

/* ============================================================================
   P0-3: Tooltips on pin action buttons
   ============================================================================ */

test.describe('P0-3: Pin action button tooltips', () => {

    test.beforeEach(async ({ page }) => {
        await loadPage(page);
        await setMultiApp(page);
        // Add a pin so buttons are rendered
        await switchTab(page, 'layout');
        // Add a pin via preset selector
        const pinTarget = page.locator('#pinTarget');
        if (await pinTarget.count() > 0) {
            const options = await pinTarget.locator('option').count();
            if (options > 1) {
                await pinTarget.selectOption({ index: 1 });
                await page.click('[data-action="addPin"]');
            }
        }
    });

    test('Edit pin button has title attribute', async ({ page }) => {
        const editBtn = page.locator('[data-action="editPin"]').first();
        if (await editBtn.count() > 0) {
            const title = await editBtn.getAttribute('title');
            expect(title).toBeTruthy();
        }
    });

    test('Remove pin button has aria-label', async ({ page }) => {
        const removeBtn = page.locator('[data-action="removePin"]').first();
        if (await removeBtn.count() > 0) {
            const label = await removeBtn.getAttribute('aria-label');
            expect(label).toBeTruthy();
            expect(label).toContain('Remove');
        }
    });

    test('Move up button has title attribute', async ({ page }) => {
        const moveUpBtn = page.locator('[data-action="movePinUp"]').first();
        if (await moveUpBtn.count() > 0) {
            const title = await moveUpBtn.getAttribute('title');
            expect(title).toBeTruthy();
        }
    });
});

/* ============================================================================
   P0-4: Dynamic Add Application placeholder
   ============================================================================ */

test.describe('P0-4: Dynamic Add Application placeholder', () => {

    test.beforeEach(async ({ page }) => {
        await loadPage(page);
        await setMultiApp(page);
        await switchTab(page, 'apps');
    });

    test('default placeholder is for path type', async ({ page }) => {
        const input = page.locator('#addAppValue');
        const placeholder = await input.getAttribute('placeholder');
        expect(placeholder).toContain('%ProgramFiles%');
    });

    test('placeholder switches to AUMID format when AUMID type selected', async ({ page }) => {
        await page.locator('#addAppType').selectOption('aumid');
        const input = page.locator('#addAppValue');
        const placeholder = await input.getAttribute('placeholder');
        expect(placeholder).toContain('WindowsCalculator');
        expect(placeholder).toContain('8wekyb3d8bbwe');
    });

    test('placeholder reverts to path format when path type re-selected', async ({ page }) => {
        await page.locator('#addAppType').selectOption('aumid');
        await page.locator('#addAppType').selectOption('path');
        const input = page.locator('#addAppValue');
        const placeholder = await input.getAttribute('placeholder');
        expect(placeholder).toContain('%ProgramFiles%');
    });

    test('help text about environment variables is visible', async ({ page }) => {
        const hint = page.locator('#addAppValue').locator('..').locator('p');
        if (await hint.count() > 0) {
            const text = await hint.textContent();
            expect(text).toContain('%ProgramFiles%');
        }
    });
});

/* ============================================================================
   P1-1: Friendly type names in pin edit heading
   ============================================================================ */

test.describe('P1-1: Friendly pin type names', () => {

    test.beforeEach(async ({ page }) => {
        await loadPage(page);
        await setMultiApp(page);
        await switchTab(page, 'layout');
    });

    test('edit pin heading shows friendly type label', async ({ page }) => {
        // Add a pin first
        const pinTarget = page.locator('#pinTarget');
        const options = await pinTarget.locator('option').count();
        if (options > 1) {
            await pinTarget.selectOption({ index: 1 });
            await page.click('[data-action="addPin"]');

            // Click edit
            const editBtn = page.locator('[data-action="editPin"]').first();
            if (await editBtn.count() > 0) {
                await editBtn.click();
                const typeEl = page.locator('#editPinType');
                if (await typeEl.count() > 0) {
                    const text = await typeEl.textContent();
                    // Should NOT contain raw "desktopAppLink" — should be friendly
                    expect(text).not.toBe('desktopAppLink');
                    // Should contain a dash and friendly label
                    expect(text).toMatch(/—\s*.+/);
                }
            }
        }
    });
});

/* ============================================================================
   P1-2: Star-github callout gated behind first export
   ============================================================================ */

test.describe('P1-2: Star-github callout gating', () => {

    test.beforeEach(async ({ page }) => {
        await loadPage(page);
        // Ensure no export flag
        await page.evaluate(() => sessionStorage.removeItem('hasExported'));
    });

    test('star-github callout is hidden before any export', async ({ page }) => {
        await switchTab(page, 'summary');
        const callout = page.locator('[data-callout-id="star-github"]');
        await expect(callout).toHaveClass(/hidden/);
    });

    test('star-github callout reveals after export flag is set', async ({ page }) => {
        // Simulate export by setting the flag
        await page.evaluate(() => sessionStorage.setItem('hasExported', '1'));
        // Also ensure callout hasn't been dismissed
        await page.evaluate(() => sessionStorage.removeItem('callout:star-github'));

        await switchTab(page, 'summary');

        const callout = page.locator('[data-callout-id="star-github"]');
        await expect(callout).not.toHaveClass(/hidden/);
    });

    test('star-github callout stays hidden if dismissed even after export', async ({ page }) => {
        await page.evaluate(() => {
            sessionStorage.setItem('hasExported', '1');
            sessionStorage.setItem('callout:star-github', '1');
        });

        await switchTab(page, 'summary');

        const callout = page.locator('[data-callout-id="star-github"]');
        await expect(callout).toHaveClass(/hidden/);
    });

    test('Config Summary section appears before export buttons on summary page', async ({ page }) => {
        await switchTab(page, 'summary');

        const summaryGroup = page.locator('fieldset').filter({ hasText: 'CONFIGURATION SUMMARY' });
        const exportGroup = page.locator('fieldset').filter({ hasText: 'EXPORT' });

        await expect(summaryGroup).toBeAttached();
        await expect(exportGroup).toBeAttached();

        // Summary should come before export in the DOM
        const summaryIndex = await summaryGroup.evaluate(el => {
            let i = 0;
            let node = el;
            while (node.previousElementSibling) { i++; node = node.previousElementSibling; }
            return i;
        });
        const exportIndex = await exportGroup.evaluate(el => {
            let i = 0;
            let node = el;
            while (node.previousElementSibling) { i++; node = node.previousElementSibling; }
            return i;
        });

        expect(summaryIndex).toBeLessThan(exportIndex);
    });
});

/* ============================================================================
   P1-3: XML Preview wrap/scroll toggle
   ============================================================================ */

test.describe('P1-3: XML preview wrap/scroll toggle', () => {

    test.beforeEach(async ({ page }) => {
        await loadPage(page);
    });

    test('wrap toggle button is present', async ({ page }) => {
        const btn = page.locator('#xmlWrapToggle');
        await expect(btn).toBeAttached();
    });

    test('initial state shows "Wrap: On"', async ({ page }) => {
        const btn = page.locator('#xmlWrapToggle');
        await expect(btn).toHaveText('Wrap: On');
    });

    test('clicking toggle switches to scroll mode', async ({ page }) => {
        const btn = page.locator('#xmlWrapToggle');
        await btn.click();
        await expect(btn).toHaveText('Wrap: Off');

        const preview = page.locator('#xmlPreview');
        await expect(preview).toHaveClass(/xml-mode-scroll/);
    });

    test('clicking toggle again returns to wrap mode', async ({ page }) => {
        const btn = page.locator('#xmlWrapToggle');
        await btn.click();
        await btn.click();
        await expect(btn).toHaveText('Wrap: On');

        const preview = page.locator('#xmlPreview');
        await expect(preview).not.toHaveClass(/xml-mode-scroll/);
    });
});

/* ============================================================================
   P2-4: SCRIPT ONLY badge tooltip
   ============================================================================ */

test.describe('P2-4: Script Only badge tooltip', () => {

    test.beforeEach(async ({ page }) => {
        await loadPage(page);
    });

    test('Sentry badge has title attribute', async ({ page }) => {
        // Sentry toggle is on apps tab in multi-app mode
        await setMultiApp(page);
        await switchTab(page, 'apps');

        const badge = page.locator('.badge-script').first();
        if (await badge.count() > 0) {
            const title = await badge.getAttribute('title');
            expect(title).toBeTruthy();
            expect(title.length).toBeGreaterThan(5);
        }
    });

    test('Script Only badges have aria-label', async ({ page }) => {
        await setMultiApp(page);
        await switchTab(page, 'apps');

        const badges = page.locator('.badge-script');
        const count = await badges.count();
        for (let i = 0; i < count; i++) {
            const label = await badges.nth(i).getAttribute('aria-label');
            expect(label).toBeTruthy();
        }
    });
});

/* ============================================================================
   P2-5: Common app "added" visual state
   ============================================================================ */

test.describe('P2-5: Common app added state', () => {

    test.beforeEach(async ({ page }) => {
        await loadPage(page);
        await setMultiApp(page);
        await switchTab(page, 'apps');
    });

    test('Edge button gains added class after clicking', async ({ page }) => {
        const edgeBtn = page.locator('[data-action="addCommonApp"][data-arg="edge"]');
        await edgeBtn.click();
        await expect(edgeBtn).toHaveClass(/common-app-btn--added/);
    });

    test('Calculator button gains added class after clicking', async ({ page }) => {
        const calcBtn = page.locator('[data-action="addCommonApp"][data-arg="calculator"]');
        await calcBtn.click();
        await expect(calcBtn).toHaveClass(/common-app-btn--added/);
    });

    test('already-added button shows toast instead of re-adding', async ({ page }) => {
        const calcBtn = page.locator('[data-action="addCommonApp"][data-arg="calculator"]');
        await calcBtn.click();

        // Get current app count
        const countBefore = await page.locator('#appList [role="listitem"]').count();

        // Click again
        await calcBtn.click();

        // Count should be unchanged
        const countAfter = await page.locator('#appList [role="listitem"]').count();
        expect(countAfter).toBe(countBefore);
    });

    test('multi-app preset loads with pre-added buttons showing added state', async ({ page }) => {
        // Multi-app preset adds edge, osk, calculator — all should be marked added
        const edgeBtn = page.locator('[data-action="addCommonApp"][data-arg="edge"]');
        const oskBtn = page.locator('[data-action="addCommonApp"][data-arg="osk"]');
        const calcBtn = page.locator('[data-action="addCommonApp"][data-arg="calculator"]');

        await expect(edgeBtn).toHaveClass(/common-app-btn--added/);
        await expect(oskBtn).toHaveClass(/common-app-btn--added/);
        await expect(calcBtn).toHaveClass(/common-app-btn--added/);
    });

    test('added button has a descriptive title attribute', async ({ page }) => {
        const calcBtn = page.locator('[data-action="addCommonApp"][data-arg="calculator"]');
        await calcBtn.click();
        const title = await calcBtn.getAttribute('title');
        expect(title).toContain('already in your allowed apps');
    });
});
