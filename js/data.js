/* ═══════════════════════════════════════════════════════════
   DATA.JS — Arya
   Export / import de données, enrichissement manuel
   et application des métadonnées sauvegardées.

   Dépend de : config.js, utils.js, library.js,
               covers.js, render.js, playlists.js
═══════════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════════
   ENRICHISSEMENT MANUEL (pochettes via Deezer / iTunes)
═══════════════════════════════════════════════════════════ */

let _enrichStopped = false;

function launchEnrichmentFromData() {
  if (_enrichRunning) { toast('⟳ Enrichissement déjà en cours', true); return; }
  _enrichStopped = false;
  _updateEnrichDataUI('running');
  startEnrichment().then(() => {
    if (!_enrichStopped) _updateEnrichDataUI('done');
  });
}

function stopEnrichment() {
  _enrichStopped  = true;
  _enrichQueue    = [];
  _enrichRunning  = false;
  updateEnrichBadge();
  _updateEnrichDataUI('stopped');
  toast('⏹ Enrichissement arrêté');
}

function _updateEnrichDataUI(state) {
  const statusEl = document.getElementById('enrichStatusText');
  const startBtn = document.getElementById('enrichStartBtn');
  const stopBtn  = document.getElementById('enrichStopBtn');
  if (!statusEl) return;

  const states = {
    running: {
      text:  `Statut : en cours… (${_enrichTotal || '?'} pistes à traiter)`,
      color: 'var(--accent)',
      start: 'none',
      stop:  '',
      label: null,
    },
    done: {
      text:  'Statut : terminé ✅ — toutes les pistes ont été traitées',
      color: 'var(--green)',
      start: '',
      stop:  'none',
      label: '↺ Relancer',
    },
    stopped: {
      text:  'Statut : arrêté manuellement',
      color: 'var(--rose)',
      start: '',
      stop:  'none',
      label: '🚀 Reprendre',
    },
  };

  const cfg = states[state];
  if (!cfg) return;
  statusEl.textContent  = cfg.text;
  statusEl.style.color  = cfg.color;
  if (startBtn) { startBtn.style.display = cfg.start; if (cfg.label) startBtn.textContent = cfg.label; }
  if (stopBtn)  stopBtn.style.display = cfg.stop;
}



/* ═══════════════════════════════════════════════════════════
   EXPORT
═══════════════════════════════════════════════════════════ */

function exportData() {
  const _get = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || fallback); }
    catch { return JSON.parse(fallback); }
  };

  const data = {
    version:    2,
    exported:   new Date().toISOString(),
    appName:    'Arya',
    meta:       _get(META_STORE,       '{}'),
    favs:       _get(FAV_STORE,        '[]'),
    history:    _get(HIST_STORE,       '[]'),
    stats:      _get(STATS_STORE,      '{}'),
    playlists:  _get(PLAYLIST_STORE,   '{}'),
    artistImgs: _get(ARTIST_IMG_STORE, '{}'),
    lrcCache:   _get(LRC_STORE,        '{}'),
    blocklist:  _get(BLOCK_STORE,      '[]'),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href:     url,
    download: `arya-export-${new Date().toISOString().slice(0, 10)}.json`,
  });
  a.click();
  URL.revokeObjectURL(url);
  toast('✅ Export téléchargé');
}


/* ═══════════════════════════════════════════════════════════
   IMPORT
═══════════════════════════════════════════════════════════ */

function importData(mode) {
  const input    = document.createElement('input');
  input.type     = 'file';
  input.accept   = 'application/json,.json';
  input.onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data.version || data.appName !== 'Arya') throw new Error('Format invalide');

      if (mode === 'replace') {
        if (!confirm('⚠️ Remplacer TOUTES vos données locales par cet export ? Action irréversible.')) return;

        localStorage.setItem(META_STORE,       JSON.stringify(data.meta       || {}));
        localStorage.setItem(FAV_STORE,        JSON.stringify(data.favs       || []));
        localStorage.setItem(HIST_STORE,       JSON.stringify(data.history    || []));
        localStorage.setItem(STATS_STORE,      JSON.stringify(data.stats      || {}));
        localStorage.setItem(PLAYLIST_STORE,   JSON.stringify(data.playlists  || {}));
        if (data.artistImgs) localStorage.setItem(ARTIST_IMG_STORE, JSON.stringify(data.artistImgs));
        // ✅ lrcCache importé en mode replace
        if (data.lrcCache)   localStorage.setItem(LRC_STORE,        JSON.stringify(data.lrcCache));
        if (data.blocklist) localStorage.setItem(BLOCK_STORE,      JSON.stringify(data.blocklist));

      } else {
        // ── MODE FUSION ──
        // ⚠️ Stats volontairement exclues pour ne pas fausser le classement.
        //    Seules les métadonnées, pochettes, favoris, playlists,
        //    images d'artistes et paroles sont fusionnées.

        if (data.meta) {
          const cur    = JSON.parse(localStorage.getItem(META_STORE) || '{}');
          const merged = { ...data.meta, ...cur }; // priorité au local
          localStorage.setItem(META_STORE, JSON.stringify(merged));
        }

        if (data.favs) {
          const cur = new Set(JSON.parse(localStorage.getItem(FAV_STORE) || '[]'));
          (data.favs || []).forEach(f => cur.add(f));
          localStorage.setItem(FAV_STORE, JSON.stringify([...cur]));
        }

        if (data.history) {
          const cur    = JSON.parse(localStorage.getItem(HIST_STORE) || '[]');
          const merged = [...cur, ...(data.history || [])];
          const seen   = new Set();
          const deduped = merged
            .filter(h => { const k = h.filename + h.ts; if (seen.has(k)) return false; seen.add(k); return true; })
            .sort((a, b) => b.ts - a.ts)
            .slice(0, MAX_HIST);
          localStorage.setItem(HIST_STORE, JSON.stringify(deduped));
        }

        if (data.playlists) {
          const cur = JSON.parse(localStorage.getItem(PLAYLIST_STORE) || '{}');
          localStorage.setItem(PLAYLIST_STORE, JSON.stringify({ ...cur, ...data.playlists }));
        }

        if (data.artistImgs) {
          const cur = JSON.parse(localStorage.getItem(ARTIST_IMG_STORE) || '{}');
          localStorage.setItem(ARTIST_IMG_STORE, JSON.stringify({ ...cur, ...data.artistImgs }));
        }

        // ✅ lrcCache fusionné — les paroles déjà en cache localement ont priorité
        if (data.lrcCache) {
          const cur = JSON.parse(localStorage.getItem(LRC_STORE) || '{}');
          localStorage.setItem(LRC_STORE, JSON.stringify({ ...data.lrcCache, ...cur }));
        }
        // Blocklist fusionnée
        if (data.blocklist) {
          const cur = new Set(JSON.parse(localStorage.getItem(BLOCK_STORE) || '[]'));
          (data.blocklist).forEach(f => cur.add(f));
          localStorage.setItem(BLOCK_STORE, JSON.stringify([...cur]));
        }
      }

      _afterImport();
      const modeLabel = mode === 'replace' ? 'remplacement' : 'fusion (stats conservées)';
      toast(`✅ Données importées — mode ${modeLabel}`);

    } catch (err) {
      console.error('[Arya Import]', err);
      toast('⚠️ Fichier invalide ou non reconnu', true);
    }
  };
  input.click();
}


/* ═══════════════════════════════════════════════════════════
   EFFACEMENT TOTAL
═══════════════════════════════════════════════════════════ */

function clearAllData() {
  if (!confirm('⚠️ Effacer TOUTES les données locales (méta, favoris, historique, stats, playlists) ?\n\nAction irréversible.')) return;
  [META_STORE, FAV_STORE, HIST_STORE, STATS_STORE, PLAYLIST_STORE, ARTIST_IMG_STORE, LRC_STORE, BLOCK_STORE, STATS_MONTHLY_STORE]
    .forEach(k => localStorage.removeItem(k));
  // Efface aussi dans Firebase
  if (typeof _uid !== 'undefined' && _uid) {
    firebase.database().ref(`users/${_uid}`).set({
      pseudo,
      favs: [], history: [], stats: {}, playlists: {},
      meta: {}, artistImgs: {}, lrcCache: {}, blocklist: [],
    }).catch(() => {});
  }
  _afterImport();
  toast('🗑 Données effacées');
}


/* ═══════════════════════════════════════════════════════════
   HELPER POST-IMPORT/CLEAR
   Ré-applique et re-rend tout après import ou clear.
═══════════════════════════════════════════════════════════ */

function _afterImport() {
  applyMeta();
  filtered = [...tracks];
  applySort();
  renderSongs();
  renderAlbums();
  renderArtists();
  renderFavorites();
  renderHistory();
  if (typeof renderPlaylists === 'function') renderPlaylists();
  if (typeof BlockList       !== 'undefined') BlockList.refreshUI();
  updateFavBadge();
  // Pousse toutes les données importées vers Firebase
  if (typeof Sync !== 'undefined') Sync.pushAll();
}
