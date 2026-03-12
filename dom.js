/* ============================================================================
   DOM Cache
   ============================================================================ */
const dom = (() => {
    const cache = new Map();

    return {
        get(id) {
            if (!cache.has(id)) {
                cache.set(id, document.getElementById(id));
            }
            return cache.get(id);
        },
        clear(id) {
            if (typeof id === 'string') {
                cache.delete(id);
            } else {
                cache.clear();
            }
        }
    };
})();
