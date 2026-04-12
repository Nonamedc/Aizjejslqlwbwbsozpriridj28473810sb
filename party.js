/* ═══════════════════════════════════════════
   PARTY MODE
═══════════════════════════════════════════ */
function startParty(){
  if(!ablyChannel){ toast('Connexion en ligne requise', true); return; }
  if(partyMode === 'host'){ stopParty(); return; }
  if(partyMode === 'listener') leaveParty(true);
  partyMode = 'host';
  // Update presence to signal we're hosting
  try{
    ablyChannel.presence.update({ pseudo, track: currentId!=null?{title:tracks.find(t=>t.id===currentId)?.title,artist:tracks.find(t=>t.id===currentId)?.artist}:null, party:true });
  }catch(e){}
  broadcastPartySync();
  partySyncInt = setInterval(broadcastPartySync, 4000);
  updatePartyUI();
  toast('🎉 Mode Fête activé ! Les autres peuvent vous rejoindre');
}

function stopParty(){
  clearInterval(partySyncInt);
  partySyncInt = null;
  try{ ablyChannel.publish('party_stop', { host: pseudo }); }catch(e){}
  try{ ablyChannel.presence.update({ pseudo, track: currentId!=null?{title:tracks.find(t=>t.id===currentId)?.title,artist:tracks.find(t=>t.id===currentId)?.artist}:null, party:false }); }catch(e){}
  partyMode = null;
  partyHost = null;
  updatePartyUI();
  toast('Mode Fête terminé');
}

function joinParty(hostPseudo){
  if(!ablyClient){ toast('Connexion requise', true); return; }
  if(partyMode === 'host'){ toast('Arrêtez votre propre fête d\'abord', true); return; }
  if(partyMode === 'listener') leaveParty(true);
  partyMode = 'listener';
  partyHost = hostPseudo;
  // Subscribe to sync messages
  try{
    ablyChannel.subscribe('party_sync', onPartySyncMsg);
    ablyChannel.subscribe('party_stop', onPartyStopMsg);
  }catch(e){}
  updatePartyUI();
  toast(`🎉 Vous avez rejoint la fête de ${hostPseudo}`);
}

function leaveParty(silent=false){
  try{
    ablyChannel.unsubscribe('party_sync', onPartySyncMsg);
    ablyChannel.unsubscribe('party_stop', onPartyStopMsg);
  }catch(e){}
  partyMode = null;
  partyHost = null;
  updatePartyUI();
  if(!silent) toast('Vous avez quitté la fête');
}

function leaveOrStopParty(){
  if(partyMode === 'host') stopParty();
  else if(partyMode === 'listener') leaveParty();
}

function broadcastPartySync(){
  if(!ablyChannel || partyMode !== 'host' || currentId === null) return;
  const t = tracks.find(x => x.id === currentId);
  if(!t) return;
  try{
    ablyChannel.publish('party_sync', {
      host: pseudo,
      filename: t.filename,
      position: audio.currentTime,
      isPlaying: isPlaying,
      title: t.title,
      artist: t.artist,
    });
  }catch(e){}
}

async function onPartySyncMsg(msg){
  if(partyMode !== 'listener' || msg.data.host !== partyHost) return;
  const data = msg.data;
  const t = tracks.find(x => x.filename === data.filename);
  if(!t) return;
  const activeAudio = activePlayer === 1 ? _audio1 : _audio2;
  const sh = activePlayer === 1 ? shaka1 : shaka2;
  if(currentId !== t.id){
    currentId = t.id;
    try { await sh.load(t.url); } catch(e) { console.warn('[Party sync] load error', e); return; }
    updatePlayerUI(t);
    highlightPlaying();
  }
  if(Math.abs(activeAudio.currentTime - data.position) > 2.5){
    activeAudio.currentTime = data.position;
  }
  if(data.isPlaying && activeAudio.paused){
    activeAudio.play().catch(async () => {
      // Stream expiré après une longue pause → rechargement + seek
      try {
        await sh.load(t.url);
        activeAudio.currentTime = data.position;
        await activeAudio.play();
        updatePlayerUI(t);
      } catch(e2) { console.warn('[Party sync] replay after reload error', e2); }
    });
  } else if(!data.isPlaying && !activeAudio.paused) activeAudio.pause();
}

function onPartyStopMsg(msg){
  if(partyMode !== 'listener' || msg.data.host !== partyHost) return;
  leaveParty(true);
  toast(`${partyHost} a arrêté la fête`);
}

function updatePartyUI(){
  // Party banner
  const banner = document.getElementById('partyBanner');
  const bannerText = document.getElementById('partyBannerText');
  if(partyMode === 'host'){
    banner.style.display = 'flex';
    bannerText.textContent = `🎉 Vous êtes l'hôte — les autres sont synchronisés sur votre lecture`;
  } else if(partyMode === 'listener'){
    banner.style.display = 'flex';
    bannerText.textContent = `🎉 Synchronisé avec ${partyHost}`;
  } else {
    banner.style.display = 'none';
  }
  // Party dot in sidebar
  document.getElementById('partyDot').style.display = partyMode ? 'block' : 'none';
  // Refresh party view if open
  const partyView = document.getElementById('view-party');
  if(partyView && partyView.classList.contains('active')) renderPartyView();
}

function renderPartyView(){
  const content = document.getElementById('partyContent');
  const statusSub = document.getElementById('partyStatusSub');

  // Find hosts in online users
  const hosts = Object.entries(onlineUsers).filter(([,u]) => u.party && u.pseudo !== pseudo);

  if(partyMode === 'host'){
    statusSub.textContent = `Vous hébergez — ${Object.keys(onlineUsers).length} personne${Object.keys(onlineUsers).length>1?'s':''} en ligne`;
    content.innerHTML = `
      <div class="party-hero" style="border-color:rgba(196,77,110,.4);">
        <div class="party-hero-ico">🎉</div>
        <div>
          <div class="party-hero-title">Fête en cours !</div>
          <div class="party-hero-sub">Votre lecture est diffusée en direct.<br>Les participants se synchronisent automatiquement toutes les 4 secondes.</div>
          <button class="btn btn-rose" onclick="stopParty()">⏹ Arrêter la fête</button>
        </div>
      </div>
      ${_renderPartyUsersList()}
    `;
  } else if(partyMode === 'listener'){
    statusSub.textContent = `Synchronisé avec ${partyHost}`;
    content.innerHTML = `
      <div class="party-hero">
        <div class="party-hero-ico">🎧</div>
        <div>
          <div class="party-hero-title">Vous écoutez avec ${esc(partyHost)}</div>
          <div class="party-hero-sub">Votre lecture est synchronisée avec l'hôte.<br>Vous ne pouvez pas changer de chanson manuellement.</div>
          <button class="btn btn-ghost" onclick="leaveParty()">Quitter la fête</button>
        </div>
      </div>
      ${_renderPartyUsersList()}
    `;
  } else {
    statusSub.textContent = 'Synchronisez votre musique en temps réel';
    content.innerHTML = `
      <div class="party-hero">
        <div class="party-hero-ico">🎉</div>
        <div>
          <div class="party-hero-title">Mode Fête</div>
          <div class="party-hero-sub">Démarrez une fête pour que d'autres participants<br>écoutent exactement la même musique que vous, en temps réel via Ably.</div>
          <button class="btn btn-acc" onclick="startParty()" ${!ablyChannel?'disabled title="Connexion requise"':''}>🎉 Démarrer une fête</button>
        </div>
      </div>
      ${hosts.length ? `
        <div class="party-users-title">Fêtes en cours</div>
        ${hosts.map(([,u]) => `
          <div class="party-user-card">
            <div class="party-user-av hosting-av">${(u.pseudo||'?')[0].toUpperCase()}</div>
            <div style="flex:1;min-width:0;">
              <div class="party-user-name">${esc(u.pseudo)}</div>
              <div class="party-user-track">${u.track?`🎵 ${esc(u.track.title)}`:'En attente…'}</div>
            </div>
            <button class="btn btn-acc" style="font-size:12px;padding:6px 14px;" onclick="joinParty('${escAttr(u.pseudo)}')">Rejoindre</button>
          </div>
        `).join('')}
      ` : `<div class="party-empty">Aucune fête en cours<br><small style="color:var(--text3);">Soyez le premier à en démarrer une !</small></div>`}
    `;
  }
}

function _renderPartyUsersList(){
  const entries = Object.entries(onlineUsers);
  if(!entries.length) return '';
  return `
    <div class="party-users-title" style="margin-top:16px;">Personnes en ligne (${entries.length})</div>
    ${entries.map(([,u]) => `
      <div class="party-user-card">
        <div class="party-user-av${u.party?' hosting-av':''}">${(u.pseudo||'?')[0].toUpperCase()}</div>
        <div style="flex:1;min-width:0;">
          <div class="party-user-name">${esc(u.pseudo)}${u.pseudo===pseudo?' <span style="font-size:10px;color:var(--accent);">(vous)</span>':''}${u.party?' 🎉':''}</div>
          <div class="party-user-track">${u.track?`🎵 ${esc(u.track.title)} · ${esc(u.track.artist)}`:'<span style="color:var(--text3);">Inactif</span>'}</div>
        </div>
      </div>
    `).join('')}
  `;
}

