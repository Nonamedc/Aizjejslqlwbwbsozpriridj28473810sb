/* ═══════════════════════════════════════════════════════════
   DASHBOARD.JS — Arya v2
   Vue d'accueil, navigation principale et gestion du pseudo.

   Dépend de : config.js, utils.js, library.js, covers.js,
               render.js, playback.js, online.js
═══════════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════════════════════════ */

function renderDashboard() {
  const s          = getStats();
  const h          = getHistory();
  const favs       = getFavs();
  const entries    = Object.entries(s).map(([fn, d]) => ({ ...d, filename: fn }));
  const totalPlays = entries.reduce((a, e) => a + (e.plays   || 0), 0);
  const totalSec   = entries.reduce((a, e) => a + (e.seconds || 0), 0);
  const topTracks  = [...entries].sort((a, b) => b.plays - a.plays).slice(0, 5);
  const onlineCount = Object.keys(onlineUsers).length;

  /* ── Salutation par heure ── */
  const hr    = new Date().getHours();
  const greet = hr < 6  ? 'Bonne nuit 🌙'
              : hr < 12 ? 'Bonjour ☀️'
              : hr < 18 ? 'Bon après-midi 🌤'
              :            'Bonne soirée 🌆';
  document.getElementById('dashGreeting').textContent = pseudo ? `${greet}, ${pseudo}` : greet;

  /* ── Piste en cours / dernière écoutée ── */
  const curTrack = currentId != null ? tracks.find(t => t.id === currentId) : null;
  const lastPlay = !curTrack && h.length ? tracks.find(t => t.filename === h[0].filename) : null;
  const nowTrack = curTrack || lastPlay;

  let nowHtml = '';
  if (nowTrack) {
    const cover = getCover(nowTrack.filename);
    const grad  = gradFor(nowTrack.artist + nowTrack.album);
    nowHtml = `
      <div class="dash-now" onclick="playTrack(${nowTrack.id})">
        <div class="dash-now-art" style="${cover ? '' : 'background:' + grad}">
          ${cover
            ? `<img src="${esc(cover)}" loading="lazy" onerror="this.parentElement.style.background='${grad}';this.remove();">`
            : '🎵'}
        </div>
        <div style="min-width:0;flex:1;">
          <div class="dash-now-label">${curTrack ? 'En cours' : 'Dernière écoute'}</div>
          <div class="dash-now-title">${esc(nowTrack.title)}</div>
          <div class="dash-now-artist">${esc(nowTrack.artist)}</div>
        </div>
        <button class="p-btn p-play"
                style="width:38px;height:38px;font-size:14px;flex-shrink:0;"
                onclick="event.stopPropagation();${curTrack ? 'togglePlay()' : 'playTrack(' + nowTrack.id + ')'}">
          ${isPlaying && curTrack ? '⏸' : '▶'}
        </button>
      </div>`;
  }

  /* ── KPIs ── */
  const kpiHtml = `
    <div class="dash-kpis">
      <div class="dash-kpi">
        <div class="dash-kpi-val">${totalPlays}</div>
        <div class="dash-kpi-lbl">écoutes</div>
      </div>
      <div class="dash-kpi">
        <div class="dash-kpi-val">${fmtDuration(totalSec)}</div>
        <div class="dash-kpi-lbl">temps total</div>
      </div>
      <div class="dash-kpi">
        <div class="dash-kpi-val">${tracks.length}</div>
        <div class="dash-kpi-lbl">titres</div>
      </div>
    </div>`;

  /* ── Raccourcis ── */
  const scHtml = `
    <div class="dash-shortcuts">
      <div class="dash-sc" onclick="showView('favorites')">
        <span class="dash-sc-ico">❤️</span>
        <div>
          <div class="dash-sc-label">Favoris</div>
          <div class="dash-sc-sub">${favs.size} titre${favs.size > 1 ? 's' : ''}</div>
        </div>
      </div>
      <div class="dash-sc" onclick="showView('online')">
        <span class="dash-sc-ico">🌐</span>
        <div>
          <div class="dash-sc-label">En ligne</div>
          <div class="dash-sc-sub">${onlineCount} connecté${onlineCount > 1 ? 's' : ''}</div>
        </div>
      </div>
      <div class="dash-sc" onclick="showView('history')">
        <span class="dash-sc-ico">🕐</span>
        <div>
          <div class="dash-sc-label">Historique</div>
          <div class="dash-sc-sub">${h.length} lecture${h.length > 1 ? 's' : ''}</div>
        </div>
      </div>
      <div class="dash-sc" onclick="showView('leaderboard')">
        <span class="dash-sc-ico">🏆</span>
        <div>
          <div class="dash-sc-label">Classement</div>
          <div class="dash-sc-sub" id="lbDashSub">Voir le podium</div>
        </div>
      </div>
      <div class="dash-sc" onclick="showView('party')">
        <span class="dash-sc-ico">🎉</span>
        <div>
          <div class="dash-sc-label">Mode Fête</div>
          <div class="dash-sc-sub">${partyMode ? 'Actif' : 'Inactif'}</div>
        </div>
      </div>
    </div>`;

  /* ── Top morceaux ── */
  let topHtml = '';
  if (topTracks.length) {
    const maxP = topTracks[0].plays || 1;
    topHtml = `
      <div class="dash-section">
        <div class="dash-section-title">🏆 Vos top morceaux</div>
        ${topTracks.map((t, i) => {
          const tr    = tracks.find(x => x.filename === t.filename);
          const cover = tr ? getCover(tr.filename) : null;
          const grad  = gradFor(t.artist + t.filename);
          return `
            <div class="dash-mini-row" ${tr ? `onclick="playTrack(${tr.id})"` : ''}>
              <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text3);
                          width:16px;text-align:center;flex-shrink:0;">${i + 1}</div>
              <div class="dash-mini-art" style="${cover ? '' : 'background:' + grad}">
                ${cover
                  ? `<img src="${esc(cover)}" loading="lazy" onerror="this.parentElement.style.background='${grad}';this.remove();">`
                  : '🎵'}
              </div>
              <div class="dash-mini-info">
                <div class="dash-mini-title">${esc(t.title)}</div>
                <div class="dash-mini-sub">${esc(t.artist)}</div>
              </div>
              <div class="dash-mini-count">${t.plays}×</div>
            </div>`;
        }).join('')}
      </div>`;
  }

  /* ── Historique récent ── */
  let recentHtml = '';
  if (h.length) {
    recentHtml = `
      <div class="dash-section">
        <div class="dash-section-title">🕐 Récemment écouté</div>
        ${h.slice(0, 5).map(e => {
          const tr    = tracks.find(x => x.filename === e.filename);
          const cover = tr ? getCover(tr.filename) : null;
          const grad  = gradFor(e.artist + e.album);
          return `
            <div class="dash-mini-row" ${tr ? `onclick="playTrack(${tr.id})"` : ''}>
              <div class="dash-mini-art" style="${cover ? '' : 'background:' + grad}">
                ${cover
                  ? `<img src="${esc(cover)}" loading="lazy" onerror="this.parentElement.style.background='${grad}';this.remove();">`
                  : '🎵'}
              </div>
              <div class="dash-mini-info">
                <div class="dash-mini-title">${esc(e.title)}</div>
                <div class="dash-mini-sub">${esc(e.artist)}</div>
              </div>
              <div class="dash-mini-count"
                   style="color:var(--text3);font-family:'Outfit',sans-serif;font-weight:400;font-size:11px;">
                ${relTime(e.ts)}
              </div>
            </div>`;
        }).join('')}
      </div>`;
  }

  /* ── État vide ── */
  const emptyHtml = (!totalPlays && !h.length) ? `
    <div style="color:var(--text3);text-align:center;padding:40px 0;font-size:14px;line-height:2.2;">
      🎵<br>Commencez à écouter pour voir vos stats ici
    </div>` : '';

  /* ── Artistes ── */
  const arts = getArtists();
  let artistsHtml = '';
  if (arts.length) {
    artistsHtml = `
      <div class="dash-section">
        <div class="dash-section-title"
             style="display:flex;align-items:center;justify-content:space-between;">
          <span>🎤 Artistes</span>
          <span style="font-size:10px;color:var(--accent);cursor:pointer;font-weight:600;
                       letter-spacing:.06em;" onclick="showView('artists')">Voir tout →</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));
                    gap:10px;margin-top:8px;">
          ${arts.slice(0, 12).map(a => {
            const img  = getArtistImg(a.name);
            const grad = gradFor(a.name);
            return `
              <div data-aname="${esc(a.name)}" data-atype="artist"
                   onclick="showDetailFromEl(this)"
                   style="display:flex;flex-direction:column;align-items:center;gap:6px;
                          cursor:pointer;padding:8px 4px;border-radius:10px;transition:background .15s;"
                   onmouseenter="this.style.background='var(--surface)'"
                   onmouseleave="this.style.background='transparent'">
                <div style="width:52px;height:52px;border-radius:50%;overflow:hidden;
                            ${img ? '' : 'background:' + grad};display:flex;align-items:center;
                            justify-content:center;font-size:20px;flex-shrink:0;"
                     data-artist-art="${escAttr(a.name)}">
                  ${img
                    ? `<img src="${esc(img)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"
                            onerror="this.parentElement.style.background='${grad}';this.remove();">`
                    : '🎤'}
                </div>
                <div style="font-size:11px;font-weight:600;text-align:center;color:var(--text);
                            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
                            width:100%;max-width:72px;">${esc(a.name)}</div>
                <div style="font-size:10px;color:var(--text3);">${a.tracks.length} titre${a.tracks.length > 1 ? 's' : ''}</div>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  document.getElementById('dashContent').innerHTML =
    nowHtml + kpiHtml + scHtml + artistsHtml + topHtml + recentHtml + emptyHtml;
}


/* ═══════════════════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════════════════ */

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.mn-btn').forEach(n => n.classList.toggle('active', n.dataset.view === name));

  document.getElementById('view-' + name)?.classList.add('active');
  document.querySelectorAll(`.nav-item[data-view="${name}"]`).forEach(n => n.classList.add('active'));

  prevView = name;

  // Lazy render — vues lourdes rendues à la demande
  if (name === 'dashboard')  renderDashboard();
  if (name === 'stats')      renderStats();
  if (name === 'history')    renderHistory();
  if (name === 'favorites')  renderFavorites();
  if (name === 'party')      renderPartyView();
  if (name === 'upload')     { loadUploadCreds(); renderUploadQueue(); }
}

/** Active une vue sans toucher à la nav ni déclencher de lazy render. */
function showViewRaw(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + name)?.classList.add('active');
}


/* ═══════════════════════════════════════════════════════════
   PSEUDO
═══════════════════════════════════════════════════════════ */

function setPseudo() {
  const val = document.getElementById('pseudoInput').value.trim();
  if (!val) return;
  pseudo = val;
  localStorage.setItem(PSEUDO_STORE, pseudo);
  document.getElementById('pseudoScreen').style.display = 'none';
  document.getElementById('sfPseudo').textContent       = pseudo;
  initAbly();
}

function changePseudo() {
  document.getElementById('pseudoInput').value          = pseudo || '';
  document.getElementById('pseudoScreen').style.display = 'flex';
  if (ablyClient) {
    try { ablyClient.close(); } catch {}
    ablyClient = ablyChannel = null;
  }
}

function loadPseudo() {
  const saved = localStorage.getItem(PSEUDO_STORE);
  if (saved) {
    pseudo = saved;
    document.getElementById('sfPseudo').textContent       = pseudo;
    document.getElementById('pseudoScreen').style.display = 'none';
    initAbly();
  }

  document.getElementById('pseudoInput')
    .addEventListener('keydown', e => { if (e.key === 'Enter') setPseudo(); });

  // Sync UI bouton repeat (REPEAT.ALL par défaut)
  const rb = document.getElementById('btnRepeat');
  if (rb) { rb.textContent = '↺'; rb.classList.add('on'); }
}
