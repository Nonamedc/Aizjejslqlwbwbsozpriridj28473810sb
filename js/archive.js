/* ═══════════════════════════════════════════════════════════
   ARCHIVE.JS — Arya V3
   Récupération de la bibliothèque depuis Archive.org
   et parsing des noms de fichiers en métadonnées.

   Dépend de : config.js, utils.js, render.js, library.js
═══════════════════════════════════════════════════════════ */

const AUDIO_EXT = /\.(mp3|flac|ogg|wav|m4a)$/i;
const YEAR_RX   = /[\(\[]((?:19|20)\d{2})[\)\]]/;
const TRACK_RX  = /^(?:track\s*)?(\d{1,3})[\.\-\s]+/i;
const FEAT_RX   = /\s*[\(\[](feat|ft|with|avec)\.?\s[^\)\]]+[\)\]]/i;

const CACHE_KEY = `arya:archive:raw:${ARCHIVE_ID}`;
const CACHE_TTL = 1000 * 60 * 10; // 10 min


/* ═══════════════════════════════════════════════════════════
   NORMALIZE
═══════════════════════════════════════════════════════════ */
function normalize(str) {
  return str
    .normalize('NFKC')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


/* ═══════════════════════════════════════════════════════════
   PARSER
═══════════════════════════════════════════════════════════ */
function parseFilename(fn) {
  let name = normalize(fn.replace(AUDIO_EXT, ''));

  name = name.replace(TRACK_RX, '');

  let title  = name;
  let artist = 'Inconnu';
  let album  = 'Sans album';
  let year   = '';
  let genre  = '';

  const yearMatch = name.match(YEAR_RX);
  if (yearMatch) {
    year = yearMatch[1];
    name = name.replace(yearMatch[0], '').trim();
  }

  const parts = name.split(/\s*-\s*/);

  if (parts.length >= 3) {
    artist = parts[0];
    album  = parts[1];
    title  = parts.slice(2).join(' - ');
  } else if (parts.length === 2) {
    artist = parts[0];
    title  = parts[1];
  } else {
    title = parts[0];
  }

  const featMatch = title.match(FEAT_RX);
  const feat = featMatch
    ? featMatch[0].replace(/^\s*[\(\[](feat|ft|with|avec)\.?\s*/i, '').replace(/[\)\]]\s*$/, '').trim()
    : '';
  title = title.replace(FEAT_RX, '').trim();

  return { title, artist, album, year, genre, feat };
}


/* ═══════════════════════════════════════════════════════════
   CACHE RAW
═══════════════════════════════════════════════════════════ */
function getCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (!c) return null;
    if (Date.now() - c.time > CACHE_TTL) return null;
    return c.data;
  } catch {
    return null;
  }
}

function setCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      time: Date.now(),
      data
    }));
  } catch {}
}


/* ═══════════════════════════════════════════════════════════
   FETCH
═══════════════════════════════════════════════════════════ */
async function fetchArchive() {
  try {
    let data = getCache();

    if (!data) {
      const res = await fetch(`https://archive.org/metadata/${ARCHIVE_ID}`);
      if (!res.ok) throw new Error('HTTP ' + res.status);

      data = await res.json();
      setCache(data);
    }

    const files = (data.files || []).filter(f =>
      AUDIO_EXT.test(f.name) && !f.name.includes('/')
    );

    const meta = getMeta();

    tracks = files.map((f, i) => {
      const saved  = meta[f.name] || {};
      const parsed = parseFilename(f.name); // toujours défini → zéro crash

      return {
        id:       i,
        filename: f.name,
        url:      `https://archive.org/download/${ARCHIVE_ID}/${encodeURIComponent(f.name)}`,
        title:    saved.title  || parsed.title,
        artist:   saved.artist || parsed.artist,
        album:    saved.album  || parsed.album,
        year:     saved.year   || parsed.year,
        genre:    saved.genre  || parsed.genre,
        feat:     saved.feat   !== undefined ? saved.feat : (parsed.feat || ''),
        length:   f.length || 0,
        size:     f.size   || 0,
        ...(saved.deezerUrl && { deezerUrl: saved.deezerUrl })
      };
    });

    afterLoad();

  } catch (e) {
    console.error('[Arya Archive]', e);
    showError(e);
  }
}


/* ═══════════════════════════════════════════════════════════
   POST LOAD
═══════════════════════════════════════════════════════════ */
function afterLoad() {
  filtered = tracks.slice();

  applySort();
  buildQueue?.();
  renderAll();
  updateCounts();
}


/* ═══════════════════════════════════════════════════════════
   ERROR UI
═══════════════════════════════════════════════════════════ */
function showError(e) {
  const isNetwork =
    e instanceof TypeError &&
    e.message &&
    e.message.toLowerCase().includes('fetch');

  const el = document.getElementById('trackList');
  if (!el) return;

  el.innerHTML = `
    <div style="color:var(--text2);padding:48px;text-align:center;">
      ${isNetwork
        ? '📡 Connexion impossible'
        : '❌ ' + esc(e.message)}
    </div>
  `;

  toast(isNetwork ? 'Connexion impossible' : 'Erreur chargement', true);
}


/* ═══════════════════════════════════════════════════════════
   COUNTS
═══════════════════════════════════════════════════════════ */
function updateCounts() {
  const s = tracks.length;
  const a = getAlbums().length;
  const r = getArtists().length;

  const set = (id, val, label) => {
    const el = document.getElementById(id);
    if (el) el.textContent = `${val} ${label}${val > 1 ? 's' : ''}`;
  };

  set('songCount',   s, 'chanson');
  set('albumCount',  a, 'album');
  set('artistCount', r, 'artiste');

  updateFavBadge();
}


/* ═══════════════════════════════════════════════════════════
   APPLY META
   Applique les métadonnées sauvegardées sur les pistes
   en mémoire. Appelé après fetchArchive() et import.
═══════════════════════════════════════════════════════════ */

function applyMeta() {
  const meta = getMeta();
  tracks.forEach(t => {
    const s = meta[t.filename];
    if (!s) return;
    if (s.title)            t.title     = s.title;
    if (s.artist)           t.artist    = s.artist;
    if (s.album)            t.album     = s.album;
    if (s.year)             t.year      = s.year;
    if (s.genre)            t.genre     = s.genre;
    if (s.feat  !== undefined) t.feat   = s.feat;
    if (s.deezerUrl) t.deezerUrl = s.deezerUrl;
    else             delete t.deezerUrl;
  });
  filtered = [...tracks];
}
