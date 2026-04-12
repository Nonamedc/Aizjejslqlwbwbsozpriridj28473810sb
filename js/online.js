/* ═══════════════════════════════════════════
   ABLY — PRESENCE
═══════════════════════════════════════════ */
function initAbly(){
  if(!pseudo) return;
  try{
    ablyClient=new Ably.Realtime({key:ABLY_KEY,clientId:pseudo+'_'+Date.now()});
    ablyChannel=ablyClient.channels.get(ABLY_CH);

    const myData=()=>({
      pseudo,
      track: currentId!=null?{title:tracks.find(t=>t.id===currentId)?.title,artist:tracks.find(t=>t.id===currentId)?.artist}:null,
      party: partyMode === 'host',
    });

    ablyClient.connection.on('connected',()=>{
      ablyChannel.presence.enter(myData());
      document.getElementById('onlineDot').style.display='block';
    });

    ablyChannel.presence.subscribe('enter',m=>{
      onlineUsers[m.clientId]={pseudo:m.data.pseudo,track:m.data.track,party:m.data.party||false};
      renderOnline();
      if(document.getElementById('view-party').classList.contains('active')) renderPartyView();
    });
    ablyChannel.presence.subscribe('leave',m=>{
      delete onlineUsers[m.clientId];
      renderOnline();
      if(document.getElementById('view-party').classList.contains('active')) renderPartyView();
    });
    ablyChannel.presence.subscribe('update',m=>{
      if(onlineUsers[m.clientId]){
        onlineUsers[m.clientId].track=m.data.track;
        onlineUsers[m.clientId].party=m.data.party||false;
      }
      renderOnline();
      if(document.getElementById('view-party').classList.contains('active')) renderPartyView();
    });

    ablyChannel.presence.get((err,members)=>{
      if(err) return;
      members.forEach(m=>{onlineUsers[m.clientId]={pseudo:m.data.pseudo,track:m.data.track,party:m.data.party||false};});
      renderOnline();
    });

  }catch(e){
    console.warn('Ably error:',e);
    toast('Connexion en ligne échouée',true);
  }
}

function broadcastTrack(t){
  if(!ablyChannel) return;
  try{
    ablyChannel.presence.update({pseudo, track:{title:t.title,artist:t.artist}, party: partyMode === 'host'});
  }catch(e){}
}

function renderOnline(){
  const entries=Object.entries(onlineUsers);
  const count=entries.length;
  document.getElementById('onlineCount').textContent=`${count} personne${count>1?'s':''} en ligne`;
  const dot=document.getElementById('onlineDot');
  dot.style.display=count>0?'block':'none';
  document.getElementById('onlineGrid').innerHTML=entries.map(([id,u])=>{
    const isMe=u.pseudo===pseudo;
    return `
      <div class="o-card${isMe?' me':''}${u.party&&!isMe?' hosting':''}">
        <div class="o-avatar">${(u.pseudo||'?')[0].toUpperCase()}</div>
        <div class="o-name">${esc(u.pseudo||id)}${isMe?' <span style="font-size:11px;color:var(--accent);">(vous)</span>':''}${u.party?' 🎉':''}</div>
        <div class="o-now">${u.track?`🎵 ${esc(u.track.title)}<br><span style="opacity:.7;">${esc(u.track.artist)}</span>`:'<span style="color:var(--text3);">Inactif</span>'}</div>
        <div class="o-status"><div style="width:6px;height:6px;border-radius:50%;background:var(--green);"></div>En ligne${u.party&&!isMe?` · <span style="color:var(--rose);cursor:pointer;" onclick="joinParty('${escAttr(u.pseudo)}')">Rejoindre la fête</span>`:''}</div>
      </div>
    `;
  }).join('')||(count===0?`<div style="color:var(--text3);font-size:14px;padding:40px 0;">Personne d'autre en ligne pour l'instant</div>`:'');
}

/* ═══════════════════════════════════════════
   KEYBOARD SHORTCUTS
═══════════════════════════════════════════ */
document.addEventListener('keydown',e=>{
  const tag=(e.target.tagName||'').toLowerCase();
  if(tag==='input'||tag==='textarea') return;
  if(e.code==='Space'){e.preventDefault();togglePlay();}
  else if(e.code==='ArrowRight'&&e.shiftKey){nextTrack();}
  else if(e.code==='ArrowLeft'&&e.shiftKey){prevTrack();}
});

