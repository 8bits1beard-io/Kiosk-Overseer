/* ============================================================================
   Validation
   ============================================================================ */
function validate() {
    function isStartMenuShortcutPath(path) {
        if (!path) return false;
        const normalized = path.replace(/\//g, '\\').toLowerCase();
        const startMenuFragment = '\\microsoft\\windows\\start menu\\programs\\';
        const hasFragment = normalized.includes(startMenuFragment);
        const allowedRoots = [
            '%appdata%',
            '%allusersprofile%',
            '%programdata%',
            'c:\\users\\',
            'c:\\programdata\\'
        ];
        return hasFragment && allowedRoots.some(root => normalized.startsWith(root));
    }

    const rules = [
        () => {
            const errs = [];
            const configName = dom.get('configName').value.trim();
            if (!configName) {
                errs.push({ message: 'Configuration Name is required', field: 'configName', tab: 'account' });
            }
            const profileId = dom.get('profileId').value;
            if (!profileId) {
                errs.push({ message: 'Profile GUID is required', field: 'profileId', tab: 'account' });
            } else if (!/^\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}$/i.test(profileId)) {
                errs.push({ message: 'Profile GUID format is invalid', field: 'profileId', tab: 'account' });
            }
            return errs;
        },
        () => {
            const errs = [];
            if (state.accountType === 'auto') {
                const displayName = dom.get('displayName').value;
                if (!displayName) errs.push({ message: 'Display Name is required for auto-logon account', field: 'displayName', tab: 'account' });
            } else if (state.accountType === 'existing') {
                const accountName = dom.get('accountName').value;
                if (!accountName) errs.push({ message: 'Account Name is required', field: 'accountName', tab: 'account' });
            } else if (state.accountType === 'group') {
                const groupName = dom.get('groupName').value;
                if (!groupName) errs.push({ message: 'Group Name is required', field: 'groupName', tab: 'account' });
            }
            return errs;
        },
        () => {
            const errs = [];
            if (state.mode !== 'single') return errs;

            const appType = dom.get('appType').value;
            if (appType === 'edge') {
                const sourceType = dom.get('edgeSourceType').value;
                if (sourceType === 'url') {
                    const url = dom.get('edgeUrl').value;
                    if (!url) errs.push({ message: 'Edge URL is required', field: 'edgeUrl', tab: 'apps' });
                } else {
                    const filePath = dom.get('edgeFilePath').value;
                    if (!filePath) errs.push({ message: 'Edge file path is required', field: 'edgeFilePath', tab: 'apps' });
                }
            } else if (appType === 'uwp') {
                const aumid = dom.get('uwpAumid').value;
                if (!aumid) errs.push({ message: 'UWP App AUMID is required', field: 'uwpAumid', tab: 'apps' });
            } else if (appType === 'win32') {
                const path = dom.get('win32Path').value;
                if (!path) errs.push({ message: 'Win32 Application Path is required', field: 'win32Path', tab: 'apps' });
            }

            return errs;
        },
        () => {
            const errs = [];
            if (state.mode !== 'multi' && state.mode !== 'restricted') return errs;

            if (state.allowedApps.length === 0) {
                errs.push({ message: 'At least one allowed app is required', field: null, tab: 'apps' });
            }

            const missingTargets = state.startPins.filter(p => p.pinType === 'desktopAppLink' && !p.target && !p.systemShortcut);
            if (missingTargets.length > 0) {
                errs.push({ message: `${missingTargets.length} shortcut(s) missing target path: ${missingTargets.map(p => p.name).join(', ')}`, field: null, tab: 'layout' });
            }

            const invalidShortcutPaths = state.startPins.filter(p => p.systemShortcut && !isStartMenuShortcutPath(p.systemShortcut));
            if (invalidShortcutPaths.length > 0) {
                errs.push({ message: `Start menu pin shortcuts must live under the Start Menu Programs folder (%APPDATA% or %ALLUSERSPROFILE%): ${invalidShortcutPaths.map(p => p.name).join(', ')}`, field: null, tab: 'layout' });
            }

            return errs;
        }
    ];

    return rules.flatMap(rule => rule());
}

function validateField(fieldId) {
    const errors = validate();
    const fieldError = errors.find(e => e.field === fieldId);
    return fieldError ? fieldError.message : null;
}

function showValidation() {
    const errors = validate();
    const statusDiv = dom.get('validationStatus');

    const profileId = dom.get('profileId').value.trim();
    const hasValidProfile = /^\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}$/i.test(profileId);

    let hasAccount = false;
    if (state.accountType === 'auto') {
        hasAccount = Boolean(dom.get('displayName').value.trim());
    } else if (state.accountType === 'existing') {
        hasAccount = Boolean(dom.get('accountName').value.trim());
    } else if (state.accountType === 'group') {
        hasAccount = Boolean(dom.get('groupName').value.trim());
    } else if (state.accountType === 'global') {
        hasAccount = true;
    }

    let hasApp = false;
    if (state.mode === 'single') {
        const appType = dom.get('appType').value;
        if (appType === 'edge') {
            const src = dom.get('edgeSourceType').value;
            hasApp = src === 'url' ? Boolean(dom.get('edgeUrl').value.trim()) : Boolean(dom.get('edgeFilePath').value.trim());
        } else if (appType === 'uwp') {
            hasApp = Boolean(dom.get('uwpAumid').value.trim());
        } else if (appType === 'win32') {
            hasApp = Boolean(dom.get('win32Path').value.trim());
        }
    } else {
        hasApp = state.allowedApps.length > 0;
    }

    const hasConfigName = Boolean(dom.get('configName').value.trim());
    const hasPins = state.mode === 'single' || state.startPins.length > 0;

    const checks = [
        { label: 'Configuration Name', ok: hasConfigName },
        { label: 'Profile GUID', ok: hasValidProfile },
        { label: 'Account configured', ok: hasAccount },
        { label: 'App configured', ok: hasApp },
        { label: 'Start pins', ok: hasPins, optional: state.mode !== 'single' }
    ];

    const checklistHtml = checks.map(c => {
        let icon, cls;
        if (c.ok) {
            icon = 'OK'; cls = 'check-ok';
        } else if (c.optional) {
            icon = '--'; cls = 'check-optional';
        } else {
            icon = '!!'; cls = 'check-error';
        }
        return `<div class="validation-check ${cls}"><span class="validation-check-icon">${icon}</span> ${c.label}</div>`;
    }).join('');

    const errorHtml = errors.length > 0
        ? `<div class="status error" style="margin-top: 10px;">
            <strong>Errors:</strong>
            <ul style="margin: 5px 0 0 20px;">${errors.map(e => `<li>${e.message}</li>`).join('')}</ul>
        </div>`
        : '';

    statusDiv.innerHTML = `<div class="validation-checklist">${checklistHtml}</div>${errorHtml}`;

    return errors.length === 0;
}
