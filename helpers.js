/* ============================================================================
   Helpers
   ============================================================================ */
function isEdgeApp(value) {
    if (!value) return false;
    const lowerValue = value.toLowerCase();
    return lowerValue.includes('msedge') ||
           lowerValue.includes('microsoftedge') ||
           lowerValue.includes('edge\\application');
}

function isChromeApp(value) {
    if (!value) return false;
    const lowerValue = value.toLowerCase();
    return lowerValue.includes('chrome.exe') ||
           lowerValue.includes('\\chrome\\application');
}

function isFirefoxApp(value) {
    if (!value) return false;
    const lowerValue = value.toLowerCase();
    return lowerValue.includes('firefox.exe') ||
           lowerValue.includes('\\mozilla firefox\\');
}

function isBraveApp(value) {
    if (!value) return false;
    const lowerValue = value.toLowerCase();
    return lowerValue.includes('brave.exe') ||
           lowerValue.includes('\\bravesoftware\\');
}

function isIslandApp(value) {
    if (!value) return false;
    const lowerValue = value.toLowerCase();
    return lowerValue.includes('island.exe') ||
           lowerValue.includes('\\island\\island\\');
}

function isBrowserWithKioskSupport(value) {
    return isEdgeApp(value) || isChromeApp(value) || isFirefoxApp(value) || isBraveApp(value) || isIslandApp(value);
}

function copyToClipboard(text, buttonEl) {
    const showFeedback = (btn) => {
        if (!btn) return;
        const original = btn.innerHTML;
        btn.innerHTML = '<span aria-hidden="true">Copied!</span>';
        btn.classList.add('copy-success');
        setTimeout(() => {
            btn.innerHTML = original;
            btn.classList.remove('copy-success');
        }, 1500);
    };

    navigator.clipboard.writeText(text).then(() => {
        showFeedback(buttonEl);
    }).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showFeedback(buttonEl);
    });
}

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type: type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function escapeXml(str) {
    if (str === null || str === undefined) return '';
    return str.replace(/[<>&'"]/g, function(c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
}

function escapeAttr(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.substring(0, len - 3) + '...' : str;
}

function buildFileUrl(filePath) {
    if (!filePath) return '';
    let normalized = filePath.trim();
    if (!normalized) return '';
    if (normalized.toLowerCase().startsWith('file:///')) {
        return normalized;
    }
    normalized = normalized.replace(/\\/g, '/');
    normalized = normalized.split('/').map((segment, index) => {
        if (index === 0 && /^[A-Za-z]:$/.test(segment)) {
            return segment;
        }
        return encodeURIComponent(segment);
    }).join('/');
    if (!normalized.toLowerCase().startsWith('file:///')) {
        normalized = 'file:///' + normalized;
    }
    return normalized;
}

function buildLaunchUrl(sourceType, urlValue, filePathValue, fallbackUrl) {
    if (sourceType === 'file') {
        return buildFileUrl(filePathValue) || buildFileUrl('C:/Kiosk/index.html');
    }
    return urlValue || fallbackUrl || '';
}

function buildEdgeKioskArgs(url, kioskType, idleTimeout) {
    let args = `--kiosk ${url} --edge-kiosk-type=${kioskType} --no-first-run`;
    if (idleTimeout && idleTimeout > 0) {
        args += ` --kiosk-idle-timeout-minutes=${idleTimeout}`;
    }
    return args;
}

function buildBrowserKioskArgs(browser, url, kioskType) {
    if (!url) return '';
    if (browser === 'edge') {
        const mode = kioskType || 'fullscreen';
        return buildEdgeKioskArgs(url, mode, 0);
    }
    if (browser === 'chrome') {
        return `--kiosk ${url} --no-first-run`;
    }
    if (browser === 'brave') {
        return `--kiosk ${url} --no-first-run`;
    }
    if (browser === 'island') {
        return `--kiosk ${url} --no-first-run`;
    }
    if (browser === 'firefox') {
        return `--kiosk ${url}`;
    }
    return '';
}

function copyDeployCode(button) {
    const code = button.closest('.deploy-code-wrapper')?.querySelector('.deploy-code');
    if (!code) return;
    copyToClipboard(code.textContent, button);
}

function parseEdgeKioskArgs(args) {
    const result = {
        mode: 'standard',
        url: '',
        sourceType: 'url',
        idleTimeout: 0
    };

    if (!args || typeof args !== 'string') return result;

    // Check if this has kiosk args
    const kioskMatch = args.match(/--kiosk\s+(\S+)/);
    if (!kioskMatch) return result;

    result.url = kioskMatch[1];

    // Determine source type (file:// vs url)
    if (result.url.toLowerCase().startsWith('file:///')) {
        result.sourceType = 'file';
    }

    // Check for edge kiosk type
    const kioskTypeMatch = args.match(/--edge-kiosk-type=(\S+)/);
    if (kioskTypeMatch) {
        if (kioskTypeMatch[1] === 'public-browsing') {
            result.mode = 'kioskPublic';
        } else {
            result.mode = 'kioskFullscreen';
        }
    } else if (kioskMatch) {
        // Has --kiosk but no --edge-kiosk-type (Chrome/Brave/Firefox/Island style)
        result.mode = 'kioskFullscreen';
    }

    // Check for idle timeout
    const idleMatch = args.match(/--kiosk-idle-timeout-minutes=(\d+)/);
    if (idleMatch) {
        result.idleTimeout = parseInt(idleMatch[1], 10);
    }

    return result;
}
