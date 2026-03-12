# Kiosk Overseer

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Windows 11](https://img.shields.io/badge/Windows-11-0078D4?logo=windows)](https://www.microsoft.com/windows)

A web-based GUI for building Windows Assigned Access (kiosk) configurations. Create validated XML without hand-editing, configure apps and pins visually, and export deployment-ready scripts.

**[Launch App →](https://kioskoverseer.com)**

---

## Why Kiosk Overseer?

Configuring Windows kiosk mode traditionally requires hand-crafting complex XML with multiple namespaces, understanding obscure Edge kiosk arguments, and manually creating Start menu shortcuts. Kiosk Overseer handles all of this through an intuitive form-based workflow:

- **No XML editing** — Configure everything through the UI; XML is generated and validated automatically
- **Edge kiosk made easy** — URL or local file sources, fullscreen or public browsing modes, idle timeouts
- **Start menu & taskbar pins** — Visual pin management with drag-and-drop reordering
- **Multiple export formats** — XML, PowerShell deployment scripts, shortcut creators, Start Layout XML
- **Save & share configs** — Export/import `.kioskoverseer.json` files to reuse or share configurations

---

## Windows Compatibility

| Windows Version | Supported |
|-----------------|-----------|
| Windows 11 Pro/Enterprise/Education | ✅ Yes |
| Windows Home | ❌ No |

> **Note:** This tool generates XML using Windows 11-specific namespaces (`v4`/`v5`) for features like Win32 app paths and Start menu pins. Requires Windows 11 Pro, Enterprise, or Education edition.

---

## Features

### Kiosk Modes
- **Single-App** — Full-screen kiosk with one application (digital signage, point-of-sale)
- **Multi-App** — Restricted desktop with whitelisted applications and custom Start menu
- **Restricted User** — Apply restrictions to user groups or all non-admin users

### Application Types
- **Microsoft Edge** — Kiosk mode with URL or local file, fullscreen or public browsing, idle timeout
- **UWP/Store Apps** — Configure via Application User Model ID (AUMID)
- **Win32 Desktop Apps** — Configure via executable path with optional arguments

### Export Options
- **XML Configuration** — AssignedAccess XML ready for Intune OMA-URI or provisioning packages
- **On-Demand Kiosk Script** — PowerShell script that deploys everything in one step directly on a device
- **Shortcut Creator Script** — Creates Start/Taskbar .lnk files for Intune deployments
- **Edge Manifest Override** — Advanced workaround script for Edge kiosk issues

### Additional Features
- 40+ common app presets (Office, browsers, system tools)
- Real-time validation with detailed error messages
- Configuration import/export (`.kioskoverseer.json`)
- Breakout sequence configuration for technician access
- Two UI themes (Fallout and Fluent)
- KioskOverseer Sentry: optional scheduled task to relaunch the auto-launch app if closed (e.g., by idle timeout policy)
- Touch Keyboard Auto-Invoke: forces Windows touch keyboard on touchscreen devices even when a physical keyboard is attached (registry-based, On-Demand Kiosk Script only)
- Diagnostic logging: enables Assigned Access, AppLocker, and AppXDeployment event logs for troubleshooting
- WCAG 2.1 Level AA accessibility: proper ARIA roles/states, contrast ratios, color-blind safe indicators

---

## Quick Start

### Use the Hosted App (Recommended)
1. Open **[kioskoverseer.com](https://kioskoverseer.com)**
2. Select a kiosk mode (Single-App, Multi-App, or Restricted User)
3. Add applications and configure settings
4. Configure pins (Multi-App/Restricted modes)
5. Export XML and deploy via Intune, PowerShell, or PPKG

### Run Locally
```bash
# Clone the repository
git clone https://github.com/8bits1beard-io/Kiosk-Overseer.git
cd KioskOverseer

# Start a local server (required for fetch() to load presets)
python -m http.server

# Open in browser
# http://localhost:8000
```

> **Note:** The app cannot be opened directly as a `file://` URL due to browser security restrictions on fetch().

---

## Deployment Methods

| Method | Best For | Documentation |
|--------|----------|---------------|
| **Intune OMA-URI** | MDM-managed devices | [REFERENCE.md](REFERENCE.md#microsoft-intune-recommended) |
| **PowerShell Script** | Standalone devices, testing | [REFERENCE.md](REFERENCE.md#powershell-script) |
| **Provisioning Package** | Imaging, OOBE deployment | [REFERENCE.md](REFERENCE.md#provisioning-package-ppkg) |

---

## Project Structure

```
├── index.html          # Entry point and UI structure
├── app.js              # Core application logic and event handling
├── apps.js             # Allowed apps management
├── pins.js             # Unified Start menu and Taskbar pin management
├── config.js           # Configuration save/load/import/export
├── xml.js              # AssignedAccess XML generation
├── validation.js       # Input validation rules
├── helpers.js          # Utility functions and browser detection
├── dom.js              # DOM caching
├── state.js            # Application state and preset loading
├── styles.css          # UI themes and layout
├── data/
│   ├── app-presets.json    # Common application presets
│   └── pin-presets.json    # Start menu pin presets
├── configs/            # Example configurations
└── assets/             # Logo and fonts
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [REFERENCE.md](REFERENCE.md) | Technical reference: deployment, troubleshooting, XML namespaces, Edge configuration |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute: code style, pull requests, testing |
| [CHANGELOG.md](CHANGELOG.md) | Version history and release notes |

---

## Privacy

Kiosk Overseer is 100% client-side. **No data is collected, transmitted, or stored on any server.**

- All configuration, XML generation, and script building happens entirely in your browser
- Exports are generated in-memory and downloaded as local files
- Saved configurations (`.kioskoverseer.json`) are stored only on your local filesystem
- No user input or configuration data ever leaves your device
- No cookies, local storage, or session tracking is used for user content
- The only external resource is [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/) for anonymous page view metrics (no personal data, no cookies)

---

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on:
- Code style and naming conventions
- Testing procedures
- Pull request requirements

---

## License

[GNU General Public License v3.0](LICENSE) — Copyright 2026 Joshua Walderbach

See [NOTICE](NOTICE) for attribution requirements.
