/* ═══════════════════════════════════════════
   COVERS & ARTIST IMAGES
═══════════════════════════════════════════ */
function getCover(filename){ return getMeta()[filename]?.cover || null; }

function getArtistImgStore(){ try{ return JSON.parse(localStorage.getItem(ARTIST_IMG_STORE)||'{}'); }catch{ return {}; } }
function getArtistImg(name){ return getArtistImgStore()[name] || null; }
function setArtistImg(name, url){ const d=getArtistImgStore(); d[name]=url; localStorage.setItem(ARTIST_IMG_STORE,JSON.stringify(d)); }

/* ── Art div helpers ── */
function artDivHtml(t, cls='tr-art', extraStyle=''){
  const cover = t?.filename ? getCover(t.filename) : null;
  const grad = gradFor((t?.artist||'')+(t?.album||t?.filename||''));
  const bg = cover ? '' : `background:${grad};`;
  return `<div class="${cls}" style="${bg}${extraStyle}" data-art-id="${t?.id??''}">${
    cover
      ? `<img src="${esc(cover)}" loading="lazy" onerror="this.parentElement.style.background='${grad}';this.remove();">`
      : '🎵'
  }</div>`;
}

function albumArtDivHtml(albumTracks, cls='g-art'){
  const firstTrack = albumTracks?.[0];
  const cover = firstTrack ? getCover(firstTrack.filename) : null;
  const grad = gradFor(firstTrack?.album||'');
  return `<div class="${cls}" style="${cover?'':'background:'+grad}">${
    cover ? `<img src="${esc(cover)}" loading="lazy" onerror="this.parentElement.style.background='${grad}';this.remove();">` : '💿'
  }</div>`;
}

function artistArtDivHtml(artistName){
  const img = getArtistImg(artistName);
  const grad = gradFor(artistName);
  return `<div class="g-art" style="border-radius:50%;${img?'':'background:'+grad}" data-artist-art="${escAttr(artistName)}">${
    img ? `<img src="${esc(img)}" loading="lazy" onerror="this.parentElement.style.background='${grad}';this.remove();">` : '🎤'
  }</div>`;
}

function miniArtHtml(t, e){
  // t = track object (may be null for history), e = entry/data object
  const cover = t ? getCover(t.filename) : null;
  const grad = gradFor((e?.artist||'')+(e?.album||e?.filename||''));
  return `<div class="dash-mini-art" style="${cover?'':'background:'+grad}">${
    cover ? `<img src="${esc(cover)}" loading="lazy" onerror="this.parentElement.style.background='${grad}';this.remove();">` : '🎵'
  }</div>`;
}

/* ── Live cover refresh ── */
function refreshCoverForTrack(trackId, coverUrl){
  const grad = gradFor((tracks.find(x=>x.id===trackId)?.artist||'')+(tracks.find(x=>x.id===trackId)?.album||''));
  document.querySelectorAll(`[data-art-id="${trackId}"]`).forEach(el=>{
    el.style.background = '';
    el.innerHTML = `<img src="${coverUrl}" loading="lazy" onerror="this.parentElement.style.background='${grad}';this.remove();">`;
  });
  if(currentId === trackId){
    const pArt = document.getElementById('pArt');
    if(pArt){
      pArt.style.background = '';
      pArt.innerHTML = `<img src="${coverUrl}" loading="lazy" onerror="this.parentElement.style.background='${grad}';this.remove();">`;
    }
  }
}

function refreshArtistImg(artistName, imgUrl){
  document.querySelectorAll(`[data-artist-art="${CSS.escape(artistName)}"]`).forEach(el=>{
    el.style.background = '';
    el.innerHTML = `<img src="${imgUrl}" loading="lazy" style="border-radius:50%;" onerror="this.parentElement.style.background='${gradFor(artistName)}';this.remove();">`;
  });
}

/* ═══════════════════════════════════════════
   MULTI-SOURCE COVER ENRICHMENT
   Ordre : Deezer (1000×1000) → iTunes (fallback)
═══════════════════════════════════════════ */
let _enrichQueue = [];
let _enrichRunning = false;
let _enrichDone = 0;
let _enrichTotal = 0;

/* ── Normalise un nom pour comparaison multi-source ── */
function _normArtist(s){
  return String(s||'').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/\s*[\(\[](feat|ft|with|avec)\.?\s[^\)\]]+[\)\]].*$/i,'')
    .replace(/[^a-z0-9\s]/g,'').trim();
}
function _normTitle(s){
  return String(s||'').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/\s*[\(\[](feat|ft|with|avec)\.?\s[^\)\]]+[\)\]]/i,'')
    .trim();
}

/* ════════════════════════════════
   SOURCE 1 : DEEZER (1000×1000)
════════════════════════════════ */
async function fetchDeezerMeta(title, artist){
  const cleanArtist = _normArtist(artist);
  const cleanTitle  = _normTitle(title);
  const queries = [
    `artist:"${artist}" track:"${title}"`,
    `${artist} ${title}`,
    title,
  ];
  for(const q of queries){
    let d;
    try{
      const r = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=10`);
      if(!r.ok) continue;
      d = await r.json();
    }catch{ continue; }
    const data = d?.data || [];
    if(!data.length) continue;
    const norm = x => _normArtist(x.artist?.name||'');
    const m = data.find(x => norm(x) === cleanArtist)
           || data.find(x => norm(x).includes(cleanArtist) || cleanArtist.includes(norm(x)))
           || data[0];
    const cover = m?.album?.cover_xl || m?.album?.cover_big;
    if(cover) return { cover, album: m.album?.title||null, year:null, genre:null, artistName: m.artist?.name||null, _source:'deezer' };
  }
  return null;
}

async function fetchDeezerArtistImg(artist){
  try{
    const r = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(artist)}&limit=5`);
    if(!r.ok) return null;
    const d = await r.json();
    const ca = _normArtist(artist);
    const m = d.data?.find(x => _normArtist(x.name||'') === ca)
           || d.data?.find(x => _normArtist(x.name||'').includes(ca))
           || d.data?.[0];
    const url = m?.picture_xl || m?.picture_big || null;
    // Reject Deezer placeholder : URL with empty hash (/artist//) or all-zero hash
    if(!url) return null;
    if(/\/images\/artist\/\//.test(url)) return null;            // double slash = no photo
    if(/\/[0-9a-f]{32}\//.test(url) && /00000000000000/.test(url)) return null; // zero hash
    return url;
  }catch{ return null; }
}

/* ════════════════════════════════
   SOURCE 2 : iTunes (fallback)
════════════════════════════════ */
async function _itunesFetch(url){
  const r = await fetch(url);
  if(!r.ok) return null;
  const d = await r.json();
  return d.results?.length ? d.results : null;
}

async function fetchItunesMeta(title, artist){
  const cleanArtist = _normArtist(artist);
  const cleanTitle  = _normTitle(title);
  const queries = [
    `${cleanArtist} ${cleanTitle}`,
    cleanTitle,
    `${cleanTitle} ${cleanArtist}`,
  ];
  for(const q of queries){
    const results = await _itunesFetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&limit=8&country=fr`
    ).catch(()=>null);
    if(!results) continue;
    const norm = r => _normArtist(r.artistName||'');
    const m = results.find(r => norm(r) === cleanArtist)
           || results.find(r => norm(r).includes(cleanArtist) || cleanArtist.includes(norm(r)))
           || results[0];
    if(m?.artworkUrl100){
      const cover = m.artworkUrl100.replace(/\/\d+x\d+bb\./, '/1000x1000bb.').replace('100x100bb','1000x1000bb');
      return { cover, album: m.collectionName||null, year: m.releaseDate?.slice(0,4)||null, genre: m.primaryGenreName||null, artistName: m.artistName||null, _source:'itunes' };
    }
  }
  return null;
}

async function fetchItunesArtistImg(artist){
  try{
    const r = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(artist)}&media=music&entity=musicArtist&limit=5`);
    if(!r.ok) return null;
    const d = await r.json();
    const ca = _normArtist(artist);
    const m = d.results?.find(x => _normArtist(x.artistName||'') === ca)
           || d.results?.find(x => _normArtist(x.artistName||'').includes(ca))
           || d.results?.[0];
    const url = m?.artworkUrl100;
    if(!url) return null;
    return url.replace(/\/\d+x\d+bb\./, '/1000x1000bb.').replace('100x100bb','1000x1000bb');
  }catch{ return null; }
}

/* ════════════════════════════════
   ORCHESTRATEUR : Deezer → iTunes
════════════════════════════════ */
async function fetchBestCover(title, artist){
  const dz = await fetchDeezerMeta(title, artist).catch(()=>null);
  if(dz?.cover) return dz;
  return fetchItunesMeta(title, artist).catch(()=>null);
}

/* ════════════════════════════════
   SOURCE 3 : Wikipedia (thumbnail)
════════════════════════════════ */
async function fetchWikipediaArtistImg(artist){
  for(const lang of ['fr','en']){
    try{
      const r = await fetch(
        `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(artist)}`,
        { signal: AbortSignal.timeout(6000) }
      );
      if(!r.ok) continue;
      const d = await r.json();
      // Reject disambiguation pages
      if(d.type === 'disambiguation') continue;
      const img = d.originalimage?.source || d.thumbnail?.source || null;
      if(img) return img;
    }catch{}
  }
  return null;
}

async function fetchBestArtistImg(artist){
  const dz = await fetchDeezerArtistImg(artist).catch(()=>null);
  if(dz) return dz;
  const it = await fetchItunesArtistImg(artist).catch(()=>null);
  if(it) return it;
  return fetchWikipediaArtistImg(artist).catch(()=>null);
}

/* ════════════════════════════════
   ENRICHISSEMENT AUTO (3 workers)
════════════════════════════════ */
async function startEnrichment(){
  const meta = getMeta();
  _enrichQueue = tracks.filter(t => !meta[t.filename]?.cover).map(t => t.filename);
  _enrichTotal = _enrichQueue.length;
  _enrichDone = 0;
  if(!_enrichQueue.length){ updateEnrichBadge(); return; }
  if(_enrichRunning) return;
  _enrichRunning = true;
  updateEnrichBadge();
  await Promise.all([processEnrichWorker(), processEnrichWorker(), processEnrichWorker()]);
  _enrichRunning = false;
  updateEnrichBadge();
  renderAlbums();
  renderArtists();
  renderDashboard();
}

const _artistsEnriched = new Set();

async function processEnrichWorker(){
  while(_enrichQueue.length > 0){
    const fn = _enrichQueue.shift();
    if(!fn) break;
    const t = tracks.find(x=>x.filename===fn);
    if(!t){ _enrichDone++; updateEnrichBadge(); continue; }
    try{
      const info = await fetchBestCover(t.title, t.artist);
      if(info?.cover){
        const cur = getMeta()[fn] || {};
        setTrackMeta(fn, {
          cover: info.cover,
          ...(!cur.album || cur.album==='Sans album' ? {album: info.album||cur.album} : {}),
          ...(!cur.year && info.year ? {year: info.year} : {}),
          ...(!cur.genre && info.genre ? {genre: info.genre} : {}),
        });
        const tr = tracks.find(x=>x.filename===fn);
        if(tr){
          if(!tr.album || tr.album==='Sans album') tr.album = info.album || tr.album;
          if(!tr.year && info.year) tr.year = info.year;
          if(!tr.genre && info.genre) tr.genre = info.genre;
        }
        refreshCoverForTrack(t.id, info.cover);
      }
      if(!_artistsEnriched.has(t.artist) && !getArtistImg(t.artist)){
        _artistsEnriched.add(t.artist);
        fetchBestArtistImg(t.artist).then(img=>{
          if(img){ setArtistImg(t.artist, img); refreshArtistImg(t.artist, img); }
        }).catch(()=>{});
      }
    }catch(e){}
    _enrichDone++;
    updateEnrichBadge();
    await new Promise(r=>setTimeout(r,200));
  }
}

function updateEnrichBadge(){
  const el = document.getElementById('enrichBadge');
  if(!el) return;
  const remaining = _enrichTotal - _enrichDone;
  if(_enrichRunning && remaining > 0){
    el.style.display = '';
    el.textContent = `⟳ ${remaining}`;
  } else {
    el.style.display = 'none';
  }
}

async function enrichTrackManual(trackId){
  const t = tracks.find(x=>x.id===trackId);
  if(!t) return;
  openCoverSearch(trackId, [t.artist, t.title].filter(Boolean).join(' '), 'cover');
}

async function searchArtistImgManual(trackId){
  const t = tracks.find(x=>x.id===trackId);
  if(!t) return;
  openCoverSearch(trackId, t.artist, 'artist');
}

/* ═══════════════════════════════════════════════════
   COVER SEARCH PICKER — Deezer 🟠 + iTunes 🔴
═══════════════════════════════════════════════════ */
let _coverMode = 'cover';       // 'cover' | 'artist'
let _coverTrackId = null;
window._coverResults = [];

/* Normalise un résultat Deezer en objet commun */
function _normDeezerResult(item, mode){
  if(mode === 'artist') return {
    _source:'deezer', cover: item.picture_xl||item.picture_big||null,
    title: item.name||'', artist:'', album:'', year:'', genre:'',
  };
  return {
    _source:'deezer',
    cover:  item.album?.cover_xl || item.album?.cover_big || null,
    title:  item.title || '',
    artist: item.artist?.name || '',
    album:  item.album?.title || '',
    year:'', genre:'',
  };
}

/* Normalise un résultat iTunes en objet commun */
function _normItunesResult(item, mode){
  const rawCover = item.artworkUrl100||'';
  const cover = rawCover
    ? rawCover.replace(/\/\d+x\d+bb\./, '/1000x1000bb.').replace('100x100bb','1000x1000bb')
    : null;
  if(mode === 'artist') return {
    _source:'itunes', cover,
    title: item.artistName||'', artist:'', album:'', year:'', genre: item.primaryGenreName||'',
  };
  return {
    _source:'itunes', cover,
    title:  item.trackName||item.collectionName||'',
    artist: item.artistName||'',
    album:  item.collectionName||'',
    year:   item.releaseDate?.slice(0,4)||'',
    genre:  item.primaryGenreName||'',
  };
}

function openCoverSearch(trackId, query='', mode='cover'){
  _coverTrackId = trackId;
  _coverMode = mode;
  const titleEl = document.getElementById('itunesSheetTitle');
  if(titleEl) titleEl.textContent = mode === 'artist' ? '🎤 Photo artiste' : '🔍 Pochette · Deezer + iTunes';
  const inp = document.getElementById('itunesQueryInput');
  if(inp) inp.value = query;
  const res = document.getElementById('itunesResults');
  if(res) res.innerHTML = '<div class="itunes-empty">Tape un nom et lance la recherche ✨</div>';
  document.getElementById('itunesBackdrop').classList.add('open');
  document.getElementById('itunesSheet').classList.add('open');
  history.pushState({ arya: 'itunesSheet' }, '');
  if(query.trim()) setTimeout(runCoverSearch, 150);
  else if(inp) setTimeout(()=>inp.focus(), 300);
}

/* Alias rétrocompatibilité */
function openItunesSearch(trackId, query, mode){ openCoverSearch(trackId, query, mode); }

let _coverDebounceTimer = null;
function _itunesDebounce(){
  clearTimeout(_coverDebounceTimer);
  const q = (document.getElementById('itunesQueryInput')?.value||'').trim();
  if(q.length < 2) return;
  _coverDebounceTimer = setTimeout(runCoverSearch, 500);
}

function closeItunesSearch(){
  const wasOpen = document.getElementById('itunesSheet').classList.contains('open');
  document.getElementById('itunesBackdrop').classList.remove('open');
  document.getElementById('itunesSheet').classList.remove('open');
  if(wasOpen && history.state?.arya === 'itunesSheet') history.back();
}

/* Lance Deezer + iTunes en parallèle, fusionne, Deezer en tête */
async function runCoverSearch(){
  const q = (document.getElementById('itunesQueryInput')?.value || '').trim();
  if(!q) return;
  const res = document.getElementById('itunesResults');
  res.innerHTML = '<div class="itunes-loading"><div class="spinner" style="width:24px;height:24px;border-width:2px;"></div> Deezer + iTunes…</div>';
  const mode = _coverMode;
  try{
    let dz = [], it = [];
    if(mode === 'artist'){
      [dz, it] = await Promise.all([
        fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(q)}&limit=8`).then(r=>r.ok?r.json():null).catch(()=>null).then(d=>(d?.data||[]).map(x=>_normDeezerResult(x,'artist'))),
        fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=musicArtist&limit=8`).then(r=>r.ok?r.json():null).catch(()=>null).then(d=>(d?.results||[]).map(x=>_normItunesResult(x,'artist'))),
      ]);
    } else {
      [dz, it] = await Promise.all([
        // Deezer : 2 requêtes parallèles fusionnées
        Promise.all([
          fetch(`https://api.deezer.com/search?q=${encodeURIComponent('artist:"'+q+'"')}&limit=10`).then(r=>r.ok?r.json():null).catch(()=>null),
          fetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=10`).then(r=>r.ok?r.json():null).catch(()=>null),
        ]).then(([a,b])=>{
          const all=[...(a?.data||[]),...(b?.data||[])];
          const seen=new Set();
          return all.filter(x=>{ if(seen.has(x.id)) return false; seen.add(x.id); return true; }).map(x=>_normDeezerResult(x,'cover'));
        }),
        // iTunes : FR + global fusionnés
        Promise.all([
          fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&limit=10&country=fr`).then(r=>r.ok?r.json():null).catch(()=>null),
          fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&limit=8`).then(r=>r.ok?r.json():null).catch(()=>null),
        ]).then(([a,b])=>{
          const all=[...(a?.results||[]),...(b?.results||[])];
          const seen=new Set();
          return all.filter(x=>{ const k=x.trackId||x.collectionId; if(seen.has(k)) return false; seen.add(k); return true; }).map(x=>_normItunesResult(x,'cover'));
        }),
      ]);
    }
    const merged = [...dz, ...it].filter(x=>x.cover);
    if(!merged.length){
      res.innerHTML = '<div class="itunes-empty">😕 Aucun résultat<br><span style="font-size:11.5px;">Essaie un autre terme</span></div>';
      return;
    }
    _renderCoverResults(merged.slice(0, 20));
  }catch(e){
    res.innerHTML = '<div class="itunes-empty" style="color:var(--rose);">⚠️ Erreur réseau</div>';
  }
}

/* Alias rétrocompatibilité */
function runItunesSearch(){ return runCoverSearch(); }

function _renderCoverResults(results){
  window._coverResults = results;
  const res = document.getElementById('itunesResults');
  const isArtist = _coverMode === 'artist';
  const nDz = results.filter(x=>x._source==='deezer').length;
  const nIt = results.filter(x=>x._source==='itunes').length;
  const countBar = `<div style="font-size:11px;color:var(--text3);padding:0 4px 10px;display:flex;gap:8px;align-items:center;">
    <span>${results.length} résultat${results.length>1?'s':''}</span>
    ${nDz?`<span style="background:rgba(250,83,6,.18);color:#fa5306;border-radius:8px;padding:1px 7px;font-weight:600;">Deezer ${nDz}</span>`:''}
    ${nIt?`<span style="background:rgba(252,60,68,.12);color:#fc3c44;border-radius:8px;padding:1px 7px;font-weight:600;">iTunes ${nIt}</span>`:''}
  </div>`;
  res.innerHTML = countBar + results.map((item, i) => {
    const circleClass = isArtist ? ' circle' : '';
    const srcBadge = item._source === 'deezer'
      ? `<span style="position:absolute;top:4px;left:4px;background:rgba(250,83,6,.88);color:#fff;font-size:9px;font-weight:700;padding:1px 5px;border-radius:5px;">DEEZER</span>`
      : `<span style="position:absolute;top:4px;left:4px;background:rgba(252,60,68,.88);color:#fff;font-size:9px;font-weight:700;padding:1px 5px;border-radius:5px;">iTUNES</span>`;
    return `<div class="itunes-result-card">
      <div class="itunes-result-cover${circleClass}" style="position:relative;">
        ${item.cover ? `<img src="${esc(item.cover)}" onerror="this.style.display='none'">` : (isArtist?'🎤':'🎵')}
        ${srcBadge}
      </div>
      <div class="itunes-result-info">
        <div class="itunes-result-title">${esc(item.title||'—')}</div>
        ${item.artist ? `<div class="itunes-result-artist">${esc(item.artist)}</div>` : ''}
        ${item.album  ? `<div class="itunes-result-album">${esc(item.album)}</div>` : ''}
        ${(item.year||item.genre) ? `<div class="itunes-result-meta">${[item.year,item.genre].filter(Boolean).join(' · ')}</div>` : ''}
      </div>
      <button class="itunes-apply-btn" onclick="applyCoverResult(${i})">✓ Appliquer</button>
    </div>`;
  }).join('');
}

/* Alias rétrocompatibilité */
function _renderItunesResults(r){ _renderCoverResults(r); }
function applyItunesResult(i){ applyCoverResult(i); }

function applyCoverResult(idx){
  const item = window._coverResults?.[idx];
  if(!item) return;
  const t = tracks.find(x=>x.id===_coverTrackId);

  if(_coverMode === 'artist'){
    if(!item.cover){ toast("Pas d'image disponible", true); return; }
    const artistName = t?.artist || item.title;
    setArtistImg(artistName, item.cover);
    refreshArtistImg(artistName, item.cover);
    toast(`✅ Photo artiste appliquée ! (${item._source === 'deezer' ? '🟠 Deezer' : '🔴 iTunes'})`);
    closeItunesSearch();
    return;
  }

  // Mode pochette
  if(item.cover){
    const inp = document.getElementById('ed-cover');
    if(inp) inp.value = item.cover;
    _setEdCoverPreview(item.cover);
  }
  if(item.album){ const el=document.getElementById('ed-album'); if(el) el.value=item.album; }
  if(item.year){  const el=document.getElementById('ed-year');  if(el) el.value=item.year;  }
  if(item.genre){ const el=document.getElementById('ed-genre'); if(el) el.value=item.genre; }

  if(t && item.cover){
    setTrackMeta(t.filename, {
      cover: item.cover,
      ...(item.album ? {album: item.album} : {}),
      ...(item.year  ? {year:  item.year}  : {}),
      ...(item.genre ? {genre: item.genre} : {}),
    });
    if(item.album) t.album = item.album;
    if(item.year)  t.year  = item.year;
    if(item.genre) t.genre = item.genre;
    refreshCoverForTrack(t.id, item.cover);
    if(currentId === t.id) updatePlayerUI(t);
  }

  toast(`✅ Appliqué — sauvegarde pour confirmer (${item._source === 'deezer' ? '🟠 Deezer 1000px' : '🔴 iTunes 1000px'})`);
  closeItunesSearch();
}

function _setEdCoverPreview(url){
  const prev = document.getElementById('ed-cover-preview');
  if(!prev) return;
  if(url){
    const grad = gradFor((edTrack?.artist||'')+(edTrack?.album||''));
    prev.style.background = '';
    prev.innerHTML = '<img src="'+url.replace(/"/g,'&quot;')+'" onerror="this.parentElement.style.background=\''+grad+'\';this.remove();">';
  }
}

/* ── Vérifie qu'une URL est bien une image (pas une page web) ── */
function _isImageUrl(url){
  if(!url || typeof url !== 'string') return false;
  // CDNs connus : Spotify/Scdn, SoundCloud, Deezer, Apple/MZStatic
  if(/i\.scdn\.co|i1\.sndcdn\.com|e-cdns-images\.dzcdn\.net|is\d*\.mzstatic\.com|lh3\.googleusercontent\.com/.test(url)) return true;
  return /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(url);
}

/* ── Recherche album sur Deezer + genre via /album/{id} ── */
async function _fetchDeezerAlbumMeta(albumName, artistName){
  try{
    const q = (artistName ? artistName + ' ' : '') + albumName;
    const r = await fetch('https://api.deezer.com/search/album?q='+encodeURIComponent(q)+'&limit=8');
    if(!r.ok) return null;
    const d = await r.json();
    const albums = d.data||[];
    if(!albums.length) return null;

    const normAl = _normTitle(albumName);
    const normAr = _normArtist(artistName||'');
    const match = albums.find(a => _normTitle(a.title||'')===normAl && (!normAr||_normArtist(a.artist?.name||'')===normAr))
               || albums.find(a => _normTitle(a.title||'').includes(normAl)||normAl.includes(_normTitle(a.title||'')))
               || albums[0];
    if(!match) return null;

    const cover = match.cover_xl || match.cover_big || null;

    // Récupère genre via l'endpoint complet de l'album
    const full = await fetch('https://api.deezer.com/album/'+match.id).then(r=>r.ok?r.json():null).catch(()=>null);
    const genre = full?.genres?.data?.[0]?.name || null;
    const year  = (full?.release_date||'').slice(0,4)||null;

    return { cover, genre, year, album: match.title||albumName, artist: match.artist?.name||artistName };
  }catch{ return null; }
}

/* ── Chemin dédié pour les liens album Spotify ── */
async function _handleSpotifyAlbumUrl(url){
  toast('🟢 Album Spotify détecté — récupération…');

  const proxies = [
    u => 'https://corsproxy.io/?'+encodeURIComponent(u),
    u => 'https://api.allorigins.win/get?url='+encodeURIComponent(u),
    u => 'https://api.codetabs.com/v1/proxy?quest='+encodeURIComponent(u),
  ];

  let albumName='', artistName='', cover='', year='';

  for(const makeUrl of proxies){
    try{
      const r = await fetch(makeUrl(url), {signal: AbortSignal.timeout(8000)});
      if(!r.ok) continue;
      const raw = await r.text();
      let html; try{ const j=JSON.parse(raw); html=j.contents||raw; }catch{ html=raw; }
      if(!html?.includes('<')) continue;

      const doc = new DOMParser().parseFromString(html, 'text/html');
      const og  = n => doc.querySelector('meta[property="og:'+n+'"]')?.content||'';

      // Pochette : og:image pointe vers i.scdn.co — valider
      const rawCover = og('image') || doc.querySelector('meta[name="twitter:image"]')?.content||'';
      if(_isImageUrl(rawCover)) cover = rawCover;

      // Titre de l'album depuis og:title (nettoyer "| Spotify")
      let rawTitle = og('title') || doc.title||'';
      rawTitle = rawTitle.replace(/\s*[|]\s*Spotify\s*$/i,'').replace(/\s*[-–—]\s*Spotify\s*$/i,'').replace(/\s+on\s+Spotify\s*$/i,'').trim();

      // JSON-LD
      let jd={};
      try{ const s=doc.querySelector('script[type="application/ld+json"]'); if(s) jd=JSON.parse(s.textContent); }catch{}
      jd = jd['@graph']?.[0]||jd;

      albumName  = jd.name || rawTitle || '';
      artistName = jd.byArtist?.name || '';

      // Artiste depuis la description si absent du JSON-LD
      if(!artistName){
        const desc = og('description')||'';
        const m = desc.match(/by\s+(.+?)\s+on\s+Spotify/i)
               || desc.match(/^(.+?)\s*[·•]\s*(?:Album|Single|EP)/i);
        if(m) artistName = m[1].trim();
      }

      // Année
      const yearRaw = jd.datePublished||jd.dateCreated||'';
      if(yearRaw) year = String(yearRaw).slice(0,4);

      if(albumName) break;
    }catch{ continue; }
  }

  const set = (id, val) => { const f=document.getElementById(id); if(f&&val&&!f.value) f.value=val; return !!(f&&val); };
  const applied = [];

  if(cover)     { document.getElementById('ed-cover').value=cover; _setEdCoverPreview(cover); applied.push('pochette'); }
  if(albumName) { if(set('ed-album', albumName))  applied.push('album'); }
  if(artistName){ if(set('ed-artist', artistName)) applied.push('artiste'); }
  if(year)      { if(set('ed-year', year))         applied.push('année'); }

  // Enrichissement Deezer : genre + pochette de meilleure qualité si manquante
  const searchAlbum  = albumName  || document.getElementById('ed-album')?.value  || '';
  const searchArtist = artistName || document.getElementById('ed-artist')?.value || '';
  if(searchAlbum || searchArtist){
    toast('🔍 Genre via Deezer…');
    const dz = await _fetchDeezerAlbumMeta(searchAlbum, searchArtist).catch(()=>null);
    if(dz){
      if(!cover && dz.cover){ document.getElementById('ed-cover').value=dz.cover; _setEdCoverPreview(dz.cover); applied.push('pochette'); }
      if(dz.genre){ if(set('ed-genre', dz.genre)) applied.push('genre'); }
      if(!year && dz.year){ if(set('ed-year', dz.year)) applied.push('année'); }
    } else {
      // Fallback iTunes pour le genre
      const it = await fetchItunesMeta(searchAlbum, searchArtist).catch(()=>null);
      if(it){
        if(!cover && it.cover){ document.getElementById('ed-cover').value=it.cover; _setEdCoverPreview(it.cover); applied.push('pochette'); }
        if(it.genre){ if(set('ed-genre', it.genre)) applied.push('genre'); }
      }
    }
  }

  if(applied.length) toast('✅ Album Spotify : '+applied.join(', '));
  else toast('⚠️ Aucune métadonnée trouvée — renseigne manuellement', true);
}

async function fetchMetaFromUrl(){
  const url = (document.getElementById('ed-meta-url')?.value||'').trim();
  if(!url){ toast('Colle un lien dans le champ d\'abord', true); return; }

  // Lien direct vers une image → pochette directe
  if(/\.(jpe?g|png|webp|gif|avif)(\?.*)?$/i.test(url)){
    document.getElementById('ed-cover').value = url;
    _setEdCoverPreview(url);
    toast('✅ Pochette appliquée depuis le lien image');
    return;
  }

  // ── Spotify album → chemin dédié ──
  if(/open\.spotify\.com(?:\/intl-[a-z-]+)?\/album\//i.test(url)){
    await _handleSpotifyAlbumUrl(url);
    return;
  }

  toast('🌐 Récupération des métadonnées…');
  try{
    // Proxies CORS en fallback
    const proxies = [
      u => 'https://corsproxy.io/?'+encodeURIComponent(u),
      u => 'https://api.codetabs.com/v1/proxy?quest='+encodeURIComponent(u),
      u => 'https://api.allorigins.win/get?url='+encodeURIComponent(u),
    ];
    let html = '';
    for(const makeUrl of proxies){
      try{
        const r = await fetch(makeUrl(url), {signal: AbortSignal.timeout(7000)});
        if(!r.ok) continue;
        const raw = await r.text();
        // allorigins renvoie du JSON {contents:...}, les autres renvoient du HTML direct
        try{ const j=JSON.parse(raw); html=j.contents||raw; }catch{ html=raw; }
        if(html && html.includes('<')) break;
      }catch{ continue; }
    }
    if(!html || !html.includes('<')){ toast('⚠️ Impossible de charger la page (tous les proxies ont échoué)', true); return; }
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // Helpers
    const og   = n => doc.querySelector('meta[property="og:'+n+'"]')?.content || doc.querySelector('meta[name="og:'+n+'"]')?.content || '';
    const meta  = n => doc.querySelector('meta[name="'+n+'"]')?.content || doc.querySelector('meta[property="'+n+'"]')?.content || '';
    const ld    = () => { try{ const s=doc.querySelector('script[type="application/ld+json"]'); return s?JSON.parse(s.textContent):{} }catch{return{}} };

    // JSON-LD (riche sur Deezer, Genius, Wikipedia…)
    const json = ld();
    const jd   = json['@graph']?.[0] || json;

    // Extraire chaque champ avec fallbacks multiples
    // IMPORTANT : valider que la cover est une vraie URL d'image (pas une page web)
    const rawCover = og('image') || meta('twitter:image') || jd.image?.url || (typeof jd.image==='string'?jd.image:'') || '';
    const cover  = _isImageUrl(rawCover) ? rawCover : '';
    const title  = og('title') || jd.name || meta('twitter:title') || doc.title || '';
    const artist = jd.byArtist?.name || jd.creator?.name || jd.author?.name || og('music:musician') || meta('music:musician') || '';
    // Pour une page album : jd.name EST le nom de l'album ; pour une piste : jd.inAlbum.name
    const isAlbumPage = jd['@type'] === 'MusicAlbum' || (jd['@type'] && String(jd['@type']).includes('MusicAlbum'));
    const album  = jd.inAlbum?.name || jd.partOfAlbum?.name || og('music:album') || meta('music:album') || jd.albumName || (isAlbumPage ? jd.name : '') || '';
    const yearRaw= jd.datePublished || jd.dateCreated || jd.inAlbum?.datePublished || og('music:release_date') || meta('music:release_date') || '';
    const year   = yearRaw ? String(yearRaw).slice(0,4) : '';
    const genre  = (Array.isArray(jd.genre)?jd.genre[0]:jd.genre) || '';

    // Appliquer aux champs (sans écraser ce que l'utilisateur a déjà saisi)
    const set = (id, val) => { const f=document.getElementById(id); if(f&&val&&!f.value) f.value=val; return !!(f&&val); };
    let applied = [];

    if(cover){ document.getElementById('ed-cover').value=cover; _setEdCoverPreview(cover); applied.push('pochette'); }
    if(set('ed-title',  title))  applied.push('titre');
    if(set('ed-artist', artist)) applied.push('artiste');
    if(set('ed-album',  album))  applied.push('album');
    if(set('ed-year',   year))   applied.push('année');
    if(set('ed-genre',  genre))  applied.push('genre');

    if(applied.length) toast('✅ Récupéré : '+applied.join(', '));
    else toast('⚠️ Aucune metadata trouvée sur cette page', true);
  }catch(e){
    console.warn('[fetchMetaFromUrl]', e);
    toast('Erreur réseau ou CORS', true);
  }
}

