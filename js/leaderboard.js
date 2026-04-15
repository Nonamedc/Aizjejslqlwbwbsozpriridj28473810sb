/* ══════════════════════════════════════════════
   LEADERBOARD — Classement global des auditeurs
   Source : Firebase Realtime Database
══════════════════════════════════════════════ */

/* ── CSS injecté une seule fois ──────────────────────────────────────── */
(function injectLbCSS() {
  if (document.getElementById('lb-css')) return;
  const s = document.createElement('style');
  s.id = 'lb-css';
  s.textContent = `
  /* Podium */
  .lb-podium {
    display: flex;
    justify-content: center;
    align-items: flex-end;
    gap: 12px;
    padding: 24px 16px 0;
  }
  .lb-podium-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    flex: 1;
    max-width: 110px;
  }
  .lb-podium-avatar {
    border-radius: 50%;
    background: var(--surface2, #2a2a3a);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    font-weight: 700;
    color: var(--text1, #fff);
    flex-shrink: 0;
  }
  .lb-podium-avatar.me {
    outline: 2px solid var(--accent, #a78bfa);
    outline-offset: 2px;
  }
  .lb-podium-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text1, #fff);
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 90px;
  }
  .lb-podium-plays {
    font-size: 11px;
    color: var(--accent, #a78bfa);
    font-weight: 600;
  }
  .lb-podium-time {
    font-size: 10px;
    color: var(--text3, #888);
  }
  .lb-podium-medal {
    font-size: 20px;
    margin-top: 2px;
  }
  .lb-podium-bar {
    width: 100%;
    border-radius: 6px 6px 0 0;
    margin-top: 6px;
    opacity: 0.85;
  }

  /* Section labels */
  .lb-section-label {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: var(--text3, #888);
    padding: 20px 4px 8px;
  }

  /* Liste */
  .lb-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .lb-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: var(--surface, #1e1e2e);
    border-radius: 12px;
    border: 1px solid var(--border, rgba(255,255,255,.06));
    transition: background .15s;
  }
  .lb-row-me {
    border-color: var(--accent, #a78bfa);
    background: rgba(167,139,250,.07);
  }
  .lb-rank {
    font-size: 16px;
    min-width: 28px;
    text-align: center;
    flex-shrink: 0;
  }
  .lb-av {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--surface2, #2a2a3a);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
    font-weight: 700;
    color: var(--text1, #fff);
    flex-shrink: 0;
  }
  .lb-av.me {
    outline: 2px solid var(--accent, #a78bfa);
    outline-offset: 1px;
  }
  .lb-name {
    font-size: 13.5px;
    font-weight: 600;
    color: var(--text1, #fff);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .lb-sub {
    font-size: 11px;
    color: var(--text3, #888);
    margin-top: 1px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .lb-bar-bg {
    height: 3px;
    background: var(--border, rgba(255,255,255,.08));
    border-radius: 2px;
    margin-top: 5px;
    overflow: hidden;
  }
  .lb-bar-fill {
    height: 100%;
    background: var(--accent, #a78bfa);
    border-radius: 2px;
    transition: width .4s;
  }
  .lb-score {
    text-align: right;
    flex-shrink: 0;
  }
  `;
  document.head.appendChild(s);
})();


/* ── Helpers locaux ──────────────────────────────────────────────────── */

/** Échappe le HTML (utilise esc() global si dispo, sinon fallback) */
function _lbEsc(str) {
  if (typeof esc === 'function') return esc(str);
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Formate des secondes en "1h 23min" ou "42min" */
function _lbFmt(sec) {
  if (typeof fmtDuration === 'function') return fmtDuration(sec);
  if (!sec || sec < 0) return '0min';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

/** Génère un dégradé CSS depuis une chaîne (couleur stable par nom) */
function _lbGrad(str) {
  if (typeof gradFor === 'function') return gradFor(str);
  let h = 0;
  for (let i = 0; i < (str || '').length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffffffff;
  const hue = Math.abs(h) % 360;
  return `linear-gradient(135deg, hsl(${hue},55%,35%), hsl(${(hue + 40) % 360},55%,25%))`;
}


/* ── 1. Sauvegarder les stats locales dans Firebase ─────────────────── */
function saveMyStatsToFirebase() {
  // getStats() et pseudo viennent des autres modules JS de l'app
  if (typeof getStats !== 'function') return;
  if (typeof pseudo === 'undefined' || !pseudo) return;

  const localStats   = getStats();
  const localEntries = Object.values(localStats);
  if (!localEntries.length) return;

  const totalPlays = localEntries.reduce((a, e) => a + (e.plays   || 0), 0);
  const totalSec   = localEntries.reduce((a, e) => a + (e.seconds || 0), 0);

  if (totalPlays === 0) return;

  const topTrackEntry = [...localEntries].sort((a, b) => (b.plays || 0) - (a.plays || 0))[0] || null;
  const topTrack = topTrackEntry
    ? { title: topTrackEntry.title || '', artist: topTrackEntry.artist || '', plays: topTrackEntry.plays || 0 }
    : null;

  const artMap = {};
  localEntries.forEach(e => {
    if (e.artist) artMap[e.artist] = (artMap[e.artist] || 0) + (e.plays || 0);
  });
  const topArtistEntry = Object.entries(artMap).sort((a, b) => b[1] - a[1])[0] || null;
  const topArtist = topArtistEntry
    ? { name: topArtistEntry[0], plays: topArtistEntry[1] }
    : null;

  firebase.database()
    .ref('users/' + pseudo)
    .set({ pseudo, totalPlays, totalSec, topTrack, topArtist })
    .then(() => console.log('[Leaderboard] Stats sauvegardées →', pseudo, totalPlays, 'écoutes'))
    .catch(err => console.warn('[Leaderboard] Erreur sauvegarde Firebase :', err));
}


/* ── 2. Charger tous les utilisateurs depuis Firebase et afficher ───── */
function renderLeaderboard() {
  const content = document.getElementById('leaderboardContent');
  if (!content) return;

  content.innerHTML = `
    <div style="color:var(--text3);text-align:center;padding:60px 20px;font-size:14px;">
      ⏳ Chargement du classement…
    </div>`;

  firebase.database()
    .ref('users')
    .orderByChild('totalPlays')
    .once('value')
    .then(snapshot => {
      const allUsers = [];
      snapshot.forEach(child => {
        const u = child.val();
        if (u && u.pseudo && u.totalPlays > 0) allUsers.push(u);
      });
      allUsers.sort((a, b) => (b.totalPlays || 0) - (a.totalPlays || 0));
      _renderLeaderboardUI(content, allUsers);
    })
    .catch(err => {
      console.error('[Leaderboard] Erreur lecture Firebase :', err);
      content.innerHTML = `
        <div style="color:var(--text3);text-align:center;padding:60px 20px;font-size:14px;">
          ⚠️ Impossible de charger le classement.<br>
          <small>${err.message}</small>
        </div>`;
    });
}


/* ── 3. Rendu HTML ───────────────────────────────────────────────────── */
function _renderLeaderboardUI(content, sorted) {
  const medals = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];

  if (!sorted.length) {
    content.innerHTML = `
      <div style="color:var(--text3);text-align:center;padding:60px 20px;line-height:2.2;font-size:14px;">
        🏆<br>Aucun auditeur enregistré pour l'instant<br>
        <small>Le classement s'affiche dès qu'un utilisateur a écouté de la musique</small>
      </div>`;
    return;
  }

  const maxPlays = sorted[0]?.totalPlays || 1;

  // Agréger artistes et morceaux globaux
  const globalArtistMap = {};
  const globalTrackMap  = {};
  sorted.forEach(u => {
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

  // currentPseudo = variable globale "pseudo" de l'app
  const me = (typeof pseudo !== 'undefined') ? pseudo : null;

  content.innerHTML = `
    <!-- Podium top 3 -->
    <div class="lb-podium">
      ${sorted.slice(0, 3).map((u, i) => {
        const isMe = u.pseudo === me;
        const sz   = [80, 65, 55][i] || 50;
        return `
        <div class="lb-podium-col">
          <div class="lb-podium-avatar${isMe ? ' me' : ''}" style="height:${sz}px;width:${sz}px;">
            ${(_lbEsc(u.pseudo || '?'))[0].toUpperCase()}
          </div>
          <div class="lb-podium-name">${_lbEsc(u.pseudo)}</div>
          <div class="lb-podium-plays">${u.totalPlays} écoutes</div>
          <div class="lb-podium-time">${_lbFmt(u.totalSec || 0)}</div>
          <div class="lb-podium-medal">${medals[i]}</div>
          <div class="lb-podium-bar" style="height:${[90,65,45][i]}px;background:${['var(--accent)','#c0c0c0','#cd7f32'][i]};"></div>
        </div>`;
      }).join('')}
    </div>

    <!-- Classement complet -->
    <div class="lb-section-label">🎧 Classement complet</div>
    <div class="lb-list">
      ${sorted.map((u, i) => {
        const isMe = u.pseudo === me;
        const pct  = Math.round((u.totalPlays / maxPlays) * 100);
        return `
        <div class="lb-row${isMe ? ' lb-row-me' : ''}">
          <div class="lb-rank">${medals[i] || (i + 1)}</div>
          <div class="lb-av${isMe ? ' me' : ''}">${(_lbEsc(u.pseudo || '?'))[0].toUpperCase()}</div>
          <div style="flex:1;min-width:0;">
            <div class="lb-name">${_lbEsc(u.pseudo)}${isMe ? ' <span style="font-size:10px;color:var(--accent);">(vous)</span>' : ''}</div>
            ${u.topArtist ? `<div class="lb-sub">🎤 ${_lbEsc(u.topArtist.name)}</div>` : ''}
            <div class="lb-bar-bg"><div class="lb-bar-fill" style="width:${pct}%"></div></div>
          </div>
          <div class="lb-score">
            <div style="font-size:14px;font-weight:700;color:var(--accent);">${u.totalPlays}×</div>
            <div style="font-size:10px;color:var(--text3);">${_lbFmt(u.totalSec || 0)}</div>
          </div>
        </div>`;
      }).join('')}
    </div>

    <!-- Top artistes globaux -->
    ${topArtists.length ? `
    <div class="lb-section-label" style="margin-top:28px;">🎤 Artistes les plus écoutés</div>
    <div class="lb-list">
      ${topArtists.map(([name, plays], i) => {
        const img  = (typeof getArtistImg === 'function') ? getArtistImg(name) : null;
        const grad = _lbGrad(name);
        return `
        <div class="lb-row">
          <div class="lb-rank">${medals[i] || (i + 1)}</div>
          <div style="width:36px;height:36px;border-radius:50%;overflow:hidden;${img ? '' : 'background:' + grad};display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">
            ${img ? `<img src="${_lbEsc(img)}" style="width:100%;height:100%;object-fit:cover;">` : '🎤'}
          </div>
          <div style="flex:1;min-width:0;">
            <div class="lb-name">${_lbEsc(name)}</div>
          </div>
          <div class="lb-score"><div style="font-size:13px;font-weight:700;color:var(--accent);">${plays}×</div></div>
        </div>`;
      }).join('')}
    </div>` : ''}

    <!-- Top morceaux globaux -->
    ${topTracks.length ? `
    <div class="lb-section-label" style="margin-top:28px;">🎵 Morceaux les plus joués</div>
    <div class="lb-list">
      ${topTracks.map((t, i) => {
        const allTracks = (typeof tracks !== 'undefined') ? tracks : [];
        const tr    = allTracks.find(x => x.title === t.title && x.artist === t.artist);
        const cover = (tr && typeof getCover === 'function') ? getCover(tr.filename) : null;
        const grad  = _lbGrad((t.artist || '') + (t.title || ''));
        return `
        <div class="lb-row"${tr ? ` onclick="playTrack(${tr.id})" style="cursor:pointer;"` : ''}>
          <div class="lb-rank">${medals[i] || (i + 1)}</div>
          <div style="width:36px;height:36px;border-radius:7px;overflow:hidden;${cover ? '' : 'background:' + grad};display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">
            ${cover ? `<img src="${_lbEsc(cover)}" style="width:100%;height:100%;object-fit:cover;">` : '🎵'}
          </div>
          <div style="flex:1;min-width:0;">
            <div class="lb-name">${_lbEsc(t.title)}</div>
            <div class="lb-sub">${_lbEsc(t.artist)}</div>
          </div>
          <div class="lb-score"><div style="font-size:13px;font-weight:700;color:var(--accent);">${t.plays}×</div></div>
        </div>`;
      }).join('')}
    </div>` : ''}

    <div style="margin-top:20px;font-size:11.5px;color:var(--text3);text-align:center;line-height:1.8;">
      🔥 Classement global — tous les auditeurs de l'application<br>
      Vos stats sont automatiquement sauvegardées dans la base de données
    </div>
  `;

  const lbSub = document.getElementById('lbSub');
  if (lbSub) {
    lbSub.textContent = `${sorted.length} auditeur${sorted.length > 1 ? 's' : ''} au total`;
  }
}


/* ── 4. Auto-save périodique (toutes les 2 minutes) ─────────────────── */
setInterval(saveMyStatsToFirebase, 2 * 60 * 1000);
