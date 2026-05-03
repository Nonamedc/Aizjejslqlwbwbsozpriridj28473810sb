/* ═══════════════════════════════════════════════════════════
   DASHBOARD.JS — Arya
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
  if (name === 'recent')     { if (typeof initRecentView === 'function') initRecentView(); }
  if (name === 'profile')    { renderProfileView(); }
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


/* ═══════════════════════════════════════════════════════════
   VUE PROFIL UTILISATEUR
═══════════════════════════════════════════════════════════ */

function renderProfileView() {
  const content = document.getElementById('profileContent');
  if (!content) return;

  const stats      = getStats();
  const entries    = Object.values(stats);
  const totalPlays = entries.reduce((a, e) => a + (e.plays   || 0), 0);
  const totalSec   = entries.reduce((a, e) => a + (e.seconds || 0), 0);
  const favCount   = getFavs().size;
  const histCount  = getHistory().length;
  const plCount    = Object.keys(JSON.parse(localStorage.getItem(PLAYLIST_STORE) || '{}')).length;
  const blockCount = typeof BlockList !== 'undefined' ? BlockList.getAll().size : 0;

  const topArtists = (() => {
    const map = {};
    entries.forEach(e => {
      if (!e.artist) return;
      map[e.artist] = (map[e.artist] || 0) + (e.plays || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 3);
  })();

  const user     = typeof _currentUser !== 'undefined' ? _currentUser : null;
  const photoUrl = localStorage.getItem('arya_profile_photo') || user?.photoURL || null;

  content.innerHTML = `
    <div style="padding:18px;background:var(--surface);border:1px solid var(--border);border-radius:18px;margin-bottom:20px;">
      <!-- Header profil -->
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">
        <div style="position:relative;flex-shrink:0;" onclick="_openPhotoOptions()">
          ${photoUrl
            ? `<img src="${photoUrl}" style="width:76px;height:76px;border-radius:50%;object-fit:cover;border:3px solid var(--accent);"
                    onerror="this.outerHTML='<div style=\'width:76px;height:76px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;color:#000;\'>${(pseudo||'?')[0].toUpperCase()}</div>'">`
            : `<div style="width:76px;height:76px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;color:#000;">${(pseudo||'?')[0].toUpperCase()}</div>`}
          <div style="position:absolute;bottom:0;right:0;width:24px;height:24px;border-radius:50%;
                      background:var(--surface);border:2px solid var(--border);
                      display:flex;align-items:center;justify-content:center;font-size:12px;cursor:pointer;">
            📷
          </div>
        </div>
        <div style="flex:1;min-width:0;">
          <div id="profileNameDisplay" style="font-size:20px;font-weight:700;display:flex;align-items:center;gap:8px;">
            ${esc(pseudo || '—')}
            <span onclick="_editPseudoInline()" style="font-size:13px;cursor:pointer;opacity:.5;">✏️</span>
          </div>
          <div id="profilePseudoEdit" style="display:none;margin-top:4px;">
            <input id="profilePseudoInput" class="form-input"
                   value="${esc(pseudo || '')}" maxlength="20"
                   style="font-size:14px;padding:8px 12px;"
                   onkeydown="if(event.key==='Enter')_savePseudoInline();if(event.key==='Escape')_cancelPseudoEdit()">
            <div style="display:flex;gap:6px;margin-top:6px;">
              <button class="btn btn-acc" style="font-size:12px;padding:6px 12px;flex:1;" onclick="_savePseudoInline()">✅ OK</button>
              <button class="btn btn-ghost" style="font-size:12px;padding:6px 12px;" onclick="_cancelPseudoEdit()">Annuler</button>
            </div>
          </div>
          <div style="font-size:12px;color:var(--text3);margin-top:4px;">${esc(user?.email || '')}</div>
        </div>
      </div>
      <!-- Actions -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-ghost" style="font-size:12px;padding:7px 14px;" onclick="_openPhotoOptions()">📷 Photo</button>
        <button class="btn btn-ghost" style="font-size:12px;padding:7px 14px;color:var(--rose);border-color:var(--rose);" onclick="Auth.signOut()">Déconnexion</button>
      </div>
      <input id="profilePhotoFile" type="file" accept="image/*" style="display:none" onchange="_uploadProfilePhoto(this)">
    </div>

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px;">
      ${[
        ['🎵', totalPlays, 'écoutes'],
        ['⏱', fmtDuration(totalSec), 'temps'],
        ['❤️', favCount, 'favoris'],
        ['🕐', histCount, 'historique'],
        ['📋', plCount, 'playlists'],
        ['🚫', blockCount, 'bloquées'],
      ].map(([ico, val, lbl]) => `
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;
                    padding:14px 10px;text-align:center;">
          <div style="font-size:20px;">${ico}</div>
          <div style="font-size:16px;font-weight:700;margin:4px 0;">${val}</div>
          <div style="font-size:11px;color:var(--text3);">${lbl}</div>
        </div>`).join('')}
    </div>

    ${topArtists.length ? `
    <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px;">
      🎤 Artistes favoris
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;">
      ${topArtists.map(([name, plays], i) => {
        const img  = getArtistImg(name);
        const grad = gradFor(name);
        return `
          <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;
                      background:var(--surface);border:1px solid var(--border);border-radius:12px;"
               onclick="showDetail('artist','${escAttr(name)}')">
            <div style="width:40px;height:40px;border-radius:50%;overflow:hidden;flex-shrink:0;
                        display:flex;align-items:center;justify-content:center;font-size:16px;
                        ${img ? '' : 'background:' + grad}">
              ${img ? `<img src="${esc(img)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : '🎤'}
            </div>
            <div style="flex:1;">
              <div style="font-size:13.5px;font-weight:600;">${esc(name)}</div>
              <div style="font-size:11.5px;color:var(--text2);">${plays} écoute${plays > 1 ? 's' : ''}</div>
            </div>
            <span style="font-size:16px;color:var(--text3);">${['🥇','🥈','🥉'][i]}</span>
          </div>`;
      }).join('')}
    </div>` : ''}

    ${blockCount > 0 ? `
    <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px;">
      🚫 Pistes bloquées (${blockCount})
    </div>
    <button class="btn btn-ghost" style="font-size:13px;border-color:var(--rose);color:var(--rose);margin-bottom:20px;"
            onclick="if(confirm('Débloquer toutes les pistes ?')) { BlockList.clear(); renderProfileView(); }">
      ✅ Tout débloquer
    </button>` : ''}
  `;
}


/* ═══════════════════════════════════════════════════════════
   PROFIL — Photo & Pseudo inline
═══════════════════════════════════════════════════════════ */

function _editPseudoInline() {
  document.getElementById('profileNameDisplay')?.style.setProperty('display', 'none');
  const edit = document.getElementById('profilePseudoEdit');
  if (edit) { edit.style.display = ''; document.getElementById('profilePseudoInput')?.focus(); }
}

function _cancelPseudoEdit() {
  document.getElementById('profileNameDisplay')?.style.removeProperty('display');
  document.getElementById('profilePseudoEdit').style.display = 'none';
}

async function _savePseudoInline() {
  const val = (document.getElementById('profilePseudoInput')?.value || '').trim();
  if (!val || val.length < 2) { toast('Pseudo trop court (min. 2 car.)', true); return; }
  pseudo = val;
  localStorage.setItem(PSEUDO_STORE, pseudo);
  // Sync Firebase
  try {
    if (typeof _uid !== 'undefined' && _uid) {
      await firebase.database().ref(`users/${_uid}/pseudo`).set(pseudo);
    }
  } catch {}
  // Ably update
  if (typeof ablyChannel !== 'undefined' && ablyChannel) {
    ablyChannel.presence.update({ pseudo, track: null, party: false }).catch(() => {});
  }
  toast('✅ Pseudo mis à jour');
  _cancelPseudoEdit();
  // Mettre à jour l'affichage
  const display = document.getElementById('profileNameDisplay');
  if (display) display.innerHTML = `${esc(pseudo)} <span onclick="_editPseudoInline()" style="font-size:13px;cursor:pointer;opacity:.5;">✏️</span>`;
  document.getElementById('sfPseudo').textContent = pseudo;
  if (typeof _updateSidebarUser === 'function') _updateSidebarUser();
}

function _openPhotoOptions() {
  // Sheet choix : URL ou fichier local
  let sheet = document.getElementById('photoOptSheet');
  if (!sheet) {
    sheet = document.createElement('div');
    sheet.id = 'photoOptSheet';
    sheet.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;background:rgba(0,0,0,.65);backdrop-filter:blur(4px);';
    document.body.appendChild(sheet);
  }
  sheet.innerHTML = `
    <div style="background:var(--surface);border-radius:22px 22px 0 0;width:100%;padding:20px 20px 36px;">
      <div style="width:36px;height:4px;background:var(--border);border-radius:2px;margin:0 auto 20px;"></div>
      <div style="font-size:15px;font-weight:700;margin-bottom:16px;">📷 Photo de profil</div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <button class="btn btn-ghost" style="text-align:left;padding:13px 16px;font-size:14px;"
                onclick="document.getElementById('profilePhotoFile').click();document.getElementById('photoOptSheet').remove()">
          📁 Choisir depuis l'appareil
        </button>
        <div style="display:flex;gap:8px;">
          <input class="form-input" id="photoUrlInput" placeholder="🌐 Coller une URL d'image…" style="flex:1;font-size:13px;">
          <button class="btn btn-acc" style="font-size:13px;padding:10px 16px;white-space:nowrap;"
                  onclick="_applyPhotoUrl()">OK</button>
        </div>
        ${localStorage.getItem('arya_profile_photo') ? `
        <button class="btn btn-ghost" style="color:var(--rose);border-color:var(--rose);font-size:13px;"
                onclick="_removeProfilePhoto()">🗑 Supprimer la photo</button>` : ''}
      </div>
      <button onclick="document.getElementById('photoOptSheet').remove()"
              style="position:absolute;top:14px;right:16px;background:none;border:none;font-size:20px;cursor:pointer;color:var(--text2);">✕</button>
    </div>`;
  sheet.onclick = e => { if (e.target === sheet) sheet.remove(); };
}

function _applyPhotoUrl() {
  const url = (document.getElementById('photoUrlInput')?.value || '').trim();
  if (!url) return;
  _saveProfilePhoto(url);
  document.getElementById('photoOptSheet')?.remove();
}

function _uploadProfilePhoto(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 2 * 1_048_576) { toast('⚠️ Image trop lourde (max 2 Mo)', true); return; }
  const reader = new FileReader();
  reader.onload = e => { _saveProfilePhoto(e.target.result); };
  reader.readAsDataURL(file);
}

/**
 * Compresse une image (URL ou base64) en miniature JPEG 100×100 max.
 * Retourne une Promise<string> avec le dataURL compressé.
 */
function _compressPhoto(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const MAX = 100;
      const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
      const w = Math.round(img.width  * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => resolve(src); // fallback : on garde l'original
    img.src = src;
  });
}

async function _saveProfilePhoto(dataOrUrl) {
  let finalData = dataOrUrl;

  // Compresse si c'est un base64 ou une URL externe (pour uniformiser)
  try {
    finalData = await _compressPhoto(dataOrUrl);
  } catch {}

  // Sauvegarde locale
  localStorage.setItem('arya_profile_photo', finalData);

  // Push vers Firebase (base64 compressé ≈ 5–12 Ko — acceptable pour RTDB)
  if (typeof _uid !== 'undefined' && _uid) {
    firebase.database().ref(`users/${_uid}/photoUrl`).set(finalData).catch(() => {});
    // Met à jour aussi le leaderboard pour que les autres voient la photo
    if (typeof pseudo !== 'undefined' && pseudo) {
      firebase.database().ref(`leaderboard/${pseudo}/photoUrl`).set(finalData).catch(() => {});
    }
  }

  toast('✅ Photo de profil mise à jour');
  renderProfileView();
  if (typeof _updateSidebarUser === 'function') _updateSidebarUser();
}

function _removeProfilePhoto() {
  localStorage.removeItem('arya_profile_photo');
  _closeGenSheet('photoOptSheet');
  // Supprime aussi dans Firebase
  if (typeof _uid !== 'undefined' && _uid) {
    firebase.database().ref(`users/${_uid}/photoUrl`).remove().catch(() => {});
    if (typeof pseudo !== 'undefined' && pseudo) {
      firebase.database().ref(`leaderboard/${pseudo}/photoUrl`).remove().catch(() => {});
    }
  }
  toast('🗑 Photo supprimée');
  renderProfileView();
  if (typeof _updateSidebarUser === 'function') _updateSidebarUser();
}
