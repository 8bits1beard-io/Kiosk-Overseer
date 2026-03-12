/* ============================================================================
   Allowed Apps Management
   ============================================================================
   Functions for managing the allowed applications list in multi-app
   and restricted user modes.
   ============================================================================ */

/* ============================================================================
   Helper Functions
   ============================================================================ */

function isHelperExecutable(value) {
    if (!value) return false;
    const lowerValue = value.toLowerCase();
    return lowerValue.includes('_proxy.exe') ||
           lowerValue.includes('edgeupdate') ||
           lowerValue.includes('update.exe') ||
           lowerValue.includes('crashhandler');
}

function shouldSkipAutoLaunch(app) {
    if (!app) return true;
    if (app.skipAutoLaunch) return true;
    return isHelperExecutable(app.value);
}

/* ============================================================================
   App List Management
   ============================================================================ */

function addAllowedApp(app, options = {}) {
    if (!app || !app.value) return false;

    if (state.allowedApps.find(a => a.value === app.value)) {
        return false;
    }

    const entry = { ...app };
    if (options.skipAutoPin || entry.skipAutoPin) {
        entry.skipAutoPin = true;
    }
    if (options.skipAutoLaunch || entry.skipAutoLaunch) {
        entry.skipAutoLaunch = true;
    }

    state.allowedApps.push(entry);
    return true;
}

function ensureEdgeDependencies(app) {
    if (!appPresets?.apps) return;

    const value = (app.value || '').toLowerCase();
    const isEdgeValue = isEdgeApp(app.value) ||
        value === 'microsoft.microsoftedge.stable_8wekyb3d8bbwe!app';

    if (!isEdgeValue) return;

    ['edge', 'edgeProxy', 'edgeAppId'].forEach(key => {
        const edgeApp = appPresets.apps[key];
        if (!edgeApp) return;
        const isDependency = key !== 'edge';
        addAllowedApp(edgeApp, { skipAutoPin: isDependency, skipAutoLaunch: isDependency });
    });
}

function addApp() {
    const type = dom.get('addAppType').value;
    const value = dom.get('addAppValue').value.trim();

    if (!value) return;

    const added = addAllowedApp({ type, value });
    dom.get('addAppValue').value = '';
    if (added) {
        ensureEdgeDependencies({ type, value });
    }
    renderAppList();
    updateAutoLaunchSelector();
    updatePinTargetPresets();
    updatePreview();
}

function addCommonApp(appKey) {
    if (!appPresets) {
        console.error('App presets not loaded');
        return;
    }

    const apps = appPresets.apps;
    const groups = appPresets.groups;

    // Check if this key has a group (multiple apps to add)
    if (groups[appKey]) {
        groups[appKey].forEach(key => {
            const app = apps[key];
            addAllowedApp(app, { skipAutoPin: app?.skipAutoPin, skipAutoLaunch: app?.skipAutoLaunch });
        });
    } else {
        // Single app
        const app = apps[appKey];
        addAllowedApp(app, { skipAutoPin: app?.skipAutoPin, skipAutoLaunch: app?.skipAutoLaunch });
    }

    renderAppList();
    updateAutoLaunchSelector();
    updatePinTargetPresets();
    updatePreview();
}

function removeApp(index) {
    // If we're removing the auto-launch app, reset the selection
    if (state.autoLaunchApp === index) {
        state.autoLaunchApp = null;
    } else if (state.autoLaunchApp !== null && state.autoLaunchApp > index) {
        // Adjust index if we removed an app before the auto-launch app
        state.autoLaunchApp--;
    }

    state.allowedApps.splice(index, 1);
    renderAppList();
    updateAutoLaunchSelector();
    updatePinTargetPresets();
    updatePreview();
}

function renderAppList() {
    const list = dom.get('appList');
    const count = dom.get('appCount');

    count.textContent = state.allowedApps.length;

    if (state.allowedApps.length === 0) {
        list.innerHTML = '<div class="empty-list" role="status">No apps added yet. Use "Add Common App" above to get started.</div>';
        return;
    }

    list.innerHTML = state.allowedApps.map((app, i) => {
        return `
        <div class="app-item" role="listitem">
            <span title="${escapeXml(app.value)}"><span aria-hidden="true">${app.type === 'aumid' ? '📦 ' : '📄 '}</span>${escapeXml(truncate(app.value, 60))}</span>
            <button type="button" class="remove-btn" data-action="removeApp" data-arg="${i}" aria-label="Remove ${escapeXml(truncate(app.value, 30))}">
                <span aria-hidden="true">✕</span>
            </button>
        </div>
    `;
    }).join('');
}

/* ============================================================================
   Auto-Launch Functions
   ============================================================================ */

function updateAutoLaunchSelector() {
    const select = dom.get('autoLaunchApp');
    const currentValue = select.value;

    // Clear all options except "None"
    select.innerHTML = '<option value="">None (show Start menu)</option>';

    // Add allowed apps as options (skip helper executables)
    state.allowedApps.forEach((app, index) => {
        if (shouldSkipAutoLaunch(app)) {
            return;
        }

        const option = document.createElement('option');
        option.value = index;

        // Create a friendly display name
        let displayName = app.value;
        if (displayName.length > 50) {
            displayName = '...' + displayName.slice(-47);
        }
        if (isEdgeApp(app.value)) {
            displayName = 'Microsoft Edge';
        }
        option.textContent = displayName;
        select.appendChild(option);
    });

    // Restore selection if still valid
    if (currentValue !== '' &&
        state.allowedApps[parseInt(currentValue)] &&
        !shouldSkipAutoLaunch(state.allowedApps[parseInt(currentValue)])) {
        select.value = currentValue;
    } else {
        select.value = '';
        state.autoLaunchApp = null;
    }

    updateMultiAppEdgeUI();
}

function updateAutoLaunchSelection() {
    const select = dom.get('autoLaunchApp');
    const value = select.value;

    if (value === '') {
        state.autoLaunchApp = null;
    } else {
        state.autoLaunchApp = parseInt(value);
    }

    updateMultiAppEdgeUI();
}

function updateMultiAppEdgeUI() {
    const edgeConfig = dom.get('multiAppEdgeConfig');
    const win32ArgsConfig = dom.get('win32ArgsConfig');
    const sentryOptions = dom.get('sentryOptions');

    let showEdgeConfig = false;
    let showWin32Args = false;
    let showSentry = false;

    if (state.autoLaunchApp !== null && state.allowedApps[state.autoLaunchApp]) {
        const app = state.allowedApps[state.autoLaunchApp];
        if (isEdgeApp(app.value)) {
            showEdgeConfig = true;
        } else if (app.type === 'path') {
            showWin32Args = true;
        }
        if (app.type === 'path') {
            showSentry = true;
        }
    }

    edgeConfig.classList.toggle('hidden', !showEdgeConfig);
    edgeConfig.setAttribute('aria-hidden', !showEdgeConfig);

    win32ArgsConfig.classList.toggle('hidden', !showWin32Args);
    win32ArgsConfig.setAttribute('aria-hidden', !showWin32Args);

    if (sentryOptions) {
        sentryOptions.classList.toggle('hidden', !showSentry);
        if (!showSentry) {
            const checkbox = dom.get('enableSentry');
            if (checkbox) checkbox.checked = false;
            updateSentryUI();
        }
    }
}

function filterCommonApps() {
    const search = document.getElementById('commonAppSearch');
    if (!search) return;
    const query = search.value.toLowerCase();
    document.querySelectorAll('[data-action="addCommonApp"]').forEach(btn => {
        btn.style.display = btn.textContent.toLowerCase().includes(query) ? '' : 'none';
    });
    document.querySelectorAll('.common-app-category').forEach(cat => {
        const hasVisible = Array.from(cat.querySelectorAll('[data-action="addCommonApp"]')).some(btn => btn.style.display !== 'none');
        cat.style.display = hasVisible ? '' : 'none';
    });
}
