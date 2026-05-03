/* ═══════════════════════════════════════════════════════════
   ERROR-GUARD.JS — Arya
   Isolation des erreurs module par module.
   Chargé en premier — surveille tout le reste.
═══════════════════════════════════════════════════════════ */

/* ── 1. Erreurs JS globales non catchées ────────────────── */
window.addEventListener('error', e => {
  console.error('[Arya Error]', e.filename?.split('/').pop(), `L${e.lineno}:`, e.message);
  // On laisse l'app tourner — on ne rethrow pas
  return true; // empêche le message d'erreur navigateur par défaut
});

window.addEventListener('unhandledrejection', e => {
  console.error('[Arya Promise]', e.reason);
  e.preventDefault(); // empêche crash console visible
});


/* ── 2. Vérification des dépendances critiques ──────────── */
document.addEventListener('DOMContentLoaded', () => {

  if (window._firebaseFailed) {
    console.error('[Arya] Firebase SDK absent — sync et auth désactivés');
    // Crée des stubs pour éviter les crashes en cascade
    window.firebase = window.firebase || {
      auth:     () => ({ onAuthStateChanged: () => {}, currentUser: null, signInWithPopup: () => Promise.reject('Firebase absent') }),
      database: () => ({ ref: () => ({ set: () => Promise.resolve(), on: () => {}, off: () => {} }) })
    };
  }

  if (window.shaka === null) {
    console.error('[Arya] Shaka Player absent — seul le cache local fonctionnera');
  }

  if (window.Ably === null) {
    console.warn('[Arya] Ably absent — mode Party désactivé');
  }
});


/* ── 3. Wrapper sécurisé pour init modules ──────────────── */
/**
 * Lance une fonction d'init en l'isolant dans un try/catch.
 * En cas d'erreur, l'app continue avec les modules restants.
 *
 * Usage (dans init.js) :
 *   safeInit('Playback', initPlayback);
 *   safeInit('Sync',     () => Sync.start());
 */
window.safeInit = function(moduleName, fn) {
  try {
    const result = fn();
    // Support async
    if (result && typeof result.catch === 'function') {
      result.catch(e => console.error(`[Arya] ${moduleName} async error:`, e));
    }
  } catch (e) {
    console.error(`[Arya] ${moduleName} init error:`, e);
  }
};


/* ── 4. Détection offline / online ──────────────────────── */
window.addEventListener('online',  () => {
  console.log('[Arya] Connexion rétablie');
  document.body.classList.remove('arya-offline');
});
window.addEventListener('offline', () => {
  console.warn('[Arya] Hors ligne');
  document.body.classList.add('arya-offline');
});
if (!navigator.onLine) document.body.classList.add('arya-offline');


/* ── 5. Perf — log du temps de chargement ───────────────── */
window.addEventListener('load', () => {
  const t = performance.timing;
  const loadTime = t.loadEventEnd - t.navigationStart;
  if (loadTime > 0) console.log(`[Arya] Chargé en ${loadTime}ms`);
});
