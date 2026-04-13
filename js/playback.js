/* ═══════════════════════════════════════════
   PLAYBACK
═══════════════════════════════════════════ */

// Identifiant de la dernière piste comptabilisée dans les stats
// → évite de compter avant 50% ET évite les doublons crossfade
let _countedTrackId = null;

function buildQueue(){
  queue=shuffle?shuffleArr([...tracks]):[...tracks];
  queueIdx=currentId!=null?queue.findIndex(t=>t.id===currentId):0;
}

function shuffleArr(arr){
  for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}
  return arr;
}

function playTrack(id){
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

  // Stoppe proprement les deux lecteurs
  try { _audio1.pause(); } catch(e) {}
  try { _audio2.pause(); } catch(e) {}

  // Annule tout pré-chargement en cours (évite erreur 3016)
  await _cancelPreload();

  // Reset gapless state
  _swapTriggered = false;
  _xfading       = false;
  _preloadedIdx  = -1;

  // Réinitialise le compteur de lecture pour la nouvelle piste
  _countedTrackId = null;

  try {
    const currentShaka = activePlayer === 1 ? shaka1 : shaka2;

    if (_shakaPendingLoad) {
      try { await _shakaPendingLoad; } catch(e) {}
      _shakaPendingLoad = null;
    }

    try {
      await currentShaka.load(t.deezerUrl || t.url);
    } catch(fetchErr) {
      if (fetchErr.code === 7000) throw fetchErr; // LOAD_INTERRUPTED = annulé par l'utilisateur
      if (t.deezerUrl) {
        console.warn('[Arya] URL Deezer inaccessible, fallback Archive.org :', fetchErr.code || fetchErr);
        await currentShaka.load(t.url);
      } else {
        throw fetchErr;
      }
    }

    currentId = t.id;
    updatePlayerUI(t);
    highlightPlaying();
    broadcastTrack(t);
    // ⚠️ addToHistory & recordPlay déplacés à 50% de lecture dans _onTimeUpdate

    // Paroles en arrière-plan
    fetchAndShowLrc(t);

    await audio.play();

    _statLastTS = audio.currentTime;

    // Pré-chargement immédiat de la piste suivante
    setTimeout(preloadNextTrack, 500);

  } catch (err) {
    if (err.code === 7000) return; // LOAD_INTERRUPTED — changement de piste volontaire, silencieux
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
    btn.textContent = '↺'; btn.classList.remove('on', 'rose');
    if (fsBtn) { fsBtn.textContent = '↺'; fsBtn.classList.remove('on', 'rose'); }
    toast('🔁 Répétition désactivée');
  } else if (repeat === 1) {
    btn.textContent = '↺'; btn.classList.add('on'); btn.classList.remove('rose');
    if (fsBtn) { fsBtn.textContent = '↺'; fsBtn.classList.add('on'); fsBtn.classList.remove('rose'); }
    toast('🔁 Répéter toute la liste');
  } else {
    btn.textContent = '⟳'; btn.classList.add('on', 'rose');
    if (fsBtn) { fsBtn.textContent = '⟳'; fsBtn.classList.add('on', 'rose'); }
    toast('🔂 Répéter cette chanson');
  }
}

function setVol(v){
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

/* ─── Audio events ─── */

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

  // Sync full-screen
  if (_fsOpen) {
    document.getElementById('fsFill').style.width = pct + '%';
    if (!_316active) document.getElementById('fsElapsed').textContent = fmtTime(cur);
    document.getElementById('fsDur').textContent = fmtTime(dur);
    if (_lyricsOpen) updateLrcHighlight(cur);
  }

  // ── Comptabilisation à 50% de la piste ──
  if (_countedTrackId !== currentId && dur > 0 && cur >= dur * 0.5) {
    _countedTrackId = currentId;
    const t = tracks.find(x => x.id === currentId);
    if (t) {
      recordPlay(t);
      addToHistory(t);
      if (typeof pushLeaderboardStats === 'function') pushLeaderboardStats();
    }
  }

  // ── Déclenchement du fondu croisé ──
  if (!_swapTriggered && !_xfading && dur > 0) {
    const remaining = dur - cur;
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

  // Assure que la piste courte est quand même comptée
  if (_countedTrackId !== currentId) {
    _countedTrackId = currentId;
    const t = tracks.find(x => x.id === currentId);
    if (t) {
      recordPlay(t);
      addToHistory(t);
      if (typeof pushLeaderboardStats === 'function') pushLeaderboardStats();
    }
  }

  if (repeat === 2) {
    this.currentTime = 0;
    this.play().catch(() => {});
  } else if (_preloadedIdx >= 0 && !_xfading) {
    triggerCrossfade();
  } else if (!_xfading) {
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
  // Wake Lock : empêche la mise en veille pendant la lecture
  if (typeof requestWakeLock === 'function') requestWakeLock();
}

function _onPause() {
  if (this !== (activePlayer === 1 ? _audio1 : _audio2)) return;
  if (_xfading) return;
  isPlaying = false;
  flushStatAccum();
  document.getElementById('btnPlay').textContent = '▶';
  document.getElementById('pArt').classList.remove('playing-pulse');
  if (_fsOpen) {
    document.getElementById('fsBtnPlay').textContent = '▶';
    document.getElementById('fsArt').classList.remove('playing-pulse');
  }
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
  // Libère le Wake Lock en pause
  if (typeof releaseWakeLock === 'function') releaseWakeLock();
}

[_audio1, _audio2].forEach(el => {
  el.addEventListener('timeupdate', _onTimeUpdate);
  el.addEventListener('ended',      _onEnded);
  el.addEventListener('play',       _onPlay);
  el.addEventListener('pause',      _onPause);
});

/* ═══════════════════════════════════════════
   MEDIA SESSION
═══════════════════════════════════════════ */

function _activeAudio() {
  return activePlayer === 1 ? _audio1 : _audio2;
}

function _setupMediaSession(){
  if(!('mediaSession' in navigator)) return;
  navigator.mediaSession.setActionHandler('play', () => { _activeAudio().play().catch(() => {}); });
  navigator.mediaSession.setActionHandler('pause', () => { _activeAudio().pause(); });
  navigator.mediaSession.setActionHandler('stop', () => { _activeAudio().pause(); _activeAudio().currentTime = 0; });
  navigator.mediaSession.setActionHandler('nexttrack', () => { nextTrack(); });
  navigator.mediaSession.setActionHandler('previoustrack', () => { prevTrack(); });
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
  } catch(e) {}
}
_setupMediaSession();

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

const _origUpdatePlayerUI2 = updatePlayerUI;
window.updatePlayerUI = function(t){
  _origUpdatePlayerUI2(t);
  if(!('mediaSession' in navigator)) return;
  navigator.mediaSession.playbackState = 'playing';
  const cover = t?.filename ? getCover(t.filename) : null;
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
  setTimeout(_updatePositionState, 200);
};

/* Fallback polling fin de piste */
setInterval(()=>{
  if (_xfading) return;
  const activeAudio = activePlayer === 1 ? _audio1 : _audio2;
  if(!activeAudio.src || activeAudio.paused || !activeAudio.duration) return;
  if(activeAudio.currentTime > 0 && activeAudio.currentTime >= activeAudio.duration - 0.8){
    activeAudio.dispatchEvent(new Event('ended'));
  }
}, 1000);

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
