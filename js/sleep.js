/* ═══════════════════════════════════════════════════════════
   SLEEP.JS — Arya v2
   Minuterie de sommeil avec fondu progressif (2.5s).
   Patch transparent de playFromQueue et triggerCrossfade.

   Dépend de : config.js, utils.js, audio-engine.js,
               playback.js, fullscreen.js (pour _fsOpen)
═══════════════════════════════════════════════════════════ */

let _slTO    = null;  // setTimeout de fin
let _slTick  = null;  // setInterval de refresh UI
let _slEnd   = 0;     // timestamp de fin (ms)
let _slNext  = false; // pause après la piste courante
let _slDoing = false; // fondu en cours

const _SL_PRESETS = [15, 20, 30, 45, 60, 90]; // minutes


/* ═══════════════════════════════════════════════════════════
   CORE
═══════════════════════════════════════════════════════════ */

function startSleepTimer(min) {
  _clearSl(true);
  _slNext = false;
  _slEnd  = Date.now() + min * 60_000;
  _slTO   = setTimeout(_doSleep, min * 60_000);
  _slTick = setInterval(_updateSleepUI, 15_000);
  toast(`😴 Pause dans ${min < 60 ? min + ' min' : min / 60 + 'h'}`);
  _updateSleepUI();
}

function startSleepAfterTrack() {
  _clearSl(true);
  _slNext = true;
  toast('😴 Pause après la chanson courante');
  _updateSleepUI();
}

function cancelSleepTimer() { _clearSl(); }

function _clearSl(silent = false) {
  if (_slTO)   { clearTimeout(_slTO);    _slTO   = null; }
  if (_slTick) { clearInterval(_slTick); _slTick = null; }
  const wasActive = _slEnd > 0 || _slNext;
  _slEnd  = 0;
  _slNext = false;
  _updateSleepUI();
  if (!silent && wasActive) toast('⏰ Minuterie annulée');
}

async function _doSleep() {
  if (_slDoing) return;
  _slDoing = true;
  _clearSl(true);

  // Fondu progressif sur les 2 lecteurs en parallèle
  await Promise.all([_audio1, _audio2].map(a => {
    if (a.paused || a.volume === 0) return Promise.resolve();
    return new Promise(res => {
      const ov    = a.volume;
      const STEPS = 25;
      const MS    = 2500 / STEPS;
      let step    = 0;
      const id    = setInterval(() => {
        a.volume = ov * (1 - ++step / STEPS);
        if (step >= STEPS) {
          clearInterval(id);
          a.pause();
          setTimeout(() => { a.volume = ov; }, 200); // restaure le volume pour la prochaine lecture
          res();
        }
      }, MS);
    });
  }));

  toast('😴 Bonne nuit !');
  _updateSleepUI();
  _slDoing = false;
}

/** Vérifie si la minuterie "après piste" doit bloquer la prochaine lecture. */
function _slCheckBlock() {
  if (_slDoing) return true;
  if (!_slNext) return false;
  _slNext = false;
  if (typeof _cancelPreload === 'function') _cancelPreload().catch(() => {});
  setTimeout(_doSleep, 60);
  return true;
}

/* Patch playFromQueue — bloque si minuterie "fin de chanson" */
(function () {
  const orig = window.playFromQueue;
  if (!orig || orig._slP) return;
  window.playFromQueue = function () { if (_slCheckBlock()) return; orig(); };
  window.playFromQueue._slP = true;
})();

/* Patch triggerCrossfade — bloque le gapless si minuterie active */
(function () {
  const orig = window.triggerCrossfade;
  if (!orig || orig._slP) return;
  window.triggerCrossfade = async function () {
    if (_slCheckBlock()) return;
    return orig();
  };
  window.triggerCrossfade._slP = true;
})();


/* ═══════════════════════════════════════════════════════════
   UI
═══════════════════════════════════════════════════════════ */

function _slRemainingText() {
  if (_slNext) return '😴 Fin de chanson';
  if (!_slEnd) return null;
  const m = Math.max(0, Math.ceil((_slEnd - Date.now()) / 60_000));
  if (!m) return null;
  if (m < 60) return `😴 ${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return `😴 ${h}h${r ? r + 'min' : ''}`;
}

function _updateSleepUI() {
  const txt = _slRemainingText();
  const on  = !!(_slEnd || _slNext);

  ['fsSleepBtn', 'miniSleepBtn'].forEach(id => {
    const b = document.getElementById(id);
    if (!b) return;
    b.classList.toggle('on',   on);
    b.classList.toggle('rose', on);
    b.title = on ? `${txt} — Annuler` : 'Minuterie de sommeil';
  });

  const lbl = document.getElementById('fsSleepLabel');
  if (lbl) {
    lbl.textContent    = txt || '';
    lbl.style.display  = txt ? '' : 'none';
  }
}


/* ═══════════════════════════════════════════════════════════
   SHEET
═══════════════════════════════════════════════════════════ */

function openSleepSheet() {
  const on     = !!(_slEnd || _slNext);
  const txt    = _slRemainingText();
  const nowMin = _slEnd ? Math.round((_slEnd - Date.now()) / 60_000) : 0;

  const presets = _SL_PRESETS.map(m => {
    const label    = m < 60 ? m + ' min' : (m / 60) + 'h';
    const isActive = _slEnd && Math.abs(nowMin - m) < 5;
    return `
      <button onclick="startSleepTimer(${m});closeSleepSheet();"
              style="padding:14px 6px;border-radius:12px;background:var(--card);
                     border:1.5px solid ${isActive ? 'var(--rose)' : 'var(--border)'};
                     color:${isActive ? 'var(--rose)' : 'var(--text)'};
                     font-size:13.5px;font-weight:600;cursor:pointer;
                     font-family:'Outfit',sans-serif;">${label}</button>`;
  }).join('');

  const html = `
    <div style="padding:4px 18px 0;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px;">
        <div>
          <div style="font-size:16px;font-weight:700;color:var(--text);">😴 Minuterie de sommeil</div>
          <div style="font-size:12px;color:${on ? 'var(--rose)' : 'var(--text3)'};margin-top:4px;line-height:1.6;">
            ${on
              ? `${txt}&ensp;·&ensp;<span style="cursor:pointer;text-decoration:underline;"
                    onclick="cancelSleepTimer();closeSleepSheet();">Annuler</span>`
              : 'Fondu progressif de 2.5s avant la pause'}
          </div>
        </div>
        <button onclick="closeSleepSheet()"
                style="background:none;border:none;color:var(--text3);font-size:22px;
                       cursor:pointer;line-height:1;padding:4px;margin-top:-2px;">×</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px;">
        ${presets}
      </div>
      <button onclick="startSleepAfterTrack();closeSleepSheet();"
              style="width:100%;padding:13px;border-radius:12px;background:var(--card);
                     border:1.5px solid ${_slNext ? 'var(--rose)' : 'var(--border)'};
                     color:${_slNext ? 'var(--rose)' : 'var(--text2)'};
                     font-size:13.5px;font-weight:500;cursor:pointer;
                     font-family:'Outfit',sans-serif;
                     margin-bottom:${on ? '10' : '0'}px;">
        🎵 Après la chanson courante
      </button>
      ${on ? `
      <button onclick="cancelSleepTimer();closeSleepSheet();"
              style="width:100%;padding:11px;border-radius:12px;background:var(--rose-glow);
                     border:1px solid rgba(196,77,110,.35);color:var(--rose);
                     font-size:13px;font-weight:600;cursor:pointer;
                     font-family:'Outfit',sans-serif;">
        ✕ Annuler la minuterie
      </button>` : ''}
    </div>`;

  _openGenSheet('sleepSheet', html);
}

function closeSleepSheet() { _closeGenSheet('sleepSheet'); }


/* ═══════════════════════════════════════════════════════════
   GENERIC SHEET — délégué à utils.js (_openGenSheet / _closeGenSheet)
   Si _fsOpen === true, utils.js ne push PAS dans l'historique.
═══════════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════════
   INJECTION DES BOUTONS DANS LE DOM
═══════════════════════════════════════════════════════════ */

function _injectSleepBtns() {
  // Bouton dans le lecteur plein écran (avant les paroles)
  if (!document.getElementById('fsSleepBtn')) {
    const ref = document.getElementById('fsLyricsBtn');
    if (ref) {
      const b = Object.assign(document.createElement('button'), {
        id:        'fsSleepBtn',
        className: 'fs-btn',
        textContent: '😴',
        title:     'Minuterie de sommeil',
        onclick:   openSleepSheet,
      });
      ref.before(b);
    }
  }

  // Label temps restant dans le lecteur plein écran
  if (!document.getElementById('fsSleepLabel')) {
    const vol = document.querySelector('#fsPlayer .fs-vol-wrap');
    if (vol) {
      const lbl = Object.assign(document.createElement('div'), { id: 'fsSleepLabel' });
      lbl.style.cssText =
        'font-size:11px;color:rgba(255,255,255,.36);text-align:center;' +
        'letter-spacing:.06em;display:none;margin-top:-5px;';
      vol.before(lbl);
    }
  }

  // Bouton dans le mini player mobile (après btnNext, visible via media query)
  if (!document.getElementById('miniSleepBtn')) {
    const refNext = document.getElementById('btnNext');
    if (refNext) {
      const b = Object.assign(document.createElement('button'), {
        id:          'miniSleepBtn',
        className:   'p-btn',
        textContent: '😴',
        title:       'Minuterie de sommeil',
        onclick:     openSleepSheet,
      });
      b.style.display = 'none'; // caché par défaut, révélé par la media query
      refNext.after(b);

      if (!document.getElementById('sl-mini-style')) {
        const s = Object.assign(document.createElement('style'), {
          id:          'sl-mini-style',
          textContent: '@media(max-width:640px){#miniSleepBtn{display:flex!important;}}',
        });
        document.head.appendChild(s);
      }
    }
  }
}

// Injecte dès que le DOM est prêt
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _injectSleepBtns);
} else {
  setTimeout(_injectSleepBtns, 150);
}
