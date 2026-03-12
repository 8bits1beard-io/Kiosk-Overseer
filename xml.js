/* ============================================================================
   XML Generation
   ============================================================================ */
function generateXml() {
    const profileId = dom.get('profileId').value || '{00000000-0000-0000-0000-000000000000}';

    let xml = `<?xml version="1.0" encoding="utf-8"?>\n`;
    xml += `<AssignedAccessConfiguration\n`;
    xml += `    xmlns="http://schemas.microsoft.com/AssignedAccess/2017/config"\n`;
    xml += `    xmlns:rs5="http://schemas.microsoft.com/AssignedAccess/201810/config"\n`;
    xml += `    xmlns:v3="http://schemas.microsoft.com/AssignedAccess/2020/config"\n`;
    xml += `    xmlns:v4="http://schemas.microsoft.com/AssignedAccess/2021/config"\n`;
    xml += `    xmlns:v5="http://schemas.microsoft.com/AssignedAccess/2022/config">\n`;

    xml += `    <Profiles>\n`;
    const profileName = escapeAttr(dom.get('configName').value.trim());
    xml += profileName
        ? `        <Profile Id="${profileId}" Name="${profileName}">\n`
        : `        <Profile Id="${profileId}">\n`;

    if (state.mode === 'single') {
        xml += generateSingleAppProfile();
    } else {
        // Both 'multi' and 'restricted' use the same profile structure
        xml += generateMultiAppProfile();
    }

    xml += `        </Profile>\n`;
    xml += `    </Profiles>\n`;

    // Use the new generateConfigsSection for proper account handling
    xml += generateConfigsSection();

    xml += `</AssignedAccessConfiguration>`;

    return xml;
}

function generateSingleAppProfile() {
    const appType = dom.get('appType').value;
    let xml = '';

    if (appType === 'edge') {
        const url = getEdgeUrl();
        const kioskType = dom.get('edgeKioskType').value;
        const idleTimeout = parseInt(dom.get('edgeIdleTimeout').value) || 0;

        // Edge kiosk mode always runs InPrivate automatically, so --inprivate is not needed
        const args = buildEdgeKioskArgs(url, kioskType, idleTimeout);

        // Edge Chromium is a Win32 app - use ClassicAppPath, not AppUserModelId
        xml += `            <KioskModeApp v4:ClassicAppPath="%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" v4:ClassicAppArguments="${escapeXml(args)}"/>\n`;
    } else if (appType === 'uwp') {
        const aumid = dom.get('uwpAumid').value;
        xml += `            <KioskModeApp AppUserModelId="${escapeXml(aumid)}"/>\n`;
    } else if (appType === 'win32') {
        const path = dom.get('win32Path').value;
        const args = dom.get('win32Args').value;

        if (args) {
            xml += `            <KioskModeApp v4:ClassicAppPath="${escapeXml(path)}" v4:ClassicAppArguments="${escapeXml(args)}"/>\n`;
        } else {
            xml += `            <KioskModeApp v4:ClassicAppPath="${escapeXml(path)}"/>\n`;
        }
    }

    // Add breakout sequence if enabled
    const breakoutSequence = getBreakoutSequence();
    if (breakoutSequence) {
        xml += `            <v4:BreakoutSequence Key="${escapeXml(breakoutSequence)}"/>\n`;
    }

    return xml;
}

function generateMultiAppProfile() {
    let xml = '';

    // AllAppsList
    xml += `            <AllAppsList>\n`;
    xml += `                <AllowedApps>\n`;

    state.allowedApps.forEach((app, index) => {
        const isAutoLaunch = state.autoLaunchApp === index;
        const isEdge = isEdgeApp(app.value);

        // Build base attribute
        let attrs = app.type === 'aumid'
            ? `AppUserModelId="${escapeXml(app.value)}"`
            : `DesktopAppPath="${escapeXml(app.value)}"`;

        // Add AutoLaunch attributes if this is the auto-launch app
        if (isAutoLaunch) {
            attrs += ` rs5:AutoLaunch="true"`;

            // If Edge is auto-launched, add kiosk arguments
            // Edge kiosk mode always runs InPrivate automatically, so --inprivate is not needed
            if (isEdge) {
                const url = getMultiAppEdgeUrl();
                const kioskType = dom.get('multiEdgeKioskType').value;

                const args = buildEdgeKioskArgs(url, kioskType, 0);
                attrs += ` rs5:AutoLaunchArguments="${escapeXml(args)}"`;
            } else if (app.type === 'path') {
                // Non-Edge Win32 app - add arguments if specified
                const win32Args = dom.get('win32AutoLaunchArgs').value.trim();
                if (win32Args) {
                    attrs += ` rs5:AutoLaunchArguments="${escapeXml(win32Args)}"`;
                }
            }
        }

        xml += `                    <App ${attrs}/>\n`;
    });

    xml += `                </AllowedApps>\n`;
    xml += `            </AllAppsList>\n`;

    // File Explorer Restrictions
    const fileAccess = dom.get('fileExplorerAccess').value;
    if (fileAccess === 'downloads') {
        xml += `            <rs5:FileExplorerNamespaceRestrictions>\n`;
        xml += `                <rs5:AllowedNamespace Name="Downloads"/>\n`;
        xml += `            </rs5:FileExplorerNamespaceRestrictions>\n`;
    } else if (fileAccess === 'removable') {
        xml += `            <rs5:FileExplorerNamespaceRestrictions>\n`;
        xml += `                <v3:AllowRemovableDrives/>\n`;
        xml += `            </rs5:FileExplorerNamespaceRestrictions>\n`;
    } else if (fileAccess === 'downloads-removable') {
        xml += `            <rs5:FileExplorerNamespaceRestrictions>\n`;
        xml += `                <rs5:AllowedNamespace Name="Downloads"/>\n`;
        xml += `                <v3:AllowRemovableDrives/>\n`;
        xml += `            </rs5:FileExplorerNamespaceRestrictions>\n`;
    } else if (fileAccess === 'all') {
        xml += `            <rs5:FileExplorerNamespaceRestrictions>\n`;
        xml += `                <v3:NoRestriction/>\n`;
        xml += `            </rs5:FileExplorerNamespaceRestrictions>\n`;
    }

    // Start Pins (Windows 11)
    // Supports three pin types: packagedAppId (UWP), desktopAppLink (.lnk), secondaryTile (Edge URLs)
    const pinsJson = buildStartPinsJson();
    if (pinsJson) {
        xml += `            <v5:StartPins><![CDATA[${JSON.stringify(pinsJson)}]]></v5:StartPins>\n`;
    }

    // Taskbar (multi-app/restricted only)
    if (state.mode === 'multi' || state.mode === 'restricted') {
        const showTaskbar = dom.get('showTaskbar').checked;
        xml += `            <Taskbar ShowTaskbar="${showTaskbar}"/>\n`;

        const taskbarLayoutXml = buildTaskbarLayoutXml();
        if (taskbarLayoutXml) {
            xml += `            <v5:TaskbarLayout><![CDATA[${taskbarLayoutXml}]]></v5:TaskbarLayout>\n`;
        }
    }

    return xml;
}

function buildStartPinsJson() {
    if (state.startPins.length === 0) {
        return null;
    }

    return {
        pinnedList: state.startPins.map(p => {
            // UWP/Store apps use packagedAppId
            if (p.pinType === 'packagedAppId' && p.packagedAppId) {
                return { packagedAppId: p.packagedAppId };
            }
            // Edge with specific URL uses secondaryTile
            if (p.pinType === 'secondaryTile' && p.packagedAppId) {
                return {
                    secondaryTile: {
                        tileId: p.tileId || `MSEdge._pin_${p.name.replace(/[^a-zA-Z0-9]/g, '')}`,
                        arguments: p.args || '',
                        displayName: p.name,
                        packagedAppId: p.packagedAppId
                    }
                };
            }
            // Win32 apps use desktopAppLink (.lnk shortcut)
            // Use system shortcut if available, otherwise Start Menu Programs path
            return {
                desktopAppLink: p.systemShortcut || `%ALLUSERSPROFILE%\\Microsoft\\Windows\\Start Menu\\Programs\\${p.name}.lnk`
            };
        })
    };
}

function buildTaskbarLayoutXml() {
    const sourcePins = state.taskbarPins;
    if (!sourcePins || sourcePins.length === 0) {
        return null;
    }

    const entries = sourcePins.map(pin => {
        if (pin.pinType === 'desktopAppLink') {
            const linkPath = pin.systemShortcut || `%ALLUSERSPROFILE%\\Microsoft\\Windows\\Start Menu\\Programs\\${pin.name}.lnk`;
            return `<taskbar:DesktopApp DesktopApplicationLinkPath="${escapeXml(linkPath)}"/>`;
        }
        if (pin.pinType === 'packagedAppId' && pin.packagedAppId) {
            return `<taskbar:UWA AppUserModelID="${escapeXml(pin.packagedAppId)}"/>`;
        }
        return '';
    }).filter(Boolean);

    if (entries.length === 0) {
        return null;
    }

    const replacePins = dom.get('replaceTaskbarPins')?.checked;
    const pinListAttr = replacePins ? ' PinListPlacement="Replace"' : '';

    return `<?xml version="1.0" encoding="utf-8"?>\n` +
`<LayoutModificationTemplate\n` +
`    xmlns="http://schemas.microsoft.com/Start/2014/LayoutModification"\n` +
`    xmlns:defaultlayout="http://schemas.microsoft.com/Start/2014/FullDefaultLayout"\n` +
`    xmlns:start="http://schemas.microsoft.com/Start/2014/StartLayout"\n` +
`    xmlns:taskbar="http://schemas.microsoft.com/Start/2014/TaskbarLayout"\n` +
`    Version="1">\n` +
`    <CustomTaskbarLayoutCollection${pinListAttr}>\n` +
`        <defaultlayout:TaskbarLayout>\n` +
`            <taskbar:TaskbarPinList>\n` +
`                ${entries.join('\n                ')}\n` +
`            </taskbar:TaskbarPinList>\n` +
`        </defaultlayout:TaskbarLayout>\n` +
`    </CustomTaskbarLayoutCollection>\n` +
`</LayoutModificationTemplate>`;
}

function generateAccountConfig() {
    let xml = '';
    const profileId = dom.get('profileId').value;

    if (state.accountType === 'auto') {
        const displayName = dom.get('displayName').value || 'Kiosk';
        xml += `            <AutoLogonAccount rs5:DisplayName="${escapeXml(displayName)}"/>\n`;
    } else if (state.accountType === 'existing') {
        const accountName = dom.get('accountName').value;
        xml += `            <Account>${escapeXml(accountName)}</Account>\n`;
    } else if (state.accountType === 'group') {
        const groupType = dom.get('groupType').value;
        const groupName = dom.get('groupName').value;
        xml += `            <UserGroup Type="${groupType}" Name="${escapeXml(groupName)}"/>\n`;
    }
    // Note: 'global' account type doesn't add anything here - it uses GlobalProfile instead

    return xml;
}

function generateConfigsSection() {
    const profileId = dom.get('profileId').value;
    let xml = '';

    xml += `    <Configs>\n`;

    if (state.accountType === 'global') {
        // Global profile applies to all non-admin users
        const excludeOwner = dom.get('excludeDeviceOwner')?.checked;
        if (excludeOwner) {
            xml += `        <v3:GlobalProfile Id="${profileId}">\n`;
            xml += `            <v5:Exclusions>\n`;
            xml += `                <SpecialGroup Name="DeviceOwner"/>\n`;
            xml += `            </v5:Exclusions>\n`;
            xml += `        </v3:GlobalProfile>\n`;
        } else {
            xml += `        <v3:GlobalProfile Id="${profileId}"/>\n`;
        }
    } else {
        xml += `        <Config>\n`;
        xml += generateAccountConfig();
        xml += `            <DefaultProfile Id="${profileId}"/>\n`;
        xml += `        </Config>\n`;
    }

    xml += `    </Configs>\n`;

    return xml;
}
