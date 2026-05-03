/* ═══════════════════════════════════════════════════════════
   FIREBASE INIT — Arya
   Initialise Firebase App, Realtime Database et Auth.
   Dépend de : SDKs Firebase chargés avant ce fichier.
═══════════════════════════════════════════════════════════ */

(function () {
  // Guard : Firebase SDK absent (CDN HS ou bloqué)
  if (typeof firebase === 'undefined') {
    console.error('[Arya] Firebase SDK absent — sync, auth et présence désactivés.');
    window._firebaseFailed = true;
    // Stub minimal pour éviter les crashes en cascade
    window.firebase = {
      apps: [],
      auth:     () => ({ onAuthStateChanged: cb => cb(null), currentUser: null, signInWithPopup: () => Promise.reject('Firebase absent'), signOut: () => Promise.resolve() }),
      database: () => ({ ref: () => ({ set: () => Promise.resolve(), once: () => Promise.resolve({ val: () => null }), on: () => {}, off: () => {} }) }),
    };
    return;
  }

  // Guard : Shaka absent
  if (typeof shaka === 'undefined') {
    console.warn('[Arya] Shaka Player absent — lecture hors cache impossible.');
    window.shaka = null;
  }

  if (firebase.apps.length) return;

  firebase.initializeApp({
    apiKey:            "AIzaSyDyOuBdN1pWWNftF4QHMFzhmePRk9zX_yE",
    authDomain:        "arya-app-86a3c.firebaseapp.com",
    databaseURL:       "https://arya-app-86a3c-default-rtdb.firebaseio.com",
    projectId:         "arya-app-86a3c",
    storageBucket:     "arya-app-86a3c.firebasestorage.app",
    messagingSenderId: "254625506411",
    appId:             "1:254625506411:web:09110525535ecb6de53d2e",
    measurementId:     "G-3E40YEX8Z7",
  });
})();
