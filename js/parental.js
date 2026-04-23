/* ═══════════════════════════════════════════════════════════
   PARENTAL.JS — Contrôle Parental · Arya V2
   Aucune dépendance externe (module IIFE autonome).

   Stockage localStorage (jamais de mot de passe en clair) :
     arya_parental_hash            → SHA-256 du mot de passe
     arya_parental_enabled         → "true" | "false"
     arya_parental_allowed_artists → JSON array d'artistes autorisés

   ⚠️  Le sel de hachage (SEL_HASH) est intégré à chaque hash.
       Le modifier invalide tous les mots de passe existants.
═══════════════════════════════════════════════════════════ */

const ParentalControl = (() => {

  /* ─────────────────────────────────────────
     CLÉS LOCALSTORAGE
  ───────────────────────────────────────── */
  const KEYS = {
    hash:    'arya_parental_hash',
    enabled: 'arya_parental_enabled',
    artists: 'arya_parental_allowed_artists',
  };

  /* ─────────────────────────────────────────
     HACHAGE SHA-256
     ⚠️  Modifier SEL_HASH invalide tous les
     mots de passe déjà enregistrés.
  ───────────────────────────────────────── */
  const SEL_HASH = '::arya_parental_v1';

  async function hashPassword(pwd) {
    const data = new TextEncoder().encode(pwd + SEL_HASH);
    const buf  = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(buf)]
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /* ─────────────────────────────────────────
     GETTERS
  ───────────────────────────────────────── */
  const isEnabled        = () => localStorage.getItem(KEYS.enabled) === 'true';
  const hasPassword      = () => !!localStorage.getItem(KEYS.hash);
  const getAllowedArtists = () => {
    try { return JSON.parse(localStorage.getItem(KEYS.artists) || '[]'); }
    catch { return []; }
  };

  /* ─────────────────────────────────────────
     FILTRE DE PISTES
     À appeler avant tout rendu de liste.
  ───────────────────────────────────────── */
  function filterTracks(tracks) {
    if (!isEnabled()) return tracks;
    const allowed = getAllowedArtists().map(a => a.toLowerCase().trim());
    if (allowed.length === 0) return tracks; // liste vide = tout autorisé
    return tracks.filter(t =>
      allowed.some(a => (t.artist || '').toLowerCase().trim() === a)
    );
  }

  /* ─────────────────────────────────────────
     UTILITAIRES UI
  ───────────────────────────────────────── */

  /** Échappe les caractères HTML (usage local dans les modales). */
  const _esc = s => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

  function _removeModal() {
    document.querySelectorAll('.pc-overlay').forEach(el => el.remove());
  }

  function _createModal(html) {
    _removeModal();
    const el = document.createElement('div');
    el.className = 'pc-overlay';
    el.innerHTML = html;
    document.body.appendChild(el);
    // Ferme en cliquant sur le fond
    el.addEventListener('click', e => { if (e.target === el) _removeModal(); });
    return el;
  }

  /** Utilise toast() de utils.js si disponible, sinon fallback natif. */
  function _toast(msg) {
    if (typeof toast === 'function') { toast(msg); return; }
    const el = Object.assign(document.createElement('div'), {
      className:   'pc-toast',
      textContent: msg,
    });
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2800);
  }

  /* ─────────────────────────────────────────
     REFRESH — recharge la vue après modif
  ───────────────────────────────────────── */
  function _triggerRefresh() {
    if (typeof tracks !== 'undefined' && typeof filtered !== 'undefined') {
      filtered = ParentalControl.filterTracks([...tracks]);
      if (typeof applySort === 'function') applySort();
    }
    if (typeof renderAll === 'function') { renderAll(); return; }
    // Fallbacks au cas où l'architecture évolue
    if (typeof App !== 'undefined') {
      if (typeof App.renderCurrentView === 'function') { App.renderCurrentView(); return; }
      if (typeof App.render            === 'function') { App.render(); return; }
    }
    if (typeof renderLibrary === 'function') renderLibrary();
  }

  /* ═══════════════════════════════════════════════════════════
     MODALE — Configuration parentale
  ═══════════════════════════════════════════════════════════ */

  async function _showSetupModal(allArtists = []) {
    const allowed = getAllowedArtists();

    const artistRows = allArtists.length
      ? allArtists.map(a => `
          <label class="pc-artist-row">
            <input type="checkbox" value="${_esc(a)}" ${allowed.includes(a) ? 'checked' : ''}>
            <span>${_esc(a)}</span>
          </label>`).join('')
      : `<p class="pc-hint">Aucun artiste détecté dans la bibliothèque.</p>`;

    const overlay = _createModal(`
      <div class="pc-modal" role="dialog" aria-modal="true" aria-label="Contrôle Parental">

        <div class="pc-header">
          <span class="pc-icon">🔒</span>
          <h2>Contrôle Parental</h2>
        </div>

        <!-- Mot de passe -->
        <section class="pc-section">
          <label class="pc-label">
            MOT DE PASSE
            ${hasPassword() ? '<span class="pc-badge-sm">laisser vide pour ne pas changer</span>' : ''}
          </label>
          <input type="password" id="pc-pwd1"
                 placeholder="Nouveau mot de passe (min. 4 car.)"
                 autocomplete="new-password">
          <input type="password" id="pc-pwd2"
                 placeholder="Confirmer le mot de passe"
                 autocomplete="new-password"
                 style="margin-top:8px">
        </section>

        <!-- Artistes autorisés -->
        <section class="pc-section">
          <label class="pc-label">
            ARTISTES AUTORISÉS
            <span class="pc-badge-sm">aucune sélection = tous autorisés</span>
          </label>
          <input type="text" id="pc-search"
                 placeholder="🔍 Rechercher un artiste…"
                 style="margin-bottom:8px">
          <div class="pc-artist-list" id="pc-artist-list">${artistRows}</div>
          <div class="pc-hint" id="pc-count-hint"></div>
        </section>

        <!-- Activer / désactiver -->
        <section class="pc-section">
          <label class="pc-label">STATUT</label>
          <div class="pc-toggle-row">
            <span>Contrôle parental actif</span>
            <label class="pc-switch">
              <input type="checkbox" id="pc-active" ${isEnabled() ? 'checked' : ''}>
              <span class="pc-slider"></span>
            </label>
          </div>
        </section>

        <div id="pc-error" class="pc-error" hidden></div>

        <div class="pc-actions">
          <button id="pc-cancel" class="pc-btn pc-btn--secondary">Annuler</button>
          <button id="pc-save"   class="pc-btn pc-btn--primary">💾 Enregistrer</button>
        </div>
      </div>
    `);

    /* Recherche dans la liste d'artistes */
    const searchInput = overlay.querySelector('#pc-search');
    const updateCount = () => {
      const n = overlay.querySelectorAll('.pc-artist-row input:checked').length;
      overlay.querySelector('#pc-count-hint').textContent =
        n > 0 ? `${n} artiste${n > 1 ? 's' : ''} sélectionné${n > 1 ? 's' : ''}` : '';
    };
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase();
      overlay.querySelectorAll('.pc-artist-row').forEach(row => {
        row.style.display = row.querySelector('span').textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });
    overlay.querySelectorAll('.pc-artist-row input').forEach(cb =>
      cb.addEventListener('change', updateCount)
    );
    updateCount();

    /* Annuler */
    overlay.querySelector('#pc-cancel').onclick = _removeModal;

    /* Enregistrer */
    overlay.querySelector('#pc-save').onclick = async () => {
      const pwd1   = overlay.querySelector('#pc-pwd1').value.trim();
      const pwd2   = overlay.querySelector('#pc-pwd2').value.trim();
      const active = overlay.querySelector('#pc-active').checked;
      const errEl  = overlay.querySelector('#pc-error');
      const showErr = msg => { errEl.textContent = msg; errEl.hidden = false; };
      errEl.hidden = true;

      /* Validation mot de passe */
      if (pwd1 || pwd2 || !hasPassword()) {
        if (!pwd1)           { showErr('Veuillez définir un mot de passe.'); return; }
        if (pwd1.length < 4) { showErr('Le mot de passe doit contenir au moins 4 caractères.'); return; }
        if (pwd1 !== pwd2)   { showErr('Les mots de passe ne correspondent pas.'); return; }
        localStorage.setItem(KEYS.hash, await hashPassword(pwd1));
      }

      /* Artistes sélectionnés */
      const selected = [...overlay.querySelectorAll('.pc-artist-row input:checked')]
        .map(cb => cb.value);
      localStorage.setItem(KEYS.artists, JSON.stringify(selected));
      localStorage.setItem(KEYS.enabled,  active ? 'true' : 'false');

      _removeModal();
      _toast(active ? '🔒 Contrôle parental activé' : '🔓 Contrôle parental désactivé');
      _triggerRefresh();
    };
  }

  /* ═══════════════════════════════════════════════════════════
     MODALE — Déverrouillage
  ═══════════════════════════════════════════════════════════ */

  function _showUnlockModal(onSuccess) {
    const overlay = _createModal(`
      <div class="pc-modal pc-modal--sm" role="dialog" aria-modal="true">
        <div class="pc-header">
          <span class="pc-icon">🔐</span>
          <h2>Mode Parental</h2>
        </div>
        <p class="pc-hint" style="text-align:center;margin-bottom:16px">
          Entrez le mot de passe pour accéder aux paramètres parentaux.
        </p>
        <input type="password" id="pc-unlock-pwd"
               placeholder="Mot de passe" autocomplete="current-password">
        <div id="pc-unlock-err" class="pc-error" hidden>❌ Mot de passe incorrect.</div>
        <div class="pc-actions" style="margin-top:16px">
          <button id="pc-ul-cancel"  class="pc-btn pc-btn--secondary">Annuler</button>
          <button id="pc-ul-confirm" class="pc-btn pc-btn--primary">🔓 Déverrouiller</button>
        </div>
      </div>
    `);

    const pwdInput = overlay.querySelector('#pc-unlock-pwd');
    const errEl    = overlay.querySelector('#pc-unlock-err');
    pwdInput.focus();

    const tryUnlock = async () => {
      const hash   = await hashPassword(pwdInput.value);
      const stored = localStorage.getItem(KEYS.hash);
      if (hash === stored) {
        _removeModal();
        if (onSuccess) onSuccess();
      } else {
        errEl.hidden   = false;
        pwdInput.value = '';
        pwdInput.focus();
      }
    };

    overlay.querySelector('#pc-ul-cancel').onclick  = _removeModal;
    overlay.querySelector('#pc-ul-confirm').onclick = tryUnlock;
    pwdInput.addEventListener('keydown', e => { if (e.key === 'Enter') tryUnlock(); });
  }

  /* ═══════════════════════════════════════════════════════════
     STYLES
  ═══════════════════════════════════════════════════════════ */

  function _injectStyles() {
    if (document.getElementById('pc-styles')) return;
    const s = document.createElement('style');
    s.id = 'pc-styles';
    s.textContent = `
      .pc-overlay {
        position:fixed;inset:0;background:rgba(0,0,0,.75);
        z-index:99999;display:flex;align-items:center;justify-content:center;
        backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);padding:16px;
      }
      .pc-modal {
        background:#12122a;border:1px solid rgba(99,102,241,.3);border-radius:22px;
        padding:24px;width:100%;max-width:460px;max-height:88vh;overflow-y:auto;
        box-shadow:0 24px 60px rgba(0,0,0,.6);
      }
      .pc-modal--sm { max-width:340px; }

      .pc-header { display:flex;align-items:center;gap:10px;margin-bottom:22px; }
      .pc-icon   { font-size:28px; }
      .pc-header h2 { margin:0;font-size:20px;color:#fff;font-family:inherit; }

      .pc-section  { margin-bottom:20px; }
      .pc-label {
        display:block;font-size:11px;font-weight:700;color:#6b7280;
        letter-spacing:.8px;text-transform:uppercase;margin-bottom:8px;
      }
      .pc-badge-sm {
        display:inline-block;font-weight:400;text-transform:none;letter-spacing:0;
        font-size:11px;color:#818cf8;margin-left:6px;
      }
      .pc-hint { font-size:12px;color:#6b7280;margin-top:6px; }

      .pc-modal input[type=password],
      .pc-modal input[type=text] {
        width:100%;box-sizing:border-box;background:#0a0a1f;
        border:1px solid rgba(99,102,241,.25);border-radius:12px;
        padding:12px 14px;color:#e2e8f0;font-size:15px;outline:none;
        transition:border-color .2s;font-family:inherit;
      }
      .pc-modal input:focus { border-color:#6366f1; }

      .pc-artist-list {
        max-height:200px;overflow-y:auto;background:#0a0a1f;
        border:1px solid rgba(99,102,241,.2);border-radius:12px;padding:4px;
      }
      .pc-artist-row {
        display:flex;align-items:center;gap:10px;padding:9px 12px;
        border-radius:8px;cursor:pointer;transition:background .15s;
      }
      .pc-artist-row:hover { background:rgba(99,102,241,.12); }
      .pc-artist-row input[type=checkbox] {
        width:17px;height:17px;accent-color:#6366f1;cursor:pointer;flex-shrink:0;
      }
      .pc-artist-row span { color:#c4c9d4;font-size:14px; }

      .pc-toggle-row {
        display:flex;align-items:center;justify-content:space-between;
        background:#0a0a1f;border:1px solid rgba(99,102,241,.2);
        border-radius:12px;padding:12px 16px;color:#c4c9d4;
      }
      .pc-switch  { position:relative;display:inline-block;width:46px;height:26px; }
      .pc-switch input { opacity:0;width:0;height:0; }
      .pc-slider  {
        position:absolute;cursor:pointer;inset:0;background:#2d2d4a;
        border-radius:26px;transition:.3s;
      }
      .pc-slider:before {
        content:'';position:absolute;height:20px;width:20px;left:3px;bottom:3px;
        background:#fff;border-radius:50%;transition:.3s;
      }
      .pc-switch input:checked + .pc-slider              { background:#6366f1; }
      .pc-switch input:checked + .pc-slider:before       { transform:translateX(20px); }

      .pc-actions { display:flex;gap:10px;margin-top:4px; }
      .pc-btn {
        flex:1;padding:13px;border-radius:13px;border:none;font-size:15px;
        font-weight:600;cursor:pointer;transition:opacity .15s;font-family:inherit;
      }
      .pc-btn:active        { opacity:.7; }
      .pc-btn--primary      { background:#6366f1;color:#fff; }
      .pc-btn--secondary    { background:#1e1e3d;color:#9ca3af; }

      .pc-error {
        color:#f87171;font-size:13px;background:rgba(248,113,113,.08);
        border:1px solid rgba(248,113,113,.25);border-radius:8px;
        padding:10px 12px;margin-top:8px;
      }

      /* Toast fallback (si utils.js non disponible) */
      .pc-toast {
        position:fixed;bottom:90px;left:50%;transform:translateX(-50%);
        background:#1e1e3d;border:1px solid rgba(99,102,241,.4);
        color:#e2e8f0;padding:11px 22px;border-radius:20px;
        z-index:999999;font-size:14px;font-weight:500;
        animation:pc-fade .25s ease;pointer-events:none;
      }
      @keyframes pc-fade { from { opacity:0;transform:translateX(-50%) translateY(8px); } }

      .pc-status-badge {
        display:inline-flex;align-items:center;gap:5px;
        background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.35);
        color:#818cf8;border-radius:20px;padding:4px 11px;
        font-size:12px;font-weight:600;
      }
    `;
    document.head.appendChild(s);
  }

  /* ═══════════════════════════════════════════════════════════
     API PUBLIQUE
  ═══════════════════════════════════════════════════════════ */
  return {

    /** Initialise les styles — appeler une fois dans init.js. */
    init() { _injectStyles(); },

    isEnabled,
    hasPassword,
    getAllowedArtists,

    /**
     * Filtre un tableau de pistes selon les artistes autorisés.
     * @param {Array} tracks
     * @returns {Array}
     */
    filterTracks,

    /**
     * Extrait les artistes uniques d'un tableau de pistes, triés alphabétiquement.
     * @param {Array} tracks
     * @returns {string[]}
     */
    extractArtists(tracks) {
      const set = new Set();
      (tracks || []).forEach(t => { if (t.artist) set.add(t.artist); });
      return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
    },

    /**
     * Ouvre les paramètres (demande le mot de passe si déjà défini).
     * @param {Array} allTracks — toutes les pistes de la bibliothèque
     */
    openSettings(allTracks = []) {
      const artists = this.extractArtists(allTracks);
      if (hasPassword()) {
        _showUnlockModal(() => _showSetupModal(artists));
      } else {
        _showSetupModal(artists);
      }
    },

    /** Retourne un badge HTML pour affichage dans la topbar/settings. */
    getStatusBadge() {
      if (!isEnabled()) return '';
      const n = getAllowedArtists().length;
      return `<span class="pc-status-badge">🔒 ${n > 0 ? n + ' artiste' + (n > 1 ? 's' : '') : 'Actif'}</span>`;
    },

    /** Ouvre uniquement la modale de déverrouillage (usage avancé). */
    unlock(onSuccess) { _showUnlockModal(onSuccess); },

    /** Désactive complètement (vérifie le mot de passe si défini). */
    disable() {
      if (!hasPassword()) { this._forceDisable(); return; }
      _showUnlockModal(() => this._forceDisable());
    },

    _forceDisable() {
      localStorage.removeItem(KEYS.hash);
      localStorage.removeItem(KEYS.enabled);
      localStorage.removeItem(KEYS.artists);
      _toast('🔓 Contrôle parental désactivé et supprimé');
      _triggerRefresh();
    },
  };

})();

/* Auto-init styles */
ParentalControl.init();
