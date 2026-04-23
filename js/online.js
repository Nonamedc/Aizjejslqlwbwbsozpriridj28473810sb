/* ═══════════════════════════════════════════════════════════
   ONLINE.JS — Arya v2
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
        </div>
      </div>`;
  }).join('');
}
