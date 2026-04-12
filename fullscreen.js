/* ══════════════════════════════════════════════
   FULL-SCREEN PLAYER
══════════════════════════════════════════════ */
// _fsOpen est déclaré dans le bloc STATE principal

function openFsPlayerIfMobile(){
  if(window.innerWidth > 640) return;
  openFsPlayer();
}

function openFsPlayer(){
  _fsOpen = true;
  const fs = document.getElementById('fsPlayer');
  fs.classList.add('open');
  syncFsPlayer();
  // Prevent body scroll on iOS
  document.body.style.overflow = 'hidden';
  // History API : le bouton retour Android fermera le lecteur au lieu de quitter l'app
  history.pushState({ arya: 'fsPlayer' }, '');
}

function closeFsPlayer(){
  _fsOpen = false;
  document.getElementById('fsPlayer').classList.remove('open');
  document.body.style.overflow = '';
  // Si on ferme via le bouton ⌄, on retire l'entrée history
  if(history.state && history.state.arya === 'fsPlayer') history.back();
}

function syncFsPlayer(){
  if(!_fsOpen) return;
  // Art
  const srcArt = document.getElementById('pArt');
  const fsArt = document.getElementById('fsArt');
  fsArt.style.background = srcArt.style.background;
  fsArt.innerHTML = srcArt.innerHTML;
  if(isPlaying) fsArt.classList.add('playing-pulse');
  else fsArt.classList.remove('playing-pulse');
  // Meta
  document.getElementById('fsTitle').textContent = document.getElementById('pTitle').textContent;
  document.getElementById('fsArtist').textContent = document.getElementById('pArtist').textContent;
  // Progress
  document.getElementById('fsFill').style.width = document.getElementById('pFill').style.width;
  document.getElementById('fsElapsed').textContent = document.getElementById('pElapsed').textContent;
  document.getElementById('fsDur').textContent = document.getElementById('pDur').textContent;
  // Play button
  document.getElementById('fsBtnPlay').textContent = isPlaying ? '⏸' : '▶';
  // Shuffle
  document.getElementById('fsBtnShuffle').classList.toggle('on', shuffle);
  // Repeat
  const rb = document.getElementById('fsBtnRepeat');
  rb.textContent = repeat===2 ? '⟳' : '↺';
  rb.classList.toggle('on', repeat > 0);
  rb.classList.toggle('rose', repeat === 2);
  // Volume
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

// Note: FS player sync is now handled directly in _onTimeUpdate / _onPlay / _onPause

/* ══════════════════════════════════════════════
   SWIPE GESTURES (player + full-screen player)
══════════════════════════════════════════════ */
(function initSwipe(){
  let _sx=0, _sy=0, _sTarget=null;

  function onTouchStart(e){
    _sx = e.touches[0].clientX;
    _sy = e.touches[0].clientY;
    _sTarget = e.currentTarget;
  }
  function onTouchEnd(e){
    const dx = e.changedTouches[0].clientX - _sx;
    const dy = e.changedTouches[0].clientY - _sy;
    if(Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if(dx < 0) nextTrack();
    else prevTrack();
  }

  // Add to player bar (mini player) and full-screen art
  const player = document.querySelector('.player');
  const fsArt = document.getElementById('fsArt');
  if(player){
    player.addEventListener('touchstart', onTouchStart, {passive:true});
    player.addEventListener('touchend', onTouchEnd, {passive:true});
  }
  if(fsArt){
    fsArt.addEventListener('touchstart', onTouchStart, {passive:true});
    fsArt.addEventListener('touchend', onTouchEnd, {passive:true});
  }
})();

/* ══════════════════════════════════════════════
   MORE BOTTOM SHEET
══════════════════════════════════════════════ */
const MORE_VIEWS = ['stats','party','history','online','editor','upload','playlists','data'];

function openMoreSheet(){
  document.getElementById('moreBackdrop').classList.add('open');
  document.getElementById('moreSheet').classList.add('open');
  // Mark active items
  const cur = document.querySelector('.view.active')?.id?.replace('view-','') || '';
  MORE_VIEWS.forEach(v=>{
    const el = document.querySelector(`#more${v.charAt(0).toUpperCase()+v.slice(1)}`);
    if(el) el.classList.toggle('active', v === cur);
  });
  // Bouton retour Android fermera le sheet
  history.pushState({ arya: 'moreSheet' }, '');
}

function closeMoreSheet(){
  const wasOpen = document.getElementById('moreSheet').classList.contains('open');
  document.getElementById('moreBackdrop').classList.remove('open');
  document.getElementById('moreSheet').classList.remove('open');
  if(wasOpen && history.state && history.state.arya === 'moreSheet') history.back();
}

/* ── Bouton retour physique (Android / PWA) ── */
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
    // Fermer le lecteur plein écran sans rappeler history.back()
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
  // Mark the More button as "active" if on a More view
  const mnMore = document.getElementById('mnMoreBtn');
  if(mnMore) mnMore.classList.add('active');
}

/* Patch showView to handle More sheet active state */
const _origShowView = showView;
window.showView = function(name){
  _origShowView(name);
  if(name === 'playlists') renderPlaylists();
  if(name === 'data') {} // static view
  // If navigating to a main nav view, deactivate More button
  const mainViews = ['dashboard','songs','favorites','albums','artists'];
  const mnMore = document.getElementById('mnMoreBtn');
  if(mnMore){
    if(mainViews.includes(name)) mnMore.classList.remove('active');
    else if(MORE_VIEWS.includes(name)) mnMore.classList.add('active');
  }
  // Sync full-screen player if open
  if(_fsOpen) syncFsPlayer();
  // Close more sheet if open
  closeMoreSheet();
};

/* Patch updatePlayerUI to also sync full-screen player */
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

