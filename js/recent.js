/* ═══════════════════════════════════════════════════════════
   RECENT.JS — Arya
   Vue "Nouveautés" — listener temps réel Firebase.
   Se met à jour automatiquement quand quelqu'un ajoute
   une musique, même si la vue est déjà ouverte.

   Dépend de : config.js, utils.js, firebase-init.js
═══════════════════════════════════════════════════════════ */

const RECENT_LIMIT = 50;

let _recentListener    = null;
let _recentLastTs      = 0;      // dernier timestamp vu (pour les notifs)
let _recentReady       = false;  // true après le premier chargement


/* ═══════════════════════════════════════════════════════════
   FORMATAGE DATE
═══════════════════════════════════════════════════════════ */

function formatRecentDate(ts) {
  if (!ts) return '';
  const diffMs  = Date.now() - ts;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffH   = Math.floor(diffMs / 3_600_000);
  const diffD   = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1)   return 'À l\'instant';
  if (diffMin < 60)  return `Il y a ${diffMin} min`;
  if (diffH   < 24)  return `Il y a ${diffH} h`;
  if (diffD   === 1) return 'Hier';
  if (diffD   < 7)   return `Il y a ${diffD} jours`;

  const d   = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}


/* ═══════════════════════════════════════════════════════════
   RENDU
═══════════════════════════════════════════════════════════ */

function _renderRecentEntries(entries) {
  const container = document.getElementById('recentList');
  const counter   = document.getElementById('recentCount');
  if (!container) return;

  if (!entries.length) {
    container.innerHTML = `<div class="recent-empty">🎵 Aucun ajout enregistré pour l'instant.</div>`;
    if (counter) counter.textContent = '';
    return;
  }

  if (counter) counter.textContent = `${entries.length} ajout${entries.length > 1 ? 's' : ''}`;

  container.innerHTML = entries.map(e => {
    const dateStr = formatRecentDate(e.addedAt);
    const track   = typeof tracks !== 'undefined'
      ? tracks.find(t => t.filename === e.filename || (t.artist === e.artist && t.title === e.title))
      : null;
    const cover = track ? getCover(track.filename) : null;

    return `
      <div class="recent-row" ${track ? `onclick="playTrack(${track.id})"` : ''}>
        <div class="recent-cover" style="${!cover ? `background:${gradFor((e.artist || '') + (e.title || ''))}` : ''}">
          ${cover
            ? `<img src="${esc(cover)}" alt="" loading="lazy" onerror="this.style.display='none'">`
            : `<div class="recent-cover-placeholder">🎵</div>`}
        </div>
        <div class="recent-info">
          <div class="recent-title">${esc(e.title || e.filename || '?')}</div>
          <div class="recent-artist">${esc(e.artist || '—')}</div>
          <div class="recent-meta">
            <span class="recent-by">👤 ${esc(e.addedBy || 'Inconnu')}</span>
            <span class="recent-dot">·</span>
            <span class="recent-date">${dateStr}</span>
          </div>
        </div>
        ${track ? '<div class="recent-play">▶</div>' : ''}
      </div>`;
  }).join('');
}


/* ═══════════════════════════════════════════════════════════
   LISTENER TEMPS RÉEL
═══════════════════════════════════════════════════════════ */

function _attachRecentListener() {
  if (_recentListener) return; // déjà actif

  const container = document.getElementById('recentList');
  if (container) {
    container.innerHTML = `
      <div class="recent-loading">
        <div class="recent-spinner"></div>
        <span>Chargement…</span>
      </div>`;
  }

  try {
    const ref = firebase.database()
      .ref('arya/recent_uploads')
      .orderByChild('addedAt')
      .limitToLast(RECENT_LIMIT);

    _recentListener = ref.on('value', snap => {
      const entries = [];
      snap.forEach(child => entries.push({ key: child.key, ...child.val() }));
      entries.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));

      // Détecte les nouveaux ajouts pour la notification
      if (_recentReady && entries.length > 0) {
        const newest = entries[0];
        if (newest.addedAt > _recentLastTs && newest.addedBy !== pseudo) {
          _showRecentNotification(newest);
        }
      }

      if (entries.length > 0) {
        _recentLastTs = entries[0].addedAt || 0;
      }
      _recentReady = true;

      _renderRecentEntries(entries);
    }, err => {
      console.error('[Arya Recent] Listener error:', err);
      if (container) {
        container.innerHTML = `<div class="recent-empty" style="color:var(--rose);">❌ Impossible de charger les nouveautés.</div>`;
      }
    });

  } catch (err) {
    console.error('[Arya Recent] Attach error:', err);
  }
}

function _detachRecentListener() {
  if (!_recentListener) return;
  try {
    firebase.database()
      .ref('arya/recent_uploads')
      .off('value', _recentListener);
  } catch {}
  _recentListener = null;
}


/* ═══════════════════════════════════════════════════════════
   NOTIFICATION — nouvel ajout
═══════════════════════════════════════════════════════════ */

function _showRecentNotification(entry) {
  const container = document.getElementById('toasts');
  if (!container) return;

  const el = document.createElement('div');
  el.className   = 'toast';
  el.style.cursor = 'pointer';
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;">
      <span style="font-size:18px;">🆕</span>
      <div>
        <div style="font-size:13px;font-weight:600;">${esc(entry.title || entry.filename || '?')}</div>
        <div style="font-size:11.5px;opacity:.75;">Ajouté par ${esc(entry.addedBy || 'Inconnu')}</div>
      </div>
    </div>`;

  el.onclick = () => {
    el.remove();
    if (typeof showView === 'function') showView('recent');
  };

  container.appendChild(el);
  setTimeout(() => { if (el.parentNode) el.remove(); }, 6000);
}


/* ═══════════════════════════════════════════════════════════
   API PUBLIQUE
═══════════════════════════════════════════════════════════ */

/** Appelé quand on navigue vers la vue "recent". */
function initRecentView() {
  _attachRecentListener();
}

/**
 * Démarre le listener en arrière-plan dès le login
 * pour recevoir les notifications même sans ouvrir la vue.
 */
function initRecentNotifications() {
  _recentReady = false;
  _recentLastTs = Date.now(); // ignore tout ce qui est antérieur au login
  // On n'attache pas le listener ici (coût réseau) — juste on écoute les nouveaux
  const ref = firebase.database()
    .ref('arya/recent_uploads')
    .orderByChild('addedAt')
    .limitToLast(1);

  ref.on('child_added', snap => {
    if (!_recentReady) { _recentReady = true; return; } // ignore le 1er (existant)
    const entry = snap.val();
    if (!entry?.addedAt || entry.addedAt <= _recentLastTs) return;
    if (entry.addedBy === pseudo) return; // c'est nous
    _recentLastTs = entry.addedAt;
    _showRecentNotification(entry);
    // Rafraîchit la vue si elle est ouverte
    const view = document.getElementById('view-recent');
    if (view?.classList.contains('active')) _attachRecentListener();
  });
}

function stopRecentNotifications() {
  _detachRecentListener();
  _recentReady = false;
}


/* ═══════════════════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════════════════ */

(function _injectRecentStyles() {
  if (document.getElementById('recent-styles')) return;
  const s = document.createElement('style');
  s.id = 'recent-styles';
  s.textContent = `
    .recent-loading {
      display: flex; align-items: center; gap: 10px;
      color: var(--text3); padding: 32px 16px; justify-content: center;
    }
    .recent-spinner {
      width: 18px; height: 18px;
      border: 2px solid var(--text3);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: recent-spin 0.7s linear infinite;
    }
    @keyframes recent-spin { to { transform: rotate(360deg); } }

    .recent-empty {
      text-align: center; color: var(--text3);
      padding: 40px 16px; font-size: 0.95rem;
    }

    .recent-row {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 16px;
      border-bottom: 1px solid var(--border);
      cursor: default; transition: background 0.15s;
    }
    .recent-row[onclick]              { cursor: pointer; }
    .recent-row[onclick]:active       { background: var(--bg2); }
    .recent-row[onclick]:hover .recent-play { opacity: 1; }

    .recent-cover {
      width: 46px; height: 46px; border-radius: 6px;
      overflow: hidden; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .recent-cover img { width: 100%; height: 100%; object-fit: cover; }
    .recent-cover-placeholder { font-size: 1.2rem; color: var(--text3); }

    .recent-info    { flex: 1; min-width: 0; }
    .recent-title {
      font-weight: 600; font-size: 0.9rem;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      color: var(--text1);
    }
    .recent-artist {
      font-size: 0.8rem; color: var(--text2);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .recent-meta {
      display: flex; align-items: center; gap: 5px;
      margin-top: 3px; font-size: 0.72rem; color: var(--text3);
    }
    .recent-dot { opacity: 0.4; }
    .recent-by  { color: var(--accent); opacity: 0.85; }
    .recent-play {
      color: var(--accent); font-size: 0.85rem;
      flex-shrink: 0; opacity: 0.6; transition: opacity 0.15s;
    }
  `;
  document.head.appendChild(s);
})();
