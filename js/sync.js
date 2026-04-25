/* ═══════════════════════════════════════════════════════════
   SYNC.JS — Arya
   Synchronisation bidirectionnelle Firebase ↔ localStorage.

   Structure Firebase :
     users/{uid}/
       pseudo
       favs        → array de filenames
       history     → array d'entrées {filename,title,artist,ts}
       stats       → map filename → {plays,seconds,title,artist}
       playlists   → map id → playlist
       meta        → map filename → métadonnées éditées
       artistImgs  → map artistName → url
       lrcCache    → map key → {lines,plain}

   Stratégie de merge :
     - Au démarrage  : Firebase > localStorage (source de vérité cloud)
     - En cours d'usage : write-through (écrit local + Firebase)
     - Listener temps réel : merge si changement depuis un autre appareil

   Dépend de : config.js, utils.js, library.js,
               auth.js, firebase-init.js
═══════════════════════════════════════════════════════════ */

const Sync = (() => {

  let _uid        = null;
  let _listeners  = []; // listeners Firebase actifs à détacher au signOut
  let _ready      = false;
  let _writeQueue = {}; // debounce des écritures Firebase


  /* ═══════════════════════════════════════════════════════════
     HELPERS
  ═══════════════════════════════════════════════════════════ */

  function _ref(path) {
    return firebase.database().ref(`users/${_uid}/${path}`);
  }

  /**
   * Écriture Firebase avec debounce 1.5s.
   * Évite des centaines d'écritures pendant une session.
   */
  function _write(path, data) {
    if (!_uid) return;
    if (_writeQueue[path]) clearTimeout(_writeQueue[path]);
    _writeQueue[path] = setTimeout(() => {
      delete _writeQueue[path];
      _ref(path).set(data).catch(e => console.warn('[Arya Sync] write error:', path, e));
    }, 1500);
  }

  /** Flush immédiat d'un chemin (avant fermeture de l'app). */
  function _writeNow(path, data) {
    if (!_uid) return Promise.resolve();
    if (_writeQueue[path]) { clearTimeout(_writeQueue[path]); delete _writeQueue[path]; }
    return _ref(path).set(data).catch(e => console.warn('[Arya Sync] writeNow error:', path, e));
  }


  /* ═══════════════════════════════════════════════════════════
     CHARGEMENT INITIAL DEPUIS FIREBASE
  ═══════════════════════════════════════════════════════════ */

  async function _loadFromFirebase() {
    try {
      const snap = await firebase.database().ref(`users/${_uid}`).once('value');
      const data = snap.val() || {};

      /* ── Favoris ── */
      if (Array.isArray(data.favs)) {
        localStorage.setItem(FAV_STORE, JSON.stringify(data.favs));
      }

      /* ── Historique ── */
      if (Array.isArray(data.history)) {
        const merged = _mergeHistory(
          JSON.parse(localStorage.getItem(HIST_STORE) || '[]'),
          data.history
        );
        localStorage.setItem(HIST_STORE, JSON.stringify(merged));
      }

      /* ── Stats ── */
      if (data.stats && typeof data.stats === 'object') {
        const local  = JSON.parse(localStorage.getItem(STATS_STORE) || '{}');
        const merged = _mergeStats(local, data.stats);
        localStorage.setItem(STATS_STORE, JSON.stringify(merged));
      }

      /* ── Playlists ── */
      if (data.playlists && typeof data.playlists === 'object') {
        const local  = JSON.parse(localStorage.getItem(PLAYLIST_STORE) || '{}');
        const merged = { ...data.playlists, ...local }; // local prioritaire
        localStorage.setItem(PLAYLIST_STORE, JSON.stringify(merged));
      }

      /* ── Métadonnées ── */
      if (data.meta && typeof data.meta === 'object') {
        const local  = JSON.parse(localStorage.getItem(META_STORE) || '{}');
        const merged = { ...data.meta, ...local }; // local prioritaire
        localStorage.setItem(META_STORE, JSON.stringify(merged));
      }

      /* ── Images artistes ── */
      if (data.artistImgs && typeof data.artistImgs === 'object') {
        const local  = JSON.parse(localStorage.getItem(ARTIST_IMG_STORE) || '{}');
        const merged = { ...data.artistImgs, ...local };
        localStorage.setItem(ARTIST_IMG_STORE, JSON.stringify(merged));
      }

      /* ── Cache paroles LRC ── */
      if (data.lrcCache && typeof data.lrcCache === 'object') {
        const local  = JSON.parse(localStorage.getItem(LRC_STORE) || '{}');
        const merged = { ...data.lrcCache, ...local };
        localStorage.setItem(LRC_STORE, JSON.stringify(merged));
      }

      _ready = true;
      if (typeof applyMeta === 'function') applyMeta();
      if (typeof renderAll === 'function') renderAll();
      if (typeof updateFavBadge === 'function') updateFavBadge();

    } catch (e) {
      console.warn('[Arya Sync] Erreur chargement initial:', e);
      _ready = true; // Continue sans sync
    }
  }


  /* ═══════════════════════════════════════════════════════════
     LISTENERS TEMPS RÉEL
  ═══════════════════════════════════════════════════════════ */

  function _attachListeners() {
    /* ── Favoris ── */
    const favRef = _ref('favs');
    const favCb  = snap => {
      if (!_ready) return;
      const val = snap.val();
      if (Array.isArray(val)) {
        localStorage.setItem(FAV_STORE, JSON.stringify(val));
        if (typeof renderFavorites === 'function') renderFavorites();
        if (typeof updateFavBadge  === 'function') updateFavBadge();
      }
    };
    favRef.on('value', favCb);
    _listeners.push(() => favRef.off('value', favCb));

    /* ── Playlists ── */
    const plRef = _ref('playlists');
    const plCb  = snap => {
      if (!_ready) return;
      const val = snap.val();
      if (val && typeof val === 'object') {
        localStorage.setItem(PLAYLIST_STORE, JSON.stringify(val));
        if (typeof renderPlaylists === 'function') renderPlaylists();
      }
    };
    plRef.on('value', plCb);
    _listeners.push(() => plRef.off('value', plCb));

    /* ── Métadonnées ── */
    const metaRef = _ref('meta');
    const metaCb  = snap => {
      if (!_ready) return;
      const val = snap.val();
      if (val && typeof val === 'object') {
        const local  = JSON.parse(localStorage.getItem(META_STORE) || '{}');
        const merged = { ...val, ...local };
        localStorage.setItem(META_STORE, JSON.stringify(merged));
        if (typeof applyMeta === 'function') applyMeta();
        if (typeof renderAll === 'function') renderAll();
      }
    };
    metaRef.on('value', metaCb);
    _listeners.push(() => metaRef.off('value', metaCb));
  }

  function _detachListeners() {
    _listeners.forEach(off => off());
    _listeners = [];
  }


  /* ═══════════════════════════════════════════════════════════
     MERGE HELPERS
  ═══════════════════════════════════════════════════════════ */

  function _mergeHistory(local, remote) {
    const all  = [...local, ...remote];
    const seen = new Set();
    return all
      .filter(h => { const k = h.filename + h.ts; if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((a, b) => b.ts - a.ts)
      .slice(0, MAX_HIST);
  }

  function _mergeStats(local, remote) {
    const merged = { ...remote };
    Object.entries(local).forEach(([fn, ls]) => {
      if (!merged[fn]) { merged[fn] = ls; return; }
      // Garde le max des plays et additionne les secondes
      merged[fn] = {
        ...merged[fn],
        title:   ls.title  || merged[fn].title,
        artist:  ls.artist || merged[fn].artist,
        plays:   Math.max(ls.plays   || 0, merged[fn].plays   || 0),
        seconds: (ls.seconds || 0) + (merged[fn].seconds || 0),
      };
    });
    return merged;
  }


  /* ═══════════════════════════════════════════════════════════
     WRITE-THROUGH — appelé depuis library.js, render.js, etc.
     Chaque fonction de sauvegarde locale appelle aussi Sync.push*
  ═══════════════════════════════════════════════════════════ */

  function pushFavs() {
    if (!_uid) return;
    const favs = JSON.parse(localStorage.getItem(FAV_STORE) || '[]');
    _write('favs', favs);
  }

  function pushHistory() {
    if (!_uid) return;
    const history = JSON.parse(localStorage.getItem(HIST_STORE) || '[]');
    _write('history', history.slice(0, 100)); // Limite Firebase
  }

  function pushStats() {
    if (!_uid) return;
    const stats = JSON.parse(localStorage.getItem(STATS_STORE) || '{}');
    _write('stats', stats);
  }

  function pushMeta() {
    if (!_uid) return;
    const meta = JSON.parse(localStorage.getItem(META_STORE) || '{}');
    _write('meta', meta);
  }

  function pushPlaylists() {
    if (!_uid) return;
    const pls = JSON.parse(localStorage.getItem(PLAYLIST_STORE) || '{}');
    _write('playlists', pls);
  }

  function pushArtistImgs() {
    if (!_uid) return;
    const imgs = JSON.parse(localStorage.getItem(ARTIST_IMG_STORE) || '{}');
    _write('artistImgs', imgs);
  }

  function pushLrcCache() {
    if (!_uid) return;
    const lrc = JSON.parse(localStorage.getItem(LRC_STORE) || '{}');
    _write('lrcCache', lrc);
  }

  /** Push tout d'un coup (import/export, clear). */
  function pushAll() {
    pushFavs();
    pushHistory();
    pushStats();
    pushMeta();
    pushPlaylists();
    pushArtistImgs();
    pushLrcCache();
  }


  /* ═══════════════════════════════════════════════════════════
     INIT / RESET
  ═══════════════════════════════════════════════════════════ */

  async function init(uid) {
    _uid   = uid;
    _ready = false;
    _detachListeners();
    await _loadFromFirebase();
    _attachListeners();
  }

  function reset() {
    _detachListeners();
    Object.values(_writeQueue).forEach(clearTimeout);
    _writeQueue = {};
    _uid        = null;
    _ready      = false;
  }


  /* ═══════════════════════════════════════════════════════════
     FLUSH avant fermeture (visibilitychange → hidden)
  ═══════════════════════════════════════════════════════════ */

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden' || !_uid) return;
    // Flush immédiat des writes en attente
    const pending = Object.entries(_writeQueue);
    pending.forEach(([path]) => {
      clearTimeout(_writeQueue[path]);
      delete _writeQueue[path];
    });
    // Réécrit tout en urgence (navigator.sendBeacon ne marche pas avec Firebase)
    pushAll();
  });


  return {
    init,
    reset,
    pushFavs,
    pushHistory,
    pushStats,
    pushMeta,
    pushPlaylists,
    pushArtistImgs,
    pushLrcCache,
    pushAll,
  };

})();
