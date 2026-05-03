/* ═══════════════════════════════════════════════════════════
   ARYA-API.JS
   Namespace window.Arya — expose toutes les fonctions globales
   utilisées dans les handlers HTML inline.

   Chargé après tous les modules, avant init.js.

   Avantages :
   - Une seule erreur JS ne casse plus tous les boutons
   - Les fonctions non encore définies sont wrappées en lazy
   - Prépare la migration vers ES modules
   - Évite les collisions avec d'autres libs globales
═══════════════════════════════════════════════════════════ */

window.Arya = window.Arya || {};

/* ── Sous-namespaces ─────────────────────────────────────── */
Arya.player  = Arya.player  || {};
Arya.ui      = Arya.ui      || {};
Arya.queue   = Arya.queue   || {};
Arya.online  = Arya.online  || {};
Arya.library = Arya.library || {};
Arya.state   = window.AryaState || {};  // référence au store

/**
 * Crée un proxy lazy : si la fonction n'est pas encore définie
 * au moment où Arya est construit, elle sera résolue au moment
 * de l'appel. Ça évite les problèmes d'ordre de chargement.
 */
function _lazy(name) {
  return function (...args) {
    const fn = window[name];
    if (typeof fn === 'function') return fn(...args);
    // Tente aussi dans les modules connus
    const parts = name.split('.');
    if (parts.length === 2) {
      const obj = window[parts[0]];
      if (obj && typeof obj[parts[1]] === 'function') return obj[parts[1]](...args);
    }
    console.warn(`[Arya] Fonction non définie : ${name}`);
  };
}

/* ── Lecture ──────────────────────────────────────────────── */
Arya.togglePlay          = _lazy('togglePlay');
Arya.nextTrack           = _lazy('nextTrack');
Arya.prevTrack           = _lazy('prevTrack');
Arya.toggleShuffle       = _lazy('toggleShuffle');
Arya.toggleRepeat        = _lazy('toggleRepeat');
Arya.seekTo              = _lazy('seekTo');
Arya.setVol              = _lazy('setVol');
Arya.setVolFs            = _lazy('setVolFs');
Arya.fsSeekTo            = _lazy('fsSeekTo');
Arya.cyclePlaybackRate   = _lazy('cyclePlaybackRate');
Arya.setPlaybackRate     = _lazy('setPlaybackRate');
Arya.toggleNormalization = _lazy('toggleNormalization');

/* ── Navigation ───────────────────────────────────────────── */
Arya.showView            = _lazy('showView');
Arya.showViewFromMore    = _lazy('showViewFromMore');
Arya.showDetail          = _lazy('showDetail');
Arya.showDetailFromEl    = _lazy('showDetailFromEl');
Arya.goBack              = _lazy('goBack');
Arya.goBackFromDetail    = _lazy('goBackFromDetail');
Arya.sortBy              = _lazy('sortBy');

/* ── Fullscreen ───────────────────────────────────────────── */
Arya.openFsPlayer        = _lazy('openFsPlayer');
Arya.openFsPlayerIfMobile= _lazy('openFsPlayerIfMobile');
Arya.closeFsPlayer       = _lazy('closeFsPlayer');
Arya.toggleLyricsPanel   = _lazy('toggleLyricsPanel');
Arya.toggleQueuePanel    = _lazy('toggleQueuePanel');

/* ── Sheets / Modals ──────────────────────────────────────── */
Arya.openMoreSheet       = _lazy('openMoreSheet');
Arya.closeMoreSheet      = _lazy('closeMoreSheet');
Arya.openSleepSheet      = _lazy('openSleepSheet');
Arya.openSidebarDrawer   = _lazy('openSidebarDrawer');
Arya.closeSidebarDrawer  = _lazy('closeSidebarDrawer');
Arya.closeContextMenu    = _lazy('closeContextMenu');
Arya.openItunesSearch    = _lazy('openItunesSearch');
Arya.closeItunesSearch   = _lazy('closeItunesSearch');
Arya.openTrackPicker     = _lazy('openTrackPicker');
Arya.closeTrackPicker    = _lazy('closeTrackPicker');

/* ── File d'attente ───────────────────────────────────────── */
Arya.addToQueueEnd       = _lazy('addToQueueEnd');
Arya.playNext            = _lazy('playNext');

/* ── Favoris / Bibliothèque ───────────────────────────────── */
Arya.toggleFavById       = _lazy('toggleFavById');
Arya.playAllFavs         = _lazy('playAllFavs');
Arya.shuffleAllFavs      = _lazy('shuffleAllFavs');
Arya.playAllSongs        = _lazy('playAllSongs');
Arya.shuffleAllSongs     = _lazy('shuffleAllSongs');
Arya.playDetailAll       = _lazy('playDetailAll');
Arya.shuffleDetailAll    = _lazy('shuffleDetailAll');

/* ── Playlists ────────────────────────────────────────────── */
Arya.openAddToPlaylistSheet = _lazy('openAddToPlaylistSheet');
Arya.closePlSheet        = _lazy('closePlSheet');
Arya.promptCreatePlaylist= _lazy('promptCreatePlaylist');
Arya.deletePlaylist      = _lazy('deletePlaylist');
Arya.renderPlaylists     = _lazy('renderPlaylists');

/* ── Upload ───────────────────────────────────────────────── */
Arya.handleUploadDrop    = _lazy('handleUploadDrop');
Arya.handleUploadFiles   = _lazy('handleUploadFiles');
Arya.startUpload         = _lazy('startUpload');
Arya.clearUploadQueue    = _lazy('clearUploadQueue');
Arya.saveUploadCreds     = _lazy('saveUploadCreds');
Arya.toggleUploadCreds   = _lazy('toggleUploadCreds');
Arya.fetchMetaFromUrl    = _lazy('fetchMetaFromUrl');

/* ── Éditeur de métadonnées ───────────────────────────────── */
Arya.openEditor          = _lazy('openEditor');
Arya.saveEdMeta          = _lazy('saveEdMeta');
Arya.resetEdMeta         = _lazy('resetEdMeta');
Arya.runCoverSearch      = _lazy('runCoverSearch');
Arya.searchArtistImgManual = _lazy('searchArtistImgManual');
Arya.enrichTrackManual   = _lazy('enrichTrackManual');
Arya.openBulkEditSheet   = _lazy('openBulkEditSheet');
Arya.launchEnrichmentFromData = _lazy('launchEnrichmentFromData');
Arya.stopEnrichment      = _lazy('stopEnrichment');

/* ── EQ ───────────────────────────────────────────────────── */
Arya.applyEqPreset       = _lazy('applyEqPreset');
Arya.setEqBand           = _lazy('setEqBand');
Arya.renderEqPanel       = _lazy('renderEqPanel');

/* ── Recherche ────────────────────────────────────────────── */
Arya.onSearchInput       = _lazy('onSearchInput');

/* ── Hors ligne ───────────────────────────────────────────── */
Arya.renderOffline       = _lazy('renderOffline');
Arya.playAllOffline      = _lazy('playAllOffline');
Arya.playOfflineTrack    = _lazy('playOfflineTrack');

/* ── Cards Album / Artiste ────────────────────────────────── */
Arya.playAlbumCard       = _lazy('playAlbumCard');
Arya.playArtistCard      = _lazy('playArtistCard');

/* ── Données / Export ─────────────────────────────────────── */
Arya.exportData          = _lazy('exportData');
Arya.importData          = _lazy('importData');
Arya.clearAllData        = _lazy('clearAllData');
Arya.clearHistory        = _lazy('clearHistory');

/* ── Itunes Sheet ─────────────────────────────────────────── */
Arya._itunesDebounce     = _lazy('_itunesDebounce');
Arya._renderTrackPicker  = _lazy('_renderTrackPicker');

/* ── Auth ─────────────────────────────────────────────────── */
Arya.setPseudo           = _lazy('setPseudo');
Arya.changePseudo        = _lazy('changePseudo');
Arya.signOut             = () => typeof Auth !== 'undefined' ? Auth.signOut() : null;
Arya.signInWithGoogle    = () => typeof Auth !== 'undefined' ? Auth.signInWithGoogle() : null;
Arya.savePseudo          = () => typeof Auth !== 'undefined' ? Auth.savePseudo() : null;

/* ── Parental / Blocklist ─────────────────────────────────── */
Arya.ParentalControl     = (action, ...args) => typeof ParentalControl !== 'undefined' ? ParentalControl[action]?.(...args) : null;
Arya.BlockList           = (action, ...args) => typeof BlockList !== 'undefined' ? BlockList[action]?.(...args) : null;

/* ── Divers ───────────────────────────────────────────────── */
Arya.logoClick           = _lazy('logoClick');
Arya.initRecentView      = _lazy('initRecentView');
Arya.leaveOrStopParty    = _lazy('leaveOrStopParty');
Arya.openSleepSheet      = _lazy('openSleepSheet');
Arya.renderLeaderboard   = _lazy('renderLeaderboard');


/* ═══════════════════════════════════════════════════════════
   DATA-ACTION DISPATCHER
   Remplace les onclick="Arya.xxx()" par data-action="xxx"
   Un seul listener délégué sur tout le document.
═══════════════════════════════════════════════════════════ */

document.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const action = btn.dataset.action;
  // Convertit kebab-case → camelCase
  const camel  = action.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

  // Tente Arya.xxx puis window.xxx
  if (typeof Arya[camel] === 'function') {
    e.preventDefault?.();
    Arya[camel](btn);
    return;
  }
  if (typeof window[camel] === 'function') {
    e.preventDefault?.();
    window[camel](btn);
    return;
  }
  console.warn('[Arya] data-action non trouvé :', action, '→', camel);
});

/* ── Remplissage des sous-namespaces après chargement ─────── */
/* Appelé depuis init.js une fois tous les modules chargés */
window.Arya._buildNamespaces = function () {
  /* Player */
  Arya.player.toggle    = _lazy('togglePlay');
  Arya.player.next      = _lazy('nextTrack');
  Arya.player.prev      = _lazy('prevTrack');
  Arya.player.seek      = _lazy('seekTo');
  Arya.player.setVol    = _lazy('setVol');
  Arya.player.shuffle   = _lazy('toggleShuffle');
  Arya.player.repeat    = _lazy('toggleRepeat');

  /* Queue */
  Arya.queue.add        = _lazy('addToQueueEnd');
  Arya.queue.playNext   = _lazy('playNext');

  /* UI */
  Arya.ui.showView      = _lazy('showView');
  Arya.ui.showDetail    = _lazy('showDetail');
  Arya.ui.toast         = _lazy('toast');
  Arya.ui.openFs        = _lazy('openFsPlayer');
  Arya.ui.closeFs       = _lazy('closeFsPlayer');

  /* Online / Social */
  Arya.online.init      = () => typeof Online !== 'undefined' ? Online.init?.() : null;
  Arya.online.getUsers  = () => typeof Online !== 'undefined' ? Online.getUsers?.() : [];

  /* Library */
  Arya.library.getTrack = (id) => typeof tracks !== 'undefined' ? tracks.find(t => t.id === id) : null;
  Arya.library.getTracks= () => typeof tracks !== 'undefined' ? tracks : [];

  /* Sync state */
  if (window.AryaState) AryaState.syncFromGlobals();
};
