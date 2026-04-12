/* ═══════════════════════════════════════════
   PLAYBACK
═══════════════════════════════════════════ */
function buildQueue(){
  queue=shuffle?shuffleArr([...tracks]):[...tracks];
  queueIdx=currentId!=null?queue.findIndex(t=>t.id===currentId):0;
}

function shuffleArr(arr){
  for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}
  return arr;
}

function playTrack(id){
  // Block manual play when listening to party
  if(partyMode === 'listener') return;
  const t=tracks.find(t=>t.id===id);
  if(!t) return;
  currentId=id;
  queueIdx=queue.findIndex(q=>q.id===id);
  if(queueIdx<0){queue=[...tracks];queueIdx=queue.findIndex(q=>q.id===id);}
  loadAndPlay(t);
}

function playFromQueue(){
  if (queueIdx < 0 || queueIdx >= queue.length) return;
  const t = queue[queueIdx];
  loadAndPlay(t);
}

async function loadAndPlay(t){
  if (!t) return;

  flushStatAccum();

  // Stoppe proprement les deux lecteurs (évite l'audio fantôme si crossfade en cours)
  try { _audio1.pause(); } catch(e) {}
  try { _audio2.pause(); } catch(e) {}

  // Reset gapless state
  _swapTriggered = false;
  _xfading       = false;
  _preloadedIdx  = -1;

  try {
    const currentShaka = activePlayer === 1 ? shaka1 : shaka2;

    if (_shakaPendingLoad) await _shakaPendingLoad;

    try {
      await currentShaka.load(t.deezerUrl || t.url);
    } catch(fetchErr) {
      // Si l'URL Deezer échoue, on tente l'URL Archive.org en fallback
      if (t.deezerUrl) {
        console.warn('[Arya] URL Deezer inaccessible, fallback Archive.org :', fetchErr);
        await currentShaka.load(t.url);
      } else {
        throw fetchErr;
      }
    }

    currentId = t.id;
    updatePlayerUI(t);
    highlightPlaying();
    broadcastTrack(t);
    addToHistory(t);
    recordPlay(t);

    // Fetch paroles LRC en arrière-plan
    fetchAndShowLrc(t);

    await audio.play();

    _statLastTS = audio.currentTime;

    // Pré-chargement immédiat de la piste suivante
    setTimeout(preloadNextTrack, 400);

  } catch (err) {
    console.error("Erreur lecture :", err);
    toast("Impossible de lire cette piste", true);
    setTimeout(nextTrack, 800);
  }
}
function updatePlayerUI(t){
  document.getElementById('pTitle').textContent=t.title;
  document.getElementById('pArtist').textContent=t.artist+(t.album&&t.album!=='Sans album'?' · '+t.album:'');
  const art=document.getElementById('pArt');
  const cover = getCover(t.filename);
  const grad = gradFor(t.artist+t.album);
  art.style.background = cover ? '' : grad;
  art.innerHTML = cover
    ? `<img src="${esc(cover)}" loading="lazy" onerror="this.parentElement.style.background='${grad}';this.remove();">`
    : '🎵';
  art.classList.add('active');
  document.title=`${t.title} — Arya`;
  const b=document.getElementById('bannerText');
  b.textContent=`▶ ${t.title}`;
  document.getElementById('playingBanner').style.display='flex';
}

function highlightPlaying(){
  document.querySelectorAll('.track-row,.detail-track-row').forEach(el=>{
    const id=parseInt(el.dataset.id);
    el.classList.toggle('playing',id===currentId);
  });
}

function togglePlay(){
  if(partyMode === 'listener') return;
  if(currentId===null){if(tracks.length)playTrack(tracks[0].id);return;}
  const activeAudio = activePlayer === 1 ? _audio1 : _audio2;
  const sh = activePlayer === 1 ? shaka1 : shaka2;
  if(isPlaying){
    activeAudio.pause();
  } else {
    const savedPos = activeAudio.currentTime;
    activeAudio.play().catch(async () => {
      // Stream expiré après une longue pause → rechargement + seek
      const t = tracks.find(x => x.id === currentId);
      if(!t) return;
      try {
        await sh.load(t.deezerUrl || t.url);
        activeAudio.currentTime = savedPos;
        await activeAudio.play();
        updatePlayerUI(t);
        if(partyMode === 'host') broadcastPartySync();
      } catch(e) { console.warn('[Arya] replay after reload error', e); }
    });
  }
}

function prevTrack(){
  if(partyMode === 'listener') return;
  const activeAudio = activePlayer === 1 ? _audio1 : _audio2;
  if(activeAudio.currentTime>3){activeAudio.currentTime=0;return;}
  if(queueIdx>0){queueIdx--;playFromQueue();}
  else if(repeat===1){queueIdx=queue.length-1;playFromQueue();}
}

function nextTrack(){
  if(partyMode === 'listener') return;
  if(queueIdx<queue.length-1){queueIdx++;playFromQueue();}
  else if(repeat===1){queueIdx=0;playFromQueue();}
}

/* ====================== SHUFFLE ====================== */
function toggleShuffle(){
  shuffle = !shuffle;
  
  const btn = document.getElementById('btnShuffle');
  const fsBtn = document.getElementById('fsBtnShuffle');
  
  btn.classList.toggle('on', shuffle);
  if (fsBtn) fsBtn.classList.toggle('on', shuffle);

  buildQueue();           
  toast(shuffle ? '🔀 Aléatoire activé' : '🔀 Aléatoire désactivé');
}

/* ====================== REPEAT ====================== */
function toggleRepeat(){
  repeat = (repeat + 1) % 3;
  
  const btn = document.getElementById('btnRepeat');
  const fsBtn = document.getElementById('fsBtnRepeat');

  if (repeat === 0) {
    btn.textContent = '↺';
    btn.classList.remove('on', 'rose');
    if (fsBtn) { fsBtn.textContent = '↺'; fsBtn.classList.remove('on', 'rose'); }
    toast('🔁 Répétition désactivée');
  } 
  else if (repeat === 1) {
    btn.textContent = '↺';
    btn.classList.add('on');
    btn.classList.remove('rose');
    if (fsBtn) { fsBtn.textContent = '↺'; fsBtn.classList.add('on'); fsBtn.classList.remove('rose'); }
    toast('🔁 Répéter toute la liste');
  } 
  else { // repeat === 2
    btn.textContent = '⟳';
    btn.classList.add('on', 'rose');
    if (fsBtn) { fsBtn.textContent = '⟳'; fsBtn.classList.add('on', 'rose'); }
    toast('🔂 Répéter cette chanson');
  }
}
function setVol(v){
  // Si un fondu est en cours, ne pas écraser les volumes individuels
  if (!_xfading) {
    _audio1.volume = v / 100;
    _audio2.volume = v / 100;
  }
  const ico=document.getElementById('volIco');
  ico.textContent=v==0?'🔇':v<50?'🔉':'🔊';
  if(v==0) showEyeClose();
}

function seekTo(e){
  if(partyMode === 'listener') return;
  const r=e.currentTarget.getBoundingClientRect();
  const pct=(e.clientX-r.left)/r.width;
  const activeAudio = activePlayer === 1 ? _audio1 : _audio2;
  if(activeAudio.duration) activeAudio.currentTime=Math.max(0,Math.min(pct*activeAudio.duration,activeAudio.duration));
}

/* ─── Audio events — Dual-Player Aware ─── */
/* On attache les handlers sur _audio1 ET _audio2 ;
   chaque handler vérifie qu'il provient du lecteur actif. */

function _onTimeUpdate() {
  if (this !== (activePlayer === 1 ? _audio1 : _audio2)) return;

  const cur = this.currentTime, dur = this.duration;
  const pct = dur ? (cur / dur) * 100 : 0;
  document.getElementById('pFill').style.width = pct + '%';
  if (!_316active) document.getElementById('pElapsed').textContent = fmtTime(cur);
  document.getElementById('pDur').textContent = fmtTime(dur);
  check316(cur);

  // Stat accumulation
  if (isPlaying && _statLastTS > 0) {
    const delta = cur - _statLastTS;
    if (delta > 0 && delta < 3) _statAccum += delta;
  }
  _statLastTS = cur;
  if (_statAccum > 15 || (Date.now() - _statLastSave) > 15000) {
    flushStatAccum();
    _statLastSave = Date.now();
    const sv = document.getElementById('view-stats');
    if (sv && sv.classList.contains('active')) renderStats();
  }

  if ('mediaSession' in navigator && Math.floor(cur) % 4 === 0) {
    _updatePositionState();
  }

  // ── Sync full-screen player ──
  if (_fsOpen) {
    document.getElementById('fsFill').style.width = pct + '%';
    if (!_316active) document.getElementById('fsElapsed').textContent = fmtTime(cur);
    document.getElementById('fsDur').textContent = fmtTime(dur);
    if (_lyricsOpen) updateLrcHighlight(cur);
  }

  // ── Déclenchement du fondu croisé ──
  if (!_swapTriggered && !_xfading && dur > 0) {
    const remaining = dur - cur;
    // Trigger entre 5 et XFADE_TRIGGER secondes selon si piste courte
    const triggerAt = Math.min(XFADE_TRIGGER, dur * 0.15);
    if (remaining <= triggerAt && remaining > 0 && _preloadedIdx >= 0) {
      _swapTriggered = true;
      triggerCrossfade();
    }
  }
}

function _onEnded() {
  if (this !== (activePlayer === 1 ? _audio1 : _audio2)) return;
  flushStatAccum();

  if (repeat === 2) {
    this.currentTime = 0;
    this.play().catch(() => {});
  } else if (_preloadedIdx >= 0 && !_xfading) {
    // Fallback : le fondu n'a pas pu se déclencher à temps
    triggerCrossfade();
  } else if (!_xfading) {
    // Pas de pré-chargement dispo — lecture classique
    if (queueIdx < queue.length - 1) { queueIdx++; playFromQueue(); }
    else if (repeat === 1) { queueIdx = 0; playFromQueue(); }
  }
}

function _onPlay() {
  if (this !== (activePlayer === 1 ? _audio1 : _audio2)) return;
  isPlaying = true;
  document.getElementById('btnPlay').textContent = '⏸';
  document.getElementById('pArt').classList.add('playing-pulse');
  if (_fsOpen) {
    document.getElementById('fsBtnPlay').textContent = '⏸';
    document.getElementById('fsArt').classList.add('playing-pulse');
  }
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
  _updatePositionState();
}

function _onPause() {
  if (this !== (activePlayer === 1 ? _audio1 : _audio2)) return;
  if (_xfading) return; // pendant le fondu le pause de l'ancien n'est pas un arrêt utilisateur
  isPlaying = false;
  flushStatAccum();
  document.getElementById('btnPlay').textContent = '▶';
  document.getElementById('pArt').classList.remove('playing-pulse');
  if (_fsOpen) {
    document.getElementById('fsBtnPlay').textContent = '▶';
    document.getElementById('fsArt').classList.remove('playing-pulse');
  }
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
}

[_audio1, _audio2].forEach(el => {
  el.addEventListener('timeupdate', _onTimeUpdate);
  el.addEventListener('ended',      _onEnded);
  el.addEventListener('play',       _onPlay);
  el.addEventListener('pause',      _onPause);
});

/* ═══════════════════════════════════════════
   MEDIA SESSION — Notif barre + écran verrouillé
   Gère : boutons play/pause/prev/next/stop/seek
   + barre de progression temps réel
   + artwork multi-résolution
   + mise à jour après crossfade
═══════════════════════════════════════════ */

function _activeAudio() {
  return activePlayer === 1 ? _audio1 : _audio2;
}

function _setupMediaSession(){
  if(!('mediaSession' in navigator)) return;

  navigator.mediaSession.setActionHandler('play', () => {
    _activeAudio().play().catch(() => {});
  });
  navigator.mediaSession.setActionHandler('pause', () => {
    _activeAudio().pause();
  });
  navigator.mediaSession.setActionHandler('stop', () => {
    _activeAudio().pause();
    _activeAudio().currentTime = 0;
  });
  navigator.mediaSession.setActionHandler('nexttrack', () => { nextTrack(); });
  navigator.mediaSession.setActionHandler('previoustrack', () => { prevTrack(); });

  // Scrubbing depuis l'écran verrouillé / la notif
  try {
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined) {
        const aa = _activeAudio();
        aa.currentTime = Math.max(0, Math.min(details.seekTime, aa.duration || 0));
        _updatePositionState();
      }
    });
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      const aa = _activeAudio();
      aa.currentTime = Math.min((details.seekOffset || 10) + aa.currentTime, aa.duration || 0);
      _updatePositionState();
    });
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      const aa = _activeAudio();
      aa.currentTime = Math.max(aa.currentTime - (details.seekOffset || 10), 0);
      _updatePositionState();
    });
  } catch(e) { /* navigateur ancien, on ignore */ }
}
_setupMediaSession();

/** Met à jour la position sur la barre de notif / écran verrouillé */
function _updatePositionState(){
  if(!('mediaSession' in navigator)) return;
  const aa = _activeAudio();
  if(!aa.duration || isNaN(aa.duration)) return;
  try {
    navigator.mediaSession.setPositionState({
      duration:     aa.duration,
      playbackRate: aa.playbackRate || 1,
      position:     Math.min(aa.currentTime, aa.duration),
    });
  } catch(e) {}
}

/** Met à jour les métadonnées (titre, artiste, pochette) dans la notif */
const _origUpdatePlayerUI2 = updatePlayerUI;
window.updatePlayerUI = function(t){
  _origUpdatePlayerUI2(t);
  if(!('mediaSession' in navigator)) return;

  navigator.mediaSession.playbackState = 'playing';

  const cover = t?.filename ? getCover(t.filename) : null;
  // Multi-résolution pour Android (96) + iOS (192) + desktop (512)
  const artwork = cover ? [
    { src: cover.replace('600x600bb', '96x96bb'),  sizes: '96x96',   type: 'image/jpeg' },
    { src: cover.replace('600x600bb', '192x192bb'), sizes: '192x192', type: 'image/jpeg' },
    { src: cover,                                    sizes: '512x512', type: 'image/jpeg' },
  ] : [];

  navigator.mediaSession.metadata = new MediaMetadata({
    title:  t.title  || '',
    artist: t.artist || '',
    album:  t.album  || '',
    artwork,
  });

  // Réinitialise la position à 0 (nouvelle piste)
  setTimeout(_updatePositionState, 200);
};

/* ─── Fallback polling : détecte la fin de piste si ended n'est pas déclenché ─── */
setInterval(()=>{
  if (_xfading) return;
  const activeAudio = activePlayer === 1 ? _audio1 : _audio2;
  if(!activeAudio.src || activeAudio.paused || !activeAudio.duration) return;
  if(activeAudio.currentTime > 0 && activeAudio.currentTime >= activeAudio.duration - 0.8){
    activeAudio.dispatchEvent(new Event('ended'));
  }
}, 1000);

/* ─── visibilitychange : resync état play/pause quand on revient sur l'app ─── */
document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState !== 'visible') return;
  const activeAudio = activePlayer === 1 ? _audio1 : _audio2;
  const actuallyPlaying = !activeAudio.paused && !activeAudio.ended && activeAudio.currentTime > 0;
  if(isPlaying !== actuallyPlaying){
    isPlaying = actuallyPlaying;
    const playBtn = document.getElementById('btnPlay');
    const fsPlayBtn = document.getElementById('fsBtnPlay');
    const artEl = document.getElementById('pArt');
    if(isPlaying){
      if(playBtn) playBtn.textContent = '⏸';
      if(fsPlayBtn) fsPlayBtn.textContent = '⏸';
      if(artEl) artEl.classList.add('playing-pulse');
    } else {
      if(playBtn) playBtn.textContent = '▶';
      if(fsPlayBtn) fsPlayBtn.textContent = '▶';
      if(artEl) artEl.classList.remove('playing-pulse');
    }
  }
});

