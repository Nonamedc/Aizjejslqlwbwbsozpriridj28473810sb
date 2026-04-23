/* ═══════════════════════════════════════════════════════════
   LYRICS.JS — Arya
   Paroles synchronisées (LRC) et plain text.

   Sources en cascade :
     1. lrclib.net /api/get  (exact match)
     2. lrclib.net /api/search (titre nettoyé)
     3. lrclib.net /api/search (titre original)
     4. lyrics.ovh
     5. Genius (search API + scraping CORS proxy)

   Cache : localStorage[LRC_STORE] — max 250 entrées
   TTL noLyrics : 7 jours

   Dépend de : config.js, utils.js, covers.js (_normTitle,
               _normArtist via covers.js), audio-engine.js
═══════════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════════
   HELPERS NORMALISATION
   Réutilise les fonctions de covers.js si disponibles,
   sinon définit une version locale légère.
═══════════════════════════════════════════════════════════ */

const _normTitle = typeof _normTitle === 'function'
  ? _normTitle
  : s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const _normArtist = typeof _normArtist === 'function'
  ? _normArtist
  : s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s*[\(\[](feat|ft|with|avec)\.?\s[^\)\]]+[\)\]]/gi, '').trim();


/* ═══════════════════════════════════════════════════════════
   PROXIES CORS — partagés entre fetchAndShowLrc et loadGeniusUrl
═══════════════════════════════════════════════════════════ */

const _GENIUS_PROXIES = [
  u => 'https://corsproxy.io/?' + encodeURIComponent(u),
  u => 'https://api.allorigins.win/get?url=' + encodeURIComponent(u),
  u => 'https://corsproxy.io/?url=' + encodeURIComponent(u),
  u => 'https://thingproxy.freeboard.io/fetch/' + u,
];


/* ═══════════════════════════════════════════════════════════
   CACHE LRC
═══════════════════════════════════════════════════════════ */

const _LRC_TTL_NO_LYRICS = 7 * 24 * 3_600_000; // 7 jours en ms
const _LRC_MAX_ENTRIES   = 250;

function _getLrcCache() {
  try { return JSON.parse(localStorage.getItem(LRC_STORE) || '{}'); }
  catch { return {}; }
}

function _saveLrcCache(c) {
  const keys = Object.keys(c);
  // Éviction FIFO : garde les 250 dernières entrées
  if (keys.length > _LRC_MAX_ENTRIES) {
    keys.slice(0, keys.length - _LRC_MAX_ENTRIES).forEach(k => delete c[k]);
  }
  localStorage.setItem(LRC_STORE, JSON.stringify(c));
}

function _lrcKey(t) {
  return (String(t.artist || '') + '|' + String(t.title || '')).toLowerCase().trim();
}


/* ═══════════════════════════════════════════════════════════
   FETCH & AFFICHAGE
═══════════════════════════════════════════════════════════ */

async function fetchAndShowLrc(t) {
  _lrcLines = []; _lrcPlain = ''; _lrcActiveIdx = -1;
  _renderLrcPanel(true);

  const key   = _lrcKey(t);
  const cache = _getLrcCache();

  // Lecture cache
  if (cache[key]) {
    const c = cache[key];
    if (c.noLyrics) {
      if (!c.ts || Date.now() - c.ts < _LRC_TTL_NO_LYRICS) {
        _renderLrcPanel();
        return;
      }
      // TTL expiré → on réessaie
      delete cache[key];
      _saveLrcCache(cache);
    } else {
      _lrcLines = c.lines || [];
      _lrcPlain = c.plain || '';
      _renderLrcPanel();
      if (_lyricsOpen) { _lrcActiveIdx = -1; updateLrcHighlight(_activeAudio().currentTime); }
      return;
    }
  }

  // Titre nettoyé pour une meilleure correspondance
  const cleanTitle = (t.title || '')
    .replace(/\s*[\(\[](feat|ft|with|avec|prod|version|remix|edit|instrumental|remaster|live)\.?\s[^\)\]]+[\)\]]/gi, '')
    .replace(/\s*[\(\[][^\)\]]*[\)\]]\s*$/g, '')
    .trim() || (t.title || '');

  let lines = [], plain = '';

  // ── 1 : lrclib /api/get — exact match ──
  try {
    const p = new URLSearchParams({ artist_name: t.artist || '', track_name: t.title || '' });
    if (t.album && t.album !== 'Sans album') p.set('album_name', t.album);
    const res = await fetch('https://lrclib.net/api/get?' + p, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const data = await res.json();
      if (data.instrumental) {
        _lrcPlain = '🎹 Instrumental';
      } else {
        lines = data.syncedLyrics ? _parseLrc(data.syncedLyrics) : [];
        plain = data.plainLyrics || '';
      }
    }
  } catch (e) { console.warn('[Arya LRC] lrclib get:', e.message); }

  // ── 2 : lrclib /api/search — titre nettoyé ──
  if (!lines.length && !plain && !_lrcPlain) {
    try {
      const q   = encodeURIComponent((t.artist || '') + ' ' + cleanTitle);
      const res = await fetch('https://lrclib.net/api/search?q=' + q, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const arr = await res.json();
        if (Array.isArray(arr) && arr.length) {
          const normCT = _normTitle(cleanTitle);
          const hit = arr.find(x => _normTitle(x.trackName || '') === normCT)
                   || arr.find(x => _normTitle(x.trackName || '').includes(normCT) || normCT.includes(_normTitle(x.trackName || '')))
                   || arr[0];
          if (hit) {
            if (hit.instrumental) { _lrcPlain = '🎹 Instrumental'; }
            else { lines = hit.syncedLyrics ? _parseLrc(hit.syncedLyrics) : []; plain = hit.plainLyrics || ''; }
          }
        }
      }
    } catch (e) { console.warn('[Arya LRC] lrclib search:', e.message); }
  }

  // ── 3 : lrclib /api/search — titre original ──
  if (!lines.length && !plain && !_lrcPlain && cleanTitle !== t.title) {
    try {
      const q   = encodeURIComponent((t.artist || '') + ' ' + (t.title || ''));
      const res = await fetch('https://lrclib.net/api/search?q=' + q, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const arr = await res.json();
        const hit = Array.isArray(arr) && arr[0];
        if (hit && !hit.instrumental) {
          lines = hit.syncedLyrics ? _parseLrc(hit.syncedLyrics) : [];
          plain = hit.plainLyrics || '';
        }
      }
    } catch {}
  }

  // ── 4 : lyrics.ovh ──
  if (!lines.length && !plain && !_lrcPlain) {
    try {
      const res = await fetch(
        `https://api.lyrics.ovh/v1/${encodeURIComponent(t.artist || '')}/${encodeURIComponent(cleanTitle)}`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (res.ok) {
        const d = await res.json();
        if (d.lyrics?.trim()) plain = d.lyrics.trim();
      }
    } catch (e) { console.warn('[Arya LRC] lyrics.ovh:', e.message); }
  }

  // ── 5 : Genius (search API + scraping CORS proxy) ──
  if (!lines.length && !plain && !_lrcPlain) {
    try {
      const gq  = encodeURIComponent((t.artist || '') + ' ' + cleanTitle);
      const res = await fetch(
        `https://genius.com/api/search/song?q=${gq}&per_page=5`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (res.ok) {
        const gData = await res.json();
        const hits  = gData?.response?.sections?.[0]?.hits || [];
        if (hits.length) {
          const normA = _normArtist(t.artist || '');
          const normT = _normTitle(cleanTitle);
          const hit = hits.find(h => {
            const hA = _normArtist(h.result?.primary_artist?.name || '');
            const hT = _normTitle(h.result?.title || '');
            return hA === normA && (hT === normT || hT.includes(normT) || normT.includes(hT));
          }) || hits.find(h => _normArtist(h.result?.primary_artist?.name || '').includes(normA))
            || hits[0];

          if (hit?.result?.path) {
            plain = await _scrapeGenius('https://genius.com' + hit.result.path);
          }
        }
      }
    } catch (e) { console.warn('[Arya LRC] genius:', e.message); }
  }

  if (!lines.length && !plain && !_lrcPlain) {
    cache[key] = { noLyrics: true, ts: Date.now() };
    _saveLrcCache(cache);
    _renderLrcPanel();
    return;
  }

  cache[key] = { lines, plain };
  _saveLrcCache(cache);

  _lrcLines = lines;
  _lrcPlain = plain || _lrcPlain;
  _renderLrcPanel();
  if (_lyricsOpen) { _lrcActiveIdx = -1; updateLrcHighlight(_activeAudio().currentTime); }
}

/** Scrape les paroles d'une page Genius via CORS proxies. */
async function _scrapeGenius(url) {
  for (const mkUrl of _GENIUS_PROXIES) {
    try {
      const res = await fetch(mkUrl(url), { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) continue;
      const raw  = await res.text();
      let html;
      try { const j = JSON.parse(raw); html = j.contents || raw; } catch { html = raw; }
      if (!html?.includes('data-lyrics-container')) continue;

      const doc        = new DOMParser().parseFromString(html, 'text/html');
      const containers = doc.querySelectorAll('[data-lyrics-container="true"]');
      if (!containers.length) continue;

      let lyr = '';
      containers.forEach(c => {
        c.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
        lyr += c.textContent.trim() + '\n\n';
      });
      lyr = lyr.trim();
      if (lyr.length > 50) return lyr;
    } catch {}
  }
  return '';
}


/* ═══════════════════════════════════════════════════════════
   PARSING LRC
═══════════════════════════════════════════════════════════ */

function _parseLrc(text) {
  const lines = [];
  const re    = /\[(\d{1,2}):(\d{2})\.(\d{2,3})\](.*)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const time = parseInt(m[1]) * 60
               + parseInt(m[2])
               + (m[3].length === 2 ? parseInt(m[3]) / 100 : parseInt(m[3]) / 1000);
    const txt  = m[4].trim();
    if (txt) lines.push({ time, text: txt });
  }
  return lines.sort((a, b) => a.time - b.time);
}


/* ═══════════════════════════════════════════════════════════
   RENDU PANEL
═══════════════════════════════════════════════════════════ */

function _renderLrcPanel(loading = false) {
  const panel = document.getElementById('fsLyricsPanel');
  if (!panel) return;

  const closeBtn   = `<button class="lrc-close-btn" onclick="toggleLyricsPanel()" title="Fermer les paroles">✕</button>`;
  const refreshBtn = `<button class="lrc-refresh-btn" id="lrcRefreshBtn" onclick="refreshLrc()" title="Rafraîchir les paroles">↺ Rafraîchir</button>`;

  if (loading) {
    panel.innerHTML = closeBtn + '<div class="lrc-loading">♪ Recherche des paroles…</div>';
    return;
  }

  if (_lrcLines.length) {
    panel.innerHTML = closeBtn
      + _lrcLines.map((l, i) =>
          `<div class="lrc-line" id="lrc-${i}" onclick="fsSeekToLrc(${i})">${esc(l.text)}</div>`
        ).join('')
      + refreshBtn;
    return;
  }

  if (_lrcPlain) {
    panel.innerHTML = closeBtn + `<div class="lrc-plain">${esc(_lrcPlain)}</div>` + refreshBtn;
    return;
  }

  panel.innerHTML = closeBtn
    + '<div class="lrc-empty">Paroles introuvables pour ce titre'
    + '<br><span style="font-size:11px;color:var(--text3);">Sources : LRCLIB · Lyrics.ovh · Genius</span>'
    + '<div class="lrc-genius-row">'
    +   '<input class="lrc-genius-input" id="lrcGeniusInput" placeholder="Coller un lien Genius…"'
    +   ' onkeydown="if(event.key===\'Enter\')loadGeniusUrl()"/>'
    +   '<button class="lrc-genius-btn" id="lrcGeniusBtn" onclick="loadGeniusUrl()">▶</button>'
    + '</div></div>'
    + refreshBtn;
}


/* ═══════════════════════════════════════════════════════════
   MISE À JOUR DU SURLIGNAGE LRC
═══════════════════════════════════════════════════════════ */

function updateLrcHighlight(cur) {
  if (!_lrcLines.length) return;
  const panel = document.getElementById('fsLyricsPanel');
  if (!panel) return;

  let idx = -1;
  for (let i = 0; i < _lrcLines.length; i++) {
    if (_lrcLines[i].time <= cur) idx = i;
    else break;
  }

  if (idx === _lrcActiveIdx) return;
  _lrcActiveIdx = idx;

  panel.querySelectorAll('.lrc-line').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
    el.classList.toggle('near',   i === idx + 1 || i === idx - 1);
  });

  if (idx >= 0) {
    document.getElementById('lrc-' + idx)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}


/* ═══════════════════════════════════════════════════════════
   CONTRÔLES
═══════════════════════════════════════════════════════════ */

function toggleLyricsPanel() {
  _lyricsOpen = !_lyricsOpen;
  document.getElementById('fsLyricsPanel')?.classList.toggle('open', _lyricsOpen);
  document.getElementById('fsLyricsBtn')?.classList.toggle('on', _lyricsOpen);
  if (_lyricsOpen) {
    _lrcActiveIdx = -1;
    updateLrcHighlight(_activeAudio().currentTime);
  }
}

function fsSeekToLrc(idx) {
  if (!_lrcLines[idx]) return;
  const aa = _activeAudio();
  if (aa) aa.currentTime = _lrcLines[idx].time;
}

async function refreshLrc() {
  if (currentId === null) return;
  const t = tracks.find(x => x.id === currentId);
  if (!t) return;

  const btn = document.getElementById('lrcRefreshBtn');
  if (btn) { btn.classList.add('spinning'); btn.style.pointerEvents = 'none'; }

  const key   = _lrcKey(t);
  const cache = _getLrcCache();
  delete cache[key];
  _saveLrcCache(cache);

  await fetchAndShowLrc(t);

  if (btn) { btn.classList.remove('spinning'); btn.style.pointerEvents = ''; }
  toast('↺ Paroles rechargées');
}


/* ═══════════════════════════════════════════════════════════
   GENIUS URL DIRECT
═══════════════════════════════════════════════════════════ */

async function loadGeniusUrl() {
  const input = document.getElementById('lrcGeniusInput');
  const btn   = document.getElementById('lrcGeniusBtn');
  if (!input) return;

  const url = input.value.trim();
  if (!url.includes('genius.com')) { toast('⚠️ URL Genius invalide', true); return; }

  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  _renderLrcPanel(true);

  const plain = await _scrapeGenius(url);

  if (plain) {
    if (currentId !== null) {
      const t = tracks.find(x => x.id === currentId);
      if (t) {
        const key   = _lrcKey(t);
        const cache = _getLrcCache();
        cache[key]  = { lines: [], plain, ts: Date.now() };
        _saveLrcCache(cache);
      }
    }
    _lrcPlain = plain;
    _renderLrcPanel();
    toast('✅ Paroles Genius chargées');
  } else {
    toast('⚠️ Impossible de lire la page Genius', true);
    _renderLrcPanel();
  }

  if (btn) { btn.disabled = false; btn.textContent = '▶'; }
}
