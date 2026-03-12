// Run: node --test tests/
// Shared test setup — mocks browser globals so vanilla JS source files can be eval'd in Node.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Mock DOM
// ---------------------------------------------------------------------------
const _domStore = {};

function _makeMockElement(initial) {
    return {
        value: initial !== undefined ? initial : '',
        checked: false,
        selectedOptions: [],
        innerHTML: '',
        textContent: '',
        classList: {
            _set: new Set(),
            add(c) { this._set.add(c); },
            remove(c) { this._set.delete(c); },
            contains(c) { return this._set.has(c); },
            toggle(c) { this._set.has(c) ? this._set.delete(c) : this._set.add(c); }
        },
        closest() { return null; },
        querySelector() { return null; },
        setAttribute() {},
        getAttribute() { return null; },
        addEventListener() {},
        removeEventListener() {},
        style: {},
        dataset: {}
    };
}

function setDomValue(id, value) {
    if (!_domStore[id]) _domStore[id] = _makeMockElement(value);
    _domStore[id].value = value;
}

function setDomChecked(id, checked) {
    if (!_domStore[id]) _domStore[id] = _makeMockElement();
    _domStore[id].checked = checked;
}

function getDomElement(id) {
    if (!_domStore[id]) _domStore[id] = _makeMockElement();
    return _domStore[id];
}

function resetDom() {
    for (const key of Object.keys(_domStore)) {
        delete _domStore[key];
    }
}

// The mock dom object that matches the real dom.get(id) pattern
const dom = {
    get(id) {
        return getDomElement(id);
    },
    clear() {}
};

// ---------------------------------------------------------------------------
// Default state factory
// ---------------------------------------------------------------------------
function createDefaultState() {
    return {
        mode: 'single',
        accountType: 'auto',
        allowedApps: [],
        startPins: [],
        taskbarPins: [],
        autoLaunchApp: null,
        multiAppEdgeConfig: {
            url: '',
            sourceType: 'url',
            kioskType: 'fullscreen'
        }
    };
}

let state = createDefaultState();

function resetState() {
    const fresh = createDefaultState();
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, fresh);
}

// ---------------------------------------------------------------------------
// Minimal browser stubs
// ---------------------------------------------------------------------------
const document = {
    getElementById(id) { return getDomElement(id); },
    createElement() { return _makeMockElement(); },
    body: { appendChild() {}, removeChild() {} },
    execCommand() {}
};

const navigator = { clipboard: { writeText() { return Promise.resolve(); } } };
const window = { location: { href: '' }, addEventListener() {} };
const sessionStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
const localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
const URL = { createObjectURL() { return ''; }, revokeObjectURL() {} };
const Blob = function() {};
const fetch = () => Promise.resolve({ json: () => Promise.resolve({}) });
const setTimeout = globalThis.setTimeout;
const console = globalThis.console;

// ---------------------------------------------------------------------------
// Install globals before loading source files
// ---------------------------------------------------------------------------
globalThis.dom = dom;
globalThis.state = state;
globalThis.document = document;
globalThis.navigator = navigator;
globalThis.window = window;
globalThis.sessionStorage = sessionStorage;
globalThis.localStorage = localStorage;
globalThis.URL = URL;
globalThis.Blob = Blob;
globalThis.fetch = fetch;

// ---------------------------------------------------------------------------
// Load source files via vm.runInThisContext so function declarations become global
// ---------------------------------------------------------------------------
const vm = require('vm');

function loadSource(filename) {
    const filePath = path.join(ROOT, filename);
    const code = fs.readFileSync(filePath, 'utf-8');
    vm.runInThisContext(code, { filename: filePath });
}

// Load in dependency order
loadSource('helpers.js');

// We need getEdgeUrl, getMultiAppEdgeUrl, getBreakoutSequence which live in app.js.
// Rather than loading all of app.js (which has lots of DOM side-effects),
// we define stubs that the tests can override.
globalThis.getEdgeUrl = function() {
    const sourceType = dom.get('edgeSourceType').value;
    return globalThis.buildLaunchUrl(
        sourceType,
        dom.get('edgeUrl').value,
        dom.get('edgeFilePath').value,
        'https://www.microsoft.com'
    );
};

globalThis.getMultiAppEdgeUrl = function() {
    const sourceType = dom.get('multiEdgeSourceType').value;
    return globalThis.buildLaunchUrl(
        sourceType,
        dom.get('multiEdgeUrl').value,
        dom.get('multiEdgeFilePath').value,
        'https://www.microsoft.com'
    );
};

globalThis.getBreakoutSequence = function() {
    if (!dom.get('enableBreakout').checked) return null;

    const ctrl = dom.get('breakoutCtrl').checked;
    const alt = dom.get('breakoutAlt').checked;
    const shift = dom.get('breakoutShift').checked;
    const key = dom.get('breakoutFinalKey').value;

    let combo = [];
    if (ctrl) combo.push('Ctrl');
    if (alt) combo.push('Alt');
    if (shift) combo.push('Shift');
    combo.push(key);

    return combo.join('+');
};

loadSource('xml.js');
loadSource('validation.js');

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
    dom,
    state,
    setDomValue,
    setDomChecked,
    getDomElement,
    resetDom,
    resetState,
    createDefaultState,

    // Re-export loaded globals for convenience
    generateXml: globalThis.generateXml,
    generateSingleAppProfile: globalThis.generateSingleAppProfile,
    generateMultiAppProfile: globalThis.generateMultiAppProfile,
    buildStartPinsJson: globalThis.buildStartPinsJson,
    buildTaskbarLayoutXml: globalThis.buildTaskbarLayoutXml,
    generateConfigsSection: globalThis.generateConfigsSection,
    generateAccountConfig: globalThis.generateAccountConfig,
    validate: globalThis.validate,
    validateField: globalThis.validateField,
    escapeXml: globalThis.escapeXml,
    escapeAttr: globalThis.escapeAttr,
    isEdgeApp: globalThis.isEdgeApp,
    buildEdgeKioskArgs: globalThis.buildEdgeKioskArgs,
    buildLaunchUrl: globalThis.buildLaunchUrl,
};
