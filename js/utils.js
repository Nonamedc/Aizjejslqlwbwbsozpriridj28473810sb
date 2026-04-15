/* ═══════════════════════════════════════════
   UTILS
═══════════════════════════════════════════ */
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escAttr(s){ return esc(s).replace(/'/g,'&#39;'); }

function fmtTime(s){
  if(!s||isNaN(s)) return '0:00';
  const m=Math.floor(s/60), sec=String(Math.floor(s%60)).padStart(2,'0');
  return `${m}:${sec}`;
}

function fmtDuration(sec){
  sec = Math.floor(sec);
  if(sec < 60) return `${sec}s`;
  if(sec < 3600) return `${Math.floor(sec/60)} min`;
  const h = Math.floor(sec/3600);
  const m = Math.floor((sec%3600)/60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function relTime(ts){
  const d = Date.now() - ts;
  if(d < 60000) return "À l'instant";
  if(d < 3600000) return `Il y a ${Math.floor(d/60000)} min`;
  if(d < 86400000) return `Il y a ${Math.floor(d/3600000)}h`;
  if(d < 172800000) return 'Hier';
  return `Il y a ${Math.floor(d/86400000)} jours`;
}

const GRADS=[
  ['#d4a054','#c44d6e'],['#6366f1','#8b5cf6'],['#10b981','#059669'],
  ['#f59e0b','#ef4444'],['#3b82f6','#06b6d4'],['#ec4899','#f43f5e'],
  ['#84cc16','#22c55e'],['#f97316','#fb923c'],['#8b5cf6','#d946ef'],
  ['#14b8a6','#0ea5e9'],['#a855f7','#ec4899'],['#22d3ee','#3b82f6'],
];
function gradFor(str){
  let h=0; for(let i=0;i<str.length;i++) h=(h*31+str.charCodeAt(i))&0xffffffff;
  const g=GRADS[Math.abs(h)%GRADS.length];
  return `linear-gradient(135deg,${g[0]},${g[1]})`;
}

function toast(msg, err=false){
  const c=document.getElementById('toasts');
  const el=document.createElement('div');
  el.className='toast'+(err?' error':'');
  el.textContent=msg;
  c.appendChild(el);
  setTimeout(()=>el.remove(),3200);
}

/* ═══════════════════════════════════════════
   METADATA (localStorage)
═══════════════════════════════════════════ */
function getMeta(){ try{return JSON.parse(localStorage.getItem(META_STORE)||'{}')}catch{return{}} }
function saveMeta(m){ localStorage.setItem(META_STORE,JSON.stringify(m)); }
function getTrackMeta(fn){ return getMeta()[fn]||null; }
function setTrackMeta(fn,d){ const m=getMeta(); m[fn]={...m[fn],...d}; saveMeta(m); }
function clearTrackMeta(fn){ const m=getMeta(); delete m[fn]; saveMeta(m); }
