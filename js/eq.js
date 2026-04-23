/* ═══════════════════════════════════════════════════════════
   EQ / WEB AUDIO ENGINE — Arya V6
   Chargé après audio-engine.js.

   API publique :
     setEqBand(idx, db)       — règle une bande (0-4)
     applyEqPreset(name)      — applique un preset
     resetEq()                — remet tout à 0 dB
     toggleNormalization(bool)— active/désactive le compresseur
     setPlaybackRate(rate)    — vitesse de lecture (0.5 → 2)
     cyclePlaybackRate()      — passe à la vitesse suivante
     renderEqPanel()          — sync l'UI du panneau EQ
═══════════════════════════════════════════════════════════ */


/* ─────────────────────────────────────────
   CLÉS LOCALSTORAGE
───────────────────────────────────────── */
const LS_EQ_BANDS = 'arya_eq_bands';
const LS_EQ_NORM  = 'arya_eq_norm';
const LS_EQ_RATE  = 'arya_eq_rate';


/* ─────────────────────────────────────────
   ÉTAT INTERNE
───────────────────────────────────────── */
let _audioCtx      = null;
let _gain1         = null;
let _gain2         = null;
let _filters1      = [];
let _filters2      = [];
let _compressor    = null;
let _normEnabled   = false;
let _webAudioReady = false;
let _currentRate   = 1;
let _eqValues      = [0, 0, 0, 0, 0]; // gains courants des 5 bandes (dB)


/* ─────────────────────────────────────────
   CHARGEMENT DES PRÉFÉRENCES
───────────────────────────────────────── */
(function _loadEqPrefs() {
  try {
    const savedBands = localStorage.getItem(LS_EQ_BANDS);
    if (savedBands) {
      const parsed = JSON.parse(savedBands);
      if (Array.isArray(parsed) && parsed.length === 5) _eqValues = parsed;
    }
    const savedNorm = localStorage.getItem(LS_EQ_NORM);
    if (savedNorm !== null) _normEnabled = savedNorm === 'true';

    const savedRate = localStorage.getItem(LS_EQ_RATE);
    if (savedRate !== null) _currentRate = parseFloat(savedRate) || 1;
  } catch (e) { /* localStorage indisponible */ }
})();


/* ─────────────────────────────────────────
   DÉFINITION DES BANDES EQ
───────────────────────────────────────── */
const EQ_BANDS = [
  { label: 'Sub',  freq: 60,    type: 'lowshelf'  },
  { label: 'Bass', freq: 250,   type: 'peaking'   },
  { label: 'Mid',  freq: 1000,  type: 'peaking'   },
  { label: 'Pres', freq: 4000,  type: 'peaking'   },
  { label: 'Air',  freq: 16000, type: 'highshelf'  },
];

/* ─────────────────────────────────────────
   PRESETS EQ
───────────────────────────────────────── */
const EQ_PRESETS = {
  'Flat':       [  0,  0,  0,  0,  0 ],
  'Bass+':      [  6,  4,  0, -1, -1 ],
  'Treble+':    [ -1, -1,  0,  4,  6 ],
  'Vocal':      [ -2,  0,  4,  3,  1 ],
  'Électro':    [  5,  3,  0,  2,  4 ],
  'Acoustique': [  2,  1,  0,  2,  3 ],
  'Jazz':       [  3,  2,  0,  2,  1 ],
  'Classique':  [  0,  0,  0,  2,  3 ],
};


/* ═══════════════════════════════════════════════════════════
   INITIALISATION WEB AUDIO
   Déclenchée au premier geste utilisateur (contrainte
   navigateur : AudioContext interdit sans interaction).
═══════════════════════════════════════════════════════════ */

function _initWebAudio() {
  if (_webAudioReady) return;

  try {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    /* Sources MediaElement — branche les <audio> dans le graphe */
    const src1 = _audioCtx.createMediaElementSource(_audio1);
    const src2 = _audioCtx.createMediaElementSource(_audio2);

    /* GainNodes — remplacent le .volume natif */
    _gain1 = _audioCtx.createGain();
    _gain2 = _audioCtx.createGain();
    _gain1.gain.value = _audio1.volume;
    _gain2.gain.value = _audio2.volume;

    /* Chaînes de filtres EQ — une par lecteur */
    function _makeBands() {
      return EQ_BANDS.map(b => {
        const f = _audioCtx.createBiquadFilter();
        f.type            = b.type;
        f.frequency.value = b.freq;
        f.Q.value         = 1.4;
        f.gain.value      = 0;
        return f;
      });
    }
    _filters1 = _makeBands();
    _filters2 = _makeBands();

    /* Compresseur dynamique (normalisation perceptuelle) */
    _compressor = _audioCtx.createDynamicsCompressor();
    _compressor.threshold.value = -24;
    _compressor.knee.value      =  30;
    _compressor.ratio.value     =   1; // neutre par défaut
    _compressor.attack.value    =  0.003;
    _compressor.release.value   =  0.25;

    /* Connexion : src → gain → [EQ × 5] → compressor → destination */
    function _connectChain(src, gain, filters) {
      src.connect(gain);
      let node = gain;
      filters.forEach(f => { node.connect(f); node = f; });
      node.connect(_compressor);
    }
    _connectChain(src1, _gain1, _filters1);
    _connectChain(src2, _gain2, _filters2);
    _compressor.connect(_audioCtx.destination);

    /* ─────────────────────────────────────────
       Override .volume sur les deux <audio>
       Tout le code existant (crossfade, setVol)
       continue de fonctionner sans modification.
    ───────────────────────────────────────── */
    [{ el: _audio1, gain: _gain1 }, { el: _audio2, gain: _gain2 }].forEach(({ el, gain }) => {
      let _vol = el.volume;
      Object.defineProperty(el, 'volume', {
        get() { return _vol; },
        set(v) {
          _vol = Math.max(0, Math.min(1, v));
          if (gain) gain.gain.value = _vol;
        },
        configurable: true,
      });
    });

    _webAudioReady = true;

    /* Restaure les préférences persistées */
    _eqValues.forEach((db, i) => {
      _filters1[i].gain.value = db;
      _filters2[i].gain.value = db;
    });

    if (_normEnabled) {
      _compressor.ratio.value     = 12;
      _compressor.threshold.value = -24;
    }

    _audio1.playbackRate = _currentRate;
    _audio2.playbackRate = _currentRate;

    /* Sync UI */
    _refreshEqUI();
    const rateLabel = document.getElementById('playbackRateLabel');
    if (rateLabel) rateLabel.textContent = _currentRate === 1 ? '1×' : _currentRate + '×';
    document.querySelectorAll('.rate-btn').forEach(btn => {
      btn.classList.toggle('on', parseFloat(btn.dataset.rate) === _currentRate);
    });
    const btnNorm = document.getElementById('btnNorm');
    if (btnNorm) btnNorm.classList.toggle('on', _normEnabled);

  } catch (e) {
    console.warn('[Arya EQ] Web Audio non disponible :', e);
  }
}

/* Déclenche l'init au premier geste utilisateur */
['click', 'touchstart', 'keydown'].forEach(evt =>
  document.addEventListener(evt, _initWebAudio, { once: true, passive: true })
);


/* ═══════════════════════════════════════════════════════════
   CONTRÔLES EQ
═══════════════════════════════════════════════════════════ */

/**
 * Règle le gain d'une bande EQ (appliqué aux 2 lecteurs).
 * @param {number} bandIdx - 0 à 4
 * @param {number} gainDb  - -12 à +12 dB
 */
function setEqBand(bandIdx, gainDb) {
  if (!_webAudioReady) return;
  const db = Math.max(-12, Math.min(12, gainDb));
  _filters1[bandIdx].gain.value = db;
  _filters2[bandIdx].gain.value = db;
  _eqValues[bandIdx] = db;
  try { localStorage.setItem(LS_EQ_BANDS, JSON.stringify(_eqValues)); } catch (e) {}
}

/**
 * Applique un preset EQ par son nom.
 * @param {string} name - clé de EQ_PRESETS
 */
function applyEqPreset(name) {
  const preset = EQ_PRESETS[name];
  if (!preset) return;
  preset.forEach((db, i) => setEqBand(i, db));
  _eqValues = [...preset];
  try { localStorage.setItem(LS_EQ_BANDS, JSON.stringify(_eqValues)); } catch (e) {}
  _refreshEqUI();
}

/** Remet toutes les bandes à 0 dB (preset Flat). */
function resetEq() {
  applyEqPreset('Flat');
}


/* ═══════════════════════════════════════════════════════════
   NORMALISATION
═══════════════════════════════════════════════════════════ */

/**
 * Active/désactive la normalisation du volume
 * via le compresseur dynamique.
 * @param {boolean} enabled
 */
function toggleNormalization(enabled) {
  _normEnabled = !!enabled;
  try { localStorage.setItem(LS_EQ_NORM, _normEnabled); } catch (e) {}

  if (_webAudioReady && _compressor) {
    if (_normEnabled) {
      _compressor.ratio.value     = 12;
      _compressor.threshold.value = -24;
    } else {
      _compressor.ratio.value     =  1; // ratio 1:1 = neutre (bypass)
      _compressor.threshold.value =  0;
    }
  }

  const btn = document.getElementById('btnNorm');
  if (btn) btn.classList.toggle('on', _normEnabled);
  toast(_normEnabled ? '🎚 Normalisation activée' : '🎚 Normalisation désactivée');
}


/* ═══════════════════════════════════════════════════════════
   VITESSE DE LECTURE
═══════════════════════════════════════════════════════════ */

const RATE_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/**
 * Définit la vitesse de lecture sur les 2 lecteurs.
 * @param {number} rate - 0.5 à 2
 */
function setPlaybackRate(rate) {
  const r = Math.min(2, Math.max(0.5, parseFloat(rate)));
  _currentRate = r;
  try { localStorage.setItem(LS_EQ_RATE, r); } catch (e) {}

  _audio1.playbackRate = r;
  _audio2.playbackRate = r;

  const label = document.getElementById('playbackRateLabel');
  if (label) label.textContent = r === 1 ? '1×' : r + '×';

  document.querySelectorAll('.rate-btn').forEach(btn => {
    btn.classList.toggle('on', parseFloat(btn.dataset.rate) === r);
  });

  if (r !== 1) toast('⏩ Vitesse : ' + r + '×');
}

/** Passe à la vitesse suivante dans RATE_STEPS (cyclique). */
function cyclePlaybackRate() {
  const idx  = RATE_STEPS.indexOf(_currentRate);
  const next = RATE_STEPS[(idx + 1) % RATE_STEPS.length];
  setPlaybackRate(next);
}


/* ═══════════════════════════════════════════════════════════
   UI — SYNC PANNEAU EQ
═══════════════════════════════════════════════════════════ */

/** Met à jour les sliders et valeurs affichées dans le panneau EQ. */
function _refreshEqUI() {
  _eqValues.forEach((db, i) => {
    const slider = document.getElementById('eq-slider-' + i);
    const val    = document.getElementById('eq-val-' + i);
    if (slider) slider.value = db;
    if (val)    val.textContent = (db > 0 ? '+' : '') + db + ' dB';
  });
}

/** Alias public — conservé pour compatibilité avec fullscreen.js. */
function renderEqPanel() {
  _refreshEqUI();
}


/* ═══════════════════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════════════════ */

(function _injectEqStyles() {
  if (document.getElementById('eq-styles')) return;
  const s = document.createElement('style');
  s.id = 'eq-styles';
  s.textContent = `
    .eq-panel {
      padding: 12px 4px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .eq-section-title {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: .08em;
      text-transform: uppercase;
      opacity: .5;
      margin-bottom: 10px;
    }

    /* ── Presets ── */
    .eq-presets {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .preset-btn {
      padding: 5px 11px;
      border-radius: 20px;
      border: 1.5px solid rgba(255,255,255,.15);
      background: transparent;
      color: inherit;
      font-size: 12px;
      cursor: pointer;
      transition: background .15s, border-color .15s;
    }
    .preset-btn:hover,
    .preset-btn.on {
      background: var(--accent, #e91e8c);
      border-color: var(--accent, #e91e8c);
      color: #fff;
    }

    /* ── Sliders ── */
    .eq-sliders {
      display: flex;
      justify-content: space-around;
      align-items: center;
      gap: 4px;
      height: 180px;
      padding: 0 8px;
    }
    .eq-band {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      flex: 1;
    }
    .eq-val {
      font-size: 10px;
      opacity: .7;
      white-space: nowrap;
      min-height: 14px;
      text-align: center;
    }
    .eq-slider-wrap {
      height: 110px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .eq-slider {
      width: 110px;
      height: 4px;
      cursor: pointer;
      accent-color: var(--accent, #e91e8c);
      transform: rotate(-90deg);
      transform-origin: center center;
    }
    .eq-label { font-size: 11px; font-weight: 600; }
    .eq-freq  { font-size: 9px; opacity: .45; }
    .eq-reset {
      margin-top: 8px;
      font-size: 11px;
      padding: 4px 12px;
      border-radius: 20px;
      border: 1px solid rgba(255,255,255,.2);
      background: transparent;
      color: inherit;
      cursor: pointer;
      opacity: .6;
    }
    .eq-reset:hover { opacity: 1; }

    /* ── Normalisation ── */
    .eq-norm-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 13px;
      gap: 12px;
    }
    .toggle-btn {
      padding: 5px 14px;
      border-radius: 20px;
      border: 1.5px solid rgba(255,255,255,.2);
      background: transparent;
      color: inherit;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: all .15s;
      min-width: 52px;
    }
    .toggle-btn.on {
      background: var(--accent, #e91e8c);
      border-color: var(--accent, #e91e8c);
      color: #fff;
    }

    /* ── Vitesse ── */
    .rate-row {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .rate-btn {
      padding: 5px 12px;
      border-radius: 20px;
      border: 1.5px solid rgba(255,255,255,.15);
      background: transparent;
      color: inherit;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all .15s;
    }
    .rate-btn.on {
      background: var(--accent, #e91e8c);
      border-color: var(--accent, #e91e8c);
      color: #fff;
    }
  `;
  document.head.appendChild(s);
})();
