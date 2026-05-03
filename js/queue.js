/* ═══════════════════════════════════════════════════════════
   QUEUE.JS — Arya V2
   File d'attente depuis le lecteur plein écran.
   Drag & drop tactile pour réordonner.

   Dépend de : config.js, utils.js, covers.js,
               audio-engine.js, playback.js
═══════════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════════
   STYLES — Drag & Drop
═══════════════════════════════════════════════════════════ */

(function _injectQueueStyles() {
  if (document.getElementById('queue-dnd-styles')) return;
  const s = document.createElement('style');
  s.id = 'queue-dnd-styles';
  s.textContent = `
    .queue-drag-handle {
      font-size: 18px;
      color: rgba(255,255,255,.22);
      padding: 6px 8px 6px 4px;
      cursor: grab;
      touch-action: none;
      user-select: none;
      line-height: 1;
      flex-shrink: 0;
      transition: color .15s;
    }
    .queue-drag-handle:active { cursor: grabbing; color: rgba(255,255,255,.6); }

    .queue-item-dragging { opacity: .2 !important; }

    .queue-item-drop-above {
      box-shadow: 0 -2px 0 0 var(--accent, #7c6af7);
      border-radius: 4px 4px 0 0;
    }
    .queue-item-drop-below {
      box-shadow: 0 2px 0 0 var(--accent, #7c6af7);
      border-radius: 0 0 4px 4px;
    }

    .queue-drag-clone {
      position: fixed;
      z-index: 9999;
      pointer-events: none;
      background: var(--surface2, #1e1e2e);
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 10px;
      box-shadow: 0 12px 40px rgba(0,0,0,.7);
      opacity: .95;
      transition: none !important;
    }
  `;
  document.head.appendChild(s);
})();


/* ═══════════════════════════════════════════════════════════
   ÉTAT
═══════════════════════════════════════════════════════════ */

let _queueOpen        = false;
let _qdListenersReady = false;
let _qdDrag           = null; // état drag en cours


/* ═══════════════════════════════════════════════════════════
   PANEL — OUVERTURE / FERMETURE
═══════════════════════════════════════════════════════════ */

function toggleQueuePanel() {
  // Ferme les paroles si ouvertes
  if (_lyricsOpen) {
    _lyricsOpen = false;
    document.getElementById('fsLyricsPanel')?.classList.remove('open');
    document.getElementById('fsLyricsBtn')?.classList.remove('on');
  }

  _queueOpen = !_queueOpen;

  // Remet _qdListenersReady à false à la fermeture pour
  // que les listeners soient bien ré-attachés à la prochaine ouverture
  if (!_queueOpen) _qdListenersReady = false;

  document.getElementById('fsQueuePanel')?.classList.toggle('open', _queueOpen);
  document.getElementById('fsQueueBtn')?.classList.toggle('on', _queueOpen);

  if (_queueOpen) renderQueuePanel();
}


/* ═══════════════════════════════════════════════════════════
   RENDU
═══════════════════════════════════════════════════════════ */

/** Génère le div pochette d'un item de queue. */
function _queueArtHtml(t) {
  const cover = getCover(t.filename);
  const grad  = gradFor(t.artist + t.album);
  return `<div class="queue-item-art" style="${cover ? '' : 'background:' + grad}">
    ${cover
      ? `<img src="${esc(cover)}" loading="lazy" onerror="this.parentElement.style.background='${grad}';this.remove();">`
      : '🎵'}
  </div>`;
}

function renderQueuePanel() {
  const panel = document.getElementById('fsQueuePanel');
  if (!panel) return;

  const closeBtn = '<button class="lrc-close-btn" onclick="toggleQueuePanel()">✕</button>';

  if (!queue.length) {
    panel.innerHTML = closeBtn + '<div class="lrc-empty">File vide</div>';
    return;
  }

  const upcoming = queue.slice(queueIdx + 1);
  const played   = queue.slice(0, queueIdx);
  const cur      = queue[queueIdx];
  const parts    = [closeBtn];

  // Piste en cours
  parts.push('<div class="queue-section-label">En cours</div>');
  if (cur) {
    parts.push(`
      <div class="queue-item queue-item-current">
        ${_queueArtHtml(cur)}
        <div class="queue-item-info">
          <div class="queue-item-title">${esc(cur.title)}</div>
          <div class="queue-item-sub">${cur.feat ? `${esc(cur.artist)} feat. ${esc(cur.feat)}` : esc(cur.artist)}</div>
        </div>
        <div class="queue-item-badge">▶</div>
      </div>`);
  }

  // À suivre
  if (upcoming.length) {
    parts.push(`
      <div class="queue-section-label" style="margin-top:18px;">
        À suivre <span style="color:var(--text3);font-weight:400;">${upcoming.length}</span>
      </div>`);

    upcoming.forEach((t, i) => {
      const realIdx = queueIdx + 1 + i;
      parts.push(`
        <div class="queue-item" id="qi-${realIdx}" data-idx="${realIdx}">
          <span class="queue-drag-handle" title="Glisser pour réordonner">⠿</span>
          <div class="queue-item-num">${i + 1}</div>
          ${_queueArtHtml(t)}
          <div class="queue-item-info" onclick="playQueueItem(${realIdx})">
            <div class="queue-item-title">${esc(t.title)}</div>
            <div class="queue-item-sub">${t.feat ? `${esc(t.artist)} feat. ${esc(t.feat)}` : esc(t.artist)}</div>
          </div>
          <div class="queue-item-actions">
            <button class="queue-act-btn queue-remove-btn" onclick="removeFromQueue(${realIdx})">✕</button>
          </div>
        </div>`);
    });

    if (upcoming.length > 1) {
      parts.push('<button class="queue-clear-btn" onclick="clearUpcomingQueue()">🗑 Vider la suite</button>');
    }
  } else {
    parts.push('<div class="queue-upcoming-empty">Plus rien dans la file</div>');
  }

  // Déjà joué (5 dernières)
  if (played.length) {
    parts.push('<div class="queue-section-label queue-played-label">Déjà joué</div>');
    played.slice(-5).reverse().forEach((t, i) => {
      const realIdx = queueIdx - 1 - i;
      parts.push(`
        <div class="queue-item queue-item-played">
          ${_queueArtHtml(t)}
          <div class="queue-item-info" onclick="playQueueItem(${realIdx})">
            <div class="queue-item-title">${esc(t.title)}</div>
            <div class="queue-item-sub">${t.feat ? `${esc(t.artist)} feat. ${esc(t.feat)}` : esc(t.artist)}</div>
          </div>
          <button class="queue-act-btn" onclick="playQueueItem(${realIdx})"
                  style="color:rgba(255,255,255,.3);">▶</button>
        </div>`);
    });
  }

  panel.innerHTML = parts.join('');
  _ensureQueueDragListeners();
}


/* ═══════════════════════════════════════════════════════════
   ACTIONS
═══════════════════════════════════════════════════════════ */

function playQueueItem(idx) {
  if (idx < 0 || idx >= queue.length) return;
  queueIdx = idx;
  playFromQueue();
}

function moveQueueItem(idx, dir) {
  const newIdx = idx + dir;
  if (newIdx <= queueIdx || newIdx >= queue.length) return;
  [queue[idx], queue[newIdx]] = [queue[newIdx], queue[idx]];
  if (_preloadedIdx === idx)         _preloadedIdx = newIdx;
  else if (_preloadedIdx === newIdx) _preloadedIdx = idx;
  renderQueuePanel();
}

function removeFromQueue(idx) {
  if (idx <= queueIdx || idx >= queue.length) return;
  queue.splice(idx, 1);
  if (_preloadedIdx === idx)    _preloadedIdx = -1;
  else if (_preloadedIdx > idx) _preloadedIdx--;
  renderQueuePanel();
  toast('Retiré de la file');
}

function clearUpcomingQueue() {
  queue.splice(queueIdx + 1);
  _preloadedIdx = -1;
  renderQueuePanel();
  toast('🗑 File vidée');
}

function playNext(id) {
  const t = tracks.find(x => x.id === id);
  if (!t) return;
  const existing = queue.findIndex((x, i) => x.id === id && i > queueIdx);
  if (existing > queueIdx) {
    queue.splice(existing, 1);
    if (_preloadedIdx > existing) _preloadedIdx--;
  }
  queue.splice(queueIdx + 1, 0, t);
  if (_preloadedIdx > queueIdx) _preloadedIdx++;
  toast('▶ Suivant : ' + t.title);
  if (_queueOpen) renderQueuePanel();
}

function addToQueueEnd(id) {
  const t = tracks.find(x => x.id === id);
  if (!t) return;
  queue.push(t);
  toast('＋ Ajouté : ' + t.title);
  if (_queueOpen) renderQueuePanel();
}


/* ═══════════════════════════════════════════════════════════
   DRAG & DROP TACTILE
═══════════════════════════════════════════════════════════ */

function _ensureQueueDragListeners() {
  if (_qdListenersReady) return;
  const panel = document.getElementById('fsQueuePanel');
  if (!panel) return;
  panel.addEventListener('touchstart',  _qdOnStart, { passive: false });
  panel.addEventListener('touchmove',   _qdOnMove,  { passive: false });
  panel.addEventListener('touchend',    _qdOnEnd);
  panel.addEventListener('touchcancel', _qdOnEnd);
  _qdListenersReady = true;
}

function _qdOnStart(e) {
  const handle = e.target.closest('.queue-drag-handle');
  if (!handle) return;
  e.preventDefault();

  const item = handle.closest('.queue-item[data-idx]');
  if (!item) return;

  const idx   = parseInt(item.dataset.idx);
  const touch = e.touches[0];
  const rect  = item.getBoundingClientRect();

  const clone = item.cloneNode(true);
  clone.className += ' queue-drag-clone';
  Object.assign(clone.style, { left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px' });
  document.body.appendChild(clone);
  item.classList.add('queue-item-dragging');
  navigator.vibrate?.(20);

  _qdDrag = { idx, el: item, clone, startY: touch.clientY, startTop: rect.top, targetIdx: null };
}

function _qdOnMove(e) {
  if (!_qdDrag) return;
  e.preventDefault();

  const touch = e.touches[0];
  _qdDrag.clone.style.top = (_qdDrag.startTop + (touch.clientY - _qdDrag.startY)) + 'px';

  const panel = document.getElementById('fsQueuePanel');
  if (!panel) return;
  const items = [...panel.querySelectorAll('.queue-item[data-idx]')];
  let targetIdx = null;

  for (const it of items) {
    if (it === _qdDrag.el) continue;
    const r = it.getBoundingClientRect();
    if (touch.clientY >= r.top && touch.clientY <= r.bottom) { targetIdx = parseInt(it.dataset.idx); break; }
  }

  items.forEach(it => it.classList.remove('queue-item-drop-above', 'queue-item-drop-below'));
  if (targetIdx !== null) {
    items.find(it => parseInt(it.dataset.idx) === targetIdx)
      ?.classList.add(targetIdx < _qdDrag.idx ? 'queue-item-drop-above' : 'queue-item-drop-below');
  }
  _qdDrag.targetIdx = targetIdx;
}

function _qdOnEnd() {
  if (!_qdDrag) return;
  const { idx, el, clone, targetIdx } = _qdDrag;
  _qdDrag = null;

  clone.remove();
  el.classList.remove('queue-item-dragging');
  document.getElementById('fsQueuePanel')
    ?.querySelectorAll('.queue-item')
    .forEach(it => it.classList.remove('queue-item-drop-above', 'queue-item-drop-below'));

  if (targetIdx === null || targetIdx === idx || targetIdx <= queueIdx) return;

  const item     = queue[idx];
  queue.splice(idx, 1);
  const adjusted = targetIdx > idx ? targetIdx - 1 : targetIdx;
  queue.splice(adjusted, 0, item);

  if      (_preloadedIdx === idx)                              _preloadedIdx = adjusted;
  else if (idx < _preloadedIdx && _preloadedIdx <= targetIdx) _preloadedIdx--;
  else if (targetIdx <= _preloadedIdx && _preloadedIdx < idx) _preloadedIdx++;

  navigator.vibrate?.(15);
  renderQueuePanel();
}


/* ═══════════════════════════════════════════════════════════
   PATCHES — différés après chargement complet de tous les scripts
═══════════════════════════════════════════════════════════ */

(function _initQueuePatches() {
  function _apply() {
    /* Patch updatePlayerUI */
    const origUI = window.updatePlayerUI;
    if (typeof origUI === 'function') {
      window.updatePlayerUI = function (t) {
        origUI(t);
        if (_queueOpen) renderQueuePanel();
      };
    }

    /* Patch closeFsPlayer */
    const origClose = window.closeFsPlayer;
    if (typeof origClose === 'function') {
      window.closeFsPlayer = function () {
        if (_queueOpen) {
          _queueOpen = _qdListenersReady = false;
          document.getElementById('fsQueuePanel')?.classList.remove('open');
          document.getElementById('fsQueueBtn')?.classList.remove('on');
        }
        origClose();
      };
    }

    /* Patch toggleLyricsPanel */
    const origLyrics = window.toggleLyricsPanel;
    if (typeof origLyrics === 'function') {
      window.toggleLyricsPanel = function () {
        if (_queueOpen && !_lyricsOpen) {
          _queueOpen = _qdListenersReady = false;
          document.getElementById('fsQueuePanel')?.classList.remove('open');
          document.getElementById('fsQueueBtn')?.classList.remove('on');
        }
        origLyrics();
      };
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _apply);
  } else {
    _apply();
  }
})();
