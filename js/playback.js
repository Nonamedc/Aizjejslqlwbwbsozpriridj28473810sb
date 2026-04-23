/* ═══════════════════════════════════════════════════════════
   PLAYBACK.JS — Arya
   Contrôle de lecture, événements audio, Media Session.

   Dépend de : config.js, utils.js, audio-engine.js,
               library.js, covers.js, ui.js, lyrics.js,
               leaderboard.js (optionnel)
═══════════════════════════════════════════════════════════ */

// Identifiant de la dernière piste comptabilisée dans les stats
// → évite de compter avant 50% ET évite les doublons crossfade
let _countedTrackId = null;


/* ═══════════════════════════════════════════════════════════
   QUEUE
═══════════════════════════════════════════════════════════ */

function buildQueue() {
  queue    = shuffle ? shuffleArr([...tracks]) : [...tracks];
  queueIdx = currentId != null ? queue.findIndex(t => t.id === currentId) : 0;
}


/* ═══════════════════════════════════════════════════════════
   LECTURE
═══════════════════════════════════════════════════════════ */

function playTrack(id) {
  if (partyMode === 'listener') return;
  const t = tracks.find(t => t.id === id);
  if (!t) return;
  currentId = id;
  queueIdx  = queue.findIndex(q => q.id === id);
  if (queueIdx < 0) { queue = [...tracks]; queueIdx = queue.findIndex(q => q.id === id); }
  loadAndPlay(t);
}

function playFromQueue() {
  if (queueIdx < 0 || queueIdx >= queue.length) return;
  loadAndPlay(queue[queueIdx]);
}

async function loadAndPlay(t) {
  if (!t) return;

  flushStatAccum();

  // Stoppe proprement les deux lecteurs
  try { _audio1.pause(); } catch {}
  try { _audio2.pause(); } catch {}

  // Annule tout pré-chargement en cours (évite erreur Shaka 3016)
  await _cancelPreload();

  // Remet l'état gapless à zéro
  _swapTriggered  = false;
  _xfading        = false;
  _preloadedIdx   = -1;
  _countedTrackId = null;

  try {
    const currentShaka = activePlayer === 1 ? shaka1 : shaka2;

    if (_shakaPendingLoad) {
      try { await _shakaPendingLoad; } catch {}
      _shakaPendingLoad = null;
    }

    try {
      await currentShaka.load(t.deezerUrl || t.url);
    } catch (fetchErr) {
      if (fetchErr.code === 7000) throw fetchErr; // LOAD_INTERRUPTED — annulé volontairement
      if (t.deezerUrl) {
        console.warn('[Arya Playback] URL Deezer inaccessible, fallback Archive.org :', fetchErr.code || fetchErr);
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

    fetchAndShowLrc(t); // paroles en arrière-plan

    await audio.play();

    _statLastTS = audio.currentTime;
    setTimeout(preloadNextTrack, 500); // pré-charge la piste suivante

  } catch (err) {
    if (err.code === 7000) return; // LOAD_INTERRUPTED — silencieux
    console.error('[Arya Playback] Erreur lecture :', err);
    toast('Impossible de lire cette piste', true);
    setTimeout(nextTrack, 800);
  }
}


/* ═══════════════════════════════════════════════════════════
   UI LECTEUR
═══════════════════════════════════════════════════════════ */

function updatePlayerUI(t) {
  document.getElementById('pTitle').textContent  = t.title;
  document.getElementById('pArtist').textContent = t.artist + (t.album && t.album !== 'Sans album' ? ' · ' + t.album : '');

  const art   = document.getElementById('pArt');
  const cover = getCover(t.filename);
  const grad  = gradFor(t.artist + t.album);
  art.style.background = cover ? '' : grad;
  art.innerHTML = cover
    ? `<img src="${esc(cover)}" loading="lazy" onerror="this.parentElement.style.background='${grad}';this.remove();">`
    : '🎵';
  art.classList.add('active');

  document.title = `${t.title} — Arya`;

  const banner = document.getElementById('playingBanner');
  const bannerText = document.getElementById('bannerText');
  if (bannerText) bannerText.textContent = `▶ ${t.title}`;
  if (banner) banner.style.display = 'flex';
}

function highlightPlaying() {
  document.querySelectorAll('.track-row, .detail-track-row').forEach(el => {
    el.classList.toggle('playing', parseInt(el.dataset.id) === currentId);
  });
}


/* ═══════════════════════════════════════════════════════════
   CONTRÔLES
═══════════════════════════════════════════════════════════ */

function togglePlay() {
  if (partyMode === 'listener') return;
  if (currentId === null) { if (tracks.length) playTrack(tracks[0].id); return; }

  const activeAudio = activePlayer === 1 ? _audio1 : _audio2;
  const sh          = activePlayer === 1 ? shaka1  : shaka2;

  if (isPlaying) {
    activeAudio.pause();
  } else {
    const savedPos = activeAudio.currentTime;
    activeAudio.play().catch(async () => {
      const t = tracks.find(x => x.id === currentId);
      if (!t) return;
      try {
        await sh.load(t.deezerUrl || t.url);
        activeAudio.currentTime = savedPos;
        await activeAudio.play();
        updatePlayerUI(t);
        if (partyMode === 'host') broadcastPartySync();
      } catch (e) { console.warn('[Arya Playback] replay after reload error:', e); }
    });
  }
}

function prevTrack() {
  if (partyMode === 'listener') return;
  const activeAudio = activePlayer === 1 ? _audio1 : _audio2;
  if (activeAudio.currentTime > 3) { activeAudio.currentTime = 0; return; }
  if (queueIdx > 0) { queueIdx--; playFromQueue(); }
  else if (repeat === REPEAT.ALL) { queueIdx = queue.length - 1; playFromQueue(); }
}

function nextTrack() {
  if (partyMode === 'listener') return;
  if (queueIdx < queue.length - 1) { queueIdx++; playFromQueue(); }
  else if (repeat === REPEAT.ALL)  { queueIdx = 0; playFromQueue(); }
}

/* ─── Shuffle ─── */
function toggleShuffle() {
  shuffle = !shuffle;
  document.getElementById('btnShuffle')?.classList.toggle('on', shuffle);
  document.getElementById('fsBtnShuffle')?.classList.toggle('on', shuffle);
  buildQueue();
  toast(shuffle ? '🔀 Aléatoire activé' : '🔀 Aléatoire désactivé');
}

/* ─── Repeat ─── */
function toggleRepeat() {
  repeat = (repeat + 1) % 3;

  const labels = {
    [REPEAT.OFF]: { icon: '↺', cls: [],              msg: '🔁 Répétition désactivée'   },
    [REPEAT.ALL]: { icon: '↺', cls: ['on'],          msg: '🔁 Répéter toute la liste'   },
    [REPEAT.ONE]: { icon: '⟳', cls: ['on', 'rose'],  msg: '🔂 Répéter cette chanson'    },
  };
  const { icon, cls, msg } = labels[repeat];

  [document.getElementById('btnRepeat'), document.getElementById('fsBtnRepeat')].forEach(btn => {
    if (!btn) return;
    btn.textContent = icon;
    btn.classList.remove('on', 'rose');
    cls.forEach(c => btn.classList.add(c));
  });
  toast(msg);
}

/* ─── Volume ─── */
function setVol(v) {
  if (!_xfading) {
    _audio1.volume = v / 100;
    _audio2.volume = v / 100;
  }
  const ico = document.getElementById('volIco');
  if (ico) ico.textContent = v === 0 ? '🔇' : v < 50 ? '🔉' : '🔊';
  if (v === 0) showEyeClose();
}

/* ─── Seek ─── */
function seekTo(e) {
  if (partyMode === 'listener') return;
  const r           = e.currentTarget.getBoundingClientRect();
  const pct         = (e.clientX - r.left) / r.width;
  const activeAudio = activePlayer === 1 ? _audio1 : _audio2;
  if (activeAudio.duration) {
    activeAudio.currentTime = Math.max(0, Math.min(pct * activeAudio.duration, activeAudio.duration));
  }
}


/* ═══════════════════════════════════════════════════════════
   ÉVÉNEMENTS AUDIO
═══════════════════════════════════════════════════════════ */

function _onTimeUpdate() {
  if (this !== (activePlayer === 1 ? _audio1 : _audio2)) return;

  const cur = this.currentTime;
  const dur = this.duration;
  const pct = dur ? (cur / dur) * 100 : 0;

  document.getElementById('pFill').style.width      = pct + '%';
  if (!_316active) document.getElementById('pElapsed').textContent = fmtTime(cur);
  document.getElementById('pDur').textContent        = fmtTime(dur);
  check316(cur);

  // Accumulation des stats d'écoute
  if (isPlaying && _statLastTS > 0) {
    const delta = cur - _statLastTS;
    if (delta > 0 && delta < 3) _statAccum += delta;
  }
  _statLastTS = cur;

  // Flush stats toutes les 15s ou 15 secondes accumulées
  if (_statAccum > 15 || (Date.now() - _statLastSave) > 15_000) {
    flushStatAccum();
    _statLastSave = Date.now();
    const sv = document.getElementById('view-stats');
    if (sv?.classList.contains('active')) renderStats();
  }

  // Media Session position — toutes les 4 secondes
  if ('mediaSession' in navigator && Math.floor(cur) % 4 === 0) {
    _updatePositionState();
  }

  // Sync lecteur plein écran
  if (_fsOpen) {
    document.getElementById('fsFill').style.width      = pct + '%';
    if (!_316active) document.getElementById('fsElapsed').textContent = fmtTime(cur);
    document.getElementById('fsDur').textContent        = fmtTime(dur);
    if (_lyricsOpen) updateLrcHighlight(cur);
  }

  // Comptabilisation à 50% de la piste
  if (_countedTrackId !== currentId && dur > 0 && cur >= dur * 0.5) {
    _countedTrackId = currentId;
    const t = tracks.find(x => x.id === currentId);
    if (t) {
      recordPlay(t);
      addToHistory(t);
      if (typeof pushLeaderboardStats === 'function') pushLeaderboardStats();
    }
  }

  // Déclenchement du crossfade
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

  // Assure que les pistes courtes sont quand même comptées
  if (_countedTrackId !== currentId) {
    _countedTrackId = currentId;
    const t = tracks.find(x => x.id === currentId);
    if (t) {
      recordPlay(t);
      addToHistory(t);
      if (typeof pushLeaderboardStats === 'function') pushLeaderboardStats();
    }
  }

  if (repeat === REPEAT.ONE) {
    this.currentTime = 0;
    this.play().catch(() => {});
  } else if (_preloadedIdx >= 0 && !_xfading) {
    triggerCrossfade();
  } else if (!_xfading) {
    if (queueIdx < queue.length - 1) { queueIdx++; playFromQueue(); }
    else if (repeat === REPEAT.ALL)  { queueIdx = 0; playFromQueue(); }
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
  if (typeof releaseWakeLock === 'function') releaseWakeLock();
}

[_audio1, _audio2].forEach(el => {
  el.addEventListener('timeupdate', _onTimeUpdate);
  el.addEventListener('ended',      _onEnded);
  el.addEventListener('play',       _onPlay);
  el.addEventListener('pause',      _onPause);
});


/* ═══════════════════════════════════════════════════════════
   MEDIA SESSION API
═══════════════════════════════════════════════════════════ */

function _activeAudio() {
  return activePlayer === 1 ? _audio1 : _audio2;
}

function _setupMediaSession() {
  if (!('mediaSession' in navigator)) return;

  navigator.mediaSession.setActionHandler('play',          () => { _activeAudio().play().catch(() => {}); });
  navigator.mediaSession.setActionHandler('pause',         () => { _activeAudio().pause(); });
  navigator.mediaSession.setActionHandler('stop',          () => { _activeAudio().pause(); _activeAudio().currentTime = 0; });
  navigator.mediaSession.setActionHandler('nexttrack',     () => { nextTrack(); });
  navigator.mediaSession.setActionHandler('previoustrack', () => { prevTrack(); });

  try {
    navigator.mediaSession.setActionHandler('seekto', details => {
      if (details.seekTime !== undefined) {
        const aa = _activeAudio();
        aa.currentTime = Math.max(0, Math.min(details.seekTime, aa.duration || 0));
        _updatePositionState();
      }
    });
    navigator.mediaSession.setActionHandler('seekforward', details => {
      const aa = _activeAudio();
      aa.currentTime = Math.min((details.seekOffset || 10) + aa.currentTime, aa.duration || 0);
      _updatePositionState();
    });
    navigator.mediaSession.setActionHandler('seekbackward', details => {
      const aa = _activeAudio();
      aa.currentTime = Math.max(aa.currentTime - (details.seekOffset || 10), 0);
      _updatePositionState();
    });
  } catch {}
}
_setupMediaSession();

function _updatePositionState() {
  if (!('mediaSession' in navigator)) return;
  const aa = _activeAudio();
  if (!aa.duration || isNaN(aa.duration)) return;
  try {
    navigator.mediaSession.setPositionState({
      duration:     aa.duration,
      playbackRate: aa.playbackRate || 1,
      position:     Math.min(aa.currentTime, aa.duration),
    });
  } catch {}
}

/* Enrichit updatePlayerUI avec les métadonnées Media Session */
const _origUpdatePlayerUI = updatePlayerUI;
window.updatePlayerUI = function (t) {
  _origUpdatePlayerUI(t);
  if (!('mediaSession' in navigator)) return;

  navigator.mediaSession.playbackState = 'playing';
  const cover   = t?.filename ? getCover(t.filename) : null;
  const artwork = cover ? [
    { src: cover.replace('600x600bb', '96x96bb'),   sizes: '96x96',   type: 'image/jpeg' },
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


/* ═══════════════════════════════════════════════════════════
   FALLBACK POLLING — fin de piste
   Sécurité en cas d'événement 'ended' manqué.
═══════════════════════════════════════════════════════════ */

setInterval(() => {
  if (_xfading) return;
  const aa = activePlayer === 1 ? _audio1 : _audio2;
  if (!aa.src || aa.paused || !aa.duration) return;
  if (aa.currentTime > 0 && aa.currentTime >= aa.duration - 0.8) {
    aa.dispatchEvent(new Event('ended'));
  }
}, 1000);


/* ═══════════════════════════════════════════════════════════
   VISIBILITYCHANGE — resync état boutons si l'onglet revient
═══════════════════════════════════════════════════════════ */

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const aa              = activePlayer === 1 ? _audio1 : _audio2;
  const actuallyPlaying = !aa.paused && !aa.ended && aa.currentTime > 0;
  if (isPlaying === actuallyPlaying) return;

  isPlaying = actuallyPlaying;
  const icon = isPlaying ? '⏸' : '▶';
  document.getElementById('btnPlay')?.setAttribute('textContent', icon); // guard null
  document.getElementById('btnPlay').textContent   = icon;
  document.getElementById('fsBtnPlay')?.setAttribute('textContent', icon);
  const artEl = document.getElementById('pArt');
  artEl?.classList.toggle('playing-pulse', isPlaying);
});
