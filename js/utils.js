/* ═══════════════════════════════════════════════════════════
   UTILS — Arya V3
   Fonctions utilitaires partagées par tous les modules.
   Chargé en premier : aucune dépendance externe.
═══════════════════════════════════════════════════════════ */


/* ─────────────────────────────────────────
   CONSTANTES
───────────────────────────────────────── */

const META_VERSION = 1;


/* ─────────────────────────────────────────
   ÉCHAPPEMENT HTML (XSS SAFE)
   Toujours utiliser esc() avant d'injecter
   une valeur utilisateur dans du innerHTML.
───────────────────────────────────────── */

/** Échappe les caractères HTML dangereux. */
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Échappe pour usage dans un attribut HTML entre guillemets simples. */
function escAttr(s) {
  return esc(s).replace(/'/g, '&#39;');
}


/* ─────────────────────────────────────────
   FORMATAGE DU TEMPS
───────────────────────────────────────── */

/**
 * Formate des secondes en "m:ss".
 * Ex : 93 → "1:33"
 */
function fmtTime(s) {
  s = Number(s);
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const m   = Math.floor(s / 60);
  const sec = String(Math.floor(s % 60)).padStart(2, '0');
  return `${m}:${sec}`;
}

/**
 * Formate une durée en secondes en texte lisible.
 * Ex : 3661 → "1h 1min"
 */
function fmtDuration(sec) {
  sec = Number(sec);
  if (!Number.isFinite(sec) || sec < 0) return '0s';
  sec = Math.floor(sec);
  if (sec < 60)   return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)} min`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return m ? `${h}h ${m}min` : `${h}h`;
}

/**
 * Retourne un temps relatif lisible depuis un timestamp ms.
 * Ex : "Il y a 5 min", "Hier"
 */
function relTime(ts) {
  ts = Number(ts);
  if (!Number.isFinite(ts)) return '';
  const d = Date.now() - ts;
  if (d < 60_000)      return "À l'instant";
  if (d < 3_600_000)   return `Il y a ${Math.floor(d / 60_000)} min`;
  if (d < 86_400_000)  return `Il y a ${Math.floor(d / 3_600_000)}h`;
  if (d < 172_800_000) return 'Hier';
  return `Il y a ${Math.floor(d / 86_400_000)} jours`;
}


/* ─────────────────────────────────────────
   DÉGRADÉS DÉTERMINISTES
   Même chaîne → toujours le même dégradé.
───────────────────────────────────────── */

const GRADS = [
  ['#d4a054', '#c44d6e'], ['#6366f1', '#8b5cf6'],
  ['#10b981', '#059669'], ['#f59e0b', '#ef4444'],
  ['#3b82f6', '#06b6d4'], ['#ec4899', '#f43f5e'],
  ['#84cc16', '#22c55e'], ['#f97316', '#fb923c'],
  ['#8b5cf6', '#d946ef'], ['#14b8a6', '#0ea5e9'],
  ['#a855f7', '#ec4899'], ['#22d3ee', '#3b82f6'],
];

/**
 * Retourne un dégradé CSS déterministe basé sur une chaîne.
 * Utilisé pour les pochettes manquantes et avatars artistes.
 */
function gradFor(str) {
  str = String(str ?? '');
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  const g = GRADS[Math.abs(h) % GRADS.length];
  return `linear-gradient(135deg, ${g[0]}, ${g[1]})`;
}


/* ─────────────────────────────────────────
   TOAST
───────────────────────────────────────── */

/**
 * Affiche une notification temporaire (3.2s).
 * @param {string}  msg - Message à afficher.
 * @param {boolean} err - true = style erreur (rouge).
 */
function toast(msg, err = false) {
  const container = document.getElementById('toasts');
  if (!container) {
    console.warn('Toast container manquant');
    return;
  }
  const el = document.createElement('div');
  el.className  = `toast${err ? ' error' : ''}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}


/* ─────────────────────────────────────────
   MÉLANGE DE TABLEAU (Fisher-Yates)
───────────────────────────────────────── */

/**
 * Retourne une copie mélangée du tableau.
 * N'affecte pas le tableau original.
 */
function shuffleArr(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}


/* ─────────────────────────────────────────
   DEBOUNCE / THROTTLE
───────────────────────────────────────── */

/**
 * Retarde l'exécution de fn jusqu'à ce que
 * l'appel soit stable depuis `delay` ms.
 */
function debounce(fn, delay = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Limite l'exécution de fn à une fois par `limit` ms.
 */
function throttle(fn, limit = 200) {
  let inThrottle = false;
  return (...args) => {
    if (inThrottle) return;
    fn(...args);
    inThrottle = true;
    setTimeout(() => (inThrottle = false), limit);
  };
}


/* ─────────────────────────────────────────
   MÉTADONNÉES (localStorage)
   Toutes les métadonnées éditées par
   l'utilisateur sont stockées dans META_STORE
   (défini dans config.js).
   Format versionné : { version, data }
   Migration automatique depuis l'ancien format.
───────────────────────────────────────── */

/** Retourne l'objet complet des métadonnées. */
function getMeta() {
  try {
    const raw = localStorage.getItem(META_STORE);
    if (!raw) return {};

    const parsed = JSON.parse(raw);

    // Nouveau format versionné
    if (parsed.version === META_VERSION && parsed.data) {
      return parsed.data;
    }

    // Ancien format détecté → migration auto, aucune perte
    if (!parsed.version) {
      console.info('Migration META v0 → v1');
      saveMeta(parsed);
      return parsed;
    }

    // Version inconnue → fallback safe
    console.warn('META version inconnue');
    return {};
  } catch (e) {
    console.error('META_STORE corrompu', e);
    return {};
  }
}

/** Sauvegarde l'objet complet des métadonnées (format versionné). */
function saveMeta(data) {
  try {
    localStorage.setItem(META_STORE, JSON.stringify({
      version: META_VERSION,
      data
    }));
  } catch (e) {
    console.error('Erreur sauvegarde META', e);
  }
}

/** Retourne les métadonnées d'une piste (ou null). */
function getTrackMeta(fn) {
  return getMeta()[fn] ?? null;
}

/**
 * Fusionne des données dans les métadonnées d'une piste.
 * @param {string}  fn   - Nom de fichier (clé).
 * @param {object}  d    - Données à fusionner.
 * @param {object}  opts - { deep: false } pour shallow (défaut) ou deep merge.
 */
function setTrackMeta(fn, d, { deep = false } = {}) {
  const m = getMeta();
  if (deep) {
    m[fn] = deepMerge(m[fn] || {}, d);
  } else {
    m[fn] = { ...(m[fn] || {}), ...d };
  }
  saveMeta(m);
}

/** Supprime les métadonnées d'une piste. */
function clearTrackMeta(fn) {
  const m = getMeta();
  delete m[fn];
  saveMeta(m);
}


/* ─────────────────────────────────────────
   DEEP MERGE
───────────────────────────────────────── */

/**
 * Fusionne récursivement source dans target.
 * Les tableaux sont écrasés (pas concaténés).
 */
function deepMerge(target, source) {
  for (const key in source) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key])
    ) {
      target[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}


/* ─────────────────────────────────────────
   STORAGE DEBUG
───────────────────────────────────────── */

/**
 * Retourne l'usage approximatif du localStorage en KB.
 * Basé sur la longueur des chaînes (UTF-16, ~2 octets/char).
 */
function getStorageUsage() {
  let total = 0;
  for (const key in localStorage) {
    if (!localStorage.hasOwnProperty(key)) continue;
    total += localStorage[key].length;
  }
  return { usedKB: (total / 1024).toFixed(2) };
}
