/* ═══════════════════════════════════════════════════════════
   UI.JS — Arya V2
   Sidebar drawer, context menu (long press / clic droit),
   navigation principale.

   Dépend de : config.js, utils.js, library.js,
               covers.js, playback.js, queue.js, playlists.js
═══════════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════════
   SIDEBAR DRAWER (mobile)
═══════════════════════════════════════════════════════════ */

function openSidebarDrawer() {
  document.querySelector('.sidebar').classList.add('open');
  document.getElementById('sidebarBackdrop').classList.add('open');
  history.pushState({ arya: 'sidebar' }, '');
}

function closeSidebarDrawer() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar?.classList.contains('open')) return;
  sidebar.classList.remove('open');
  document.getElementById('sidebarBackdrop').classList.remove('open');
  if (history.state?.arya === 'sidebar') history.back();
}

// Ferme le drawer automatiquement quand on navigue (mobile)
document.querySelectorAll('.nav-item').forEach(el =>
  el.addEventListener('click', () => {
    if (window.innerWidth <= 640) closeSidebarDrawer();
  })
);


/* ═══════════════════════════════════════════════════════════
   CONTEXT MENU — Styles
═══════════════════════════════════════════════════════════ */

(function _injectCtxStyles() {
  if (document.getElementById('ctx-menu-styles')) return;
  const s = document.createElement('style');
  s.id = 'ctx-menu-styles';
  s.textContent = `
    #ctxBackdrop {
      display: none;
      position: fixed; inset: 0;
      z-index: 1400;
    }
    #ctxBackdrop.open { display: block; }

    #ctxMenu {
      display: none;
      position: fixed;
      z-index: 1500;
      background: var(--surface2, #1e1e2e);
      border: 1px solid rgba(255,255,255,.09);
      border-radius: 16px;
      padding: 6px;
      min-width: 230px;
      max-width: 280px;
      box-shadow: 0 20px 60px rgba(0,0,0,.7);
      opacity: 0;
      transform: scale(.9) translateY(-4px);
      transition: opacity .15s ease, transform .15s ease;
      pointer-events: none;
    }
    #ctxMenu.open {
      display: block;
      opacity: 1;
      transform: scale(1) translateY(0);
      pointer-events: auto;
    }

    .ctx-header {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 10px 11px;
      pointer-events: none;
    }
    .ctx-art {
      width: 40px; height: 40px;
      border-radius: 7px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 17px; overflow: hidden;
    }
    .ctx-art img { width: 100%; height: 100%; object-fit: cover; border-radius: 7px; }

    .ctx-track-title {
      font-size: 13px; font-weight: 600;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .ctx-track-sub {
      font-size: 11.5px; color: var(--text2, #888); margin-top: 2px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    .ctx-sep { height: 1px; background: rgba(255,255,255,.07); margin: 4px 8px; }

    .ctx-item {
      display: flex; align-items: center; gap: 10px;
      width: 100%; text-align: left;
      background: transparent; border: none;
      color: var(--text1, #fff); font-size: 13.5px;
      padding: 10px 12px; border-radius: 9px;
      cursor: pointer; transition: background .1s;
      font-family: inherit;
    }
    .ctx-item:hover,
    .ctx-item:active  { background: rgba(255,255,255,.07); }
    .ctx-item-ico     { font-size: 15px; width: 20px; text-align: center; flex-shrink: 0; }
    .ctx-item.ctx-fav-on { color: #e05; }
    .ctx-item.ctx-danger { color: var(--rose, #e05); }
  `;
  document.head.appendChild(s);
})();


/* ═══════════════════════════════════════════════════════════
   CONTEXT MENU — DOM
═══════════════════════════════════════════════════════════ */

(function _injectCtxDom() {
  if (document.getElementById('ctxMenu')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div id="ctxBackdrop" onclick="closeContextMenu()"></div>
    <div id="ctxMenu"></div>
  `);
})();


/* ═══════════════════════════════════════════════════════════
   CONTEXT MENU — Core
═══════════════════════════════════════════════════════════ */

let _ctxLongTimer = null;
const _CTX_DELAY  = 480; // ms avant déclenchement du long press

function _showContextMenu(trackId, x, y) {
  const t = tracks.find(tr => tr.id === trackId);
  if (!t) return;

  const favs   = getFavs();
  const faved  = favs.has(t.filename);
  const cover  = getCover(t.filename);
  const grad   = gradFor(t.artist + t.album);

  document.getElementById('ctxMenu').innerHTML = `
    <div class="ctx-header">
      <div class="ctx-art" style="${cover ? '' : `background:${grad}`}">
        ${cover
          ? `<img src="${esc(cover)}" onerror="this.parentElement.style.background='${grad}';this.remove();">`
          : '🎵'}
      </div>
      <div style="flex:1;min-width:0;">
        <div class="ctx-track-title">${esc(t.title)}</div>
        <div class="ctx-track-sub">${esc(t.artist)}</div>
      </div>
    </div>
    <div class="ctx-sep"></div>
    <button class="ctx-item" onclick="playTrack(${t.id});closeContextMenu()">
      <span class="ctx-item-ico">▶</span>Lire maintenant
    </button>
    <button class="ctx-item" onclick="playNext(${t.id});closeContextMenu()">
      <span class="ctx-item-ico">⏭</span>Lire ensuite
    </button>
    <button class="ctx-item" onclick="addToQueueEnd(${t.id});closeContextMenu()">
      <span class="ctx-item-ico">➕</span>Ajouter à la file
    </button>
    <div class="ctx-sep"></div>
    <button class="ctx-item${faved ? ' ctx-fav-on' : ''}"
            onclick="toggleFavById(${t.id}, null);closeContextMenu()">
      <span class="ctx-item-ico">${faved ? '♥' : '♡'}</span>
      ${faved ? 'Retirer des favoris' : 'Ajouter aux favoris'}
    </button>
    <button class="ctx-item"
            onclick="closeContextMenu();openAddToPlaylistSheet('${escAttr(t.filename)}', null)">
      <span class="ctx-item-ico">📋</span>Ajouter à une playlist
    </button>
    <div class="ctx-sep"></div>
    <button class="ctx-item" onclick="closeContextMenu();openEditor(${t.id})">
      <span class="ctx-item-ico">✏️</span>Éditer les infos
    </button>
  `;

  // Positionnement — reste dans le viewport
  const menu = document.getElementById('ctxMenu');
  menu.style.left = '0px';
  menu.style.top  = '0px';
  menu.classList.add('open');

  const { offsetWidth: mw, offsetHeight: mh } = menu;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  menu.style.left = Math.max(8, Math.min(x + 2, vw - mw - 8)) + 'px';
  menu.style.top  = Math.max(8, Math.min(y + 2, vh - mh - 8)) + 'px';

  document.getElementById('ctxBackdrop').classList.add('open');
}

function closeContextMenu() {
  document.getElementById('ctxMenu').classList.remove('open');
  document.getElementById('ctxBackdrop').classList.remove('open');
}

/** Remonte jusqu'au .track-row — ignore les boutons d'action pour ne pas interférer. */
function _ctxTargetRow(el) {
  if (el.closest('.tr-actions, .ico-btn, button, .ctx-item')) return null;
  return el.closest('.track-row[data-id]');
}


/* ═══════════════════════════════════════════════════════════
   DÉCLENCHEURS
═══════════════════════════════════════════════════════════ */

// Clic droit (desktop)
document.addEventListener('contextmenu', e => {
  const row = _ctxTargetRow(e.target);
  if (!row) return;
  e.preventDefault();
  const id = parseInt(row.dataset.id);
  if (!isNaN(id) && id >= 0) _showContextMenu(id, e.clientX, e.clientY);
});

// Long press (mobile)
document.addEventListener('touchstart', e => {
  const row = _ctxTargetRow(e.target);
  if (!row) return;
  const { clientX: cx, clientY: cy } = e.touches[0];
  _ctxLongTimer = setTimeout(() => {
    _ctxLongTimer = null;
    const id = parseInt(row.dataset.id);
    if (!isNaN(id) && id >= 0) {
      navigator.vibrate?.(25);
      _showContextMenu(id, cx, cy);
    }
  }, _CTX_DELAY);
}, { passive: true });

// Annule le long press si le doigt bouge ou se lève
function _cancelCtxLong() {
  if (_ctxLongTimer) { clearTimeout(_ctxLongTimer); _ctxLongTimer = null; }
}
document.addEventListener('touchend',    _cancelCtxLong, { passive: true });
document.addEventListener('touchmove',   _cancelCtxLong, { passive: true });
document.addEventListener('touchcancel', _cancelCtxLong, { passive: true });

// Fermeture via clavier ou scroll
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeContextMenu(); });
document.addEventListener('scroll',  closeContextMenu, true);
