/* ═══════════════════════════════════════════
   UPLOAD TO ARCHIVE.ORG
═══════════════════════════════════════════ */
/* ═══════════════════════════════════════════
   UPLOAD TO ARCHIVE.ORG
   Queue item: { file, artist, title, status, progress, error }
   Filename envoyé : "Artiste - Titre.ext"
═══════════════════════════════════════════ */
let _uploadQueue = [];

/* ── Credentials ── */
function getUploadCreds(){
  try{ return JSON.parse(localStorage.getItem(ARCHIVE_CREDS_STORE)||'{}'); }catch{ return {}; }
}
function saveUploadCreds(){
  const ak = (document.getElementById('uploadAccessKey')?.value||'').trim();
  const sk = (document.getElementById('uploadSecretKey')?.value||'').trim();
  localStorage.setItem(ARCHIVE_CREDS_STORE, JSON.stringify({accessKey:ak,secretKey:sk}));
  updateUploadCredsStatus();
}
function loadUploadCreds(){
  const c = getUploadCreds();
  if(c.accessKey) document.getElementById('uploadAccessKey').value = c.accessKey;
  if(c.secretKey) document.getElementById('uploadSecretKey').value = c.secretKey;
  updateUploadCredsStatus();
}
function updateUploadCredsStatus(){
  const c = getUploadCreds();
  const ok = c.accessKey && c.secretKey;
  const el = document.getElementById('uploadCredsStatus');
  if(el){ el.textContent = ok ? '✅ configurées' : '⚠️ non configurées'; el.style.color = ok ? 'var(--green)' : 'var(--text3)'; }
}
function toggleUploadCreds(){
  const body = document.getElementById('uploadCredsBody');
  const arrow = document.getElementById('uploadCredsArrow');
  const open = body.classList.toggle('open');
  if(arrow) arrow.textContent = open ? '▲' : '▼';
  if(open) loadUploadCreds();
}

/* ── Filename helpers ── */
function getFileExt(name){ return (name.match(/\.(mp3|flac|ogg|wav|m4a)$/i)||[''])[0].toLowerCase(); }

// Parse n'importe quel nom de fichier pour en extraire artiste/titre
function parseUploadFilename(name){
  const base = name.replace(/\.(mp3|flac|ogg|wav|m4a)$/i,'').replace(/_/g,' ').trim();
  const dash = base.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if(dash) return { artist: dash[1].trim(), title: dash[2].trim() };
  return { artist: '', title: base };
}

// Nom final envoyé à Archive.org
function buildUploadFilename(item){
  const ext = getFileExt(item.file.name);
  const a = (item.artist||'').trim();
  const t = (item.title||'').trim();
  if(!a || !t) return null;
  return `${a} - ${t}${ext}`;
}

// Doublon : vérifie contre la bibliothèque ET la queue (hors doublons d'erreur)
// selfIdx : index de l'élément courant dans _uploadQueue à exclure (-1 = aucun, ex: avant push)
function isUploadDuplicate(finalName, selfIdx = -1){
  const lower = finalName.toLowerCase();
  if(tracks.some(t => t.filename.toLowerCase() === lower)) return 'biblio';
  if(_uploadQueue.some((x, i) => i !== selfIdx && buildUploadFilename(x)?.toLowerCase() === lower && x.status !== 'error')) return 'queue';
  return false;
}

/* ── Handlers ── */
function handleUploadDrop(e){
  e.preventDefault();
  document.getElementById('uploadDropzone').classList.remove('drag-over');
  const files = [...e.dataTransfer.files].filter(f => /\.(mp3|flac|ogg|wav|m4a)$/i.test(f.name));
  if(!files.length){ toast('Aucun fichier audio reconnu', true); return; }
  addFilesToUploadQueue(files);
}
function handleUploadFiles(fileList){
  const files = [...fileList].filter(f => /\.(mp3|flac|ogg|wav|m4a)$/i.test(f.name));
  if(!files.length){ toast('Aucun fichier audio reconnu', true); return; }
  addFilesToUploadQueue(files);
  document.getElementById('uploadFileInput').value = '';
}

function addFilesToUploadQueue(files){
  let added = 0, dupes = 0;
  files.forEach(f => {
    const parsed = parseUploadFilename(f.name);
    // Pré-vérif doublon avec le nom original si déjà bien formaté
    const item = { file:f, artist:parsed.artist, title:parsed.title, status:'pending', progress:0, error:'' };
    const finalName = buildUploadFilename(item);
    if(finalName){
      const dupeType = isUploadDuplicate(finalName);
      if(dupeType){ dupes++; return; }
    }
    _uploadQueue.push(item);
    added++;
  });
  if(dupes) toast(`🔁 ${dupes} doublon${dupes>1?'s':''} ignoré${dupes>1?'s':''}`, true);
  if(added) renderUploadQueue();
}

function removeFromUploadQueue(idx){
  if(_uploadQueue[idx]?.status === 'uploading') return;
  _uploadQueue.splice(idx, 1);
  renderUploadQueue();
}
function clearUploadQueue(){
  _uploadQueue = _uploadQueue.filter(x => x.status === 'uploading');
  renderUploadQueue();
}

// Appelé depuis les inputs inline dans la liste
function updateUploadItem(idx, field, value){
  if(!_uploadQueue[idx]) return;
  _uploadQueue[idx][field] = value;
  // Mettre à jour seulement le preview + warning, pas tout rerendre (évite de perdre le focus)
  const row = document.getElementById(`urow-${idx}`);
  if(!row) return;
  const preview = row.querySelector('.upload-filename-preview');
  const finalName = buildUploadFilename(_uploadQueue[idx]);
  if(preview){
    if(!finalName){
      preview.textContent = '⚠️ Artiste et titre requis';
      preview.className = 'upload-filename-preview dupe';
    } else {
      const dupeType = isUploadDuplicate(finalName, idx);
      if(dupeType === 'biblio'){
        preview.textContent = `🔁 Existe déjà dans la bibliothèque : ${finalName}`;
        preview.className = 'upload-filename-preview dupe';
      } else if(dupeType === 'queue'){
        preview.textContent = `🔁 Doublon dans la queue : ${finalName}`;
        preview.className = 'upload-filename-preview dupe';
      } else {
        preview.textContent = `→ ${finalName}`;
        preview.className = 'upload-filename-preview ok';
      }
    }
  }
  // Update start button
  _refreshUploadStartBtn();
}

function _refreshUploadStartBtn(){
  const startBtn = document.getElementById('uploadStartBtn');
  if(!startBtn) return;
  const hasUploading = _uploadQueue.some(x=>x.status==='uploading');
  const readyToSend = _uploadQueue.filter((x, i) => {
    if(x.status !== 'pending') return false;
    const fn = buildUploadFilename(x);
    return fn && !isUploadDuplicate(fn, i);
  }).length;
  startBtn.disabled = hasUploading || !readyToSend;
  startBtn.textContent = hasUploading ? '⏳ Envoi en cours…' : `📤 Envoyer${readyToSend>1?` (${readyToSend})`:''}`;
}

function renderUploadQueue(){
  const list = document.getElementById('uploadFileList');
  const actBar = document.getElementById('uploadActionsBar');
  const qInfo = document.getElementById('uploadQueueInfo');
  if(!list) return;

  if(!_uploadQueue.length){
    list.innerHTML = '';
    if(actBar) actBar.style.display = 'none';
    return;
  }

  const done   = _uploadQueue.filter(x=>x.status==='done').length;
  const errors = _uploadQueue.filter(x=>x.status==='error').length;
  const pending = _uploadQueue.filter(x=>x.status==='pending').length;

  list.innerHTML = _uploadQueue.map((item, idx) => {
    const fmtSize = item.file.size > 1048576
      ? (item.file.size/1048576).toFixed(1)+' Mo'
      : (item.file.size/1024).toFixed(0)+' Ko';
    const statusLabel = {pending:'',uploading:'Envoi…',done:'✅ Envoyé',error:'❌ Erreur'}[item.status];
    const editable = item.status === 'pending';
    const finalName = buildUploadFilename(item);
    const dupeType = finalName ? isUploadDuplicate(finalName, idx) : false;

    let previewText, previewClass;
    if(!finalName){ previewText='⚠️ Artiste et titre requis'; previewClass='dupe'; }
    else if(dupeType==='biblio'){ previewText=`🔁 Existe déjà : ${finalName}`; previewClass='dupe'; }
    else if(dupeType==='queue'){ previewText=`🔁 Doublon dans la queue : ${finalName}`; previewClass='dupe'; }
    else { previewText=`→ ${finalName}`; previewClass='ok'; }

    return `
      <div class="upload-file-row ${item.status}" id="urow-${idx}">
        <div class="upload-file-header">
          <div style="min-width:0;">
            <div class="upload-file-name">${esc(item.file.name)}</div>
            <div class="upload-file-size">${fmtSize}${item.error?` · <span style="color:var(--rose);">${esc(item.error)}</span>`:''}</div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
            ${statusLabel?`<span class="upload-file-status ${item.status}">${statusLabel}</span>`:''}
            ${item.status!=='uploading'?`<span class="upload-file-remove" onclick="removeFromUploadQueue(${idx})" title="Retirer">✕</span>`:''}
          </div>
        </div>

        ${editable ? `
        <div class="upload-file-fields">
          <div class="upload-field-group">
            <div class="upload-field-label">Artiste</div>
            <input class="upload-field-input${!item.artist?' warn':''}" value="${escAttr(item.artist)}"
              placeholder="Nom de l'artiste"
              oninput="updateUploadItem(${idx},'artist',this.value)"
              onclick="event.stopPropagation()">
          </div>
          <div class="upload-field-group">
            <div class="upload-field-label">Titre</div>
            <input class="upload-field-input${!item.title?' warn':''}" value="${escAttr(item.title)}"
              placeholder="Titre de la chanson"
              oninput="updateUploadItem(${idx},'title',this.value)"
              onclick="event.stopPropagation()">
          </div>
        </div>
        <div class="upload-filename-preview ${previewClass}">${previewText}</div>
        ` : `
        <div class="upload-filename-preview ${item.status==='done'?'ok':''}" style="margin-top:6px;">${finalName||''}</div>
        `}

        ${item.status==='uploading'||item.status==='done' ? `
          <div class="upload-progress-bg">
            <div class="upload-progress-fill" style="width:${item.progress}%;${item.status==='done'?'background:var(--green)':''}"></div>
          </div>` : ''}
      </div>`;
  }).join('');

  if(actBar) actBar.style.display = _uploadQueue.length ? 'flex' : 'none';
  if(qInfo) qInfo.textContent = `${_uploadQueue.length} fichier${_uploadQueue.length>1?'s':''} · ${done} envoyé${done>1?'s':''} · ${errors} erreur${errors>1?'s':''}`;
  _refreshUploadStartBtn();
}

async function startUpload(){
  const creds = getUploadCreds();
  if(!creds.accessKey || !creds.secretKey){
    const body = document.getElementById('uploadCredsBody');
    if(!body.classList.contains('open')) toggleUploadCreds();
    toast('⚠️ Configurez vos clés Archive.org d\'abord', true);
    return;
  }

  // Seulement les items valides, sans doublons
  const pending = _uploadQueue.filter((x, i) => {
    if(x.status !== 'pending') return false;
    const fn = buildUploadFilename(x);
    return fn && !isUploadDuplicate(fn, i);
  });

  if(!pending.length){
    toast('Aucun fichier prêt à envoyer (vérifiez artiste / titre / doublons)', true);
    return;
  }

  let successCount = 0, errorCount = 0;

  for(const item of pending){
    item.status = 'uploading';
    item.progress = 0;
    renderUploadQueue();
    try{
      await uploadFileToArchive(item, creds.accessKey, creds.secretKey);
      item.status = 'done';
      item.progress = 100;
      successCount++;
    }catch(e){
      item.status = 'error';
      item.error = e.message || 'Erreur inconnue';
      errorCount++;
    }
    renderUploadQueue();
  }

  const summary = document.getElementById('uploadSummary');
  if(summary){
    summary.classList.add('visible');
    const errPart = errorCount ? ' ⚠️ ' + errorCount + ' erreur' + (errorCount>1?'s':'') + '.' : '';
    summary.innerHTML = successCount
      ? `✅ <strong>${successCount} fichier${successCount>1?'s':''} envoyé${successCount>1?'s':''}</strong> dans <em>${ARCHIVE_ID}</em>.${errPart}<br>
         <span style="cursor:pointer;color:var(--accent);" onclick="fetchArchive();toast('🔄 Bibliothèque rechargée');">→ Actualiser la bibliothèque</span>`
      : `❌ Aucun fichier envoyé. Vérifiez vos clés et votre connexion.`;
  }

  if(successCount) toast(`✅ ${successCount} fichier${successCount>1?'s':''} envoyé${successCount>1?'s':''} !`);
  if(errorCount) toast(`⚠️ ${errorCount} erreur${errorCount>1?'s':''}`, true);
  if(successCount) setTimeout(fetchArchive, 2000);
}

function uploadFileToArchive(item, accessKey, secretKey){
  return new Promise((resolve, reject) => {
    const finalName = buildUploadFilename(item);
    if(!finalName) return reject(new Error('Artiste ou titre manquant'));

    // Renommer le fichier via le constructeur File
    const ext = getFileExt(item.file.name);
    const mimeMap = {'.mp3':'audio/mpeg','.flac':'audio/flac','.ogg':'audio/ogg','.wav':'audio/wav','.m4a':'audio/mp4'};
    const mime = mimeMap[ext] || item.file.type || 'audio/mpeg';
    const renamedFile = new File([item.file], finalName, { type: mime });

    const url = `https://s3.us.archive.org/${encodeURIComponent(ARCHIVE_ID)}/${encodeURIComponent(finalName)}`;
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Authorization', `LOW ${accessKey}:${secretKey}`);
    xhr.setRequestHeader('x-archive-auto-make-bucket', '1');
    xhr.setRequestHeader('x-amz-auto-make-bucket', '1');
    xhr.setRequestHeader('Content-Type', mime);
    xhr.upload.onprogress = (e) => {
      if(e.lengthComputable){
        item.progress = Math.round(e.loaded / e.total * 100);
        // Mise à jour légère : juste la barre
        const row = document.getElementById(`urow-${_uploadQueue.indexOf(item)}`);
        const fill = row?.querySelector('.upload-progress-fill');
        if(fill) fill.style.width = item.progress+'%';
      }
    };
    xhr.onload = () => {
      if(xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`HTTP ${xhr.status}`));
    };
    xhr.onerror  = () => reject(new Error('Erreur réseau'));
    xhr.ontimeout= () => reject(new Error('Timeout'));
    xhr.timeout  = 300000;
    xhr.send(renamedFile);
  });
}

