/* ═══════════════════════════════════════════
   RENDER ALL
═══════════════════════════════════════════ */
function renderAll(){
  renderSongs();
  renderAlbums();
  renderArtists();
  renderEdList();
  renderFavorites();
  renderHistory();
  renderDashboard();
  if(typeof renderPlaylists === 'function') renderPlaylists();
}

/* ─── SONGS ─── */
function renderSongs(){
  const list=document.getElementById('trackList');
  if(!filtered.length){
    list.innerHTML=`<div style="color:var(--text2);padding:48px;text-align:center;">Aucune chanson trouvée</div>`;
    return;
  }
  const favs = getFavs();
  list.innerHTML=filtered.map((t,i)=>{
    const sub=sortField==='genre'?(t.genre?`${esc(t.genre)} · ${esc(t.artist)}`:esc(t.artist)):
              sortField==='year'?(t.year?`${esc(t.artist)} · ${t.year}`:esc(t.artist)):
              esc(t.artist);
    const faved = favs.has(t.filename);
    return `
    <div class="track-row${currentId===t.id?' playing':''}" data-id="${t.id}" onclick="playTrack(${t.id})">
      <div class="tr-num">${i+1}</div>
      <div class="playing-bars"><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div></div>
      ${artDivHtml(t)}
      <div class="tr-info">
        <div class="tr-title">${esc(t.title)}</div>
        <div class="tr-artist-s">${sub}</div>
      </div>
      <div class="tr-artist">${esc(t.artist)}</div>
      <div class="tr-album">${sortField==='genre'?esc(t.genre||'—'):esc(t.album)}</div>
      <div class="tr-dur">
        <span class="dur-val">${fmtTime(t.length)}</span>
        <div class="tr-actions">
          <button class="ico-btn fav-btn${faved?' active':''}" data-tid="${t.id}" onclick="toggleFavById(${t.id},event)" title="${faved?'Retirer des favoris':'Ajouter aux favoris'}">${faved?'♥':'♡'}</button>
          <button class="ico-btn" onclick="openAddToPlaylistSheet('${escAttr(t.filename)}',event)" title="Ajouter à une playlist">＋</button>
          <button class="ico-btn edit" onclick="event.stopPropagation();openEditor(${t.id})" title="Éditer">✏️</button>
        </div>
      </div>
    </div>
  `}).join('');
}

/* ─── ALBUMS ─── */
function getAlbums(){
  const map={};
  tracks.forEach(t=>{
    if(!map[t.album]) map[t.album]={name:t.album,artist:t.artist,count:0,tracks:[]};
    map[t.album].count++;
    map[t.album].tracks.push(t);
  });
  return Object.values(map).sort((a,b)=>a.name.localeCompare(b.name));
}
function renderAlbums(){
  const albs=getAlbums();
  document.getElementById('albumGrid').innerHTML=albs.map(a=>`
    <div class="g-card" data-aname="${esc(a.name)}" data-atype="album" onclick="showDetailFromEl(this)">
      ${albumArtDivHtml(a.tracks)}
      <div class="g-name">${esc(a.name)}</div>
      <div class="g-sub">${esc(a.artist)} · ${a.count} titre${a.count>1?'s':''}</div>
    </div>
  `).join('');
}

/* ─── ARTISTS ─── */
function getArtists(){
  const map={};
  tracks.forEach(t=>{
    if(!map[t.artist]) map[t.artist]={name:t.artist,albums:new Set(),tracks:[]};
    map[t.artist].albums.add(t.album);
    map[t.artist].tracks.push(t);
  });
  return Object.values(map).sort((a,b)=>a.name.localeCompare(b.name));
}
function renderArtists(){
  const arts=getArtists();
  document.getElementById('artistGrid').innerHTML=arts.map(a=>`
    <div class="g-card g-artist" data-aname="${esc(a.name)}" data-atype="artist" onclick="showDetailFromEl(this)">
      ${artistArtDivHtml(a.name)}
      <div class="g-name">${esc(a.name)}</div>
      <div class="g-sub">${a.albums.size} album${a.albums.size>1?'s':''} · ${a.tracks.length} titre${a.tracks.length>1?'s':''}</div>
    </div>
  `).join('');
}

function showDetailFromEl(el){
  showDetail(el.dataset.atype, el.dataset.aname);
}

/* ─── DETAIL ─── */
function showDetail(type,name){
  prevView=document.querySelector('.nav-item.active')?.dataset?.view||'songs';
  _plDetailId = null;
  // Cache le bouton "Ajouter" (réservé aux playlists)
  const addBtn = document.getElementById('detailAddBtn');
  if(addBtn) addBtn.style.display = 'none';
  const filtered2=type==='album'
    ? tracks.filter(t=>t.album===name)
    : tracks.filter(t=>t.artist===name);
  detailTracks=filtered2;
  document.getElementById('detailType').textContent=type==='album'?'Album':'Artiste';
  document.getElementById('detailName').textContent=name;

  // Hero art avec vraie pochette
  const heroArt = document.getElementById('detailArt');
  heroArt.style.borderRadius = type==='artist'?'50%':'12px';
  if(type==='album'){
    const cover = filtered2[0] ? getCover(filtered2[0].filename) : null;
    const grad = gradFor(name);
    heroArt.style.background = cover ? '' : grad;
    heroArt.innerHTML = cover
      ? `<img src="${esc(cover)}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" onerror="this.parentElement.style.background='${grad}';this.remove();">`
      : '💿';
  } else {
    const img = getArtistImg(name);
    const grad = gradFor(name);
    heroArt.style.background = img ? '' : grad;
    heroArt.innerHTML = img
      ? `<img src="${esc(img)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.parentElement.style.background='${grad}';this.remove();">`
      : '🎤';
  }

  if(type==='album'){
    const artist=filtered2[0]?.artist||'';
    document.getElementById('detailSub').textContent=`${artist} · ${filtered2.length} titre${filtered2.length>1?'s':''}`;
  } else {
    const albs=[...new Set(filtered2.map(t=>t.album))];
    document.getElementById('detailSub').textContent=`${albs.length} album${albs.length>1?'s':''} · ${filtered2.length} titre${filtered2.length>1?'s':''}`;
  }
  const favs = getFavs();
  document.getElementById('detailList').innerHTML=filtered2.map((t,i)=>{
    const faved = favs.has(t.filename);
    return `
    <div class="track-row detail-track-row${currentId===t.id?' playing':''}" data-id="${t.id}" onclick="playDetailTrack(${i})">
      <div class="tr-num">${i+1}</div>
      <div class="playing-bars"><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div></div>
      ${artDivHtml(t)}
      <div class="tr-info">
        <div class="tr-title">${esc(t.title)}</div>
        <div class="tr-artist-s">${esc(type==='album'?t.artist:t.album)}</div>
      </div>
      <div class="tr-artist">${esc(type==='album'?t.artist:t.album)}</div>
      <div class="tr-dur">
        <span class="dur-val">${fmtTime(t.length)}</span>
        <div class="tr-actions">
          <button class="ico-btn fav-btn${faved?' active':''}" data-tid="${t.id}" onclick="toggleFavById(${t.id},event)" title="${faved?'Retirer':'Ajouter'}">${faved?'♥':'♡'}</button>
          <button class="ico-btn edit" onclick="event.stopPropagation();openEditor(${t.id})" title="Éditer">✏️</button>
        </div>
      </div>
    </div>
  `}).join('');
  showViewRaw('detail');
}

function goBack(){ showView(prevView); }
function playDetailAll(){ if(!detailTracks.length) return; queue=[...detailTracks]; queueIdx=0; playFromQueue(); }
function shuffleDetailAll(){ if(!detailTracks.length) return; queue=shuffleArr([...detailTracks]); queueIdx=0; playFromQueue(); }
function playDetailTrack(i){ queue=[...detailTracks]; queueIdx=i; playFromQueue(); }

function playAllSongs(){ if(!filtered.length) return; queue=[...filtered]; queueIdx=0; playFromQueue(); }
function shuffleAllSongs(){ if(!filtered.length) return; queue=shuffleArr([...filtered]); queueIdx=0; playFromQueue(); }
function playAllFavs(){ const favs=getFavs(); const ft=tracks.filter(t=>favs.has(t.filename)); if(!ft.length) return; queue=[...ft]; queueIdx=0; playFromQueue(); }
function shuffleAllFavs(){ const favs=getFavs(); const ft=tracks.filter(t=>favs.has(t.filename)); if(!ft.length) return; queue=shuffleArr([...ft]); queueIdx=0; playFromQueue(); }

/* ─── EDITOR LIST ─── */
function renderEdList(){
  document.getElementById('edList').innerHTML=tracks.map(t=>{
    const cover = getCover(t.filename);
    const grad = gradFor(t.artist+t.album);
    return `
    <div class="ed-row${edTrack&&edTrack.id===t.id?' selected':''}" data-id="${t.id}" onclick="selectEdTrack(${t.id})">
      <div class="tr-art" style="${cover?'':'background:'+grad};width:36px;height:36px;border-radius:6px;font-size:14px;overflow:hidden;">
        ${cover?`<img src="${esc(cover)}" style="width:100%;height:100%;object-fit:cover;border-radius:6px;" onerror="this.parentElement.style.background='${grad}';this.remove();">`:'🎵'}
      </div>
      <div class="tr-info">
        <div class="tr-title" style="font-size:13px;">${esc(t.title)}</div>
        <div class="tr-artist-s">${esc(t.artist)}</div>
      </div>
    </div>`;
  }).join('');
}

function openEditor(id){ selectEdTrack(id); showView('editor'); }

function selectEdTrack(id){
  edTrack=tracks.find(t=>t.id===id);
  if(!edTrack) return;
  document.getElementById('ed-title').value=edTrack.title;
  document.getElementById('ed-artist').value=edTrack.artist;
  document.getElementById('ed-album').value=edTrack.album;
  document.getElementById('ed-year').value=edTrack.year;
  document.getElementById('ed-genre').value=edTrack.genre;
  document.getElementById('ed-file').value=edTrack.filename;
  document.getElementById('ed-deezer').value=edTrack.deezerUrl||'';
  // Cover preview
  const cover = getCover(edTrack.filename);
  const grad = gradFor(edTrack.artist+edTrack.album);
  const prev = document.getElementById('ed-cover-preview');
  if(prev){
    prev.style.background = cover ? '' : grad;
    prev.innerHTML = cover
      ? `<img src="${esc(cover)}" onerror="this.parentElement.style.background='${grad}';this.remove();">`
      : '🎵';
  }
  const coverInput = document.getElementById('ed-cover');
  if(coverInput) coverInput.value = cover||'';
  document.getElementById('edFormLabel').textContent=`Éditer : ${edTrack.title}`;
  document.getElementById('edPlaceholder').style.display='none';
  document.getElementById('edForm').style.display='block';
  document.querySelectorAll('.ed-row').forEach(r=>r.classList.toggle('selected',parseInt(r.dataset.id)===id));
}

function saveEdMeta(){
  if(!edTrack) return;
  const coverVal = (document.getElementById('ed-cover')?.value||'').trim();
  const deezerVal = (document.getElementById('ed-deezer')?.value||'').trim();
  const d={
    title:document.getElementById('ed-title').value.trim()||edTrack.title,
    artist:document.getElementById('ed-artist').value.trim()||edTrack.artist,
    album:document.getElementById('ed-album').value.trim()||edTrack.album,
    year:document.getElementById('ed-year').value.trim(),
    genre:document.getElementById('ed-genre').value.trim(),
    ...(coverVal ? {cover: coverVal} : {}),
    ...(deezerVal ? {deezerUrl: deezerVal} : {deezerUrl: ''}),
  };
  setTrackMeta(edTrack.filename,d);
  const t=tracks.find(x=>x.id===edTrack.id);
  Object.assign(t,d);
  if(deezerVal) t.deezerUrl = deezerVal; else delete t.deezerUrl;
  edTrack=t;
  if(coverVal) refreshCoverForTrack(edTrack.id, coverVal);
  filtered=[...tracks];
  applySort();
  renderAll();
  if(currentId===edTrack.id) updatePlayerUI(t);
  toast(deezerVal ? '✅ Sauvegardé · Source : Deezer 🎵' : '✅ Métadonnées sauvegardées');
}

function resetEdMeta(){
  if(!edTrack) return;
  clearTrackMeta(edTrack.filename);
  const parsed=parseFilename(edTrack.filename);
  const t=tracks.find(x=>x.id===edTrack.id);
  Object.assign(t,parsed);
  edTrack=t;
  filtered=[...tracks];
  applySort();
  renderAll();
  selectEdTrack(edTrack.id);
  if(currentId===edTrack.id) updatePlayerUI(t);
  toast('↺ Métadonnées réinitialisées');
}

/* ═══════════════════════════════════════════
   SORT / FILTER
═══════════════════════════════════════════ */
function sortBy(field,btn){
  if(sortField===field){ sortDir*=-1; } else { sortDir=1; }
  sortField=field;
  document.querySelectorAll('.sort-pill').forEach(b=>{
    b.classList.remove('active');
    const d=b.querySelector('.pill-dir');
    if(d) d.remove();
  });
  if(btn){
    btn.classList.add('active');
    const arrow=document.createElement('span');
    arrow.className='pill-dir';
    arrow.textContent=sortDir===1?' ↑':' ↓';
    btn.appendChild(arrow);
  }
  applySort();
  renderSongs();
}

function applySort(){
  filtered.sort((a,b)=>{
    if(sortField==='year'||sortField==='length'){
      const va=parseFloat(a[sortField])||0;
      const vb=parseFloat(b[sortField])||0;
      return (va-vb)*sortDir;
    }
    const va=String(a[sortField]||'').toLowerCase();
    const vb=String(b[sortField]||'').toLowerCase();
    return va.localeCompare(vb)*sortDir;
  });
}

/* ── Normalise une chaîne pour la recherche (retire accents, ponctuation, casse) ── */
function _normSearch(s){
  return String(s||'')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')  // accents → base
    .replace(/[''`]/g,"'");
}

function onSearch(){
  const raw = document.getElementById('searchInput').value;
  const q = _normSearch(raw);

  if(q) showViewRaw('songs');

  if(!q){
    filtered = [...tracks];
  } else {
    // Découpe en tokens : chaque mot doit matcher AU MOINS UN champ
    const tokens = q.split(/\s+/).filter(Boolean);
    filtered = tracks.filter(t => {
      const fields = [
        _normSearch(t.title),
        _normSearch(t.artist),
        _normSearch(t.album),
        _normSearch(t.genre),
        _normSearch(t.year),
      ];
      return tokens.every(tok => fields.some(f => f.includes(tok)));
    });
  }

  applySort();
  renderSongs();

  // Affiche le compte de résultats dans le sous-titre de la vue
  const sub = document.getElementById('songCount');
  if(sub){
    if(q && filtered.length !== tracks.length){
      sub.textContent = `${filtered.length} résultat${filtered.length>1?'s':''} pour « ${raw} »`;
    } else {
      sub.textContent = `${tracks.length} chanson${tracks.length>1?'s':''}`;
    }
  }
}

