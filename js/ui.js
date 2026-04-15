/* ══════════════════════════════════════════════
   SIDEBAR DRAWER (mobile)
══════════════════════════════════════════════ */
function openSidebarDrawer(){
  document.querySelector('.sidebar').classList.add('open');
  document.getElementById('sidebarBackdrop').classList.add('open');
  history.pushState({ arya: 'sidebar' }, '');
}
function closeSidebarDrawer(){
  const sidebar = document.querySelector('.sidebar');
  if(!sidebar?.classList.contains('open')) return;
  sidebar.classList.remove('open');
  document.getElementById('sidebarBackdrop').classList.remove('open');
  if(history.state?.arya === 'sidebar') history.back();
}

// Ferme le drawer automatiquement sur chaque nav-item
document.querySelectorAll('.nav-item').forEach(el =>
  el.addEventListener('click', () => {
    if(window.innerWidth <= 640) closeSidebarDrawer();
  })
);


/* ══════════════════════════════════════════════
   CONTEXT MENU  (long press mobile · clic droit desktop)
══════════════════════════════════════════════ */

/* ─── Inject CSS ─── */
(function _injectCtxStyles(){
  if(document.getElementById('ctx-menu-styles')) return;
  const s = document.createElement('style');
  s.id = 'ctx-menu-styles';
  s.textContent = `
    #ctxBackdrop {
      display:none; position:fixed; inset:0; z-index:1400;
    }
    #ctxBackdrop.open { display:block; }

    #ctxMenu {
      display:none; position:fixed; z-index:1500;
      background:var(--surface2,#1e1e2e);
      border:1px solid rgba(255,255,255,.09);
      border-radius:16px; padding:6px;
      min-width:230px; max-width:280px;
      box-shadow:0 20px 60px rgba(0,0,0,.7);
      opacity:0; transform:scale(.9) translateY(-4px);
      transition:opacity .15s ease, transform .15s ease;
      pointer-events:none;
    }
    #ctxMenu.open {
      display:block; opacity:1; transform:scale(1) translateY(0);
      pointer-events:auto;
    }
    .ctx-header {
      display:flex; align-items:center; gap:10px;
      padding:8px 10px 11px; pointer-events:none;
    }
    .ctx-art {
      width:40px; height:40px; border-radius:7px; flex-shrink:0;
      display:flex; align-items:center; justify-content:center;
      font-size:17px; overflow:hidden;
    }
    .ctx-art img { width:100%; height:100%; object-fit:cover; border-radius:7px; }
    .ctx-track-title {
      font-size:13px; font-weight:600;
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    }
    .ctx-track-sub {
      font-size:11.5px; color:var(--text2,#888); margin-top:2px;
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    }
    .ctx-sep { height:1px; background:rgba(255,255,255,.07); margin:4px 8px; }
    .ctx-item {
      display:flex; align-items:center; gap:10px;
      width:100%; text-align:left;
      background:transparent; border:none;
      color:var(--text1,#fff); font-size:13.5px;
      padding:10px 12px; border-radius:9px;
      cursor:pointer; transition:background .1s;
    }
    .ctx-item:hover, .ctx-item:active { background:rgba(255,255,255,.07); }
    .ctx-item-ico { font-size:15px; width:20px; text-align:center; flex-shrink:0; }
    .ctx-item.ctx-fav-on { color:#e05; }
    .ctx-item.ctx-danger { color:var(--rose,#e05); }
  `;
  document.head.appendChild(s);
})();

/* ─── Inject DOM ─── */
(function _injectCtxDom(){
  if(document.getElementById('ctxMenu')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div id="ctxBackdrop" onclick="closeContextMenu()"></div>
    <div id="ctxMenu"></div>
  `);
})();

/* ─── State ─── */
let _ctxLongTimer = null;
const _CTX_DELAY = 480; // ms pour long press

/* ─── Core ─── */
function _showContextMenu(trackId, x, y) {
  const t = tracks.find(x => x.id === trackId);
  if (!t) return;

  const favs   = getFavs();
  const faved  = favs.has(t.filename);
  const cover  = getCover(t.filename);
  const grad   = gradFor(t.artist + t.album);
  const artBg  = cover ? '' : `background:${grad}`;
  const artImg = cover
    ? `<img src="${esc(cover)}" onerror="this.parentElement.style.background='${grad}';this.remove();">`
    : '🎵';

  document.getElementById('ctxMenu').innerHTML = `
    <div class="ctx-header">
      <div class="ctx-art" style="${artBg}">${artImg}</div>
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
    <button class="ctx-item${faved?' ctx-fav-on':''}" onclick="toggleFavById(${t.id},null);closeContextMenu()">
      <span class="ctx-item-ico">${faved?'♥':'♡'}</span>${faved?'Retirer des favoris':'Ajouter aux favoris'}
    </button>
    <button class="ctx-item" onclick="closeContextMenu();openAddToPlaylistSheet('${escAttr(t.filename)}',null)">
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

  const mw = menu.offsetWidth;
  const mh = menu.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = Math.min(x + 2, vw - mw - 8);
  let top  = Math.min(y + 2, vh - mh - 8);
  left = Math.max(left, 8);
  top  = Math.max(top,  8);

  menu.style.left = left + 'px';
  menu.style.top  = top  + 'px';

  document.getElementById('ctxBackdrop').classList.add('open');
}

function closeContextMenu() {
  document.getElementById('ctxMenu').classList.remove('open');
  document.getElementById('ctxBackdrop').classList.remove('open');
}

/* ─── Helpers ─── */
function _ctxTargetRow(el) {
  // Remonte jusqu'au .track-row mais ignore les boutons d'action
  if (el.closest('.tr-actions, .ico-btn, button, .ctx-item')) return null;
  return el.closest('.track-row[data-id]');
}

/* ─── Clic droit (desktop) ─── */
document.addEventListener('contextmenu', function(e) {
  const row = _ctxTargetRow(e.target);
  if (!row) return;
  e.preventDefault();
  const id = parseInt(row.dataset.id);
  if (!isNaN(id) && id >= 0) _showContextMenu(id, e.clientX, e.clientY);
});

/* ─── Long press (mobile) ─── */
document.addEventListener('touchstart', function(e) {
  const row = _ctxTargetRow(e.target);
  if (!row) return;
  const touch = e.touches[0];
  const cx = touch.clientX;
  const cy = touch.clientY;
  _ctxLongTimer = setTimeout(() => {
    _ctxLongTimer = null;
    const id = parseInt(row.dataset.id);
    if (!isNaN(id) && id >= 0) {
      if (navigator.vibrate) navigator.vibrate(25);
      _showContextMenu(id, cx, cy);
    }
  }, _CTX_DELAY);
}, { passive: true });

// Annule si le doigt bouge ou se lève trop vite
function _cancelCtxLong() {
  if (_ctxLongTimer) { clearTimeout(_ctxLongTimer); _ctxLongTimer = null; }
}
document.addEventListener('touchend',    _cancelCtxLong, { passive: true });
document.addEventListener('touchmove',   _cancelCtxLong, { passive: true });
document.addEventListener('touchcancel', _cancelCtxLong, { passive: true });

// Ferme aussi si on scrolle ou appuie sur Escape
document.addEventListener('keydown', e => { if(e.key === 'Escape') closeContextMenu(); });
document.addEventListener('scroll',  closeContextMenu, true);
