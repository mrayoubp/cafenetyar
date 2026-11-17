const json=(v,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
const norm=s=>String(s||'').trim().toLowerCase().replace(/ي/g,'ی').replace(/ك/g,'ک');
const category=name=>({id:'category:'+name,name,slug:encodeURIComponent(name),tone:'mint',icon:'grid'});
const empty=()=>({favorites:[],visited:{},saved:[],read:[],categoryIds:[]});
export async function bridge(request,db,content){
 const url=new URL(request.url);let name,args;
 if(request.method==='GET'){name=url.searchParams.get('name');try{args=JSON.parse(url.searchParams.get('args')||'{}')}catch{return json({error:'درخواست نامعتبر'},400)}}
 else {const body=await request.json();name=body.name;args=body.args||{};}
 if(!args||typeof args!=='object'||Array.isArray(args))return json({error:'درخواست نامعتبر'},400);
 if(JSON.stringify(args).length>16000)return json({error:'متن درخواست بیش از حد طولانی است.'},413);
 const identity=request.headers.get('oai-authenticated-user-id');
 const row=identity?await db.prepare('SELECT value FROM library_preferences WHERE identity_id=?').bind(identity).first():null;
 const prefs={...empty(),...(row?JSON.parse(row.value):{})};
 const sites=content.filter(x=>x.kind==='site'),news=content.filter(x=>['article','news'].includes(x.kind));
 const card=x=>({id:x.id,title:x.title,summary:x.meta?.summary||x.body.slice(0,180),imageUrl:null,category:category(x.meta?.category||'عمومی'),sourceName:x.meta?.sourceTitle||'کافی‌نت‌یار',sourceUrl:x.meta?.sourceUrl||x.url||null,publishedAt:x.meta?.sourceDate?new Date(x.meta.sourceDate+'T12:00:00+03:30').getTime():x.updated_at,isUrgent:false,isPinned:false,isDemo:false,saved:prefs.saved.includes(x.id),read:prefs.read.includes(x.id)});
 if(request.method==='GET'){
  if(name==='websites:catalog'||name==='websites:highlights'){
   const categories=[...new Set(sites.map(x=>x.meta?.category||'سایر'))].map(n=>({...category(n),description:null,count:sites.filter(x=>(x.meta?.category||'سایر')===n).length}));
   const items=sites.map((x,i)=>({id:x.id,name:x.title,description:x.body,url:x.url,logoUrl:null,sourceName:x.meta?.sourceTitle||x.title,sourceUrl:x.meta?.sourceUrl||x.url,verificationStatus:'needs_review',lastCheckedAt:x.meta?.checkedAt?new Date(x.meta.checkedAt).getTime():null,lastCheckStatus:'unchecked',visitCount:0,isFeatured:i<6,isActive:true,sortOrder:i,updatedAt:x.updated_at,createdAt:x.updated_at,isFavorite:prefs.favorites.includes(x.id),favoriteOrder:prefs.favorites.indexOf(x.id),lastVisitedAt:prefs.visited[x.id]||null,category:category(x.meta?.category||'سایر')}));
   if(name==='websites:highlights')return json({items:items.slice(0,4),favoriteCount:items.filter(x=>x.isFavorite).length,total:items.length});
   const mySuggestions=identity?(await db.prepare("SELECT * FROM library_requests WHERE identity_id=? AND kind='suggestion' ORDER BY created_at DESC").bind(identity).all()).results.map(x=>({id:x.id,...JSON.parse(x.payload),status:x.status,adminNote:x.admin_note,createdAt:x.created_at})):[];
   return json({items,categories,mySuggestions,stats:{total:items.length,favorites:items.filter(x=>x.isFavorite).length,recent:items.filter(x=>x.lastVisitedAt).length,featured:items.filter(x=>x.isFeatured).length,needsReview:items.length},serverNow:Date.now()});
  }
  if(name==='news:get'){const x=news.find(x=>x.id===args.newsId);return json(x?{...card(x),body:x.body}:null);}
  if(name==='news:highlights')return json({items:news.map(card).sort((a,b)=>b.publishedAt-a.publishedAt).slice(0,4),hasDemo:false});
  if(name==='news:feed'){
   let items=news.filter(x=>(!args.categoryId||category(x.meta?.category||'عمومی').id===args.categoryId)&&(!args.search||norm(x.title+' '+x.body).includes(norm(args.search)))&&(!args.savedOnly||prefs.saved.includes(x.id))&&(!args.unreadOnly||!prefs.read.includes(x.id))&&(!args.preferredOnly||prefs.categoryIds.includes(category(x.meta?.category||'عمومی').id))).map(card);items.sort((a,b)=>(a.publishedAt-b.publishedAt)*(args.sort==='oldest'?1:-1));
   const categories=[...new Set(news.map(x=>x.meta?.category||'عمومی'))].map(n=>({...category(n),newsCount:news.filter(x=>(x.meta?.category||'عمومی')===n).length}));
   const sources=[...new Set(news.map(x=>x.meta?.sourceTitle||'کافی‌نت‌یار'))].map(n=>({id:n,name:n,kind:'manual',lastFetchedAt:null}));
   return json({items,urgent:[],categories,preferences:{categoryIds:prefs.categoryIds,updatedAt:null},savedCount:prefs.saved.length,unreadCount:news.filter(x=>!prefs.read.includes(x.id)).length,totalCount:news.length,hasDemo:false,sources,serverNow:Date.now()});
  }
  return json({error:'مسیر خواندن پیدا نشد.'},404);
 }
 if(!identity)return json({error:'ورود به سایت لازم است.'},401);
 const site=sites.find(x=>x.id===args.websiteId),article=news.find(x=>x.id===args.newsId);let result={ok:true};
 if(name==='websites:submitSuggestion'||name==='websites:reportBroken'){
  if(name.endsWith('reportBroken')&&!site)return json({error:'سامانه پیدا نشد.'},404);
  if(name.endsWith('submitSuggestion')){try{const u=new URL(args.url);if(u.protocol!=='https:'||!u.hostname.includes('.')||u.username||u.password)throw Error()}catch{return json({error:'نشانی HTTPS معتبر وارد کنید.'},400)}if(!args.name?.trim())return json({error:'نام سامانه لازم است.'},400);}
  const count=await db.prepare('SELECT count(*) AS n FROM library_requests WHERE identity_id=? AND created_at>?').bind(identity,Date.now()-3600000).first();if(count.n>=20)return json({error:'تعداد درخواست‌ها زیاد است؛ بعداً تلاش کنید.'},429);
  await db.prepare('INSERT INTO library_requests(id,identity_id,kind,payload,status,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),identity,name.endsWith('submitSuggestion')?'suggestion':'report',JSON.stringify(args),'pending',Date.now()).run();return json(result);
 }
 if(name.startsWith('websites:')&&!site)return json({error:'سامانه پیدا نشد.'},404);
 if(['news:toggleSaved','news:markRead'].includes(name)&&!article)return json({error:'مقاله پیدا نشد.'},404);
 if(name==='websites:toggleFavorite'){const saved=!prefs.favorites.includes(site.id);prefs.favorites=saved?[...prefs.favorites,site.id]:prefs.favorites.filter(x=>x!==site.id);result={isFavorite:saved};}
 else if(name==='websites:recordVisit')prefs.visited[site.id]=Date.now();
 else if(name==='websites:moveFavorite'){const i=prefs.favorites.indexOf(site.id),j=i+(args.direction==='up'?-1:1);result={moved:i>=0&&j>=0&&j<prefs.favorites.length};if(result.moved)[prefs.favorites[i],prefs.favorites[j]]=[prefs.favorites[j],prefs.favorites[i]];}
 else if(name==='news:toggleSaved'){const saved=!prefs.saved.includes(article.id);prefs.saved=saved?[...prefs.saved,article.id]:prefs.saved.filter(x=>x!==article.id);result={saved};}
 else if(name==='news:markRead')prefs.read=[...new Set([...prefs.read,article.id])];
 else if(name==='news:setPreferences'){const valid=new Set(news.map(x=>category(x.meta?.category||'عمومی').id));prefs.categoryIds=(Array.isArray(args.categoryIds)?args.categoryIds:[]).filter(x=>valid.has(x));}
 else return json({error:'عملیات ناشناخته'},400);
 await db.prepare('INSERT INTO library_preferences(identity_id,value) VALUES(?,?) ON CONFLICT(identity_id) DO UPDATE SET value=excluded.value').bind(identity,JSON.stringify(prefs)).run();return json(result);
}
