/* ═══════════════════════════════════════════════════════════
   AUTH.JS — Arya
   Authentification Firebase Google.
   Gère la session, le pseudo et l'accès à l'app.

   Dépend de : config.js, utils.js, firebase-init.js
═══════════════════════════════════════════════════════════ */

let _currentUser = null; // firebase.User courant
let _uid         = null; // raccourci vers _currentUser.uid


/* ═══════════════════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════════════════ */

(function _injectAuthStyles() {
  if (document.getElementById('auth-styles')) return;
  const s = document.createElement('style');
  s.id = 'auth-styles';
  s.textContent = `
    #authScreen {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg, #0c0810);
      padding: 20px;
      flex-direction: column;
      gap: 0;
    }

    .auth-box {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 36px 28px 28px;
      width: 100%;
      max-width: 380px;
      box-shadow: 0 24px 60px rgba(0,0,0,.6);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0;
    }

    .auth-logo {
      font-size: 48px;
      margin-bottom: 8px;
    }
    .auth-appname {
      font-size: 26px;
      font-weight: 700;
      color: var(--text);
      margin-bottom: 6px;
      font-family: 'Outfit', sans-serif;
    }
    .auth-tagline {
      font-size: 13px;
      color: var(--text3);
      margin-bottom: 28px;
      text-align: center;
      line-height: 1.6;
    }

    /* ── Étape pseudo ── */
    .auth-pseudo-wrap {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .auth-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: var(--text3);
    }
    .auth-input {
      width: 100%;
      box-sizing: border-box;
      background: var(--surface2, #2a1f33);
      border: 1.5px solid var(--border);
      border-radius: 12px;
      padding: 13px 14px;
      color: var(--text);
      font-size: 15px;
      font-family: inherit;
      outline: none;
      transition: border-color .2s;
    }
    .auth-input:focus { border-color: var(--accent); }

    /* ── Bouton Google ── */
    .auth-google-btn {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 14px 20px;
      border-radius: 14px;
      border: 1.5px solid var(--border);
      background: var(--surface2, #2a1f33);
      color: var(--text);
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: background .15s, border-color .15s;
    }
    .auth-google-btn:hover { background: var(--card); border-color: var(--accent); }
    .auth-google-btn:active { opacity: .8; }
    .auth-google-ico {
      width: 22px; height: 22px;
      background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="%23EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.7 2.5 30.2 0 24 0 14.6 0 6.6 5.4 2.5 13.3l7.8 6C12.4 13 17.8 9.5 24 9.5z"/><path fill="%234285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.1z"/><path fill="%23FBBC05" d="M10.3 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.8-6A24 24 0 0 0 0 24c0 3.8.9 7.4 2.5 10.6l7.8-5.9z"/><path fill="%2334A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.6-5.9c-2 1.4-4.7 2.2-7.6 2.2-6.2 0-11.5-4.2-13.4-9.8l-7.8 5.9C6.6 42.6 14.6 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></svg>') center/contain no-repeat;
      flex-shrink: 0;
    }

    /* ── Bouton primary ── */
    .auth-btn-primary {
      width: 100%;
      padding: 14px;
      border-radius: 14px;
      border: none;
      background: var(--accent);
      color: #000;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      transition: opacity .15s;
    }
    .auth-btn-primary:active { opacity: .85; }

    .auth-divider {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 18px 0;
      color: var(--text3);
      font-size: 12px;
    }
    .auth-divider::before,
    .auth-divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--border);
    }

    .auth-loading {
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--text3);
      font-size: 14px;
      margin: 10px 0;
    }

    .auth-error {
      color: var(--rose);
      font-size: 13px;
      text-align: center;
      background: rgba(196,77,110,.08);
      border: 1px solid rgba(196,77,110,.25);
      border-radius: 10px;
      padding: 10px 14px;
      width: 100%;
      box-sizing: border-box;
      display: none;
    }

    /* ── Avatar dans la sidebar ── */
    .auth-avatar {
      width: 32px; height: 32px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid var(--accent);
    }
    .auth-avatar-placeholder {
      width: 32px; height: 32px;
      border-radius: 50%;
      background: var(--accent);
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: 700; color: #000;
      flex-shrink: 0;
    }
    .auth-signout-btn {
      font-size: 11px;
      color: var(--text3);
      cursor: pointer;
      background: none;
      border: none;
      font-family: inherit;
      padding: 0;
      text-decoration: underline;
    }
    .auth-signout-btn:hover { color: var(--rose); }
  `;
  document.head.appendChild(s);
})();


/* ═══════════════════════════════════════════════════════════
   ÉCRAN D'AUTH
═══════════════════════════════════════════════════════════ */

function _showAuthScreen() {
  // Cache l'écran pseudo d'origine
  const pseudoScreen = document.getElementById('pseudoScreen');
  if (pseudoScreen) pseudoScreen.style.display = 'none';

  if (document.getElementById('authScreen')) return;

  const screen = document.createElement('div');
  screen.id = 'authScreen';
  screen.innerHTML = `
    <div class="auth-box">
      <div class="auth-logo">🎵</div>
      <div class="auth-appname">Arya</div>
      <div class="auth-tagline">Votre musique, partout.<br>Connectez-vous pour synchroniser vos données.</div>

      <div id="authError" class="auth-error"></div>
      <div id="authLoading" class="auth-loading" style="display:none;">
        <div class="spinner" style="width:18px;height:18px;border-width:2px;"></div>
        Connexion…
      </div>

      <button class="auth-google-btn" id="authGoogleBtn" onclick="Auth.signInWithGoogle()">
        <div class="auth-google-ico"></div>
        Continuer avec Google
      </button>
    </div>`;
  document.body.appendChild(screen);
}

function _showPseudoStep(displayName) {
  const box = document.querySelector('.auth-box');
  if (!box) return;

  // Pré-remplir avec le nom Google
  const suggested = (displayName || '').split(' ')[0] || '';

  box.innerHTML = `
    <div class="auth-logo">🎵</div>
    <div class="auth-appname">Arya</div>
    <div class="auth-tagline">Choisissez un pseudo pour apparaître<br>dans le classement et la présence en ligne.</div>

    <div id="authError" class="auth-error"></div>

    <div class="auth-pseudo-wrap">
      <div class="auth-label">Votre pseudo Arya</div>
      <input class="auth-input" id="authPseudoInput"
             placeholder="Ex: Ludo, DJ Shadow…"
             maxlength="20"
             value="${esc(suggested)}"
             onkeydown="if(event.key==='Enter') Auth.savePseudo()">
      <button class="auth-btn-primary" onclick="Auth.savePseudo()">
        ✅ Commencer
      </button>
    </div>`;

  setTimeout(() => {
    const inp = document.getElementById('authPseudoInput');
    if (inp) { inp.focus(); inp.select(); }
  }, 100);
}

function _hideAuthScreen() {
  const screen = document.getElementById('authScreen');
  if (screen) screen.remove();
}

function _setAuthLoading(on) {
  const btn  = document.getElementById('authGoogleBtn');
  const load = document.getElementById('authLoading');
  if (btn)  btn.style.display  = on ? 'none' : 'flex';
  if (load) load.style.display = on ? 'flex' : 'none';
}

function _showAuthError(msg) {
  const el = document.getElementById('authError');
  if (!el) return;
  el.textContent = msg;
  el.style.display = '';
  setTimeout(() => { el.style.display = 'none'; }, 5000);
}


/* ═══════════════════════════════════════════════════════════
   SIDEBAR — mise à jour infos utilisateur
═══════════════════════════════════════════════════════════ */

function _updateSidebarUser() {
  const footer = document.querySelector('.sidebar-footer');
  if (!footer || !_currentUser) return;

  const photoUrl = _currentUser.photoURL;
  const avatarHtml = photoUrl
    ? `<img class="auth-avatar" src="${photoUrl}" alt="${esc(pseudo)}">`
    : `<div class="auth-avatar-placeholder">${(pseudo || '?')[0].toUpperCase()}</div>`;

  footer.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
      ${avatarHtml}
      <div style="min-width:0;flex:1;">
        <div class="sf-pseudo" id="sfPseudo" style="margin:0;">${esc(pseudo)}</div>
        <div style="font-size:10.5px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${esc(_currentUser.email || '')}
        </div>
      </div>
    </div>
    <div style="display:flex;gap:8px;">
      <div class="sf-change" onclick="changePseudo()" style="flex:1;">Changer le pseudo</div>
      <button class="auth-signout-btn" onclick="Auth.signOut()">Déconnexion</button>
    </div>`;
}


/* ═══════════════════════════════════════════════════════════
   API PUBLIQUE
═══════════════════════════════════════════════════════════ */

const Auth = (() => {

  /** Lance le popup Google Sign-In. */
  async function signInWithGoogle() {
    _setAuthLoading(true);
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      // WebView Android ou file:// → signInWithRedirect (popup bloqué par Google)
      const isWebView = /wv|WebView/.test(navigator.userAgent)
        || window.location.protocol === 'file:';

      if (isWebView) {
        await firebase.auth().signInWithRedirect(provider);
        // La page va se recharger → onAuthStateChanged prend le relais
      } else {
        await firebase.auth().signInWithPopup(provider);
      }
    } catch (e) {
      _setAuthLoading(false);
      if (e.code === 'auth/popup-closed-by-user') return;
      _showAuthError('Connexion échouée : ' + (e.message || e.code));
      console.warn('[Arya Auth]', e);
    }
  }

  /** Sauvegarde le pseudo choisi et lance l'app. */
  async function savePseudo() {
    const input = document.getElementById('authPseudoInput');
    const val   = (input?.value || '').trim();
    if (!val || val.length < 2) {
      _showAuthError('Le pseudo doit contenir au moins 2 caractères.');
      return;
    }
    if (val.length > 20) {
      _showAuthError('Le pseudo doit faire 20 caractères maximum.');
      return;
    }

    pseudo = val;
    localStorage.setItem(PSEUDO_STORE, pseudo);

    // Sauvegarde dans Firebase
    try {
      await firebase.database().ref(`users/${_uid}/pseudo`).set(pseudo);
    } catch (e) {
      console.warn('[Arya Auth] Sauvegarde pseudo Firebase:', e);
    }

    _hideAuthScreen();
    _updateSidebarUser();
    _onAppReady();
  }

  /** Déconnexion. */
  async function signOut() {
    if (!confirm('Se déconnecter d\'Arya ?')) return;
    try {
      await firebase.auth().signOut();
    } catch (e) {
      console.warn('[Arya Auth] signOut:', e);
    }
    // onAuthStateChanged → null → retour écran auth
  }

  /**
   * Initialise l'écouteur d'état Auth.
   * Appelé depuis init.js à la place de loadPseudo().
   */
  function init() {
    // Cache toujours le pseudoScreen d'origine (remplacé par authScreen)
    const _ps = document.getElementById('pseudoScreen');
    if (_ps) _ps.style.display = 'none';

    // ── MODE DEV LOCAL (file:// ou localhost) ──
    // Bypasse Firebase Auth pour tester sans connexion
    const isLocal = window.location.protocol === 'file:'
      || window.location.hostname === 'localhost'
      || window.location.hostname === '127.0.0.1';

    if (isLocal) {
      _currentUser = { uid: 'local-dev', email: 'dev@local', displayName: 'Dev', photoURL: null };
      _uid         = 'local-dev';
      pseudo       = localStorage.getItem(PSEUDO_STORE) || 'Dev';
      localStorage.setItem(PSEUDO_STORE, pseudo);
      _hideAuthScreen();
      _updateSidebarUser();
      _onAppReady();
      return; // pas de Firebase Auth en local
    }

    firebase.auth().onAuthStateChanged(async user => {
      if (user) {
        // ── Connecté ──
        _currentUser = user;
        _uid         = user.uid;

        // 1. localStorage d'abord — synchrone, instantané
        const localPseudo = localStorage.getItem(PSEUDO_STORE);
        if (localPseudo) {
          pseudo = localPseudo;
          _hideAuthScreen();
          _updateSidebarUser();
          _onAppReady();

          // Vérification Firebase en arrière-plan (sans bloquer l'app)
          firebase.database().ref(`users/${_uid}`).once('value')
            .then(snap => {
              const data = snap.val() || {};
              // Sync pseudo si différent
              if (data.pseudo && data.pseudo !== pseudo) {
                pseudo = data.pseudo;
                localStorage.setItem(PSEUDO_STORE, pseudo);
                _updateSidebarUser();
              } else if (!data.pseudo) {
                firebase.database().ref(`users/${_uid}/pseudo`).set(pseudo).catch(() => {});
              }
              // Sync photo de profil
              if (data.photoUrl) {
                localStorage.setItem('arya_profile_photo', data.photoUrl);
                if (typeof _updateSidebarUser === 'function') _updateSidebarUser();
              }
            })
            .catch(() => {});
          return;
        }

        // 2. Pas en local → on attend Firebase
        let fbPseudo = null;
        try {
          const snap = await firebase.database().ref(`users/${_uid}/pseudo`).once('value');
          fbPseudo = snap.val();
        } catch (e) {
          console.warn('[Arya Auth] Lecture pseudo Firebase:', e);
        }

        if (fbPseudo) {
          pseudo = fbPseudo;
          localStorage.setItem(PSEUDO_STORE, pseudo);
          _hideAuthScreen();
          _updateSidebarUser();
          _onAppReady();
        } else {
          // Nouveau compte → étape pseudo
          _showAuthScreen();
          _showPseudoStep(user.displayName);
        }

      } else {
        // ── Déconnecté ──
        _currentUser = null;
        _uid         = null;
        pseudo       = '';
        if (typeof Sync !== 'undefined') Sync.reset();
        _showAuthScreen();
      }
    });
  }

  return { init, signInWithGoogle, savePseudo, signOut };

})();


/* ═══════════════════════════════════════════════════════════
   _onAppReady — lance tout après connexion
   Remplace loadPseudo() + fetchArchive() de init.js
═══════════════════════════════════════════════════════════ */

function _onAppReady() {
  // Sync depuis Firebase (charge toutes les données utilisateur)
  if (typeof Sync !== 'undefined') Sync.init(_uid);

  // Ably (présence en ligne)
  if (typeof initAbly === 'function') initAbly();

  // Bibliothèque Archive.org
  fetchArchive();

  // Cache audio
  if (typeof CacheManager !== 'undefined') {
    CacheManager.init();
    CacheManager.renderCacheSection();
  }

  // Flow
  if (typeof Flow !== 'undefined') Flow.init();

  // Notifications Nouveautés temps réel
  if (typeof initRecentNotifications === 'function') initRecentNotifications();

  // Met à jour la sidebar
  const sfP = document.getElementById('sfPseudo');
  if (sfP) sfP.textContent = pseudo;
}
