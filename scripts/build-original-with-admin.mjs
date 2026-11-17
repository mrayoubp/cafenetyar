import {readFileSync,writeFileSync,readdirSync,mkdirSync,copyFileSync} from 'node:fs';
import {join,relative} from 'node:path';
import {execFileSync} from 'node:child_process';
const root=process.cwd(),dir=join(root,'source/dist'),assets={};
function walk(path){for(const entry of readdirSync(path,{withFileTypes:true})){const file=join(path,entry.name);if(entry.isDirectory())walk(file);else assets['/'+relative(dir,file).replaceAll('\\','/')]=readFileSync(file).toString('base64');}}
walk(dir);if(!assets['/index.html']||!Object.keys(assets).some(x=>x.startsWith('/assets/index-')))throw Error('Original app build missing. Refusing to publish the standalone management app.');
writeFileSync('native/original-assets.generated.mjs','export default '+JSON.stringify(assets)+';\n');
mkdirSync('dist/server',{recursive:true});
execFileSync('source/node_modules/.bin/esbuild',['native/composed-server.mjs','--bundle','--format=esm','--platform=browser','--target=es2022','--outfile=dist/server/index.js'],{stdio:'inherit'});
function copyDir(from,to){mkdirSync(to,{recursive:true});for(const e of readdirSync(from,{withFileTypes:true})){e.isDirectory()?copyDir(join(from,e.name),join(to,e.name)):copyFileSync(join(from,e.name),join(to,e.name));}}
copyDir('drizzle','dist/server/drizzle');
console.log('Original app assets bundled:',Object.keys(assets).length);
