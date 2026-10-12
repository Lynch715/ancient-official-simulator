let registration=null,promptEvent=null,listener=()=>{},reloading=false;
const built=!!document.querySelector('meta[name="offline-build"]');
const info={supported:built&&'serviceWorker'in navigator,ready:false,waiting:false,installable:false,text:built?'正在准备离线资源…':'本地开发预览；发布包支持离线准备。'};
export const offlineInfo=()=>({...info});
const update=x=>{Object.assign(info,x);listener(offlineInfo());};
async function status(){const worker=registration?.active;if(!worker)return;const result=await new Promise(resolve=>{const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();resolve(null);},4000);channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data);};worker.postMessage({type:'OFFLINE_STATUS'},[channel.port2]);});if(result)update({ready:result.ready,waiting:!!registration.waiting,text:result.ready?`离线资源已备齐，可离线打开本网址续玩。版本 ${result.build}`:'离线资源不完整，请联网后检查更新。'});}
export async function startOffline(onChange){listener=onChange;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();promptEvent=e;update({installable:true});});window.addEventListener('appinstalled',()=>update({installable:false}));
 if(!info.supported){update({text:built?'此浏览器暂不支持离线缓存；仍可联网玩。':info.text});return;}
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloading)location.reload();else status().catch(()=>{});});
 try{registration=await navigator.serviceWorker.register(new URL('../sw.js',import.meta.url),{scope:new URL('../',import.meta.url).pathname,updateViaCache:'none'});const watch=()=>{const worker=registration.installing;if(!worker)return;worker.addEventListener('statechange',()=>{if(worker.state==='installed'){update({waiting:!!registration.waiting});if(!registration.active)update({text:'离线资源已下载，正在启用…'});}if(worker.state==='activated')status().catch(()=>{});if(worker.state==='redundant')update({text:'离线资源准备未完成，请联网重试。'});});};registration.addEventListener('updatefound',watch);watch();await navigator.serviceWorker.ready;await status();}
 catch{update({text:'离线资源准备失败，请保持联网并稍后检查更新。'});}
}
export async function checkOffline(){if(!registration)return;update({text:'正在检查版本与离线资源…'});try{await registration.update();if(!info.ready&&registration.active)await new Promise(resolve=>{const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();resolve();},30000);channel.port1.onmessage=()=>{clearTimeout(timer);channel.port1.close();resolve();};registration.active.postMessage({type:'REPAIR_CACHE'},[channel.port2]);});await status();if(registration.waiting)update({waiting:true});}catch{update({text:info.ready?'当前离线资源可用，暂时无法检查新版本。':'无法联网检查；离线资源尚未备齐。'});}}
export function applyOfflineUpdate(save){if(!registration?.waiting)return;if(!save())return;reloading=true;registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});}
export async function installOffline(){if(!promptEvent)return;await promptEvent.prompt();await promptEvent.userChoice;promptEvent=null;update({installable:false});}
