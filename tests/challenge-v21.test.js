import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createGame,dispatch,validateSave,VERSION} from '../src/engine.js';
import {contentAssessment,lateAssessment,contentStats,CHALLENGE} from '../src/career-difficulty.js';
import {challengePanel,challengeRules} from '../src/career-difficulty-view.js';
import {guideContent} from '../src/guide.js';
import {OFFICE_CONTENT} from '../src/office-stories.js';
import {run} from './helpers/challenge-county.js';
import {runPref,runTz,runZf} from './helpers/challenge-career.js';
import {inPlay,czPlay,bzPlay,xfPlay} from './helpers/challenge-late.js';
import {act} from './helpers/career.js';
const late=[['inspector','in',inPlay,'dockets'],['canzheng','cz',czPlay,'projects'],['buzheng','bz',bzPlay,'promises'],['xunfu','xf',xfPlay,'missions']];
const roundtrip=s=>{const json=JSON.parse(JSON.stringify(s));assert.deepEqual(validateSave(json),json);};
const golden=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/v16-legacy-eight-golden.json.gz',import.meta.url))));
for(const r of golden)test(`v16旧${r.role}迁移及十周续玩与v0.20引擎逐字段相等`,()=>{
 const before=structuredClone(r.initial);let s=validateSave(r.initial);
 assert.equal(s.balanceVersion,0);assert.equal(s.version,VERSION);
 const strip=n=>{const x=structuredClone(n);delete x.balanceVersion;x.version=16;return x;};
 assert.deepEqual(strip(s),r.initial);
 for(const c of r.commands){s=dispatch(s,c);roundtrip(s);}
 assert.deepEqual(strip(s),r.expected);assert.deepEqual(r.initial,before);
});
test('新局锁定新严苛，常例及旧履历仍保留原规则',()=>{
 assert.equal(createGame().balanceVersion,1);assert.equal(createGame({difficulty:'standard'}).balanceVersion,0);
 assert.throws(()=>validateSave({...createGame(),balanceVersion:3}));
 const n=createGame({difficulty:'standard'});n.balanceVersion=1;assert.throws(()=>validateSave(n));
});
const starts={},finished={};
let career=run('careful',314159);finished.county=career;roundtrip(career);
for(const [role,play] of [['prefecture',runPref],['tongzhi',runTz],['zhifu',runZf]]){career=play(career,'diligent');finished[role]=career;roundtrip(career);}
for(const [role,prefix,play] of late){career=act(career,prefix+'_appoint');starts[role]=career;career=play(career,{policy:'check',onStep:(s,type)=>{if(type===prefix+'_advance'&&s[role].turn%13===0)roundtrip(s);}});finished[role]=career;roundtrip(career);}
test('从新县任至巡抚连续1248周，八任均可75分以上称职且后四任不满分',()=>{
 assert.equal(finished.county.outcome.rating,'称职');
 for(const [role,s]of Object.entries(finished)){
  const q=role==='county'?s:s[role];assert.equal(q.turn,156);assert(q.outcome.score>=75);assert.equal(q.outcome.rating,'称职');
  if(role!=='county'){assert(q.outcome.candidate);const b=s.officeStories.offices[role];assert.equal(Object.keys(b.main).length,8);assert.equal(Object.keys(b.events).length,18);assert.equal(Object.keys(b.cases).length,4);assert.deepEqual(q.challenge,{version:1,role,...contentStats(b)});for(const d of OFFICE_CONTENT[role].events)assert.equal(s.officeStories.counts[d.id],1);}
 }
 for(const [role]of late){assert(finished[role][role].outcome.score<95);assert.equal(starts[role][role].ap,1);}
});
test('剧情全交属员即使本职全办也不能再靠其他高分直接晋升',()=>{
 for(const [role,prefix,play]of late){const s=play(starts[role],{policy:'delegate'});assert.equal(s[role].challenge.stories,0);assert(!s[role].outcome.candidate);assert(s.accountability.current);roundtrip(s);}
});
test('剧情和案件为硬条件，留有非满清容错，违规仍不能称职',()=>{
 const c={version:1,role:'inspector',stories:18,cases:4,timelyCases:4},rows=Array.from({length:12},()=>({opened:0,closed:24}));
 const assess=(patch={},work=rows,quality=()=>1,scope=true)=>lateAssessment({challenge:{...c,...patch}},work,quality,100,scope);
 assert.equal(assess().score,100);assert(assess().candidate);
 for(const patch of [{cases:2,timelyCases:2},{stories:11}]){assert(assess(patch).score>=75);assert(!assess(patch).candidate);}
 assert(assess({cases:3,timelyCases:3,stories:16},rows.slice(0,11)).candidate);
 assert(!assess({},rows.slice(0,8)).candidate);assert(!assess({},rows,()=>.6).candidate);assert(!assess({},rows,()=>1,false).candidate);
 assert(!lateAssessment({challenge:c,misconduct:true},rows,()=>1,100).candidate);
 for(const role of ['prefecture','tongzhi','zhifu']){
  const q={challenge:{...c,role,cases:3,stories:12}},result={score:90,candidate:true,rating:'称职',summary:''};
  assert(contentAssessment(q,result).candidate);q.challenge.cases=2;assert(!contentAssessment(q,result).candidate);q.challenge.cases=4;q.challenge.stories=11;assert(!contentAssessment(q,result).candidate);
 }
});
test('本职和来源案的按期边界与逾期折算独立，逾期不封死补办',()=>{
 for(const [role]of late){const limit=CHALLENGE[role].workLimit,c={version:1,role,stories:18,cases:4,timelyCases:4};
  const rows=Array.from({length:12},()=>({opened:10,closed:10+limit}));
  assert.equal(lateAssessment({challenge:c},rows,()=>1,100).score,100);
  rows[0].closed++;assert.equal(lateAssessment({challenge:c},rows,()=>1,100).score,99);
  for(const r of rows)r.closed++;assert.equal(lateAssessment({challenge:{...c,timelyCases:0}},rows,()=>1,100).score,77);assert(lateAssessment({challenge:{...c,timelyCases:0}},rows,()=>1,100).candidate);
 }
 assert.deepEqual(contentStats({events:{a:{status:'done'},b:{status:'delegated'}},cases:{a:{status:'closed',opened:10,closed:26},b:{status:'closed',opened:10,closed:27},c:{status:'executing'}}}),{stories:1,cases:2,timelyCases:1});
});
function advance(s,role,prefix,to){while(s[role].turn<to){if(s[role].event)s=act(s,prefix+'_event',{choice:'refer'});s=act(s,prefix+'_advance');}return s;}
for(const [role,prefix]of late)test(`新严苛${role}最后一周来源案归档先于考评分，读档无漏结`,()=>{
 let s=advance(starts[role],role,prefix,147),d=OFFICE_CONTENT[role].cases.at(-1);
 for(const clue of d.clues){if(s[role].event)s=act(s,prefix+'_event',{choice:'refer'});s=act(s,'office_case',{case:d.id,action:'clue',clue:clue.id});s=advance(s,role,prefix,s[role].turn+1);}
 s=act(s,'office_case',{case:d.id,action:'review',choice:'evidence'});s=advance(s,role,prefix,154);if(s[role].event)s=act(s,prefix+'_event',{choice:'refer'});s=act(s,'office_case',{case:d.id,action:'execute'});s=advance(s,role,prefix,156);
 assert.equal(s.officeStories.offices[role].cases[d.id].closed,156);assert.equal(s[role].challenge.cases,1);assert.match(s[role].outcome.summary,/来源案归档1\/4/);roundtrip(s);
});
test('存档拒绝伪造查验数量、难度标记和越额精力',()=>{
 for(const [role]of late)for(const change of [s=>delete s[role].challenge,s=>s[role].challenge.cases++,s=>s[role].challenge.role='county',s=>s[role].ap=3,s=>s.balanceVersion=0]){const n=structuredClone(starts[role]);change(n);assert.throws(()=>validateSave(n));}
});
test('七任考核面板、指南显示实际新规则，旧档没有新增门槛文案',()=>{
 for(const role of Object.keys(OFFICE_CONTENT)){const s=finished[role],html=challengePanel(s,role),guide=guideContent(s);assert.match(html,/75分/);assert.match(html,/3\/4/);assert.match(html,/12\/18/);assert(!html.includes('undefined'));assert.match(guide,/新严苛考评/);if(CHALLENGE[role]){assert.match(html,/每周1点亲办精力/);assert.match(challengeRules(s[role]),new RegExp(CHALLENGE[role].workLimit+'周内'));}}
 for(const r of golden.filter(r=>r.role!=='county'))assert.match(challengePanel(validateSave(r.initial),r.role),/沿用原有/);
});
