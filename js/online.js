/* ═══════════════════════════════════════════
   ABLY — PRESENCE
═══════════════════════════════════════════ */
function _buildPresenceData(){
  const stats = getStats();
  const entries = Object.values(stats);
  const totalPlays = entries.reduce((a,e) => a+(e.plays||0), 0);
  const totalSec   = entries.reduce((a,e) => a+(e.seconds||0), 0);
  const top = [...entries].sort((a,b) => b.plays-a.plays).slice(0,3);
  const artistMap = {};
  entries.forEach(e => {
    if(!e.artist) return;
    if(!artistMap[e.artist]) artistMap[e.artist] = 0;
    artistMap[e.artist] += (e.plays||0);
  });
  const topArtist = Object.entries(artistMap).sort((a,b) => b[1]-a[1])[0] || null;
  const curTrack = currentId != null ? tracks.find(t=>t.id===currentId) : null;
  return {
    pseudo,
    track: curTrack ? { title: curTrack.title, artist: curTrack.artist } : null,
    party: partyMode === 'host',
    stats: {
      totalPlays,
      totalSec,
      topTrack:  top[0] ? { title: top[0].title, artist: top[0].artist, plays: top[0].plays } : null,
      topArtist: topArtist ? { name: topArtist[0], plays: topArtist[1] } : null,
    }
  };
}

function initAbly(){
  if(!pseudo) return;
  try{
    ablyClient=new Ably.Realtime({key:ABLY_KEY, clientId: pseudo+'_'+Date.now()});
    ablyChannel=ablyClient.channels.get(ABLY_CH);

    ablyClient.connection.on('connected',()=>{
      ablyChannel.presence.enter(_buildPresenceData());
      document.getElementById('onlineDot').style.display='block';
    });

    ablyClient.connection.on('failed', () => {
      toast('🔌 Connexion Ably échouée', true);
    });
    ablyClient.connection.on('disconnected', () => {
      document.getElementById('onlineDot').style.display='none';
    });

    function _upsertUser(m){
      // Utilise le pseudo comme clé pour éviter les doublons de reconnexion
      const key = m.data.pseudo || m.clientId;
      onlineUsers[key] = {
        pseudo:    m.data.pseudo,
        track:     m.data.track,
        party:     m.data.party||false,
        stats:     m.data.stats||null,
        clientId:  m.clientId,
      };
    }

    ablyChannel.presence.subscribe('enter', m=>{
      _upsertUser(m);
      renderOnline();
      if(document.getElementById('view-party').classList.contains('active')) renderPartyView();
      if(document.getElementById('view-leaderboard')?.classList.contains('active')) renderLeaderboard();
    });
    ablyChannel.presence.subscribe('leave', m=>{
      const key = m.data.pseudo || m.clientId;
      delete onlineUsers[key];
      renderOnline();
      if(document.getElementById('view-party').classList.contains('active')) renderPartyView();
      if(document.getElementById('view-leaderboard')?.classList.contains('active')) renderLeaderboard();
    });
    ablyChannel.presence.subscribe('update', m=>{
      const key = m.data.pseudo || m.clientId;
      if(onlineUsers[key]){
        onlineUsers[key].track  = m.data.track;
        onlineUsers[key].party  = m.data.party||false;
        onlineUsers[key].stats  = m.data.stats||null;
      }
      renderOnline();
      if(document.getElementById('view-party').classList.contains('active')) renderPartyView();
      if(document.getElementById('view-leaderboard')?.classList.contains('active')) renderLeaderboard();
    });

    ablyChannel.presence.get((err,members)=>{
      if(err) return;
      members.forEach(m=>_upsertUser(m));
      renderOnline();
      if(document.getElementById('view-leaderboard')?.classList.contains('active')) renderLeaderboard();
    });

  }catch(e){
    console.warn('Ably error:',e);
    toast('Connexion en ligne échouée',true);
  }
}

function broadcastTrack(t){
  if(!ablyChannel) return;
  try{
    ablyChannel.presence.update(_buildPresenceData());
  }catch(e){}
}

/** Pousse les stats locales vers la présence Ably (après un compte à 50%) */
function pushLeaderboardStats(){
  if(!ablyChannel) return;
  try{ ablyChannel.presence.update(_buildPresenceData()); }catch(e){}
}

function renderOnline(){
  const entries=Object.entries(onlineUsers);
  const count=entries.length;
  document.getElementById('onlineCount').textContent=`${count} personne${count>1?'s':''} en ligne`;
  const dot=document.getElementById('onlineDot');
  dot.style.display=count>0?'block':'none';
  document.getElementById('onlineGrid').innerHTML=entries.map(([key,u])=>{
    const isMe=u.pseudo===pseudo;
    return `
      <div class="o-card${isMe?' me':''}${u.party&&!isMe?' hosting':''}">
        <div class="o-avatar">${(u.pseudo||'?')[0].toUpperCase()}</div>
        <div class="o-name">${esc(u.pseudo||key)}${isMe?' <span style="font-size:11px;color:var(--accent);">(vous)</span>':''}${u.party?' 🎉':''}</div>
        <div class="o-now">${u.track?`🎵 ${esc(u.track.title)}<br><span style="opacity:.7;">${esc(u.track.artist)}</span>`:'<span style="color:var(--text3);">Inactif</span>'}</div>
        ${u.stats?.totalPlays?`<div style="font-size:11px;color:var(--text3);margin-top:4px;">🎧 ${u.stats.totalPlays} écoutes · ${fmtDuration(u.stats.totalSec||0)}</div>`:''}
        <div class="o-status"><div style="width:6px;height:6px;border-radius:50%;background:var(--green);"></div>En ligne${u.party&&!isMe?` · <span style="color:var(--rose);cursor:pointer;" onclick="joinParty('${escAttr(u.pseudo)}')">Rejoindre</span>`:''}</div>
      </div>
    `;
  }).join('')||(count===0?`<div style="color:var(--text3);font-size:14px;padding:40px 0;">Personne d'autre en ligne pour l'instant</div>`:'');
}

/* ═══════════════════════════════════════════
   KEYBOARD SHORTCUTS (global)
═══════════════════════════════════════════ */
document.addEventListener('keydown',e=>{
  const tag=(e.target.tagName||'').toLowerCase();
  if(tag==='input'||tag==='textarea') return;
  if(e.code==='Space'){e.preventDefault();togglePlay();}
  else if(e.code==='ArrowRight'&&e.shiftKey){nextTrack();}
  else if(e.code==='ArrowLeft'&&e.shiftKey){prevTrack();}
});
