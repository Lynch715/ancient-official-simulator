import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { gunzipSync } from "node:zlib";
import { createGame,dispatch,validateSave,VERSION } from "../src/engine.js";
import { BZ_PROMISES,BZ_EVENTS,BZ_FUNDS,bzTeams,bzTravel,bzAvailable,buzhengAssessment,buzhengHard } from "../src/buzheng.js";
import { OFFICE_CONTENT,blankOfficeStories,syncOfficeStories,sourceClueCost } from "../src/office-stories.js";
import { buzhengPrevious,bzNext,bzPlay } from "./helpers/buzheng.js";
import { act } from "./helpers/career.js";
import { buzhengView } from "../src/buzheng-view.js";
import { guideContent } from "../src/guide.js";
const previous=buzhengPrevious(),hardPrevious=buzhengPrevious(true);
const start=(hard=false)=>act(hard?hardPrevious:previous,"bz_appoint");
const weeks=(s,n)=>{for(let i=0;i<n;i++)s=bzNext(s);return s;};
const work=(s,id,action)=>act(s,"bz_promise",{promise:id,action});
const roundtrip=s=>{const json=JSON.parse(JSON.stringify(s));assert.deepEqual(validateSave(json),json);assert.equal(dispatch(s,{id:s.completedCommands.at(-1),type:"bz_advance"}),s);};
function ready(){let s=act(start(),"bz_event",{choice:"refer"});s=work(s,"BP01","audit");s=work(s,"BP01","request");return weeks(s,2);}
test("布政使任命承接前六任，日常与三专款独立，旧任冻结",()=>{
 assert.throws(()=>act(createGame(),"bz_appoint"));const s=start();assert.equal(s.version,VERSION);assert.equal(s.buzheng.silver,150);assert.equal(s.buzheng.funds.relief.silver,300);assert.equal(s.buzheng.private,previous.canzheng.private);assert.equal(s.buzheng.counties.beiling.people,previous.canzheng.counties.beiling.people);assert.equal(s.buzheng.counties.dongpu.people,65);assert.deepEqual(s.canzheng,previous.canzheng);
 for(const type of ["bz_appoint","cz_advance","in_advance","zf_advance","tz_advance","pref_advance","advance"])assert.throws(()=>act(s,type));roundtrip(s);
});
test("真实v14参政开局、办理中、常例及严苛考满原样迁移并继续",()=>{
 for(const file of ["standard-start","standard-finished","hard-finished","browser-active"]){const old=JSON.parse(gunzipSync(fs.readFileSync(new URL(`./fixtures/v14-canzheng-${file}.json.gz`,import.meta.url))));assert.equal(old.version,14);const n=validateSave(old);assert.equal(n.buzheng,null);const stripped=structuredClone(n);stripped.version=14;delete stripped.buzheng;delete stripped.xunfu;assert.deepEqual(stripped,old);roundtrip(n);if(n.canzheng.finished){const next=act(n,"bz_appoint");assert(next.buzheng);roundtrip(next);}else{let next=n;if(next.canzheng.event)next=act(next,"cz_event",{choice:"refer"});next=act(next,"cz_advance");assert.equal(next.canzheng.turn,n.canzheng.turn+1);roundtrip(next);}}
});
test("承诺占用、分批扣款、到达和两次核收逐段独立",()=>{
 let s=ready();assert.throws(()=>work(s,"BP01","dispatch"));const initial=s.buzheng.funds.relief.silver;s=work(s,"BP01","reserve");assert.equal(s.buzheng.funds.relief.silver,initial);assert.equal(bzAvailable(s.buzheng,"relief").held.silver,104);assert.throws(()=>work(s,"BP01","reserve"));
 const available=bzAvailable(s.buzheng,"relief").silver,score=buzhengAssessment(s).score;s=work(s,"BP01","dispatch");assert.equal(s.buzheng.funds.relief.silver,initial-52);assert.equal(bzAvailable(s.buzheng,"relief").silver,available);assert.equal(s.buzheng.counties.beiling.receivedSilver,0);assert.throws(()=>work(s,"BP01","verify"));assert.throws(()=>work(s,"BP01","dispatch"));
 s=weeks(s,2);assert.equal(s.buzheng.counties.beiling.receivedSilver,52);assert.equal(buzhengAssessment(s).score,score);s=work(s,"BP01","verify");assert.equal(buzhengAssessment(s).score,score);assert.equal(s.buzheng.promises.BP01.status,"partial");assert.throws(()=>work(s,"BP01","verify"));s=work(s,"BP01","dispatch");assert.equal(bzAvailable(s.buzheng,"relief").held.silver,0);s=weeks(s,2);s=work(s,"BP01","verify");assert.equal(s.buzheng.promises.BP01.status,"closed");assert(buzhengAssessment(s).score>score);assert.throws(()=>work(s,"BP01","dispatch"));roundtrip(s);
});
for(const hard of [false,true])for(const policy of ["help","check","delegate"])test(`${hard?"严苛":"常例"}三年真实全流程·剧情${policy}，触发无缺、各一次、账可往返`,()=>{
 const s=bzPlay(start(hard),{policy,onStep:(s,type)=>{if(type==="bz_advance"&&s.buzheng.turn%13===0)roundtrip(s);}}),b=s.officeStories.offices.buzheng;
 assert(s.buzheng.outcome.candidate);assert.equal(s.buzheng.turn,156);assert.equal(Object.values(s.buzheng.promises).filter(r=>r.status==="closed").length,12);assert.equal(Object.keys(b.main).length,8);assert.equal(Object.keys(b.events).length,18);assert.equal(Object.values(b.cases).filter(r=>r.status==="closed").length,4);assert(Object.values(s.buzheng.promises).every(r=>r.shipments.length===2&&r.shipments.every(x=>x.verified!==null)));
 for(const d of OFFICE_CONTENT.buzheng.events)assert.equal(s.officeStories.counts[d.id],1);assert.equal(b.queue.length,0);assert.deepEqual(s.canzheng,hard?hardPrevious.canzheng:previous.canzheng);assert.throws(()=>act(s,"bz_advance"));roundtrip(s);
});
test("专款不串用且不能二次承诺，容量含到达待核，拒绝不改原状态",()=>{
 let s=act(start(),"bz_event",{choice:"refer"});for(const id of ["BP01","BP02","BP03"])s=work(s,id,"audit");s=bzNext(s);for(const id of ["BP01","BP02","BP03"])s=work(s,id,"request");s=weeks(s,2);for(const id of ["BP01","BP02","BP03"])s=work(s,id,"reserve");s=bzNext(s);s=work(s,"BP01","dispatch");s=work(s,"BP02","dispatch");assert.equal(bzTeams(s.buzheng),2);assert.throws(()=>work(s,"BP03","dispatch"));s=weeks(s,3);assert.equal(bzTeams(s.buzheng),2);assert.throws(()=>work(s,"BP03","dispatch"));s=work(s,"BP01","verify");s=work(s,"BP03","dispatch");roundtrip(s);
 let poor=ready();poor.buzheng.funds.relief.silver=103;const snapshot=structuredClone(poor);assert.throws(()=>work(poor,"BP01","reserve"));assert.deepEqual(poor,snapshot);
 // Same-fund requests from different waves compete for the same unspent reservation.
 let double=weeks(start(),39);double=work(double,"BP01","audit");double=work(double,"BP01","request");double=work(double,"BP04","audit");double=bzNext(double);double=work(double,"BP04","request");double=weeks(double,2);
 double.buzheng.funds.relief.silver=180;double=work(double,"BP01","reserve");assert.equal(double.buzheng.funds.relief.silver,180);assert.equal(bzAvailable(double.buzheng,"relief").silver,76);const unchanged=structuredClone(double);assert.throws(()=>work(double,"BP04","reserve"));assert.deepEqual(double,unchanged);
});
test("一次调剂先入暂存两周再入指定专款，不重复记银粮",()=>{
 let s=act(start(),"bz_event",{choice:"refer"}),before=structuredClone(s.buzheng);s=act(s,"bz_adjust",{fund:"river"});assert.equal(s.buzheng.silver,before.silver-60);assert.equal(s.buzheng.grain,before.grain-40);assert.deepEqual(s.buzheng.funds,before.funds);roundtrip(s);assert.throws(()=>act(s,"bz_adjust",{fund:"river"}));assert.throws(()=>act(s,"bz_adjust",{fund:"private"}));s=bzNext(s);assert.equal(s.buzheng.adjustments.river.approved,null);s=bzNext(s);assert.equal(s.buzheng.funds.river.silver,before.funds.river.silver+4+60);assert.equal(s.buzheng.funds.river.grain,before.funds.river.grain+2+40);assert.equal(s.buzheng.funds.relief.silver,before.funds.relief.silver+4);roundtrip(s);
});
test("八份公文全部选项入责任簿，虚报不等于实绩",()=>{let s=start();for(const e of BZ_EVENTS){s=weeks(s,e.week-s.buzheng.turn);for(const o of e.options){const n=act(s,"bz_event",{choice:o.id});roundtrip(n);if(o.misconduct)assert(n.accountability.incidents.some(i=>i.role==="buzheng"&&i.week===e.week));}s=act(s,"bz_event",{choice:"verify"});}let bad=act(start(),"bz_event",{choice:"shortcut"});bad=weeks(bad,156);assert.equal(bad.buzheng.outcome.rating,"候查");assert.equal(bad.accountability.current.status,"inquiry");roundtrip(bad);});
test("四件来源案草率复核退回，三证后复核执行各两周，不能重复",()=>{let s=start();for(const d of OFFICE_CONTENT.buzheng.cases){s=weeks(s,d.week-s.buzheng.turn);s=act(s,"office_case",{case:d.id,action:"review",choice:"hasty"});s=weeks(s,2);assert.equal(s.officeStories.offices.buzheng.cases[d.id].status,"returned");for(const e of d.clues)s=act(s,"office_case",{case:d.id,action:"clue",clue:e.id});s=bzNext(s);s=act(s,"office_case",{case:d.id,action:"review",choice:"evidence"});s=weeks(s,2);s=act(s,"office_case",{case:d.id,action:"execute"});s=weeks(s,2);assert.equal(s.officeStories.offices.buzheng.cases[d.id].status,"closed");assert.throws(()=>act(s,"office_case",{case:d.id,action:"execute"}));roundtrip(s);}});
test("末周可核收、最后一周来源案归档纳入考评，未竟承诺不释放",()=>{
 let s=ready();s=work(s,"BP01","reserve");s=weeks(s,149);s=work(s,"BP01","dispatch");s=weeks(s,2);s=work(s,"BP01","verify");s=work(s,"BP01","dispatch");s=weeks(s,2);assert.equal(s.buzheng.turn,155);s=work(s,"BP01","verify");s=bzNext(s);assert.equal(s.buzheng.promises.BP01.closed,155);roundtrip(s);
 let terminal=weeks(start(),151);for(const e of OFFICE_CONTENT.buzheng.cases[3].clues)terminal=act(terminal,"office_case",{case:"BC04",action:"clue",clue:e.id});terminal=bzNext(terminal);terminal=act(terminal,"bz_event",{choice:"refer"});terminal=act(terminal,"office_case",{case:"BC04",action:"review",choice:"evidence"});terminal=weeks(terminal,2);terminal=act(terminal,"office_case",{case:"BC04",action:"execute"});terminal=weeks(terminal,2);assert.equal(terminal.officeStories.offices.buzheng.cases.BC04.status,"closed");assert.match(terminal.buzheng.outcome.summary,/归档1\/4/);roundtrip(terminal);
 let unspent=work(ready(),"BP01","reserve");unspent=weeks(unspent,154);assert.equal(unspent.buzheng.promises.BP01.status,"handover");assert.equal(bzAvailable(unspent.buzheng,"relief").held.silver,104);roundtrip(unspent);
 const late=weeks(work(ready(),"BP01","reserve"),150);assert.throws(()=>work(late,"BP01","dispatch"));assert.throws(()=>act(weeks(start(),154),"bz_adjust",{fund:"supply"}));
});
test("全任不主动办事仍有18独立剧情留卷、4案交接，不能空转称职",()=>{const s=weeks(start(),156),b=s.officeStories.offices.buzheng;assert(Object.values(s.buzheng.promises).every(r=>r.status==="handover"));assert.equal(Object.keys(b.main).length,8);assert.equal(Object.keys(b.events).length,18);assert(Object.values(b.events).every(r=>r.status==="delegated"));assert(Object.values(b.cases).every(r=>r.status==="handover"));assert(!s.buzheng.outcome.candidate);roundtrip(s);});
test("篡改余额、占用、批次实到和专款流水会被拒收",()=>{const s=bzPlay(start(),{until:25});for(const mutate of [n=>n.buzheng.silver++,n=>n.buzheng.funds.relief.silver++,n=>n.buzheng.promises.BP01.reserved=null,n=>n.buzheng.promises.BP01.shipments[0].arrived--,n=>n.buzheng.promises.BP01.shipments[1].verified=0,n=>n.buzheng.counties.beiling.receivedGrain++,n=>delete n.officeStories.offices.buzheng.main.B01,n=>n.buzheng.ledger.find(r=>r.title==="BP01第1批拨运").fund="river"]){const n=structuredClone(s);mutate(n);assert.throws(()=>validateSave(n));}});
test("千种严苛排程每条一次，主线剧情案件间隔不超过八周",()=>{for(let seed=1;seed<=1000;seed++){const s={seed,officeStories:blankOfficeStories(),buzheng:{turn:0,finished:false,logs:[],nextLog:1,hard:buzhengHard(seed)}};syncOfficeStories(s);const values=Object.values(s.officeStories.offices.buzheng.schedule);assert.equal(new Set(values).size,18);const anchors=[...new Set([0,156,...values,...Object.values(s.buzheng.hard.weeks),...OFFICE_CONTENT.buzheng.cases.map(d=>d.week)])].sort((a,b)=>a-b);assert(anchors.slice(1).every((v,i)=>v-anchors[i]<=8));}});
test("通判至布政使108剧情24原篇全局唯一，页面规则和新出处正确",()=>{const all=Object.entries(OFFICE_CONTENT).filter(([key])=>key!=="xunfu").map(([,d])=>d),stories=all.flatMap(d=>d.events),cases=all.flatMap(d=>d.cases);assert.equal(stories.length,108);assert.equal(new Set(stories.map(d=>d.id)).size,108);assert.equal(new Set(stories.map(d=>d.title)).size,108);assert(stories.every(d=>d.maxAppearances===1));assert.equal(cases.length,24);assert.equal(new Set(cases.map(d=>d.source.key)).size,24);const h={esc:String,num:String,scene:()=>"",portrait:()=>"",avatar:()=>"",btn:t=>t,icon:()=>""};const s=bzPlay(start(),{until:20});assert.match(buzhengView(s,h),/郑克《折狱龟鉴》/);assert.match(guideContent(s),/十二项省计承诺/);assert.equal(sourceClueCost(s,"buzheng","BC01","e1").silver,2);});

test("称职门槛要求覆盖三类专款，不能用两类满额与高分抵销另一类空缺",()=>{
 let captured; bzPlay(start(),{onStep:s=>{if(!captured&&s.buzheng.turn===130)captured=structuredClone(s);}});
 // Compare the assessment with an otherwise complete record missing one fund; timeline validation is covered separately.
 const missing=structuredClone(captured);for(const d of BZ_PROMISES.filter(d=>d.fund==="supply"))missing.buzheng.promises[d.id].status="received";
 assert(buzhengAssessment(captured).candidate);assert.equal(Object.values(missing.buzheng.promises).filter(r=>r.status==="closed").length,8);assert(buzhengAssessment(missing).score>=70);assert(!buzhengAssessment(missing).candidate);
});
