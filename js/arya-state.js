/* ═══════════════════════════════════════════════════════════
   ARYA-STATE.JS — Store centralisé
   Source unique de vérité pour l'état de l'app.
   Chargé tôt (après config.js).

   Usage :
     AryaState.set('playing', true);
     AryaState.get('currentTrack');
     AryaState.subscribe('playing', (val) => updateUI(val));
═══════════════════════════════════════════════════════════ */

window.AryaState = (function () {

  const _state = {
    /* ── Lecture ── */
    currentTrack:    null,   // objet track complet
    currentId:       null,   // id numérique
    isPlaying:       false,
    activePlayer:    1,      // 1 ou 2 (gapless dual-player)
    shuffle:         false,
    repeat:          false,  // false | 'one' | 'all'
    volume:          100,
    playbackRate:    1.0,
    normalize:       false,

    /* ── File d'attente ── */
    queue:           [],
    queueIdx:        0,

    /* ── UI ── */
    currentView:     'dashboard',
    fsOpen:          false,
    lyricsOpen:      false,
    queuePanelOpen:  false,

    /* ── Réseau / Social ── */
    online:          navigator.onLine,
    pseudo:          null,
    uid:             null,
    partyId:         null,
    partyHosting:    false,

    /* ── Bibliothèque ── */
    tracks:          [],
    favs:            new Set(),
    history:         [],

    /* ── Cache ── */
    cacheEnabled:    false,
  };

  const _listeners = {};  // { key: [callbacks] }

  return {

    /* ── Lecture ─────────────────────────────────────────── */
    get(key) {
      return _state[key];
    },

    getAll() {
      return { ..._state };
    },

    /* ── Écriture ────────────────────────────────────────── */
    set(key, value) {
      if (_state[key] === value) return;
      _state[key] = value;
      this._notify(key, value);
    },

    /* Mise à jour partielle d'un objet */
    patch(key, partial) {
      if (typeof _state[key] !== 'object' || _state[key] === null) return;
      _state[key] = { ..._state[key], ...partial };
      this._notify(key, _state[key]);
    },

    /* ── Subscriptions ───────────────────────────────────── */
    subscribe(key, cb) {
      if (!_listeners[key]) _listeners[key] = [];
      _listeners[key].push(cb);
      // Appel immédiat avec la valeur courante
      cb(_state[key]);
      // Retourne un unsubscribe
      return () => {
        _listeners[key] = _listeners[key].filter(f => f !== cb);
      };
    },

    _notify(key, value) {
      (_listeners[key] || []).forEach(cb => {
        try { cb(value); } catch(e) { console.warn('[AryaState]', key, e); }
      });
    },

    /* ── Helpers lecture ─────────────────────────────────── */
    isOnline()   { return _state.online; },
    isLoggedIn() { return !!_state.uid; },
    hasParty()   { return !!_state.partyId; },

    /* ── Sync depuis les variables globales existantes ───── */
    /* Appelé par init.js après chargement pour bootstrapper */
    syncFromGlobals() {
      try {
        if (typeof currentId    !== 'undefined') this.set('currentId',    currentId);
        if (typeof isPlaying    !== 'undefined') this.set('isPlaying',    isPlaying);
        if (typeof activePlayer !== 'undefined') this.set('activePlayer', activePlayer);
        if (typeof queue        !== 'undefined') this.set('queue',        queue);
        if (typeof queueIdx     !== 'undefined') this.set('queueIdx',     queueIdx);
        if (typeof pseudo       !== 'undefined') this.set('pseudo',       pseudo);
        if (typeof tracks       !== 'undefined') this.set('tracks',       tracks);
      } catch(e) {
        console.warn('[AryaState] syncFromGlobals:', e);
      }
    },
  };

})();

/* ── Sync online/offline ─────────────────────────────────── */
window.addEventListener('online',  () => AryaState.set('online', true));
window.addEventListener('offline', () => AryaState.set('online', false));
