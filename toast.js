/* ============================================================================
   Toast Notification System
   ============================================================================
   Accessible, themed toast notifications to replace alert() calls.

   API:
     showToast(message, { type: 'success' | 'error' | 'info', duration?: number })

   - Uses ARIA live regions for screen reader announcements
   - Auto-dismisses: 4s for success/info, 8s for error (configurable)
   - Stacks multiple toasts vertically
   - Respects prefers-reduced-motion
   - Theme-aware via existing CSS custom properties
   ============================================================================ */

const TOAST_DEFAULTS = {
    success: { duration: 4000, icon: '\u2713', label: 'Success' },
    error:   { duration: 8000, icon: '!',      label: 'Error' },
    info:    { duration: 4000, icon: 'i',      label: 'Info' }
};

function showToast(message, options = {}) {
    const type = options.type || 'info';
    const defaults = TOAST_DEFAULTS[type] || TOAST_DEFAULTS.info;
    const duration = options.duration ?? defaults.duration;

    const container = document.getElementById('toastContainer');
    if (!container) return;

    // Switch ARIA live mode based on severity
    if (type === 'error') {
        container.setAttribute('aria-live', 'assertive');
        container.setAttribute('role', 'alert');
    } else {
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('role', 'status');
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = defaults.icon;

    const msg = document.createElement('span');
    msg.className = 'toast-message';
    msg.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.setAttribute('aria-label', 'Dismiss notification');
    closeBtn.textContent = '\u00d7';
    closeBtn.type = 'button';

    toast.appendChild(icon);
    toast.appendChild(msg);
    toast.appendChild(closeBtn);

    // Progress bar for auto-dismiss
    if (duration > 0) {
        const progress = document.createElement('div');
        progress.className = 'toast-progress';
        progress.style.animationDuration = `${duration}ms`;
        toast.appendChild(progress);
    }

    container.appendChild(toast);

    // Dismiss function
    let dismissed = false;
    let timer = null;

    function dismiss() {
        if (dismissed) return;
        dismissed = true;
        if (timer) clearTimeout(timer);

        // Check for reduced motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReducedMotion) {
            toast.remove();
            return;
        }

        toast.classList.add('toast-removing');
        toast.addEventListener('animationend', () => toast.remove(), { once: true });
        // Fallback removal in case animation doesn't fire
        setTimeout(() => { if (toast.parentNode) toast.remove(); }, 300);
    }

    closeBtn.addEventListener('click', dismiss);

    if (duration > 0) {
        timer = setTimeout(dismiss, duration);
    }

    // Pause timer on hover
    toast.addEventListener('mouseenter', () => {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
        const progress = toast.querySelector('.toast-progress');
        if (progress) progress.style.animationPlayState = 'paused';
    });

    toast.addEventListener('mouseleave', () => {
        if (!dismissed && duration > 0) {
            timer = setTimeout(dismiss, duration);
            const progress = toast.querySelector('.toast-progress');
            if (progress) progress.style.animationPlayState = 'running';
        }
    });

    return toast;
}
