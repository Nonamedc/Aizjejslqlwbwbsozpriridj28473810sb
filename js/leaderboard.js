/* ═══════════════════════════════════════════════════════════
   LEADERBOARD.JS — Arya V4
   Classement global + vue profil par utilisateur.
   Source : Firebase Realtime Database → leaderboard/{pseudo}

   Dépend de : config.js, utils.js, covers.js,
               library.js, firebase-init.js
═══════════════════════════════════════════════════════════ */

const STATS_MONTHLY_STORE = 'arya_stats_monthly';


/* ═══════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════ */

function getMonthlyStats() {
  try { return JSON.parse(localStorage.getItem(STATS_MONTHLY_STORE) || '{}'); }
  catch { return {}; }
}

function _buildTop10Artists(entries) {
  const map = {};
  entries.forEach(e => {
    if (!e.artist) return;
    if (!map[e.artist]) map[e.artist] = { name: e.artist, plays: 0, sec: 0 };
    map[e.artist].plays += (e.plays   || 0);
    map[e.artist].sec   += (e.seconds || e.sec || 0);
  });
  return Object.values(map).sort((a, b) => b.plays - a.plays).slice(0, 10);
}

function _buildTop10Tracks(entries) {
  return [...entries]
    .filter(e => e.title)
    .sort((a, b) => (b.plays || 0) - (a.plays || 0))
    .slice(0, 10)
    .map(e => ({
      title:  e.title  || '',
      artist: e.artist || '',
      plays:  e.plays  || 0,
      sec:    e.seconds || e.sec || 0,
    }));
}

/** Helper HTML pochette piste (36×36). */
function _lbCoverHtml(cover, grad, radius = '7px') {
  return `<div style="width:36px;height:36px;border-radius:${radius};overflow:hidden;
    flex-shrink:0;display:flex;align-items:center;justify-content:center;
    font-size:14px;${cover ? '' : 'background:' + grad}">
    ${cover ? `<img src="${esc(cover)}" style="width:100%;height:100%;object-fit:cover;">` : (radius === '50%' ? '🎤' : '🎵')}
  </div>`;
}


/* ═══════════════════════════════════════════════════════════
   PUSH VERS FIREBASE
   Appelé depuis playback.js après chaque écoute à 50%.
═══════════════════════════════════════════════════════════ */

function pushLeaderboardStats() {
  if (!pseudo) return;

  const t = tracks.find(x => x.id === currentId);
  if (t) {
    // Stats mensuelles locales — clé séparée de `monthly` plus bas
    const monthKey      = new Date().toISOString().slice(0, 7);
    const curMonthStats = getMonthlyStats();
    if (!curMonthStats[monthKey]) curMonthStats[monthKey] = {};
    if (!curMonthStats[monthKey][t.filename]) {
      curMonthStats[monthKey][t.filename] = { plays: 0, artist: t.artist || '', title: t.title || '' };
    }
    curMonthStats[monthKey][t.filename].plays++;
    localStorage.setItem(STATS_MONTHLY_STORE, JSON.stringify(curMonthStats));
  }

  const allStats      = getStats();
  const entries       = Object.values(allStats);
  const totalPlays    = entries.reduce((a, e) => a + (e.plays   || 0), 0);
  const totalSec      = entries.reduce((a, e) => a + (e.seconds || 0), 0);
  const top10Artists  = _buildTop10Artists(entries);
  const top10Tracks   = _buildTop10Tracks(entries);

  const monthly      = getMonthlyStats();
  const monthlyData  = {};
  const yearlyAgg    = {};

  Object.entries(monthly).forEach(([mk, trackMap]) => {
    const mEntries = Object.values(trackMap);
    const mTotal   = mEntries.reduce((a, e) => a + (e.plays || 0), 0);
    monthlyData[mk] = {
      totalPlays:   mTotal,
      top10Artists: _buildTop10Artists(mEntries),
      top10Tracks:  _buildTop10Tracks(mEntries),
    };
    const year = mk.slice(0, 4);
    if (!yearlyAgg[year]) yearlyAgg[year] = { trackMap: {}, totalPlays: 0 };
    yearlyAgg[year].totalPlays += mTotal;
    mEntries.forEach(e => {
      const key = (e.title || '') + '|||' + (e.artist || '');
      if (!yearlyAgg[year].trackMap[key]) {
        yearlyAgg[year].trackMap[key] = { title: e.title || '', artist: e.artist || '', plays: 0 };
      }
      yearlyAgg[year].trackMap[key].plays += (e.plays || 0);
    });
  });

  const yearlyData = {};
  Object.entries(yearlyAgg).forEach(([year, data]) => {
    const yEntries = Object.values(data.trackMap);
    yearlyData[year] = {
      totalPlays:   data.totalPlays,
      top10Artists: _buildTop10Artists(yEntries),
      top10Tracks:  _buildTop10Tracks(yEntries),
    };
  });

  firebase.database().ref('leaderboard/' + pseudo).set({
    pseudo,
    updatedAt:  Date.now(),
    totalPlays,
    totalSec,
    top10Artists,
    top10Tracks,
    monthly:  monthlyData,
    yearly:   yearlyData,
  }).catch(e => console.warn('[Arya Leaderboard] push error:', e));
}


/* ═══════════════════════════════════════════════════════════
   ÉTAT INTERNE
═══════════════════════════════════════════════════════════ */

let _lbListener   = null;
let _lbCachedData = null; // cache Firebase — évite un re-fetch à la navigation profil


/* ═══════════════════════════════════════════════════════════
   RENDER PRINCIPAL — classement global
═══════════════════════════════════════════════════════════ */

function renderLeaderboard() {
  const content = document.getElementById('leaderboardContent');
  if (!content) return;

  // Détache le listener précédent avant de ré-abonner
  if (_lbListener) {
    firebase.database().ref('leaderboard').off('value', _lbListener);
    _lbListener = null;
  }

  content.innerHTML = `
    <div style="color:var(--text3);text-align:center;padding:60px 20px;font-size:14px;">
      ⏳ Chargement du classement…
    </div>`;

  const lbSub = document.getElementById('lbSub');
  if (lbSub) lbSub.textContent = 'Chargement…';

  _lbListener = firebase.database().ref('leaderboard').on('value', snap => {
    _lbCachedData = snap.val() || {};
    _renderLbGlobal(_lbCachedData, content);
  }, () => {
    content.innerHTML = `
      <div style="color:var(--rose);text-align:center;padding:40px;font-size:14px;">
        ⚠️ Impossible de charger le classement
      </div>`;
  });
}


/* ═══════════════════════════════════════════════════════════
   VUE GLOBALE
═══════════════════════════════════════════════════════════ */

function _renderLbGlobal(data, content) {
  const users  = Object.values(data).filter(u => u?.pseudo && (u.totalPlays || 0) > 0);
  const sorted = [...users].sort((a, b) => (b.totalPlays || 0) - (a.totalPlays || 0));
  const medals = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];

  const lbSub = document.getElementById('lbSub');
  if (lbSub) lbSub.textContent = `${sorted.length} auditeur${sorted.length > 1 ? 's' : ''}`;

  if (!sorted.length) {
    content.innerHTML = `
      <div style="color:var(--text3);text-align:center;padding:60px 20px;line-height:2.2;font-size:14px;">
        🏆<br>Aucun auditeur dans le classement<br>
        <small>Les stats apparaissent après la première écoute</small>
      </div>`;
    return;
  }

  const now        = new Date();
  const monthKey   = now.toISOString().slice(0, 7);
  const yearKey    = String(now.getFullYear());
  const monthLabel = now.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });

  // Agrégation mensuelle globale
  const mArtMap = {}, mTrkMap = {};
  let mTotal = 0;
  users.forEach(u => {
    const m = u.monthly?.[monthKey];
    if (!m) return;
    mTotal += (m.totalPlays || 0);
    (m.top10Artists || []).forEach(a => {
      if (!mArtMap[a.name]) mArtMap[a.name] = { name: a.name, plays: 0 };
      mArtMap[a.name].plays += (a.plays || 0);
    });
    (m.top10Tracks || []).forEach(t => {
      const k = t.title + '|||' + t.artist;
      if (!mTrkMap[k]) mTrkMap[k] = { title: t.title, artist: t.artist, plays: 0 };
      mTrkMap[k].plays += (t.plays || 0);
    });
  });
  const mTop10Artists = Object.values(mArtMap).sort((a, b) => b.plays - a.plays).slice(0, 10);
  const mTop10Tracks  = Object.values(mTrkMap).sort((a, b) => b.plays - a.plays).slice(0, 10);

  // Agrégation annuelle globale
  const yArtMap = {}, yTrkMap = {};
  let yTotal = 0;
  users.forEach(u => {
    const y = u.yearly?.[yearKey];
    if (!y) return;
    yTotal += (y.totalPlays || 0);
    (y.top10Artists || []).forEach(a => {
      if (!yArtMap[a.name]) yArtMap[a.name] = { name: a.name, plays: 0 };
      yArtMap[a.name].plays += (a.plays || 0);
    });
    (y.top10Tracks || []).forEach(t => {
      const k = t.title + '|||' + t.artist;
      if (!yTrkMap[k]) yTrkMap[k] = { title: t.title, artist: t.artist, plays: 0 };
      yTrkMap[k].plays += (t.plays || 0);
    });
  });
  const yTop10Artists = Object.values(yArtMap).sort((a, b) => b.plays - a.plays).slice(0, 10);
  const yTop10Tracks  = Object.values(yTrkMap).sort((a, b) => b.plays - a.plays).slice(0, 10);

  // Agrégation globale artistes + tracks (tous utilisateurs confondus)
  const gArtMap = {}, gTrkMap = {};
  users.forEach(u => {
    (u.top10Artists || []).forEach(a => {
      if (!gArtMap[a.name]) gArtMap[a.name] = { name: a.name, plays: 0, sec: 0 };
      gArtMap[a.name].plays += (a.plays || 0);
      gArtMap[a.name].sec   += (a.sec   || 0);
    });
    (u.top10Tracks || []).forEach(t => {
      const k = t.title + '|||' + t.artist;
      if (!gTrkMap[k]) gTrkMap[k] = { title: t.title, artist: t.artist, plays: 0, sec: 0 };
      gTrkMap[k].plays += (t.plays || 0);
      gTrkMap[k].sec   += (t.sec   || 0);
    });
  });
  const gTop10Artists = Object.values(gArtMap).sort((a, b) => b.plays - a.plays).slice(0, 10);
  const gTop10Tracks  = Object.values(gTrkMap).sort((a, b) => b.plays - a.plays).slice(0, 10);

  const maxPlays = sorted[0]?.totalPlays || 1;

  // ── Podium ──
  let html = `<div class="lb-podium">`;
  sorted.slice(0, 3).forEach((u, i) => {
    const isMe = u.pseudo === pseudo;
    const sz   = [80, 65, 55][i];
    const bh   = [90, 65, 45][i];
    const bg   = ['var(--accent)', '#c0c0c0', '#cd7f32'][i];
    html += `
    <div class="lb-podium-col" onclick="_renderLbProfile('${esc(u.pseudo)}')" style="cursor:pointer;">
      <div class="lb-podium-avatar${isMe ? ' me' : ''}" style="height:${sz}px;width:${sz}px;">
        ${(u.pseudo || '?')[0].toUpperCase()}
      </div>
      <div class="lb-podium-name">${esc(u.pseudo)}</div>
      <div class="lb-podium-plays">${u.totalPlays} écoutes</div>
      <div class="lb-podium-time">${fmtDuration(u.totalSec || 0)}</div>
      <div class="lb-podium-medal">${medals[i]}</div>
      <div class="lb-podium-bar" style="height:${bh}px;background:${bg};"></div>
    </div>`;
  });
  html += `</div>`;

  // ── Classement complet ──
  html += `<div class="lb-section-label">🎧 Classement complet</div><div class="lb-list">`;
  sorted.forEach((u, i) => {
    const isMe    = u.pseudo === pseudo;
    const pct     = Math.round((u.totalPlays / maxPlays) * 100);
    const top3art = (u.top10Artists || []).slice(0, 3).map(a => esc(a.name)).join(', ');
    html += `
    <div class="lb-row${isMe ? ' lb-row-me' : ''}"
         onclick="_renderLbProfile('${esc(u.pseudo)}')" style="cursor:pointer;">
      <div class="lb-rank">${medals[i] || i + 1}</div>
      <div class="lb-av${isMe ? ' me' : ''}">${(u.pseudo || '?')[0].toUpperCase()}</div>
      <div style="flex:1;min-width:0;">
        <div class="lb-name">
          ${esc(u.pseudo)}${isMe ? ' <span style="font-size:10px;color:var(--accent);">(vous)</span>' : ''}
          <span style="font-size:10px;color:var(--text3);margin-left:4px;">›</span>
        </div>
        ${top3art ? `<div class="lb-sub">🎤 ${top3art}</div>` : ''}
        <div class="lb-bar-bg"><div class="lb-bar-fill" style="width:${pct}%"></div></div>
      </div>
      <div class="lb-score">
        <div style="font-size:14px;font-weight:700;color:var(--accent);">${u.totalPlays}×</div>
        <div style="font-size:10px;color:var(--text3);">${fmtDuration(u.totalSec || 0)}</div>
      </div>
    </div>`;
  });
  html += `</div>`;

  // ── Top 10 artistes global ──
  if (gTop10Artists.length) {
    html += `<div class="lb-section-label" style="margin-top:28px;">🎤 Top 10 Artistes — Tous les auditeurs</div><div class="lb-list">`;
    gTop10Artists.forEach((a, i) => {
      html += `
      <div class="lb-row">
        <div class="lb-rank">${medals[i] || i + 1}</div>
        ${_lbCoverHtml(getArtistImg(a.name), gradFor(a.name), '50%')}
        <div style="flex:1;min-width:0;">
          <div class="lb-name">${esc(a.name)}</div>
          <div class="lb-sub">${a.plays} écoutes · ${fmtDuration(a.sec || 0)}</div>
        </div>
        <div class="lb-score"><div style="font-size:13px;font-weight:700;color:var(--accent);">${a.plays}×</div></div>
      </div>`;
    });
    html += `</div>`;
  }

  // ── Top 10 chansons global ──
  if (gTop10Tracks.length) {
    html += `<div class="lb-section-label" style="margin-top:28px;">🎵 Top 10 Chansons — Tous les auditeurs</div><div class="lb-list">`;
    gTop10Tracks.forEach((t, i) => {
      const tr    = tracks.find(x => x.title === t.title && x.artist === t.artist);
      const cover = tr ? getCover(tr.filename) : null;
      html += `
      <div class="lb-row" ${tr ? `onclick="playTrack(${tr.id})" style="cursor:pointer;"` : ''}>
        <div class="lb-rank">${medals[i] || i + 1}</div>
        ${_lbCoverHtml(cover, gradFor((t.artist || '') + (t.title || '')))}
        <div style="flex:1;min-width:0;">
          <div class="lb-name">${esc(t.title)}</div>
          <div class="lb-sub">${esc(t.artist)} · ${fmtDuration(t.sec || 0)}</div>
        </div>
        <div class="lb-score"><div style="font-size:13px;font-weight:700;color:var(--accent);">${t.plays}×</div></div>
      </div>`;
    });
    html += `</div>`;
  }

  // ── Récap mensuel global ──
  if (mTop10Artists.length || mTop10Tracks.length) {
    html += `
    <div class="lb-section-label" style="margin-top:32px;font-size:15px;">
      📅 Récap — ${monthLabel}
      <span style="font-size:12px;color:var(--text3);font-weight:400;"> · ${mTotal} écoutes</span>
    </div>`;

    if (mTop10Artists.length) {
      html += `<div style="font-size:11px;color:var(--text3);font-weight:600;letter-spacing:.06em;padding:8px 16px 4px;">🎤 TOP 10 ARTISTES DU MOIS</div><div class="lb-list">`;
      mTop10Artists.forEach((a, i) => {
        html += `
        <div class="lb-row">
          <div class="lb-rank">${medals[i] || i + 1}</div>
          ${_lbCoverHtml(getArtistImg(a.name), gradFor(a.name), '50%')}
          <div style="flex:1;min-width:0;"><div class="lb-name">${esc(a.name)}</div></div>
          <div class="lb-score"><div style="font-size:13px;font-weight:700;color:var(--accent);">${a.plays}×</div></div>
        </div>`;
      });
      html += `</div>`;
    }

    if (mTop10Tracks.length) {
      html += `<div style="font-size:11px;color:var(--text3);font-weight:600;letter-spacing:.06em;padding:14px 16px 4px;">🎵 TOP 10 CHANSONS DU MOIS</div><div class="lb-list">`;
      mTop10Tracks.forEach((t, i) => {
        const tr    = tracks.find(x => x.title === t.title && x.artist === t.artist);
        const cover = tr ? getCover(tr.filename) : null;
        html += `
        <div class="lb-row" ${tr ? `onclick="playTrack(${tr.id})" style="cursor:pointer;"` : ''}>
          <div class="lb-rank">${medals[i] || i + 1}</div>
          ${_lbCoverHtml(cover, gradFor((t.artist || '') + (t.title || '')))}
          <div style="flex:1;min-width:0;">
            <div class="lb-name">${esc(t.title)}</div>
            <div class="lb-sub">${esc(t.artist)}</div>
          </div>
          <div class="lb-score"><div style="font-size:13px;font-weight:700;color:var(--accent);">${t.plays}×</div></div>
        </div>`;
      });
      html += `</div>`;
    }
  }

  // ── Récap annuel global ──
  if (yTop10Artists.length || yTop10Tracks.length) {
    html += `
    <div style="margin:32px 0 12px;padding:12px 16px;
                background:color-mix(in srgb,var(--accent) 10%,transparent);
                border:1px solid color-mix(in srgb,var(--accent) 40%,transparent);
                border-radius:14px;">
      <div style="font-size:16px;font-weight:700;color:var(--accent);">🏆 Récap ${yearKey}</div>
      <div style="font-size:12px;color:var(--text3);margin-top:3px;">${yTotal} écoutes cette année — tous les auditeurs</div>
    </div>`;

    if (yTop10Artists.length) {
      html += `<div style="font-size:11px;color:var(--text3);font-weight:600;letter-spacing:.06em;padding:4px 16px 4px;">🎤 TOP 10 ARTISTES ${yearKey}</div><div class="lb-list">`;
      yTop10Artists.forEach((a, i) => {
        html += `
        <div class="lb-row">
          <div class="lb-rank">${medals[i] || i + 1}</div>
          ${_lbCoverHtml(getArtistImg(a.name), gradFor(a.name), '50%')}
          <div style="flex:1;min-width:0;"><div class="lb-name">${esc(a.name)}</div></div>
          <div class="lb-score"><div style="font-size:13px;font-weight:700;color:var(--accent);">${a.plays}×</div></div>
        </div>`;
      });
      html += `</div>`;
    }

    if (yTop10Tracks.length) {
      html += `<div style="font-size:11px;color:var(--text3);font-weight:600;letter-spacing:.06em;padding:14px 16px 4px;">🎵 TOP 10 CHANSONS ${yearKey}</div><div class="lb-list">`;
      yTop10Tracks.forEach((t, i) => {
        const tr    = tracks.find(x => x.title === t.title && x.artist === t.artist);
        const cover = tr ? getCover(tr.filename) : null;
        html += `
        <div class="lb-row" ${tr ? `onclick="playTrack(${tr.id})" style="cursor:pointer;"` : ''}>
          <div class="lb-rank">${medals[i] || i + 1}</div>
          ${_lbCoverHtml(cover, gradFor((t.artist || '') + (t.title || '')))}
          <div style="flex:1;min-width:0;">
            <div class="lb-name">${esc(t.title)}</div>
            <div class="lb-sub">${esc(t.artist)}</div>
          </div>
          <div class="lb-score"><div style="font-size:13px;font-weight:700;color:var(--accent);">${t.plays}×</div></div>
        </div>`;
      });
      html += `</div>`;
    }
  }

  html += `
  <div style="margin-top:24px;font-size:11.5px;color:var(--text3);text-align:center;line-height:1.9;">
    📡 Classement en temps réel — Firebase<br>
    Appuie sur un auditeur pour voir son profil complet
  </div>`;

  content.innerHTML = html;
}


/* ═══════════════════════════════════════════════════════════
   VUE PROFIL — stats d'un utilisateur spécifique
═══════════════════════════════════════════════════════════ */

function _renderLbProfile(targetPseudo) {
  const content = document.getElementById('leaderboardContent');
  if (!content) return;

  const u = _lbCachedData
    ? Object.values(_lbCachedData).find(x => x?.pseudo === targetPseudo)
    : null;

  if (!u) {
    content.innerHTML = `
      <div style="color:var(--text3);text-align:center;padding:60px 20px;font-size:14px;">
        Utilisateur introuvable
      </div>`;
    return;
  }

  const medals     = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
  const isMe       = u.pseudo === pseudo;
  const now        = new Date();
  const monthKey   = now.toISOString().slice(0, 7);
  const yearKey    = String(now.getFullYear());
  const monthLabel = now.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
  const mData      = u.monthly?.[monthKey] || null;
  const yData      = u.yearly?.[yearKey]   || null;

  // ── Bouton retour ──
  let html = `
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
    <button onclick="_lbGoBack()" style="
      background:var(--surface,#1e1e2e);
      border:1px solid var(--border,rgba(255,255,255,.1));
      border-radius:10px;color:var(--text1,#fff);
      font-size:13px;padding:7px 14px;cursor:pointer;
      display:flex;align-items:center;gap:6px;">
      ← Retour
    </button>
    <span style="font-size:13px;color:var(--text3);">Profil auditeur</span>
  </div>`;

  // ── Header profil ──
  html += `
  <div style="display:flex;align-items:center;gap:16px;padding:16px;
              background:var(--surface,#1e1e2e);
              border:1px solid ${isMe ? 'var(--accent)' : 'var(--border,rgba(255,255,255,.06))'};
              border-radius:16px;margin-bottom:20px;">
    <div style="width:60px;height:60px;border-radius:50%;
                background:var(--surface2,#2a2a3a);
                display:flex;align-items:center;justify-content:center;
                font-size:26px;font-weight:700;color:var(--text1,#fff);flex-shrink:0;
                ${isMe ? 'outline:2px solid var(--accent);outline-offset:2px;' : ''}">
      ${(u.pseudo || '?')[0].toUpperCase()}
    </div>
    <div>
      <div style="font-size:18px;font-weight:700;color:var(--text1,#fff);">
        ${esc(u.pseudo)}${isMe ? ' <span style="font-size:11px;color:var(--accent);">(vous)</span>' : ''}
      </div>
      <div style="font-size:13px;color:var(--accent);margin-top:3px;">
        ${u.totalPlays || 0} écoutes · ${fmtDuration(u.totalSec || 0)}
      </div>
      ${u.updatedAt ? `<div style="font-size:11px;color:var(--text3);margin-top:2px;">
        Mis à jour ${new Date(u.updatedAt).toLocaleDateString('fr-FR')}
      </div>` : ''}
    </div>
  </div>`;

  // ── Top 10 artistes all-time ──
  if ((u.top10Artists || []).length) {
    html += `<div class="lb-section-label">🎤 Top 10 Artistes — All time</div><div class="lb-list">`;
    u.top10Artists.forEach((a, i) => {
      html += `
      <div class="lb-row">
        <div class="lb-rank">${medals[i] || i + 1}</div>
        ${_lbCoverHtml(getArtistImg(a.name), gradFor(a.name), '50%')}
        <div style="flex:1;min-width:0;">
          <div class="lb-name">${esc(a.name)}</div>
          ${a.sec ? `<div class="lb-sub">${fmtDuration(a.sec)}</div>` : ''}
        </div>
        <div class="lb-score"><div style="font-size:13px;font-weight:700;color:var(--accent);">${a.plays}×</div></div>
      </div>`;
    });
    html += `</div>`;
  }

  // ── Top 10 chansons all-time ──
  if ((u.top10Tracks || []).length) {
    html += `<div class="lb-section-label" style="margin-top:20px;">🎵 Top 10 Chansons — All time</div><div class="lb-list">`;
    u.top10Tracks.forEach((t, i) => {
      const tr    = tracks.find(x => x.title === t.title && x.artist === t.artist);
      const cover = tr ? getCover(tr.filename) : null;
      html += `
      <div class="lb-row" ${tr ? `onclick="playTrack(${tr.id})" style="cursor:pointer;"` : ''}>
        <div class="lb-rank">${medals[i] || i + 1}</div>
        ${_lbCoverHtml(cover, gradFor((t.artist || '') + (t.title || '')))}
        <div style="flex:1;min-width:0;">
          <div class="lb-name">${esc(t.title)}</div>
          <div class="lb-sub">${esc(t.artist)}${t.sec ? ' · ' + fmtDuration(t.sec) : ''}</div>
        </div>
        <div class="lb-score"><div style="font-size:13px;font-weight:700;color:var(--accent);">${t.plays}×</div></div>
      </div>`;
    });
    html += `</div>`;
  }

  // ── Récap mensuel personnel ──
  if (mData && (mData.totalPlays || 0) > 0) {
    html += `
    <div class="lb-section-label" style="margin-top:28px;font-size:15px;">
      📅 Récap — ${monthLabel}
      <span style="font-size:12px;color:var(--text3);font-weight:400;"> · ${mData.totalPlays} écoutes</span>
    </div>`;

    if ((mData.top10Artists || []).length) {
      html += `<div style="font-size:11px;color:var(--text3);font-weight:600;letter-spacing:.06em;padding:8px 0 4px;">🎤 ARTISTES DU MOIS</div><div class="lb-list">`;
      mData.top10Artists.forEach((a, i) => {
        html += `
        <div class="lb-row">
          <div class="lb-rank">${medals[i] || i + 1}</div>
          ${_lbCoverHtml(getArtistImg(a.name), gradFor(a.name), '50%')}
          <div style="flex:1;min-width:0;"><div class="lb-name">${esc(a.name)}</div></div>
          <div class="lb-score"><div style="font-size:13px;font-weight:700;color:var(--accent);">${a.plays}×</div></div>
        </div>`;
      });
      html += `</div>`;
    }

    if ((mData.top10Tracks || []).length) {
      html += `<div style="font-size:11px;color:var(--text3);font-weight:600;letter-spacing:.06em;padding:14px 0 4px;">🎵 CHANSONS DU MOIS</div><div class="lb-list">`;
      mData.top10Tracks.forEach((t, i) => {
        const tr    = tracks.find(x => x.title === t.title && x.artist === t.artist);
        const cover = tr ? getCover(tr.filename) : null;
        html += `
        <div class="lb-row" ${tr ? `onclick="playTrack(${tr.id})" style="cursor:pointer;"` : ''}>
          <div class="lb-rank">${medals[i] || i + 1}</div>
          ${_lbCoverHtml(cover, gradFor((t.artist || '') + (t.title || '')))}
          <div style="flex:1;min-width:0;">
            <div class="lb-name">${esc(t.title)}</div>
            <div class="lb-sub">${esc(t.artist)}</div>
          </div>
          <div class="lb-score"><div style="font-size:13px;font-weight:700;color:var(--accent);">${t.plays}×</div></div>
        </div>`;
      });
      html += `</div>`;
    }
  }

  // ── Récap annuel personnel ──
  if (yData && (yData.totalPlays || 0) > 0) {
    html += `
    <div style="margin:28px 0 12px;padding:12px 16px;
                background:color-mix(in srgb,var(--accent) 10%,transparent);
                border:1px solid color-mix(in srgb,var(--accent) 40%,transparent);
                border-radius:14px;">
      <div style="font-size:16px;font-weight:700;color:var(--accent);">🏆 Récap ${yearKey}</div>
      <div style="font-size:12px;color:var(--text3);margin-top:3px;">${yData.totalPlays} écoutes cette année</div>
    </div>`;

    if ((yData.top10Artists || []).length) {
      html += `<div style="font-size:11px;color:var(--text3);font-weight:600;letter-spacing:.06em;padding:4px 0;">🎤 ARTISTES ${yearKey}</div><div class="lb-list">`;
      yData.top10Artists.forEach((a, i) => {
        html += `
        <div class="lb-row">
          <div class="lb-rank">${medals[i] || i + 1}</div>
          ${_lbCoverHtml(getArtistImg(a.name), gradFor(a.name), '50%')}
          <div style="flex:1;min-width:0;"><div class="lb-name">${esc(a.name)}</div></div>
          <div class="lb-score"><div style="font-size:13px;font-weight:700;color:var(--accent);">${a.plays}×</div></div>
        </div>`;
      });
      html += `</div>`;
    }

    if ((yData.top10Tracks || []).length) {
      html += `<div style="font-size:11px;color:var(--text3);font-weight:600;letter-spacing:.06em;padding:14px 0 4px;">🎵 CHANSONS ${yearKey}</div><div class="lb-list">`;
      yData.top10Tracks.forEach((t, i) => {
        const tr    = tracks.find(x => x.title === t.title && x.artist === t.artist);
        const cover = tr ? getCover(tr.filename) : null;
        html += `
        <div class="lb-row" ${tr ? `onclick="playTrack(${tr.id})" style="cursor:pointer;"` : ''}>
          <div class="lb-rank">${medals[i] || i + 1}</div>
          ${_lbCoverHtml(cover, gradFor((t.artist || '') + (t.title || '')))}
          <div style="flex:1;min-width:0;">
            <div class="lb-name">${esc(t.title)}</div>
            <div class="lb-sub">${esc(t.artist)}</div>
          </div>
          <div class="lb-score"><div style="font-size:13px;font-weight:700;color:var(--accent);">${t.plays}×</div></div>
        </div>`;
      });
      html += `</div>`;
    }
  }

  // ── Historique mensuel complet ──
  const allMonths = Object.entries(u.monthly || {})
    .sort((a, b) => b[0].localeCompare(a[0]))
    .filter(([, m]) => (m.totalPlays || 0) > 0);

  if (allMonths.length > 1) {
    html += `<div class="lb-section-label" style="margin-top:28px;">📆 Historique mensuel</div>
    <div style="display:flex;flex-direction:column;gap:8px;">`;
    allMonths.forEach(([mk, m]) => {
      const label = new Date(mk + '-01').toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
      const topA  = (m.top10Artists || [])[0];
      const topT  = (m.top10Tracks  || [])[0];
      html += `
      <div style="padding:12px 14px;background:var(--surface,#1e1e2e);
                  border:1px solid var(--border,rgba(255,255,255,.06));border-radius:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:13px;font-weight:600;color:var(--text1,#fff);">${label}</span>
          <span style="font-size:12px;font-weight:700;color:var(--accent);">${m.totalPlays} écoutes</span>
        </div>
        ${topA ? `<div style="font-size:11px;color:var(--text3);margin-top:4px;">🎤 ${esc(topA.name)} · ${topA.plays}×</div>` : ''}
        ${topT ? `<div style="font-size:11px;color:var(--text3);margin-top:2px;">🎵 ${esc(topT.title)} · ${topT.plays}×</div>` : ''}
      </div>`;
    });
    html += `</div>`;
  }

  html += `
  <div style="margin-top:24px;margin-bottom:8px;font-size:11.5px;color:var(--text3);
              text-align:center;line-height:1.9;">
    📡 Données Firebase — ${esc(u.pseudo)}
  </div>`;

  content.innerHTML = html;
  content.scrollTop = 0;
}


/* ═══════════════════════════════════════════════════════════
   RETOUR AU CLASSEMENT GLOBAL
═══════════════════════════════════════════════════════════ */

function _lbGoBack() {
  const content = document.getElementById('leaderboardContent');
  if (!content) return;
  if (_lbCachedData) _renderLbGlobal(_lbCachedData, content);
  else renderLeaderboard();
}
