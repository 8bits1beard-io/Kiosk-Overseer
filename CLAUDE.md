# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kiosk Overseer is a web-based GUI for building Windows 11 Assigned Access (kiosk) configurations. It generates validated AssignedAccess XML without hand-editing, supports visual app/pin configuration, and exports deployment-ready scripts.

**Target:** Windows 11 Pro/Enterprise/Education only (uses v4/v5 XML namespaces specific to Windows 11).

**Live site:** [kioskoverseer.com](https://kioskoverseer.com)

## Development Commands

```bash
# Start local server (required - fetch() won't work with file:// URLs)
python -m http.server 8080

# Then open http://localhost:8080
```

No build step, no npm, no framework. Pure vanilla JavaScript served statically.

## Agent Usage

When working on complex tasks, spin up agents in parallel to maximize efficiency:

- **Codebase exploration** - Use Explore agents to search for patterns, find files, or understand how features work
- **Multi-file analysis** - Spawn multiple agents to analyze different files simultaneously
- **Bug hunting** - Use agents to search for issues like missing DOM elements, undefined variables, or duplicate functions
- **Refactoring** - Use Plan agents to design changes, then implement

Example scenarios where agents help:
- "Find all places that reference browser detection" → Explore agent
- "Check for errors across the codebase" → Multiple agents analyzing different modules
- "How does the pin system work?" → Explore agent with thorough analysis

## Architecture

### Script Loading Order (Critical)

Scripts load in this order in `index.html`. **Order matters** - later scripts override functions from earlier ones:

1. `dom.js` - DOM element caching
2. `state.js` - Central state object, preset loading
3. `helpers.js` - Utilities (clipboard, download, browser detection)
4. `xml.js` - AssignedAccess XML generation
5. `validation.js` - Input validation rules
6. `app.js` - Core UI logic, mode switching, Edge args, welcome modal, callouts
7. `apps.js` - Allowed apps management
8. `pins.js` - Unified pin management for Start menu and Taskbar
9. `exports.js` - Export downloads (XML, PowerShell, shortcuts, README) with PS1 templates
10. `config.js` - Save/load/import/export + **actionHandlers event delegation**

**Important:** `actionHandlers` (the event dispatch map) lives at the end of `config.js` so it captures references to the correct modular functions. If you add a new action handler, add it to `actionHandlers` in config.js.

### Module Responsibilities

| File | Purpose |
|------|---------|
| `app.js` | Core UI: mode switching, Edge args builder, welcome modal, callouts, tooltips |
| `apps.js` | Allowed apps CRUD: addAllowedApp, removeApp, renderAppList, auto-launch selection |
| `pins.js` | All pin operations for both Start menu and Taskbar (uses `PIN_LIST_CONFIG`) |
| `exports.js` | Export downloads (XML, PowerShell, shortcuts, README) with `fillTemplate()` and PS1 template constants |
| `config.js` | Configuration persistence + `actionHandlers` event delegation |
| `xml.js` | AssignedAccess XML generation with namespace handling (rs5, v3, v4, v5) |
| `validation.js` | Input validation rules, returns error objects with field and message |
| `helpers.js` | Utilities: clipboard, file download, XML escaping (`escapeXml`, `escapeAttr`), browser detection |
| `state.js` | Central `state` object and async preset loading from JSON files |
| `dom.js` | DOM element caching via `dom.get(id)` to avoid repeated queries |

### Unified Pin Management

`pins.js` uses a configuration-driven approach to eliminate duplication between Start menu and Taskbar pins:

```javascript
const PIN_LIST_CONFIG = {
    start: { stateKey: 'startPins', listId: 'pinList', ... },
    taskbar: { stateKey: 'taskbarPins', listId: 'taskbarPinList', ... }
};
```

Functions like `renderPinListForType(listType)` use this config to handle both pin types with shared logic.

### Key State Structure

```javascript
state = {
    mode: 'single' | 'multi' | 'restricted',
    accountType: 'auto' | 'existing' | 'group' | 'global',
    allowedApps: [{type: 'path'|'aumid', value: string, skipAutoPin?, skipAutoLaunch?}],
    startPins: [{name, target, args, iconPath, pinType, systemShortcut, packagedAppId, tileId}],
    taskbarPins: [...],
    autoLaunchApp: null | index,
    multiAppEdgeConfig: {url, sourceType, kioskType}
}
```

### Tab/Step Structure

The UI has 6 steps, each a tab panel. In single-app mode, only Layout is hidden.

| Tab ID | Step | Contains |
|--------|------|----------|
| `tab-mode` | 1: Kiosk Mode | Mode selection (single/multi/restricted) |
| `tab-apps` | 2: Applications | Single-app config, multi-app allowed apps, auto-launch, file explorer access |
| `tab-layout` | 3: Layout | Taskbar controls (show/replace) + Start menu pins + Taskbar pins |
| `tab-account` | 4: Account & Identity | Config name, author, profile GUID, account type |
| `tab-device` | 5: Device Settings | Script-only settings (not in XML) — Touch Keyboard Auto-Invoke, etc. |
| `tab-summary` | Summary & Export | Validation checklist, export buttons, deploy guide (collapsible), star GitHub callout |

Side nav buttons use `tab-btn-{id}` IDs.

### XML vs Script Settings

Settings in the Assigned Access XML (configured via tabs 1-4):
- Kiosk mode, allowed apps, start pins, taskbar pins, file explorer access, account, auto-launch, breakout sequence

Settings applied only by the PowerShell script (tab 5 "Device Settings"):
- Touch Keyboard Auto-Invoke (registry keys)
- KioskOverseer Sentry (scheduled task — toggle lives in Apps tab near auto-launch, marked with "Script Only" badge)
- Edge Manifest Override (separate export button)

Use the `badge-script` CSS class for "Script Only" labels on script-only settings.

### Pin Workflow

Pins (Start menu and Taskbar) use a dropdown-driven workflow. The user selects from their allowed apps via a `<select>` dropdown — there is no manual target path entry. The pin name auto-fills with a friendly name from `EXE_FRIENDLY_NAMES` (in `pins.js`) or `getFriendlyAppName()` (in `app.js`), but users can override it. An `autoFilled` data attribute tracks whether the name was auto-filled or manually edited.

Pin types: `desktopAppLink` (Win32/.lnk), `packagedAppId` (UWP), `secondaryTile` (Edge URLs). The XML generates `.lnk` paths from the pin name: `%ALLUSERSPROFILE%\Microsoft\Windows\Start Menu\Programs\${name}.lnk`.

### Callouts and Modals

**Callouts** use `data-callout-id` attributes with `dismissCallout()` in `app.js`. Dismissal is stored in `sessionStorage` (per-session). Add `hidden` class initially if the callout should be shown programmatically (e.g., the save-config reminder appears via `switchTab`).

**Welcome modal** uses `localStorage` (persists forever) so it only shows on first visit. Dismiss via `dismissWelcome()`.

**Edge Args modal** is the only other modal — uses `hidden` class toggle pattern.

### Event Delegation Pattern

HTML uses `data-action` and `data-arg` attributes. Single delegated listener dispatches to `actionHandlers` (defined at end of config.js).

To add a new action:
1. Create the function in the appropriate module (apps.js, pins.js, etc.)
2. Add it to `actionHandlers` in config.js
3. Use `data-action="functionName"` in HTML

### Browser Kiosk Support

`helpers.js` provides browser detection functions:
- `isEdgeApp()`, `isChromeApp()`, `isFirefoxApp()`, `isBraveApp()`, `isIslandApp()`
- `isBrowserWithKioskSupport()` - combines all five

Kiosk args vary by browser:
- **Edge**: Full options (fullscreen/public-browsing, idle timeout)
- **Chrome/Brave/Island**: `--kiosk URL --no-first-run`
- **Firefox**: `--kiosk URL`

### XML Namespace Versions

- `2017/config` - Base kiosk
- `201901/config` (rs5) - DisplayName, AutoLaunch
- `2020/config` (v3) - AllowRemovableDrives, GlobalProfile
- `2021/config` (v4) - ClassicAppPath (Win32 in single-app), BreakoutSequence
- `2022/config` (v5) - StartPins (Windows 11 Start menu)

## Coding Conventions

- **Functions:** camelCase, verb-first (`updatePreview`, `renderPinList`)
- **DOM IDs:** camelCase (`fileExplorerAccess`)
- **Data attributes:** kebab-case (`data-action`, `data-change`)
- **CSS classes:** kebab-case (`.pin-item`)
- **Indentation:** 4 spaces

## Version Bumps - CRITICAL REQUIREMENT

**MANDATORY: After ANY change to HTML, CSS, or JS files, you MUST update ALL version numbers in `index.html`.**

This is NOT optional. Browser caching will break the application if versions are not updated.

### When to Update Versions

Update versions after changes to:
- HTML structure (`index.html` itself)
- Any JavaScript file (`*.js`)
- CSS files (`styles.css`)

### How to Update Versions

Run the version bump script:

```bash
./bump-version.sh patch       # 1.8.3 → 1.8.4
./bump-version.sh minor       # 1.8.3 → 1.9.0
./bump-version.sh major       # 1.8.3 → 2.0.0
./bump-version.sh 2.0.0       # explicit version
```

This updates all version locations in `index.html` atomically (header build version + all file query strings).

## Data Files

- `data/app-presets.json` - Common Windows app definitions with groups for multi-path apps
- `data/pin-presets.json` - Start menu pin templates

App preset structure:
```json
{
    "apps": {
        "edge": { "type": "path", "value": "...\\msedge.exe" },
        "edgeProxy": { "type": "path", "value": "...", "skipAutoPin": true }
    },
    "groups": {
        "edge": ["edge", "edgeProxy", "edgeAppId"]
    }
}
```

## Testing

### Automated Tests

```bash
node --test tests/*.test.js
```

80 tests covering `xml.js` (42 tests) and `validation.js` (38 tests). Tests mock `dom.get()` and `state` to run in Node without a browser.

### Manual Testing

1. Test all three kiosk modes (Single-App, Multi-App, Restricted User)
2. Test tab visibility: single-app hides only Layout tab; multi/restricted show all 6 tabs
3. Test browser kiosk options (Edge, Chrome, Firefox, Brave, Island)
4. Test pin management (add, edit, reorder, duplicate, remove) — Start and Taskbar pins share the Layout tab
5. Test all exports (XML, PowerShell, shortcuts, config save/load)
6. Test Replace Default Taskbar Pins toggle (verify PinListPlacement="Replace" appears/disappears in XML preview)
7. Test configuration save/load functionality
8. Test both themes (Fallout and Fluent)
9. Test KioskOverseer Sentry (enable toggle, interval field, PowerShell export with scheduled task)
10. Test Touch Keyboard Auto-Invoke on Device Settings tab (verify registry commands in PowerShell export)
11. Test accessibility (screen reader announcements, keyboard navigation, contrast in both themes)
12. Test tooltips open on click and close when clicking elsewhere

## Edge Kiosk Notes

Edge Chromium is Win32, not UWP. Use `%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe` with ClassicAppPath/DesktopAppPath.

For Edge secondary tiles in StartPins, include all three in allowed apps:
- `msedge.exe`
- `msedge_proxy.exe`
- `Microsoft.MicrosoftEdge.Stable_8wekyb3d8bbwe!App`

## Adding New Features

### Adding a New App Preset

Edit `data/app-presets.json`:
```json
{
  "apps": {
    "myApp": { "type": "path", "value": "C:\\Path\\To\\app.exe" }
  },
  "groups": {
    "myApp": ["myApp"]  // Group apps that should be added together
  }
}
```

### Adding a New Pin Preset

Edit `data/pin-presets.json` following existing structure for pin types: `desktopAppLink`, `packagedAppId`, or `secondaryTile`.
