/* ═══════════════════════════════════════════════════════════
   CACHE.JS V3 — Arya
   Cache audio hors ligne via IndexedDB.
   Demande l'autorisation à l'utilisateur au premier lancement.

   Flux :
     1. Prompt "Activer le mode hors ligne ?"
     2. Si oui → les pistes jouées sont mises en cache
     3. Préchargement silencieux des pistes suivantes
     4. Lecture depuis le cache si disponible (bypass Shaka)
     5. Badge 💾 sur les pistes cachées

   API publique :
     CacheManager.init()                   — initialise (appelé dans init.js)
     CacheManager.isEnabled()              — cache activé ?
     CacheManager.getOrFetch(url, fn)      — blob URL (cache ou réseau)
     CacheManager.isCached(filename)       — vrai si en cache
     CacheManager.prefetch(url, filename)  — précharge silencieusement
     CacheManager.delete(filename)         — supprime une piste
     CacheManager.clear()                  — vide tout le cache
     CacheManager.getUsage()               — {used, count} en bytes

   Dépend de : config.js, utils.js
═══════════════════════════════════════════════════════════ */

const CacheManager = (() => {

  /* ─────────────────────────────────────────
     CONSTANTES
  ───────────────────────────────────────── */
  const DB_NAME    = 'arya_audio_cache';
  const DB_VERSION = 1;
  const STORE_NAME = 'audio_blobs';
  const LS_ENABLED = 'arya_cache_enabled'; // 'true' | 'false' | absent = pas encore demandé
  const LS_QUOTA   = 'arya_cache_quota';   // quota en bytes

  const QUOTA_OPTIONS = [
    { label: '500 Mo',   bytes: 500  * 1_048_576 },
    { label: '1 Go',     bytes: 1024 * 1_048_576 },
    { label: '2 Go',     bytes: 2048 * 1_048_576 },
    { label: '5 Go',     bytes: 5120 * 1_048_576 },
    { label: 'Illimité', bytes: Infinity },
  ];

  let _db      = null;
  let _enabled = localStorage.getItem(LS_ENABLED) === 'true';
  let _quota   = parseInt(localStorage.getItem(LS_QUOTA) || '0') || 2048 * 1_048_576; // 2 Go par défaut
  let _dbReady   = false;
  let _dbPending = [];
  const _prefetching = new Set();


  /* ═══════════════════════════════════════════════════════════
     INDEXEDDB — Ouverture
  ═══════════════════════════════════════════════════════════ */

  function _openDB() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('IndexedDB non supporté'));
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = e => {
        const db    = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'filename' });
          store.createIndex('cachedAt', 'cachedAt', { unique: false });
        }
      };

      req.onsuccess = e => { _db = e.target.result; _dbReady = true; resolve(_db); };
      req.onerror   = e => reject(e.target.error);
    });
  }

  /** Attend que la DB soit prête (ouvre si besoin). */
  function _getDB() {
    if (_dbReady && _db) return Promise.resolve(_db);
    return _openDB();
  }


  /* ═══════════════════════════════════════════════════════════
     CRUD IndexedDB
  ═══════════════════════════════════════════════════════════ */

  async function _get(filename) {
    const db  = await _getDB();
    const tx  = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(filename);
    return new Promise((res, rej) => {
      req.onsuccess = () => res(req.result || null);
      req.onerror   = () => rej(req.error);
    });
  }

  async function _put(filename, blob, url) {
    const db    = await _getDB();
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const entry = { filename, blob, url, size: blob.size, cachedAt: Date.now() };
    const req   = tx.objectStore(STORE_NAME).put(entry);
    return new Promise((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror    = () => rej(req.error);
    });
  }

  /* ─────────────────────────────────────────
     ÉVICTION LRU — supprime les pistes les plus
     anciennes si le quota est dépassé.
  ───────────────────────────────────────── */
  async function _enforceQuota() {
    if (_quota === Infinity) return;
    const all    = await _getAll();
    let used     = all.reduce((a, e) => a + (e.size || 0), 0);
    if (used <= _quota) return;

    // Tri par lastUsed (le plus ancien en premier)
    const sorted = [...all].sort((a, b) => (a.lastUsed || a.cachedAt) - (b.lastUsed || b.cachedAt));
    for (const entry of sorted) {
      if (used <= _quota) break;
      await _delete(entry.filename);
      _cachedSet.delete(entry.filename);
      used -= (entry.size || 0);
      console.log('[Arya Cache] Éviction LRU :', entry.filename);
    }
    _refreshBadges();
  }

  async function _delete(filename) {
    const db  = await _getDB();
    const tx  = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).delete(filename);
    return new Promise((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror    = () => rej(req.error);
    });
  }

  async function _getAll() {
    const db  = await _getDB();
    const tx  = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    return new Promise((res, rej) => {
      req.onsuccess = () => res(req.result || []);
      req.onerror   = () => rej(req.error);
    });
  }

  async function _clear() {
    const db  = await _getDB();
    const tx  = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).clear();
    return new Promise((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror    = () => rej(req.error);
    });
  }


  /* ═══════════════════════════════════════════════════════════
     TÉLÉCHARGEMENT AVEC PROGRESSION
  ═══════════════════════════════════════════════════════════ */

  async function _download(url, onProgress) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const total   = parseInt(res.headers.get('Content-Length') || '0');
    const reader  = res.body.getReader();
    const chunks  = [];
    let received  = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (onProgress && total) onProgress(received / total);
    }

    const mime = res.headers.get('Content-Type') || 'audio/mpeg';
    return new Blob(chunks, { type: mime });
  }


  /* ═══════════════════════════════════════════════════════════
     PROMPT DE PERMISSION
     Affiché une seule fois au premier lancement.
  ═══════════════════════════════════════════════════════════ */

  function _showPrompt() {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.id    = 'cachePrompt';
      overlay.style.cssText =
        'position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;' +
        'justify-content:center;background:rgba(0,0,0,.72);' +
        'backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);padding:16px;';

      // Quota sélectionné par défaut : 2 Go
      let _selectedQuota = 2048 * 1_048_576;

      overlay.innerHTML = `
        <div style="
          background:var(--surface);
          border:1px solid var(--border);
          border-radius:22px;
          padding:26px 22px 22px;
          width:100%;max-width:420px;
          box-shadow:0 24px 60px rgba(0,0,0,.7);
        ">
          <div style="font-size:36px;margin-bottom:14px;text-align:center;">🎵💾</div>
          <div style="font-size:17px;font-weight:700;color:var(--text);margin-bottom:10px;text-align:center;">
            Mode hors ligne
          </div>
          <div style="font-size:13px;color:var(--text2);line-height:1.7;margin-bottom:18px;text-align:center;">
            Arya peut sauvegarder vos musiques sur cet appareil.<br>
            Lecture <strong style="color:var(--text);">instantanée</strong>, même sans connexion.<br>
            <span style="font-size:11.5px;color:var(--text3);">
              Les musiques les plus anciennes sont supprimées automatiquement si le quota est atteint.
            </span>
          </div>

          <div style="font-size:11.5px;font-weight:700;color:var(--text3);letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px;">
            Espace à allouer
          </div>
          <div id="quotaBtns" style="display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:18px;">
            ${QUOTA_OPTIONS.map(o => `
              <button data-bytes="${o.bytes === Infinity ? 'Infinity' : o.bytes}"
                      style="padding:10px 6px;border-radius:11px;font-size:13px;font-weight:600;
                             border:2px solid ${o.bytes === 2048 * 1_048_576 ? 'var(--accent)' : 'var(--border)'};
                             background:${o.bytes === 2048 * 1_048_576 ? 'color-mix(in srgb,var(--accent) 15%,transparent)' : 'var(--surface2,#2a1f33)'};
                             color:${o.bytes === 2048 * 1_048_576 ? 'var(--accent)' : 'var(--text2)'};
                             cursor:pointer;font-family:inherit;transition:all .15s;">
                ${o.label}
              </button>`).join('')}
          </div>

          <div style="display:flex;gap:10px;">
            <button id="cacheNo" style="
              flex:1;padding:13px;border-radius:13px;
              border:1px solid var(--border);background:var(--surface2,#2a1f33);
              color:var(--text2);font-size:14px;cursor:pointer;font-family:inherit;
            ">Non merci</button>
            <button id="cacheYes" style="
              flex:2;padding:13px;border-radius:13px;
              border:none;background:var(--accent);
              color:#000;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;
            ">✅ Activer</button>
          </div>

          <div style="font-size:10.5px;color:var(--text3);text-align:center;margin-top:12px;line-height:1.6;">
            Vous pouvez changer ce choix dans<br>Import / Export → Cache audio
          </div>
        </div>`;

      // Gestion sélection quota
      overlay.querySelector('#quotaBtns').addEventListener('click', e => {
        const btn = e.target.closest('button[data-bytes]');
        if (!btn) return;
        const raw = btn.dataset.bytes;
        _selectedQuota = raw === 'Infinity' ? Infinity : parseInt(raw);
        overlay.querySelectorAll('#quotaBtns button').forEach(b => {
          const active = b === btn;
          b.style.borderColor = active ? 'var(--accent)' : 'var(--border)';
          b.style.background  = active ? 'color-mix(in srgb,var(--accent) 15%,transparent)' : 'var(--surface2,#2a1f33)';
          b.style.color       = active ? 'var(--accent)' : 'var(--text2)';
        });
      });

      document.body.appendChild(overlay);

      document.getElementById('cacheYes').onclick = () => {
        overlay.remove();
        resolve({ accepted: true, quota: _selectedQuota });
      };
      document.getElementById('cacheNo').onclick = () => {
        overlay.remove();
        resolve({ accepted: false, quota: null });
      };
    });
  }


  /* ═══════════════════════════════════════════════════════════
     BADGES VISUELS
  ═══════════════════════════════════════════════════════════ */

  const _cachedSet = new Set(); // filenames en cache (chargé au démarrage)

  async function _loadCachedSet() {
    try {
      const all = await _getAll();
      all.forEach(e => _cachedSet.add(e.filename));
      _refreshBadges();
    } catch {}
  }

  function _refreshBadges() {
    document.querySelectorAll('.track-row[data-id]').forEach(row => {
      const id = parseInt(row.dataset.id);
      const t  = tracks.find(x => x.id === id);
      if (!t) return;
      _updateBadge(row, _cachedSet.has(t.filename));
    });
  }

  function _updateBadge(row, isCached) {
    let badge = row.querySelector('.cache-badge');
    if (isCached && !badge) {
      badge = document.createElement('span');
      badge.className   = 'cache-badge';
      badge.textContent = '💾';
      badge.title       = 'Disponible hors ligne';
      badge.style.cssText =
        'font-size:11px;margin-left:auto;flex-shrink:0;opacity:.55;pointer-events:none;';
      const dur = row.querySelector('.tr-dur');
      if (dur) dur.prepend(badge);
    } else if (!isCached && badge) {
      badge.remove();
    }
  }


  /* ═══════════════════════════════════════════════════════════
     STYLES
  ═══════════════════════════════════════════════════════════ */

  function _injectStyles() {
    if (document.getElementById('cache-styles')) return;
    const s = document.createElement('style');
    s.id = 'cache-styles';
    s.textContent = `
      .cache-badge { transition: opacity .2s; }
      .track-row:hover .cache-badge { opacity: 1 !important; }

      /* Section cache dans la vue data */
      .cache-usage-bar {
        height: 6px;
        background: var(--border);
        border-radius: 3px;
        margin: 10px 0 6px;
        overflow: hidden;
      }
      .cache-usage-fill {
        height: 100%;
        background: var(--accent);
        border-radius: 3px;
        transition: width .4s ease;
      }
      .cache-track-list {
        max-height: 260px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-top: 12px;
      }
      .cache-track-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 10px;
        border-radius: 8px;
        background: var(--card);
        border: 1px solid var(--border);
        font-size: 12.5px;
      }
      .cache-track-del {
        margin-left: auto;
        background: none;
        border: none;
        color: var(--text3);
        cursor: pointer;
        font-size: 14px;
        flex-shrink: 0;
        padding: 4px;
        border-radius: 4px;
        transition: color .13s;
      }
      .cache-track-del:hover { color: var(--rose); }
    `;
    document.head.appendChild(s);
  }


  /* ═══════════════════════════════════════════════════════════
     VUE CACHE (dans la vue data)
  ═══════════════════════════════════════════════════════════ */

  async function renderCacheSection() {
    const container = document.getElementById('cacheSection');
    if (!container) return;

    const enabled = _enabled;
    let usageHtml = '';

    if (enabled) {
      const usage  = await getUsage().catch(() => ({ used: 0, count: 0 }));
      const usedMb = (usage.used / 1_048_576).toFixed(1);
      const quotaLabel = _quota === Infinity ? 'Illimité' : (_quota / 1_048_576) >= 1024
        ? (_quota / 1_073_741_824).toFixed(0) + ' Go'
        : (_quota / 1_048_576).toFixed(0) + ' Mo';
      const pctQuota = _quota === Infinity ? 5 : Math.min(100, Math.round(usage.used / _quota * 100));

      // Sélecteur de quota
      const quotaSelectorHtml = `
        <div style="margin:14px 0 8px;">
          <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px;">
            Espace alloué
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            ${QUOTA_OPTIONS.map(o => `
              <button onclick="CacheManager.setQuota(${o.bytes === Infinity ? 'Infinity' : o.bytes})"
                      style="padding:7px 13px;border-radius:20px;font-size:12.5px;font-weight:600;
                             border:2px solid ${o.bytes === _quota ? 'var(--accent)' : 'var(--border)'};
                             background:${o.bytes === _quota ? 'color-mix(in srgb,var(--accent) 15%,transparent)' : 'var(--card)'};
                             color:${o.bytes === _quota ? 'var(--accent)' : 'var(--text2)'};
                             cursor:pointer;font-family:inherit;">
                ${o.label}
              </button>`).join('')}
          </div>
        </div>`;

      let quotaHtml = `
        <div class="cache-usage-bar">
          <div class="cache-usage-fill" style="width:${pctQuota}%"></div>
        </div>
        <div style="font-size:11px;color:var(--text3);margin-bottom:4px;">
          ${usedMb} Mo utilisés sur ${quotaLabel} · ${usage.count} piste${usage.count !== 1 ? 's' : ''}
          ${_quota !== Infinity ? `· (${pctQuota}%)` : ''}
        </div>
        ${quotaSelectorHtml}`;

      // Liste des pistes en cache
      let listHtml = '';
      if (usage.count > 0) {
        const all = await _getAll().catch(() => []);
        all.sort((a, b) => b.cachedAt - a.cachedAt);
        listHtml = `
          <div class="cache-track-list">
            ${all.map(e => {
              const t = typeof tracks !== 'undefined' ? tracks.find(x => x.filename === e.filename) : null;
              const mb = (e.size / 1_048_576).toFixed(1);
              return `
                <div class="cache-track-item">
                  <span>💾</span>
                  <div style="flex:1;min-width:0;">
                    <div style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                      ${esc(t ? t.title : e.filename)}
                    </div>
                    <div style="font-size:11px;color:var(--text3);">${mb} Mo</div>
                  </div>
                  <button class="cache-track-del"
                          onclick="CacheManager.delete('${escAttr(e.filename)}').then(()=>CacheManager.renderCacheSection())"
                          title="Retirer du cache">✕</button>
                </div>`;
            }).join('')}
          </div>`;
      }

      usageHtml = quotaHtml + listHtml;
    }

    container.innerHTML = `
      <div class="data-section-label">Cache audio hors ligne</div>
      <div class="data-card">
        <div class="data-card-title">💾 Mode hors ligne</div>
        <div class="data-card-sub">
          ${enabled
            ? `Les musiques écoutées sont sauvegardées sur cet appareil pour une lecture instantanée, même sans connexion.<br>
               ${usageHtml}`
            : `Activez ce mode pour écouter vos musiques sans connexion — comme Spotify.<br>
               Les fichiers sont stockés localement sur votre appareil.`}
        </div>
        <div class="data-acts" style="flex-wrap:wrap;gap:8px;">
          ${enabled
            ? `<button class="btn btn-ghost" style="border-color:var(--rose);color:var(--rose);"
                       onclick="CacheManager.disable()">⛔ Désactiver & vider</button>`
            : `<button class="btn btn-acc"
                       onclick="CacheManager.enable()">✅ Activer</button>`}
          ${enabled && _cachedSet.size > 0
            ? `<button class="btn btn-ghost"
                       onclick="CacheManager.clear().then(()=>CacheManager.renderCacheSection())">
                 🗑 Vider le cache
               </button>`
            : ''}
        </div>
      </div>`;
  }


  /* ═══════════════════════════════════════════════════════════
     API PUBLIQUE
  ═══════════════════════════════════════════════════════════ */

  async function init() {
    _injectStyles();

    // Ouvre la DB en arrière-plan si déjà décidé
    if (_enabled) {
      _openDB().then(() => _loadCachedSet()).catch(() => {});
    }

    // Pas encore demandé → affiche le prompt après le pseudo
    const decided = localStorage.getItem(LS_ENABLED);
    if (decided === null) {
      // Attend que le pseudo soit défini (pseudoScreen caché)
      const waitPseudo = setInterval(() => {
        const screen = document.getElementById('pseudoScreen');
        if (!screen || screen.style.display === 'none') {
          clearInterval(waitPseudo);
          setTimeout(async () => {
            const { accepted, quota } = await _showPrompt();
            localStorage.setItem(LS_ENABLED, accepted ? 'true' : 'false');
            _enabled = accepted;
            if (accepted) {
              _quota = quota;
              localStorage.setItem(LS_QUOTA, quota === Infinity ? 'Infinity' : String(quota));
              await _openDB();
              await _loadCachedSet();
              renderCacheSection();
              const opt = QUOTA_OPTIONS.find(o => o.bytes === quota);
              toast('💾 Mode hors ligne activé — ' + (opt ? opt.label : 'quota personnalisé'));
            }
          }, 600);
        }
      }, 300);
    }
  }

  function isEnabled() { return _enabled; }

  function isCached(filename) { return _cachedSet.has(filename); }

  /**
   * Retourne un blob URL depuis le cache ou télécharge depuis le réseau.
   * Appelé dans loadAndPlay() avant Shaka.
   * @returns {Promise<string|null>} blobUrl si en cache, null sinon
   */
  async function getOrFetch(url, filename) {
    if (!_enabled) return null;
    try {
      const entry = await _get(filename);
      if (entry?.blob) {
        // Met à jour lastUsed pour le LRU
        const db = await _getDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put({ ...entry, lastUsed: Date.now() });
        return URL.createObjectURL(entry.blob);
      }
    } catch {}
    return null;
  }

  /**
   * Précharge une piste en arrière-plan et la met en cache.
   * Silencieux — aucune erreur n'est propagée.
   */
  async function prefetch(url, filename) {
    if (!_enabled || !filename || _cachedSet.has(filename) || _prefetching.has(filename)) return;
    _prefetching.add(filename);
    try {
      const blob = await _download(url);
      await _put(filename, blob, url);
      _cachedSet.add(filename);
      await _enforceQuota();
      _refreshBadges();
    } catch (e) {
      console.warn('[Arya Cache] Préchargement échoué :', filename, e.message);
    } finally {
      _prefetching.delete(filename);
    }
  }

  /**
   * Met en cache une piste après lecture (depuis le blob déjà téléchargé).
   * Appelé dans loadAndPlay() après lecture réussie.
   */
  async function cacheAfterPlay(url, filename) {
    if (!_enabled || !filename || _cachedSet.has(filename) || _prefetching.has(filename)) return;
    _prefetching.add(filename);
    try {
      const blob = await _download(url);
      await _put(filename, blob, url);
      _cachedSet.add(filename);
      await _enforceQuota();
      _refreshBadges();
    } catch (e) {
      console.warn('[Arya Cache] Mise en cache échouée :', filename, e.message);
    } finally {
      _prefetching.delete(filename);
    }
  }

  async function deleteTrack(filename) {
    try {
      await _delete(filename);
      _cachedSet.delete(filename);
      _refreshBadges();
      toast('🗑 Retiré du cache');
    } catch (e) {
      toast('Erreur lors de la suppression', true);
    }
  }

  async function clear() {
    try {
      await _clear();
      _cachedSet.clear();
      _refreshBadges();
      toast('🗑 Cache vidé');
    } catch {
      toast('Erreur lors du vidage', true);
    }
  }

  async function getUsage() {
    const all  = await _getAll();
    const used = all.reduce((a, e) => a + (e.size || 0), 0);
    return { used, count: all.length };
  }

  function setQuota(bytes) {
    _quota = bytes;
    localStorage.setItem(LS_QUOTA, bytes === Infinity ? 'Infinity' : String(bytes));
    _enforceQuota().then(() => renderCacheSection());
    const opt = QUOTA_OPTIONS.find(o => o.bytes === bytes);
    toast('💾 Quota : ' + (opt ? opt.label : (bytes / 1_048_576).toFixed(0) + ' Mo'));
  }

  function enable() {
    localStorage.setItem(LS_ENABLED, 'true');
    _enabled = true;
    _openDB().then(() => _loadCachedSet()).catch(() => {});
    renderCacheSection();
    toast('💾 Mode hors ligne activé !');
  }

  function disable() {
    if (!confirm('Désactiver le mode hors ligne et supprimer tous les fichiers en cache ?')) return;
    localStorage.setItem(LS_ENABLED, 'false');
    _enabled = false;
    clear().then(() => renderCacheSection());
  }

  return {
    init,
    isEnabled,
    isCached,
    getOrFetch,
    prefetch,
    cacheAfterPlay,
    delete: deleteTrack,
    clear,
    getUsage,
    setQuota,
    enable,
    disable,
    renderCacheSection,
    refreshBadges: _refreshBadges,
  };

})();
