/* ═══════════════════════════════════════════════════════════
   OFFLINE.JS — Arya
   Vue "Hors ligne" : affiche les pistes disponibles en cache.

   Fonctionne de deux façons :
   1. Via CacheManager.listCached() si disponible (cache.js)
   2. Sinon via l'API Cache Storage native du navigateur
      en croisant les URLs avec les pistes connues (tracks[])
═══════════════════════════════════════════════════════════ */

/* ── État ──────────────────────────────────────────────── */
let _offlineTracks    = [];   // pistes trouvées en cache
let _offlineRendered  = false;

/* ══════════════════════════════════════════════════════════
   DÉTECTION DES PISTES EN CACHE
══════════════════════════════════════════════════════════ */

/**
 * Retourne la liste des pistes disponibles hors ligne.
 * Essaie CacheManager d'abord, puis Cache Storage natif.
 */
async function getOfflineTracks() {

  /* ── 1. CacheManager (IndexedDB) — source principale ── */
  if (typeof CacheManager !== 'undefined' && CacheManager.isEnabled()) {
    try {
      const cachedFilenames = typeof CacheManager.listCached === 'function'
        ? CacheManager.listCached()   // synchrone — retourne directement le Set converti
        : [];

      if (cachedFilenames.length > 0) {
        const filenameSet = new Set(cachedFilenames);
        return (typeof tracks !== 'undefined' ? tracks : [])
          .filter(t => t.filename && filenameSet.has(t.filename));
      }
    } catch (e) {
      if (window.Arya?.log) Arya.log.warn('cache', 'getOfflineTracks CacheManager error', e);
    }
  }

  /* ── 2. Fallback : Cache Storage natif (SW cache) ───── */
  if (!('caches' in window)) return [];

  try {
    const cacheNames = await caches.keys();
    if (!cacheNames.length) return [];

    const allCachedUrls = new Set();
    for (const name of cacheNames) {
      const cache    = await caches.open(name);
      const requests = await cache.keys();
      requests.forEach(req => allCachedUrls.add(req.url));
    }

    return (typeof tracks !== 'undefined' ? tracks : []).filter(t => {
      const url = t.deezerUrl || t.url;
      if (!url) return false;
      const filename = url.split('/').pop().split('?')[0];
      for (const cachedUrl of allCachedUrls) {
        if (cachedUrl === url || cachedUrl.includes(filename)) return true;
      }
      return false;
    });
  } catch (e) {
    if (window.Arya?.log) Arya.log.warn('cache', 'getOfflineTracks Cache API error', e);
    return [];
  }
}

/* ══════════════════════════════════════════════════════════
   RENDU DE LA VUE
══════════════════════════════════════════════════════════ */

async function renderOffline() {
  const list      = document.getElementById('offlineList');
  const loading   = document.getElementById('offlineLoading');
  const empty     = document.getElementById('offlineEmpty');
  const count     = document.getElementById('offlineCount');
  const colHeads  = document.getElementById('offlineColHeads');
  const badge     = document.getElementById('offlineBadge');

  if (!list) return;

  // État initial : chargement
  loading.style.display  = 'block';
  empty.style.display    = 'none';
  list.innerHTML         = '';
  if (colHeads) colHeads.style.display = 'none';

  _offlineTracks = await getOfflineTracks();

  loading.style.display = 'none';

  // Mise à jour du badge
  if (badge) {
    if (_offlineTracks.length > 0) {
      badge.textContent     = _offlineTracks.length;
      badge.style.display   = 'inline';
    } else {
      badge.style.display   = 'none';
    }
  }

  if (_offlineTracks.length === 0) {
    empty.style.display = 'block';
    if (count) count.textContent = 'Aucune piste en cache';
    return;
  }

  // Sous-titre
  const totalSec = _offlineTracks.reduce((s, t) => s + (t.duration || 0), 0);
  const totalMin = Math.round(totalSec / 60);
  if (count) {
    count.textContent = `${_offlineTracks.length} titre${_offlineTracks.length > 1 ? 's' : ''}`
      + (totalMin > 0 ? ` · ${totalMin} min` : '');
  }

  if (colHeads) colHeads.style.display = 'grid';

  const favs = typeof getFavs === 'function' ? getFavs() : new Set();

  list.innerHTML = _offlineTracks.map((t, i) => {
    const faved   = favs.has(t.filename);
    const cover   = typeof getCover  === 'function' ? getCover(t.filename)      : null;
    const grad    = typeof gradFor   === 'function' ? gradFor(t.artist + t.album) : '#222';
    const artHtml = cover
      ? `<img src="${esc(cover)}" loading="lazy" onerror="this.parentElement.style.background='${grad}';this.remove();">`
      : '🎵';
    const sub     = t.feat ? `${esc(t.artist)} feat. ${esc(t.feat)}` : esc(t.artist);
    const dur     = typeof fmtTime === 'function' ? fmtTime(t.duration || 0) : '';

    return `
      <div class="track-row${currentId === t.id ? ' playing' : ''}"
           data-id="${t.id}"
           onclick="playOfflineTrack(${i})">

        <div class="tr-num">
          <div class="playing-bars">
            <div class="bar"></div><div class="bar"></div>
            <div class="bar"></div><div class="bar"></div>
          </div>
          <span>${i + 1}</span>
        </div>

        <div class="tr-art" style="${cover ? '' : 'background:' + grad}">
          ${artHtml}
        </div>

        <div class="tr-info">
          <div class="tr-title">${esc(t.title)}</div>
          <div class="tr-artist-s">${sub}</div>
        </div>

        <div class="tr-album">${esc(t.album || '—')}</div>

        <div class="tr-dur">
          <span class="dur-val">${dur}</span>
          <div class="tr-actions">
            <button class="ico-btn fav-btn${faved ? ' active' : ''}"
                    onclick="event.stopPropagation();toggleFavById(${t.id},event)"
                    title="${faved ? 'Retirer des favoris' : 'Ajouter aux favoris'}">
              ${faved ? '♥' : '♡'}
            </button>
            <button class="ico-btn"
                    onclick="event.stopPropagation();addToQueueEnd(${t.id})"
                    title="Ajouter à la file">+</button>
          </div>
        </div>

      </div>`;
  }).join('');

  _offlineRendered = true;
}

/* ══════════════════════════════════════════════════════════
   LECTURE
══════════════════════════════════════════════════════════ */

function playOfflineTrack(idx) {
  if (!_offlineTracks.length) return;
  // Charge la queue offline et joue
  queue    = [..._offlineTracks];
  queueIdx = idx;
  playTrack(_offlineTracks[idx].id);
}

function playAllOffline() {
  if (!_offlineTracks.length) return;
  queue    = [..._offlineTracks];
  queueIdx = 0;
  playTrack(_offlineTracks[0].id);
}

/* ══════════════════════════════════════════════════════════
   MISE À JOUR DU BADGE AU DÉMARRAGE
══════════════════════════════════════════════════════════ */

// Actualise le badge discrètement sans rendre la vue
async function _updateOfflineBadge() {
  if (typeof tracks === 'undefined' || !tracks.length) return;
  const cached = await getOfflineTracks();
  const badge  = document.getElementById('offlineBadge');
  if (!badge) return;
  if (cached.length > 0) {
    badge.textContent   = cached.length;
    badge.style.display = 'inline';
  } else {
    badge.style.display = 'none';
  }
}

// Lance après le chargement des pistes (léger délai pour laisser tracks[] se peupler)
setTimeout(_updateOfflineBadge, 3000);
