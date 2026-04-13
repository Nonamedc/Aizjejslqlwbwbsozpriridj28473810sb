/* ══════════════════════════════════════════════
   LEADERBOARD — Classement global des auditeurs
   Basé sur les stats partagées via Ably presence
══════════════════════════════════════════════ */

function renderLeaderboard(){
  const content = document.getElementById('leaderboardContent');
  if(!content) return;

  // Fusionner les stats de tous les utilisateurs en ligne
  const allUsers = Object.values(onlineUsers).filter(u => u.stats && u.stats.totalPlays > 0);

  // Ajouter l'utilisateur local même s'il n'est pas dans onlineUsers
  const localStats = getStats();
  const localEntries = Object.values(localStats);
  const localTotal  = localEntries.reduce((a,e) => a+(e.plays||0), 0);
  const localSec    = localEntries.reduce((a,e) => a+(e.seconds||0), 0);
  const localTop    = [...localEntries].sort((a,b) => b.plays-a.plays).slice(0,1)[0]||null;
  const localArtMap = {};
  localEntries.forEach(e => { if(e.artist){ localArtMap[e.artist]=(localArtMap[e.artist]||0)+(e.plays||0); } });
  const localTopArt = Object.entries(localArtMap).sort((a,b)=>b[1]-a[1])[0]||null;

  const meInList = allUsers.find(u => u.pseudo === pseudo);
  if(!meInList && localTotal > 0){
    allUsers.push({
      pseudo,
      stats: {
        totalPlays: localTotal,
        totalSec:   localSec,
        topTrack:   localTop ? { title: localTop.title, artist: localTop.artist, plays: localTop.plays } : null,
        topArtist:  localTopArt ? { name: localTopArt[0], plays: localTopArt[1] } : null,
      }
    });
  }

  // Trier par nombre d'écoutes
  const sorted = allUsers.sort((a,b) => (b.stats.totalPlays||0) - (a.stats.totalPlays||0));

  // Agréger les artistes de tous les utilisateurs
  const globalArtistMap = {};
  const globalTrackMap  = {};
  allUsers.forEach(u => {
    if(u.stats?.topArtist?.name){
      const key = u.stats.topArtist.name;
      globalArtistMap[key] = (globalArtistMap[key]||0) + (u.stats.topArtist.plays||0);
    }
    if(u.stats?.topTrack?.title){
      const key = u.stats.topTrack.title;
      if(!globalTrackMap[key]) globalTrackMap[key] = { title: u.stats.topTrack.title, artist: u.stats.topTrack.artist, plays: 0 };
      globalTrackMap[key].plays += (u.stats.topTrack.plays||0);
    }
  });
  const topArtists = Object.entries(globalArtistMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const topTracks  = Object.values(globalTrackMap).sort((a,b)=>b.plays-a.plays).slice(0,5);

  const medals = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];

  if(!sorted.length){
    content.innerHTML = `
      <div style="color:var(--text3);text-align:center;padding:60px 20px;line-height:2.2;font-size:14px;">
        🏆<br>Aucun auditeur en ligne pour l'instant<br>
        <small>Le classement s'affiche quand des utilisateurs sont connectés</small>
      </div>`;
    return;
  }

  const maxPlays = sorted[0]?.stats?.totalPlays || 1;

  content.innerHTML = `
    <!-- Podium top 3 -->
    <div class="lb-podium">
      ${sorted.slice(0,3).map((u,i) => {
        const isMe = u.pseudo === pseudo;
        const h = [80, 65, 55][i] || 50;
        return `
        <div class="lb-podium-col">
          <div class="lb-podium-avatar${isMe?' me':''}" style="height:${h}px;width:${h}px;">
            ${(u.pseudo||'?')[0].toUpperCase()}
          </div>
          <div class="lb-podium-name">${esc(u.pseudo)}</div>
          <div class="lb-podium-plays">${u.stats.totalPlays} écoutes</div>
          <div class="lb-podium-time">${fmtDuration(u.stats.totalSec||0)}</div>
          <div class="lb-podium-medal">${medals[i]}</div>
          <div class="lb-podium-bar" style="height:${[90,65,45][i]}px;background:${['var(--accent)','#c0c0c0','#cd7f32'][i]};"></div>
        </div>`;
      }).join('')}
    </div>

    <!-- Classement complet -->
    <div class="lb-section-label">🎧 Classement complet</div>
    <div class="lb-list">
      ${sorted.map((u, i) => {
        const isMe = u.pseudo === pseudo;
        const pct  = Math.round((u.stats.totalPlays / maxPlays) * 100);
        return `
        <div class="lb-row${isMe?' lb-row-me':''}">
          <div class="lb-rank">${medals[i]||i+1}</div>
          <div class="lb-av${isMe?' me':''}">${(u.pseudo||'?')[0].toUpperCase()}</div>
          <div style="flex:1;min-width:0;">
            <div class="lb-name">${esc(u.pseudo)}${isMe?' <span style="font-size:10px;color:var(--accent);">(vous)</span>':''}</div>
            ${u.stats.topArtist ? `<div class="lb-sub">🎤 ${esc(u.stats.topArtist.name)}</div>` : ''}
            <div class="lb-bar-bg"><div class="lb-bar-fill" style="width:${pct}%"></div></div>
          </div>
          <div class="lb-score">
            <div style="font-size:14px;font-weight:700;color:var(--accent);">${u.stats.totalPlays}×</div>
            <div style="font-size:10px;color:var(--text3);">${fmtDuration(u.stats.totalSec||0)}</div>
          </div>
        </div>`;
      }).join('')}
    </div>

    <!-- Top artistes globaux -->
    ${topArtists.length ? `
    <div class="lb-section-label" style="margin-top:28px;">🎤 Artistes les plus écoutés</div>
    <div class="lb-list">
      ${topArtists.map(([name, plays], i) => {
        const img = getArtistImg(name);
        const grad = gradFor(name);
        return `
        <div class="lb-row">
          <div class="lb-rank">${medals[i]||i+1}</div>
          <div style="width:36px;height:36px;border-radius:50%;overflow:hidden;${img?'':'background:'+grad};display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">
            ${img?`<img src="${esc(img)}" style="width:100%;height:100%;object-fit:cover;">`:'🎤'}
          </div>
          <div style="flex:1;min-width:0;">
            <div class="lb-name">${esc(name)}</div>
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
        const tr = tracks.find(x => x.title === t.title && x.artist === t.artist);
        const cover = tr ? getCover(tr.filename) : null;
        const grad = gradFor((t.artist||'')+(t.title||''));
        return `
        <div class="lb-row"${tr?` onclick="playTrack(${tr.id})" style="cursor:pointer;"`:''}>
          <div class="lb-rank">${medals[i]||i+1}</div>
          <div style="width:36px;height:36px;border-radius:7px;overflow:hidden;${cover?'':'background:'+grad};display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">
            ${cover?`<img src="${esc(cover)}" style="width:100%;height:100%;object-fit:cover;">`:'🎵'}
          </div>
          <div style="flex:1;min-width:0;">
            <div class="lb-name">${esc(t.title)}</div>
            <div class="lb-sub">${esc(t.artist)}</div>
          </div>
          <div class="lb-score"><div style="font-size:13px;font-weight:700;color:var(--accent);">${t.plays}×</div></div>
        </div>`;
      }).join('')}
    </div>` : ''}

    <div style="margin-top:20px;font-size:11.5px;color:var(--text3);text-align:center;line-height:1.8;">
      📡 Classement en direct — basé sur les utilisateurs connectés<br>
      Vos stats sont partagées automatiquement quand vous êtes en ligne
    </div>
  `;

  // Mettre à jour le sous-titre
  const lbSub = document.getElementById('lbSub');
  if(lbSub){
    const totalOnline = Object.keys(onlineUsers).length;
    lbSub.textContent = `${sorted.length} auditeur${sorted.length>1?'s':''} · ${totalOnline} en ligne maintenant`;
  }
}
