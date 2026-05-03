/* ═══════════════════════════════════════════════════════════
   RENDER.JS — Arya
   Rendu des vues : chansons, albums, artistes, détail,
   éditeur de métadonnées, tri et recherche.

   Dépend de : config.js, utils.js, covers.js,
               library.js, parental.js, playback.js
═══════════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════════
   HELPER — ARTISTE + FEAT (cliquables)
═══════════════════════════════════════════════════════════ */

/* Styles pour les liens d'artistes cliquables */
(function _injectFeatStyles() {
  if (document.getElementById('feat-styles')) return;
  const s = document.createElement('style');
  s.id = 'feat-styles';
  s.textContent = `
    .artist-link {
      cursor: pointer;
      color: inherit;
      transition: color .15s, opacity .15s;
      border-radius: 3px;
      padding: 1px 0;
    }
    .artist-link:hover  { color: var(--accent, #d4a054); text-decoration: underline; }
    .artist-link:active { opacity: .7; }
    .feat-label {
      color: var(--text3, #666);
      font-size: .88em;
      font-weight: 400;
      margin: 0 1px;
    }
  `;
  document.head.appendChild(s);
})();

/**
 * Découpe une chaîne de featurings en tableau de noms.
 * Séparateurs supportés : virgule, &, and, et, x (entre espaces)
 */
function parseFeatArtists(feat) {
  if (!feat) return [];
  return feat.split(/\s*,\s*|\s+(?:&|and|et|x)\s+/i).map(s => s.trim()).filter(Boolean);
}

/** Retourne un <span> cliquable qui ouvre la page de l'artiste. */
function _artistLink(name) {
  return `<span class="artist-link" onclick="event.stopPropagation();showDetail('artist','${escAttr(name)}')">${esc(name)}</span>`;
}

/**
 * Retourne le HTML "Artiste feat. X, Y" avec chaque nom cliquable.
 * Si aucun feat, retourne juste le lien de l'artiste principal.
 */
function artistFeatHtml(t) {
  const mainLink = _artistLink(t.artist);
  if (!t.feat) return mainLink;
  const featLinks = parseFeatArtists(t.feat).map(_artistLink).join(', ');
  return `${mainLink} <span class="feat-label">feat.</span> ${featLinks}`;
}


/* ═══════════════════════════════════════════════════════════
   RENDER ALL
═══════════════════════════════════════════════════════════ */

function renderAll() {
  renderSongs();
  renderAlbums();
  renderArtists();
  renderEdList();
  renderFavorites();
  renderHistory();
  renderDashboard();
  initBulkEdit();
  if (typeof renderPlaylists === 'function') renderPlaylists();
}


/* ═══════════════════════════════════════════════════════════
   CHANSONS
═══════════════════════════════════════════════════════════ */

function renderSongs() {
  const list  = document.getElementById('trackList');
  const songs = ParentalControl.filterTracks(filtered);

  if (!songs.length) {
    list.innerHTML = `<div style="color:var(--text2);padding:48px;text-align:center;">Aucune chanson trouvée</div>`;
    return;
  }

  const favs = getFavs();
  list.innerHTML = songs.map((t, i) => {
    const sub = sortField === 'genre'
      ? (t.genre ? `${esc(t.genre)} · ${artistFeatHtml(t)}` : artistFeatHtml(t))
      : sortField === 'year'
        ? (t.year ? `${artistFeatHtml(t)} · ${t.year}` : artistFeatHtml(t))
        : artistFeatHtml(t);
    const faved = favs.has(t.filename);
    return `
      <div class="track-row${currentId === t.id ? ' playing' : ''}" data-id="${t.id}" onclick="playTrack(${t.id})">
        <div class="tr-num">${i + 1}</div>
        <div class="playing-bars"><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div></div>
        ${artDivHtml(t)}
        <div class="tr-info">
          <div class="tr-title">${esc(t.title)}</div>
          <div class="tr-artist-s">${sub}</div>
        </div>
        <div class="tr-album">${sortField === 'genre' ? esc(t.genre || '—') : esc(t.album)}</div>
        <div class="tr-dur">
          <span class="dur-val">${fmtTime(t.length)}</span>
          <div class="tr-actions">
            <button class="ico-btn fav-btn${faved ? ' active' : ''}" data-tid="${t.id}"
                    onclick="toggleFavById(${t.id}, event)"
                    title="${faved ? 'Retirer des favoris' : 'Ajouter aux favoris'}">${faved ? '♥' : '♡'}</button>
          </div>
        </div>
      </div>`;
  }).join('');
}


/* ═══════════════════════════════════════════════════════════
   ALBUMS
═══════════════════════════════════════════════════════════ */

function getAlbums() {
  const map = {};
  ParentalControl.filterTracks(tracks).forEach(t => {
    if (!map[t.album]) map[t.album] = { name: t.album, artist: t.artist, count: 0, tracks: [] };
    map[t.album].count++;
    map[t.album].tracks.push(t);
  });
  return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
}

function renderAlbums() {
  const grid = document.getElementById('albumGrid');
  if (!grid) return;
  grid.innerHTML = getAlbums().map(a => `
    <div class="g-card" data-aname="${esc(a.name)}" data-atype="album" onclick="showDetailFromEl(this)">
      <div class="g-art-wrap">
        ${albumArtDivHtml(a.tracks)}
        <button class="g-play-btn" onclick="event.stopPropagation();playAlbumCard(this)" data-aname="${esc(a.name)}" aria-label="Lire">▶</button>
      </div>
      <div class="g-name">${esc(a.name)}</div>
      <div class="g-sub">${esc(a.artist)} · ${a.count} titre${a.count > 1 ? 's' : ''}</div>
    </div>`).join('');
}


/* ═══════════════════════════════════════════════════════════
   ARTISTES
═══════════════════════════════════════════════════════════ */

function getArtists() {
  const map = {};
  ParentalControl.filterTracks(tracks).forEach(t => {
    if (!map[t.artist]) map[t.artist] = { name: t.artist, albums: new Set(), tracks: [] };
    map[t.artist].albums.add(t.album);
    map[t.artist].tracks.push(t);
  });
  return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
}

function renderArtists() {
  const grid = document.getElementById('artistGrid');
  if (!grid) return;
  grid.innerHTML = getArtists().map(a => `
    <div class="g-card g-artist" data-aname="${esc(a.name)}" data-atype="artist" onclick="showDetailFromEl(this)">
      <div class="g-art-wrap g-artist-wrap">
        ${artistArtDivHtml(a.name)}
        <button class="g-play-btn g-play-circle" onclick="event.stopPropagation();playArtistCard(this)" data-aname="${esc(a.name)}" aria-label="Lire">▶</button>
      </div>
      <div class="g-name">${esc(a.name)}</div>
      <div class="g-sub">${a.albums.size} album${a.albums.size > 1 ? 's' : ''} · ${a.tracks.length} titre${a.tracks.length > 1 ? 's' : ''}</div>
    </div>`).join('');
}

function showDetailFromEl(el) {
  showDetail(el.dataset.atype, el.dataset.aname);
}
function playAlbumCard(btn) {
  const name   = btn.dataset.aname;
  const album  = getAlbums().find(a => a.name === name);
  if (!album || !album.tracks.length) return;
  const first  = album.tracks[0];
  // Set queue to album tracks then play first
  queue    = filterAllTracks([...album.tracks]);
  queueIdx = 0;
  playTrack(first.id);
}

function playArtistCard(btn) {
  const name   = btn.dataset.aname;
  const artist = getArtists().find(a => a.name === name);
  if (!artist || !artist.tracks.length) return;
  queue    = filterAllTracks([...artist.tracks]);
  queueIdx = 0;
  playTrack(artist.tracks[0].id);
}



/* ═══════════════════════════════════════════════════════════
   VUE DÉTAIL (album ou artiste)
═══════════════════════════════════════════════════════════ */

function showDetail(type, name) {
  prevView    = document.querySelector('.nav-item.active')?.dataset?.view || 'songs';
  _plDetailId = null;

  const addBtn = document.getElementById('detailAddBtn');
  if (addBtn) addBtn.style.display = 'none';

  const detailFiltered = filterAllTracks(
    type === 'album'
      ? tracks.filter(t => t.album === name)
      : tracks.filter(t => t.artist === name || parseFeatArtists(t.feat).includes(name))
  );
  detailTracks = detailFiltered;

  document.getElementById('detailType').textContent = type === 'album' ? 'Album' : 'Artiste';
  document.getElementById('detailName').textContent = name;

  // Hero art
  const heroArt = document.getElementById('detailArt');
  heroArt.style.borderRadius = type === 'artist' ? '50%' : '12px';
  const grad = gradFor(name);

  if (type === 'album') {
    const cover = detailFiltered[0] ? getCover(detailFiltered[0].filename) : null;
    heroArt.style.background = cover ? '' : grad;
    heroArt.innerHTML = cover
      ? `<img src="${esc(cover)}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" onerror="this.parentElement.style.background='${grad}';this.remove();">`
      : '💿';
  } else {
    const img = getArtistImg(name);
    heroArt.style.background = img ? '' : grad;
    heroArt.innerHTML = img
      ? `<img src="${esc(img)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.parentElement.style.background='${grad}';this.remove();">`
      : '🎤';
  }

  // Sous-titre
  if (type === 'album') {
    const artist = detailFiltered[0]?.artist || '';
    document.getElementById('detailSub').textContent =
      `${artist} · ${detailFiltered.length} titre${detailFiltered.length > 1 ? 's' : ''}`;
  } else {
    const albs = [...new Set(detailFiltered.map(t => t.album))];
    document.getElementById('detailSub').textContent =
      `${albs.length} album${albs.length > 1 ? 's' : ''} · ${detailFiltered.length} titre${detailFiltered.length > 1 ? 's' : ''}`;
  }

  // Liste des pistes
  const favs = getFavs();
  document.getElementById('detailList').innerHTML = detailFiltered.map((t, i) => {
    const faved = favs.has(t.filename);
    const sub   = type === 'album' ? artistFeatHtml(t) : esc(t.album);
    return `
      <div class="track-row detail-track-row${currentId === t.id ? ' playing' : ''}" data-id="${t.id}" onclick="playDetailTrack(${i})">
        <div class="tr-num">${i + 1}</div>
        <div class="playing-bars"><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div></div>
        ${artDivHtml(t)}
        <div class="tr-info">
          <div class="tr-title">${esc(t.title)}</div>
          <div class="tr-artist-s">${sub}</div>
        </div>
        <div class="tr-dur">
          <span class="dur-val">${fmtTime(t.length)}</span>
          <div class="tr-actions">
            <button class="ico-btn fav-btn${faved ? ' active' : ''}" data-tid="${t.id}"
                    onclick="toggleFavById(${t.id}, event)"
                    title="${faved ? 'Retirer' : 'Ajouter'}">${faved ? '♥' : '♡'}</button>
          </div>
        </div>
      </div>`;
  }).join('');

  showViewRaw('detail');
}

function goBack()          { showView(prevView); }
function playDetailAll()   { if (!detailTracks.length) return; queue = [...detailTracks];              queueIdx = 0; playFromQueue(); }
function shuffleDetailAll(){ if (!detailTracks.length) return; queue = shuffleArr([...detailTracks]); queueIdx = 0; playFromQueue(); }
function playDetailTrack(i){ queue = [...detailTracks]; queueIdx = i; playFromQueue(); }

function playAllSongs()    { const f = ParentalControl.filterTracks(filtered);                              if (!f.length) return; queue = [...f];              queueIdx = 0; playFromQueue(); }
function shuffleAllSongs() { const f = ParentalControl.filterTracks(filtered);                              if (!f.length) return; queue = shuffleArr([...f]); queueIdx = 0; playFromQueue(); }
function playAllFavs()     { const f = ParentalControl.filterTracks(tracks.filter(t => getFavs().has(t.filename))); if (!f.length) return; queue = [...f];              queueIdx = 0; playFromQueue(); }
function shuffleAllFavs()  { const f = ParentalControl.filterTracks(tracks.filter(t => getFavs().has(t.filename))); if (!f.length) return; queue = shuffleArr([...f]); queueIdx = 0; playFromQueue(); }


/* ═══════════════════════════════════════════════════════════
   ÉDITEUR DE MÉTADONNÉES
═══════════════════════════════════════════════════════════ */

function renderEdList() {
  const edList = document.getElementById('edList');
  if (!edList) return;
  edList.innerHTML = tracks.map(t => {
    const cover = getCover(t.filename);
    const grad  = gradFor(t.artist + t.album);
    return `
      <div class="ed-row${edTrack && edTrack.id === t.id ? ' selected' : ''}" data-id="${t.id}" onclick="selectEdTrack(${t.id})">
        <div class="tr-art" style="${cover ? '' : 'background:' + grad};width:36px;height:36px;border-radius:6px;font-size:14px;overflow:hidden;">
          ${cover ? `<img src="${esc(cover)}" style="width:100%;height:100%;object-fit:cover;border-radius:6px;" onerror="this.parentElement.style.background='${grad}';this.remove();">` : '🎵'}
        </div>
        <div class="tr-info">
          <div class="tr-title" style="font-size:13px;">${esc(t.title)}</div>
          <div class="tr-artist-s">${artistFeatHtml(t)}</div>
        </div>
      </div>`;
  }).join('');
}

function openEditor(id) {
  selectEdTrack(id);
  showView('editor');
}

function selectEdTrack(id) {
  edTrack = tracks.find(t => t.id === id);
  if (!edTrack) return;

  document.getElementById('ed-title').value  = edTrack.title;
  document.getElementById('ed-artist').value = edTrack.artist;
  document.getElementById('ed-feat').value   = edTrack.feat || '';
  document.getElementById('ed-album').value  = edTrack.album;
  document.getElementById('ed-year').value   = edTrack.year;
  document.getElementById('ed-genre').value  = edTrack.genre;
  document.getElementById('ed-file').value   = edTrack.filename;
  document.getElementById('ed-deezer').value = edTrack.deezerUrl || '';

  const cover = getCover(edTrack.filename);
  const grad  = gradFor(edTrack.artist + edTrack.album);
  const prev  = document.getElementById('ed-cover-preview');
  if (prev) {
    prev.style.background = cover ? '' : grad;
    prev.innerHTML = cover
      ? `<img src="${esc(cover)}" onerror="this.parentElement.style.background='${grad}';this.remove();">`
      : '🎵';
  }

  const coverInput = document.getElementById('ed-cover');
  if (coverInput) coverInput.value = cover || '';

  document.getElementById('edFormLabel').textContent  = `Éditer : ${edTrack.title}`;
  document.getElementById('edPlaceholder').style.display = 'none';
  document.getElementById('edForm').style.display        = 'block';
  document.querySelectorAll('.ed-row').forEach(r =>
    r.classList.toggle('selected', parseInt(r.dataset.id) === id)
  );
}

function saveEdMeta() {
  if (!edTrack) return;
  const coverVal  = (document.getElementById('ed-cover')?.value  || '').trim();
  const deezerVal = (document.getElementById('ed-deezer')?.value || '').trim();

  const d = {
    title:  document.getElementById('ed-title').value.trim()  || edTrack.title,
    artist: document.getElementById('ed-artist').value.trim() || edTrack.artist,
    feat:   document.getElementById('ed-feat')?.value.trim()  ?? (edTrack.feat || ''),
    album:  document.getElementById('ed-album').value.trim()  || edTrack.album,
    year:   document.getElementById('ed-year').value.trim(),
    genre:  document.getElementById('ed-genre').value.trim(),
    ...(coverVal  ? { cover:     coverVal  } : {}),
    ...(deezerVal ? { deezerUrl: deezerVal } : { deezerUrl: '' }),
  };

  setTrackMeta(edTrack.filename, d);
  const t = tracks.find(x => x.id === edTrack.id);
  Object.assign(t, d);
  if (deezerVal) t.deezerUrl = deezerVal; else delete t.deezerUrl;
  edTrack = t;

  if (coverVal) refreshCoverForTrack(edTrack.id, coverVal);
  if (typeof Sync !== 'undefined') Sync.pushMeta();
  filtered = ParentalControl.filterTracks([...tracks]);
  applySort();
  renderAll();
  if (currentId === edTrack.id) updatePlayerUI(t);
  toast(deezerVal ? '✅ Sauvegardé · Source : Deezer 🎵' : '✅ Métadonnées sauvegardées');
}

function resetEdMeta() {
  if (!edTrack) return;
  clearTrackMeta(edTrack.filename);
  const parsed = parseFilename(edTrack.filename);
  const t      = tracks.find(x => x.id === edTrack.id);
  Object.assign(t, parsed);
  edTrack = t;
  filtered = ParentalControl.filterTracks([...tracks]);
  applySort();
  renderAll();
  selectEdTrack(edTrack.id);
  if (currentId === edTrack.id) updatePlayerUI(t);
  toast('↺ Métadonnées réinitialisées');
}


/* ═══════════════════════════════════════════════════════════
   TRI
═══════════════════════════════════════════════════════════ */

function sortBy(field, btn) {
  sortDir   = sortField === field ? sortDir * -1 : 1;
  sortField = field;

  document.querySelectorAll('.sort-pill').forEach(b => {
    b.classList.remove('active');
    b.querySelector('.pill-dir')?.remove();
  });

  if (btn) {
    btn.classList.add('active');
    const arrow = document.createElement('span');
    arrow.className   = 'pill-dir';
    arrow.textContent = sortDir === 1 ? ' ↑' : ' ↓';
    btn.appendChild(arrow);
  }

  applySort();
  renderSongs();
}

function applySort() {
  filtered.sort((a, b) => {
    if (sortField === 'year' || sortField === 'length') {
      return ((parseFloat(a[sortField]) || 0) - (parseFloat(b[sortField]) || 0)) * sortDir;
    }
    return String(a[sortField] || '').toLowerCase()
      .localeCompare(String(b[sortField] || '').toLowerCase()) * sortDir;
  });
}


/* ═══════════════════════════════════════════════════════════
   RECHERCHE
═══════════════════════════════════════════════════════════ */

/** Normalise une chaîne pour la recherche (accents, casse, ponctuation). */
/* _normSearch — défini dans utils.js (chargé en premier) */

function onSearch() {
  const raw    = document.getElementById('searchInput').value;
  const q      = _normSearch(raw);
  const tokens = q.split(/\s+/).filter(Boolean);

  if (q) showViewRaw('songs');

  filtered = q
    ? filterAllTracks(tracks.filter(t => {
        const fields = [t.title, t.artist, t.feat, t.album, t.genre, t.year].map(_normSearch);
        return tokens.every(tok => fields.some(f => f.includes(tok)));
      }))
    : filterAllTracks([...tracks]);

  applySort();
  renderSongs();

  const sub = document.getElementById('songCount');
  if (sub) {
    sub.textContent = q && filtered.length !== tracks.length
      ? `${filtered.length} résultat${filtered.length > 1 ? 's' : ''} pour « ${raw} »`
      : `${tracks.length} chanson${tracks.length > 1 ? 's' : ''}`;
  }
}
