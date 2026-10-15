import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { gunzipSync } from "node:zlib";
import { createGame,dispatch,validateSave,VERSION } from "../src/engine.js";
import { CZ_PROJECTS,CZ_EVENTS,CZ_PLANS,czTeams,czTravel,czBudget,canzhengAssessment,canzhengHard } from "../src/canzheng.js";
import { OFFICE_CONTENT,blankOfficeStories,syncOfficeStories } from "../src/office-stories.js";
import { canzhengPrevious,czNext,czPlay } from "./helpers/canzheng.js";
import { act } from "./helpers/career.js";
import { canzhengView } from "../src/canzheng-view.js";
import { guideContent } from "../src/guide.js";
const previous=canzhengPrevious(),hardPrevious=canzhengPrevious(true);
const start=(hard=false)=>act(hard?hardPrevious:previous,"cz_appoint");
const weeks=(s,n)=>{for(let i=0;i<n;i++)s=czNext(s);return s;};
const roundtrip=s=>{const json=JSON.parse(JSON.stringify(s));assert.deepEqual(validateSave(json),json);assert.equal(dispatch(s,{id:s.completedCommands.at(-1),type:"cz_advance"}),s);};

test("参政任命严格衔接副使，公账另拨、私产与府情承接，旧任封存",()=>{
  assert.throws(()=>act(createGame(),"cz_appoint"));
  const s=start();assert.equal(s.version,VERSION);assert.equal(s.canzheng.silver,600);assert.equal(s.canzheng.grain,320);assert.equal(s.canzheng.private,previous.inspector.private);
  assert.equal(s.canzheng.counties.nanze.people,previous.inspector.counties.nanze.people);assert.deepEqual(s.inspector,previous.inspector);
  for(const type of ["cz_appoint","in_appoint","in_advance","zf_advance","tz_advance","pref_advance","advance"])assert.throws(()=>act(s,type));
  assert.equal(start(true).canzheng.silver,350);assert.equal(start(true).canzheng.grain,160);roundtrip(s);
});

test("真实v13副使开局、办理中与考满旧档原样升级，不回放或补发",()=>{
  for(const file of ["standard-start","standard-finished","hard-finished","browser-active"]) {
    const old=JSON.parse(gunzipSync(fs.readFileSync(new URL(`./fixtures/v13-inspector-${file}.json.gz`,import.meta.url))));assert.equal(old.version,13);const n=validateSave(old);assert.equal(n.canzheng,null);
    const stripped=structuredClone(n);stripped.version=13;delete stripped.canzheng;delete stripped.buzheng;delete stripped.xunfu;assert.deepEqual(stripped,old);roundtrip(n);
    if(n.inspector.finished)roundtrip(act(n,"cz_appoint"));
  }
});

test("勘核、呈准、拨出、实到、落实、验收逐段发生，钱粮没有提前入账",()=>{
  let s=act(start(),"cz_event",{choice:"verify"});
  assert.throws(()=>act(s,"cz_project",{project:"CP01",action:"propose",plan:"adapt"}));
  s=act(s,"cz_project",{project:"CP01",action:"survey"});assert.throws(()=>act(s,"cz_project",{project:"CP01",action:"survey"}));
  s=act(s,"cz_project",{project:"CP01",action:"propose",plan:"adapt"});roundtrip(s);
  assert.throws(()=>act(s,"cz_project",{project:"CP01",action:"dispatch"}));s=weeks(s,2);
  const a=structuredClone(s.canzheng),score=canzhengAssessment(s).score;
  s=act(s,"cz_project",{project:"CP01",action:"dispatch"});assert.equal(s.canzheng.silver,a.silver-54);assert.equal(s.canzheng.grain,a.grain-24);assert.equal(s.canzheng.counties.beiling.receivedGrain,0);
  assert.throws(()=>act(s,"cz_project",{project:"CP01",action:"dispatch"}));s=weeks(s,2);assert.equal(s.canzheng.counties.beiling.receivedGrain,24);assert.equal(canzhengAssessment(s).score,score);
  assert.throws(()=>act(s,"cz_project",{project:"CP01",action:"accept"}));s=weeks(s,5);assert.equal(s.canzheng.projects.CP01.status,"ready");assert.equal(canzhengAssessment(s).score,score);
  s=act(s,"cz_project",{project:"CP01",action:"accept"});assert(canzhengAssessment(s).score>score);assert.equal(s.canzheng.counties.beiling.burden,28);assert.throws(()=>act(s,"cz_project",{project:"CP01",action:"accept"}));roundtrip(s);
});

for(const hard of [false,true])for(const policy of ["help","check","delegate"])test(`${hard?"严苛":"常例"}156周完整路线：${policy}剧情、十二施政、四案、八主线各一次`,()=>{
  const s=czPlay(start(hard),{policy,onStep:(s,type)=>{if(type==="cz_advance"&&s.canzheng.turn%13===0)roundtrip(s);}}),b=s.officeStories.offices.canzheng;
  assert(s.canzheng.outcome.candidate);assert.equal(s.canzheng.turn,156);assert.equal(Object.values(s.canzheng.projects).filter(r=>r.status==="closed").length,12);assert.equal(Object.keys(b.main).length,8);assert.equal(Object.keys(b.events).length,18);assert.equal(Object.values(b.cases).filter(r=>r.status==="closed").length,4);
  for(const d of OFFICE_CONTENT.canzheng.events)assert.equal(s.officeStories.counts[d.id],1);
  assert.equal(b.queue.length,0);assert.deepEqual(s.inspector,hard?hardPrevious.inspector:previous.inspector);assert.deepEqual(s.canzheng.outcome,canzhengAssessment(s));assert.throws(()=>act(s,"cz_advance"));roundtrip(s);
});

for(const plan of ["pilot","template"])test(`${plan}方案在钱粮、周期、真实成效和地方负担上有区别`,()=>{
  const s=czPlay(start(),{plan});const q=s.canzheng;
  assert.equal(Object.values(q.projects).filter(r=>r.status==="closed").length,12);
  for(const d of CZ_PROJECTS){const r=q.projects[d.id];assert.deepEqual(r.allocation,czBudget(d,plan));assert.equal(r.ready-r.arrived,CZ_PLANS[plan].weeks);}
  assert.equal(q.counties.beiling.burden,plan==="pilot"?26:42);assert.equal(q.outcome.candidate,plan==="pilot");roundtrip(s);
});

test("两组督办并发限制包含待验收，呈准不占组，库存不足不部分扣账",()=>{
  let s=act(start(),"cz_event",{choice:"refer"});
  for(const id of ["CP01","CP02","CP03"])s=act(s,"cz_project",{project:id,action:"survey"});s=czNext(s);
  for(const id of ["CP01","CP02","CP03"])s=act(s,"cz_project",{project:id,action:"propose",plan:"adapt"});s=weeks(s,2);
  s=act(s,"cz_project",{project:"CP01",action:"dispatch"});s=act(s,"cz_project",{project:"CP02",action:"dispatch"});assert.equal(czTeams(s.canzheng),2);
  assert.throws(()=>act(s,"cz_project",{project:"CP03",action:"dispatch"}));s=weeks(s,8);assert.equal(czTeams(s.canzheng),2);assert.throws(()=>act(s,"cz_project",{project:"CP03",action:"dispatch"}));
  s=act(s,"cz_project",{project:"CP01",action:"accept"});const poor=structuredClone(s);poor.canzheng.grain=0;const snapshot=structuredClone(poor);
  assert.throws(()=>act(poor,"cz_project",{project:"CP03",action:"dispatch"}));assert.deepEqual(poor,snapshot);s=act(s,"cz_project",{project:"CP03",action:"dispatch"});roundtrip(s);
});

test("全部主线选择均可续档，违法有独立责任记录且任满查核",()=>{
  let s=start();for(const e of CZ_EVENTS){s=weeks(s,e.week-s.canzheng.turn);for(const o of e.options){const n=act(s,"cz_event",{choice:o.id});roundtrip(n);if(o.misconduct)assert(n.accountability.incidents.some(i=>i.role==="canzheng"&&i.week===e.week));}s=act(s,"cz_event",{choice:"verify"});}
  let bad=act(start(),"cz_event",{choice:"shortcut"});bad=weeks(bad,156);assert.equal(bad.canzheng.outcome.rating,"候查");assert.equal(bad.accountability.current.status,"inquiry");roundtrip(bad);
});

test("四案草率拟结退回，证据保留，三证呈核后执行归档且不得重领奖",()=>{
  let s=start();for(const d of OFFICE_CONTENT.canzheng.cases){s=weeks(s,d.week-s.canzheng.turn);s=act(s,"office_case",{case:d.id,action:"review",choice:"hasty"});s=weeks(s,2);assert.equal(s.officeStories.offices.canzheng.cases[d.id].status,"returned");
    for(const e of d.clues)s=act(s,"office_case",{case:d.id,action:"clue",clue:e.id});s=czNext(s);s=act(s,"office_case",{case:d.id,action:"review",choice:"evidence"});s=weeks(s,2);s=act(s,"office_case",{case:d.id,action:"execute"});s=weeks(s,2);assert.equal(s.officeStories.offices.canzheng.cases[d.id].status,"closed");assert.throws(()=>act(s,"office_case",{case:d.id,action:"execute"}));roundtrip(s);}
});

test("任末155周可验收，156周来源案到账计考评，逾期不强行启动",()=>{
  let s=act(start(),"cz_event",{choice:"refer"});s=act(s,"cz_project",{project:"CP01",action:"survey"});s=weeks(s,146);s=act(s,"cz_project",{project:"CP01",action:"propose",plan:"adapt"});s=weeks(s,2);s=act(s,"cz_project",{project:"CP01",action:"dispatch"});
  s=weeks(s,4);s=act(s,"cz_event",{choice:"refer"});for(const e of OFFICE_CONTENT.canzheng.cases[3].clues)s=act(s,"office_case",{case:"CC04",action:"clue",clue:e.id});
  // 152周已无精力，下一周呈核会使执行来不及；独立分支精确检查最后4周。
  let terminal=weeks(start(),151);for(const e of OFFICE_CONTENT.canzheng.cases[3].clues)terminal=act(terminal,"office_case",{case:"CC04",action:"clue",clue:e.id});terminal=czNext(terminal);terminal=act(terminal,"cz_event",{choice:"refer"});terminal=act(terminal,"office_case",{case:"CC04",action:"review",choice:"evidence"});terminal=weeks(terminal,2);terminal=act(terminal,"office_case",{case:"CC04",action:"execute"});terminal=weeks(terminal,2);assert.equal(terminal.officeStories.offices.canzheng.cases.CC04.status,"closed");assert.match(terminal.canzheng.outcome.summary,/归档1\/4/);roundtrip(terminal);
  s=weeks(s,3);s=act(s,"cz_project",{project:"CP01",action:"accept"});assert.equal(s.canzheng.projects.CP01.closed,155);s=czNext(s);roundtrip(s);
  let late=weeks(start(),147);late=act(late,"cz_project",{project:"CP02",action:"survey"});assert.throws(()=>act(late,"cz_project",{project:"CP02",action:"propose",plan:"adapt"}));
});

test("闲置路线不漏剧情与案卷，未竟统一交接，无假验收",()=>{
  const s=weeks(start(),156),b=s.officeStories.offices.canzheng;assert(Object.values(s.canzheng.projects).every(r=>r.status==="handover"));assert.equal(Object.keys(b.main).length,8);assert.equal(Object.keys(b.events).length,18);assert(Object.values(b.events).every(r=>r.status==="delegated"));assert(Object.values(b.cases).every(r=>r.status==="handover"));assert(!s.canzheng.outcome.candidate);roundtrip(s);
});

test("改钱粮、批复、实到、拨运流水、重复主线和倒序验收均拒绝导入",()=>{
  const s=czPlay(start(),{until:20});for(const mutate of [n=>n.canzheng.silver++,n=>n.canzheng.counties.beiling.receivedGrain++,n=>n.canzheng.projects.CP01.approved--,n=>n.canzheng.projects.CP01.arrived--,n=>n.canzheng.projects.CP01.closed=0,n=>delete n.officeStories.offices.canzheng.main.C01,n=>n.canzheng.ledger.find(r=>r.title==="CP01拨运钱粮").title="错单"]) {const n=structuredClone(s);mutate(n);assert.throws(()=>validateSave(n));}
});

test("1000个严苛种子十八条叙事均排入，每两处叙事锚点不超过八周",()=>{
  for(let seed=1;seed<=1000;seed++){const s={seed,officeStories:blankOfficeStories(),canzheng:{turn:0,finished:false,logs:[],nextLog:1,hard:canzhengHard(seed)}};syncOfficeStories(s);const values=Object.values(s.officeStories.offices.canzheng.schedule);assert.equal(new Set(values).size,18);const anchors=[...new Set([0,156,...values,...Object.values(s.canzheng.hard.weeks),...OFFICE_CONTENT.canzheng.cases.map(d=>d.week)])].sort((a,b)=>a-b);assert(anchors.slice(1).every((v,i)=>v-anchors[i]<=8));}
});

test("五段扩展共90剧情、20原篇均唯一，参政页面与指南显式列办理规则",()=>{
  const all=Object.entries(OFFICE_CONTENT).filter(([key])=>!["buzheng","xunfu"].includes(key)).map(([,d])=>d),stories=all.flatMap(d=>d.events),cases=all.flatMap(d=>d.cases);assert.equal(stories.length,90);assert.equal(new Set(stories.map(d=>d.id)).size,90);assert.equal(new Set(stories.map(d=>d.title)).size,90);assert.equal(new Set(cases.map(d=>d.source.key)).size,20);
  const h={esc:String,num:String,scene:()=>"",portrait:()=>"",avatar:()=>"",btn:t=>t,icon:()=>""};assert.match(canzhengView(start(),h),/三府施政/);assert.match(guideContent(start()),/十二项三府施政/);
});

// 十项小试恰好折算八项，避免浮点累计让达到门槛的履历误失资格。
test("十项小试达到八项实效门槛，余项如实交接仍可按总分称职",()=>{
  let captured;
  czPlay(start(),{plan:"pilot",onStep:s=>{if(!captured&&Object.values(s.canzheng.projects).filter(r=>r.status==="closed").length===10)captured=structuredClone(s);}});
  assert(captured);
  while(!captured.canzheng.finished)captured=czNext(captured);
  assert.equal(Object.values(captured.canzheng.projects).filter(r=>r.status==="closed").length,10);
  assert.match(captured.canzheng.outcome.summary,/折算8项/);
  assert(captured.canzheng.outcome.candidate);roundtrip(captured);
});
