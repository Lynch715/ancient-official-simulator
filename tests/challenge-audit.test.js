import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,validateSave} from '../src/engine.js';
import {CASES,EVENTS} from '../src/data.js';
import {countyEvent} from '../src/county-content.js';
import {mainEvent} from '../src/county-hard.js';
import {PREF_EVENTS} from '../src/prefecture.js';
import {TZ_EVENTS} from '../src/tongzhi.js';
import {ZF_EVENTS} from '../src/zhifu.js';
import {IN_EVENTS} from '../src/inspector.js';
import {CZ_EVENTS} from '../src/canzheng.js';
import {BZ_EVENTS} from '../src/buzheng.js';
import {XF_EVENTS,XF_ENDINGS} from '../src/xunfu-data.js';
import {officeEvent} from '../src/office-hard.js';
import {OFFICE_CONTENT} from '../src/office-stories.js';
import {decisionRisk} from '../src/accountability.js';
import {xunfuEndingView} from '../src/xunfu-view.js';
import {run} from './helpers/challenge-county.js';
import {runPref,runTz,runZf} from './helpers/challenge-career.js';
import {act} from './helpers/career.js';
import {recover} from './helpers/challenge-recovery.js';

const offices=[['prefecture','pref',PREF_EVENTS],['tongzhi','tz',TZ_EVENTS],['zhifu','zf',ZF_EVENTS],['inspector','in',IN_EVENTS],['canzheng','cz',CZ_EVENTS],['buzheng','bz',BZ_EVENTS],['xunfu','xf',XF_EVENTS]];
const clone=s=>JSON.parse(JSON.stringify(s));
const roundtrip=s=>{const json=clone(s);assert.deepEqual(validateSave(json),json);return validateSave(json);};
function chooseFree(s,role,defs){
 const q=s[role],e=officeEvent(q,defs.find(d=>d.id===q.event));
 const o=e.options.find(o=>Object.values(o.cost).every(v=>!v)&&!decisionRisk(role,e.id,o.id));
 assert(o,`${role}/${e.id} needs a legal no-resource option`);return o.id;
}
function next(s,role,prefix,defs){if(s[role].event)s=act(s,prefix+'_event',{choice:chooseFree(s,role,defs)});return act(s,prefix+'_advance');}
function until(s,office,week){while(s[office[0]].turn<week)s=next(s,...office);return s;}
const county=run('careful',314159),starts={};
let previous=county;
for(const [role,play,appoint]of [['prefecture',runPref,'appointment'],['tongzhi',runTz,'tz_appoint'],['zhifu',runZf,'zf_appoint']]){starts[role]=act(previous,appoint);previous=play(previous,'diligent');}

test('知县三出身四种子主线无遗漏，四案均执行，来信最多出现两次',()=>{
 for(const family of ['humble','scholar','gentry'])for(const seed of [314159,101,8,13]){
  const s=run('careful',seed,family);
  for(const d of CASES){assert.equal(s.cases[d.id].status,'closed');assert.equal(s.cases[d.id].execution.status,'done');}
  for(let turn=0;turn<156;turn++){
   const id=mainEvent({...s,turn});if(!id)continue;
   assert(s.doneEvents.includes(id)||(id==='X13'&&s.doneEvents.includes('G06')),`${family}/${seed}/${id}`);
  }
  for(const id of new Set(s.doneEvents))assert(s.doneEvents.filter(x=>x===id).length<=(id.startsWith('W')?2:1));
  for(const id of Object.keys(EVENTS))assert(countyEvent(s,id).options.some(o=>Object.values(o.cost).every(v=>!v)&&!decisionRisk('county',id,o.id)),id);
  roundtrip(s);
 }
});

test('八任连续不达标仍能依法整改复考，实际升任并抵达巡抚结局',()=>{
 let s=run('careful',101);assert(s.outcome.score<75);s=recover(s);
 for(const office of offices){
  const [role,prefix]=office;s=act(s,role==='prefecture'?'appointment':prefix+'_appoint');
  assert.equal(s[role].challenge.version,1);
  s=until(s,office,156);assert(!s[role].outcome.candidate);
  const b=s.officeStories.offices[role];assert.equal(Object.keys(b.main).length,8);assert.equal(Object.keys(b.events).length,18);assert.equal(Object.keys(b.cases).length,4);
  s=recover(s);roundtrip(s);
 }
 assert.equal(Object.keys(s.accountability.qualifications).length,8);
 assert.equal(s.accountability.history.length,7);
 const html=xunfuEndingView(s,{esc:x=>x,btn:(label,action)=>`${action}:${label}`});assert.match(html,/xf-ending/);
 for(const choice of Object.keys(XF_ENDINGS)){const n=act(s,'xf_ending',{choice});roundtrip(n);assert.equal(n.xunfu.ending.choice,choice);assert.throws(()=>act(n,'xf_ending',{choice}));}
});

test('七任全部主线在钱粮精力为零时均有合法出口，不强迫违法',()=>{
 for(const [role,,defs]of offices)for(const e of defs){
  const q={hard:{seed:314159},challenge:{version:1},silver:0,grain:0,ap:0};
  const visible=officeEvent(q,e);
  assert(visible.options.some(o=>Object.values(o.cost).every(v=>!v)&&!decisionRisk(role,e.id,o.id)),`${role}/${e.id}`);
 }
});

test('通判合法开支耗尽公银后，T03可缓办推进，存档保留且不凭空发粮',()=>{
 let s=starts.prefecture;
 while(s.prefecture.event!=='T03'){
  if(s.prefecture.event)s=act(s,'pref_event',{choice:chooseFree(s,'prefecture',PREF_EVENTS)});
  if(s.prefecture.silver>=30&&s.prefecture.ap&&s.prefecture.condition<100)s=act(s,'pref_repair');
  for(const c of Object.values(s.prefecture.counties))if(s.prefecture.ap&&s.prefecture.silver>=6&&s.prefecture.turn-c.lastAudit>=4)s=act(s,'pref_audit',{county:c.id});
  s=act(s,'pref_advance');assert(s.prefecture.turn<40);
 }
 assert(s.prefecture.silver<8,`Expected shortage, got ${s.prefecture.silver}`);
 const before=clone(s.prefecture);s=act(s,'pref_event',{choice:'defer'});
 assert.equal(s.prefecture.silver,before.silver);assert.equal(s.prefecture.grain,before.grain);assert.equal(s.prefecture.ap,before.ap);
 assert.equal(s.prefecture.trust,Math.max(0,before.trust-2));assert(!s.prefecture.misconduct);assert.deepEqual(s.prefecture.pending,before.pending);
 s=roundtrip(s);assert.equal(s.officeStories.offices.prefecture.main.T03.choice,'defer');
 assert.equal(act(s,'pref_advance').prefecture.turn,before.turn+1);
});

for(const id of ['D03','D04'])test(`${id}零资源边界保留人口与粮册，不伪造赈济或工效`,()=>{
 let s=starts.tongzhi;while(s.tongzhi.event!==id)s=next(s,...offices[1]);
 // Adversarial command boundary, separate from the unmodified full-career simulations.
 s=clone(s);s.tongzhi.silver=0;s.tongzhi.grain=0;s.tongzhi.ap=0;
 const before=clone(s.tongzhi);s=act(s,'tz_event',{choice:'defer'});
 for(const key of ['silver','grain','ap','counties','projects','workReliefUntil'])assert.deepEqual(s.tongzhi[key],before[key]);
 assert.equal(s.tongzhi.trust,Math.max(0,before.trust-2));assert(!s.tongzhi.misconduct);
 assert.equal(act(s,'tz_advance').tongzhi.turn,before.turn+1);
});

test('缓办仅供新严苛，不改旧档选项或旧难度',()=>{
 for(const e of [PREF_EVENTS.find(e=>e.id==='T03'),...TZ_EVENTS.filter(e=>['D03','D04'].includes(e.id))]){
  assert(!officeEvent({hard:{seed:1}},e).options.some(o=>o.id==='defer'));
  assert(!officeEvent({},e).options.some(o=>o.id==='defer'));
 }
 assert.equal(createGame({difficulty:'standard'}).balanceVersion,0);
});

for(const office of offices.slice(0,3))test(`${office[0]}第156周案卷与剧情回报计入最终分数，无漏结`,()=>{
 const [role,prefix]=office;let s=until(starts[role],office,147);
 const d=OFFICE_CONTENT[role].cases.at(-1);
 for(const clue of d.clues){if(s[role].event)s=act(s,prefix+'_event',{choice:chooseFree(s,role,office[2])});s=act(s,'office_case',{case:d.id,action:'clue',clue:clue.id});s=next(s,...office);}
 s=act(s,'office_case',{case:d.id,action:'review',choice:'evidence'});s=until(s,office,153);
 const story=OFFICE_CONTENT[role].events.at(-1);
 s=act(s,'office_story',{event:story.id,choice:'check'});s=until(s,office,154);
 if(s[role].event)s=act(s,prefix+'_event',{choice:chooseFree(s,role,office[2])});
 s=act(s,'office_case',{case:d.id,action:'execute'});s=until(s,office,156);
 assert.equal(s.officeStories.offices[role].cases[d.id].closed,156);assert.equal(s[role].challenge.cases,1);
 assert.equal(s.officeStories.offices[role].events[story.id].completed,156);assert.equal(s[role].challenge.stories,1);
 assert.match(s[role].outcome.summary,/当前1\/4案/);roundtrip(s);
});
