/* ═══════════════════════════════════════════════════════════
   SEARCH.JS — Arya V2
   Panel de suggestions live sous la barre de recherche.

   Dépend de : config.js, utils.js, render.js, covers.js
     (onSearch, _normSearch, getArtists, getAlbums,
      esc, escAttr, gradFor, getCover, getArtistImg,
      fmtTime, showDetail, showViewRaw, playTrack)
═══════════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════════════════ */

(function _injectSugStyles() {
  if (document.getElementById('sug-styles')) return;
  const s = document.createElement('style');
  s.id = 'sug-styles';
  s.textContent = `
    #sugPanel {
      display: none;
      position: fixed;
      z-index: 1300;
      background: var(--surface2, #1e1e2e);
      border: 1px solid rgba(255,255,255,.09);
      border-radius: 16px;
      padding: 6px;
      min-width: 280px;
      max-width: min(94vw, 460px);
      max-height: 72vh;
      overflow-y: auto;
      overflow-x: hidden;
      box-shadow: 0 24px 64px rgba(0,0,0,.75);
      opacity: 0;
      transform: translateY(-6px) scale(.98);
      transition: opacity .14s ease, transform .14s ease;
      pointer-events: none;
    }
    #sugPanel.open {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }

    .sug-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: var(--text3, #555);
      padding: 8px 12px 3px;
      pointer-events: none;
      user-select: none;
    }

    .sug-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 10px;
      cursor: pointer;
      transition: background .1s;
      -webkit-tap-highlight-color: transparent;
    }
    .sug-item:hover,
    .sug-item.sug-focused { background: rgba(255,255,255,.07); }
    .sug-item:active       { background: rgba(255,255,255,.11); }

    .sug-art {
      width: 38px; height: 38px;
      border-radius: 8px;
      flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; overflow: hidden;
    }
    .sug-art.sug-round { border-radius: 50%; }
    .sug-art img { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }

    .sug-info  { flex: 1; min-width: 0; }
    .sug-title {
      font-size: 13px; font-weight: 600;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .sug-sub {
      font-size: 11.5px; color: var(--text2, #888); margin-top: 1px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    .sug-badge {
      font-size: 10.5px; color: var(--text3, #555);
      background: rgba(255,255,255,.06);
      border-radius: 6px; padding: 2px 7px;
      flex-shrink: 0; white-space: nowrap;
    }

    .sug-sep { height: 1px; background: rgba(255,255,255,.07); margin: 4px 8px; }

    .sug-all {
      display: block; width: 100%; text-align: center;
      background: transparent; border: none;
      color: var(--accent, #a78bfa);
      font-size: 12.5px; padding: 10px 12px;
      border-radius: 9px; cursor: pointer;
      transition: background .1s;
      -webkit-tap-highlight-color: transparent;
    }
    .sug-all:hover,
    .sug-all.sug-focused { background: rgba(255,255,255,.06); }

    .sug-empty {
      color: var(--text3, #555);
      text-align: center;
      padding: 22px 16px;
      font-size: 13px;
    }

    .sug-hl { color: var(--accent, #a78bfa); font-weight: 700; }
  `;
  document.head.appendChild(s);
})();


/* ═══════════════════════════════════════════════════════════
   DOM
═══════════════════════════════════════════════════════════ */

(function _injectSugDom() {
  if (document.getElementById('sugPanel')) return;
  document.body.insertAdjacentHTML('beforeend',
    '<div id="sugPanel" role="listbox" aria-label="Suggestions de recherche"></div>'
  );
})();


/* ═══════════════════════════════════════════════════════════
   ÉTAT
═══════════════════════════════════════════════════════════ */

let _sugOpen      = false;
let _sugFocusIdx  = -1;
let _sugFocusList = [];
let _sugDebTimer  = null;
let _sugTouching  = false; // empêche le blur de fermer le panel pendant un tap


/* ═══════════════════════════════════════════════════════════
   ENTRÉE PUBLIQUE
═══════════════════════════════════════════════════════════ */

/** Appelé sur oninput du champ de recherche. */
function onSearchInput() {
  onSearch(); // filtre immédiat
  clearTimeout(_sugDebTimer);
  _sugDebTimer = setTimeout(_buildSuggestions, 130);
}


/* ═══════════════════════════════════════════════════════════
   CONSTRUCTION DES SUGGESTIONS
═══════════════════════════════════════════════════════════ */

function _buildSuggestions() {
  const input = document.getElementById('searchInput');
  if (!input) return;
  const raw    = input.value.trim();
  const q      = _normSearch(raw);
  if (!q) { _closeSug(); return; }

  const tokens     = q.split(/\s+/).filter(Boolean);
  const matchTrack = t => tokens.every(tok =>
    [t.title, t.artist, t.album, t.genre, String(t.year || '')].some(f => _normSearch(f).includes(tok))
  );
  const matchStr = str => tokens.every(tok => _normSearch(str).includes(tok));

  const songHits   = tracks.filter(matchTrack);
  const songSlice  = songHits.slice(0, 5);
  const artistHits = getArtists().filter(a => matchStr(a.name)).slice(0, 3);
  const albumHits  = getAlbums().filter(a => matchStr(a.name) || matchStr(a.artist)).slice(0, 3);
  const total      = songHits.length;

  if (!total && !artistHits.length && !albumHits.length) {
    _openSug(`<div class="sug-empty">Aucun résultat pour <b>${esc(raw)}</b></div>`);
    return;
  }

  let html = '';

  // Chansons
  if (songSlice.length) {
    html += '<div class="sug-label">🎵 Chansons</div>';
    html += songSlice.map(t => {
      const cover = getCover(t.filename);
      const grad  = gradFor(t.artist + t.album);
      return `<div class="sug-item" role="option" onclick="_sugPlay(${t.id})">
        <div class="sug-art" style="${cover ? '' : `background:${grad}`}">
          ${cover ? `<img src="${esc(cover)}" onerror="this.parentElement.style.background='${grad}';this.remove();">` : '🎵'}
        </div>
        <div class="sug-info">
          <div class="sug-title">${_hlMatch(t.title, tokens)}</div>
          <div class="sug-sub">${esc(t.artist)} · ${esc(t.album)}</div>
        </div>
        <span class="sug-badge">${fmtTime(t.length)}</span>
      </div>`;
    }).join('');
  }

  // Artistes
  if (artistHits.length) {
    if (songSlice.length) html += '<div class="sug-sep"></div>';
    html += '<div class="sug-label">🎤 Artistes</div>';
    html += artistHits.map(a => {
      const img  = getArtistImg(a.name);
      const grad = gradFor(a.name);
      const albs = a.albums.size;
      return `<div class="sug-item" role="option" onclick="_sugArtist('${escAttr(a.name)}')">
        <div class="sug-art sug-round" style="${img ? '' : `background:${grad}`}">
          ${img ? `<img src="${esc(img)}" onerror="this.parentElement.style.background='${grad}';this.remove();">` : '🎤'}
        </div>
        <div class="sug-info">
          <div class="sug-title">${_hlMatch(a.name, tokens)}</div>
          <div class="sug-sub">${albs} album${albs > 1 ? 's' : ''} · ${a.tracks.length} titre${a.tracks.length > 1 ? 's' : ''}</div>
        </div>
        <span class="sug-badge">Artiste</span>
      </div>`;
    }).join('');
  }

  // Albums
  if (albumHits.length) {
    if (songSlice.length || artistHits.length) html += '<div class="sug-sep"></div>';
    html += '<div class="sug-label">💿 Albums</div>';
    html += albumHits.map(a => {
      const cover = a.tracks[0] ? getCover(a.tracks[0].filename) : null;
      const grad  = gradFor(a.name);
      return `<div class="sug-item" role="option" onclick="_sugAlbum('${escAttr(a.name)}')">
        <div class="sug-art" style="${cover ? '' : `background:${grad}`}">
          ${cover ? `<img src="${esc(cover)}" onerror="this.parentElement.style.background='${grad}';this.remove();">` : '💿'}
        </div>
        <div class="sug-info">
          <div class="sug-title">${_hlMatch(a.name, tokens)}</div>
          <div class="sug-sub">${esc(a.artist)} · ${a.count} titre${a.count > 1 ? 's' : ''}</div>
        </div>
        <span class="sug-badge">Album</span>
      </div>`;
    }).join('');
  }

  // Bouton "Voir tout"
  if (total > 0) {
    html += '<div class="sug-sep"></div>';
    html += `<button class="sug-all" onclick="_sugAll()">${
      total > 5
        ? `Voir les ${total} résultats →`
        : `${total} résultat${total > 1 ? 's' : ''} · Afficher la liste →`
    }</button>`;
  }

  _openSug(html);
}

/**
 * Met en surbrillance les tokens trouvés dans une chaîne.
 * Opère sur le texte échappé pour éviter les injections HTML.
 */
function _hlMatch(str, tokens) {
  let safe = esc(str);
  tokens.forEach(tok => {
    if (!tok) return;
    try {
      const re = new RegExp('(' + tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      safe = safe.replace(re, '<span class="sug-hl">$1</span>');
    } catch {} // regex invalide — ignorer
  });
  return safe;
}


/* ═══════════════════════════════════════════════════════════
   PANEL — OUVERTURE / FERMETURE / POSITION
═══════════════════════════════════════════════════════════ */

function _openSug(html) {
  const panel = document.getElementById('sugPanel');
  panel.innerHTML = html;
  _positionSug();
  panel.style.display = 'block';
  requestAnimationFrame(() => panel.classList.add('open'));
  _sugOpen      = true;
  _sugFocusList = [...panel.querySelectorAll('.sug-item, .sug-all')];
  _sugFocusIdx  = -1;
}

function _closeSug() {
  const panel = document.getElementById('sugPanel');
  if (!panel) return;
  panel.classList.remove('open');
  setTimeout(() => {
    if (!panel.classList.contains('open')) panel.style.display = 'none';
  }, 150);
  _sugOpen      = false;
  _sugFocusIdx  = -1;
  _sugFocusList = [];
}

function _positionSug() {
  const input = document.getElementById('searchInput');
  const panel = document.getElementById('sugPanel');
  if (!input || !panel) return;
  const rect = input.getBoundingClientRect();
  panel.style.top   = (rect.bottom + 6) + 'px';
  panel.style.left  = rect.left + 'px';
  panel.style.width = Math.max(rect.width, 280) + 'px';
}


/* ═══════════════════════════════════════════════════════════
   ACTIONS
═══════════════════════════════════════════════════════════ */

function _sugPlay(id) {
  _closeSug();
  document.getElementById('searchInput').blur();
  playTrack(id);
}

function _sugArtist(name) {
  _closeSug();
  document.getElementById('searchInput').value = '';
  onSearch();
  showDetail('artist', name);
}

function _sugAlbum(name) {
  _closeSug();
  document.getElementById('searchInput').value = '';
  onSearch();
  showDetail('album', name);
}

function _sugAll() {
  _closeSug();
  showViewRaw('songs');
  onSearch();
}


/* ═══════════════════════════════════════════════════════════
   NAVIGATION CLAVIER
═══════════════════════════════════════════════════════════ */

function _sugMoveFocus(delta) {
  if (!_sugFocusList.length) return;
  if (_sugFocusIdx >= 0) _sugFocusList[_sugFocusIdx].classList.remove('sug-focused');
  _sugFocusIdx = Math.max(0, Math.min(_sugFocusList.length - 1, _sugFocusIdx + delta));
  _sugFocusList[_sugFocusIdx].classList.add('sug-focused');
  _sugFocusList[_sugFocusIdx].scrollIntoView({ block: 'nearest' });
}

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('searchInput');
  if (!input) return;

  input.addEventListener('keydown', e => {
    if (!_sugOpen) return;
    if (e.key === 'ArrowDown')  { e.preventDefault(); _sugMoveFocus(+1); return; }
    if (e.key === 'ArrowUp')    { e.preventDefault(); _sugMoveFocus(-1); return; }
    if (e.key === 'Enter') {
      if (_sugFocusIdx >= 0 && _sugFocusList[_sugFocusIdx]) {
        e.preventDefault();
        _sugFocusList[_sugFocusIdx].click();
      } else {
        _closeSug();
      }
      return;
    }
    if (e.key === 'Escape') { _closeSug(); input.blur(); }
  });

  // Panel tactile — empêche le blur de fermer pendant un tap
  const panel = document.getElementById('sugPanel');
  if (panel) {
    panel.addEventListener('touchstart', () => { _sugTouching = true; },                            { passive: true });
    panel.addEventListener('touchend',   () => { setTimeout(() => { _sugTouching = false; }, 350); }, { passive: true });
  }

  // Ré-ouvre si le champ contient déjà du texte au focus
  input.addEventListener('focus', function () {
    if (this.value.trim()) _buildSuggestions();
  });

  // Ferme après un délai pour laisser les clics passer
  input.addEventListener('blur', () => {
    if (_sugTouching) return;
    setTimeout(_closeSug, 200);
  });
});

document.addEventListener('scroll', () => { if (!_sugTouching) _closeSug(); }, true);
window.addEventListener('resize',   () => { if (_sugOpen) _positionSug(); });
