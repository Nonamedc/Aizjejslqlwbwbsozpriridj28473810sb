/* ═══════════════════════════════════════════════════════════
   AUDIO-ENGINE.JS — Arya V7
   Double buffering Shaka Player + crossfade gapless.
   Mutex async pour éviter les races preload/swap/fade.
═══════════════════════════════════════════════════════════ */

/* ── AsyncMutex — serialize les opérations critiques ─────── */
class _AsyncMutex {
  constructor() { this._q = Promise.resolve(); }
  run(fn) {
    // Sérialise vraiment les opérations async — attend la fin de fn() avant de libérer
    const runPromise = this._q.then(async () => {
      return await fn();
    });
    // La prochaine op attend la fin de celle-ci (même si elle rejette)
    this._q = runPromise.catch(() => {});
    return runPromise;
  }
}
const _audioMutex   = new _AsyncMutex();  // pour preload/swap/play
const _preloadMutex = new _AsyncMutex();  // pour preloadNextTrack

const _audio1 = document.createElement('audio');
const _audio2 = document.createElement('audio');
let activePlayer  = 1;
let masterVolume  = 0.8;   // source de vérité volume — jamais el.volume directement

/** Met à jour masterVolume et applique aux deux players hors fade */
function setMasterVolume(v) {
  masterVolume = Math.max(0, Math.min(1, v));
  if (!_xfading) {
    _audio1.volume = masterVolume;
    _audio2.volume = masterVolume;
  }
}

/* Namespace public — évite la pollution window */
window.AryaAudio = {
  setVolume: setMasterVolume,
  getVolume: () => masterVolume,
};

[_audio1, _audio2].forEach((el, i) => {
  el.style.display = 'none';
  el.preload       = 'auto';
  el.crossOrigin   = 'anonymous';
  el.volume        = masterVolume;
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

/* ── Guard Shaka ─────────────────────────────────────────── */
const _shakaAvailable = typeof shaka !== 'undefined' && shaka !== null;

if (!_shakaAvailable) {
  console.error('[Arya Audio] Shaka Player indisponible — mode dégradé (cache uniquement)');
} else {
  try { shaka.polyfill.installAll(); } catch(e) { console.warn('[Arya Audio] polyfill:', e); }
}

const shaka1 = _shakaAvailable ? new shaka.Player() : null;
const shaka2 = _shakaAvailable ? new shaka.Player() : null;

const _setupShaka = async (player, el) => {
  if (!player || !_shakaAvailable) return;
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
  if (!_shakaAvailable) return;
  try {
    await Promise.all([_setupShaka(shaka1, _audio1), _setupShaka(shaka2, _audio2)]);
    console.log('[Arya] Double Engine Shaka', shaka.Player.version, 'activé');
  } catch(e) {
    console.error('[Arya Audio] Setup Shaka échoué:', e);
  }
})();


// visibilitychange — pause activité en arrière-plan SANS détruire les players
// (destroy causerait un crash au retour sur Android)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    // Annule le preload en cours pour libérer réseau/RAM
    _cancelPreload().catch(() => {});
    // Pas de destroy — l'app peut revenir au premier plan
  }
  // Rien à faire sur 'visible' — la lecture reprend naturellement
});


/* ═══════════════════════════════════════════════════════════
   HELPER — attend canplay
═══════════════════════════════════════════════════════════ */
function _waitCanPlay(el) {
  return new Promise((resolve, reject) => {
    if (el.readyState >= 3) { resolve(); return; }

    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('_waitCanPlay timeout'));
    }, 15000);

    const onPlay = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };

    const onError = (e) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(e?.target?.error || new Error('audio error'));
    };

    const cleanup = () => {
      clearTimeout(timeout);
      el.removeEventListener('canplay', onPlay);
      el.removeEventListener('error',   onError);
    };

    el.addEventListener('canplay', onPlay,  { once: true });
    el.addEventListener('error',   onError, { once: true });
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
        // Capture le pending courant pour éviter la race condition
        const pending = _shakaPendingLoad;
        if (pending) {
          try { await pending; } catch(e) {
            console.warn('[Arya audio] load failed before play:', e?.code || e);
          }
          // Nettoie seulement si c'est encore le même pending
          if (_shakaPendingLoad === pending) _shakaPendingLoad = null;
        }
        return el.play();
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

      // Révoque l'ancien blob si besoin (évite fuite mémoire)
      if (el._aryaBlobUrl) {
        URL.revokeObjectURL(el._aryaBlobUrl);
        el._aryaBlobUrl = null;
      }

      // Assigné SYNCHRONEMENT — audio.play() attendra toujours
const _thisLoad = (async () => {
        try {
          const blobUrl = (typeof CacheManager !== 'undefined' && CacheManager.isEnabled())
            ? await CacheManager.getOrFetch(value, _filename)
            : null;

          if (blobUrl) {
            // ✅ Cache disponible — bypass Shaka
            console.log('[Arya Cache] 💾 Lecture hors ligne :', _filename);
            el._aryaBlobUrl = blobUrl;
            el.src = blobUrl;
            el.load();
            await _waitCanPlay(el);

          } else if (_shakaAvailable && sh) {
            // 🌐 Shaka avec timeout 20s
            let _loadTimer;
            const loadTimeout = new Promise((_, rej) => {
              _loadTimer = setTimeout(() => rej(new Error('shaka.load timeout')), 20000);
            });
            try {
              await Promise.race([sh.load(value), loadTimeout]);
            } catch(e) {
              // Si timeout → unload pour arrêter le ghost load
              if (e.message === 'shaka.load timeout') {
                sh.unload().catch(() => {});
              }
              throw e;
            } finally {
              clearTimeout(_loadTimer);
            }
            if (typeof CacheManager !== 'undefined' && CacheManager.isEnabled()) {
              CacheManager.cacheAfterPlay(value, _filename);
            }
          } else {
            // Shaka indisponible — fallback src direct
            el.src = value;
            el.load();
            await _waitCanPlay(el);
          }
        } catch (err) {
          if (err && err.code !== 7000) {
            console.warn('[Arya Shaka] Erreur chargement :', err.message || err.code || err);
            if (!navigator.onLine) toast('📶 Piste non disponible hors ligne', true);
          }
          throw err;
        } finally {
          // Nettoie seulement si c'est encore ce load qui est en cours
          if (_shakaPendingLoad === _thisLoad) _shakaPendingLoad = null;
        }
      })();
      _shakaPendingLoad = _thisLoad;

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
  audio.play().catch(e => {
    console.warn('[Arya Dual] swap play failed:', e?.name || e);
  });
}


/* ═══════════════════════════════════════════════════════════
   CROSSFADE / GAPLESS ENGINE
═══════════════════════════════════════════════════════════ */

const XFADE_TRIGGER  = 10;
const XFADE_DURATION = 1400;

let _preloadedIdx           = -1;
let _preloadedUrl           = null;   // comparaison URL réelle pour éviter double preload
let _preloadSession         = 0;      // token session — invalide les preloads obsolètes
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
    if (inactiveShaka) await inactiveShaka.unload();
    // Révoque le blob si présent
    if (inactiveAudio._aryaBlobUrl) {
      URL.revokeObjectURL(inactiveAudio._aryaBlobUrl);
      inactiveAudio._aryaBlobUrl = null;
    }
  } catch {}
  _preloadedIdx = -1;
  _preloadedUrl = null;
}

async function preloadNextTrack() {
  return _preloadMutex.run(_doPreload);
}

async function _doPreload() {
  const ni = _nextQueueIdx();
  if (ni < 0) { _preloadedIdx = -1; return; }
  const t = queue[ni];
  if (!t) { _preloadedIdx = -1; return; }
  const _pUrlCheck = (queue[ni]?.deezerUrl || queue[ni]?.url) ?? null;
  if (_preloadedIdx === ni && _preloadedUrl === _pUrlCheck) return;

  await _cancelPreload();

  // Recalcule l'index après l'await — queue peut avoir changé
  const niAfter = _nextQueueIdx();
  if (niAfter !== ni) { _preloadedIdx = -1; _preloadedUrl = null; return; }

  // Snapshot du player actif + token session
  // Si un swap arrive pendant le preload, les deux checks invalident l'opération
  const session       = ++_preloadSession;
  const playerAtStart = activePlayer;

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

    if (ctrl.signal.aborted || session !== _preloadSession || playerAtStart !== activePlayer) return;

    if (_pBlob) {
      // ✅ Cache disponible — bypass Shaka
      console.log('[Arya Cache] 💾 Pré-chargement hors ligne :', _pFile);
      // Révoque l'ancien blob de l'audio inactif
      if (inactiveAudio._aryaBlobUrl) {
        URL.revokeObjectURL(inactiveAudio._aryaBlobUrl);
      }
      inactiveAudio._aryaBlobUrl = _pBlob;
      inactiveAudio.src = _pBlob;
      inactiveAudio.load();
      await _waitCanPlay(inactiveAudio);

    } else if (_shakaAvailable && inactiveShaka) {
      // 🌐 En ligne → Shaka normal + prefetch cache
      let _preloadTimer;
      const loadTimeout = new Promise((_, rej) => {
        _preloadTimer = setTimeout(() => rej(new Error('preload shaka timeout')), 20000);
      });
      try {
        await Promise.race([inactiveShaka.load(_pUrl), loadTimeout]);
      } catch(e) {
        if (e.message === 'preload shaka timeout') {
          inactiveShaka.unload().catch(() => {});
        }
        throw e;
      } finally {
        clearTimeout(_preloadTimer);
      }
      if (ctrl.signal.aborted || session !== _preloadSession || playerAtStart !== activePlayer) return;
      if (typeof CacheManager !== 'undefined' && CacheManager.isEnabled()) {
        CacheManager.prefetch(_pUrl, _pFile);
      }
    } else {
      // Shaka indisponible — fallback src direct
      inactiveAudio.src = _pUrl;
      inactiveAudio.load();
      await _waitCanPlay(inactiveAudio);
    }

    if (ctrl.signal.aborted || session !== _preloadSession || playerAtStart !== activePlayer) return;

    _preloadAbortController   = null;
    try { inactiveAudio.currentTime = 0; } catch {}
    _preloadedIdx             = ni;
    _preloadedUrl             = _pUrl;
  } catch (e) {
    _preloadAbortController = null;
    if (e.code !== 7000 && !ctrl.signal.aborted) {
      console.warn('[Arya Dual] Pré-chargement échoué :', e.code || e);
    }
    _preloadedIdx = -1;
  }
}

async function triggerCrossfade() {
  return _audioMutex.run(_doCrossfade);
}

async function _doCrossfade() {
  if (_xfading || _preloadedIdx < 0) return;
  const nextTrack = queue[_preloadedIdx];
  if (!nextTrack) return;

  const oldAudio  = activePlayer === 1 ? _audio1 : _audio2;
  const newAudio  = activePlayer === 1 ? _audio2 : _audio1;
  const newQIdx   = _preloadedIdx;

  _xfading = true;   // posé ici pour que le finally puisse toujours le reset
  try { newAudio.currentTime = 0; } catch {}
  newAudio.volume = 0;
  try { await newAudio.play(); } catch (e) {
    console.warn('[Arya Dual] play failed before fade:', e?.name || e);
    _xfading = false;
    return;
  }

  // Crossfade via requestAnimationFrame
  // masterVolume = source de vérité, jamais les éléments audio directement
  try {
  await new Promise(resolve => {
    const startTime    = performance.now();
    let _rafId, _settled = false;
    const _done = () => {
      if (_settled) return;
      _settled = true;
      clearTimeout(_safetyTimer);
      cancelAnimationFrame(_rafId);
      resolve();
    };
    const _safetyTimer = setTimeout(_done, XFADE_DURATION + 500);

    function _frame(now) {
      const elapsed = Math.min(now - startTime, XFADE_DURATION);
      const p       = elapsed / XFADE_DURATION;

      oldAudio.volume = Math.max(0, masterVolume * (1 - p));
      newAudio.volume = Math.max(0, masterVolume * p);

      if (p < 1) {
        _rafId = requestAnimationFrame(_frame);
      } else {
        _done();
      }
    }
    _rafId = requestAnimationFrame(_frame);
  });

  oldAudio.pause();
  // Restaure les volumes master après le fade
  _audio1.volume = masterVolume;
  _audio2.volume = masterVolume;

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
  } finally {
    _xfading = false;
  }
}
