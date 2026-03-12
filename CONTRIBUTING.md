# Contributing to Kiosk Overseer

Thank you for your interest in contributing to Kiosk Overseer! This guide will help you get started.

## Getting Started

### Prerequisites
- A modern web browser (Edge, Chrome, Firefox)
- Python 3.x (for local development server) or any static file server
- Git for version control
- A text editor or IDE

### Local Development Setup

```bash
# Clone the repository
git clone https://github.com/8bits1beard-io/Kiosk-Overseer.git
cd KioskOverseer

# Start a local server (required - fetch() won't work with file:// URLs)
python -m http.server

# Open in browser
# http://localhost:8000
```

> **Important:** The app loads presets via `fetch()`, so it must be served from a web server. Opening `index.html` directly as a `file://` URL will not work.

---

## Project Structure

```
├── index.html          # Entry point, UI structure
├── app.js              # Core UI logic, mode switching, Edge args, exports
├── apps.js             # Allowed apps management
├── pins.js             # Unified Start menu and Taskbar pin management
├── config.js           # Configuration save/load + actionHandlers event delegation
├── xml.js              # AssignedAccess XML generation
├── validation.js       # Input validation rules
├── helpers.js          # Utility functions (clipboard, download, browser detection)
├── dom.js              # DOM element caching
├── state.js            # Application state and preset loading
├── styles.css          # UI themes (Fallout, Fluent) and layout
├── data/
│   ├── app-presets.json    # Common Windows application definitions
│   └── pin-presets.json    # Start menu pin templates
├── configs/            # Example .kioskoverseer.json configurations
└── assets/             # Logo, mascot image, self-hosted fonts
```

### Key Files

| File | Purpose |
|------|---------|
| `app.js` | Core UI: mode switching, Edge args builder, export generation |
| `apps.js` | Allowed apps CRUD: addAllowedApp, removeApp, renderAppList |
| `pins.js` | All pin operations for Start menu and Taskbar |
| `config.js` | Configuration persistence + `actionHandlers` event delegation |
| `xml.js` | Generates AssignedAccess XML with proper namespaces |
| `validation.js` | Validates user input and configuration state |
| `helpers.js` | Utility functions shared across modules |
| `state.js` | Application state object and preset loading |

---

## Coding Standards

### JavaScript
- Plain ES6+ with no framework dependencies
- Keep functions focused and named by intent (e.g., `updatePreview`, `renderPinList`)
- Use the existing module pattern (separate files for concerns)
- No build step required

### HTML/CSS
- 4-space indentation
- Use the existing CSS variable system in `styles.css`
- Prefer theme variables over hard-coded colors
- Maintain WCAG 2.1 Level AA accessibility (ARIA roles/states, keyboard navigation, 4.5:1 contrast ratios)
- Use `escapeAttr()` from `helpers.js` when inserting user-provided text into HTML attributes

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| DOM IDs | camelCase | `fileExplorerAccess` |
| Data attributes | kebab-case with prefix | `data-action`, `data-change` |
| Functions | camelCase, verb-first | `updatePreview()`, `renderPinList()` |
| CSS classes | kebab-case | `.pin-item`, `.export-button` |

---

## Testing

There is currently no automated test framework. Testing is done manually:

1. **Load the app locally** via `python -m http.server`
2. **Test each kiosk mode** (Single-App, Multi-App, Restricted User)
3. **Generate XML** and verify structure
4. **Test exports** (XML download, PowerShell scripts, config save/load)
5. **Test validation** (trigger errors, verify messages)
6. **Test both themes** (Fallout and Fluent)
7. **Test KioskOverseer Sentry** (enable toggle, interval field, scheduled task in PowerShell export)
8. **Test Touch Keyboard Auto-Invoke** (enable toggle, verify registry commands in PowerShell export)
9. **Test accessibility** (screen reader output, keyboard navigation, contrast ratios in both themes)

If you add automated tests, please document the test runner and execution instructions.

---

## Making Changes

### Adding a New App Preset

1. Edit `data/app-presets.json`
2. Add entries to the `apps` object and optionally create a group:
   ```json
   {
     "apps": {
       "myApp": { "type": "path", "value": "C:\\Path\\To\\app.exe" },
       "myApp86": { "type": "path", "value": "C:\\Path (x86)\\To\\app.exe" }
     },
     "groups": {
       "myApp": ["myApp", "myApp86"]
     }
   }
   ```
3. For UWP apps, use `"type": "aumid"` and `"value": "AppId!App"`
4. Use `skipAutoPin: true` or `skipAutoLaunch: true` for helper apps (like Edge proxy)

### Adding a New Pin Preset

1. Edit `data/pin-presets.json`
2. Follow the existing structure for the pin type (desktopAppLink, packagedAppId, secondaryTile)

### Modifying XML Generation

1. Edit `xml.js`
2. Ensure proper XML escaping using `escapeXml()` from `helpers.js`
3. Use correct namespace prefixes (rs5, v3, v4, v5) for version-specific features
4. Test generated XML validates against Windows schemas

---

## Commit Guidelines

Follow the existing commit style:

- **Short, imperative, descriptive** messages
- Examples:
  - `Add Fluent theme toggle`
  - `Fix validation for empty app list`
  - `Skip shortcut creation in single-app mode`

### Version Bumps

After ANY change to HTML, CSS, or JS files, update ALL version numbers in `index.html` together:

1. **Header build version**: `KIOSK OVERSEER // BUILD X.X.X`
2. **All file query strings** (10 total):
   ```html
   <link rel="stylesheet" href="styles.css?v=X.X.X">
   <script src="dom.js?v=X.X.X"></script>
   <script src="state.js?v=X.X.X"></script>
   <script src="helpers.js?v=X.X.X"></script>
   <script src="xml.js?v=X.X.X"></script>
   <script src="validation.js?v=X.X.X"></script>
   <script src="app.js?v=X.X.X"></script>
   <script src="apps.js?v=X.X.X"></script>
   <script src="pins.js?v=X.X.X"></script>
   <script src="config.js?v=X.X.X"></script>
   ```

Increment the patch version (e.g., `1.8.2` → `1.8.3`) for all 11 locations in sync. Never update just one.

---

## Pull Request Guidelines

When submitting a PR, include:

1. **Summary** of changes (what and why)
2. **Screenshots** for UI changes
3. **Testing notes** (what you tested, how)
4. **Version bump** if assets changed

### PR Checklist

- [ ] Tested locally with `python -m http.server`
- [ ] Tested all affected kiosk modes
- [ ] Tested XML export validates
- [ ] Updated version query strings if needed
- [ ] No console errors in browser

---

## Deployment

The app is hosted at [kioskoverseer.com](https://kioskoverseer.com).

- Pushes to `main` trigger automatic deployment
- Use version query strings to bust browser cache

---

## Questions?

Open an issue on GitHub for:
- Bug reports
- Feature requests
- Questions about implementation

Thank you for contributing!
