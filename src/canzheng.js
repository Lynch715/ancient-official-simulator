import { initChallenge, challenged, weeklyAP, CHALLENGE, lateAssessment } from "./career-difficulty.js";
import { CZ_REGIONS, CZ_EVENTS, CZ_PROJECTS, CZ_PLANS } from "./canzheng-data.js";
import { qualified } from "./accountability.js";
import { inspectorAssessment } from "./inspector.js";
import { termLabel } from "./rules.js";
import { familyAllowance } from "./county-content.js";
import { roll } from "./county-hard.js";
import { eventAt, eventWeek, officeDrift, blendIntegrity } from "./office-hard.js";
export { CZ_REGIONS, CZ_EVENTS, CZ_PROJECTS, CZ_PLANS };
export const czLabel = q => termLabel(q.turn, "布政司参政");
const round = n => Math.round(n * 100) / 100;
const clamp = n => Math.max(0, Math.min(100, round(n)));
const log = (q, text) => { q.logs.unshift({ id: q.nextLog++, turn: q.turn, text }); q.logs = q.logs.slice(0, 300); };
function money(q, title, delta) {
  for (const [k,v] of Object.entries(delta)) if (!["silver","grain","private"].includes(k) || !Number.isFinite(v) || q[k] + v < 0) throw Error("可用钱粮不足。");
  for (const [k,v] of Object.entries(delta)) q[k] = round(q[k] + v);
  const row = { turn: q.turn, title, ...delta }; q.ledger.push(row); q.lastLedger.push(row);
}
function pay(q, silver = 0, grain = 0, ap = 1, title = "参政办理") {
  if (q.ap < ap || q.silver < silver || q.grain < grain) throw Error(q.ap < ap ? "本周精力不足。" : "可用钱粮不足。");
  q.ap -= ap;
  if (silver || grain) money(q, title, { silver: -silver, grain: -grain });
}
const enoughTime = (q, n) => { if (q.turn + n > 155) throw Error("本任余期不足以完成验收，须据实交接。"); };
export const czTeams = q => Object.values(q.projects).filter(r => ["transit","implementing","ready"].includes(r.status)).length;
export const czTravel = (q,d) => CZ_REGIONS.find(x => x.id === d.region).days + (q.hard ? 1 : 0);
export const czBudget = (d,plan) => ({ silver: Math.ceil(d.silver * CZ_PLANS[plan].factor), grain: Math.ceil(d.grain * CZ_PLANS[plan].factor) });
export const canzhengHard = seed => ({ seed, weeks: Object.fromEntries(CZ_EVENTS.map(e => [e.id, e.week === 0 || e.week >= 140 ? e.week : e.week + Math.floor(roll(seed, `cz:${e.id}`)*9)-4])), lifeSum: 0, integritySum: 0, weeksCounted: 0 });
function open(q) {
  q.event = eventAt(q,CZ_EVENTS)?.id || null;
  for (const d of CZ_PROJECTS) if (d.week === q.turn && !q.projects[d.id]) {
    q.projects[d.id] = { id:d.id, opened:q.turn, status:"open", surveyed:null, plan:null, proposed:null, approved:null, sent:null, arrived:null, ready:null, closed:null, due:null, allocation:null };
    log(q, `${d.title}列入三府施政簿。须勘核、呈准、拨运、落实并验收；${d.urgent ? "逾26周未验，地方民生每周减0.3。" : "到卷不是完成。"}`);
  }
}
export function appointCanzheng(s) {
  const p = s.inspector;
  if (s.canzheng) throw Error("参政任命已办理。");
  if (!p?.finished || (!inspectorAssessment(s).candidate && !qualified(s,"inspector"))) throw Error("须副使考满称职，或复考恢复资格，才可升任参政。");
  const q = s.canzheng = {
    turn:0, finished:false, ap:3, silver:0, grain:0, private:p.private, integrity:p.integrity, trust:p.trust, misconduct:false, event:null,
    nextLog:1, logs:[], ledger:[], lastLedger:[], projects:{}, outcome:null,
    record:{ silver:p.silver, grain:p.grain, private:p.private, score:p.outcome.score },
    counties:Object.fromEntries(CZ_REGIONS.map(d => [d.id,{ id:d.id,name:d.name,people:p.counties[d.id].people,cooperation:p.counties[d.id].cooperation,burden:30,receivedSilver:0,receivedGrain:0 }])),
    hard:s.difficulty === "hard" && p.hard ? canzhengHard(s.seed) : null,
  };
  initChallenge(s,q,"canzheng");
  money(q,"分守专项钱粮正式核拨",{ silver:challenged(q)?CHALLENGE.canzheng.silver:q.hard ? 350 : 600, grain:challenged(q)?CHALLENGE.canzheng.grain:q.hard ? 160 : 320 });
  open(q); log(q,"升任从三品布政司参政，奉命分守三府，统筹获准的钱粮民政事项。原任公账封存，新专项另拨，私产和三府民生协作承接；不自行更定全省赋制，不终审刑案。方案经批复后才能拨运，只有实到、落实并验收才计成效。");
}
export function canzhengAssessment(s) {
  const q = s.canzheng, closed = Object.values(q.projects).filter(r => r.status === "closed");
  const quality = round(closed.reduce((n,r) => n + CZ_PLANS[r.plan].quality,0)), timely = closed.filter(r => r.closed <= r.opened + 26).length;
  if(challenged(q))return lateAssessment(q,closed,r=>CZ_PLANS[r.plan].quality,blendIntegrity(q));
  const cases = Object.values(s.officeStories.offices.canzheng?.cases || {}).filter(r => r.status === "closed").length;
  const score = Math.round(quality / 12 * 50 + timely / 12 * 10 + cases / 4 * 25 + blendIntegrity(q) * .15);
  const candidate = !q.misconduct && quality >= 8 && score >= (q.hard ? 75 : 70);
  return { score, rating:q.misconduct ? "候查" : candidate ? "称职" : score >= 50 ? "平常" : "不称职", candidate, summary:`施政实际验收${closed.length}/12项，按方案成效折算${round(quality)}项；26周内验收${timely}项，来源案实际归档${cases}/4件。称职须施政成效折算至少8项；在途、回报待验与未竟分别交接。` };
}
export function finalizeCanzheng(s) { if (s.canzheng?.finished) s.canzheng.outcome = canzhengAssessment(s); }
export function canzhengCommand(s,c) {
  const q = s.canzheng;
  if (!q || q.finished) throw Error("尚未任命或参政本任已经考满。");
  q.lastLedger = [];
  if (c.type === "cz_event") {
    const e = CZ_EVENTS.find(e => e.id === q.event), o = e?.options.find(o => o.id === c.choice);
    if (!o) throw Error("本周参政公文或处置无效。");
    pay(q,o.cost.silver || 0,0,o.cost.ap || 0,e.title);
    for (const [k,v] of Object.entries(o.effect)) q[k] = clamp(q[k]+v);
    if (o.misconduct) q.misconduct = true;
    q.event = null; log(q,`${e.title}：${o.label}。钱粮按实际拨运办理，未代记施政成果。`); return;
  }
  if (c.type === "cz_project") {
    const d = CZ_PROJECTS.find(d => d.id === c.project), r = q.projects[c.project];
    if (!d || !r) throw Error("这项差事尚未列入本任。");
    if (c.action === "survey") {
      if (r.status !== "open") throw Error("地方条件已经核过，不能重复勘核。");
      pay(q,4,0,1,d.title+"勘核"); r.surveyed=q.turn; r.status="surveyed"; log(q,`${d.title}勘核：${d.survey}`);
    } else if (c.action === "propose") {
      if (r.status !== "surveyed" || !Object.hasOwn(CZ_PLANS,c.plan)) throw Error("须先勘核，再从三种方案中择定一案呈准。");
      const p=CZ_PLANS[c.plan]; enoughTime(q,2+czTravel(q,d)+p.weeks);
      pay(q,0,0,1); Object.assign(r,{status:"review",plan:c.plan,proposed:q.turn,due:q.turn+2});
      log(q,`${d.title}呈请${p.label}，2周后批复。${c.plan === "adapt" ? d.plan : c.plan === "pilot" ? "缩小试行范围，等待较长观察期。" : "通用章程较快，但不合全地条件，成效仅四成并增负担。"}目前尚未拨银出粮。`);
    } else if (c.action === "dispatch") {
      if (r.status !== "approved" || czTeams(q)>=2) throw Error("须先取得批复，且有空闲督办组。");
      const p=CZ_PLANS[r.plan], budget=czBudget(d,r.plan); enoughTime(q,czTravel(q,d)+p.weeks);
      pay(q,budget.silver,budget.grain,1,d.id+"拨运钱粮"); Object.assign(r,{ status:"transit",sent:q.turn,due:q.turn+czTravel(q,d),allocation:budget });
      log(q,`${d.title}拨出银${budget.silver}两、粮${budget.grain}石，${czTravel(q,d)}周在途；拨出即扣专项库，未计地方实收与成效。`);
    } else if (c.action === "accept") {
      if (r.status !== "ready") throw Error("尚未收到落实回报，或已经验收。");
      pay(q,0,0,1); r.status="closed"; r.closed=q.turn;
      const region=q.counties[d.region], p=CZ_PLANS[r.plan]; region.people=clamp(region.people+p.people); region.cooperation=clamp(region.cooperation+2); region.burden=clamp(region.burden+p.burden); q.integrity=clamp(q.integrity+1);
      log(q,`${d.title}现场验收：${r.plan === "adapt" ? d.result : r.plan === "pilot" ? "小范围试行有实效，其余范围仍留待后续决定，按八成成效入卷。" : "通用章程仅部分适用，按四成成效入卷，地方负担增加。"}本项只验收一次，民生+${p.people}、协作+2、负担${p.burden>0?"+":""}${p.burden}、吏治+1（以实际变化为准）。`);
    } else throw Error("施政操作无效。");
    return;
  }
  if (c.type !== "cz_advance") throw Error("参政操作无效。");
  if (q.event) throw Error("请先处置本周参政公文。");
  money(q,"分守专项每周核拨",{silver:challenged(q)?CHALLENGE.canzheng.weeklySilver:q.hard?5:8,grain:challenged(q)?CHALLENGE.canzheng.weeklyGrain:q.hard?3:4});
  money(q,"参政俸入与家计净额",{private:2+familyAllowance(s)});
  q.turn++;
  for (const d of CZ_PROJECTS) {
    const r=q.projects[d.id]; if (!r) continue;
    if (r.due!==null && r.due<=q.turn) {
      if (r.status === "review") { r.status="approved"; r.approved=q.turn; r.due=null; log(q,`${d.title}方案获准，可拨运；未领款不算实施。`); }
      else if (r.status === "transit") {
        r.status="implementing"; r.arrived=q.turn; r.due=q.turn+CZ_PLANS[r.plan].weeks;
        const region=q.counties[d.region]; region.receivedSilver+=r.allocation.silver; region.receivedGrain+=r.allocation.grain;
        log(q,`${d.title}实到银${r.allocation.silver}两、粮${r.allocation.grain}石，地方签收；开始${CZ_PLANS[r.plan].weeks}周落实，尚未记验收。`);
      } else if (r.status === "implementing") { r.status="ready"; r.ready=q.turn; r.due=null; log(q,`${d.title}落实回报已到，须核对实际成果才能验收。`); }
    }
    if (d.urgent && r.status!=="closed" && q.turn>r.opened+26) q.counties[d.region].people=clamp(q.counties[d.region].people-.3);
  }
  if (q.hard) officeDrift(q,Object.values(q.counties),{people:[55,.006],integrity:[60,.006]});
  if (q.turn===156) {
    q.finished=true; q.ap=0;
    for (const r of Object.values(q.projects)) if (r.status!=="closed") { r.handoverFrom=r.status; r.status="handover"; r.due=null; }
    log(q,"参政三年任满，按实收、实办和实效归卷。未竟差事据实交接，来源案到期回报并入考评。");
  } else { q.ap=weeklyAP(q); open(q); }
}
export function canzhengReceipt(before,after,c) {
  const a=before.canzheng,b=after.canzheng,changes=[];
  const add=(name,x,y)=>{if(x!==y)changes.push({name,before:x,after:y,delta:round(y-x)});};
  if(a) {
    for(const [k,name] of Object.entries({silver:"专项官银",grain:"专项公粮",private:"私产",ap:"精力",integrity:"吏治",trust:"上级信任"})) add(name,a[k],b[k]);
    for(const d of CZ_REGIONS) for(const [k,name] of Object.entries({people:"民生",cooperation:"协作",burden:"地方负担",receivedSilver:"累计实收银",receivedGrain:"累计实收粮"})) add(d.name+" · "+name,a.counties[d.id][k],b.counties[d.id][k]);
  } else { add("分守核拨银",0,b.silver); add("分守核拨粮",0,b.grain); }
  return {id:c.id,chapter:"布政司参政",turn:a?.turn||0,title:c.type==="cz_appoint"?"参政任命已生效":c.type==="cz_advance"?"参政本周结算":"施政办理回执",changes,notes:b.logs.filter(x=>x.id>=(a?.nextLog||1)).reverse().map(x=>x.text),policies:[],ledger:b.lastLedger};
}
export function validateCanzheng(s) {
  const q=s.canzheng; if(q===null)return;
  const fail=()=>{throw Error("参政履历结构、钱粮或办理时序异常。");};
  const num=(x,a=0,b=1e9)=>Number.isFinite(x)&&x>=a&&x<=b, int=(x,a=0,b=156)=>Number.isInteger(x)&&num(x,a,b);
  if(!q || !s.inspector?.finished || (!inspectorAssessment(s).candidate&&!qualified(s,"inspector")) || !int(q.turn) || q.finished!==(q.turn===156) || !int(q.ap,0,3) || (q.finished&&q.ap!==0) || typeof q.misconduct!=="boolean")fail();
  for(const k of ["silver","grain","private","integrity","trust","nextLog"])if(!num(q[k],0,["integrity","trust"].includes(k)?100:1e9))fail();
  if(!q.record || ["silver","grain","private"].some(k=>q.record[k]!==s.inspector[k]) || q.record.score!==s.inspector.outcome.score)fail();
  if(q.hard) {
    if(s.difficulty!=="hard" || !s.inspector.hard || q.hard.seed!==s.seed || JSON.stringify(q.hard.weeks)!==JSON.stringify(canzhengHard(s.seed).weeks) || q.hard.weeksCounted!==q.turn || !num(q.hard.lifeSum,0,q.turn*100) || !num(q.hard.integritySum,0,q.turn*100))fail();
  } else if(q.hard!==null || (s.difficulty==="hard"&&s.inspector.hard))fail();
  const main=s.officeStories.offices.canzheng?.main;
  if(!main || (q.event!==null&&(!CZ_EVENTS.some(e=>e.id===q.event&&eventWeek(q,e)===q.turn)||q.finished)))fail();
  for(const e of CZ_EVENTS) { const w=eventWeek(q,e),r=main[e.id]; if(w<=q.turn&&q.event!==e.id) {if(!r||r.turn!==w||!e.options.some(o=>o.id===r.choice))fail();}else if(r)fail(); }
  if(Object.keys(main).some(id=>!CZ_EVENTS.some(e=>e.id===id)))fail();
  if(!q.counties||Object.keys(q.counties).length!==3||!q.projects||czTeams(q)>2||Object.keys(q.projects).length!==CZ_PROJECTS.filter(d=>d.week<=q.turn).length)fail();
  for(const d of CZ_REGIONS) {
    const r=q.counties[d.id]; if(!r||r.id!==d.id||r.name!==d.name||["people","cooperation","burden"].some(k=>!num(r[k],0,100)))fail();
    for(const [k,a] of [["receivedSilver","silver"],["receivedGrain","grain"]]) {
      const expected=Object.values(q.projects).filter(p=>p.arrived!==null&&CZ_PROJECTS.find(d=>d.id===p.id)?.region===d.id).reduce((n,p)=>n+(p.allocation?.[a]||0),0);
      if(!num(r[k])||r[k]!==expected)fail();
    }
  }
  const phases=["open","surveyed","review","approved","transit","implementing","ready","closed"];
  for(const [id,r] of Object.entries(q.projects)) {
    const d=CZ_PROJECTS.find(d=>d.id===id);
    if(!d||d.week>q.turn||r.id!==id||r.opened!==d.week||![...phases,"handover"].includes(r.status))fail();
    if(r.status==="handover"?!q.finished||!phases.slice(0,-1).includes(r.handoverFrom):q.finished&&r.status!=="closed")fail();
    const status=r.status==="handover"?r.handoverFrom:r.status,phase=phases.indexOf(status),p=CZ_PLANS[r.plan];
    if(phase<2?r.plan!==null:!Object.hasOwn(CZ_PLANS,r.plan))fail();
    for(const [key,min,earliest]of [["surveyed",1,r.opened],["proposed",2,r.surveyed],["approved",3,r.proposed+2],["sent",4,r.approved],["arrived",5,r.sent+czTravel(q,d)],["ready",6,r.arrived+(p?.weeks||0)],["closed",7,r.ready]]) {
      if(phase>=min?!int(r[key],earliest,Math.min(q.turn,155)):r[key]!==null)fail();
    }
    if(phase>=3&&r.approved!==r.proposed+2 || phase>=5&&r.arrived!==r.sent+czTravel(q,d) || phase>=6&&r.ready!==r.arrived+p.weeks)fail();
    if(phase>=2&&r.proposed+2+czTravel(q,d)+p.weeks>155 || phase>=4&&r.sent+czTravel(q,d)+p.weeks>155)fail();
    if(phase<4?r.allocation!==null:!r.allocation||Object.keys(r.allocation).length!==2||["silver","grain"].some(k=>r.allocation[k]!==czBudget(d,r.plan)[k]))fail();
    const due=status==="review"?r.proposed+2:status==="transit"?r.sent+czTravel(q,d):status==="implementing"?r.arrived+p.weeks:null;
    if(r.status==="handover"?r.due!==null:r.due!==due||(r.due!==null&&!int(r.due,q.turn+1,155)))fail();
  }
  if(!Array.isArray(q.logs)||!Array.isArray(q.ledger)||!Array.isArray(q.lastLedger)||q.logs.length>300||q.ledger.length>5000||q.lastLedger.length>100||q.logs.some(r=>!int(r.id,1,q.nextLog-1)||!int(r.turn,0,q.turn)||typeof r.text!=="string")||new Set(q.logs.map(r=>r.id)).size!==q.logs.length)fail();
  for(const r of [...q.ledger,...q.lastLedger])if(!r||!int(r.turn,0,q.turn)||typeof r.title!=="string"||["silver","grain","private"].some(k=>r[k]!==undefined&&!num(r[k],-1e9)))fail();
  for(const k of ["silver","grain","private"])if(Math.abs(round(q.ledger.reduce((n,r)=>n+(r[k]||0),k==="private"?q.record.private:0))-q[k])>.01)fail();
  for(const d of CZ_PROJECTS) { const r=q.projects[d.id],rows=q.ledger.filter(l=>l.title===d.id+"拨运钱粮"); if(r?.sent!==null&&r?.sent!==undefined) {if(rows.length!==1||rows[0].turn!==r.sent||rows[0].silver!==-r.allocation.silver||rows[0].grain!==-r.allocation.grain)fail();}else if(rows.length)fail(); }
  if(q.finished)q.outcome=canzhengAssessment(s);else if(q.outcome!==null)fail();
}
