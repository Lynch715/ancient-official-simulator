import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync('dist/sw.js','utf8');
const files=JSON.parse(code.match(/const FILES=(.*);/)[1]);
const build=JSON.parse(code.match(/const BUILD=(.*);/)[1]);
function worker({base='https://example.test/game/',fail=null}={}){
 const listeners={},stores=new Map();let skipped=0,offline=false;
 const key='qinghe-offline:'+new URL(base).pathname+':'+build;
 const network=async request=>{const url=typeof request==='string'?request:request.url;if(offline||url.endsWith(fail))throw Error('offline');return new Response(fs.readFileSync('dist/'+new URL(url).pathname.slice(new URL(base).pathname.length)));};
 const caches={keys:async()=>[...stores.keys()],delete:async n=>stores.delete(n),open:async n=>{if(!stores.has(n))stores.set(n,new Map());const store=stores.get(n);return{match:async req=>store.get(typeof req==='string'?req:req.url)?.clone(),put:async(req,response)=>store.set(typeof req==='string'?req:req.url,response.clone()),addAll:async reqs=>{const responses=await Promise.all(reqs.map(network));reqs.forEach((r,i)=>store.set(r.url,responses[i]));}};}};
 const self={location:{href:base+'sw.js'},clients:{claim:async()=>{}},skipWaiting:async()=>{skipped++;},addEventListener:(type,handler)=>listeners[type]=handler};
 vm.runInNewContext(code,{self,caches,URL,Request,fetch:network});
 const emit=async(type,extra={})=>{let result;listeners[type]({...extra,waitUntil:p=>result=p,respondWith:p=>result=p});return result;};
 return{base,key,stores,caches,emit,get skipped(){return skipped;},set offline(v){offline=v;},fetch:path=>emit('fetch',{request:new Request(new URL(path,base))})};
}
test('发布清单完整、无根路径依赖，图标与版本一致',()=>{
 assert(files.length>=120);assert.equal(new Set(files).size,files.length);
 for(const file of files){assert(!file.startsWith('/'));assert(fs.existsSync('dist/'+file));}
 const html=fs.readFileSync('dist/index.html','utf8');assert(html.includes(`content="${build}"`));
 const m=JSON.parse(fs.readFileSync('dist/manifest.webmanifest'));assert.equal(m.scope,'./');assert.equal(m.start_url,'./');for(const icon of m.icons)assert(files.includes(icon.src));
 assert(!fs.readFileSync('index.html','utf8').includes('name="offline-build"'));
});
test('子目录首次安装后，断网仍可取回全部游戏与美术资源',async()=>{
 const w=worker();await w.emit('install');w.offline=true;
 for(const file of files){const response=await w.fetch(file);assert(response.ok,file);assert.equal((await response.arrayBuffer()).byteLength,fs.statSync('dist/'+file).size);}
 assert((await w.fetch('./')).ok);assert((await w.fetch('index.html?from=home')).ok);
});
test('根目录部署同样可离线访问',async()=>{const w=worker({base:'https://example.test/'});await w.emit('install');w.offline=true;assert((await w.fetch('./')).ok);});
test('不拦截其它仓库、未知地址及写请求',async()=>{
 const w=worker();assert.equal(await w.fetch('../other/'),undefined);assert.equal(await w.fetch('unknown.json'),undefined);
 assert.equal(await w.emit('fetch',{request:new Request(w.base+'index.html',{method:'POST'})}),undefined);
});
test('下载中断删除残缺的新缓存，保留旧版',async()=>{
 const w=worker({fail:'src/app.js'});await w.caches.open('qinghe-offline:/game/:old');await assert.rejects(w.emit('install'));
 assert(!w.stores.has(w.key));assert(w.stores.has('qinghe-offline:/game/:old'));
});
test('启用新版本只清除本仓库旧缓存',async()=>{
 const w=worker();await w.emit('install');for(const n of ['qinghe-offline:/game/:old','qinghe-offline:/other/:old','unrelated'])await w.caches.open(n);
 await w.emit('activate');assert(!w.stores.has('qinghe-offline:/game/:old'));assert(w.stores.has('qinghe-offline:/other/:old'));assert(w.stores.has('unrelated'));assert(w.stores.has(w.key));
});
test('更新等待玩家明确操作，不自行抢占页面',async()=>{
 const w=worker();await w.emit('install');assert.equal(w.skipped,0);
 await w.emit('message',{data:{type:'ACTIVATE_UPDATE'},source:{url:'https://other.test/'}});assert.equal(w.skipped,0);
 await w.emit('message',{data:{type:'ACTIVATE_UPDATE'},source:{url:w.base}});assert.equal(w.skipped,1);
});
test('缓存缺失可被准确报告，并在联网检查时补齐',async()=>{
 const w=worker();await w.emit('install');let status;
 const message=type=>w.emit('message',{data:{type},source:{url:w.base},ports:[{postMessage:x=>status=x}]});
 await message('OFFLINE_STATUS');assert.equal(status.ready,true);
 w.stores.get(w.key).delete(w.base+'src/app.js');await message('OFFLINE_STATUS');assert.equal(status.ready,false);
 await message('REPAIR_CACHE');assert.equal(status.ok,true);await message('OFFLINE_STATUS');assert.equal(status.ready,true);
});
