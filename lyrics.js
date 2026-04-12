/* ══════════════════════════════════════════════
   LRC LYRICS — LRCLIB.NET
══════════════════════════════════════════════ */

function _getLrcCache(){ try{ return JSON.parse(localStorage.getItem(LRC_STORE)||'{}'); }catch{ return {}; } }
function _saveLrcCache(c){
  const keys = Object.keys(c);
  if(keys.length > 250){ keys.slice(0, keys.length-250).forEach(k => delete c[k]); }
  localStorage.setItem(LRC_STORE, JSON.stringify(c));
}
function _lrcKey(t){ return (String(t.artist||'')+'|'+String(t.title||'')).toLowerCase().trim(); }

async function fetchAndShowLrc(t){
  // Reset panel
  _lrcLines = []; _lrcPlain = ''; _lrcActiveIdx = -1;
  _renderLrcPanel(true); // show loading state

  const key = _lrcKey(t);
  const cache = _getLrcCache();

  if(cache[key]){
    const c = cache[key];
    if(c.noLyrics){
      // noLyrics expire après 7 jours → on réessaie
      const TTL = 7 * 24 * 3600 * 1000;
      if(!c.ts || Date.now() - c.ts < TTL){ _renderLrcPanel(); return; }
      // Expiré : supprimer et réessayer
      delete cache[key]; _saveLrcCache(cache);
    } else {
      _lrcLines = c.lines || [];
      _lrcPlain = c.plain || '';
      _renderLrcPanel();
      if(_lyricsOpen){ _lrcActiveIdx=-1; updateLrcHighlight(_activeAudio().currentTime); }
      return;
    }
  }

  // Titre nettoyé : retire les mentions feat./prod./remix/etc. pour une meilleure correspondance
  const cleanTitle = (t.title||'')
    .replace(/\s*[\(\[](feat|ft|with|avec|prod|version|remix|edit|instrumental|remaster|live)\.?\s[^\)\]]+[\)\]]/gi, '')
    .replace(/\s*[\(\[][^\)\]]*[\)\]]\s*$/g, '')  // retire les parenthèses finales
    .trim() || (t.title||'');

  let lines = [], plain = '';

  // ── Tentative 1 : lrclib /api/get exact match (titre original) ──
  try{
    const p = new URLSearchParams({ artist_name: t.artist||'', track_name: t.title||'' });
    if(t.album && t.album !== 'Sans album') p.set('album_name', t.album);
    const res = await fetch('https://lrclib.net/api/get?'+p, { signal: AbortSignal.timeout(8000) });
    if(res.ok){
      const data = await res.json();
      if(data.instrumental){
        _lrcPlain = '🎹 Instrumental';
      } else {
        lines = data.syncedLyrics ? _parseLrc(data.syncedLyrics) : [];
        plain = data.plainLyrics || '';
      }
    }
  }catch(e){ console.warn('[Arya LRC] lrclib get', e); }

  // ── Tentative 2 : lrclib /api/search avec titre nettoyé ──
  if(!lines.length && !plain && !_lrcPlain){
    try{
      const q = encodeURIComponent(((t.artist||'')+' '+(cleanTitle)).trim());
      const res2 = await fetch('https://lrclib.net/api/search?q='+q, { signal: AbortSignal.timeout(8000) });
      if(res2.ok){
        const arr = await res2.json();
        if(Array.isArray(arr) && arr.length){
          // Cherche le meilleur match sur le titre nettoyé
          const normCT = _normTitle(cleanTitle);
          const hit = arr.find(x => _normTitle(x.trackName||'') === normCT)
                   || arr.find(x => _normTitle(x.trackName||'').includes(normCT) || normCT.includes(_normTitle(x.trackName||'')))
                   || arr[0];
          if(hit){
            if(hit.instrumental){ _lrcPlain = '🎹 Instrumental'; }
            else {
              lines = hit.syncedLyrics ? _parseLrc(hit.syncedLyrics) : [];
              plain = hit.plainLyrics || '';
            }
          }
        }
      }
    }catch(e){ console.warn('[Arya LRC] lrclib search', e); }
  }

  // ── Tentative 3 : lrclib /api/search avec titre original (si nettoyé ≠ original) ──
  if(!lines.length && !plain && !_lrcPlain && cleanTitle !== t.title){
    try{
      const q3 = encodeURIComponent(((t.artist||'')+' '+(t.title||'')).trim());
      const res3 = await fetch('https://lrclib.net/api/search?q='+q3, { signal: AbortSignal.timeout(8000) });
      if(res3.ok){
        const arr3 = await res3.json();
        const hit3 = Array.isArray(arr3) && arr3[0];
        if(hit3 && !hit3.instrumental){
          lines = hit3.syncedLyrics ? _parseLrc(hit3.syncedLyrics) : [];
          plain = hit3.plainLyrics || '';
        }
      }
    }catch{}
  }

  // ── Tentative 4 : lyrics.ovh ──
  if(!lines.length && !plain && !_lrcPlain){
    try{
      const artist = encodeURIComponent(t.artist||'');
      const title  = encodeURIComponent(cleanTitle);
      const res4 = await fetch(`https://api.lyrics.ovh/v1/${artist}/${title}`, { signal: AbortSignal.timeout(8000) });
      if(res4.ok){
        const d = await res4.json();
        if(d.lyrics && d.lyrics.trim()) plain = d.lyrics.trim();
      }
    }catch(e4){ console.warn('[Arya LRC] lyrics.ovh', e4); }
  }

  // ── Tentative 5 : Genius (search API + scraping via CORS proxy) ──
  if(!lines.length && !plain && !_lrcPlain){
    try{
      // Étape 1 : recherche sur l'API Genius (pas de clé requise)
      const gq = encodeURIComponent(((t.artist||'')+' '+(cleanTitle)).trim());
      const gRes = await fetch(
        `https://genius.com/api/search/song?q=${gq}&per_page=5`,
        { signal: AbortSignal.timeout(8000) }
      );
      if(gRes.ok){
        const gData = await gRes.json();
        const hits = gData?.response?.sections?.[0]?.hits || [];
        if(hits.length){
          // Meilleur match artiste + titre
          const normA = _normArtist(t.artist||'');
          const normT = _normTitle(cleanTitle);
          const hit = hits.find(h => {
            const hA = _normArtist(h.result?.primary_artist?.name||'');
            const hT = _normTitle(h.result?.title||'');
            return hA === normA && (hT === normT || hT.includes(normT) || normT.includes(hT));
          }) || hits.find(h => _normArtist(h.result?.primary_artist?.name||'').includes(normA))
            || hits[0];

          if(hit?.result?.path){
            const gUrl = 'https://genius.com' + hit.result.path;
            // Étape 2 : récupère la page via CORS proxy
            const gProxies = [
              u => 'https://corsproxy.io/?'+encodeURIComponent(u),
              u => 'https://api.allorigins.win/get?url='+encodeURIComponent(u),
              u => 'https://corsproxy.io/?url='+encodeURIComponent(u),
              u => 'https://thingproxy.freeboard.io/fetch/'+u,
            ];
            for(const mkUrl of gProxies){
              try{
                const gPage = await fetch(mkUrl(gUrl), { signal: AbortSignal.timeout(10000) });
                if(!gPage.ok) continue;
                const raw = await gPage.text();
                let html; try{ const j=JSON.parse(raw); html=j.contents||raw; }catch{ html=raw; }
                if(!html || !html.includes('data-lyrics-container')) continue;
                const doc = new DOMParser().parseFromString(html, 'text/html');
                const containers = doc.querySelectorAll('[data-lyrics-container="true"]');
                if(!containers.length) continue;
                let lyr = '';
                containers.forEach(c => {
                  c.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
                  lyr += c.textContent.trim() + '\n\n';
                });
                lyr = lyr.trim();
                if(lyr.length > 50){ plain = lyr; break; }
              }catch{}
            }
          }
        }
      }
    }catch(e5){ console.warn('[Arya LRC] genius', e5); }
  }

  if(!lines.length && !plain && !_lrcPlain){
    // noLyrics avec timestamp pour expiration future
    cache[key] = { noLyrics: true, ts: Date.now() };
    _saveLrcCache(cache);
    _renderLrcPanel();
    return;
  }

  cache[key] = { lines, plain };
  _saveLrcCache(cache);

  _lrcLines = lines;
  _lrcPlain = plain || _lrcPlain;
  _renderLrcPanel();
  if(_lyricsOpen){ _lrcActiveIdx=-1; updateLrcHighlight(_activeAudio().currentTime); }

}

function _parseLrc(text){
  const lines = [];
  const re = /\[(\d{1,2}):(\d{2})\.(\d{2,3})\](.*)/g;
  let m;
  while((m = re.exec(text)) !== null){
    const time = parseInt(m[1])*60 + parseInt(m[2]) + (m[3].length===2 ? parseInt(m[3])/100 : parseInt(m[3])/1000);
    const txt = m[4].trim();
    if(txt) lines.push({ time, text: txt });
  }
  return lines.sort((a,b) => a.time-b.time);
}

function _renderLrcPanel(loading=false){
  const panel = document.getElementById('fsLyricsPanel');
  if(!panel) return;

  const closeBtn  = `<button class="lrc-close-btn" onclick="toggleLyricsPanel()" title="Fermer les paroles">✕</button>`;
  const refreshBtn = `<button class="lrc-refresh-btn" id="lrcRefreshBtn" onclick="refreshLrc()" title="Rafraîchir les paroles">↺ Rafraîchir</button>`;

  if(loading){
    panel.innerHTML = closeBtn + '<div class="lrc-loading">♪ Recherche des paroles…</div>';
    return;
  }

  if(_lrcLines.length){
    panel.innerHTML = closeBtn + _lrcLines.map((l,i) =>
      `<div class="lrc-line" id="lrc-${i}" onclick="fsSeekToLrc(${i})">${esc(l.text)}</div>`
    ).join('') + refreshBtn;
    return;
  }

  if(_lrcPlain){
    panel.innerHTML = closeBtn + `<div class="lrc-plain">${esc(_lrcPlain)}</div>` + refreshBtn;
    return;
  }

  panel.innerHTML = closeBtn
    + '<div class="lrc-empty">Paroles introuvables pour ce titre<br><span style="font-size:11px;color:var(--text3);">Sources : LRCLIB · Lyrics.ovh · Genius</span>'
    + '<div class="lrc-genius-row"><input class="lrc-genius-input" id="lrcGeniusInput" placeholder="Coller un lien Genius…" onkeydown="if(event.key===\'Enter\')loadGeniusUrl()"/>'
    + '<button class="lrc-genius-btn" id="lrcGeniusBtn" onclick="loadGeniusUrl()">▶</button></div>'
    + '</div>' + refreshBtn;
}

function updateLrcHighlight(cur){
  if(!_lrcLines.length) return;
  const panel = document.getElementById('fsLyricsPanel');
  if(!panel) return;

  let idx = -1;
  for(let i=0; i<_lrcLines.length; i++){
    if(_lrcLines[i].time <= cur) idx = i;
    else break;
  }

  if(idx === _lrcActiveIdx) return;
  _lrcActiveIdx = idx;

  panel.querySelectorAll('.lrc-line').forEach((el,i) => {
    el.classList.toggle('active', i === idx);
    el.classList.toggle('near',   i === idx+1 || i === idx-1);
  });

  if(idx >= 0){
    const el = document.getElementById('lrc-'+idx);
    if(el) el.scrollIntoView({ behavior:'smooth', block:'center' });
  }
}

function toggleLyricsPanel(){
  _lyricsOpen = !_lyricsOpen;
  const panel = document.getElementById('fsLyricsPanel');
  const btn   = document.getElementById('fsLyricsBtn');
  if(panel) panel.classList.toggle('open', _lyricsOpen);
  if(btn)   btn.classList.toggle('on', _lyricsOpen);
  if(_lyricsOpen){
    _lrcActiveIdx = -1;
    updateLrcHighlight(_activeAudio().currentTime);
  }
}

function fsSeekToLrc(idx){
  if(!_lrcLines[idx]) return;
  const aa = _activeAudio();
  if(aa) aa.currentTime = _lrcLines[idx].time;
}

async function refreshLrc(){
  if(currentId === null) return;
  const t = tracks.find(x => x.id === currentId);
  if(!t) return;

  // Animer le bouton
  const btn = document.getElementById('lrcRefreshBtn');
  if(btn){ btn.classList.add('spinning'); btn.style.pointerEvents='none'; }

  // Vider le cache pour cette chanson
  const key = _lrcKey(t);
  const cache = _getLrcCache();
  delete cache[key];
  _saveLrcCache(cache);

  // Re-fetch
  await fetchAndShowLrc(t);

  if(btn){ btn.classList.remove('spinning'); btn.style.pointerEvents=''; }
  toast('↺ Paroles rechargées');
}

/* ══════════════════════════════════════════════
   GENIUS URL DIRECT LOAD
══════════════════════════════════════════════ */
async function loadGeniusUrl(){
  const input = document.getElementById('lrcGeniusInput');
  const btn   = document.getElementById('lrcGeniusBtn');
  if(!input) return;
  const url = input.value.trim();
  if(!url.includes('genius.com')){ toast('⚠️ URL Genius invalide', true); return; }

  if(btn){ btn.disabled = true; btn.textContent = '…'; }
  _renderLrcPanel(true);

  const proxies = [
    u => 'https://corsproxy.io/?'+encodeURIComponent(u),
    u => 'https://api.allorigins.win/get?url='+encodeURIComponent(u),
    u => 'https://corsproxy.io/?url='+encodeURIComponent(u),
    u => 'https://thingproxy.freeboard.io/fetch/'+u,
  ];

  let plain = '';
  for(const mkProxy of proxies){
    try{
      const res = await fetch(mkProxy(url), { signal: AbortSignal.timeout(12000) });
      if(!res.ok) continue;
      const raw = await res.text();
      let html; try{ const j=JSON.parse(raw); html=j.contents||raw; }catch{ html=raw; }
      if(!html) continue;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const containers = doc.querySelectorAll('[data-lyrics-container="true"]');
      if(containers.length){
        let lyr = '';
        containers.forEach(c => {
          c.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
          lyr += c.textContent.trim() + '\n\n';
        });
        lyr = lyr.trim();
        if(lyr.length > 20){ plain = lyr; break; }
      }
      // fallback: cherche des balises communes
      if(!plain){
        const sel = doc.querySelector('.lyrics,.Lyrics__Root-sc,.lyrics-root');
        if(sel){ plain = sel.textContent.trim(); if(plain.length > 20) break; }
      }
    }catch{}
  }

  if(plain){
    // Sauvegarde dans le cache pour cette chanson
    if(currentId !== null){
      const t = tracks.find(x => x.id === currentId);
      if(t){
        const key = _lrcKey(t);
        const cache = _getLrcCache();
        cache[key] = { lines: [], plain, ts: Date.now() };
        _saveLrcCache(cache);
      }
    }
    _lrcPlain = plain;
    _renderLrcPanel();
    toast('✅ Paroles Genius chargées');
  } else {
    toast('⚠️ Impossible de lire la page Genius', true);
    _renderLrcPanel();
  }
  if(btn){ btn.disabled = false; btn.textContent = '▶'; }
}

