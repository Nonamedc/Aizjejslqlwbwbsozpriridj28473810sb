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
        <div class="ctx-track-sub">${t.feat ? `${esc(t.artist)} feat. ${esc(t.feat)}` : esc(t.artist)}</div>
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
    <div class="ctx-sep"></div>
    <button class="ctx-item" onclick="closeContextMenu();showDetail('artist','${escAttr(t.artist)}')">
      <span class="ctx-item-ico">🎤</span>Aller à l'artiste
    </button>
    <button class="ctx-item" onclick="closeContextMenu();showDetail('album','${escAttr(t.album)}')">
      <span class="ctx-item-ico">💿</span>Aller à l'album
    </button>
    <div class="ctx-sep"></div>
    <div class="ctx-sep"></div>
    <button class="ctx-item" onclick="closeContextMenu();showDetail('artist','${escAttr(t.artist)}')">
      <span class="ctx-item-ico">🎤</span>Aller à l'artiste
    </button>
    <button class="ctx-item" onclick="closeContextMenu();showDetail('album','${escAttr(t.album)}')">
      <span class="ctx-item-ico">💿</span>Aller à l'album
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


/* ═══════════════════════════════════════════════════════════
   GESTES MOBILE — Arya
   1. Fullscreen : swipe G/D = prev/next, swipe bas = ferme
   2. Track row  : swipe gauche = révèle actions (like + queue)
   3. Detail     : swipe droite = retour
═══════════════════════════════════════════════════════════ */

(function _mobileGestures() {

  /* ── Utilitaires ─────────────────────────────────────── */
  const isMobile = () => window.innerWidth <= 1024;

  /* ══════════════════════════════════════════════════════
     1. FULLSCREEN PLAYER — swipe G/D/bas
  ══════════════════════════════════════════════════════ */
  let _fs = { x0: 0, y0: 0, active: false, dx: 0, dy: 0 };
  const FS_THRESH_X = 60;
  const FS_THRESH_Y = 90;

  document.addEventListener('touchstart', e => {
    const fs = document.getElementById('fsPlayer');
    if (!fs || !fs.classList.contains('open')) return;
    // Ignorer si on touche la barre de progression ou les boutons
    if (e.target.closest('.fs-track, .fs-btns, .fs-vol-wrap, .fs-lyrics-panel, .fs-queue-panel, button')) return;
    const t = e.touches[0];
    _fs.x0 = t.clientX;
    _fs.y0 = t.clientY;
    _fs.dx = 0;
    _fs.dy = 0;
    _fs.active = true;
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (!_fs.active) return;
    const fs = document.getElementById('fsPlayer');
    if (!fs || !fs.classList.contains('open')) return;
    if (e.target.closest('.fs-lyrics-panel, .fs-queue-panel')) return;
    const t = e.touches[0];
    _fs.dx = t.clientX - _fs.x0;
    _fs.dy = t.clientY - _fs.y0;

    // Swipe bas → on translate le player pour feedback visuel
    if (_fs.dy > 10 && Math.abs(_fs.dy) > Math.abs(_fs.dx)) {
      const translateY = Math.max(0, _fs.dy * 0.5);
      fs.style.transform = `translateY(${translateY}px)`;
      fs.style.transition = 'none';
    }
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (!_fs.active) return;
    _fs.active = false;
    const fs = document.getElementById('fsPlayer');
    if (!fs || !fs.classList.contains('open')) return;

    fs.style.transform = '';
    fs.style.transition = '';

    const absDx = Math.abs(_fs.dx);
    const absDy = Math.abs(_fs.dy);

    // Swipe bas → fermer
    if (_fs.dy > FS_THRESH_Y && absDy > absDx) {
      if (typeof closeFsPlayer === 'function') closeFsPlayer();
      return;
    }

    // Swipe horizontal → prev/next
    if (absDx > FS_THRESH_X && absDx > absDy) {
      if (_fs.dx < 0) {
        // Gauche → suivant
        if (typeof nextTrack === 'function') nextTrack();
        _fsArtBounce('left');
      } else {
        // Droite → précédent
        if (typeof prevTrack === 'function') prevTrack();
        _fsArtBounce('right');
      }
    }
  }, { passive: true });

  function _fsArtBounce(dir) {
    const art = document.getElementById('fsArt');
    if (!art) return;
    const tx = dir === 'left' ? '-18px' : '18px';
    art.style.transition = 'transform .12s ease';
    art.style.transform  = `translateX(${tx}) scale(.96)`;
    setTimeout(() => {
      art.style.transform = '';
      setTimeout(() => { art.style.transition = ''; }, 200);
    }, 120);
  }


  /* ══════════════════════════════════════════════════════
     2. TRACK ROW — swipe gauche révèle actions
  ══════════════════════════════════════════════════════ */
  const SWIPE_OPEN  = 88;   // px à glisser pour ouvrir
  const SWIPE_CLOSE = 30;   // px en retour pour refermer
  let _sw = {
    el: null, startX: 0, startY: 0,
    curX: 0, open: false, locked: false, moved: false
  };

  // Injecte les styles swipe une seule fois
  if (!document.getElementById('swipe-row-styles')) {
    const s = document.createElement('style');
    s.id = 'swipe-row-styles';
    s.textContent = `
      .track-row { overflow: hidden; }

      .tr-swipe-inner {
        display: contents;
      }

      .tr-swipe-actions {
        position: absolute;
        right: 0; top: 0; bottom: 0;
        display: flex; align-items: center; gap: 0;
        transform: translateX(100%);
        transition: transform .22s cubic-bezier(.22,1,.36,1);
        z-index: 3;
        pointer-events: none;
      }
      .track-row.swiped .tr-swipe-actions {
        transform: translateX(0);
        pointer-events: auto;
      }
      .tr-sw-btn {
        width: 44px; height: 100%;
        display: flex; align-items: center; justify-content: center;
        font-size: 18px; border: none; cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        flex-shrink: 0;
      }
      .tr-sw-like { background: var(--rose, #b84060); }
      .tr-sw-queue { background: var(--accent, #c8924a); color: #000; }

      .track-row { transition: transform .22s cubic-bezier(.22,1,.36,1); }
      .track-row.swiped { transform: translateX(-88px); border-radius: 8px 0 0 8px; }
    `;
    document.head.appendChild(s);
  }

  function _injectSwipeActions(row) {
    if (row.querySelector('.tr-swipe-actions')) return;
    const id  = parseInt(row.dataset.id);
    const div = document.createElement('div');
    div.className = 'tr-swipe-actions';
    div.innerHTML = `
      <button class="tr-sw-btn tr-sw-like"
        ontouchend="event.preventDefault();event.stopPropagation();_swipeToggleFav(${id},this)">♡</button>
      <button class="tr-sw-btn tr-sw-queue"
        ontouchend="event.preventDefault();event.stopPropagation();_swipeAddQueue(${id})">+</button>
    `;
    row.style.position = 'relative';
    row.appendChild(div);

    // Refresh fav icon
    if (typeof getFavs === 'function') {
      const t = (typeof tracks !== 'undefined' ? tracks : []).find(t => t.id === id);
      if (t && getFavs().has(t.filename)) {
        div.querySelector('.tr-sw-like').textContent = '♥';
        div.querySelector('.tr-sw-like').style.background = '#e0335a';
      }
    }
  }

  window._swipeToggleFav = function(id, btn) {
    if (typeof toggleFavById === 'function') {
      toggleFavById(id, { stopPropagation: () => {} });
    }
    const t = (typeof tracks !== 'undefined' ? tracks : []).find(t => t.id === id);
    if (t && typeof getFavs === 'function') {
      const isFav = getFavs().has(t.filename);
      btn.textContent = isFav ? '♥' : '♡';
      btn.style.background = isFav ? '#e0335a' : 'var(--rose)';
    }
    _closeAllSwipes();
  };

  window._swipeAddQueue = function(id) {
    if (typeof addToQueueEnd === 'function') addToQueueEnd(id);
    if (typeof toast === 'function') toast('➕ Ajouté à la file');
    _closeAllSwipes();
  };

  function _closeAllSwipes(except) {
    document.querySelectorAll('.track-row.swiped').forEach(r => {
      if (r !== except) r.classList.remove('swiped');
    });
  }

  document.addEventListener('touchstart', e => {
    if (!isMobile()) return;
    const row = e.target.closest('.track-row[data-id]');
    if (!row) { _closeAllSwipes(); return; }
    if (e.target.closest('.tr-swipe-actions, button, .ico-btn')) return;

    _injectSwipeActions(row);
    _sw.el     = row;
    _sw.startX = e.touches[0].clientX;
    _sw.startY = e.touches[0].clientY;
    _sw.open   = row.classList.contains('swiped');
    _sw.locked = false;
    _sw.moved  = false;
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (!_sw.el || _sw.locked) return;
    const dx = e.touches[0].clientX - _sw.startX;
    const dy = e.touches[0].clientY - _sw.startY;

    if (!_sw.moved) {
      // Détermine la direction dominante
      if (Math.abs(dy) > Math.abs(dx) + 4) { _sw.locked = true; _sw.el = null; return; }
      if (Math.abs(dx) > 6) _sw.moved = true;
    }
    if (!_sw.moved) return;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (!_sw.el || !_sw.moved) { _sw.el = null; return; }
    const row = _sw.el;
    _sw.el = null;

    const dx = e.changedTouches[0].clientX - _sw.startX;

    if (!_sw.open && dx < -SWIPE_OPEN) {
      _closeAllSwipes(row);
      row.classList.add('swiped');
    } else if (_sw.open && dx > SWIPE_CLOSE) {
      row.classList.remove('swiped');
    } else if (!_sw.open && dx > 8) {
      // swipe droite sur une row = ferme les autres
      _closeAllSwipes();
    }
  }, { passive: true });

  // Ferme les swipes si on tap ailleurs
  document.addEventListener('touchstart', e => {
    if (!e.target.closest('.track-row')) _closeAllSwipes();
  }, { passive: true });


  /* ══════════════════════════════════════════════════════
     3. VUE DÉTAIL — swipe droite = retour
  ══════════════════════════════════════════════════════ */
  let _detailSwipe = { x0: 0, y0: 0, active: false };

  document.addEventListener('touchstart', e => {
    if (!isMobile()) return;
    const detail = document.getElementById('view-detail');
    if (!detail || !detail.classList.contains('active')) return;
    if (e.target.closest('button, .ico-btn, .tr-swipe-actions, .back-btn')) return;

    const t = e.touches[0];
    if (t.clientX > 40) return; // seulement depuis le bord gauche (≤40px)
    _detailSwipe.x0     = t.clientX;
    _detailSwipe.y0     = t.clientY;
    _detailSwipe.active = true;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (!_detailSwipe.active) return;
    _detailSwipe.active = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - _detailSwipe.x0;
    const dy = Math.abs(t.clientY - _detailSwipe.y0);
    if (dx > 60 && dy < 60) {
      // Swipe droite → retour
      if (typeof goBackFromDetail === 'function') goBackFromDetail();
      else document.querySelector('.back-btn')?.click();
    }
  }, { passive: true });


  /* ══════════════════════════════════════════════════════
     4. MINI PLAYER — tout le player ouvre le fullscreen
  ══════════════════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', () => {
    const player = document.querySelector('.player');
    if (!player) return;

    player.addEventListener('touchend', e => {
      if (!isMobile()) return;
      // Ignorer les contrôles interactifs
      if (e.target.closest(
        '.p-btn, .p-play, .p-track, .vol-slider, .vol-wrap, #btnPlay, button'
      )) return;

      e.preventDefault();
      if (typeof openFsPlayerIfMobile === 'function') openFsPlayerIfMobile();
      else if (typeof openFsPlayer === 'function') openFsPlayer();
    });
  });

})();
