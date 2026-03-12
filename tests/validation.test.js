// Run: node --test tests/
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

const {
    state,
    setDomValue,
    setDomChecked,
    resetDom,
    resetState,
    validate,
    validateField,
} = require('./setup.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function setupValidDom() {
    setDomValue('configName', 'TestConfig');
    setDomValue('profileId', '{12345678-1234-1234-1234-123456789abc}');
    setDomValue('displayName', 'Kiosk');
    setDomValue('accountName', 'KioskUser');
    setDomValue('groupName', 'KioskGroup');
    setDomValue('appType', 'edge');
    setDomValue('edgeSourceType', 'url');
    setDomValue('edgeUrl', 'https://example.com');
    setDomValue('edgeFilePath', '');
    setDomValue('uwpAumid', '');
    setDomValue('win32Path', '');
}

// ---------------------------------------------------------------------------
// Config name validation
// ---------------------------------------------------------------------------
describe('Config name validation', () => {
    beforeEach(() => {
        resetDom();
        resetState();
        setupValidDom();
        state.mode = 'single';
        state.accountType = 'auto';
    });

    it('returns error when config name is missing', () => {
        setDomValue('configName', '');
        const errors = validate();
        const nameError = errors.find(e => e.field === 'configName');
        assert.ok(nameError);
        assert.ok(nameError.message.includes('Configuration Name'));
    });

    it('returns no config name error when name is provided', () => {
        setDomValue('configName', 'MyConfig');
        const errors = validate();
        const nameError = errors.find(e => e.field === 'configName');
        assert.strictEqual(nameError, undefined);
    });

    it('trims whitespace from config name', () => {
        setDomValue('configName', '   ');
        const errors = validate();
        const nameError = errors.find(e => e.field === 'configName');
        assert.ok(nameError);
    });
});

// ---------------------------------------------------------------------------
// Profile GUID validation
// ---------------------------------------------------------------------------
describe('Profile GUID validation', () => {
    beforeEach(() => {
        resetDom();
        resetState();
        setupValidDom();
        state.mode = 'single';
        state.accountType = 'auto';
    });

    it('returns error when profile GUID is missing', () => {
        setDomValue('profileId', '');
        const errors = validate();
        const guidError = errors.find(e => e.field === 'profileId');
        assert.ok(guidError);
        assert.ok(guidError.message.includes('required'));
    });

    it('returns error for invalid GUID format', () => {
        setDomValue('profileId', 'not-a-guid');
        const errors = validate();
        const guidError = errors.find(e => e.field === 'profileId');
        assert.ok(guidError);
        assert.ok(guidError.message.includes('invalid'));
    });

    it('returns error for GUID without braces', () => {
        setDomValue('profileId', '12345678-1234-1234-1234-123456789abc');
        const errors = validate();
        const guidError = errors.find(e => e.field === 'profileId');
        assert.ok(guidError);
    });

    it('accepts valid GUID format', () => {
        setDomValue('profileId', '{12345678-1234-1234-1234-123456789abc}');
        const errors = validate();
        const guidError = errors.find(e => e.field === 'profileId');
        assert.strictEqual(guidError, undefined);
    });

    it('accepts GUID with uppercase hex', () => {
        setDomValue('profileId', '{ABCDEF01-2345-6789-ABCD-EF0123456789}');
        const errors = validate();
        const guidError = errors.find(e => e.field === 'profileId');
        assert.strictEqual(guidError, undefined);
    });
});

// ---------------------------------------------------------------------------
// Account validation by type
// ---------------------------------------------------------------------------
describe('Account validation by type', () => {
    beforeEach(() => {
        resetDom();
        resetState();
        setupValidDom();
        state.mode = 'single';
    });

    it('requires displayName for auto account type', () => {
        state.accountType = 'auto';
        setDomValue('displayName', '');
        const errors = validate();
        const accountError = errors.find(e => e.field === 'displayName');
        assert.ok(accountError);
        assert.ok(accountError.message.includes('Display Name'));
    });

    it('passes when displayName is provided for auto type', () => {
        state.accountType = 'auto';
        setDomValue('displayName', 'MyKiosk');
        const errors = validate();
        const accountError = errors.find(e => e.field === 'displayName');
        assert.strictEqual(accountError, undefined);
    });

    it('requires accountName for existing account type', () => {
        state.accountType = 'existing';
        setDomValue('accountName', '');
        const errors = validate();
        const accountError = errors.find(e => e.field === 'accountName');
        assert.ok(accountError);
        assert.ok(accountError.message.includes('Account Name'));
    });

    it('passes when accountName is provided for existing type', () => {
        state.accountType = 'existing';
        setDomValue('accountName', 'KioskUser');
        const errors = validate();
        const accountError = errors.find(e => e.field === 'accountName');
        assert.strictEqual(accountError, undefined);
    });

    it('requires groupName for group account type', () => {
        state.accountType = 'group';
        setDomValue('groupName', '');
        const errors = validate();
        const accountError = errors.find(e => e.field === 'groupName');
        assert.ok(accountError);
        assert.ok(accountError.message.includes('Group Name'));
    });

    it('passes when groupName is provided for group type', () => {
        state.accountType = 'group';
        setDomValue('groupName', 'KioskGroup');
        const errors = validate();
        const accountError = errors.find(e => e.field === 'groupName');
        assert.strictEqual(accountError, undefined);
    });

    it('requires no extra fields for global account type', () => {
        state.accountType = 'global';
        // Clear all account-specific fields
        setDomValue('displayName', '');
        setDomValue('accountName', '');
        setDomValue('groupName', '');
        const errors = validate();
        // Should have no account-related errors
        const accountErrors = errors.filter(e =>
            e.field === 'displayName' || e.field === 'accountName' || e.field === 'groupName'
        );
        assert.strictEqual(accountErrors.length, 0);
    });
});

// ---------------------------------------------------------------------------
// Single-app mode validation
// ---------------------------------------------------------------------------
describe('Single-app mode validation', () => {
    beforeEach(() => {
        resetDom();
        resetState();
        setupValidDom();
        state.mode = 'single';
        state.accountType = 'auto';
    });

    it('requires Edge URL when source type is url', () => {
        setDomValue('appType', 'edge');
        setDomValue('edgeSourceType', 'url');
        setDomValue('edgeUrl', '');
        const errors = validate();
        const appError = errors.find(e => e.field === 'edgeUrl');
        assert.ok(appError);
    });

    it('requires Edge file path when source type is file', () => {
        setDomValue('appType', 'edge');
        setDomValue('edgeSourceType', 'file');
        setDomValue('edgeFilePath', '');
        const errors = validate();
        const appError = errors.find(e => e.field === 'edgeFilePath');
        assert.ok(appError);
    });

    it('passes with valid Edge URL', () => {
        setDomValue('appType', 'edge');
        setDomValue('edgeSourceType', 'url');
        setDomValue('edgeUrl', 'https://example.com');
        const errors = validate();
        const appError = errors.find(e => e.field === 'edgeUrl');
        assert.strictEqual(appError, undefined);
    });

    it('requires AUMID for UWP app type', () => {
        setDomValue('appType', 'uwp');
        setDomValue('uwpAumid', '');
        const errors = validate();
        const appError = errors.find(e => e.field === 'uwpAumid');
        assert.ok(appError);
        assert.ok(appError.message.includes('AUMID'));
    });

    it('passes with valid UWP AUMID', () => {
        setDomValue('appType', 'uwp');
        setDomValue('uwpAumid', 'Microsoft.WindowsCalculator_8wekyb3d8bbwe!App');
        const errors = validate();
        const appError = errors.find(e => e.field === 'uwpAumid');
        assert.strictEqual(appError, undefined);
    });

    it('requires path for Win32 app type', () => {
        setDomValue('appType', 'win32');
        setDomValue('win32Path', '');
        const errors = validate();
        const appError = errors.find(e => e.field === 'win32Path');
        assert.ok(appError);
        assert.ok(appError.message.includes('Win32'));
    });

    it('passes with valid Win32 path', () => {
        setDomValue('appType', 'win32');
        setDomValue('win32Path', 'C:\\Program Files\\MyApp\\app.exe');
        const errors = validate();
        const appError = errors.find(e => e.field === 'win32Path');
        assert.strictEqual(appError, undefined);
    });
});

// ---------------------------------------------------------------------------
// Multi-app mode validation
// ---------------------------------------------------------------------------
describe('Multi-app mode validation', () => {
    beforeEach(() => {
        resetDom();
        resetState();
        setupValidDom();
        state.mode = 'multi';
        state.accountType = 'auto';
    });

    it('requires at least one allowed app', () => {
        state.allowedApps = [];
        const errors = validate();
        const appError = errors.find(e => e.message.toLowerCase().includes('at least one'));
        assert.ok(appError);
        assert.strictEqual(appError.tab, 'apps');
    });

    it('passes with allowed apps present', () => {
        state.allowedApps = [{ type: 'aumid', value: 'App!App' }];
        state.startPins = [];
        const errors = validate();
        const appError = errors.find(e => e.message.includes('at least one'));
        assert.strictEqual(appError, undefined);
    });

    it('validates pin targets — reports missing targets', () => {
        state.allowedApps = [{ type: 'path', value: 'C:\\app.exe' }];
        state.startPins = [
            { pinType: 'desktopAppLink', name: 'MyApp', target: '', systemShortcut: '' }
        ];

        const errors = validate();
        const pinError = errors.find(e => e.message.includes('missing target'));
        assert.ok(pinError);
        assert.ok(pinError.message.includes('MyApp'));
        assert.strictEqual(pinError.tab, 'layout');
    });

    it('passes when pin has systemShortcut', () => {
        state.allowedApps = [{ type: 'path', value: 'C:\\app.exe' }];
        state.startPins = [
            { pinType: 'desktopAppLink', name: 'MyApp', target: '', systemShortcut: '%ALLUSERSPROFILE%\\Microsoft\\Windows\\Start Menu\\Programs\\MyApp.lnk' }
        ];

        const errors = validate();
        const pinError = errors.find(e => e.message.includes('missing target'));
        assert.strictEqual(pinError, undefined);
    });

    it('does not validate single-app fields when in multi mode', () => {
        state.allowedApps = [{ type: 'aumid', value: 'App!App' }];
        setDomValue('appType', 'edge');
        setDomValue('edgeUrl', '');
        setDomValue('uwpAumid', '');
        setDomValue('win32Path', '');

        const errors = validate();
        const singleAppErrors = errors.filter(e =>
            e.field === 'edgeUrl' || e.field === 'uwpAumid' || e.field === 'win32Path'
        );
        assert.strictEqual(singleAppErrors.length, 0);
    });

    it('validates in restricted mode same as multi', () => {
        state.mode = 'restricted';
        state.allowedApps = [];
        const errors = validate();
        const appError = errors.find(e => e.message.toLowerCase().includes('at least one'));
        assert.ok(appError);
    });

    it('reports invalid shortcut paths that are not under Start Menu Programs', () => {
        state.allowedApps = [{ type: 'path', value: 'C:\\app.exe' }];
        state.startPins = [
            { pinType: 'desktopAppLink', name: 'BadApp', systemShortcut: 'C:\\RandomFolder\\BadApp.lnk' }
        ];

        const errors = validate();
        const pathError = errors.find(e => e.message.includes('Start menu pin shortcuts'));
        assert.ok(pathError);
        assert.ok(pathError.message.includes('BadApp'));
    });

    it('accepts valid Start Menu shortcut path', () => {
        state.allowedApps = [{ type: 'path', value: 'C:\\app.exe' }];
        state.startPins = [
            { pinType: 'desktopAppLink', name: 'GoodApp', systemShortcut: '%ALLUSERSPROFILE%\\Microsoft\\Windows\\Start Menu\\Programs\\GoodApp.lnk' }
        ];

        const errors = validate();
        const pathError = errors.find(e => e.message.includes('Start menu pin shortcuts'));
        assert.strictEqual(pathError, undefined);
    });
});

// ---------------------------------------------------------------------------
// validateField
// ---------------------------------------------------------------------------
describe('validateField()', () => {
    beforeEach(() => {
        resetDom();
        resetState();
        setupValidDom();
        state.mode = 'single';
        state.accountType = 'auto';
    });

    it('returns error message for invalid field', () => {
        setDomValue('configName', '');
        const msg = validateField('configName');
        assert.ok(msg);
        assert.ok(msg.includes('Configuration Name'));
    });

    it('returns null for valid field', () => {
        setDomValue('configName', 'ValidName');
        const msg = validateField('configName');
        assert.strictEqual(msg, null);
    });

    it('returns null when field has no errors', () => {
        setDomValue('profileId', '{12345678-1234-1234-1234-123456789abc}');
        const msg = validateField('profileId');
        assert.strictEqual(msg, null);
    });

    it('returns specific field error for profileId', () => {
        setDomValue('profileId', 'bad-guid');
        const msg = validateField('profileId');
        assert.ok(msg);
        assert.ok(msg.includes('GUID'));
    });

    it('returns specific field error for displayName', () => {
        state.accountType = 'auto';
        setDomValue('displayName', '');
        const msg = validateField('displayName');
        assert.ok(msg);
        assert.ok(msg.includes('Display Name'));
    });

    it('returns null for non-existent field', () => {
        const msg = validateField('nonExistentField');
        assert.strictEqual(msg, null);
    });
});

// ---------------------------------------------------------------------------
// Full validation pass (zero errors)
// ---------------------------------------------------------------------------
describe('Full validation — zero errors', () => {
    beforeEach(() => {
        resetDom();
        resetState();
        setupValidDom();
    });

    it('returns no errors for valid single-app Edge config', () => {
        state.mode = 'single';
        state.accountType = 'auto';
        const errors = validate();
        assert.strictEqual(errors.length, 0);
    });

    it('returns no errors for valid multi-app config', () => {
        state.mode = 'multi';
        state.accountType = 'existing';
        state.allowedApps = [{ type: 'aumid', value: 'App!App' }];
        state.startPins = [];
        const errors = validate();
        assert.strictEqual(errors.length, 0);
    });

    it('returns no errors for valid global account config', () => {
        state.mode = 'single';
        state.accountType = 'global';
        const errors = validate();
        assert.strictEqual(errors.length, 0);
    });
});
