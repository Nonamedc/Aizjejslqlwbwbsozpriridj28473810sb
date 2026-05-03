/* ═══════════════════════════════════════════════════════════
   BLOCKLIST.JS — Arya
   Bloquer une piste — elle ne joue plus jamais
   automatiquement (shuffle, Flow, crossfade).
   Elle reste dans la bibliothèque et peut être
   relancée manuellement si voulu.

   Stockage : localStorage[BLOCK_STORE] → Set de filenames

   API publique :
     BlockList.isBlocked(filename)
     BlockList.toggle(filename)
     BlockList.getAll()
     BlockList.clear()

   Dépend de : config.js, utils.js
═══════════════════════════════════════════════════════════ */

const BlockList = (() => {

  // BLOCK_STORE défini dans config.js

  /* ─────────────────────────────────────────
     STOCKAGE
  ───────────────────────────────────────── */

  function _load() {
    try { return new Set(JSON.parse(localStorage.getItem(BLOCK_STORE) || '[]')); }
    catch { return new Set(); }
  }

  function _save(set) {
    localStorage.setItem(BLOCK_STORE, JSON.stringify([...set]));
  }


  /* ═══════════════════════════════════════════════════════════
     STYLES
  ═══════════════════════════════════════════════════════════ */

  (function _injectStyles() {
    if (document.getElementById('blocklist-styles')) return;
    const s = document.createElement('style');
    s.id = 'blocklist-styles';
    s.textContent = `
      /* Piste bloquée dans la liste */
      .track-row.blocked {
        opacity: 0.35;
        filter: grayscale(1);
        transition: opacity .2s, filter .2s;
      }
      .track-row.blocked:hover {
        opacity: 0.6;
        filter: grayscale(0.5);
      }

      /* Bouton bloquer dans le context menu */
      .ctx-item.ctx-block    { color: var(--rose); }
      .ctx-item.ctx-unblock  { color: var(--accent); }

      /* Toast blocklist */
      .blocklist-undo {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .blocklist-undo-btn {
        background: rgba(255,255,255,.15);
        border: none;
        border-radius: 8px;
        color: #fff;
        font-size: 12px;
        font-weight: 700;
        padding: 3px 10px;
        cursor: pointer;
        font-family: inherit;
      }

      /* Banner dans le lecteur plein écran */
      #fsBlockedBanner {
        display: none;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 8px 16px;
        background: rgba(196,77,110,.12);
        border: 1px solid rgba(196,77,110,.3);
        border-radius: 12px;
        font-size: 12.5px;
        color: var(--rose);
        width: 100%;
        box-sizing: border-box;
        margin-top: -4px;
      }
      #fsBlockedBanner button {
        background: none;
        border: 1px solid var(--rose);
        border-radius: 8px;
        color: var(--rose);
        font-size: 11px;
        font-weight: 700;
        padding: 3px 10px;
        cursor: pointer;
        font-family: inherit;
      }

      /* Icône 🚫 dans la liste sur les pistes bloquées */
      .block-badge {
        font-size: 11px;
        margin-left: 4px;
        opacity: 0.6;
        pointer-events: none;
      }
    `;
    document.head.appendChild(s);
  })();


  /* ═══════════════════════════════════════════════════════════
     API
  ═══════════════════════════════════════════════════════════ */

  function isBlocked(filename) {
    return _load().has(filename);
  }

  function getAll() {
    return _load();
  }

  function block(filename) {
    const set = _load();
    set.add(filename);
    _save(set);
    _applyBlockedUI(filename, true);
    if (typeof Sync !== 'undefined') Sync.pushBlocklist();
  }

  function unblock(filename) {
    const set = _load();
    set.delete(filename);
    _save(set);
    _applyBlockedUI(filename, false);
    if (typeof Sync !== 'undefined') Sync.pushBlocklist();
  }

  function toggle(filename) {
    if (isBlocked(filename)) {
      unblock(filename);
      return false;
    } else {
      block(filename);
      return true;
    }
  }

  function clear() {
    localStorage.removeItem(BLOCK_STORE);
    _refreshAllUI();
    toast('✅ Toutes les pistes débloquées');
  }


  /* ═══════════════════════════════════════════════════════════
     UI
  ═══════════════════════════════════════════════════════════ */

  /** Applique/retire la classe .blocked sur toutes les rows d'une piste. */
  function _applyBlockedUI(filename, blocked) {
    const t = typeof tracks !== 'undefined'
      ? tracks.find(x => x.filename === filename)
      : null;
    if (!t) return;

    document.querySelectorAll(`.track-row[data-id="${t.id}"]`).forEach(row => {
      row.classList.toggle('blocked', blocked);
      // Badge 🚫
      const existing = row.querySelector('.block-badge');
      if (blocked && !existing) {
        const badge = document.createElement('span');
        badge.className   = 'block-badge';
        badge.textContent = '🚫';
        badge.title       = 'Piste bloquée';
        const titleEl = row.querySelector('.tr-title');
        if (titleEl) titleEl.appendChild(badge);
      } else if (!blocked && existing) {
        existing.remove();
      }
    });

    // Update bannière FS si la piste bloquée est celle en cours
    _updateFsBanner();
  }

  function _refreshAllUI() {
    const blocked = _load();
    if (typeof tracks === 'undefined') return;
    tracks.forEach(t => _applyBlockedUI(t.filename, blocked.has(t.filename)));
  }

  /** Bannière dans le lecteur plein écran si la piste courante est bloquée. */
  function _updateFsBanner() {
    const banner = document.getElementById('fsBlockedBanner');
    if (!banner) return;
    if (typeof currentId === 'undefined' || currentId === null) {
      banner.style.display = 'none';
      return;
    }
    const t = typeof tracks !== 'undefined'
      ? tracks.find(x => x.id === currentId)
      : null;
    if (t && isBlocked(t.filename)) {
      banner.style.display = 'flex';
    } else {
      banner.style.display = 'none';
    }
  }

  /** Injecte la bannière dans le lecteur FS si elle n'existe pas. */
  function _injectFsBanner() {
    if (document.getElementById('fsBlockedBanner')) return;
    const fsArtist = document.getElementById('fsArtist');
    if (!fsArtist) return;
    const banner = document.createElement('div');
    banner.id = 'fsBlockedBanner';
    banner.innerHTML = `
      🚫 Cette piste est bloquée
      <button onclick="BlockList.unblockCurrent()">Débloquer</button>`;
    fsArtist.insertAdjacentElement('afterend', banner);
  }

  function unblockCurrent() {
    if (typeof currentId === 'undefined' || currentId === null) return;
    const t = typeof tracks !== 'undefined'
      ? tracks.find(x => x.id === currentId)
      : null;
    if (!t) return;
    unblock(t.filename);
    toast('✅ Piste débloquée — elle rejoindra le shuffle et le Flow');
  }


  /* ═══════════════════════════════════════════════════════════
     PATCHES — empêche les pistes bloquées de jouer
     automatiquement (shuffle, Flow, crossfade, nextTrack)
  ═══════════════════════════════════════════════════════════ */

  function _patchPlayFromQueue() {
    const orig = window.playFromQueue;
    if (!orig || orig._blockPatched) return;
    window.playFromQueue = function () {
      // Saute les pistes bloquées (max 50 essais pour éviter boucle infinie)
      let attempts = 0;
      while (
        typeof queueIdx !== 'undefined' &&
        typeof queue    !== 'undefined' &&
        queue[queueIdx] &&
        isBlocked(queue[queueIdx].filename) &&
        attempts < 50
      ) {
        queueIdx++;
        attempts++;
        if (queueIdx >= queue.length) {
          queueIdx = 0;
          break;
        }
      }
      return orig.apply(this, arguments);
    };
    window.playFromQueue._blockPatched = true;
  }

  function _patchNextTrack() {
    const orig = window.nextTrack;
    if (!orig || orig._blockPatched) return;
    window.nextTrack = function () {
      orig.apply(this, arguments);
      // Si la piste suivante est bloquée → saute automatiquement
      setTimeout(() => {
        if (
          typeof currentId !== 'undefined' &&
          typeof tracks    !== 'undefined'
        ) {
          const t = tracks.find(x => x.id === currentId);
          if (t && isBlocked(t.filename)) {
            orig.apply(this, arguments);
          }
        }
      }, 100);
    };
    window.nextTrack._blockPatched = true;
  }

  function _patchBuildQueue() {
    const orig = window.buildQueue;
    if (!orig || orig._blockPatched) return;
    window.buildQueue = function () {
      orig.apply(this, arguments);
      // Retire les pistes bloquées de la queue
      if (typeof queue !== 'undefined') {
        queue = queue.filter(t => !isBlocked(t.filename));
      }
    };
    window.buildQueue._blockPatched = true;
  }


  /* ═══════════════════════════════════════════════════════════
     CONTEXT MENU — Ajouter le bouton bloquer
  ═══════════════════════════════════════════════════════════ */

  function _patchContextMenu() {
    const origShow = window._showContextMenu;
    if (!origShow || origShow._blockPatched) return;
    window._showContextMenu = function (trackId, x, y) {
      origShow.apply(this, arguments);
      // Ajoute le bouton bloquer à la fin du menu
      const menu = document.getElementById('ctxMenu');
      if (!menu) return;
      const t = typeof tracks !== 'undefined'
        ? tracks.find(x => x.id === trackId)
        : null;
      if (!t) return;
      const blocked = isBlocked(t.filename);
      const sep = document.createElement('div');
      sep.className = 'ctx-sep';
      const btn = document.createElement('button');
      btn.className = `ctx-item ${blocked ? 'ctx-unblock' : 'ctx-block'}`;
      btn.innerHTML = `<span class="ctx-item-ico">${blocked ? '✅' : '🚫'}</span>
        ${blocked ? 'Débloquer cette piste' : 'Ne plus jamais jouer'}`;
      btn.onclick = () => {
        window.closeContextMenu();
        const wasBlocked = toggle(t.filename);
        if (wasBlocked) {
          // Toast avec bouton Annuler
          _toastWithUndo(t.filename, t.title);
        } else {
          toast('✅ Piste débloquée — de retour dans le shuffle et le Flow');
        }
        // Si la piste bloquée est en cours → passe à la suivante
        if (wasBlocked && typeof currentId !== 'undefined' && currentId === trackId) {
          setTimeout(() => {
            if (typeof nextTrack === 'function') nextTrack();
          }, 800);
        }
      };
      menu.appendChild(sep);
      menu.appendChild(btn);
    };
    window._showContextMenu._blockPatched = true;
  }

  function _toastWithUndo(filename, title) {
    const container = document.getElementById('toasts');
    if (!container) { toast('🚫 ' + title + ' ne jouera plus'); return; }
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `
      <span class="blocklist-undo">
        🚫 Ne jouera plus
        <button class="blocklist-undo-btn" onclick="BlockList.unblock('${filename.replace(/'/g, "\\'")}');this.closest('.toast').remove();">
          ANNULER
        </button>
      </span>`;
    container.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.remove(); }, 5000);
  }


  /* ═══════════════════════════════════════════════════════════
     INIT
  ═══════════════════════════════════════════════════════════ */

  function init() {
    _injectFsBanner();
    _patchPlayFromQueue();
    _patchNextTrack();
    _patchBuildQueue();
    _patchContextMenu();
    _refreshAllUI();

    // Patch updatePlayerUI pour mettre à jour la bannière FS
    const origUpdateUI = window.updatePlayerUI;
    if (origUpdateUI && !origUpdateUI._blockPatched) {
      window.updatePlayerUI = function (t) {
        origUpdateUI.apply(this, arguments);
        _updateFsBanner();
      };
      window.updatePlayerUI._blockPatched = true;
    }
  }

  return {
    init,
    isBlocked,
    getAll,
    block,
    unblock,
    unblockCurrent,
    toggle,
    clear,
    refreshUI: _refreshAllUI,
  };

})();
