/* ═══════════════════════════════════════════════════════════
   PARTY.JS — Arya v2
   Mode Fête — synchronisation en temps réel via Ably.
   Sync toutes les 4s + sync immédiat à la connexion.
   Tolérance de dérive : 2.5s avant resync de position.

   Dépend de : config.js, utils.js, online.js,
               audio-engine.js, playback.js
═══════════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════════
   HOST — Démarrage / Arrêt
═══════════════════════════════════════════════════════════ */

function startParty() {
  if (!ablyChannel) { toast('Connexion en ligne requise', true); return; }
  if (partyMode === 'host')     { stopParty(); return; }
  if (partyMode === 'listener') leaveParty(true);

  partyMode = 'host';

  // Annonce la fête à la présence Ably
  _updatePresence(true);

  // Écoute les demandes de sync immédiates (nouveaux listeners)
  ablyChannel.subscribe('party_request_sync', _onPartySyncRequest).catch(() => {});

  broadcastPartySync();
  partySyncInt = setInterval(broadcastPartySync, 4000);
  updatePartyUI();
  toast('🎉 Mode Fête activé ! Les autres peuvent vous rejoindre');
}

function stopParty() {
  clearInterval(partySyncInt);
  partySyncInt = null;

  ablyChannel.publish('party_stop', { host: pseudo }).catch(() => {});
  _updatePresence(false);
  ablyChannel.unsubscribe('party_request_sync', _onPartySyncRequest);

  partyMode = null;
  partyHost = null;
  updatePartyUI();
  toast('Mode Fête terminé');
}

/** Répond à une demande de sync immédiat d'un listener qui vient de rejoindre. */
function _onPartySyncRequest(msg) {
  if (partyMode !== 'host' || msg.data.host !== pseudo) return;
  broadcastPartySync();
}

/** Met à jour le flag party:true/false dans la présence Ably. */
function _updatePresence(isHost) {
  if (!ablyChannel) return;
  const cur = currentId != null ? tracks.find(t => t.id === currentId) : null;
  ablyChannel.presence.update({
    pseudo,
    track: cur ? { title: cur.title, artist: cur.artist } : null,
    party: isHost,
  }).catch(() => {});
}


/* ═══════════════════════════════════════════════════════════
   LISTENER — Rejoindre / Quitter
═══════════════════════════════════════════════════════════ */

function joinParty(hostPseudo) {
  if (!ablyClient)              { toast('Connexion requise', true); return; }
  if (partyMode === 'host')     { toast('Arrêtez votre propre fête d\'abord', true); return; }
  if (partyMode === 'listener') leaveParty(true);

  partyMode = 'listener';
  partyHost = hostPseudo;

  ablyChannel.subscribe('party_sync', onPartySyncMsg).catch(() => {});
  ablyChannel.subscribe('party_stop', onPartyStopMsg).catch(() => {});

  // Demande un sync immédiat sans attendre les 4s
  ablyChannel.publish('party_request_sync', { listener: pseudo, host: hostPseudo }).catch(() => {});

  updatePartyUI();
  toast(`🎉 Vous avez rejoint la fête de ${hostPseudo}`);
}

function leaveParty(silent = false) {
  ablyChannel.unsubscribe('party_sync', onPartySyncMsg);
  ablyChannel.unsubscribe('party_stop', onPartyStopMsg);
  partyMode = null;
  partyHost = null;
  updatePartyUI();
  if (!silent) toast('Vous avez quitté la fête');
}

function leaveOrStopParty() {
  if (partyMode === 'host')     stopParty();
  else if (partyMode === 'listener') leaveParty();
}


/* ═══════════════════════════════════════════════════════════
   SYNC — Broadcast & Réception
═══════════════════════════════════════════════════════════ */

function broadcastPartySync() {
  if (!ablyChannel || partyMode !== 'host' || currentId === null) return;
  const t = tracks.find(x => x.id === currentId);
  if (!t) return;
  ablyChannel.publish('party_sync', {
    host:      pseudo,
    filename:  t.filename,
    position:  audio.currentTime,
    isPlaying,
    title:     t.title,
    artist:    t.artist,
  }).catch(() => {});
}

async function onPartySyncMsg(msg) {
  if (partyMode !== 'listener' || msg.data.host !== partyHost) return;

  const data        = msg.data;
  const t           = tracks.find(x => x.filename === data.filename);
  if (!t) return;

  const activeAudio = activePlayer === 1 ? _audio1 : _audio2;
  const sh          = activePlayer === 1 ? shaka1  : shaka2;

  // Change de piste si nécessaire
  if (currentId !== t.id) {
    currentId = t.id;
    try { await sh.load(t.url); }
    catch (e) { console.warn('[Arya Party] load error:', e); return; }
    updatePlayerUI(t);
    highlightPlaying();
  }

  // Resync si dérive > 2.5s
  if (Math.abs(activeAudio.currentTime - data.position) > 2.5) {
    activeAudio.currentTime = data.position;
  }

  if (data.isPlaying && activeAudio.paused) {
    activeAudio.play().catch(async () => {
      try {
        await sh.load(t.url);
        activeAudio.currentTime = data.position;
        await activeAudio.play();
        updatePlayerUI(t);
      } catch (e) { console.warn('[Arya Party] replay error:', e); }
    });
  } else if (!data.isPlaying && !activeAudio.paused) {
    activeAudio.pause();
  }
}

function onPartyStopMsg(msg) {
  if (partyMode !== 'listener' || msg.data.host !== partyHost) return;
  const host = partyHost;
  leaveParty(true);
  toast(`${host} a arrêté la fête`);
}


/* ═══════════════════════════════════════════════════════════
   UI
═══════════════════════════════════════════════════════════ */

function updatePartyUI() {
  const banner     = document.getElementById('partyBanner');
  const bannerText = document.getElementById('partyBannerText');

  if (partyMode === 'host') {
    if (banner)     banner.style.display     = 'flex';
    if (bannerText) bannerText.textContent   = '🎉 Vous êtes l\'hôte — les autres sont synchronisés sur votre lecture';
  } else if (partyMode === 'listener') {
    if (banner)     banner.style.display     = 'flex';
    if (bannerText) bannerText.textContent   = `🎉 Synchronisé avec ${partyHost}`;
  } else {
    if (banner) banner.style.display = 'none';
  }

  const dot = document.getElementById('partyDot');
  if (dot) dot.style.display = partyMode ? 'block' : 'none';

  if (document.getElementById('view-party')?.classList.contains('active')) renderPartyView();
}

function renderPartyView() {
  const content   = document.getElementById('partyContent');
  const statusSub = document.getElementById('partyStatusSub');
  if (!content) return;

  const hosts      = Object.entries(onlineUsers).filter(([, u]) => u.party && u.pseudo !== pseudo);
  const onlineCount = Object.keys(onlineUsers).length;

  if (partyMode === 'host') {
    if (statusSub) statusSub.textContent =
      `Vous hébergez — ${onlineCount} personne${onlineCount > 1 ? 's' : ''} en ligne`;
    content.innerHTML = `
      <div class="party-hero" style="border-color:rgba(196,77,110,.4);">
        <div class="party-hero-ico">🎉</div>
        <div>
          <div class="party-hero-title">Fête en cours !</div>
          <div class="party-hero-sub">
            Votre lecture est diffusée en direct.<br>
            Les participants se synchronisent automatiquement toutes les 4 secondes.
          </div>
          <button class="btn btn-rose" onclick="stopParty()">⏹ Arrêter la fête</button>
        </div>
      </div>
      ${_renderPartyUsersList()}`;

  } else if (partyMode === 'listener') {
    if (statusSub) statusSub.textContent = `Synchronisé avec ${partyHost}`;
    content.innerHTML = `
      <div class="party-hero">
        <div class="party-hero-ico">🎧</div>
        <div>
          <div class="party-hero-title">Vous écoutez avec ${esc(partyHost)}</div>
          <div class="party-hero-sub">
            Votre lecture est synchronisée avec l'hôte.<br>
            Vous ne pouvez pas changer de chanson manuellement.
          </div>
          <button class="btn btn-ghost" onclick="leaveParty()">Quitter la fête</button>
        </div>
      </div>
      ${_renderPartyUsersList()}`;

  } else {
    if (statusSub) statusSub.textContent = 'Synchronisez votre musique en temps réel';
    content.innerHTML = `
      <div class="party-hero">
        <div class="party-hero-ico">🎉</div>
        <div>
          <div class="party-hero-title">Mode Fête</div>
          <div class="party-hero-sub">
            Démarrez une fête pour que d'autres participants<br>
            écoutent exactement la même musique que vous, en temps réel via Ably.
          </div>
          <button class="btn btn-acc" onclick="startParty()"
                  ${!ablyChannel ? 'disabled title="Connexion requise"' : ''}>
            🎉 Démarrer une fête
          </button>
        </div>
      </div>
      ${hosts.length
        ? `<div class="party-users-title">Fêtes en cours</div>
           ${hosts.map(([, u]) => `
             <div class="party-user-card">
               <div class="party-user-av hosting-av">${(u.pseudo || '?')[0].toUpperCase()}</div>
               <div style="flex:1;min-width:0;">
                 <div class="party-user-name">${esc(u.pseudo)}</div>
                 <div class="party-user-track">${u.track ? `🎵 ${esc(u.track.title)}` : 'En attente…'}</div>
               </div>
               <button class="btn btn-acc" style="font-size:12px;padding:6px 14px;"
                       onclick="joinParty('${escAttr(u.pseudo)}')">Rejoindre</button>
             </div>`).join('')}`
        : `<div class="party-empty">
             Aucune fête en cours<br>
             <small style="color:var(--text3);">Soyez le premier à en démarrer une !</small>
           </div>`}`;
  }
}

function _renderPartyUsersList() {
  const entries = Object.entries(onlineUsers);
  if (!entries.length) return '';
  return `
    <div class="party-users-title" style="margin-top:16px;">
      Personnes en ligne (${entries.length})
    </div>
    ${entries.map(([, u]) => `
      <div class="party-user-card">
        <div class="party-user-av${u.party ? ' hosting-av' : ''}">${(u.pseudo || '?')[0].toUpperCase()}</div>
        <div style="flex:1;min-width:0;">
          <div class="party-user-name">
            ${esc(u.pseudo)}
            ${u.pseudo === pseudo ? '<span style="font-size:10px;color:var(--accent);"> (vous)</span>' : ''}
            ${u.party ? ' 🎉' : ''}
          </div>
          <div class="party-user-track">
            ${u.track
              ? `🎵 ${esc(u.track.title)} · ${esc(u.track.artist)}`
              : '<span style="color:var(--text3);">Inactif</span>'}
          </div>
        </div>
      </div>`).join('')}`;
}
