/* ═══════════════════════════════════════════════════════════
   RECENT.JS — Arya V2
   Vue "Nouveautés" — lit arya/recent_uploads dans Firebase
   et affiche les derniers morceaux ajoutés.

   Dépend de : config.js, utils.js, firebase-init.js
═══════════════════════════════════════════════════════════ */

const RECENT_LIMIT = 50; // nombre max d'entrées affichées


/* ═══════════════════════════════════════════════════════════
   FORMATAGE DATE
═══════════════════════════════════════════════════════════ */

/**
 * Formate un timestamp en texte relatif ou date précise.
 * Similaire à relTime() de utils.js mais avec date complète
 * au-delà de 7 jours.
 */
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

  // Au-delà de 7 jours : date + heure précise
  const d   = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}


/* ═══════════════════════════════════════════════════════════
   CHARGEMENT FIREBASE
═══════════════════════════════════════════════════════════ */

async function loadRecentUploads() {
  const container = document.getElementById('recentList');
  const counter   = document.getElementById('recentCount');
  if (!container) return;

  container.innerHTML = `
    <div class="recent-loading">
      <div class="recent-spinner"></div>
      <span>Chargement…</span>
    </div>`;

  try {
    const db   = firebase.database();
    const snap = await db.ref('arya/recent_uploads')
      .orderByChild('addedAt')
      .limitToLast(RECENT_LIMIT)
      .once('value');

    if (!snap.exists()) {
      container.innerHTML = `<div class="recent-empty">🎵 Aucun ajout enregistré pour l'instant.</div>`;
      if (counter) counter.textContent = '';
      return;
    }

    // Trier du plus récent au plus ancien
    const entries = [];
    snap.forEach(child => entries.push({ key: child.key, ...child.val() }));
    entries.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));

    if (counter) counter.textContent = `${entries.length} ajout${entries.length > 1 ? 's' : ''}`;

    container.innerHTML = entries.map(e => {
      const dateStr = formatRecentDate(e.addedAt);

      // Cherche le morceau dans la bibliothèque locale via id pour le jouer
      const track = typeof tracks !== 'undefined'
        ? tracks.find(t => t.filename === e.filename || (t.artist === e.artist && t.title === e.title))
        : null;

      const cover = track ? getCover(track.filename) : null;

      return `
        <div class="recent-row" ${track ? `onclick="playTrack(${track.id})"` : ''}>
          <div class="recent-cover" style="${!cover ? `background:${gradFor((e.artist || '') + (e.title || ''))}` : ''}">
            ${cover
              ? `<img src="${esc(cover)}" alt="" loading="lazy" onerror="this.style.display='none'">`
              : `<div class="recent-cover-placeholder">🎵</div>`
            }
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

  } catch (err) {
    console.error('[Arya Recent] Erreur chargement:', err);
    container.innerHTML = `<div class="recent-empty" style="color:var(--rose);">❌ Impossible de charger les nouveautés.</div>`;
  }
}

/** Appelé quand on navigue vers la vue "recent". */
function initRecentView() {
  loadRecentUploads();
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
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--text3);
      padding: 32px 16px;
      justify-content: center;
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
      text-align: center;
      color: var(--text3);
      padding: 40px 16px;
      font-size: 0.95rem;
    }

    .recent-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 16px;
      border-bottom: 1px solid var(--border);
      cursor: default;
      transition: background 0.15s;
    }
    .recent-row[onclick]        { cursor: pointer; }
    .recent-row[onclick]:active { background: var(--bg2); }
    .recent-row[onclick]:hover .recent-play { opacity: 1; }

    .recent-cover {
      width: 46px; height: 46px;
      border-radius: 6px;
      overflow: hidden;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .recent-cover img {
      width: 100%; height: 100%;
      object-fit: cover;
    }
    .recent-cover-placeholder {
      font-size: 1.2rem;
      color: var(--text3);
    }

    .recent-info    { flex: 1; min-width: 0; }
    .recent-title {
      font-weight: 600;
      font-size: 0.9rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--text1);
    }
    .recent-artist {
      font-size: 0.8rem;
      color: var(--text2);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .recent-meta {
      display: flex;
      align-items: center;
      gap: 5px;
      margin-top: 3px;
      font-size: 0.72rem;
      color: var(--text3);
    }
    .recent-dot { opacity: 0.4; }
    .recent-by  { color: var(--accent); opacity: 0.85; }

    .recent-play {
      color: var(--accent);
      font-size: 0.85rem;
      flex-shrink: 0;
      opacity: 0.6;
      transition: opacity 0.15s;
    }
  `;
  document.head.appendChild(s);
})();
