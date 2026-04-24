/* ═══════════════════════════════════════════════════════════
   AUDIO-ENGINE.JS V8 — Arya
   Double buffering Shaka Player + crossfade gapless.
═══════════════════════════════════════════════════════════ */

const _audio1 = document.createElement('audio');
const _audio2 = document.createElement('audio');
let activePlayer = 1;

[_audio1, _audio2].forEach((el, i) => {
  el.style.display = 'none';
  el.preload       = 'auto';
  el.crossOrigin   = 'anonymous';
  el.volume        = 0.8;
  el.setAttribute('playsinline',          '');
  el.setAttribute('webkit-playsinline',   '');
  el.setAttribute('x-webkit-airplay', 'allow');
  document.body.appendChild(el);

  el.addEventListener('waiting', () => {
    if (activePlayer === i + 1) {
      const pArt = document.getElementById('pArt');
      if (pArt) pArt.style.opacity = '0.5';
    }
  });
  el.addEventListener('canplay', () => {
    if (activePlayer === i + 1) {
      const pArt = document.getElementById('pArt');
      if (pArt) pArt.style.opacity = '1';
    }
  });
});


/* ═══════════════════════════════════════════════════════════
   SHAKA PLAYER
═══════════════════════════════════════════════════════════ */

shaka.polyfill.installAll();

const shaka1 = new shaka.Player();
const shaka2 = new shaka.Player();

const _setupShaka = async (player, el) => {
  await player.attach(el);
  player.configure({
    streaming: {
      bufferingGoal:    30,
      rebufferingGoal:   2,
      bufferBehind:     30,
      stallEnabled:     true,
      stallThreshold:    1,
      stallSkip:       0.1,
      retryParameters: {
        maxAttempts:   4,
        baseDelay:     1000,
        backoffFactor: 2,
        fuzzFactor:    0.5,
        timeout:       20000,
      },
    },
    manifest: {
      retryParameters: { maxAttempts: 4, baseDelay: 1000, backoffFactor: 2 },
    },
  });

  player.addEventListener('error', event => {
    const e = event.detail;
    if (e.code === 7000) return;
    if (player !== (activePlayer === 1 ? shaka1 : shaka2)) return;
    console.warn('[Arya Shaka] Erreur:', e.code, e.message);
    if (e.category === shaka.util.Error.Category.NETWORK) {
      toast('⚠️ Interruption réseau…', true);
    }
  });
};

(async () => {
  await Promise.all([_setupShaka(shaka1, _audio1), _setupShaka(shaka2, _audio2)]);
})();

window.addEventListener('load', () => {
  if (shaka.Player.isBrowserSupported()) {
    console.log('[Arya] Double Engine Shaka ' + shaka.Player.version + ' activé');
  }
});


/* ═══════════════════════════════════════════════════════════
   HELPER — attend canplay
═══════════════════════════════════════════════════════════ */
function _waitCanPlay(el) {
  return new Promise(resolve => {
    if (el.readyState >= 3) { resolve(); return; }
    el.addEventListener('canplay', resolve, { once: true });
    el.addEventListener('error',   resolve, { once: true });
  });
}


/* ═══════════════════════════════════════════════════════════
   PROXY AUDIO
═══════════════════════════════════════════════════════════ */

let _shakaPendingLoad = null;

const audio = new Proxy({}, {
  get(target, prop) {
    const el = activePlayer === 1 ? _audio1 : _audio2;
    const sh = activePlayer === 1 ? shaka1  : shaka2;

    if (prop === 'play') {
      return async function () {
        if (_shakaPendingLoad) {
          try { await _shakaPendingLoad; } catch {}
          _shakaPendingLoad = null;
        }
        return el.play().catch(e => console.warn('[Arya audio.play]', e));
      };
    }

    if (prop === 'inactiveShaka') return activePlayer === 1 ? shaka2 : shaka1;
    if (prop === 'activeShaka')   return sh;

    const val = el[prop];
    return typeof val === 'function' ? val.bind(el) : val;
  },

  set(target, prop, value) {
    const el = activePlayer === 1 ? _audio1 : _audio2;
    const sh = activePlayer === 1 ? shaka1  : shaka2;

    if (prop === 'src' && value) {
      const _filename = value.split('/').pop().split('?')[0];

      // Assigné SYNCHRONEMENT — audio.play() attendra toujours
      _shakaPendingLoad = (async () => {
        try {
          const blobUrl = (typeof CacheManager !== 'undefined' && CacheManager.isEnabled())
            ? await CacheManager.getOrFetch(value, _filename)
            : null;

          if (blobUrl) {
            // ✅ Cache disponible — bypass Shaka
            console.log('[Arya Cache] 💾 Lecture hors ligne :', _filename);
            el.src = blobUrl;
            el.load();
            await _waitCanPlay(el);

          } else if (!navigator.onLine) {
            // ❌ Hors ligne + pas en cache
            console.warn('[Arya Cache] Hors ligne, non mis en cache :', _filename);
            toast('📶 Hors ligne — piste non disponible sans connexion', true);

          } else {
            // 🌐 En ligne → Shaka normal
            await sh.load(value);
            if (typeof CacheManager !== 'undefined' && CacheManager.isEnabled()) {
              CacheManager.cacheAfterPlay(value, _filename);
            }
          }
        } catch (err) {
          // Absorbe toutes les erreurs — ne jamais rejeter vers playback.js
          if (err && err.code !== 7000) {
            console.warn('[Arya Shaka] Erreur chargement :', err.code || err);
            if (!navigator.onLine) {
              toast('📶 Piste non disponible hors ligne', true);
            }
          }
        } finally {
          _shakaPendingLoad = null;
        }
      })();

      return true;
    }

    el[prop] = value;
    return true;
  },
});


/* ═══════════════════════════════════════════════════════════
   SWAP
═══════════════════════════════════════════════════════════ */

function swapAudioBridge() {
  const oldPlayer = activePlayer === 1 ? _audio1 : _audio2;
  oldPlayer.pause();
  activePlayer = activePlayer === 1 ? 2 : 1;
  audio.play();
}


/* ═══════════════════════════════════════════════════════════
   CROSSFADE / GAPLESS ENGINE
═══════════════════════════════════════════════════════════ */

const XFADE_TRIGGER  = 10;
const XFADE_DURATION = 1400;

let _preloadedIdx           = -1;
let _swapTriggered          = false;
let _xfading                = false;
let _preloadAbortController = null;

function _nextQueueIdx() {
  if (!queue.length) return -1;
  const ni = queueIdx + 1;
  if (ni < queue.length) return ni;
  if (repeat === 1) return 0;
  return -1;
}

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
  } catch {}
  _preloadedIdx = -1;
}

async function preloadNextTrack() {
  const ni = _nextQueueIdx();
  if (ni < 0) { _preloadedIdx = -1; return; }
  const t = queue[ni];
  if (!t) { _preloadedIdx = -1; return; }
  if (_preloadedIdx === ni) return;

  await _cancelPreload();

  const inactiveShaka = activePlayer === 1 ? shaka2 : shaka1;
  const inactiveAudio = activePlayer === 1 ? _audio2 : _audio1;
  const ctrl          = new AbortController();
  _preloadAbortController = ctrl;

  try {
    inactiveAudio.volume = 0;

    const _pUrl  = t.deezerUrl || t.url;
    const _pFile = _pUrl.split('/').pop().split('?')[0];

    const _pBlob = (typeof CacheManager !== 'undefined' && CacheManager.isEnabled())
      ? await CacheManager.getOrFetch(_pUrl, _pFile)
      : null;

    if (ctrl.signal.aborted) return;

    if (_pBlob) {
      // ✅ Cache disponible — bypass Shaka
      console.log('[Arya Cache] 💾 Pré-chargement hors ligne :', _pFile);
      inactiveAudio.src = _pBlob;
      inactiveAudio.load();
      await _waitCanPlay(inactiveAudio);

    } else if (!navigator.onLine) {
      // ❌ Hors ligne + pas en cache → abandon silencieux
      console.warn('[Arya Cache] Pré-chargement annulé (hors ligne) :', _pFile);
      _preloadedIdx = -1;
      return;

    } else {
      // 🌐 En ligne → Shaka normal + prefetch cache
      await inactiveShaka.load(_pUrl);
      if (ctrl.signal.aborted) return;
      if (typeof CacheManager !== 'undefined' && CacheManager.isEnabled()) {
        CacheManager.prefetch(_pUrl, _pFile);
      }
    }

    if (ctrl.signal.aborted) return;

    _preloadAbortController   = null;
    inactiveAudio.currentTime = 0;
    _preloadedIdx             = ni;
  } catch (e) {
    _preloadAbortController = null;
    if (e.code !== 7000 && !ctrl.signal.aborted) {
      console.warn('[Arya Dual] Pré-chargement échoué :', e.code || e);
    }
    _preloadedIdx = -1;
  }
}

async function triggerCrossfade() {
  if (_xfading || _preloadedIdx < 0) return;
  const nextTrack = queue[_preloadedIdx];
  if (!nextTrack) return;

  _xfading = true;

  const oldAudio  = activePlayer === 1 ? _audio1 : _audio2;
  const newAudio  = activePlayer === 1 ? _audio2 : _audio1;
  const targetVol = oldAudio.volume > 0 ? oldAudio.volume : 0.8;
  const newQIdx   = _preloadedIdx;

  newAudio.currentTime = 0;
  newAudio.volume      = 0;
  try { await newAudio.play(); } catch (e) { console.warn('[Arya Dual] play:', e); }

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
  currentId      = nextTrack.id;
  _preloadedIdx  = -1;
  _xfading       = false;
  _swapTriggered = false;
  _preloadAbortController = null;

  updatePlayerUI(nextTrack);
  highlightPlaying();
  broadcastTrack(nextTrack);

  isPlaying = true;
  document.getElementById('btnPlay').textContent = '⏸';
  document.getElementById('pArt')?.classList.add('playing-pulse');
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';

  _statLastTS = newAudio.currentTime;
  setTimeout(_updatePositionState, 100);

  await preloadNextTrack();
}
