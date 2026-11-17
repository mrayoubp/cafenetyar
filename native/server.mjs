import library from './library.json' with { type: 'json' };
import { html } from './ui.mjs';
const PERMISSIONS=['accounts.view','content.edit','support.manage','audit.view','settings.edit'];
const enc=new TextEncoder();
const now=()=>Date.now();
const uuid=()=>crypto.randomUUID();
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
const json=(data,status=200,headers={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
const clean=(value,max=200)=>String(value??'').trim().slice(0,max);
function validUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!!u.hostname&&u.hostname.includes('.')&&!u.username&&!u.password;}catch{return false;}}
const query=(db,sql,...v)=>db.prepare(sql).bind(...v);
const all=async(db,sql,...v)=>(await query(db,sql,...v).all()).results;
const one=(db,sql,...v)=>query(db,sql,...v).first();
function base32(bytes){let bits=0,value=0,out='';for(const b of bytes){value=(value<<8)|b;bits+=8;while(bits>=5){out+='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[(value>>>(bits-5))&31];bits-=5;}}if(bits)out+='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[(value<<(5-bits))&31];return out;}
function decode32(s){let bits=0,value=0,out=[];for(const c of s){value=(value<<5)|'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(c);bits+=5;if(bits>=8){out.push((value>>>(bits-8))&255);bits-=8;}}return new Uint8Array(out);}
export async function totp(secret,step){const key=await crypto.subtle.importKey('raw',decode32(secret),{name:'HMAC',hash:'SHA-1'},false,['sign']);const counter=new Uint8Array(8);new DataView(counter.buffer).setBigUint64(0,BigInt(step));const mac=new Uint8Array(await crypto.subtle.sign('HMAC',key,counter));const o=mac[19]&15;return String(((mac[o]&127)*16777216+mac[o+1]*65536+mac[o+2]*256+mac[o+3])%1000000).padStart(6,'0');}
function auditStatement(db,user,action,id,detail){return query(db,'INSERT INTO audit(id,actor_id,actor_name,action,entity_id,detail,created_at) VALUES(?,?,?,?,?,?,?)',uuid(),user?.id??null,user?.name??'ورود',action,id??null,JSON.stringify(detail),now());}
async function identity(request){const id=request.headers.get('oai-authenticated-user-id');const email=request.headers.get('oai-authenticated-user-email')?.toLowerCase();if(!id||!email)fail('ابتدا با حساب ChatGPT خود وارد شوید.',401);return {id,email};}
async function session(request,db){const ident=await identity(request);const token=request.headers.get('cookie')?.match(/(?:^|;\s*)kfy_session=([^;]+)/)?.[1];if(!token)fail('برای ورود دکمهٔ ورود به پنل را بزنید.',401);const row=await one(db,'SELECT s.id AS session_id,s.mfa_at,a.* FROM sessions s JOIN accounts a ON a.id=s.user_id WHERE s.id=? AND s.expires_at>? AND a.identity_id=?',await hash(token),now(),ident.id);if(!row||!row.active)fail('نشست پایان یافته است. دوباره وارد شوید.',401);row.permissions=JSON.parse(row.permissions);return row;}
function can(u,p){return u.role==='owner'||(u.role==='admin'&&u.permissions.includes(p));}
function requireAdmin(u,p){if(!can(u,p))fail('اجازهٔ انجام این عملیات را ندارید.',403);if(u.role==='owner'&&(!u.mfa_at||u.mfa_at<now()-30*60*1000))fail('تأیید دومرحله‌ای مالک لازم است.',428);}
function requireOwner(u){if(u.role!=='owner')fail('فقط مالک سایت می‌تواند این کار را انجام دهد.',403);requireAdmin(u,'owner');}
export function mergeLibrary(rows){const entries=new Map(library.map(x=>[x.id,x]));for(const row of rows)entries.set(row.id,{...row,meta:typeof row.meta==='string'?JSON.parse(row.meta):row.meta||{}});return [...entries.values()].sort((a,b)=>b.updated_at-a.updated_at);}
async function contentRows(db){return mergeLibrary(await all(db,'SELECT * FROM content ORDER BY updated_at DESC'));}
export default {async fetch(request,env){try{
 const url=new URL(request.url),path=url.pathname,db=env.DB;
 if(!path.startsWith('/api/'))return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'}});
 if(!db)fail('دیتابیس هنوز متصل نشده است.',503);
 if(!['GET','HEAD'].includes(request.method)){
  if(request.headers.get('origin')!==url.origin)fail('مبدأ درخواست معتبر نیست.',403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))fail('فرمت درخواست معتبر نیست.',415);
  if(Number(request.headers.get('content-length')||0)>1500000)fail('حجم درخواست زیاد است.',413);
 }
 let body={};if(request.method==='POST'){const raw=await request.text();if(raw.length>1500000)fail('حجم درخواست زیاد است.',413);try{body=JSON.parse(raw);}catch{fail('اطلاعات معتبر نیست.');}}
 if(path==='/api/public'&&request.method==='GET'){
  const settings=await one(db,"SELECT value FROM settings WHERE id='site'");
  return json({settings:settings?JSON.parse(settings.value):{title:'کافی‌نت‌یار',tagline:'مدیریت ساده‌تر، وقت بیشتر برای مشتریان'},content:(await contentRows(db)).filter(x=>x.published)});
 }
 if(path==='/api/session'&&request.method==='POST'){
  const ident=await identity(request);let user=await one(db,'SELECT * FROM accounts WHERE identity_id=?',ident.id);
  if(!user){
   user=await one(db,'SELECT * FROM accounts WHERE email=?',ident.email);
   if(user?.identity_id&&user.identity_id!==ident.id)fail('هویت این حساب مطابقت ندارد.',403);
   if(!user){
    const owner=await one(db,"SELECT id FROM accounts WHERE role='owner'");
    if(owner||!env.OWNER_EMAIL||ident.email!==env.OWNER_EMAIL.toLowerCase())fail('این حساب دعوت نشده است؛ دسترسی باید توسط مالک ایجاد شود.',403);
    user={id:uuid(),name:'مالک کافی‌نت‌یار',email:ident.email,phone:env.OWNER_PHONE||'09939417533',role:'owner',active:1};
    await query(db,"INSERT INTO accounts(id,identity_id,email,phone,name,role,created_at) VALUES(?,?,?,?,?,'owner',?)",user.id,ident.id,user.email,user.phone,user.name,now()).run();
   }else await query(db,'UPDATE accounts SET identity_id=? WHERE id=? AND identity_id IS NULL',ident.id,user.id).run();
  }
  if(!user.active)fail('حساب مسدود شده است.',403);
  const token=uuid()+uuid(),sid=await hash(token);
  await db.batch([query(db,'INSERT INTO sessions(id,user_id,expires_at,created_at) VALUES(?,?,?,?)',sid,user.id,now()+86400000,now()),query(db,'UPDATE accounts SET last_login=? WHERE id=?',now(),user.id),auditStatement(db,user,'login',user.id,{})]);
  return json({ok:true},200,{'Set-Cookie':`kfy_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`});
 }
 const u=await session(request,db);
 if(path==='/api/me'&&request.method==='GET'){
  let security=await one(db,'SELECT enabled FROM mfa WHERE user_id=?',u.id);
  return json({user:{id:u.id,name:u.name,email:u.email,phone:u.phone,role:u.role,permissions:u.permissions,cafe:u.cafe,subscription_end:u.subscription_end},mfaRequired:u.role==='owner'&&(!u.mfa_at||u.mfa_at<now()-1800000),mfaEnabled:!!security?.enabled,catalog:PERMISSIONS});
 }
 if(path==='/api/mfa/setup'&&request.method==='POST'){
  if(u.role!=='owner')fail('فقط مالک.',403);
  let m=await one(db,'SELECT * FROM mfa WHERE user_id=?',u.id);if(m?.enabled)fail('دومرحله‌ای قبلاً فعال شده است.');
  if(!m){m={secret:base32(crypto.getRandomValues(new Uint8Array(20)))};await query(db,'INSERT INTO mfa(user_id,secret) VALUES(?,?)',u.id,m.secret).run();}
  return json({secret:m.secret});
 }
 if(path==='/api/mfa/verify'&&request.method==='POST'){
  if(u.role!=='owner')fail('فقط مالک.',403);
  const attempts=await one(db,"SELECT count(*) AS n FROM audit WHERE actor_id=? AND action='mfa.failed' AND created_at>?",u.id,now()-600000);if(attempts.n>=5)fail('تلاش زیاد؛ ۱۰ دقیقه دیگر امتحان کنید.',429);
  const m=await one(db,'SELECT * FROM mfa WHERE user_id=?',u.id);if(!m)fail('ابتدا راه‌اندازی دومرحله‌ای را شروع کنید.');
  const code=clean(body.code,6).replace(/[۰-۹]/g,c=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(c));let match=-1;
  const step=Math.floor(now()/30000);for(const s of [step-1,step,step+1])if(s>m.last_step&&await totp(m.secret,s)===code)match=s;
  if(match<0){await auditStatement(db,u,'mfa.failed',u.id,{}).run();fail('کد نادرست یا قبلاً استفاده شده است.');}
  const result=await query(db,'UPDATE mfa SET enabled=1,last_step=? WHERE user_id=? AND last_step<?',match,u.id,match).run();if(!result.meta.changes)fail('کد قبلاً استفاده شده است.');
  await db.batch([query(db,'UPDATE sessions SET mfa_at=? WHERE id=?',now(),u.session_id),auditStatement(db,u,'mfa.verified',u.id,{})]);return json({ok:true});
 }
 if(path==='/api/logout'&&request.method==='POST'){
  const target=body.userId||u.id;if(target!==u.id)requireOwner(u);
  const other=await one(db,'SELECT role FROM accounts WHERE id=?',target);if(!other)fail('حساب پیدا نشد.',404);if(other.role==='owner'&&target!==u.id)fail('حساب مالک قابل تغییر نیست.',403);
  await db.batch([query(db,'DELETE FROM sessions WHERE user_id=?',target),auditStatement(db,u,'sessions.revoked',target,{})]);return json({ok:true},200,target===u.id?{'Set-Cookie':'kfy_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'}:{});
 }
 if(path==='/api/accounts'){
  requireAdmin(u,'accounts.view');
  if(request.method==='GET')return json(await all(db,'SELECT a.id,a.name,a.email,a.phone,a.role,a.permissions,a.active,a.cafe,a.subscription_end,a.last_login,(SELECT count(*) FROM sessions s WHERE s.user_id=a.id AND s.expires_at>?) AS sessions FROM accounts a ORDER BY a.created_at DESC',now()));
  if(request.method==='POST'){
   requireOwner(u);const id=body.id||uuid(),before=body.id?await one(db,'SELECT * FROM accounts WHERE id=?',id):null;
   if(body.id&&!before)fail('حساب پیدا نشد.',404);if(before?.role==='owner')fail('نقش و وضعیت مالک از این بخش قابل تغییر نیست.');
   const name=clean(body.name,100),email=clean(body.email).toLowerCase(),phone=clean(body.phone).replace(/[۰-۹]/g,c=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(c));
   if(name.length<3||!/^\S+@\S+\.\S+$/.test(email)||!/^09\d{9}$/.test(phone))fail('نام، ایمیل و شماره موبایل معتبر وارد کنید.');
   const role=body.role;if(!['admin','customer'].includes(role))fail('نقش معتبر نیست.');
   const permissions=Array.isArray(body.permissions)?[...new Set(body.permissions)]:[];if(permissions.some(p=>!PERMISSIONS.includes(p)))fail('مجوز معتبر نیست.');
   if(before&&before.email!==email)fail('ایمیل هویتی حساب قابل تغییر نیست.');
   const duplicate=await one(db,'SELECT id FROM accounts WHERE (email=? OR phone=?) AND id<>?',email,phone,id);if(duplicate)fail('ایمیل یا موبایل قبلاً ثبت شده است.');
   const end=body.subscription_end||null;if(end&&!/^\d{4}-\d{2}-\d{2}$/.test(end))fail('تاریخ معتبر نیست.');
   const after={name,email,phone,role,permissions,active:body.active===false?0:1,cafe:clean(body.cafe),subscription_end:end};
   const statement=before?query(db,'UPDATE accounts SET name=?,phone=?,role=?,permissions=?,active=?,cafe=?,subscription_end=? WHERE id=?',name,phone,role,JSON.stringify(permissions),after.active,after.cafe,end,id):query(db,'INSERT INTO accounts(id,email,phone,name,role,permissions,active,cafe,subscription_end,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',id,email,phone,name,role,JSON.stringify(permissions),after.active,after.cafe,end,now());
   await db.batch([statement,auditStatement(db,u,before?'account.updated':'account.created',id,{before,after})]);return json({ok:true});
  }
 }
 if(path==='/api/content'){
  requireAdmin(u,'content.edit');if(request.method==='GET')return json(await contentRows(db));
  if(request.method==='POST'){
   const id=body.id||uuid(),before=body.id?(await one(db,'SELECT * FROM content WHERE id=?',id)||library.find(x=>x.id===id)):null;
   if(body.id&&!before)fail('محتوا پیدا نشد.',404);
   if(body.remove){const statement=library.some(x=>x.id===id)?query(db,'INSERT INTO content(id,kind,title,body,url,published,updated_at,meta) VALUES(?,?,?,?,?,0,?,?) ON CONFLICT(id) DO UPDATE SET published=0,updated_at=excluded.updated_at',id,before.kind,before.title,before.body,before.url,now(),JSON.stringify(typeof before.meta==='string'?JSON.parse(before.meta):before.meta||{})):query(db,'DELETE FROM content WHERE id=?',id);await db.batch([statement,auditStatement(db,u,'content.deleted',id,{before})]);return json({ok:true});}
   const kind=body.kind,title=clean(body.title),text=clean(body.body,20000),link=clean(body.url,2000);if(!['news','service','page','plan','site','article'].includes(kind)||!title)fail('عنوان و نوع محتوا لازم است.');
   if(link&&!validUrl(link))fail('لینک باید با https:// شروع شود.');
   const priorMeta=typeof before?.meta==='string'?JSON.parse(before.meta):before?.meta||{};
   const meta={...priorMeta};for(const key of ['category','summary','sourceTitle','sourceUrl','sourceDate','type'])if(body.meta&&Object.hasOwn(body.meta,key))meta[key]=clean(body.meta[key],key==='summary'?500:2000);
   if(meta.sourceUrl&&!validUrl(meta.sourceUrl))fail('نشانی منبع باید HTTPS باشد.');
   if(meta.sourceDate&&!/^\d{4}-\d{2}-\d{2}$/.test(meta.sourceDate))fail('تاریخ منبع معتبر نیست.');
   if(['article','news'].includes(kind))meta.preparedAt=new Date().toISOString().slice(0,10);
   if(kind==='site'&&!link)fail('نشانی سامانه لازم است.');
   if(before&&before.url!==link){meta.access='unverified';delete meta.httpStatus;delete meta.checkedAt;}
   const after={kind,title,body:text,url:link,published:!!body.published,meta};
   await db.batch([query(db,'INSERT INTO content(id,kind,title,body,url,published,updated_at,meta) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,title=excluded.title,body=excluded.body,url=excluded.url,published=excluded.published,updated_at=excluded.updated_at,meta=excluded.meta',id,kind,title,text,link,after.published?1:0,now(),JSON.stringify(meta)),auditStatement(db,u,'content.saved',id,{before,after})]);return json({ok:true});
  }
 }
 if(path==='/api/settings'){
  requireAdmin(u,'settings.edit');if(request.method==='GET'){const row=await one(db,"SELECT value FROM settings WHERE id='site'");return json(row?JSON.parse(row.value):{});}
  if(request.method==='POST'){
   const value={title:clean(body.title,100),tagline:clean(body.tagline,300),contact:clean(body.contact,300),logo:clean(body.logo,1400000)};
   if(value.logo&&!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value.logo))fail('لوگو باید تصویر PNG، JPG یا WebP باشد.');
   const before=await one(db,"SELECT value FROM settings WHERE id='site'");
   await db.batch([query(db,"INSERT INTO settings(id,value) VALUES('site',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",JSON.stringify(value)),auditStatement(db,u,'settings.updated','site',{before:before?{...JSON.parse(before.value),logo:'[image]'}:null,after:{...value,logo:value.logo?'[image]':''}})]);return json({ok:true});
  }
 }
 if(path==='/api/audit'&&request.method==='GET'){
  requireAdmin(u,'audit.view');const term=clean(url.searchParams.get('q')),from=Number(url.searchParams.get('from'))||0,to=Number(url.searchParams.get('to'))||now();
  return json(await all(db,'SELECT * FROM audit WHERE created_at>=? AND created_at<=? AND (actor_name LIKE ? OR action LIKE ?) ORDER BY created_at DESC LIMIT 300',from,to,'%'+term+'%','%'+term+'%'));
 }
 if(path==='/api/overview'&&request.method==='GET'){
  if(u.role==='customer')fail('این بخش مدیریتی است.',403);requireAdmin(u,u.permissions[0]||'owner');
  const stats={};if(can(u,'accounts.view')){stats.accounts=(await one(db,'SELECT count(*) AS n FROM accounts')).n;stats.admins=(await one(db,"SELECT count(*) AS n FROM accounts WHERE role IN ('owner','admin')")).n;}
  if(can(u,'support.manage'))stats.tickets=(await one(db,"SELECT count(*) AS n FROM tickets WHERE status='open'")).n;
  if(can(u,'content.edit'))stats.content=(await contentRows(db)).filter(x=>x.published).length;
  return json(stats);
 }
 if(path==='/api/transactions'){
  if(request.method==='GET')return json(await all(db,'SELECT * FROM transactions WHERE user_id=? ORDER BY created_at DESC LIMIT 500',u.id));
  if(request.method==='POST'){
   const title=clean(body.title),amount=Number(body.amount),kind=body.kind;
   if(!title||!Number.isSafeInteger(amount)||amount<=0||amount>1e12||!['income','expense'].includes(kind))fail('عنوان و مبلغ صحیح وارد کنید.');
   if(u.role==='customer'&&u.subscription_end&&u.subscription_end<new Date().toISOString().slice(0,10))fail('اشتراک پایان یافته است.',403);
   await db.batch([query(db,'INSERT INTO transactions(id,user_id,title,amount,kind,created_at) VALUES(?,?,?,?,?,?)',uuid(),u.id,title,amount,kind,now()),auditStatement(db,u,'transaction.created',u.id,{title,amount,kind})]);return json({ok:true});
  }
 }
 if(path==='/api/tickets'){
  const support=can(u,'support.manage');if(support)requireAdmin(u,'support.manage');
  if(request.method==='GET')return json(support?await all(db,'SELECT t.*,a.name FROM tickets t JOIN accounts a ON a.id=t.user_id ORDER BY updated_at DESC LIMIT 300'):await all(db,'SELECT * FROM tickets WHERE user_id=? ORDER BY updated_at DESC',u.id));
  if(request.method==='POST'){
   if(body.id){if(!support)fail('اجازهٔ پاسخ ندارید.',403);const ticket=await one(db,'SELECT * FROM tickets WHERE id=?',body.id);if(!ticket)fail('تیکت پیدا نشد.',404);const reply=clean(body.reply,10000);if(!reply)fail('پاسخ خالی است.');await db.batch([query(db,'UPDATE tickets SET reply=?,status=?,updated_at=? WHERE id=?',reply,body.closed?'closed':'open',now(),body.id),auditStatement(db,u,'ticket.replied',body.id,{reply})]);}
   else{const subject=clean(body.subject),text=clean(body.body,10000);if(!subject||!text)fail('موضوع و پیام لازم است.');await query(db,'INSERT INTO tickets(id,user_id,subject,body,updated_at) VALUES(?,?,?,?,?)',uuid(),u.id,subject,text,now()).run();}return json({ok:true});
  }
 }
 fail('مسیر پیدا نشد.',404);
 }catch(error){return json({error:error.status?error.message:'خطای سرور؛ دوباره تلاش کنید.'},error.status||500);}}
};
