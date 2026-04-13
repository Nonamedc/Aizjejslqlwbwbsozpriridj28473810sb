/* ══════════════════════════════════════════════
   WAKE LOCK — empêche la mise en veille
══════════════════════════════════════════════ */
let _wakeLock = null;

async function requestWakeLock() {
  if (_wakeLock) return; // déjà actif
  if (!('wakeLock' in navigator)) return;
  try {
    _wakeLock = await navigator.wakeLock.request('screen');
    _wakeLock.addEventListener('release', () => {
      _wakeLock = null;
      // Re-acquiert automatiquement si la lecture est en cours (ex: onglet redevenu visible)
      if (isPlaying) requestWakeLock();
    });
    console.log('[Arya] 🔆 Wake Lock actif');
  } catch (e) {
    // Pas un problème bloquant — l'appli fonctionne sans
    console.warn('[Arya] Wake Lock non disponible :', e.message);
  }
}

async function releaseWakeLock() {
  if (!_wakeLock) return;
  try { await _wakeLock.release(); } catch(e) {}
  _wakeLock = null;
  console.log('[Arya] 🔅 Wake Lock libéré');
}

// Ré-acquiert le Wake Lock quand l'onglet/l'app redevient visible
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && isPlaying) {
    requestWakeLock();
  } else if (document.visibilityState === 'hidden') {
    // Ne libère pas — l'audio doit continuer en arrière-plan
  }
});

/* ══════════════════════════════════════════════
   FULL-SCREEN PLAYER
══════════════════════════════════════════════ */

function openFsPlayerIfMobile(){
  // Accessible depuis mobile ET TV (clavier distant)
  // Sur desktop classique on l'ignore (sauf raccourci clavier)
  if(window.innerWidth > 1280 && !_touchDevice) return;
  openFsPlayer();
}

// Détection device tactile/TV
const _touchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

function openFsPlayer(){
  _fsOpen = true;
  const fs = document.getElementById('fsPlayer');
  fs.classList.add('open');
  syncFsPlayer();
  document.body.style.overflow = 'hidden';
  history.pushState({ arya: 'fsPlayer' }, '');
}

function closeFsPlayer(){
  _fsOpen = false;
  document.getElementById('fsPlayer').classList.remove('open');
  document.body.style.overflow = '';
  if(history.state && history.state.arya === 'fsPlayer') history.back();
}

function syncFsPlayer(){
  if(!_fsOpen) return;
  const srcArt = document.getElementById('pArt');
  const fsArt = document.getElementById('fsArt');
  fsArt.style.background = srcArt.style.background;
  fsArt.innerHTML = srcArt.innerHTML;
  if(isPlaying) fsArt.classList.add('playing-pulse');
  else fsArt.classList.remove('playing-pulse');
  document.getElementById('fsTitle').textContent = document.getElementById('pTitle').textContent;
  document.getElementById('fsArtist').textContent = document.getElementById('pArtist').textContent;
  document.getElementById('fsFill').style.width = document.getElementById('pFill').style.width;
  document.getElementById('fsElapsed').textContent = document.getElementById('pElapsed').textContent;
  document.getElementById('fsDur').textContent = document.getElementById('pDur').textContent;
  document.getElementById('fsBtnPlay').textContent = isPlaying ? '⏸' : '▶';
  document.getElementById('fsBtnShuffle').classList.toggle('on', shuffle);
  const rb = document.getElementById('fsBtnRepeat');
  rb.textContent = repeat===2 ? '⟳' : '↺';
  rb.classList.toggle('on', repeat > 0);
  rb.classList.toggle('rose', repeat === 2);
  document.getElementById('fsVolSlider').value = Math.round(audio.volume * 100);
  document.getElementById('fsVolIco').textContent = audio.volume===0?'🔇':audio.volume<0.5?'🔉':'🔊';
}

function fsSeekTo(e){
  if(partyMode === 'listener') return;
  const r = e.currentTarget.getBoundingClientRect();
  const pct = (e.clientX - r.left) / r.width;
  const activeAudio = activePlayer === 1 ? _audio1 : _audio2;
  if(activeAudio.duration) activeAudio.currentTime = Math.max(0, Math.min(pct * activeAudio.duration, activeAudio.duration));
}

function setVolFs(v){
  setVol(v);
  document.getElementById('fsVolIco').textContent = v==0?'🔇':v<50?'🔉':'🔊';
  document.getElementById('volSlider').value = v;
}

/* ══════════════════════════════════════════════
   SWIPE GESTURES
══════════════════════════════════════════════ */
(function initSwipe(){
  let _sx=0, _sy=0;

  function onTouchStart(e){ _sx = e.touches[0].clientX; _sy = e.touches[0].clientY; }
  function onTouchEnd(e){
    const dx = e.changedTouches[0].clientX - _sx;
    const dy = e.changedTouches[0].clientY - _sy;
    if(Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if(dx < 0) nextTrack();
    else prevTrack();
  }

  const player = document.querySelector('.player');
  const fsArt = document.getElementById('fsArt');
  if(player){ player.addEventListener('touchstart', onTouchStart, {passive:true}); player.addEventListener('touchend', onTouchEnd, {passive:true}); }
  if(fsArt){ fsArt.addEventListener('touchstart', onTouchStart, {passive:true}); fsArt.addEventListener('touchend', onTouchEnd, {passive:true}); }
})();

/* ══════════════════════════════════════════════
   RACCOURCIS CLAVIER — TV / Desktop
══════════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;

  // 'f' ou Enter sur l'artwork → ouvre/ferme le lecteur plein écran
  if (e.key === 'f' || e.key === 'F') {
    e.preventDefault();
    if (_fsOpen) closeFsPlayer(); else openFsPlayer();
    return;
  }
  // Échap → ferme le plein écran
  if (e.key === 'Escape' && _fsOpen) {
    closeFsPlayer();
    return;
  }
});

/* ══════════════════════════════════════════════
   MORE BOTTOM SHEET
══════════════════════════════════════════════ */
const MORE_VIEWS = ['stats','party','history','online','editor','upload','playlists','data','leaderboard'];

function openMoreSheet(){
  document.getElementById('moreBackdrop').classList.add('open');
  document.getElementById('moreSheet').classList.add('open');
  const cur = document.querySelector('.view.active')?.id?.replace('view-','') || '';
  MORE_VIEWS.forEach(v=>{
    const el = document.querySelector(`#more${v.charAt(0).toUpperCase()+v.slice(1)}`);
    if(el) el.classList.toggle('active', v === cur);
  });
  history.pushState({ arya: 'moreSheet' }, '');
}

function closeMoreSheet(){
  const wasOpen = document.getElementById('moreSheet').classList.contains('open');
  document.getElementById('moreBackdrop').classList.remove('open');
  document.getElementById('moreSheet').classList.remove('open');
  if(wasOpen && history.state && history.state.arya === 'moreSheet') history.back();
}

/* ── Bouton retour physique ── */
window.addEventListener('popstate', function(e){
  if(document.getElementById('tpSheet')?.classList.contains('open')){
    document.getElementById('tpBackdrop').classList.remove('open');
    document.getElementById('tpSheet').classList.remove('open');
    return;
  }
  if(document.getElementById('plSheet')?.classList.contains('open')){
    document.getElementById('plSheetBackdrop').classList.remove('open');
    document.getElementById('plSheet').classList.remove('open');
    return;
  }
  if(document.getElementById('itunesSheet')?.classList.contains('open')){
    document.getElementById('itunesBackdrop').classList.remove('open');
    document.getElementById('itunesSheet').classList.remove('open');
    return;
  }
  if(document.querySelector('.sidebar')?.classList.contains('open')){
    document.querySelector('.sidebar').classList.remove('open');
    document.getElementById('sidebarBackdrop').classList.remove('open');
    return;
  }
  if(_fsOpen){
    _fsOpen = false;
    document.getElementById('fsPlayer').classList.remove('open');
    document.body.style.overflow = '';
    return;
  }
  if(document.getElementById('moreSheet').classList.contains('open')){
    document.getElementById('moreBackdrop').classList.remove('open');
    document.getElementById('moreSheet').classList.remove('open');
    return;
  }
});

function showViewFromMore(name){
  closeMoreSheet();
  showView(name);
  const mnMore = document.getElementById('mnMoreBtn');
  if(mnMore) mnMore.classList.add('active');
}

/* Patch showView */
const _origShowView = showView;
window.showView = function(name){
  _origShowView(name);
  if(name === 'playlists') renderPlaylists();
  if(name === 'leaderboard') renderLeaderboard();
  const mainViews = ['dashboard','songs','favorites','albums','artists'];
  const mnMore = document.getElementById('mnMoreBtn');
  if(mnMore){
    if(mainViews.includes(name)) mnMore.classList.remove('active');
    else if(MORE_VIEWS.includes(name)) mnMore.classList.add('active');
  }
  if(_fsOpen) syncFsPlayer();
  closeMoreSheet();
};

/* Patch updatePlayerUI */
const _origUpdatePlayerUI = updatePlayerUI;
window.updatePlayerUI = function(t){
  _origUpdatePlayerUI(t);
  if(_fsOpen) setTimeout(syncFsPlayer, 50);
};

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>{
    navigator.serviceWorker.register("./sw.js")
      .then(r=>console.log("[Arya PWA] SW enregistré",r.scope))
      .catch(e=>console.warn("[Arya PWA] SW échoué",e));
  });
}
