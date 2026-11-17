import management from './server.mjs';
import assets from './original-assets.generated.mjs';
const typeFor=path=>path.endsWith('.html')?'text/html; charset=utf-8':path.endsWith('.js')?'application/javascript; charset=utf-8':path.endsWith('.css')?'text/css; charset=utf-8':path.endsWith('.svg')?'image/svg+xml':path.endsWith('.png')?'image/png':path.endsWith('.woff2')?'font/woff2':path.endsWith('.zip')?'application/zip':path.endsWith('.webmanifest')?'application/manifest+json':'application/octet-stream';
export default {async fetch(request,env,ctx){
 const path=new URL(request.url).pathname;
 if(!['GET','HEAD'].includes(request.method)&&!path.startsWith('/api/'))return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});
 if(path==='/favicon.ico')return Response.redirect(new URL('/logo.svg',request.url),302);
 if(path==='/downloads/kafinetyar-setup.zip')return Response.redirect('https://github.com/mrayoubp/cafenetyar',302);
 if(path==='/downloads'||path==='/downloads/')return new Response(request.method==='HEAD'?null:Uint8Array.from(atob(assets['/downloads/index.html']),c=>c.charCodeAt(0)),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'}});
 // Management is an addition. Every other page and static asset is the original Vite app.
 if(path==='/manage'||path.startsWith('/manage/')||path.startsWith('/api/'))return management.fetch(request,env,ctx);
 if(path==='/admin'||path.startsWith('/admin/')||path==='/super-admin')return Response.redirect(new URL('/manage',request.url),302);
 const key=Object.hasOwn(assets,path)?path:!path.split('/').pop().includes('.')?'/index.html':null;
 if(!key)return new Response('Not found',{status:404});
 const data=Uint8Array.from(atob(assets[key]),c=>c.charCodeAt(0));
 return new Response(request.method==='HEAD'?null:data,{headers:{'Content-Type':typeFor(key),'Cache-Control':key==='/index.html'?'no-cache':key.startsWith('/assets/')?'public, max-age=31536000, immutable':'no-cache','X-Content-Type-Options':'nosniff'}});
}};
