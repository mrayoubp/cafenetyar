var __freeze = Object.freeze;
var __defProp = Object.defineProperty;
var __template = (cooked, raw) => __freeze(__defProp(cooked, "raw", { value: __freeze(raw || cooked.slice()) }));

// native/ui.mjs
var _a;
var html = String.raw(_a || (_a = __template([`<!doctype html><html lang="fa" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>\u06A9\u0627\u0641\u06CC\u200C\u0646\u062A\u200C\u06CC\u0627\u0631 | \u0645\u062F\u06CC\u0631\u06CC\u062A \u06CC\u06A9\u067E\u0627\u0631\u0686\u0647</title><style>
:root{color-scheme:dark;--bg:#08151e;--surface:#102531;--line:#23414e;--text:#eaf4f7;--muted:#a1bdc9;--accent:#51d5dd}*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 15% 0,#173b4c 0,transparent 55%),var(--bg);color:var(--text);font:15px Tahoma,Arial,sans-serif;line-height:1.9}button,input,textarea,select{font:inherit}button,a{touch-action:manipulation}a{color:var(--accent);text-decoration:none}button,.button{cursor:pointer;border:1px solid var(--line);background:#1b3542;color:var(--text);padding:10px 17px;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;gap:8px}button:hover,.button:hover{border-color:var(--accent)}button:disabled{opacity:.5;cursor:wait}.primary{background:var(--accent);color:#06212c;border-color:var(--accent);font-weight:bold}.danger{color:#ffb6b6}header{border-bottom:1px solid var(--line);padding:18px 5%;display:flex;align-items:center;justify-content:space-between;background:#081923e8;gap:18px;flex-wrap:wrap}.brand{font-size:21px;font-weight:bold;display:flex;align-items:center;gap:12px}.mark{width:45px;height:45px;border:1px solid #73dce2;background:linear-gradient(140deg,#127e8f,#12394c);border-radius:14px;display:grid;place-items:center;color:white;font-size:18px}.logo{width:52px;height:52px;object-fit:contain;border-radius:12px}.small{font-size:12px;color:var(--muted)}.muted{color:var(--muted)}main{max-width:1280px;margin:28px auto;padding:0 24px}.shell{display:grid;grid-template-columns:220px minmax(0,1fr);gap:24px}aside{align-self:start;position:sticky;top:20px;background:#0e2330;border:1px solid var(--line);border-radius:20px;padding:12px}aside button{width:100%;background:transparent;border-color:transparent;justify-content:flex-start;margin:3px 0}aside button.selected{background:#1b414e;color:var(--accent);border-color:#2c626d}.card{background:linear-gradient(145deg,#132d3b,#0f2531);border:1px solid var(--line);border-radius:22px;padding:24px;margin-bottom:20px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:16px}.stat{font-size:32px;font-weight:bold;color:var(--accent)}h1,h2,h3,p{margin:0 0 14px}h1{font-size:28px}h2{font-size:20px}h3{font-size:17px}.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.between{justify-content:space-between}.hero{padding:70px 35px}.hero h1{font-size:clamp(32px,5vw,54px);max-width:800px}.hero p{max-width:650px;font-size:18px;color:var(--muted)}.pill{display:inline-block;background:#17414a;border:1px solid #2a6872;color:#a0f7e8;border-radius:30px;padding:2px 12px;font-size:12px}.notice{padding:14px;border:1px solid #725f29;background:#302b1e;color:#ffe6a4;border-radius:12px;margin:15px 0}.empty{padding:35px;text-align:center;color:var(--muted)}label{display:grid;gap:7px;font-size:13px;margin-bottom:15px}input,textarea,select{width:100%;border:1px solid #345363;border-radius:10px;padding:11px;background:#091c27;color:var(--text);outline:none}input:focus,textarea:focus,select:focus{border-color:var(--accent);box-shadow:0 0 0 2px #51d5dd20}textarea{min-height:130px;resize:vertical}input[type=checkbox]{width:18px;height:18px;accent-color:var(--accent)}.check{display:flex;align-items:center;gap:8px}.tablewrap{overflow:auto}table{width:100%;border-collapse:collapse;white-space:nowrap;font-size:13px}td,th{text-align:right;padding:14px 10px;border-bottom:1px solid var(--line)}th{color:var(--muted);font-weight:normal}td small{display:block;color:var(--muted)}dialog{background:#102631;color:var(--text);border:1px solid #3a6577;border-radius:24px;width:min(720px,95vw);max-height:90vh;padding:26px}dialog::backdrop{background:#0009;backdrop-filter:blur(4px)}dialog .close{float:left}.pre{white-space:pre-wrap;word-break:break-word}.error{background:#562a30;color:#ffdadf;padding:14px;border-radius:12px;margin:12px 0}#toast{position:fixed;bottom:25px;left:25px;max-width:90vw;background:#d3f5ed;color:#112b29;padding:15px 24px;border-radius:14px;z-index:20;display:none}footer{text-align:center;padding:30px;color:var(--muted);font-size:12px}.section-title{margin:22px 0}.split{display:grid;grid-template-columns:1fr 1fr;gap:16px}.login{max-width:580px;margin:70px auto}code{display:block;direction:ltr;word-break:break-all;background:#071922;padding:15px;border-radius:10px}details{border-bottom:1px solid var(--line);padding:12px 0}summary{cursor:pointer}button:focus-visible,a:focus-visible{outline:3px solid var(--accent);outline-offset:3px}@media(max-width:760px){main{padding:0 14px;margin:18px auto}.shell{display:block}aside{position:static;display:flex;overflow:auto;margin-bottom:20px;padding:8px}aside button{width:auto;white-space:nowrap}.card{padding:18px}.hero{padding:35px 20px}.split{grid-template-columns:1fr}header{padding:14px 18px}.brand{font-size:18px}h1{font-size:24px}}
</style></head><body><header><a class="brand" href="/" id="brand"><span class="mark">CY</span>\u06A9\u0627\u0641\u06CC\u200C\u0646\u062A\u200C\u06CC\u0627\u0631</a><div class="row"><a href="/">\u062E\u0627\u0646\u0647</a><a class="button" href="/admin">\u067E\u0646\u0644 \u0645\u062F\u06CC\u0631\u06CC\u062A</a><a class="button primary" href="/dashboard">\u0641\u0636\u0627\u06CC \u06A9\u0627\u0631\u06CC \u0645\u0646</a></div></header><main id="app"><div class="empty" role="status">\u062F\u0631 \u062D\u0627\u0644 \u062F\u0631\u06CC\u0627\u0641\u062A \u0627\u0637\u0644\u0627\u0639\u0627\u062A\u2026</div></main><footer>\u06A9\u0627\u0641\u06CC\u200C\u0646\u062A\u200C\u06CC\u0627\u0631 \xB7 \u0641\u0636\u0627\u06CC \u0645\u062F\u06CC\u0631\u06CC\u062A \u0634\u0645\u0627</footer><dialog id="modal"></dialog><div id="toast" role="status"></div><script>
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fa=n=>Number(n||0).toLocaleString('fa-IR'),date=n=>n?new Date(n).toLocaleString('fa-IR'):'\u062B\u0628\u062A \u0646\u0634\u062F\u0647';
let me=null,current='overview',settings={},records=[],siteContent=[];
const labels={'accounts.view':'\u0645\u0634\u0627\u0647\u062F\u0647 \u06A9\u0627\u0631\u0628\u0631\u0627\u0646','content.edit':'\u0648\u06CC\u0631\u0627\u06CC\u0634 \u0645\u062D\u062A\u0648\u0627\u06CC \u0633\u0627\u06CC\u062A','support.manage':'\u0645\u062F\u06CC\u0631\u06CC\u062A \u067E\u0634\u062A\u06CC\u0628\u0627\u0646\u06CC','audit.view':'\u0645\u0634\u0627\u0647\u062F\u0647 \u06AF\u0632\u0627\u0631\u0634 \u0641\u0639\u0627\u0644\u06CC\u062A','settings.edit':'\u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0633\u0627\u06CC\u062A'};
const roleLabel={owner:'\u0645\u0627\u0644\u06A9',admin:'\u0627\u062F\u0645\u06CC\u0646',customer:'\u0645\u0634\u062A\u0631\u06CC'};
function toast(s){$('#toast').textContent=s;$('#toast').style.display='block';setTimeout(()=>$('#toast').style.display='none',4500)}
async function api(path,data){const r=await fetch('/api/'+path,{method:data===undefined?'GET':'POST',headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});const v=await r.json();if(!r.ok){const e=new Error(v.error||'\u062E\u0637\u0627 \u062F\u0631 \u0627\u0631\u062A\u0628\u0627\u0637');e.status=r.status;throw e;}return v}
function error(e){toast(e.message);if(e.status===428)boot();if(e.status===401)login(e.message)}
function formData(form){return Object.fromEntries(new FormData(form))}
function modal(title,body){$('#modal').innerHTML='<button class="close" type="button" id="close">\u0628\u0633\u062A\u0646 \xD7</button><h2>'+esc(title)+'</h2>'+body;$('#close').onclick=()=>$('#modal').close();$('#modal').showModal()}
function field(name,label,value='',type='text'){return '<label>'+esc(label)+'<input name="'+name+'" type="'+type+'" value="'+esc(value)+'" '+(['name','email','phone','title','subject','amount'].includes(name)?'required':'')+'></label>'}
function allowed(p){return me?.user.role==='owner'||me?.user.permissions.includes(p)}
function cardContent(x){return '<article class="card"><span class="pill">'+({news:'\u062E\u0628\u0631',service:'\u062E\u062F\u0645\u0627\u062A',page:'\u0631\u0627\u0647\u0646\u0645\u0627',plan:'\u0627\u0634\u062A\u0631\u0627\u06A9'}[x.kind]||'\u0645\u062D\u062A\u0648\u0627')+'</span><h3 class="section-title">'+esc(x.title)+'</h3><p class="pre muted">'+esc(x.body)+'</p>'+(x.url?'<a href="'+esc(x.url)+'" target="_blank" rel="noopener noreferrer">\u0645\u0634\u0627\u0647\u062F\u0647 \u2190</a>':'')+'</article>'}
async function publicData(){const d=await api('public');settings=d.settings;siteContent=d.content;$('#brand').innerHTML=(settings.logo?'<img class="logo" src="'+esc(settings.logo)+'" alt="\u0644\u0648\u06AF\u0648\u06CC \u0633\u0627\u06CC\u062A">':'<span class="mark">CY</span>')+esc(settings.title||'\u06A9\u0627\u0641\u06CC\u200C\u0646\u062A\u200C\u06CC\u0627\u0631');}
async function landing(){await publicData();$('#app').innerHTML='<section class="card hero"><span class="pill">\u0647\u0645\u0631\u0627\u0647 \u0631\u0648\u0632\u0645\u0631\u0647\u0654 \u06A9\u0627\u0641\u06CC\u200C\u0646\u062A \u0634\u0645\u0627</span><h1 class="section-title">'+esc(settings.tagline||'\u0645\u062F\u06CC\u0631\u06CC\u062A \u0633\u0627\u062F\u0647\u200C\u062A\u0631\u060C \u0648\u0642\u062A \u0628\u06CC\u0634\u062A\u0631 \u0628\u0631\u0627\u06CC \u0645\u0634\u062A\u0631\u06CC\u0627\u0646')+'</h1><p>\u062D\u0633\u0627\u0628\u200C\u0647\u0627\u060C \u062F\u0631\u0622\u0645\u062F \u0648 \u0647\u0632\u06CC\u0646\u0647\u200C\u0647\u0627\u060C \u062E\u062F\u0645\u0627\u062A \u0648 \u0627\u0631\u062A\u0628\u0627\u0637 \u0628\u0627 \u0645\u0634\u062A\u0631\u06CC\u0627\u0646 \u0631\u0627 \u062F\u0631 \u06CC\u06A9 \u0641\u0636\u0627\u06CC \u0645\u0631\u062A\u0628 \u0645\u062F\u06CC\u0631\u06CC\u062A \u06A9\u0646\u06CC\u062F.</p><div class="row"><a class="button primary" href="/dashboard">\u0648\u0631\u0648\u062F \u0628\u0647 \u0641\u0636\u0627\u06CC \u06A9\u0627\u0631\u06CC \u2190</a><a class="button" href="/admin">\u0645\u062F\u06CC\u0631\u06CC\u062A \u0633\u0627\u06CC\u062A</a></div></section><div class="grid"><div class="card"><h3>\u062D\u0633\u0627\u0628\u200C\u0648\u06A9\u062A\u0627\u0628 \u0631\u0648\u0634\u0646</h3><p class="muted">\u062B\u0628\u062A \u062F\u0631\u0622\u0645\u062F \u0648 \u0647\u0632\u06CC\u0646\u0647 \u0628\u0627 \u0633\u0627\u0628\u0642\u0647\u0654 \u0642\u0627\u0628\u0644 \u0628\u0631\u0631\u0633\u06CC.</p></div><div class="card"><h3>\u062F\u0633\u062A\u0631\u0633\u06CC \u06A9\u0646\u062A\u0631\u0644\u200C\u0634\u062F\u0647</h3><p class="muted">\u062D\u0633\u0627\u0628\u200C\u0647\u0627 \u0648 \u0645\u062C\u0648\u0632\u0647\u0627 \u0628\u0627 \u062A\u0623\u06CC\u06CC\u062F \u0645\u0627\u0644\u06A9 \u0645\u062F\u06CC\u0631\u06CC\u062A \u0645\u06CC\u200C\u0634\u0648\u0646\u062F.</p></div><div class="card"><h3>\u067E\u0634\u062A\u06CC\u0628\u0627\u0646\u06CC \u062F\u0631 \u06A9\u0646\u0627\u0631 \u0634\u0645\u0627</h3><p class="muted">\u067E\u06CC\u0627\u0645 \u0648 \u067E\u0627\u0633\u062E \u062F\u0631 \u06CC\u06A9 \u06AF\u0641\u062A\u200C\u0648\u06AF\u0648\u06CC \u062B\u0628\u062A\u200C\u0634\u062F\u0647.</p></div></div>'+(siteContent.length?'<h2 class="section-title">\u062A\u0627\u0632\u0647\u200C\u0647\u0627 \u0648 \u062E\u062F\u0645\u0627\u062A</h2><div class="grid">'+siteContent.map(cardContent).join('')+'</div>':'')+(settings.contact?'<section class="card"><h2>\u062A\u0645\u0627\u0633 \u0628\u0627 \u0645\u0627</h2><p class="pre">'+esc(settings.contact)+'</p></section>':'');}
function login(message=''){me=null;$('#app').innerHTML='<section class="card login"><span class="pill">\u0648\u0631\u0648\u062F \u0627\u0645\u0646</span><h1 class="section-title">\u0628\u0647 \u06A9\u0627\u0641\u06CC\u200C\u0646\u062A\u200C\u06CC\u0627\u0631 \u062E\u0648\u0634 \u0622\u0645\u062F\u06CC\u062F</h1><p class="muted">\u0628\u0627 \u0647\u0645\u0627\u0646 \u062D\u0633\u0627\u0628 ChatGPT \u06A9\u0647 \u0627\u06CC\u0646 \u0633\u0627\u06CC\u062A \u0631\u0627 \u0633\u0627\u062E\u062A\u0647\u060C \u0648\u0627\u0631\u062F \u067E\u0646\u0644 \u0645\u0627\u0644\u06A9 \u0634\u0648\u06CC\u062F. \u062D\u0633\u0627\u0628\u200C\u0647\u0627\u06CC \u062F\u06CC\u06AF\u0631 \u0628\u0627\u06CC\u062F \u0642\u0628\u0644\u0627\u064B \u062A\u0648\u0633\u0637 \u0645\u0627\u0644\u06A9 \u0627\u0636\u0627\u0641\u0647 \u0634\u062F\u0647 \u0628\u0627\u0634\u0646\u062F.</p>'+(message?'<p class="notice">'+esc(message)+'</p>':'')+'<button class="primary" id="enter">\u0648\u0631\u0648\u062F \u0628\u0647 \u067E\u0646\u0644</button><p class="small section-title">\u0646\u06CC\u0627\u0632\u06CC \u0628\u0647 \u0631\u0645\u0632 \u0633\u0627\u06CC\u062A \u0642\u0628\u0644\u06CC \u06CC\u0627 \u0646\u0635\u0628 \u0628\u0631\u0646\u0627\u0645\u0647 \u0631\u0648\u06CC \u06A9\u0627\u0645\u067E\u06CC\u0648\u062A\u0631 \u0646\u06CC\u0633\u062A.</p><a target="_top" href="/signin-with-chatgpt?return_to=%2Fadmin">\u0648\u0631\u0648\u062F \u06CC\u0627 \u062A\u063A\u06CC\u06CC\u0631 \u062D\u0633\u0627\u0628 ChatGPT</a></section>';$('#enter').onclick=async()=>{try{$('#enter').disabled=true;await api('session',{});await boot()}catch(e){login(e.message)}}}
async function security(){
 $('#app').innerHTML='<section class="card login"><span class="pill">\u0627\u0645\u0646\u06CC\u062A \u062D\u0633\u0627\u0628 \u0645\u0627\u0644\u06A9</span><h1 class="section-title">\u062A\u0623\u06CC\u06CC\u062F \u062F\u0648\u0645\u0631\u062D\u0644\u0647\u200C\u0627\u06CC</h1><p class="muted">\u0628\u0631\u0627\u06CC \u0645\u062D\u0627\u0641\u0638\u062A \u0627\u0632 \u067E\u0646\u0644 \u0645\u0627\u0644\u06A9\u060C \u06A9\u062F \u0634\u0634\u200C\u0631\u0642\u0645\u06CC \u0628\u0631\u0646\u0627\u0645\u0647\u0654 Authenticator \u0644\u0627\u0632\u0645 \u0627\u0633\u062A.</p><div id="setup"></div><form id="verify"><label>\u06A9\u062F \u0634\u0634\u200C\u0631\u0642\u0645\u06CC<input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required dir="ltr"></label><button class="primary">\u062A\u0623\u06CC\u06CC\u062F \u0648 \u0648\u0631\u0648\u062F</button><p id="mfaError" class="error" hidden></p></form></section>';
 if(!me.mfaEnabled){const d=await api('mfa/setup',{});$('#setup').innerHTML='<ol><li>\u062F\u0631 Google Authenticator \u06CC\u0627 Microsoft Authenticator \u06AF\u0632\u06CC\u0646\u0647\u0654 \u0627\u0641\u0632\u0648\u062F\u0646 \u062D\u0633\u0627\u0628 \u0628\u0627 \u06A9\u0644\u06CC\u062F \u0631\u0627\u0647\u200C\u0627\u0646\u062F\u0627\u0632\u06CC \u0631\u0627 \u0627\u0646\u062A\u062E\u0627\u0628 \u06A9\u0646\u06CC\u062F.</li><li>\u0646\u0627\u0645 \u062D\u0633\u0627\u0628 \u0631\u0627 \xAB\u06A9\u0627\u0641\u06CC\u200C\u0646\u062A\u200C\u06CC\u0627\u0631\xBB \u0648 \u0646\u0648\u0639 \u0622\u0646 \u0631\u0627 \xAB\u0632\u0645\u0627\u0646\u200C\u0645\u062D\u0648\u0631\xBB \u0628\u06AF\u0630\u0627\u0631\u06CC\u062F.</li><li>\u0627\u06CC\u0646 \u06A9\u0644\u06CC\u062F \u0631\u0627 \u0648\u0627\u0631\u062F \u06A9\u0646\u06CC\u062F \u0648 \u0633\u067E\u0633 \u06A9\u062F \u062A\u0648\u0644\u06CC\u062F\u0634\u062F\u0647 \u0631\u0627 \u067E\u0627\u06CC\u06CC\u0646 \u0628\u0646\u0648\u06CC\u0633\u06CC\u062F.</li></ol><code>'+esc(d.secret)+'</code><p class="small">\u0627\u06CC\u0646 \u06A9\u0644\u06CC\u062F \u0631\u0627 \u062E\u0635\u0648\u0635\u06CC \u0646\u06AF\u0647 \u062F\u0627\u0631\u06CC\u062F\u061B \u0622\u0646 \u0631\u0627 \u062F\u0631 \u0686\u062A \u0646\u0641\u0631\u0633\u062A\u06CC\u062F.</p>';}
 $('#verify').onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;try{await api('mfa/verify',formData(e.target));await boot()}catch(err){$('#mfaError').hidden=false;$('#mfaError').textContent=err.message;b.disabled=false}};
}
const nav=[['overview','\u0646\u0645\u0627\u06CC \u06A9\u0644\u06CC',null],['accounts','\u06A9\u0627\u0631\u0628\u0631\u0627\u0646 \u0648 \u0627\u062F\u0645\u06CC\u0646\u200C\u0647\u0627','accounts.view'],['content','\u0645\u062D\u062A\u0648\u0627\u06CC \u0633\u0627\u06CC\u062A','content.edit'],['tickets','\u067E\u0634\u062A\u06CC\u0628\u0627\u0646\u06CC','support.manage'],['audit','\u06AF\u0632\u0627\u0631\u0634 \u0641\u0639\u0627\u0644\u06CC\u062A','audit.view'],['settings','\u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0648 \u0644\u0648\u06AF\u0648','settings.edit'],['transactions','\u062F\u0641\u062A\u0631 \u0645\u0627\u0644\u06CC','self'],['profile','\u062D\u0633\u0627\u0628 \u0645\u0646','self']];
function shell(){const admin=me.user.role!=='customer';let items=nav.filter(x=>x[2]==='self'||(admin&&(x[2]===null||allowed(x[2]))));if(!admin)items.unshift(['tickets','\u067E\u0634\u062A\u06CC\u0628\u0627\u0646\u06CC','self']);if(!items.some(x=>x[0]===current))current=items[0][0];$('#app').innerHTML='<div class="row between" style="margin-bottom:20px"><div><h1>\u0633\u0644\u0627\u0645\u060C '+esc(me.user.name)+'</h1><span class="muted">'+roleLabel[me.user.role]+' \xB7 \u06A9\u0627\u0641\u06CC\u200C\u0646\u062A\u200C\u06CC\u0627\u0631</span></div><span class="pill">\u062D\u0633\u0627\u0628 \u0645\u062A\u0635\u0644</span></div><div class="shell"><aside>'+items.map(x=>'<button data-tab="'+x[0]+'" class="'+(current===x[0]?'selected':'')+'">'+x[1]+'</button>').join('')+'</aside><section id="view"><div class="empty">\u062F\u0631 \u062D\u0627\u0644 \u062F\u0631\u06CC\u0627\u0641\u062A\u2026</div></section></div>';document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{current=b.dataset.tab;shell();loadView().catch(error)});}
async function loadView(){const v=$('#view');
 if(current==='overview'){const d=await api('overview');v.innerHTML='<div class="grid">'+[['accounts','\u062D\u0633\u0627\u0628\u200C\u0647\u0627'],['admins','\u0645\u062F\u06CC\u0631\u0627\u0646'],['tickets','\u062A\u06CC\u06A9\u062A \u0628\u0627\u0632'],['content','\u0645\u062D\u062A\u0648\u0627\u06CC \u0645\u0646\u062A\u0634\u0631\u0634\u062F\u0647']].filter(x=>d[x[0]]!==undefined).map(x=>'<div class="card"><p class="muted">'+x[1]+'</p><div class="stat">'+fa(d[x[0]])+'</div></div>').join('')+'</div><section class="card"><h2>\u067E\u0646\u0644 \u0634\u0645\u0627 \u0622\u0645\u0627\u062F\u0647\u0654 \u0645\u062F\u06CC\u0631\u06CC\u062A \u0627\u0633\u062A</h2><p class="muted">\u0627\u0632 \u0641\u0647\u0631\u0633\u062A \u06A9\u0646\u0627\u0631 \u0635\u0641\u062D\u0647 \u06A9\u0627\u0631\u0628\u0631\u0627\u0646 \u0631\u0627 \u0627\u0636\u0627\u0641\u0647 \u06A9\u0646\u06CC\u062F\u060C \u062F\u0633\u062A\u0631\u0633\u06CC\u200C\u0647\u0627 \u0631\u0627 \u062A\u0639\u06CC\u06CC\u0646 \u06A9\u0646\u06CC\u062F \u0648 \u0645\u062D\u062A\u0648\u0627\u06CC \u0633\u0627\u06CC\u062A \u0631\u0627 \u0628\u0647\u200C\u0631\u0648\u0632 \u0646\u06AF\u0647 \u062F\u0627\u0631\u06CC\u062F.</p><div class="notice">\u0627\u06CC\u0646 \u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 \u062C\u062F\u06CC\u062F \u0627\u0633\u062A\u061B \u0627\u0637\u0644\u0627\u0639\u0627\u062A \u062D\u0633\u0627\u0628\u200C\u0647\u0627 \u0648 \u062A\u0631\u0627\u06A9\u0646\u0634\u200C\u0647\u0627\u06CC \u0633\u0631\u0648\u0631 \u0642\u0628\u0644\u06CC \u0645\u0646\u062A\u0642\u0644 \u0646\u0634\u062F\u0647\u200C\u0627\u0646\u062F. \u0648\u0631\u0648\u062F \u067E\u06CC\u0627\u0645\u06A9\u06CC \u0648 \u067E\u0631\u062F\u0627\u062E\u062A \u0622\u0646\u0644\u0627\u06CC\u0646 \u0647\u0646\u0648\u0632 \u0645\u062A\u0635\u0644 \u0646\u06CC\u0633\u062A\u0646\u062F.</div><a href="/" target="_blank">\u0645\u0634\u0627\u0647\u062F\u0647 \u0633\u0627\u06CC\u062A \u2190</a></section>';}
 if(current==='accounts'){records=await api('accounts');v.innerHTML='<div class="card"><div class="row between"><h2>\u06A9\u0627\u0631\u0628\u0631\u0627\u0646 \u0648 \u0627\u062F\u0645\u06CC\u0646\u200C\u0647\u0627</h2>'+(me.user.role==='owner'?'<button class="primary" id="newAccount">\u0627\u0641\u0632\u0648\u062F\u0646 \u062D\u0633\u0627\u0628 +</button>':'')+'</div><p class="small">\u0648\u0631\u0648\u062F \u0628\u0627 \u0627\u06CC\u0645\u06CC\u0644 \u062D\u0633\u0627\u0628 ChatGPT \u0627\u0646\u062C\u0627\u0645 \u0645\u06CC\u200C\u0634\u0648\u062F\u061B \u0645\u0648\u0628\u0627\u06CC\u0644\u060C \u0627\u0637\u0644\u0627\u0639\u0627\u062A \u062A\u0645\u0627\u0633 \u0627\u0633\u062A. \u0633\u0627\u06CC\u062A \u0641\u0639\u0644\u0627\u064B \u0641\u0642\u0637 \u0628\u0631\u0627\u06CC \u0645\u0627\u0644\u06A9 \u0642\u0627\u0628\u0644 \u0645\u0634\u0627\u0647\u062F\u0647 \u0627\u0633\u062A.</p><label>\u062C\u0633\u062A\u200C\u0648\u062C\u0648<input id="searchAccounts" placeholder="\u0646\u0627\u0645\u060C \u0645\u0648\u0628\u0627\u06CC\u0644 \u06CC\u0627 \u0627\u06CC\u0645\u06CC\u0644"></label><div id="accountTable"></div></div>';function table(term=''){const rows=records.filter(x=>(x.name+x.phone+x.email).toLowerCase().includes(term.toLowerCase()));$('#accountTable').innerHTML='<div class="tablewrap"><table><thead><tr><th>\u06A9\u0627\u0631\u0628\u0631</th><th>\u0646\u0642\u0634 / \u0648\u0636\u0639\u06CC\u062A</th><th>\u0622\u062E\u0631\u06CC\u0646 \u0648\u0631\u0648\u062F</th><th>\u0646\u0634\u0633\u062A</th><th>\u0639\u0645\u0644\u06CC\u0627\u062A</th></tr></thead><tbody>'+rows.map(x=>'<tr><td>'+esc(x.name)+'<small dir="ltr">'+esc(x.email)+'<br>'+esc(x.phone)+'</small></td><td>'+roleLabel[x.role]+'<small>'+(x.active?'\u0641\u0639\u0627\u0644':'\u0645\u0633\u062F\u0648\u062F')+'</small></td><td>'+date(x.last_login)+'</td><td>'+fa(x.sessions)+'</td><td>'+(me.user.role==='owner'&&x.role!=='owner'?'<button data-edit="'+x.id+'">\u0648\u06CC\u0631\u0627\u06CC\u0634</button>':'\u2014')+'</td></tr>').join('')+'</tbody></table></div>';document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>accountEditor(records.find(x=>x.id===b.dataset.edit)))}table();$('#searchAccounts').oninput=e=>table(e.target.value);if($('#newAccount'))$('#newAccount').onclick=()=>accountEditor();}
 if(current==='content'){records=await api('content');v.innerHTML='<div class="row between"><h2>\u0645\u062D\u062A\u0648\u0627 \u0648 \u062E\u062F\u0645\u0627\u062A \u0633\u0627\u06CC\u062A</h2><button id="newContent" class="primary">\u0645\u062D\u062A\u0648\u0627\u06CC \u062C\u062F\u06CC\u062F +</button></div><p class="small">\u0645\u062D\u062A\u0648\u0627\u06CC \u0645\u0646\u062A\u0634\u0631\u0634\u062F\u0647 \u0628\u0644\u0627\u0641\u0627\u0635\u0644\u0647 \u062F\u0631 \u0635\u0641\u062D\u0647\u0654 \u0627\u0635\u0644\u06CC \u0646\u0645\u0627\u06CC\u0634 \u062F\u0627\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F.</p><div class="grid">'+records.map(x=>'<article class="card"><span class="pill">'+(x.published?'\u0645\u0646\u062A\u0634\u0631\u0634\u062F\u0647':'\u067E\u06CC\u0634\u200C\u0646\u0648\u06CC\u0633')+'</span><h3 class="section-title">'+esc(x.title)+'</h3><p class="muted">'+esc(x.body.slice(0,120))+'</p><button data-content="'+x.id+'">\u0648\u06CC\u0631\u0627\u06CC\u0634</button></article>').join('')+'</div>'+(!records.length?'<div class="card empty">\u0647\u0646\u0648\u0632 \u0645\u062D\u062A\u0648\u0627\u06CC\u06CC \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A.</div>':'');$('#newContent').onclick=()=>contentEditor();document.querySelectorAll('[data-content]').forEach(b=>b.onclick=()=>contentEditor(records.find(x=>x.id===b.dataset.content)));}
 if(current==='settings'){const d=await api('settings');v.innerHTML='<form id="settingsForm" class="card"><h2>\u0647\u0648\u06CC\u062A \u0648 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0633\u0627\u06CC\u062A</h2>'+field('title','\u0646\u0627\u0645 \u0633\u0627\u06CC\u062A',d.title||'\u06A9\u0627\u0641\u06CC\u200C\u0646\u062A\u200C\u06CC\u0627\u0631')+field('tagline','\u0645\u062A\u0646 \u0627\u0635\u0644\u06CC \u0635\u0641\u062D\u0647',d.tagline||'')+'<label>\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u062A\u0645\u0627\u0633<textarea name="contact">'+esc(d.contact||'')+'</textarea></label><label>\u0644\u0648\u06AF\u0648 \xB7 PNG\u060C JPG \u06CC\u0627 WebP<input type="file" id="logoFile" accept="image/png,image/jpeg,image/webp"></label>'+(d.logo?'<img class="logo" src="'+esc(d.logo)+'" alt="\u0644\u0648\u06AF\u0648\u06CC \u0641\u0639\u0644\u06CC">':'')+'<button class="primary">\u0630\u062E\u06CC\u0631\u0647 \u062A\u063A\u06CC\u06CC\u0631\u0627\u062A</button><p class="small">\u062A\u063A\u06CC\u06CC\u0631\u0627\u062A \u0628\u062F\u0648\u0646 \u0627\u0646\u062A\u0634\u0627\u0631 \u062F\u0648\u0628\u0627\u0631\u0647\u0654 \u06A9\u062F \u0631\u0648\u06CC \u0633\u0627\u06CC\u062A \u0627\u0639\u0645\u0627\u0644 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F.</p></form>';$('#settingsForm').onsubmit=async e=>{e.preventDefault();try{const values=formData(e.target);values.logo=d.logo||'';const file=$('#logoFile').files[0];if(file){if(file.size>1000000)throw Error('\u062D\u062C\u0645 \u062A\u0635\u0648\u06CC\u0631 \u0628\u0627\u06CC\u062F \u06A9\u0645\u062A\u0631 \u0627\u0632 \u06CC\u06A9 \u0645\u06AF\u0627\u0628\u0627\u06CC\u062A \u0628\u0627\u0634\u062F.');values.logo=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)})}await api('settings',values);toast('\u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.');await publicData()}catch(err){error(err)}};}
 if(current==='audit'){v.innerHTML='<div class="card"><h2>\u06AF\u0632\u0627\u0631\u0634 \u0641\u0639\u0627\u0644\u06CC\u062A \u0645\u062F\u06CC\u0631\u0627\u0646</h2><form id="auditFilter" class="row"><input name="q" placeholder="\u0646\u0627\u0645 \u06CC\u0627 \u0639\u0645\u0644\u06CC\u0627\u062A" style="flex:1"><label>\u0627\u0632 \u062A\u0627\u0631\u06CC\u062E<input type="date" name="from"></label><label>\u062A\u0627 \u062A\u0627\u0631\u06CC\u062E<input type="date" name="to"></label><button>\u0641\u06CC\u0644\u062A\u0631</button></form><div id="logs"></div></div>';async function logs(params=''){const list=await api('audit'+params);$('#logs').innerHTML=list.map(x=>'<details><summary>'+esc(x.actor_name)+' \xB7 '+esc(x.action)+' <span class="small">'+date(x.created_at)+'</span></summary><pre class="pre small">'+esc(JSON.stringify(JSON.parse(x.detail),null,2))+'</pre></details>').join('')||'<div class="empty">\u06AF\u0632\u0627\u0631\u0634\u06CC \u062F\u0631 \u0627\u06CC\u0646 \u0628\u0627\u0632\u0647 \u0646\u06CC\u0633\u062A.</div>'}await logs();$('#auditFilter').onsubmit=async e=>{e.preventDefault();const d=formData(e.target),params=new URLSearchParams({q:d.q,from:d.from?String(new Date(d.from+'T00:00:00+03:30').getTime()):'0',to:d.to?String(new Date(d.to+'T23:59:59+03:30').getTime()):String(Date.now())});try{await logs('?'+params)}catch(err){error(err)}};}
 if(current==='transactions'){const list=await api('transactions'),income=list.filter(x=>x.kind==='income').reduce((n,x)=>n+x.amount,0),expense=list.filter(x=>x.kind==='expense').reduce((n,x)=>n+x.amount,0);v.innerHTML='<div class="grid"><div class="card">\u062F\u0631\u0622\u0645\u062F \u062B\u0628\u062A\u200C\u0634\u062F\u0647<div class="stat">'+fa(income)+'</div><small>\u062A\u0648\u0645\u0627\u0646</small></div><div class="card">\u0647\u0632\u06CC\u0646\u0647 \u062B\u0628\u062A\u200C\u0634\u062F\u0647<div class="stat">'+fa(expense)+'</div><small>\u062A\u0648\u0645\u0627\u0646</small></div></div><form class="card" id="moneyForm"><h2>\u062B\u0628\u062A \u062F\u0631\u0622\u0645\u062F \u06CC\u0627 \u0647\u0632\u06CC\u0646\u0647</h2><div class="split">'+field('title','\u0634\u0631\u062D')+field('amount','\u0645\u0628\u0644\u063A \u0628\u0647 \u062A\u0648\u0645\u0627\u0646','','number')+'</div><label>\u0646\u0648\u0639<select name="kind"><option value="income">\u062F\u0631\u0622\u0645\u062F</option><option value="expense">\u0647\u0632\u06CC\u0646\u0647</option></select></label><button class="primary">\u062B\u0628\u062A \u062A\u0631\u0627\u06A9\u0646\u0634</button></form><div class="card tablewrap"><h2>\u0622\u062E\u0631\u06CC\u0646 \u062A\u0631\u0627\u06A9\u0646\u0634\u200C\u0647\u0627</h2><table><thead><tr><th>\u0634\u0631\u062D</th><th>\u0646\u0648\u0639</th><th>\u0645\u0628\u0644\u063A (\u062A\u0648\u0645\u0627\u0646)</th><th>\u0632\u0645\u0627\u0646</th></tr></thead><tbody>'+list.map(x=>'<tr><td>'+esc(x.title)+'</td><td>'+(x.kind==='income'?'\u062F\u0631\u0622\u0645\u062F':'\u0647\u0632\u06CC\u0646\u0647')+'</td><td>'+fa(x.amount)+'</td><td>'+date(x.created_at)+'</td></tr>').join('')+'</tbody></table>'+(!list.length?'<p class="empty">\u062A\u0631\u0627\u06A9\u0646\u0634\u06CC \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A.</p>':'')+'</div>';$('#moneyForm').onsubmit=async e=>{e.preventDefault();try{await api('transactions',formData(e.target));toast('\u062B\u0628\u062A \u0634\u062F.');await loadView()}catch(err){error(err)}};}
 if(current==='tickets'){const list=await api('tickets');v.innerHTML='<div class="row between"><h2>\u067E\u0634\u062A\u06CC\u0628\u0627\u0646\u06CC</h2><button id="newTicket">\u067E\u06CC\u0627\u0645 \u062C\u062F\u06CC\u062F +</button></div>'+list.map(x=>'<article class="card"><div class="row between"><h3>'+esc(x.subject)+'</h3><span class="pill">'+(x.status==='closed'?'\u0628\u0633\u062A\u0647\u200C\u0634\u062F\u0647':'\u0628\u0627\u0632')+'</span></div><p class="small">'+esc(x.name||me.user.name)+' \xB7 '+date(x.updated_at)+'</p><p class="pre">'+esc(x.body)+'</p>'+(x.reply?'<div class="notice pre">\u067E\u0627\u0633\u062E: '+esc(x.reply)+'</div>':'')+(allowed('support.manage')?'<button data-ticket="'+x.id+'">\u067E\u0627\u0633\u062E</button>':'')+'</article>').join('')+(!list.length?'<div class="card empty">\u0647\u0646\u0648\u0632 \u067E\u06CC\u0627\u0645\u06CC \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A.</div>':'');$('#newTicket').onclick=()=>{modal('\u067E\u06CC\u0627\u0645 \u062C\u062F\u06CC\u062F','<form id="ticketForm">'+field('subject','\u0645\u0648\u0636\u0648\u0639')+'<label>\u0645\u062A\u0646 \u067E\u06CC\u0627\u0645<textarea name="body" required></textarea></label><button class="primary">\u0627\u0631\u0633\u0627\u0644</button></form>');$('#ticketForm').onsubmit=async e=>{e.preventDefault();try{await api('tickets',formData(e.target));$('#modal').close();await loadView()}catch(err){error(err)}}};document.querySelectorAll('[data-ticket]').forEach(b=>b.onclick=()=>{const x=list.find(x=>x.id===b.dataset.ticket);modal('\u067E\u0627\u0633\u062E \u0628\u0647 '+x.subject,'<form id="replyForm"><label>\u067E\u0627\u0633\u062E<textarea name="reply" required>'+esc(x.reply)+'</textarea></label><label class="check"><input type="checkbox" name="closed">\u0628\u0633\u062A\u0646 \u062A\u06CC\u06A9\u062A</label><button class="primary">\u062B\u0628\u062A \u067E\u0627\u0633\u062E</button></form>');$('#replyForm').onsubmit=async e=>{e.preventDefault();try{await api('tickets',{id:x.id,...formData(e.target),closed:e.target.closed.checked});$('#modal').close();await loadView()}catch(err){error(err)}}});}
 if(current==='profile'){v.innerHTML='<section class="card"><h2>\u062D\u0633\u0627\u0628 \u0645\u0646</h2><p>'+esc(me.user.name)+'</p><p dir="ltr">'+esc(me.user.email)+'</p><p dir="ltr">'+esc(me.user.phone)+'</p><p>\u0646\u0642\u0634: '+roleLabel[me.user.role]+'</p><p>\u067E\u0627\u06CC\u0627\u0646 \u0627\u0634\u062A\u0631\u0627\u06A9: '+esc(me.user.subscription_end||'\u062A\u0639\u06CC\u06CC\u0646 \u0646\u0634\u062F\u0647')+'</p><button id="logoutAll" class="danger">\u062E\u0631\u0648\u062C \u0627\u0632 \u0647\u0645\u0647 \u062F\u0633\u062A\u06AF\u0627\u0647\u200C\u0647\u0627</button><p class="small">\u0648\u0631\u0648\u062F \u0627\u0632 \u0637\u0631\u06CC\u0642 \u062D\u0633\u0627\u0628 ChatGPT \u0627\u0646\u062C\u0627\u0645 \u0634\u062F\u0647 \u0627\u0633\u062A. \u062A\u0623\u06CC\u06CC\u062F \u067E\u06CC\u0627\u0645\u06A9\u06CC \u0645\u0648\u0628\u0627\u06CC\u0644 \u0647\u0646\u0648\u0632 \u0641\u0639\u0627\u0644 \u0646\u06CC\u0633\u062A.</p></section>';$('#logoutAll').onclick=async()=>{if(!confirm('\u0627\u0632 \u0647\u0645\u0647\u0654 \u062F\u0633\u062A\u06AF\u0627\u0647\u200C\u0647\u0627 \u062E\u0627\u0631\u062C \u0634\u0648\u06CC\u062F\u061F'))return;try{await api('logout',{});location.href='/signout-with-chatgpt?return_to=%2F'}catch(err){error(err)}};}
}
function accountEditor(x={}){const permissions=typeof x.permissions==='string'?JSON.parse(x.permissions):[];modal(x.id?'\u0648\u06CC\u0631\u0627\u06CC\u0634 \u062D\u0633\u0627\u0628':'\u0627\u0641\u0632\u0648\u062F\u0646 \u062D\u0633\u0627\u0628','<form id="accountForm"><div class="split">'+field('name','\u0646\u0627\u0645 \u0648 \u0646\u0627\u0645 \u062E\u0627\u0646\u0648\u0627\u062F\u06AF\u06CC',x.name)+field('phone','\u0634\u0645\u0627\u0631\u0647 \u0645\u0648\u0628\u0627\u06CC\u0644',x.phone)+field('email','\u0627\u06CC\u0645\u06CC\u0644 \u062D\u0633\u0627\u0628 ChatGPT',x.email,'email')+field('cafe','\u0646\u0627\u0645 \u06A9\u0627\u0641\u06CC\u200C\u0646\u062A',x.cafe)+'</div><label>\u0646\u0642\u0634<select name="role"><option value="customer" '+(x.role!=='admin'?'selected':'')+'>\u0645\u0634\u062A\u0631\u06CC</option><option value="admin" '+(x.role==='admin'?'selected':'')+'>\u0627\u062F\u0645\u06CC\u0646</option></select></label>'+field('subscription_end','\u067E\u0627\u06CC\u0627\u0646 \u0627\u0634\u062A\u0631\u0627\u06A9',x.subscription_end,'date')+'<label class="check"><input name="active" type="checkbox" '+(x.active!==0?'checked':'')+'>\u062D\u0633\u0627\u0628 \u0641\u0639\u0627\u0644 \u0628\u0627\u0634\u062F</label><h3>\u0645\u062C\u0648\u0632\u0647\u0627\u06CC \u0627\u062F\u0645\u06CC\u0646</h3><div class="grid">'+Object.entries(labels).map(([key,label])=>'<label class="check"><input type="checkbox" name="permission" value="'+key+'" '+(permissions.includes(key)?'checked':'')+'>'+label+'</label>').join('')+'</div><button class="primary">\u0630\u062E\u06CC\u0631\u0647 \u062D\u0633\u0627\u0628</button>'+(x.id?'<button type="button" id="revoke" class="danger">\u062E\u0631\u0648\u062C \u0627\u0632 \u0647\u0645\u0647 \u062F\u0633\u062A\u06AF\u0627\u0647\u200C\u0647\u0627</button>':'')+'</form>');if(x.id)$('#accountForm [name=email]').readOnly=true;$('#accountForm').onsubmit=async e=>{e.preventDefault();const data=formData(e.target);try{await api('accounts',{...data,id:x.id,active:e.target.active.checked,permissions:[...e.target.querySelectorAll('[name=permission]:checked')].map(el=>el.value)});$('#modal').close();toast('\u062D\u0633\u0627\u0628 \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.');await loadView()}catch(err){error(err)}};if($('#revoke'))$('#revoke').onclick=async()=>{if(!confirm('\u0647\u0645\u0647\u0654 \u0646\u0634\u0633\u062A\u200C\u0647\u0627\u06CC \u0627\u06CC\u0646 \u062D\u0633\u0627\u0628 \u0644\u063A\u0648 \u0634\u0648\u0646\u062F\u061F'))return;try{await api('logout',{userId:x.id});toast('\u0646\u0634\u0633\u062A\u200C\u0647\u0627 \u0644\u063A\u0648 \u0634\u062F\u0646\u062F.');$('#modal').close();await loadView()}catch(err){error(err)}};}
function contentEditor(x={}){modal(x.id?'\u0648\u06CC\u0631\u0627\u06CC\u0634 \u0645\u062D\u062A\u0648\u0627':'\u0645\u062D\u062A\u0648\u0627\u06CC \u062C\u062F\u06CC\u062F','<form id="contentForm"><label>\u0646\u0648\u0639 \u0645\u062D\u062A\u0648\u0627<select name="kind">'+Object.entries({news:'\u062E\u0628\u0631',service:'\u062E\u062F\u0645\u062A',page:'\u0631\u0627\u0647\u0646\u0645\u0627',plan:'\u067E\u0644\u0646 \u0627\u0634\u062A\u0631\u0627\u06A9'}).map(([k,v])=>'<option value="'+k+'" '+(x.kind===k?'selected':'')+'>'+v+'</option>').join('')+'</select></label>'+field('title','\u0639\u0646\u0648\u0627\u0646',x.title)+'<label>\u0645\u062A\u0646<textarea name="body">'+esc(x.body||'')+'</textarea></label>'+field('url','\u0644\u06CC\u0646\u06A9 \u0645\u0631\u062A\u0628\u0637 (\u0627\u062E\u062A\u06CC\u0627\u0631\u06CC)',x.url,'url')+'<label class="check"><input name="published" type="checkbox" '+(x.published?'checked':'')+'>\u062F\u0631 \u0633\u0627\u06CC\u062A \u0645\u0646\u062A\u0634\u0631 \u0634\u0648\u062F</label><button class="primary">\u0630\u062E\u06CC\u0631\u0647</button>'+(x.id?'<button type="button" id="deleteContent" class="danger">\u062D\u0630\u0641 \u0645\u062D\u062A\u0648\u0627</button>':'')+'</form>');$('#contentForm').onsubmit=async e=>{e.preventDefault();try{await api('content',{...formData(e.target),id:x.id,published:e.target.published.checked});$('#modal').close();toast('\u0645\u062D\u062A\u0648\u0627 \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.');await loadView()}catch(err){error(err)}};if($('#deleteContent'))$('#deleteContent').onclick=async()=>{if(!confirm('\u0627\u06CC\u0646 \u0645\u062D\u062A\u0648\u0627 \u062D\u0630\u0641 \u0634\u0648\u062F\u061F'))return;try{await api('content',{id:x.id,remove:true});$('#modal').close();await loadView()}catch(err){error(err)}};}
async function boot(){try{if(location.pathname==='/'||location.pathname==='/index.html'){await landing();return;}me=await api('me');await publicData();if(me.mfaRequired){await security();return;}shell();await loadView()}catch(e){if(e.status===401||e.status===403)login(e.message);else{$('#app').innerHTML='<section class="card login"><h2>\u062F\u0631\u06CC\u0627\u0641\u062A \u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0645\u0645\u06A9\u0646 \u0646\u0634\u062F</h2><p class="error">'+esc(e.message)+'</p><button onclick="location.reload()">\u062A\u0644\u0627\u0634 \u062F\u0648\u0628\u0627\u0631\u0647</button></section>'}}}
boot();
<\/script></body></html>`])));

// native/server.mjs
var PERMISSIONS = ["accounts.view", "content.edit", "support.manage", "audit.view", "settings.edit"];
var enc = new TextEncoder();
var now = () => Date.now();
var uuid = () => crypto.randomUUID();
var hash = async (s) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s))), (b) => b.toString(16).padStart(2, "0")).join("");
var json = (data, status = 200, headers = {}) => Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
var fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
var clean = (value, max = 200) => String(value ?? "").trim().slice(0, max);
var query = (db, sql, ...v) => db.prepare(sql).bind(...v);
var all = async (db, sql, ...v) => (await query(db, sql, ...v).all()).results;
var one = (db, sql, ...v) => query(db, sql, ...v).first();
function base32(bytes) {
  let bits = 0, value = 0, out = "";
  for (const b of bytes) {
    value = value << 8 | b;
    bits += 8;
    while (bits >= 5) {
      out += "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"[value >>> bits - 5 & 31];
      bits -= 5;
    }
  }
  if (bits) out += "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"[value << 5 - bits & 31];
  return out;
}
function decode32(s) {
  let bits = 0, value = 0, out = [];
  for (const c of s) {
    value = value << 5 | "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(c);
    bits += 5;
    if (bits >= 8) {
      out.push(value >>> bits - 8 & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}
async function totp(secret, step) {
  const key = await crypto.subtle.importKey("raw", decode32(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const counter = new Uint8Array(8);
  new DataView(counter.buffer).setBigUint64(0, BigInt(step));
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, counter));
  const o = mac[19] & 15;
  return String(((mac[o] & 127) * 16777216 + mac[o + 1] * 65536 + mac[o + 2] * 256 + mac[o + 3]) % 1e6).padStart(6, "0");
}
function auditStatement(db, user, action, id, detail) {
  return query(db, "INSERT INTO audit(id,actor_id,actor_name,action,entity_id,detail,created_at) VALUES(?,?,?,?,?,?,?)", uuid(), user?.id ?? null, user?.name ?? "\u0648\u0631\u0648\u062F", action, id ?? null, JSON.stringify(detail), now());
}
async function identity(request) {
  const id = request.headers.get("oai-authenticated-user-id");
  const email = request.headers.get("oai-authenticated-user-email")?.toLowerCase();
  if (!id || !email) fail("\u0627\u0628\u062A\u062F\u0627 \u0628\u0627 \u062D\u0633\u0627\u0628 ChatGPT \u062E\u0648\u062F \u0648\u0627\u0631\u062F \u0634\u0648\u06CC\u062F.", 401);
  return { id, email };
}
async function session(request, db) {
  const ident = await identity(request);
  const token = request.headers.get("cookie")?.match(/(?:^|;\s*)kfy_session=([^;]+)/)?.[1];
  if (!token) fail("\u0628\u0631\u0627\u06CC \u0648\u0631\u0648\u062F \u062F\u06A9\u0645\u0647\u0654 \u0648\u0631\u0648\u062F \u0628\u0647 \u067E\u0646\u0644 \u0631\u0627 \u0628\u0632\u0646\u06CC\u062F.", 401);
  const row = await one(db, "SELECT s.id AS session_id,s.mfa_at,a.* FROM sessions s JOIN accounts a ON a.id=s.user_id WHERE s.id=? AND s.expires_at>? AND a.identity_id=?", await hash(token), now(), ident.id);
  if (!row || !row.active) fail("\u0646\u0634\u0633\u062A \u067E\u0627\u06CC\u0627\u0646 \u06CC\u0627\u0641\u062A\u0647 \u0627\u0633\u062A. \u062F\u0648\u0628\u0627\u0631\u0647 \u0648\u0627\u0631\u062F \u0634\u0648\u06CC\u062F.", 401);
  row.permissions = JSON.parse(row.permissions);
  return row;
}
function can(u, p) {
  return u.role === "owner" || u.role === "admin" && u.permissions.includes(p);
}
function requireAdmin(u, p) {
  if (!can(u, p)) fail("\u0627\u062C\u0627\u0632\u0647\u0654 \u0627\u0646\u062C\u0627\u0645 \u0627\u06CC\u0646 \u0639\u0645\u0644\u06CC\u0627\u062A \u0631\u0627 \u0646\u062F\u0627\u0631\u06CC\u062F.", 403);
  if (u.role === "owner" && (!u.mfa_at || u.mfa_at < now() - 30 * 60 * 1e3)) fail("\u062A\u0623\u06CC\u06CC\u062F \u062F\u0648\u0645\u0631\u062D\u0644\u0647\u200C\u0627\u06CC \u0645\u0627\u0644\u06A9 \u0644\u0627\u0632\u0645 \u0627\u0633\u062A.", 428);
}
function requireOwner(u) {
  if (u.role !== "owner") fail("\u0641\u0642\u0637 \u0645\u0627\u0644\u06A9 \u0633\u0627\u06CC\u062A \u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u062F \u0627\u06CC\u0646 \u06A9\u0627\u0631 \u0631\u0627 \u0627\u0646\u062C\u0627\u0645 \u062F\u0647\u062F.", 403);
  requireAdmin(u, "owner");
}
var server_default = {
  async fetch(request, env) {
    try {
      const url = new URL(request.url), path = url.pathname, db = env.DB;
      if (!path.startsWith("/api/")) return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin" } });
      if (!db) fail("\u062F\u06CC\u062A\u0627\u0628\u06CC\u0633 \u0647\u0646\u0648\u0632 \u0645\u062A\u0635\u0644 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A.", 503);
      if (!["GET", "HEAD"].includes(request.method)) {
        if (request.headers.get("origin") !== url.origin) fail("\u0645\u0628\u062F\u0623 \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A.", 403);
        if (!request.headers.get("content-type")?.startsWith("application/json")) fail("\u0641\u0631\u0645\u062A \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A.", 415);
        if (Number(request.headers.get("content-length") || 0) > 15e5) fail("\u062D\u062C\u0645 \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u0632\u06CC\u0627\u062F \u0627\u0633\u062A.", 413);
      }
      let body = {};
      if (request.method === "POST") {
        const raw = await request.text();
        if (raw.length > 15e5) fail("\u062D\u062C\u0645 \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u0632\u06CC\u0627\u062F \u0627\u0633\u062A.", 413);
        try {
          body = JSON.parse(raw);
        } catch {
          fail("\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A.");
        }
      }
      if (path === "/api/public" && request.method === "GET") {
        const settings = await one(db, "SELECT value FROM settings WHERE id='site'");
        return json({ settings: settings ? JSON.parse(settings.value) : { title: "\u06A9\u0627\u0641\u06CC\u200C\u0646\u062A\u200C\u06CC\u0627\u0631", tagline: "\u0645\u062F\u06CC\u0631\u06CC\u062A \u0633\u0627\u062F\u0647\u200C\u062A\u0631\u060C \u0648\u0642\u062A \u0628\u06CC\u0634\u062A\u0631 \u0628\u0631\u0627\u06CC \u0645\u0634\u062A\u0631\u06CC\u0627\u0646" }, content: await all(db, "SELECT * FROM content WHERE published=1 ORDER BY updated_at DESC LIMIT 100") });
      }
      if (path === "/api/session" && request.method === "POST") {
        const ident = await identity(request);
        let user = await one(db, "SELECT * FROM accounts WHERE identity_id=?", ident.id);
        if (!user) {
          user = await one(db, "SELECT * FROM accounts WHERE email=?", ident.email);
          if (user?.identity_id && user.identity_id !== ident.id) fail("\u0647\u0648\u06CC\u062A \u0627\u06CC\u0646 \u062D\u0633\u0627\u0628 \u0645\u0637\u0627\u0628\u0642\u062A \u0646\u062F\u0627\u0631\u062F.", 403);
          if (!user) {
            const owner = await one(db, "SELECT id FROM accounts WHERE role='owner'");
            if (owner || !env.OWNER_EMAIL || ident.email !== env.OWNER_EMAIL.toLowerCase()) fail("\u0627\u06CC\u0646 \u062D\u0633\u0627\u0628 \u062F\u0639\u0648\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A\u061B \u062F\u0633\u062A\u0631\u0633\u06CC \u0628\u0627\u06CC\u062F \u062A\u0648\u0633\u0637 \u0645\u0627\u0644\u06A9 \u0627\u06CC\u062C\u0627\u062F \u0634\u0648\u062F.", 403);
            user = { id: uuid(), name: "\u0645\u0627\u0644\u06A9 \u06A9\u0627\u0641\u06CC\u200C\u0646\u062A\u200C\u06CC\u0627\u0631", email: ident.email, phone: env.OWNER_PHONE || "09939417533", role: "owner", active: 1 };
            await query(db, "INSERT INTO accounts(id,identity_id,email,phone,name,role,created_at) VALUES(?,?,?,?,?,'owner',?)", user.id, ident.id, user.email, user.phone, user.name, now()).run();
          } else await query(db, "UPDATE accounts SET identity_id=? WHERE id=? AND identity_id IS NULL", ident.id, user.id).run();
        }
        if (!user.active) fail("\u062D\u0633\u0627\u0628 \u0645\u0633\u062F\u0648\u062F \u0634\u062F\u0647 \u0627\u0633\u062A.", 403);
        const token = uuid() + uuid(), sid = await hash(token);
        await db.batch([query(db, "INSERT INTO sessions(id,user_id,expires_at,created_at) VALUES(?,?,?,?)", sid, user.id, now() + 864e5, now()), query(db, "UPDATE accounts SET last_login=? WHERE id=?", now(), user.id), auditStatement(db, user, "login", user.id, {})]);
        return json({ ok: true }, 200, { "Set-Cookie": `kfy_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400` });
      }
      const u = await session(request, db);
      if (path === "/api/me" && request.method === "GET") {
        let security = await one(db, "SELECT enabled FROM mfa WHERE user_id=?", u.id);
        return json({ user: { id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, permissions: u.permissions, cafe: u.cafe, subscription_end: u.subscription_end }, mfaRequired: u.role === "owner" && (!u.mfa_at || u.mfa_at < now() - 18e5), mfaEnabled: !!security?.enabled, catalog: PERMISSIONS });
      }
      if (path === "/api/mfa/setup" && request.method === "POST") {
        if (u.role !== "owner") fail("\u0641\u0642\u0637 \u0645\u0627\u0644\u06A9.", 403);
        let m = await one(db, "SELECT * FROM mfa WHERE user_id=?", u.id);
        if (m?.enabled) fail("\u062F\u0648\u0645\u0631\u062D\u0644\u0647\u200C\u0627\u06CC \u0642\u0628\u0644\u0627\u064B \u0641\u0639\u0627\u0644 \u0634\u062F\u0647 \u0627\u0633\u062A.");
        if (!m) {
          m = { secret: base32(crypto.getRandomValues(new Uint8Array(20))) };
          await query(db, "INSERT INTO mfa(user_id,secret) VALUES(?,?)", u.id, m.secret).run();
        }
        return json({ secret: m.secret });
      }
      if (path === "/api/mfa/verify" && request.method === "POST") {
        if (u.role !== "owner") fail("\u0641\u0642\u0637 \u0645\u0627\u0644\u06A9.", 403);
        const attempts = await one(db, "SELECT count(*) AS n FROM audit WHERE actor_id=? AND action='mfa.failed' AND created_at>?", u.id, now() - 6e5);
        if (attempts.n >= 5) fail("\u062A\u0644\u0627\u0634 \u0632\u06CC\u0627\u062F\u061B \u06F1\u06F0 \u062F\u0642\u06CC\u0642\u0647 \u062F\u06CC\u06AF\u0631 \u0627\u0645\u062A\u062D\u0627\u0646 \u06A9\u0646\u06CC\u062F.", 429);
        const m = await one(db, "SELECT * FROM mfa WHERE user_id=?", u.id);
        if (!m) fail("\u0627\u0628\u062A\u062F\u0627 \u0631\u0627\u0647\u200C\u0627\u0646\u062F\u0627\u0632\u06CC \u062F\u0648\u0645\u0631\u062D\u0644\u0647\u200C\u0627\u06CC \u0631\u0627 \u0634\u0631\u0648\u0639 \u06A9\u0646\u06CC\u062F.");
        const code = clean(body.code, 6).replace(/[۰-۹]/g, (c) => "\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9".indexOf(c));
        let match = -1;
        const step = Math.floor(now() / 3e4);
        for (const s of [step - 1, step, step + 1]) if (s > m.last_step && await totp(m.secret, s) === code) match = s;
        if (match < 0) {
          await auditStatement(db, u, "mfa.failed", u.id, {}).run();
          fail("\u06A9\u062F \u0646\u0627\u062F\u0631\u0633\u062A \u06CC\u0627 \u0642\u0628\u0644\u0627\u064B \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u0634\u062F\u0647 \u0627\u0633\u062A.");
        }
        const result = await query(db, "UPDATE mfa SET enabled=1,last_step=? WHERE user_id=? AND last_step<?", match, u.id, match).run();
        if (!result.meta.changes) fail("\u06A9\u062F \u0642\u0628\u0644\u0627\u064B \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u0634\u062F\u0647 \u0627\u0633\u062A.");
        await db.batch([query(db, "UPDATE sessions SET mfa_at=? WHERE id=?", now(), u.session_id), auditStatement(db, u, "mfa.verified", u.id, {})]);
        return json({ ok: true });
      }
      if (path === "/api/logout" && request.method === "POST") {
        const target = body.userId || u.id;
        if (target !== u.id) requireOwner(u);
        const other = await one(db, "SELECT role FROM accounts WHERE id=?", target);
        if (!other) fail("\u062D\u0633\u0627\u0628 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.", 404);
        if (other.role === "owner" && target !== u.id) fail("\u062D\u0633\u0627\u0628 \u0645\u0627\u0644\u06A9 \u0642\u0627\u0628\u0644 \u062A\u063A\u06CC\u06CC\u0631 \u0646\u06CC\u0633\u062A.", 403);
        await db.batch([query(db, "DELETE FROM sessions WHERE user_id=?", target), auditStatement(db, u, "sessions.revoked", target, {})]);
        return json({ ok: true }, 200, target === u.id ? { "Set-Cookie": "kfy_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0" } : {});
      }
      if (path === "/api/accounts") {
        requireAdmin(u, "accounts.view");
        if (request.method === "GET") return json(await all(db, "SELECT a.id,a.name,a.email,a.phone,a.role,a.permissions,a.active,a.cafe,a.subscription_end,a.last_login,(SELECT count(*) FROM sessions s WHERE s.user_id=a.id AND s.expires_at>?) AS sessions FROM accounts a ORDER BY a.created_at DESC", now()));
        if (request.method === "POST") {
          requireOwner(u);
          const id = body.id || uuid(), before = body.id ? await one(db, "SELECT * FROM accounts WHERE id=?", id) : null;
          if (body.id && !before) fail("\u062D\u0633\u0627\u0628 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.", 404);
          if (before?.role === "owner") fail("\u0646\u0642\u0634 \u0648 \u0648\u0636\u0639\u06CC\u062A \u0645\u0627\u0644\u06A9 \u0627\u0632 \u0627\u06CC\u0646 \u0628\u062E\u0634 \u0642\u0627\u0628\u0644 \u062A\u063A\u06CC\u06CC\u0631 \u0646\u06CC\u0633\u062A.");
          const name = clean(body.name, 100), email = clean(body.email).toLowerCase(), phone = clean(body.phone).replace(/[۰-۹]/g, (c) => "\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9".indexOf(c));
          if (name.length < 3 || !/^\S+@\S+\.\S+$/.test(email) || !/^09\d{9}$/.test(phone)) fail("\u0646\u0627\u0645\u060C \u0627\u06CC\u0645\u06CC\u0644 \u0648 \u0634\u0645\u0627\u0631\u0647 \u0645\u0648\u0628\u0627\u06CC\u0644 \u0645\u0639\u062A\u0628\u0631 \u0648\u0627\u0631\u062F \u06A9\u0646\u06CC\u062F.");
          const role = body.role;
          if (!["admin", "customer"].includes(role)) fail("\u0646\u0642\u0634 \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A.");
          const permissions = Array.isArray(body.permissions) ? [...new Set(body.permissions)] : [];
          if (permissions.some((p) => !PERMISSIONS.includes(p))) fail("\u0645\u062C\u0648\u0632 \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A.");
          if (before && before.email !== email) fail("\u0627\u06CC\u0645\u06CC\u0644 \u0647\u0648\u06CC\u062A\u06CC \u062D\u0633\u0627\u0628 \u0642\u0627\u0628\u0644 \u062A\u063A\u06CC\u06CC\u0631 \u0646\u06CC\u0633\u062A.");
          const duplicate = await one(db, "SELECT id FROM accounts WHERE (email=? OR phone=?) AND id<>?", email, phone, id);
          if (duplicate) fail("\u0627\u06CC\u0645\u06CC\u0644 \u06CC\u0627 \u0645\u0648\u0628\u0627\u06CC\u0644 \u0642\u0628\u0644\u0627\u064B \u062B\u0628\u062A \u0634\u062F\u0647 \u0627\u0633\u062A.");
          const end = body.subscription_end || null;
          if (end && !/^\d{4}-\d{2}-\d{2}$/.test(end)) fail("\u062A\u0627\u0631\u06CC\u062E \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A.");
          const after = { name, email, phone, role, permissions, active: body.active === false ? 0 : 1, cafe: clean(body.cafe), subscription_end: end };
          const statement = before ? query(db, "UPDATE accounts SET name=?,phone=?,role=?,permissions=?,active=?,cafe=?,subscription_end=? WHERE id=?", name, phone, role, JSON.stringify(permissions), after.active, after.cafe, end, id) : query(db, "INSERT INTO accounts(id,email,phone,name,role,permissions,active,cafe,subscription_end,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)", id, email, phone, name, role, JSON.stringify(permissions), after.active, after.cafe, end, now());
          await db.batch([statement, auditStatement(db, u, before ? "account.updated" : "account.created", id, { before, after })]);
          return json({ ok: true });
        }
      }
      if (path === "/api/content") {
        requireAdmin(u, "content.edit");
        if (request.method === "GET") return json(await all(db, "SELECT * FROM content ORDER BY updated_at DESC"));
        if (request.method === "POST") {
          const id = body.id || uuid(), before = body.id ? await one(db, "SELECT * FROM content WHERE id=?", id) : null;
          if (body.id && !before) fail("\u0645\u062D\u062A\u0648\u0627 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.", 404);
          if (body.remove) {
            await db.batch([query(db, "DELETE FROM content WHERE id=?", id), auditStatement(db, u, "content.deleted", id, { before })]);
            return json({ ok: true });
          }
          const kind = body.kind, title = clean(body.title), text = clean(body.body, 2e4), link = clean(body.url, 2e3);
          if (!["news", "service", "page", "plan"].includes(kind) || !title) fail("\u0639\u0646\u0648\u0627\u0646 \u0648 \u0646\u0648\u0639 \u0645\u062D\u062A\u0648\u0627 \u0644\u0627\u0632\u0645 \u0627\u0633\u062A.");
          if (link && !/^https:\/\//i.test(link)) fail("\u0644\u06CC\u0646\u06A9 \u0628\u0627\u06CC\u062F \u0628\u0627 https:// \u0634\u0631\u0648\u0639 \u0634\u0648\u062F.");
          const after = { kind, title, body: text, url: link, published: !!body.published };
          await db.batch([query(db, "INSERT INTO content(id,kind,title,body,url,published,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,title=excluded.title,body=excluded.body,url=excluded.url,published=excluded.published,updated_at=excluded.updated_at", id, kind, title, text, link, after.published ? 1 : 0, now()), auditStatement(db, u, "content.saved", id, { before, after })]);
          return json({ ok: true });
        }
      }
      if (path === "/api/settings") {
        requireAdmin(u, "settings.edit");
        if (request.method === "GET") {
          const row = await one(db, "SELECT value FROM settings WHERE id='site'");
          return json(row ? JSON.parse(row.value) : {});
        }
        if (request.method === "POST") {
          const value = { title: clean(body.title, 100), tagline: clean(body.tagline, 300), contact: clean(body.contact, 300), logo: clean(body.logo, 14e5) };
          if (value.logo && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value.logo)) fail("\u0644\u0648\u06AF\u0648 \u0628\u0627\u06CC\u062F \u062A\u0635\u0648\u06CC\u0631 PNG\u060C JPG \u06CC\u0627 WebP \u0628\u0627\u0634\u062F.");
          const before = await one(db, "SELECT value FROM settings WHERE id='site'");
          await db.batch([query(db, "INSERT INTO settings(id,value) VALUES('site',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value", JSON.stringify(value)), auditStatement(db, u, "settings.updated", "site", { before: before ? { ...JSON.parse(before.value), logo: "[image]" } : null, after: { ...value, logo: value.logo ? "[image]" : "" } })]);
          return json({ ok: true });
        }
      }
      if (path === "/api/audit" && request.method === "GET") {
        requireAdmin(u, "audit.view");
        const term = clean(url.searchParams.get("q")), from = Number(url.searchParams.get("from")) || 0, to = Number(url.searchParams.get("to")) || now();
        return json(await all(db, "SELECT * FROM audit WHERE created_at>=? AND created_at<=? AND (actor_name LIKE ? OR action LIKE ?) ORDER BY created_at DESC LIMIT 300", from, to, "%" + term + "%", "%" + term + "%"));
      }
      if (path === "/api/overview" && request.method === "GET") {
        if (u.role === "customer") fail("\u0627\u06CC\u0646 \u0628\u062E\u0634 \u0645\u062F\u06CC\u0631\u06CC\u062A\u06CC \u0627\u0633\u062A.", 403);
        requireAdmin(u, u.permissions[0] || "owner");
        const stats = {};
        if (can(u, "accounts.view")) {
          stats.accounts = (await one(db, "SELECT count(*) AS n FROM accounts")).n;
          stats.admins = (await one(db, "SELECT count(*) AS n FROM accounts WHERE role IN ('owner','admin')")).n;
        }
        if (can(u, "support.manage")) stats.tickets = (await one(db, "SELECT count(*) AS n FROM tickets WHERE status='open'")).n;
        if (can(u, "content.edit")) stats.content = (await one(db, "SELECT count(*) AS n FROM content WHERE published=1")).n;
        return json(stats);
      }
      if (path === "/api/transactions") {
        if (request.method === "GET") return json(await all(db, "SELECT * FROM transactions WHERE user_id=? ORDER BY created_at DESC LIMIT 500", u.id));
        if (request.method === "POST") {
          const title = clean(body.title), amount = Number(body.amount), kind = body.kind;
          if (!title || !Number.isSafeInteger(amount) || amount <= 0 || amount > 1e12 || !["income", "expense"].includes(kind)) fail("\u0639\u0646\u0648\u0627\u0646 \u0648 \u0645\u0628\u0644\u063A \u0635\u062D\u06CC\u062D \u0648\u0627\u0631\u062F \u06A9\u0646\u06CC\u062F.");
          if (u.role === "customer" && u.subscription_end && u.subscription_end < (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)) fail("\u0627\u0634\u062A\u0631\u0627\u06A9 \u067E\u0627\u06CC\u0627\u0646 \u06CC\u0627\u0641\u062A\u0647 \u0627\u0633\u062A.", 403);
          await db.batch([query(db, "INSERT INTO transactions(id,user_id,title,amount,kind,created_at) VALUES(?,?,?,?,?,?)", uuid(), u.id, title, amount, kind, now()), auditStatement(db, u, "transaction.created", u.id, { title, amount, kind })]);
          return json({ ok: true });
        }
      }
      if (path === "/api/tickets") {
        const support = can(u, "support.manage");
        if (support) requireAdmin(u, "support.manage");
        if (request.method === "GET") return json(support ? await all(db, "SELECT t.*,a.name FROM tickets t JOIN accounts a ON a.id=t.user_id ORDER BY updated_at DESC LIMIT 300") : await all(db, "SELECT * FROM tickets WHERE user_id=? ORDER BY updated_at DESC", u.id));
        if (request.method === "POST") {
          if (body.id) {
            if (!support) fail("\u0627\u062C\u0627\u0632\u0647\u0654 \u067E\u0627\u0633\u062E \u0646\u062F\u0627\u0631\u06CC\u062F.", 403);
            const ticket = await one(db, "SELECT * FROM tickets WHERE id=?", body.id);
            if (!ticket) fail("\u062A\u06CC\u06A9\u062A \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.", 404);
            const reply = clean(body.reply, 1e4);
            if (!reply) fail("\u067E\u0627\u0633\u062E \u062E\u0627\u0644\u06CC \u0627\u0633\u062A.");
            await db.batch([query(db, "UPDATE tickets SET reply=?,status=?,updated_at=? WHERE id=?", reply, body.closed ? "closed" : "open", now(), body.id), auditStatement(db, u, "ticket.replied", body.id, { reply })]);
          } else {
            const subject = clean(body.subject), text = clean(body.body, 1e4);
            if (!subject || !text) fail("\u0645\u0648\u0636\u0648\u0639 \u0648 \u067E\u06CC\u0627\u0645 \u0644\u0627\u0632\u0645 \u0627\u0633\u062A.");
            await query(db, "INSERT INTO tickets(id,user_id,subject,body,updated_at) VALUES(?,?,?,?,?)", uuid(), u.id, subject, text, now()).run();
          }
          return json({ ok: true });
        }
      }
      fail("\u0645\u0633\u06CC\u0631 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.", 404);
    } catch (error) {
      return json({ error: error.status ? error.message : "\u062E\u0637\u0627\u06CC \u0633\u0631\u0648\u0631\u061B \u062F\u0648\u0628\u0627\u0631\u0647 \u062A\u0644\u0627\u0634 \u06A9\u0646\u06CC\u062F." }, error.status || 500);
    }
  }
};
export {
  server_default as default,
  totp
};
