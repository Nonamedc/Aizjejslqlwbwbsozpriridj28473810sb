
/* ═══════════════════════════════════════════
   SHAKA PLAYER — Web ExoPlayer Integration
   Remplace le lecteur natif HTML5 <audio> par
   le moteur adaptatif de Google (DASH / HLS /
   MP3 / FLAC / OGG / WAV / M4A) avec buffer
   intelligent, reprise sur erreur et retry.
═══════════════════════════════════════════ */

// Élément <audio> caché utilisé comme backend par Shaka
/* ═══════════════════════════════════════════
   MOTEURS AUDIO (DOUBLE BUFFERING) - ARYA v5
═══════════════════════════════════════════ */

// 1. Création des deux éléments audio physiques
const _audio1 = document.createElement('audio');
const _audio2 = document.createElement('audio');
let activePlayer = 1; // Pivot : 1 ou 2

[_audio1, _audio2].forEach((el, i) => {
  el.style.display = 'none';
  el.preload = 'auto';
  el.volume = 0.8;
  // Nécessaire pour iOS : garde l'audio actif en arrière-plan et écran verrouillé
  el.setAttribute('playsinline', '');
  el.setAttribute('webkit-playsinline', '');
  el.setAttribute('x-webkit-airplay', 'allow');
  document.body.appendChild(el);
  
  // Indicateur de buffering lié au lecteur actif
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

// Install polyfills
shaka.polyfill.installAll();

// 2. Instanciation des deux Shaka Players
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
    console.warn('[Shaka] Erreur:', e.code, e.message);
    if (e.category === shaka.util.Error.Category.NETWORK) {
      toast('⚠️ Interruption réseau...', true);
    } else {
      toast('⚠️ Erreur (' + e.code + ')', true);
    }
  });
};

// Initialisation asynchrone des deux moteurs
(async () => {
  await Promise.all([setupShaka(shaka1, _audio1), setupShaka(shaka2, _audio2)]);
})();

let _shakaPendingLoad = null;

/* ═══════════════════════════════════════════
   PROXY AUDIO (L'AIGUILLEUR DYNAMIQUE)
═══════════════════════════════════════════ */

var audio = new Proxy({}, {
  get(target, prop) {
    const el = activePlayer === 1 ? _audio1 : _audio2;
    const sh = activePlayer === 1 ? shaka1 : shaka2;

    // Intercepte play() pour attendre le chargement
    if (prop === 'play') {
      return async function() {
        if (_shakaPendingLoad) {
          try { await _shakaPendingLoad; } catch(e) {}
          _shakaPendingLoad = null;
        }
        return el.play().catch(e => console.warn('[audio play]', e));
      };
    }

    // Accès spécial pour charger sur le lecteur INACTIF (Preload)
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
          console.warn('[Shaka] Fallback natif:', err);
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
   FONCTION DE SWAP (À utiliser pour le Gapless)
═══════════════════════════════════════════ */
function swapAudioBridge() {
  const oldPlayer = activePlayer === 1 ? _audio1 : _audio2;
  oldPlayer.pause();
  
  // On change de cible
  activePlayer = activePlayer === 1 ? 2 : 1;
  
  // Le Proxy pointera maintenant sur le nouveau lecteur qui a déjà préchargé
  audio.play();
  console.log("Arya Engine: Switched to Player", activePlayer);
}

// Toast de confirmation
window.addEventListener('load', () => {
  if (shaka.Player.isBrowserSupported()) {
    console.log('[Arya] 🎬 Mode Double Engine Shaka ' + shaka.Player.version + ' activé');
  }
});

/* ═══════════════════════════════════════════
   GAPLESS / CROSSFADE ENGINE — Arya v5
   ─────────────────────────────────────────
   Player 1 joue → à t-10s : bascule sur P2
   P2 démarre en fondu → P1 précharge N+2
   P2 à t-8s → bascule sur P1, P2 précharge N+3
═══════════════════════════════════════════ */

const XFADE_TRIGGER  = 10;   // secondes restantes pour déclencher le swap
const XFADE_DURATION = 1400; // ms du fondu croisé

let _preloadedIdx  = -1;    // queueIdx de la piste pré-chargée sur l'inactif
let _swapTriggered = false;  // empêche le double déclenchement
let _xfading       = false;  // fondu en cours

/** Retourne le prochain queueIdx (-1 si aucun) */
function _nextQueueIdx() {
  if (!queue.length) return -1;
  const ni = queueIdx + 1;
  if (ni < queue.length) return ni;
  if (repeat === 1) return 0;
  return -1;
}

/** Pré-charge la piste suivante sur le lecteur inactif */
async function preloadNextTrack() {
  const ni = _nextQueueIdx();
  if (ni < 0) { _preloadedIdx = -1; return; }
  const t = queue[ni];
  if (!t) { _preloadedIdx = -1; return; }

  const inactiveShaka = activePlayer === 1 ? shaka2 : shaka1;
  const inactiveAudio = activePlayer === 1 ? _audio2 : _audio1;

  try {
    inactiveAudio.volume = 0;
    await inactiveShaka.load(t.deezerUrl || t.url);
    inactiveAudio.currentTime = 0;
    _preloadedIdx = ni;
    console.log('[Arya Dual] ✅ Pré-chargé :', t.title, '→ Player', activePlayer === 1 ? 2 : 1);
  } catch(e) {
    console.warn('[Arya Dual] ⚠️ Pré-chargement échoué :', e);
    _preloadedIdx = -1;
  }
}

/** Fondu croisé : bascule de l'actif vers l'inactif pré-chargé */
async function triggerCrossfade() {
  if (_xfading || _preloadedIdx < 0) return;
  const nextTrackData = queue[_preloadedIdx];
  if (!nextTrackData) return;

  _xfading = true;

  const oldAudio  = activePlayer === 1 ? _audio1 : _audio2;
  const newAudio  = activePlayer === 1 ? _audio2 : _audio1;
  const targetVol = oldAudio.volume > 0 ? oldAudio.volume : 0.8;
  const newQIdx   = _preloadedIdx;

  // Démarre le nouveau lecteur (déjà chargé)
  newAudio.currentTime = 0;
  newAudio.volume = 0;
  try { await newAudio.play(); } catch(e) { console.warn('[Arya Dual] play new:', e); }

  // Fondu croisé progressif
  const steps  = 28;
  const stepMs = XFADE_DURATION / steps;
  for (let i = 1; i <= steps; i++) {
    await new Promise(r => setTimeout(r, stepMs));
    const p = i / steps;
    oldAudio.volume = targetVol * (1 - p);
    newAudio.volume = targetVol * p;
  }

  // Stop ancien lecteur et remet son volume pour la prochaine fois
  oldAudio.pause();
  oldAudio.volume = targetVol;

  // Bascule l'état global
  activePlayer   = activePlayer === 1 ? 2 : 1;
  queueIdx       = newQIdx;
  currentId      = nextTrackData.id;
  _preloadedIdx  = -1;
  _xfading       = false;
  _swapTriggered = false;

  // Mise à jour UI
  updatePlayerUI(nextTrackData);
  highlightPlaying();
  broadcastTrack(nextTrackData);
  addToHistory(nextTrackData);
  recordPlay(nextTrackData);
  isPlaying = true;
  document.getElementById('btnPlay').textContent = '⏸';
  document.getElementById('pArt')?.classList.add('playing-pulse');
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
  _statLastTS = newAudio.currentTime;
  setTimeout(_updatePositionState, 100);

  console.log('[Arya Dual] 🔄 Swap → Player', activePlayer, '|', nextTrackData.title);

  // Pré-charge le suivant sur l'ancien lecteur (maintenant inactif)
  await preloadNextTrack();
}

