/* ═══════════════════════════════════════════════════════════
   FULLSCREEN.JS — Arya v2
   Wake Lock, lecteur plein écran, swipe, raccourcis clavier,
   bottom sheet "More", Service Worker.

   Dépend de : config.js, utils.js, playback.js, ui.js
═══════════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════════
   DÉTECTION DEVICE TACTILE
   ⚠️  Doit être déclaré AVANT openFsPlayerIfMobile()
       pour éviter la Temporal Dead Zone (const hoisting).
═══════════════════════════════════════════════════════════ */
const _touchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);


/* ═══════════════════════════════════════════════════════════
   WAKE LOCK — empêche la mise en veille pendant la lecture
═══════════════════════════════════════════════════════════ */

let _wakeLock = null;

async function requestWakeLock() {
  if (_wakeLock) return;
  if (!('wakeLock' in navigator)) return;
  try {
    _wakeLock = await navigator.wakeLock.request('screen');
    _wakeLock.addEventListener('release', () => {
      _wakeLock = null;
      // Ré-acquiert automatiquement si la lecture est toujours en cours
      if (isPlaying) requestWakeLock();
    });
  } catch (e) {
    console.warn('[Arya WakeLock] Non disponible :', e.message);
  }
}

async function releaseWakeLock() {
  if (!_wakeLock) return;
  try { await _wakeLock.release(); } catch {}
  _wakeLock = null;
}

// Ré-acquiert quand l'onglet redevient visible (pas de release en arrière-plan
// pour ne pas couper la lecture audio)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && isPlaying) requestWakeLock();
});


/* ═══════════════════════════════════════════════════════════
   LECTEUR PLEIN ÉCRAN
═══════════════════════════════════════════════════════════ */

function openFsPlayerIfMobile() {
  // Ouverture automatique sur mobile / TV, ignoré sur desktop
  if (window.innerWidth > 1280 && !_touchDevice) return;
  openFsPlayer();
}

function openFsPlayer() {
  _fsOpen = true;
  document.getElementById('fsPlayer').classList.add('open');
  document.body.style.overflow = 'hidden';
  syncFsPlayer();
  history.pushState({ arya: 'fsPlayer' }, '');
}

function closeFsPlayer() {
  _fsOpen = false;
  document.getElementById('fsPlayer').classList.remove('open');
  document.body.style.overflow = '';
  if (history.state?.arya === 'fsPlayer') history.back();
}

function syncFsPlayer() {
  if (!_fsOpen) return;

  // Copie la pochette depuis le mini-player
  const srcArt = document.getElementById('pArt');
  const fsArt  = document.getElementById('fsArt');
  fsArt.style.background = srcArt.style.background;
  fsArt.innerHTML        = srcArt.innerHTML;
  fsArt.classList.toggle('playing-pulse', isPlaying);

  // Texte
  document.getElementById('fsTitle').textContent  = document.getElementById('pTitle').textContent;
  document.getElementById('fsArtist').textContent = document.getElementById('pArtist').textContent;

  // Barre de progression
  document.getElementById('fsFill').style.width      = document.getElementById('pFill').style.width;
  document.getElementById('fsElapsed').textContent   = document.getElementById('pElapsed').textContent;
  document.getElementById('fsDur').textContent        = document.getElementById('pDur').textContent;

  // Boutons
  document.getElementById('fsBtnPlay').textContent = isPlaying ? '⏸' : '▶';
  document.getElementById('fsBtnShuffle').classList.toggle('on', shuffle);

  const rb = document.getElementById('fsBtnRepeat');
  rb.textContent = repeat === REPEAT.ONE ? '⟳' : '↺';
  rb.classList.toggle('on',   repeat > REPEAT.OFF);
  rb.classList.toggle('rose', repeat === REPEAT.ONE);

  // Volume
  document.getElementById('fsVolSlider').value    = Math.round(audio.volume * 100);
  document.getElementById('fsVolIco').textContent = audio.volume === 0 ? '🔇' : audio.volume < 0.5 ? '🔉' : '🔊';
}

function fsSeekTo(e) {
  if (partyMode === 'listener') return;
  const r           = e.currentTarget.getBoundingClientRect();
  const pct         = (e.clientX - r.left) / r.width;
  const activeAudio = activePlayer === 1 ? _audio1 : _audio2;
  if (activeAudio.duration) {
    activeAudio.currentTime = Math.max(0, Math.min(pct * activeAudio.duration, activeAudio.duration));
  }
}

function setVolFs(v) {
  setVol(v);
  document.getElementById('fsVolIco').textContent = v === 0 ? '🔇' : v < 50 ? '🔉' : '🔊';
  document.getElementById('volSlider').value = v;
}


/* ═══════════════════════════════════════════════════════════
   SWIPE — piste suivante / précédente
═══════════════════════════════════════════════════════════ */

(function _initSwipe() {
  let _sx = 0, _sy = 0;
  const onTouchStart = e => { _sx = e.touches[0].clientX; _sy = e.touches[0].clientY; };
  const onTouchEnd   = e => {
    const dx = e.changedTouches[0].clientX - _sx;
    const dy = e.changedTouches[0].clientY - _sy;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    dx < 0 ? nextTrack() : prevTrack();
  };
  const opts = { passive: true };

  ['.player', '#fsArt'].forEach(sel => {
    const el = document.querySelector(sel);
    if (!el) return;
    el.addEventListener('touchstart', onTouchStart, opts);
    el.addEventListener('touchend',   onTouchEnd,   opts);
  });
})();


/* ═══════════════════════════════════════════════════════════
   RACCOURCIS CLAVIER — TV / Desktop
═══════════════════════════════════════════════════════════ */

document.addEventListener('keydown', e => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;

  switch (e.key) {
    case ' ':
      e.preventDefault();
      togglePlay();
      break;
    case 'f': case 'F':
      e.preventDefault();
      _fsOpen ? closeFsPlayer() : openFsPlayer();
      break;
    case 'e': case 'E':
      e.preventDefault();
      showView('eq');
      break;
    case 'Escape':
      if (_fsOpen) closeFsPlayer();
      break;
  }
});


/* ═══════════════════════════════════════════════════════════
   MORE BOTTOM SHEET
═══════════════════════════════════════════════════════════ */

const MORE_VIEWS = ['stats', 'party', 'history', 'online', 'editor', 'upload', 'playlists', 'data', 'leaderboard', 'eq'];

function openMoreSheet() {
  document.getElementById('moreBackdrop').classList.add('open');
  document.getElementById('moreSheet').classList.add('open');
  const cur = document.querySelector('.view.active')?.id?.replace('view-', '') || '';
  MORE_VIEWS.forEach(v => {
    const el = document.getElementById('more' + v.charAt(0).toUpperCase() + v.slice(1));
    if (el) el.classList.toggle('active', v === cur);
  });
  history.pushState({ arya: 'moreSheet' }, '');
}

function closeMoreSheet() {
  const sheet   = document.getElementById('moreSheet');
  const wasOpen = sheet.classList.contains('open');
  document.getElementById('moreBackdrop').classList.remove('open');
  sheet.classList.remove('open');
  if (wasOpen && history.state?.arya === 'moreSheet') history.back();
}

function showViewFromMore(name) {
  closeMoreSheet();
  showView(name);
  document.getElementById('mnMoreBtn')?.classList.add('active');
}


/* ═══════════════════════════════════════════════════════════
   BOUTON RETOUR PHYSIQUE (Android / iOS)
   Ferme les sheets dans l'ordre de priorité.
═══════════════════════════════════════════════════════════ */

window.addEventListener('popstate', () => {
  // Sheets prioritaires — fermées dans l'ordre
  const sheets = [
    { sheet: 'tpSheet',      backdrop: 'tpBackdrop'        },
    { sheet: 'plSheet',      backdrop: 'plSheetBackdrop'    },
    { sheet: 'itunesSheet',  backdrop: 'itunesBackdrop'     },
    { sheet: 'moreSheet',    backdrop: 'moreBackdrop'       },
  ];

  for (const { sheet, backdrop } of sheets) {
    const el = document.getElementById(sheet);
    if (el?.classList.contains('open')) {
      document.getElementById(backdrop)?.classList.remove('open');
      el.classList.remove('open');
      return;
    }
  }

  // Sidebar
  const sidebar = document.querySelector('.sidebar');
  if (sidebar?.classList.contains('open')) {
    sidebar.classList.remove('open');
    document.getElementById('sidebarBackdrop')?.classList.remove('open');
    return;
  }

  // Lecteur plein écran
  if (_fsOpen) {
    _fsOpen = false;
    document.getElementById('fsPlayer').classList.remove('open');
    document.body.style.overflow = '';
  }
});


/* ═══════════════════════════════════════════════════════════
   PATCH showView
   Branche les rendus lazy et gère le badge "More".
═══════════════════════════════════════════════════════════ */

const _origShowView = showView;
window.showView = function (name) {
  _origShowView(name);
  if (name === 'playlists')   renderPlaylists();
  if (name === 'leaderboard') renderLeaderboard();
  if (name === 'eq')          renderEqPanel('eq-panel-container');

  const mainViews = ['dashboard', 'songs', 'favorites', 'albums', 'artists'];
  const mnMore    = document.getElementById('mnMoreBtn');
  if (mnMore) {
    if (mainViews.includes(name))  mnMore.classList.remove('active');
    else if (MORE_VIEWS.includes(name)) mnMore.classList.add('active');
  }

  if (_fsOpen) syncFsPlayer();
  closeMoreSheet();
};


/* ═══════════════════════════════════════════════════════════
   PATCH updatePlayerUI — sync FS si ouvert
   Différé au load pour éviter les conflits d'ordre de
   chargement des scripts.
═══════════════════════════════════════════════════════════ */

window.addEventListener('load', () => {
  const _prevUpdateUI = typeof updatePlayerUI === 'function' ? updatePlayerUI : null;
  window.updatePlayerUI = function (t) {
    if (_prevUpdateUI) _prevUpdateUI(t);
    if (_fsOpen) setTimeout(syncFsPlayer, 50);
  };
});


/* ═══════════════════════════════════════════════════════════
   SERVICE WORKER — PWA
═══════════════════════════════════════════════════════════ */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .catch(e => console.warn('[Arya PWA] Service Worker échoué :', e));
  });
}
