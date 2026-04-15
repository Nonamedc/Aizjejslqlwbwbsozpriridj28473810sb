/* ═══════════════════════════════════════════
   FAVORITES
═══════════════════════════════════════════ */
function getFavs(){ try{ return new Set(JSON.parse(localStorage.getItem(FAV_STORE)||'[]')); }catch{ return new Set(); } }
function saveFavs(s){ localStorage.setItem(FAV_STORE, JSON.stringify([...s])); }
function isFav(filename){ return getFavs().has(filename); }

function toggleFavById(id, e){
  if(e) e.stopPropagation();
  const t = tracks.find(x => x.id === id);
  if(!t) return;
  const s = getFavs();
  const adding = !s.has(t.filename);
  if(adding) s.add(t.filename); else s.delete(t.filename);
  saveFavs(s);
  // Update all fav buttons for this track
  document.querySelectorAll(`.fav-btn[data-tid="${id}"]`).forEach(btn => {
    btn.classList.toggle('active', adding);
    btn.title = adding ? 'Retirer des favoris' : 'Ajouter aux favoris';
    btn.textContent = adding ? '♥' : '♡';
  });
  updateFavBadge();
  renderFavorites();
  toast(adding ? '❤️ Ajouté aux favoris' : '💔 Retiré des favoris');
}

function updateFavBadge(){
  const count = getFavs().size;
  const badge = document.getElementById('favBadge');
  badge.style.display = count > 0 ? '' : 'none';
  badge.textContent = count;
}

function renderFavorites(){
  const favs = getFavs();
  const favTracks = tracks.filter(t => favs.has(t.filename));
  const count = document.getElementById('favCount');
  const list = document.getElementById('favList');
  count.textContent = `${favTracks.length} chanson${favTracks.length !== 1 ? 's' : ''}`;
  if(!favTracks.length){
    list.innerHTML = `<div style="color:var(--text2);padding:60px;text-align:center;line-height:2;">♡<br>Aucun favori pour l'instant<br><small style="color:var(--text3);">Survolez une chanson et cliquez ♡ pour l'ajouter</small></div>`;
    return;
  }
  list.innerHTML = favTracks.map((t,i) => `
    <div class="track-row${currentId===t.id?' playing':''}" data-id="${t.id}" onclick="playTrack(${t.id})">
      <div class="tr-num">${i+1}</div>
      <div class="playing-bars"><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div></div>
      ${artDivHtml(t)}
      <div class="tr-info">
        <div class="tr-title">${esc(t.title)}</div>
        <div class="tr-artist-s">${esc(t.artist)}</div>
      </div>
      <div class="tr-artist">${esc(t.artist)}</div>
      <div class="tr-album">${esc(t.album)}</div>
      <div class="tr-dur">
        <span class="dur-val">${fmtTime(t.length)}</span>
        <div class="tr-actions">
        </div>
      </div>
    </div>
  `).join('');
}

/* ═══════════════════════════════════════════
   HISTORY
═══════════════════════════════════════════ */
function getHistory(){ try{ return JSON.parse(localStorage.getItem(HIST_STORE)||'[]'); }catch{ return []; } }

function addToHistory(t){
  const h = getHistory();
  // Évite les doublons : même piste dans les 5 minutes (crossfade ou retry)
  if(h.length && h[0].filename === t.filename && (Date.now() - h[0].ts) < 300000) return;
  h.unshift({ filename:t.filename, title:t.title, artist:t.artist, album:t.album, id:t.id, ts:Date.now() });
  if(h.length > MAX_HIST) h.splice(MAX_HIST);
  localStorage.setItem(HIST_STORE, JSON.stringify(h));
}

function clearHistory(){
  localStorage.removeItem(HIST_STORE);
  renderHistory();
  toast('🗑 Historique effacé');
}

function renderHistory(){
  const h = getHistory();
  const count = document.getElementById('histCount');
  const list = document.getElementById('histList');
  count.textContent = `${h.length} écoute${h.length !== 1 ? 's' : ''}`;
  if(!h.length){
    list.innerHTML = `<div style="color:var(--text2);padding:60px;text-align:center;line-height:2;">🕐<br>Aucune écoute récente</div>`;
    return;
  }
  list.innerHTML = h.map((e, i) => {
    const t = tracks.find(x => x.filename === e.filename);
    const id = t ? t.id : -1;
    const hhmm = new Date(e.ts).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
    const cover = t ? getCover(t.filename) : null;
    const grad = gradFor(e.artist+e.album);
    return `
      <div class="track-row hist-track-row${currentId===id?' playing':''}" data-id="${id}" onclick="${id>=0?`playTrack(${id})`:''}">
        <div class="tr-num" style="font-size:11px;font-family:'JetBrains Mono',monospace;">${i+1}</div>
        <div class="playing-bars"><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div></div>
        <div class="tr-art" style="${cover?'':'background:'+grad};overflow:hidden;" data-art-id="${id}">
          ${cover?`<img src="${esc(cover)}" loading="lazy" onerror="this.parentElement.style.background='${grad}';this.remove();">`:'🎵'}
        </div>
        <div class="tr-info">
          <div class="tr-title">${esc(e.title)}</div>
          <div class="tr-artist-s">${esc(e.artist)}</div>
        </div>
        <div class="tr-artist">${esc(e.artist)}</div>
        <div class="tr-album" style="font-size:12px;color:var(--text3);">${relTime(e.ts)}</div>
        <div class="tr-dur"><span class="dur-val" style="color:var(--text3);font-size:11px;">${hhmm}</span></div>
      </div>
    `;
  }).join('');
}

/* ═══════════════════════════════════════════
   STATS
═══════════════════════════════════════════ */
function getStats(){ try{ return JSON.parse(localStorage.getItem(STATS_STORE)||'{}'); }catch{ return {}; } }
function saveStats(s){ localStorage.setItem(STATS_STORE, JSON.stringify(s)); }

function recordPlay(t){
  const s = getStats();
  if(!s[t.filename]) s[t.filename] = { title:t.title, artist:t.artist, plays:0, seconds:0 };
  s[t.filename].plays++;
  s[t.filename].title = t.title;
  s[t.filename].artist = t.artist;
  saveStats(s);
}

function flushStatAccum(){
  if(_statAccum <= 0 || currentId === null) return;
  const t = tracks.find(x => x.id === currentId);
  if(!t) return;
  const s = getStats();
  if(!s[t.filename]) s[t.filename] = { title:t.title, artist:t.artist, plays:0, seconds:0 };
  s[t.filename].seconds = (s[t.filename].seconds || 0) + _statAccum;
  saveStats(s);
  _statAccum = 0;
}

function renderStats(){
  const s = getStats();
  const entries = Object.entries(s).map(([fn, d]) => ({ ...d, filename:fn }));
  const totalSec = entries.reduce((a,e) => a + (e.seconds||0), 0);
  const totalPlays = entries.reduce((a,e) => a + (e.plays||0), 0);
  const topTracks = [...entries].sort((a,b) => b.plays - a.plays).slice(0, 10);
  const artistMap = {};
  entries.forEach(e => {
    if(!artistMap[e.artist]) artistMap[e.artist] = { plays:0, seconds:0 };
    artistMap[e.artist].plays += e.plays;
    artistMap[e.artist].seconds += e.seconds || 0;
  });
  const topArtists = Object.entries(artistMap).sort((a,b) => b[1].plays - a[1].plays).slice(0, 6);

  document.getElementById('statsSubtitle').textContent =
    totalPlays > 0 ? `${totalPlays} lecture${totalPlays>1?'s':''} · ${fmtDuration(totalSec)} au total` : '—';

  if(!totalPlays){
    document.getElementById('statsContent').innerHTML = `
      <div style="color:var(--text3);text-align:center;padding:80px 0;font-size:14px;line-height:2.2;">
        📊<br>Aucune statistique pour l'instant<br>
        <small>Les données apparaissent au fur et à mesure de vos écoutes</small>
      </div>`;
    return;
  }

  const maxPlays = topTracks[0]?.plays || 1;

  document.getElementById('statsContent').innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">🎵</div>
        <div class="stat-val">${totalPlays}</div>
        <div class="stat-label">lectures totales</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">⏱</div>
        <div class="stat-val">${fmtDuration(totalSec)}</div>
        <div class="stat-label">temps d'écoute</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🎤</div>
        <div class="stat-val">${topArtists.length}</div>
        <div class="stat-label">artistes écoutés</div>
      </div>
    </div>

    ${topTracks.length ? `
    <div style="margin-bottom:28px;">
      <div class="stats-section-label">🏆 Top morceaux</div>
      ${topTracks.map((t,i) => `
        <div class="top-track-row">
          <div style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text3);width:20px;text-align:center;flex-shrink:0;">${i+1}</div>
          <div class="top-bar-wrap">
            <div class="top-bar-title">${esc(t.title)}</div>
            <div class="top-bar-sub">${esc(t.artist)}${t.seconds?` · ${fmtDuration(t.seconds)}`:''}
            </div>
            <div class="top-bar-bg"><div class="top-bar-fill" style="width:${(t.plays/maxPlays*100).toFixed(0)}%"></div></div>
          </div>
          <div class="top-count">${t.plays}×</div>
        </div>
      `).join('')}
    </div>` : ''}

    ${topArtists.length ? `
    <div>
      <div class="stats-section-label">🎤 Top artistes</div>
      ${topArtists.map(([name, data]) => `
        <div class="top-artist-row">
          <div class="top-artist-av" style="background:${gradFor(name)}">🎤</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13.5px;font-weight:600;">${esc(name)}</div>
            <div style="font-size:11.5px;color:var(--text2);">${data.plays} lecture${data.plays>1?'s':''} · ${fmtDuration(data.seconds)}</div>
          </div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--accent);font-weight:700;">${data.plays}×</div>
        </div>
      `).join('')}
    </div>` : ''}
  `;
}
