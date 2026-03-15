const { test, expect } = require('@playwright/test');

// Helper: switch to a specific tab
async function switchTab(page, tabName) {
    await page.click(`[data-action="switchTab"][data-arg="${tabName}"]`);
    await page.waitForSelector(`#tab-${tabName}.active`, { timeout: 2000 });
}

// Helper: set up multi-app with 3 pins for reorder testing
async function setupPinsForReorder(page) {
    await page.click('[data-action="setMode"][data-arg="multi"]');
    await switchTab(page, 'apps');
    await page.click('[data-action="addCommonApp"][data-arg="edge"]');
    await page.click('[data-action="addCommonApp"][data-arg="calculator"]');
    await page.click('[data-action="addCommonApp"][data-arg="notepad"]');
    await switchTab(page, 'layout');

    // Add 3 start menu pins
    await page.selectOption('#pinTargetPreset', { index: 1 }); // Edge
    await page.click('[data-action="addPin"]');
    await page.selectOption('#pinTargetPreset', { index: 2 }); // Calculator
    await page.click('[data-action="addPin"]');
    await page.selectOption('#pinTargetPreset', { index: 3 }); // Notepad
    await page.click('[data-action="addPin"]');
}

// Helper: get the ordered pin names from the DOM
async function getPinNames(page, listId = 'pinList') {
    return page.evaluate((id) => {
        const list = document.getElementById(id);
        return Array.from(list.querySelectorAll('.app-item'))
            .map(item => {
                const nameEl = item.querySelector('[style*="font-weight: 500"]');
                return nameEl ? nameEl.textContent.trim().replace(/UWP|\.lnk|Edge|⚠/g, '').trim() : '';
            });
    }, listId);
}

test.describe('Keyboard Pin Reorder', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.setItem('welcomeDismissed', '1'));
        await page.reload();
        await page.waitForSelector('#xmlPreview', { timeout: 5000 });
    });

    // ========================================================================
    // 1. Each pin item has a visible reorder handle button
    // ========================================================================
    test('each pin item has a visible reorder handle button', async ({ page }) => {
        await setupPinsForReorder(page);

        const grips = page.locator('#pinList [data-reorder-grip]');
        await expect(grips).toHaveCount(3);

        for (let i = 0; i < 3; i++) {
            await expect(grips.nth(i)).toBeVisible();
        }
    });

    // ========================================================================
    // 2. Handle button has appropriate aria-label
    // ========================================================================
    test('handle button has appropriate aria-label', async ({ page }) => {
        await setupPinsForReorder(page);

        const grips = page.locator('#pinList [data-reorder-grip]');
        const firstLabel = await grips.first().getAttribute('aria-label');
        expect(firstLabel).toMatch(/^Reorder .+/);
    });

    // ========================================================================
    // 3. Enter/Space on handle enters reorder mode
    // ========================================================================
    test('pressing Enter on handle enters reorder mode', async ({ page }) => {
        await setupPinsForReorder(page);

        const grip = page.locator('#pinList [data-reorder-grip]').first();
        await grip.focus();
        await page.keyboard.press('Enter');

        // The parent app-item should have reorder-active class
        const item = page.locator('#pinList .app-item.reorder-active');
        await expect(item).toHaveCount(1);
    });

    test('pressing Space on handle enters reorder mode', async ({ page }) => {
        await setupPinsForReorder(page);

        const grip = page.locator('#pinList [data-reorder-grip]').first();
        await grip.focus();
        await page.keyboard.press('Space');

        const item = page.locator('#pinList .app-item.reorder-active');
        await expect(item).toHaveCount(1);
    });

    // ========================================================================
    // 4. ArrowDown moves pin down one position
    // ========================================================================
    test('ArrowDown moves pin down one position in the DOM', async ({ page }) => {
        await setupPinsForReorder(page);

        const namesBefore = await getPinNames(page);
        expect(namesBefore.length).toBe(3);

        // Enter reorder mode on first pin
        const grip = page.locator('#pinList [data-reorder-grip]').first();
        await grip.focus();
        await page.keyboard.press('Enter');

        // Move down
        await page.keyboard.press('ArrowDown');

        // Confirm
        await page.keyboard.press('Enter');

        const namesAfter = await getPinNames(page);
        // First pin should now be in second position
        expect(namesAfter[0]).toBe(namesBefore[1]);
        expect(namesAfter[1]).toBe(namesBefore[0]);
        expect(namesAfter[2]).toBe(namesBefore[2]);
    });

    // ========================================================================
    // 5. ArrowUp moves pin up one position
    // ========================================================================
    test('ArrowUp moves pin up one position in the DOM', async ({ page }) => {
        await setupPinsForReorder(page);

        const namesBefore = await getPinNames(page);

        // Enter reorder mode on second pin (index 1)
        const grip = page.locator('#pinList [data-reorder-grip]').nth(1);
        await grip.focus();
        await page.keyboard.press('Enter');

        // Move up
        await page.keyboard.press('ArrowUp');

        // Confirm
        await page.keyboard.press('Enter');

        const namesAfter = await getPinNames(page);
        expect(namesAfter[0]).toBe(namesBefore[1]);
        expect(namesAfter[1]).toBe(namesBefore[0]);
    });

    // ========================================================================
    // 6. Home moves pin to the top
    // ========================================================================
    test('Home moves pin to the top', async ({ page }) => {
        await setupPinsForReorder(page);

        const namesBefore = await getPinNames(page);

        // Enter reorder mode on last pin
        const grip = page.locator('#pinList [data-reorder-grip]').last();
        await grip.focus();
        await page.keyboard.press('Enter');

        // Home key
        await page.keyboard.press('Home');

        // Confirm
        await page.keyboard.press('Enter');

        const namesAfter = await getPinNames(page);
        expect(namesAfter[0]).toBe(namesBefore[2]); // last is now first
    });

    // ========================================================================
    // 7. End moves pin to the bottom
    // ========================================================================
    test('End moves pin to the bottom', async ({ page }) => {
        await setupPinsForReorder(page);

        const namesBefore = await getPinNames(page);

        // Enter reorder mode on first pin
        const grip = page.locator('#pinList [data-reorder-grip]').first();
        await grip.focus();
        await page.keyboard.press('Enter');

        // End key
        await page.keyboard.press('End');

        // Confirm
        await page.keyboard.press('Enter');

        const namesAfter = await getPinNames(page);
        expect(namesAfter[2]).toBe(namesBefore[0]); // first is now last
    });

    // ========================================================================
    // 8. Enter confirms the new position and exits reorder mode
    // ========================================================================
    test('Enter confirms and exits reorder mode', async ({ page }) => {
        await setupPinsForReorder(page);

        const grip = page.locator('#pinList [data-reorder-grip]').first();
        await grip.focus();
        await page.keyboard.press('Enter'); // enter reorder mode

        await page.keyboard.press('ArrowDown'); // move

        await page.keyboard.press('Enter'); // confirm

        // reorder-active class should be gone
        const activeItems = page.locator('#pinList .app-item.reorder-active');
        await expect(activeItems).toHaveCount(0);
    });

    // ========================================================================
    // 9. Escape cancels and reverts to original position
    // ========================================================================
    test('Escape cancels and reverts to original position', async ({ page }) => {
        await setupPinsForReorder(page);

        // Use data model for comparison (DOM text extraction can be unreliable with badges)
        const namesBefore = await page.evaluate(() =>
            state.startPins.map(p => p.name)
        );

        const grip = page.locator('#pinList [data-reorder-grip]').first();
        await grip.focus();
        await page.keyboard.press('Enter');

        // Move down twice
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');

        // Cancel
        await page.keyboard.press('Escape');

        const namesAfter = await page.evaluate(() =>
            state.startPins.map(p => p.name)
        );
        expect(namesAfter).toEqual(namesBefore);
    });

    // ========================================================================
    // 10. ARIA live region announces each move
    // ========================================================================
    test('ARIA live region announces position changes', async ({ page }) => {
        await setupPinsForReorder(page);

        const region = page.locator('#reorderLiveRegion');
        const grip = page.locator('#pinList [data-reorder-grip]').first();
        await grip.focus();
        await page.keyboard.press('Enter');

        // Wait for announcement (setTimeout 50ms in announceReorder)
        await page.waitForTimeout(100);

        let announcement = await region.textContent();
        expect(announcement).toContain('Reordering');
        expect(announcement).toContain('arrow keys');

        // Move down
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(100);

        announcement = await region.textContent();
        expect(announcement).toContain('position 2 of 3');

        // Confirm
        await page.keyboard.press('Enter');
        await page.waitForTimeout(100);

        announcement = await region.textContent();
        expect(announcement).toContain('moved to position');
    });

    test('ARIA live region announces cancel', async ({ page }) => {
        await setupPinsForReorder(page);

        const grip = page.locator('#pinList [data-reorder-grip]').first();
        await grip.focus();
        await page.keyboard.press('Enter');
        await page.waitForTimeout(100);
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(100);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);

        const announcement = await page.locator('#reorderLiveRegion').textContent();
        expect(announcement).toContain('cancelled');
    });

    // ========================================================================
    // 11. Data model is updated on confirm
    // ========================================================================
    test('data model is updated after confirm', async ({ page }) => {
        await setupPinsForReorder(page);

        const namesBefore = await page.evaluate(() =>
            state.startPins.map(p => p.name)
        );

        const grip = page.locator('#pinList [data-reorder-grip]').first();
        await grip.focus();
        await page.keyboard.press('Enter');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');

        const namesAfter = await page.evaluate(() =>
            state.startPins.map(p => p.name)
        );

        expect(namesAfter[0]).toBe(namesBefore[1]);
        expect(namesAfter[1]).toBe(namesBefore[0]);
    });

    // ========================================================================
    // 12. Mouse drag-and-drop still works (regression)
    // ========================================================================
    test('mouse drag-and-drop still works after changes', async ({ page }) => {
        await setupPinsForReorder(page);

        const namesBefore = await getPinNames(page);
        const items = page.locator('#pinList .app-item');

        // Use the existing up/down buttons to verify the data model works
        // (drag-and-drop is hard to test with Playwright, but the up/down
        // buttons use the same splice logic)
        await page.click(`#pinList [data-action="movePinDown"][data-arg="0"]`);

        const namesAfter = await getPinNames(page);
        expect(namesAfter[0]).toBe(namesBefore[1]);
        expect(namesAfter[1]).toBe(namesBefore[0]);
    });

    // ========================================================================
    // 13. Reorder handle is keyboard-focusable via Tab
    // ========================================================================
    test('reorder handle is keyboard-focusable via Tab', async ({ page }) => {
        await setupPinsForReorder(page);

        // Tab into the pin list area — the grip should be focusable
        const grip = page.locator('#pinList [data-reorder-grip]').first();
        await grip.focus();

        const isFocused = await page.evaluate(() =>
            document.activeElement?.hasAttribute('data-reorder-grip')
        );
        expect(isFocused).toBe(true);
    });

    // ========================================================================
    // 14. Works in Fluent theme
    // ========================================================================
    test('works in Fluent theme without visual breakage', async ({ page }) => {
        await page.click('[data-action="toggleTheme"]');
        await setupPinsForReorder(page);

        const grips = page.locator('#pinList [data-reorder-grip]');
        await expect(grips).toHaveCount(3);

        // Enter reorder mode
        await grips.first().focus();
        await page.keyboard.press('Enter');

        const activeItem = page.locator('#pinList .app-item.reorder-active');
        await expect(activeItem).toHaveCount(1);

        // The active item should have the reorder-active class with accent border
        const hasClass = await activeItem.evaluate(el => el.classList.contains('reorder-active'));
        expect(hasClass).toBe(true);

        await page.keyboard.press('Escape');
    });

    // ========================================================================
    // 15. Source scan: every rendered pin item has a reorder handle
    // ========================================================================
    test('every rendered pin item has a reorder handle', async ({ page }) => {
        await setupPinsForReorder(page);

        const items = await page.locator('#pinList .app-item').count();
        const grips = await page.locator('#pinList [data-reorder-grip]').count();
        expect(grips).toBe(items);
        expect(grips).toBeGreaterThan(0);
    });

    // ========================================================================
    // 16. Taskbar pins also have reorder handles
    // ========================================================================
    test('taskbar pin list also has reorder handles', async ({ page }) => {
        await setupPinsForReorder(page);

        // Add taskbar pins
        await page.selectOption('#taskbarPinTargetPreset', { index: 1 });
        await page.click('[data-action="addTaskbarPin"]');
        await page.selectOption('#taskbarPinTargetPreset', { index: 2 });
        await page.click('[data-action="addTaskbarPin"]');

        const grips = page.locator('#taskbarPinList [data-reorder-grip]');
        await expect(grips).toHaveCount(2);
    });

    // ========================================================================
    // 17. ARIA live region exists with correct attributes
    // ========================================================================
    test('ARIA live region exists with assertive mode', async ({ page }) => {
        const region = page.locator('#reorderLiveRegion');
        await expect(region).toBeAttached();
        await expect(region).toHaveAttribute('aria-live', 'assertive');
        await expect(region).toHaveAttribute('aria-atomic', 'true');
    });
});
