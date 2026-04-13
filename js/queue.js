/* ══════════════════════════════════════════════
   QUEUE PANEL - Arya v5
   File d'attente depuis le lecteur plein ecran
══════════════════════════════════════════════ */

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
      const btnUp   = i > 0
        ? '<button class="queue-act-btn" onclick="moveQueueItem(' + realIdx + ',-1)">↑</button>'
        : '<span class="queue-act-btn queue-act-disabled">↑</span>';
      const btnDown = i < upcoming.length - 1
        ? '<button class="queue-act-btn" onclick="moveQueueItem(' + realIdx + ',1)">↓</button>'
        : '<span class="queue-act-btn queue-act-disabled">↓</span>';
      const btnRm   = '<button class="queue-act-btn queue-remove-btn" onclick="removeFromQueue(' + realIdx + ')">✕</button>';
      parts.push(
        '<div class="queue-item" id="qi-' + realIdx + '">' +
          '<div class="queue-item-num">' + (i + 1) + '</div>' +
          '<div class="queue-item-art" style="' + bg + '">' + img + '</div>' +
          '<div class="queue-item-info" onclick="playQueueItem(' + realIdx + ')">' +
            '<div class="queue-item-title">' + esc(t.title) + '</div>' +
            '<div class="queue-item-sub">' + esc(t.artist) + '</div>' +
          '</div>' +
          '<div class="queue-item-actions">' + btnUp + btnDown + btnRm + '</div>' +
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

/* Patches */
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
