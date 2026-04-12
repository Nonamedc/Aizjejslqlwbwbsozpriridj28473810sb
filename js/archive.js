/* ═══════════════════════════════════════════
   PARSE FILENAME → metadata
═══════════════════════════════════════════ */
function parseFilename(fn){
  let name = fn.replace(/\.(mp3|flac|ogg|wav|m4a)$/i,'').replace(/_/g,' ').trim();

  // Retire les numéros de piste en début : "01 - ", "1. ", "01. ", "Track 01 - "
  name = name.replace(/^(?:track\s*)?(\d{1,3})[\.\-\s]+/i, '');

  let title = name, artist = 'Inconnu', album = 'Sans album', year = '', genre = '';

  const parts = name.split(/\s*-\s*/).map(p => p.trim()).filter(Boolean);
  if(parts.length >= 3){ artist = parts[0]; album = parts[1]; title = parts.slice(2).join(' - '); }
  else if(parts.length === 2){ artist = parts[0]; title = parts[1]; }
  else { title = parts[0] || name; }

  // Extrait l'année entre parenthèses ou crochets : (2003) ou [2003]
  const ym = title.match(/[\(\[]((?:19|20)\d{2})[\)\]]/);
  if(ym){ year = ym[1]; title = title.replace(ym[0],'').trim(); }

  // Retire les mentions feat. du titre (nettoyage)
  title = title.replace(/\s*[\(\[](feat|ft|with|avec)\.?\s[^\)\]]+[\)\]]/i,'').trim();

  return { title, artist, album, year, genre };
}

/* ═══════════════════════════════════════════
   FETCH ARCHIVE.ORG
═══════════════════════════════════════════ */
async function fetchArchive(){
  try{
    const res=await fetch(`https://archive.org/metadata/${ARCHIVE_ID}`);
    if(!res.ok) throw new Error('HTTP '+res.status);
    const data=await res.json();
    const audioRx=/\.(mp3|flac|ogg|wav|m4a)$/i;
    const files=(data.files||[]).filter(f=>audioRx.test(f.name)&&!f.name.includes('/'));
    const meta=getMeta();
    tracks=files.map((f,i)=>{
      const saved=meta[f.name]||{};
      const parsed=parseFilename(f.name);
      return{
        id:i,
        filename:f.name,
        url:`https://archive.org/download/${ARCHIVE_ID}/${encodeURIComponent(f.name)}`,
        title:saved.title||parsed.title,
        artist:saved.artist||parsed.artist,
        album:saved.album||parsed.album,
        year:saved.year||parsed.year,
        genre:saved.genre||parsed.genre,
        length:f.length||0,
        size:f.size||0,
        ...(saved.deezerUrl ? {deezerUrl: saved.deezerUrl} : {}),
      };
    });
    filtered=[...tracks];
    applySort();
    buildQueue();
    renderAll();
    updateCounts();
  }catch(e){
    console.error(e);
    const isNetwork = e instanceof TypeError && e.message.includes('fetch');
    document.getElementById('trackList').innerHTML=`<div style="color:var(--text2);padding:48px;text-align:center;">${isNetwork?'📡':'❌'} ${isNetwork?'Impossible de joindre Archive.org.<br><small style="color:var(--text3);">Vérifiez votre connexion internet.</small>':'Impossible de charger la bibliothèque.<br><small style="color:var(--text3);">' + e.message + '</small>'}</div>`;
    toast(isNetwork ? '📡 Connexion impossible' : 'Erreur de chargement', true);
  }
}

function updateCounts(){
  const albs=getAlbums(), arts=getArtists();
  document.getElementById('songCount').textContent=`${tracks.length} chanson${tracks.length>1?'s':''}`;
  document.getElementById('albumCount').textContent=`${albs.length} album${albs.length>1?'s':''}`;
  document.getElementById('artistCount').textContent=`${arts.length} artiste${arts.length>1?'s':''}`;
  updateFavBadge();
}

