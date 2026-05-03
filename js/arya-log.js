/* ═══════════════════════════════════════════════════════════
   ARYA-LOG.JS — Logs structurés
   Remplace les console.log dispersés par un système catégorisé.
   Chargé tôt (après config.js).

   Usage :
     Arya.log('player', 'track changed', { id: 42 });
     Arya.log.warn('sync', 'retry', attempt);
     Arya.log.error('firebase', 'write failed', err);
     Arya.log.setLevel('player', true);   // activer une catégorie
     Arya.log.setLevel('sync',   false);  // silencer une catégorie
     Arya.log.history();                  // consulter l'historique
═══════════════════════════════════════════════════════════ */

(function () {

  /* ── Config ─────────────────────────────────────────────── */
  const MAX_HISTORY = 200;

  // Catégories actives en dev, silencées en prod
  // Pour activer en prod : localStorage.setItem('arya_log_player', '1')
  const DEFAULT_CATEGORIES = {
    player:    true,
    queue:     false,
    sync:      false,
    firebase:  false,
    cache:     false,
    covers:    false,
    lyrics:    false,
    online:    true,
    party:     false,
    auth:      true,
    ui:        false,
    perf:      true,
    error:     true,   // toujours actif
  };

  /* ── État interne ────────────────────────────────────────── */
  const _levels   = { ...DEFAULT_CATEGORIES };
  const _history  = [];
  const _isProd   = !window.location.hostname.includes('localhost')
                 && !window.location.protocol.includes('file');

  // En prod, désactiver tout sauf error et perf
  if (_isProd) {
    Object.keys(_levels).forEach(k => {
      if (k !== 'error' && k !== 'perf' && k !== 'auth') _levels[k] = false;
    });
  }

  // Surcharge depuis localStorage (pour debug en prod)
  Object.keys(_levels).forEach(k => {
    const override = localStorage.getItem(`arya_log_${k}`);
    if (override !== null) _levels[k] = override === '1';
  });

  /* ── Styles console ──────────────────────────────────────── */
  const _styles = {
    player:   'color:#c8924a;font-weight:bold',
    queue:    'color:#a78bfa',
    sync:     'color:#60a5fa',
    firebase: 'color:#fb923c',
    cache:    'color:#34d399',
    covers:   'color:#f472b6',
    lyrics:   'color:#e879f9',
    online:   'color:#4ade80',
    party:    'color:#f59e0b',
    auth:     'color:#38bdf8',
    ui:       'color:#94a3b8',
    perf:     'color:#fbbf24',
    error:    'color:#f87171',
  };

  /* ── Fonction principale ─────────────────────────────────── */
  function log(category, msg, ...args) {
    const entry = {
      t:        Date.now(),
      category,
      msg,
      args,
      level:   'info',
    };
    _addHistory(entry);
    if (!_levels[category] && category !== 'error') return;

    const style = _styles[category] || 'color:#999';
    const time  = new Date().toISOString().substr(11, 8);
    console.log(`%c[Arya:${category}] %c${time} ${msg}`, style, 'color:#666', ...args);
  }

  log.warn = function (category, msg, ...args) {
    const entry = { t: Date.now(), category, msg, args, level: 'warn' };
    _addHistory(entry);
    if (!_levels[category] && category !== 'error') return;
    console.warn(`[Arya:${category}]`, msg, ...args);
  };

  log.error = function (category, msg, ...args) {
    const entry = { t: Date.now(), category, msg, args, level: 'error' };
    _addHistory(entry);
    // Les erreurs passent toujours
    console.error(`[Arya:${category}]`, msg, ...args);
    // Propagation vers AryaState si disponible
    if (window.AryaState) {
      // On pourrait stocker les erreurs dans le state pour un panneau debug
    }
  };

  /* ── Perf ────────────────────────────────────────────────── */
  log.time = function (label) {
    if (_levels.perf) console.time(`[Arya:perf] ${label}`);
  };
  log.timeEnd = function (label) {
    if (_levels.perf) console.timeEnd(`[Arya:perf] ${label}`);
  };

  /* ── Contrôle ────────────────────────────────────────────── */
  log.setLevel = function (category, enabled) {
    _levels[category] = enabled;
    localStorage.setItem(`arya_log_${category}`, enabled ? '1' : '0');
  };

  log.enableAll = function () {
    Object.keys(_levels).forEach(k => { _levels[k] = true; });
    console.log('[Arya:log] Tous les logs activés');
  };

  log.disableAll = function () {
    Object.keys(_levels).forEach(k => {
      if (k !== 'error') _levels[k] = false;
    });
  };

  /* ── Historique ──────────────────────────────────────────── */
  function _addHistory(entry) {
    _history.push(entry);
    if (_history.length > MAX_HISTORY) _history.shift();
  }

  log.history = function (category) {
    const items = category ? _history.filter(e => e.category === category) : _history;
    console.table(items.map(e => ({
      time:     new Date(e.t).toISOString().substr(11, 8),
      category: e.category,
      level:    e.level,
      msg:      e.msg,
    })));
    return items;
  };

  log.levels = function () {
    console.table(_levels);
    return { ..._levels };
  };

  /* ── Export ──────────────────────────────────────────────── */
  window.Arya = window.Arya || {};
  window.Arya.log = log;

  // Shortcut global pour le debug console
  window.aryaLog = log;

  log('perf', 'Arya Logger initialisé', { prod: _isProd });

})();
