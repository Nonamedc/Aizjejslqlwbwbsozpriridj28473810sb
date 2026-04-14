/* ══════════════════════════════════════════════
   LEADERBOARD — Classement global persistant
   Firebase : arya-app-86a3c-default-rtdb
   Tout le monde dedans, connecté ou non
══════════════════════════════════════════════ */

const FIREBASE_URL = 'https://arya-app-86a3c-default-rtdb.firebaseio.com';


// ── Push ses stats vers Firebase ─────────────────────────────────────────────
async function pushStatsToFirebase() {
  if (!pseudo) return;

  const localStats   = getStats();
  const localEntries = Object.values(localStats);
  const totalPlays   = localEntries.reduce((a, e) => a + (e.plays   || 0), 0);
  const totalSec     = localEntries.reduce((a, e) => a + (e.seconds || 0), 0);

  if (totalPlays === 0) return;

  const topTrackEntry = [...localEntries].sort((a, b) => b.plays - a.plays)[0] || null;

  const artMap = {};
  localEntries.forEach(e => {
    if (e.artist) artMap[e.artist] = (artMap[e.artist] || 0) + (e.plays || 0);
  });
  const topArtEntry = Object.entries(artMap).sort((a, b) => b[1] - a[1])[0] || null;

  const payload = {
    pseudo,
    totalPlays,
    totalSec,
    topTrack  : topTrackEntry
      ? { title: topTrackEntry.title, artist: topTrackEntry.artist, plays: topTrackEntry.plays }
      : null,
    topArtist : topArtEntry
      ? { name: topArtEntry[0], plays: topArtEntry[1] }
      : null,
    updatedAt : Date.now()
  };

  try {
    const key = encodeURIComponent(pseudo).replace(/\./g, '%2E');
    await fetch(`${FIREBASE_URL}/leaderboard/${key}.json`, {
      method  : 'PUT',
      headers : { 'Content-Type': 'application/json' },
      body    : JSON.stringify(payload)
    });
  } catch (err) {
    console.warn('[Leaderboard] Firebase push échoué :', err);
  }
}

// ← C'est ce nom que playback.js appelle déjà (lignes 253 & 279)
// Debounce 5s pour éviter de spammer Firebase à chaque écoute
function pushLeaderboardStats() {
  clearTimeout(window._lbPushTimer);
  window._lbPushTimer = setTimeout(pushStatsToFirebase, 5000);
}


// ── Lecture du classement depuis Firebase ────────────────────────────────────
let _lbCache     = null;
let _lbLastFetch = 0;

async function fetchLeaderboardData(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && _lbCache && now - _lbLastFetch < 30000) return _lbCache;

  try {
    const res  = await fetch(`${FIREBASE_URL}/leaderboard.json`);
    const data = await res.json();
    _lbCache     = data ? Object.values(data).filter(Boolean) : [];
    _lbLastFetch = now;
    return _lbCache;
  } catch (err) {
    console.warn('[Leaderboard] Firebase lecture échouée :', err);
    return _lbCache || [];
  }
}


// ── Rendu principal ──────────────────────────────────────────────────────────
async function renderLeaderboard() {
  const content = document.getElementById('leaderboardContent');
  if (!content) return;

  // Spinner
  content.innerHTML = `
    <div style="text-align:center;padding:60px 20px;color:var(--text3);">
      ⏳ Chargement du classement global…
    </div>`;

  // Push ses propres stats au passage
  pushStatsToFirebase();

  const allUsers = await fetchLeaderboardData();

  if (!allUsers.length) {
    content.innerHTML = `
      <div style="color:var(--text3);text-align:center;padding:60px 20px;line-height:2.2;font-size:14px;">
        🏆<br>Personne dans le classement pour l'instant<br>
        <small>Écoute quelques morceaux pour apparaître ici !</small>
      </div>`;
    return;
  }

  const sorted   = [...allUsers].sort((a, b) => (b.totalPlays || 0) - (a.totalPlays || 0));
  const maxPlays = sorted[0]?.totalPlays || 1;

  // Agrégats globaux
  const globalArtistMap = {};
  const globalTrackMap  = {};
  allUsers.forEach(u => {
    if (u.topArtist?.name) {
      const k = u.topArtist.name;
      globalArtistMap[k] = (globalArtistMap[k] || 0) + (u.topArtist.plays || 0);
    }
    if (u.topTrack?.title) {
      const k = u.topTrack.title;
      if (!globalTrackMap[k]) globalTrackMap[k] = { title: u.topTrack.title, artist: u.topTrack.artist, plays: 0 };
      globalTrackMap[k].plays += (u.topTrack.plays || 0);
    }
  });
  const topArtists = Object.entries(globalArtistMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topTracks  = Object.values(globalTrackMap).sort((a, b) => b.plays - a.plays).slice(0, 5);

  const medals = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];

  content.innerHTML = `

    <!-- ─── Podium top 3 ─── -->
    <div class="lb-podium">
      ${sorted.slice(0, 3).map((u, i) => {
        const isMe = u.pseudo === pseudo;
        const sz   = [80, 65, 55][i] || 50;
        return `
        <div class="lb-podium-col">
          <div class="lb-podium-avatar${isMe ? ' me' : ''}" style="height:${sz}px;width:${sz}px;">
            ${(u.pseudo || '?')[0].toUpperCase()}
          </div>
          <div class="lb-podium-name">${esc(u.pseudo)}</div>
          <div class="lb-podium-plays">${u.totalPlays} écoutes</div>
          <div class="lb-podium-time">${fmtDuration(u.totalSec || 0)}</div>
          <div class="lb-podium-medal">${medals[i]}</div>
          <div class="lb-podium-bar" style="height:${[90,65,45][i]}px;background:${['var(--accent)','#c0c0c0','#cd7f32'][i]};"></div>
        </div>`;
      }).join('')}
    </div>

    <!-- ─── Classement complet ─── -->
    <div class="lb-section-label">🎧 Classement complet</div>
    <div class="lb-list">
      ${sorted.map((u, i) => {
        const isMe = u.pseudo === pseudo;
        const pct  = Math.round((u.totalPlays / maxPlays) * 100);
        return `
        <div class="lb-row${isMe ? ' lb-row-me' : ''}">
          <div class="lb-rank">${medals[i] || i + 1}</div>
          <div class="lb-av${isMe ? ' me' : ''}">${(u.pseudo || '?')[0].toUpperCase()}</div>
          <div style="flex:1;min-width:0;">
            <div class="lb-name">
              ${esc(u.pseudo)}
              ${isMe ? '<span style="font-size:10px;color:var(--accent);"> (vous)</span>' : ''}
            </div>
            ${u.topArtist?.name ? `<div class="lb-sub">🎤 ${esc(u.topArtist.name)}</div>` : ''}
            <div class="lb-bar-bg"><div class="lb-bar-fill" style="width:${pct}%"></div></div>
          </div>
          <div class="lb-score">
            <div style="font-size:14px;font-weight:700;color:var(--accent);">${u.totalPlays}×</div>
            <div style="font-size:10px;color:var(--text3);">${fmtDuration(u.totalSec || 0)}</div>
          </div>
        </div>`;
      }).join('')}
    </div>

    <!-- ─── Top artistes ─── -->
    ${topArtists.length ? `
    <div class="lb-section-label" style="margin-top:28px;">🎤 Artistes les plus écoutés</div>
    <div class="lb-list">
      ${topArtists.map(([name, plays], i) => {
        const img  = getArtistImg(name);
        const grad = gradFor(name);
        return `
        <div class="lb-row">
          <div class="lb-rank">${medals[i] || i + 1}</div>
          <div style="width:36px;height:36px;border-radius:50%;overflow:hidden;
               ${img ? '' : 'background:' + grad};
               display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">
            ${img ? `<img src="${esc(img)}" style="width:100%;height:100%;object-fit:cover;">` : '🎤'}
          </div>
          <div style="flex:1;min-width:0;"><div class="lb-name">${esc(name)}</div></div>
          <div class="lb-score"><div style="font-size:13px;font-weight:700;color:var(--accent);">${plays}×</div></div>
        </div>`;
      }).join('')}
    </div>` : ''}

    <!-- ─── Top morceaux ─── -->
    ${topTracks.length ? `
    <div class="lb-section-label" style="margin-top:28px;">🎵 Morceaux les plus joués</div>
    <div class="lb-list">
      ${topTracks.map((t, i) => {
        const tr    = tracks.find(x => x.title === t.title && x.artist === t.artist);
        const cover = tr ? getCover(tr.filename) : null;
        const grad  = gradFor((t.artist || '') + (t.title || ''));
        return `
        <div class="lb-row"${tr ? ` onclick="playTrack(${tr.id})" style="cursor:pointer;"` : ''}>
          <div class="lb-rank">${medals[i] || i + 1}</div>
          <div style="width:36px;height:36px;border-radius:7px;overflow:hidden;
               ${cover ? '' : 'background:' + grad};
               display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">
            ${cover ? `<img src="${esc(cover)}" style="width:100%;height:100%;object-fit:cover;">` : '🎵'}
          </div>
          <div style="flex:1;min-width:0;">
            <div class="lb-name">${esc(t.title)}</div>
            <div class="lb-sub">${esc(t.artist)}</div>
          </div>
          <div class="lb-score"><div style="font-size:13px;font-weight:700;color:var(--accent);">${t.plays}×</div></div>
        </div>`;
      }).join('')}
    </div>` : ''}

    <!-- ─── Pied de page ─── -->
    <div style="margin-top:24px;font-size:11.5px;color:var(--text3);text-align:center;line-height:2;">
      🌍 Classement global — ${sorted.length} auditeur${sorted.length > 1 ? 's' : ''} au total<br>
      <span style="font-size:10px;">Mis à jour automatiquement à chaque écoute</span><br>
      <button onclick="_lbCache=null;renderLeaderboard()" style="
        margin-top:8px;padding:5px 14px;border-radius:20px;border:1px solid var(--border);
        background:transparent;color:var(--text2);font-size:11px;cursor:pointer;">
        🔄 Actualiser
      </button>
    </div>
  `;

  // Sous-titre header
  const lbSub = document.getElementById('lbSub');
  if (lbSub) {
    lbSub.textContent = `${sorted.length} auditeur${sorted.length > 1 ? 's' : ''} · classement global`;
  }
}
