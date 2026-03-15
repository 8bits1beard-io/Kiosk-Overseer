/* ============================================================================
   Pin Management (Start Menu & Taskbar)
   ============================================================================
   Unified pin management for both Start menu pins and Taskbar pins.
   Uses configuration objects to eliminate code duplication.
   ============================================================================ */

// Configuration for each pin list type
const PIN_LIST_CONFIG = {
    start: {
        stateKey: 'startPins',
        listId: 'pinList',
        countId: 'pinCount',
        editPanelId: 'pinEditPanel',
        prefix: 'pin',
        editPrefix: 'editPin',
        emptyMessage: 'No pins added yet. Add a desktop shortcut or UWP app above.',
        supportsSecondaryTile: true,
        supportsDuplicate: true
    },
    taskbar: {
        stateKey: 'taskbarPins',
        listId: 'taskbarPinList',
        countId: 'taskbarPinCount',
        editPanelId: 'taskbarEditPanel',
        prefix: 'taskbarPin',
        editPrefix: 'editTaskbar',
        emptyMessage: 'No taskbar pins configured. Add a desktop app or UWP app above.',
        supportsSecondaryTile: false,
        supportsDuplicate: false
    }
};

// Track which pin is being edited
let editingPinIndex = null;
let editingPinListType = null;

/* ============================================================================
   Pin Utility Functions
   ============================================================================ */

function buildUniquePinName(baseName, listType) {
    const config = PIN_LIST_CONFIG[listType || 'start'];
    const pins = state[config.stateKey];
    const trimmed = baseName.trim() || 'Shortcut';
    const existing = pins.map(p => (p.name || '').toLowerCase());

    if (!existing.includes(trimmed.toLowerCase())) {
        return trimmed;
    }

    let counter = 2;
    let candidate = `${trimmed} (${counter})`;
    while (existing.includes(candidate.toLowerCase())) {
        counter += 1;
        candidate = `${trimmed} (${counter})`;
    }
    return candidate;
}

// Known exe-to-friendly-name mappings
const EXE_FRIENDLY_NAMES = {
    'msedge.exe': 'Microsoft Edge',
    'chrome.exe': 'Google Chrome',
    'firefox.exe': 'Firefox',
    'brave.exe': 'Brave',
    'island.exe': 'Island',
    'osk.exe': 'On-Screen Keyboard',
    'tabtip.exe': 'Touch Keyboard',
    'sndvol.exe': 'Volume Mixer',
    'explorer.exe': 'File Explorer',
    'control.exe': 'Control Panel',
    'cmd.exe': 'Command Prompt',
    'powershell.exe': 'PowerShell',
    'pwsh.exe': 'PowerShell 7',
    'notepad.exe': 'Notepad',
    'winword.exe': 'Microsoft Word',
    'excel.exe': 'Microsoft Excel',
    'powerpnt.exe': 'Microsoft PowerPoint',
    'outlook.exe': 'Microsoft Outlook',
    'teams.exe': 'Microsoft Teams',
    'zoom.exe': 'Zoom'
};

function buildPinNameFromApp(app) {
    if (!app || !app.value) return 'Unnamed';
    if (isEdgeApp(app.value)) return 'Microsoft Edge';
    if (app.type === 'aumid') return app.value;
    const parts = app.value.split('\\');
    const filename = parts[parts.length - 1] || app.value;
    // Check known names first
    const friendly = EXE_FRIENDLY_NAMES[filename.toLowerCase()];
    if (friendly) return friendly;
    // Strip .exe extension and capitalize
    return filename.replace(/\.exe$/i, '') || app.value;
}

function isEdgeBackedDesktopPin(pin) {
    if (!pin || pin.pinType !== 'desktopAppLink') return false;
    if (pin.target && (isEdgeApp(pin.target) || pin.target.toLowerCase().includes('msedge.exe'))) {
        return true;
    }
    if (pin.systemShortcut) {
        const shortcut = pin.systemShortcut.toLowerCase();
        return shortcut.includes('microsoft edge.lnk') ||
            shortcut.includes('\\microsoft\\edge\\application\\');
    }
    return false;
}

function shouldWarnEdgeShortcutPin(pin) {
    if (!isEdgeBackedDesktopPin(pin)) return false;
    const name = (pin.name || '').trim().toLowerCase();
    const hasCustomName = name && name !== 'microsoft edge';
    const hasCustomIcon = !!(pin.iconPath && pin.iconPath.trim());
    return hasCustomName || hasCustomIcon;
}

function getEdgeShortcutWarningPins() {
    const pins = []
        .concat(state.startPins || [])
        .concat(state.taskbarPins || []);
    return pins
        .filter(pin => shouldWarnEdgeShortcutPin(pin))
        .map(pin => pin.name || '(unnamed)');
}

function hasDesktopAppLinks() {
    const pins = []
        .concat(state.startPins || [])
        .concat(state.taskbarPins || []);
    return pins.some(pin => pin.pinType === 'desktopAppLink');
}

function hasEdgeBackedDesktopLinks() {
    const pins = []
        .concat(state.startPins || [])
        .concat(state.taskbarPins || []);
    return pins.some(pin => isEdgeBackedDesktopPin(pin));
}

/* ============================================================================
   Render Functions
   ============================================================================ */

function renderPinList() {
    renderPinListForType('start');
}

function renderTaskbarPinList() {
    renderPinListForType('taskbar');
}

function renderPinListForType(listType) {
    const config = PIN_LIST_CONFIG[listType];
    const list = dom.get(config.listId);
    const count = dom.get(config.countId);
    const pins = state[config.stateKey];

    if (!list || !count) return;

    // Filter pins for taskbar (only desktop and packaged, no secondary tiles)
    const displayPins = listType === 'taskbar'
        ? pins.filter(pin => pin.pinType === 'desktopAppLink' || pin.pinType === 'packagedAppId')
        : pins;

    count.textContent = displayPins.length;

    if (displayPins.length === 0) {
        list.innerHTML = `<div class="empty-list" role="status">${config.emptyMessage}</div>`;
        return;
    }

    list.innerHTML = displayPins.map((pin, i) => {
        const isUwp = pin.pinType === 'packagedAppId';
        const isSecondaryTile = pin.pinType === 'secondaryTile';

        // Determine display target
        let displayTarget;
        if (isUwp) {
            displayTarget = pin.packagedAppId;
        } else if (isSecondaryTile) {
            displayTarget = pin.args || pin.packagedAppId || 'Edge site tile';
        } else {
            displayTarget = pin.target
                ? truncate(pin.target, 40)
                : (pin.systemShortcut ? truncate(pin.systemShortcut, 40) : '(no target - click to edit)');
        }

        const hasArgs = pin.args && !isSecondaryTile ? ` (${truncate(pin.args, 20)})` : '';
        const missingTarget = !isUwp && pin.pinType === 'desktopAppLink' && !pin.target && !pin.systemShortcut;
        const warningStyle = missingTarget ? 'color: var(--error-color, #e74c3c);' : 'color: var(--text-secondary);';

        // Badges
        const typeLabel = isUwp ? '<span style="background: var(--accent); color: white; padding: 1px 4px; border-radius: 3px; font-size: 0.65rem; margin-left: 6px;">UWP</span>' : '';
        const linkBadge = pin.pinType === 'desktopAppLink'
            ? '<span style="background: var(--bg-tertiary); color: var(--text-secondary); padding: 1px 4px; border-radius: 3px; font-size: 0.65rem; margin-left: 6px;">.lnk</span>'
            : '';
        const edgeBadge = isEdgeBackedDesktopPin(pin)
            ? '<span style="background: var(--bg-tertiary); color: var(--text-secondary); padding: 1px 4px; border-radius: 3px; font-size: 0.65rem; margin-left: 4px;">Edge</span>'
            : '';
        const edgeWarning = shouldWarnEdgeShortcutPin(pin)
            ? '<span style="font-size: 0.7rem; color: var(--warning-color, #b26a00);">Note: Edge-backed shortcuts may show as \'Microsoft Edge\' with the Edge icon in Assigned Access; custom .lnk name/icon may be ignored.</span>'
            : '';

        // Action buttons
        const moveUpAction = listType === 'start' ? 'movePinUp' : 'moveTaskbarPinUp';
        const moveDownAction = listType === 'start' ? 'movePinDown' : 'moveTaskbarPinDown';
        const editAction = listType === 'start' ? 'editPin' : 'editTaskbarPin';
        const removeAction = listType === 'start' ? 'removePin' : 'removeTaskbarPin';
        const duplicateBtn = config.supportsDuplicate
            ? `<button type="button" class="btn-icon btn-small" data-action="duplicatePin" data-arg="${i}" aria-label="Duplicate ${escapeAttr(pin.name)}"><span aria-hidden="true">⧉</span></button>`
            : '';

        // Copy to Taskbar button - only for Start pins that are valid taskbar types (not secondary tiles)
        const copyToTaskbarBtn = (listType === 'start' && (pin.pinType === 'desktopAppLink' || pin.pinType === 'packagedAppId'))
            ? `<button type="button" class="btn-icon btn-small" data-action="copyPinToTaskbar" data-arg="${i}" aria-label="Copy ${escapeAttr(pin.name)} to Taskbar" title="Copy to Taskbar"><span aria-hidden="true">⤵</span></button>`
            : '';

        return `
        <div class="app-item draggable" role="listitem" data-pin-list="${listType}" data-index="${i}" draggable="true" style="${missingTarget ? 'border-left: 3px solid var(--error-color, #e74c3c);' : ''}">
            <button type="button" class="reorder-grip" aria-label="Reorder ${escapeAttr(pin.name || 'pin')}" data-reorder-grip data-pin-list="${listType}" data-index="${i}"><span aria-hidden="true">⠿</span></button>
            <div style="display: flex; flex-direction: column; flex: 1; min-width: 0;">
                <span style="font-weight: 500;">${escapeXml(pin.name || 'Unnamed')}${typeLabel}${linkBadge}${edgeBadge}${missingTarget ? ' <span style="color: var(--error-color, #e74c3c);" title="Target path required">⚠</span>' : ''}</span>
                <span style="font-size: 0.75rem; ${warningStyle} overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeXml(displayTarget)}${escapeXml(hasArgs)}">${escapeXml(displayTarget)}${escapeXml(hasArgs)}</span>
                ${edgeWarning}
            </div>
            <div class="pin-actions">
                <button type="button" class="btn-icon btn-small" data-action="${moveUpAction}" data-arg="${i}" aria-label="Move ${escapeAttr(pin.name || 'pin')} up" ${i === 0 ? 'disabled' : ''}>
                    <span aria-hidden="true">↑</span>
                </button>
                <button type="button" class="btn-icon btn-small" data-action="${moveDownAction}" data-arg="${i}" aria-label="Move ${escapeAttr(pin.name || 'pin')} down" ${i === displayPins.length - 1 ? 'disabled' : ''}>
                    <span aria-hidden="true">↓</span>
                </button>
                ${duplicateBtn}
                ${copyToTaskbarBtn}
                <button type="button" class="btn-icon btn-small" data-action="${editAction}" data-arg="${i}" aria-label="Edit ${escapeAttr(pin.name || 'pin')}">
                    <span aria-hidden="true">✎</span>
                </button>
                <button type="button" class="remove-btn" data-action="${removeAction}" data-arg="${i}" aria-label="Remove ${escapeAttr(pin.name || 'pin')}">
                    <span aria-hidden="true">✕</span>
                </button>
            </div>
        </div>
    `;
    }).join('');
}

/* ============================================================================
   Add Pin Functions
   ============================================================================ */

function addPin() {
    const presetSelect = dom.get('pinTargetPreset');
    const name = dom.get('pinName').value.trim();
    const target = dom.get('pinTarget').value.trim();
    const args = dom.get('pinArgs').value.trim();
    const workingDir = dom.get('pinWorkingDir').value.trim();
    const iconPath = dom.get('pinIconPath').value.trim();

    if (!target) {
        showToast('Please select an allowed app.', { type: 'error' });
        return;
    }

    if (!name) {
        showToast('Shortcut Name is required.', { type: 'error' });
        return;
    }

    if (state.startPins.find(p => p.name.toLowerCase() === name.toLowerCase())) {
        showToast('A shortcut with this name already exists.', { type: 'error' });
        return;
    }

    // Determine pin type from the selected app
    const app = state.allowedApps.find(a => a.value === target);
    const isAumid = app && app.type === 'aumid';

    if (isAumid) {
        state.startPins.push({
            name: name,
            pinType: 'packagedAppId',
            packagedAppId: target
        });
    } else {
        state.startPins.push({
            name: name,
            pinType: 'desktopAppLink',
            target: target,
            args: args,
            workingDir: workingDir,
            iconPath: iconPath
        });
    }

    // Clear form
    if (presetSelect) presetSelect.value = '';
    dom.get('pinName').value = '';
    dom.get('pinName').dataset.autoFilled = 'false';
    dom.get('pinTarget').value = '';
    dom.get('pinArgs').value = '';
    dom.get('pinWorkingDir').value = '';
    dom.get('pinIconPath').value = '';
    updateEdgeArgsVisibility('pin', 'pinTarget', 'pinEdgeArgsGroup');

    renderPinList();
    updatePreview();
}

function addTaskbarPin() {
    const presetSelect = dom.get('taskbarPinTargetPreset');
    const name = dom.get('taskbarPinName').value.trim();
    const type = dom.get('taskbarPinType').value;
    const value = dom.get('taskbarPinValue').value.trim();
    const target = dom.get('taskbarPinTarget').value.trim();

    // Must have selected an app
    if (!presetSelect || !presetSelect.value) {
        showToast('Please select an allowed app.', { type: 'error' });
        return;
    }

    if (!name) {
        showToast('Taskbar pin name is required.', { type: 'error' });
        return;
    }

    const isPackaged = type === 'packagedAppId';

    const pin = {
        name: name,
        pinType: isPackaged ? 'packagedAppId' : 'desktopAppLink',
        packagedAppId: isPackaged ? value : '',
        systemShortcut: '',
        target: isPackaged ? '' : target,
        args: isPackaged ? '' : dom.get('taskbarPinArgs').value.trim(),
        workingDir: isPackaged ? '' : dom.get('taskbarPinWorkingDir').value.trim(),
        iconPath: isPackaged ? '' : dom.get('taskbarPinIconPath').value.trim()
    };

    state.taskbarPins.push(pin);

    // Clear form
    if (presetSelect) presetSelect.value = '';
    dom.get('taskbarPinName').value = '';
    dom.get('taskbarPinName').dataset.autoFilled = 'false';
    dom.get('taskbarPinType').value = 'desktopAppLink';
    dom.get('taskbarPinValue').value = '';
    dom.get('taskbarPinTarget').value = '';
    dom.get('taskbarPinArgs').value = '';
    dom.get('taskbarPinWorkingDir').value = '';
    dom.get('taskbarPinIconPath').value = '';
    // Show desktop fields again after clearing
    const desktopFields = dom.get('taskbarDesktopFields');
    if (desktopFields) desktopFields.classList.remove('hidden');
    updateEdgeArgsVisibility('taskbarPin', 'taskbarPinTarget', 'taskbarPinEdgeArgsGroup');

    renderTaskbarPinList();
    updatePreview();
}

function addEdgeSecondaryTile() {
    const name = dom.get('edgeTileName').value.trim();
    const url = getEdgeTileLaunchUrl();
    const tileId = dom.get('edgeTileId').value.trim();

    if (!name || !url) {
        showToast('Edge tile name and URL/file path are required.', { type: 'error' });
        return;
    }

    if (state.startPins.find(p => p.name.toLowerCase() === name.toLowerCase())) {
        showToast('A pin with this name already exists.', { type: 'error' });
        return;
    }

    state.startPins.push({
        name: name,
        pinType: 'secondaryTile',
        packagedAppId: 'Microsoft.MicrosoftEdge.Stable_8wekyb3d8bbwe!App',
        args: url,
        tileId: tileId || ''
    });

    dom.get('edgeTileName').value = '';
    dom.get('edgeTileUrl').value = '';
    dom.get('edgeTileFilePath').value = '';
    dom.get('edgeTileId').value = '';

    renderPinList();
    updatePreview();
}

/* ============================================================================
   Edit Pin Functions
   ============================================================================ */

function editPin(index) {
    const pin = state.startPins[index];
    if (!pin) return;

    editingPinIndex = index;
    editingPinListType = 'start';

    dom.get('editPinName').value = pin.name || '';
    dom.get('editPinType').textContent = pin.pinType || 'desktopAppLink';

    dom.get('editDesktopFields').classList.toggle('hidden', pin.pinType !== 'desktopAppLink');
    dom.get('editPackagedFields').classList.toggle('hidden', pin.pinType !== 'packagedAppId');
    dom.get('editSecondaryFields').classList.toggle('hidden', pin.pinType !== 'secondaryTile');

    if (pin.pinType === 'desktopAppLink') {
        dom.get('editPinTarget').value = pin.target || '';
        dom.get('editPinArgs').value = pin.args || '';
        dom.get('editPinWorkingDir').value = pin.workingDir || '';
        dom.get('editPinIconPath').value = pin.iconPath || '';
        dom.get('editPinShortcutPath').value = pin.systemShortcut || '';
        updateEdgeArgsVisibility('editPin', 'editPinTarget', 'editPinEdgeArgsGroup');
    } else if (pin.pinType === 'packagedAppId') {
        dom.get('editPinPackagedAppId').value = pin.packagedAppId || '';
    } else if (pin.pinType === 'secondaryTile') {
        dom.get('editTileId').value = pin.tileId || '';
        dom.get('editTileUrl').value = pin.args || '';
        dom.get('editTilePackagedAppId').value = pin.packagedAppId || 'Microsoft.MicrosoftEdge.Stable_8wekyb3d8bbwe!App';
    }

    dom.get('pinEditPanel').classList.remove('hidden');
}

function editTaskbarPin(index) {
    const pin = state.taskbarPins[index];
    if (!pin) return;

    editingPinIndex = index;
    editingPinListType = 'taskbar';

    dom.get('editTaskbarPinName').value = pin.name || '';
    dom.get('editTaskbarPinType').value = pin.pinType || 'desktopAppLink';
    dom.get('editTaskbarPinValue').value = pin.pinType === 'packagedAppId' ? (pin.packagedAppId || '') : '';
    dom.get('editTaskbarPinTarget').value = pin.pinType === 'desktopAppLink' ? (pin.target || '') : '';
    dom.get('editTaskbarPinArgs').value = pin.pinType === 'desktopAppLink' ? (pin.args || '') : '';
    dom.get('editTaskbarPinWorkingDir').value = pin.pinType === 'desktopAppLink' ? (pin.workingDir || '') : '';
    dom.get('editTaskbarPinIconPath').value = pin.iconPath || '';

    updateEdgeArgsVisibility('editTaskbar', 'editTaskbarPinTarget', 'editTaskbarEdgeArgsGroup');
    updateEditTaskbarPinTypeUI();

    dom.get('taskbarEditPanel').classList.remove('hidden');
    dom.get('taskbarEditPanel').setAttribute('aria-hidden', 'false');
}

function saveEditPin() {
    if (editingPinIndex === null) return;
    const pin = state.startPins[editingPinIndex];
    if (!pin) return;

    const name = dom.get('editPinName').value.trim();
    if (!name) {
        showToast('Pin name is required.', { type: 'error' });
        return;
    }

    pin.name = name;

    if (pin.pinType === 'desktopAppLink') {
        pin.target = dom.get('editPinTarget').value.trim();
        pin.args = dom.get('editPinArgs').value.trim();
        pin.workingDir = dom.get('editPinWorkingDir').value.trim();
        pin.iconPath = dom.get('editPinIconPath').value.trim();
        pin.systemShortcut = dom.get('editPinShortcutPath').value.trim();
    } else if (pin.pinType === 'packagedAppId') {
        pin.packagedAppId = dom.get('editPinPackagedAppId').value.trim();
    } else if (pin.pinType === 'secondaryTile') {
        pin.tileId = dom.get('editTileId').value.trim();
        const url = dom.get('editTileUrl').value.trim();
        if (!url) {
            showToast('Tile URL or file path is required.', { type: 'error' });
            return;
        }
        pin.args = url;
        pin.packagedAppId = dom.get('editTilePackagedAppId').value.trim() || 'Microsoft.MicrosoftEdge.Stable_8wekyb3d8bbwe!App';
    }

    renderPinList();
    updatePreview();
    cancelEditPin();
}

function saveTaskbarPin() {
    if (editingPinIndex === null) return;
    const pin = state.taskbarPins[editingPinIndex];
    if (!pin) return;

    const name = dom.get('editTaskbarPinName').value.trim();
    const type = dom.get('editTaskbarPinType').value;
    const value = dom.get('editTaskbarPinValue').value.trim();
    const target = dom.get('editTaskbarPinTarget').value.trim();

    if (!name) {
        showToast('Taskbar pin name is required.', { type: 'error' });
        return;
    }

    if (type === 'packagedAppId' && !value) {
        showToast('Packaged app ID is required.', { type: 'error' });
        return;
    }

    if (type === 'desktopAppLink' && !target) {
        showToast('Target path is required for taskbar shortcuts.', { type: 'error' });
        return;
    }

    pin.name = name;
    pin.pinType = type === 'packagedAppId' ? 'packagedAppId' : 'desktopAppLink';
    pin.packagedAppId = type === 'packagedAppId' ? value : '';
    pin.systemShortcut = '';
    pin.target = type === 'desktopAppLink' ? target : '';
    pin.args = type === 'desktopAppLink' ? dom.get('editTaskbarPinArgs').value.trim() : '';
    pin.workingDir = type === 'desktopAppLink' ? dom.get('editTaskbarPinWorkingDir').value.trim() : '';
    pin.iconPath = type === 'packagedAppId' ? '' : dom.get('editTaskbarPinIconPath').value.trim();

    renderTaskbarPinList();
    updatePreview();
    cancelTaskbarPinEdit();
}

function cancelEditPin() {
    editingPinIndex = null;
    editingPinListType = null;
    dom.get('pinEditPanel').classList.add('hidden');
}

function cancelTaskbarPinEdit() {
    editingPinIndex = null;
    editingPinListType = null;
    dom.get('taskbarEditPanel').classList.add('hidden');
    dom.get('taskbarEditPanel').setAttribute('aria-hidden', 'true');
}

/* ============================================================================
   Move/Remove/Duplicate Functions
   ============================================================================ */

function movePinUp(index) {
    if (index <= 0) return;
    const [pin] = state.startPins.splice(index, 1);
    state.startPins.splice(index - 1, 0, pin);
    renderPinList();
    updatePreview();
}

function movePinDown(index) {
    if (index >= state.startPins.length - 1) return;
    const [pin] = state.startPins.splice(index, 1);
    state.startPins.splice(index + 1, 0, pin);
    renderPinList();
    updatePreview();
}

function moveTaskbarPinUp(index) {
    if (index <= 0) return;
    const [pin] = state.taskbarPins.splice(index, 1);
    state.taskbarPins.splice(index - 1, 0, pin);
    renderTaskbarPinList();
    updatePreview();
}

function moveTaskbarPinDown(index) {
    if (index >= state.taskbarPins.length - 1) return;
    const [pin] = state.taskbarPins.splice(index, 1);
    state.taskbarPins.splice(index + 1, 0, pin);
    renderTaskbarPinList();
    updatePreview();
}

function removePin(index) {
    state.startPins.splice(index, 1);
    renderPinList();
    updatePreview();
}

function removeTaskbarPin(index) {
    state.taskbarPins.splice(index, 1);
    renderTaskbarPinList();
    updatePreview();
}

function duplicatePin(index) {
    const pin = state.startPins[index];
    if (!pin) return;

    let clone = null;
    if (pin.pinType === 'secondaryTile') {
        clone = {
            name: buildUniquePinName(`${pin.name || 'Edge Site'} Copy`, 'start'),
            pinType: 'secondaryTile',
            packagedAppId: pin.packagedAppId || 'Microsoft.MicrosoftEdge.Stable_8wekyb3d8bbwe!App',
            args: pin.args || '',
            tileId: ''
        };
    } else if (pin.pinType === 'packagedAppId') {
        clone = {
            name: buildUniquePinName(`${pin.name || 'App'} Copy`, 'start'),
            pinType: 'packagedAppId',
            packagedAppId: pin.packagedAppId || ''
        };
    } else {
        clone = {
            name: buildUniquePinName(`${pin.name || 'Shortcut'} Copy`, 'start'),
            pinType: 'desktopAppLink',
            target: pin.target || '',
            args: pin.args || '',
            workingDir: pin.workingDir || '',
            iconPath: pin.iconPath || '',
            systemShortcut: pin.systemShortcut || ''
        };
    }

    state.startPins.push(clone);
    renderPinList();
    editPin(state.startPins.length - 1);
    updatePreview();
}

function copyPinToTaskbar(index) {
    const pin = state.startPins[index];
    if (!pin) return;

    // Only desktop and packaged app pins can be copied to taskbar (not secondary tiles)
    if (pin.pinType !== 'desktopAppLink' && pin.pinType !== 'packagedAppId') {
        showToast('Edge site tiles cannot be pinned to the taskbar.', { type: 'error' });
        return;
    }

    // Check if already on taskbar
    if (pin.pinType === 'packagedAppId') {
        if (state.taskbarPins.some(p => p.pinType === 'packagedAppId' && p.packagedAppId === pin.packagedAppId)) {
            showToast('This app is already pinned to the taskbar.', { type: 'info' });
            return;
        }
    } else {
        const targetMatch = pin.target || pin.systemShortcut;
        if (targetMatch && state.taskbarPins.some(p => p.target === targetMatch || p.systemShortcut === targetMatch)) {
            showToast('This app is already pinned to the taskbar.', { type: 'info' });
            return;
        }
    }

    // Clone the pin for taskbar
    const taskbarPin = {
        name: pin.name || 'Unnamed',
        pinType: pin.pinType,
        packagedAppId: pin.packagedAppId || '',
        systemShortcut: pin.systemShortcut || '',
        target: pin.target || '',
        args: pin.args || '',
        workingDir: pin.workingDir || '',
        iconPath: pin.iconPath || ''
    };

    state.taskbarPins.push(taskbarPin);
    renderTaskbarPinList();
    updatePreview();
}

/* ============================================================================
   Pin from Allowed Apps
   ============================================================================ */

function pinAllowedToStart(index) {
    const app = state.allowedApps[index];
    if (!app) return;

    if (app.type === 'aumid') {
        if (state.startPins.some(p => p.pinType === 'packagedAppId' && p.packagedAppId === app.value)) {
            showToast('This app is already pinned to Start.', { type: 'info' });
            return;
        }
        state.startPins.push({
            name: buildPinNameFromApp(app),
            pinType: 'packagedAppId',
            packagedAppId: app.value
        });
    } else {
        if (state.startPins.some(p => p.pinType === 'desktopAppLink' && p.target === app.value)) {
            showToast('This app is already pinned to Start.', { type: 'info' });
            return;
        }
        state.startPins.push({
            name: buildPinNameFromApp(app),
            pinType: 'desktopAppLink',
            target: app.value,
            args: '',
            workingDir: '',
            iconPath: ''
        });
    }

    renderPinList();
    updatePreview();
}

function pinAllowedToTaskbar(index) {
    const app = state.allowedApps[index];
    if (!app) return;

    if (app.type === 'aumid') {
        if (state.taskbarPins.some(p => p.pinType === 'packagedAppId' && p.packagedAppId === app.value)) {
            showToast('This app is already pinned to the taskbar.', { type: 'info' });
            return;
        }
        state.taskbarPins.push({
            name: buildPinNameFromApp(app),
            pinType: 'packagedAppId',
            packagedAppId: app.value,
            systemShortcut: '',
            target: '',
            iconPath: ''
        });
    } else {
        if (state.taskbarPins.some(p => p.pinType === 'desktopAppLink' && p.target === app.value)) {
            showToast('This app is already pinned to the taskbar.', { type: 'info' });
            return;
        }
        state.taskbarPins.push({
            name: buildPinNameFromApp(app),
            pinType: 'desktopAppLink',
            packagedAppId: '',
            systemShortcut: '',
            target: app.value,
            args: '',
            workingDir: '',
            iconPath: ''
        });
    }

    renderTaskbarPinList();
    updatePreview();
}

function addAllowedEdgeTile(index) {
    const app = state.allowedApps[index];
    if (!app) return;

    const isEdge = isEdgeApp(app.value) || app.value === 'Microsoft.MicrosoftEdge.Stable_8wekyb3d8bbwe!App';
    if (!isEdge) {
        showToast('Edge site tiles require Microsoft Edge in the allowed apps list.', { type: 'error' });
        return;
    }

    ensureEdgeDependencies(app);

    const name = prompt('Tile name:', 'Edge Site');
    if (!name) return;
    const urlInput = prompt('URL or file path:', 'https://');
    const url = normalizeTileUrl(urlInput);
    if (!url) return;

    if (state.startPins.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        showToast('A pin with this name already exists.', { type: 'error' });
        return;
    }

    state.startPins.push({
        name: name,
        pinType: 'secondaryTile',
        packagedAppId: 'Microsoft.MicrosoftEdge.Stable_8wekyb3d8bbwe!App',
        args: url,
        tileId: ''
    });

    renderPinList();
    updatePreview();
}

/* ============================================================================
   Drag and Drop
   ============================================================================ */

let dragPinContext = null;

function handlePinDragStart(event) {
    const item = event.target.closest('.app-item.draggable');
    if (!item || item.getAttribute('draggable') !== 'true') return;
    dragPinContext = {
        list: item.dataset.pinList,
        index: parseInt(item.dataset.index, 10)
    };
    item.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', 'pin');
}

function handlePinDragOver(event) {
    const target = event.target.closest('.app-item.draggable');
    if (!dragPinContext || !target || target.dataset.pinList !== dragPinContext.list) return;
    event.preventDefault();
    target.classList.add('drag-over');
}

function handlePinDragLeave(event) {
    const target = event.target.closest('.app-item.draggable');
    if (target) {
        target.classList.remove('drag-over');
    }
}

function handlePinDrop(event) {
    const target = event.target.closest('.app-item.draggable');
    if (!dragPinContext || !target || target.dataset.pinList !== dragPinContext.list) return;
    event.preventDefault();

    const toIndex = parseInt(target.dataset.index, 10);
    const fromIndex = dragPinContext.index;
    if (Number.isNaN(toIndex) || Number.isNaN(fromIndex) || toIndex === fromIndex) {
        dragPinContext = null;
        return;
    }

    const pins = dragPinContext.list === 'start' ? state.startPins : state.taskbarPins;
    if (!pins || !pins[fromIndex]) {
        dragPinContext = null;
        return;
    }

    const [moved] = pins.splice(fromIndex, 1);
    pins.splice(toIndex, 0, moved);

    dragPinContext = null;
    if (target.dataset.pinList === 'start') {
        renderPinList();
    } else {
        renderTaskbarPinList();
    }
    updatePreview();
}

function handlePinDragEnd(event) {
    const item = event.target.closest('.app-item.draggable');
    if (item) {
        item.classList.remove('dragging');
    }
    document.querySelectorAll('.app-item.drag-over').forEach(el => el.classList.remove('drag-over'));
    dragPinContext = null;
}

/* ============================================================================
   Keyboard Reorder
   ============================================================================ */

let reorderContext = null;

function announceReorder(message) {
    const region = document.getElementById('reorderLiveRegion');
    if (!region) return;
    // Clear then set to force re-announcement of identical text
    region.textContent = '';
    setTimeout(() => { region.textContent = message; }, 50);
}

function enterReorderMode(grip) {
    if (reorderContext) exitReorderMode(true);

    const listType = grip.dataset.pinList;
    const index = parseInt(grip.dataset.index, 10);
    const pins = listType === 'start' ? state.startPins : state.taskbarPins;
    if (!pins || !pins[index]) return;

    reorderContext = {
        listType,
        originalIndex: index,
        currentIndex: index,
        originalOrder: JSON.parse(JSON.stringify(pins)),
        grip
    };

    const item = grip.closest('.app-item');
    if (item) item.classList.add('reorder-active');

    const name = pins[index].name || 'pin';
    const total = pins.length;
    announceReorder(`Reordering ${name}. Use arrow keys to move, Enter to confirm, Escape to cancel.`);
}

function exitReorderMode(cancel) {
    if (!reorderContext) return;

    const { listType, originalIndex, currentIndex, originalOrder } = reorderContext;
    const pins = listType === 'start' ? state.startPins : state.taskbarPins;
    const name = pins[currentIndex]?.name || 'pin';
    const total = pins.length;

    if (cancel) {
        // Restore original order
        pins.length = 0;
        originalOrder.forEach(p => pins.push(p));
        announceReorder('Reorder cancelled.');
    } else {
        announceReorder(`${name} moved to position ${currentIndex + 1} of ${total}.`);
    }

    reorderContext = null;

    if (listType === 'start') {
        renderPinList();
    } else {
        renderTaskbarPinList();
    }
    updatePreview();

    // Re-focus the grip at the final position
    const targetIndex = cancel ? originalIndex : currentIndex;
    requestAnimationFrame(() => {
        const listId = listType === 'start' ? 'pinList' : 'taskbarPinList';
        const listEl = document.getElementById(listId);
        if (!listEl) return;
        const grip = listEl.querySelector(`[data-reorder-grip][data-index="${targetIndex}"]`);
        if (grip) grip.focus();
    });
}

function moveReorder(direction) {
    if (!reorderContext) return;

    const { listType, currentIndex } = reorderContext;
    const pins = listType === 'start' ? state.startPins : state.taskbarPins;
    const total = pins.length;
    let newIndex;

    if (direction === 'up') {
        newIndex = currentIndex - 1;
    } else if (direction === 'down') {
        newIndex = currentIndex + 1;
    } else if (direction === 'home') {
        newIndex = 0;
    } else if (direction === 'end') {
        newIndex = total - 1;
    }

    if (newIndex < 0 || newIndex >= total || newIndex === currentIndex) return;

    // Swap in data model
    const [moved] = pins.splice(currentIndex, 1);
    pins.splice(newIndex, 0, moved);
    reorderContext.currentIndex = newIndex;

    // Re-render and re-focus
    const listId = listType === 'start' ? 'pinList' : 'taskbarPinList';
    if (listType === 'start') {
        renderPinList();
    } else {
        renderTaskbarPinList();
    }

    // Re-apply active state and focus the grip at new position
    requestAnimationFrame(() => {
        if (!reorderContext) return; // reorder may have been confirmed/cancelled
        const listEl = document.getElementById(listId);
        if (!listEl) return;
        const newItem = listEl.querySelector(`[data-index="${newIndex}"]`);
        if (newItem) newItem.classList.add('reorder-active');
        const grip = listEl.querySelector(`[data-reorder-grip][data-index="${newIndex}"]`);
        if (grip) grip.focus();
    });

    const name = moved.name || 'pin';
    announceReorder(`${name}, position ${newIndex + 1} of ${total}.`);
}

function handleReorderKeydown(event) {
    // If reorder mode is active, handle keys globally (grip may have been re-rendered)
    if (reorderContext) {
        switch (event.key) {
            case 'ArrowUp':
                event.preventDefault();
                moveReorder('up');
                return;
            case 'ArrowDown':
                event.preventDefault();
                moveReorder('down');
                return;
            case 'Home':
                event.preventDefault();
                moveReorder('home');
                return;
            case 'End':
                event.preventDefault();
                moveReorder('end');
                return;
            case 'Enter':
            case ' ':
                event.preventDefault();
                exitReorderMode(false);
                return;
            case 'Escape':
                event.preventDefault();
                exitReorderMode(true);
                return;
        }
        return;
    }

    // Not in reorder mode — Enter/Space on a grip activates reorder mode
    const grip = event.target.closest('[data-reorder-grip]');
    if (!grip) return;

    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        enterReorderMode(grip);
    }
}

// Delegate keydown from document for reorder grips
document.addEventListener('keydown', handleReorderKeydown);
