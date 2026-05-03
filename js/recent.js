/* ═══════════════════════════════════════════════════════════
   RECENT.JS — Arya
   Nouveautés + notifications background.

   Règles :
   - Aucune IIFE au niveau du fichier (pas de document au load)
   - Un seul listener Firebase .on('value')
   - Données en mémoire → pas de .once() supplémentaire
   - CSS injecté uniquement au premier initRecentView()
   - Détach propre au logout
═══════════════════════════════════════════════════════════ */

const RECENT_LIMIT = 50;

let _recentRef      = null;
let _recentCb       = null;
let _recentLoginTs  = 0;
let _recentKeys     = new Set();
let _recentOpen     = false;
let _recentEntries  = [];
let _recentStyles   = false;


/* ═══════════════════════════════════════════════════════════
   CSS — injecté une seule fois, uniquement quand le DOM est prêt
═══════════════════════════════════════════════════════════ */

function _injectRecentCSS() {
  if (_recentStyles) return;
  _recentStyles = true;
  const s = document.createElement('style');
  s.textContent = `
    .recent-loading {
      display:flex;align-items:center;gap:10px;
      color:var(--text3);padding:32px 16px;justify-content:center;
    }
    .recent-spinner {
      width:18px;height:18px;border-radius:50%;
      border:2px solid var(--text3);border-top-color:var(--accent);
      animation:rspin .7s linear infinite;flex-shrink:0;
    }
    @keyframes rspin{to{transform:rotate(360deg)}}

    .recent-empty{
      text-align:center;color:var(--text3);padding:40px 16px;font-size:.95rem;
    }

    .recent-row{
      display:flex;align-items:center;gap:12px;
      padding:10px 16px;border-bottom:1px solid var(--border);
      cursor:default;transition:background .15s;
    }
    .recent-row[onclick]{cursor:pointer;}
    .recent-row[onclick]:active{background:var(--bg2);}
    .recent-row-new{border-left:3px solid var(--accent);padding-left:13px;}

    .recent-badge{
      display:inline-block;background:var(--accent);color:#000;
      font-size:9px;font-weight:800;letter-spacing:.06em;
      padding:1px 5px;border-radius:4px;margin-right:5px;vertical-align:middle;
    }

    .recent-cover{
      width:46px;height:46px;border-radius:6px;overflow:hidden;
      flex-shrink:0;display:flex;align-items:center;justify-content:center;
    }
    .recent-cover img{width:100%;height:100%;object-fit:cover;}
    .recent-cover-ph{font-size:1.2rem;color:var(--text3);}

    .recent-info{flex:1;min-width:0;}
    .recent-title{
      font-weight:600;font-size:.9rem;color:var(--text1);
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
    }
    .recent-artist{
      font-size:.8rem;color:var(--text2);
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
    }
    .recent-meta{
      display:flex;align-items:center;gap:5px;
      margin-top:3px;font-size:.72rem;color:var(--text3);
    }
    .recent-by{color:var(--accent);opacity:.85;}
    .recent-play{color:var(--accent);font-size:.85rem;flex-shrink:0;opacity:.5;}
    .recent-row[onclick]:hover .recent-play{opacity:1;}

    .toast-new{border-left:3px solid var(--accent);}
  `;
  document.head.appendChild(s);
}


/* ═══════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════ */

function _recentPseudo() {
  return (typeof pseudo !== 'undefined' ? pseudo : null)
    || localStorage.getItem(PSEUDO_STORE)
    || 'Inconnu';
}

function _recentArtist(e) {
  if (!e.artist) return '—';
  return e.feat ? `${e.artist} feat. ${e.feat}` : e.artist;
}

function _recentDate(ts) {
  if (!ts) return '';
  const d = Math.floor((Date.now() - ts) / 60000);
  if (d < 1)   return "À l'instant";
  if (d < 60)  return `Il y a ${d} min`;
  if (d < 1440) return `Il y a ${Math.floor(d/60)} h`;
  if (d < 2880) return 'Hier';
  if (d < 10080) return `Il y a ${Math.floor(d/1440)} jours`;
  const dt = new Date(ts), p = n => String(n).padStart(2,'0');
  return `${p(dt.getDate())}/${p(dt.getMonth()+1)}/${dt.getFullYear()} ${p(dt.getHours())}:${p(dt.getMinutes())}`;
}


/* ═══════════════════════════════════════════════════════════
   TOAST NOTIFICATION
═══════════════════════════════════════════════════════════ */

function _recentToast(e) {
  if (_recentOpen) return;
  const box = document.getElementById('toasts');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast toast-new';
  el.style.cursor = 'pointer';
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;">
      <span style="font-size:20px;">🆕</span>
      <div>
        <div style="font-size:13px;font-weight:700;">${esc(e.title || e.filename || '?')}</div>
        <div style="font-size:11.5px;opacity:.8;">${esc(_recentArtist(e))}</div>
        <div style="font-size:11px;opacity:.6;">par ${esc(e.addedBy || '?')}</div>
      </div>
    </div>`;
  el.onclick = () => { el.remove(); if (typeof showView === 'function') showView('recent'); };
  box.appendChild(el);
  setTimeout(() => { try { el.remove(); } catch {} }, 7000);
}


/* ═══════════════════════════════════════════════════════════
   RENDU
═══════════════════════════════════════════════════════════ */

function _recentRender(entries) {
  const list = document.getElementById('recentList');
  const ctr  = document.getElementById('recentCount');
  if (!list) return;

  if (!entries.length) {
    list.innerHTML = '<div class="recent-empty">🎵 Aucun ajout pour l\'instant.</div>';
    if (ctr) ctr.textContent = '';
    return;
  }

  if (ctr) ctr.textContent = `${entries.length} ajout${entries.length > 1 ? 's' : ''}`;

  list.innerHTML = entries.map(e => {
    const tr    = typeof tracks !== 'undefined'
      ? tracks.find(t => t.filename === e.filename || (t.artist === e.artist && t.title === e.title))
      : null;
    const cover = tr ? getCover(tr.filename) : null;
    const grad  = gradFor((e.artist || '') + (e.title || ''));
    const isNew = e.addedAt > _recentLoginTs;

    return `
      <div class="recent-row${isNew ? ' recent-row-new' : ''}"
           ${tr ? `onclick="playTrack(${tr.id})"` : ''}>
        <div class="recent-cover" style="${cover ? '' : 'background:' + grad}">
          ${cover
            ? `<img src="${esc(cover)}" loading="lazy"
                    onerror="this.parentElement.style.background='${grad}';this.remove();">`
            : '<div class="recent-cover-ph">🎵</div>'}
        </div>
        <div class="recent-info">
          <div class="recent-title">
            ${isNew ? '<span class="recent-badge">NEW</span>' : ''}
            ${esc(e.title || e.filename || '?')}
          </div>
          <div class="recent-artist">${esc(_recentArtist(e))}</div>
          <div class="recent-meta">
            <span class="recent-by">👤 ${esc(e.addedBy || '?')}</span>
            <span>·</span>
            <span>${_recentDate(e.addedAt)}</span>
          </div>
        </div>
        ${tr ? '<div class="recent-play">▶</div>' : ''}
      </div>`;
  }).join('');
}


/* ═══════════════════════════════════════════════════════════
   LISTENER FIREBASE
═══════════════════════════════════════════════════════════ */

function _recentAttach() {
  if (_recentRef && _recentCb) return; // déjà actif

  try {
    _recentRef = firebase.database()
      .ref('arya/recent_uploads')
      .orderByChild('addedAt')
      .limitToLast(RECENT_LIMIT);

    _recentCb = _recentRef.on('value', snap => {
      const entries = [];
      snap.forEach(child => { entries.push({ _key: child.key, ...child.val() }); });
      entries.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));

      // Détection des vraies nouveautés
      entries.forEach(e => {
        if (!_recentKeys.has(e._key)) {
          if (
            _recentKeys.size > 0 &&
            (e.addedAt || 0) > _recentLoginTs &&
            e.addedBy !== _recentPseudo()
          ) {
            _recentToast(e);
          }
          _recentKeys.add(e._key);
        }
      });

      _recentEntries = entries;
      if (_recentOpen) _recentRender(entries);

    }, err => {
      console.error('[Arya Recent] Erreur listener:', err);
    });

  } catch (err) {
    console.error('[Arya Recent] Attach échoué:', err);
  }
}

function _recentDetach() {
  if (_recentRef && _recentCb) {
    try { _recentRef.off('value', _recentCb); } catch {}
  }
  _recentRef     = null;
  _recentCb      = null;
  _recentEntries = [];
}


/* ═══════════════════════════════════════════════════════════
   API PUBLIQUE
═══════════════════════════════════════════════════════════ */

/** Appelé au login — démarre les notifications background. */
function initRecentNotifications() {
  _recentDetach();
  _recentLoginTs = Date.now();
  _recentKeys    = new Set();
  _recentOpen    = false;
  _recentAttach();
}

/** Appelé quand on navigue vers la vue "recent". */
function initRecentView() {
  _injectRecentCSS();
  _recentOpen = true;

  if (!_recentRef) {
    // Spinner puis attache
    const list = document.getElementById('recentList');
    if (list) list.innerHTML = `
      <div class="recent-loading">
        <div class="recent-spinner"></div><span>Chargement…</span>
      </div>`;
    _recentAttach();
  } else if (_recentEntries.length) {
    // Données déjà en mémoire → rendu immédiat
    _recentRender(_recentEntries);
  }
  // Sinon le listener actif va déclencher _recentRender dès qu'il reçoit les données
}

/** Appelé quand on quitte la vue "recent". */
function exitRecentView() {
  _recentOpen = false;
}

/** Appelé au logout. */
function stopRecentNotifications() {
  _recentDetach();
  _recentKeys  = new Set();
  _recentOpen  = false;
}
