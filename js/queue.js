/* ══════════════════════════════════════════════
   QUEUE PANEL - Mugiwara
   File d'attente depuis le lecteur plein ecran
══════════════════════════════════════════════ */

/* ─── Inject CSS drag & drop ─── */
(function _injectQueueStyles(){
  if(document.getElementById('queue-dnd-styles')) return;
  const s = document.createElement('style');
  s.id = 'queue-dnd-styles';
  s.textContent = `
    .queue-drag-handle {
      font-size:18px; color:rgba(255,255,255,.22);
      padding:6px 8px 6px 4px; cursor:grab;
      touch-action:none; user-select:none;
      line-height:1; flex-shrink:0;
      transition:color .15s;
    }
    .queue-drag-handle:active { cursor:grabbing; color:rgba(255,255,255,.6); }

    .queue-item-dragging {
      opacity:.2 !important;
    }
    .queue-item-drop-above {
      box-shadow: 0 -2px 0 0 var(--accent, #7c6af7);
      border-radius:4px 4px 0 0;
    }
    .queue-item-drop-below {
      box-shadow: 0 2px 0 0 var(--accent, #7c6af7);
      border-radius:0 0 4px 4px;
    }

    /* Clone flottant pendant le drag */
    .queue-drag-clone {
      position:fixed; z-index:9999;
      pointer-events:none;
      background:var(--surface2,#1e1e2e);
      border:1px solid rgba(255,255,255,.12);
      border-radius:10px;
      box-shadow:0 12px 40px rgba(0,0,0,.7);
      opacity:.95;
      transition:none !important;
    }
  `;
  document.head.appendChild(s);
})();

let _queueOpen = false;

function toggleQueuePanel() {
  if (_lyricsOpen) {
    _lyricsOpen = false;
    const lp = document.getElementById('fsLyricsPanel');
    const lb = document.getElementById('fsLyricsBtn');
    if (lp) lp.classList.remove('open');
    if (lb) lb.classList.remove('on');
  }
  _queueOpen = !_queueOpen;
  const panel = document.getElementById('fsQueuePanel');
  const btn   = document.getElementById('fsQueueBtn');
  if (panel) panel.classList.toggle('open', _queueOpen);
  if (btn)   btn.classList.toggle('on', _queueOpen);
  if (_queueOpen) renderQueuePanel();
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
  const parts    = [];

  parts.push(closeBtn);
  parts.push('<div class="queue-section-label">En cours</div>');

  const cur = queue[queueIdx];
  if (cur) {
    const cover = getCover(cur.filename);
    const grad  = gradFor(cur.artist + cur.album);
    const bg    = cover ? '' : 'background:' + grad;
    const img   = cover
      ? '<img src="' + esc(cover) + '" loading="lazy" onerror="this.parentElement.style.background=\'' + grad + '\';this.remove();">'
      : '🎵';
    parts.push(
      '<div class="queue-item queue-item-current">' +
        '<div class="queue-item-art" style="' + bg + '">' + img + '</div>' +
        '<div class="queue-item-info">' +
          '<div class="queue-item-title">' + esc(cur.title) + '</div>' +
          '<div class="queue-item-sub">' + esc(cur.artist) + '</div>' +
        '</div>' +
        '<div class="queue-item-badge">▶</div>' +
      '</div>'
    );
  }

  if (upcoming.length) {
    parts.push(
      '<div class="queue-section-label" style="margin-top:18px;">A suivre ' +
      '<span style="color:var(--text3);font-weight:400;">' + upcoming.length + '</span></div>'
    );
    upcoming.forEach(function(t, i) {
      const realIdx = queueIdx + 1 + i;
      const cover   = getCover(t.filename);
      const grad    = gradFor(t.artist + t.album);
      const bg      = cover ? '' : 'background:' + grad;
      const img     = cover
        ? '<img src="' + esc(cover) + '" loading="lazy" onerror="this.parentElement.style.background=\'' + grad + '\';this.remove();">'
        : '🎵';
      const btnRm   = '<button class="queue-act-btn queue-remove-btn" onclick="removeFromQueue(' + realIdx + ')">✕</button>';

      parts.push(
        '<div class="queue-item" id="qi-' + realIdx + '" data-idx="' + realIdx + '">' +
          /* ⠿ drag handle — remplace les boutons ↑↓ */
          '<span class="queue-drag-handle" title="Glisser pour réordonner">⠿</span>' +
          '<div class="queue-item-num">' + (i + 1) + '</div>' +
          '<div class="queue-item-art" style="' + bg + '">' + img + '</div>' +
          '<div class="queue-item-info" onclick="playQueueItem(' + realIdx + ')">' +
            '<div class="queue-item-title">' + esc(t.title) + '</div>' +
            '<div class="queue-item-sub">' + esc(t.artist) + '</div>' +
          '</div>' +
          '<div class="queue-item-actions">' + btnRm + '</div>' +
        '</div>'
      );
    });
    if (upcoming.length > 1) {
      parts.push('<button class="queue-clear-btn" onclick="clearUpcomingQueue()">🗑 Vider la suite</button>');
    }
  } else {
    parts.push('<div class="queue-upcoming-empty">Plus rien dans la file</div>');
  }

  if (played.length) {
    const lastPlayed = played.slice(-5).reverse();
    parts.push('<div class="queue-section-label queue-played-label">Deja joue</div>');
    lastPlayed.forEach(function(t, i) {
      const realIdx = queueIdx - 1 - i;
      const cover   = getCover(t.filename);
      const grad    = gradFor(t.artist + t.album);
      const bg      = cover ? '' : 'background:' + grad;
      const img     = cover
        ? '<img src="' + esc(cover) + '" loading="lazy" onerror="this.parentElement.style.background=\'' + grad + '\';this.remove();">'
        : '🎵';
      parts.push(
        '<div class="queue-item queue-item-played">' +
          '<div class="queue-item-art" style="' + bg + '">' + img + '</div>' +
          '<div class="queue-item-info" onclick="playQueueItem(' + realIdx + ')">' +
            '<div class="queue-item-title">' + esc(t.title) + '</div>' +
            '<div class="queue-item-sub">' + esc(t.artist) + '</div>' +
          '</div>' +
          '<button class="queue-act-btn" onclick="playQueueItem(' + realIdx + ')" style="color:rgba(255,255,255,.3);">▶</button>' +
        '</div>'
      );
    });
  }

  panel.innerHTML = parts.join('');

  // Active le drag & drop touch après chaque rendu
  _ensureQueueDragListeners();
}

function playQueueItem(idx) {
  if (idx < 0 || idx >= queue.length) return;
  queueIdx = idx;
  playFromQueue();
}

function moveQueueItem(idx, dir) {
  const newIdx = idx + dir;
  if (newIdx <= queueIdx || newIdx >= queue.length) return;
  const tmp = queue[idx]; queue[idx] = queue[newIdx]; queue[newIdx] = tmp;
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


/* ══════════════════════════════════════════════
   DRAG & DROP TOUCH — réordonnancement de la file
══════════════════════════════════════════════ */

let _qdDrag = null;          // état du drag en cours
let _qdListenersReady = false;

function _ensureQueueDragListeners() {
  if (_qdListenersReady) return;
  const panel = document.getElementById('fsQueuePanel');
  if (!panel) return;
  panel.addEventListener('touchstart',  _qdOnStart,  { passive: false });
  panel.addEventListener('touchmove',   _qdOnMove,   { passive: false });
  panel.addEventListener('touchend',    _qdOnEnd);
  panel.addEventListener('touchcancel', _qdOnEnd);
  _qdListenersReady = true;
}

function _qdOnStart(e) {
  const handle = e.target.closest('.queue-drag-handle');
  if (!handle) return;
  e.preventDefault();                         // empêche le scroll pendant le drag

  const item = handle.closest('.queue-item[data-idx]');
  if (!item) return;

  const idx   = parseInt(item.dataset.idx);
  const touch = e.touches[0];
  const rect  = item.getBoundingClientRect();

  // Clone visuel flottant
  const clone = item.cloneNode(true);
  clone.className += ' queue-drag-clone';
  Object.assign(clone.style, {
    left:  rect.left  + 'px',
    top:   rect.top   + 'px',
    width: rect.width + 'px',
  });
  document.body.appendChild(clone);

  item.classList.add('queue-item-dragging');
  if (navigator.vibrate) navigator.vibrate(20);

  _qdDrag = {
    idx,
    el: item,
    clone,
    startY:   touch.clientY,
    startTop: rect.top,
    targetIdx: null,
  };
}

function _qdOnMove(e) {
  if (!_qdDrag) return;
  e.preventDefault();

  const touch = e.touches[0];
  const dy    = touch.clientY - _qdDrag.startY;

  // Déplace le clone
  _qdDrag.clone.style.top = (_qdDrag.startTop + dy) + 'px';

  // Cherche la cible sous le doigt
  const panel = document.getElementById('fsQueuePanel');
  if (!panel) return;
  const items = [...panel.querySelectorAll('.queue-item[data-idx]')];
  const midY  = touch.clientY;
  let targetIdx = null;

  for (const it of items) {
    if (it === _qdDrag.el) continue;
    const r = it.getBoundingClientRect();
    if (midY >= r.top && midY <= r.bottom) {
      targetIdx = parseInt(it.dataset.idx);
      break;
    }
  }

  // Highlight
  items.forEach(it => it.classList.remove('queue-item-drop-above', 'queue-item-drop-below'));
  if (targetIdx !== null) {
    const targetEl = items.find(it => parseInt(it.dataset.idx) === targetIdx);
    if (targetEl) {
      targetEl.classList.add(
        targetIdx < _qdDrag.idx ? 'queue-item-drop-above' : 'queue-item-drop-below'
      );
    }
  }

  _qdDrag.targetIdx = targetIdx;
}

function _qdOnEnd() {
  if (!_qdDrag) return;
  const { idx, el, clone, targetIdx } = _qdDrag;
  _qdDrag = null;

  clone.remove();
  el.classList.remove('queue-item-dragging');

  const panel = document.getElementById('fsQueuePanel');
  if (panel) {
    panel.querySelectorAll('.queue-item').forEach(it =>
      it.classList.remove('queue-item-drop-above', 'queue-item-drop-below')
    );
  }

  if (targetIdx === null || targetIdx === idx) return;
  // Les deux indices sont > queueIdx (seuls les "à suivre" sont draggables)
  if (targetIdx <= queueIdx) return;

  // Déplace dans le tableau queue
  const item = queue[idx];
  queue.splice(idx, 1);
  const adjusted = targetIdx > idx ? targetIdx - 1 : targetIdx;
  queue.splice(adjusted, 0, item);

  // Met à jour le cache preload
  if      (_preloadedIdx === idx)                              _preloadedIdx = adjusted;
  else if (idx < _preloadedIdx && _preloadedIdx <= targetIdx) _preloadedIdx--;
  else if (targetIdx <= _preloadedIdx && _preloadedIdx < idx) _preloadedIdx++;

  if (navigator.vibrate) navigator.vibrate(15);
  renderQueuePanel();
}


/* ══════════════════════════════════════════════
   PATCHES
══════════════════════════════════════════════ */
const _origUpdateUIQueue = window.updatePlayerUI;
window.updatePlayerUI = function(t) {
  _origUpdateUIQueue(t);
  if (_queueOpen) renderQueuePanel();
};

const _origCloseFsQueue = window.closeFsPlayer;
window.closeFsPlayer = function() {
  if (_queueOpen) {
    _queueOpen = false;
    const p = document.getElementById('fsQueuePanel');
    const b = document.getElementById('fsQueueBtn');
    if (p) p.classList.remove('open');
    if (b) b.classList.remove('on');
  }
  _origCloseFsQueue();
};

const _origToggleLyricsQueue = window.toggleLyricsPanel;
window.toggleLyricsPanel = function() {
  if (_queueOpen && !_lyricsOpen) {
    _queueOpen = false;
    const p = document.getElementById('fsQueuePanel');
    const b = document.getElementById('fsQueueBtn');
    if (p) p.classList.remove('open');
    if (b) b.classList.remove('on');
  }
  _origToggleLyricsQueue();
};
