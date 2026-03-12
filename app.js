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

    if (state.mode === 'restricted') {
        // Show group and global options for restricted mode
        groupBtn.classList.remove('hidden');
        globalBtn.classList.remove('hidden');
        autoBtn.classList.add('hidden');
        existingBtn.classList.add('hidden');

        // Force restricted mode to group/global accounts only
        if (state.accountType === 'auto' || state.accountType === 'existing') {
            setAccountType('group');
        }
    } else {
        // Hide group and global options for single/multi modes
        groupBtn.classList.add('hidden');
        globalBtn.classList.add('hidden');
        autoBtn.classList.remove('hidden');
        existingBtn.classList.remove('hidden');

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
    const groupBtn = dom.get('accountGroup');
    const globalBtn = dom.get('accountGlobal');
    const autoConfig = dom.get('autoLogonConfig');
    const existingConfig = dom.get('existingAccountConfig');
    const groupConfig = dom.get('groupAccountConfig');
    const globalConfig = dom.get('globalProfileConfig');

    // Update button states
    autoBtn.classList.toggle('active', type === 'auto');
    existingBtn.classList.toggle('active', type === 'existing');
    groupBtn.classList.toggle('active', type === 'group');
    globalBtn.classList.toggle('active', type === 'global');
    autoBtn.setAttribute('aria-pressed', type === 'auto');
    existingBtn.setAttribute('aria-pressed', type === 'existing');
    groupBtn.setAttribute('aria-pressed', type === 'group');
    globalBtn.setAttribute('aria-pressed', type === 'global');

    // Show/hide config panels
    autoConfig.classList.toggle('hidden', type !== 'auto');
    existingConfig.classList.toggle('hidden', type !== 'existing');
    groupConfig.classList.toggle('hidden', type !== 'group');
    globalConfig.classList.toggle('hidden', type !== 'global');
    autoConfig.setAttribute('aria-hidden', type !== 'auto');
    existingConfig.setAttribute('aria-hidden', type !== 'existing');
    groupConfig.setAttribute('aria-hidden', type !== 'group');
    globalConfig.setAttribute('aria-hidden', type !== 'global');

    updatePreview();
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

function showWelcome() {
    if (localStorage.getItem('welcomeDismissed')) return;
    const modal = document.getElementById('welcomeModal');
    if (modal) modal.classList.remove('hidden');
}

function dismissWelcome() {
    const modal = document.getElementById('welcomeModal');
    if (modal) modal.classList.add('hidden');
    localStorage.setItem('welcomeDismissed', '1');
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

// Clear auto-filled flag when user manually edits the name
document.addEventListener('DOMContentLoaded', () => {
    const pinNameInput = document.getElementById('pinName');
    if (pinNameInput) {
        pinNameInput.addEventListener('input', () => { pinNameInput.dataset.autoFilled = 'false'; });
    }
    const taskbarPinNameInput = document.getElementById('taskbarPinName');
    if (taskbarPinNameInput) {
        taskbarPinNameInput.addEventListener('input', () => { taskbarPinNameInput.dataset.autoFilled = 'false'; });
    }
});

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
            alert('Edge kiosk mode requires a URL or local file path.');
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
            alert('Kiosk mode requires a URL or local file path.');
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
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
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
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    edgeArgsModalContext = null;
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

function toggleExportSection(sectionId) {
    const section = dom.get(sectionId);
    if (!section) return;
    const isHidden = section.classList.contains('hidden');
    section.classList.toggle('hidden', !isHidden);
    section.setAttribute('aria-hidden', (!isHidden).toString());
    const toggle = document.querySelector(`[data-action="toggleExportSection"][data-arg="${sectionId}"]`);
    if (toggle) {
        toggle.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
    }
}

function updateExportAvailability() {
    const startLayoutBtn = dom.get('downloadStartLayoutBtn');
    if (!startLayoutBtn) return;
    const show = state.mode === 'multi' || state.mode === 'restricted';
    startLayoutBtn.classList.toggle('hidden', !show);
    startLayoutBtn.setAttribute('aria-hidden', (!show).toString());
}

function updateExportDetectedGuidance() {
    // This function is kept for compatibility but no longer hides/shows buttons dynamically
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
   Export Functions
   ============================================================================ */
function getConfigFileName(extension) {
    const configName = dom.get('configName').value.trim();
    if (configName) {
        // Sanitize: replace spaces with hyphens, remove invalid filename chars
        const sanitized = configName.replace(/\s+/g, '-').replace(/[<>:"/\\|?*]/g, '');
        return `AssignedAccess-${sanitized}.${extension}`;
    }
    return `AssignedAccessConfig.${extension}`;
}


function downloadXml() {
    if (!showValidation()) {
        if (!confirm('Configuration has errors. Download anyway?')) return;
    }

    const xml = generateXml();
    downloadFile(xml, getConfigFileName('xml'), 'application/xml');
}

function downloadPowerShell() {
    if (!showValidation()) {
        if (!confirm('Configuration has errors. Download anyway?')) return;
    }

    const xml = generateXml();

    // Generate shortcuts JSON for PowerShell
    // Exclude: UWP apps (packagedAppId - no .lnk needed), secondary tiles (Edge URLs - handled via XML), system shortcuts (already exist)
    // Single-app mode doesn't use Start Menu pins or taskbar, so skip shortcuts entirely
    const shortcutsJson = state.mode === 'single' ? '[]' : JSON.stringify(state.startPins
        .concat(state.taskbarPins || [])
        .filter(p => p.pinType !== 'packagedAppId' && p.pinType !== 'secondaryTile' && !p.systemShortcut)
        .map(p => ({
            Name: p.name || '',
            TargetPath: p.target || '',
            Arguments: p.args || '',
            WorkingDirectory: p.workingDir || '',
            IconLocation: p.iconPath || ''
        })), null, 4);

    // Generate Touch Keyboard auto-invoke registry block
    let touchKeyboardPs = '';
    if (dom.get('enableTouchKeyboard').checked) {
        touchKeyboardPs = `
    # Touch Keyboard - Force auto-invoke for touchscreen devices
    if (-not $ShortcutsOnly) {
        Write-Log -Action "Touch Keyboard" -Status "Info" -Message "Enabling auto-invoke for touchscreen devices"
        try {
            reg add "HKLM\\SOFTWARE\\Microsoft\\TabletTip\\1.7" /v EnableDesktopModeAutoInvoke /t REG_DWORD /d 1 /f | Out-Null
            reg add "HKLM\\SOFTWARE\\Microsoft\\TabletTip\\1.7" /v TouchKeyboardTapInvoke /t REG_DWORD /d 2 /f | Out-Null
            reg add "HKLM\\SOFTWARE\\Microsoft\\TabletTip\\1.7" /v DisableNewKeyboardExperience /t REG_DWORD /d 1 /f | Out-Null
            Write-Log -Action "Touch Keyboard" -Status "Success" -Message "Auto-invoke enabled"
        } catch {
            Write-Log -Action "Touch Keyboard" -Status "Warning" -Message $_.Exception.Message
        }
    }
`;
    }

    // Generate KioskOverseer Sentry scheduled task block
    let sentryPs = '';
    if (state.mode !== 'single' && dom.get('enableSentry').checked) {
        const appInfo = getSentryAppInfo();
        if (appInfo) {
            const interval = Math.max(5, parseInt(dom.get('sentryInterval').value) || 10);
            const escapedPath = appInfo.exePath.replace(/'/g, "''");
            const escapedArgs = appInfo.launchArgs.replace(/'/g, "''");
            const pName = appInfo.processName;
            const processCheck = appInfo.isBrowser
                ? `$running = Get-Process -Name $processName -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }`
                : `$running = Get-Process -Name $processName -ErrorAction SilentlyContinue`;

            sentryPs = `
    # KioskOverseer Sentry - Create scheduled task to relaunch app if closed
    if (-not $ShortcutsOnly) {
        Write-Log -Action "KioskOverseer Sentry" -Status "Info" -Message "Creating scheduled task for ${pName}"
        try {
            $sentryTaskName = "KioskOverseer-Sentry"

            # Remove existing sentry task if present
            $existing = Get-ScheduledTask -TaskName $sentryTaskName -ErrorAction SilentlyContinue
            if ($existing) {
                Unregister-ScheduledTask -TaskName $sentryTaskName -Confirm:$false
                Write-Log -Action "Removed existing sentry task" -Status "Info"
            }

            $sentryScript = @'
# KioskOverseer Sentry
$processName = '${pName}'
$exePath = [Environment]::ExpandEnvironmentVariables('${escapedPath}')
$launchArgs = '${escapedArgs}'
$cooldownSeconds = 10
$lastLaunch = [datetime]::MinValue

while ($true) {
    Start-Sleep -Seconds ${interval}
    ${processCheck}
    if (-not $running) {
        $now = Get-Date
        if (($now - $lastLaunch).TotalSeconds -ge $cooldownSeconds) {
            try {
                if ($launchArgs) {
                    Start-Process -FilePath $exePath -ArgumentList $launchArgs
                } else {
                    Start-Process -FilePath $exePath
                }
                $lastLaunch = $now
            } catch {
                $errMsg = $_.Exception.Message
                $errLog = Join-Path $env:ProgramData "KioskOverseer\\Logs\\KioskOverseer-Sentry.log"
                $now = Get-Date
                $line = '<![LOG[Failed to relaunch: {0}]LOG]!><time="{1}" date="{2}" component="KioskOverseer-Sentry" context="" type="3" thread="{3}" file="">' -f $errMsg, $now.ToString("HH:mm:ss.fffzz00"), $now.ToString("MM-dd-yyyy"), [System.Threading.Thread]::CurrentThread.ManagedThreadId
                $line | Out-File -Append -FilePath $errLog -Encoding UTF8
            }
        }
    }
}
'@

            $sentryPath = Join-Path $env:ProgramData "KioskOverseer\\KioskOverseer-Sentry.ps1"
            $sentryDir = Split-Path $sentryPath
            if (-not (Test-Path $sentryDir)) {
                New-Item -ItemType Directory -Path $sentryDir -Force | Out-Null
            }
            Set-Content -Path $sentryPath -Value $sentryScript -Encoding UTF8

            $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \`"$sentryPath\`""
            $trigger = New-ScheduledTaskTrigger -AtLogOn
            $principal = New-ScheduledTaskPrincipal -GroupId "BUILTIN\\Users" -RunLevel Limited
            $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

            Register-ScheduledTask -TaskName $sentryTaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "KioskOverseer Sentry - Relaunches app if closed" -Force | Out-Null

            Write-Log -Action "KioskOverseer Sentry created" -Status "Success" -Message "Task: $sentryTaskName, Process: ${pName}, Interval: ${interval}s"
        } catch {
            Write-Log -Action "KioskOverseer Sentry" -Status "Warning" -Message $_.Exception.Message
        }
    }
`;
        }
    }

    // Generate Edge Manifest Override block
    let manifestPs = '';
    if (state.mode !== 'single' && hasEdgeBackedDesktopLinks()) {
        manifestPs = `
    # Edge Manifest Override - Rename VisualElementsManifest so shortcuts keep custom name/icon
    if (-not $ShortcutsOnly) {
        Write-Log -Action "Edge Manifest Override" -Status "Info" -Message "Checking for Edge VisualElementsManifest files"
        try {
            $manifestTaskName = "KioskOverseer-EdgeVisualElements"

            # Remove existing manifest task if present
            $existingManifestTask = Get-ScheduledTask -TaskName $manifestTaskName -ErrorAction SilentlyContinue
            if ($existingManifestTask) {
                Unregister-ScheduledTask -TaskName $manifestTaskName -Confirm:$false
                Write-Log -Action "Removed existing manifest task" -Status "Info"
            }

            # Find and rename manifest files
            $manifestPaths = @()
            $pf = $env:ProgramFiles
            $pfx86 = [Environment]::GetEnvironmentVariable('ProgramFiles(x86)')
            if ($pf) { $manifestPaths += (Join-Path $pf "Microsoft\\Edge\\Application\\msedge.VisualElementsManifest.xml") }
            if ($pfx86) { $manifestPaths += (Join-Path $pfx86 "Microsoft\\Edge\\Application\\msedge.VisualElementsManifest.xml") }
            $manifestPaths = $manifestPaths | Select-Object -Unique

            $manifestRenamed = 0
            foreach ($mp in $manifestPaths) {
                $mpDir = Split-Path $mp -Parent
                $mpBackup = Join-Path $mpDir "msedge.VisualElementsManifest.xml.kioskoverseer.bak"
                if (Test-Path $mp) {
                    if (-not (Test-Path $mpBackup)) {
                        Rename-Item -Path $mp -NewName $mpBackup -ErrorAction Stop
                        Write-Log -Action "Edge Manifest Override" -Status "Success" -Message "Renamed manifest to backup: $mpBackup"
                    } else {
                        $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
                        $recreated = Join-Path $mpDir ("msedge.VisualElementsManifest.xml.kioskoverseer.recreated." + $stamp)
                        Rename-Item -Path $mp -NewName $recreated -ErrorAction Stop
                        Write-Log -Action "Edge Manifest Override" -Status "Info" -Message "Manifest recreated by Edge update, renamed to: $recreated"
                        # Trim old recreated files (keep 5)
                        $oldRecreated = Get-ChildItem -Path $mpDir -Filter "msedge.VisualElementsManifest.xml.kioskoverseer.recreated.*" -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -Skip 5
                        foreach ($old in $oldRecreated) {
                            Remove-Item $old.FullName -Force -ErrorAction SilentlyContinue
                        }
                    }
                    $manifestRenamed++
                } else {
                    Write-Log -Action "Edge Manifest Override" -Status "Info" -Message "Manifest not found at: $mp"
                }
            }

            if ($manifestRenamed -gt 0) {
                Write-Log -Action "Edge Manifest Override" -Status "Success" -Message "Renamed $manifestRenamed manifest file(s)"
            }

            # Create re-apply script for scheduled task (runs at startup to catch Edge updates)
            $manifestScript = @'
# KioskOverseer Edge Manifest Override - Re-apply after Edge updates
$mLogDir = Join-Path $env:ProgramData "KioskOverseer\\Logs"
if (-not (Test-Path $mLogDir)) { New-Item -ItemType Directory -Path $mLogDir -Force | Out-Null }
$mLogPath = Join-Path $mLogDir ("KioskOverseer-EdgeVisualElements_" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".log")

function Write-ManifestLog {
    param([string]$Msg, [int]$Type = 1)
    try {
        $now = Get-Date
        $line = '<![LOG[{0}]LOG]!><time="{1}" date="{2}" component="KioskOverseer-EdgeVisualElements" context="" type="{3}" thread="{4}" file="">' -f $Msg, $now.ToString("HH:mm:ss.fffzz00"), $now.ToString("MM-dd-yyyy"), $Type, [System.Threading.Thread]::CurrentThread.ManagedThreadId
        $line | Out-File -FilePath $mLogPath -Append -Encoding UTF8
    } catch { }
}

$mPaths = @()
$mPf = $env:ProgramFiles
$mPfx86 = [Environment]::GetEnvironmentVariable('ProgramFiles(x86)')
if ($mPf) { $mPaths += (Join-Path $mPf "Microsoft\\Edge\\Application\\msedge.VisualElementsManifest.xml") }
if ($mPfx86) { $mPaths += (Join-Path $mPfx86 "Microsoft\\Edge\\Application\\msedge.VisualElementsManifest.xml") }
$mPaths = $mPaths | Select-Object -Unique

foreach ($mp in $mPaths) {
    $dir = Split-Path $mp -Parent
    $backup = Join-Path $dir "msedge.VisualElementsManifest.xml.kioskoverseer.bak"
    if (Test-Path $mp) {
        if (-not (Test-Path $backup)) {
            try {
                Rename-Item -Path $mp -NewName $backup -ErrorAction Stop
                Write-ManifestLog "Renamed manifest to backup: $backup"
            } catch {
                Write-ManifestLog "Failed to rename manifest: $($_.Exception.Message)" -Type 3
            }
        } else {
            $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
            $recreated = Join-Path $dir ("msedge.VisualElementsManifest.xml.kioskoverseer.recreated." + $stamp)
            try {
                Rename-Item -Path $mp -NewName $recreated -ErrorAction Stop
                Write-ManifestLog "Edge update detected - renamed recreated manifest: $recreated" -Type 2
            } catch {
                Write-ManifestLog "Failed to rename recreated manifest: $($_.Exception.Message)" -Type 3
            }
            Get-ChildItem -Path $dir -Filter "msedge.VisualElementsManifest.xml.kioskoverseer.recreated.*" -File -ErrorAction SilentlyContinue |
                Sort-Object LastWriteTime -Descending | Select-Object -Skip 5 | ForEach-Object {
                    Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
                }
        }
    }
}
Write-ManifestLog "Edge manifest override check complete"
'@

            $manifestScriptPath = Join-Path $env:ProgramData "KioskOverseer\\KioskOverseer-EdgeVisualElements.ps1"
            $manifestScriptDir = Split-Path $manifestScriptPath
            if (-not (Test-Path $manifestScriptDir)) {
                New-Item -ItemType Directory -Path $manifestScriptDir -Force | Out-Null
            }
            Set-Content -Path $manifestScriptPath -Value $manifestScript -Encoding UTF8

            $manifestAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \`"$manifestScriptPath\`""
            $manifestTrigger = New-ScheduledTaskTrigger -AtStartup
            $manifestPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
            $manifestSettings = New-ScheduledTaskSettingsSet -Compatibility Win8 -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

            Register-ScheduledTask -TaskName $manifestTaskName -Action $manifestAction -Trigger $manifestTrigger -Principal $manifestPrincipal -Settings $manifestSettings -Description "KioskOverseer - Re-applies Edge manifest rename after Edge updates" -Force | Out-Null

            Write-Log -Action "Edge Manifest Override" -Status "Success" -Message "Scheduled task created: $manifestTaskName"
        } catch {
            Write-Log -Action "Edge Manifest Override" -Status "Warning" -Message $_.Exception.Message
        }
    }
`;
    }

    const ps1 = `#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Applies AssignedAccess (Kiosk) configuration to the local device.
.DESCRIPTION
    This script must be run as SYSTEM. Use PsExec:
    psexec.exe -i -s powershell.exe -ExecutionPolicy Bypass -File "AssignedAccess-<Config>.ps1"

    To create shortcuts only (without applying AssignedAccess), run as Administrator:
    powershell.exe -ExecutionPolicy Bypass -File "AssignedAccess-<Config>.ps1" -ShortcutsOnly
.PARAMETER ShortcutsOnly
    When specified, only creates Start Menu shortcuts without applying the AssignedAccess configuration.
    Does not require SYSTEM context - can be run as Administrator.
.NOTES
    Generated by Kiosk Overseer
    Reboot required after applying (not needed for -ShortcutsOnly).
    Creates a CMTrace-compatible log file in %ProgramData%\\KioskOverseer\\Logs.
    If Windows blocks the script, right-click the .ps1 file, choose Properties, then Unblock.
#>
param(
    [switch]$ShortcutsOnly
)

$ErrorActionPreference = "Stop"

# Initialize logging
$scriptName = if ($ShortcutsOnly) { "KioskOverseer-Shortcuts" } else { "KioskOverseer-Apply-AssignedAccess" }
$logDir = Join-Path $env:ProgramData "KioskOverseer\\Logs"
if (-not (Test-Path $logDir)) {
    try { New-Item -ItemType Directory -Path $logDir -Force | Out-Null } catch { }
}
$logFile = Join-Path $logDir ($scriptName + "_" + (Get-Date -Format 'yyyyMMdd-HHmmss') + ".log")
$windowsBuild = $null
try {
    $windowsBuild = (Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion" -ErrorAction Stop).DisplayVersion
} catch {
    $windowsBuild = "Unknown"
}
$log = @{
    startTime = (Get-Date).ToString("o")
    computerName = $env:COMPUTERNAME
    userName = $env:USERNAME
    windowsVersion = [System.Environment]::OSVersion.Version.ToString()
    windowsBuild = $windowsBuild
    windowsEdition = $null
    executionContext = $null
    preFlightPassed = $false
    steps = @()
    success = $false
    xmlLength = $null
    endTime = $null
}

function Write-Log {
    param([string]$Action, [string]$Status, [string]$Message = "", [hashtable]$Data = $null)
    $log.steps += @{ timestamp = (Get-Date).ToString("o"); level = $Status; event = $Action; message = $Message }

    $color = switch ($Status) {
        "Success" { "Green" }
        "Warning" { "Yellow" }
        "Error" { "Red" }
        default { "Cyan" }
    }
    Write-Host "[$Status] $Action" -ForegroundColor $color
    if ($Message) { Write-Host "    $Message" -ForegroundColor Gray }

    $cmType = switch ($Status) { "Error" { 3 } "Warning" { 2 } default { 1 } }
    $dataStr = if ($Data) { " | " + ($Data.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join ", " } else { "" }
    $logMsg = "[$Action] $Message$dataStr"
    $now = Get-Date
    $line = '<![LOG[{0}]LOG]!><time="{1}" date="{2}" component="{3}" context="" type="{4}" thread="{5}" file="">' -f $logMsg, $now.ToString("HH:mm:ss.fffzz00"), $now.ToString("MM-dd-yyyy"), $scriptName, $cmType, [System.Threading.Thread]::CurrentThread.ManagedThreadId
    try { $line | Out-File -FilePath $logFile -Append -Encoding UTF8 } catch { }
}

function Save-Log {
    $log.endTime = (Get-Date).ToString("o")
    $summaryMsg = "Summary: Computer=$($log.computerName), User=$($log.userName), Windows=$($log.windowsVersion) ($($log.windowsBuild)), Edition=$($log.windowsEdition), Context=$($log.executionContext), PreFlight=$($log.preFlightPassed), Success=$($log.success), XMLLength=$($log.xmlLength), Start=$($log.startTime), End=$($log.endTime)"
    $now = Get-Date
    $line = '<![LOG[{0}]LOG]!><time="{1}" date="{2}" component="{3}" context="" type="1" thread="{4}" file="">' -f $summaryMsg, $now.ToString("HH:mm:ss.fffzz00"), $now.ToString("MM-dd-yyyy"), $scriptName, [System.Threading.Thread]::CurrentThread.ManagedThreadId
    try { $line | Out-File -FilePath $logFile -Append -Encoding UTF8 } catch { }
}

# Start Menu Shortcuts to create (JSON parsed at runtime)
$shortcutsJson = @'
${shortcutsJson}
'@
$shortcuts = @()
if ($shortcutsJson.Trim() -ne '[]' -and $shortcutsJson.Trim() -ne '') {
    try {
        $parsed = $shortcutsJson | ConvertFrom-Json
        # Ensure it's always an array (single object needs wrapping)
        if ($null -ne $parsed) {
            if ($parsed -is [System.Array]) {
                $shortcuts = $parsed
            } else {
                $shortcuts = @($parsed)
            }
        }
    } catch {
        Write-Log -Action "Parse shortcuts JSON" -Status "Warning" -Message $_.Exception.Message
    }
}

# Function to create shortcuts
function New-Shortcut {
    param(
        [string]$Name,
        [string]$TargetPath,
        [string]$Arguments,
        [string]$WorkingDirectory,
        [string]$IconLocation
    )

    $shortcutDir = Join-Path $env:ALLUSERSPROFILE "Microsoft\\Windows\\Start Menu\\Programs"
    if (-not (Test-Path $shortcutDir)) {
        New-Item -ItemType Directory -Path $shortcutDir -Force -ErrorAction Stop | Out-Null
    }

    $shortcutPath = Join-Path $shortcutDir "$Name.lnk"
    $existed = Test-Path $shortcutPath

    # Expand environment variables in paths
    $expandedTarget = [Environment]::ExpandEnvironmentVariables($TargetPath)

    $WshShell = New-Object -ComObject WScript.Shell
    $shortcut = $WshShell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $expandedTarget

    if ($Arguments) {
        $shortcut.Arguments = $Arguments
    }
    if ($WorkingDirectory) {
        $shortcut.WorkingDirectory = $WorkingDirectory
    }
    if ($IconLocation) {
        $shortcut.IconLocation = $IconLocation
    }

    $shortcut.Save()

    return @{ Path = $shortcutPath; Overwritten = $existed }
}

# AssignedAccess Configuration XML
$xml = @'
${xml}
'@

$modeMessage = if ($ShortcutsOnly) { "Shortcuts Only Mode" } else { "AssignedAccess Deploy Script" }
Write-Log -Action "Script start" -Status "Info" -Message $modeMessage
Write-Log -Action "Pre-flight checks" -Status "Info"

try {
    # Check 1: Windows Edition (required for both modes)
    $edition = (Get-WindowsEdition -Online).Edition
    $log.windowsEdition = $edition
    $supportedEditions = @("Pro", "Enterprise", "Education", "IoTEnterprise", "IoTEnterpriseS", "ServerRdsh")
    $isSupported = $supportedEditions | Where-Object { $edition -like "*$_*" }
    if (-not $isSupported) {
        Write-Log -Action "Windows Edition Check" -Status "Error" -Message "Unsupported edition: $edition. AssignedAccess requires Enterprise, Education, or IoT Enterprise."
        Save-Log
        exit 1
    }
    Write-Log -Action "Windows Edition Check" -Status "Success" -Message $edition

    # Check 2: Running as SYSTEM (skip for ShortcutsOnly mode)
    $currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent()
    $log.executionContext = $currentUser.Name
    if (-not $ShortcutsOnly) {
        $isSystem = $currentUser.User.Value -eq "S-1-5-18"
        if (-not $isSystem) {
            Write-Log -Action "SYSTEM Context Check" -Status "Error" -Message "Running as: $($currentUser.Name). Must run as SYSTEM. Use: psexec.exe -i -s powershell.exe -ExecutionPolicy Bypass -File \`"$PSCommandPath\`""
            Save-Log
            exit 1
        }
        Write-Log -Action "SYSTEM Context Check" -Status "Success"

        # Check 3: MDM_AssignedAccess WMI instance exists (skip for ShortcutsOnly mode)
        $obj = Get-CimInstance -Namespace "root\\cimv2\\mdm\\dmmap" -ClassName "MDM_AssignedAccess" -ErrorAction SilentlyContinue
        if ($null -eq $obj) {
            Write-Log -Action "MDM_AssignedAccess WMI Check" -Status "Error" -Message "WMI instance not found. This may indicate an unsupported Windows configuration or WMI corruption."
            Save-Log
            exit 1
        }
        Write-Log -Action "MDM_AssignedAccess WMI Check" -Status "Success"
    } else {
        Write-Log -Action "SYSTEM Context Check" -Status "Info" -Message "Skipped (ShortcutsOnly mode) - Running as: $($currentUser.Name)"
        Write-Log -Action "MDM_AssignedAccess WMI Check" -Status "Info" -Message "Skipped (ShortcutsOnly mode)"
    }

    $log.preFlightPassed = $true
    Write-Log -Action "Pre-flight checks passed" -Status "Success" -Message "Proceeding with deployment"
}
catch {
    Write-Log -Action "Pre-flight check failed" -Status "Error" -Message $_.Exception.Message
    Save-Log
    exit 1
}

try {
    Write-Log -Action "Starting deployment" -Status "Info" -Message "Target: $env:COMPUTERNAME"
${sentryPs}
${touchKeyboardPs}
${manifestPs}
    # Skip audit logging setup in ShortcutsOnly mode
    if (-not $ShortcutsOnly) {
        # Enable audit logging for process creation and command-line capture
        Write-Log -Action "Enable process creation auditing" -Status "Info"
        try {
            auditpol /set /subcategory:"Process Creation" /success:enable /failure:enable | Out-Null
            Write-Log -Action "Process creation auditing enabled" -Status "Success"
        } catch {
            Write-Log -Action "Process creation auditing failed" -Status "Warning" -Message $_.Exception.Message
        }

        Write-Log -Action "Enable command-line capture" -Status "Info"
        try {
            reg add "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System\\Audit" /v ProcessCreationIncludeCmdLine_Enabled /t REG_DWORD /d 1 /f | Out-Null
            Write-Log -Action "Command-line capture enabled" -Status "Success"
        } catch {
            Write-Log -Action "Command-line capture failed" -Status "Warning" -Message $_.Exception.Message
        }

        Write-Log -Action "Increase Security log size" -Status "Info" -Message "Setting to 512MB"
        try {
            wevtutil sl Security /ms:536870912 | Out-Null
            Write-Log -Action "Security log size updated" -Status "Success"
        } catch {
            Write-Log -Action "Security log size update failed" -Status "Warning" -Message $_.Exception.Message
        }

        # Enable diagnostic event log channels for Assigned Access and AppLocker
        Write-Log -Action "Enable diagnostic event logs" -Status "Info"
        $diagLogs = @(
            'Microsoft-Windows-AssignedAccess/Operational',
            'Microsoft-Windows-AssignedAccess/Admin',
            'Microsoft-Windows-AppLocker/EXE and DLL',
            'Microsoft-Windows-AppLocker/MSI and Script',
            'Microsoft-Windows-AppLocker/Packaged app-Execution',
            'Microsoft-Windows-AppLocker/Packaged app-Deployment',
            'Microsoft-Windows-AppXDeployment/Operational',
            'Microsoft-Windows-AppXDeploymentServer/Operational'
        )
        foreach ($logName in $diagLogs) {
            try {
                wevtutil sl $logName /e:true 2>$null
                Write-Log -Action "Enabled log: $logName" -Status "Success"
            } catch {
                Write-Log -Action "Enable log: $logName" -Status "Warning" -Message $_.Exception.Message
            }
        }

        # Clear existing AssignedAccess configuration
        Write-Log -Action "Clearing existing AssignedAccess" -Status "Info"
        try {
            $currentConfig = $obj.Configuration
            if ($currentConfig -and $currentConfig.Trim() -ne "") {
                $obj.Configuration = ""
                Set-CimInstance -CimInstance $obj -ErrorAction Stop
                Write-Log -Action "Existing configuration cleared" -Status "Success"
                # Re-fetch the object for the new configuration
                $obj = Get-CimInstance -Namespace "root\\cimv2\\mdm\\dmmap" -ClassName "MDM_AssignedAccess" -ErrorAction Stop
            } else {
                Write-Log -Action "No existing configuration" -Status "Info" -Message "Skipping clear step"
            }
        } catch {
            Write-Log -Action "Clear existing configuration" -Status "Warning" -Message $_.Exception.Message
        }
    }

    # Create Start Menu shortcuts
    if ($shortcuts.Count -gt 0) {
        Write-Log -Action "Creating Start Menu shortcuts" -Status "Info" -Message "$($shortcuts.Count) shortcut(s) to create"
        foreach ($sc in $shortcuts) {
            # Skip shortcuts with empty name or target
            if ([string]::IsNullOrWhiteSpace($sc.Name) -or [string]::IsNullOrWhiteSpace($sc.TargetPath)) {
                Write-Log -Action "Skipped shortcut" -Status "Warning" -Message "Missing name or target path"
                continue
            }
            try {
                $result = New-Shortcut -Name $sc.Name -TargetPath $sc.TargetPath -Arguments $sc.Arguments -WorkingDirectory $sc.WorkingDirectory -IconLocation $sc.IconLocation
                if ($result.Overwritten) {
                    Write-Log -Action "Overwrote shortcut" -Status "Warning" -Message $result.Path
                } else {
                    Write-Log -Action "Created shortcut" -Status "Success" -Message $result.Path
                }
            }
            catch {
                Write-Log -Action "Failed to create shortcut" -Status "Warning" -Message "$($sc.Name): $($_.Exception.Message)"
            }
        }
    } else {
        Write-Log -Action "Creating Start Menu shortcuts" -Status "Info" -Message "No shortcuts to create"
    }

    # Skip XML application in ShortcutsOnly mode
    if ($ShortcutsOnly) {
        $log.success = $true
        Write-Log -Action "Shortcuts complete" -Status "Success" -Message "Start Menu shortcuts created (ShortcutsOnly mode)"
        Save-Log
    } else {
        # HTML encode the XML and apply
        Write-Log -Action "Encoding XML configuration" -Status "Info"
        $log.xmlLength = $xml.Length
        $encodedXml = [System.Net.WebUtility]::HtmlEncode($xml)
        Write-Log -Action "XML encoded" -Status "Success" -Message "Original: $($xml.Length) chars, Encoded: $($encodedXml.Length) chars"

        Write-Log -Action "Applying configuration" -Status "Info"
        $obj.Configuration = $encodedXml
        Set-CimInstance -CimInstance $obj -ErrorAction Stop
        Write-Log -Action "Configuration applied" -Status "Success"

        $log.success = $true

        Write-Log -Action "Deployment complete" -Status "Success" -Message "AssignedAccess configuration applied"
        Write-Log -Action "Reboot required" -Status "Warning" -Message "Changes take effect after reboot"

        Write-Log -Action "Reboot prompt" -Status "Info" -Message "Prompting to reboot"
        $reboot = Read-Host "Reboot now? (Y/N)"
        if ($reboot -eq 'Y' -or $reboot -eq 'y') {
            Write-Log -Action "User initiated reboot" -Status "Info"
            Save-Log
            Restart-Computer -Force
        } else {
            Write-Log -Action "Reboot skipped" -Status "Info"
            Save-Log
        }
    }
}
catch {
    Write-Log -Action "Deployment failed" -Status "Error" -Message $_.Exception.Message
    Write-Log -Action "Troubleshooting" -Status "Info" -Message "Common causes: Invalid XML configuration; Referenced user account does not exist; Referenced app is not installed."
    Save-Log
    exit 1
}
`;

    downloadFile(ps1, getConfigFileName('ps1'), 'text/plain');

    // Also download the README summary
    const readme = generateReadme();
    setTimeout(() => {
        downloadFile(readme, 'README.md', 'text/markdown');
    }, 100);
}

function downloadShortcutsScript() {
    // Single-app mode doesn't use Start Menu pins or taskbar
    if (state.mode === 'single') {
        alert('Shortcut Creator is not needed for single-app kiosks. Single-app mode runs one app fullscreen without Start Menu access.');
        return;
    }

    if (!showValidation()) {
        if (!confirm('Configuration has errors. Download anyway?')) return;
    }

    const edgeWarningPins = getEdgeShortcutWarningPins();
    const edgeWarningComment = edgeWarningPins.length > 0
        ? `# WARNING: Some Edge-backed shortcuts may not display custom name/icon in Assigned Access.\n# Affected pins: ${edgeWarningPins.join(', ')}\n\n`
        : '';

    // Generate shortcuts JSON for PowerShell
    // Exclude: UWP apps (packagedAppId - no .lnk needed), secondary tiles (Edge URLs - handled via XML), system shortcuts (already exist)
    const shortcutsJson = JSON.stringify(state.startPins
        .concat(state.taskbarPins || [])
        .filter(p => p.pinType !== 'packagedAppId' && p.pinType !== 'secondaryTile' && !p.systemShortcut)
        .map(p => ({
            Name: p.name || '',
            TargetPath: p.target || '',
            Arguments: p.args || '',
            WorkingDirectory: p.workingDir || '',
            IconLocation: p.iconPath || ''
        })), null, 4);

    const ps1 = `#Requires -RunAsAdministrator
${edgeWarningComment}<#
.SYNOPSIS
    Creates Start Menu shortcuts required by AssignedAccess StartPins.
.DESCRIPTION
    This script creates .lnk files under the Start Menu Programs folder.
    Use when deploying XML via Intune/OMA-URI and you only need shortcuts.
.NOTES
    Generated by Kiosk Overseer
    If Windows blocks the script, right-click the .ps1 file, choose Properties, then Unblock.
#>

$ErrorActionPreference = "Stop"

# Initialize logging
$scriptName = "KioskOverseer-Shortcut-Creator"
$logDir = Join-Path $env:ProgramData "KioskOverseer\\Logs"
if (-not (Test-Path $logDir)) {
    try { New-Item -ItemType Directory -Path $logDir -Force | Out-Null } catch { }
}
$logFile = Join-Path $logDir ($scriptName + "_" + (Get-Date -Format 'yyyyMMdd-HHmmss') + ".log")

function Write-Log {
    param(
        [string]$Level,
        [string]$Event,
        [string]$Message,
        [hashtable]$Data = $null
    )
    $cmType = switch ($Level) { "ERROR" { 3 } "WARN" { 2 } default { 1 } }
    $dataStr = if ($Data) { " | " + (($Data.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join ", ") } else { "" }
    $logMsg = "[$Event] $Message$dataStr"
    $now = Get-Date
    $line = '<![LOG[{0}]LOG]!><time="{1}" date="{2}" component="{3}" context="" type="{4}" thread="{5}" file="">' -f $logMsg, $now.ToString("HH:mm:ss.fffzz00"), $now.ToString("MM-dd-yyyy"), $scriptName, $cmType, [System.Threading.Thread]::CurrentThread.ManagedThreadId
    try { $line | Out-File -FilePath $logFile -Append -Encoding UTF8 } catch { }
}

Write-Log -Level "INFO" -Event "Script start" -Message "Shortcut Creator started"

# Start Menu Shortcuts to create (JSON parsed at runtime)
$shortcutsJson = @'
${shortcutsJson}
'@
$shortcuts = @()
if ($shortcutsJson.Trim() -ne '[]' -and $shortcutsJson.Trim() -ne '') {
    try {
        $parsed = $shortcutsJson | ConvertFrom-Json
        # Ensure it's always an array (single object needs wrapping)
        if ($null -ne $parsed) {
            if ($parsed -is [System.Array]) {
                $shortcuts = $parsed
            } else {
                $shortcuts = @($parsed)
            }
        }
    } catch {
        Write-Log -Level "WARN" -Event "parse_shortcuts_json" -Message $_.Exception.Message
    }
}

function New-Shortcut {
    param(
        [string]$Name,
        [string]$TargetPath,
        [string]$Arguments,
        [string]$WorkingDirectory,
        [string]$IconLocation
    )

    $shortcutDir = Join-Path $env:ALLUSERSPROFILE "Microsoft\\Windows\\Start Menu\\Programs"
    if (-not (Test-Path $shortcutDir)) {
        New-Item -ItemType Directory -Path $shortcutDir -Force -ErrorAction Stop | Out-Null
    }

    $shortcutPath = Join-Path $shortcutDir "$Name.lnk"
    $existed = Test-Path $shortcutPath

    # Expand environment variables in paths
    $expandedTarget = [Environment]::ExpandEnvironmentVariables($TargetPath)

    $WshShell = New-Object -ComObject WScript.Shell
    $shortcut = $WshShell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $expandedTarget

    if ($Arguments) {
        $shortcut.Arguments = $Arguments
    }
    if ($WorkingDirectory) {
        $shortcut.WorkingDirectory = $WorkingDirectory
    }
    if ($IconLocation) {
        $shortcut.IconLocation = $IconLocation
    }

    $shortcut.Save()

    return @{ Path = $shortcutPath; Overwritten = $existed }
}

if ($shortcuts.Count -eq 0) {
    Write-Host "No shortcuts to create." -ForegroundColor Yellow
    Write-Log -Level "WARN" -Event "no_shortcuts" -Message "No shortcuts to create."
    exit 0
}

Write-Host "Creating Start Menu shortcuts..." -ForegroundColor Cyan
Write-Log -Level "INFO" -Event "create_shortcuts" -Message "Creating Start Menu shortcuts" -Data @{ count = $shortcuts.Count }
foreach ($sc in $shortcuts) {
    if ([string]::IsNullOrWhiteSpace($sc.Name) -or [string]::IsNullOrWhiteSpace($sc.TargetPath)) {
        Write-Host "[WARN] Skipped shortcut with missing name or target." -ForegroundColor Yellow
        Write-Log -Level "WARN" -Event "skip_shortcut" -Message "Skipped shortcut with missing name or target." -Data @{ name = $sc.Name; target = $sc.TargetPath }
        continue
    }
    try {
        $result = New-Shortcut -Name $sc.Name -TargetPath $sc.TargetPath -Arguments $sc.Arguments -WorkingDirectory $sc.WorkingDirectory -IconLocation $sc.IconLocation
        if ($result.Overwritten) {
            Write-Host "[WARN] Overwrote: $($sc.Name) -> $($result.Path)" -ForegroundColor Yellow
            Write-Log -Level "WARN" -Event "shortcut_overwritten" -Message "Overwrote existing shortcut" -Data @{ name = $sc.Name; path = $result.Path }
        } else {
            Write-Host "[OK] Created: $($sc.Name) -> $($result.Path)" -ForegroundColor Green
            Write-Log -Level "INFO" -Event "shortcut_created" -Message "Created shortcut" -Data @{ name = $sc.Name; path = $result.Path }
        }
    }
    catch {
        Write-Host "[WARN] Failed to create: $($sc.Name) - $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Log -Level "ERROR" -Event "shortcut_failed" -Message $_.Exception.Message -Data @{ name = $sc.Name }
    }
}

# Create sentinel file for Intune Win32 app detection
$sentinelDir = Join-Path $env:ProgramData "KioskOverseer"
if (-not (Test-Path $sentinelDir)) {
    try { New-Item -ItemType Directory -Path $sentinelDir -Force | Out-Null } catch { }
}
$sentinelPath = Join-Path $sentinelDir "ShortcutCreator.installed"
try {
    New-Item -Path $sentinelPath -ItemType File -Force | Out-Null
    Write-Log -Level "INFO" -Event "sentinel_created" -Message "Created detection sentinel file" -Data @{ path = $sentinelPath }
} catch {
    Write-Log -Level "WARN" -Event "sentinel_failed" -Message "Failed to create sentinel file" -Data @{ path = $sentinelPath; error = $_.Exception.Message }
}

Write-Log -Level "INFO" -Event "complete" -Message "Shortcut Creator complete"
`;

    const configName = dom.get('configName').value.trim();
    const suffix = configName ? configName.replace(/\s+/g, '-').replace(/[<>:"/\\|?*]/g, '') : 'Config';
    downloadFile(ps1, `CreateShortcuts_${suffix}.ps1`, 'text/plain');
}

function downloadEdgeManifestWorkaround() {
    const installScript = `#Requires -RunAsAdministrator
[CmdletBinding()]
param()

$scriptName = "KioskOverseer-EdgeVisualElements-Install"

function Write-Log {
    param(
        [string]$Level,
        [string]$Event,
        [string]$Message,
        [hashtable]$Data = $null
    )
    try {
        $logDir = Join-Path $env:ProgramData "KioskOverseer\\Logs"
        if (-not (Test-Path $logDir)) {
            New-Item -ItemType Directory -Path $logDir -Force | Out-Null
        }
        if (-not $script:LogPath) {
            $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
            $script:LogPath = Join-Path $logDir ($scriptName + "_" + $timestamp + ".log")
        }
        $cmType = switch ($Level) { "ERROR" { 3 } "WARN" { 2 } default { 1 } }
        $dataStr = if ($Data) { " | " + (($Data.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join ", ") } else { "" }
        $logMsg = "[$Event] $Message$dataStr"
        $now = Get-Date
        $line = '<![LOG[{0}]LOG]!><time="{1}" date="{2}" component="{3}" context="" type="{4}" thread="{5}" file="">' -f $logMsg, $now.ToString("HH:mm:ss.fffzz00"), $now.ToString("MM-dd-yyyy"), $scriptName, $cmType, [System.Threading.Thread]::CurrentThread.ManagedThreadId
        $line | Out-File -FilePath $script:LogPath -Append -Encoding UTF8
    } catch {
        # Logging must never block execution
    }
}

function Test-Admin {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-ManifestPaths {
    $paths = @()
    $pf = $env:ProgramFiles
    $pfx86 = [Environment]::GetEnvironmentVariable('ProgramFiles(x86)')
    if ($pf) {
        $paths += (Join-Path $pf "Microsoft\\Edge\\Application\\msedge.VisualElementsManifest.xml")
    }
    if ($pfx86) {
        $paths += (Join-Path $pfx86 "Microsoft\\Edge\\Application\\msedge.VisualElementsManifest.xml")
    }
    return $paths | Select-Object -Unique
}

function Get-RecreatedFiles {
    param([string]$Directory)
    if (-not (Test-Path $Directory)) { return @() }
    Get-ChildItem -Path $Directory -Filter "msedge.VisualElementsManifest.xml.kioskoverseer.recreated.*" -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending
}

function Trim-RecreatedFiles {
    param([string]$Directory)
    $files = Get-RecreatedFiles -Directory $Directory
    if ($files.Count -le 5) { return }
    $files | Select-Object -Skip 5 | ForEach-Object {
        try {
            Remove-Item $_.FullName -Force -ErrorAction Stop
            Write-Log -Level "INFO" -Event "cleanup_recreated" -Message "Removed old recreated file" -Data @{ path = $_.FullName }
        } catch {
            Write-Log -Level "WARN" -Event "cleanup_recreated_failed" -Message $_.Exception.Message -Data @{ path = $_.FullName }
        }
    }
}

function Apply-ManifestRename {
    param([string]$ManifestPath)
    $dir = Split-Path $ManifestPath -Parent
    $backup = Join-Path $dir "msedge.VisualElementsManifest.xml.kioskoverseer.bak"
    if (Test-Path $ManifestPath) {
        if (-not (Test-Path $backup)) {
            try {
                Rename-Item -Path $ManifestPath -NewName $backup -ErrorAction Stop
                Write-Log -Level "INFO" -Event "backup_created" -Message "Renamed live manifest to backup" -Data @{ path = $ManifestPath; backup = $backup }
            } catch {
                Write-Log -Level "ERROR" -Event "backup_failed" -Message $_.Exception.Message -Data @{ path = $ManifestPath; backup = $backup }
            }
        } else {
            $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
            $recreated = Join-Path $dir ("msedge.VisualElementsManifest.xml.kioskoverseer.recreated." + $stamp)
            try {
                Rename-Item -Path $ManifestPath -NewName $recreated -ErrorAction Stop
                Write-Log -Level "WARN" -Event "live_manifest_recreated" -Message "Live manifest renamed because backup already exists" -Data @{ path = $ManifestPath; recreated = $recreated }
            } catch {
                Write-Log -Level "ERROR" -Event "recreated_rename_failed" -Message $_.Exception.Message -Data @{ path = $ManifestPath; recreated = $recreated }
            }
            Trim-RecreatedFiles -Directory $dir
        }
    } else {
        Write-Log -Level "INFO" -Event "manifest_missing" -Message "Manifest not found; nothing to rename" -Data @{ path = $ManifestPath }
    }
}

function Register-StartupTask {
    $taskName = "KioskOverseer-EdgeVisualElements"
    $scriptPath = $MyInvocation.MyCommand.Path
    if (-not $scriptPath) {
        Write-Log -Level "ERROR" -Event "task_register_failed" -Message "Cannot resolve script path for scheduled task"
        return
    }
    $argument = '-NoProfile -ExecutionPolicy Bypass -File "' + $scriptPath + '"'
    $action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument $argument
    $trigger = New-ScheduledTaskTrigger -AtStartup
    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
    $settings = New-ScheduledTaskSettingsSet -Compatibility Win8 -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
    try {
        Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
        Write-Log -Level "INFO" -Event "task_registered" -Message "Scheduled task registered/updated" -Data @{ task = $taskName }
    } catch {
        Write-Log -Level "ERROR" -Event "task_register_failed" -Message $_.Exception.Message -Data @{ task = $taskName }
    }
}

if (-not (Test-Admin)) {
    Write-Log -Level "ERROR" -Event "admin_required" -Message "Administrator privileges are required."
    exit 1
}

$osCaption = (Get-CimInstance Win32_OperatingSystem).Caption
if ($osCaption -notmatch "Windows 11") {
    Write-Log -Level "WARN" -Event "os_check" -Message "This script is intended for Windows 11; continuing anyway." -Data @{ caption = $osCaption }
} else {
    Write-Log -Level "INFO" -Event "os_check" -Message "Windows 11 detected." -Data @{ caption = $osCaption }
}

$paths = Get-ManifestPaths
foreach ($path in $paths) {
    Apply-ManifestRename -ManifestPath $path
}

Register-StartupTask
Write-Log -Level "INFO" -Event "complete" -Message "Edge VisualElements workaround applied."
`;

    const removeScript = `#Requires -RunAsAdministrator
[CmdletBinding()]
param(
    [switch]$CleanupRecreatedFiles
)

$scriptName = "KioskOverseer-EdgeVisualElements-Remove"

function Write-Log {
    param(
        [string]$Level,
        [string]$Event,
        [string]$Message,
        [hashtable]$Data = $null
    )
    try {
        $logDir = Join-Path $env:ProgramData "KioskOverseer\\Logs"
        if (-not (Test-Path $logDir)) {
            New-Item -ItemType Directory -Path $logDir -Force | Out-Null
        }
        if (-not $script:LogPath) {
            $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
            $script:LogPath = Join-Path $logDir ($scriptName + "_" + $timestamp + ".log")
        }
        $cmType = switch ($Level) { "ERROR" { 3 } "WARN" { 2 } default { 1 } }
        $dataStr = if ($Data) { " | " + (($Data.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join ", ") } else { "" }
        $logMsg = "[$Event] $Message$dataStr"
        $now = Get-Date
        $line = '<![LOG[{0}]LOG]!><time="{1}" date="{2}" component="{3}" context="" type="{4}" thread="{5}" file="">' -f $logMsg, $now.ToString("HH:mm:ss.fffzz00"), $now.ToString("MM-dd-yyyy"), $scriptName, $cmType, [System.Threading.Thread]::CurrentThread.ManagedThreadId
        $line | Out-File -FilePath $script:LogPath -Append -Encoding UTF8
    } catch {
        # Logging must never block execution
    }
}

function Test-Admin {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-ManifestPaths {
    $paths = @()
    $pf = $env:ProgramFiles
    $pfx86 = [Environment]::GetEnvironmentVariable('ProgramFiles(x86)')
    if ($pf) {
        $paths += (Join-Path $pf "Microsoft\\Edge\\Application\\msedge.VisualElementsManifest.xml")
    }
    if ($pfx86) {
        $paths += (Join-Path $pfx86 "Microsoft\\Edge\\Application\\msedge.VisualElementsManifest.xml")
    }
    return $paths | Select-Object -Unique
}

function Cleanup-Recreated {
    param([string]$Directory)
    if (-not (Test-Path $Directory)) { return }
    Get-ChildItem -Path $Directory -Filter "msedge.VisualElementsManifest.xml.kioskoverseer.recreated.*" -File -ErrorAction SilentlyContinue |
        ForEach-Object {
            try {
                Remove-Item $_.FullName -Force -ErrorAction Stop
                Write-Log -Level "INFO" -Event "cleanup_recreated" -Message "Removed recreated file" -Data @{ path = $_.FullName }
            } catch {
                Write-Log -Level "WARN" -Event "cleanup_recreated_failed" -Message $_.Exception.Message -Data @{ path = $_.FullName }
            }
        }
}

if (-not (Test-Admin)) {
    Write-Log -Level "ERROR" -Event "admin_required" -Message "Administrator privileges are required."
    exit 1
}

$taskName = "KioskOverseer-EdgeVisualElements"
try {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction Stop
    Write-Log -Level "INFO" -Event "task_removed" -Message "Scheduled task removed" -Data @{ task = $taskName }
} catch {
    Write-Log -Level "WARN" -Event "task_remove_failed" -Message $_.Exception.Message -Data @{ task = $taskName }
}

$paths = Get-ManifestPaths
foreach ($path in $paths) {
    $dir = Split-Path $path -Parent
    $backup = Join-Path $dir "msedge.VisualElementsManifest.xml.kioskoverseer.bak"
    if ((Test-Path $backup) -and -not (Test-Path $path)) {
        try {
            Rename-Item -Path $backup -NewName $path -ErrorAction Stop
            Write-Log -Level "INFO" -Event "restore_backup" -Message "Restored backup manifest" -Data @{ backup = $backup; path = $path }
        } catch {
            Write-Log -Level "ERROR" -Event "restore_failed" -Message $_.Exception.Message -Data @{ backup = $backup; path = $path }
        }
    } elseif ((Test-Path $backup) -and (Test-Path $path)) {
        Write-Log -Level "WARN" -Event "restore_skipped" -Message "Both live manifest and backup exist; no overwrite performed." -Data @{ backup = $backup; path = $path }
    } else {
        Write-Log -Level "INFO" -Event "backup_missing" -Message "Backup manifest not found; nothing to restore." -Data @{ backup = $backup; path = $path }
    }

    if ($CleanupRecreatedFiles) {
        Cleanup-Recreated -Directory $dir
    }
}

Write-Log -Level "INFO" -Event "complete" -Message "Edge VisualElements workaround removed."
`;

    const readme = `Kiosk Overseer
Author: Joshua Walderbach

Edge VisualElements Workaround (Advanced / Unsupported)

What this does:
- Renames Edge's Visual Elements manifest file (msedge.VisualElementsManifest.xml) so
  Assigned Access shortcuts are less likely to be forced into Edge's default name/icon.
- Installs a scheduled task that reapplies the rename at startup (to handle Edge updates).

Important:
- This workaround is NOT supported or documented by Microsoft.
- Edge updates may restore or replace the manifest at any time.
- Use only on managed kiosk devices where you control Edge updates.

How to install:
1) Run KioskOverseer-EdgeVisualElements-Install.ps1 as Administrator.

How to remove:
1) Run KioskOverseer-EdgeVisualElements-Remove.ps1 as Administrator.
   Optional: add -CleanupRecreatedFiles to delete recreated manifest files.

Logging:
- Logs are written to: %ProgramData%\\KioskOverseer\\Logs
- Filename format: <scriptname>_<yyyyMMdd-HHmmss>.log
- Log format: CMTrace-compatible (viewable in CMTrace, OneTrace, or similar log viewers)
`;

    downloadFile(installScript, 'KioskOverseer-EdgeVisualElements-Install.ps1', 'text/plain');
    setTimeout(() => {
        downloadFile(removeScript, 'KioskOverseer-EdgeVisualElements-Remove.ps1', 'text/plain');
    }, 100);
    setTimeout(() => {
        downloadFile(readme, 'KioskOverseer-EdgeVisualElements-Readme.txt', 'text/plain');
    }, 200);
}

function generateReadme() {
    const configName = dom.get('configName').value.trim();
    const configAuthor = dom.get('configAuthor').value.trim();
    const profileId = dom.get('profileId').value || '(not set)';
    const now = new Date().toLocaleString();
    const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
    const edgeWarningPins = getEdgeShortcutWarningPins();

    let readme = `# Kiosk Configuration Summary\n\n`;
    if (configName) {
        readme += `**Configuration:** ${configName}\n\n`;
    }
    if (configAuthor) {
        readme += `**Author:** ${configAuthor}  \n`;
        readme += `**Date:** ${currentDate}\n\n`;
    }
    readme += `Generated: ${now}\n\n`;

    // Kiosk Mode
    readme += `## Kiosk Mode\n\n`;
    const modeLabels = { single: 'Single-App', multi: 'Multi-App', restricted: 'Restricted User' };
    readme += `**Type:** ${modeLabels[state.mode] || state.mode}\n\n`;

    // Account
    readme += `## Account\n\n`;
    if (state.accountType === 'auto') {
        const displayName = dom.get('displayName').value || 'Kiosk User';
        readme += `**Type:** Auto Logon (Managed)\n`;
        readme += `**Display Name:** ${displayName}\n\n`;
    } else if (state.accountType === 'existing') {
        const accountName = dom.get('accountName').value || '(not set)';
        readme += `**Type:** Existing Account\n`;
        readme += `**Account:** ${accountName}\n\n`;
    } else if (state.accountType === 'group') {
        const groupName = dom.get('groupName').value || '(not set)';
        readme += `**Type:** User Group\n`;
        readme += `**Group:** ${groupName}\n\n`;
    } else if (state.accountType === 'global') {
        readme += `**Type:** Global Profile (All Non-Admin Users)\n\n`;
    }

    if (state.mode === 'single') {
        // Single-App details
        readme += `## Application\n\n`;
        const appType = dom.get('appType').value;

        if (appType === 'edge') {
            const sourceType = dom.get('edgeSourceType').value;
            const url = sourceType === 'url'
                ? dom.get('edgeUrl').value
                : dom.get('edgeFilePath').value;
            const kioskType = dom.get('edgeKioskType').value;

            readme += `**App:** Microsoft Edge (Kiosk Mode)\n`;
            readme += `**Source:** ${sourceType === 'url' ? 'URL' : 'Local File'}\n`;
            readme += `**${sourceType === 'url' ? 'URL' : 'File Path'}:** ${url || '(not set)'}\n`;
            readme += `**Kiosk Type:** ${kioskType === 'fullscreen' ? 'Fullscreen (Digital Signage)' : 'Public Browsing'}\n`;
            readme += `**InPrivate Mode:** Always enabled (automatic in kiosk mode)\n\n`;
        } else if (appType === 'uwp') {
            const aumid = dom.get('uwpAumid').value;
            readme += `**App:** UWP/Store App\n`;
            readme += `**AUMID:** ${aumid || '(not set)'}\n\n`;
        } else {
            const path = dom.get('win32Path').value;
            const args = dom.get('win32Args').value;
            readme += `**App:** Win32 Desktop App\n`;
            readme += `**Path:** ${path || '(not set)'}\n`;
            if (args) readme += `**Arguments:** ${args}\n`;
            readme += `\n`;
        }

        // Breakout sequence
        const breakoutEnabled = dom.get('enableBreakout').checked;
        if (breakoutEnabled) {
            const breakoutPreview = dom.get('breakoutPreview').textContent;
            readme += `## Breakout Sequence\n\n`;
            readme += `**Key Combination:** ${breakoutPreview}\n\n`;
        }
    } else {
        // Multi-App / Restricted details
        readme += `## Allowed Applications\n\n`;
        if (state.allowedApps.length === 0) {
            readme += `(No applications added)\n\n`;
        } else {
            state.allowedApps.forEach((app, i) => {
                const isAutoLaunch = state.autoLaunchApp === i;
                const typeLabel = app.type === 'aumid' ? 'UWP' : 'Win32';
                readme += `${i + 1}. \`${app.value}\` (${typeLabel})${isAutoLaunch ? ' — **Auto-Launch**' : ''}\n`;
            });
            readme += `\n`;
        }

        // Auto-launch browser config
        if (state.autoLaunchApp !== null) {
            const autoApp = state.allowedApps[state.autoLaunchApp];
            if (autoApp && isBrowserWithKioskSupport(autoApp.value)) {
                if (isEdgeApp(autoApp.value)) {
                    readme += `### Browser Auto-Launch Settings\n\n`;
                    readme += `**Browser:** Microsoft Edge\n`;
                    const sourceType = dom.get('multiEdgeSourceType').value;
                    const url = sourceType === 'url'
                        ? dom.get('multiEdgeUrl').value
                        : dom.get('multiEdgeFilePath').value;
                    const kioskType = dom.get('multiEdgeKioskType').value;
                    readme += `**Source:** ${sourceType === 'url' ? 'URL' : 'Local File'}\n`;
                    readme += `**${sourceType === 'url' ? 'URL' : 'File Path'}:** ${url || '(not set)'}\n`;
                    readme += `**Kiosk Type:** ${kioskType === 'fullscreen' ? 'Fullscreen' : 'Public Browsing'}\n\n`;
                } else {
                    const segments = autoApp.value.replace(/\//g, '\\').split('\\');
                    const exeName = segments[segments.length - 1];
                    const launchArgs = dom.get('win32AutoLaunchArgs').value.trim();
                    readme += `### Browser Auto-Launch Settings\n\n`;
                    readme += `**Browser:** ${exeName}\n`;
                    if (launchArgs) readme += `**Arguments:** ${launchArgs}\n`;
                    readme += `\n`;
                }
            }
        }

        // Start menu pins
        if (state.startPins.length > 0) {
            readme += `## Start Menu Pins\n\n`;
            state.startPins.forEach((pin, i) => {
                readme += `${i + 1}. **${pin.name || '(unnamed)'}**\n`;
                readme += `   - Target: \`${pin.target || '(not set)'}\`\n`;
                if (pin.args) readme += `   - Arguments: \`${pin.args}\`\n`;
                if (pin.systemShortcut) readme += `   - Uses system shortcut\n`;
            });
            readme += `\n`;
        }

        // Taskbar pins
        if (state.taskbarPins.length > 0) {
            readme += `## Taskbar Pins\n\n`;
            state.taskbarPins.forEach((pin, i) => {
                readme += `${i + 1}. **${pin.name || '(unnamed)'}**\n`;
                readme += `   - Target: \`${pin.target || '(not set)'}\`\n`;
                if (pin.args) readme += `   - Arguments: \`${pin.args}\`\n`;
                if (pin.systemShortcut) readme += `   - Uses system shortcut\n`;
            });
            readme += `\n`;
        }

        // System restrictions
        readme += `## System Restrictions\n\n`;
        const showTaskbar = dom.get('showTaskbar').checked;
        const fileExplorer = dom.get('fileExplorerAccess').value;

        readme += `| Setting | Value |\n`;
        readme += `|---------|-------|\n`;
        readme += `| Taskbar | ${showTaskbar ? 'Visible' : 'Hidden'} |\n`;
        const fileExplorerLabels = {
            'none': 'Disabled',
            'downloads': 'Downloads folder only',
            'removable': 'Removable drives only',
            'downloads-removable': 'Downloads + Removable drives',
            'all': 'No restriction'
        };
        readme += `| File Explorer | ${fileExplorerLabels[fileExplorer] || fileExplorer} |\n\n`;

        // KioskOverseer Sentry
        const sentryEnabled = dom.get('enableSentry').checked;
        if (sentryEnabled) {
            const interval = dom.get('sentryInterval').value;
            const appInfo = getSentryAppInfo();
            readme += `## KioskOverseer Sentry\n\n`;
            readme += `**Poll Interval:** ${interval} seconds\n`;
            if (appInfo) {
                readme += `**Monitored Process:** ${appInfo.processName}\n`;
            } else {
                readme += `**Monitored Process:** (requires auto-launch app with executable path)\n`;
            }
            readme += `**Task Name:** \`KioskOverseer-Sentry\`\n\n`;
        }
    }

    // Device Settings
    readme += `## Device Settings\n\n`;
    readme += `| Setting | Value |\n|---|---|\n`;
    readme += `| Touch Keyboard Auto-Invoke | ${dom.get('enableTouchKeyboard').checked ? 'Enabled' : 'Disabled'} |\n\n`;

    // Warnings
    if (edgeWarningPins.length > 0) {
        readme += `## Warnings\n\n`;
        readme += `Some Edge-backed shortcuts may not display custom name/icon in Assigned Access. ` +
            `Assigned Access renders these pins using the Edge app identity, ignoring .lnk metadata.\n\n`;
        readme += `Affected pins:\n`;
        edgeWarningPins.forEach(name => {
            readme += `- ${name}\n`;
        });
        readme += `\n`;
    }

    // Profile ID
    readme += `## Profile\n\n`;
    readme += `**Profile GUID:** \`${profileId}\`\n\n`;

    // Deployment note
    readme += `---\n\n`;
    readme += `## Deployment\n\n`;
    readme += `Deploy the PowerShell script via Intune or run locally as SYSTEM:\n`;
    readme += `\`\`\`powershell\npsexec.exe -i -s powershell.exe -ExecutionPolicy Bypass -File "AssignedAccess-<Config>.ps1"\n\`\`\`\n\n`;
    readme += `A reboot is required after applying the configuration.\n\n`;
    readme += `> Generated by [Kiosk Overseer](https://kioskoverseer.com)\n`;

    return readme;
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

    document.addEventListener('click', (event) => {
        const header = event.target.closest('legend.collapsible-header');
        if (!header) return;

        const content = header.nextElementSibling;
        if (!content || !content.classList.contains('collapsible-content')) return;

        header.classList.toggle('collapsed');
        content.classList.toggle('collapsed');
        const isExpanded = !header.classList.contains('collapsed');
        header.setAttribute('aria-expanded', isExpanded.toString());
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
            let errorEl = parent.querySelector('.field-error');
            if (error) {
                input.classList.add('invalid');
                if (!errorEl) {
                    errorEl = document.createElement('span');
                    errorEl.className = 'field-error';
                    parent.appendChild(errorEl);
                }
                errorEl.textContent = error;
            } else {
                input.classList.remove('invalid');
                if (errorEl) errorEl.remove();
            }
        });
    });
});
