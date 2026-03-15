/* ============================================================================
   Kiosk Overseer - Application Logic
   ============================================================================ */

const SECTION_DEFS = [
    { key: 'kioskMode', title: 'KIOSK MODE' },
    { key: 'profile', title: 'PROFILE' },
    { key: 'account', title: 'ACCOUNT' },
    { key: 'taskbarControls', title: 'TASKBAR' },
    { key: 'fileExplorerControls', title: 'FILE EXPLORER ACCESS' },
    { key: 'singleAppSettings', title: 'SINGLE-APP SETTINGS' },
    { key: 'allowedApplications', title: 'ALLOWED APPLICATIONS' },
    { key: 'autoLaunch', title: 'AUTO-LAUNCH CONFIGURATION' },
    { key: 'edgeKiosk', title: 'EDGE KIOSK SETTINGS' },
    { key: 'win32Args', title: 'WIN32 APP ARGUMENTS' },
    { key: 'startMenuPins', title: 'START MENU PINS' },
    { key: 'taskbarLayout', title: 'TASKBAR PINS' },
    { key: 'configSummary', title: 'CONFIGURATION SUMMARY' },
    { key: 'xmlPreview', title: 'XML PREVIEW' },
    { key: 'deployGuide', title: 'DEPLOYMENT GUIDE' },
    { key: 'deviceSettings', title: 'DEVICE SETTINGS' },
    { key: 'navigation', title: 'NAVIGATION', showNumber: false },
    { key: 'navMode', navLabel: 'STEP 1: KIOSK MODE', showNumber: false },
    { key: 'navApps', navLabel: 'STEP 2: APPLICATIONS', showNumber: false },
    { key: 'navLayout', navLabel: 'STEP 3: LAYOUT', showNumber: false },
    { key: 'navAccount', navLabel: 'STEP 4: ACCOUNT & IDENTITY', showNumber: false },
    { key: 'navDevice', navLabel: 'STEP 5: DEVICE SETTINGS', showNumber: false },
    { key: 'navSummary', navLabel: 'SUMMARY & EXPORT', showNumber: false }
];

const SECTION_START_INDEX = 1;
const THEME_STORAGE_KEY = 'ko_theme';

function formatSectionNumber(value) {
    return String(value).padStart(2, '0');
}

function resolveSectionNumbers(defs) {
    const fallbackNumbers = defs.map((_, index) => formatSectionNumber(index + SECTION_START_INDEX));
    const candidateNumbers = defs.map((def, index) => def.displayNumber ?? fallbackNumbers[index]);
    const seen = new Map();
    let hasDuplicate = false;

    defs.forEach((def, index) => {
        if (def.showNumber === false) return;
        const number = candidateNumbers[index];
        if (seen.has(number)) {
            hasDuplicate = true;
        } else {
            seen.set(number, def.key);
        }
    });

    if (hasDuplicate) {
        console.warn('Duplicate section numbers detected; falling back to index-based numbering.');
        return fallbackNumbers;
    }

    return candidateNumbers;
}

function applySectionLabels() {
    const defs = SECTION_DEFS;
    const numbers = resolveSectionNumbers(defs);
    const numberMap = new Map();
    defs.forEach((def, index) => {
        numberMap.set(def.key, numbers[index]);
    });

    document.querySelectorAll('[data-section-key]').forEach(element => {
        const key = element.dataset.sectionKey;
        const def = defs.find(entry => entry.key === key);
        if (!def) {
            console.warn(`Missing section definition for key: ${key}`);
            return;
        }

        if (element.classList.contains('side-nav-btn')) {
            if (def.navLabel) {
                element.textContent = def.navLabel;
            }
            return;
        }

        const title = def.title || def.navLabel || '';
        if (!title) return;

        if (def.showNumber === false) {
            element.textContent = title;
            return;
        }

        element.textContent = title;
    });
}

/* ============================================================================
   GUID Generator
   ============================================================================ */
function generateGuid() {
    const guid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
    dom.get('profileId').value = '{' + guid + '}';
    updatePreview();
}

function copyProfileId(buttonEl) {
    copyToClipboard(dom.get('profileId').value, buttonEl);
}

/* ============================================================================
   Deploy Guide Tabs
   ============================================================================ */
function switchDeployTab(tabId) {
    document.querySelectorAll('.deploy-tab').forEach(btn => {
        const isActive = btn.id === `deploy-tab-${tabId}`;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive);
    });

    document.querySelectorAll('.deploy-content').forEach(panel => {
        const isActive = panel.id === `deploy-${tabId}`;
        panel.classList.toggle('active', isActive);
    });
}

/* ============================================================================
   Tab Navigation
   ============================================================================ */
function switchTab(tabId) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn, .side-nav-btn').forEach(btn => {
        const isActive = btn.id === `tab-btn-${tabId}`;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive);
    });

    // Update tab panels
    document.querySelectorAll('.tab-content').forEach(panel => {
        const isActive = panel.id === `tab-${tabId}`;
        panel.classList.toggle('active', isActive);
    });

    // Show save config reminder when entering Summary & Export tab
    if (tabId === 'summary') {
        const reminder = document.querySelector('.callout[data-callout-id="save-config-reminder"]');
        if (reminder && !sessionStorage.getItem('callout:save-config-reminder')) {
            reminder.classList.remove('hidden');
        }
    }
}

function updateTabVisibility() {
    const isMultiOrRestricted = state.mode === 'multi' || state.mode === 'restricted';
    const layoutTab = dom.get('tab-btn-layout');

    // All modes see: Mode, Apps, Account, Summary
    // Only multi/restricted see: Layout (pins)
    function setTabVisible(btn, visible) {
        if (!btn) return;
        btn.classList.toggle('hidden', !visible);
        btn.disabled = !visible;
        btn.setAttribute('aria-disabled', (!visible).toString());
        btn.setAttribute('aria-hidden', (!visible).toString());
    }

    setTabVisible(layoutTab, isMultiOrRestricted);

    // Hide file explorer access in single mode (lives in apps tab)
    const fileExplorerSection = document.getElementById('fileExplorerSection');
    if (fileExplorerSection) {
        fileExplorerSection.classList.toggle('hidden', !isMultiOrRestricted);
        fileExplorerSection.setAttribute('aria-hidden', (!isMultiOrRestricted).toString());
    }

    // If switching to single mode and currently on Layout tab, redirect
    if (!isMultiOrRestricted) {
        const activeTab = document.querySelector('.side-nav-btn.active');
        if (activeTab && activeTab.id === 'tab-btn-layout') {
            switchTab('mode');
        }
    }
}

function updateTaskbarControlsVisibility() {
    const legend = document.querySelector('[data-section-key="taskbarControls"]');
    if (!legend) return;
    const fieldset = legend.closest('fieldset');
    if (!fieldset) return;
    const hide = state.mode === 'single';
    fieldset.classList.toggle('hidden', hide);
    fieldset.setAttribute('aria-hidden', hide.toString());
    fieldset.querySelectorAll('input, select, textarea, button').forEach(control => {
        control.disabled = hide;
    });
}

function updateSentryUI() {
    const enabled = dom.get('enableSentry').checked;
    const intervalGroup = dom.get('sentryIntervalGroup');
    if (intervalGroup) intervalGroup.classList.toggle('hidden', !enabled);
}

function getStoredTheme() {
    return localStorage.getItem(THEME_STORAGE_KEY) || 'fallout';
}

function updateThemeToggleLabel(theme) {
    const toggle = dom.get('themeToggle');
    if (!toggle) return;
    toggle.textContent = theme === 'fluent' ? 'Theme: Fluent' : 'Theme: Fallout';
}

function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'fluent') {
        root.setAttribute('data-theme', 'fluent');
    } else {
        root.removeAttribute('data-theme');
    }
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    updateThemeToggleLabel(theme);
}

function toggleTheme() {
    const current = getStoredTheme();
    const next = current === 'fluent' ? 'fallout' : 'fluent';
    applyTheme(next);
}

/* ============================================================================
   Mode Switching
   ============================================================================ */
function setMode(mode) {
    state.mode = mode;

    const singleBtn = dom.get('modeSingle');
    const multiBtn = dom.get('modeMulti');
    const restrictedBtn = dom.get('modeRestricted');
    const singleConfig = dom.get('singleAppConfig');
    const multiConfig = dom.get('multiAppConfig');

    // Update mode buttons
    singleBtn.classList.toggle('active', mode === 'single');
    multiBtn.classList.toggle('active', mode === 'multi');
    restrictedBtn.classList.toggle('active', mode === 'restricted');
    singleBtn.setAttribute('aria-pressed', mode === 'single');
    multiBtn.setAttribute('aria-pressed', mode === 'multi');
    restrictedBtn.setAttribute('aria-pressed', mode === 'restricted');

    // Show/hide config panels - restricted uses same UI as multi-app
    singleConfig.classList.toggle('hidden', mode !== 'single');
    multiConfig.classList.toggle('hidden', mode === 'single');
    singleConfig.setAttribute('aria-hidden', mode !== 'single');
    multiConfig.setAttribute('aria-hidden', mode === 'single');

    // Update account type options based on mode
    updateAccountTypeOptions();

    // Update tab visibility based on mode
    updateTabVisibility();
    updateTaskbarControlsVisibility();
    updateKioskModeHint();

    // Update auto-launch selector when switching to multi/restricted mode
    if (mode === 'multi' || mode === 'restricted') {
        updateAutoLaunchSelector();
    }

    updatePreview();
}

function updateAccountTypeOptions() {
    const groupBtn = dom.get('accountGroup');
    const globalBtn = dom.get('accountGlobal');
    const autoBtn = dom.get('accountAuto');
    const existingBtn = dom.get('accountExisting');
    const visitorBtn = dom.get('accountVisitor');

    if (state.mode === 'restricted') {
        // Show group, global, and visitor options for restricted mode
        groupBtn.classList.remove('hidden');
        globalBtn.classList.remove('hidden');
        if (visitorBtn) visitorBtn.classList.remove('hidden');
        autoBtn.classList.add('hidden');
        existingBtn.classList.add('hidden');

        // Force restricted mode away from auto/existing
        if (state.accountType === 'auto' || state.accountType === 'existing') {
            setAccountType('group');
        }
    } else {
        // Hide group and global options for single/multi modes
        groupBtn.classList.add('hidden');
        globalBtn.classList.add('hidden');
        autoBtn.classList.remove('hidden');
        existingBtn.classList.remove('hidden');
        if (visitorBtn) visitorBtn.classList.remove('hidden');

        // If currently on group or global, switch back to auto
        if (state.accountType === 'group' || state.accountType === 'global') {
            setAccountType('auto');
        }
    }
}

function setAccountType(type) {
    state.accountType = type;

    const autoBtn = dom.get('accountAuto');
    const existingBtn = dom.get('accountExisting');
    const visitorBtn = dom.get('accountVisitor');
    const groupBtn = dom.get('accountGroup');
    const globalBtn = dom.get('accountGlobal');
    const autoConfig = dom.get('autoLogonConfig');
    const existingConfig = dom.get('existingAccountConfig');
    const visitorConfig = dom.get('visitorConfig');
    const groupConfig = dom.get('groupAccountConfig');
    const globalConfig = dom.get('globalProfileConfig');

    // Update button states
    autoBtn.classList.toggle('active', type === 'auto');
    existingBtn.classList.toggle('active', type === 'existing');
    visitorBtn.classList.toggle('active', type === 'visitor');
    groupBtn.classList.toggle('active', type === 'group');
    globalBtn.classList.toggle('active', type === 'global');
    autoBtn.setAttribute('aria-pressed', type === 'auto');
    existingBtn.setAttribute('aria-pressed', type === 'existing');
    visitorBtn.setAttribute('aria-pressed', type === 'visitor');
    groupBtn.setAttribute('aria-pressed', type === 'group');
    globalBtn.setAttribute('aria-pressed', type === 'global');

    // Show/hide config panels
    autoConfig.classList.toggle('hidden', type !== 'auto');
    existingConfig.classList.toggle('hidden', type !== 'existing');
    visitorConfig.classList.toggle('hidden', type !== 'visitor');
    groupConfig.classList.toggle('hidden', type !== 'group');
    globalConfig.classList.toggle('hidden', type !== 'global');
    autoConfig.setAttribute('aria-hidden', type !== 'auto');
    existingConfig.setAttribute('aria-hidden', type !== 'existing');
    visitorConfig.setAttribute('aria-hidden', type !== 'visitor');
    groupConfig.setAttribute('aria-hidden', type !== 'group');
    globalConfig.setAttribute('aria-hidden', type !== 'global');

    updatePreview();
}

function updatePinMethodUI() {
    const method = dom.get('pinMethod')?.value;
    const group = document.getElementById('pinDesktopAppIdGroup');
    if (group) {
        group.classList.toggle('hidden', method !== 'desktopAppId');
        group.setAttribute('aria-hidden', method !== 'desktopAppId');
    }
}

function updateAppTypeUI() {
    const appType = dom.get('appType').value;
    const edgeConfig = dom.get('edgeConfig');
    const uwpConfig = dom.get('uwpConfig');
    const win32Config = dom.get('win32Config');

    edgeConfig.classList.toggle('hidden', appType !== 'edge');
    uwpConfig.classList.toggle('hidden', appType !== 'uwp');
    win32Config.classList.toggle('hidden', appType !== 'win32');

    edgeConfig.setAttribute('aria-hidden', appType !== 'edge');
    uwpConfig.setAttribute('aria-hidden', appType !== 'uwp');
    win32Config.setAttribute('aria-hidden', appType !== 'win32');
}

function dismissCallout(idOrElement) {
    const callout = typeof idOrElement === 'string'
        ? document.querySelector(`.callout[data-callout-id="${idOrElement}"]`)
        : idOrElement?.closest?.('.callout');
    if (!callout) return;
    const calloutId = callout.getAttribute('data-callout-id');
    if (calloutId) {
        sessionStorage.setItem(`callout:${calloutId}`, 'dismissed');
    }
    callout.classList.add('hidden');
}

let welcomeTrap = null;

function showWelcome() {
    if (localStorage.getItem('welcomeDismissed')) return;
    const modal = document.getElementById('welcomeModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    if (!welcomeTrap) {
        welcomeTrap = createFocusTrap(modal, { onClose: dismissWelcome });
    }
    welcomeTrap.activate();
}

function dismissWelcome() {
    const modal = document.getElementById('welcomeModal');
    if (modal) modal.classList.add('hidden');
    localStorage.setItem('welcomeDismissed', '1');
    if (welcomeTrap) welcomeTrap.deactivate();
}

function initCallouts() {
    document.querySelectorAll('.callout[data-callout-id]').forEach(callout => {
        const calloutId = callout.getAttribute('data-callout-id');
        if (calloutId && sessionStorage.getItem(`callout:${calloutId}`)) {
            callout.classList.add('hidden');
        }
    });
}

function updateKioskModeHint() {
    const hint = dom.get('kioskModeHintText');
    if (!hint) return;

    if (state.mode === 'single') {
        hint.textContent = 'Single-App: Runs one app fullscreen (e.g., Edge kiosk)';
        return;
    }

    if (state.mode === 'multi') {
        hint.textContent = 'Multi-App: Allows multiple apps with custom Start menu';
        return;
    }

    hint.textContent = 'Restricted User: Desktop with limited apps, supports user groups';
}

function updateEdgeSourceUI() {
    const sourceType = dom.get('edgeSourceType').value;
    const urlConfig = dom.get('edgeUrlConfig');
    const fileConfig = dom.get('edgeFileConfig');

    urlConfig.classList.toggle('hidden', sourceType !== 'url');
    fileConfig.classList.toggle('hidden', sourceType !== 'file');

    urlConfig.setAttribute('aria-hidden', sourceType !== 'url');
    fileConfig.setAttribute('aria-hidden', sourceType !== 'file');
}

function updateEdgeTileSourceUI() {
    const sourceType = dom.get('edgeTileSourceType').value;
    const urlConfig = dom.get('edgeTileUrlConfig');
    const fileConfig = dom.get('edgeTileFileConfig');

    urlConfig.classList.toggle('hidden', sourceType !== 'url');
    fileConfig.classList.toggle('hidden', sourceType !== 'file');

    urlConfig.setAttribute('aria-hidden', sourceType !== 'url');
    fileConfig.setAttribute('aria-hidden', sourceType !== 'file');
}

function updateTaskbarPinTypeUI() {
    const type = dom.get('taskbarPinType')?.value || 'desktopAppLink';
    const packaged = dom.get('taskbarPackagedFields');
    const desktop = dom.get('taskbarDesktopFields');
    if (!packaged || !desktop) return;
    const isPackaged = type === 'packagedAppId';
    packaged.classList.toggle('hidden', !isPackaged);
    packaged.setAttribute('aria-hidden', !isPackaged);
    desktop.classList.toggle('hidden', isPackaged);
    desktop.setAttribute('aria-hidden', isPackaged);
}

function updateEditTaskbarPinTypeUI() {
    const type = dom.get('editTaskbarPinType')?.value || 'desktopAppLink';
    const packaged = dom.get('editTaskbarPackagedFields');
    const desktop = dom.get('editTaskbarDesktopFields');
    if (!packaged || !desktop) return;
    const isPackaged = type === 'packagedAppId';
    packaged.classList.toggle('hidden', !isPackaged);
    packaged.setAttribute('aria-hidden', !isPackaged);
    desktop.classList.toggle('hidden', isPackaged);
    desktop.setAttribute('aria-hidden', isPackaged);
}

function getFriendlyAppName(app) {
    if (!app || !app.value) return 'Unknown';
    if (app.type === 'aumid') {
        // Try to extract a readable name from the AUMID
        const parts = app.value.split('!');
        const pkg = parts[0] || '';
        const name = pkg.split('_')[0] || pkg;
        // Strip "Microsoft." prefix for cleaner display
        return name.replace(/^Microsoft\./, '').replace(/([a-z])([A-Z])/g, '$1 $2');
    }
    return buildPinNameFromApp(app);
}

function updatePinTargetPresets() {
    const presetSelect = dom.get('pinTargetPreset');
    const editPresetSelect = dom.get('editPinTargetPreset');
    const taskbarPresetSelect = dom.get('taskbarPinTargetPreset');
    const editTaskbarPresetSelect = dom.get('editTaskbarPinTargetPreset');

    const allowedApps = state.allowedApps
        .filter(app => !isHelperExecutable(app.value));

    // Deduplicate by value
    const seen = new Set();
    const uniqueApps = allowedApps.filter(app => {
        if (seen.has(app.value)) return false;
        seen.add(app.value);
        return true;
    });

    const buildOptions = (placeholder) => {
        return [`<option value="">${placeholder}</option>`]
            .concat(uniqueApps.map(app => {
                const friendlyName = getFriendlyAppName(app);
                const typeLabel = app.type === 'aumid' ? ' (UWP)' : '';
                return `<option value="${escapeXml(app.value)}" data-app-type="${app.type}">${escapeXml(friendlyName)}${typeLabel}</option>`;
            }))
            .join('');
    };

    if (presetSelect) {
        presetSelect.innerHTML = buildOptions('Select an allowed app');
    }
    if (editPresetSelect) {
        editPresetSelect.innerHTML = buildOptions('Select allowed app');
    }
    if (taskbarPresetSelect) {
        taskbarPresetSelect.innerHTML = buildOptions('Select an allowed app');
    }
    if (editTaskbarPresetSelect) {
        editTaskbarPresetSelect.innerHTML = buildOptions('Select allowed app');
    }
}

function applyPinTargetPreset() {
    const presetSelect = dom.get('pinTargetPreset');
    const targetInput = dom.get('pinTarget');
    const nameInput = dom.get('pinName');
    if (!presetSelect || !targetInput) return;
    const value = presetSelect.value;
    if (value) {
        const selectedOption = presetSelect.options[presetSelect.selectedIndex];
        const appType = selectedOption.getAttribute('data-app-type');
        const app = state.allowedApps.find(a => a.value === value);
        targetInput.value = value;
        // Auto-fill name if empty or was previously auto-filled
        if (nameInput && (!nameInput.value.trim() || nameInput.dataset.autoFilled === 'true')) {
            nameInput.value = getFriendlyAppName(app || { value, type: appType || 'path' });
            nameInput.dataset.autoFilled = 'true';
        }
        syncEdgeArgsField('pin');
        updateEdgeArgsVisibility('pin', 'pinTarget', 'pinEdgeArgsGroup');
    }
}

// Clear auto-filled flag when user manually edits the name (registered in initApp below)

function applyEditPinTargetPreset() {
    const presetSelect = dom.get('editPinTargetPreset');
    const targetInput = dom.get('editPinTarget');
    if (!presetSelect || !targetInput) return;
    const value = presetSelect.value;
    if (value) {
        targetInput.value = value;
        syncEdgeArgsField('editPin');
        updateEdgeArgsVisibility('editPin', 'editPinTarget', 'editPinEdgeArgsGroup');
    }
}

function applyTaskbarPinTargetPreset() {
    const presetSelect = dom.get('taskbarPinTargetPreset');
    const targetInput = dom.get('taskbarPinTarget');
    const nameInput = dom.get('taskbarPinName');
    const typeInput = dom.get('taskbarPinType');
    const valueInput = dom.get('taskbarPinValue');
    if (!presetSelect) return;
    const value = presetSelect.value;
    if (value) {
        const selectedOption = presetSelect.options[presetSelect.selectedIndex];
        const appType = selectedOption.getAttribute('data-app-type');
        const app = state.allowedApps.find(a => a.value === value);

        // Set hidden type and value fields based on app type
        if (appType === 'aumid') {
            if (typeInput) typeInput.value = 'packagedAppId';
            if (valueInput) valueInput.value = value;
            if (targetInput) targetInput.value = '';
        } else {
            if (typeInput) typeInput.value = 'desktopAppLink';
            if (targetInput) targetInput.value = value;
            if (valueInput) valueInput.value = '';
        }

        // Auto-fill name if empty or was previously auto-filled
        if (nameInput && (!nameInput.value.trim() || nameInput.dataset.autoFilled === 'true')) {
            nameInput.value = getFriendlyAppName(app || { value, type: appType || 'path' });
            nameInput.dataset.autoFilled = 'true';
        }

        // Show/hide desktop advanced options based on type
        const desktopFields = dom.get('taskbarDesktopFields');
        if (desktopFields) {
            desktopFields.classList.toggle('hidden', appType === 'aumid');
        }

        syncEdgeArgsField('taskbarPin');
        updateEdgeArgsVisibility('taskbarPin', 'taskbarPinTarget', 'taskbarPinEdgeArgsGroup');
    }
}

function applyEditTaskbarPinTargetPreset() {
    const presetSelect = dom.get('editTaskbarPinTargetPreset');
    const targetInput = dom.get('editTaskbarPinTarget');
    if (!presetSelect || !targetInput) return;
    const value = presetSelect.value;
    if (value) {
        targetInput.value = value;
        syncEdgeArgsField('editTaskbar');
        updateEdgeArgsVisibility('editTaskbar', 'editTaskbarPinTarget', 'editTaskbarEdgeArgsGroup');
    }
}

function updateEdgeArgsModeUI(prefix) {
    const mode = dom.get(`${prefix}EdgeArgsMode`)?.value;
    const sourceConfig = dom.get(`${prefix}EdgeArgsSourceConfig`);
    const idleConfig = dom.get(`${prefix}EdgeArgsIdleConfig`);
    if (!mode || !sourceConfig || !idleConfig) return;
    const needsSource = mode === 'kioskFullscreen' || mode === 'kioskPublic';
    sourceConfig.classList.toggle('hidden', !needsSource);
    sourceConfig.setAttribute('aria-hidden', !needsSource);
    idleConfig.classList.toggle('hidden', !needsSource);
    idleConfig.setAttribute('aria-hidden', !needsSource);
    if (needsSource) {
        updateEdgeArgsSourceUI(prefix);
    }
    syncEdgeArgsField(prefix);
}

function updateEdgeArgsSourceUI(prefix) {
    const sourceType = dom.get(`${prefix}EdgeArgsSourceType`)?.value;
    const urlConfig = dom.get(`${prefix}EdgeArgsUrlConfig`);
    const fileConfig = dom.get(`${prefix}EdgeArgsFileConfig`);
    if (!sourceType || !urlConfig || !fileConfig) return;
    urlConfig.classList.toggle('hidden', sourceType !== 'url');
    fileConfig.classList.toggle('hidden', sourceType !== 'file');
    urlConfig.setAttribute('aria-hidden', sourceType !== 'url');
    fileConfig.setAttribute('aria-hidden', sourceType !== 'file');
    syncEdgeArgsField(prefix);
}

function updateModalEdgeArgsModeUI() {
    updateEdgeArgsModeUI('modal');
}

function updateModalEdgeArgsSourceUI() {
    updateEdgeArgsSourceUI('modal');
}

function buildEdgeArgsFromUi(prefix, options = {}) {
    const { suppressAlert = false } = options;
    const mode = dom.get(`${prefix}EdgeArgsMode`)?.value || 'standard';
    if (mode === 'standard') {
        return '';
    }
    const sourceType = dom.get(`${prefix}EdgeArgsSourceType`)?.value || 'url';
    const url = buildLaunchUrl(
        sourceType,
        dom.get(`${prefix}EdgeArgsUrl`)?.value.trim(),
        dom.get(`${prefix}EdgeArgsFilePath`)?.value,
        ''
    );
    if (!url) {
        if (!suppressAlert) {
            showToast('Edge kiosk mode requires a URL or local file path.', { type: 'error' });
        }
        return '';
    }
    const kioskType = mode === 'kioskPublic' ? 'public-browsing' : 'fullscreen';
    const idleTimeout = parseInt(dom.get(`${prefix}EdgeArgsIdle`)?.value, 10) || 0;
    return buildEdgeKioskArgs(url, kioskType, idleTimeout);
}

function buildBrowserArgsFromUi(prefix, targetValue, options = {}) {
    const { suppressAlert = false } = options;
    const mode = dom.get(`${prefix}EdgeArgsMode`)?.value || 'standard';
    if (mode === 'standard') {
        return '';
    }
    const sourceType = dom.get(`${prefix}EdgeArgsSourceType`)?.value || 'url';
    const url = buildLaunchUrl(
        sourceType,
        dom.get(`${prefix}EdgeArgsUrl`)?.value.trim(),
        dom.get(`${prefix}EdgeArgsFilePath`)?.value,
        ''
    );
    if (!url) {
        if (!suppressAlert) {
            showToast('Kiosk mode requires a URL or local file path.', { type: 'error' });
        }
        return '';
    }
    // Chrome/Brave/Island have simpler kiosk args (no public-browsing or idle timeout)
    if (isChromeApp(targetValue) || isBraveApp(targetValue) || isIslandApp(targetValue)) {
        return `--kiosk ${url} --no-first-run`;
    }
    // Firefox has basic kiosk support
    if (isFirefoxApp(targetValue)) {
        return `--kiosk ${url}`;
    }
    // Edge has full kiosk options
    const kioskType = mode === 'kioskPublic' ? 'public-browsing' : 'fullscreen';
    const idleTimeout = parseInt(dom.get(`${prefix}EdgeArgsIdle`)?.value, 10) || 0;
    return buildEdgeKioskArgs(url, kioskType, idleTimeout);
}

function syncEdgeArgsField(prefix) {
    const fieldMap = {
        pin: ['pinTarget', 'pinArgs'],
        editPin: ['editPinTarget', 'editPinArgs'],
        taskbarPin: ['taskbarPinTarget', 'taskbarPinArgs'],
        editTaskbar: ['editTaskbarPinTarget', 'editTaskbarPinArgs']
    };
    const ids = fieldMap[prefix];
    if (!ids) return;
    // Skip sync when inline edge args elements don't exist (using modal instead)
    if (!dom.get(`${prefix}EdgeArgsMode`)) return;
    const targetInput = dom.get(ids[0]);
    const argsInput = dom.get(ids[1]);
    if (!targetInput || !argsInput) return;
    if (!isBrowserWithKioskSupport(targetInput.value)) {
        const mode = dom.get(`${prefix}EdgeArgsMode`)?.value || 'standard';
        if (mode !== 'standard') {
            argsInput.value = '';
        }
        return;
    }
    argsInput.value = buildBrowserArgsFromUi(prefix, targetInput.value, { suppressAlert: true });
}

function updateEdgeArgsVisibility(prefix, targetInputId, groupId) {
    const targetInput = dom.get(targetInputId);
    const group = dom.get(groupId);
    if (!targetInput || !group) return;
    const show = isBrowserWithKioskSupport(targetInput.value);
    group.classList.toggle('hidden', !show);
    group.setAttribute('aria-hidden', !show);
    if (show) {
        const details = group.closest('details.pin-advanced-options');
        if (details) details.open = true;
    }
}

function getEdgeArgsPrefixFromId(id) {
    if (!id) return '';
    if (id === 'pinTarget') return 'pin';
    if (id === 'editPinTarget') return 'editPin';
    if (id === 'taskbarPinTarget') return 'taskbarPin';
    if (id === 'editTaskbarPinTarget') return 'editTaskbar';
    if (id.startsWith('pinEdgeArgs')) return 'pin';
    if (id.startsWith('editPinEdgeArgs')) return 'editPin';
    if (id.startsWith('taskbarPinEdgeArgs')) return 'taskbarPin';
    if (id.startsWith('editTaskbarEdgeArgs')) return 'editTaskbar';
    return '';
}

function getEdgeArgsTargetConfigFromId(id) {
    switch (id) {
        case 'pinTarget':
            return { prefix: 'pin', targetId: 'pinTarget', groupId: 'pinEdgeArgsGroup' };
        case 'editPinTarget':
            return { prefix: 'editPin', targetId: 'editPinTarget', groupId: 'editPinEdgeArgsGroup' };
        case 'taskbarPinTarget':
            return { prefix: 'taskbarPin', targetId: 'taskbarPinTarget', groupId: 'taskbarPinEdgeArgsGroup' };
        case 'editTaskbarPinTarget':
            return { prefix: 'editTaskbar', targetId: 'editTaskbarPinTarget', groupId: 'editTaskbarEdgeArgsGroup' };
        default:
            return null;
    }
}

let edgeArgsModalContext = null;
let edgeArgsTrap = null;

const EDGE_ARGS_FIELD_MAP = {
    pin: { targetId: 'pinTarget', argsId: 'pinArgs' },
    editPin: { targetId: 'editPinTarget', argsId: 'editPinArgs' },
    taskbarPin: { targetId: 'taskbarPinTarget', argsId: 'taskbarPinArgs' },
    editTaskbar: { targetId: 'editTaskbarPinTarget', argsId: 'editTaskbarPinArgs' }
};

function openEdgeArgsModal(prefix) {
    const ctx = EDGE_ARGS_FIELD_MAP[prefix];
    if (!ctx) return;
    edgeArgsModalContext = { ...ctx, prefix };

    // Parse current args to pre-populate modal
    const argsInput = dom.get(ctx.argsId);
    const targetInput = dom.get(ctx.targetId);
    const currentArgs = argsInput?.value || '';
    const parsed = parseEdgeKioskArgs(currentArgs);

    dom.get('modalEdgeArgsMode').value = parsed.mode;
    if (parsed.sourceType === 'file') {
        let filePath = parsed.url;
        if (filePath.toLowerCase().startsWith('file:///')) {
            filePath = decodeURIComponent(filePath.substring(8)).replace(/\//g, '\\');
        }
        dom.get('modalEdgeArgsFilePath').value = filePath;
        dom.get('modalEdgeArgsUrl').value = '';
    } else {
        dom.get('modalEdgeArgsUrl').value = parsed.url;
        dom.get('modalEdgeArgsFilePath').value = '';
    }
    dom.get('modalEdgeArgsSourceType').value = parsed.sourceType;
    dom.get('modalEdgeArgsIdle').value = parsed.idleTimeout || '';

    updateEdgeArgsModeUI('modal');

    const modal = document.getElementById('edgeArgsModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    if (!edgeArgsTrap) {
        edgeArgsTrap = createFocusTrap(modal, { onClose: hideEdgeArgsModal });
    }
    edgeArgsTrap.activate();
}

function applyEdgeArgsModal() {
    if (!edgeArgsModalContext) return;
    const targetInput = dom.get(edgeArgsModalContext.targetId);
    const argsInput = dom.get(edgeArgsModalContext.argsId);
    if (!targetInput || !argsInput) return;

    const args = buildBrowserArgsFromUi('modal', targetInput.value);
    argsInput.value = args || '';
    hideEdgeArgsModal();
}

function hideEdgeArgsModal() {
    const modal = document.getElementById('edgeArgsModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    edgeArgsModalContext = null;
    if (edgeArgsTrap) edgeArgsTrap.deactivate();
}

function getEdgeUrl() {
    const sourceType = dom.get('edgeSourceType').value;
    return buildLaunchUrl(
        sourceType,
        dom.get('edgeUrl').value,
        dom.get('edgeFilePath').value,
        'https://www.microsoft.com'
    );
}

function getEdgeTileLaunchUrl() {
    const sourceType = dom.get('edgeTileSourceType').value;
    return buildLaunchUrl(
        sourceType,
        dom.get('edgeTileUrl').value.trim(),
        dom.get('edgeTileFilePath').value,
        ''
    );
}

function normalizeTileUrl(input) {
    if (!input) return '';
    const trimmed = input.trim();
    if (/^https?:\/\//i.test(trimmed) || /^file:\/\//i.test(trimmed)) {
        return trimmed;
    }
    return buildFileUrl(trimmed);
}

function updateBreakoutUI() {
    const enabled = dom.get('enableBreakout').checked;
    const breakoutConfig = dom.get('breakoutConfig');
    breakoutConfig.classList.toggle('hidden', !enabled);
    breakoutConfig.setAttribute('aria-hidden', !enabled);
    updateBreakoutPreview();
}

function updateBreakoutPreview() {
    const ctrl = dom.get('breakoutCtrl').checked;
    const alt = dom.get('breakoutAlt').checked;
    const shift = dom.get('breakoutShift').checked;
    const key = dom.get('breakoutFinalKey').value;

    let combo = [];
    if (ctrl) combo.push('Ctrl');
    if (alt) combo.push('Alt');
    if (shift) combo.push('Shift');
    combo.push(key);

    dom.get('breakoutPreview').textContent = combo.join('+');
}

function getBreakoutSequence() {
    if (!dom.get('enableBreakout').checked) return null;

    const ctrl = dom.get('breakoutCtrl').checked;
    const alt = dom.get('breakoutAlt').checked;
    const shift = dom.get('breakoutShift').checked;
    const key = dom.get('breakoutFinalKey').value;

    // Build the key string in the format expected by AssignedAccess
    let combo = [];
    if (ctrl) combo.push('Ctrl');
    if (alt) combo.push('Alt');
    if (shift) combo.push('Shift');
    combo.push(key);

    return combo.join('+');
}

/* ============================================================================
   Multi-App Auto-Launch Functions
   ============================================================================ */
function getMultiAppEdgeUrl() {
    const sourceType = dom.get('multiEdgeSourceType').value;
    return buildLaunchUrl(
        sourceType,
        dom.get('multiEdgeUrl').value,
        dom.get('multiEdgeFilePath').value,
        'https://www.microsoft.com'
    );
}

function getSentryAppInfo() {
    if (state.autoLaunchApp === null) return null;
    const app = state.allowedApps[state.autoLaunchApp];
    if (!app || app.type !== 'path') return null;

    const exePath = app.value;
    const segments = exePath.replace(/\//g, '\\').split('\\');
    const exeName = segments[segments.length - 1];
    const processName = exeName.replace(/\.exe$/i, '');
    const isBrowser = isBrowserWithKioskSupport(app.value);

    let launchArgs = '';
    if (isEdgeApp(app.value)) {
        const url = getMultiAppEdgeUrl();
        const kioskType = dom.get('multiEdgeKioskType').value;
        launchArgs = buildEdgeKioskArgs(url, kioskType, 0);
    } else {
        launchArgs = dom.get('win32AutoLaunchArgs').value.trim();
    }

    return { exePath, processName, launchArgs, isBrowser };
}

function updateMultiEdgeSourceUI() {
    const sourceType = dom.get('multiEdgeSourceType').value;
    const urlGroup = dom.get('multiEdgeUrlGroup');
    const fileGroup = dom.get('multiEdgeFileGroup');

    urlGroup.classList.toggle('hidden', sourceType !== 'url');
    fileGroup.classList.toggle('hidden', sourceType !== 'file');

    urlGroup.setAttribute('aria-hidden', sourceType !== 'url');
    fileGroup.setAttribute('aria-hidden', sourceType !== 'file');
}

function updateTabIndicators() {
    const errors = validate();
    const tabNames = ['mode', 'apps', 'layout', 'account', 'device', 'summary'];
    const errorsByTab = {};
    tabNames.forEach(t => { errorsByTab[t] = false; });
    errors.forEach(e => {
        if (e.tab && errorsByTab.hasOwnProperty(e.tab)) {
            errorsByTab[e.tab] = true;
        }
    });
    tabNames.forEach(tab => {
        const btn = document.getElementById(`tab-btn-${tab}`);
        if (btn) btn.classList.toggle('tab-has-errors', errorsByTab[tab]);
    });
}

/* ============================================================================
   Preview & Syntax Highlighting
   ============================================================================ */

/**
 * Colorizes XML for preview display with semantic section highlighting.
 * Wraps different sections in colored spans for visual distinction.
 * @param {string} xml - The raw XML string
 * @returns {string} HTML string with colored sections
 */

/**
 * Checks if the configuration has minimum required fields to generate XML.
 * @returns {boolean} True if ready to generate XML preview
 */
function isConfigReadyForPreview() {
    const profileId = dom.get('profileId').value.trim();
    const displayName = dom.get('displayName').value.trim();
    const accountName = dom.get('accountName').value.trim();

    // Must have a profile ID
    if (!profileId) return false;

    // For auto-logon accounts, display name is required
    if (state.accountType === 'auto' && !displayName) return false;

    // For existing accounts, account name is required
    if (state.accountType === 'existing' && !accountName) return false;

    return true;
}

function updatePreview() {
    const configName = dom.get('configName').value.trim();
    const generatedAt = new Date();
    const modeLabel = state.mode === 'single'
        ? 'Single-App'
        : state.mode === 'multi'
            ? 'Multi-App'
            : 'Restricted Kiosk';

    dom.get('previewProfileName').textContent = configName || 'Unnamed Profile';
    dom.get('previewKioskMode').textContent = modeLabel;
    dom.get('previewAllowedApps').textContent = String(state.allowedApps.length);
    dom.get('previewStartPins').textContent = String(state.startPins.length);
    dom.get('previewToolbarPins').textContent = String(state.taskbarPins.length);
    dom.get('previewShowTaskbar').textContent = dom.get('showTaskbar').checked ? 'Enabled' : 'Hidden';
    dom.get('previewFileExplorer').textContent = dom.get('fileExplorerAccess')?.selectedOptions?.[0]?.textContent || 'Unknown';
    dom.get('previewAutoLogon').textContent = state.accountType === 'auto' ? 'Enabled' : 'Disabled';
    const genDateEl = dom.get('previewGeneratedDate');
    if (genDateEl) genDateEl.textContent = generatedAt.toLocaleString();

    // Only show XML if config is ready, otherwise show placeholder
    if (isConfigReadyForPreview()) {
        const xml = generateXml();
        dom.get('xmlPreview').textContent = xml;
    } else {
        dom.get('xmlPreview').textContent = 'Complete the following steps to generate your XML:\n\n' +
            '1. Choose a Kiosk Mode (Step 1)\n' +
            '2. Configure your apps (Step 2)\n' +
            '3. Set up Account & Identity — enter a Display Name and generate a Profile GUID (Step 4)\n\n' +
            'The XML preview will appear here once the required fields are filled.';
    }
    updateExportAvailability();
    updateExportDetectedGuidance();
    const isValid = showValidation();
    const statusEl = dom.get('previewStatus');
    if (statusEl) statusEl.textContent = isValid ? 'Valid' : 'Errors';
    updateTabIndicators();
}

/* ============================================================================
   Tooltip Positioning
   ============================================================================ */
function positionTooltip(tooltipIcon) {
    const tooltip = tooltipIcon.nextElementSibling;
    if (!tooltip || !tooltip.classList.contains('tooltip-content')) return;

    const iconRect = tooltipIcon.getBoundingClientRect();
    const tooltipWidth = 320; // matches CSS width
    const padding = 10;

    // Position below the icon
    let top = iconRect.bottom + 8;
    let left = iconRect.left + (iconRect.width / 2) - (tooltipWidth / 2);

    // Keep within viewport bounds
    if (left < padding) {
        left = padding;
    } else if (left + tooltipWidth > window.innerWidth - padding) {
        left = window.innerWidth - tooltipWidth - padding;
    }

    // If tooltip would go below viewport, position above instead
    const tooltipHeight = tooltip.offsetHeight || 150;
    if (top + tooltipHeight > window.innerHeight - padding) {
        top = iconRect.top - tooltipHeight - 8;
    }

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
}

/* ============================================================================
   Initialize
   ============================================================================ */
document.addEventListener('DOMContentLoaded', async () => {
    applySectionLabels();
    applyTheme(getStoredTheme());

    // Load presets first
    await loadPresets();

    // Don't auto-generate GUID - user must click Generate button
    initCallouts();
    showWelcome();
    updateTabVisibility();
    updateTaskbarControlsVisibility();
    updateKioskModeHint();
    updatePreview();
    updateEdgeTileSourceUI();
    updatePinTargetPresets();
    updateTaskbarPinTypeUI();
    updateEditTaskbarPinTypeUI();
    updateEdgeArgsVisibility('pin', 'pinTarget', 'pinEdgeArgsGroup');
    updateEdgeArgsVisibility('editPin', 'editPinTarget', 'editPinEdgeArgsGroup');
    updateEdgeArgsVisibility('taskbarPin', 'taskbarPinTarget', 'taskbarPinEdgeArgsGroup');
    updateEdgeArgsVisibility('editTaskbar', 'editTaskbarPinTarget', 'editTaskbarEdgeArgsGroup');
    updateExportAvailability();

    const konamiSequence = [
        'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
        'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
        'KeyB', 'KeyA'
    ];
    let konamiIndex = 0;
    let easterEggBuffer = '';
    const easterEggPhrase = 'hello joshua';
    document.addEventListener('keydown', (event) => {
        const expectedKey = konamiSequence[konamiIndex];
        if (event.code === expectedKey) {
            konamiIndex++;
            if (konamiIndex === konamiSequence.length) {
                window.location.href = 'https://hirejoshua.com';
                konamiIndex = 0;
            }
        } else {
            konamiIndex = event.code === konamiSequence[0] ? 1 : 0;
        }

        if (event.key && event.key.length === 1) {
            easterEggBuffer += event.key.toLowerCase();
            if (easterEggBuffer.length > easterEggPhrase.length) {
                easterEggBuffer = easterEggBuffer.slice(-easterEggPhrase.length);
            }
            if (easterEggBuffer === easterEggPhrase) {
                window.location.href = '404.html';
                easterEggBuffer = '';
            }
        }
    });

    document.addEventListener('click', (event) => {
        const target = event.target.closest('[data-action]');
        if (!target) return;
        runAction(target.dataset.action, target, event);
    });

    function toggleCollapsible(header) {
        const content = header.nextElementSibling;
        if (!content || !content.classList.contains('collapsible-content')) return;

        header.classList.toggle('collapsed');
        content.classList.toggle('collapsed');
        const isExpanded = !header.classList.contains('collapsed');
        header.setAttribute('aria-expanded', isExpanded.toString());
    }

    document.addEventListener('click', (event) => {
        const header = event.target.closest('legend.collapsible-header');
        if (!header) return;
        toggleCollapsible(header);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const header = event.target.closest('legend.collapsible-header');
        if (!header) return;
        event.preventDefault();
        toggleCollapsible(header);
    });

    document.addEventListener('change', (event) => {
        const target = event.target.closest('[data-change]');
        if (!target) return;
        runActions(target.dataset.change, target, event);
    });

    document.addEventListener('input', (event) => {
        const prefix = getEdgeArgsPrefixFromId(event.target?.id);
        if (!prefix) return;
        syncEdgeArgsField(prefix);
        const targetConfig = getEdgeArgsTargetConfigFromId(event.target?.id);
        if (targetConfig) {
            updateEdgeArgsVisibility(targetConfig.prefix, targetConfig.targetId, targetConfig.groupId);
        }
    });

    document.addEventListener('dragstart', handlePinDragStart);
    document.addEventListener('dragover', handlePinDragOver);
    document.addEventListener('dragleave', handlePinDragLeave);
    document.addEventListener('drop', handlePinDrop);
    document.addEventListener('dragend', handlePinDragEnd);

    // Clear auto-filled flag when user manually edits pin name
    const pinNameInput = document.getElementById('pinName');
    if (pinNameInput) {
        pinNameInput.addEventListener('input', () => { pinNameInput.dataset.autoFilled = 'false'; });
    }
    const taskbarPinNameInput = document.getElementById('taskbarPinName');
    if (taskbarPinNameInput) {
        taskbarPinNameInput.addEventListener('input', () => { taskbarPinNameInput.dataset.autoFilled = 'false'; });
    }

    // Tooltips: show/hide on click
    document.querySelectorAll('.tooltip-icon').forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            const tooltip = icon.nextElementSibling;
            if (!tooltip || !tooltip.classList.contains('tooltip-content')) return;
            const wasActive = tooltip.classList.contains('tooltip-active');
            // Close all open tooltips
            document.querySelectorAll('.tooltip-content.tooltip-active').forEach(t => t.classList.remove('tooltip-active'));
            if (!wasActive) {
                positionTooltip(icon);
                tooltip.classList.add('tooltip-active');
            }
        });
    });
    // Close tooltips when clicking elsewhere
    document.addEventListener('click', () => {
        document.querySelectorAll('.tooltip-content.tooltip-active').forEach(t => t.classList.remove('tooltip-active'));
    });
    // Close tooltips on resize or scroll (stale fixed positions)
    let tooltipResizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(tooltipResizeTimer);
        tooltipResizeTimer = setTimeout(() => {
            document.querySelectorAll('.tooltip-content.tooltip-active').forEach(t => t.classList.remove('tooltip-active'));
        }, 150);
    });
    window.addEventListener('scroll', () => {
        document.querySelectorAll('.tooltip-content.tooltip-active').forEach(t => t.classList.remove('tooltip-active'));
    }, { passive: true });

    // Common apps search filter
    const commonAppSearch = document.getElementById('commonAppSearch');
    if (commonAppSearch) {
        commonAppSearch.addEventListener('input', filterCommonApps);
    }

    // Real-time field validation on blur
    const validatedFields = ['configName', 'profileId', 'displayName', 'accountName', 'groupName', 'edgeUrl', 'edgeFilePath', 'uwpAumid', 'win32Path'];
    validatedFields.forEach(fieldId => {
        const input = document.getElementById(fieldId);
        if (!input) return;
        input.addEventListener('blur', () => {
            const error = validateField(fieldId);
            const parent = input.closest('.form-group') || input.parentElement;
            const errorId = `error-${fieldId}`;
            let errorEl = parent.querySelector('.field-error');
            if (error) {
                input.classList.add('invalid');
                if (!errorEl) {
                    errorEl = document.createElement('span');
                    errorEl.className = 'field-error';
                    errorEl.id = errorId;
                    errorEl.setAttribute('role', 'alert');
                    parent.appendChild(errorEl);
                }
                errorEl.textContent = error;
                input.setAttribute('aria-describedby', errorId);
            } else {
                input.classList.remove('invalid');
                input.removeAttribute('aria-describedby');
                if (errorEl) errorEl.remove();
            }
        });
    });
});
