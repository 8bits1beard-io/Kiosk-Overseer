/* ============================================================================
   Configuration Save / Load / Import / Export
   ============================================================================
   Functions for saving, loading, importing, and exporting kiosk configurations.
   ============================================================================ */

const CONFIG_SCHEMA_VERSION = 1;
let configFileHandle = null;

/* ============================================================================
   Config Snapshot Functions
   ============================================================================ */

function getConfigSaveName() {
    const configName = dom.get('configName').value.trim();
    if (configName) {
        const sanitized = configName.replace(/\s+/g, '-').replace(/[<>:"/\\|?*]/g, '');
        return `AssignedAccess-${sanitized}.kioskoverseer.json`;
    }
    return 'AssignedAccessConfig.kioskoverseer.json';
}

function collectFormValues() {
    const values = {};
    document.querySelectorAll('input, select, textarea').forEach(el => {
        if (!el.id || el.type === 'file') return;
        if (el.dataset && el.dataset.configSkip === 'true') return;
        if (el.type === 'checkbox') {
            values[el.id] = !!el.checked;
            return;
        }
        if (el.type === 'radio') {
            values[el.id] = !!el.checked;
            return;
        }
        values[el.id] = el.value;
    });
    return values;
}

function buildConfigSnapshot() {
    return {
        schemaVersion: CONFIG_SCHEMA_VERSION,
        name: dom.get('configName').value.trim() || 'Unnamed',
        savedAt: new Date().toISOString(),
        payload: {
            state: {
                mode: state.mode,
                accountType: state.accountType,
                allowedApps: state.allowedApps,
                startPins: state.startPins,
                taskbarPins: state.taskbarPins,
                autoLaunchApp: state.autoLaunchApp
            },
            formValues: collectFormValues()
        }
    };
}

/* ============================================================================
   Save Functions
   ============================================================================ */

async function writeConfigToHandle(handle, config) {
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(config, null, 2));
    await writable.close();
}

async function saveConfigAs(existingConfig) {
    const config = existingConfig || buildConfigSnapshot();
    downloadFile(JSON.stringify(config, null, 2), getConfigSaveName(), 'application/json');
}

/* ============================================================================
   Load Functions
   ============================================================================ */

async function loadConfig() {
    dom.get('configImportInput').click();
}

function normalizeConfigPayload(config) {
    if (!config || typeof config !== 'object') {
        return { ok: false, error: 'Invalid configuration file.' };
    }
    if (config.schemaVersion && config.schemaVersion !== CONFIG_SCHEMA_VERSION) {
        return { ok: false, error: `Unsupported schema version: ${config.schemaVersion}` };
    }
    const payload = config.payload;
    if (!payload || typeof payload !== 'object') {
        return { ok: false, error: 'Configuration payload missing.' };
    }
    const savedState = payload.state || {};
    return {
        ok: true,
        payload: {
            state: savedState,
            formValues: payload.formValues || {}
        }
    };
}

async function loadConfigFile(file, handle) {
    const text = await file.text();
    let parsed = null;
    try {
        parsed = JSON.parse(text);
    } catch (e) {
        alert('This file is not valid JSON.');
        return;
    }

    const normalized = normalizeConfigPayload(parsed);
    if (!normalized.ok) {
        alert(normalized.error);
        return;
    }

    if (!confirm('Loading this configuration will replace your current settings. Continue?')) {
        return;
    }

    applyConfigSnapshot(normalized.payload);
    configFileHandle = handle || null;
    alert('Configuration loaded.');
}

function handleConfigImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    loadConfigFile(file, null);
    event.target.value = '';
}

function applyConfigSnapshot(payload) {
    loadPreset('blank');

    const savedState = payload.state || {};
    const savedMode = savedState.mode || 'single';
    const savedAccount = savedState.accountType || 'auto';

    // Normalize account type based on mode
    let normalizedAccount = savedAccount;
    if (savedMode === 'restricted' && savedAccount !== 'group' && savedAccount !== 'global') {
        normalizedAccount = 'group';
    }
    if (savedMode !== 'restricted' && (savedAccount === 'group' || savedAccount === 'global')) {
        normalizedAccount = 'auto';
    }

    setMode(savedMode);
    setAccountType(normalizedAccount);

    state.allowedApps = Array.isArray(savedState.allowedApps) ? savedState.allowedApps : [];
    state.startPins = Array.isArray(savedState.startPins) ? savedState.startPins : [];
    state.taskbarPins = Array.isArray(savedState.taskbarPins) ? savedState.taskbarPins : [];
    const autoLaunch = Number.isInteger(savedState.autoLaunchApp) ? savedState.autoLaunchApp : null;

    // Restore form values
    Object.entries(payload.formValues || {}).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (!el || el.type === 'file') return;
        if (el.type === 'checkbox' || el.type === 'radio') {
            el.checked = !!value;
            return;
        }
        el.value = value;
    });

    // Update UI
    renderAppList();
    renderPinList();
    renderTaskbarPinList();
    updatePinTargetPresets();
    updateAutoLaunchSelector();

    if (autoLaunch !== null) {
        dom.get('autoLaunchApp').value = String(autoLaunch);
    }
    updateAutoLaunchSelection();
    updateTabVisibility();
    updateAppTypeUI();
    updateEdgeSourceUI();
    updateEdgeTileSourceUI();
    updateMultiEdgeSourceUI();
    updateTaskbarPinTypeUI();
    updateEditTaskbarPinTypeUI();
    updateEdgeArgsVisibility('pin', 'pinTarget', 'pinEdgeArgsGroup');
    updateEdgeArgsVisibility('editPin', 'editPinTarget', 'editPinEdgeArgsGroup');
    updateEdgeArgsVisibility('taskbarPin', 'taskbarPinTarget', 'taskbarPinEdgeArgsGroup');
    updateEdgeArgsVisibility('editTaskbar', 'editTaskbarPinTarget', 'editTaskbarEdgeArgsGroup');
    updateBreakoutUI();
    updateSentryUI();
    updatePreview();
}

/* ============================================================================
   Preset Loading
   ============================================================================ */

function loadPresetFromSelect() {
    const select = dom.get('presetSelect');
    const value = select.value;
    if (value) {
        loadPreset(value);
        // Reset select to placeholder
        select.selectedIndex = 0;
    }
}

function loadPreset(preset) {
    // Reset state
    state.allowedApps = [];
    state.startPins = [];
    state.taskbarPins = [];
    state.autoLaunchApp = null;
    configFileHandle = null;

    // Reset config name
    dom.get('configName').value = '';

    // Reset multi-app Edge config
    dom.get('multiEdgeSourceType').value = 'url';
    dom.get('multiEdgeUrl').value = '';
    dom.get('multiEdgeFilePath').value = '';
    dom.get('multiEdgeKioskType').value = 'fullscreen';
    dom.get('win32AutoLaunchArgs').value = '';
    updateMultiEdgeSourceUI();

    // Reset taskbar pin replacement and global profile exclusion
    dom.get('replaceTaskbarPins').checked = true;
    dom.get('excludeDeviceOwner').checked = true;

    // Reset sentry config
    dom.get('enableSentry').checked = false;
    dom.get('sentryInterval').value = '10';
    updateSentryUI();

    // Reset touch keyboard
    dom.get('enableTouchKeyboard').checked = false;

    switch (preset) {
        case 'blank':
            setMode('single');
            setAccountType('auto');
            generateGuid();
            dom.get('displayName').value = '';
            dom.get('appType').value = 'edge';
            dom.get('edgeSourceType').value = 'url';
            dom.get('edgeUrl').value = '';
            dom.get('edgeFilePath').value = '';
            dom.get('edgeKioskType').value = 'fullscreen';
            updateAppTypeUI();
            updateEdgeSourceUI();
            break;

        case 'edgeFullscreen':
            setMode('single');
            setAccountType('auto');
            generateGuid();
            dom.get('displayName').value = 'Kiosk';
            dom.get('appType').value = 'edge';
            dom.get('edgeSourceType').value = 'url';
            dom.get('edgeUrl').value = 'https://www.microsoft.com';
            dom.get('edgeFilePath').value = '';
            dom.get('edgeKioskType').value = 'fullscreen';
            updateAppTypeUI();
            updateEdgeSourceUI();
            break;

        case 'edgePublic':
            setMode('single');
            setAccountType('auto');
            generateGuid();
            dom.get('displayName').value = 'Public Browsing';
            dom.get('appType').value = 'edge';
            dom.get('edgeSourceType').value = 'url';
            dom.get('edgeUrl').value = 'https://www.bing.com';
            dom.get('edgeFilePath').value = '';
            dom.get('edgeKioskType').value = 'public-browsing';
            updateAppTypeUI();
            updateEdgeSourceUI();
            break;

        case 'multiApp':
            setMode('multi');
            setAccountType('auto');
            generateGuid();
            dom.get('displayName').value = 'Multi-App Kiosk';
            addCommonApp('edge');
            addCommonApp('osk');
            addCommonApp('calculator');
            dom.get('showTaskbar').checked = true;
            dom.get('fileExplorerAccess').value = 'downloads';
            break;
    }

    updateAppTypeUI();
    renderAppList();
    renderPinList();
    renderTaskbarPinList();
    updateAutoLaunchSelector();
    updatePreview();
}

/* ============================================================================
   Event Delegation
   ============================================================================
   NOTE: This must be at the END of the last-loaded script (config.js) so that
   all function references point to the correct modular versions from pins.js,
   apps.js, etc. rather than any duplicates that may exist in app.js.
   ============================================================================ */

const actionHandlers = {
    loadPreset,
    loadPresetFromSelect,
    loadConfig,
    saveConfigAs,
    switchTab,
    switchDeployTab,
    setMode,
    setAccountType,
    generateGuid,
    addApp,
    addCommonApp,
    addPin,
    removeApp,
    removePin,
    updatePreview,
    updateAppTypeUI,
    updateEdgeSourceUI,
    updateBreakoutUI,
    updateBreakoutPreview,
    updateAutoLaunchSelection,
    updateMultiEdgeSourceUI,
    updateEdgeTileSourceUI,
    updatePinTargetPresets,
    applyPinTargetPreset,
    applyEditPinTargetPreset,
    applyTaskbarPinTargetPreset,
    applyEditTaskbarPinTargetPreset,
    updateTaskbarPinTypeUI,
    updateEditTaskbarPinTypeUI,
    updateModalEdgeArgsModeUI,
    updateModalEdgeArgsSourceUI,
    openEdgeArgsModal,
    applyEdgeArgsModal,
    hideEdgeArgsModal,
    toggleExportSection,
    editPin,
    saveEditPin,
    cancelEditPin,
    movePinUp,
    movePinDown,
    duplicatePin,
    copyPinToTaskbar,
    addTaskbarPin,
    editTaskbarPin,
    saveTaskbarPin,
    cancelTaskbarPinEdit,
    removeTaskbarPin,
    moveTaskbarPinUp,
    moveTaskbarPinDown,
    copyDeployCode,
    downloadXml,
    downloadPowerShell,
    downloadShortcutsScript,
    downloadEdgeManifestWorkaround,
    addEdgeSecondaryTile,
    handleConfigImport,
    copyProfileId,
    dismissCallout,
    dismissWelcome,
    toggleTheme,
    updateSentryUI
};

// Debounce guard for download actions to prevent double-triggering
const actionDebounce = new Map();
const DEBOUNCE_MS = 500;

function runAction(action, target, event) {
    const handler = actionHandlers[action];
    if (!handler) return;

    // Debounce download actions to prevent double-triggering
    if (action.startsWith('download')) {
        const lastRun = actionDebounce.get(action);
        const now = Date.now();
        if (lastRun && (now - lastRun) < DEBOUNCE_MS) {
            return;
        }
        actionDebounce.set(action, now);
    }

    const arg = target?.dataset?.arg;
    if (action === 'handleConfigImport') {
        handler(event);
        return;
    }

    if (arg !== undefined) {
        if (action === 'removeApp' || action === 'removePin' || action === 'removeTaskbarPin') {
            handler(parseInt(arg, 10));
        } else {
            handler(arg);
        }
        return;
    }

    // Pass button element to copy handlers and dismissCallout for visual feedback / DOM traversal
    if (action.startsWith('copy') || action === 'dismissCallout') {
        handler(target);
        return;
    }

    handler();
}

function runActions(actionString, target, event) {
    actionString.split('|').forEach(action => {
        runAction(action.trim(), target, event);
    });
}
