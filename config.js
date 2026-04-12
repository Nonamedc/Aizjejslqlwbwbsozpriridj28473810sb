/* ── Polyfill console ── */
// Polyfill console.info pour environnements qui l'auraient supprimé (ex: certains WebViews Android)
if (typeof console === 'undefined') window.console = {};
if (typeof console.info !== 'function') console.info = console.log || function(){};
if (typeof console.warn !== 'function') console.warn = console.log || function(){};
if (typeof console.error !== 'function') console.error = console.log || function(){};

/* ═══════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════ */
const ARCHIVE_ID   = 'blind-test-huhu';
const ABLY_KEY     = 'lPL6kQ.ErKKBw:wWefHnBgmBJGVwiIRycvlQCQSjvKGosGDQ2gfIIZW8k';
const META_STORE   = 'arya_meta_v1';
const PSEUDO_STORE = 'arya_pseudo';
const FAV_STORE    = 'arya_favs_v1';
const HIST_STORE   = 'arya_history_v1';
const STATS_STORE  = 'arya_stats_v1';
const ABLY_CH      = 'arya-presence-v1';
const MAX_HIST     = 150;
const ARTIST_IMG_STORE = 'arya_artist_imgs_v1';
const ARCHIVE_CREDS_STORE = 'arya_archive_creds_v1';
const LRC_STORE           = 'arya_lrc_v1';

/* ═══════════════════════════════════════════
   STATE
═══════════════════════════════════════════ */
let tracks       = [];
let filtered     = [];
let currentId    = null;
var isPlaying    = false;
var shuffle      = false;
var repeat       = 1; // 0=off 1=all 2=one  — boucle toute la liste par défaut
let queue        = [];
let queueIdx     = -1;
let sortField    = 'title';
let sortDir      = 1;
let prevView     = 'dashboard';
let detailTracks = [];
let edTrack      = null;
let pseudo       = '';
let ablyClient   = null;
let ablyChannel  = null;
let onlineUsers  = {};

// Full-screen player state (déclaré en var car utilisé dans un autre bloc script)
var _fsOpen = false;

// LRC / lyrics state
var _lrcLines     = [];   // [{time, text}] pour la chanson courante
var _lrcPlain     = '';   // paroles brutes (fallback)
var _lrcActiveIdx = -1;
var _lyricsOpen   = false;

// Party state
var partyMode    = null; // null | 'host' | 'listener'
let partyHost    = null;
let partySyncInt = null;
let _partyJoinPending = null;

// Stats accumulator
let _statAccum   = 0; // seconds accumulated since last flush
let _statLastTS  = 0; // audio.currentTime at last tick
let _statLastSave = 0; // Date.now() of last localStorage write
