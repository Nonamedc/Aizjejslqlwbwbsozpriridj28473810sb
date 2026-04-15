/* ═══════════════════════════════════════════
   MOTEURS AUDIO (DOUBLE BUFFERING) - ARYA v5
═══════════════════════════════════════════ */

const _audio1 = document.createElement('audio');
const _audio2 = document.createElement('audio');
let activePlayer = 1;

[_audio1, _audio2].forEach((el, i) => {
  el.style.display = 'none';
  el.preload = 'auto';
  el.crossOrigin = 'anonymous';   // ← AJOUTER CETTE LIGNE
  el.volume = 0.8;
  el.setAttribute('playsinline', '');
  el.setAttribute('webkit-playsinline', '');
  el.setAttribute('x-webkit-airplay', 'allow');
  document.body.appendChild(el);

  el.addEventListener('waiting', () => {
    if (activePlayer === (i + 1)) {
      const pArt = document.getElementById('pArt');
      if (pArt) pArt.style.opacity = '0.5';
    }
  });
  el.addEventListener('canplay', () => {
    if (activePlayer === (i + 1)) {
      const pArt = document.getElementById('pArt');
      if (pArt) pArt.style.opacity = '1';
    }
  });
});

shaka.polyfill.installAll();

const shaka1 = new shaka.Player();
const shaka2 = new shaka.Player();

const setupShaka = async (p, el) => {
  await p.attach(el);
  p.configure({
    streaming: {
      bufferingGoal: 30,
      rebufferingGoal: 2,
      bufferBehind: 30,
      stallEnabled: true,
      stallThreshold: 1,
      stallSkip: 0.1,
      retryParameters: { maxAttempts: 4, baseDelay: 1000, backoffFactor: 2, fuzzFactor: 0.5, timeout: 20000 },
    },
    manifest: { retryParameters: { maxAttempts: 4, baseDelay: 1000, backoffFactor: 2 } }
  });

  p.addEventListener('error', (event) => {
    const e = event.detail;
    // 7000 = LOAD_INTERRUPTED — attendu lors d'un changement de piste, ne pas afficher en erreur
    if (e.code === 7000) return;
    // Erreurs récupérables sur le lecteur inactif — ignorer silencieusement
    if (p !== (activePlayer === 1 ? shaka1 : shaka2)) return;
    console.warn('[Shaka] Erreur:', e.code, e.message);
    if (e.category === shaka.util.Error.Category.NETWORK) {
      toast('⚠️ Interruption réseau...', true);
    }
  });
};

(async () => {
  await Promise.all([setupShaka(shaka1, _audio1), setupShaka(shaka2, _audio2)]);
})();

let _shakaPendingLoad = null;

/* ═══════════════════════════════════════════
   PROXY AUDIO
═══════════════════════════════════════════ */
var audio = new Proxy({}, {
  get(target, prop) {
    const el = activePlayer === 1 ? _audio1 : _audio2;
    const sh = activePlayer === 1 ? shaka1 : shaka2;

    if (prop === 'play') {
      return async function() {
        if (_shakaPendingLoad) {
          try { await _shakaPendingLoad; } catch(e) {}
          _shakaPendingLoad = null;
        }
        return el.play().catch(e => console.warn('[audio play]', e));
      };
    }

    if (prop === 'inactiveShaka') return activePlayer === 1 ? shaka2 : shaka1;
    if (prop === 'activeShaka') return sh;

    const val = el[prop];
    return typeof val === 'function' ? val.bind(el) : val;
  },

  set(target, prop, value) {
    const el = activePlayer === 1 ? _audio1 : _audio2;
    const sh = activePlayer === 1 ? shaka1 : shaka2;

    if (prop === 'src' && value) {
      _shakaPendingLoad = sh.load(value)
        .then(() => { _shakaPendingLoad = null; })
        .catch(err => {
          if (err.code !== 7000) console.warn('[Shaka] Fallback natif:', err);
          el.src = value;
          _shakaPendingLoad = null;
        });
      return true;
    }
    el[prop] = value;
    return true;
  }
});

/* ═══════════════════════════════════════════
   SWAP
═══════════════════════════════════════════ */
function swapAudioBridge() {
  const oldPlayer = activePlayer === 1 ? _audio1 : _audio2;
  oldPlayer.pause();
  activePlayer = activePlayer === 1 ? 2 : 1;
  audio.play();
  console.log("Arya Engine: Switched to Player", activePlayer);
}

window.addEventListener('load', () => {
  if (shaka.Player.isBrowserSupported()) {
    console.log('[Arya] 🎬 Mode Double Engine Shaka ' + shaka.Player.version + ' activé');
  }
});

/* ═══════════════════════════════════════════
   GAPLESS / CROSSFADE ENGINE — Arya v5
═══════════════════════════════════════════ */

const XFADE_TRIGGER  = 10;
const XFADE_DURATION = 1400;

let _preloadedIdx  = -1;
let _swapTriggered = false;
let _xfading       = false;
let _preloadAbortController = null; // pour annuler le pré-chargement en cours

function _nextQueueIdx() {
  if (!queue.length) return -1;
  const ni = queueIdx + 1;
  if (ni < queue.length) return ni;
  if (repeat === 1) return 0;
  return -1;
}

/** Annule le pré-chargement en cours et nettoie l'état */
async function _cancelPreload() {
  if (_preloadAbortController) {
    _preloadAbortController.abort();
    _preloadAbortController = null;
  }
  const inactiveShaka = activePlayer === 1 ? shaka2 : shaka1;
  const inactiveAudio = activePlayer === 1 ? _audio2 : _audio1;
  try {
    inactiveAudio.pause();
    await inactiveShaka.unload();
  } catch(e) { /* silence — LOAD_INTERRUPTED attendu */ }
  _preloadedIdx = -1;
}

/** Pré-charge la piste suivante sur le lecteur inactif */
async function preloadNextTrack() {
  const ni = _nextQueueIdx();
  if (ni < 0) { _preloadedIdx = -1; return; }
  const t = queue[ni];
  if (!t) { _preloadedIdx = -1; return; }
  if (_preloadedIdx === ni) return; // déjà pré-chargé

  // Annule tout pré-chargement précédent
  await _cancelPreload();

  const inactiveShaka = activePlayer === 1 ? shaka2 : shaka1;
  const inactiveAudio = activePlayer === 1 ? _audio2 : _audio1;
  const ctrl = new AbortController();
  _preloadAbortController = ctrl;

  try {
    inactiveAudio.volume = 0;
    await inactiveShaka.load(t.deezerUrl || t.url);

    if (ctrl.signal.aborted) return; // annulé entre-temps
    _preloadAbortController = null;
    inactiveAudio.currentTime = 0;
    _preloadedIdx = ni;
    console.log('[Arya Dual] ✅ Pré-chargé :', t.title, '→ Player', activePlayer === 1 ? 2 : 1);
  } catch(e) {
    _preloadAbortController = null;
    // 7000 = LOAD_INTERRUPTED — normal lors d'un changement de piste
    if (e.code !== 7000 && !ctrl.signal.aborted) {
      console.warn('[Arya Dual] ⚠️ Pré-chargement échoué :', e.code || e);
    }
    _preloadedIdx = -1;
  }
}

/** Fondu croisé */
async function triggerCrossfade() {
  if (_xfading || _preloadedIdx < 0) return;
  const nextTrackData = queue[_preloadedIdx];
  if (!nextTrackData) return;

  _xfading = true;

  const oldAudio  = activePlayer === 1 ? _audio1 : _audio2;
  const newAudio  = activePlayer === 1 ? _audio2 : _audio1;
  const targetVol = oldAudio.volume > 0 ? oldAudio.volume : 0.8;
  const newQIdx   = _preloadedIdx;

  newAudio.currentTime = 0;
  newAudio.volume = 0;
  try { await newAudio.play(); } catch(e) { console.warn('[Arya Dual] play new:', e); }

  const steps  = 28;
  const stepMs = XFADE_DURATION / steps;
  for (let i = 1; i <= steps; i++) {
    await new Promise(r => setTimeout(r, stepMs));
    const p = i / steps;
    oldAudio.volume = targetVol * (1 - p);
    newAudio.volume = targetVol * p;
  }

  oldAudio.pause();
  oldAudio.volume = targetVol;

  activePlayer   = activePlayer === 1 ? 2 : 1;
  queueIdx       = newQIdx;
  currentId      = nextTrackData.id;
  _preloadedIdx  = -1;
  _xfading       = false;
  _swapTriggered = false;
  _preloadAbortController = null;

  updatePlayerUI(nextTrackData);
  highlightPlaying();
  broadcastTrack(nextTrackData);
  // Stats comptées à 50% via _onTimeUpdate — pas ici
  isPlaying = true;
  document.getElementById('btnPlay').textContent = '⏸';
  document.getElementById('pArt')?.classList.add('playing-pulse');
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
  _statLastTS = newAudio.currentTime;
  setTimeout(_updatePositionState, 100);

  console.log('[Arya Dual] 🔄 Swap → Player', activePlayer, '|', nextTrackData.title);

  await preloadNextTrack();
}
