/* ══════════════════════════════════════════════
   SLEEP TIMER — Arya v5.1
   FIX : popstate FS player + bouton mobile visible
══════════════════════════════════════════════ */

let _slTO    = null;
let _slTick  = null;
let _slEnd   = 0;
let _slNext  = false;
let _slDoing = false;

const _SL_PRESETS = [15, 20, 30, 45, 60, 90];

/* ══ Core ══ */

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
  _slEnd = 0; _slNext = false;
  _updateSleepUI();
  if (!silent && wasActive) toast('⏰ Minuterie annulée');
}

async function _doSleep() {
  if (_slDoing) return;
  _slDoing = true;
  _clearSl(true);
  await Promise.all([_audio1, _audio2].map(a => {
    if (a.paused || a.volume === 0) return Promise.resolve();
    return new Promise(res => {
      const ov = a.volume, STEPS = 25, MS = 2500 / STEPS;
      let step = 0;
      const id = setInterval(() => {
        a.volume = ov * (1 - ++step / STEPS);
        if (step >= STEPS) {
          clearInterval(id);
          a.pause();
          setTimeout(() => { a.volume = ov; }, 200);
          res();
        }
      }, MS);
    });
  }));
  toast('😴 Bonne nuit !');
  _updateSleepUI();
  _slDoing = false;
}

function _slCheckBlock() {
  if (_slDoing) return true;
  if (!_slNext)  return false;
  _slNext = false;
  if (typeof _cancelPreload === 'function') _cancelPreload().catch(() => {});
  setTimeout(_doSleep, 60);
  return true;
}

(function () {
  const orig = window.playFromQueue;
  if (!orig || orig._slP) return;
  window.playFromQueue = function () { if (_slCheckBlock()) return; orig(); };
  window.playFromQueue._slP = true;
})();

(function () {
  const orig = window.triggerCrossfade;
  if (!orig || orig._slP) return;
  window.triggerCrossfade = async function () {
    if (_slCheckBlock()) return;
    return orig();
  };
  window.triggerCrossfade._slP = true;
})();

/* ══ UI ══ */

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
  if (lbl) { lbl.textContent = txt || ''; lbl.style.display = txt ? '' : 'none'; }
}

/* ══ Sheet ══ */

function openSleepSheet() {
  const on     = !!(_slEnd || _slNext);
  const txt    = _slRemainingText();
  const nowMin = _slEnd ? Math.round((_slEnd - Date.now()) / 60_000) : 0;

  const presets = _SL_PRESETS.map(m => {
    const label    = m < 60 ? m + ' min' : (m / 60) + 'h';
    const isActive = _slEnd && Math.abs(nowMin - m) < 5;
    return `<button onclick="startSleepTimer(${m});closeSleepSheet();"
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
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px;">${presets}</div>
      <button onclick="startSleepAfterTrack();closeSleepSheet();"
        style="width:100%;padding:13px;border-radius:12px;background:var(--card);
               border:1.5px solid ${_slNext ? 'var(--rose)' : 'var(--border)'};
               color:${_slNext ? 'var(--rose)' : 'var(--text2)'};
               font-size:13.5px;font-weight:500;cursor:pointer;font-family:'Outfit',sans-serif;
               margin-bottom:${on ? '10' : '0'}px;">
        🎵 Après la chanson courante
      </button>
      ${on ? `<button onclick="cancelSleepTimer();closeSleepSheet();"
        style="width:100%;padding:11px;border-radius:12px;background:var(--rose-glow);
               border:1px solid rgba(196,77,110,.35);color:var(--rose);
               font-size:13px;font-weight:600;cursor:pointer;font-family:'Outfit',sans-serif;">
        ✕ Annuler la minuterie</button>` : ''}
    </div>`;

  _openGenSheet('sleepSheet', html);
}

function closeSleepSheet() { _closeGenSheet('sleepSheet'); }

/* ══════════════════════════════════════════════
   FIX POPSTATE — Sheet générique FS-aware
   ──────────────────────────────────────────────
   AVANT : history.pushState systématique
   → popstate de fullscreen.js interceptait history.back()
     et fermait le FS player au lieu du sheet.

   MAINTENANT : si _fsOpen === true, on NE push pas dans
   l'historique. La fermeture se fait uniquement en CSS.
   On mémorise par sheet si un état a bien été pushé.
══════════════════════════════════════════════ */

const _genSheetHistPushed = {};

function _openGenSheet(id, html) {
  let bd = document.getElementById(id + 'Bd');
  let sh = document.getElementById(id);

  if (!bd) {
    bd = document.createElement('div');
    bd.id = id + 'Bd';
    bd.style.cssText =
      'position:fixed;inset:0;z-index:210;background:rgba(0,0,0,.65);' +
      'backdrop-filter:blur(4px);opacity:0;pointer-events:none;transition:opacity .22s;';
    bd.onclick = () => _closeGenSheet(id);
    document.body.appendChild(bd);

    sh = document.createElement('div');
    sh.id = id;
    sh.style.cssText =
      'position:fixed;bottom:0;left:0;right:0;z-index:211;' +
      'background:var(--bg2);border-top:1px solid var(--border);' +
      'border-radius:18px 18px 0 0;max-height:82vh;overflow-y:auto;' +
      'padding-bottom:max(20px,calc(10px + env(safe-area-inset-bottom,0px)));' +
      'transform:translateY(100%);transition:transform .28s cubic-bezier(.32,1,.23,1);';
    document.body.appendChild(sh);
  }

  sh.innerHTML =
    '<div style="width:36px;height:4px;border-radius:2px;' +
    'background:var(--border);margin:10px auto 14px;"></div>' + html;

  bd.style.pointerEvents = 'auto';
  requestAnimationFrame(() => {
    bd.style.opacity = '1';
    sh.style.transform = 'translateY(0)';
  });

  // ── FIX ──────────────────────────────────────
  // Ne pas pousser dans l'historique si on est
  // à l'intérieur du lecteur plein écran.
  // fullscreen.js écoute popstate et, quand
  // _fsOpen === true, ferme le FS player —
  // ce qui faisait "quitter" au lieu de fermer le sheet.
  const insideFs = !!window._fsOpen;
  _genSheetHistPushed[id] = !insideFs;
  if (!insideFs) {
    history.pushState({ arya: id }, '');
  }
  // ─────────────────────────────────────────────
}

function _closeGenSheet(id) {
  const bd = document.getElementById(id + 'Bd');
  const sh = document.getElementById(id);
  if (!sh) return;
  if (bd) { bd.style.opacity = '0'; bd.style.pointerEvents = 'none'; }
  sh.style.transform = 'translateY(100%)';

  // Ne pop que si on avait pushé un état pour ce sheet
  if (_genSheetHistPushed[id] && history.state?.arya === id) {
    _genSheetHistPushed[id] = false;
    history.back();
  }
}

/* ══ Injection boutons ══ */

function _injectSleepBtns() {
  /* ── FS Player : bouton 😴 avant les paroles ── */
  if (!document.getElementById('fsSleepBtn')) {
    const ref = document.getElementById('fsLyricsBtn');
    if (ref) {
      const b = document.createElement('button');
      b.id = 'fsSleepBtn';
      b.className = 'fs-btn';
      b.textContent = '😴';
      b.title = 'Minuterie de sommeil';
      b.onclick = openSleepSheet;
      ref.before(b);
    }
  }

  /* ── FS Player : label temps restant ── */
  if (!document.getElementById('fsSleepLabel')) {
    const vol = document.querySelector('#fsPlayer .fs-vol-wrap');
    if (vol) {
      const lbl = document.createElement('div');
      lbl.id = 'fsSleepLabel';
      lbl.style.cssText =
        'font-size:11px;color:rgba(255,255,255,.36);text-align:center;' +
        'letter-spacing:.06em;display:none;margin-top:-5px;';
      vol.before(lbl);
    }
  }

  /* ── Mini player mobile ──────────────────────────────────────
     btnParty est dans .p-right → display:none sur mobile.
     On injecte miniSleepBtn dans .p-btns (après btnNext),
     visible uniquement sur mobile via une règle CSS injectée.
     Sur desktop le FS player suffit (bouton caché par défaut).
  ────────────────────────────────────────────────────────────── */
  if (!document.getElementById('miniSleepBtn')) {
    // Cherche btnNext dans p-btns
    const refNext = document.getElementById('btnNext');
    if (refNext) {
      const b = document.createElement('button');
      b.id = 'miniSleepBtn';
      b.className = 'p-btn';
      b.textContent = '😴';
      b.title = 'Minuterie de sommeil';
      b.onclick = openSleepSheet;
      b.style.display = 'none'; // caché par défaut
      refNext.after(b);

      // Affiche sur mobile uniquement
      if (!document.getElementById('sl-mini-style')) {
        const s = document.createElement('style');
        s.id = 'sl-mini-style';
        s.textContent = '@media(max-width:640px){#miniSleepBtn{display:flex!important;}}';
        document.head.appendChild(s);
      }
    }
  }

  console.log('[Arya Sleep] ✅ Boutons injectés (v5.1)');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _injectSleepBtns);
} else {
  setTimeout(_injectSleepBtns, 150);
}
