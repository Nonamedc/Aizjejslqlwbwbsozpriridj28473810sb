/* ═══════════════════════════════════════════════════════════
   FIREBASE INIT — Arya V2
   Initialise Firebase Realtime Database.
   Dépend de : SDK Firebase chargé avant ce fichier.
═══════════════════════════════════════════════════════════ */

(function () {
  // Évite une double initialisation en cas de rechargement partiel
  if (firebase.apps.length) return;

  firebase.initializeApp({
    databaseURL: 'https://arya-app-86a3c-default-rtdb.firebaseio.com',
  });
})();
