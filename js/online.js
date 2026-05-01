/* ═══════════════════════════════════════════════════════════
   ONLINE.JS — Arya
   Présence en ligne via Ably Realtime.

   Dépend de : config.js, utils.js, playback.js, party.js
   Variables globales utilisées :
     ABLY_KEY, ABLY_CH, pseudo, onlineUsers, partyMode,
     currentId, tracks, ablyClient, ablyChannel
═══════════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════ */

/** Construit le payload de présence de l'utilisateur local. */
function _myPresenceData() {
  const cur = currentId != null ? tracks.find(t => t.id === currentId) : null;
  return {
    pseudo,
    track: cur ? { title: cur.title, artist: cur.artist } : null,
    party: partyMode === 'host',
  };
}

/** Re-rend la vue party si elle est active. */
function _renderPartyIfOpen() {
  if (document.getElementById('view-party')?.classList.contains('active')) {
    renderPartyView();
  }
}

/** Affiche ou cache le dot de connexion. */
function _setOnlineDot(visible) {
  const dot = document.getElementById('onlineDot');
  if (dot) dot.style.display = visible ? 'block' : 'none';
}


/* ═══════════════════════════════════════════════════════════
   INITIALISATION ABLY
═══════════════════════════════════════════════════════════ */

function initAbly() {
  if (!pseudo) return;
  try {
    ablyClient  = new Ably.Realtime({ key: ABLY_KEY, clientId: pseudo + '_' + Date.now() });
    ablyChannel = ablyClient.channels.get(ABLY_CH);

    /* ── Refresh complet de la liste de présence ── */
    function _refreshPresenceList() {
      ablyChannel.presence.get((err, members) => {
        if (err) return;
        const fresh = {};
        (members || []).forEach(m => {
          fresh[m.clientId] = {
            pseudo: m.data.pseudo,
            track:  m.data.track,
            party:  m.data.party || false,
          };
        });
        onlineUsers = fresh;
        renderOnline();
        _renderPartyIfOpen();
      });
    }

    /* ── Connexion / Reconnexion ── */
    ablyClient.connection.on('connected', () => {
      // enter() lève une erreur si déjà entré (reconnexion) → fallback update
      ablyChannel.presence.enter(_myPresenceData()).catch(() => {
        ablyChannel.presence.update(_myPresenceData()).catch(() => {});
      });
      // Refresh complet important après reconnexion
      setTimeout(_refreshPresenceList, 600);
      _setOnlineDot(true);
    });

    ablyClient.connection.on('disconnected', () => _setOnlineDot(false));
    ablyClient.connection.on('suspended',    () => _setOnlineDot(false));
    ablyClient.connection.on('failed',       () => {
      _setOnlineDot(false);
      toast('⚠️ Connexion Ably perdue', true);
    });

    /* ── Événements de présence ── */
    const _onPresence = (m, action) => {
      if (action === 'leave') {
        delete onlineUsers[m.clientId];
      } else {
        // update peut arriver avant enter après reconnexion rapide → crée l'entrée si absente
        onlineUsers[m.clientId] = {
          pseudo: m.data.pseudo,
          track:  m.data.track,
          party:  m.data.party || false,
        };
      }
      renderOnline();
      _renderPartyIfOpen();
    };

    ablyChannel.presence.subscribe('enter',  m => _onPresence(m, 'enter'));
    ablyChannel.presence.subscribe('leave',  m => _onPresence(m, 'leave'));
    ablyChannel.presence.subscribe('update', m => _onPresence(m, 'update'));

    /* ── Lecture initiale ── */
    _refreshPresenceList();

    /* ── Heartbeat toutes les 25s ──────────────────────
       Empêche la présence d'expirer sur les onglets
       en arrière-plan / écrans verrouillés.
    ──────────────────────────────────────────────────── */
    setInterval(() => {
      if (ablyClient?.connection?.state === 'connected') {
        ablyChannel.presence.update(_myPresenceData()).catch(() => {});
      }
    }, 25_000);

  } catch (e) {
    console.warn('[Arya Ably]', e);
    toast('Connexion en ligne échouée', true);
  }
}


/* ═══════════════════════════════════════════════════════════
   BROADCAST PISTE EN COURS
═══════════════════════════════════════════════════════════ */

function broadcastTrack(t) {
  if (!ablyChannel) return;
  ablyChannel.presence.update({
    pseudo,
    track: { title: t.title, artist: t.artist },
    party: partyMode === 'host',
  }).catch(() => {});
}


/* ═══════════════════════════════════════════════════════════
   RENDU VUE ONLINE
═══════════════════════════════════════════════════════════ */

function renderOnline() {
  const entries = Object.entries(onlineUsers);
  const count   = entries.length;

  const countEl = document.getElementById('onlineCount');
  if (countEl) countEl.textContent = `${count} personne${count > 1 ? 's' : ''} en ligne`;

  // Le dot reste allumé si connecté, même seul
  if (ablyClient?.connection?.state === 'connected') _setOnlineDot(true);

  const grid = document.getElementById('onlineGrid');
  if (!grid) return;

  if (!count) {
    grid.innerHTML = `
      <div style="color:var(--text3);font-size:14px;padding:40px 0;">
        Personne d'autre en ligne pour l'instant
      </div>`;
    return;
  }

  grid.innerHTML = entries.map(([id, u]) => {
    const isMe = u.pseudo === pseudo;
    return `
      <div class="o-card${isMe ? ' me' : ''}${u.party && !isMe ? ' hosting' : ''}">
        <div class="o-avatar">${(u.pseudo || '?')[0].toUpperCase()}</div>
        <div class="o-name">
          ${esc(u.pseudo || id)}
          ${isMe              ? '<span style="font-size:11px;color:var(--accent);"> (vous)</span>' : ''}
          ${u.party           ? ' 🎉' : ''}
        </div>
        <div class="o-now">
          ${u.track
            ? `🎵 ${esc(u.track.title)}<br><span style="opacity:.7;">${esc(u.track.artist)}</span>`
            : '<span style="color:var(--text3);">Inactif</span>'}
        </div>
        <div class="o-status">
          <div style="width:6px;height:6px;border-radius:50%;background:var(--green);"></div>
          En ligne
          ${u.party && !isMe
            ? ` · <span style="color:var(--rose);cursor:pointer;"
                  onclick="joinParty('${escAttr(u.pseudo)}')">Rejoindre la fête</span>`
            : ''}
          ${!isMe
            ? ` · <span style="color:var(--accent);cursor:pointer;"
                  onclick="openUserProfile('${escAttr(u.pseudo)}')">Voir profil</span>`
            : ''}
        </div>
      </div>`;
  }).join('');
}


/* ═══════════════════════════════════════════════════════════
   PROFIL D'UN AUTRE UTILISATEUR
═══════════════════════════════════════════════════════════ */

function openUserProfile(targetPseudo) {
  // Cherche dans le leaderboard Firebase
  const db  = firebase.database();
  const ref = db.ref('leaderboard');

  let sheet = document.getElementById('userProfileSheet');
  if (!sheet) {
    sheet = document.createElement('div');
    sheet.id = 'userProfileSheet';
    sheet.style.cssText = 'position:fixed;inset:0;z-index:9998;display:flex;align-items:flex-end;background:rgba(0,0,0,.7);backdrop-filter:blur(6px);';
    document.body.appendChild(sheet);
  }

  sheet.innerHTML = `
    <div style="background:var(--surface);border-radius:22px 22px 0 0;width:100%;
                max-height:85vh;overflow-y:auto;padding-bottom:32px;">
      <div style="width:36px;height:4px;background:var(--border);border-radius:2px;margin:12px auto 0;"></div>
      <div style="display:flex;align-items:center;justify-content:center;padding:32px 20px;gap:12px;color:var(--text3);">
        <div class="recent-spinner"></div> Chargement…
      </div>
    </div>`;
  sheet.onclick = e => { if (e.target === sheet) sheet.remove(); };
  sheet.style.display = 'flex';

  ref.once('value').then(snap => {
    const data = snap.val() || {};
    const user = Object.values(data).find(u => u?.pseudo === targetPseudo);
    _renderUserProfileSheet(sheet, targetPseudo, user);
  }).catch(() => {
    _renderUserProfileSheet(sheet, targetPseudo, null);
  });
}

function _renderUserProfileSheet(sheet, targetPseudo, user) {
  const medals    = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
  const totalPlays = user?.totalPlays || 0;
  const totalSec   = user?.totalSec   || 0;
  const top5Artists = (user?.top10Artists || []).slice(0, 5);
  const top5Tracks  = (user?.top10Tracks  || []).slice(0, 5);

  const content = document.createElement('div');
  content.style.cssText = 'background:var(--surface);border-radius:22px 22px 0 0;width:100%;max-height:85vh;overflow-y:auto;padding-bottom:32px;';

  content.innerHTML = `
    <div style="width:36px;height:4px;background:var(--border);border-radius:2px;margin:12px auto 16px;"></div>

    <!-- Header -->
    <div style="display:flex;align-items:center;gap:14px;padding:0 20px 18px;border-bottom:1px solid var(--border);">
      <div style="width:56px;height:56px;border-radius:50%;background:var(--accent);
                  display:flex;align-items:center;justify-content:center;
                  font-size:22px;font-weight:700;color:#000;flex-shrink:0;">
        ${(targetPseudo || '?')[0].toUpperCase()}
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:18px;font-weight:700;">${esc(targetPseudo)}</div>
        <div style="font-size:12px;color:var(--accent);margin-top:4px;">
          ${totalPlays} écoute${totalPlays > 1 ? 's' : ''} · ${fmtDuration(totalSec)}
        </div>
      </div>
      ${onlineUsers && Object.values(onlineUsers).find(u => u.pseudo === targetPseudo)
        ? `<div style="display:flex;align-items:center;gap:5px;font-size:12px;color:var(--green);">
            <div style="width:7px;height:7px;border-radius:50%;background:var(--green);"></div>En ligne
           </div>`
        : ''}
    </div>

    <div style="padding:16px 20px;">
      ${!user ? `<div style="color:var(--text3);text-align:center;padding:30px 0;">
        Pas encore de statistiques pour ${esc(targetPseudo)}
      </div>` : ''}

      <!-- Top artistes -->
      ${top5Artists.length ? `
      <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px;">
        🎤 Top artistes
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:20px;">
        ${top5Artists.map((a, i) => {
          const img  = getArtistImg(a.name);
          const grad = gradFor(a.name);
          return `
          <div style="display:flex;align-items:center;gap:10px;padding:9px 12px;
                      background:var(--card);border:1px solid var(--border);border-radius:11px;
                      cursor:pointer;" onclick="showDetail('artist','${escAttr(a.name)}');document.getElementById('userProfileSheet').remove()">
            <span style="font-size:14px;width:20px;text-align:center;">${medals[i] || i+1}</span>
            <div style="width:34px;height:34px;border-radius:50%;overflow:hidden;flex-shrink:0;
                        display:flex;align-items:center;justify-content:center;font-size:14px;
                        ${img ? '' : 'background:' + grad}">
              ${img ? `<img src="${esc(img)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : '🎤'}
            </div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(a.name)}</div>
            </div>
            <span style="font-size:12px;font-weight:700;color:var(--accent);">${a.plays}×</span>
          </div>`;
        }).join('')}
      </div>` : ''}

      <!-- Top chansons -->
      ${top5Tracks.length ? `
      <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px;">
        🎵 Top chansons
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:20px;">
        ${top5Tracks.map((t, i) => {
          const tr    = tracks.find(x => x.title === t.title && x.artist === t.artist);
          const cover = tr ? getCover(tr.filename) : null;
          const grad  = gradFor((t.artist || '') + (t.title || ''));
          return `
          <div style="display:flex;align-items:center;gap:10px;padding:9px 12px;
                      background:var(--card);border:1px solid var(--border);border-radius:11px;
                      ${tr ? 'cursor:pointer;' : ''}"
               ${tr ? `onclick="playTrack(${tr.id});document.getElementById('userProfileSheet').remove()"` : ''}>
            <span style="font-size:14px;width:20px;text-align:center;">${medals[i] || i+1}</span>
            <div style="width:34px;height:34px;border-radius:7px;overflow:hidden;flex-shrink:0;
                        display:flex;align-items:center;justify-content:center;font-size:14px;
                        ${cover ? '' : 'background:' + grad}">
              ${cover ? `<img src="${esc(cover)}" style="width:100%;height:100%;object-fit:cover;">` : '🎵'}
            </div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(t.title)}</div>
              <div style="font-size:11px;color:var(--text2);">${t.feat ? esc(t.artist) + ' feat. ' + esc(t.feat) : esc(t.artist)}</div>
            </div>
            <span style="font-size:12px;font-weight:700;color:var(--accent);">${t.plays}×</span>
          </div>`;
        }).join('')}
      </div>` : ''}

      <!-- Boutons action -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${Object.values(onlineUsers || {}).find(u => u.pseudo === targetPseudo)?.party
          ? `<button class="btn btn-acc" style="font-size:13px;padding:9px 16px;"
                    onclick="joinParty('${escAttr(targetPseudo)}');document.getElementById('userProfileSheet').remove()">
              🎉 Rejoindre la fête
            </button>`
          : ''}
        <button class="btn btn-ghost" style="font-size:13px;padding:9px 16px;"
                onclick="document.getElementById('userProfileSheet').remove()">Fermer</button>
      </div>
    </div>`;

  sheet.innerHTML = '';
  sheet.appendChild(content);
}
/* ═══════════════════════════════════════════════════════════
   PARTY — Mode Fête (fusionné depuis party.js)
   Synchronisation en temps réel via Ably.
   Sync toutes les 4s + sync immédiat à la connexion.
   Tolérance de dérive : 2.5s avant resync de position.
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
  const onlineCount = (onlineUsers instanceof Map ? onlineUsers.size : Object.keys(onlineUsers || {}).length);

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

// ↑ party.js fusionné dans online.js
