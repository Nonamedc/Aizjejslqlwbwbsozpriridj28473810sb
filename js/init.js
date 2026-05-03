/* ═══════════════════════════════════════════════════════════
   INIT.JS — Arya
   Point d'entrée de l'application.
   Chargé en dernier, après tous les autres scripts.
═══════════════════════════════════════════════════════════ */

// Fallback safeInit si error-guard.js pas encore chargé
if (typeof safeInit === 'undefined') {
  window.safeInit = function(name, fn) {
    try { const r = fn(); if (r?.catch) r.catch(e => console.error('[Arya]', name, e)); }
    catch(e) { console.error('[Arya]', name, e); }
  };
}

// Construit les sous-namespaces Arya après chargement de tous les modules
safeInit('AryaNamespaces', () => window.Arya?._buildNamespaces?.());

// Auth gère tout : connexion → pseudo → fetchArchive → CacheManager → Flow
safeInit('Auth',      () => Auth.init());
safeInit('BlockList', () => BlockList.init());
safeInit('CacheManager', () => CacheManager?.init?.());


/* ═══════════════════════════════════════════════════════════
   🐺 EASTER EGGS — ARYA STARK
   // pas aujourd'hui
═══════════════════════════════════════════════════════════ */


/* ─── BRAISES (canvas) ─────────────────────────────────── */
safeInit('Embers', () => (function initEmbers() {
  const canvas = document.getElementById('emberCanvas');
  if (!canvas) return;

  const hr = new Date().getHours();
  window._emberEvening = hr >= 20 || hr < 7;

  const ctx = canvas.getContext('2d', { alpha: true });
  let W, H, particles = [], lastTime = 0;

  function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  function spawn(fromTop) {
    return {
      x:     Math.random() * W,
      y:     fromTop ? -10 : Math.random() * H,
      size:  Math.random() * 1.8 + 0.4,
      speed: Math.random() * 1.0 + 0.3,
      drift: (Math.random() - 0.5) * 0.5,
      alpha: Math.random() * 0.5 + 0.2,
      hue:   Math.random() * 30 + 8,
      life:  300 + Math.random() * 200,
    };
  }

  const baseCount = window._emberEvening ? 35 : 18;
  for (let i = 0; i < baseCount; i++) particles.push(spawn(false));
  window._emberIntense = false;

  let _emberPaused = false;
  document.addEventListener('visibilitychange', () => {
    _emberPaused = document.visibilityState === 'hidden';
  });

  function frame(ts) {
    if (_emberPaused) { requestAnimationFrame(frame); return; }
    ts = ts || 0;
    // Reset si lag important (onglet en arrière-plan / économie énergie)
    if (lastTime && ts - lastTime > 1500) {
      particles = [];
      for (let i = 0; i < baseCount; i++) particles.push(spawn(true));
    }
    lastTime = ts;
    ctx.clearRect(0, 0, W, H);

    const target = window._emberIntense ? 90 : baseCount;
    while (particles.length < target) particles.push(spawn(true));
    while (particles.length > target && particles.length > baseCount) particles.pop();

    const alphaScale = window._emberIntense ? 0.9 : (window._emberEvening ? 0.38 : 0.22);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.y -= p.speed;
      p.x += p.drift;
      p.life--;
      if (p.life <= 0 || p.y < -20) { particles[i] = spawn(true); continue; }

      ctx.save();
      ctx.globalAlpha = p.alpha * alphaScale;
      ctx.fillStyle   = `hsl(${p.hue},100%,${window._emberIntense ? 65 : 62}%)`;
      ctx.shadowColor = `hsl(${p.hue},100%,60%)`;
      ctx.shadowBlur  = window._emberIntense ? 9 : (window._emberEvening ? 4 : 2);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})());


/* ─── SAISON → COULEUR DE LA BARRE ────────────────────── */
(function applySeasonColor() {
  const m = new Date().getMonth();
  const c = m >= 2 && m <= 4  ? '#4ade80'  // Printemps — Vert
          : m >= 5 && m <= 7  ? '#c44d6e'  // Été — Rose
          : m >= 8 && m <= 10 ? '#d4a054'  // Automne — Or
          :                      '#9aa5b4'; // Hiver — Gris
  const s = document.createElement('style');
  s.textContent = `.p-fill,.p-fill::after,.fs-fill,.fs-fill::after,.top-bar-fill{background:${c}!important}`;
  document.head.appendChild(s);
})();


/* ─── 3:09 → NOCES POURPRES (S3E9) ────────────────────── */
let _316shown = false, _316active = false;

function check316(t) {
  if (Math.floor(t) !== 189 || _316shown) return;
  _316shown  = true;
  _316active = true;

  const el   = document.getElementById('pElapsed');
  const fsEl = document.getElementById('fsElapsed');
  if (!el) return;

  const origText  = el.textContent;
  const origStyle = el.style.cssText;
  const fsOrigText  = fsEl ? fsEl.textContent : '';
  const fsOrigStyle = fsEl ? fsEl.style.cssText : '';
  const pStyle = 'color:#9b30d4;font-size:9px;white-space:nowrap;font-weight:700;text-shadow:0 0 8px rgba(155,48,212,0.6);';

  el.textContent = '☠️ Noces Pourpres'; el.style.cssText = pStyle;
  if (fsEl) { fsEl.textContent = '☠️ Noces Pourpres'; fsEl.style.cssText = pStyle; }

  _launchBloodDrips();

  setTimeout(() => {
    el.textContent = origText || fmtTime(t); el.style.cssText = origStyle || '';
    if (fsEl) { fsEl.textContent = fsOrigText || fmtTime(t); fsEl.style.cssText = fsOrigStyle || ''; }
    _316active = false;
    _316shown  = false;
  }, 6000);
}

function _launchBloodDrips() {
  const canvas  = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9997;';
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const N = 18, drips = [];
  for (let i = 0; i < N; i++) {
    drips.push({
      x:       Math.random() * canvas.width,
      w:       4 + Math.random() * 10,
      speed:   60 + Math.random() * 160,
      delay:   Math.random() * 2000,
      wobble:  (Math.random() - 0.5) * 18,
      hue:     Math.floor(Math.random() * 10),
      sat:     80 + Math.random() * 20,
      y:       0,
      started: false,
      done:    false,
      startTime: null,
    });
  }

  let raf;
  const startTs  = performance.now();
  const LIFETIME = 7000;

  function drawBloodTrail(d) {
    if (!d.started || d.y <= 0) return;
    const h    = d.y;
    const grad = ctx.createLinearGradient(d.x, 0, d.x, h);
    grad.addColorStop(0,   `hsla(${d.hue},${d.sat}%,18%,0.95)`);
    grad.addColorStop(0.3, `hsla(${d.hue},${d.sat}%,28%,0.92)`);
    grad.addColorStop(0.7, `hsla(${d.hue},${d.sat}%,35%,0.85)`);
    grad.addColorStop(1,   `hsla(${d.hue},${d.sat}%,30%,0.6)`);

    const topW = d.w, botW = d.w * 0.55;
    const wx   = d.wobble * (h / canvas.height);
    ctx.beginPath();
    ctx.moveTo(d.x - topW / 2, 0);
    ctx.quadraticCurveTo(d.x + wx / 2, h * 0.5, d.x + wx - botW / 2, h);
    ctx.lineTo(d.x + wx + botW / 2, h);
    ctx.quadraticCurveTo(d.x + wx / 2, h * 0.5, d.x + topW / 2, 0);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    const dropR    = botW * 0.9 + 2;
    const cx       = d.x + wx, cy = h + dropR * 0.8;
    const dropGrad = ctx.createRadialGradient(cx - dropR * 0.25, cy - dropR * 0.3, 0, cx, cy, dropR * 1.4);
    dropGrad.addColorStop(0,   `hsla(${d.hue},${d.sat}%,45%,0.95)`);
    dropGrad.addColorStop(0.5, `hsla(${d.hue},${d.sat}%,30%,0.9)`);
    dropGrad.addColorStop(1,   `hsla(${d.hue},${d.sat}%,18%,0.5)`);
    ctx.beginPath();
    ctx.ellipse(cx, cy, dropR, dropR * 1.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = dropGrad;
    ctx.fill();

    // Reflet
    ctx.beginPath();
    ctx.ellipse(cx - dropR * 0.3, cy - dropR * 0.4, dropR * 0.3, dropR * 0.2, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,180,180,0.18)';
    ctx.fill();
  }

  function frame(ts) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const elapsed = ts - startTs;
    let allDone = true;

    for (const d of drips) {
      if (d.done) continue;
      if (elapsed < d.delay) { allDone = false; continue; }
      if (!d.started) { d.started = true; d.startTime = ts; }
      d.y = Math.min(d.speed * ((ts - d.startTime) / 1000), canvas.height + 40);
      drawBloodTrail(d);
      if (d.y < canvas.height + 40) allDone = false;
    }

    if (elapsed > 5500) {
      const alpha = Math.max(0, 1 - (elapsed - 5500) / 600);
      ctx.fillStyle = `rgba(12,8,16,${1 - alpha})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (elapsed < LIFETIME && !allDone) {
      raf = requestAnimationFrame(frame);
    } else {
      canvas.remove();
    }
  }

  raf = requestAnimationFrame(frame);
  setTimeout(() => { cancelAnimationFrame(raf); canvas.remove(); }, LIFETIME + 200);
}


/* ─── TRIPLE CLIC SUR LE LOGO ──────────────────────────── */
let _logoClicks = 0, _logoTimer = null;

function logoClick() {
  _logoClicks++;
  clearTimeout(_logoTimer);
  _logoTimer = setTimeout(() => { _logoClicks = 0; }, 700);
  if (_logoClicks >= 3) {
    _logoClicks = 0;
    const origTitle = document.title;
    document.title  = 'La Liste — Arya';
    toast('📜 La Liste...');
    const vt = document.getElementById('view-songs')?.querySelector('.view-title');
    if (vt && vt.textContent === 'Toutes les chansons') {
      const orig = vt.textContent;
      vt.textContent = 'La Liste';
      setTimeout(() => { vt.textContent = orig; document.title = origTitle; }, 5000);
    } else {
      setTimeout(() => { document.title = origTitle; }, 5000);
    }
  }
}


/* ─── ŒIL QUI SE FERME (volume = 0) ───────────────────── */
function showEyeClose() {
  let eye = document.getElementById('easterEye');
  if (!eye) { eye = Object.assign(document.createElement('div'), { id: 'easterEye' }); document.body.appendChild(eye); }
  eye.textContent = '👁';
  eye.style.opacity = '1';
  setTimeout(() => { eye.textContent = '😑'; }, 600);
  setTimeout(() => { eye.style.opacity = '0'; }, 2200);
}


/* ─── KONAMI CODE ──────────────────────────────────────── */
const _KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
let _konamiIdx = 0, _konamiActive = false;

function _checkKonami(key) {
  if (key === _KONAMI[_konamiIdx]) _konamiIdx++;
  else { _konamiIdx = 0; if (key === _KONAMI[0]) _konamiIdx = 1; }
  if (_konamiIdx === _KONAMI.length) {
    _konamiIdx = 0;
    if (_konamiActive) return;
    _konamiActive      = true;
    window._emberIntense = true;
    audio.playbackRate   = 0.82;
    toast('🔥 Valar Dohaeris');
    setTimeout(() => { window._emberIntense = false; audio.playbackRate = 1; _konamiActive = false; }, 9000);
  }
}


/* ─── BUFFER CLAVIER GLOBAL ────────────────────────────── */
let _keyBuf = '';
window._keyBuf = _keyBuf;

function _checkValar(str) {
  if (str.endsWith('valar')) {
    _keyBuf = '';
    toast('... morghulis 💀');
    setTimeout(nextTrack, 900);
  }
}
window._checkValar = _checkValar;

document.addEventListener('keydown', e => {
  if (e.key.length !== 1) return;
  _keyBuf += e.key.toLowerCase();
  window._keyBuf = _keyBuf;
  if (_keyBuf.length > 12) _keyBuf = _keyBuf.slice(-12);
  window._checkValar(_keyBuf);
}, { passive: true });

;(function () {
  let _lastSearch = '';
  const _si = document.getElementById('searchInput');
  if (_si) _si.addEventListener('input', () => {
    const v = _si.value.toLowerCase();
    if (v !== _lastSearch) { _lastSearch = v; _checkValar(v); }
  });
})();

document.addEventListener('keydown', e => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;
  _checkKonami(e.key);
});


/* ─── KONAMI MOBILE (swipe sur pArt) ──────────────────── */
(function () {
  const _swSeq = ['up','up','down','down','left','right','left','right'];
  let _swIdx = 0, _swTimer = null, _swSx = 0, _swSy = 0;
  const target = document.getElementById('pArt') || document.body;

  target.addEventListener('touchstart', e => {
    _swSx = e.touches[0].clientX; _swSy = e.touches[0].clientY;
  }, { passive: true });

  target.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - _swSx;
    const dy = e.changedTouches[0].clientY - _swSy;
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
    const dir = Math.abs(dy) > Math.abs(dx) ? (dy < 0 ? 'up' : 'down') : (dx < 0 ? 'left' : 'right');
    clearTimeout(_swTimer);
    _swTimer = setTimeout(() => { _swIdx = 0; }, 1800);
    if (dir === _swSeq[_swIdx]) {
      _swIdx++;
      if (_swIdx === _swSeq.length) { _swIdx = 0; _checkKonami('b'); _checkKonami('a'); }
    } else { _swIdx = 0; if (dir === _swSeq[0]) _swIdx = 1; }
  }, { passive: true });
})();


/* ─── INACTIVITÉ 10 MIN ────────────────────────────────── */
let _inactTimer = null, _inactOverlay = null;

function _resetInact() {
  clearTimeout(_inactTimer);
  if (_inactOverlay) {
    _inactOverlay.style.background = 'rgba(0,0,0,0)';
    _inactOverlay.style.pointerEvents = 'none';
    const msg = _inactOverlay.querySelector('#inactMsg');
    if (msg) msg.style.color = 'rgba(245,239,232,0)';
  }
  _inactTimer = setTimeout(_showInact, 10 * 60 * 1000);
}

function _showInact() {
  if (!_inactOverlay) {
    _inactOverlay = document.createElement('div');
    _inactOverlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0);z-index:800;transition:background 3.5s ease;display:flex;align-items:flex-end;justify-content:flex-end;padding:44px;cursor:pointer;';
    _inactOverlay.innerHTML = '<span id="inactMsg" style="font-family:\'Cormorant Garamond\',serif;font-size:14px;color:rgba(245,239,232,0);letter-spacing:.16em;font-style:italic;transition:color 3.5s ease;">La fille a du travail.</span>';
    _inactOverlay.addEventListener('click', _resetInact);
    document.body.appendChild(_inactOverlay);
  }
  _inactOverlay.style.pointerEvents = 'auto';
  requestAnimationFrame(() => {
    _inactOverlay.style.background = 'rgba(0,0,0,0.88)';
    const msg = document.getElementById('inactMsg');
    if (msg) msg.style.color = 'rgba(245,239,232,0.55)';
  });
}

['click','keydown','mousemove','touchstart'].forEach(ev =>
  document.addEventListener(ev, _resetInact, { passive: true })
);
_resetInact();


/* ─── 3 JOURS DE SUITE → COUTEAU ──────────────────────── */
(function checkStreak() {
  const KEY   = 'arya_visit_dates';
  const today = new Date().toDateString();
  let dates   = [];
  try { dates = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch {}

  if (!dates.includes(today)) {
    dates.push(today);
    if (dates.length > 10) dates = dates.slice(-10);
    localStorage.setItem(KEY, JSON.stringify(dates));
  }

  if (dates.length < 3) return;
  const sorted = [...dates].sort((a, b) => new Date(a) - new Date(b));
  let streak = 1;
  for (let i = sorted.length - 1; i > 0; i--) {
    const diff = Math.round((new Date(sorted[i]) - new Date(sorted[i - 1])) / 86_400_000);
    if (diff === 1) streak++; else break;
  }

  if (streak >= 3 && !sessionStorage.getItem('arya_knife')) {
    sessionStorage.setItem('arya_knife', '1');
    setTimeout(() => {
      const k = document.createElement('div');
      k.style.cssText = 'position:fixed;top:50%;left:-80px;font-size:38px;z-index:9999;pointer-events:none;transform:translateY(-50%) scaleX(-1);animation:knifeSlash 1.3s ease-in-out forwards;';
      k.textContent = '🗡️';
      document.body.appendChild(k);
      setTimeout(() => k.remove(), 1400);
    }, 1800);
  }
})();


/* ─── TRIPLE-TAP SUR POCHETTE ──────────────────────────── */
let _pArtClicks = 0, _pArtTimer = null;
document.getElementById('pArt').addEventListener('click', () => {
  _pArtClicks++;
  clearTimeout(_pArtTimer);
  _pArtTimer = setTimeout(() => { _pArtClicks = 0; }, 700);
  if (_pArtClicks >= 3) { _pArtClicks = 0; logoClick(); }
});


/* ─── WOLF PIXEL ────────────────────────────────────────── */
document.getElementById('wolfPixel')?.addEventListener('click', () => {
  try {
    const ac  = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ac.createOscillator();
    const g   = ac.createGain();
    osc.connect(g); g.connect(ac.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(130, ac.currentTime + 0.5);
    osc.frequency.exponentialRampToValueAtTime(220, ac.currentTime + 0.9);
    osc.frequency.exponentialRampToValueAtTime(85,  ac.currentTime + 1.6);
    g.gain.setValueAtTime(0.28, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 1.8);
    osc.start(); osc.stop(ac.currentTime + 1.8);
  } catch {}
});


/* ─── "dracarys" → FEU DE DRAGON ──────────────────────── */
(function () {
  let _dracarysActive = false;
  function _dracarysCheck(str) {
    if (!str.endsWith('dracarys') || _dracarysActive) return;
    _dracarysActive = true;
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(200,40,0,0);z-index:9995;pointer-events:none;transition:background 0.6s ease;';
    document.body.appendChild(ov);
    requestAnimationFrame(() => { ov.style.background = 'rgba(200,40,0,0.22)'; });
    const flame = document.createElement('div');
    flame.style.cssText = 'position:fixed;bottom:-30px;left:50%;transform:translateX(-50%);font-size:72px;z-index:9996;pointer-events:none;animation:dracarysFire 2s ease-out forwards;';
    flame.textContent = '🔥';
    document.body.appendChild(flame);
    window._emberIntense = true;
    try { audio.playbackRate = 1.18; } catch {}
    toast('🐉 DRACARYS');
    setTimeout(() => {
      ov.style.background = 'rgba(200,40,0,0)';
      setTimeout(() => { ov.remove(); flame.remove(); }, 700);
      window._emberIntense = false;
      try { audio.playbackRate = 1; } catch {}
      _dracarysActive = false;
    }, 4000);
  }
  document.addEventListener('keydown', e => { if (e.key.length !== 1) return; _dracarysCheck((window._keyBuf || '').slice(-10)); });
  document.getElementById('searchInput')?.addEventListener('input', function () { _dracarysCheck(this.value.toLowerCase()); });
})();


/* ─── "hodor" → HODOR BLOQUE LA SIDEBAR ───────────────── */
(function () {
  let _hodorActive = false;
  function _hodorCheck(str) {
    if (!str.endsWith('hodor') || _hodorActive) return;
    _hodorActive = true;
    toast('HODOR.');
    const sidebar = document.querySelector('.sidebar');
    if (window.innerWidth <= 640) {
      sidebar.classList.add('open');
      document.getElementById('sidebarBackdrop').classList.add('open');
    }
    const _origClose = window.closeSidebarDrawer;
    window.closeSidebarDrawer = function () {
      sidebar.style.transition = 'transform 0.08s';
      sidebar.style.transform  = 'translateX(-14px)';
      setTimeout(() => { sidebar.style.transform = ''; }, 160);
    };
    const logo = document.getElementById('logoMark');
    if (logo) { const orig = logo.textContent; logo.textContent = '🚪'; setTimeout(() => { logo.textContent = orig; }, 3000); }
    setTimeout(() => {
      window.closeSidebarDrawer = _origClose;
      _hodorActive = false;
      if (window.innerWidth <= 640) closeSidebarDrawer();
    }, 3500);
  }
  document.addEventListener('keydown', e => { if (e.key.length !== 1) return; _hodorCheck((window._keyBuf || '').slice(-7)); });
  document.getElementById('searchInput')?.addEventListener('input', function () { _hodorCheck(this.value.toLowerCase()); });
})();


/* ─── "winter" → NEIGE QUI TOMBE ──────────────────────── */
(function () {
  let _winterActive = false;
  function _winterCheck(str) {
    if (!str.endsWith('winter') || _winterActive) return;
    _winterActive = true;
    toast('❄️ Winter is coming...');
    const FLAKES = ['❄','❅','❆','✦','·'];
    const created = [];
    for (let i = 0; i < 40; i++) {
      setTimeout(() => {
        const f = document.createElement('div');
        f.className = 'snow-flake';
        f.textContent = FLAKES[Math.floor(Math.random() * FLAKES.length)];
        f.style.left  = Math.random() * 100 + 'vw';
        f.style.fontSize = (10 + Math.random() * 14) + 'px';
        f.style.opacity  = (0.4 + Math.random() * 0.6).toString();
        const dur = 3 + Math.random() * 4;
        f.style.animationDuration = dur + 's';
        f.style.animationDelay   = '0s';
        document.body.appendChild(f);
        created.push(f);
        setTimeout(() => f.remove(), dur * 1000 + 200);
      }, i * 120);
    }
    setTimeout(() => { created.forEach(f => { try { f.remove(); } catch {} }); _winterActive = false; }, 10000);
  }
  document.addEventListener('keydown', e => {
    if (e.key.length !== 1) return;
    const buf = (window._keyBuf || '').slice(-9) + e.key.toLowerCase();
    _winterCheck(buf);
  });
  document.getElementById('searchInput')?.addEventListener('input', function () { _winterCheck(this.value.toLowerCase()); });
})();


/* ─── "arya" → LA LISTE DE NOMS ───────────────────────── */
(function () {
  let _aryaActive = false;
  const LISTE = ['Cersei Lannister','Walder Frey','Meryn Trant','Tywin Lannister','The Red Woman','Beric Dondarrion','Thoros of Myr','Ilyn Payne','The Mountain','The Hound'];
  function _aryaCheck(str) {
    if ((!str.endsWith('arya') && str !== 'arya') || _aryaActive) return;
    _aryaActive = true;
    toast('🗡️ Une fille a une liste...');
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;pointer-events:none;z-index:9992;';
    document.body.appendChild(container);
    LISTE.forEach((name, i) => {
      setTimeout(() => {
        const el = document.createElement('div');
        el.style.cssText = `font-family:'Cormorant Garamond',serif;font-size:clamp(18px,3vw,28px);color:var(--rose);letter-spacing:.06em;font-style:italic;animation:nameFlash 1.8s ease forwards;pointer-events:none;text-shadow:0 0 20px rgba(196,77,110,.5);`;
        el.textContent = name;
        container.appendChild(el);
        setTimeout(() => el.remove(), 1900);
      }, i * 300);
    });
    setTimeout(() => { container.remove(); _aryaActive = false; }, LISTE.length * 300 + 2000);
  }
  document.addEventListener('keydown', e => {
    if (e.key.length !== 1) return;
    const buf = (window._keyBuf || '').slice(-6) + e.key.toLowerCase();
    _aryaCheck(buf);
  });
  document.getElementById('searchInput')?.addEventListener('input', function () { _aryaCheck(this.value.toLowerCase()); });
})();


/* ─── 03:00 DU MATIN → LA NUIT EST SOMBRE ─────────────── */
(function () {
  let _nightShown = false;
  function _checkNightHour() {
    const now = new Date();
    if (now.getHours() !== 3 || now.getMinutes() !== 0 || _nightShown) return;
    _nightShown = true;
    const el = document.createElement('div');
    el.style.cssText = "position:fixed;bottom:120px;left:50%;transform:translateX(-50%);font-family:'Cormorant Garamond',serif;font-size:13px;font-style:italic;color:rgba(154,132,144,0.7);letter-spacing:.1em;pointer-events:none;z-index:9991;opacity:0;transition:opacity 2s ease;white-space:nowrap;";
    el.textContent = 'La nuit est sombre et pleine de terreurs.';
    document.body.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.opacity = '1'; }));
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 2200); }, 6000);
    setTimeout(() => { _nightShown = false; }, 70000);
  }
  setInterval(_checkNightHour, 30000);
  _checkNightHour();
})();


/* ─── 7 CLICS SUR LE PSEUDO → SEPT COURONNES ──────────── */
(function () {
  let _pseudoClicks = 0, _pseudoTimer = null, _pseudoActive = false;
  const sfPseudo = document.getElementById('sfPseudo');
  if (!sfPseudo) return;
  sfPseudo.style.cursor = 'pointer';
  sfPseudo.addEventListener('click', () => {
    _pseudoClicks++;
    clearTimeout(_pseudoTimer);
    _pseudoTimer = setTimeout(() => { _pseudoClicks = 0; }, 2800);
    if (_pseudoClicks >= 7 && !_pseudoActive) {
      _pseudoClicks = 0; _pseudoActive = true;
      toast('👑 Sept Couronnes. Sept Royaumes.');
      document.documentElement.style.setProperty('--accent',     '#9b6dff');
      document.documentElement.style.setProperty('--accent-rgb', '155,109,255');
      for (let i = 0; i < 7; i++) {
        setTimeout(() => {
          const c = document.createElement('div');
          c.style.cssText = `position:fixed;top:-30px;left:${10 + Math.random() * 80}vw;font-size:${22 + Math.random() * 16}px;z-index:9993;pointer-events:none;animation:snowfall ${2 + Math.random() * 2}s ease-in forwards;`;
          c.textContent = '👑';
          document.body.appendChild(c);
          setTimeout(() => c.remove(), 4200);
        }, i * 280);
      }
      setTimeout(() => {
        document.documentElement.style.setProperty('--accent',     '#d4a054');
        document.documentElement.style.setProperty('--accent-rgb', '212,160,84');
        _pseudoActive = false;
      }, 7000);
    }
  });
})();
