/* ═══════════════════════════════════════════════════════════
   FIREBASE INIT — Arya
   Initialise Firebase App, Realtime Database et Auth.
   Dépend de : SDKs Firebase chargés avant ce fichier.
═══════════════════════════════════════════════════════════ */

(function () {
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
