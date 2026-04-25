/* ═══════════════════════════════════════════════════════════
   FLOW.JS — Arya
   Génère une queue intelligente type "Flow" Deezer.
   Basé sur les stats locales (artistes, genres, heure).

   Algo :
     1. Calcule un score pour chaque piste
     2. Score basé sur : artiste favori, genre favori,
        heure de la journée, nouveauté, pas récemment joué
     3. Sélection aléatoire pondérée par le score
     4. Queue de 30 pistes renouvelée automatiquement

   API publique :
     Flow.start()   — lance le Flow
     Flow.stop()    — arrête le Flow
     Flow.isActive() — Flow en cours ?

   Dépend de : config.js, utils.js, library.js,
               playback.js, render.js
═══════════════════════════════════════════════════════════ */

const Flow = (() => {

  const FLOW_SIZE       = 30;  // pistes dans la queue
  const FLOW_REFILL_AT  = 5;   // recharge quand il reste N pistes
  const RECENT_EXCLUDE  = 20;  // évite les N dernières pistes jouées

  let _active    = false;
  let _patching  = false; // guard contre double-patch


  /* ═══════════════════════════════════════════════════════════
     SCORING
  ═══════════════════════════════════════════════════════════ */

  function _buildScores() {
    const stats   = getStats();
    const history = getHistory();
    const hr      = new Date().getHours();

    /* ── Top artistes (score normalisé 0-1) ── */
    const artistPlays = {};
    Object.values(stats).forEach(e => {
      if (!e.artist) return;
      artistPlays[e.artist] = (artistPlays[e.artist] || 0) + (e.plays || 0);
    });
    const maxArtist = Math.max(1, ...Object.values(artistPlays));
    const artistScore = a => (artistPlays[a] || 0) / maxArtist;

    /* ── Top genres ── */
    const genrePlays = {};
    Object.values(stats).forEach(e => {
      const t = tracks.find(x => x.filename === e.filename);
      if (!t?.genre) return;
      genrePlays[t.genre] = (genrePlays[t.genre] || 0) + (e.plays || 0);
    });
    const maxGenre = Math.max(1, ...Object.values(genrePlays));
    const genreScore = g => g ? (genrePlays[g] || 0) / maxGenre : 0;

    /* ── Pistes récemment jouées à éviter ── */
    const recentFns = new Set(history.slice(0, RECENT_EXCLUDE).map(h => h.filename));

    /* ── Ambiance par heure ──
       Matin (6-11)   : énergique → score sur plays élevés
       Après-midi (12-17) : neutre
       Soir (18-23)   : favorise les artistes top
       Nuit (0-5)     : favorise les pistes moins jouées (découverte)
    ── */
    const timeBonus = (plays) => {
      if (hr >= 6  && hr < 12) return plays > 5  ? 1.3 : 1.0; // matin  → connu
      if (hr >= 18 && hr < 24) return plays > 2  ? 1.2 : 0.9; // soir   → favori
      if (hr >= 0  && hr < 6)  return plays === 0 ? 1.4 : 0.8; // nuit   → découverte
      return 1.0; // après-midi → neutre
    };

    /* ── Score final par piste ── */
    return ParentalControl.filterTracks(tracks).map(t => {
      const s      = stats[t.filename] || { plays: 0 };
      const plays  = s.plays || 0;

      let score = 0;
      score += artistScore(t.artist) * 40;  // artiste favori  → max 40pts
      score += genreScore(t.genre)   * 25;  // genre favori    → max 25pts
      score += Math.min(plays / 10, 1) * 15; // popularité     → max 15pts
      score += Math.random()         * 20;  // aléatoire       → max 20pts (diversité)
      score *= timeBonus(plays);            // bonus heure

      // Pénalité si récemment joué
      if (recentFns.has(t.filename)) score *= 0.1;

      return { track: t, score };
    });
  }

  /* Sélection aléatoire pondérée par le score. */
  function _weightedSample(scored, n) {
    const pool     = [...scored].sort((a, b) => b.score - a.score);
    const selected = new Set();
    const result   = [];

    // Top 60% → candidats prioritaires
    const top = pool.slice(0, Math.ceil(pool.length * 0.6));

    while (result.length < n && (selected.size < pool.length)) {
      const candidates = result.length < n * 0.7 ? top : pool;
      const totalScore = candidates.reduce((a, x) => a + Math.max(0.01, x.score), 0);
      let rand = Math.random() * totalScore;

      for (const item of candidates) {
        if (selected.has(item.track.filename)) continue;
        rand -= Math.max(0.01, item.score);
        if (rand <= 0) {
          selected.add(item.track.filename);
          result.push(item.track);
          break;
        }
      }
    }

    return result;
  }


  /* ═══════════════════════════════════════════════════════════
     GÉNÉRATION DE LA QUEUE
  ═══════════════════════════════════════════════════════════ */

  function _generateQueue(count = FLOW_SIZE) {
    if (!tracks.length) return [];
    const scored = _buildScores();
    return _weightedSample(scored, Math.min(count, scored.length));
  }

  /** Recharge la fin de queue quand il reste peu de pistes. */
  function _refillIfNeeded() {
    if (!_active) return;
    const remaining = queue.length - queueIdx - 1;
    if (remaining <= FLOW_REFILL_AT) {
      const newTracks = _generateQueue(FLOW_SIZE);
      // Évite les doublons avec la fin de queue actuelle
      const tailFns   = new Set(queue.slice(queueIdx + 1).map(t => t.filename));
      const fresh     = newTracks.filter(t => !tailFns.has(t.filename));
      queue.push(...fresh);
    }
  }


  /* ═══════════════════════════════════════════════════════════
     PATCH playFromQueue
     Recharge automatiquement le Flow quand la queue se vide.
  ═══════════════════════════════════════════════════════════ */

  function _patchPlayFromQueue() {
    if (_patching) return;
    const orig = window.playFromQueue;
    if (!orig || orig._flowPatched) return;
    window.playFromQueue = function () {
      if (_active) _refillIfNeeded();
      return orig.apply(this, arguments);
    };
    window.playFromQueue._flowPatched = true;
    _patching = true;
  }

  function _unpatchPlayFromQueue() {
    const fn = window.playFromQueue;
    if (fn?._flowPatched && fn._orig) {
      window.playFromQueue = fn._orig;
    }
    _patching = false;
  }


  /* ═══════════════════════════════════════════════════════════
     UI — BOUTON FLOW
  ═══════════════════════════════════════════════════════════ */

  function _injectFlowBtn() {
    if (document.getElementById('flowBtn')) return;

    /* Styles */
    if (!document.getElementById('flow-styles')) {
      const s = document.createElement('style');
      s.id = 'flow-styles';
      s.textContent = `
        #flowBtn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 22px;
          border-radius: 24px;
          border: none;
          background: linear-gradient(135deg, var(--accent), #e91e8c);
          color: #fff;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          box-shadow: 0 4px 20px rgba(212,160,84,.35);
          transition: opacity .15s, transform .15s, box-shadow .15s;
          letter-spacing: .02em;
        }
        #flowBtn:hover  { opacity: .92; transform: translateY(-1px); box-shadow: 0 6px 28px rgba(212,160,84,.45); }
        #flowBtn:active { transform: scale(.97); }
        #flowBtn.active {
          background: linear-gradient(135deg, #e91e8c, var(--accent));
          box-shadow: 0 4px 20px rgba(233,30,140,.4);
          animation: flowPulse 2s ease-in-out infinite;
        }
        @keyframes flowPulse {
          0%, 100% { box-shadow: 0 4px 20px rgba(233,30,140,.4); }
          50%       { box-shadow: 0 4px 32px rgba(233,30,140,.7); }
        }
        .flow-hero {
          background: linear-gradient(135deg,
            color-mix(in srgb, var(--accent) 12%, transparent),
            color-mix(in srgb, #e91e8c 8%, transparent));
          border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
          border-radius: 18px;
          padding: 20px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .flow-hero-ico  { font-size: 42px; flex-shrink: 0; }
        .flow-hero-text { flex: 1; min-width: 0; }
        .flow-hero-title { font-size: 18px; font-weight: 700; color: var(--text); margin-bottom: 4px; }
        .flow-hero-sub   { font-size: 13px; color: var(--text2); line-height: 1.6; }
        .flow-tracks-preview {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: 16px;
        }
        .flow-preview-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          border-radius: 10px;
          background: var(--surface);
          border: 1px solid var(--border);
          cursor: pointer;
          transition: background .12s;
        }
        .flow-preview-row:hover { background: var(--surface2, #2a1f33); }
        .flow-preview-num  { font-size: 11px; color: var(--text3); width: 16px; text-align: center; flex-shrink: 0; }
        .flow-preview-info { flex: 1; min-width: 0; }
        .flow-preview-title  { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .flow-preview-artist { font-size: 11.5px; color: var(--text2); }
        .flow-score-badge {
          font-size: 10px;
          background: color-mix(in srgb, var(--accent) 18%, transparent);
          color: var(--accent);
          border-radius: 8px;
          padding: 2px 7px;
          font-weight: 700;
          flex-shrink: 0;
        }
      `;
      document.head.appendChild(s);
    }

    /* Bouton dans la nav sidebar */
    const navSection = document.querySelector('.sidebar .nav-section');
    if (navSection) {
      const item = document.createElement('div');
      item.className = 'nav-item';
      item.dataset.view = 'flow';
      item.innerHTML = '<span class="nav-ico">🌊</span> Flow';
      item.onclick = () => showView('flow');
      navSection.appendChild(item);
    }

    /* Bouton dans more sheet */
    const moreGrid = document.getElementById('moreGrid') || document.querySelector('.more-grid');
    if (moreGrid) {
      const moreItem = document.createElement('div');
      moreItem.className = 'more-item';
      moreItem.id        = 'moreFlow';
      moreItem.innerHTML = '<span class="more-ico">🌊</span>Flow';
      moreItem.onclick   = () => showViewFromMore('flow');
      moreGrid.appendChild(moreItem);
    }
  }


  /* ═══════════════════════════════════════════════════════════
     VUE FLOW
  ═══════════════════════════════════════════════════════════ */

  function renderFlowView() {
    const content = document.getElementById('flowContent');
    if (!content) return;

    const hr       = new Date().getHours();
    const moment   = hr < 6 ? 'Nuit 🌙' : hr < 12 ? 'Matin ☀️' : hr < 18 ? 'Après-midi 🌤' : 'Soir 🌆';
    const stats    = getStats();
    const hasStats = Object.keys(stats).length > 0;

    const preview = _active
      ? queue.slice(queueIdx, queueIdx + 8)
      : _generateQueue(8);

    content.innerHTML = `
      <div class="flow-hero">
        <div class="flow-hero-ico">🌊</div>
        <div class="flow-hero-text">
          <div class="flow-hero-title">
            Flow · ${moment}
            ${_active ? '<span style="font-size:12px;color:var(--rose);margin-left:8px;">● En cours</span>' : ''}
          </div>
          <div class="flow-hero-sub">
            ${hasStats
              ? 'Une sélection personnalisée basée sur vos goûts, l\'heure et votre humeur.'
              : 'Écoutez quelques pistes — le Flow apprend vos goûts et s\'améliore avec le temps.'}
          </div>
        </div>
      </div>

      <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;">
        <button id="flowBtn" class="${_active ? 'active' : ''}"
                onclick="Flow.${_active ? 'stop' : 'start'}()">
          ${_active ? '⏹ Arrêter le Flow' : '🌊 Lancer le Flow'}
        </button>
        ${_active ? `<button class="btn btn-ghost" onclick="Flow.shuffle()">🔀 Remélanger</button>` : ''}
      </div>

      ${preview.length ? `
        <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.08em;
                    text-transform:uppercase;margin-bottom:10px;">
          ${_active ? 'Pistes à venir' : 'Aperçu · ' + preview.length + ' pistes'}
        </div>
        <div class="flow-tracks-preview">
          ${preview.map((t, i) => {
            const cover = getCover(t.filename);
            const grad  = gradFor(t.artist + t.album);
            const s     = stats[t.filename];
            return `
              <div class="flow-preview-row" onclick="Flow.jumpTo(${_active ? queueIdx + i : -1}, '${escAttr(t.filename)}')">
                <div class="flow-preview-num">${i + 1}</div>
                <div style="width:34px;height:34px;border-radius:6px;flex-shrink:0;overflow:hidden;
                            display:flex;align-items:center;justify-content:center;font-size:14px;
                            ${cover ? '' : 'background:' + grad}">
                  ${cover ? `<img src="${esc(cover)}" style="width:100%;height:100%;object-fit:cover;">` : '🎵'}
                </div>
                <div class="flow-preview-info">
                  <div class="flow-preview-title">${esc(t.title)}</div>
                  <div class="flow-preview-artist">${esc(t.artist)}</div>
                </div>
                ${s?.plays ? `<span class="flow-score-badge">${s.plays}×</span>` : ''}
              </div>`;
          }).join('')}
        </div>` : ''}`;
  }


  /* ═══════════════════════════════════════════════════════════
     INITIALISATION VUE FLOW DANS LE DOM
  ═══════════════════════════════════════════════════════════ */

  function _injectFlowView() {
    if (document.getElementById('view-flow')) return;
    const main = document.querySelector('main.main');
    if (!main) return;
    const div = document.createElement('div');
    div.className = 'view';
    div.id        = 'view-flow';
    div.innerHTML = `
      <div class="view-header">
        <div class="view-title">🌊 Flow</div>
        <div class="view-sub">Votre musique, à votre rythme</div>
      </div>
      <div id="flowContent"></div>`;
    main.appendChild(div);

    // Patch showView pour rendre la vue Flow
    const origShow = window.showView;
    if (origShow && !origShow._flowPatched) {
      window.showView = function (name) {
        origShow.apply(this, arguments);
        if (name === 'flow') renderFlowView();
      };
      window.showView._flowPatched = true;
    }
  }


  /* ═══════════════════════════════════════════════════════════
     API PUBLIQUE
  ═══════════════════════════════════════════════════════════ */

  function start() {
    if (!tracks.length) { toast('Bibliothèque vide', true); return; }
    _active = true;

    const flowQueue = _generateQueue();
    if (!flowQueue.length) { toast('Pas assez de pistes', true); return; }

    queue    = flowQueue;
    queueIdx = 0;
    shuffle  = false;

    document.getElementById('btnShuffle')?.classList.remove('on');
    document.getElementById('fsBtnShuffle')?.classList.remove('on');

    _patchPlayFromQueue();
    playFromQueue();
    renderFlowView();

    const hr      = new Date().getHours();
    const moment  = hr < 6 ? 'nuit' : hr < 12 ? 'matin' : hr < 18 ? 'après-midi' : 'soir';
    toast(`🌊 Flow lancé — sélection ${moment}`);
  }

  function stop() {
    _active = false;
    _unpatchPlayFromQueue();
    renderFlowView();
    toast('Flow arrêté');
  }

  function shuffle_() {
    if (!_active) { start(); return; }
    const newQueue = _generateQueue();
    queue    = newQueue;
    queueIdx = 0;
    playFromQueue();
    renderFlowView();
    toast('🔀 Flow remélangé');
  }

  function jumpTo(idx, filename) {
    if (_active && idx >= 0) {
      queueIdx = idx;
      playFromQueue();
    } else {
      // Pas encore en cours → lance le Flow sur cette piste
      start();
      const ti = queue.findIndex(t => t.filename === filename);
      if (ti >= 0) { queueIdx = ti; playFromQueue(); }
    }
    renderFlowView();
  }

  function isActive() { return _active; }

  /* Init au démarrage */
  function init() {
    _injectFlowView();
    _injectFlowBtn();
  }

  return { start, stop, shuffle: shuffle_, jumpTo, isActive, init, renderFlowView };

})();
