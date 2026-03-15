/* ============================================================================
   Focus Trap Utility
   ============================================================================
   Reusable, accessible focus management for modal dialogs.

   API:
     const trap = createFocusTrap(modalElement, { onClose: () => hideModal() });
     trap.activate();   // call when modal opens
     trap.deactivate(); // call when modal closes

   Features:
   - Traps Tab/Shift+Tab within the modal
   - Closes on Escape via onClose callback
   - Stores and restores focus to the triggering element
   - Handles dynamically added/removed elements
   - Handles zero or one focusable element
   - Prevents background scroll while active
   ============================================================================ */

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
].join(', ');

// Track active traps for scroll lock management
let activeTrapCount = 0;

function createFocusTrap(modalElement, options = {}) {
    const { onClose } = options;
    let previouslyFocused = null;
    let active = false;

    function getFocusableElements() {
        return Array.from(modalElement.querySelectorAll(FOCUSABLE_SELECTOR))
            .filter(el => !el.closest('.hidden') && el.offsetParent !== null);
    }

    function handleKeydown(event) {
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            if (onClose) onClose();
            return;
        }

        if (event.key !== 'Tab') return;

        const focusable = getFocusableElements();
        if (focusable.length === 0) {
            // No focusable elements — keep focus on modal container
            event.preventDefault();
            return;
        }

        if (focusable.length === 1) {
            // Only one element — stay on it
            event.preventDefault();
            focusable[0].focus();
            return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey) {
            // Shift+Tab: wrap from first to last
            if (document.activeElement === first) {
                event.preventDefault();
                last.focus();
            }
        } else {
            // Tab: wrap from last to first
            if (document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }
    }

    function activate() {
        if (active) return;
        active = true;

        // Store the element that had focus before the modal opened
        previouslyFocused = document.activeElement;

        // Ensure modal container is focusable as fallback
        if (!modalElement.hasAttribute('tabindex')) {
            modalElement.setAttribute('tabindex', '-1');
        }

        // Listen for keyboard events
        modalElement.addEventListener('keydown', handleKeydown);

        // Prevent background scroll
        activeTrapCount++;
        document.body.style.overflow = 'hidden';

        // Move focus to first focusable element, or close button, or modal itself
        requestAnimationFrame(() => {
            const focusable = getFocusableElements();
            // Prefer the close button or first interactive element
            const closeBtn = modalElement.querySelector('.modal-close');
            const target = (closeBtn && focusable.includes(closeBtn))
                ? closeBtn
                : focusable[0] || modalElement;
            target.focus();
        });
    }

    function deactivate() {
        if (!active) return;
        active = false;

        modalElement.removeEventListener('keydown', handleKeydown);

        // Restore background scroll if no other traps are active
        activeTrapCount = Math.max(0, activeTrapCount - 1);
        if (activeTrapCount === 0) {
            document.body.style.overflow = '';
        }

        // Restore focus to the element that triggered the modal
        if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
            previouslyFocused.focus();
        }
        previouslyFocused = null;
    }

    return { activate, deactivate };
}
