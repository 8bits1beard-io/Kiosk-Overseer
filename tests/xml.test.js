// Run: node --test tests/
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

const {
    state,
    setDomValue,
    setDomChecked,
    resetDom,
    resetState,
    generateXml,
    generateSingleAppProfile,
    generateMultiAppProfile,
    buildStartPinsJson,
    buildTaskbarLayoutXml,
    generateConfigsSection,
    escapeXml,
} = require('./setup.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function setupBasicDom() {
    setDomValue('profileId', '{12345678-1234-1234-1234-123456789abc}');
    setDomValue('configName', 'TestConfig');
    setDomValue('displayName', 'Kiosk');
    setDomValue('edgeSourceType', 'url');
    setDomValue('edgeUrl', 'https://example.com');
    setDomValue('edgeFilePath', '');
    setDomValue('edgeKioskType', 'fullscreen');
    setDomValue('edgeIdleTimeout', '0');
    setDomValue('appType', 'edge');
    setDomChecked('enableBreakout', false);
    setDomValue('fileExplorerAccess', 'none');
    setDomChecked('showTaskbar', true);
    setDomChecked('replaceTaskbarPins', false);
    setDomValue('multiEdgeSourceType', 'url');
    setDomValue('multiEdgeUrl', 'https://example.com');
    setDomValue('multiEdgeFilePath', '');
    setDomValue('multiEdgeKioskType', 'fullscreen');
    setDomValue('win32AutoLaunchArgs', '');
}

// ---------------------------------------------------------------------------
// generateXml — single-app mode
// ---------------------------------------------------------------------------
describe('generateXml() — single-app mode', () => {
    beforeEach(() => {
        resetDom();
        resetState();
        setupBasicDom();
        state.mode = 'single';
        state.accountType = 'auto';
    });

    it('generates Edge kiosk fullscreen XML', () => {
        setDomValue('appType', 'edge');
        setDomValue('edgeKioskType', 'fullscreen');
        setDomValue('edgeUrl', 'https://example.com');

        const xml = generateXml();
        assert.ok(xml.includes('msedge.exe'));
        assert.ok(xml.includes('--edge-kiosk-type=fullscreen'));
        assert.ok(xml.includes('--kiosk https://example.com'));
        assert.ok(xml.includes('v4:ClassicAppPath'));
        assert.ok(xml.includes('v4:ClassicAppArguments'));
    });

    it('generates Edge kiosk public-browsing XML', () => {
        setDomValue('appType', 'edge');
        setDomValue('edgeKioskType', 'public-browsing');

        const xml = generateXml();
        assert.ok(xml.includes('--edge-kiosk-type=public-browsing'));
    });

    it('generates UWP app XML', () => {
        setDomValue('appType', 'uwp');
        setDomValue('uwpAumid', 'Microsoft.WindowsCalculator_8wekyb3d8bbwe!App');

        const xml = generateXml();
        assert.ok(xml.includes('AppUserModelId="Microsoft.WindowsCalculator_8wekyb3d8bbwe!App"'));
        assert.ok(xml.includes('KioskModeApp'));
        // Should NOT have ClassicAppPath
        assert.ok(!xml.includes('ClassicAppPath'));
    });

    it('generates Win32 app XML without arguments', () => {
        setDomValue('appType', 'win32');
        setDomValue('win32Path', 'C:\\MyApp\\app.exe');
        setDomValue('win32Args', '');

        const xml = generateXml();
        assert.ok(xml.includes('v4:ClassicAppPath'));
        assert.ok(xml.includes('C:\\MyApp\\app.exe'));
        assert.ok(!xml.includes('v4:ClassicAppArguments'));
    });

    it('generates Win32 app XML with arguments', () => {
        setDomValue('appType', 'win32');
        setDomValue('win32Path', 'C:\\MyApp\\app.exe');
        setDomValue('win32Args', '--fullscreen --no-splash');

        const xml = generateXml();
        assert.ok(xml.includes('v4:ClassicAppPath'));
        assert.ok(xml.includes('v4:ClassicAppArguments'));
        assert.ok(xml.includes('--fullscreen --no-splash'));
    });

    it('includes breakout sequence when enabled', () => {
        setDomValue('appType', 'edge');
        setDomChecked('enableBreakout', true);
        setDomChecked('breakoutCtrl', true);
        setDomChecked('breakoutAlt', true);
        setDomChecked('breakoutShift', false);
        setDomValue('breakoutFinalKey', 'K');

        const xml = generateXml();
        assert.ok(xml.includes('v4:BreakoutSequence'));
        assert.ok(xml.includes('Ctrl+Alt+K'));
    });

    it('omits breakout sequence when disabled', () => {
        setDomValue('appType', 'edge');
        setDomChecked('enableBreakout', false);

        const xml = generateXml();
        assert.ok(!xml.includes('BreakoutSequence'));
    });
});

// ---------------------------------------------------------------------------
// generateXml — multi-app mode
// ---------------------------------------------------------------------------
describe('generateXml() — multi-app mode', () => {
    beforeEach(() => {
        resetDom();
        resetState();
        setupBasicDom();
        state.mode = 'multi';
        state.accountType = 'auto';
    });

    it('generates AllAppsList with multiple allowed apps', () => {
        state.allowedApps = [
            { type: 'aumid', value: 'Microsoft.WindowsCalculator_8wekyb3d8bbwe!App' },
            { type: 'path', value: '%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe' }
        ];

        const xml = generateXml();
        assert.ok(xml.includes('AllAppsList'));
        assert.ok(xml.includes('AllowedApps'));
        assert.ok(xml.includes('AppUserModelId="Microsoft.WindowsCalculator_8wekyb3d8bbwe!App"'));
        assert.ok(xml.includes('DesktopAppPath='));
    });

    it('marks auto-launch app with rs5:AutoLaunch="true"', () => {
        state.allowedApps = [
            { type: 'aumid', value: 'SomeApp!App' },
            { type: 'path', value: 'C:\\app.exe' }
        ];
        state.autoLaunchApp = 1;

        const xml = generateXml();
        // The second app should have AutoLaunch
        const lines = xml.split('\n');
        const appLines = lines.filter(l => l.includes('<App '));
        assert.strictEqual(appLines.length, 2);
        assert.ok(!appLines[0].includes('AutoLaunch'));
        assert.ok(appLines[1].includes('rs5:AutoLaunch="true"'));
    });

    it('adds kiosk arguments for auto-launched Edge app', () => {
        state.allowedApps = [
            { type: 'path', value: '%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe' }
        ];
        state.autoLaunchApp = 0;
        setDomValue('multiEdgeKioskType', 'fullscreen');
        setDomValue('multiEdgeUrl', 'https://kiosk.example.com');
        setDomValue('multiEdgeSourceType', 'url');

        const xml = generateXml();
        assert.ok(xml.includes('rs5:AutoLaunchArguments'));
        assert.ok(xml.includes('--kiosk https://kiosk.example.com'));
        assert.ok(xml.includes('--edge-kiosk-type=fullscreen'));
    });

    it('generates FileExplorerNamespaceRestrictions for downloads', () => {
        state.allowedApps = [{ type: 'aumid', value: 'App!App' }];
        setDomValue('fileExplorerAccess', 'downloads');

        const xml = generateXml();
        assert.ok(xml.includes('rs5:FileExplorerNamespaceRestrictions'));
        assert.ok(xml.includes('AllowedNamespace Name="Downloads"'));
    });

    it('generates FileExplorerNamespaceRestrictions for removable drives', () => {
        state.allowedApps = [{ type: 'aumid', value: 'App!App' }];
        setDomValue('fileExplorerAccess', 'removable');

        const xml = generateXml();
        assert.ok(xml.includes('rs5:FileExplorerNamespaceRestrictions'));
        assert.ok(xml.includes('v3:AllowRemovableDrives'));
    });

    it('generates FileExplorerNamespaceRestrictions for downloads + removable', () => {
        state.allowedApps = [{ type: 'aumid', value: 'App!App' }];
        setDomValue('fileExplorerAccess', 'downloads-removable');

        const xml = generateXml();
        assert.ok(xml.includes('AllowedNamespace Name="Downloads"'));
        assert.ok(xml.includes('v3:AllowRemovableDrives'));
    });

    it('generates NoRestriction for all file access', () => {
        state.allowedApps = [{ type: 'aumid', value: 'App!App' }];
        setDomValue('fileExplorerAccess', 'all');

        const xml = generateXml();
        assert.ok(xml.includes('v3:NoRestriction'));
    });

    it('omits FileExplorerNamespaceRestrictions for none', () => {
        state.allowedApps = [{ type: 'aumid', value: 'App!App' }];
        setDomValue('fileExplorerAccess', 'none');

        const xml = generateXml();
        assert.ok(!xml.includes('FileExplorerNamespaceRestrictions'));
    });
});

// ---------------------------------------------------------------------------
// buildStartPinsJson
// ---------------------------------------------------------------------------
describe('buildStartPinsJson()', () => {
    beforeEach(() => {
        resetDom();
        resetState();
    });

    it('returns null for empty pins', () => {
        state.startPins = [];
        assert.strictEqual(buildStartPinsJson(), null);
    });

    it('generates desktopAppLink for Win32 app', () => {
        state.startPins = [
            { pinType: 'desktopAppLink', name: 'Notepad' }
        ];

        const result = buildStartPinsJson();
        assert.ok(result);
        assert.strictEqual(result.pinnedList.length, 1);
        assert.ok(result.pinnedList[0].desktopAppLink.includes('Notepad.lnk'));
        assert.ok(result.pinnedList[0].desktopAppLink.includes('%ALLUSERSPROFILE%'));
    });

    it('generates desktopAppLink with systemShortcut when provided', () => {
        state.startPins = [
            { pinType: 'desktopAppLink', name: 'MyApp', systemShortcut: '%ALLUSERSPROFILE%\\Microsoft\\Windows\\Start Menu\\Programs\\MyApp.lnk' }
        ];

        const result = buildStartPinsJson();
        assert.strictEqual(result.pinnedList[0].desktopAppLink, '%ALLUSERSPROFILE%\\Microsoft\\Windows\\Start Menu\\Programs\\MyApp.lnk');
    });

    it('generates packagedAppId for UWP app', () => {
        state.startPins = [
            { pinType: 'packagedAppId', packagedAppId: 'Microsoft.WindowsCalculator_8wekyb3d8bbwe!App' }
        ];

        const result = buildStartPinsJson();
        assert.strictEqual(result.pinnedList[0].packagedAppId, 'Microsoft.WindowsCalculator_8wekyb3d8bbwe!App');
    });

    it('generates secondaryTile for Edge URL', () => {
        state.startPins = [
            {
                pinType: 'secondaryTile',
                packagedAppId: 'Microsoft.MicrosoftEdge.Stable_8wekyb3d8bbwe!App',
                tileId: 'MSEdge.tile123',
                name: 'My Site',
                args: '--app-id=xyz'
            }
        ];

        const result = buildStartPinsJson();
        const tile = result.pinnedList[0].secondaryTile;
        assert.ok(tile);
        assert.strictEqual(tile.tileId, 'MSEdge.tile123');
        assert.strictEqual(tile.arguments, '--app-id=xyz');
        assert.strictEqual(tile.displayName, 'My Site');
        assert.strictEqual(tile.packagedAppId, 'Microsoft.MicrosoftEdge.Stable_8wekyb3d8bbwe!App');
    });

    it('auto-generates tileId when not provided', () => {
        state.startPins = [
            {
                pinType: 'secondaryTile',
                packagedAppId: 'Microsoft.MicrosoftEdge.Stable_8wekyb3d8bbwe!App',
                name: 'My Site!',
                args: ''
            }
        ];

        const result = buildStartPinsJson();
        const tile = result.pinnedList[0].secondaryTile;
        // tileId should strip non-alphanumeric chars
        assert.strictEqual(tile.tileId, 'MSEdge._pin_MySite');
    });
});

// ---------------------------------------------------------------------------
// buildTaskbarLayoutXml
// ---------------------------------------------------------------------------
describe('buildTaskbarLayoutXml()', () => {
    beforeEach(() => {
        resetDom();
        resetState();
        setupBasicDom();
    });

    it('returns null for empty pins', () => {
        state.taskbarPins = [];
        assert.strictEqual(buildTaskbarLayoutXml(), null);
    });

    it('generates DesktopApp element for Win32 app', () => {
        state.taskbarPins = [
            { pinType: 'desktopAppLink', name: 'Notepad' }
        ];

        const result = buildTaskbarLayoutXml();
        assert.ok(result);
        assert.ok(result.includes('taskbar:DesktopApp'));
        assert.ok(result.includes('Notepad.lnk'));
    });

    it('generates UWA element for UWP app', () => {
        state.taskbarPins = [
            { pinType: 'packagedAppId', packagedAppId: 'Microsoft.WindowsCalculator_8wekyb3d8bbwe!App' }
        ];

        const result = buildTaskbarLayoutXml();
        assert.ok(result);
        assert.ok(result.includes('taskbar:UWA'));
        assert.ok(result.includes('AppUserModelID="Microsoft.WindowsCalculator_8wekyb3d8bbwe!App"'));
    });

    it('uses systemShortcut when available for DesktopApp', () => {
        state.taskbarPins = [
            { pinType: 'desktopAppLink', name: 'MyApp', systemShortcut: '%ALLUSERSPROFILE%\\Microsoft\\Windows\\Start Menu\\Programs\\Custom.lnk' }
        ];

        const result = buildTaskbarLayoutXml();
        assert.ok(result.includes('Custom.lnk'));
    });

    it('includes PinListPlacement="Replace" when replaceTaskbarPins is checked', () => {
        state.taskbarPins = [
            { pinType: 'desktopAppLink', name: 'App' }
        ];
        setDomChecked('replaceTaskbarPins', true);

        const result = buildTaskbarLayoutXml();
        assert.ok(result.includes('PinListPlacement="Replace"'));
    });

    it('omits PinListPlacement when replaceTaskbarPins is unchecked', () => {
        state.taskbarPins = [
            { pinType: 'desktopAppLink', name: 'App' }
        ];
        setDomChecked('replaceTaskbarPins', false);

        const result = buildTaskbarLayoutXml();
        assert.ok(!result.includes('PinListPlacement'));
    });

    it('contains proper XML structure', () => {
        state.taskbarPins = [
            { pinType: 'desktopAppLink', name: 'App' }
        ];

        const result = buildTaskbarLayoutXml();
        assert.ok(result.includes('<?xml version="1.0"'));
        assert.ok(result.includes('LayoutModificationTemplate'));
        assert.ok(result.includes('CustomTaskbarLayoutCollection'));
        assert.ok(result.includes('TaskbarPinList'));
    });
});

// ---------------------------------------------------------------------------
// generateConfigsSection
// ---------------------------------------------------------------------------
describe('generateConfigsSection()', () => {
    beforeEach(() => {
        resetDom();
        resetState();
        setupBasicDom();
    });

    it('generates AutoLogonAccount for auto account type', () => {
        state.accountType = 'auto';
        setDomValue('displayName', 'MyKiosk');

        const xml = generateConfigsSection();
        assert.ok(xml.includes('AutoLogonAccount'));
        assert.ok(xml.includes('rs5:DisplayName="MyKiosk"'));
        assert.ok(xml.includes('DefaultProfile'));
    });

    it('uses default display name "Kiosk" when empty', () => {
        state.accountType = 'auto';
        setDomValue('displayName', '');

        const xml = generateConfigsSection();
        assert.ok(xml.includes('rs5:DisplayName="Kiosk"'));
    });

    it('generates Account element for existing account type', () => {
        state.accountType = 'existing';
        setDomValue('accountName', 'KioskUser1');

        const xml = generateConfigsSection();
        assert.ok(xml.includes('<Account>KioskUser1</Account>'));
        assert.ok(xml.includes('DefaultProfile'));
    });

    it('generates UserGroup element for group account type', () => {
        state.accountType = 'group';
        setDomValue('groupType', 'LocalGroup');
        setDomValue('groupName', 'KioskUsers');

        const xml = generateConfigsSection();
        assert.ok(xml.includes('UserGroup'));
        assert.ok(xml.includes('Type="LocalGroup"'));
        assert.ok(xml.includes('Name="KioskUsers"'));
    });

    it('generates GlobalProfile for global account type', () => {
        state.accountType = 'global';
        setDomChecked('excludeDeviceOwner', false);

        const xml = generateConfigsSection();
        assert.ok(xml.includes('v3:GlobalProfile'));
        assert.ok(!xml.includes('Config>'));
        assert.ok(!xml.includes('Exclusions'));
    });

    it('generates GlobalProfile with DeviceOwner exclusion', () => {
        state.accountType = 'global';
        setDomChecked('excludeDeviceOwner', true);

        const xml = generateConfigsSection();
        assert.ok(xml.includes('v3:GlobalProfile'));
        assert.ok(xml.includes('v5:Exclusions'));
        assert.ok(xml.includes('SpecialGroup Name="DeviceOwner"'));
    });
});

// ---------------------------------------------------------------------------
// XML correctness
// ---------------------------------------------------------------------------
describe('XML correctness', () => {
    beforeEach(() => {
        resetDom();
        resetState();
        setupBasicDom();
        state.mode = 'single';
        state.accountType = 'auto';
    });

    it('includes proper namespace declarations', () => {
        const xml = generateXml();
        assert.ok(xml.includes('xmlns="http://schemas.microsoft.com/AssignedAccess/2017/config"'));
        assert.ok(xml.includes('xmlns:rs5='));
        assert.ok(xml.includes('xmlns:v3='));
        assert.ok(xml.includes('xmlns:v4='));
        assert.ok(xml.includes('xmlns:v5='));
    });

    it('starts with XML declaration', () => {
        const xml = generateXml();
        assert.ok(xml.startsWith('<?xml version="1.0" encoding="utf-8"?>'));
    });

    it('has matching opening and closing AssignedAccessConfiguration tags', () => {
        const xml = generateXml();
        assert.ok(xml.includes('<AssignedAccessConfiguration'));
        assert.ok(xml.includes('</AssignedAccessConfiguration>'));
    });

    it('has matching Profile tags', () => {
        const xml = generateXml();
        const openCount = (xml.match(/<Profile /g) || []).length;
        const closeCount = (xml.match(/<\/Profile>/g) || []).length;
        assert.strictEqual(openCount, 1);
        assert.strictEqual(closeCount, 1);
    });

    it('escapes special characters in XML values', () => {
        setDomValue('configName', 'Test & Config');
        setDomValue('appType', 'uwp');
        setDomValue('uwpAumid', 'App&"Special<>');

        const xml = generateXml();
        // configName goes through escapeAttr (escapes &, ", ')
        assert.ok(xml.includes('Name="Test &amp; Config"'));
        // aumid goes through escapeXml (escapes &, ", ', <, >)
        assert.ok(xml.includes('App&amp;&quot;Special&lt;&gt;'));
    });

    it('includes profile Name attribute when config name is set', () => {
        setDomValue('configName', 'MyKiosk');

        const xml = generateXml();
        assert.ok(xml.includes('Name="MyKiosk"'));
    });

    it('omits profile Name attribute when config name is empty', () => {
        setDomValue('configName', '');

        const xml = generateXml();
        // Should have Profile with Id but no Name
        const profileMatch = xml.match(/<Profile [^>]*>/);
        assert.ok(profileMatch);
        assert.ok(!profileMatch[0].includes('Name='));
    });
});
