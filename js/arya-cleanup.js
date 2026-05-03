/* ═══════════════════════════════════════════════════════════
   ARYA-CLEANUP.JS — Gestion des listeners et ressources
   Évite les listeners dupliqués et les fuites mémoire.

   Chargé après utils.js.

   Usage :
     // Listener unique (remplace addEventListener avec dédup)
     AryaEvents.on(element, 'click', handler, 'my-key');
     AryaEvents.off(element, 'my-key');
     AryaEvents.offAll(element);

     // Ressources à nettoyer
     AryaCleanup.registerInterval(id);
     AryaCleanup.registerBlob(url);
     AryaCleanup.flush();   // nettoie tout
═══════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════
   ARYA EVENTS — Listeners sans doublons
══════════════════════════════════════════════════════════ */
window.AryaEvents = (function () {

  // Map WeakMap<element, Map<key, {type, fn, options}>>
  const _registry = new WeakMap();

  function _getMap(el) {
    if (!_registry.has(el)) _registry.set(el, new Map());
    return _registry.get(el);
  }

  return {
    /**
     * Attache un listener unique identifié par une clé.
     * Si un listener avec la même clé existe déjà, il est retiré avant.
     *
     * @param {EventTarget} el
     * @param {string} type        - 'click', 'touchstart', etc.
     * @param {Function} fn
     * @param {string} key         - identifiant unique pour cet élément
     * @param {object} [options]   - options addEventListener
     */
    on(el, type, fn, key, options) {
      if (!el) return;
      const map = _getMap(el);

      // Retire l'ancien si même clé
      if (map.has(key)) {
        const old = map.get(key);
        el.removeEventListener(old.type, old.fn, old.options);
      }

      el.addEventListener(type, fn, options);
      map.set(key, { type, fn, options });
    },

    /**
     * Retire un listener par sa clé.
     */
    off(el, key) {
      if (!el) return;
      const map = _getMap(el);
      if (!map.has(key)) return;
      const { type, fn, options } = map.get(key);
      el.removeEventListener(type, fn, options);
      map.delete(key);
    },

    /**
     * Retire tous les listeners d'un élément.
     */
    offAll(el) {
      if (!el) return;
      const map = _getMap(el);
      map.forEach(({ type, fn, options }) => {
        el.removeEventListener(type, fn, options);
      });
      map.clear();
    },

    /**
     * Listener one-shot garanti unique.
     */
    once(el, type, fn, key) {
      if (!el) return;
      const wrapped = (e) => {
        fn(e);
        this.off(el, key);
      };
      this.on(el, type, wrapped, key, { once: true });
    },
  };

})();


/* ══════════════════════════════════════════════════════════
   ARYA CLEANUP — Ressources à durée de vie gérée
══════════════════════════════════════════════════════════ */
window.AryaCleanup = (function () {

  const _intervals  = new Set();
  const _timeouts   = new Set();
  const _rafs       = new Set();
  const _blobs      = new Set();
  const _observers  = new Set();

  return {

    /* ── Intervals ────────────────────────────────────────── */
    registerInterval(id) {
      _intervals.add(id);
      return id;
    },
    clearInterval(id) {
      clearInterval(id);
      _intervals.delete(id);
    },

    /* ── Timeouts ─────────────────────────────────────────── */
    registerTimeout(id) {
      _timeouts.add(id);
      return id;
    },
    clearTimeout(id) {
      clearTimeout(id);
      _timeouts.delete(id);
    },

    /* ── RAF ──────────────────────────────────────────────── */
    registerRaf(id) {
      _rafs.add(id);
      return id;
    },
    cancelRaf(id) {
      cancelAnimationFrame(id);
      _rafs.delete(id);
    },

    /* ── Blob URLs ────────────────────────────────────────── */
    registerBlob(url) {
      if (url && url.startsWith('blob:')) _blobs.add(url);
      return url;
    },
    revokeBlob(url) {
      if (url && _blobs.has(url)) {
        URL.revokeObjectURL(url);
        _blobs.delete(url);
      }
    },

    /* ── Observers ────────────────────────────────────────── */
    registerObserver(obs) {
      _observers.add(obs);
      return obs;
    },
    disconnectObserver(obs) {
      obs?.disconnect?.();
      _observers.delete(obs);
    },

    /* ── Stats ────────────────────────────────────────────── */
    stats() {
      return {
        intervals: _intervals.size,
        timeouts:  _timeouts.size,
        rafs:      _rafs.size,
        blobs:     _blobs.size,
        observers: _observers.size,
      };
    },

    /* ── Nettoyage global (appelé si besoin de libérer RAM) ── */
    flush() {
      _intervals.forEach(id => clearInterval(id));
      _intervals.clear();

      _timeouts.forEach(id => clearTimeout(id));
      _timeouts.clear();

      _rafs.forEach(id => cancelAnimationFrame(id));
      _rafs.clear();

      _blobs.forEach(url => URL.revokeObjectURL(url));
      _blobs.clear();

      _observers.forEach(obs => obs?.disconnect?.());
      _observers.clear();

      if (window.Arya?.log) {
        Arya.log('perf', 'AryaCleanup.flush() — ressources libérées');
      }
    },
  };

})();


/* ══════════════════════════════════════════════════════════
   SURVEILLANCE MÉMOIRE — alerte si RAM critique
══════════════════════════════════════════════════════════ */
(function _memoryWatch() {
  if (!performance?.memory) return;  // Chrome only

  const CHECK_INTERVAL = 30000;  // 30s
  const WARN_MB        = 200;    // Alerte à 200MB heap utilisé

  AryaCleanup.registerInterval(setInterval(() => {
    const used = performance.memory.usedJSHeapSize / 1048576;
    if (used > WARN_MB) {
      if (window.Arya?.log) {
        Arya.log.warn('perf', `Heap JS élevé : ${used.toFixed(0)}MB`, AryaCleanup.stats());
      }
    }
  }, CHECK_INTERVAL));
})();


/* ══════════════════════════════════════════════════════════
   PATCH VISIBILITYCHANGE — pause propre si onglet caché
   (évite les intervals qui tournent en arrière-plan)
══════════════════════════════════════════════════════════ */
(function _visibilityPatch() {
  let _hidden = false;

  document.addEventListener('visibilitychange', () => {
    _hidden = document.hidden;
    if (window.Arya?.log) {
      Arya.log('ui', _hidden ? 'App en arrière-plan' : 'App au premier plan');
    }
  });

  // Expose pour les modules qui veulent savoir
  window.AryaIsHidden = () => _hidden;
})();
