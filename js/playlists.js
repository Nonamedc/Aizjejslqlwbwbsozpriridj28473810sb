/* ══════════════════════════════════════════════
   PLAYLISTS
══════════════════════════════════════════════ */
const PLAYLIST_STORE = 'arya_playlists_v1';

function getPlaylists(){ try{ return JSON.parse(localStorage.getItem(PLAYLIST_STORE)||'{}'); }catch{ return {}; } }
function savePlaylists(pls){ localStorage.setItem(PLAYLIST_STORE, JSON.stringify(pls)); }

function createPlaylist(name){
  const pls = getPlaylists();
  const id = 'pl_' + Date.now();
  pls[id] = { id, name: name.trim(), tracks: [], created: Date.now() };
  savePlaylists(pls);
  return id;
}

function deletePlaylist(id){
  const pls = getPlaylists();
  delete pls[id];
  savePlaylists(pls);
}

function addToPlaylist(plId, filename){
  const pls = getPlaylists();
  if(!pls[plId]) return;
  if(!pls[plId].tracks.includes(filename)) pls[plId].tracks.push(filename);
  savePlaylists(pls);
}

function removeFromPlaylist(plId, filename){
  const pls = getPlaylists();
  if(!pls[plId]) return;
  pls[plId].tracks = pls[plId].tracks.filter(f => f !== filename);
  savePlaylists(pls);
}

function promptCreatePlaylist(){
  const name = prompt('Nom de la playlist :');
  if(!name || !name.trim()) return;
  createPlaylist(name.trim());
  renderPlaylists();
  toast('✅ Playlist "' + name.trim() + '" créée');
}

function renderPlaylists(){
  const pls = getPlaylists();
  const entries = Object.values(pls).sort((a,b) => b.created - a.created);
  const badge = document.getElementById('plBadge');
  const countEl = document.getElementById('plCount');
  if(badge){ badge.style.display = entries.length ? '' : 'none'; badge.textContent = entries.length; }
  if(countEl) countEl.textContent = entries.length + ' playlist' + (entries.length !== 1 ? 's' : '');
  const list = document.getElementById('playlistList');
  if(!list) return;
  if(!entries.length){
    list.innerHTML = '<div style="color:var(--text2);padding:60px;text-align:center;line-height:2;">📋<br>Aucune playlist<br><small style="color:var(--text3);">Créez votre première playlist ci-dessus</small></div>';
    return;
  }
  list.innerHTML = entries.map(pl => {
    const count = pl.tracks.length;
    const firstTrack = pl.tracks.map(fn => tracks.find(t => t.filename === fn)).find(Boolean);
    const cover = firstTrack ? getCover(firstTrack.filename) : null;
    const grad = firstTrack ? gradFor(firstTrack.artist + firstTrack.album) : 'linear-gradient(135deg,var(--accent),var(--rose))';
    return '<div class="playlist-card" onclick="openPlaylistDetail(\'' + pl.id + '\')">'
      + '<div class="playlist-card-art" style="' + (cover ? '' : 'background:' + grad) + '">'
      + (cover ? '<img src="' + esc(cover) + '" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" onerror="this.parentElement.style.background=\'' + grad + '\';this.remove();">' : '🎵')
      + '</div>'
      + '<div style="flex:1;min-width:0;">'
      + '<div class="playlist-card-name">' + esc(pl.name) + '</div>'
      + '<div class="playlist-card-sub">' + count + ' chanson' + (count !== 1 ? 's' : '') + '</div>'
      + '</div>'
      + '<button class="playlist-del-btn" onclick="event.stopPropagation();confirmDeletePlaylist(\'' + pl.id + '\',\'' + escAttr(pl.name) + '\')" title="Supprimer">🗑</button>'
      + '</div>';
  }).join('');
}

let _plDetailId = null;

function openPlaylistDetail(id){
  const pls = getPlaylists();
  const pl = pls[id];
  if(!pl) return;
  _plDetailId = id;
  const plTracks = pl.tracks.map(fn => tracks.find(t => t.filename === fn)).filter(Boolean);
  detailTracks = plTracks;
  prevView = 'playlists';

  document.getElementById('detailType').textContent = 'Playlist';
  document.getElementById('detailName').textContent = pl.name;
  document.getElementById('detailSub').textContent = plTracks.length + ' chanson' + (plTracks.length !== 1 ? 's' : '');
  // Affiche le bouton "Ajouter des titres" uniquement pour les playlists
  const addBtn = document.getElementById('detailAddBtn');
  if(addBtn) addBtn.style.display = '';
  const heroArt = document.getElementById('detailArt');
  heroArt.style.borderRadius = '12px';
  const firstCover = plTracks.map(t => getCover(t.filename)).find(Boolean);
  const grad = gradFor(pl.name);
  heroArt.style.background = firstCover ? '' : grad;
  heroArt.innerHTML = firstCover
    ? '<img src="' + esc(firstCover) + '" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" onerror="this.parentElement.style.background=\'' + grad + '\';this.remove();">'
    : '🎵';

  document.getElementById('detailList').innerHTML = plTracks.map((t, i) => {
    const faved = getFavs().has(t.filename);
    return '<div class="track-row detail-track-row' + (currentId === t.id ? ' playing' : '') + '" data-id="' + t.id + '" onclick="playDetailTrack(' + i + ')">'
      + '<div class="tr-num">' + (i+1) + '</div>'
      + '<div class="playing-bars"><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div></div>'
      + artDivHtml(t)
      + '<div class="tr-info"><div class="tr-title">' + esc(t.title) + '</div><div class="tr-artist-s">' + esc(t.artist) + '</div></div>'
      + '<div class="tr-artist">' + esc(t.artist) + '</div>'
      + '<div class="tr-dur"><span class="dur-val">' + fmtTime(t.length) + '</span>'
      + '<div class="tr-actions">'
      + '<button class="ico-btn fav-btn' + (faved ? ' active' : '') + '" data-tid="' + t.id + '" onclick="toggleFavById(' + t.id + ',event)" title="' + (faved ? 'Retirer' : 'Ajouter') + '">' + (faved ? '♥' : '♡') + '</button>'
      + '<button class="ico-btn" onclick="event.stopPropagation();removePlTrackAndRefresh(\'' + id + '\',\'' + escAttr(t.filename) + '\')" title="Retirer de la playlist" style="color:var(--rose);font-size:16px;">✕</button>'
      + '</div></div></div>';
  }).join('');

  showViewRaw('detail');
}

function removePlTrackAndRefresh(plId, filename){
  removeFromPlaylist(plId, filename);
  openPlaylistDetail(plId);
  toast('🗑 Retiré de la playlist');
}

function confirmDeletePlaylist(id, name){
  if(confirm('Supprimer la playlist "' + name + '" ?')){
    deletePlaylist(id);
    renderPlaylists();
    toast('🗑 Playlist supprimée');
  }
}

/* ── Track Picker — ajouter/retirer des titres depuis le détail d'une playlist ── */
let _tpPlId = null;

function openTrackPicker(plId){
  if(!plId) return;
  _tpPlId = plId;
  const pl = getPlaylists()[plId];
  if(!pl) return;
  document.getElementById('tpTitle').textContent = '➕ ' + pl.name;
  document.getElementById('tpSearch').value = '';
  _renderTrackPicker();
  document.getElementById('tpBackdrop').classList.add('open');
  document.getElementById('tpSheet').classList.add('open');
  history.pushState({ arya: 'tpSheet' }, '');
  setTimeout(() => document.getElementById('tpSearch')?.focus(), 350);
}

function closeTrackPicker(){
  const was = document.getElementById('tpSheet').classList.contains('open');
  document.getElementById('tpBackdrop').classList.remove('open');
  document.getElementById('tpSheet').classList.remove('open');
  if(was && history.state?.arya === 'tpSheet') history.back();
  // Rafraîchit le détail de la playlist pour refléter les changements
  if(_plDetailId) openPlaylistDetail(_plDetailId);
}

function _renderTrackPicker(){
  const pl = getPlaylists()[_tpPlId];
  if(!pl) return;
  const inPl = new Set(pl.tracks);
  const raw = document.getElementById('tpSearch')?.value || '';
  const q = _normSearch(raw);

  let list = [...tracks];
  if(q){
    const tokens = q.split(/\s+/).filter(Boolean);
    list = list.filter(t => {
      const fields = [_normSearch(t.title), _normSearch(t.artist), _normSearch(t.album)];
      return tokens.every(tok => fields.some(f => f.includes(tok)));
    });
  }

  // Titres déjà dans la playlist en premier, puis alpha
  list.sort((a, b) => {
    const aIn = inPl.has(a.filename) ? 0 : 1;
    const bIn = inPl.has(b.filename) ? 0 : 1;
    if(aIn !== bIn) return aIn - bIn;
    return a.title.localeCompare(b.title);
  });

  const inCount = pl.tracks.length;
  const countEl = document.getElementById('tpCount');
  if(countEl) countEl.textContent =
    inCount + ' titre' + (inCount !== 1 ? 's' : '') + ' dans la playlist'
    + (list.length !== tracks.length ? ' · ' + list.length + ' résultat' + (list.length !== 1 ? 's' : '') : '');

  document.getElementById('tpList').innerHTML = list.map(t => {
    const has = inPl.has(t.filename);
    const cover = getCover(t.filename);
    const grad = gradFor(t.artist + t.album);
    return '<div class="tp-row' + (has ? ' in-pl' : '') + '" onclick="toggleTrackInPicker(\'' + escAttr(t.filename) + '\')">'
      + '<div class="tp-row-art" style="' + (cover ? '' : 'background:' + grad) + '">'
      + (cover ? '<img src="' + esc(cover) + '" loading="lazy" onerror="this.parentElement.style.background=\'' + grad + '\';this.remove();">' : '🎵')
      + '</div>'
      + '<div class="tp-row-info">'
      + '<div class="tp-row-title">' + esc(t.title) + '</div>'
      + '<div class="tp-row-sub">' + esc(t.artist) + '</div>'
      + '</div>'
      + '<div class="tp-row-check">' + (has ? '✅' : '<span style="color:var(--accent);font-size:17px;font-weight:700;">＋</span>') + '</div>'
      + '</div>';
  }).join('');
}

function toggleTrackInPicker(filename){
  if(!_tpPlId) return;
  const pl = getPlaylists()[_tpPlId];
  if(!pl) return;
  if(pl.tracks.includes(filename)){
    removeFromPlaylist(_tpPlId, filename);
    toast('🗑 Retiré de la playlist');
  } else {
    addToPlaylist(_tpPlId, filename);
    toast('✅ Ajouté à la playlist');
  }
  _renderTrackPicker();
  // Met à jour le sous-titre du détail en live
  const newPl = getPlaylists()[_tpPlId];
  if(newPl){
    const subEl = document.getElementById('detailSub');
    if(subEl) subEl.textContent = newPl.tracks.length + ' chanson' + (newPl.tracks.length !== 1 ? 's' : '');
  }
}

/* ── Add-to-playlist sheet ── */
let _plSheetFilename = null;

function openAddToPlaylistSheet(filename, e){
  if(e) e.stopPropagation();
  _plSheetFilename = filename;
  _renderPlSheetList();
  document.getElementById('plSheetBackdrop').classList.add('open');
  document.getElementById('plSheet').classList.add('open');
  history.pushState({ arya: 'plSheet' }, '');
}

function closePlSheet(){
  const was = document.getElementById('plSheet').classList.contains('open');
  document.getElementById('plSheetBackdrop').classList.remove('open');
  document.getElementById('plSheet').classList.remove('open');
  if(was && history.state?.arya === 'plSheet') history.back();
}

function _renderPlSheetList(){
  const pls = getPlaylists();
  const entries = Object.values(pls).sort((a,b) => b.created - a.created);
  const list = document.getElementById('plSheetList');
  list.innerHTML = '<div class="pl-new-input-row">'
    + '<input class="form-input" id="plNewInput" placeholder="Nouvelle playlist…" style="flex:1;font-size:13.5px;" onkeydown="if(event.key===\'Enter\')plSheetCreateAndAdd()">'
    + '<button class="btn btn-acc" style="font-size:13px;padding:8px 14px;" onclick="plSheetCreateAndAdd()">＋ Créer</button>'
    + '</div>'
    + (entries.length
      ? entries.map(pl => {
          const already = pl.tracks.includes(_plSheetFilename);
          return '<div class="pl-sheet-item" onclick="plSheetAddTo(\'' + pl.id + '\')">'
            + '<div class="pl-sheet-item-ico">' + (already ? '✅' : '🎵') + '</div>'
            + '<div><div class="pl-sheet-item-name">' + esc(pl.name) + '</div>'
            + '<div class="pl-sheet-item-sub">' + pl.tracks.length + ' chanson' + (pl.tracks.length !== 1 ? 's' : '') + (already ? ' · déjà ajouté' : '') + '</div></div>'
            + '</div>';
        }).join('')
      : '<div style="color:var(--text3);font-size:13px;text-align:center;padding:20px 0;">Aucune playlist — créez-en une ci-dessus</div>');
}

function plSheetAddTo(plId){
  if(!_plSheetFilename) return;
  addToPlaylist(plId, _plSheetFilename);
  const pl = getPlaylists()[plId];
  toast('✅ Ajouté à "' + (pl?.name || 'playlist') + '"');
  _renderPlSheetList();
}

function plSheetCreateAndAdd(){
  const input = document.getElementById('plNewInput');
  const name = input?.value?.trim();
  if(!name){ toast('⚠️ Donnez un nom à la playlist', true); return; }
  const id = createPlaylist(name);
  if(_plSheetFilename) addToPlaylist(id, _plSheetFilename);
  toast('✅ Playlist "' + name + '" créée');
  closePlSheet();
  renderPlaylists();
}
