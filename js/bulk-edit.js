/* ═══════════════════════════════════════════════════════════
   BULK-EDIT.JS — Arya v2
   Multi-sélection & édition en masse.

   Dépend de : config.js, utils.js, render.js, covers.js
   Point d'entrée : initBulkEdit() depuis renderAll()
═══════════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════════
   0. CSS
═══════════════════════════════════════════════════════════ */

(function _injectBulkStyles() {
  if (document.getElementById('bulk-edit-styles')) return;
  const s = document.createElement('style');
  s.id = 'bulk-edit-styles';
  s.textContent = `
    /* ── Track list en mode sélection ── */
    #trackList.sel-mode {
      user-select: none;
      -webkit-user-select: none;
    }
    #trackList.sel-mode .track-row {
      position: relative;
      padding-left: 48px !important;
      cursor: pointer;
      transition: background 0.12s, padding-left 0.15s;
    }

    /* Cercle checkbox avant chaque row */
    #trackList.sel-mode .track-row::before {
      content: '';
      position: absolute;
      left: 14px; top: 50%;
      transform: translateY(-50%);
      width: 22px; height: 22px;
      border-radius: 50%;
      border: 2px solid var(--text3);
      background: transparent;
      transition: all 0.15s;
      box-sizing: border-box;
    }
    #trackList.sel-mode .track-row.sel-checked::before {
      background: var(--accent);
      border-color: var(--accent);
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'/%3E%3C/svg%3E");
      background-size: 13px;
      background-repeat: no-repeat;
      background-position: center;
    }
    #trackList.sel-mode .track-row.sel-checked {
      background: color-mix(in srgb, var(--accent) 10%, transparent);
    }
    #trackList.sel-mode .track-row * { pointer-events: none; }

    /* Flash feedback long-press */
    @keyframes _selFlash {
      0%   { background: transparent; }
      40%  { background: color-mix(in srgb, var(--accent) 22%, transparent); }
      100% { background: color-mix(in srgb, var(--accent) 10%, transparent); }
    }
    #trackList.sel-mode .track-row.sel-flash {
      animation: _selFlash 0.25s ease forwards;
    }

    /* ── Barre de sélection fixe en bas ── */
    #bulkSelBar {
      position: fixed;
      bottom: calc(-72px - env(safe-area-inset-bottom, 0px));
      left: 0; right: 0;
      background: var(--surface);
      border-top: 1px solid var(--border);
      padding: 10px 14px calc(10px + env(safe-area-inset-bottom, 0px));
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 210;
      transition: bottom 0.28s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 -6px 24px rgba(0,0,0,.18);
      gap: 8px;
    }
    #bulkSelBar.visible { bottom: 0; }
    #bulkSelCount {
      font-size: 13px; font-weight: 600;
      color: var(--text); white-space: nowrap; min-width: 80px;
    }
    .bsb-actions {
      display: flex; gap: 6px;
      align-items: center; flex-wrap: nowrap;
    }
    .bsb-btn {
      padding: 7px 13px; border-radius: 20px;
      border: 1px solid var(--border); background: var(--surface2);
      color: var(--text); font-size: 12.5px; font-weight: 500;
      cursor: pointer; white-space: nowrap;
      transition: opacity 0.15s;
      -webkit-tap-highlight-color: transparent;
      font-family: inherit;
    }
    .bsb-btn.accent {
      background: var(--accent); color: #fff;
      border-color: var(--accent); font-weight: 700;
    }
    .bsb-btn.close {
      background: transparent; border: none;
      font-size: 18px; padding: 4px 6px; color: var(--text2);
    }
    .bsb-btn:disabled { opacity: 0.35; cursor: default; }

    /* ── Panel bulk edit (bottom sheet) ── */
    #bulkEditPanel {
      position: fixed; inset: 0; z-index: 300;
      display: flex; flex-direction: column; justify-content: flex-end;
      opacity: 0; pointer-events: none;
      transition: opacity 0.22s;
    }
    #bulkEditPanel.visible { opacity: 1; pointer-events: all; }
    .bep-overlay {
      position: absolute; inset: 0;
      background: rgba(0,0,0,.52);
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
    }
    .bep-sheet {
      position: relative;
      background: var(--surface);
      border-radius: 22px 22px 0 0;
      max-height: 88vh;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      transform: translateY(100%);
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      padding-bottom: env(safe-area-inset-bottom, 0px);
    }
    #bulkEditPanel.visible .bep-sheet { transform: translateY(0); }

    .bep-handle {
      width: 36px; height: 4px;
      background: var(--border); border-radius: 2px;
      margin: 10px auto 0;
    }
    .bep-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 20px 12px;
      border-bottom: 1px solid var(--border);
    }
    .bep-title  { font-size: 15px; font-weight: 700; color: var(--text); }
    .bep-close  {
      background: var(--surface2); border: none;
      width: 28px; height: 28px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; cursor: pointer; color: var(--text2);
    }
    .bep-body   { padding: 16px 20px; display: flex; flex-direction: column; gap: 18px; }
    .bep-field  { display: flex; flex-direction: column; gap: 7px; }
    .bep-label  {
      font-size: 11px; font-weight: 700;
      letter-spacing: 0.6px; text-transform: uppercase; color: var(--text3);
    }
    .bep-input  {
      background: var(--surface2);
      border: 1.5px solid var(--border); border-radius: 11px;
      padding: 11px 13px; color: var(--text); font-size: 14px;
      width: 100%; box-sizing: border-box;
      transition: border-color 0.15s;
      -webkit-appearance: none; font-family: inherit;
    }
    .bep-input:focus        { outline: none; border-color: var(--accent); }
    .bep-input::placeholder { color: var(--text3); font-style: italic; }

    .bep-img-row {
      display: flex; gap: 12px; align-items: flex-start;
    }
    .bep-cover-prev {
      width: 60px; height: 60px; border-radius: 10px;
      background: var(--surface2);
      display: flex; align-items: center; justify-content: center;
      font-size: 22px; flex-shrink: 0; overflow: hidden;
      border: 1.5px solid var(--border);
    }
    .bep-cover-prev img { width: 100%; height: 100%; object-fit: cover; border-radius: 9px; }
    .bep-img-inputs {
      flex: 1; min-width: 0;
      display: flex; flex-direction: column; gap: 6px;
    }
    .bep-file-btn {
      padding: 7px 12px; border-radius: 9px;
      border: 1px solid var(--border); background: var(--surface2);
      color: var(--text2); font-size: 12px; cursor: pointer;
      text-align: center;
      -webkit-tap-highlight-color: transparent;
      font-family: inherit;
    }
    .bep-mixed-note {
      background: color-mix(in srgb, var(--accent) 8%, transparent);
      border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
      border-radius: 10px; padding: 9px 13px;
      font-size: 12px; color: var(--text2); line-height: 1.5;
    }
    .bep-footer {
      display: flex; gap: 10px;
      padding: 12px 20px 16px;
      border-top: 1px solid var(--border);
    }
    .bep-cancel {
      flex: 1; padding: 13px; border-radius: 13px;
      border: 1.5px solid var(--border); background: var(--surface2);
      color: var(--text); font-size: 14px; font-weight: 600;
      cursor: pointer; font-family: inherit;
    }
    .bep-save {
      flex: 2; padding: 13px; border-radius: 13px;
      border: none; background: var(--accent);
      color: #fff; font-size: 14px; font-weight: 700;
      cursor: pointer; transition: opacity 0.15s;
      font-family: inherit;
    }
    .bep-save:active { opacity: 0.85; }
  `;
  document.head.appendChild(s);
})();


/* ═══════════════════════════════════════════════════════════
   1. ÉTAT
═══════════════════════════════════════════════════════════ */

let _selMode  = false;
let _selected = new Set(); // Set<trackId>
let _lpTimer  = null;
let _lpMoved  = false;
let _lpStartX = 0;
let _lpStartY = 0;

const LP_MS             = 480; // durée long press (ms)
const LP_MOVE_THRESHOLD = 8;   // pixels — seuil d'annulation


/* ═══════════════════════════════════════════════════════════
   2. WRAP renderSongs — ré-applique l'UI de sélection
      après chaque re-render de la liste
═══════════════════════════════════════════════════════════ */

function _wrapRenderSongs() {
  const _orig = window.renderSongs;
  if (!_orig || _orig._bulkWrapped) return;
  window.renderSongs = function () {
    _orig.apply(this, arguments);
    if (_selMode) _bulkReapplyUI();
  };
  window.renderSongs._bulkWrapped = true;
}


/* ═══════════════════════════════════════════════════════════
   3. LISTENERS — event delegation sur #trackList
═══════════════════════════════════════════════════════════ */

function _initBulkListeners() {
  const list = document.getElementById('trackList');
  if (!list || list._bulkInited) return;
  list._bulkInited = true;

  /* Long press → entre en mode sélection */
  list.addEventListener('pointerdown', e => {
    const row = e.target.closest('.track-row');
    if (!row) return;
    _lpMoved = false;
    _lpStartX = e.clientX;
    _lpStartY = e.clientY;
    const id = parseInt(row.dataset.id);
    _lpTimer = setTimeout(() => {
      if (_lpMoved) return;
      if (!_selMode) _enterSelMode();
      _toggleSelect(id);
      navigator.vibrate?.(35);
      row.classList.add('sel-flash');
      setTimeout(() => row.classList.remove('sel-flash'), 280);
    }, LP_MS);
  }, { passive: true });

  list.addEventListener('pointermove', e => {
    if (_lpTimer === null) return;
    const dx = e.clientX - _lpStartX;
    const dy = e.clientY - _lpStartY;
    if (Math.sqrt(dx * dx + dy * dy) > LP_MOVE_THRESHOLD) {
      _lpMoved = true;
      clearTimeout(_lpTimer);
      _lpTimer = null;
    }
  }, { passive: true });

  const _cancelLp = () => { clearTimeout(_lpTimer); _lpTimer = null; };
  list.addEventListener('pointerup',     _cancelLp, { passive: true });
  list.addEventListener('pointercancel', _cancelLp, { passive: true });

  /* Bloque le menu contextuel natif Android pendant le long press */
  list.addEventListener('contextmenu', e => e.preventDefault(), { passive: false });

  /* Click en mode sélection : toggle au lieu de jouer
     Capture phase → intercepté avant l'onclick inline du row */
  list.addEventListener('click', e => {
    if (!_selMode) return;
    const row = e.target.closest('.track-row');
    if (!row) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    _toggleSelect(parseInt(row.dataset.id));
  }, true /* capture */);
}


/* ═══════════════════════════════════════════════════════════
   4. ENTER / EXIT MODE SÉLECTION
═══════════════════════════════════════════════════════════ */

function _enterSelMode() {
  _selMode = true;
  _selected.clear();
  document.getElementById('trackList')?.classList.add('sel-mode');
  _showSelBar();
}

function _exitSelMode() {
  _selMode = false;
  _selected.clear();
  document.getElementById('trackList')?.classList.remove('sel-mode');
  document.querySelectorAll('#trackList .track-row.sel-checked')
    .forEach(r => r.classList.remove('sel-checked'));
  _hideSelBar();
}


/* ═══════════════════════════════════════════════════════════
   5. SÉLECTION
═══════════════════════════════════════════════════════════ */

function _toggleSelect(id) {
  if (_selected.has(id)) _selected.delete(id);
  else                   _selected.add(id);
  document.querySelector(`#trackList .track-row[data-id="${id}"]`)
    ?.classList.toggle('sel-checked', _selected.has(id));
  _updateSelBar();
}

function _bulkSelectAll() {
  filtered.forEach(t => _selected.add(t.id));
  _bulkReapplyUI();
  _updateSelBar();
}

function _bulkDeselectAll() {
  _selected.clear();
  _bulkReapplyUI();
  _updateSelBar();
}

/* Ré-applique les classes après un renderSongs() */
function _bulkReapplyUI() {
  const list = document.getElementById('trackList');
  if (!list) return;
  list.classList.add('sel-mode');
  list.querySelectorAll('.track-row').forEach(row => {
    row.classList.toggle('sel-checked', _selected.has(parseInt(row.dataset.id)));
  });
}


/* ═══════════════════════════════════════════════════════════
   6. BARRE DE SÉLECTION (fixe en bas)
═══════════════════════════════════════════════════════════ */

function _showSelBar() {
  let bar = document.getElementById('bulkSelBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'bulkSelBar';
    bar.innerHTML = `
      <span id="bulkSelCount">0 sélectionné</span>
      <div class="bsb-actions">
        <button class="bsb-btn" onclick="_bulkSelectAll()">Tout</button>
        <button class="bsb-btn" onclick="_bulkDeselectAll()">Aucun</button>
        <button class="bsb-btn accent" id="bsbEditBtn" onclick="openBulkEditPanel()" disabled>✏️ Modifier</button>
        <button class="bsb-btn close" onclick="_exitSelMode()" title="Quitter">✕</button>
      </div>`;
    document.body.appendChild(bar);
  }
  requestAnimationFrame(() => bar.classList.add('visible'));
  _updateSelBar();
}

function _hideSelBar() {
  document.getElementById('bulkSelBar')?.classList.remove('visible');
}

function _updateSelBar() {
  const n   = _selected.size;
  const el  = document.getElementById('bulkSelCount');
  const btn = document.getElementById('bsbEditBtn');
  if (el)  el.textContent = `${n} sélectionné${n > 1 ? 's' : ''}`;
  if (btn) btn.disabled   = n === 0;
}


/* ═══════════════════════════════════════════════════════════
   7. PANEL D'ÉDITION EN MASSE (bottom sheet)
═══════════════════════════════════════════════════════════ */

function openBulkEditPanel() {
  if (!_selected.size) { toast('Sélectionne des pistes d\'abord', true); return; }

  const selTracks = tracks.filter(t => _selected.has(t.id));
  const uniq      = arr => [...new Set(arr)];
  const uAlbum    = uniq(selTracks.map(t => t.album  || ''));
  const uYear     = uniq(selTracks.map(t => t.year   || ''));
  const uGenre    = uniq(selTracks.map(t => t.genre  || ''));
  const uCovers   = uniq(selTracks.map(t => getCover(t.filename) || ''));

  const single  = arr => arr.length === 1 ? arr[0] : '';
  const phMixed = (arr, lbl) =>
    arr.length > 1 ? `${arr.length} valeurs · laisser vide = garder` : `ex: ${lbl}`;

  /* Crée le panel si besoin */
  let panel = document.getElementById('bulkEditPanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'bulkEditPanel';
    panel.innerHTML = `
      <div class="bep-overlay" onclick="closeBulkEditPanel()"></div>
      <div class="bep-sheet">
        <div class="bep-handle"></div>
        <div class="bep-header">
          <span class="bep-title" id="bepTitle">Édition en masse</span>
          <button class="bep-close" onclick="closeBulkEditPanel()">✕</button>
        </div>
        <div class="bep-body">
          <div class="bep-field">
            <label class="bep-label">🖼 Image (pochette)</label>
            <div class="bep-img-row">
              <div class="bep-cover-prev" id="bepCoverPrev">🖼</div>
              <div class="bep-img-inputs">
                <input id="bepCoverUrl" type="url" class="bep-input"
                       placeholder="https://… URL de l'image"
                       oninput="_onBepCoverUrlInput(this.value)">
                <input id="bepCoverFile" type="file" accept="image/*"
                       style="display:none" onchange="_onBepCoverFile(this)">
                <button class="bep-file-btn"
                        onclick="document.getElementById('bepCoverFile').click()">
                  📁 Choisir un fichier local
                </button>
              </div>
            </div>
          </div>
          <div class="bep-field">
            <label class="bep-label">💿 Album</label>
            <input id="bepAlbum" type="text" class="bep-input">
          </div>
          <div class="bep-field">
            <label class="bep-label">📅 Année</label>
            <input id="bepYear" type="text" class="bep-input"
                   maxlength="4" inputmode="numeric" pattern="[0-9]{4}">
          </div>
          <div class="bep-field">
            <label class="bep-label">🎸 Genre</label>
            <input id="bepGenre" type="text" class="bep-input">
          </div>
          <div class="bep-mixed-note" id="bepMixedNote">
            ℹ️ Les champs <strong>vides</strong> ne modifient rien.
            Les champs <strong>remplis</strong> s'appliquent à toutes les pistes sélectionnées.
          </div>
        </div>
        <div class="bep-footer">
          <button class="bep-cancel" onclick="closeBulkEditPanel()">Annuler</button>
          <button class="bep-save"   onclick="saveBulkEdit()">
            ✅ Appliquer · <span id="bepSaveCount">0</span> piste(s)
          </button>
        </div>
      </div>`;
    document.body.appendChild(panel);
  }

  document.getElementById('bepTitle').textContent =
    `Édition en masse — ${selTracks.length} piste${selTracks.length > 1 ? 's' : ''}`;
  document.getElementById('bepSaveCount').textContent = selTracks.length;

  const albumInput = document.getElementById('bepAlbum');
  albumInput.value       = single(uAlbum);
  albumInput.placeholder = phMixed(uAlbum, 'Mon album');

  const yearInput = document.getElementById('bepYear');
  yearInput.value       = single(uYear);
  yearInput.placeholder = phMixed(uYear, '2024');

  const genreInput = document.getElementById('bepGenre');
  genreInput.value       = single(uGenre);
  genreInput.placeholder = phMixed(uGenre, 'Pop, Hip-Hop…');

  const firstCover = single(uCovers);
  document.getElementById('bepCoverUrl').value = firstCover;
  _setBepCoverPreview(firstCover);

  const hasMixed = uAlbum.length > 1 || uYear.length > 1 || uGenre.length > 1 || uCovers.length > 1;
  document.getElementById('bepMixedNote').style.display = hasMixed ? '' : 'none';

  requestAnimationFrame(() => panel.classList.add('visible'));
}

function closeBulkEditPanel() {
  document.getElementById('bulkEditPanel')?.classList.remove('visible');
}

/* Préview pochette */
function _setBepCoverPreview(url) {
  const prev = document.getElementById('bepCoverPrev');
  if (!prev) return;
  if (url) {
    prev.innerHTML = `<img src="${url.startsWith('data:') ? url : esc(url)}"
      onerror="this.parentElement.innerHTML='?';this.parentElement.style.background='var(--surface2)';">`;
    prev.style.background = '';
  } else {
    prev.innerHTML = '🖼';
    prev.style.background = 'var(--surface2)';
  }
}

function _onBepCoverUrlInput(val) { _setBepCoverPreview(val.trim()); }

/* Fichier local → base64 */
function _onBepCoverFile(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const data = e.target.result;
    document.getElementById('bepCoverUrl').value = data;
    _setBepCoverPreview(data);
  };
  reader.readAsDataURL(file);
}


/* ═══════════════════════════════════════════════════════════
   8. SAUVEGARDE
═══════════════════════════════════════════════════════════ */

function saveBulkEdit() {
  const selTracks = tracks.filter(t => _selected.has(t.id));
  if (!selTracks.length) { toast('Aucune piste sélectionnée', true); return; }

  const coverVal = (document.getElementById('bepCoverUrl')?.value || '').trim();
  const albumVal = (document.getElementById('bepAlbum')?.value    || '').trim();
  const yearVal  = (document.getElementById('bepYear')?.value     || '').trim();
  const genreVal = (document.getElementById('bepGenre')?.value    || '').trim();

  if (!coverVal && !albumVal && !yearVal && !genreVal) {
    toast('Aucun champ rempli — rien à modifier', true);
    return;
  }

  const metaStore = getMeta();

  selTracks.forEach(t => {
    const merged = { ...(metaStore[t.filename] || {}) };
    if (albumVal) { merged.album = albumVal; t.album = albumVal; }
    if (yearVal)  { merged.year  = yearVal;  t.year  = yearVal;  }
    if (genreVal) { merged.genre = genreVal; t.genre = genreVal; }
    if (coverVal) { merged.cover = coverVal; }
    setTrackMeta(t.filename, merged);
    if (coverVal) refreshCoverForTrack(t.id, coverVal);
  });

  filtered = [...tracks];
  applySort();
  renderAll();
  closeBulkEditPanel();
  _exitSelMode();

  const parts = [];
  if (coverVal) parts.push('pochette');
  if (albumVal) parts.push('album');
  if (yearVal)  parts.push('année');
  if (genreVal) parts.push('genre');

  toast(`✅ ${selTracks.length} piste${selTracks.length > 1 ? 's' : ''} modifiée${selTracks.length > 1 ? 's' : ''} — ${parts.join(', ')}`);
}


/* ═══════════════════════════════════════════════════════════
   9. INIT
═══════════════════════════════════════════════════════════ */

function initBulkEdit() {
  _wrapRenderSongs();   // wrap renderSongs pour ré-appliquer l'UI de sélection
  _initBulkListeners(); // event delegation sur #trackList
}
