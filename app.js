// AE TV — Ultra PRO (New UI + Embedded Proxy same-origin)
const $ = id => document.getElementById(id);
const splash = $('splash'), login = $('login'), shell = $('shell');
const groupsEl = $('groups'), cardsEl = $('cards'), emptyEl = $('empty'), searchEl = $('search');
const playerOverlay = $('playerOverlay'), player = $('player'), nowTitle = $('nowTitle'), epgBox = $('epgBox');
const resumeBar = $('resumeBar'), resumeTimeEl = $('resumeTime'), settingsPanel = $('settingsPanel');

// Tabs
document.querySelectorAll('.mode').forEach(b=> b.addEventListener('click', ()=>{
  document.querySelectorAll('.mode').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.pane').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');
  (b.dataset.tab==='xtream' ? $('formXtream') : b.dataset.tab==='m3u' ? $('formM3U') : $('profilesPane')).classList.add('active');
}));

// State
let state = {
  view:'live',
  channels:[], live:[], movies:[], series:[],
  groups:[], currentGroup:'الكل', search:'',
  profile:null,
  epgIndex:{}, epgOffsetMin:0,
  settings: loadSettings(),
  lastStream: JSON.parse(localStorage.getItem('ae_last_stream_pro')||'null'),
  favorites: new Set(JSON.parse(localStorage.getItem('ae_favs_pro')||'[]')),
  protectedRegex:null,
  locked:true
};

applyTheme();
window.addEventListener('load', ()=> setTimeout(()=>{ splash.classList.add('hidden'); login.classList.remove('hidden'); renderProfiles(); }, 800));

// Settings
function loadSettings(){
  const def = { https:true, proxy:(window.PROXY_BASE||''), forceProxy:true, epg:'', epgOffset:0, autoplayLast:false, protectedWords:'Adult,XXX,+18', pin:'', amoled:false };
  try { return {...def, ...(JSON.parse(localStorage.getItem('ae_settings_pro')||'{}'))}; } catch { return def; }
}
function saveSettings(){ localStorage.setItem('ae_settings_pro', JSON.stringify(state.settings)); }
function applyTheme(){ document.documentElement.classList.toggle('amoled', !!state.settings?.amoled); }
$('s_save').onclick = ()=>{
  state.settings.https = $('s_https').checked;
  state.settings.proxy = $('s_proxy').value.trim();
  state.settings.epg = $('s_epg').value.trim();
  state.settings.epgOffset = Number($('s_epgOffset').value||0);
  state.settings.autoplayLast = $('s_autoplay').checked;
  state.settings.protectedWords = $('s_protected').value.trim();
  state.settings.pin = $('s_pin').value;
  state.settings.amoled = $('s_amoled').checked;
  saveSettings(); applyTheme(); alert('تم الحفظ');
};
$('s_reset').onclick = ()=>{ localStorage.removeItem('ae_settings_pro'); state.settings = loadSettings(); applyTheme(); };

function openSettings(){
  $('s_https').checked = state.settings.https;
  $('s_proxy').value = state.settings.proxy||'';
  $('s_epg').value = state.settings.epg||'';
  $('s_epgOffset').value = state.settings.epgOffset||0;
  $('s_autoplay').checked = !!state.settings.autoplayLast;
  $('s_protected').value = state.settings.protectedWords||'';
  $('s_pin').value = state.settings.pin||'';
  $('s_amoled').checked = !!state.settings.amoled;
  settingsPanel.classList.remove('hidden');
}
function closeSettings(){ settingsPanel.classList.add('hidden'); }

// Main nav
document.querySelectorAll('.tab').forEach(b=> b.addEventListener('click', ()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active')); b.classList.add('active');
  const v=b.dataset.v; if(v==='settings'){ openSettings(); } else { closeSettings(); }
  switchView(v);
}));

function switchView(v){ state.view=v; renderGroups(); applyFilter(); }
function sourceForView(){ if(state.view==='live') return state.live; if(state.view==='movies') return state.movies; if(state.view==='series') return state.series; if(state.view==='fav') return state.channels.filter(c=> state.favorites.has(c.url)); return state.channels; }

// Profiles
function loadProfiles(){ return JSON.parse(localStorage.getItem('ae_profiles_pro')||'[]'); }
function saveProfiles(x){ localStorage.setItem('ae_profiles_pro', JSON.stringify(x)); }
function renderProfiles(){
  const box = $('profilesList'); const list = loadProfiles(); box.innerHTML='';
  if(!list.length){ box.innerHTML='<div class="empty">لا توجد ملفات تعريف.</div>'; return; }
  list.forEach((p,i)=>{ const b=document.createElement('button'); b.className='group'; b.textContent=`${p.name||('ملف #'+(i+1))} — ${p.type.toUpperCase()}`; b.onclick=()=> handleLogin(p.url, p); box.appendChild(b); });
}
$('deleteProfiles').onclick=()=>{ localStorage.removeItem('ae_profiles_pro'); renderProfiles(); };

// Forms
$('formXtream').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const user = $('x_user').value.trim();
  const pass = $('x_pass').value.trim();
  const https = $('x_https').checked;
  const remember = $('x_remember').checked;
  const forceProxy = $('x_forceProxy').checked;
  const epgUrl = $('x_epg').value.trim() || state.settings.epg;
  const epgOffset = Number($('x_epgOffset').value || state.settings.epgOffset || 0);
  const err=$('x_error'); err.textContent='';
  if(!user||!pass){ err.textContent='أدخل اسم المستخدم وكلمة المرور.'; return; }
  const host = (window.DEFAULT_HOST||'mhdd1.com:8080').replace(/^https?:\/\//,'');
  const base = `${https?'https':'http'}://${host}`;
  const m3uUrl = `${base}/get.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&type=m3u_plus&output=ts`;
  const final = shouldProxy(m3uUrl, forceProxy) ? prox(m3uUrl) : m3uUrl;
  await handleLogin(final, { type:'xtream', base, user, pass, name:user, epgUrl, epgOffset, remember, forceProxy });
});

$('formM3U').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const url = $('m3u_url').value.trim();
  const forceProxy = $('m3u_forceProxy').checked;
  const epgUrl = $('m3u_epg').value.trim() || state.settings.epg;
  const epgOffset = Number($('m3u_epgOffset').value || state.settings.epgOffset || 0);
  const err=$('m3u_error'); err.textContent='';
  if(!url){ err.textContent='أدخل رابط M3U.'; return; }
  const final = shouldProxy(url, forceProxy) ? prox(url) : url;
  await handleLogin(final, { type:'m3u', url:final, name:'M3U', epgUrl, epgOffset, remember:false, forceProxy });
});

// Proxy utils
function shouldProxy(url, force=false){
  if (force || state.settings.forceProxy) return true;
  try{ const u = new URL(url, location.href); return u.origin !== location.origin; }catch{ return true; }
}
function prox(url){
  const base = (state.settings.proxy || window.PROXY_BASE || '').replace(/\/$/, '');
  const p = base ? `${base}` : ''; // same-origin: /proxy & /hls
  if (/\.m3u8(\?|$)/i.test(url)) return `${p}/hls?u=${encodeURIComponent(url)}`;
  return `${p}/proxy?u=${encodeURIComponent(url)}`;
}
async function fetchText(url){ const r=await fetch(url); if(!r.ok) throw new Error('HTTP '+r.status); return await r.text(); }

// Login core
async function handleLogin(m3uUrl, meta){
  try{
    const text = await fetchText(m3uUrl);
    if(!text.trim().startsWith('#EXTM3U')) throw new Error('الملف ليس M3U.');
    state.profile = {...meta, url:m3uUrl};
    if(meta.remember){ const L=loadProfiles(); L.push(state.profile); saveProfiles(L); }
    const entries = parseM3U(text);
    classify(entries);
    await maybeLoadEPG(meta.epgUrl, meta.epgOffset);
    state.protectedRegex = buildProtectedRegex(state.settings.protectedWords);
    state.locked = !!state.settings.pin;
    login.classList.add('hidden'); shell.classList.remove('hidden');
    attachGlobalKeys(); switchView('live');
    if(state.settings.autoplayLast && state.lastStream){
      const found = state.channels.find(x=> x.url===state.lastStream.url);
      if(found) play(found,{auto:true});
    }
  }catch(e){
    const tgt = meta.type==='xtream'?$('x_error'):$('m3u_error'); tgt.textContent = e.message;
  }
}

// Parse M3U
function attr(line,key){ const m=new RegExp(key+'="([^"]+)"').exec(line); return m?m[1]:''; }
function parseM3U(text){
  const lines = text.split('\n'); const out = [];
  for(let i=0;i<lines.length;i++){
    const L=lines[i];
    if(L.startsWith('#EXTINF')){
      const name=(L.split(',')[1]||'بدون اسم').trim();
      const logo=attr(L,'tvg-logo'); const tvgId=attr(L,'tvg-id'); const group=attr(L,'group-title')||'غير مصنف';
      const url=(lines[i+1]||'').trim();
      if(url) out.push({name,logo,tvgId,group,url:shouldProxy(url,true)?prox(url):url});
    }
  }
  return out;
}

// Classify
function classify(all){
  state.channels=all;
  const isMovie=(n,g)=>/(\\bVOD\\b|\\bMovies?\\b|\\bFilm\\b|\\bCinema\\b)/i.test(g)||/(\\b\\d{4}\\b)/.test(n);
  const isSeries=(n,g)=>/(\\bSeries?\\b|\\bShows?\\b|Episodes?)/i.test(g)||/(S\\d{1,2}E\\d{1,2})/i.test(n);
  state.movies=all.filter(x=>isMovie(x.name,x.group));
  state.series=all.filter(x=>isSeries(x.name,x.group));
  const set=new Set([...state.movies,...state.series]); state.live=all.filter(x=>!set.has(x));
}

// EPG
async function maybeLoadEPG(url, offsetMin){
  state.epgIndex={}; state.epgOffsetMin=offsetMin||0; const u=url||state.settings.epg; if(!u) return;
  try{
    let txt;
    if(u.endsWith('.gz')){ await loadPako(); const resp=await fetch(shouldProxy(u,true)?prox(u):u); const buf=new Uint8Array(await resp.arrayBuffer()); txt=window.pako.ungzip(buf,{to:'string'}); }
    else { txt=await fetchText(shouldProxy(u,true)?prox(u):u); }
    buildEpgIndex(txt);
  }catch(e){ console.warn('EPG load failed',e); }
}
function buildEpgIndex(xml){
  const programmes=[...xml.matchAll(/<programme[^>]*start="([^"]+)"[^>]*channel="([^"]+)"[^>]*>([\\s\\S]*?)<\\/programme>/g)];
  const titleRe=/<title[^>]*>([\\s\\S]*?)<\\/title>/; const descRe=/<desc[^>]*>([\\s\\S]*?)<\\/desc>/;
  const items=programmes.map(m=>{const start=m[1],ch=m[2],body=m[3]; const title=(titleRe.exec(body)||[])[1]||''; const desc=(descRe.exec(body)||[])[1]||''; return {ch,start,title,desc};});
  const byCh={}; items.forEach(p=>{ (byCh[p.ch]=byCh[p.ch]||[]).push(p); }); Object.keys(byCh).forEach(k=> byCh[k].sort((a,b)=>a.start.localeCompare(b.start))); state.epgIndex=byCh;
}
async function loadPako(){ if(window.pako) return; await new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js'; s.onload=res; s.onerror=()=>rej(new Error('تعذر تحميل pako')); document.head.appendChild(s); }); }

// View rendering
function renderGroups(){ const src=sourceForView(); const groups=['الكل',...Array.from(new Set(src.map(x=>x.group)))]; state.groups=groups; state.currentGroup='الكل'; groupsEl.innerHTML=''; groups.forEach(g=>{ if(state.locked && isProtected(g)) return; const b=document.createElement('button'); b.className='group'+(g==='الكل'?' active':''); b.textContent=g; b.onclick=()=>{ document.querySelectorAll('.group').forEach(x=>x.classList.remove('active')); b.classList.add('active'); state.currentGroup=g; applyFilter(); }; groupsEl.appendChild(b); }); }
function applyFilter(){ const src=sourceForView(); const list=src.filter(x=> (state.currentGroup==='الكل'||x.group===state.currentGroup) && (!state.search||x.name.toLowerCase().includes(state.search))); renderCards(list); emptyEl.classList.toggle('hidden', list.length>0); }
const CHUNK=200; async function renderCards(list){ cardsEl.innerHTML=''; let i=0; while(i<list.length){ const slice=list.slice(i,i+CHUNK); const frag=document.createDocumentFragment(); slice.forEach(x=>{ if(state.locked&&(isProtected(x.group)||isProtected(x.name))) return; const card=document.createElement('div'); card.className='cardx'; const img=x.logo||'https://via.placeholder.com/400x250?text=AE+TV'; const badge=state.favorites.has(x.url)?'<div class="badge">★</div>':''; card.innerHTML=`${badge}<img src="${img}" alt="${x.name}"><div class="title">${x.name}</div>`; card.onclick=()=>play(x); card.oncontextmenu=(ev)=>{ev.preventDefault(); toggleFav(x); card.querySelector('.badge')?.remove(); if(state.favorites.has(x.url)){ const b=document.createElement('div'); b.className='badge'; b.textContent='★'; card.appendChild(b);} }; frag.appendChild(card); }); cardsEl.appendChild(frag); i+=CHUNK; await new Promise(r=>requestAnimationFrame(r)); } }
searchEl.addEventListener('input', ()=>{ state.search=searchEl.value.toLowerCase(); applyFilter(); });

// Favorites + PIN
function toggleFav(e){ if(state.favorites.has(e.url)) state.favorites.delete(e.url); else state.favorites.add(e.url); localStorage.setItem('ae_favs_pro', JSON.stringify([...state.favorites])); }
function buildProtectedRegex(words){ const list=(words||'').split(',').map(w=>w.trim()).filter(Boolean); if(!list.length) return null; const esc=list.map(w=>w.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\$&')); return new RegExp('('+esc.join('|')+')','i'); }
function isProtected(text){ if(!state.protectedRegex) return false; return state.protectedRegex.test(text||''); }
function ensureUnlocked(onOk){
  if(!state.settings.pin || !state.locked){ onOk(); return; }
  const modal=$('pinModal'), pinInput=$('pinInput'), pinErr=$('pinError');
  pinErr.textContent=''; modal.classList.remove('hidden'); pinInput.value=''; pinInput.focus();
  const done=ok=>{ modal.classList.add('hidden'); pinErr.textContent=''; if(ok){ state.locked=false; onOk(); } };
  const check=()=>{ if(pinInput.value===state.settings.pin) done(true); else pinErr.textContent='PIN غير صحيح'; };
  $('pinOk').onclick=check; $('pinCancel').onclick=()=>done(false); pinInput.onkeydown=e=>{ if(e.key==='Enter') check(); if(e.key==='Escape') done(false); };
}

// Player + Resume + EPG + Download
async function ensureHls(){ if(window.Hls) return; await new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/hls.js@latest'; s.onload=res; s.onerror=()=>rej(new Error('تعذر تحميل hls.js')); document.head.appendChild(s); }); }
let currentEntry=null;
async function play(entry, opts={}){
  const act=()=>{
    currentEntry=entry; nowTitle.textContent=entry.name; playerOverlay.classList.remove('hidden');
    const raw = entry.url; const isHls = /\.m3u8(\?|$)/i.test(raw); const src = shouldProxy(raw,true)?prox(raw):raw;
    if(isHls && !player.canPlayType('application/vnd.apple.mpegurl')){ ensureHls().then(()=>{ const hls=new Hls(); hls.loadSource(src); hls.attachMedia(player); }); }
    else { player.src = src; }
    const key='pos_'+raw; const saved=Number(localStorage.getItem(key)||0);
    if(!opts.auto && saved>10){ resumeTimeEl.textContent=fmt(saved); resumeBar.classList.remove('hidden');
      $('resumeYes').onclick=()=>{ resumeBar.classList.add('hidden'); player.currentTime=saved; player.play().catch(()=>{}); };
      $('resumeNo').onclick=()=>{ resumeBar.classList.add('hidden'); player.currentTime=0; player.play().catch(()=>{}); };
    } else { resumeBar.classList.add('hidden'); player.play().catch(()=>{}); }
    state.lastStream={url:entry.url,name:entry.name}; localStorage.setItem('ae_last_stream_pro', JSON.stringify(state.lastStream));
    renderEPG(entry);
  };
  if(isProtected(entry.group)||isProtected(entry.name)) ensureUnlocked(act); else act();
}
$('closePlayer').onclick=()=>{ player.pause(); try{ player.src=''; }catch{} player.removeAttribute('src'); player.load(); playerOverlay.classList.add('hidden'); currentEntry=null; };
player.addEventListener('timeupdate', ()=>{ if(!currentEntry) return; const inVOD = state.movies.includes(currentEntry)||state.series.includes(currentEntry); if(!inVOD) return; const key='pos_'+currentEntry.url; localStorage.setItem(key, String(Math.floor(player.currentTime))); });
function fmt(sec){ const h=Math.floor(sec/3600), m=Math.floor((sec%3600)/60), s=sec%60; return [h,m,s].map(x=>String(x).padStart(2,'0')).join(':'); }
function renderEPG(entry){
  epgBox.textContent=''; if(!entry.tvgId||!state.epgIndex[entry.tvgId]) return; const list=state.epgIndex[entry.tvgId]; const now=Date.now();
  const parseTime=s=>{const y=+s.slice(0,4), m=+s.slice(4,6)-1, d=+s.slice(6,8), hh=+s.slice(8,10), mm=+s.slice(10,12), ss=+s.slice(12,14); const base=new Date(Date.UTC(y,m,d,hh,mm,ss)).getTime(); return base + (state.epgOffsetMin*60*1000);};
  const withTs=list.map(p=>({...p, ts:parseTime(p.start)})).sort((a,b)=>a.ts-b.ts); let cur=null, next=null;
  for(let i=0;i<withTs.length;i++){ if(withTs[i].ts<=now) cur=withTs[i]; if(withTs[i].ts>now){ next=withTs[i]; break;} }
  const fmtT=ts=> new Date(ts).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); const parts=[];
  if(cur) parts.push(`الآن: ${cur.title||''} (${fmtT(cur.ts)})`); if(next) parts.push(`التالي: ${next.title||''} (${fmtT(next.ts)})`); epgBox.textContent=parts.join(' • ');
}

// Download helpers
const downloadBtn = $('downloadBtn'); const hlsModal=$('hlsModal'), hlsUrlEl=$('hlsUrl'), hlsCmdEl=$('hlsCmd');
$('hlsClose').onclick=()=> hlsModal.classList.add('hidden');
$('hlsCopyUrl').onclick=()=>{ hlsUrlEl.select(); document.execCommand('copy'); };
$('hlsCopyCmd').onclick=()=>{ hlsCmdEl.select(); document.execCommand('copy'); };
function showHlsHelper(url){ const final=shouldProxy(url,true)?prox(url):url; hlsUrlEl.value=final; hlsCmdEl.value=`ffmpeg -i "${final}" -c copy "AE-TV-download.mp4"`; hlsModal.classList.remove('hidden'); }
async function saveBlob(url, filename){ const res=await fetch(url); if(!res.ok) throw new Error('HTTP '+res.status); const blob=await res.blob(); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 1000); }
downloadBtn.onclick=()=>{ if(!currentEntry) return; const raw=currentEntry.url; const final=shouldProxy(raw,true)?prox(raw):raw; if(/\.(mp4|mov|mkv|ts)(\?|$)/i.test(raw)){ saveBlob(final,(currentEntry.name||'AE-TV')+'.mp4').catch(e=>alert('فشل التحميل: '+e.message)); } else if (/\.m3u8(\?|$)/i.test(raw)){ showHlsHelper(raw); } else { saveBlob(final,(currentEntry.name||'AE-TV')+'.bin').catch(()=> showHlsHelper(raw)); } };

// Shortcuts
function attachGlobalKeys(){ window.onkeydown=(e)=>{ if(e.key==='Escape'){ if(!playerOverlay.classList.contains('hidden')) $('closePlayer').click(); } if(!playerOverlay.classList.contains('hidden')){ if(e.key===' '){ e.preventDefault(); player.paused?player.play():player.pause(); } if(e.key==='ArrowRight') player.currentTime+=10; if(e.key==='ArrowLeft') player.currentTime-=10; if(e.key==='ArrowUp') player.volume=Math.min(1, player.volume+0.05); if(e.key==='ArrowDown') player.volume=Math.max(0, player.volume-0.05); } }; }

// Protected / PIN
function buildProtectedRegex(words){ const list=(words||'').split(',').map(w=>w.trim()).filter(Boolean); if(!list.length) return null; const esc=list.map(w=>w.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\$&')); return new RegExp('('+esc.join('|')+')','i'); }
function isProtected(text){ if(!state.protectedRegex) return false; return state.protectedRegex.test(text||''); }

// Search
searchEl.addEventListener('input', ()=>{ state.search=searchEl.value.toLowerCase(); applyFilter(); });


// ---- Locked Build (Android) ----
if (window.LOCKED_BUILD) {
  // Remove Settings tab and panel
  document.querySelectorAll('.locked-hide').forEach(el=> el.remove());
  const settingsBtn = document.querySelector('.tab[data-v="settings"]');
  if (settingsBtn) settingsBtn.remove();
  const settingsPanelEl = document.getElementById('settingsPanel');
  if (settingsPanelEl) settingsPanelEl.remove();

  // Force secure defaults
  state.settings.https = true;
  state.settings.forceProxy = true;
  state.settings.proxy = ""; // same-origin scheme via Capacitor WebView
  saveSettings = function(){}; // no-op
}
