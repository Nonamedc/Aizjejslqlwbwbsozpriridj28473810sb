/* ═══════════════════════════════════════════════════════════
   CONFIG — Arya V3
   Constantes globales, clés localStorage et état partagé.
   Chargé juste après utils.js — aucune autre dépendance.
═══════════════════════════════════════════════════════════ */


/* ─────────────────────────────────────────
   POLYFILL CONSOLE
   Sécurise console pour certains WebViews
   Android qui suppriment les méthodes.
───────────────────────────────────────── */
if (typeof console === 'undefined') window.console = {};
if (typeof console.info  !== 'function') console.info  = console.log || function () {};
if (typeof console.warn  !== 'function') console.warn  = console.log || function () {};
if (typeof console.error !== 'function') console.error = console.log || function () {};


/* ─────────────────────────────────────────
   CONFIG IMMUABLE
   Object.freeze() empêche toute modification
   accidentelle depuis un autre module.
   ⚠️  ABLY_KEY : visible dans le source.
   Restriction impérative dans le dashboard
   Ably (subscribe only sur arya-presence-v1).
   Solution propre = token server, même léger.
───────────────────────────────────────── */
const CONFIG = Object.freeze({
  ARCHIVE_ID : 'blind-test-huhu',
  ABLY_KEY   : 'lPL6kQ.ErKKBw:wWefHnBgmBJGVwiIRycvlQCQSjvKGosGDQ2gfIIZW8k',
  ABLY_CH    : 'arya-presence-v1',
});

// Alias pour compatibilité avec le reste du code (rétrocompat)
const ARCHIVE_ID = CONFIG.ARCHIVE_ID;
const ABLY_KEY   = CONFIG.ABLY_KEY;
const ABLY_CH    = CONFIG.ABLY_CH;


/* ─────────────────────────────────────────
   CLÉS LOCALSTORAGE
───────────────────────────────────────── */
const META_STORE          = 'arya_meta_v1';
const PSEUDO_STORE        = 'arya_pseudo';
const FAV_STORE           = 'arya_favs_v1';
const HIST_STORE          = 'arya_history_v1';
const STATS_STORE         = 'arya_stats_v1';
const ARTIST_IMG_STORE    = 'arya_artist_imgs_v1';
const ARCHIVE_CREDS_STORE = 'arya_archive_creds_v1';
const LRC_STORE           = 'arya_lrc_v1';
const PLAYLIST_STORE      = 'arya_playlists_v1';
const BLOCK_STORE         = 'arya_blocklist_v1';
const STATS_MONTHLY_STORE = 'arya_stats_monthly';

/** Nombre maximum d'entrées dans l'historique. */
const MAX_HIST = 150;


/* ─────────────────────────────────────────
   ENUM — Mode de répétition
   Remplace l'entier magique repeat = 1.
   Usage : repeat = REPEAT.ALL
───────────────────────────────────────── */
const REPEAT = Object.freeze({ OFF: 0, ALL: 1, ONE: 2 });


/* ─────────────────────────────────────────
   ÉTAT — Bibliothèque & lecture
───────────────────────────────────────── */
let playerState = {
  tracks    : [],     // toutes les pistes chargées depuis Archive.org
  filtered  : [],     // pistes après filtre recherche / contrôle parental
  currentId : null,   // id de la piste en cours
  isPlaying : false,
  shuffle   : false,
  repeat    : REPEAT.ALL,  // REPEAT.OFF | REPEAT.ALL | REPEAT.ONE
  queue     : [],
  queueIdx  : -1,
  sortField : 'title',
  sortDir   : 1,      // 1 = croissant | -1 = décroissant
  prevView  : 'dashboard',
  detailTracks : [],
  edTrack   : null,
};

// Alias à plat pour compatibilité avec le reste du code existant.
// ⚠️  MIGRATION : remplacer progressivement par playerState.xxx
let tracks       = playerState.tracks;
let filtered     = playerState.filtered;
let currentId    = playerState.currentId;
let isPlaying    = playerState.isPlaying;
let shuffle      = playerState.shuffle;
let repeat       = playerState.repeat;
let queue        = playerState.queue;
let queueIdx     = playerState.queueIdx;
let sortField    = playerState.sortField;
let sortDir      = playerState.sortDir;
let prevView     = playerState.prevView;
let detailTracks = playerState.detailTracks;
let edTrack      = playerState.edTrack;


/* ─────────────────────────────────────────
   ÉTAT — Utilisateur & présence
   Map() remplace {} :
   - pas de collision __proto__
   - itération propre (for...of)
   - API claire (has / get / set / delete)
───────────────────────────────────────── */
let userState = {
  pseudo      : '',
  ablyClient  : null,
  ablyChannel : null,
  onlineUsers : new Map(),
};

// Alias à plat pour compatibilité
let pseudo      = userState.pseudo;
let ablyClient  = userState.ablyClient;
let ablyChannel = userState.ablyChannel;
let onlineUsers = userState.onlineUsers;


/* ─────────────────────────────────────────
   ÉTAT — Lecteur plein écran
   Regroupé sous __ARYA__ pour éviter toute
   collision avec d'autres scripts globaux.
   Lecture dans sleep.js : window.__ARYA__.fsOpen
───────────────────────────────────────── */
window.__ARYA__ = window.__ARYA__ || {};
window.__ARYA__.fsOpen = false;

// Alias rétrocompat — à supprimer quand sleep.js est mis à jour
Object.defineProperty(window, '_fsOpen', {
  get() { return window.__ARYA__.fsOpen; },
  set(v) { window.__ARYA__.fsOpen = v; },
});


/* ─────────────────────────────────────────
   ÉTAT — Paroles (LRC)
───────────────────────────────────────── */
let lyricsState = {
  lines     : [],   // [{ time, text }] pour la chanson courante
  plain     : '',   // paroles brutes (fallback sans timestamps)
  activeIdx : -1,
  open      : false,
};

// Alias à plat pour compatibilité
let _lrcLines     = lyricsState.lines;
let _lrcPlain     = lyricsState.plain;
let _lrcActiveIdx = lyricsState.activeIdx;
let _lyricsOpen   = lyricsState.open;


/* ─────────────────────────────────────────
   ÉTAT — Mode soirée (Party)
───────────────────────────────────────── */
let partyState = {
  mode        : null,  // null | 'host' | 'listener'
  host        : null,
  syncInt     : null,
  joinPending : null,
};

// Alias à plat pour compatibilité
let partyMode         = partyState.mode;
let partyHost         = partyState.host;
let partySyncInt      = partyState.syncInt;
let _partyJoinPending = partyState.joinPending;


/* ─────────────────────────────────────────
   ÉTAT — Accumulateur de stats d'écoute
   Les stats sont flushées dans localStorage
   toutes les N secondes par playback.js.
───────────────────────────────────────── */
let statsState = {
  accumulated : 0,  // secondes accumulées depuis le dernier flush
  lastTime    : 0,  // audio.currentTime au dernier tick
  lastSaveAt  : 0,  // Date.now() du dernier write localStorage
};

// Alias à plat pour compatibilité
let _statAccum    = statsState.accumulated;
let _statLastTS   = statsState.lastTime;
let _statLastSave = statsState.lastSaveAt;


/* ═══════════════════════════════════════════════════════════
   ⚠️  NOTE DE MIGRATION — À LIRE AVANT TOUCHER AUX AUTRES FICHIERS

   Les alias à plat (tracks, filtered, repeat, onlineUsers…)
   sont là pour que le reste du code ne casse PAS immédiatement.

   MAIS : les alias primitifs (currentId, isPlaying, shuffle…)
   ne sont PAS liés à playerState par référence — ce sont des
   copies. Si tu écris `currentId = 'abc'`, playerState.currentId
   ne bouge pas, et vice-versa.

   Migration propre en 3 étapes (par fichier) :
   1. Remplacer `currentId` par `playerState.currentId` partout
   2. Idem pour chaque groupe (userState, partyState, etc.)
   3. Supprimer les blocs "Alias à plat" ici

   Priorité suggérée :
   - repeat  → REPEAT.xxx  (1 fichier : player.js)
   - onlineUsers → Map   (déjà ok, Map passée par référence)
   - window._fsOpen → window.__ARYA__.fsOpen  (sleep.js)
   - statsState  → playback.js
   - lyricsState → lrc.js
═══════════════════════════════════════════════════════════ */
