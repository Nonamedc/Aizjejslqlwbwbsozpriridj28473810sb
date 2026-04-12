/* ══════════════════════════════════════════════
   ENRICHISSEMENT MANUEL — lancé depuis la vue Données
══════════════════════════════════════════════ */
let _enrichStopped = false;

function launchEnrichmentFromData(){
  if(_enrichRunning){ toast('⟳ Enrichissement déjà en cours', true); return; }
  _enrichStopped = false;
  _updateEnrichDataUI('running');
  startEnrichment().then(() => {
    if(!_enrichStopped) _updateEnrichDataUI('done');
  });
}

function stopEnrichment(){
  _enrichStopped = true;
  _enrichQueue = [];   // vide la queue → les workers s'arrêtent naturellement
  _enrichRunning = false;
  updateEnrichBadge();
  _updateEnrichDataUI('stopped');
  toast('⏹ Enrichissement arrêté');
}

function _updateEnrichDataUI(state){
  const statusEl  = document.getElementById('enrichStatusText');
  const startBtn  = document.getElementById('enrichStartBtn');
  const stopBtn   = document.getElementById('enrichStopBtn');
  if(!statusEl) return;
  if(state === 'running'){
    statusEl.textContent = 'Statut : en cours… (' + (_enrichTotal||'?') + ' pistes à traiter)';
    statusEl.style.color = 'var(--accent)';
    if(startBtn) startBtn.style.display = 'none';
    if(stopBtn)  stopBtn.style.display  = '';
  } else if(state === 'done'){
    statusEl.textContent = 'Statut : terminé ✅ — toutes les pistes ont été traitées';
    statusEl.style.color = 'var(--green)';
    if(startBtn){ startBtn.style.display = ''; startBtn.textContent = '↺ Relancer'; }
    if(stopBtn)  stopBtn.style.display  = 'none';
  } else if(state === 'stopped'){
    statusEl.textContent = 'Statut : arrêté manuellement';
    statusEl.style.color = 'var(--rose)';
    if(startBtn){ startBtn.style.display = ''; startBtn.textContent = '🚀 Reprendre'; }
    if(stopBtn)  stopBtn.style.display  = 'none';
  }
}


/* ══════════════════════════════════════════════
   APPLY META — réapplique les métadonnées sauvegardées
   aux objets track en mémoire (utilisé après import/clear)
══════════════════════════════════════════════ */
function applyMeta(){
  const meta = getMeta();
  tracks.forEach(t => {
    const s = meta[t.filename];
    if(!s) return;
    if(s.title)     t.title     = s.title;
    if(s.artist)    t.artist    = s.artist;
    if(s.album)     t.album     = s.album;
    if(s.year)      t.year      = s.year;
    if(s.genre)     t.genre     = s.genre;
    if(s.cover)     {} // géré via getCover()
    if(s.deezerUrl) t.deezerUrl = s.deezerUrl;
    else            delete t.deezerUrl;
  });
  filtered = [...tracks];
}

/* ══════════════════════════════════════════════
   IMPORT / EXPORT DE DONNÉES
══════════════════════════════════════════════ */
function exportData(){
  const data = {
    version: 1,
    exported: new Date().toISOString(),
    appName: 'Arya',
    meta:        JSON.parse(localStorage.getItem(META_STORE)        || '{}'),
    favs:        JSON.parse(localStorage.getItem(FAV_STORE)         || '[]'),
    history:     JSON.parse(localStorage.getItem(HIST_STORE)        || '[]'),
    stats:       JSON.parse(localStorage.getItem(STATS_STORE)       || '{}'),
    playlists:   JSON.parse(localStorage.getItem(PLAYLIST_STORE)    || '{}'),
    artistImgs:  JSON.parse(localStorage.getItem(ARTIST_IMG_STORE)  || '{}'),
    lrcCache:    JSON.parse(localStorage.getItem(LRC_STORE)          || '{}'),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'arya-export-' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
  toast('✅ Export téléchargé');
}

function importData(mode){
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    try{
      const text = await file.text();
      const data = JSON.parse(text);
      if(!data.version || data.appName !== 'Arya') throw new Error('Format invalide');

      if(mode === 'replace'){
        if(!confirm('⚠️ Remplacer TOUTES vos données locales par cet export ? Action irréversible.')) return;
        localStorage.setItem(META_STORE,       JSON.stringify(data.meta       || {}));
        localStorage.setItem(FAV_STORE,        JSON.stringify(data.favs       || []));
        localStorage.setItem(HIST_STORE,       JSON.stringify(data.history    || []));
        localStorage.setItem(STATS_STORE,      JSON.stringify(data.stats      || {}));
        localStorage.setItem(PLAYLIST_STORE,   JSON.stringify(data.playlists  || {}));
        if(data.artistImgs) localStorage.setItem(ARTIST_IMG_STORE, JSON.stringify(data.artistImgs));
      } else {
        // Merge
        if(data.meta){
          const cur = JSON.parse(localStorage.getItem(META_STORE)||'{}');
          localStorage.setItem(META_STORE, JSON.stringify({...cur, ...data.meta}));
        }
        if(data.favs){
          const cur = new Set(JSON.parse(localStorage.getItem(FAV_STORE)||'[]'));
          (data.favs||[]).forEach(f => cur.add(f));
          localStorage.setItem(FAV_STORE, JSON.stringify([...cur]));
        }
        if(data.history){
          const cur = JSON.parse(localStorage.getItem(HIST_STORE)||'[]');
          const merged = [...(data.history||[]), ...cur];
          const seen = new Set();
          const deduped = merged.filter(h => { const k = h.filename + h.ts; if(seen.has(k)) return false; seen.add(k); return true; });
          localStorage.setItem(HIST_STORE, JSON.stringify(deduped.slice(0, MAX_HIST)));
        }
        if(data.stats){
          const cur = JSON.parse(localStorage.getItem(STATS_STORE)||'{}');
          const merged = {...cur};
          Object.entries(data.stats||{}).forEach(([k, v]) => {
            if(merged[k]){ merged[k].plays = (merged[k].plays||0)+(v.plays||0); merged[k].seconds = (merged[k].seconds||0)+(v.seconds||0); }
            else { merged[k] = v; }
          });
          localStorage.setItem(STATS_STORE, JSON.stringify(merged));
        }
        if(data.playlists){
          const cur = JSON.parse(localStorage.getItem(PLAYLIST_STORE)||'{}');
          localStorage.setItem(PLAYLIST_STORE, JSON.stringify({...cur, ...data.playlists}));
        }
        if(data.artistImgs){
          const cur = JSON.parse(localStorage.getItem(ARTIST_IMG_STORE)||'{}');
          localStorage.setItem(ARTIST_IMG_STORE, JSON.stringify({...cur, ...data.artistImgs}));
        }
      }

      applyMeta();
      filtered = [...tracks];
      applySort();
      renderSongs();
      renderAlbums();
      renderArtists();
      renderFavorites();
      renderHistory();
      renderPlaylists();
      updateFavBadge();
      toast('✅ Données importées avec succès');
    }catch(err){
      console.error('[Arya import]', err);
      toast('⚠️ Fichier invalide ou non reconnu', true);
    }
  };
  input.click();
}

function clearAllData(){
  if(!confirm('⚠️ Effacer TOUTES les données locales (méta, favoris, historique, stats, playlists) ?\n\nAction irréversible.')) return;
  [META_STORE, FAV_STORE, HIST_STORE, STATS_STORE, PLAYLIST_STORE, ARTIST_IMG_STORE, LRC_STORE].forEach(k => localStorage.removeItem(k));
  filtered = [...tracks];
  applyMeta();
  applySort();
  renderSongs();
  renderAlbums();
  renderArtists();
  renderFavorites();
  renderHistory();
  renderPlaylists();
  updateFavBadge();
  toast('🗑 Données effacées');
}
